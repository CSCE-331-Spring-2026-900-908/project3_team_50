import React, { useState } from 'react';
import { BrowserRouter as Router, Routes, Route, NavLink, Navigate } from 'react-router-dom';
import CashierDashboard from './components/CashierDashboard';
import MenuManagement from './components/MenuManagement';
import Login from './components/Login';
import Kiosk from './components/Kiosk';
import './App.css';

function App() {
  const [user, setUser] = useState(null);

  const handleLogout = () => {
    setUser(null);
  };

  // If not logged in, show only the Login screen
  if (!user) {
    return <Login onLogin={setUser} />;
  }

  const isCashier = user.role === 'Cashier';
  const isManager = user.role === 'Manager';
  const isCustomer = user.role === 'Customer';

  // ── Customer Kiosk (no nav bar) ────────────────────────────────────
  if (isCustomer) {
    return (
      <Router>
        <div className="app-shell">
          <main className="main-content">
            <Routes>
              <Route path="/" element={<Kiosk />} />
              <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
          </main>
        </div>
      </Router>
    );
  }

  // ── Cashier & Manager Views (with nav bar) ─────────────────────────
  return (
    <Router>
      <div className="app-shell">
        {/* ── Top Navigation Bar ──────────────────────────────────── */}
        <nav className="top-nav">
          <div className="nav-brand">
            <span className="brand-icon">🧋</span>
            <span className="brand-text">Boba POS</span>
          </div>

          <div className="nav-links">
            <NavLink
              to="/"
              end
              className={({ isActive }) => `nav-pill ${isActive ? 'active' : ''}`}
            >
              <span className="nav-icon">💳</span>
              Cashier
            </NavLink>
            
            {/* Managers only tab */}
            {isManager && (
              <NavLink
                to="/menu-management"
                className={({ isActive }) => `nav-pill ${isActive ? 'active' : ''}`}
              >
                <span className="nav-icon">📋</span>
                Menu Management
              </NavLink>
            )}
          </div>

          <div className="nav-user">
            <span className="user-info">Logged in as {user.name}</span>
            <span className="user-badge">{user.role}</span>
            <button className="logout-btn" onClick={handleLogout}>Logout</button>
          </div>
        </nav>

        {/* ── Page Content ────────────────────────────────────────── */}
        <main className="main-content">
          <Routes>
            <Route path="/" element={<CashierDashboard cashierName={user.name} />} />
            
            {/* Protected Route */}
            <Route 
              path="/menu-management" 
              element={isManager ? <MenuManagement /> : <Navigate to="/" replace />} 
            />
          </Routes>
        </main>
      </div>
    </Router>
  );
}

export default App;
