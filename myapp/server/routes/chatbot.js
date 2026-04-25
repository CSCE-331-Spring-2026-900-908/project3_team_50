const express = require('express');

const router = express.Router();
const GEMINI_MODEL = process.env.GEMINI_MODEL || 'gemini-1.5-flash';

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

function fallbackRecommendations({ preferences, menuItems, popularItems }) {
  const keywordMatches = preferences
    ? menuItems.filter((item) => {
        const haystack = `${item.name} ${item.category}`.toLowerCase();
        return haystack.includes(preferences);
      })
    : [];

  const picks = (keywordMatches.length > 0 ? keywordMatches : popularItems).slice(0, 3);
  return picks.map((item) => ({
    ...item,
    reason: keywordMatches.length > 0
      ? 'This item matches your stated preference.'
      : 'This is one of our most popular menu items.',
  }));
}

function extractGeminiText(payload) {
  const candidate = payload?.candidates?.[0];
  const parts = candidate?.content?.parts || [];
  const textParts = parts.map((part) => part?.text).filter(Boolean);
  return textParts.join('\n').trim();
}

function parseGeminiJson(text) {
  if (!text) return null;
  const cleaned = text
    .replace(/^```json\s*/i, '')
    .replace(/^```\s*/i, '')
    .replace(/```$/i, '')
    .trim();
  try {
    return JSON.parse(cleaned);
  } catch {
    return null;
  }
}

async function getGeminiRecommendations({ preferences, menuItems, popularItems }) {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return { source: 'fallback', error: 'Missing GEMINI_API_KEY.' };
  }

  const prompt = [
    'You are a boba tea ordering assistant.',
    'Use ONLY the provided menu. Never invent items.',
    `Customer preferences: ${preferences || 'none provided'}`,
    '',
    'Top popular items:',
    JSON.stringify(popularItems, null, 2),
    '',
    'Full menu snapshot:',
    JSON.stringify(menuItems, null, 2),
    '',
    'Return JSON only with this shape:',
    '{"message":"string","recommendations":[{"name":"string","reason":"string"}]}',
  ].join('\n');

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 12000);

  try {
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(GEMINI_MODEL)}:generateContent?key=${encodeURIComponent(apiKey)}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        signal: controller.signal,
        body: JSON.stringify({
          contents: [{ role: 'user', parts: [{ text: prompt }] }],
          generationConfig: {
            temperature: 0.4,
            maxOutputTokens: 350,
          },
        }),
      }
    );

    const payload = await response.json();
    if (!response.ok) {
      throw new Error(payload?.error?.message || `Gemini request failed (${response.status}).`);
    }

    const rawText = extractGeminiText(payload);
    const parsed = parseGeminiJson(rawText);
    if (!parsed || !Array.isArray(parsed.recommendations)) {
      throw new Error('Gemini returned non-JSON or invalid recommendation format.');
    }

    return {
      source: 'gemini',
      message: typeof parsed.message === 'string' ? parsed.message : 'Here are some picks you might enjoy.',
      recommendations: parsed.recommendations,
    };
  } finally {
    clearTimeout(timeout);
  }
}

function alignRecommendationsToMenu(recommendations, menuItems) {
  const byName = new Map(menuItems.map((item) => [normalizeText(item.name), item]));

  return recommendations
    .map((rec) => {
      const match = byName.get(normalizeText(rec?.name));
      if (!match) return null;
      return {
        itemId: match.itemId,
        name: match.name,
        category: match.category,
        price: match.price,
        reason: typeof rec?.reason === 'string' && rec.reason.trim()
          ? rec.reason.trim()
          : 'Recommended based on your preferences and current trends.',
      };
    })
    .filter(Boolean)
    .slice(0, 3);
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

    let source = 'fallback';
    let message = 'Here are some strong menu picks to get started.';
    let recommendationPayload = fallbackRecommendations({ preferences, menuItems, popularItems });
    let warning = null;

    try {
      const geminiResult = await getGeminiRecommendations({ preferences, menuItems, popularItems });
      if (geminiResult.source === 'gemini') {
        const aligned = alignRecommendationsToMenu(geminiResult.recommendations, menuItems);
        if (aligned.length > 0) {
          source = 'gemini';
          message = geminiResult.message;
          recommendationPayload = aligned;
        } else {
          warning = 'Gemini suggestions did not map to current menu items; using fallback recommendations.';
        }
      } else {
        warning = geminiResult.error || 'Gemini key missing; using fallback recommendations.';
      }
    } catch (geminiErr) {
      warning = geminiErr.message || 'Gemini unavailable; using fallback recommendations.';
      console.error('Gemini recommendation error:', geminiErr);
    }

    return res.json({
      message,
      preferences,
      source,
      warning,
      recommendations: recommendationPayload,
      popularItems: popularItems.slice(0, 5),
    });
  } catch (err) {
    console.error('Chatbot recommendation error:', err);
    return res.status(500).json({ error: 'Failed to generate recommendations.' });
  }
});

module.exports = router;
