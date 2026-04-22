const express = require('express');
const router = express.Router();

// ═══════════════════════════════════════════════════════════════════════
//  POST /api/orders
//  → Process a complete checkout transaction
//  Mirrors CashierDashboard.processCheckout()
//
//  Body:
//  {
//    cashier_name: "John",
//    customer_name: "Walk-in",
//    customer_id: 5,  // optional
//    total: 12.50,
//    subtotal: 10.50,  // optional, used for points calculation
//    tip: 1.25,
//    points_used: 0,  // optional
//    discount_applied: false,  // optional
//    items: [
//      {
//        baseItemId: 3,
//        bobaInventoryId: 12,  // -1 means no boba
//      },
//      ...
//    ]
//  }
// ═══════════════════════════════════════════════════════════════════════
router.post('/', async (req, res) => {
  const pool = req.app.locals.pool;
  const { cashier_name, customer_name, customer_id, total, subtotal, tip, points_used, points_redeemed, discount_applied, items } = req.body;

  if (!items || items.length === 0) {
    return res.status(400).json({ error: 'No items in order' });
  }

  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    // 1. Get Employee ID from cashier name
    let empId = 1; // Default
    const empResult = await client.query(
      'SELECT employee_id FROM employees WHERE name = $1 LIMIT 1',
      [cashier_name || 'Walk-in']
    );
    if (empResult.rows.length > 0) {
      empId = empResult.rows[0].employee_id;
    }

    // 2. Insert Order
    const finalTotal = (total || 0) + (tip || 0);
    const orderResult = await client.query(
      'INSERT INTO Orders (Cus_name, Employee_ID, TimeStamp, Total) VALUES ($1, $2, CURRENT_TIMESTAMP, $3) RETURNING Order_ID',
      [customer_name || 'Walk-in', empId, finalTotal]
    );
    const newOrderId = orderResult.rows[0].order_id;

    // 3. Process each item — insert order details & deduct inventory
    for (const item of items) {
      // Insert Order Detail with customizations stored as JSON
      const customizations = {
        boba: item.boba,
        bobaInventoryId: item.bobaInventoryId,
        ice: item.ice,
        sweetness: item.sweetness,
        iconConfig: item.iconConfig,
      };
      
      await client.query(
        'INSERT INTO Order_Details (Order_ID, Item_ID, Quantity, customizations) VALUES ($1, $2, 1, $3)',
        [newOrderId, item.baseItemId, JSON.stringify(customizations)]
      );

      // Fetch base recipe ingredients from junction table & deduct
      const ingrResult = await client.query(
        'SELECT ingredient_id FROM menu_items_junction WHERE menu_item_id = $1',
        [item.baseItemId]
      );
      for (const row of ingrResult.rows) {
        await client.query(
          'UPDATE inventory SET current_stock = current_stock - 1 WHERE inventory_id = $1',
          [row.ingredient_id]
        );
      }

      // Deduct boba topping if chosen
      if (item.bobaInventoryId && item.bobaInventoryId !== -1) {
        await client.query(
          'UPDATE inventory SET current_stock = current_stock - 1 WHERE inventory_id = $1',
          [item.bobaInventoryId]
        );
      }
    }

    // 4. Handle customer loyalty points (if customer_id provided)
    if (customer_id) {
      const baseSubtotal = subtotal || total;
      const ptsRedeemed = points_redeemed || points_used || 0;
      // Earn 1 point per dollar of subtotal (after applying any discounts from redemption)
      const earnedPoints = discount_applied ? 0 : Math.floor(baseSubtotal);
      const newPoints = Math.max(0, earnedPoints - ptsRedeemed);

      // Get current customer info
      const customerRes = await client.query(
        'SELECT points, past_orders FROM customer WHERE cus_id = $1',
        [customer_id]
      );

      if (customerRes.rows.length > 0) {
        const customer = customerRes.rows[0];
        const currentPoints = (customer.points || 0) + newPoints;
        const currentPastOrders = customer.past_orders || '';
        
        // Add new order to past_orders list (max 3)
        let pastOrdersList = currentPastOrders ? currentPastOrders.split(',').map(id => id.trim()) : [];
        pastOrdersList = [newOrderId.toString(), ...pastOrdersList].slice(0, 3);
        const updatedPastOrders = pastOrdersList.join(',');

        // Update customer with new points and past orders
        await client.query(
          'UPDATE customer SET points = $1, past_orders = $2 WHERE cus_id = $3',
          [currentPoints, updatedPastOrders, customer_id]
        );
      }
    }

    await client.query('COMMIT');
    res.json({ success: true, order_id: newOrderId });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error(err);
    res.status(500).json({ error: err.message });
  } finally {
    client.release();
  }
});

// ═══════════════════════════════════════════════════════════════════════
//  GET /api/orders/:orderId
//  → Retrieve order details for reorder functionality with all customizations
// ═══════════════════════════════════════════════════════════════════════
router.get('/:orderId', async (req, res) => {
  const pool = req.app.locals.pool;
  const { orderId } = req.params;

  try {
    // Get order header
    const orderRes = await pool.query(
      'SELECT Order_ID, Cus_name, Total FROM Orders WHERE Order_ID = $1',
      [orderId]
    );

    if (orderRes.rows.length === 0) {
      return res.status(404).json({ error: 'Order not found' });
    }

    // Get order items with details and customizations
    const itemsRes = await pool.query(
      `SELECT od.Item_ID, od.customizations, mi.item_name, mi.price, mi.icon_config
       FROM Order_Details od
       JOIN menu_items mi ON od.Item_ID = mi.item_id
       WHERE od.Order_ID = $1`,
      [orderId]
    );

    const items = itemsRes.rows.map((row) => {
      let customizations = {};
      try {
        customizations = row.customizations ? JSON.parse(row.customizations) : {};
      } catch (e) {
        console.error('Failed to parse customizations:', e);
      }

      return {
        baseItemId: row.item_id,
        name: row.item_name,
        basePrice: parseFloat(row.price),
        iconConfig: row.icon_config,
        bobaInventoryId: customizations.bobaInventoryId || -1,
        boba: customizations.boba || 'No Boba',
        bobaPrice: customizations.bobaInventoryId && customizations.bobaInventoryId !== -1 ? 0.5 : 0,
        ice: customizations.ice || 'Regular Ice',
        sweetness: customizations.sweetness || 'Regular Sweet',
      };
    });

    res.json({
      order_id: orderRes.rows[0].order_id,
      customer_name: orderRes.rows[0].cus_name,
      total: parseFloat(orderRes.rows[0].total),
      items,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
