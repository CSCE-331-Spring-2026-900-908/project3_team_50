import React, { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import './Kiosk.css';

const API = process.env.REACT_APP_API_URL || 'http://localhost:3001/api';

/* ═══════════════════════════════════════════════════════════════════════
   Kiosk — Customer ordering view
   Mirrors CashierDashboard but for customer self-service
   ═══════════════════════════════════════════════════════════════════════ */
   //for customers with accounts, points displayed in the corner of the screen.
   //upon checkout, customer earns the rounded down dollar amount of points. $5.60 = 5 points
   //option to use points at checkout. Can accept or deny. Can pic how many point they want to use. in whole dollar amounts. 
   //10 points is worth 1 dollar. using 130 points on a $13 dollar order makes it free but also resets points to 0. using 10 points on a $5.60 order makes it $4.60 
   //Orders where a discount is use is void to earn points.
   //Customer with account, Past 3 orders are listed in the bottom left corner. Rebuy button. On click and the order is populated. 
   //Upon purchase, reorder section is updates. 

   
export default function Kiosk() {
  // ── State ──────────────────────────────────────────────────────────
  const [categories, setCategories] = useState([]);
  const [activeCategory, setActiveCategory] = useState(null);
  const [menuItems, setMenuItems] = useState([]);
  const [bobaToppings, setBobaToppings] = useState([]);

  // Order state (mirrors orderItems list in Java)
  const [orderItems, setOrderItems] = useState([]);
  const [currentItemIndex, setCurrentItemIndex] = useState(null);

  // View state — "CUSTOMER_INFO" | "CATEGORIES" | "ITEMS" | "ADDONS" | "CHECKOUT"
  const [view, setView] = useState('CUSTOMER_INFO');
  const [tip, setTip] = useState(0);
  const [customTipInput, setCustomTipInput] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [successMessage, setSuccessMessage] = useState('');
  const [customerFirstName, setCustomerFirstName] = useState('');
  const [customerLastName, setCustomerLastName] = useState('');
  const [customerEmail, setCustomerEmail] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [customerId, setCustomerId] = useState(null);
  const [showNameModal, setShowNameModal] = useState(false);
  const [nameModalTitle, setNameModalTitle] = useState('');
  const [tempFirstName, setTempFirstName] = useState('');
  const [tempLastName, setTempLastName] = useState('');

  
  const subtotal = orderItems.reduce(
    (sum, item) => sum + item.basePrice + item.bobaPrice,
    0
  );

  
  useEffect(() => {
    const savedSession = localStorage.getItem('kiosk_customer_session');
    if (savedSession) {
      try {
        const session = JSON.parse(savedSession);
        setCustomerId(session.customerId);
        setCustomerFirstName(session.customerFirstName);
        setCustomerLastName(session.customerLastName);
        setCustomerEmail(session.customerEmail);
        setCustomerPhone(session.customerPhone);
        setView('CATEGORIES');
      } catch (err) {
        console.error('Failed to restore session:', err);
        localStorage.removeItem('kiosk_customer_session');
      }
    }
  }, []);

  // ── Save customer session to localStorage when customer data changes ──
  useEffect(() => {
    if (customerId && view !== 'CUSTOMER_INFO') {
      const session = {
        customerId,
        customerFirstName,
        customerLastName,
        customerEmail,
        customerPhone,
      };
      localStorage.setItem('kiosk_customer_session', JSON.stringify(session));
    }
  }, [customerId, customerFirstName, customerLastName, customerEmail, customerPhone, view]);

 
  useEffect(() => {
    axios.get(`${API}/menu/categories`).then((r) => {
      setCategories(r.data);
    });
    axios.get(`${API}/menu/boba`).then((r) => setBobaToppings(r.data));
  }, []);

  const fetchItems = useCallback(() => {
    if (!activeCategory) return;
    axios
      .get(`${API}/menu/items`, { params: { category: activeCategory } })
      .then((r) => setMenuItems(r.data));
  }, [activeCategory]);

  useEffect(() => {
    fetchItems();
  }, [fetchItems]);

  // ── Handlers ───────────────────────────────────────────────────────
  const handleCategoryClick = (category) => {
    setActiveCategory(category);
    setView('ITEMS');
  };

  const handleBackToCategories = () => {
    setView('CATEGORIES');
    setActiveCategory(null);
  };

  // ── Logout handler ──────────────────────────────────────────────────
  const handleLogout = () => {
    if (window.confirm('Are you sure you want to logout? Your order will be cleared.')) {
      // Clear all customer data
      setCustomerId(null);
      setCustomerFirstName('');
      setCustomerLastName('');
      setCustomerEmail('');
      setCustomerPhone('');
      setOrderItems([]);
      setActiveCategory(null);
      setTip(0);
      setCustomTipInput('');
      setSuccessMessage('');
      setView('CUSTOMER_INFO');
      
      // Clear localStorage session
      localStorage.removeItem('kiosk_customer_session');
    }
  };

  const addItemToOrder = (item) => {
    const newItem = {
      baseItemId: item.item_id,
      name: item.item_name,
      basePrice: parseFloat(item.price),
      bobaInventoryId: -1,
      boba: 'No Boba',
      bobaPrice: 0,
      ice: 'Regular Ice',
      sweetness: 'Regular Sweet',
    };
    setOrderItems((prev) => [...prev, newItem]);
    setCurrentItemIndex(orderItems.length);
    setView('ADDONS');
  };

  const updateCurrentItem = (field, value) => {
    if (currentItemIndex === null) return;
    setOrderItems((prev) => {
      const copy = [...prev];
      copy[currentItemIndex] = { ...copy[currentItemIndex], [field]: value };
      return copy;
    });
  };

  const selectBoba = (topping) => {
    if (currentItemIndex === null) return;
    setOrderItems((prev) => {
      const copy = [...prev];
      copy[currentItemIndex] = {
        ...copy[currentItemIndex],
        bobaInventoryId: topping.id,
        boba: topping.name,
        bobaPrice: topping.price,
      };
      return copy;
    });
  };

  const removeItem = (index) => {
    setOrderItems((prev) => prev.filter((_, i) => i !== index));
    // Reset currentItemIndex if it's affected by the removal
    if (currentItemIndex === index) {
      setCurrentItemIndex(null);
      // Go back to items if we were editing this item
      setView('ITEMS');
    } else if (currentItemIndex !== null && currentItemIndex > index) {
      setCurrentItemIndex(currentItemIndex - 1);
    }
  };

  const handleCheckout = async (customerName) => {
    if (orderItems.length === 0) return;
    setIsProcessing(true);
    try {
      await axios.post(`${API}/orders`, {
        cashier_name: 'Walk-in',
        customer_name: customerName || 'Walk-in',
        total: subtotal,
        tip,
        items: orderItems.map((item) => ({
          baseItemId: item.baseItemId,
          bobaInventoryId: item.bobaInventoryId,
        })),
      });
      // Reset
      setOrderItems([]);
      setTip(0);
      setView('CUSTOMER_INFO');
      setCustomerFirstName('');
      setCustomerLastName('');
      setCustomerEmail('');
      setCustomerPhone('');
      setCustomerId(null);
      setSuccessMessage('Payment Successful!');
      setTimeout(() => setSuccessMessage(''), 3000);
    } catch (err) {
      alert('Checkout failed: ' + (err.response?.data?.error || err.message));
    } finally {
      setIsProcessing(false);
    }
  };

  
  const handleCustomerInfoContinue = async () => {
    // If neither email nor phone provided, just skip to categories
    if (!customerEmail.trim() && !customerPhone.trim()) {
      setView('CATEGORIES');
      return;
    }

    setIsProcessing(true);
    try {
      
      const lookupRes = await axios.post(`${API}/auth/customer-lookup`, {
        email: customerEmail,
        phone: customerPhone,
      });

      const { found, customer, missingField } = lookupRes.data;

      if (found) {
        
        setCustomerId(customer.cus_id);
        setCustomerFirstName(customer.first_name || '');
        setCustomerLastName(customer.last_name || '');

        if (missingField && missingField !== 'none') {
          
          if (missingField === 'both') {
            setNameModalTitle('Complete Your Profile');
            setTempFirstName('');
            setTempLastName('');
            setShowNameModal(true);
          } else if (missingField === 'email' || missingField === 'phone') {
            // Single field missing - proceed (handle manual entry at checkout if needed)
            setView('CATEGORIES');
          }
        } else {
          
          setView('CATEGORIES');
        }
      } else {
        
        setNameModalTitle('Register New Account');
        setTempFirstName('');
        setTempLastName('');
        setShowNameModal(true);
      }
    } catch (err) {
      alert('Error: ' + (err.response?.data?.error || err.message));
    } finally {
      setIsProcessing(false);
    }
  };

  
  const handleNameModalSubmit = async () => {
    if (!tempFirstName.trim() || !tempLastName.trim()) {
      alert('Please enter both first and last name');
      return;
    }

    setIsProcessing(true);
    try {
      const registerRes = await axios.post(`${API}/auth/register-customer`, {
        first_name: tempFirstName,
        last_name: tempLastName,
        email: customerEmail,
        phone: customerPhone,
        customer_id: customerId || null,
      });

      setCustomerId(registerRes.data.customer_id);
      setCustomerFirstName(tempFirstName);
      setCustomerLastName(tempLastName);
      setShowNameModal(false);
      setView('CATEGORIES');
    } catch (err) {
      alert('Registration error: ' + (err.response?.data?.error || err.message));
    } finally {
      setIsProcessing(false);
    }
  };

  
  return (
    <div className="kiosk-layout">
      {/* ── HEADER with Logout Button ──────────────────────────────── */}
      {view !== 'CUSTOMER_INFO' && (
        <div className="kiosk-header">
          <div className="header-content">
            <div className="header-welcome">
              {customerFirstName && customerLastName && (
                <span>Welcome, {customerFirstName}!</span>
              )}
            </div>
            <button className="logout-btn-header" onClick={handleLogout}>
              ← Back / Logout
            </button>
          </div>
        </div>
      )}
      
      {showNameModal && (
        <NameEntryModal
          title={nameModalTitle}
          firstName={tempFirstName}
          lastName={tempLastName}
          onFirstNameChange={setTempFirstName}
          onLastNameChange={setTempLastName}
          onSubmit={handleNameModalSubmit}
          isProcessing={isProcessing}
        />
      )}

      <div className="kiosk-content-wrapper">
        {/* ── MAIN CONTENT ──────────────────────────────────────────────── */}
        <div className="kiosk-main">
          {view === 'CUSTOMER_INFO' && (
            <CustomerInfoPrompt
              email={customerEmail}
              phone={customerPhone}
              onFirstNameChange={setCustomerFirstName}
              onLastNameChange={setCustomerLastName}
              onEmailChange={setCustomerEmail}
              onPhoneChange={setCustomerPhone}
              onContinue={handleCustomerInfoContinue}
              isProcessing={isProcessing}
            />
          )}

          {view === 'CATEGORIES' && (
            <div className="categories-view">
              <h1 className="kiosk-title">Select a Category</h1>
              <div className="categories-grid">
                {categories.map((category) => (
                  <button
                    key={category}
                    className="category-box"
                    onClick={() => handleCategoryClick(category)}
                  >
                    <div className="category-image">
                      {getCategoryEmoji(category)}
                    </div>
                    <span className="category-name">{category}</span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {view === 'ITEMS' && activeCategory && (
            <div className="items-view">
              <button className="back-arrow" onClick={handleBackToCategories}>
                ← Back
              </button>
              <h2 className="items-title">{activeCategory}</h2>
              <div className="items-grid">
                {menuItems.map((item) => (
                  <button
                    key={item.item_id}
                    className="item-card glass-card"
                    onClick={() => addItemToOrder(item)}
                  >
                    <span className="item-name">{item.item_name}</span>
                    <span className="item-price">${parseFloat(item.price).toFixed(2)}</span>
                  </button>
                ))}
                {menuItems.length === 0 && (
                  <p className="empty-hint">No items in this category</p>
                )}
              </div>
            </div>
          )}

          {view === 'ADDONS' && currentItemIndex !== null && (
            <div className="addons-view">
              <button className="back-arrow" onClick={() => {
                setCurrentItemIndex(null);
                setView('ITEMS');
              }}>
                ← Back
              </button>
              <AddonsPanel
                item={orderItems[currentItemIndex]}
                bobaToppings={bobaToppings}
                onSelectBoba={selectBoba}
                onUpdateItem={updateCurrentItem}
                onDone={() => {
                  setCurrentItemIndex(null);
                  setView('ITEMS');
                }}
              />
            </div>
          )}

          {view === 'CHECKOUT' && (
            <CheckoutPanel
              subtotal={subtotal}
              tip={tip}
              setTip={setTip}
              customTipInput={customTipInput}
              setCustomTipInput={setCustomTipInput}
              onPay={handleCheckout}
              onBack={() => setView('ITEMS')}
              isProcessing={isProcessing}
            />
          )}
        </div>

        {/* ── RIGHT: Order summary ──────────────────────────────────── */}
        <aside className="order-sidebar glass-card">
        <h3 className="sidebar-title">Current Order</h3>

        {successMessage && (
          <div className="toast toast-success" style={{ marginBottom: '16px' }}>
            {successMessage}
          </div>
        )}

        <div className="order-items-list">
          {orderItems.length === 0 && (
            <p className="empty-order">No items yet</p>
          )}
          {orderItems.map((item, i) => (
            <div key={i} className="order-row">
              <div className="order-row-top">
                <span className="order-item-name">{item.name}</span>
                <span className="order-item-price">
                  ${(item.basePrice + item.bobaPrice).toFixed(2)}
                </span>
                <button
                  className="remove-btn"
                  title="Remove"
                  onClick={() => removeItem(i)}
                >
                  ✕
                </button>
              </div>
              {/* Addon tags */}
              <div className="addon-tags">
                {item.boba !== 'No Boba' && (
                  <span className="addon-tag">+ {item.boba}</span>
                )}
                {item.ice !== 'Regular Ice' && (
                  <span className="addon-tag">+ {item.ice}</span>
                )}
                {item.sweetness !== 'Regular Sweet' && (
                  <span className="addon-tag">+ {item.sweetness}</span>
                )}
              </div>
            </div>
          ))}
        </div>

        <div className="order-total-bar">
          <span>Total</span>
          <span className="total-amount">${subtotal.toFixed(2)}</span>
        </div>

        <button
          className="checkout-btn"
          disabled={orderItems.length === 0}
          onClick={() => {
            setTip(0);
            setView('CHECKOUT');
          }}
        >
          Checkout
        </button>
        </aside>
      </div>
    </div>
  );
}

/* ─── Helper: Get emoji for category ───────────────────────────────── */
function getCategoryEmoji(category) {
  const emojiMap = {
    'Slush': '🥤',
    'Milk Tea': '🥛🧋',
    'Fruit Tea': '🧃🧋',
    'Boba': '🧋',
    
  };
  return emojiMap[category] || '🧋';
}

/* ─── Addons Sub-Component ─────────────────────────────────────────── */
function AddonsPanel({ item, bobaToppings, onSelectBoba, onUpdateItem, onDone }) {
  const iceOptions = ['Regular Ice', 'Less Ice', 'No Ice'];
  const sweetnessOptions = ['More Sweet', 'Regular Sweet', 'Less Sweet'];

  return (
    <div className="addons-panel">
      <h2 className="addons-heading">
        Customize: <span className="highlight">{item.name}</span>
      </h2>

      {/* Boba */}
      <div className="addon-section">
        <h3 className="addon-section-title">🧋 Boba Toppings — $0.50 each</h3>
        <div className="addon-options">
          {bobaToppings.map((t) => (
            <button
              key={t.id}
              className={`addon-btn ${item.bobaInventoryId === t.id ? 'selected' : ''}`}
              onClick={() => onSelectBoba(t)}
            >
              {t.name}
            </button>
          ))}
          <button
            className={`addon-btn ${item.bobaInventoryId === -1 ? 'selected' : ''}`}
            onClick={() =>
              onUpdateItem('bobaInventoryId', -1) ||
              onUpdateItem('boba', 'No Boba') ||
              onUpdateItem('bobaPrice', 0)
            }
          >
            No Boba
          </button>
        </div>
      </div>

      {/* Ice */}
      <div className="addon-section">
        <h3 className="addon-section-title">🧊 Ice Level</h3>
        <div className="addon-options">
          {iceOptions.map((opt) => (
            <button
              key={opt}
              className={`addon-btn ${item.ice === opt ? 'selected' : ''}`}
              onClick={() => onUpdateItem('ice', opt)}
            >
              {opt}
            </button>
          ))}
        </div>
      </div>

      {/* Sweetness */}
      <div className="addon-section">
        <h3 className="addon-section-title">🍯 Sweetness</h3>
        <div className="addon-options">
          {sweetnessOptions.map((opt) => (
            <button
              key={opt}
              className={`addon-btn ${item.sweetness === opt ? 'selected' : ''}`}
              onClick={() => onUpdateItem('sweetness', opt)}
            >
              {opt}
            </button>
          ))}
        </div>
      </div>

      <button className="done-btn" onClick={onDone}>
        ✓ Done — Back to Menu
      </button>
    </div>
  );
}

/* ─── Checkout Sub-Component ───────────────────────────────────────── */
function CheckoutPanel({
  subtotal,
  tip,
  setTip,
  customTipInput,
  setCustomTipInput,
  onPay,
  onBack,
  isProcessing,
}) {
  const [customerName, setCustomerName] = useState('');

  const tipPresets = [
    { label: '10%', calc: subtotal * 0.1 },
    { label: '15%', calc: subtotal * 0.15 },
    { label: '20%', calc: subtotal * 0.2 },
  ];

  return (
    <div className="checkout-panel">
      <button className="back-link" onClick={onBack}>
        ← Back to Order
      </button>

      <h2 className="checkout-heading">Checkout</h2>

      <div className="checkout-summary">
        <div className="summary-row">
          <span>Subtotal</span>
          <span>${subtotal.toFixed(2)}</span>
        </div>
        <div className="summary-row">
          <span>Tip</span>
          <span>${tip.toFixed(2)}</span>
        </div>
        <div className="summary-row total-row">
          <span>Total</span>
          <span>${(subtotal + tip).toFixed(2)}</span>
        </div>
      </div>

      {/* Tip Buttons */}
      <div className="tip-section">
        <h3>Add a Tip</h3>
        <div className="tip-btns">
          {tipPresets.map((p) => (
            <button
              key={p.label}
              className={`tip-btn ${Math.abs(tip - p.calc) < 0.01 ? 'active' : ''}`}
              onClick={() => setTip(p.calc)}
            >
              <span className="tip-pct">{p.label}</span>
              <span className="tip-amt">${p.calc.toFixed(2)}</span>
            </button>
          ))}
          <div className="tip-custom">
            <input
              type="number"
              placeholder="Custom $"
              value={customTipInput}
              onChange={(e) => setCustomTipInput(e.target.value)}
              min="0"
              step="0.01"
            />
            <button
              className="tip-apply"
              onClick={() => {
                const val = parseFloat(customTipInput);
                if (!isNaN(val) && val >= 0) setTip(val);
              }}
            >
              Apply
            </button>
          </div>
        </div>
      </div>

      {/* Customer Name */}
      <div className="customer-section">
        <label htmlFor="customer-name">Customer Name (optional)</label>
        <input
          id="customer-name"
          type="text"
          placeholder="Walk-in"
          value={customerName}
          onChange={(e) => setCustomerName(e.target.value)}
        />
      </div>

      <button
        className="pay-btn"
        onClick={() => onPay(customerName)}
        disabled={isProcessing}
      >
        {isProcessing ? 'Processing…' : `Pay $${(subtotal + tip).toFixed(2)}`}
      </button>
    </div>
  );
}


function CustomerInfoPrompt({ email, phone, onEmailChange, onPhoneChange, onContinue, isProcessing }) {
  return (
    <div className="customer-info-modal">
      <div className="customer-info-box">
        <h1 className="customer-info-title">Welcome!</h1>
        <p className="customer-info-subtitle">
          Do you have an account with us?
        </p>
        <p className="customer-info-text">
          Share your email or phone number so we can save your preferences and order history.
        </p>
        <div className = "customer-info-inputs">

        </div>
        <div className="customer-info-inputs">
          <div className="input-group">
            <label htmlFor="customer-email">Email (optional)</label>
            <input
              id="customer-email"
              type="email"
              placeholder="you@example.com"
              value={email}
              onChange={(e) => onEmailChange(e.target.value)}
            />
          </div>

          <div className="input-group">
            <label htmlFor="customer-phone">Phone (optional)</label>
            <input
              id="customer-phone"
              type="tel"
              placeholder="(123) 456-7890"
              value={phone}
              onChange={(e) => onPhoneChange(e.target.value)}
            />
          </div>
        </div>

        <div className="customer-info-actions">
          <button className="continue-btn" onClick={onContinue} disabled={isProcessing}>
            {isProcessing ? 'Processing…' : 'Continue'}
          </button>
          <button className="skip-link" onClick={onContinue} disabled={isProcessing}>
            Skip
          </button>
        </div>
      </div>
    </div>
  );
}


function NameEntryModal({ title, firstName, lastName, onFirstNameChange, onLastNameChange, onSubmit, isProcessing }) {
  return (
    <div className="customer-info-modal">
      <div className="customer-info-box">
        <h1 className="customer-info-title">{title}</h1>
        <p className="customer-info-text">
          Please enter your name to continue.
        </p>

        <div className="customer-info-inputs">
          <div className="input-group">
            <label htmlFor="first-name">First Name</label>
            <input
              id="first-name"
              type="text"
              placeholder="John"
              value={firstName}
              onChange={(e) => onFirstNameChange(e.target.value)}
              disabled={isProcessing}
            />
          </div>

          <div className="input-group">
            <label htmlFor="last-name">Last Name</label>
            <input
              id="last-name"
              type="text"
              placeholder="Doe"
              value={lastName}
              onChange={(e) => onLastNameChange(e.target.value)}
              disabled={isProcessing}
            />
          </div>
        </div>

        <div className="customer-info-actions">
          <button className="continue-btn" onClick={onSubmit} disabled={isProcessing}>
            {isProcessing ? 'Processing…' : 'Submit'}
          </button>
        </div>
      </div>
    </div>
  );
}
