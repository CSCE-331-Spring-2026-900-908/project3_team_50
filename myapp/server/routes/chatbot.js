const express = require('express');

const router = express.Router();
const GEMINI_MODEL = process.env.GEMINI_MODEL || 'gemini-2.5-flash';
const GEMINI_FALLBACK_MODELS = (process.env.GEMINI_FALLBACK_MODELS || 'gemini-2.0-flash,gemini-2.0-flash-lite')
  .split(',')
  .map((name) => name.trim())
  .filter(Boolean);

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
  const tokens = normalizeText(preferences)
    .split(/\s+/)
    .map((token) => token.trim())
    .filter((token) => token.length >= 3);

  const scoredMatches = tokens.length > 0
    ? menuItems
        .map((item) => {
          const haystack = `${item.name} ${item.category}`.toLowerCase();
          const score = tokens.reduce((sum, token) => sum + (haystack.includes(token) ? 1 : 0), 0);
          return { item, score };
        })
        .filter((entry) => entry.score > 0)
        .sort((a, b) => b.score - a.score || a.item.name.localeCompare(b.item.name))
        .map((entry) => entry.item)
    : [];

  const fallbackPool = scoredMatches.length > 0 ? scoredMatches : popularItems;

  // Rotate recommendations by preference hash so repeated prompts do not always return the same first three.
  const hashSeed = normalizeText(preferences)
    .split('')
    .reduce((hash, char) => hash + char.charCodeAt(0), 0);
  const startIndex = fallbackPool.length > 0 ? hashSeed % fallbackPool.length : 0;
  const rotated = fallbackPool.length > 0
    ? [...fallbackPool.slice(startIndex), ...fallbackPool.slice(0, startIndex)]
    : [];
  const picks = rotated.slice(0, 3);

  return picks.map((item) => ({
    ...item,
    reason: scoredMatches.length > 0
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

function summarizeGeminiPayload(payload) {
  const finishReason = payload?.candidates?.[0]?.finishReason || 'unknown';
  const safetyRatings = payload?.candidates?.[0]?.safetyRatings;
  const promptFeedback = payload?.promptFeedback;
  return JSON.stringify({
    finishReason,
    hasCandidateText: Boolean(extractGeminiText(payload)),
    safetyRatings,
    promptFeedback,
  });
}

function parseGeminiJson(text) {
  if (!text) return null;
  const cleaned = text
    .replace(/^```json\s*/i, '')
    .replace(/^```\s*/i, '')
    .replace(/```$/i, '')
    .trim();
  try {
    const firstParse = JSON.parse(cleaned);
    if (typeof firstParse === 'string') {
      try {
        return JSON.parse(firstParse);
      } catch {
        // Keep the string parse result if it is not nested JSON.
        return firstParse;
      }
    }
    return firstParse;
  } catch {
    const jsonMatch = cleaned.match(/\{[\s\S]*\}/);
    if (!jsonMatch) return null;
    try {
      const firstParse = JSON.parse(jsonMatch[0]);
      if (typeof firstParse === 'string') {
        try {
          return JSON.parse(firstParse);
        } catch {
          return firstParse;
        }
      }
      return firstParse;
    } catch {
      return null;
    }
  }
}

function coerceRecommendationsFromParsed(parsed) {
  if (!parsed) return [];

  if (Array.isArray(parsed)) return parsed;

  if (typeof parsed === 'object') {
    if (parsed.recommendation) {
      if (Array.isArray(parsed.recommendation)) return parsed.recommendation;
      if (typeof parsed.recommendation === 'object') return [parsed.recommendation];
      if (typeof parsed.recommendation === 'string') return [{ name: parsed.recommendation }];
    }

    const candidateArrays = [
      parsed.recommendations,
      parsed.items,
      parsed.suggestions,
      parsed.drinks,
      parsed.results,
    ];

    for (const candidate of candidateArrays) {
      if (Array.isArray(candidate)) return candidate;
    }
  }

  return [];
}

function normalizeRecommendationName(rec) {
  if (!rec || typeof rec !== 'object') return '';
  return String(
    rec.name
    || rec.item
    || rec.drink
    || rec.menuItem
    || rec.title
    || ''
  ).trim();
}

function extractRecommendationsFromText(rawText, menuItems) {
  const lowered = normalizeText(rawText);
  if (!lowered) return [];

  const rawTokens = new Set(
    lowered
      .split(/[^a-z0-9]+/)
      .map((token) => token.trim())
      .filter((token) => token.length >= 3)
  );

  const ranked = menuItems
    .map((item) => {
      const normalizedName = normalizeText(item.name);
      const exactIncluded = lowered.includes(normalizedName);
      const itemTokens = normalizedName
        .split(/[^a-z0-9]+/)
        .map((token) => token.trim())
        .filter((token) => token.length >= 3);
      const tokenOverlap = itemTokens.filter((token) => rawTokens.has(token)).length;
      return { item, score: exactIncluded ? tokenOverlap + 100 : tokenOverlap };
    })
    .filter((entry) => entry.score >= 2)
    .sort((a, b) => b.score - a.score || a.item.name.localeCompare(b.item.name))
    .slice(0, 3);

  return ranked.map(({ item }) => ({
    name: item.name,
    reason: 'Recommended by Gemini based on your preferences.',
  }));
}

function buildPreferenceProfile(preferences) {
  const pref = normalizeText(preferences);
  return {
    fruity: /\b(fruit|fruity|citrus|berry|mango|lychee|peach|refreshing)\b/.test(pref),
    refreshing: /\b(refresh|refreshing|light|icy|cool)\b/.test(pref),
    milkTea: /\b(milk|creamy|cream|latte|brown sugar|toffee)\b/.test(pref),
    lowCaffeine: /\b(low caffeine|less caffeine|no caffeine|light caffeine)\b/.test(pref),
    strongTea: /\b(strong|high caffeine|extra caffeine|boost)\b/.test(pref),
    sweet: /\b(sweet|dessert|sugary)\b/.test(pref),
    adventurous: /\b(new|underrated|different|surprise|unique)\b/.test(pref),
  };
}

function shouldTryNextModel(errorMessage) {
  const msg = normalizeText(errorMessage);
  return msg.includes('quota')
    || msg.includes('rate')
    || msg.includes('resource_exhausted')
    || msg.includes('not found')
    || msg.includes('permission')
    || msg.includes('429')
    || msg.includes('max_tokens');
}

async function requestGeminiForModel({ modelName, apiKey, prompt, menuItems }) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 12000);

  try {
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(modelName)}:generateContent?key=${encodeURIComponent(apiKey)}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        signal: controller.signal,
        body: JSON.stringify({
          contents: [{ role: 'user', parts: [{ text: prompt }] }],
          generationConfig: {
            temperature: 0.2,
            maxOutputTokens: 700,
            responseMimeType: 'application/json',
            thinkingConfig: {
              thinkingBudget: 0,
            },
            responseSchema: {
              type: 'OBJECT',
              required: ['message', 'recommendations'],
              properties: {
                message: { type: 'STRING' },
                recommendations: {
                  type: 'ARRAY',
                  minItems: 3,
                  maxItems: 3,
                  items: {
                    type: 'OBJECT',
                    required: ['name', 'reason'],
                    properties: {
                      name: { type: 'STRING' },
                      reason: { type: 'STRING' },
                    },
                  },
                },
              },
            },
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
    const coercedRecommendations = coerceRecommendationsFromParsed(parsed);
    if (coercedRecommendations.length > 0) {
      return {
        source: 'gemini',
        model: modelName,
        message: typeof parsed?.message === 'string' ? parsed.message : 'Here are some picks you might enjoy.',
        recommendations: coercedRecommendations,
      };
    }

    const fromText = extractRecommendationsFromText(rawText, menuItems);
    if (fromText.length > 0) {
      return {
        source: 'gemini',
        model: modelName,
        message: 'Based on your preferences, these should be good picks.',
        recommendations: fromText,
      };
    }

    const rawPreview = rawText ? rawText.slice(0, 240) : '(empty)';
    const payloadSummary = summarizeGeminiPayload(payload);
    throw new Error(`Gemini returned non-JSON or invalid recommendation format. rawPreview=${rawPreview} payloadSummary=${payloadSummary}`);
  } finally {
    clearTimeout(timeout);
  }
}

async function getGeminiRecommendations({ preferences, menuItems, popularItems }) {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return { source: 'fallback', error: 'Missing GEMINI_API_KEY.' };
  }

  const preferenceTokens = normalizeText(preferences)
    .split(/[^a-z0-9]+/)
    .map((token) => token.trim())
    .filter((token) => token.length >= 3);
  const popularNames = new Set(popularItems.map((item) => normalizeText(item.name)));

  const rankedMenuForPrompt = menuItems
    .map((item) => {
      const itemText = normalizeText(`${item.name} ${item.category}`);
      const tokenScore = preferenceTokens.reduce(
        (score, token) => score + (itemText.includes(token) ? 1 : 0),
        0
      );
      const popularBoost = popularNames.has(normalizeText(item.name)) ? 1 : 0;
      return { item, score: tokenScore + popularBoost };
    })
    .sort((a, b) => b.score - a.score || a.item.name.localeCompare(b.item.name));

  const menuForPrompt = rankedMenuForPrompt
    .slice(0, 20)
    .map(({ item }) => ({
      name: item.name,
      category: item.category,
      price: item.price,
    }));

  const prompt = [
    'You are a boba tea ordering assistant.',
    'Use ONLY the provided menu. Never invent items.',
    'Return ONLY valid JSON. No markdown fences. No prose outside JSON.',
    'Provide exactly 3 recommendations from the menu.',
    'Keep each reason under 12 words.',
    `Customer preferences: ${preferences || 'none provided'}`,
    '',
    'Menu:',
    JSON.stringify(menuForPrompt),
    '',
    'Return JSON only with this exact shape and exactly 3 items:',
    '{"message":"string","recommendations":[{"name":"string","reason":"string"},{"name":"string","reason":"string"},{"name":"string","reason":"string"}]}',
  ].join('\n');

  const modelsToTry = [GEMINI_MODEL, ...GEMINI_FALLBACK_MODELS].filter(
    (model, index, arr) => arr.indexOf(model) === index
  );

  let lastError = null;
  for (let i = 0; i < modelsToTry.length; i += 1) {
    const modelName = modelsToTry[i];
    try {
      return await requestGeminiForModel({
        modelName,
        apiKey,
        prompt,
        menuItems,
      });
    } catch (err) {
      lastError = err;
      const canRetry = i < modelsToTry.length - 1 && shouldTryNextModel(err.message || '');
      if (!canRetry) {
        throw err;
      }
    }
  }

  throw lastError || new Error('All configured Gemini models failed.');
}

function alignRecommendationsToMenu(recommendations, menuItems) {
  const byName = new Map(menuItems.map((item) => [normalizeText(item.name), item]));

  function fuzzyFindMenuItem(name) {
    const normalizedName = normalizeText(name);
    if (!normalizedName) return null;
    if (byName.has(normalizedName)) return byName.get(normalizedName);

    const nameTokens = normalizedName.split(/\s+/).filter(Boolean);
    let best = { score: 0, item: null };

    for (const item of menuItems) {
      const itemName = normalizeText(item.name);
      if (!itemName) continue;
      if (itemName.includes(normalizedName) || normalizedName.includes(itemName)) {
        return item;
      }
      const itemTokens = itemName.split(/\s+/).filter(Boolean);
      const overlap = nameTokens.filter((token) => itemTokens.includes(token)).length;
      if (overlap > best.score) {
        best = { score: overlap, item };
      }
    }

    return best.score >= 2 ? best.item : null;
  }

  return recommendations
    .map((rec) => {
      const candidateName = normalizeRecommendationName(rec);
      const match = fuzzyFindMenuItem(candidateName);
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
    let model = null;
    let message = 'Here are some strong menu picks to get started.';
    let recommendationPayload = fallbackRecommendations({ preferences, menuItems, popularItems });
    let warning = null;

    try {
      const geminiResult = await getGeminiRecommendations({ preferences, menuItems, popularItems });
      if (geminiResult.source === 'gemini') {
        const aligned = alignRecommendationsToMenu(geminiResult.recommendations, menuItems);
        if (aligned.length > 0) {
          source = 'gemini';
          model = geminiResult.model || GEMINI_MODEL;
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
      model,
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
