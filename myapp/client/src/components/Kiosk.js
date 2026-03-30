import React, { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import './Kiosk.css';

const API = process.env.REACT_APP_API_URL || 'http://localhost:3001/api';

/* ═══════════════════════════════════════════════════════════════════════
   Cashier Dashboard — POS view
   Translates CashierDashboard.java to React
   ═══════════════════════════════════════════════════════════════════════ */
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
  const [tip, setTip] = useState(0);
  const [customTipInput, setCustomTipInput] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [successMessage, setSuccessMessage] = useState('');

  // ── Derived values ─────────────────────────────────────────────────
  const subtotal = orderItems.reduce(
    (sum, item) => sum + item.basePrice + item.bobaPrice,
    0
  );

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
      setView('MENU');
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
            tip={tip}
            setTip={setTip}
            customTipInput={customTipInput}
            setCustomTipInput={setCustomTipInput}
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
            setTip(0);
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
