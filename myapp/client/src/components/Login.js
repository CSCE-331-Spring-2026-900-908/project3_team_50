import React, { useState } from 'react';
import axios from 'axios';
import './Login.css';

const API = process.env.REACT_APP_API_URL || 'http://localhost:3001/api';

/* ═══════════════════════════════════════════════════════════════════════
   Login Screen (PIN Pad)
   Translates App.java's PIN pad to React
   ═══════════════════════════════════════════════════════════════════════ */
export default function Login({ onLogin }) {
  const [pin, setPin] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  // ── Keyboard logic ──────────────────────────────────────────────────
  const handleNum = (num) => {
    if (pin.length < 8) setPin((prev) => prev + num);
  };

  const handleBackspace = () => {
    setPin((prev) => prev.slice(0, -1));
  };

  // ── Submit logic ────────────────────────────────────────────────────
  const handleSubmit = async (e) => {
    if (e) e.preventDefault();
    if (!pin) return;

    setIsLoading(true);
    setError('');

    try {
      const res = await axios.post(`${API}/auth/login`, { pin });
      if (res.data.success) {
        
        localStorage.setItem('user', JSON.stringify(res.data.user));
        onLogin(res.data.user);
      }
    } catch (err) {
      setError(err.response?.data?.error || 'Login failed');
      setPin('');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="login-wrapper">
      <div className="login-card glass-card">
        <div className="login-header">
          <span className="brand-icon">🧋</span>
          <h1>Boba POS Login</h1>
          <p>Please enter your employee PIN</p>
        </div>

        {error && <div className="login-error">{error}</div>}

        <form onSubmit={handleSubmit} className="pin-form">
          <div className="pin-display">
            {/* Show dots for security instead of numbers */}
            {pin ? '•'.repeat(pin.length) : <span className="placeholder">Enter PIN</span>}
          </div>

          <div className="pin-pad">
            {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((num) => (
              <button
                key={num}
                type="button"
                className="pin-btn"
                onClick={() => handleNum(num)}
              >
                {num}
              </button>
            ))}
            <button
              type="button"
              className="pin-btn action-btn backspace"
              onClick={handleBackspace}
            >
              ⌫
            </button>
            <button
              type="button"
              className="pin-btn"
              onClick={() => handleNum(0)}
            >
              0
            </button>
            <button
              type="submit"
              className="pin-btn action-btn enter"
              disabled={isLoading || pin.length === 0}
            >
              {isLoading ? '...' : 'Enter'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
