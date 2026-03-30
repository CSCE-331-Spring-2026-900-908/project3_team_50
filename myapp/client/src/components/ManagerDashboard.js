import React from 'react';
import { Link } from 'react-router-dom';
import './ManagerDashboard.css';

export default function ManagerDashboard() {
  return (
    <div className="manager-dashboard">
      <div className="manager-header">
        <h1>Manager Dashboard</h1>
      </div>

      <div className="manager-grid">
        <Link to="/menu-management" className="manager-card active-card">
          <h2>Menu Management</h2>
          <p>View, add, update, and delete menu items.</p>
          <span className="manager-card-cta">Open Page</span>
        </Link>

        <Link to="/inventory-management" className="manager-card active-card">
          <h2>Inventory Management</h2>
          <p>View, add, update, and delete inventory items.</p>
          <span className="manager-card-cta">Open Page</span>
        </Link>

        <div className="manager-card disabled-card">
          <h2>Employee Management</h2>
          <p>In progress.</p>
          <span className="manager-card-cta muted">Coming Next</span>
        </div>

        <div className="manager-card disabled-card">
          <h2>Reports</h2>
          <p>In progress.</p>
          <span className="manager-card-cta muted">Coming Next</span>
        </div>
      </div>
    </div>
  );
}
