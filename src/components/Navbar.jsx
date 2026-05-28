import React from 'react';
import { useNavigate, useLocation } from 'react-router-dom';

export default function Navbar() {
  const navigate = useNavigate();
  const { pathname } = useLocation();

  const tabs = [
    {
      path: '/',
      label: 'Home',
      icon: (a) => (
        <svg width="24" height="24" viewBox="0 0 24 24" fill={a ? '#fff' : 'none'} stroke={a ? 'none' : '#b3b3b3'} strokeWidth="2">
          <path d="M3 9.5L12 3l9 6.5V21H15v-6H9v6H3V9.5z" strokeLinejoin="round"/>
        </svg>
      ),
    },
    {
      path: '/search',
      label: 'Search',
      icon: (a) => (
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke={a ? '#fff' : '#b3b3b3'} strokeWidth={a ? 2.5 : 2} strokeLinecap="round">
          <circle cx="11" cy="11" r="8"/><path d="M21 21l-4.35-4.35"/>
        </svg>
      ),
    },
    {
      path: '/library',
      label: 'Your Library',
      icon: (a) => (
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke={a ? '#fff' : '#b3b3b3'} strokeWidth={a ? 2.5 : 2} strokeLinecap="round">
          <path d="M4 19V5M8 19V9M12 19V12M16 19V7M20 19V3"/>
        </svg>
      ),
    },
  ];

  return (
    <nav style={{
      position: 'fixed', bottom: 0, left: '50%', transform: 'translateX(-50%)',
      width: '100%', maxWidth: 430,
      background: '#000',
      borderTop: '1px solid #282828',
      paddingBottom: 'env(safe-area-inset-bottom)',
      zIndex: 50,
    }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-around', padding: '8px 0 6px' }}>
        {tabs.map(tab => {
          const active = pathname === tab.path;
          return (
            <button key={tab.path} onClick={() => navigate(tab.path)}
              style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4, background: 'none', border: 'none', cursor: 'pointer', padding: '4px 16px', minWidth: 0 }}>
              {tab.icon(active)}
              <span style={{ fontSize: 10, fontWeight: 600, color: active ? '#fff' : '#b3b3b3' }}>{tab.label}</span>
            </button>
          );
        })}
      </div>
    </nav>
  );
}
