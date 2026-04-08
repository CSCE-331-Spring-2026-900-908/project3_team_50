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


router.post('/customer-lookup', async (req, res) => {
  const pool = req.app.locals.pool;
  const { email, phone } = req.body;

  try {
    let query = 'SELECT * FROM customer WHERE ';
    const params = [];

    if (email && phone) {
      query += 'email = $1 OR phone_number = $2';
      params.push(email, phone);
    } else if (email) {
      query += 'email = $1';
      params.push(email);
    } else if (phone) {
      query += 'phone_number = $1';
      params.push(phone);
    } else {
      return res.status(400).json({ error: 'Email or phone required' });
    }

    const result = await pool.query(query, params);

    if (result.rows.length > 0) {
      const customer = result.rows[0];
      
      // Determine what info is missing
      let missingField = null;
      if (email && phone) {
        const hasEmail = customer.email && customer.email.trim() !== '';
        const hasPhone = customer.phone_number && customer.phone_number.trim() !== '';
        if (!hasEmail && !hasPhone) {
          missingField = 'both';
        } else if (!hasEmail) {
          missingField = 'email';
        } else if (!hasPhone) {
          missingField = 'phone';
        } else {
          missingField = 'none'; // both exist
        }
      }

      res.json({
        found: true,
        customer: {
          cus_id: customer.cus_id,
          first_name: customer.cus_fname,
          last_name: customer.cus_lname,
          email: customer.email,
          phone: customer.phone_number,
        },
        missingField,
      });
    } else {
      // Neither email nor phone found
      res.json({
        found: false,
        customer: null,
        missingField: 'both',
      });
    }
  } catch (err) {
    console.error('Customer lookup error:', err.message);
    res.status(500).json({ error: 'Database error during lookup: ' + err.message });
  }
});


router.post('/register-customer', async (req, res) => {
  const pool = req.app.locals.pool;
  const { first_name, last_name, email, phone, customer_id } = req.body;

  if (!first_name || !last_name) {
    return res.status(400).json({ error: 'First and last name are required' });
  }

  try {
    let newCustomerId;

    if (customer_id) {
      // UPDATE existing customer with missing field(s)
      const updates = [];
      const params = [customer_id];
      let paramIndex = 2;

      if (email) {
        updates.push('email = $' + paramIndex);
        params.push(email);
        paramIndex++;
      }
      if (phone) {
        updates.push('phone_number = $' + paramIndex);
        params.push(phone);
        paramIndex++;
      }

      if (updates.length > 0) {
        const updateQuery = `UPDATE customer SET ${updates.join(', ')} WHERE cus_id = $1 RETURNING cus_id`;
        const result = await pool.query(updateQuery, params);
        newCustomerId = result.rows[0].cus_id;
      } else {
        newCustomerId = customer_id;
      }
    } else {
      // Generate a new numeric customer ID from sequence-like approach
      // Get the max existing ID and increment, or use 1 as first ID
      const result = await pool.query('SELECT MAX(cus_id) as max_id FROM customer');
      let newId = 1;
      if (result.rows[0].max_id) {
        newId = parseInt(result.rows[0].max_id) + 1;
      }
      
      // INSERT new customer with generated cus_id
      const insertResult = await pool.query(
        'INSERT INTO customer (cus_id, cus_fname, cus_lname, email, phone_number) VALUES ($1, $2, $3, $4, $5) RETURNING cus_id',
        [newId, first_name, last_name, email || '', phone || '']
      );
      newCustomerId = insertResult.rows[0].cus_id;
    }

    res.json({
      success: true,
      customer_id: newCustomerId,
    });
  } catch (err) {
    console.error('Register customer error:', err.message);
    res.status(500).json({ error: 'Database error during registration: ' + err.message });
  }
});

module.exports = router;
