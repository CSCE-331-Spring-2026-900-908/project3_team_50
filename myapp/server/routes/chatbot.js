const express = require('express');

const router = express.Router();

async function getPopularItems(pool, limit = 5) {
  const result = await pool.query(
    `SELECT
       mi.item_id,
       mi.item_name,
       mi.item_category,
       mi.price,
       COUNT(*)::int AS order_count
     FROM order_details od
     JOIN menu_items mi ON mi.item_id = od.item_id
     WHERE COALESCE(mi.is_archived, false) = false
     GROUP BY mi.item_id, mi.item_name, mi.item_category, mi.price
     ORDER BY order_count DESC, mi.item_name ASC
     LIMIT $1`,
    [limit]
  );

  return result.rows.map((row) => ({
    itemId: row.item_id,
    name: row.item_name,
    category: row.item_category,
    price: Number(row.price),
    orderCount: row.order_count,
  }));
}

async function getMenuSnapshot(pool) {
  const result = await pool.query(
    `SELECT item_id, item_name, item_category, price
     FROM menu_items
     WHERE COALESCE(is_archived, false) = false
     ORDER BY item_category, item_name`
  );

  return result.rows.map((row) => ({
    itemId: row.item_id,
    name: row.item_name,
    category: row.item_category,
    price: Number(row.price),
  }));
}

function normalizeText(value) {
  return String(value || '')
    .trim()
    .toLowerCase();
}

router.get('/context', async (req, res) => {
  const pool = req.app.locals.pool;

  try {
    const [popularItems, menuItems] = await Promise.all([
      getPopularItems(pool, 8),
      getMenuSnapshot(pool),
    ]);

    return res.json({
      generatedAt: new Date().toISOString(),
      popularItems,
      menuItems,
      menuItemCount: menuItems.length,
    });
  } catch (err) {
    console.error('Chatbot context error:', err);
    return res.status(500).json({ error: 'Failed to build chatbot context.' });
  }
});

router.post('/recommend', async (req, res) => {
  const pool = req.app.locals.pool;
  const preferences = normalizeText(req.body?.preferences);

  try {
    const [popularItems, menuItems] = await Promise.all([
      getPopularItems(pool, 8),
      getMenuSnapshot(pool),
    ]);

    const keywordMatches = preferences
      ? menuItems.filter((item) => {
          const haystack = `${item.name} ${item.category}`.toLowerCase();
          return haystack.includes(preferences);
        })
      : [];

    const recommendations = (keywordMatches.length > 0 ? keywordMatches : popularItems).slice(0, 3);

    return res.json({
      message: 'Foundation response only. Gemini personalization will be added next.',
      preferences,
      recommendations,
      popularItems: popularItems.slice(0, 5),
    });
  } catch (err) {
    console.error('Chatbot recommendation error:', err);
    return res.status(500).json({ error: 'Failed to generate recommendations.' });
  }
});

module.exports = router;
