import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './styles/globals.css';

// Force a full reload whenever the version bumps to completely destroy HMR memory state
const CURRENT_APP_VERSION = 'v8';
if (localStorage.getItem('prachify-app-version') !== CURRENT_APP_VERSION) {
  localStorage.setItem('prachify-app-version', CURRENT_APP_VERSION);
  window.location.reload();
}

// Auto-register service worker using virtual imports from vite-plugin-pwa
import { registerSW } from 'virtual:pwa-register';

if ('serviceWorker' in navigator) {
  registerSW({
    onNeedRefresh() {
      if (confirm('A new version of Geet is available. Update now?')) {
        window.location.reload();
      }
    },
    onOfflineReady() {
      console.log('Geet is ready to be used offline 🎧');
    },
  });
}

// Give the cinematic splash screen time to play (animations complete ~1.6s)
setTimeout(() => {
  ReactDOM.createRoot(document.getElementById('root')).render(
    <React.StrictMode>
      <App />
    </React.StrictMode>
  );
}, 1600);
