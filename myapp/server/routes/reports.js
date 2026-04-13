const express = require('express');
const router = express.Router();

/**
 * Build optional date filter for orders table alias `o` using parameters.
 * Returns { clause: string, params: any[], nextIndex: number }
 */
function ordersDateClause(start, end, paramStartIndex = 1) {
  const params = [];
  let clause = '';
  let i = paramStartIndex;
  if (start) {
    clause += ` AND o.timestamp >= $${i}::timestamp`;
    params.push(`${start} 00:00:00`);
    i += 1;
  }
  if (end) {
    clause += ` AND o.timestamp <= $${i}::timestamp`;
    params.push(`${end} 23:59:59`);
    i += 1;
  }
  return { clause, params, nextIndex: i };
}

/**
 * Same for bare orders (no alias)
 */
function ordersWhereTimestamp(start, end, paramStartIndex = 1) {
  const params = [];
  let clause = '';
  let i = paramStartIndex;
  if (start) {
    clause += ` AND timestamp >= $${i}::timestamp`;
    params.push(`${start} 00:00:00`);
    i += 1;
  }
  if (end) {
    clause += ` AND timestamp <= $${i}::timestamp`;
    params.push(`${end} 23:59:59`);
    i += 1;
  }
  return { clause, params, nextIndex: i };
}

async function ensureZReportsTable(pool) {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS z_reports (
      report_id SERIAL PRIMARY KEY,
      report_date DATE DEFAULT CURRENT_DATE,
      report_time TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      total_sales NUMERIC,
      total_tax NUMERIC,
      cash_sales NUMERIC,
      card_sales NUMERIC
    )
  `);
}

async function ensureCustomQueriesTable(pool) {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS custom_queries (
      query_id SERIAL PRIMARY KEY,
      query_name VARCHAR(255) NOT NULL,
      query_sql TEXT NOT NULL
    )
  `);
}

// GET /api/reports/sales-by-category?start=&end=
router.get('/sales-by-category', async (req, res) => {
  const pool = req.app.locals.pool;
  const { start, end } = req.query;
  const { clause, params } = ordersDateClause(start, end);
  const sql = `
    SELECT m.item_category,
           COUNT(*)::int AS orders,
           SUM(od.quantity)::int AS items_sold,
           SUM(m.price * od.quantity)::float AS revenue
    FROM order_details od
    JOIN menu_items m ON od.item_id = m.item_id
    JOIN orders o ON od.order_id = o.order_id
    WHERE 1 = 1 ${clause}
    GROUP BY m.item_category
    ORDER BY revenue DESC`;
  try {
    const result = await pool.query(sql, params);
    res.json({ title: 'Sales by Category', rows: result.rows, chart: { type: 'pie', valueKey: 'revenue', labelKey: 'item_category' } });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

// GET /api/reports/top-selling?start=&end=
router.get('/top-selling', async (req, res) => {
  const pool = req.app.locals.pool;
  const { start, end } = req.query;
  const { clause, params } = ordersDateClause(start, end);
  const sql = `
    SELECT m.item_name,
           SUM(od.quantity)::int AS total_sold,
           SUM(m.price * od.quantity)::float AS revenue
    FROM order_details od
    JOIN menu_items m ON od.item_id = m.item_id
    JOIN orders o ON od.order_id = o.order_id
    WHERE 1 = 1 ${clause}
    GROUP BY m.item_name
    ORDER BY total_sold DESC
    LIMIT 10`;
  try {
    const result = await pool.query(sql, params);
    res.json({ title: 'Top Selling Items', rows: result.rows, chart: { type: 'pie', valueKey: 'revenue', labelKey: 'item_name' } });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

// GET /api/reports/low-stock
router.get('/low-stock', async (req, res) => {
  const pool = req.app.locals.pool;
  const sql = `
    SELECT name, current_stock, min_stock, unit
    FROM inventory
    WHERE current_stock < min_stock
    ORDER BY (current_stock - min_stock)`;
  try {
    const result = await pool.query(sql);
    res.json({ title: 'Low Stock Items', rows: result.rows, chart: { type: 'bar', labelKey: 'name', valueKey: 'current_stock' } });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

// GET /api/reports/revenue?start=&end=
router.get('/revenue', async (req, res) => {
  const pool = req.app.locals.pool;
  const { start, end } = req.query;
  const { clause, params } = ordersWhereTimestamp(start, end);
  const sql = `
    SELECT COUNT(*)::int AS order_count, COALESCE(SUM(total), 0)::float AS total_revenue
    FROM orders
    WHERE 1 = 1 ${clause}`;
  try {
    const summary = await pool.query(sql, params);
    const hourlySql = `
      SELECT DATE(timestamp) AS date,
             EXTRACT(HOUR FROM timestamp)::int AS hour,
             COUNT(*)::int AS orders,
             COALESCE(SUM(total), 0)::float AS revenue
      FROM orders
      WHERE 1 = 1 ${clause}
      GROUP BY DATE(timestamp), EXTRACT(HOUR FROM timestamp)
      ORDER BY date, hour`;
    const hourly = await pool.query(hourlySql, params);
    res.json({
      title: 'Revenue',
      summary: summary.rows[0] || {},
      hourly: hourly.rows,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

// GET /api/reports/employee-summary?start=&end=
router.get('/employee-summary', async (req, res) => {
  const pool = req.app.locals.pool;
  const { start, end } = req.query;
  const joinParts = ['e.employee_id = o.employee_id'];
  const params = [];
  let i = 1;
  if (start) {
    joinParts.push(`o.timestamp >= $${i}::timestamp`);
    params.push(`${start} 00:00:00`);
    i += 1;
  }
  if (end) {
    joinParts.push(`o.timestamp <= $${i}::timestamp`);
    params.push(`${end} 23:59:59`);
    i += 1;
  }
  const onClause = joinParts.join(' AND ');
  const sql = `
    SELECT e.name, e.role, e.hourly_rate::float AS hourly_rate,
           COUNT(o.order_id)::int AS orders_processed,
           COALESCE(SUM(o.total), 0)::float AS total_sales
    FROM employees e
    LEFT JOIN orders o ON ${onClause}
    GROUP BY e.employee_id, e.name, e.role, e.hourly_rate
    ORDER BY total_sales DESC`;
  try {
    const result = await pool.query(sql, params);
    res.json({ title: 'Employee Summary', rows: result.rows, chart: { type: 'bar', labelKey: 'name', valueKey: 'total_sales' } });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

// GET /api/reports/product-usage?start=&end=
router.get('/product-usage', async (req, res) => {
  const pool = req.app.locals.pool;
  const { start, end } = req.query;
  const { clause, params } = ordersDateClause(start, end);
  const sql = `
    SELECT i.name AS ingredient, SUM(od.quantity)::int AS total_used
    FROM orders o
    JOIN order_details od ON o.order_id = od.order_id
    JOIN menu_items_junction mj ON od.item_id = mj.menu_item_id
    JOIN inventory i ON mj.ingredient_id = i.inventory_id
    WHERE 1 = 1 ${clause}
    GROUP BY i.name
    ORDER BY total_used DESC`;
  try {
    const result = await pool.query(sql, params);
    res.json({ title: 'Product Usage', rows: result.rows, chart: { type: 'bar', labelKey: 'ingredient', valueKey: 'total_used' } });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

async function getLastZReportTime(pool) {
  await ensureZReportsTable(pool);
  const r = await pool.query('SELECT MAX(report_time) AS t FROM z_reports');
  if (r.rows[0] && r.rows[0].t) {
    return r.rows[0].t;
  }
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
}

// GET /api/reports/x-report
router.get('/x-report', async (req, res) => {
  const pool = req.app.locals.pool;
  try {
    await ensureZReportsTable(pool);
    const lastZ = await getLastZReportTime(pool);

    let totals;
    try {
      totals = await pool.query(
        `SELECT COUNT(*)::int AS orders,
                COALESCE(SUM(total), 0)::float AS total_sales,
                COALESCE(SUM(COALESCE(tax, 0)), 0)::float AS total_tax,
                COALESCE(SUM(CASE WHEN payment_method = 'Cash' THEN total ELSE 0 END), 0)::float AS cash_sales,
                COALESCE(SUM(CASE WHEN payment_method = 'Card' THEN total ELSE 0 END), 0)::float AS card_sales
         FROM orders WHERE timestamp > $1`,
        [lastZ]
      );
    } catch (e) {
      totals = await pool.query(
        `SELECT COUNT(*)::int AS orders,
                COALESCE(SUM(total), 0)::float AS total_sales,
                0::float AS total_tax,
                0::float AS cash_sales,
                0::float AS card_sales
         FROM orders WHERE timestamp > $1`,
        [lastZ]
      );
    }

    const hourly = await pool.query(
      `SELECT EXTRACT(HOUR FROM timestamp)::int AS hour,
              COUNT(*)::int AS orders,
              COALESCE(SUM(total), 0)::float AS sales
       FROM orders WHERE timestamp > $1
       GROUP BY hour ORDER BY hour`,
      [lastZ]
    );

    res.json({
      title: 'X-Report',
      since: lastZ,
      totals: totals.rows[0],
      hourly: hourly.rows,
      chart: { type: 'bar', labelKey: 'hour', valueKey: 'sales', labelFormat: 'hour' },
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

// GET /api/reports/z-report/status
router.get('/z-report/status', async (req, res) => {
  const pool = req.app.locals.pool;
  try {
    await ensureZReportsTable(pool);
    const r = await pool.query(
      'SELECT * FROM z_reports WHERE report_date = CURRENT_DATE ORDER BY report_time DESC LIMIT 1'
    );
    res.json({ alreadyToday: r.rows.length > 0, row: r.rows[0] || null });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

// POST /api/reports/z-report  (end-of-day close — logs row like Project 2)
router.post('/z-report', async (req, res) => {
  const pool = req.app.locals.pool;
  const client = await pool.connect();
  try {
    await ensureZReportsTable(pool);

    const dup = await client.query(
      'SELECT * FROM z_reports WHERE report_date = CURRENT_DATE LIMIT 1'
    );
    if (dup.rows.length > 0) {
      return res.json({
        alreadyLogged: true,
        row: dup.rows[0],
        message: 'Z-Report already generated for today.',
      });
    }

    const lastZ = await getLastZReportTime(pool);

    let totals;
    try {
      totals = await client.query(
        `SELECT COALESCE(SUM(total), 0)::float AS total_sales,
                COALESCE(SUM(COALESCE(tax, 0)), 0)::float AS total_tax,
                COALESCE(SUM(CASE WHEN payment_method = 'Cash' THEN total ELSE 0 END), 0)::float AS cash_sales,
                COALESCE(SUM(CASE WHEN payment_method = 'Card' THEN total ELSE 0 END), 0)::float AS card_sales,
                COUNT(*)::int AS orders
         FROM orders WHERE timestamp > $1`,
        [lastZ]
      );
    } catch (e) {
      totals = await client.query(
        `SELECT COALESCE(SUM(total), 0)::float AS total_sales,
                0::float AS total_tax,
                0::float AS cash_sales,
                0::float AS card_sales,
                COUNT(*)::int AS orders
         FROM orders WHERE timestamp > $1`,
        [lastZ]
      );
    }

    const t = totals.rows[0];
    await client.query(
      `INSERT INTO z_reports (total_sales, total_tax, cash_sales, card_sales) VALUES ($1, $2, $3, $4)`,
      [t.total_sales, t.total_tax, t.cash_sales, t.card_sales]
    );

    const hourly = await client.query(
      `SELECT EXTRACT(HOUR FROM timestamp)::int AS hour,
              COUNT(*)::int AS orders,
              COALESCE(SUM(total), 0)::float AS sales
       FROM orders WHERE timestamp > $1
       GROUP BY hour ORDER BY hour`,
      [lastZ]
    );

    res.json({
      title: 'Z-Report',
      since: lastZ,
      totals: t,
      hourly: hourly.rows,
      chart: { type: 'bar', labelKey: 'hour', valueKey: 'sales', labelFormat: 'hour' },
      logged: true,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  } finally {
    client.release();
  }
});

// --- Custom queries (Project 2 parity) ---

router.get('/custom-queries', async (req, res) => {
  const pool = req.app.locals.pool;
  try {
    await ensureCustomQueriesTable(pool);
    const r = await pool.query(
      'SELECT query_id, query_name, query_sql FROM custom_queries ORDER BY query_name'
    );
    res.json(r.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

router.post('/custom-queries', async (req, res) => {
  const pool = req.app.locals.pool;
  const { query_name, query_sql } = req.body;
  if (!query_name || !query_sql || !String(query_sql).trim().toUpperCase().startsWith('SELECT')) {
    return res.status(400).json({ error: 'Name and SELECT query_sql are required.' });
  }
  try {
    await ensureCustomQueriesTable(pool);
    await pool.query(
      'INSERT INTO custom_queries (query_name, query_sql) VALUES ($1, $2)',
      [query_name.trim(), query_sql.trim()]
    );
    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

router.delete('/custom-queries/:id', async (req, res) => {
  const pool = req.app.locals.pool;
  try {
    await pool.query('DELETE FROM custom_queries WHERE query_id = $1', [req.params.id]);
    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

router.get('/custom-queries/:id/run', async (req, res) => {
  const pool = req.app.locals.pool;
  try {
    await ensureCustomQueriesTable(pool);
    const q = await pool.query('SELECT query_sql FROM custom_queries WHERE query_id = $1', [
      req.params.id,
    ]);
    if (q.rows.length === 0) {
      return res.status(404).json({ error: 'Query not found' });
    }
    const sql = q.rows[0].query_sql.trim();
    if (!sql.toUpperCase().startsWith('SELECT')) {
      return res.status(400).json({ error: 'Only SELECT queries are allowed.' });
    }
    const result = await pool.query(sql);
    res.json({ columns: result.fields.map((f) => f.name), rows: result.rows });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
