import React, { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import './Kiosk.css';
import { BobaIcon, BobaTopping, isPopping, TOPPING_STYLES } from './BobaIcon';

const defaultIconConfig = {
  teaColor: '#E6C9A8', milkColor: '#FFFFFF', waveComplexity: 1, hasBoba: true, iceLevel: 'Regular Ice'
};

const API = process.env.REACT_APP_API_URL || 'http://localhost:3001/api';

/* ═══════════════════════════════════════════════════════════════════════
   Kiosk — Customer ordering view
   Mirrors CashierDashboard but for customer self-service
   ═══════════════════════════════════════════════════════════════════════ */
export default function Kiosk() {
  // ── State ──────────────────────────────────────────────────────────
  const [categories, setCategories] = useState([]);
  const [menuItems, setMenuItems] = useState([]);
  const [bobaToppings, setBobaToppings] = useState([]);

  // Order state
  const [orderItems, setOrderItems] = useState([]);
  const [currentItemIndex, setCurrentItemIndex] = useState(null);

  // View state — "ITEMS" | "ADDONS" | "CHECKOUT"
  const [view, setView] = useState('ITEMS');
  const [tip, setTip] = useState(0);
  const [customTipInput, setCustomTipInput] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [successMessage, setSuccessMessage] = useState('');
  const [chatInput, setChatInput] = useState('');
  const [isChatLoading, setIsChatLoading] = useState(false);
  const [chatMessages, setChatMessages] = useState([
    {
      role: 'assistant',
      text: 'Hi! Tell me what flavors or caffeine level you like, and I can recommend drinks.',
      recommendations: [],
    },
  ]);

  // ── Derived values ─────────────────────────────────────────────────
  const subtotal = orderItems.reduce(
    (sum, item) => sum + item.basePrice + item.bobaPrice,
    0
  );

  // ── Data fetching ──────────────────────────────────────────────────
  useEffect(() => {
    axios.get(`${API}/menu/categories`).then((r) => {
      setCategories(r.data);
    });
    axios.get(`${API}/menu/boba`).then((r) => setBobaToppings(r.data));
  }, []);

  const fetchItems = useCallback(() => {
    axios
      .get(`${API}/menu/items`)
      .then((r) => setMenuItems(r.data));
  }, []);

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
      iconConfig: item.icon_config || null,
    };
    setOrderItems((prev) => [newItem, ...prev]);
    setCurrentItemIndex(0);
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
      setView('CATEGORIES');
      setSuccessMessage('Payment Successful!');
      setTimeout(() => setSuccessMessage(''), 3000);
    } catch (err) {
      alert('Checkout failed: ' + (err.response?.data?.error || err.message));
    } finally {
      setIsProcessing(false);
    }
  };

  const addRecommendedItemToOrder = (recommendation) => {
    const normalizedName = String(recommendation?.name || '').trim().toLowerCase();
    const menuMatch = menuItems.find((item) => {
      const itemName = String(item.item_name || '').trim().toLowerCase();
      return item.item_id === recommendation?.itemId || itemName === normalizedName;
    });

    if (!menuMatch) {
      alert('That recommended item is not currently available in the kiosk menu.');
      return;
    }

    addItemToOrder(menuMatch);
  };

  const submitChatPrompt = async () => {
    const trimmedInput = chatInput.trim();
    if (!trimmedInput || isChatLoading) return;

    const userMessage = { role: 'user', text: trimmedInput, recommendations: [] };
    setChatMessages((prev) => [...prev, userMessage]);
    setChatInput('');
    setIsChatLoading(true);

    try {
      const response = await axios.post(`${API}/chatbot/recommend`, {
        preferences: trimmedInput,
      });

      const assistantMessage = {
        role: 'assistant',
        text: response.data?.message || 'Here are some recommendations for you.',
        recommendations: Array.isArray(response.data?.recommendations)
          ? response.data.recommendations
          : [],
      };

      setChatMessages((prev) => [...prev, assistantMessage]);
    } catch (err) {
      setChatMessages((prev) => [
        ...prev,
        {
          role: 'assistant',
          text: err.response?.data?.error || 'Sorry, I could not get recommendations right now.',
          recommendations: [],
        },
      ]);
    } finally {
      setIsChatLoading(false);
    }
  };

  // ── Render ─────────────────────────────────────────────────────────
  return (
    <div className="kiosk-layout">
      <div className="kiosk-content-wrapper">
      {view === 'ADDONS' && currentItemIndex !== null && (
        <button className="back-arrow" onClick={() => {
          setCurrentItemIndex(null);
          setView('ITEMS');
        }}>
          ← Back
        </button>
      )}
      {/* ── MAIN CONTENT ──────────────────────────────────────────────── */}
      <div className="kiosk-main">
        {view === 'ITEMS' && (
          <div className="items-view" style={{ display: 'flex', flexDirection: 'row', gap: '16px' }}>
            {/* Sidebar Anchor Navigation */}
            <nav className="kiosk-sidebar-nav">
              <p className="cat-nav-label">Categories</p>
              {categories.map((category) => (
                <button
                  key={category}
                  className="category-nav-btn"
                  onClick={() => {
                    const el = document.getElementById(`category-${category}`);
                    if (el) el.scrollIntoView({ behavior: 'smooth' });
                  }}
                >
                  {category}
                </button>
              ))}
            </nav>

            {/* Continuous Scroll Items */}
            <div className="items-scroll-container">
              {categories.map((category) => {
                const itemsInCategory = menuItems.filter(i => i.item_category === category);
                if (itemsInCategory.length === 0) return null;
                return (
                  <div key={category} id={`category-${category}`} className="category-section">
                    <h2 className="items-title">{category}</h2>
                    <div className="items-grid">
                      {itemsInCategory.map((item) => (
                        <button
                          key={item.item_id}
                          className="item-card"
                          onClick={() => addItemToOrder(item)}
                        >
                          <div className="item-icon-wrap">
                            <BobaIcon
                              teaColor={item.icon_config?.teaColor || defaultIconConfig.teaColor}
                              milkColor={item.icon_config?.milkColor || defaultIconConfig.milkColor}
                              waveComplexity={item.icon_config?.waveComplexity ?? defaultIconConfig.waveComplexity}
                              iceLevel={'Regular Ice'}
                              hasBoba={item.icon_config?.hasBoba ?? defaultIconConfig.hasBoba}
                            />
                          </div>
                          <span className="item-name">{item.item_name}</span>
                          <span className="item-price">${parseFloat(item.price).toFixed(2)}</span>
                        </button>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {view === 'ADDONS' && currentItemIndex !== null && (
          <div className="addons-view">
            <div className="addons-header-row">
              <h2 className="addons-heading">
                Customize: <span className="highlight">{orderItems[currentItemIndex].name}</span>
              </h2>
            </div>

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
          {orderItems.map((item, i) => {
            const bobaStyle = TOPPING_STYLES[item.boba];
            const pearlColor = bobaStyle ? bobaStyle.fill : '#1A0A02';
            const isEditing = view === 'ADDONS' && i === currentItemIndex;
            return (
            <div key={i} className="order-row">
              {isEditing ? (
                /* Large preview when actively editing this drink */
                <>
                  <div className="order-row-top">
                    <div className="order-item-info">
                      <span className="order-item-name">{item.name}</span>
                      <span className="order-item-price">
                        ${(item.basePrice + item.bobaPrice).toFixed(2)}
                      </span>
                    </div>
                    <button
                      className="remove-btn"
                      title="Remove item"
                      onClick={() => removeItem(i)}
                    >
                      ✕
                    </button>
                  </div>
                  <div className="order-icon-large">
                    <BobaIcon
                      teaColor={item.iconConfig?.teaColor || defaultIconConfig.teaColor}
                      milkColor={item.iconConfig?.milkColor || defaultIconConfig.milkColor}
                      waveComplexity={item.iconConfig?.waveComplexity ?? defaultIconConfig.waveComplexity}
                      iceLevel={item.ice}
                      hasBoba={item.boba !== 'No Boba'}
                      bobaColor={pearlColor}
                      logoText="TEAM 50"
                    />
                  </div>
                </>
              ) : (
                /* Normal compact row */
                <div className="order-row-top">
                  <div className="order-icon-mini">
                    <BobaIcon
                      teaColor={item.iconConfig?.teaColor || defaultIconConfig.teaColor}
                      milkColor={item.iconConfig?.milkColor || defaultIconConfig.milkColor}
                      waveComplexity={item.iconConfig?.waveComplexity ?? defaultIconConfig.waveComplexity}
                      iceLevel={item.ice}
                      hasBoba={item.boba !== 'No Boba'}
                      bobaColor={pearlColor}
                      logoText=""
                    />
                  </div>
                  <div className="order-item-info">
                    <span className="order-item-name">{item.name}</span>
                    <span className="order-item-price">
                      ${(item.basePrice + item.bobaPrice).toFixed(2)}
                    </span>
                  </div>
                  <button
                    className="remove-btn"
                    title="Remove item"
                    onClick={() => removeItem(i)}
                  >
                    ✕
                  </button>
                </div>
              )}
              {/* Per-addon rows, each removable */}
              <div className="order-addons">
                {item.boba !== 'No Boba' && (
                  <div className="order-addon-row">
                    <span className="addon-row-icon-wrap">
                      <svg viewBox="0 0 20 20" aria-hidden="true" className="addon-row-pearl-svg">
                        {(() => {
                          const s = TOPPING_STYLES[item.boba];
                          const c = s ? s.fill : '#1A0A02';
                          const r = s ? s.rim : '#3D1A04';
                          return [<circle key={0} cx={7} cy={10} r={5} fill={c} stroke={r} strokeWidth={1} />, <circle key={1} cx={14} cy={10} r={5} fill={c} stroke={r} strokeWidth={1} />];
                        })()}
                      </svg>
                      {item.boba}
                    </span>
                    <button className="addon-remove-btn" onClick={() => {
                      const copy = [...orderItems];
                      copy[i] = { ...copy[i], bobaInventoryId: -1, boba: 'No Boba', bobaPrice: 0 };
                      setOrderItems(copy);
                    }}>✕</button>
                  </div>
                )}
                {item.ice !== 'Regular Ice' && (
                  <div className="order-addon-row">
                    <span>🧊 {item.ice}</span>
                    <button className="addon-remove-btn" onClick={() => {
                      const copy = [...orderItems];
                      copy[i] = { ...copy[i], ice: 'Regular Ice' };
                      setOrderItems(copy);
                    }}>✕</button>
                  </div>
                )}
                {item.sweetness !== 'Regular Sweet' && (
                  <div className="order-addon-row">
                    <span>🍯 {item.sweetness}</span>
                    <button className="addon-remove-btn" onClick={() => {
                      const copy = [...orderItems];
                      copy[i] = { ...copy[i], sweetness: 'Regular Sweet' };
                      setOrderItems(copy);
                    }}>✕</button>
                  </div>
                )}
              </div>
            </div>
            );
          })}
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

        <ChatbotPanel
          chatInput={chatInput}
          setChatInput={setChatInput}
          onSubmit={submitChatPrompt}
          isLoading={isChatLoading}
          messages={chatMessages}
          onAddRecommendation={addRecommendedItemToOrder}
        />
      </aside>
      </div>
    </div>
  );
}

function ChatbotPanel({
  chatInput,
  setChatInput,
  onSubmit,
  isLoading,
  messages,
  onAddRecommendation,
}) {
  const quickPrompts = [
    'fruity low caffeine',
    'sweet milk tea',
    'something refreshing',
  ];

  return (
    <section className="kiosk-chatbot-panel" aria-label="Kiosk recommendation assistant">
      <h4 className="kiosk-chatbot-title">Assistant</h4>
      <div className="kiosk-chatbot-quick-prompts" aria-label="Quick prompt suggestions">
        {quickPrompts.map((prompt) => (
          <button
            key={prompt}
            type="button"
            className="chat-quick-btn"
            onClick={() => setChatInput(prompt)}
          >
            {prompt}
          </button>
        ))}
      </div>
      <div className="kiosk-chatbot-messages" aria-live="polite">
        {messages.map((message, index) => (
          <div key={`${message.role}-${index}`} className={`chat-message ${message.role}`}>
            <p>{message.text}</p>
            {message.role === 'assistant' && Array.isArray(message.recommendations) && message.recommendations.length > 0 && (
              <div className="chat-recommendations">
                {message.recommendations.map((rec, recIndex) => (
                  <div key={`${rec.name}-${recIndex}`} className="chat-recommendation-card">
                    <div className="chat-recommendation-meta">
                      <span className="chat-recommendation-name">{rec.name}</span>
                      {typeof rec.price === 'number' && (
                        <span className="chat-recommendation-price">${rec.price.toFixed(2)}</span>
                      )}
                    </div>
                    {rec.reason && <span className="chat-recommendation-reason">{rec.reason}</span>}
                    <button
                      type="button"
                      className="chat-add-btn"
                      aria-label={`Add ${rec.name} to order`}
                      onClick={() => onAddRecommendation(rec)}
                    >
                      Add to Order
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        ))}
        {isLoading && <p className="chat-loading">Thinking...</p>}
      </div>
      <div className="kiosk-chatbot-input-row">
        <input
          type="text"
          value={chatInput}
          onChange={(e) => setChatInput(e.target.value)}
          placeholder="e.g. fruity, low caffeine"
          aria-label="Describe your drink preferences"
          onKeyDown={(e) => {
            if (e.key === 'Enter') onSubmit();
          }}
        />
        <button
          type="button"
          onClick={onSubmit}
          disabled={isLoading || !chatInput.trim()}
          aria-label="Send recommendation request"
        >
          Send
        </button>
      </div>
    </section>
  );
}

/* ─── Addons Sub-Component ─────────────────────────────────────────── */
function AddonsPanel({ item, bobaToppings, onSelectBoba, onUpdateItem, onDone }) {
  const iceOptions     = ['More Ice', 'Regular Ice', 'Less Ice', 'No Ice'];
  const sweetnessOpts  = ['More Sweet', 'Regular Sweet', 'Less Sweet'];

  const clearBoba = () => {
    onUpdateItem('bobaInventoryId', -1);
    onUpdateItem('boba', 'No Boba');
    onUpdateItem('bobaPrice', 0);
  };

  return (
    <div className="addons-panel">
      {/* Toppings and sections follow */}
      {/* ── Boba Toppings ─────────────────────────────────────────── */}
      <section className="addon-section" aria-label="Boba toppings">
        <h3 className="addon-section-title">🧋 Boba Toppings</h3>

        {/* Regular Boba subsection */}
        <p className="addon-sub-label">Classic Boba — <strong>+$0.50</strong></p>
        <div className="boba-topping-grid">
          {bobaToppings.filter((t) => !isPopping(t.name)).map((t) => (
            <BobaTopping
              key={t.id}
              topping={t}
              selected={item.bobaInventoryId === t.id}
              onClick={() => onSelectBoba(t)}
            />
          ))}
        </div>

        {/* Popping Boba subsection */}
        <p className="addon-sub-label" style={{ marginTop: '16px' }}>Popping Boba — <strong>+$0.50</strong></p>
        <div className="boba-topping-grid">
          {bobaToppings.filter((t) => isPopping(t.name)).map((t) => (
            <BobaTopping
              key={t.id}
              topping={t}
              selected={item.bobaInventoryId === t.id}
              onClick={() => onSelectBoba(t)}
            />
          ))}
        </div>

        {/* No-Boba option */}
        <div className="boba-topping-grid" style={{ marginTop: '12px' }}>
          <button
            className={`boba-topping-card no-boba-card${item.bobaInventoryId === -1 ? ' selected' : ''}`}
            onClick={clearBoba}
            aria-pressed={item.bobaInventoryId === -1}
          >
            <svg viewBox="0 0 34 34" aria-hidden="true" className="boba-topping-svg">
              <line x1="8" y1="8" x2="26" y2="26" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
              <line x1="26" y1="8" x2="8" y2="26" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
            </svg>
            <span className="boba-topping-name">No Boba</span>
            <span className="boba-topping-price">Free</span>
          </button>
        </div>
      </section>

      {/* ── Ice Level ─────────────────────────────────────────────── */}
      <section className="addon-section" aria-label="Ice level">
        <h3 className="addon-section-title">🧊 Ice Level</h3>
        <div className="addon-options">
          {iceOptions.map((opt) => (
            <button
              key={opt}
              className={`addon-btn${item.ice === opt ? ' selected' : ''}`}
              onClick={() => onUpdateItem('ice', opt)}
            >
              {opt}
            </button>
          ))}
        </div>
      </section>

      {/* ── Sweetness ─────────────────────────────────────────────── */}
      <section className="addon-section" aria-label="Sweetness level">
        <h3 className="addon-section-title">🍯 Sweetness</h3>
        <div className="addon-options">
          {sweetnessOpts.map((opt) => (
            <button
              key={opt}
              className={`addon-btn${item.sweetness === opt ? ' selected' : ''}`}
              onClick={() => onUpdateItem('sweetness', opt)}
            >
              {opt}
            </button>
          ))}
        </div>
      </section>

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
