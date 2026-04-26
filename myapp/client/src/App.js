import React, { useState } from 'react';
import { BrowserRouter as Router, Routes, Route, NavLink, Navigate } from 'react-router-dom';
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

function App() {
  const [user, setUser] = useState(null);
  const { language, setLanguage, supportedLanguages, isTranslating } = useGoogleTranslate();

  const handleLogout = () => {
    setUser(null);
    localStorage.removeItem('user');
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
                  <span>Welcome Valued Customer</span>
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
                  <Route path="/kiosk" element={<Kiosk />} />
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
