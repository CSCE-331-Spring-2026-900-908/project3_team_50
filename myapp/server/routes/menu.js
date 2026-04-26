const express = require('express');
const router = express.Router();

async function ensureRecipeQuantityColumn(clientOrPool) {
  await clientOrPool.query(`
    ALTER TABLE menu_items_junction
    ADD COLUMN IF NOT EXISTS quantity_used NUMERIC DEFAULT 1
  `);
}

function normalizeIngredientRows(ingredientInput = []) {
  return ingredientInput
    .map((entry) => {
      if (typeof entry === 'object' && entry !== null) {
        const ingredientId = parseInt(entry.ingredient_id ?? entry.id, 10);
        const quantityUsed = Number(entry.quantity_used ?? entry.quantity ?? 1);
        return {
          ingredient_id: ingredientId,
          quantity_used: Number.isFinite(quantityUsed) && quantityUsed > 0 ? quantityUsed : 1,
        };
      }

      const ingredientId = parseInt(entry, 10);
      return {
        ingredient_id: ingredientId,
        quantity_used: 1,
      };
    })
    .filter((entry) => Number.isInteger(entry.ingredient_id));
}

// ═══════════════════════════════════════════════════════════════════════
//  GET /api/menu/categories
//  → Distinct item categories (mirrors CashierDashboard.getCategories)
// ═══════════════════════════════════════════════════════════════════════
router.get('/categories', async (req, res) => {
  const pool = req.app.locals.pool;
  try {
    const result = await pool.query(
      'SELECT DISTINCT item_category FROM menu_items WHERE COALESCE(is_archived, false) = false ORDER BY item_category'
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
    await ensureRecipeQuantityColumn(pool);
    let sql, params;
    if (category) {
      sql = 'SELECT item_id, item_name, item_category, price, icon_config FROM menu_items WHERE item_category = $1 AND COALESCE(is_archived, false) = false ORDER BY item_id';
      params = [category];
    } else {
      // Full menu view with ingredient details for manager recipe editing.
      sql = `
        SELECT m.item_id, m.item_name, m.item_category, m.price, m.icon_config,
               STRING_AGG(CAST(j.ingredient_id AS TEXT), ', ' ORDER BY j.ingredient_id) AS ingredients,
               COALESCE(
                 JSON_AGG(
                   JSON_BUILD_OBJECT(
                     'ingredient_id', i.inventory_id,
                     'name', i.name,
                     'quantity_used', COALESCE(j.quantity_used, 1),
                     'unit', i.unit
                   )
                   ORDER BY i.name
                 ) FILTER (WHERE i.inventory_id IS NOT NULL),
                 '[]'::json
               ) AS ingredient_details
        FROM menu_items m
        LEFT JOIN menu_items_junction j ON m.item_id = j.menu_item_id
        LEFT JOIN inventory i ON j.ingredient_id = i.inventory_id
        WHERE COALESCE(m.is_archived, false) = false
        GROUP BY m.item_id, m.item_name, m.item_category, m.price, m.icon_config
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
      "SELECT inventory_id, name FROM inventory WHERE (name LIKE '%Boba%' OR name LIKE '%Pearl%') AND name NOT LIKE '%Straw%'"
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
  const { item_name, item_category, price, ingredient_ids, ingredients, icon_config } = req.body;
  const client = await pool.connect();

  try {
    await client.query('BEGIN');
    await ensureRecipeQuantityColumn(client);

    // 1. Get next ID
    const idResult = await client.query('SELECT COALESCE(MAX(item_id), 0) + 1 AS next_id FROM menu_items');
    const nextId = idResult.rows[0].next_id;

    // 2. Insert menu item
    await client.query(
      'INSERT INTO menu_items (item_id, item_name, item_category, price, icon_config) VALUES ($1, $2, $3, $4, $5)',
      [nextId, item_name, item_category, price, icon_config ? JSON.stringify(icon_config) : null]
    );

    // 3. Insert junction rows
    const ingredientRows = normalizeIngredientRows(ingredients || ingredient_ids);
    if (ingredientRows.length > 0) {
      for (const ingredient of ingredientRows) {
        await client.query(
          `INSERT INTO menu_items_junction (menu_item_id, ingredient_id, quantity_used)
           VALUES ($1, $2, $3)
           ON CONFLICT (menu_item_id, ingredient_id)
           DO UPDATE SET quantity_used = EXCLUDED.quantity_used`,
          [nextId, ingredient.ingredient_id, ingredient.quantity_used]
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
  const { item_name, item_category, price, ingredient_ids, ingredients, icon_config } = req.body;
  const client = await pool.connect();

  try {
    await client.query('BEGIN');
    await ensureRecipeQuantityColumn(client);

    // 1. Update menu item
    await client.query(
      'UPDATE menu_items SET item_name=$1, item_category=$2, price=$3, icon_config=$5 WHERE item_id=$4',
      [item_name, item_category, price, id, icon_config ? JSON.stringify(icon_config) : null]
    );

    // 2. Replace junction rows
    await client.query('DELETE FROM menu_items_junction WHERE menu_item_id = $1', [id]);
    const ingredientRows = normalizeIngredientRows(ingredients || ingredient_ids);
    if (ingredientRows.length > 0) {
      for (const ingredient of ingredientRows) {
        await client.query(
          `INSERT INTO menu_items_junction (menu_item_id, ingredient_id, quantity_used)
           VALUES ($1, $2, $3)
           ON CONFLICT (menu_item_id, ingredient_id)
           DO UPDATE SET quantity_used = EXCLUDED.quantity_used`,
          [id, ingredient.ingredient_id, ingredient.quantity_used]
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
//  DELETE /api/menu/items/:id   (Soft-delete / Archive menu item)
//  Sets is_archived=true so FK references in order_details are preserved
// ═══════════════════════════════════════════════════════════════════════
router.delete('/items/:id', async (req, res) => {
  const pool = req.app.locals.pool;
  const { id } = req.params;

  try {
    const result = await pool.query(
      'UPDATE menu_items SET is_archived = true WHERE item_id = $1 RETURNING item_id',
      [id]
    );
    if (result.rowCount === 0) {
      return res.status(404).json({ error: 'Item not found.' });
    }
    res.json({ success: true, archived: true, item_id: id });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
