import React, { useState } from 'react';
import axios from 'axios';
import LanguageSwitcher from '../i18n/LanguageSwitcher';
import './Login.css';
import { GoogleLogin } from '@react-oauth/google';
import { jwtDecode } from 'jwt-decode';

const API = process.env.REACT_APP_API_URL || 'http://localhost:3001/api';

/* ═══════════════════════════════════════════════════════════════════════
   Login Screen (PIN Pad)
   Translates App.java's PIN pad to React
   ═══════════════════════════════════════════════════════════════════════ */
export default function Login({ onLogin, language, setLanguage, supportedLanguages, isTranslating }) {
  const [pin, setPin] = useState('');
  const [isBinding, setIsBinding] = useState(false);
  const [googleEmail, setGoogleEmail] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const handleGoogleLogin = async (credentialResponse) => {
    console.log("Google token:", credentialResponse.credential);
    const decoded = jwtDecode(credentialResponse.credential);
    const email = decoded.email;
    setGoogleEmail(email);
    setIsLoading(true);

    try {
      // 1. Try to log them in directly using the email
      const res = await axios.post(`${API}/auth/google-login`, { email });
      if (res.data.success) {
        localStorage.setItem('user', JSON.stringify(res.data.user));
        onLogin(res.data.user);
      }
    } catch (err) {
      // 2. If it fails (e.g. 404 unbound), force them to bind!
      setIsBinding(true);
      setError('Email not recognized. Please link your PIN.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleGoogleError = () => {
    console.log("Google login failed");
    setError("Google login failed");
  };

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
      if (isBinding) {
        const res = await axios.post(`${API}/auth/bind`, { email: googleEmail, pin });
        if (res.data.status === "success") {
          alert("Google account bound successfully!");
          setIsBinding(false);
          setPin('');
        }
      } else {
        const res = await axios.post(`${API}/auth/login`, { pin });
        if (res.data.success) {

          localStorage.setItem('user', JSON.stringify(res.data.user));
          onLogin(res.data.user);
        }
      }
    }
    catch (err) {
      setError(err.response?.data?.error || err.response?.data?.message || 'Login failed');
      setPin('');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="login-wrapper">
      <div className="login-language-switcher">
        <LanguageSwitcher
          language={language}
          setLanguage={setLanguage}
          supportedLanguages={supportedLanguages}
          isTranslating={isTranslating}
        />
      </div>
      <div className="login-card glass-card">
        <div className="login-header">
          <span className="brand-icon">🧋</span>
          <h1>{isBinding ? "Link Account" : "Boba POS Login"}</h1>
          <p>
            {isBinding
              ? `Enter your PIN to link ${googleEmail}`
              : "Please enter your employee PIN or sign in with Google"}
          </p>
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
        {!isBinding ? (
          <div className="google-login-container">
            <GoogleLogin
              onSuccess={handleGoogleLogin}
              onError={handleGoogleError}
            />
          </div>
        ) : (
          <div style={{ textAlign: 'center', marginTop: '1rem' }}>
            <button 
              type="button" 
              onClick={() => {
                setIsBinding(false);
                setError('');
                setPin('');
              }}
              style={{
                background: 'none',
                border: 'none',
                color: '#888',
                cursor: 'pointer',
                textDecoration: 'underline',
                fontSize: '1rem'
              }}
            >
              Cancel and Return to Login
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
