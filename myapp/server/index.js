const express = require('express');
const cors = require('cors');
const { Pool } = require('pg');
const dotenv = require('dotenv');

// Load .env from the server directory
dotenv.config({ path: __dirname + '/.env' });

// ── Express setup ──────────────────────────────────────────────────────
const app = express();
const port = process.env.PORT || 3001;

app.use(cors());
app.use(express.json());

// ── PostgreSQL pool ────────────────────────────────────────────────────
const pool = new Pool({
  user: process.env.PSQL_USER,
  host: process.env.PSQL_HOST,
  database: process.env.PSQL_DATABASE,
  password: process.env.PSQL_PASSWORD,
  port: process.env.PSQL_PORT,
  ssl: { rejectUnauthorized: false },
});

// Make pool accessible to route files
app.locals.pool = pool;

// ── Routes ─────────────────────────────────────────────────────────────
const authRoutes = require('./routes/auth');
const menuRoutes = require('./routes/menu');
const orderRoutes = require('./routes/orders');

app.use('/api/auth', authRoutes);
app.use('/api/menu', menuRoutes);
app.use('/api/orders', orderRoutes);

// Health-check endpoint
app.get('/api/health', async (req, res) => {
  try {
    const result = await pool.query('SELECT NOW()');
    res.json({ status: 'ok', time: result.rows[0].now });
  } catch (err) {
    res.status(500).json({ status: 'error', message: err.message });
  }
});

// ── Graceful shutdown ──────────────────────────────────────────────────
process.on('SIGINT', () => {
  pool.end();
  console.log('Application successfully shut down');
  process.exit(0);
});

app.listen(port, () => {
  console.log(`Boba POS API listening at http://localhost:${port}`);
});
