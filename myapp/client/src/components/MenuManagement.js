import React, { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import './MenuManagement.css';

const API = process.env.REACT_APP_API_URL || 'http://localhost:3001/api';

/* ═══════════════════════════════════════════════════════════════════════
   Menu Management — CRUD table
   Translates MenuManagementPanel.java to React
   ═══════════════════════════════════════════════════════════════════════ */
export default function MenuManagement() {
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
    });
    setError('');
    setSuccess('');
    setModal('edit');
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
      flashError('Please select an item to delete');
      return;
    }
    if (!window.confirm('Are you sure you want to delete this menu item?')) return;
    try {
      await axios.delete(`${API}/menu/items/${selectedId}`);
      setSelectedId(null);
      flashSuccess('Menu item deleted successfully!');
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

        {/* Toasts */}
        {error && <div className="toast toast-error">{error}</div>}
        {success && <div className="toast toast-success">{success}</div>}
      </div>

      {/* ── Table ─────────────────────────────────────────────────── */}
      <div className="table-wrapper glass-card">
        <table className="mgmt-table" id="menu-table">
          <thead>
            <tr>
              <th>ID</th>
              <th>Item Name</th>
              <th>Category</th>
              <th>Price</th>
              <th>Ingredient IDs</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan="5" className="table-loading">Loading…</td>
              </tr>
            ) : items.length === 0 ? (
              <tr>
                <td colSpan="5" className="table-loading">No menu items found.</td>
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
          + Add New Item
        </button>
        <button className="action-btn edit" onClick={openEdit}>
          ✎ Update Selected
        </button>
        <button className="action-btn delete" onClick={handleDelete}>
          ✕ Delete Selected
        </button>
      </div>

      {/* ── Modal ─────────────────────────────────────────────────── */}
      {modal && (
        <div className="modal-overlay" onClick={() => setModal(null)}>
          <div className="modal-card" onClick={(e) => e.stopPropagation()}>
            <h2>{modal === 'add' ? 'Add New Menu Item' : 'Update Menu Item'}</h2>

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

            <div className="modal-btns">
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
        </div>
      )}
    </div>
  );
}
