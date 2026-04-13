import React, { useState, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, NavLink, Navigate } from 'react-router-dom';
import axios from 'axios';
import CashierDashboard from './components/CashierDashboard';
import MenuManagement from './components/MenuManagement';
import InventoryManagement from './components/InventoryManagement';
import EmployeeManagement from './components/EmployeeManagement';
import ReportsPanel from './components/ReportsPanel';
import ManagerDashboard from './components/ManagerDashboard';
import Login from './components/Login';
import Kiosk from './components/Kiosk';
import LanguageSwitcher from './i18n/LanguageSwitcher';
import useGoogleTranslate from './i18n/Translate';
import './App.css';

const API = process.env.REACT_APP_API_URL || 'http://localhost:3001/api';

function App() {
  const [user, setUser] = useState(null);
  const [showPinBox, setShowPinBox] = useState(false);
  const [pinInput, setPinInput] = useState('');
  const [pinError, setPinError] = useState('');
  const { language, setLanguage, supportedLanguages, isTranslating } = useGoogleTranslate();

  
  useEffect(() => {
    const storedUser = localStorage.getItem('user');
    if (storedUser) {
      try {
        setUser(JSON.parse(storedUser));
      } catch (err) {
        console.error('Failed to parse stored user:', err);
        localStorage.removeItem('user');
      }
    }
  }, []);

  const handleLogout = () => {
    setUser(null);
    setPinInput('');
    setPinError('');
    setShowPinBox(false);
    
    localStorage.removeItem('user');
  };

  const handleCustomerLogout = () => {
    setShowPinBox(true);
    setPinInput('');
    setPinError('');
  };

  const verifyManagerPin = async () => {
    if (!pinInput) {
      setPinError('PIN is required');
      return;
    }

    try {
      const response = await axios.post(`${API}/auth/login`, { pin: pinInput });
      const userData = response.data.user;

      if (userData.role === 'Manager') {
        handleLogout();
      } else {
        setPinError('Invalid credentials. Manager PIN required.');
      }
    } catch (err) {
      setPinError('Invalid PIN');
    }
  };

  // If not logged in, show only the Login screen
  if (!user) {
    return (
      <Login
        onLogin={setUser}
        language={language}
        setLanguage={setLanguage}
        supportedLanguages={supportedLanguages}
        isTranslating={isTranslating}
      />
    );
  }

  //const isCashier = user.role === 'Cashier'; not needed for now
  const isManager = user.role === 'Manager';
  const isCustomer = user.role === 'Customer';

  //Customer Kiosk (with simplified nav)
  if (isCustomer) {
    return (
      <Router>
        <div className="app-shell">
          {/* Kiosk Top Nav*/}
          <nav className="top-nav">
            <div className="nav-brand">
              <span className="brand-icon">🧋</span>
              <span className="brand-text">Boba Shop 50</span>
            </div>

            <div className="nav-welcome">
              <span>Welcome Valued Customer</span>
            </div>

            <div className="nav-user">
              <LanguageSwitcher
                language={language}
                setLanguage={setLanguage}
                supportedLanguages={supportedLanguages}
                isTranslating={isTranslating}
              />
              <button className="logout-btn" onClick={handleCustomerLogout}>Logout</button>
            </div>
          </nav>

          {/* PIN for costomer logout */}
          {showPinBox && (
            <div className="pinBox-overlay" onClick={() => setShowPinBox(false)}>
              <div className="pinBox-content" onClick={(e) => e.stopPropagation()}>
                <h2>Manager Verification</h2>
                <p>Enter manager PIN to logout:</p>
                
                <div className="pinBox-display">
                  {pinInput ? '•'.repeat(pinInput.length) : <span className="pinBox-placeholder">Enter PIN</span>}
                </div>

                <div className="pinBox-pad">
                  {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((num) => (
                    <button
                      key={num}
                      type="button"
                      className="pinBox-btn"
                      onClick={() => setPinInput((prev) => prev.length < 8 ? prev + num : prev)}
                    >
                      {num}
                    </button>
                  ))}
                  <button
                    type="button"
                    className="pinBox-btn action-btn backspace"
                    onClick={() => setPinInput((prev) => prev.slice(0, -1))}
                  >
                    ⌫
                  </button>
                  <button
                    type="button"
                    className="pinBox-btn"
                    onClick={() => setPinInput((prev) => prev.length < 8 ? prev + '0' : prev)}
                  >
                    0
                  </button>
                  <button
                    type="button"
                    className="pinBox-btn action-btn enter"
                    onClick={verifyManagerPin}
                    disabled={pinInput.length === 0}
                  >
                    Enter
                  </button>
                </div>

                {pinError && <p className="pin-error">{pinError}</p>}
                <button className="btn-cancel" onClick={() => setShowPinBox(false)}>Cancel</button>
              </div>
            </div>
          )}

          
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

  //Cashier & Manager Views (with nav bar)
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
            {!isManager && (
              <NavLink
                to="/"
                end
                className={({ isActive }) => `nav-pill ${isActive ? 'active' : ''}`}
              >
                <span className="nav-icon">💳</span>
                Cashier
              </NavLink>
            )}
            
            {/* Managers only tab */}
            {isManager && (
              <NavLink
                to="/manager-dashboard"
                className={({ isActive }) => `nav-pill ${isActive ? 'active' : ''}`}
              >
                <span className="nav-icon">📋</span>
                Manager Dashboard
              </NavLink>
            )}
          </div>

          <div className="nav-user">
            <LanguageSwitcher
              language={language}
              setLanguage={setLanguage}
              supportedLanguages={supportedLanguages}
              isTranslating={isTranslating}
            />
            <span className="user-info">Logged in as {user.name}</span>
            <span className="user-badge">{user.role}</span>
            <button className="logout-btn" onClick={handleLogout}>Logout</button>
          </div>
        </nav>

        {/* ── Page Content ────────────────────────────────────────── */}
        <main className="main-content">
          <Routes>
            <Route
              path="/"
              element={
                isManager
                  ? <Navigate to="/manager-dashboard" replace />
                  : <CashierDashboard cashierName={user.name} />
              }
            />
            
            {/* Protected Route */}
            <Route
              path="/manager-dashboard"
              element={isManager ? <ManagerDashboard /> : <Navigate to="/" replace />}
            />
            <Route 
              path="/menu-management" 
              element={isManager ? <MenuManagement /> : <Navigate to="/" replace />} 
            />
            <Route
              path="/inventory-management"
              element={isManager ? <InventoryManagement /> : <Navigate to="/" replace />}
            />
            <Route
              path="/employee-management"
              element={isManager ? <EmployeeManagement /> : <Navigate to="/" replace />}
            />
            <Route
              path="/reports"
              element={isManager ? <ReportsPanel /> : <Navigate to="/" replace />}
            />
          </Routes>
        </main>
      </div>
    </Router>
  );
}

export default App;
