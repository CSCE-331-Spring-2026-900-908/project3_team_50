const express = require('express');
const router = express.Router();

// ═══════════════════════════════════════════════════════════════════════
//  POST /api/auth/login
//  → Authenticate employee via PIN (mirrors App.java login logic)
//
//  Body: { pin: "1234" }
// ═══════════════════════════════════════════════════════════════════════
router.post('/login', async (req, res) => {
  const pool = req.app.locals.pool;
  const { pin } = req.body;

  if (!pin) {
    return res.status(400).json({ error: 'PIN is required' });
  }

  try {
    const result = await pool.query(
      'SELECT employee_id, role, name FROM employees WHERE pin = $1',
      [pin]
    );

    if (result.rows.length > 0) {
      const user = result.rows[0];
      res.json({
        success: true,
        user: {
          id: user.employee_id,
          name: user.name,
          role: user.role, // "Cashier" or "Manager or Customer"
        },
      });
    } else {
      res.status(401).json({ error: 'Invalid PIN!' });
    }
  } catch (err) {
    console.error('Login error:', err);
    res.status(500).json({ error: 'Database error during authentication' });
  }
});

module.exports = router;
