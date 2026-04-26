const express = require('express');
const router = express.Router();

// ═══════════════════════════════════════════════════════════════════════
//  Mapping functions for customization levels
// ═══════════════════════════════════════════════════════════════════════
// Ice level: 0=No Ice, 1=Less Ice, 2=Regular Ice, 3=More Ice
const iceTextToNum = {
  'No Ice': 0,
  'Less Ice': 1,
  'Regular Ice': 2,
  'More Ice': 3,
};

const iceNumToText = {
  0: 'No Ice',
  1: 'Less Ice',
  2: 'Regular Ice',
  3: 'More Ice',
};

// Sweet level: 1=Less Sweet, 2=Regular Sweet, 3=More Sweet
const sweetTextToNum = {
  'Less Sweet': 1,
  'Regular Sweet': 2,
  'More Sweet': 3,
};

const sweetNumToText = {
  1: 'Less Sweet',
  2: 'Regular Sweet',
  3: 'More Sweet',
};

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
//        ice: "Regular Ice",
//        sweetness: "Regular Sweet"
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
      // Convert customization text values to numeric values
      const toppingId = item.bobaInventoryId && item.bobaInventoryId !== -1 ? item.bobaInventoryId : null;
      const iceLevel = iceTextToNum[item.ice || 'Regular Ice'] ?? 2; // Default to 2 (Regular Ice)
      const sweetLevel = sweetTextToNum[item.sweetness || 'Regular Sweet'] ?? 2; // Default to 2 (Regular Sweet)
      
      await client.query(
        'INSERT INTO Order_Details (Order_ID, Item_ID, Quantity, topping_id, ice_level, sweet_level) VALUES ($1, $2, 1, $3, $4, $5)',
        [newOrderId, item.baseItemId, toppingId, iceLevel, sweetLevel]
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
        const currentPoints = (parseInt(customer.points, 10) || 0) + newPoints;
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
      `SELECT od.item_id, od.topping_id, od.ice_level, od.sweet_level, mi.item_name, mi.price, mi.icon_config, inv.name as topping_name
       FROM order_details od
       JOIN menu_items mi ON od.item_id = mi.item_id
       LEFT JOIN inventory inv ON od.topping_id = inv.inventory_id
       WHERE od.order_id = $1`,
      [orderId]
    );

    const items = itemsRes.rows.map((row) => {
      // Convert numeric values back to text and construct response object
      const bobaInventoryId = row.topping_id || -1;
      const bobaPrice = bobaInventoryId && bobaInventoryId !== -1 ? 0.5 : 0;
      const ice = iceNumToText[row.ice_level] || 'Regular Ice';
      const sweetness = sweetNumToText[row.sweet_level] || 'Regular Sweet';
      const bobaName = row.topping_name || 'No Boba';

      return {
        baseItemId: row.item_id,
        name: row.item_name,
        basePrice: parseFloat(row.price),
        iconConfig: row.icon_config,
        bobaInventoryId,
        boba: bobaInventoryId && bobaInventoryId !== -1 ? bobaName : 'No Boba',
        bobaPrice,
        ice,
        sweetness,
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
