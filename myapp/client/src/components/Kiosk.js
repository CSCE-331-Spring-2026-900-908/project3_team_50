import React, { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import './Kiosk.css';
import { BobaIcon, BobaTopping, isPopping, TOPPING_STYLES } from './BobaIcon';

const defaultIconConfig = {
  teaColor: '#E6C9A8', milkColor: '#FFFFFF', waveComplexity: 1, hasBoba: true, iceLevel: 'Regular Ice'
};

const API = process.env.REACT_APP_API_URL || 'http://localhost:3001/api';
const TAX_RATE = 0.0825;

/* ═══════════════════════════════════════════════════════════════════════
   Kiosk — Customer ordering view
   Mirrors CashierDashboard but for customer self-service
   ═══════════════════════════════════════════════════════════════════════ */
export default function Kiosk() {
  // ── State ──────────────────────────────────────────────────────────
  const [categories, setCategories] = useState([]);
  const [menuItems, setMenuItems] = useState([]);
  const [bobaToppings, setBobaToppings] = useState([]);

  // Customer state
  const [customer, setCustomer] = useState(null);
  const [showCustomerLogin, setShowCustomerLogin] = useState(true);
  const [pastOrders, setPastOrders] = useState([]);

  // Order state
  const [orderItems, setOrderItems] = useState([]);
  const [currentItemIndex, setCurrentItemIndex] = useState(null);

  // View state — "ITEMS" | "ADDONS" | "CHECKOUT"
  const [view, setView] = useState('ITEMS');
  const [tip, setTip] = useState(0);
  const [customTipInput, setCustomTipInput] = useState('');
  const [pointsToRedeem, setPointsToRedeem] = useState(0);
  const [isProcessing, setIsProcessing] = useState(false);
  const [successMessage, setSuccessMessage] = useState('');
  
  // Track which past orders have been reordered (for toggle behavior)
  const [reorderedOrderIds, setReorderedOrderIds] = useState(new Set());

  // ── Derived values ─────────────────────────────────────────────────
  const subtotal = orderItems.reduce(
    (sum, item) => sum + item.basePrice + item.bobaPrice,
    0
  );

  const pointsDiscount = pointsToRedeem / 10; // 10 points = $1
  const totalAfterDiscount = Math.max(0, subtotal - pointsDiscount);
  const taxAmount = Number((totalAfterDiscount * TAX_RATE).toFixed(2));

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

  const handleSetCustomer = (customerData) => {
    setCustomer(customerData);
    setShowCustomerLogin(false);
    
    // Fetch past orders if customer has any
    if (customerData && customerData.past_orders) {
      const orderIds = customerData.past_orders.split(',').map(id => id.trim()).filter(id => id);
      console.log('Fetching past orders:', orderIds);
      fetchPastOrders(orderIds);
    } else {
      console.log('No past orders for customer:', customerData);
    }
  };

  const fetchPastOrders = async (orderIds) => {
    try {
      console.log('Attempting to fetch orders:', orderIds);
      const orders = await Promise.all(
        orderIds.map(orderId =>
          axios.get(`${API}/orders/${orderId}`)
        )
      );
      console.log('Fetched orders:', orders.map(r => r.data));
      setPastOrders(orders.map(r => r.data));
    } catch (err) {
      console.error('Failed to fetch past orders:', err);
    }
  };

  const handleReorderClick = async (pastOrderId) => {
    try {
      // Check if this order is already reordered
      if (reorderedOrderIds.has(pastOrderId)) {
        // Remove items from this order
        setOrderItems(prev => prev.filter(item => item._reorderedFrom !== pastOrderId));
        setReorderedOrderIds(prev => {
          const newSet = new Set(prev);
          newSet.delete(pastOrderId);
          return newSet;
        });
      } else {
        // Add items from this order
        const response = await axios.get(`${API}/orders/${pastOrderId}`);
        const { items } = response.data;
        
        setOrderItems(prev => [
          ...items.map(item => ({
            baseItemId: item.baseItemId,
            name: item.name,
            basePrice: item.basePrice,
            bobaInventoryId: item.bobaInventoryId,
            boba: item.boba,
            bobaPrice: item.bobaPrice,
            ice: item.ice,
            sweetness: item.sweetness,
            iconConfig: item.iconConfig,
            _reorderedFrom: pastOrderId, // Track which past order this came from
          })),
          ...prev
        ]);
        
        setReorderedOrderIds(prev => new Set(prev).add(pastOrderId));
      }
      
      setView('ITEMS');
    } catch (err) {
      alert('Failed to load past order: ' + (err.response?.data?.error || err.message));
    }
  };

  const handleStartNewOrder = () => {
    setCustomer(null);
    setShowCustomerLogin(true);
    setOrderItems([]);
    setTip(0);
    setPointsToRedeem(0);
    setView('ITEMS');
    setSuccessMessage('');
    setPastOrders([]);
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
        customer_id: customer?.cus_id || null,
        customer_name: customerName || customer?.cus_fname + ' ' + customer?.cus_lname || 'Walk-in',
        total: totalAfterDiscount + taxAmount + tip,
        subtotal: subtotal,
        tip,
        points_redeemed: pointsToRedeem,
        payment_method: 'Card',
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
      setView('ITEMS');
      setSuccessMessage('Payment Successful!');
      setTimeout(() => handleStartNewOrder(), 3000);
    } catch (err) {
      alert('Checkout failed: ' + (err.response?.data?.error || err.message));
    } finally {
      setIsProcessing(false);
    }
  };

  // ── Render ─────────────────────────────────────────────────────────
  
  // Show customer login modal if not logged in
  if (showCustomerLogin) {
    return <CustomerLogin onLogin={handleSetCustomer} />;
  }

  return (
    <div className="kiosk-layout">
      <div className="kiosk-content-wrapper">
      
      {/* ── Customer Info Header ──────────────────────────────────── */}
      <div className="kiosk-customer-header">
        <div className="customer-info-left">
          <span className="customer-greeting">
            {customer ? `Welcome, ${customer.cus_fname}!` : 'Guest'}
          </span>
        </div>
        <div className="customer-info-center">
          {customer && (
            <span className="customer-points">
               {customer.points} points
            </span>
          )}
        </div>
        <div className="customer-info-right">
          <button 
            className="logout-customer-btn"
            onClick={handleStartNewOrder}
            title="Start new order with different customer"
          >
            ✕ Switch Customer
          </button>
        </div>
      </div>

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
              {/* Past Orders Section */}
              {customer && pastOrders.length > 0 && (
                <div className="past-orders-section">
                  <h2 className="items-title">Your Past Orders</h2>
                  <div className="past-orders-grid">
                    {pastOrders.map((order, idx) => (
                      <div key={idx} className="past-order-card">
                        <div className="past-order-header">
                          <span className="past-order-label">Order #{order.order_id}</span>
                        </div>
                        <div className="past-order-items">
                          {order.items.slice(0, 3).map((item, itemIdx) => (
                            <div key={itemIdx} className="past-order-item">
                              <span className="item-name-compact">{item.name}</span>
                              {item.boba !== 'No Boba' && (
                                <span className="item-addon">+ {item.boba}</span>
                              )}
                            </div>
                          ))}
                          {order.items.length > 3 && (
                            <span className="items-more">+{order.items.length - 3} more</span>
                          )}
                        </div>
                        <button
                          className={`reorder-btn ${reorderedOrderIds.has(order.order_id) ? 'active' : ''}`}
                          onClick={() => handleReorderClick(order.order_id)}
                        >
                          {reorderedOrderIds.has(order.order_id) ? 'Remove' : 'Reorder'}
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}

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
            totalAfterDiscount={totalAfterDiscount}
            tip={tip}
            setTip={setTip}
            customTipInput={customTipInput}
            setCustomTipInput={setCustomTipInput}
            customer={customer}
            pointsToRedeem={pointsToRedeem}
            setPointsToRedeem={setPointsToRedeem}
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
                    <span> {item.ice}</span>
                    <button className="addon-remove-btn" onClick={() => {
                      const copy = [...orderItems];
                      copy[i] = { ...copy[i], ice: 'Regular Ice' };
                      setOrderItems(copy);
                    }}>✕</button>
                  </div>
                )}
                {item.sweetness !== 'Regular Sweet' && (
                  <div className="order-addon-row">
                    <span> {item.sweetness}</span>
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
      </aside>
      </div>
    </div>
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
        <h3 className="addon-section-title"> Boba Toppings</h3>

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
        <h3 className="addon-section-title"> Ice Level</h3>
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
        <h3 className="addon-section-title"> Sweetness</h3>
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
  totalAfterDiscount,
  tip,
  setTip,
  customTipInput,
  setCustomTipInput,
  customer,
  pointsToRedeem,
  setPointsToRedeem,
  onPay,
  onBack,
  isProcessing,
}) {
  const [customerName, setCustomerName] = useState('');
  const [showPointsInput, setShowPointsInput] = useState(false);
  const [pointsInput, setPointsInput] = useState('');

  const tipPresets = [
    { label: '10%', calc: subtotal * 0.1 },
    { label: '15%', calc: subtotal * 0.15 },
    { label: '20%', calc: subtotal * 0.2 },
  ];

  const availablePoints = customer?.points || 0;
  const pointsDiscount = pointsToRedeem / 10;
  const taxAmount = Number((totalAfterDiscount * TAX_RATE).toFixed(2));
  const total = totalAfterDiscount + taxAmount + tip;
  const maxPointsByDiscount = Math.ceil(subtotal) * 10;
   const effectiveMaxPoints = Math.min(availablePoints, maxPointsByDiscount);

  const handleApplyPoints = () => {
    const points = parseInt(pointsInput, 10);
    if (isNaN(points) || points < 0) {
      alert('Please enter a valid number');
      return;
    }
    if (points > availablePoints) {
      alert('Cannot redeem more points than available');
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
        
        {pointsToRedeem > 0 && (
          <div className="summary-row discount-row">
            <span>Points Discount ({pointsToRedeem} pts)</span>
            <span>-${pointsDiscount.toFixed(2)}</span>
          </div>
        )}
        <div className="summary-row">
          <span>Tax (8.25%)</span>
          <span>${taxAmount.toFixed(2)}</span>
        </div>
        
        <div className="summary-row">
          <span>Tip</span>
          <span>${tip.toFixed(2)}</span>
        </div>
        <div className="summary-row total-row">
          <span>Total</span>
          <span>${total.toFixed(2)}</span>
        </div>
      </div>

      {/* Points Redemption Section */}
      {customer && availablePoints > 0 && (
        <div className="points-section">
          <div className="points-header">
            <h3>Loyalty Points</h3>
            <span className="available-points">{availablePoints} pts available</span>
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
                Redeeming <strong>{pointsToRedeem} points</strong> for <strong>${pointsDiscount.toFixed(2)}</strong> off
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
          placeholder={customer ? `${customer.cus_fname} ${customer.cus_lname}` : 'Walk-in'}
          value={customerName}
          onChange={(e) => setCustomerName(e.target.value)}
        />
      </div>

      <button
        className="pay-btn"
        onClick={() => onPay(customerName)}
        disabled={isProcessing}
      >
        {isProcessing ? 'Processing…' : `Pay $${total.toFixed(2)}`}
      </button>
    </div>
  );
}

/* ─── Customer Login Sub-Component ──────────────────────────────────── */
function CustomerLogin({ onLogin }) {
  const [screen, setScreen] = useState('login'); // 'login' or 'register'
  const [loginMethod, setLoginMethod] = useState('email'); // 'email' or 'phone'
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  // Register form state
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [registerEmail, setRegisterEmail] = useState('');
  const [registerPhone, setRegisterPhone] = useState('');

  const handleLogin = async () => {
    setError('');
    
    if (loginMethod === 'email' && !email.trim()) {
      setError('Please enter your email');
      return;
    }
    if (loginMethod === 'phone' && !phone.trim()) {
      setError('Please enter your phone number');
      return;
    }

    setIsLoading(true);
    try {
      const response = await axios.post(`${API}/auth/customer-lookup`, {
        [loginMethod === 'email' ? 'email' : 'phone_number']: loginMethod === 'email' ? email : phone,
      });

      if (response.data.customer) {
        onLogin(response.data.customer);
      } else {
        setError('Customer not found');
      }
    } catch (err) {
      // If customer not found (404), offer to create account
      if (err.response?.status === 404) {
        setError('');
        // Pre-fill registration form with lookup info
        if (loginMethod === 'email') {
          setRegisterEmail(email);
        } else {
          setRegisterPhone(phone);
        }
        setScreen('register');
      } else {
        setError(err.response?.data?.error || 'Login failed. Please try again.');
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleRegister = async () => {
    setError('');

    if (!firstName.trim()) {
      setError('First name is required');
      return;
    }
    if (!lastName.trim()) {
      setError('Last name is required');
      return;
    }
    if (!registerEmail.trim() && !registerPhone.trim()) {
      setError('Please provide an email or phone number');
      return;
    }

    setIsLoading(true);
    try {
      const response = await axios.post(`${API}/auth/register-customer`, {
        first_name: firstName,
        last_name: lastName,
        email: registerEmail || undefined,
        phone: registerPhone || undefined,
      });

      // Account created and logged in
      if (response.data.customer) {
        onLogin(response.data.customer);
      } else {
        setError('Account created but login failed');
      }
    } catch (err) {
      setError(err.response?.data?.error || 'Registration failed. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleSkip = () => {
    // Allow guest checkout
    onLogin(null);
  };

  const handleKeyPress = (e) => {
    if (e.key === 'Enter') {
      if (screen === 'login') {
        handleLogin();
      } else {
        handleRegister();
      }
    }
  };

  if (screen === 'register') {
    return (
      <div className="customer-login-modal">
        <div className="customer-login-box">
          <div className="login-header">
            <h1 className="login-title">Create Account</h1>
            <p className="login-subtitle">Join our loyalty program</p>
            <p className="login-text">Earn points on every purchase!</p>
          </div>

          <div className="register-form">
            <div className="form-row">
              <div className="form-col">
                <label>First Name *</label>
                <input
                  type="text"
                  placeholder="John"
                  value={firstName}
                  onChange={(e) => setFirstName(e.target.value)}
                  onKeyPress={handleKeyPress}
                  disabled={isLoading}
                  autoFocus
                />
              </div>
              <div className="form-col">
                <label>Last Name *</label>
                <input
                  type="text"
                  placeholder="Doe"
                  value={lastName}
                  onChange={(e) => setLastName(e.target.value)}
                  onKeyPress={handleKeyPress}
                  disabled={isLoading}
                />
              </div>
            </div>

            <div className="form-group">
              <label>Email (optional)</label>
              <input
                type="email"
                placeholder="you@example.com"
                value={registerEmail}
                onChange={(e) => setRegisterEmail(e.target.value)}
                onKeyPress={handleKeyPress}
                disabled={isLoading}
              />
            </div>

            <div className="form-group">
              <label>Phone Number (optional)</label>
              <input
                type="tel"
                placeholder="(555) 123-4567"
                value={registerPhone}
                onChange={(e) => setRegisterPhone(e.target.value)}
                onKeyPress={handleKeyPress}
                disabled={isLoading}
              />
            </div>

            {error && <p className="login-error">{error}</p>}

            <button
              className="login-btn"
              onClick={handleRegister}
              disabled={isLoading}
            >
              {isLoading ? 'Creating Account...' : 'Create Account'}
            </button>

            <button
              className="back-to-login-btn"
              onClick={() => {
                setScreen('login');
                setError('');
                setFirstName('');
                setLastName('');
                setRegisterEmail('');
                setRegisterPhone('');
              }}
              disabled={isLoading}
            >
              Back to Login
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="customer-login-modal">
      <div className="customer-login-box">
        <div className="login-header">
          <h1 className="login-title">Welcome</h1>
          <p className="login-subtitle">Sign in to your account</p>
          <p className="login-text">Earn and redeem points on your purchases!</p>
        </div>

        <div className="login-method-tabs">
          <button
            className={`login-tab ${loginMethod === 'email' ? 'active' : ''}`}
            onClick={() => {
              setLoginMethod('email');
              setError('');
            }}
          >
            Email
          </button>
          <button
            className={`login-tab ${loginMethod === 'phone' ? 'active' : ''}`}
            onClick={() => {
              setLoginMethod('phone');
              setError('');
            }}
          >
            Phone
          </button>
        </div>

        <div className="login-input-group">
          {loginMethod === 'email' ? (
            <input
              type="email"
              placeholder="you@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              onKeyPress={handleKeyPress}
              disabled={isLoading}
              autoFocus
            />
          ) : (
            <input
              type="tel"
              placeholder="(555) 123-4567"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              onKeyPress={handleKeyPress}
              disabled={isLoading}
              autoFocus
            />
          )}
        </div>

        {error && <p className="login-error">{error}</p>}

        <button
          className="login-btn"
          onClick={handleLogin}
          disabled={isLoading}
        >
          {isLoading ? 'Signing in...' : 'Sign In'}
        </button>

        <div className="login-divider">or</div>

        <button
          className="skip-btn"
          onClick={handleSkip}
          disabled={isLoading}
        >
          Continue as Guest
        </button>

        <p className="login-info">
          Don't have an account? Just sign in with your email/phone and we'll create one for you!
        </p>
      </div>
    </div>
  );
}
