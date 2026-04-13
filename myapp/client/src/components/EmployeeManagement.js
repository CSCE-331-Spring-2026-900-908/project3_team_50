import React, { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import { Link } from 'react-router-dom';
import './EmployeeManagement.css';

const API = process.env.REACT_APP_API_URL || 'http://localhost:3001/api';

const ROLES = ['Manager', 'Cashier', 'Customer'];

export default function EmployeeManagement() {
  const [employees, setEmployees] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedId, setSelectedId] = useState(null);
  const [modal, setModal] = useState(null);
  const [form, setForm] = useState({
    name: '',
    role: 'Cashier',
    hourly_rate: '',
    pin: '',
  });
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const loadEmployees = useCallback(async () => {
    setLoading(true);
    try {
      const res = await axios.get(`${API}/employees`);
      setEmployees(res.data);
    } catch (err) {
      console.error(err);
      flashError('Failed to load employees');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadEmployees();
  }, [loadEmployees]);

  useEffect(() => {
    if (modal === 'edit') {
      if (selectedId === null) {
        setModal(null);
      } else {
        const emp = employees.find((e) => e.employee_id === selectedId);
        if (emp) {
          setForm({
            name: emp.name ?? '',
            role: emp.role ?? 'Cashier',
            hourly_rate: String(emp.hourly_rate ?? ''),
            pin: emp.pin != null ? String(emp.pin) : '',
          });
        }
      }
    }
  }, [selectedId, employees, modal]);

  const flashError = (msg) => {
    setError(msg);
    setTimeout(() => setError(''), 4000);
  };

  const flashSuccess = (msg) => {
    setSuccess(msg);
    setTimeout(() => setSuccess(''), 3000);
  };

  const openAdd = () => {
    setForm({ name: '', role: 'Cashier', hourly_rate: '', pin: '' });
    setError('');
    setSuccess('');
    setModal('add');
  };

  const openEdit = () => {
    if (selectedId === null) {
      flashError('Please select an employee to update');
      return;
    }
    const emp = employees.find((e) => e.employee_id === selectedId);
    if (!emp) return;
    setForm({
      name: emp.name ?? '',
      role: emp.role ?? 'Cashier',
      hourly_rate: String(emp.hourly_rate ?? ''),
      pin: emp.pin != null ? String(emp.pin) : '',
    });
    setError('');
    setSuccess('');
    setModal('edit');
  };

  const validateForm = () => {
    if (!form.name.trim()) {
      flashError('Name is required');
      return false;
    }
    const rate = parseFloat(form.hourly_rate);
    if (Number.isNaN(rate) || rate < 0) {
      flashError('Hourly rate must be a valid non-negative number');
      return false;
    }
    if (!form.pin || String(form.pin).trim() === '') {
      flashError('PIN is required');
      return false;
    }
    return true;
  };

  const handleAdd = async () => {
    if (!validateForm()) return;
    try {
      await axios.post(`${API}/employees`, {
        name: form.name.trim(),
        role: form.role,
        hourly_rate: parseFloat(form.hourly_rate),
        pin: String(form.pin).trim(),
      });
      setModal(null);
      flashSuccess('Employee added successfully!');
      loadEmployees();
    } catch (err) {
      flashError(err.response?.data?.error || err.message);
    }
  };

  const handleUpdate = async () => {
    if (!validateForm()) return;
    try {
      await axios.put(`${API}/employees/${selectedId}`, {
        name: form.name.trim(),
        role: form.role,
        hourly_rate: parseFloat(form.hourly_rate),
        pin: String(form.pin).trim(),
      });
      setModal(null);
      flashSuccess('Employee updated successfully!');
      loadEmployees();
    } catch (err) {
      flashError(err.response?.data?.error || err.message);
    }
  };

  const handleFire = async () => {
    if (selectedId === null) {
      flashError('Please select an employee');
      return;
    }
    if (!window.confirm('Fire this employee? They will be removed from the active list.')) return;
    try {
      await axios.delete(`${API}/employees/${selectedId}`);
      setSelectedId(null);
      flashSuccess('Employee removed from the active list.');
      loadEmployees();
    } catch (err) {
      flashError(err.response?.data?.error || err.message);
    }
  };

  return (
    <div className="employee-mgmt">
      <div className="mgmt-header">
        <h1>Employee Management</h1>
        <Link className="action-btn back-link-btn" to="/manager-dashboard">
          ← Back to Dashboard
        </Link>
        {error && <div className="toast toast-error">{error}</div>}
        {success && <div className="toast toast-success">{success}</div>}
      </div>

      <div className="table-wrapper glass-card">
        <table className="mgmt-table" id="employee-table">
          <thead>
            <tr>
              <th>ID</th>
              <th>Name</th>
              <th>Role</th>
              <th>Hourly Rate</th>
              <th>PIN</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan="5" className="table-loading">Loading…</td>
              </tr>
            ) : employees.length === 0 ? (
              <tr>
                <td colSpan="5" className="table-loading">No employees found.</td>
              </tr>
            ) : (
              employees.map((emp) => (
                <tr
                  key={emp.employee_id}
                  className={selectedId === emp.employee_id ? 'selected' : ''}
                  onClick={() =>
                    setSelectedId(selectedId === emp.employee_id ? null : emp.employee_id)
                  }
                >
                  <td>{emp.employee_id}</td>
                  <td>{emp.name}</td>
                  <td>
                    <span className="cat-chip">{emp.role}</span>
                  </td>
                  <td className="price-cell">${Number(emp.hourly_rate).toFixed(2)}</td>
                  <td className="pin-cell">••••</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <div className="mgmt-actions">
        <button type="button" className="action-btn refresh" onClick={loadEmployees}>
          ↻ Refresh
        </button>
        <button type="button" className="action-btn add" onClick={openAdd}>
          + Add Employee
        </button>
        <button type="button" className="action-btn edit" onClick={openEdit}>
          ✎ Update Selected
        </button>
        <button type="button" className="action-btn delete" onClick={handleFire}>
          Fire Selected
        </button>
      </div>

      {modal && (
        <div className="modal-overlay" onClick={() => setModal(null)}>
          <div className="modal-card" onClick={(e) => e.stopPropagation()}>
            <h2>{modal === 'add' ? 'Add Employee' : 'Update Employee'}</h2>

            <label>
              Name
              <input
                type="text"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
              />
            </label>

            <label>
              Role
              <select
                value={form.role}
                onChange={(e) => setForm({ ...form, role: e.target.value })}
              >
                {ROLES.map((r) => (
                  <option key={r} value={r}>
                    {r}
                  </option>
                ))}
              </select>
            </label>

            <label>
              Hourly rate ($)
              <input
                type="number"
                step="0.01"
                min="0"
                value={form.hourly_rate}
                onChange={(e) => setForm({ ...form, hourly_rate: e.target.value })}
              />
            </label>

            <label>
              PIN
              <input
                type="password"
                autoComplete="new-password"
                value={form.pin}
                onChange={(e) => setForm({ ...form, pin: e.target.value })}
              />
            </label>

            <div className="modal-btns">
              <button type="button" className="modal-cancel" onClick={() => setModal(null)}>
                Cancel
              </button>
              <button
                type="button"
                className="modal-confirm"
                onClick={modal === 'add' ? handleAdd : handleUpdate}
              >
                {modal === 'add' ? 'Add' : 'Save'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
