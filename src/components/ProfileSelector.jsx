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
  const customPins = useProfileStore(s => s.customPins);
  const [lockedProfile, setLockedProfile] = useState(null);
  const [pin, setPin] = useState('');
  const [isError, setIsError] = useState(false);
  const [showHint, setShowHint] = useState(false);
  const updatePin = useProfileStore(s => s.updatePin);

  // Recovery States
  const [showRecoveryMenu, setShowRecoveryMenu] = useState(false);
  const [recoveryMode, setRecoveryMode] = useState(null); // 'hint', 'answer', 'newPin'
  const [securityAnswer, setSecurityAnswer] = useState('');
  const [recoveryError, setRecoveryError] = useState('');
  const [newPinForm, setNewPinForm] = useState({ pin: '', hint: '' });

  // Helper to get active PIN and Hint for a profile
  const getProfileSecurity = (id) => {
    const custom = customPins[id];
    const profile = PROFILES.find(p => p.id === id);
    return {
      pin: custom?.pin || profile?.defaultPin,
      hint: custom?.hint || 'Your birth date (DDMM)',
      securityQuestion: custom?.securityQuestion || null,
      securityAnswer: custom?.securityAnswer || null,
    };
  };

  const handleSelect = (id) => {
    const profile = PROFILES.find(p => p.id === id);
    const { pin: activePin } = getProfileSecurity(id);
    if (activePin) {
      setLockedProfile(profile);
      setPin('');
      setIsError(false);
      setShowHint(false);
      setShowRecoveryMenu(false);
      setRecoveryMode(null);
      setSecurityAnswer('');
      setRecoveryError('');
      setNewPinForm({ pin: '', hint: '' });
    } else {
      selectProfile(id);
      if (onClose) onClose();
    }
  };

  const handleKeypad = (num) => {
    if (isError) {
      setIsError(false);
      setPin(num.toString());
      return;
    }
    if (pin.length < 4) {
      const newPin = pin + num;
      setPin(newPin);
      if (newPin.length === 4) {
        const { pin: correctPin } = getProfileSecurity(lockedProfile.id);
        if (newPin === correctPin) {
          selectProfile(lockedProfile.id);
          if (onClose) onClose();
        } else {
          setIsError(true);
        }
      }
    }
  };

  const handleBackspace = () => {
    if (isError) {
      setIsError(false);
      setPin('');
      return;
    }
    setPin(p => p.slice(0, -1));
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

      {!lockedProfile ? (
        <>
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
        </>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', width: '100%', maxWidth: 320 }}>
          <div style={{ marginBottom: 24, transform: 'scale(0.8)' }}>
            <ProfileAvatar profile={lockedProfile} />
          </div>
          <h2 style={{ fontSize: 24, fontWeight: 700, marginBottom: 8 }}>Enter PIN</h2>
          <p style={{ fontSize: 14, color: isError ? '#ff4fa3' : '#b3b3b3', marginBottom: 32, height: 20 }}>
            {isError ? 'Invalid PIN' : `Welcome back, ${lockedProfile.name}`}
          </p>

          <div style={{
            display: 'flex', gap: 16, marginBottom: 40,
            animation: isError ? 'shake 0.4s cubic-bezier(0.36, 0.07, 0.19, 0.97) both' : 'none',
          }}>
            {[0, 1, 2, 3].map(i => (
              <div key={i} style={{
                width: 16, height: 16, borderRadius: '50%',
                background: i < pin.length ? (isError ? '#ff4fa3' : '#fff') : 'rgba(255,255,255,0.1)',
                transition: 'background 0.2s, transform 0.2s',
                transform: i < pin.length ? 'scale(1.2)' : 'scale(1)'
              }} />
            ))}
          </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12, width: '100%' }}>
              {[1, 2, 3, 4, 5, 6, 7, 8, 9].map(num => (
                <button
                  key={num}
                  onClick={() => handleKeypad(num)}
                  style={{
                    background: 'rgba(255,255,255,0.05)', border: 'none',
                    borderRadius: '50%', width: 64, height: 64, margin: '0 auto',
                    color: '#fff', fontSize: 24, fontWeight: 600, cursor: 'pointer',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                  }}
                >
                {num}
              </button>
            ))}
            <button
              onClick={() => setLockedProfile(null)}
              style={{
                background: 'transparent', border: 'none', color: '#b3b3b3',
                fontSize: 14, fontWeight: 600, cursor: 'pointer'
              }}
            >
              Cancel
            </button>
              <button
                onClick={() => handleKeypad(0)}
                style={{
                  background: 'rgba(255,255,255,0.05)', border: 'none',
                  borderRadius: '50%', width: 64, height: 64, margin: '0 auto',
                  color: '#fff', fontSize: 24, fontWeight: 600, cursor: 'pointer',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}
              >
              0
            </button>
            <button
              onClick={handleBackspace}
              style={{
                background: 'transparent', border: 'none', color: '#b3b3b3', cursor: 'pointer',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}
            >
              <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21 4H8l-7 8 7 8h13a2 2 0 0 0 2-2V6a2 2 0 0 0-2-2z"></path>
                <line x1="18" y1="9" x2="12" y2="15"></line>
                <line x1="12" y1="9" x2="18" y2="15"></line>
              </svg>
            </button>
          </div>

          <div style={{ marginTop: 24, textAlign: 'center', width: '100%' }}>
            {!showRecoveryMenu ? (
              <button
                onClick={() => setShowRecoveryMenu(true)}
                style={{
                  background: 'none', border: 'none', color: '#1db954',
                  fontSize: 13, fontWeight: 600, cursor: 'pointer', padding: 8
                }}
              >
                Forgot PIN?
              </button>
            ) : recoveryMode === null ? (
              <div style={{ display: 'flex', flexDirection: 'row', gap: 8, animation: 'fadeIn 0.2s ease', justifyContent: 'center', flexWrap: 'wrap' }}>
                <button
                  onClick={() => setRecoveryMode('hint')}
                  style={{ background: '#2a2a2a', border: 'none', color: '#fff', padding: '10px 16px', borderRadius: 20, fontSize: 12, fontWeight: 600, cursor: 'pointer', flex: 1 }}
                >
                  Show Hint
                </button>
                <button
                  onClick={() => {
                    if (!getProfileSecurity(lockedProfile.id).securityQuestion) {
                      setRecoveryError("You haven't set a security question yet.");
                    } else {
                      setRecoveryMode('answer');
                    }
                  }}
                  style={{ background: '#2a2a2a', border: 'none', color: '#fff', padding: '10px 16px', borderRadius: 20, fontSize: 12, fontWeight: 600, cursor: 'pointer', flex: 2, minWidth: '60%' }}
                >
                  Reset with Question
                </button>
                {recoveryError && <div style={{ color: '#ff4fa3', fontSize: 12 }}>{recoveryError}</div>}
              </div>
            ) : recoveryMode === 'hint' ? (
              <div style={{
                background: 'rgba(29, 185, 84, 0.1)', border: '1px solid rgba(29, 185, 84, 0.2)',
                borderRadius: 8, padding: '12px 16px', color: '#1db954', fontSize: 13,
                animation: 'fadeIn 0.3s ease'
              }}>
                Hint: {getProfileSecurity(lockedProfile.id).hint}
              </div>
            ) : recoveryMode === 'answer' ? (
              <div style={{ background: '#222', padding: 16, borderRadius: 12, animation: 'fadeIn 0.2s ease' }}>
                <div style={{ fontSize: 13, color: '#fff', marginBottom: 12, fontWeight: 600 }}>
                  {getProfileSecurity(lockedProfile.id).securityQuestion}
                </div>
                {recoveryError && <div style={{ color: '#ff4fa3', fontSize: 12, marginBottom: 8 }}>{recoveryError}</div>}
                <input
                  type="text"
                  placeholder="Your Answer"
                  value={securityAnswer}
                  onChange={e => setSecurityAnswer(e.target.value)}
                  style={{ width: '100%', padding: '10px', borderRadius: 8, background: '#121212', border: '1px solid #333', color: '#fff', marginBottom: 12 }}
                />
                <button
                  onClick={() => {
                    const correctAns = getProfileSecurity(lockedProfile.id).securityAnswer || '';
                    if (securityAnswer.trim().toLowerCase() === correctAns.trim().toLowerCase()) {
                      setRecoveryError('');
                      setRecoveryMode('newPin');
                    } else {
                      setRecoveryError('Incorrect answer');
                    }
                  }}
                  style={{ background: '#1db954', border: 'none', color: '#000', padding: '10px', borderRadius: 8, width: '100%', fontWeight: 700, cursor: 'pointer' }}
                >
                  Verify
                </button>
              </div>
            ) : recoveryMode === 'newPin' ? (
              <div style={{ background: '#222', padding: 16, borderRadius: 12, animation: 'fadeIn 0.2s ease' }}>
                <div style={{ fontSize: 14, fontWeight: 700, color: '#fff', marginBottom: 16 }}>Create New PIN</div>
                {recoveryError && <div style={{ color: '#ff4fa3', fontSize: 12, marginBottom: 8 }}>{recoveryError}</div>}
                <input
                  type="password"
                  placeholder="New PIN (4 digits)"
                  maxLength={4}
                  value={newPinForm.pin}
                  onChange={e => setNewPinForm(p => ({ ...p, pin: e.target.value }))}
                  style={{ width: '100%', padding: '10px', borderRadius: 8, background: '#121212', border: '1px solid #333', color: '#fff', marginBottom: 12 }}
                />
                <input
                  type="text"
                  placeholder="New Hint (optional)"
                  maxLength={30}
                  value={newPinForm.hint}
                  onChange={e => setNewPinForm(p => ({ ...p, hint: e.target.value }))}
                  style={{ width: '100%', padding: '10px', borderRadius: 8, background: '#121212', border: '1px solid #333', color: '#fff', marginBottom: 12 }}
                />
                <button
                  onClick={async () => {
                    if (newPinForm.pin.length !== 4 || isNaN(newPinForm.pin)) {
                      setRecoveryError('PIN must be 4 digits');
                      return;
                    }
                    await updatePin(lockedProfile.id, newPinForm.pin, newPinForm.hint);
                    selectProfile(lockedProfile.id);
                    if (onClose) onClose();
                  }}
                  style={{ background: '#1db954', border: 'none', color: '#000', padding: '10px', borderRadius: 8, width: '100%', fontWeight: 700, cursor: 'pointer' }}
                >
                  Save & Login
                </button>
              </div>
            ) : null}
          </div>
        </div>
      )}
    </div>
  );
}
