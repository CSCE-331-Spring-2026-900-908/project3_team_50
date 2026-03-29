const express = require('express');
const router = express.Router();

// ═══════════════════════════════════════════════════════════════════════
//  GET /api/menu/categories
//  → Distinct item categories (mirrors CashierDashboard.getCategories)
// ═══════════════════════════════════════════════════════════════════════
router.get('/categories', async (req, res) => {
  const pool = req.app.locals.pool;
  try {
    const result = await pool.query(
      'SELECT DISTINCT item_category FROM menu_items ORDER BY item_category'
    );
    res.json(result.rows.map((r) => r.item_category));
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

// ═══════════════════════════════════════════════════════════════════════
//  GET /api/menu/items?category=<cat>
//  → Items for a category (mirrors CashierDashboard.getItems)
//    If no category query param → returns all items with ingredient info
// ═══════════════════════════════════════════════════════════════════════
router.get('/items', async (req, res) => {
  const pool = req.app.locals.pool;
  const { category } = req.query;

  try {
    let sql, params;
    if (category) {
      sql = 'SELECT item_id, item_name, item_category, price FROM menu_items WHERE item_category = $1 ORDER BY item_id';
      params = [category];
    } else {
      // Full menu view with ingredient IDs (mirrors MenuManagementPanel.loadMenuItems)
      sql = `
        SELECT m.item_id, m.item_name, m.item_category, m.price,
               STRING_AGG(CAST(j.ingredient_id AS TEXT), ', ' ORDER BY j.ingredient_id) AS ingredients
        FROM menu_items m
        LEFT JOIN menu_items_junction j ON m.item_id = j.menu_item_id
        GROUP BY m.item_id, m.item_name, m.item_category, m.price
        ORDER BY m.item_id`;
      params = [];
    }
    const result = await pool.query(sql, params);
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

// ═══════════════════════════════════════════════════════════════════════
//  GET /api/menu/boba
//  → Boba / Pearl toppings from inventory (mirrors CashierDashboard.addonsPanel)
// ═══════════════════════════════════════════════════════════════════════
router.get('/boba', async (req, res) => {
  const pool = req.app.locals.pool;
  try {
    const result = await pool.query(
      "SELECT inventory_id, name FROM inventory WHERE name LIKE '%Boba%' OR name LIKE '%Pearl%'"
    );
    // Add standardised price to each topping
    const toppings = result.rows.map((r) => ({
      id: r.inventory_id,
      name: r.name,
      price: 0.5,
    }));
    res.json(toppings);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

// ═══════════════════════════════════════════════════════════════════════
//  POST /api/menu/items   (Add new menu item)
//  Body: { item_name, item_category, price, ingredient_ids: [1,5,9] }
// ═══════════════════════════════════════════════════════════════════════
router.post('/items', async (req, res) => {
  const pool = req.app.locals.pool;
  const { item_name, item_category, price, ingredient_ids } = req.body;
  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    // 1. Get next ID
    const idResult = await client.query('SELECT COALESCE(MAX(item_id), 0) + 1 AS next_id FROM menu_items');
    const nextId = idResult.rows[0].next_id;

    // 2. Insert menu item
    await client.query(
      'INSERT INTO menu_items (item_id, item_name, item_category, price) VALUES ($1, $2, $3, $4)',
      [nextId, item_name, item_category, price]
    );

    // 3. Insert junction rows
    if (ingredient_ids && ingredient_ids.length > 0) {
      for (const ingId of ingredient_ids) {
        await client.query(
          'INSERT INTO menu_items_junction (menu_item_id, ingredient_id) VALUES ($1, $2) ON CONFLICT DO NOTHING',
          [nextId, ingId]
        );
      }
    }

    await client.query('COMMIT');
    res.json({ success: true, item_id: nextId });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error(err);
    res.status(500).json({ error: err.message });
  } finally {
    client.release();
  }
});

// ═══════════════════════════════════════════════════════════════════════
//  PUT /api/menu/items/:id   (Update menu item)
//  Body: { item_name, item_category, price, ingredient_ids: [1,5,9] }
// ═══════════════════════════════════════════════════════════════════════
router.put('/items/:id', async (req, res) => {
  const pool = req.app.locals.pool;
  const { id } = req.params;
  const { item_name, item_category, price, ingredient_ids } = req.body;
  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    // 1. Update menu item
    await client.query(
      'UPDATE menu_items SET item_name=$1, item_category=$2, price=$3 WHERE item_id=$4',
      [item_name, item_category, price, id]
    );

    // 2. Replace junction rows
    await client.query('DELETE FROM menu_items_junction WHERE menu_item_id = $1', [id]);
    if (ingredient_ids && ingredient_ids.length > 0) {
      for (const ingId of ingredient_ids) {
        await client.query(
          'INSERT INTO menu_items_junction (menu_item_id, ingredient_id) VALUES ($1, $2) ON CONFLICT DO NOTHING',
          [id, ingId]
        );
      }
    }

    await client.query('COMMIT');
    res.json({ success: true });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error(err);
    res.status(500).json({ error: err.message });
  } finally {
    client.release();
  }
});

// ═══════════════════════════════════════════════════════════════════════
//  DELETE /api/menu/items/:id   (Delete menu item)
// ═══════════════════════════════════════════════════════════════════════
router.delete('/items/:id', async (req, res) => {
  const pool = req.app.locals.pool;
  const { id } = req.params;
  const client = await pool.connect();

  try {
    // Check FK references in order_details
    const check = await client.query('SELECT COUNT(*) FROM order_details WHERE item_id = $1', [id]);
    if (parseInt(check.rows[0].count) > 0) {
      return res.status(409).json({
        error: `Cannot delete: this item is referenced in ${check.rows[0].count} order(s).`,
      });
    }

    await client.query('BEGIN');
    await client.query('DELETE FROM menu_items_junction WHERE menu_item_id = $1', [id]);
    await client.query('DELETE FROM menu_items WHERE item_id = $1', [id]);
    await client.query('COMMIT');
    res.json({ success: true });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error(err);
    res.status(500).json({ error: err.message });
  } finally {
    client.release();
  }
});

module.exports = router;
