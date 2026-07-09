// src/components/ChangelogModal.jsx

import React from 'react';

export default function ChangelogModal({ changelog, onClose }) {
  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0,0,0,0.6)',
        backdropFilter: 'blur(8px)',
        WebkitBackdropFilter: 'blur(8px)',
        zIndex: 9999,
        display: 'flex',
        alignItems: 'flex-end',
        justifyContent: 'center',
        animation: 'fadeInOverlay 0.2s ease',
      }}
      onClick={onClose}
    >
      <div
        style={{
          background: 'linear-gradient(180deg, #1c1c1e 0%, #141414 100%)',
          borderRadius: '28px 28px 0 0',
          width: '100%',
          maxWidth: 480,
          maxHeight: '80vh',
          overflowY: 'auto',
          animation: 'slideUpModal 0.3s cubic-bezier(0.32, 0.72, 0, 1)',
          paddingBottom: 'env(safe-area-inset-bottom, 24px)',
        }}
        onClick={e => e.stopPropagation()}
      >
        {/* Drag handle */}
        <div style={{ display: 'flex', justifyContent: 'center', padding: '12px 0 4px' }}>
          <div style={{ width: 36, height: 4, borderRadius: 2, background: 'rgba(255,255,255,0.15)' }} />
        </div>

        {/* Header */}
        <div style={{ padding: '12px 24px 20px', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <div>
              <div style={{ fontSize: 22, fontWeight: 800, color: '#fff', letterSpacing: '-0.3px' }}>
                What's New
              </div>
              <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.4)', marginTop: 2 }}>
                Geet keeps getting better ✨
              </div>
            </div>
            <button
              onClick={onClose}
              style={{
                width: 30, height: 30, borderRadius: '50%',
                background: 'rgba(255,255,255,0.1)',
                border: 'none', cursor: 'pointer',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                color: 'rgba(255,255,255,0.6)', fontSize: 14, fontWeight: 700,
                flexShrink: 0, marginTop: 2,
              }}
            >
              ✕
            </button>
          </div>
        </div>

        {/* Version entries */}
        <div style={{ padding: '8px 0 16px' }}>
          {changelog.map((entry, i) => (
            <div key={entry.version} style={{ padding: '16px 24px' }}>
              {/* Version row */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 }}>
                {i === 0 ? (
                  <span style={{
                    background: 'linear-gradient(135deg, #ff2d55, #ff6b8a)',
                    color: '#fff',
                    fontSize: 10,
                    fontWeight: 800,
                    padding: '3px 10px',
                    borderRadius: 20,
                    letterSpacing: '0.5px',
                    textTransform: 'uppercase',
                  }}>
                    Latest
                  </span>
                ) : (
                  <span style={{
                    background: 'rgba(255,255,255,0.08)',
                    color: 'rgba(255,255,255,0.5)',
                    fontSize: 10,
                    fontWeight: 700,
                    padding: '3px 10px',
                    borderRadius: 20,
                    letterSpacing: '0.5px',
                  }}>
                    v{entry.version}
                  </span>
                )}
                <span style={{ fontSize: 13, color: 'rgba(255,255,255,0.35)', fontWeight: 500 }}>
                  {new Date(entry.date).toLocaleDateString('en-IN', {
                    day: 'numeric', month: 'long', year: 'numeric'
                  })}
                </span>
              </div>

              {/* Update items */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {entry.updates.map((update, j) => {
                  const emoji = update.match(/^\S+/)?.[0] || '•';
                  const text = update.replace(/^\S+\s*/, '');
                  return (
                    <div
                      key={j}
                      style={{
                        display: 'flex',
                        alignItems: 'flex-start',
                        gap: 12,
                        background: 'rgba(255,255,255,0.04)',
                        borderRadius: 14,
                        padding: '12px 14px',
                        border: '1px solid rgba(255,255,255,0.06)',
                      }}
                    >
                      <div style={{
                        width: 36, height: 36, borderRadius: 10,
                        background: 'rgba(255,255,255,0.07)',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        fontSize: 18, flexShrink: 0,
                      }}>
                        {emoji}
                      </div>
                      <div style={{
                        fontSize: 14,
                        color: 'rgba(255,255,255,0.85)',
                        lineHeight: 1.5,
                        paddingTop: 2,
                        fontWeight: 500,
                      }}>
                        {text}
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Divider between versions */}
              {i < changelog.length - 1 && (
                <div style={{ marginTop: 20, borderBottom: '1px solid rgba(255,255,255,0.06)' }} />
              )}
            </div>
          ))}
        </div>

        <style>{`
          @keyframes fadeInOverlay {
            from { opacity: 0; }
            to { opacity: 1; }
          }
          @keyframes slideUpModal {
            from { transform: translateY(100%); }
            to { transform: translateY(0); }
          }
        `}</style>
      </div>
    </div>
  );
}
