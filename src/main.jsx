import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './styles/globals.css';

// Auto-register service worker using virtual imports from vite-plugin-pwa
import { registerSW } from 'virtual:pwa-register';

if ('serviceWorker' in navigator) {
  registerSW({
    onNeedRefresh() {
      if (confirm('A new version of Prachify is available. Update now?')) {
        window.location.reload();
      }
    },
    onOfflineReady() {
      console.log('Prachify is ready to be used offline 🎧');
    },
  });
}

// Give the cinematic splash screen time to play
setTimeout(() => {
  ReactDOM.createRoot(document.getElementById('root')).render(
    <React.StrictMode>
      <App />
    </React.StrictMode>
  );
}, 2500);
