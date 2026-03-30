import React, { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import { Link } from 'react-router-dom';
import './InventoryManagement.css';

const API = process.env.REACT_APP_API_URL || 'http://localhost:3001/api';

export default function InventoryManagement() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedId, setSelectedId] = useState(null);

  const [modal, setModal] = useState(null); // null | 'add' | 'edit'
  const [form, setForm] = useState({
    name: '',
    current_stock: '',
    max_stock: '',
    min_stock: '',
    unit: '',
    unit_cost: '',
  });
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const loadItems = useCallback(async () => {
    setLoading(true);
    try {
      const res = await axios.get(`${API}/inventory/items`);
      setItems(res.data);
    } catch (err) {
      console.error(err);
      flashError('Failed to load inventory items');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadItems();
  }, [loadItems]);

  const flashError = (msg) => {
    setError(msg);
    setTimeout(() => setError(''), 3000);
  };

  const flashSuccess = (msg) => {
    setSuccess(msg);
    setTimeout(() => setSuccess(''), 3000);
  };

  const openAdd = () => {
    setForm({
      name: '',
      current_stock: '',
      max_stock: '',
      min_stock: '',
      unit: '',
      unit_cost: '',
    });
    setError('');
    setSuccess('');
    setModal('add');
  };

  const openEdit = () => {
    if (selectedId === null) {
      flashError('Please select an item to update');
      return;
    }
    const item = items.find((i) => i.inventory_id === selectedId);
    if (!item) return;

    setForm({
      name: item.name ?? '',
      current_stock: String(item.current_stock ?? ''),
      max_stock: String(item.max_stock ?? ''),
      min_stock: String(item.min_stock ?? ''),
      unit: item.unit ?? '',
      unit_cost: String(item.unit_cost ?? ''),
    });
    setError('');
    setSuccess('');
    setModal('edit');
  };

  const payloadFromForm = () => ({
    name: form.name.trim(),
    current_stock: parseFloat(form.current_stock),
    max_stock: parseFloat(form.max_stock),
    min_stock: parseFloat(form.min_stock),
    unit: form.unit.trim(),
    unit_cost: parseFloat(form.unit_cost),
  });

  const validateForm = () => {
    const payload = payloadFromForm();

    if (!payload.name || !payload.unit) {
      flashError('Name and unit are required');
      return false;
    }

    if (
      Number.isNaN(payload.current_stock) ||
      Number.isNaN(payload.max_stock) ||
      Number.isNaN(payload.min_stock) ||
      Number.isNaN(payload.unit_cost)
    ) {
      flashError('Please enter valid numeric values');
      return false;
    }

    if (
      payload.current_stock < 0 ||
      payload.max_stock < 0 ||
      payload.min_stock < 0 ||
      payload.unit_cost < 0
    ) {
      flashError('Stock values and unit cost cannot be negative');
      return false;
    }

    if (payload.min_stock > payload.max_stock) {
      flashError('Minimum stock cannot be greater than maximum stock');
      return false;
    }

    return true;
  };

  const handleAdd = async () => {
    if (!validateForm()) return;

    try {
      await axios.post(`${API}/inventory/items`, payloadFromForm());
      setModal(null);
      flashSuccess('Inventory item added successfully!');
      loadItems();
    } catch (err) {
      flashError(err.response?.data?.error || err.message);
    }
  };

  const handleUpdate = async () => {
    if (!validateForm()) return;

    try {
      await axios.put(`${API}/inventory/items/${selectedId}`, payloadFromForm());
      setModal(null);
      flashSuccess('Inventory item updated successfully!');
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
    if (!window.confirm('Are you sure you want to delete this inventory item?')) return;

    try {
      await axios.delete(`${API}/inventory/items/${selectedId}`);
      setSelectedId(null);
      flashSuccess('Inventory item deleted successfully!');
      loadItems();
    } catch (err) {
      flashError(err.response?.data?.error || err.message);
    }
  };

  const handleRestock = async () => {
    if (selectedId === null) {
      flashError('Please select an item to restock');
      return;
    }

    const item = items.find((i) => i.inventory_id === selectedId);
    if (!item) return;

    try {
      await axios.put(`${API}/inventory/items/${selectedId}`, {
        ...item,
        current_stock: item.max_stock,
      });

      flashSuccess('Item restocked to max!');
      loadItems();
    } catch (err) {
      flashError(err.response?.data?.error || err.message);
    }
  };

  return (
    <div className="inventory-mgmt">
      <div className="mgmt-header">
        <h1>Inventory Management</h1>
        <Link className="action-btn back-link-btn" to="/manager-dashboard">
          ← Back to Dashboard
        </Link>
        {error && <div className="toast toast-error">{error}</div>}
        {success && <div className="toast toast-success">{success}</div>}
      </div>

      <div className="table-wrapper glass-card">
        <table className="mgmt-table" id="inventory-table">
          <thead>
            <tr>
              <th>ID</th>
              <th>Name</th>
              <th>Current Stock</th>
              <th>Max Stock</th>
              <th>Min Stock</th>
              <th>Unit</th>
              <th>Unit Cost</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan="8" className="table-loading">Loading...</td>
              </tr>
            ) : items.length === 0 ? (
              <tr>
                <td colSpan="8" className="table-loading">No inventory items found.</td>
              </tr>
            ) : (
              items.map((item) => (
                <tr
                  key={item.inventory_id}
                  className={[
                    selectedId === item.inventory_id ? 'selected' : '',
                    Number(item.current_stock) < Number(item.min_stock) ? 'low-stock-row' : '',
                  ].join(' ').trim()}
                  onClick={() =>
                    setSelectedId(selectedId === item.inventory_id ? null : item.inventory_id)
                  }
                >
                  <td>{item.inventory_id}</td>
                  <td>{item.name}</td>
                  <td>{item.current_stock}</td>
                  <td>{item.max_stock}</td>
                  <td>{item.min_stock}</td>
                  <td>{item.unit}</td>
                  <td>${Number(item.unit_cost ?? 0).toFixed(2)}</td>
                  <td>
                    {Number(item.current_stock) < Number(item.min_stock) ? 'Low Stock' : 'OK'}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <div className="mgmt-actions">
        <button className="action-btn refresh" onClick={loadItems}>Refresh</button>
        <button className="action-btn add" onClick={openAdd}>+ Add New Item</button>
        <button className="action-btn edit" onClick={openEdit}>Update Selected</button>
        <button className="action-btn delete" onClick={handleDelete}>Delete Selected</button>
        <button className="action-btn" onClick={handleRestock}>
          Restock Selected
        </button>
      </div>

      {modal && (
        <div className="modal-overlay" onClick={() => setModal(null)}>
          <div className="modal-card" onClick={(e) => e.stopPropagation()}>
            <h2>{modal === 'add' ? 'Add New Inventory Item' : 'Update Inventory Item'}</h2>

            <label>
              Name
              <input
                type="text"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
              />
            </label>

            <label>
              Current Stock
              <input
                type="number"
                step="0.01"
                value={form.current_stock}
                onChange={(e) => setForm({ ...form, current_stock: e.target.value })}
              />
            </label>

            <label>
              Max Stock
              <input
                type="number"
                step="0.01"
                value={form.max_stock}
                onChange={(e) => setForm({ ...form, max_stock: e.target.value })}
              />
            </label>

            <label>
              Min Stock
              <input
                type="number"
                step="0.01"
                value={form.min_stock}
                onChange={(e) => setForm({ ...form, min_stock: e.target.value })}
              />
            </label>

            <label>
              Unit
              <input
                type="text"
                value={form.unit}
                onChange={(e) => setForm({ ...form, unit: e.target.value })}
              />
            </label>

            <label>
              Unit Cost
              <input
                type="number"
                step="0.01"
                value={form.unit_cost}
                onChange={(e) => setForm({ ...form, unit_cost: e.target.value })}
              />
            </label>

            <div className="modal-btns">
              <button className="modal-cancel" onClick={() => setModal(null)}>Cancel</button>
              <button className="modal-confirm" onClick={modal === 'add' ? handleAdd : handleUpdate}>
                {modal === 'add' ? 'Add Item' : 'Save Changes'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}