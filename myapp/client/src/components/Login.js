import React, { useState, useEffect } from 'react';
import axios from 'axios';
import LanguageSwitcher from '../i18n/LanguageSwitcher';
import FontSizePicker from './FontSizePicker';
import './Login.css';
import { GoogleLogin } from '@react-oauth/google';
import { jwtDecode } from 'jwt-decode';

const API = process.env.REACT_APP_API_URL || 'http://localhost:3001/api';
const GOOGLE_CLIENT_CONFIGURED = Boolean((process.env.REACT_APP_GOOGLE_CLIENT_ID || '').trim());

/* ═══════════════════════════════════════════════════════════════════════
   Login Screen (PIN Pad)
   Translates App.java's PIN pad to React
   ═══════════════════════════════════════════════════════════════════════ */
export default function Login({ onLogin, language, setLanguage, supportedLanguages, isTranslating }) {
  const [pin, setPin] = useState('');
  const [isBinding, setIsBinding] = useState(false);
  const [googleEmail, setGoogleEmail] = useState('');
  const [googleCredential, setGoogleCredential] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    const handleKeyDown = (e) => {
      // Ignore if typing in a standard input
      if (document.activeElement.tagName === 'INPUT' || document.activeElement.tagName === 'TEXTAREA') return;

      if (/^[0-9]$/.test(e.key)) {
        setPin((prev) => prev.length < 8 ? prev + e.key : prev);
      } else if (e.key === 'Backspace') {
        setPin((prev) => prev.slice(0, -1));
      } else if (e.key === 'Enter') {
        e.preventDefault();
        // Trigger a real click to avoid React stale-closure bugs inside this listener
        document.getElementById('login-submit-btn')?.click();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  const handleGoogleLogin = async (credentialResponse) => {
    const credential = credentialResponse.credential;
    setGoogleCredential(credential);
    const decoded = jwtDecode(credential);
    const email = decoded.email;
    setGoogleEmail(email);
    setIsLoading(true);

    try {
      const res = await axios.post(`${API}/auth/google-login`, { credential });
      if (res.data.success) {
        localStorage.setItem('user', JSON.stringify(res.data.user));
        onLogin(res.data.user);
      }
    } catch (err) {
      if (err.response?.status === 404) {
        setIsBinding(true);
        setError('No account linked to this Google email. Enter your employee PIN to link.');
      } else {
        setError(
          err.response?.data?.error || err.response?.data?.message || 'Google sign-in failed'
        );
        setGoogleCredential('');
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleGoogleError = () => {
    setError('Google sign-in failed');
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
        if (!googleCredential) {
          setError('Google session expired. Please sign in with Google again.');
          setIsBinding(false);
          return;
        }
        const res = await axios.post(`${API}/auth/bind`, { credential: googleCredential, pin });
        if (res.data.status === 'success' && res.data.user) {
          localStorage.setItem('user', JSON.stringify(res.data.user));
          onLogin(res.data.user);
          setIsBinding(false);
          setPin('');
          setGoogleCredential('');
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
      <div className="login-top-controls">
        <FontSizePicker variant="light" />
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
              : GOOGLE_CLIENT_CONFIGURED
                ? 'Please enter your employee PIN or sign in with Google'
                : 'Please enter your employee PIN'}
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
              id="login-submit-btn"
              type="submit"
              className="pin-btn action-btn enter"
              disabled={isLoading || pin.length === 0}
            >
              {isLoading ? '...' : 'Enter'}
            </button>
          </div>
        </form>
        {!isBinding && GOOGLE_CLIENT_CONFIGURED ? (
          <div className="google-login-container">
            <GoogleLogin
              onSuccess={handleGoogleLogin}
              onError={handleGoogleError}
            />
          </div>
        ) : !isBinding ? null : (
          <div style={{ textAlign: 'center', marginTop: '1rem' }}>
            <button 
              type="button" 
              onClick={() => {
                setIsBinding(false);
                setError('');
                setPin('');
                setGoogleCredential('');
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
