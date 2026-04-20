import React, { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import { Link } from 'react-router-dom';
import './MenuManagement.css';
import { BobaIcon } from './BobaIcon';

const API = process.env.REACT_APP_API_URL || 'http://localhost:3001/api';

/* ═══════════════════════════════════════════════════════════════════════
   Menu Management — CRUD table
   Translates MenuManagementPanel.java to React
   ═══════════════════════════════════════════════════════════════════════ */
export default function MenuManagement() {
  const defaultIconConfig = {
    teaColor: '#E6C9A8', milkColor: '#FFFFFF', waveComplexity: 1, hasBoba: true, iceLevel: 'Regular Ice'
  };

  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedId, setSelectedId] = useState(null);

  // Modal state
  const [modal, setModal] = useState(null); // null | 'add' | 'edit'
  const [form, setForm] = useState({
    item_name: '',
    item_category: '',
    price: '',
    ingredient_ids: '',
    icon_config: defaultIconConfig,
  });
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  // ── Fetch all items ────────────────────────────────────────────────
  const loadItems = useCallback(async () => {
    setLoading(true);
    try {
      const res = await axios.get(`${API}/menu/items`);
      setItems(res.data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadItems();
  }, [loadItems]);

  // Auto-populate form when selecting a new row while right panel is open
  useEffect(() => {
    if (modal && modal !== 'add' && selectedId !== null) {
      const item = items.find((i) => i.item_id === selectedId);
      if (item) {
        setForm({
          item_name: item.item_name || '',
          item_category: item.item_category || '',
          price: item.price ? parseFloat(item.price).toFixed(2) : '',
          ingredient_ids: item.ingredients || '',
          icon_config: item.icon_config || defaultIconConfig,
        });
        setError('');
        setSuccess('');
      }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedId, items, modal]);

  // ── Helpers ────────────────────────────────────────────────────────
  const openAdd = () => {
    setForm({ item_name: '', item_category: '', price: '', ingredient_ids: '' });
    setError('');
    setSuccess('');
    setModal('add');
  };

  const openEdit = () => {
    if (selectedId === null) {
      flashError('Please select an item to update');
      return;
    }
    const item = items.find((i) => i.item_id === selectedId);
    if (!item) return;
    setForm({
      item_name: item.item_name,
      item_category: item.item_category,
      price: parseFloat(item.price).toFixed(2),
      ingredient_ids: item.ingredients || '',
      icon_config: item.icon_config || defaultIconConfig,
    });
    setError('');
    setSuccess('');
    setModal('edit');
  };

  const openEditIcon = () => {
    if (selectedId === null) {
      flashError('Please select an item to edit its icon');
      return;
    }
    const item = items.find((i) => i.item_id === selectedId);
    if (!item) return;
    setForm({
      item_name: item.item_name,
      item_category: item.item_category,
      price: parseFloat(item.price).toFixed(2),
      ingredient_ids: item.ingredients || '',
      icon_config: item.icon_config || defaultIconConfig,
    });
    setError('');
    setSuccess('');
    setModal('edit-icon');
  };

  const flashError = (msg) => {
    setError(msg);
    setTimeout(() => setError(''), 3000);
  };

  const flashSuccess = (msg) => {
    setSuccess(msg);
    setTimeout(() => setSuccess(''), 3000);
  };

  const parseIngredients = (str) => {
    if (!str || str.trim() === '') return [];
    return str
      .split(',')
      .map((s) => parseInt(s.trim(), 10))
      .filter((n) => !isNaN(n));
  };

  // ── CRUD handlers ──────────────────────────────────────────────────
  const handleAdd = async () => {
    try {
      await axios.post(`${API}/menu/items`, {
        item_name: form.item_name,
        item_category: form.item_category,
        price: parseFloat(form.price),
        ingredient_ids: parseIngredients(form.ingredient_ids),
      });
      setModal(null);
      flashSuccess('Menu item added successfully!');
      loadItems();
    } catch (err) {
      flashError(err.response?.data?.error || err.message);
    }
  };

  const handleUpdate = async () => {
    try {
      await axios.put(`${API}/menu/items/${selectedId}`, {
        item_name: form.item_name,
        item_category: form.item_category,
        price: parseFloat(form.price),
        ingredient_ids: parseIngredients(form.ingredient_ids),
        icon_config: form.icon_config
      });
      setModal(null);
      flashSuccess('Menu item updated successfully!');
      loadItems();
    } catch (err) {
      flashError(err.response?.data?.error || err.message);
    }
  };

  const handleDelete = async () => {
    if (selectedId === null) {
      flashError('Please select an item to archive');
      return;
    }
    if (!window.confirm('Archive this item? It will be hidden from the menu but kept in the database for order history.')) return;
    try {
      await axios.delete(`${API}/menu/items/${selectedId}`);
      setSelectedId(null);
      setModal(null);
      flashSuccess('Menu item archived successfully!');
      loadItems();
    } catch (err) {
      flashError(err.response?.data?.error || err.message);
    }
  };

  // ── Render ─────────────────────────────────────────────────────────
  return (
    <div className="menu-mgmt">
      <div className="mgmt-header">
        <h1>Menu Items Management</h1>
        <Link className="action-btn back-link-btn" to="/manager-dashboard">
          ← Back to Dashboard
        </Link>

        {/* Toasts */}
        {error && <div className="toast toast-error">{error}</div>}
        {success && <div className="toast toast-success">{success}</div>}
      </div>



      {/* ── Main Layout ───────────────────────────────────────────── */}
      <div className="mgmt-main-content">
        <div className="mgmt-left-panel">
          <div className="table-wrapper glass-card">
        <table className="mgmt-table" id="menu-table">
          <thead>
            <tr>
              <th>ID</th>
              <th>Icon</th>
              <th>Item Name</th>
              <th>Category</th>
              <th>Price</th>
              <th>Ingredient IDs</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan="6" className="table-loading">Loading…</td>
              </tr>
            ) : items.length === 0 ? (
              <tr>
                <td colSpan="6" className="table-loading">No menu items found.</td>
              </tr>
            ) : (
              items.map((item) => (
                <tr
                  key={item.item_id}
                  className={selectedId === item.item_id ? 'selected' : ''}
                  onClick={() =>
                    setSelectedId(selectedId === item.item_id ? null : item.item_id)
                  }
                >
                  <td>{item.item_id}</td>
                  <td>
                    <div style={{ width: '32px', height: '42px', backgroundColor: '#F8F9FA', borderRadius: '4px', padding: '2px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <BobaIcon
                        teaColor={item.icon_config?.teaColor}
                        milkColor={item.icon_config?.milkColor}
                        waveComplexity={item.icon_config?.waveComplexity}
                        iceLevel={item.icon_config?.iceLevel ?? defaultIconConfig.iceLevel}
                        hasBoba={item.icon_config?.hasBoba}
                      />
                    </div>
                  </td>
                  <td>{item.item_name}</td>
                  <td>
                    <span className="cat-chip">{item.item_category}</span>
                  </td>
                  <td className="price-cell">${parseFloat(item.price).toFixed(2)}</td>
                  <td className="ingredients-cell">{item.ingredients || '—'}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* ── Action buttons ────────────────────────────────────────── */}
      <div className="mgmt-actions">
        <button className="action-btn refresh" onClick={loadItems}>
          ↻ Refresh
        </button>
        <button className="action-btn add" onClick={openAdd}>
          + New Item
        </button>
        <button className="action-btn edit" onClick={openEdit}>
          ✎ Update
        </button>
        <button className="action-btn" onClick={openEditIcon} style={{ background: '#7B2CBF', color: 'white', borderColor: '#5A189A' }}>
          🎨 Edit Icon
        </button>
        <button className="action-btn delete" onClick={handleDelete}>
          🗄 Archive
        </button>
      </div>
      </div>

      {modal && (
          <div className="mgmt-right-panel glass-card" style={modal === 'edit-icon' ? { width: '450px' } : undefined}>
            <div className="mgmt-form-header">
              <h2>{modal === 'add' ? 'Add New Menu Item' : (modal === 'edit-icon' ? 'Customize Cup' : 'Update Menu Item')}</h2>
              <button className="mgmt-close-btn" onClick={() => setModal(null)}>&times;</button>
            </div>
            <div className="mgmt-form-body">
            {modal === 'edit-icon' ? (
              <>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', alignItems: 'center', marginTop: '0' }}>
                  <div style={{ width: '110px', height: '150px', flexShrink: 0, backgroundColor: '#F8F9FA', borderRadius: '12px', padding: '0.5rem', display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
                    <BobaIcon
                      teaColor={form.icon_config?.teaColor || defaultIconConfig.teaColor}
                      milkColor={form.icon_config?.milkColor || defaultIconConfig.milkColor}
                      waveComplexity={form.icon_config?.waveComplexity ?? defaultIconConfig.waveComplexity}
                      iceLevel={form.icon_config?.iceLevel ?? defaultIconConfig.iceLevel}
                      hasBoba={form.icon_config?.hasBoba ?? defaultIconConfig.hasBoba}
                    />
                  </div>
                  
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.8rem', width: '100%' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span style={{ fontWeight: 600 }}>Tea Color</span>
                      <div style={{ position: 'relative', width: '36px', height: '36px', borderRadius: '50%', overflow: 'hidden', border: '2px solid #E9ECEF', boxShadow: '0 2px 4px rgba(0,0,0,0.1)' }}>
                        <input type="color" value={form.icon_config?.teaColor || defaultIconConfig.teaColor} onChange={e => setForm({ ...form, icon_config: { ...form.icon_config, teaColor: e.target.value }})} style={{ position: 'absolute', top: '-10px', left: '-10px', width: '56px', height: '56px', border: 'none', cursor: 'pointer', padding: 0 }} />
                      </div>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span style={{ fontWeight: 600 }}>Milk Color</span>
                      <div style={{ position: 'relative', width: '36px', height: '36px', borderRadius: '50%', overflow: 'hidden', border: '2px solid #E9ECEF', boxShadow: '0 2px 4px rgba(0,0,0,0.1)' }}>
                        <input type="color" value={form.icon_config?.milkColor || defaultIconConfig.milkColor} onChange={e => setForm({ ...form, icon_config: { ...form.icon_config, milkColor: e.target.value }})} style={{ position: 'absolute', top: '-10px', left: '-10px', width: '56px', height: '56px', border: 'none', cursor: 'pointer', padding: 0 }} />
                      </div>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span style={{ fontWeight: 600 }}>Wave Style</span>
                      <select value={form.icon_config?.waveComplexity ?? defaultIconConfig.waveComplexity} onChange={e => setForm({ ...form, icon_config: { ...form.icon_config, waveComplexity: parseInt(e.target.value) }})} style={{ padding: '6px 10px', borderRadius: '6px', border: '1px solid #ced4da', outline: 'none' }}>
                        <option value={0}>Flat Layer</option>
                        <option value={1}>Smooth Wave</option>
                        <option value={2}>Swirling Waves</option>
                      </select>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span style={{ fontWeight: 600 }}>Ice Level</span>
                      <select value={form.icon_config?.iceLevel ?? defaultIconConfig.iceLevel} onChange={e => setForm({ ...form, icon_config: { ...form.icon_config, iceLevel: e.target.value }})} style={{ padding: '6px 10px', borderRadius: '6px', border: '1px solid #ced4da', outline: 'none' }}>
                        <option value="More Ice">More Ice</option>
                        <option value="Regular Ice">Regular Ice</option>
                        <option value="Less Ice">Less Ice</option>
                        <option value="No Ice">No Ice</option>
                      </select>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span style={{ fontWeight: 600 }}>Boba Pearls</span>
                      <input type="checkbox" checked={form.icon_config?.hasBoba ?? defaultIconConfig.hasBoba} onChange={e => setForm({ ...form, icon_config: { ...form.icon_config, hasBoba: e.target.checked }})} style={{ cursor: 'pointer', width: '22px', height: '22px', accentColor: '#7B2CBF' }} />
                    </div>
                  </div>
                </div>
              </>
            ) : (
              <>
                <h2>{modal === 'add' ? 'Add New Menu Item' : 'Update Basic Info'}</h2>
                <label>
                  Item Name
                  <input
                    type="text"
                    value={form.item_name}
                    onChange={(e) => setForm({ ...form, item_name: e.target.value })}
                  />
                </label>

                <label>
                  Category
                  <input
                    type="text"
                    value={form.item_category}
                    onChange={(e) => setForm({ ...form, item_category: e.target.value })}
                  />
                </label>

                <label>
                  Price
                  <input
                    type="number"
                    step="0.01"
                    value={form.price}
                    onChange={(e) => setForm({ ...form, price: e.target.value })}
                  />
                </label>

                <label>
                  Ingredient IDs (comma-separated)
                  <input
                    type="text"
                    placeholder="1, 5, 9, 12"
                    value={form.ingredient_ids}
                    onChange={(e) => setForm({ ...form, ingredient_ids: e.target.value })}
                  />
                </label>
              </>
            )}
            </div>

            <div className="mgmt-form-footer">
              <button className="modal-cancel" onClick={() => setModal(null)}>
                Cancel
              </button>
              <button
                className="modal-confirm"
                onClick={modal === 'add' ? handleAdd : handleUpdate}
              >
                {modal === 'add' ? 'Add Item' : 'Save Changes'}
              </button>
            </div>
          </div>
      )}
      </div>
    </div>
  );
}
