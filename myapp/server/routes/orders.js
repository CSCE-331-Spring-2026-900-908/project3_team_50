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
//    total: 12.50,
//    tip: 1.25,
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
  const { cashier_name, customer_name, total, tip, items } = req.body;

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
      // Insert Order Detail
      await client.query(
        'INSERT INTO Order_Details (Order_ID, Item_ID, Quantity) VALUES ($1, $2, 1)',
        [newOrderId, item.baseItemId]
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

module.exports = router;
