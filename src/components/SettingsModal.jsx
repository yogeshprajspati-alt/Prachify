import React, { useState } from 'react';
import { isFilterEnabled, setFilterEnabled } from '../utils/languageFilter';

export default function SettingsModal({ onClose }) {
  const [enabled, setEnabled] = useState(isFilterEnabled());

  const toggle = () => {
    const next = !enabled;
    setEnabled(next);
    setFilterEnabled(next);
  };

  return (
    <div
      onClick={onClose}
      style={{
        position: 'fixed', inset: 0, zIndex: 9500,
        background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)',
        display: 'flex', alignItems: 'flex-end', justifyContent: 'center',
        animation: 'fadeIn 0.2s ease',
      }}
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{
          width: '100%', maxWidth: 480,
          background: '#181818', borderRadius: '20px 20px 0 0',
          padding: '20px 20px calc(env(safe-area-inset-bottom) + 24px)',
          animation: 'slideUp 0.25s cubic-bezier(0.32, 0.72, 0, 1)',
        }}
      >
        <div style={{ width: 36, height: 4, borderRadius: 2, background: '#444', margin: '0 auto 20px' }} />

        <h2 style={{ fontSize: 18, fontWeight: 800, color: '#fff', margin: '0 0 20px' }}>Settings</h2>

        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          gap: 16, padding: '14px 0',
        }}>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 14, fontWeight: 700, color: '#fff', marginBottom: 4 }}>
              Language Filter
            </div>
            <div style={{ fontSize: 12, color: '#b3b3b3', lineHeight: 1.5 }}>
              Sirf Hindi, Punjabi aur English songs Home/Explore mein dikhenge.
              Off karoge to sab languages allow ho jayengi.
            </div>
          </div>

          <button
            onClick={toggle}
            aria-label="Toggle language filter"
            style={{
              width: 46, height: 26, borderRadius: 13, border: 'none', cursor: 'pointer',
              padding: 3, flexShrink: 0,
              background: enabled ? '#1db954' : '#3a3a3a',
              transition: 'background 0.2s ease',
              display: 'flex', alignItems: 'center',
              justifyContent: enabled ? 'flex-end' : 'flex-start',
            }}
          >
            <div style={{
              width: 20, height: 20, borderRadius: '50%', background: '#fff',
              boxShadow: '0 1px 3px rgba(0,0,0,0.4)',
            }} />
          </button>
        </div>

        <div style={{ fontSize: 11, color: '#666', marginTop: 8 }}>
          Note: koi bhi query mein direct language ka naam type karoge (e.g. "telugu"),
          us search ke liye filter khud bypass ho jaata hai.
        </div>

        <button
          onClick={onClose}
          style={{
            width: '100%', marginTop: 24, padding: '12px', borderRadius: 24,
            border: 'none', background: '#2a2a2a', color: '#fff',
            fontWeight: 700, fontSize: 14, cursor: 'pointer', fontFamily: 'inherit',
          }}
        >
          Done
        </button>
      </div>
    </div>
  );
}
