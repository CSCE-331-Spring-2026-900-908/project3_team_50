import React, { useEffect, useState } from 'react';
import { BrowserRouter as Router, Routes, Route, NavLink, Navigate, useNavigate } from 'react-router-dom';
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
import FontSizePicker from './components/FontSizePicker';
import './App.css';

const KIOSK_CUSTOMER_STORAGE_KEY = 'kioskCustomer';
const KIOSK_LOGIN_OPEN_STORAGE_KEY = 'isKioskLoginOpen';

function KioskExitRoute({ onExit }) {
  const navigate = useNavigate();

  useEffect(() => {
    onExit();
    navigate('/', { replace: true });
  }, [navigate, onExit]);

  return null;
}

function App() {
  const parseStoredJson = (storageKey) => {
    try {
      const value = localStorage.getItem(storageKey);
      return value ? JSON.parse(value) : null;
    } catch (error) {
      localStorage.removeItem(storageKey);
      return null;
    }
  };

  const [user, setUser] = useState(() => {
    try {
      const storedUser = localStorage.getItem('user');
      return storedUser ? JSON.parse(storedUser) : null;
    } catch (error) {
      localStorage.removeItem('user');
      return null;
    }
  });
  const [kioskCustomer, setKioskCustomer] = useState(() => parseStoredJson(KIOSK_CUSTOMER_STORAGE_KEY));
  const [isKioskLoginOpen, setIsKioskLoginOpen] = useState(() => {
    const stored = localStorage.getItem(KIOSK_LOGIN_OPEN_STORAGE_KEY);
    if (stored === null) return true;
    return stored === 'true';
  });
  const { language, setLanguage, supportedLanguages, isTranslating } = useGoogleTranslate();

  const handleKioskCustomerChange = (customer) => {
    setKioskCustomer(customer);
    if (customer) {
      localStorage.setItem(KIOSK_CUSTOMER_STORAGE_KEY, JSON.stringify(customer));
      localStorage.setItem(KIOSK_LOGIN_OPEN_STORAGE_KEY, 'false');
    } else {
      localStorage.removeItem(KIOSK_CUSTOMER_STORAGE_KEY);
      localStorage.setItem(KIOSK_LOGIN_OPEN_STORAGE_KEY, 'true');
    }
  };

  const handleKioskLoginStateChange = (isLoginOpen) => {
    setIsKioskLoginOpen(isLoginOpen);
    localStorage.setItem(KIOSK_LOGIN_OPEN_STORAGE_KEY, isLoginOpen ? 'true' : 'false');
    if (isLoginOpen) {
      localStorage.removeItem(KIOSK_CUSTOMER_STORAGE_KEY);
      setKioskCustomer(null);
    }
  };

  const handleLogout = () => {
    setUser(null);
    setKioskCustomer(null);
    localStorage.removeItem('user');
    localStorage.removeItem(KIOSK_CUSTOMER_STORAGE_KEY);
    localStorage.removeItem(KIOSK_LOGIN_OPEN_STORAGE_KEY);
  };

  const isManager = user?.role === 'Manager';
  const isCustomer = user?.role === 'Customer';

  return (
    <Router>
      {/* Login Page - shown at root when not logged in */}
      {!user ? (
        <Routes>
          <Route
            path="/"
            element={
              <Login
                onLogin={setUser}
                language={language}
                setLanguage={setLanguage}
                supportedLanguages={supportedLanguages}
                isTranslating={isTranslating}
              />
            }
          />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      ) : (
        <div className="app-shell">
          {/* Customer Kiosk - has simplified nav */}
          {isCustomer ? (
            <>
              {/* Kiosk Top Nav */}
              <nav className="top-nav">
                <div className="nav-brand">
                  <span className="brand-icon">🧋</span>
                  <span className="brand-text">Boba Shop 50</span>
                </div>

                <div className="nav-welcome">
                  {!isKioskLoginOpen && (
                    <>
                      <span>
                        {kioskCustomer ? `Welcome, ${kioskCustomer.cus_fname}` : 'Welcome, Guest'}
                      </span>
                      <button
                        className="logout-customer-btn"
                        onClick={() => window.dispatchEvent(new Event('kiosk-logout'))}
                        title="Start new order with different customer"
                        aria-label="Switch customer"
                      >
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M14 19a6 6 0 0 0-12 0" />
                          <circle cx="8" cy="7" r="4" />
                          <polyline points="16 11 14 13 16 15" />
                          <line x1="14" y1="13" x2="22" y2="13" />
                          <polyline points="20 17 22 19 20 21" />
                          <line x1="16" y1="19" x2="22" y2="19" />
                        </svg>
                      </button>
                    </>
                  )}
                </div>

                <div className="nav-user">
                  <FontSizePicker variant="nav" />
                  <LanguageSwitcher
                    language={language}
                    setLanguage={setLanguage}
                    supportedLanguages={supportedLanguages}
                    isTranslating={isTranslating}
                  />
                </div>
              </nav>

              <main className="main-content">
                <Routes>
                  <Route path="/exit" element={<KioskExitRoute onExit={handleLogout} />} />
                  <Route
                    path="/kiosk"
                    element={(
                      <Kiosk
                        initialCustomer={kioskCustomer}
                        initialShowCustomerLogin={isKioskLoginOpen}
                        onCustomerChange={handleKioskCustomerChange}
                        onLoginStateChange={handleKioskLoginStateChange}
                      />
                    )}
                  />
                  <Route path="/" element={<Navigate to="/kiosk" replace />} />
                  <Route path="*" element={<Navigate to="/kiosk" replace />} />
                </Routes>
              </main>
            </>
          ) : (
            <>
              {/* Manager/Cashier Top Navigation Bar */}
              <nav className="top-nav">
                <div className="nav-brand">
                  <span className="brand-icon">🧋</span>
                  <span className="brand-text">Boba POS</span>
                </div>

                <div className="nav-links">
                  {!isManager && (
                    <NavLink
                      to="/cashier"
                      end
                      className={({ isActive }) =>
                        `nav-pill ${isActive ? 'active' : ''}`
                      }
                    >
                      
                      Cashier
                    </NavLink>
                  )}

                  {/* Managers only tab */}
                  {isManager && (
                    <NavLink
                      to="/manager-dashboard"
                      className={({ isActive }) =>
                        `nav-pill ${isActive ? 'active' : ''}`
                      }
                    >
                      
                      Manager Dashboard
                    </NavLink>
                  )}
                </div>

                <div className="nav-user">
                  <FontSizePicker variant="nav" />
                  <LanguageSwitcher
                    language={language}
                    setLanguage={setLanguage}
                    supportedLanguages={supportedLanguages}
                    isTranslating={isTranslating}
                  />
                  <span className="user-info">Logged in as {user.name}</span>
                  <span className="user-badge">{user.role}</span>
                  <button className="logout-btn" onClick={handleLogout}>
                    Logout
                  </button>
                </div>
              </nav>

              {/* Page Content */}
              <main className="main-content">
                <Routes>
                  <Route
                    path="/"
                    element={
                      isManager ? (
                        <Navigate to="/manager-dashboard" replace />
                      ) : (
                        <Navigate to="/cashier" replace />
                      )
                    }
                  />
                  <Route
                    path="/cashier"
                    element={
                      !isManager ? (
                        <CashierDashboard cashierName={user.name} />
                      ) : (
                        <Navigate to="/manager-dashboard" replace />
                      )
                    }
                  />
                  <Route
                    path="/manager-dashboard"
                    element={
                      isManager ? (
                        <ManagerDashboard />
                      ) : (
                        <Navigate to="/cashier" replace />
                      )
                    }
                  />
                  <Route
                    path="/menu-management"
                    element={
                      isManager ? (
                        <MenuManagement />
                      ) : (
                        <Navigate to="/cashier" replace />
                      )
                    }
                  />
                  <Route
                    path="/inventory-management"
                    element={
                      isManager ? (
                        <InventoryManagement />
                      ) : (
                        <Navigate to="/cashier" replace />
                      )
                    }
                  />
                  <Route
                    path="/employee-management"
                    element={
                      isManager ? (
                        <EmployeeManagement />
                      ) : (
                        <Navigate to="/cashier" replace />
                      )
                    }
                  />
                  <Route
                    path="/reports"
                    element={
                      isManager ? (
                        <ReportsPanel />
                      ) : (
                        <Navigate to="/cashier" replace />
                      )
                    }
                  />
                  <Route path="*" element={<Navigate to="/" replace />} />
                </Routes>
              </main>
            </>
          )}
        </div>
      )}
    </Router>
  );
}

export default App;
