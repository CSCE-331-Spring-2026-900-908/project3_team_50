import React, { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import './CashierDashboard.css';

const API = process.env.REACT_APP_API_URL || 'http://localhost:3001/api';

/* ═══════════════════════════════════════════════════════════════════════
   Cashier Dashboard — POS view
   Translates CashierDashboard.java to React
   ═══════════════════════════════════════════════════════════════════════ */
   
   //When starting an order, ask customer if they have an account (email/phone lookup): pre-fill name if found
   //Take order, and ask if they want to use points to add a discount (if they have an account)
   //points can be used only in whole dollar amounts (10 points)
   //then proceed to payment method as normal.
  

export default function CashierDashboard() {
  // ── State ──────────────────────────────────────────────────────────
  const [categories, setCategories] = useState([]);
  const [activeCategory, setActiveCategory] = useState(null);
  const [menuItems, setMenuItems] = useState([]);
  const [bobaToppings, setBobaToppings] = useState([]);

  // Order state (mirrors orderItems list in Java)
  const [orderItems, setOrderItems] = useState([]);
  const [currentItemIndex, setCurrentItemIndex] = useState(null);

  // View state — "MENU" | "ADDONS" | "CHECKOUT"
  const [view, setView] = useState('MENU');
  const [paymentType, setPaymentType] = useState(null); // 'CASH' or 'CARD'
  const [tip, setTip] = useState(0);
  const [customTipInput, setCustomTipInput] = useState('');
  const [amountProvided, setAmountProvided] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [successMessage, setSuccessMessage] = useState('');

  // Customer state (for account lookup and loyalty points)
  const [customer, setCustomer] = useState(null);
  const [pointsToRedeem, setPointsToRedeem] = useState(0);

  // ── Derived values ─────────────────────────────────────────────────
  const subtotal = orderItems.reduce(
    (sum, item) => sum + item.basePrice + item.bobaPrice,
    0
  );

  const pointsDiscount = pointsToRedeem / 10; // 10 points = $1
  const totalAfterDiscount = Math.max(0, subtotal - pointsDiscount);

  // ── Data fetching ──────────────────────────────────────────────────
  useEffect(() => {
    axios.get(`${API}/menu/categories`).then((r) => {
      setCategories(r.data);
      if (r.data.length > 0) setActiveCategory(r.data[0]);
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
    setCurrentItemIndex(orderItems.length); // index of newly pushed item
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
      // Go back to menu if we were editing this item
      setView('MENU');
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
        customer_name: customerName || customer?.cus_fname + ' ' + customer?.cus_lname || 'Walk-in',
        customer_id: customer?.cus_id || null,
        total: totalAfterDiscount + (paymentType === 'CARD' ? tip : 0),
        subtotal: subtotal,
        tip: paymentType === 'CARD' ? tip : 0,
        points_redeemed: pointsToRedeem,
        items: orderItems.map((item) => ({
          baseItemId: item.baseItemId,
          bobaInventoryId: item.bobaInventoryId,
          ice: item.ice,
          sweetness: item.sweetness,
        })),
      });
      // Reset
      setOrderItems([]);
      setTip(0);
      setPointsToRedeem(0);
      setPaymentType(null);
      setAmountProvided('');
      setView('MENU');
      setCustomer(null);
      setSuccessMessage('Payment Successful!');
      setTimeout(() => setSuccessMessage(''), 3000);
    } catch (err) {
      alert('Checkout failed: ' + (err.response?.data?.error || err.message));
    } finally {
      setIsProcessing(false);
    }
  };

  // ── Render ─────────────────────────────────────────────────────────
  return (
    <div className="cashier-layout">
      {/* ── LEFT: Menu / Addons / Checkout ─────────────────────────── */}
      <div className="cashier-main">
        {view === 'MENU' && (
          <>
            {/* Category pills */}
            <div className="category-bar">
              {categories.map((cat) => (
                <button
                  key={cat}
                  className={`cat-btn ${activeCategory === cat ? 'active' : ''}`}
                  onClick={() => setActiveCategory(cat)}
                >
                  {cat}
                </button>
              ))}
            </div>

            {/* Item grid */}
            <div className="item-grid">
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
                <p className="empty-hint">Select a category above</p>
              )}
            </div>
          </>
        )}

        {view === 'ADDONS' && currentItemIndex !== null && (
          <AddonsPanel
            item={orderItems[currentItemIndex]}
            bobaToppings={bobaToppings}
            onSelectBoba={selectBoba}
            onUpdateItem={updateCurrentItem}
            onDone={() => {
              setCurrentItemIndex(null);
              setView('MENU');
            }}
          />
        )}

        {view === 'CHECKOUT' && (
          <CheckoutPanel
            subtotal={subtotal}
            totalAfterDiscount={totalAfterDiscount}
            tip={tip}
            setTip={setTip}
            customTipInput={customTipInput}
            setCustomTipInput={setCustomTipInput}
            paymentType={paymentType}
            setPaymentType={setPaymentType}
            amountProvided={amountProvided}
            setAmountProvided={setAmountProvided}
            customer={customer}
            setCustomer={setCustomer}
            pointsToRedeem={pointsToRedeem}
            setPointsToRedeem={setPointsToRedeem}
            onPay={handleCheckout}
            onBack={() => setView('MENU')}
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
            if (paymentType === 'CARD' || !paymentType) {
              setTip(totalAfterDiscount * 0.2);
            }
            setView('CHECKOUT');
          }}
        >
          Checkout
        </button>
      </aside>
    </div>
  );
}

/* ─── Addons Sub-Component ─────────────────────────────────────────── */
function AddonsPanel({ item, bobaToppings, onSelectBoba, onUpdateItem, onDone }) {
  const iceOptions = ['Regular Ice', 'Less Ice', 'No Ice'];
  const sweetnessOptions = ['More Sweet', 'Regular Sweet', 'Less Sweet'];

  const poppingBoba = bobaToppings.filter(t => t.name.toLowerCase().includes('popping')).sort((a,b) => a.name.localeCompare(b.name));
  const otherBoba = bobaToppings.filter(t => !t.name.toLowerCase().includes('popping')).sort((a,b) => a.name.localeCompare(b.name));

  return (
    <div className="addons-panel">
      <h2 className="addons-heading">
        Customize: <span className="highlight">{item.name}</span>
      </h2>

      {/* Boba */}
      <div className="addon-section">
        <h3 className="addon-section-title">🧋 Boba Toppings — $0.50 each</h3>
        
        {otherBoba.length > 0 && (
          <div style={{ marginBottom: '16px' }}>
            <h4 style={{ fontSize: '0.9rem', color: 'var(--text-muted)', marginBottom: '8px' }}>Classic & Jelly</h4>
            <div className="addon-options">
              {otherBoba.map((t) => (
                <button
                  key={t.id}
                  className={`addon-btn ${item.bobaInventoryId === t.id ? 'selected' : ''}`}
                  onClick={() => onSelectBoba(t)}
                >
                  {t.name}
                </button>
              ))}
            </div>
          </div>
        )}

        {poppingBoba.length > 0 && (
          <div style={{ marginBottom: '16px' }}>
            <h4 style={{ fontSize: '0.9rem', color: 'var(--text-muted)', marginBottom: '8px' }}>Popping Boba</h4>
            <div className="addon-options">
              {poppingBoba.map((t) => (
                <button
                  key={t.id}
                  className={`addon-btn ${item.bobaInventoryId === t.id ? 'selected' : ''}`}
                  onClick={() => onSelectBoba(t)}
                >
                  {t.name}
                </button>
              ))}
            </div>
          </div>
        )}

        <div className="addon-options">
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
  totalAfterDiscount,
  tip,
  setTip,
  customTipInput,
  setCustomTipInput,
  paymentType,
  setPaymentType,
  amountProvided,
  setAmountProvided,
  customer,
  setCustomer,
  pointsToRedeem,
  setPointsToRedeem,
  onPay,
  onBack,
  isProcessing,
}) {
  const [customerName, setCustomerName] = useState('');
  const [lookupInput, setLookupInput] = useState('');
  const [lookupMethod, setLookupMethod] = useState('email'); // 'email' or 'phone'
  const [isLooking, setIsLooking] = useState(false);
  const [lookupError, setLookupError] = useState('');
  const [showCreateAccountModal, setShowCreateAccountModal] = useState(false);
  const [showPointsInput, setShowPointsInput] = useState(false);
  const [pointsInput, setPointsInput] = useState('');
  const [newAccountData, setNewAccountData] = useState({
    firstName: '',
    lastName: '',
    email: '',
    phone: '',
  });

  const tipPresets = [
    { label: '10%', calc: subtotal * 0.1 },
    { label: '15%', calc: subtotal * 0.15 },
    { label: '20%', calc: subtotal * 0.2 },
  ];

  const amountProvidedNum = parseFloat(amountProvided) || 0;
  const change = amountProvidedNum - totalAfterDiscount;
  const isValidCashPayment = amountProvidedNum >= totalAfterDiscount;
  const maxPointsToRedeem = customer ? customer.points : 0;
  
  // Cap points at nearest rounded-up dollar amount (10 points = $1)
  const maxPointsByDiscount = Math.ceil(subtotal) * 10;
  const effectiveMaxPoints = Math.min(maxPointsToRedeem, maxPointsByDiscount);

  const handlePointsChange = (newValue) => {
    const numValue = parseInt(newValue) || 0;
    // Ensure points are in increments of 10 and don't exceed max
    const cappedValue = Math.min(Math.max(0, Math.round(numValue / 10) * 10), effectiveMaxPoints);
    setPointsToRedeem(cappedValue);
  };

  const incrementPoints = () => {
    handlePointsChange(pointsToRedeem + 10);
  };

  const decrementPoints = () => {
    handlePointsChange(pointsToRedeem - 10);
  };

  const handleApplyPoints = () => {
    const points = parseInt(pointsInput, 10);
    if (isNaN(points) || points < 0) {
      alert('Please enter a valid number');
      return;
    }
    if (points > effectiveMaxPoints) {
      alert(`Cannot redeem more than ${effectiveMaxPoints} points`);
      return;
    }
    if (points % 10 !== 0) {
      alert('Can only redeem in increments of 10 points');
      return;
    }
    setPointsToRedeem(points);
    setShowPointsInput(false);
    setPointsInput('');
  };

  const handleClearPoints = () => {
    setPointsToRedeem(0);
    setPointsInput('');
  };

  const handleLookupCustomer = async () => {
    if (!lookupInput.trim()) {
      setLookupError('Please enter ' + (lookupMethod === 'email' ? 'email' : 'phone number'));
      return;
    }

    setIsLooking(true);
    setLookupError('');
    try {
      const response = await axios.post(`${API}/auth/customer-lookup`, {
        [lookupMethod === 'email' ? 'email' : 'phone_number']: lookupInput,
      });

      if (response.data.customer) {
        setCustomer(response.data.customer);
        setLookupInput('');
        setPointsToRedeem(0);
      }
    } catch (err) {
      if (err.response?.status === 404) {
        // Pre-fill for account creation
        setNewAccountData({
          firstName: '',
          lastName: '',
          email: lookupMethod === 'email' ? lookupInput : '',
          phone: lookupMethod === 'phone' ? lookupInput : '',
        });
        setShowCreateAccountModal(true);
        setLookupError('');
      } else {
        setLookupError(err.response?.data?.error || 'Lookup failed');
      }
    } finally {
      setIsLooking(false);
    }
  };

  const handleCreateAccount = async () => {
    if (!newAccountData.firstName.trim() || !newAccountData.lastName.trim()) {
      setLookupError('First and last name are required');
      return;
    }

    setIsLooking(true);
    try {
      const response = await axios.post(`${API}/auth/register-customer`, {
        first_name: newAccountData.firstName,
        last_name: newAccountData.lastName,
        email: newAccountData.email || undefined,
        phone: newAccountData.phone || undefined,
      });

      if (response.data.customer) {
        setCustomer(response.data.customer);
        setShowCreateAccountModal(false);
        setNewAccountData({ firstName: '', lastName: '', email: '', phone: '' });
        setLookupInput('');
      }
    } catch (err) {
      setLookupError(err.response?.data?.error || 'Failed to create account');
    } finally {
      setIsLooking(false);
    }
  };

  const handleSkipAccount = () => {
    setShowCreateAccountModal(false);
    setLookupInput('');
    setLookupError('');
    setNewAccountData({ firstName: '', lastName: '', email: '', phone: '' });
  };

  const handleClearCustomer = () => {
    setCustomer(null);
    setPointsToRedeem(0);
    setLookupInput('');
    setLookupError('');
  };

  // Modal for account creation
  if (showCreateAccountModal) {
    return (
      <div className="checkout-panel">
        <button className="back-link" onClick={onBack}>
          ← Back to Order
        </button>

        <h2 className="checkout-heading">Create Account</h2>
        <p className="create-account-subtitle">Join our loyalty program and earn points!</p>

        <div className="create-account-form">
          <div className="form-row">
            <div className="form-col">
              <label>First Name *</label>
              <input
                type="text"
                placeholder="John"
                value={newAccountData.firstName}
                onChange={(e) => setNewAccountData({ ...newAccountData, firstName: e.target.value })}
                disabled={isLooking}
              />
            </div>
            <div className="form-col">
              <label>Last Name *</label>
              <input
                type="text"
                placeholder="Doe"
                value={newAccountData.lastName}
                onChange={(e) => setNewAccountData({ ...newAccountData, lastName: e.target.value })}
                disabled={isLooking}
              />
            </div>
          </div>

          {lookupMethod === 'email' && (
            <div className="form-group">
              <label>Email</label>
              <input
                type="email"
                placeholder="john@example.com"
                value={newAccountData.email}
                onChange={(e) => setNewAccountData({ ...newAccountData, email: e.target.value })}
                disabled={isLooking}
              />
            </div>
          )}

          {lookupMethod === 'phone' && (
            <div className="form-group">
              <label>Phone Number</label>
              <input
                type="tel"
                placeholder="(555) 123-4567"
                value={newAccountData.phone}
                onChange={(e) => setNewAccountData({ ...newAccountData, phone: e.target.value })}
                disabled={isLooking}
              />
            </div>
          )}

          {lookupError && <p className="form-error">{lookupError}</p>}

          <div className="form-actions">
            <button
              className="skip-account-btn"
              onClick={handleSkipAccount}
              disabled={isLooking}
            >
              Skip — Checkout as Guest
            </button>
            <button
              className="create-account-btn"
              onClick={handleCreateAccount}
              disabled={isLooking}
            >
              {isLooking ? 'Creating...' : 'Create Account'}
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="checkout-panel">
      <button className="back-link" onClick={onBack}>
        ← Back to Order
      </button>

      <h2 className="checkout-heading">Checkout</h2>

      {/* Customer Lookup Section */}
      {!customer && (
        <div className="customer-lookup-section">
          <h3>Have an account?</h3>
          <p className="lookup-subtitle">Look up your account to apply discounts and earn points</p>

          <div className="lookup-method-tabs">
            <button
              className={`method-tab ${lookupMethod === 'email' ? 'active' : ''}`}
              onClick={() => {
                setLookupMethod('email');
                setLookupInput('');
              }}
            >
              📧 Email
            </button>
            <button
              className={`method-tab ${lookupMethod === 'phone' ? 'active' : ''}`}
              onClick={() => {
                setLookupMethod('phone');
                setLookupInput('');
              }}
            >
              📱 Phone
            </button>
          </div>

          <div className="lookup-input-group">
            <input
              type={lookupMethod === 'email' ? 'email' : 'tel'}
              placeholder={lookupMethod === 'email' ? 'Enter email...' : 'Enter phone number...'}
              value={lookupInput}
              onChange={(e) => setLookupInput(e.target.value)}
              disabled={isLooking}
              onKeyPress={(e) => e.key === 'Enter' && handleLookupCustomer()}
            />
            <button
              className="lookup-btn"
              onClick={handleLookupCustomer}
              disabled={isLooking}
            >
              {isLooking ? 'Looking...' : 'Look Up'}
            </button>
          </div>

          {lookupError && <p className="lookup-error">{lookupError}</p>}

          <button
            className="skip-lookup-btn"
            onClick={() => setLookupInput('')}
          >
            Continue as Guest
          </button>
        </div>
      )}

      {/* Customer Info Display */}
      {customer && (
        <div className="customer-info-section">
          <div className="customer-info-header">
            <div>
              <h3>Welcome, {customer.cus_fname}!</h3>
              <p className="customer-points"> {customer.points} Points Available</p>
            </div>
            <button
              className="change-customer-btn"
              onClick={handleClearCustomer}
              title="Look up different customer"
            >
              Change
            </button>
          </div>

          {/* Points Redemption */}
          {customer.points > 0 && (
            <div className="points-section">
              <div className="points-header">
                <h3>Loyalty Points</h3>
                <span className="available-points">{effectiveMaxPoints} pts available</span>
              </div>

              {pointsToRedeem === 0 ? (
                <button
                  className="use-points-btn"
                  onClick={() => setShowPointsInput(true)}
                >
                  Redeem Points
                </button>
              ) : (
                <div className="points-redeemed">
                  <p className="points-redeemed-text">
                    Redeeming <strong>{pointsToRedeem} points</strong> for <strong>${(pointsToRedeem / 10).toFixed(2)}</strong> off
                  </p>
                  <button
                    className="clear-points"
                    onClick={handleClearPoints}
                  >
                    Remove Points
                  </button>
                </div>
              )}

              {showPointsInput && pointsToRedeem === 0 && (
                <div className="points-input-group">
                  <p className="points-ratio">10 points = $1 off • Max: ${(effectiveMaxPoints / 10).toFixed(0)}</p>
                  <div className="points-controls">
                    <input
                      type="number"
                      placeholder="Enter points (e.g., 10, 20, 30)"
                      value={pointsInput}
                      onChange={(e) => setPointsInput(e.target.value)}
                      min="0"
                      step="10"
                      max={effectiveMaxPoints}
                    />
                    <button
                      className="points-apply"
                      onClick={handleApplyPoints}
                    >
                      Apply
                    </button>
                    <button
                      className="points-cancel"
                      onClick={() => {
                        setShowPointsInput(false);
                        setPointsInput('');
                      }}
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      <div className="checkout-summary">
        <div className="summary-row">
          <span>Subtotal</span>
          <span>${subtotal.toFixed(2)}</span>
        </div>
        {pointsToRedeem > 0 && (
          <div className="summary-row discount-row">
            <span>Points Discount</span>
            <span>-${(pointsToRedeem / 10).toFixed(2)}</span>
          </div>
        )}
        {paymentType === 'CARD' && (
          <div className="summary-row">
            <span>Tip</span>
            <span>${tip.toFixed(2)}</span>
          </div>
        )}
        <div className="summary-row total-row">
          <span>Total</span>
          <span>${(totalAfterDiscount + (paymentType === 'CARD' ? tip : 0)).toFixed(2)}</span>
        </div>
      </div>

      {/* Payment Type Selection */}
      {!paymentType ? (
        <div className="payment-type-section">
          <h3>Select Payment Method</h3>
          <div className="payment-type-btns">
            <button
              className="payment-type-btn cash-btn"
              onClick={() => setPaymentType('CASH')}
            >
              Cash
            </button>
            <button
              className="payment-type-btn card-btn"
              onClick={() => setPaymentType('CARD')}
            >
              Card
            </button>
          </div>
        </div>
      ) : (
        <>
          
          {paymentType === 'CASH' && (
            <div className="cash-payment-section">
              <div className="cash-input-group">
                <label htmlFor="amount-provided">Amount Provided ($)</label>
                <input
                  id="amount-provided"
                  type="number"
                  placeholder="0.00"
                  value={amountProvided}
                  onChange={(e) => setAmountProvided(e.target.value)}
                  min="0"
                  step={.01}
                  autoFocus
                />
              </div>

              {amountProvided && (
                <div className={`change-display ${change < 0 ? 'insufficient' : ''}`}>
                  <div className="change-label">Change</div>
                  <div className={`change-amount ${change < 0 ? 'red' : 'green'}`}>
                    ${Math.abs(change).toFixed(2)}
                  </div>
                  {change < 0 && (
                    <div className="change-error">Amount insufficient</div>
                  )}
                </div>
              )}
            </div>
          )}

          
          {paymentType === 'CARD' && (
            <div className="card-payment-section">
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
            </div>
          )}

          {/* Cash Total Display */}
          {paymentType === 'CASH' && (
            <div className="cash-total">
              <div className="cash-total-row">
                <span>Amount Due</span>
                <span>${totalAfterDiscount.toFixed(2)}</span>
              </div>
              <div className="cash-total-row">
                <span>Amount Provided</span>
                <span>${amountProvidedNum.toFixed(2)}</span>
              </div>
            </div>
          )}

          
          <div className="customer-section">
            <label htmlFor="customer-name">Customer Name (optional)</label>
            <input
              id="customer-name"
              type="text"
              placeholder={customer ? `${customer.cus_fname} ${customer.cus_lname}` : 'Walk-in'}
              value={customerName}
              onChange={(e) => setCustomerName(e.target.value)}
            />
          </div>

          {/* Payment Buttons */}
          <div className="payment-actions">
            <button
              className="change-payment-btn"
              onClick={() => {
                setPaymentType(null);
                setAmountProvided('');
                setTip(0);
                setCustomTipInput('');
              }}
            >
              Change Payment Method
            </button>

            <button
              className="pay-btn"
              onClick={() => onPay(customerName)}
              disabled={
                isProcessing ||
                (paymentType === 'CASH' && !isValidCashPayment)
              }
            >
              {isProcessing
                ? 'Processing…'
                : paymentType === 'CASH'
                ? `Confirm Cash Payment $${totalAfterDiscount.toFixed(2)}`
                : `Pay $${(totalAfterDiscount + tip).toFixed(2)}`}
            </button>
          </div>
        </>
      )}
    </div>
  );
}
