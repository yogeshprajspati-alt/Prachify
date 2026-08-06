import React, { useState } from 'react';
import { isFilterEnabled, setFilterEnabled } from '../utils/languageFilter';
import useProfileStore from '../store/profileStore';

export default function SettingsModal({ onClose }) {
  const [enabled, setEnabled] = useState(isFilterEnabled());
  const activeProfile = useProfileStore(s => s.getActiveProfile());
  const updatePin = useProfileStore(s => s.updatePin);
  const customPins = useProfileStore(s => s.customPins);

  const [isChangingPin, setIsChangingPin] = useState(false);
  const [pinForm, setPinForm] = useState({ oldPin: '', newPin: '', hint: '', securityQuestion: '', securityAnswer: '' });
  const [pinError, setPinError] = useState('');
  const [pinSuccess, setPinSuccess] = useState(false);

  const handlePinSave = async () => {
    setPinError('');
    if (!pinForm.oldPin || !pinForm.newPin) return setPinError('PIN fields cannot be empty');
    if (pinForm.newPin.length !== 4 || isNaN(pinForm.newPin)) return setPinError('New PIN must be 4 digits');
    
    const activePin = customPins[activeProfile.id]?.pin || activeProfile.defaultPin;
    if (pinForm.oldPin !== activePin) return setPinError('Old PIN is incorrect');

    await updatePin(activeProfile.id, pinForm.newPin, pinForm.hint, pinForm.securityQuestion, pinForm.securityAnswer);
    setPinSuccess(true);
    setTimeout(() => {
      setIsChangingPin(false);
      setPinSuccess(false);
      setPinForm({ oldPin: '', newPin: '', hint: '', securityQuestion: '', securityAnswer: '' });
    }, 1500);
  };

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

        {/* Security / PIN Section */}
        {activeProfile && activeProfile.id !== 'guest' && (
          <div style={{ marginTop: 32, borderTop: '1px solid #333', paddingTop: 20 }}>
            {!isChangingPin ? (
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div>
                  <div style={{ fontSize: 14, fontWeight: 700, color: '#fff' }}>Profile Security</div>
                  <div style={{ fontSize: 12, color: '#b3b3b3' }}>Change your 4-digit PIN</div>
                </div>
                <button
                  onClick={() => setIsChangingPin(true)}
                  style={{
                    background: '#2a2a2a', border: 'none', color: '#fff',
                    padding: '8px 16px', borderRadius: 16, fontSize: 12, fontWeight: 600, cursor: 'pointer'
                  }}
                >
                  Change PIN
                </button>
              </div>
            ) : (
              <div style={{ background: '#222', padding: 16, borderRadius: 12, animation: 'fadeIn 0.2s ease' }}>
                <div style={{ fontSize: 14, fontWeight: 700, color: '#fff', marginBottom: 16 }}>Change PIN</div>
                
                {pinError && <div style={{ color: '#ff4fa3', fontSize: 12, marginBottom: 12 }}>{pinError}</div>}
                {pinSuccess && <div style={{ color: '#1db954', fontSize: 12, marginBottom: 12 }}>PIN updated successfully!</div>}
                
                <input
                  type="password"
                  placeholder="Old PIN"
                  maxLength={4}
                  value={pinForm.oldPin}
                  onChange={e => setPinForm(p => ({ ...p, oldPin: e.target.value }))}
                  style={inputStyle}
                />
                <input
                  type="password"
                  placeholder="New PIN (4 digits)"
                  maxLength={4}
                  value={pinForm.newPin}
                  onChange={e => setPinForm(p => ({ ...p, newPin: e.target.value }))}
                  style={inputStyle}
                />
                <input
                  type="text"
                  placeholder="Hint (optional, e.g. My lucky number)"
                  maxLength={30}
                  value={pinForm.hint}
                  onChange={e => setPinForm(p => ({ ...p, hint: e.target.value }))}
                  style={inputStyle}
                />
                <input
                  type="text"
                  placeholder="Security Question (e.g. Pet's name?)"
                  maxLength={50}
                  value={pinForm.securityQuestion}
                  onChange={e => setPinForm(p => ({ ...p, securityQuestion: e.target.value }))}
                  style={inputStyle}
                />
                <input
                  type="text"
                  placeholder="Security Answer (Keep it simple)"
                  maxLength={50}
                  value={pinForm.securityAnswer}
                  onChange={e => setPinForm(p => ({ ...p, securityAnswer: e.target.value }))}
                  style={{ ...inputStyle, marginBottom: 16 }}
                />
                
                <div style={{ display: 'flex', gap: 12 }}>
                  <button onClick={() => setIsChangingPin(false)} style={{ ...btnStyle, background: '#333', flex: 1 }}>Cancel</button>
                  <button onClick={handlePinSave} style={{ ...btnStyle, background: '#1db954', color: '#000', flex: 1 }}>Save</button>
                </div>
              </div>
            )}
          </div>
        )}

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

const inputStyle = {
  width: '100%', background: '#121212', border: '1px solid #333',
  color: '#fff', padding: '10px 12px', borderRadius: 8, fontSize: 14,
  marginBottom: 12, outline: 'none'
};

const btnStyle = {
  border: 'none', padding: '10px', borderRadius: 8, fontSize: 13,
  fontWeight: 700, cursor: 'pointer', color: '#fff'
};
