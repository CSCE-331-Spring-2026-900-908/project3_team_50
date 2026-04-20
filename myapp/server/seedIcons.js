const { Pool } = require('pg');
require('dotenv').config({ path: '/home/brittonmcl/project3_team_50/myapp/.env' });

const pool = new Pool({
  user: process.env.PSQL_USER || process.env.DB_USER,
  host: process.env.PSQL_HOST || process.env.DB_HOST,
  database: process.env.PSQL_DATABASE || process.env.DB_NAME,
  password: process.env.PSQL_PASSWORD || process.env.DB_PASSWORD,
  port: process.env.PSQL_PORT || process.env.DB_PORT || 5432,
  ssl: { rejectUnauthorized: false }
});

async function run() {
  const map = {
    // Teas / Boba
    "The OG Brown Sugar Deerskin": { teaColor: "#935029", milkColor: "#EAD2B2", waveComplexity: 2, hasIce: true, hasBoba: true },
    "Taro Cloud": { teaColor: "#8D7992", milkColor: "#C9AECE", waveComplexity: 1, hasIce: true, hasBoba: true },
    "Earl Grey Lavender": { teaColor: "#6C5B7B", milkColor: "#A5A5BA", waveComplexity: 1, hasIce: true, hasBoba: true },
    "Hokkaido Toffee Milk Tea": { teaColor: "#B07436", milkColor: "#EED7BA", waveComplexity: 1, hasIce: true, hasBoba: true },
    "Sunrise Passion": { teaColor: "#E3A736", milkColor: "#FBD67A", waveComplexity: 0, hasIce: true, hasBoba: false },
    "Strawberry Matcha Latte": { teaColor: "#748641", milkColor: "#F4B8B9", waveComplexity: 2, hasIce: true, hasBoba: true },
    "Lychee Rose Refresher": { teaColor: "#D47575", milkColor: "#EBB6B6", waveComplexity: 0, hasIce: true, hasBoba: false },
    "Wintermelon Zen": { teaColor: "#C68E42", milkColor: "#EBB366", waveComplexity: 0, hasIce: true, hasBoba: false },
    "Crème Brûlée Dirty Milk": { teaColor: "#C19A6B", milkColor: "#FFFDD0", waveComplexity: 2, hasIce: true, hasBoba: true },
    "Matcha Mango Swirl": { teaColor: "#748641", milkColor: "#FEE287", waveComplexity: 2, hasIce: true, hasBoba: true },
    "Ube Cheesecake Swirl": { teaColor: "#5B3B70", milkColor: "#9B7EB0", waveComplexity: 2, hasIce: true, hasBoba: true },
    "Cookies & Cream Storm": { teaColor: "#363636", milkColor: "#E8E8E8", waveComplexity: 2, hasIce: true, hasBoba: true },
    "Mango Pomelo Sago": { teaColor: "#EBB336", milkColor: "#FEE287", waveComplexity: 1, hasIce: false, hasBoba: false },
    "Avocado Dream": { teaColor: "#8C9950", milkColor: "#C0DE5D", waveComplexity: 1, hasIce: false, hasBoba: false },
    "Peach Oolong Slush": { teaColor: "#E0835B", milkColor: "#FCBB9F", waveComplexity: 1, hasIce: false, hasBoba: false },
    "Thai Tea Frappe": { teaColor: "#D96C2B", milkColor: "#FFA461", waveComplexity: 1, hasIce: false, hasBoba: true }
  };

  const client = await pool.connect();
  try {
    for (const [name, config] of Object.entries(map)) {
      const res = await client.query('UPDATE menu_items SET icon_config = $1 WHERE item_name ILIKE $2', [JSON.stringify(config), `%${name}%`]);
      if (res.rowCount > 0) {
        console.log(`Updated ${name}`);
      }
    }
  } catch(e) {
    console.error(e);
  } finally {
    client.release();
    pool.end();
  }
}
run();
