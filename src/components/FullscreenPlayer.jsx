import React, { useState, useRef } from 'react';
import usePlayerStore from '../store/playerStore';

function fmt(s) {
  if (!s || isNaN(s)) return '0:00';
  return `${Math.floor(s/60)}:${String(Math.floor(s%60)).padStart(2,'0')}`;
}

export default function FullscreenPlayer({
  song, isPlaying, isLoading, position, duration,
  queue, queueIndex, onClose, onPlayPause, onNext, onPrev, onSeek,
  onJumpToQueue, volume, isMuted, onVolumeChange, onToggleMute,
  shuffle, repeatMode, onToggleShuffle, onCycleRepeat,
}) {
  const [tab, setTab] = useState('player'); // 'player' | 'queue'
  const likedSongs = usePlayerStore(s => s.likedSongs);
  const toggleLike = usePlayerStore(s => s.toggleLike);
  const isLiked = likedSongs.includes(song?.id);

  // Swipe down to close
  const startY = useRef(null);
  const onTouchStart = e => { startY.current = e.touches[0].clientY; };
  const onTouchEnd = e => {
    if (startY.current !== null && e.changedTouches[0].clientY - startY.current > 80) onClose();
    startY.current = null;
  };

  const pct = duration > 0 ? (position / duration) * 100 : 0;
  const effectiveVol = isMuted ? 0 : volume;

  return (
    <div className="slide-up" style={{
      position: 'fixed', inset: 0, zIndex: 100,
      display: 'flex', flexDirection: 'column',
      background: '#121212',
      maxWidth: 430, margin: '0 auto',
    }} onTouchStart={onTouchStart} onTouchEnd={onTouchEnd}>

      {/* Dynamic blurred bg */}
      <div style={{ position: 'absolute', inset: 0, overflow: 'hidden', zIndex: 0 }}>
        <img src={song.cover} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover', filter: 'blur(80px) brightness(0.3)', transform: 'scale(1.2)' }} onError={() => {}} />
        <div style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.55)' }} />
      </div>

      {/* Content */}
      <div style={{ position: 'relative', zIndex: 1, display: 'flex', flexDirection: 'column', flex: 1, padding: '0 24px', paddingBottom: 'max(28px, env(safe-area-inset-bottom))' }}>

        {/* Drag handle */}
        <div style={{ display: 'flex', justifyContent: 'center', padding: '12px 0 8px' }}>
          <div style={{ width: 32, height: 4, borderRadius: 2, background: 'rgba(255,255,255,0.3)' }} />
        </div>

        {/* Top bar */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
          <button onClick={onClose} style={ctrl}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.5" strokeLinecap="round">
              <path d="M19 9l-7 7-7-7"/>
            </svg>
          </button>
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: 'rgba(255,255,255,0.6)', letterSpacing: 1.5, textTransform: 'uppercase' }}>
              {tab === 'queue' ? 'Next up' : 'Now playing'}
            </div>
          </div>
          <button onClick={() => setTab(tab === 'queue' ? 'player' : 'queue')} style={ctrl}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={tab === 'queue' ? '#1DB954' : '#fff'} strokeWidth="2" strokeLinecap="round">
              <path d="M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01"/>
            </svg>
          </button>
        </div>

        {tab === 'player' ? (
          <>
            {/* Album art */}
            <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 24 }}>
              <div style={{ width: '100%', maxWidth: 320, aspectRatio: '1', borderRadius: 8, overflow: 'hidden', boxShadow: '0 24px 64px rgba(0,0,0,0.8)', transition: 'transform 0.3s', transform: isPlaying ? 'scale(1)' : 'scale(0.92)' }}>
                <img src={song.cover} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} onError={e => e.target.style.background='#333'} />
              </div>
            </div>

            {/* Song info + like */}
            <div style={{ display: 'flex', alignItems: 'center', marginBottom: 20 }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 20, fontWeight: 800, color: '#fff', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', marginBottom: 4 }}>{song.title}</div>
                <div style={{ fontSize: 14, color: 'rgba(255,255,255,0.6)' }}>{song.artist}</div>
              </div>
              <button onClick={() => toggleLike(song)} style={{ ...ctrl, marginLeft: 12 }}>
                <svg width="24" height="24" viewBox="0 0 24 24" fill={isLiked ? '#1DB954' : 'none'} stroke={isLiked ? '#1DB954' : 'rgba(255,255,255,0.6)'} strokeWidth="2">
                  <path d="M20.84 4.61a5.5 5.5 0 00-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 00-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 000-7.78z"/>
                </svg>
              </button>
            </div>

            {/* Seekbar */}
            <SeekBar pct={pct} position={position} duration={duration} onSeek={onSeek} />

            {/* Playback controls */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
              <button onClick={onToggleShuffle} style={ctrl}>
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={shuffle ? '#1DB954' : 'rgba(255,255,255,0.6)'} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="16 3 21 3 21 8"/><line x1="4" y1="20" x2="21" y2="3"/><polyline points="21 16 21 21 16 21"/><line x1="15" y1="15" x2="21" y2="21"/>
                </svg>
                {shuffle && <div style={{ position: 'absolute', bottom: 2, width: 4, height: 4, borderRadius: '50%', background: '#1DB954' }} />}
              </button>

              <button onClick={onPrev} style={ctrl}>
                <svg width="32" height="32" viewBox="0 0 24 24" fill="rgba(255,255,255,0.9)">
                  <path d="M6 6h2v12H6zm3.5 6l8.5 6V6z"/>
                </svg>
              </button>

              <button onClick={onPlayPause} style={{ width: 64, height: 64, borderRadius: '50%', background: '#fff', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 8px 24px rgba(0,0,0,0.4)', flexShrink: 0 }}>
                {isLoading
                  ? <div style={{ width: 24, height: 24, borderRadius: '50%', border: '3px solid #535353', borderTop: '3px solid #000', animation: 'spin 0.8s linear infinite' }} />
                  : isPlaying
                    ? <svg width="26" height="26" viewBox="0 0 24 24" fill="#000"><rect x="6" y="4" width="4" height="16"/><rect x="14" y="4" width="4" height="16"/></svg>
                    : <svg width="26" height="26" viewBox="0 0 24 24" fill="#000"><polygon points="5,3 19,12 5,21"/></svg>
                }
              </button>

              <button onClick={onNext} style={ctrl}>
                <svg width="32" height="32" viewBox="0 0 24 24" fill="rgba(255,255,255,0.9)">
                  <path d="M6 18l8.5-6L6 6v12zM16 6v12h2V6h-2z"/>
                </svg>
              </button>

              <button onClick={onCycleRepeat} style={{ ...ctrl, position: 'relative' }}>
                {repeatMode === 'one'
                  ? <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#1DB954" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <polyline points="17 1 21 5 17 9"/><path d="M3 11V9a4 4 0 014-4h14"/><polyline points="7 23 3 19 7 15"/><path d="M21 13v2a4 4 0 01-4 4H3"/><text x="12" y="13" fontSize="5" fill="#1DB954" stroke="none" textAnchor="middle" dominantBaseline="middle" fontWeight="900">1</text>
                    </svg>
                  : <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={repeatMode === 'all' ? '#1DB954' : 'rgba(255,255,255,0.6)'} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <polyline points="17 1 21 5 17 9"/><path d="M3 11V9a4 4 0 014-4h14"/><polyline points="7 23 3 19 7 15"/><path d="M21 13v2a4 4 0 01-4 4H3"/>
                    </svg>
                }
                {repeatMode !== 'off' && <div style={{ position: 'absolute', bottom: 0, width: 4, height: 4, borderRadius: '50%', background: '#1DB954' }} />}
              </button>
            </div>

            {/* Volume slider */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 24 }}>
              <button onClick={onToggleMute} style={ctrl}>
                {isMuted || volume === 0
                  ? <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.5)" strokeWidth="2" strokeLinecap="round"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/><line x1="23" y1="9" x2="17" y2="15"/><line x1="17" y1="9" x2="23" y2="15"/></svg>
                  : <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.5)" strokeWidth="2" strokeLinecap="round"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/><path d="M15.54 8.46a5 5 0 010 7.07"/><path d="M19.07 4.93a10 10 0 010 14.14"/></svg>
                }
              </button>
              <div style={{ flex: 1, height: 4, background: 'rgba(255,255,255,0.2)', borderRadius: 2, cursor: 'pointer', position: 'relative' }}
                onClick={e => { const r = e.currentTarget.getBoundingClientRect(); onVolumeChange(Math.max(0, Math.min(1, (e.clientX - r.left) / r.width))); }}>
                <div style={{ height: '100%', background: '#fff', borderRadius: 2, width: `${effectiveVol * 100}%` }} />
              </div>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.5)" strokeWidth="2" strokeLinecap="round"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/><path d="M15.54 8.46a5 5 0 010 7.07"/><path d="M19.07 4.93a10 10 0 010 14.14"/></svg>
            </div>
          </>
        ) : (
          /* Queue view */
          <div style={{ flex: 1, overflowY: 'auto', marginBottom: 16 }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: 'rgba(255,255,255,0.5)', marginBottom: 12 }}>Next in queue</div>
            {queue.map((item, i) => {
              const isCur = i === queueIndex;
              return (
                <button key={`${item.id}-${i}`} onClick={() => onJumpToQueue?.(i)}
                  style={{ display: 'flex', alignItems: 'center', gap: 12, width: '100%', background: isCur ? 'rgba(255,255,255,0.1)' : 'none', border: 'none', cursor: 'pointer', padding: '10px 8px', borderRadius: 6, textAlign: 'left', marginBottom: 2 }}>
                  <img src={item.cover} alt="" style={{ width: 44, height: 44, borderRadius: 4, objectFit: 'cover', flexShrink: 0 }} onError={e => e.target.style.background='#333'} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 14, fontWeight: 600, color: isCur ? '#1DB954' : '#fff', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{item.title}</div>
                    <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.5)' }}>{item.artist}</div>
                  </div>
                  {isCur && isPlaying && <div style={{ display: 'flex', alignItems: 'flex-end', gap: 2, height: 16 }}><span className="eq-bar"/><span className="eq-bar"/><span className="eq-bar"/></div>}
                </button>
              );
            })}
          </div>
        )}
      </div>
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}

function SeekBar({ pct, position, duration, onSeek }) {
  const ref = useRef(null);
  const seek = e => {
    const r = ref.current?.getBoundingClientRect();
    if (!r || !duration) return;
    onSeek(Math.max(0, Math.min(1, (e.clientX - r.left) / r.width)) * duration);
  };

  return (
    <div style={{ marginBottom: 20 }}>
      <div ref={ref} onClick={seek}
        onTouchStart={e => {
          const move = ev => { const r = ref.current?.getBoundingClientRect(); if (!r) return; onSeek(Math.max(0,Math.min(1,(ev.touches[0].clientX-r.left)/r.width))*duration); };
          const end = () => { window.removeEventListener('touchmove',move); window.removeEventListener('touchend',end); };
          window.addEventListener('touchmove',move,{passive:true});
          window.addEventListener('touchend',end);
        }}
        style={{ height: 4, background: 'rgba(255,255,255,0.2)', borderRadius: 2, cursor: 'pointer', position: 'relative', padding: '10px 0', margin: '-10px 0', boxSizing: 'content-box' }}>
        <div style={{ height: 4, background: '#fff', borderRadius: 2, width: `${pct}%`, pointerEvents: 'none' }} />
      </div>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 6 }}>
        <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.5)' }}>
          {`${Math.floor(position/60)}:${String(Math.floor(position%60)).padStart(2,'0')}`}
        </span>
        <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.5)' }}>
          {`${Math.floor(duration/60)}:${String(Math.floor(duration%60)).padStart(2,'0')}`}
        </span>
      </div>
    </div>
  );
}

const ctrl = {
  background: 'none', border: 'none', cursor: 'pointer',
  display: 'flex', alignItems: 'center', justifyContent: 'center',
  padding: 8, borderRadius: '50%', position: 'relative',
  WebkitTapHighlightColor: 'transparent',
};
