import React, { useState } from 'react';
import useProfileStore, { PROFILES } from '../store/profileStore';

// Renders the profile's cartoon avatar image if it exists at
// /profile-avatars/<id>.png, otherwise falls back to a cute gradient
// circle with an emoji — so the screen looks good even before real
// artwork is dropped in.
function ProfileAvatar({ profile, size = 96 }) {
  const [imgFailed, setImgFailed] = useState(false);

  return (
    <div
      style={{
        width: size,
        height: size,
        borderRadius: '50%',
        overflow: 'hidden',
        background: profile.gradient,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        boxShadow: `0 8px 24px ${profile.color}55`,
        border: '3px solid transparent',
        transition: 'transform 0.2s ease, border-color 0.2s ease',
      }}
    >
      {!imgFailed ? (
        <img
          src={profile.avatar}
          alt={profile.name}
          onError={() => setImgFailed(true)}
          style={{ width: '100%', height: '100%', objectFit: 'cover' }}
        />
      ) : (
        <span style={{ fontSize: size * 0.42, lineHeight: 1 }}>{profile.emoji}</span>
      )}
    </div>
  );
}

function ProfileCard({ profile, onSelect }) {
  const [hover, setHover] = useState(false);

  return (
    <button
      onClick={() => onSelect(profile.id)}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      onTouchStart={() => setHover(true)}
      onTouchEnd={() => setHover(false)}
      style={{
        background: 'transparent',
        border: 'none',
        cursor: 'pointer',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: 12,
        padding: 8,
        transform: hover ? 'translateY(-4px) scale(1.05)' : 'translateY(0) scale(1)',
        transition: 'transform 0.2s cubic-bezier(0.34, 1.56, 0.64, 1)',
      }}
    >
      <div style={{
        borderRadius: '50%',
        padding: 3,
        background: hover ? profile.gradient : 'transparent',
        transition: 'background 0.2s ease',
      }}>
        <ProfileAvatar profile={profile} />
      </div>
      <span style={{
        fontSize: 15,
        fontWeight: 600,
        color: hover ? '#fff' : '#b3b3b3',
        transition: 'color 0.2s ease',
      }}>
        {profile.name}
      </span>
    </button>
  );
}

// Full-screen "Who's listening?" gate — shown when no profile is active yet.
// Also reused as an overlay (isModal=true) when switching profiles later.
export default function ProfileSelector({ isModal = false, onClose }) {
  const selectProfile = useProfileStore(s => s.selectProfile);

  const handleSelect = (id) => {
    selectProfile(id);
    if (onClose) onClose();
  };

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 10000,
        background: isModal ? 'rgba(18,18,18,0.92)' : '#121212',
        backdropFilter: isModal ? 'blur(8px)' : 'none',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '24px 16px',
        animation: 'fadeIn 0.25s ease',
      }}
    >
      {isModal && (
        <button
          onClick={onClose}
          aria-label="Close"
          style={{
            position: 'absolute', top: 20, right: 20,
            background: 'rgba(255,255,255,0.08)', border: 'none',
            width: 36, height: 36, borderRadius: '50%',
            color: '#fff', fontSize: 18, cursor: 'pointer',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}
        >
          ✕
        </button>
      )}

      <img
        src="/prachify-logo.png"
        alt=""
        style={{ width: 48, height: 48, objectFit: 'contain', marginBottom: 24, opacity: 0.9 }}
      />

      <h1 style={{
        fontSize: 'clamp(22px, 5vw, 32px)',
        fontWeight: 800,
        color: '#fff',
        marginBottom: 8,
        textAlign: 'center',
      }}>
        Kaun sun raha hai?
      </h1>
      <p style={{ fontSize: 14, color: '#b3b3b3', marginBottom: 40, textAlign: 'center' }}>
        Apna profile chuno
      </p>

      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(96px, 1fr))',
        gap: 28,
        maxWidth: 480,
        width: '100%',
        justifyItems: 'center',
      }}>
        {PROFILES.map(profile => (
          <ProfileCard key={profile.id} profile={profile} onSelect={handleSelect} />
        ))}
      </div>
    </div>
  );
}
