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
          <path d="M3 9.5L12 3l9 6.5V21H15v-6H9v6H3V9.5z" strokeLinejoin="round" />
        </svg>
      ),
    },
    {
      path: '/search',
      label: 'Search',
      icon: (a) => (
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke={a ? '#fff' : '#b3b3b3'} strokeWidth={a ? 2.5 : 2} strokeLinecap="round">
          <circle cx="11" cy="11" r="8" /><path d="M21 21l-4.35-4.35" />
        </svg>
      ),
    },
    {
      path: '/explore',
      label: 'Explore',
      icon: (a) => (
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke={a ? '#fff' : '#b3b3b3'} strokeWidth={a ? 2.5 : 2} strokeLinecap="round" strokeLinejoin="round">
          <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
        </svg>
      ),
    },
    {
      path: '/library',
      label: 'Your Library',
      icon: (a) => (
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke={a ? '#fff' : '#b3b3b3'} strokeWidth={a ? 2.5 : 2} strokeLinecap="round">
          <path d="M4 19V5M8 19V9M12 19V12M16 19V7M20 19V3" />
        </svg>
      ),
    },
  ];

  return (
    <nav className="nav-container">
      <div className="desktop-logo">
        <img src="/prachify-logo.png" alt="" style={{ width: 32, height: 32, objectFit: 'contain', filter: 'drop-shadow(0 0 8px rgba(200, 100, 255, 0.4))' }} />
        Geet
      </div>
      {tabs.map(tab => {
        const active = pathname === tab.path;
        return (
          <button key={tab.path} onClick={() => navigate(tab.path)} className="nav-item">
            {tab.icon(active)}
            <span style={{ fontSize: 10, fontWeight: 600, color: active ? '#fff' : '#b3b3b3' }}>{tab.label}</span>
          </button>
        );
      })}
    </nav>
  );
}
