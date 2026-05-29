import React, { useState, useRef, useEffect, memo } from 'react';
import { useNavigate } from 'react-router-dom';
import usePlayerStore from '../store/playerStore';
import { searchSongs, getLyrics } from '../services/jiosaavn';

function LyricsView({ lines, position, duration, scrollRef }) {
  const currentIdx = duration > 0
    ? Math.min(Math.floor((position / duration) * lines.length), lines.length - 1)
    : 0;

  const lineRefs = useRef([]);

  // Auto-scroll current line ko center mein lao
  useEffect(() => {
    const el = lineRefs.current[currentIdx];
    if (el && scrollRef.current) {
      const container = scrollRef.current;
      const elTop = el.offsetTop;
      const elHeight = el.offsetHeight;
      const containerHeight = container.offsetHeight;
      container.scrollTo({
        top: elTop - containerHeight / 2 + elHeight / 2,
        behavior: 'smooth',
      });
    }
  }, [currentIdx]);

  return (
    <div style={{ padding: '20px 0' }}>
      {lines.map((line, idx) => {
        const isCurrent = idx === currentIdx;
        const isPast = idx < currentIdx;
        return (
          <p
            key={idx}
            ref={el => lineRefs.current[idx] = el}
            style={{
              margin: 0,
              padding: '10px 8px',
              fontSize: isCurrent ? 20 : 16,
              fontWeight: isCurrent ? 800 : 500,
              color: isCurrent
                ? '#fff'
                : isPast
                  ? 'rgba(255,255,255,0.25)'
                  : 'rgba(255,255,255,0.45)',
              lineHeight: 1.5,
              transition: 'all 0.4s ease',
              textAlign: 'center',
              transform: isCurrent ? 'scale(1.04)' : 'scale(1)',
              transformOrigin: 'center',
            }}
          >
            {line}
          </p>
        );
      })}
    </div>
  );
}

function fmt(s) {
  if (!s || isNaN(s)) return '0:00';
  return `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`;
}

export default function FullscreenPlayer({
  song, isPlaying, isLoading, position, duration,
  queue, queueIndex, onClose, onPlayPause, onNext, onPrev, onSeek,
  onJumpToQueue, volume, isMuted, onVolumeChange, onToggleMute,
  shuffle, repeatMode, onToggleShuffle, onCycleRepeat,
  onPlaySuggestion,
}) {
  const navigate = useNavigate();
  const [tab, setTab] = useState('player');
  const likedSongs = usePlayerStore(s => s.likedSongs);
  const toggleLike = usePlayerStore(s => s.toggleLike);
  const smartQueueEnabled = usePlayerStore(s => s.smartQueueEnabled);
  const toggleSmartQueue = usePlayerStore(s => s.toggleSmartQueue);
  const playbackRate = usePlayerStore(s => s.playbackRate);
  const setPlaybackRate = usePlayerStore(s => s.setPlaybackRate);
  const abLoop = usePlayerStore(s => s.abLoop);
  const setAbPoint = usePlayerStore(s => s.setAbPoint);
  const resetAbLoop = usePlayerStore(s => s.resetAbLoop);
  const isLiked = likedSongs.includes(song?.id);

  const [suggestions, setSuggestions] = useState([]);
  const [loadingSuggestions, setLoadingSuggestions] = useState(false);
  const lastFetchedId = useRef(null);

  const [related, setRelated] = useState([]);
  const [loadingRelated, setLoadingRelated] = useState(false);
  const lastRelatedId = useRef(null);

  const [lyrics, setLyrics] = useState([]);
  const [loadingLyrics, setLoadingLyrics] = useState(false);
  const lyricsScrollRef = useRef(null);
  const lastLyricsSongId = useRef(null);

  // ── Lock body scroll when player is open ───────────────────────────────
  useEffect(() => {
    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = originalOverflow;
    };
  }, []);

  // ── Swipe gestures (only active in player tab, not queue) ────────────
  const touchStart = useRef(null);
  const onTouchStart = e => {
    if (tab === 'queue' || tab === 'related') return; // let queue/related scroll freely
    touchStart.current = { x: e.touches[0].clientX, y: e.touches[0].clientY };
  };
  const onTouchEnd = e => {
    if (tab === 'queue' || tab === 'related' || !touchStart.current) return;
    const dx = e.changedTouches[0].clientX - touchStart.current.x;
    const dy = e.changedTouches[0].clientY - touchStart.current.y;
    touchStart.current = null;
    if (Math.abs(dy) > Math.abs(dx)) {
      if (dy > 80) onClose();        // swipe down → close
    } else {
      if (dx < -60) onNext();         // swipe left → next
      if (dx > 60) onPrev();          // swipe right → prev
    }
  };

  // ── Album art pop animation on song change ───────────────────────────────
  const [artKey, setArtKey] = useState(0);
  const prevId = useRef(song?.id);
  useEffect(() => {
    if (song?.id !== prevId.current) { setArtKey(k => k + 1); prevId.current = song?.id; }
  }, [song?.id]);

  // ── Fetch "You might like" suggestions (queue tab) ──────────────────────
  useEffect(() => {
    if (!song?.id || song.id === lastFetchedId.current) return;
    lastFetchedId.current = song.id;

    setSuggestions([]);
    setLoadingSuggestions(true);

    const artistName = song.artist?.split(',')[0]?.trim();
    if (!artistName) { setLoadingSuggestions(false); return; }

    searchSongs(artistName, 10)
      .then(results => {
        const queueIds = new Set(queue.map(s => s.id));
        const filtered = results
          .filter(s => s.id !== song.id && !queueIds.has(s.id))
          .slice(0, 6);
        setSuggestions(filtered);
      })
      .catch(() => setSuggestions([]))
      .finally(() => setLoadingSuggestions(false));
  }, [song?.id]);

  // ── Fetch Related tab — only when tab is open (lazy) ─────────────────────
  useEffect(() => {
    if (tab !== 'related') return;
    if (!song?.id || song.id === lastRelatedId.current) return;
    lastRelatedId.current = song.id;

    setRelated([]);
    setLoadingRelated(true);

    const artistName = song.artist?.split(',')[0]?.trim();
    if (!artistName) { setLoadingRelated(false); return; }

    searchSongs(artistName, 15)
      .then(results => {
        const filtered = results
          .filter(s => s.id !== song.id)
          .slice(0, 12);
        setRelated(filtered);
      })
      .catch(() => setRelated([]))
      .finally(() => setLoadingRelated(false));
  }, [tab, song?.id]);

  // ── Fetch Lyrics — only when tab is open ───────────────────────────────
  useEffect(() => {
    if (tab !== 'lyrics') return;
    if (!song?.id || song.source !== 'jiosaavn') { setLyrics([]); return; }
    if (song.id === lastLyricsSongId.current) return;
    lastLyricsSongId.current = song.id;

    setLyrics([]);
    setLoadingLyrics(true);
    getLyrics(song.id)
      .then(lines => setLyrics(lines || []))
      .catch(() => setLyrics([]))
      .finally(() => setLoadingLyrics(false));
  }, [tab, song?.id]);

  const effDuration = duration > 0 ? duration : (song?.duration || 0);
  const pct = effDuration > 0 ? (position / effDuration) * 100 : 0;
  const effectiveVol = isMuted ? 0 : volume;

  return (
    <div
      className="slide-up"
      style={{ position: 'fixed', inset: 0, zIndex: 100, display: 'flex', flexDirection: 'column', maxWidth: 430, margin: '0 auto', overflow: 'hidden', background: '#000' }}
      onTouchStart={onTouchStart}
      onTouchEnd={onTouchEnd}
    >
      {/* ── Animated blurred album background ─────────────────────────── */}
      <Background cover={song.cover} artKey={artKey} />

      {/* ── Content ───────────────────────────────────────────────────── */}
      <div style={{ position: 'relative', zIndex: 1, display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0, padding: '0 24px', paddingBottom: 'max(28px, env(safe-area-inset-bottom))' }}>

        {/* Drag handle */}
        <div style={{ display: 'flex', justifyContent: 'center', padding: '12px 0 8px' }}>
          <div style={{ width: 36, height: 4, borderRadius: 2, background: 'rgba(255,255,255,0.25)' }} />
        </div>

        {/* Top bar */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
          {/* Close button */}
          <button onClick={onClose} style={ctrl}>
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.8)" strokeWidth="2.5" strokeLinecap="round">
              <path d="M19 9l-7 7-7-7" />
            </svg>
          </button>

          {/* Tab pills — center */}
          <div style={{ display: 'flex', gap: 4, background: 'rgba(255,255,255,0.08)', borderRadius: 20, padding: 3 }}>
            {['player', 'queue', 'related', 'lyrics'].map(t => (
              <button
                key={t}
                onClick={() => setTab(t)}
                style={{
                  padding: '5px 12px',
                  borderRadius: 16,
                  border: 'none',
                  cursor: 'pointer',
                  fontFamily: 'inherit',
                  fontSize: 12,
                  fontWeight: 600,
                  background: tab === t ? 'rgba(255,255,255,0.15)' : 'transparent',
                  color: tab === t ? '#fff' : 'rgba(255,255,255,0.4)',
                  transition: 'background 0.2s, color 0.2s',
                  whiteSpace: 'nowrap',
                }}
              >
                {t === 'player' ? 'Player' : t === 'queue' ? 'Queue' : t === 'related' ? 'Related' : '🎤'}
              </button>
            ))}
          </div>

          {/* Spacer (balance) */}
          <div style={{ width: 38 }} />
        </div>

        {tab === 'player' ? (
          <>
            {/* ── Album art ── */}
            <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 'min(3vh, 20px)', minHeight: 0 }}>
              <div
                key={artKey}
                style={{
                  height: '100%', maxHeight: 300, maxWidth: '100%', aspectRatio: '1',
                  borderRadius: 16, overflow: 'hidden',
                  boxShadow: isPlaying
                    ? '0 32px 80px rgba(0,0,0,0.8), 0 0 60px rgba(29,185,84,0.12)'
                    : '0 20px 50px rgba(0,0,0,0.7)',
                  transform: isPlaying ? 'scale(1)' : 'scale(0.88)',
                  transition: 'transform 0.45s cubic-bezier(0.34, 1.56, 0.64, 1), box-shadow 0.45s ease',
                  animation: 'artPop 0.45s cubic-bezier(0.34,1.56,0.64,1) both',
                }}
              >
                <img
                  src={song.cover?.replace('150x150', '500x500') || song.cover} alt=""
                  style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                  onError={e => e.target.style.background = '#333'}
                />
              </div>
            </div>

            {/* Song info + like */}
            <div style={{ display: 'flex', alignItems: 'center', marginBottom: 'min(2.5vh, 18px)' }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 21, fontWeight: 800, color: '#fff', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', marginBottom: 4 }}>{song.title}</div>
                <div
                  onClick={(e) => { e.stopPropagation(); navigate(`/artist/${encodeURIComponent(song.artist?.split(',')[0]?.trim())}`); onClose(); }}
                  style={{ fontSize: 14, color: 'rgba(255,255,255,0.55)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', cursor: 'pointer' }}
                >
                  {song.artist}
                </div>
              </div>
              <button
                onClick={() => toggleLike(song)}
                style={{ ...ctrl, marginLeft: 12, transition: 'transform 0.2s' }}
                onMouseDown={e => e.currentTarget.style.transform = 'scale(0.8)'}
                onMouseUp={e => e.currentTarget.style.transform = 'scale(1)'}
                onTouchStart={e => e.currentTarget.style.transform = 'scale(0.8)'}
                onTouchEnd={e => e.currentTarget.style.transform = 'scale(1)'}
              >
                <svg width="26" height="26" viewBox="0 0 24 24"
                  fill={isLiked ? '#1DB954' : 'none'}
                  stroke={isLiked ? '#1DB954' : 'rgba(255,255,255,0.55)'}
                  strokeWidth="2"
                  style={{ transition: 'fill 0.2s, stroke 0.2s' }}
                >
                  <path d="M20.84 4.61a5.5 5.5 0 00-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 00-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 000-7.78z" />
                </svg>
              </button>
            </div>

            {/* Seekbar */}
            <SeekBar pct={pct} position={position} duration={duration || song?.duration || 0} onSeek={onSeek} />

            {/* Playback controls */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 'min(3vh, 24px)' }}>
              <button onClick={onToggleShuffle} style={{ ...ctrl, position: 'relative' }}>
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none"
                  stroke={shuffle ? '#1DB954' : 'rgba(255,255,255,0.55)'}
                  strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="16 3 21 3 21 8" /><line x1="4" y1="20" x2="21" y2="3" />
                  <polyline points="21 16 21 21 16 21" /><line x1="15" y1="15" x2="21" y2="21" />
                </svg>
                {shuffle && <div style={{ position: 'absolute', bottom: 2, width: 4, height: 4, borderRadius: '50%', background: '#1DB954' }} />}
              </button>

              <button onClick={onPrev} style={ctrl}>
                <svg width="34" height="34" viewBox="0 0 24 24" fill="rgba(255,255,255,0.9)">
                  <path d="M6 6h2v12H6zm3.5 6l8.5 6V6z" />
                </svg>
              </button>

              {/* Play/pause — glassmorphism circle */}
              <button
                onClick={onPlayPause}
                style={{
                  width: 68, height: 68, borderRadius: '50%',
                  background: '#fff',
                  border: 'none', padding: 0, cursor: 'pointer',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  boxShadow: '0 8px 32px rgba(0,0,0,0.5)',
                  flexShrink: 0,
                  transition: 'transform 0.15s, box-shadow 0.15s',
                }}
                onMouseDown={e => e.currentTarget.style.transform = 'scale(0.92)'}
                onMouseUp={e => e.currentTarget.style.transform = 'scale(1)'}
                onTouchStart={e => e.currentTarget.style.transform = 'scale(0.92)'}
                onTouchEnd={e => e.currentTarget.style.transform = 'scale(1)'}
              >
                {isLoading
                  ? <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#000" strokeWidth="2.5" strokeLinecap="round" style={{ animation: 'spin 0.8s linear infinite' }}><circle cx="12" cy="12" r="10" stroke="rgba(0,0,0,0.15)" /><path d="M12 2a10 10 0 0 1 10 10" /></svg>
                  : isPlaying
                    ? <svg width="28" height="28" viewBox="0 0 24 24" fill="#000"><rect x="6" y="4" width="4" height="16" /><rect x="14" y="4" width="4" height="16" /></svg>
                    : <svg width="28" height="28" viewBox="0 0 24 24" fill="#000"><polygon points="6,3 20,12 6,21" /></svg>
                }
              </button>

              <button onClick={onNext} style={ctrl}>
                <svg width="34" height="34" viewBox="0 0 24 24" fill="rgba(255,255,255,0.9)">
                  <path d="M6 18l8.5-6L6 6v12zM16 6v12h2V6h-2z" />
                </svg>
              </button>

              <button onClick={onCycleRepeat} style={{ ...ctrl, position: 'relative' }}>
                {repeatMode === 'one'
                  ? <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#1DB954" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="17 1 21 5 17 9" /><path d="M3 11V9a4 4 0 014-4h14" />
                    <polyline points="7 23 3 19 7 15" /><path d="M21 13v2a4 4 0 01-4 4H3" />
                    <text x="12" y="13" fontSize="5" fill="#1DB954" stroke="none" textAnchor="middle" dominantBaseline="middle" fontWeight="900">1</text>
                  </svg>
                  : <svg width="22" height="22" viewBox="0 0 24 24" fill="none"
                    stroke={repeatMode === 'all' ? '#1DB954' : 'rgba(255,255,255,0.55)'}
                    strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="17 1 21 5 17 9" /><path d="M3 11V9a4 4 0 014-4h14" />
                    <polyline points="7 23 3 19 7 15" /><path d="M21 13v2a4 4 0 01-4 4H3" />
                  </svg>
                }
                {repeatMode !== 'off' && <div style={{ position: 'absolute', bottom: 2, width: 4, height: 4, borderRadius: '50%', background: '#1DB954' }} />}
              </button>
            </div>

            {/* Advanced Controls Row (A-B Loop & Speed) */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 'min(3vh, 20px)' }}>
              
              {/* A-B Loop Segment */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <button
                  onClick={() => { if (abLoop.active) resetAbLoop(); else setAbPoint('auto'); }}
                  style={{
                    padding: '5px 12px', borderRadius: 20, border: 'none',
                    background: abLoop.active ? 'rgba(29,185,84,0.15)' : abLoop.a !== null ? 'rgba(255,165,0,0.15)' : 'rgba(255,255,255,0.06)',
                    color: abLoop.active ? '#1DB954' : abLoop.a !== null ? '#FFA500' : 'rgba(255,255,255,0.6)',
                    fontSize: 11, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit',
                    transition: 'all 0.2s', border: abLoop.active ? '1px solid rgba(29,185,84,0.3)' : abLoop.a !== null ? '1px solid rgba(255,165,0,0.3)' : '1px solid transparent',
                  }}
                >
                  {abLoop.active ? '⟳ A-B ON' : abLoop.a !== null ? '● Set B' : 'A-B Loop'}
                </button>
                
                {(abLoop.a !== null || abLoop.active) && (
                  <span style={{ fontSize: 10, color: 'rgba(255,255,255,0.4)', fontFamily: 'monospace', letterSpacing: 0.5 }}>
                    {abLoop.a !== null ? fmt(abLoop.a) : '--'} - {abLoop.b !== null ? fmt(abLoop.b) : '--'}
                  </span>
                )}
                
                {abLoop.active && (
                  <button onClick={resetAbLoop} style={{ background: 'none', border: 'none', color: 'rgba(255,255,255,0.3)', cursor: 'pointer', padding: '0 4px', fontSize: 14 }}>✕</button>
                )}
              </div>

              {/* Speed Segmented Control */}
              <div style={{ display: 'flex', background: 'rgba(255,255,255,0.06)', borderRadius: 20, padding: 3 }}>
                {[0.75, 1.0, 1.25, 1.5].map(rate => (
                  <button
                    key={rate}
                    onClick={() => setPlaybackRate(rate)}
                    style={{
                      padding: '4px 10px', borderRadius: 16, border: 'none',
                      background: playbackRate === rate ? 'rgba(255,255,255,0.15)' : 'transparent',
                      color: playbackRate === rate ? '#fff' : 'rgba(255,255,255,0.4)',
                      fontSize: 11, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit',
                      transition: 'all 0.2s',
                    }}
                  >
                    {rate}x
                  </button>
                ))}
              </div>
            </div>

            {/* Volume */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
              <button onClick={onToggleMute} style={ctrl}>
                {isMuted || volume === 0
                  ? <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.4)" strokeWidth="2" strokeLinecap="round"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" /><line x1="23" y1="9" x2="17" y2="15" /><line x1="17" y1="9" x2="23" y2="15" /></svg>
                  : <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.4)" strokeWidth="2" strokeLinecap="round"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" /><path d="M15.54 8.46a5 5 0 010 7.07" /></svg>
                }
              </button>
              {/* Slim volume track — same pattern as seekbar */}
              <div
                style={{ flex: 1, padding: '12px 0', margin: '-12px 0', cursor: 'pointer', boxSizing: 'content-box', position: 'relative' }}
                onClick={e => { const r = e.currentTarget.getBoundingClientRect(); onVolumeChange(Math.max(0, Math.min(1, (e.clientX - r.left) / r.width))); }}
              >
                <div style={{ height: 3, background: 'rgba(255,255,255,0.18)', borderRadius: 99 }}>
                  <div style={{ height: '100%', width: `${effectiveVol * 100}%`, background: 'rgba(255,255,255,0.75)', borderRadius: 99 }} />
                </div>
              </div>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.4)" strokeWidth="2" strokeLinecap="round">
                <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" /><path d="M15.54 8.46a5 5 0 010 7.07" /><path d="M19.07 4.93a10 10 0 010 14.14" />
              </svg>
            </div>

            {/* Swipe hint */}
            <div style={{ textAlign: 'center', marginTop: 6, fontSize: 11, color: 'rgba(255,255,255,0.2)', letterSpacing: 0.5 }}>
              swipe ← → to skip · swipe ↓ to close
            </div>
          </>
        ) : tab === 'queue' ? (
          /* ── Queue view ── */
          <div style={{ flex: 1, overflowY: 'auto', overscrollBehavior: 'contain', WebkitOverflowScrolling: 'touch', marginBottom: 16 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: 'rgba(255,255,255,0.4)', letterSpacing: 1, textTransform: 'uppercase' }}>
                Next in queue
              </div>
              <button
                onClick={toggleSmartQueue}
                style={{
                  display: 'flex', alignItems: 'center', gap: 6,
                  background: smartQueueEnabled ? 'rgba(29,185,84,0.15)' : 'rgba(255,255,255,0.06)',
                  border: smartQueueEnabled ? '1px solid rgba(29,185,84,0.3)' : '1px solid rgba(255,255,255,0.1)',
                  borderRadius: 12, padding: '4px 10px',
                  cursor: 'pointer', fontFamily: 'inherit',
                  fontSize: 11, fontWeight: 600,
                  color: smartQueueEnabled ? '#1DB954' : 'rgba(255,255,255,0.4)',
                  transition: 'all 0.2s',
                }}
              >
                <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M12 3v10.55c-.59-.34-1.27-.55-2-.55-2.21 0-4 1.79-4 4s1.79 4 4 4 4-1.79 4-4V7h4V3h-6z"/>
                </svg>
                Auto-radio {smartQueueEnabled ? 'on' : 'off'}
              </button>
            </div>
            {queue.map((item, i) => {
              const isCur = i === queueIndex;
              return (
                <button key={`${item.id}-${i}`} onClick={() => onJumpToQueue?.(i)}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 12, width: '100%',
                    background: isCur ? 'rgba(29,185,84,0.12)' : 'rgba(255,255,255,0.03)',
                    border: isCur ? '1px solid rgba(29,185,84,0.25)' : '1px solid transparent',
                    borderRadius: 12, cursor: 'pointer', padding: '10px 12px',
                    textAlign: 'left', marginBottom: 6, transition: 'background 0.15s',
                  }}>
                  <img src={item.cover} alt="" style={{ width: 44, height: 44, borderRadius: 8, objectFit: 'cover', flexShrink: 0 }} onError={e => e.target.style.background = '#333'} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 14, fontWeight: 600, color: isCur ? '#1DB954' : '#fff', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{item.title}</div>
                    <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.45)' }}>{item.artist}</div>
                  </div>
                  {isCur && isPlaying && <div style={{ display: 'flex', alignItems: 'flex-end', gap: 2, height: 16 }}><span className="eq-bar" /><span className="eq-bar" /><span className="eq-bar" /></div>}
                </button>
              );
            })}

            {/* ── You might like (suggestions) ── */}
            {(loadingSuggestions || suggestions.length > 0) && (
              <div style={{ marginTop: 20 }}>
                <div style={{ fontSize: 12, fontWeight: 700, color: 'rgba(255,255,255,0.4)', marginBottom: 12, letterSpacing: 1, textTransform: 'uppercase' }}>
                  You might like
                </div>
                {loadingSuggestions ? (
                  [1,2,3].map(i => (
                    <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 6, padding: '10px 12px', borderRadius: 12, background: 'rgba(255,255,255,0.03)' }}>
                      <div style={{ width: 44, height: 44, borderRadius: 8, background: 'rgba(255,255,255,0.08)', flexShrink: 0, animation: 'shimmer 1.4s ease-in-out infinite' }} />
                      <div style={{ flex: 1 }}>
                        <div style={{ height: 12, borderRadius: 6, background: 'rgba(255,255,255,0.08)', marginBottom: 6, width: '70%', animation: 'shimmer 1.4s ease-in-out infinite' }} />
                        <div style={{ height: 10, borderRadius: 6, background: 'rgba(255,255,255,0.05)', width: '45%', animation: 'shimmer 1.4s ease-in-out infinite' }} />
                      </div>
                    </div>
                  ))
                ) : (
                  suggestions.map(item => (
                    <button
                      key={item.id}
                      onClick={() => onPlaySuggestion?.(item)}
                      style={{
                        display: 'flex', alignItems: 'center', gap: 12, width: '100%',
                        background: 'rgba(255,255,255,0.03)',
                        border: '1px solid transparent',
                        borderRadius: 12, cursor: 'pointer', padding: '10px 12px',
                        textAlign: 'left', marginBottom: 6,
                        transition: 'background 0.15s',
                        fontFamily: 'inherit',
                      }}
                      onMouseOver={e => e.currentTarget.style.background = 'rgba(255,255,255,0.07)'}
                      onMouseOut={e => e.currentTarget.style.background = 'rgba(255,255,255,0.03)'}
                    >
                      <img src={item.cover} alt="" style={{ width: 44, height: 44, borderRadius: 8, objectFit: 'cover', flexShrink: 0 }} onError={e => e.target.style.background = '#333'} />
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: 14, fontWeight: 600, color: '#fff', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{item.title}</div>
                        <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.45)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{item.artist}</div>
                      </div>
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="rgba(255,255,255,0.3)">
                        <polygon points="5,3 19,12 5,21" />
                      </svg>
                    </button>
                  ))
                )}
              </div>
            )}
          </div>

        ) : tab === 'related' ? (
          /* ── Related view ── */
          <div style={{ flex: 1, overflowY: 'auto', overscrollBehavior: 'contain', WebkitOverflowScrolling: 'touch', marginBottom: 16 }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: 'rgba(255,255,255,0.4)', marginBottom: 12, letterSpacing: 1, textTransform: 'uppercase' }}>
              Related · {song?.artist?.split(',')[0]}
            </div>

            {loadingRelated ? (
              [1,2,3,4,5].map(i => (
                <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 6, padding: '10px 12px', borderRadius: 12, background: 'rgba(255,255,255,0.03)' }}>
                  <div style={{ width: 44, height: 44, borderRadius: 8, background: 'rgba(255,255,255,0.08)', flexShrink: 0, animation: 'shimmer 1.4s ease-in-out infinite' }} />
                  <div style={{ flex: 1 }}>
                    <div style={{ height: 12, borderRadius: 6, background: 'rgba(255,255,255,0.08)', marginBottom: 6, width: '70%', animation: 'shimmer 1.4s ease-in-out infinite' }} />
                    <div style={{ height: 10, borderRadius: 6, background: 'rgba(255,255,255,0.05)', width: '45%', animation: 'shimmer 1.4s ease-in-out infinite' }} />
                  </div>
                </div>
              ))
            ) : related.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '40px 0', color: 'rgba(255,255,255,0.3)', fontSize: 13 }}>
                No related songs found
              </div>
            ) : (
              related.map(item => (
                <button
                  key={item.id}
                  onClick={() => onPlaySuggestion?.(item)}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 12, width: '100%',
                    background: 'rgba(255,255,255,0.03)',
                    border: '1px solid transparent',
                    borderRadius: 12, cursor: 'pointer', padding: '10px 12px',
                    textAlign: 'left', marginBottom: 6,
                    transition: 'background 0.15s',
                    fontFamily: 'inherit',
                  }}
                  onMouseOver={e => e.currentTarget.style.background = 'rgba(255,255,255,0.07)'}
                  onMouseOut={e => e.currentTarget.style.background = 'rgba(255,255,255,0.03)'}
                >
                  <img src={item.cover} alt="" style={{ width: 44, height: 44, borderRadius: 8, objectFit: 'cover', flexShrink: 0 }} onError={e => e.target.style.background = '#333'} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 14, fontWeight: 600, color: '#fff', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{item.title}</div>
                    <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.45)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{item.artist}</div>
                  </div>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="rgba(255,255,255,0.25)">
                    <polygon points="5,3 19,12 5,21" />
                  </svg>
                </button>
              ))
            )}
          </div>
        ) : tab === 'lyrics' ? (
          /* ── Lyrics view ── */
          <div
            ref={lyricsScrollRef}
            style={{ flex: 1, overflowY: 'auto', overscrollBehavior: 'contain', padding: '0 4px 20px', WebkitOverflowScrolling: 'touch', marginBottom: 16 }}
          >
            {loadingLyrics ? (
              <div style={{ textAlign: 'center', padding: '60px 0', color: 'rgba(255,255,255,0.3)' }}>
                <div style={{ width: 24, height: 24, borderRadius: '50%', border: '2px solid rgba(255,255,255,0.1)', borderTop: '2px solid #1DB954', animation: 'spin 0.8s linear infinite', margin: '0 auto 12px' }} />
                Loading lyrics...
              </div>
            ) : lyrics.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '60px 0', color: 'rgba(255,255,255,0.25)', fontSize: 14 }}>
                No lyrics available for this song
              </div>
            ) : (
              <LyricsView lines={lyrics} position={position} duration={duration || song?.duration} scrollRef={lyricsScrollRef} />
            )}
          </div>
        ) : null}
      </div>

      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
        @keyframes bgFadeIn { from { opacity: 0; transform: translate(-14%,-14%) scale(1.05); } to { opacity: 1; transform: translate(-14%,-14%) scale(1); } }
        @keyframes artPop { from { opacity: 0; transform: scale(0.82); } to { opacity: 1; } }
        @keyframes shimmer { 0%,100% { opacity: 0.4; } 50% { opacity: 1; } }
      `}</style>
    </div>
  );
}

function SeekBar({ pct, position, duration, onSeek }) {
  const ref = useRef(null);
  const [dragging, setDragging] = useState(false);
  const [hoverPct, setHoverPct] = useState(null);

  const calcPct = (clientX) => {
    const r = ref.current?.getBoundingClientRect();
    if (!r || !duration) return 0;
    return Math.max(0, Math.min(1, (clientX - r.left) / r.width));
  };

  const displayPct = hoverPct !== null ? hoverPct * 100 : pct;
  const showThumb = hoverPct !== null || dragging;

  return (
    <div style={{ marginBottom: 'min(2.5vh, 18px)' }}>
      {/* Invisible large hit area wrapping a slim visual bar */}
      <div
        ref={ref}
        onClick={e => onSeek(calcPct(e.clientX) * duration)}
        onMouseMove={e => setHoverPct(calcPct(e.clientX))}
        onMouseLeave={() => { if (!dragging) setHoverPct(null); }}
        onMouseDown={e => {
          setDragging(true);
          const move = ev => { setHoverPct(calcPct(ev.clientX)); onSeek(calcPct(ev.clientX) * duration); };
          const up = () => { setDragging(false); setHoverPct(null); window.removeEventListener('mousemove', move); window.removeEventListener('mouseup', up); };
          window.addEventListener('mousemove', move);
          window.addEventListener('mouseup', up);
        }}
        onTouchStart={e => {
          setDragging(true);
          const move = ev => { const p = calcPct(ev.touches[0].clientX); setHoverPct(p); onSeek(p * duration); };
          const end = () => { setDragging(false); setHoverPct(null); window.removeEventListener('touchmove', move); window.removeEventListener('touchend', end); };
          window.addEventListener('touchmove', move, { passive: true });
          window.addEventListener('touchend', end);
        }}
        style={{ padding: '14px 0', margin: '-14px 0', cursor: 'pointer', boxSizing: 'content-box', position: 'relative' }}
      >
        {/* Slim visual track — always just 3px tall */}
        <div style={{ height: 3, background: 'rgba(255,255,255,0.18)', borderRadius: 99, position: 'relative', overflow: 'visible' }}>
          {/* Filled portion */}
          <div style={{
            height: '100%',
            width: `${displayPct}%`,
            background: showThumb ? '#fff' : 'rgba(255,255,255,0.8)',
            borderRadius: 99,
            transition: dragging ? 'none' : 'width 0.1s linear',
            position: 'relative',
          }}>
            {/* Scrubber thumb */}
            <div style={{
              position: 'absolute', right: -6, top: '50%',
              transform: 'translateY(-50%)',
              width: 13, height: 13, borderRadius: '50%',
              background: '#fff',
              boxShadow: '0 1px 4px rgba(0,0,0,0.5)',
              opacity: showThumb ? 1 : 0,
              transition: 'opacity 0.15s',
              pointerEvents: 'none',
            }} />
          </div>
        </div>
      </div>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 6 }}>
        <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.35)' }}>{fmt(position)}</span>
        <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.35)' }}>{fmt(duration)}</span>
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

/* Memoized blurred background — only re-renders on song change, not position ticks */
const Background = memo(function Background({ cover, artKey }) {
  return (
    <div style={{ position: 'absolute', inset: 0, zIndex: 0, overflow: 'hidden', background: '#000' }}>
      <img
        key={artKey}
        src={cover}
        alt=""
        style={{
          width: '140%', height: '140%',
          objectFit: 'cover',
          filter: 'blur(60px) saturate(2) brightness(0.35)',
          transform: 'translate(-14%, -14%)',
          animation: 'bgFadeIn 0.8s ease both',
        }}
        onError={() => {}}
      />
      {/* Deep vignette overlay */}
      <div style={{
        position: 'absolute', inset: 0,
        background: 'linear-gradient(to bottom, rgba(0,0,0,0.35) 0%, rgba(0,0,0,0.15) 40%, rgba(0,0,0,0.7) 80%, rgba(0,0,0,0.92) 100%)',
      }} />
    </div>
  );
});
