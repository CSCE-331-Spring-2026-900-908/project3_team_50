const express = require('express');
const router = express.Router();

// GET /api/inventory/items
router.get('/items', async (req, res) => {
  const pool = req.app.locals.pool;
  try {
    const result = await pool.query(
      `SELECT inventory_id, name, current_stock, max_stock, min_stock, unit, unit_cost
       FROM inventory
       ORDER BY inventory_id`
    );
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

// POST /api/inventory/items
router.post('/items', async (req, res) => {
  const pool = req.app.locals.pool;
  const { name, current_stock, max_stock, min_stock, unit, unit_cost } = req.body;
  const client = await pool.connect();

  try {
    await client.query('BEGIN');
    const idResult = await client.query(
      'SELECT COALESCE(MAX(inventory_id), 0) + 1 AS next_id FROM inventory'
    );
    const nextId = idResult.rows[0].next_id;

    await client.query(
      `INSERT INTO inventory (inventory_id, name, current_stock, max_stock, min_stock, unit, unit_cost)
       VALUES ($1, $2, $3, $4, $5, $6, $7)`,
      [nextId, name, current_stock, max_stock, min_stock, unit]
    );

    await client.query('COMMIT');
    res.json({ success: true, inventory_id: nextId });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error(err);
    res.status(500).json({ error: err.message });
  } finally {
    client.release();
  }
});

// PUT /api/inventory/items/:id
router.put('/items/:id', async (req, res) => {
  const pool = req.app.locals.pool;
  const { id } = req.params;
  const { name, current_stock, max_stock, min_stock, unit, unit_cost } = req.body;

  try {
    await pool.query(
      `UPDATE inventory
       SET name = $1, current_stock = $2, max_stock = $3, min_stock = $4, unit = $5, unit_cost = $6
       WHERE inventory_id = $7`,
      [name, current_stock, max_stock, min_stock, unit, unit_cost, id]
    );
    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

// DELETE /api/inventory/items/:id
router.delete('/items/:id', async (req, res) => {
  const pool = req.app.locals.pool;
  const { id } = req.params;
  const client = await pool.connect();

  try {
    const check = await client.query(
      'SELECT COUNT(*) FROM restock_orders WHERE ingredient_id = $1',
      [id]
    );

    if (parseInt(check.rows[0].count, 10) > 0) {
      return res.status(409).json({
        error: `Cannot delete: this inventory item is referenced in ${check.rows[0].count} restock order(s).`,
      });
    }

    await client.query('DELETE FROM inventory WHERE inventory_id = $1', [id]);
    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  } finally {
    client.release();
  }
});

module.exports = router;
