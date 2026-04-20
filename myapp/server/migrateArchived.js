require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const path = require('path');
const { Pool } = require('pg');

const pool = new Pool({
  user: process.env.PSQL_USER,
  host: process.env.PSQL_HOST,
  database: process.env.PSQL_DATABASE,
  password: process.env.PSQL_PASSWORD,
  port: process.env.PSQL_PORT,
  ssl: { rejectUnauthorized: false }
});


async function migrate() {
  try {
    console.log("Adding is_archived column to menu_items...");
    await pool.query('ALTER TABLE menu_items ADD COLUMN IF NOT EXISTS is_archived BOOLEAN DEFAULT FALSE;');
    console.log("Migration successful!");
  } catch (error) {
    console.error("Migration failed:");
    console.error(error);
  } finally {
    pool.end();
  }
}

migrate();
