const express = require('express');
const router = express.Router();

let cachedHasIsActive = null;

async function employeesHasIsActiveColumn(pool) {
  if (cachedHasIsActive !== null) return cachedHasIsActive;
  const r = await pool.query(
    `SELECT 1 FROM information_schema.columns
     WHERE table_schema = 'public' AND table_name = 'employees' AND column_name = 'is_active'
     LIMIT 1`
  );
  cachedHasIsActive = r.rows.length > 0;
  return cachedHasIsActive;
}

// GET /api/employees
router.get('/', async (req, res) => {
  const pool = req.app.locals.pool;
  try {
    const hasActive = await employeesHasIsActiveColumn(pool);
    const sql = hasActive
      ? `SELECT employee_id, name, role, hourly_rate, pin, is_active
         FROM employees
         WHERE COALESCE(is_active, true) = true
         ORDER BY employee_id`
      : `SELECT employee_id, name, role, hourly_rate, pin
         FROM employees
         ORDER BY employee_id`;
    const result = await pool.query(sql);
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

// POST /api/employees
router.post('/', async (req, res) => {
  const pool = req.app.locals.pool;
  const { name, role, hourly_rate, pin } = req.body;
  if (!name || !role || pin === undefined || pin === null || hourly_rate === undefined) {
    return res.status(400).json({ error: 'name, role, hourly_rate, and pin are required' });
  }
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const idResult = await client.query(
      'SELECT COALESCE(MAX(employee_id), 0) + 1 AS next_id FROM employees'
    );
    const nextId = idResult.rows[0].next_id;
    const hasActive = await employeesHasIsActiveColumn(pool);

    if (hasActive) {
      await client.query(
        `INSERT INTO employees (employee_id, name, role, hourly_rate, pin, is_active)
         VALUES ($1, $2, $3, $4, $5, true)`,
        [nextId, name, role, parseFloat(hourly_rate), String(pin)]
      );
    } else {
      await client.query(
        `INSERT INTO employees (employee_id, name, role, hourly_rate, pin)
         VALUES ($1, $2, $3, $4, $5)`,
        [nextId, name, role, parseFloat(hourly_rate), String(pin)]
      );
    }
    await client.query('COMMIT');
    res.json({ success: true, employee_id: nextId });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error(err);
    res.status(500).json({ error: err.message });
  } finally {
    client.release();
  }
});

// PUT /api/employees/:id
router.put('/:id', async (req, res) => {
  const pool = req.app.locals.pool;
  const { id } = req.params;
  const { name, role, hourly_rate, pin } = req.body;
  try {
    await pool.query(
      `UPDATE employees SET name = $1, role = $2, hourly_rate = $3, pin = $4
       WHERE employee_id = $5`,
      [name, role, parseFloat(hourly_rate), String(pin), id]
    );
    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

// DELETE /api/employees/:id  — soft "fire" when is_active exists, else hard delete with FK checks
router.delete('/:id', async (req, res) => {
  const pool = req.app.locals.pool;
  const { id } = req.params;
  const client = await pool.connect();

  try {
    const ordersCheck = await client.query(
      'SELECT COUNT(*)::int AS c FROM orders WHERE employee_id = $1',
      [id]
    );
    if (ordersCheck.rows[0].c > 0) {
      return res.status(409).json({
        error: `Cannot remove employee: referenced in ${ordersCheck.rows[0].c} order(s).`,
      });
    }

    try {
      const restockCheck = await client.query(
        'SELECT COUNT(*)::int AS c FROM restock_orders WHERE employee_id = $1',
        [id]
      );
      if (restockCheck.rows[0].c > 0) {
        return res.status(409).json({
          error: `Cannot remove employee: referenced in ${restockCheck.rows[0].c} restock order(s).`,
        });
      }
    } catch (e) {
      if (!String(e.message || '').includes('does not exist')) {
        throw e;
      }
    }

    const hasActive = await employeesHasIsActiveColumn(pool);
    if (hasActive) {
      await client.query('UPDATE employees SET is_active = false WHERE employee_id = $1', [id]);
    } else {
      await client.query('DELETE FROM employees WHERE employee_id = $1', [id]);
    }
    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  } finally {
    client.release();
  }
});

module.exports = router;
