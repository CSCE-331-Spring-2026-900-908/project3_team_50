const express = require('express');
const { OAuth2Client } = require('google-auth-library');
const router = express.Router();

let googleEmailColumnReady = false;

async function ensureGoogleEmailColumn(pool) {
  if (googleEmailColumnReady) return;
  await pool.query(`
    ALTER TABLE employees ADD COLUMN IF NOT EXISTS google_email VARCHAR(255);
  `);
  await pool.query(`
    CREATE UNIQUE INDEX IF NOT EXISTS idx_employees_google_email_lower
    ON employees (LOWER(TRIM(google_email)))
    WHERE google_email IS NOT NULL AND TRIM(google_email) <> '';
  `);
  googleEmailColumnReady = true;
}

function getGoogleClientId() {
  return process.env.GOOGLE_CLIENT_ID || process.env.REACT_APP_GOOGLE_CLIENT_ID;
}

async function getEmailFromGoogleCredential(credential) {
  const clientId = getGoogleClientId();
  if (!clientId || !credential) {
    return null;
  }
  const client = new OAuth2Client(clientId);
  const ticket = await client.verifyIdToken({
    idToken: credential,
    audience: clientId,
  });
  const payload = ticket.getPayload();
  return payload.email || null;
}

function userRowToClient(row) {
  return {
    id: row.employee_id,
    name: row.name,
    role: row.role,
  };
}

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

// ═══════════════════════════════════════════════════════════════════════
//  POST /api/auth/google-login
//  Body: { credential: "<Google ID token JWT>" }
//  Verifies JWT with Google, looks up employees.google_email, returns same user shape as /login
// ═══════════════════════════════════════════════════════════════════════
router.post('/google-login', async (req, res) => {
  const pool = req.app.locals.pool;
  const { credential } = req.body;

  if (!credential) {
    return res.status(400).json({ error: 'Google credential is required' });
  }

  try {
    await ensureGoogleEmailColumn(pool);
    const email = await getEmailFromGoogleCredential(credential);
    if (!email) {
      return res.status(401).json({ error: 'Invalid Google token' });
    }

    const result = await pool.query(
      `SELECT employee_id, role, name, google_email
       FROM employees
       WHERE LOWER(TRIM(COALESCE(google_email, ''))) = LOWER(TRIM($1))`,
      [email]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'No employee linked to this Google account' });
    }

    const user = result.rows[0];
    res.json({
      success: true,
      user: userRowToClient(user),
    });
  } catch (err) {
    console.error('Google login error:', err);
    if (err.message && err.message.includes('Token used too late')) {
      return res.status(401).json({ error: 'Google session expired. Please sign in again.' });
    }
    res.status(500).json({ error: 'Google authentication failed' });
  }
});

// ═══════════════════════════════════════════════════════════════════════
//  POST /api/auth/bind
//  Body: { credential: "<Google ID token>", pin: "1234" }
//  Verifies PIN, then stores google_email from verified JWT on that employee
// ═══════════════════════════════════════════════════════════════════════
router.post('/bind', async (req, res) => {
  const pool = req.app.locals.pool;
  const { credential, pin } = req.body;

  if (!credential || pin === undefined || pin === null || pin === '') {
    return res.status(400).json({ error: 'Google credential and PIN are required' });
  }

  try {
    await ensureGoogleEmailColumn(pool);
    const email = await getEmailFromGoogleCredential(credential);
    if (!email) {
      return res.status(401).json({ error: 'Invalid Google token' });
    }

    const empResult = await pool.query(
      'SELECT employee_id, role, name FROM employees WHERE pin = $1',
      [String(pin)]
    );

    if (empResult.rows.length === 0) {
      return res.status(401).json({ error: 'Invalid PIN' });
    }

    const employee = empResult.rows[0];

    const conflict = await pool.query(
      `SELECT employee_id FROM employees
       WHERE LOWER(TRIM(COALESCE(google_email, ''))) = LOWER(TRIM($1))
         AND employee_id <> $2`,
      [email, employee.employee_id]
    );

    if (conflict.rows.length > 0) {
      return res.status(409).json({
        error: 'This Google account is already linked to another employee',
      });
    }

    await pool.query(
      'UPDATE employees SET google_email = $1 WHERE employee_id = $2',
      [email.trim(), employee.employee_id]
    );

    res.json({
      status: 'success',
      success: true,
      user: userRowToClient(employee),
    });
  } catch (err) {
    console.error('Bind error:', err);
    if (err.code === '23505') {
      return res.status(409).json({ error: 'This Google account is already linked' });
    }
    res.status(500).json({ error: 'Failed to link Google account' });
  }
});


router.post('/customer-lookup', async (req, res) => {
  const pool = req.app.locals.pool;
  const { email, phone_number } = req.body;

  try {
    let query = 'SELECT * FROM customer WHERE ';
    const params = [];

    if (email && phone_number) {
      query += 'LOWER(email) = LOWER($1) OR phone_number = $2';
      params.push(email, phone_number);
    } else if (email) {
      query += 'LOWER(email) = LOWER($1)';
      params.push(email);
    } else if (phone_number) {
      query += 'phone_number = $1';
      params.push(phone_number);
    } else {
      return res.status(400).json({ error: 'Email or phone number required' });
    }

    const result = await pool.query(query, params);

    if (result.rows.length > 0) {
      const customer = result.rows[0];
      
      res.json({
        customer: {
          cus_id: customer.cus_id,
          cus_fname: customer.cus_fname,
          cus_lname: customer.cus_lname,
          email: customer.email,
          phone_number: customer.phone_number,
          points: customer.points || 0,
          past_orders: customer.past_orders || [],
        },
      });
    } else {
      res.status(404).json({ error: 'Customer not found' });
    }
  } catch (err) {
    console.error('Customer lookup error:', err.message);
    res.status(500).json({ error: 'Database error during lookup: ' + err.message });
  }
});


router.post('/register-customer', async (req, res) => {
  const pool = req.app.locals.pool;
  const { first_name, last_name, email, phone } = req.body;

  if (!first_name || !last_name) {
    return res.status(400).json({ error: 'First and last name are required' });
  }

  if (!email && !phone) {
    return res.status(400).json({ error: 'Email or phone number is required' });
  }

  try {
    // Generate a new numeric customer ID from sequence-like approach
    // Get the max existing ID and increment, or use 1 as first ID
    const result = await pool.query('SELECT MAX(cus_id) as max_id FROM customer');
    let newId = 1;
    if (result.rows[0].max_id) {
      newId = parseInt(result.rows[0].max_id) + 1;
    }
    
    // INSERT new customer with generated cus_id
    const insertResult = await pool.query(
      'INSERT INTO customer (cus_id, cus_fname, cus_lname, email, phone_number, points) VALUES ($1, $2, $3, $4, $5, 0) RETURNING *',
      [newId, first_name, last_name, email || '', phone || '']
    );

    const newCustomer = insertResult.rows[0];

    res.json({
      success: true,
      customer_id: newCustomer.cus_id,
      customer: {
        cus_id: newCustomer.cus_id,
        cus_fname: newCustomer.cus_fname,
        cus_lname: newCustomer.cus_lname,
        email: newCustomer.email,
        phone_number: newCustomer.phone_number,
        points: newCustomer.points || 0,
        past_orders: newCustomer.past_orders || [],
      },
    });
  } catch (err) {
    console.error('Register customer error:', err.message);
    res.status(500).json({ error: 'Database error during registration: ' + err.message });
  }
});

// ═══════════════════════════════════════════════════════════════════════
//  PATCH /api/auth/customer/:customerId
//  → Update customer points and past_orders
//
//  Body:
//  {
//    points: 150,
//    past_order_id: 456
//  }
// ═══════════════════════════════════════════════════════════════════════
router.patch('/customer/:customerId', async (req, res) => {
  const pool = req.app.locals.pool;
  const { customerId } = req.params;
  const { points, past_order_id } = req.body;

  try {
    let updateQuery = 'UPDATE customer SET ';
    const params = [];
    const updates = [];

    if (points !== undefined) {
      updates.push(`points = $${params.length + 1}`);
      params.push(points);
    }

    if (past_order_id !== undefined) {
      // Get current past_orders and prepend the new order ID
      const customerRes = await pool.query(
        'SELECT past_orders FROM customer WHERE cus_id = $1',
        [customerId]
      );

      if (customerRes.rows.length > 0) {
        const currentPastOrders = customerRes.rows[0].past_orders || '';
        let ordersList = currentPastOrders ? currentPastOrders.split(',').map(id => id.trim()) : [];
        ordersList = [past_order_id.toString(), ...ordersList].slice(0, 3);
        const updatedPastOrders = ordersList.join(',');

        updates.push(`past_orders = $${params.length + 1}`);
        params.push(updatedPastOrders);
      }
    }

    if (updates.length === 0) {
      return res.status(400).json({ error: 'No fields to update' });
    }

    updates.push(`cus_id = $${params.length + 1}`);
    params.push(customerId);

    updateQuery += updates.slice(0, -1).join(', ') + ' WHERE cus_id = $' + params.length;

    const result = await pool.query(updateQuery, params.slice(0, -1).concat(customerId));

    res.json({
      success: true,
      message: 'Customer updated',
    });
  } catch (err) {
    console.error('Update customer error:', err.message);
    res.status(500).json({ error: 'Database error: ' + err.message });
  }
});

module.exports = router;
