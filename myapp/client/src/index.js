import React from 'react';
import ReactDOM from 'react-dom/client';
import './index.css';
import App from './App';
import reportWebVitals from './reportWebVitals';
import { GoogleOAuthProvider } from '@react-oauth/google';
import { readFontSize, applyFontSizeToDocument } from './fontSize';

applyFontSizeToDocument(readFontSize());

const clientID = (process.env.REACT_APP_GOOGLE_CLIENT_ID || '').trim();

if (!clientID) {
  // CRA inlines REACT_APP_* at build time; server/.env is not read by the client.
  console.error(
    'Missing REACT_APP_GOOGLE_CLIENT_ID. Add it to myapp/client/.env locally, ' +
      'or set it in your host (e.g. Render Static Site) and rebuild.'
  );
}

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(
  <React.StrictMode>
    {clientID ? (
      <GoogleOAuthProvider clientId={clientID}>
        <App />
      </GoogleOAuthProvider>
    ) : (
      <App />
    )}
  </React.StrictMode>
);

// If you want to start measuring performance in your app, pass a function
// to log results (for example: reportWebVitals(console.log))
// or send to an analytics endpoint. Learn more: https://bit.ly/CRA-vitals
reportWebVitals();
