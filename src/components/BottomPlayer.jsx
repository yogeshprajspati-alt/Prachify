import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { usePlayer } from '../hooks/usePlayer';
import FullscreenPlayer from './FullscreenPlayer';
import usePlayerStore from '../store/playerStore';
import MiniLyrics from './MiniLyrics';

export default function BottomPlayer() {
  const navigate = useNavigate();
  const { currentSong, isPlaying, isLoading, position, duration, queue, queueIndex, togglePlay, next, prev, seekTo, volume, isMuted, setVolume, toggleMute, jumpToQueueSong, playSong } = usePlayer();
  const shuffle = usePlayerStore(s => s.shuffle);
  const repeatMode = usePlayerStore(s => s.repeatMode);
  const toggleShuffle = usePlayerStore(s => s.toggleShuffle);
  const cycleRepeat = usePlayerStore(s => s.cycleRepeat);
  const likedSongs = usePlayerStore(s => s.likedSongs);
  const toggleLike = usePlayerStore(s => s.toggleLike);
  const [expanded, setExpanded] = useState(false);

  if (!currentSong) return null;

  const effDuration = duration > 0 ? duration : (currentSong?.duration || 0);
  const pct = effDuration > 0 ? (position / effDuration) * 100 : 0;
  const isLiked = likedSongs.includes(currentSong.id);

  return (
    <>
      <MiniLyrics song={currentSong} position={position} />
      {/* ── Mini player ────────────────────────────────────────────────── */}
      <div style={{
        position: 'fixed', bottom: 56, left: '50%', transform: 'translateX(-50%)',
        width: 'calc(100% - 16px)', maxWidth: 414,
        zIndex: 45,
      }}>
        {/* Glassmorphism card */}
        <div style={{
          background: 'rgba(30,30,30,0.82)',
          backdropFilter: 'blur(24px)',
          WebkitBackdropFilter: 'blur(24px)',
          borderRadius: '16px',
          border: '1px solid rgba(255,255,255,0.08)',
          overflow: 'hidden',
          boxShadow: '0 8px 32px rgba(0,0,0,0.55)',
        }}>
          {/* Progress bar — scaleX instead of width for GPU-composited animation */}
          <div style={{ height: 2, background: 'rgba(255,255,255,0.08)', overflow: 'hidden' }}>
            <div style={{ height: '100%', background: '#1DB954', width: '100%', transform: `scaleX(${pct / 100})`, transformOrigin: 'left', transition: 'transform 0.2s linear', borderRadius: 1 }} />
          </div>

          {/* Row */}
          <div
            style={{ display: 'flex', alignItems: 'center', padding: '10px 14px', gap: 12, cursor: 'pointer' }}
            onClick={() => setExpanded(true)}
          >
            {/* Album art with subtle pulse when playing */}
            <div style={{
              flexShrink: 0, borderRadius: 10, overflow: 'hidden',
              width: 44, height: 44,
              boxShadow: isPlaying ? '0 0 14px rgba(29,185,84,0.3)' : '0 2px 8px rgba(0,0,0,0.4)',
              transition: 'box-shadow 0.4s ease',
              animation: isPlaying ? 'miniPulse 3s ease-in-out infinite' : 'none',
            }}>
              <img
                src={currentSong.cover} alt=""
                style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                decoding="async"
                onError={e => e.target.style.background = '#333'}
              />
            </div>

            {/* Info */}
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: '#fff', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{currentSong.title}</div>
              <div
                onClick={(e) => { e.stopPropagation(); navigate(`/artist/${encodeURIComponent(currentSong.artist?.split(',')[0]?.trim())}`); setExpanded(false); }}
                style={{ fontSize: 11, color: 'rgba(255,255,255,0.5)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', cursor: 'pointer' }}
              >
                {currentSong.artist}
              </div>
            </div>

            {/* Controls */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 2 }} onClick={e => e.stopPropagation()}>
              <button onClick={() => toggleLike(currentSong)} style={miniBtn}>
                <svg width="20" height="20" viewBox="0 0 24 24"
                  fill={isLiked ? '#1DB954' : 'none'}
                  stroke={isLiked ? '#1DB954' : 'rgba(255,255,255,0.5)'}
                  strokeWidth="2"
                  style={{ transition: 'fill 0.2s' }}
                >
                  <path d="M20.84 4.61a5.5 5.5 0 00-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 00-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 000-7.78z" />
                </svg>
              </button>
              <button onClick={togglePlay} style={{ ...miniBtn, padding: 0, width: 34, height: 34 }}>
                {isLoading
                  ? <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.5" strokeLinecap="round" style={{ animation: 'spin 0.8s linear infinite' }}><circle cx="12" cy="12" r="10" stroke="rgba(255,255,255,0.2)" /><path d="M12 2a10 10 0 0 1 10 10" /></svg>
                  : isPlaying
                    ? <svg width="26" height="26" viewBox="0 0 24 24" fill="#fff"><rect x="6" y="4" width="4" height="16" /><rect x="14" y="4" width="4" height="16" /></svg>
                    : <svg width="26" height="26" viewBox="0 0 24 24" fill="#fff"><polygon points="5,3 19,12 5,21" /></svg>
                }
              </button>
              <button onClick={next} style={miniBtn}>
                <svg width="22" height="22" viewBox="0 0 24 24" fill="rgba(255,255,255,0.7)">
                  <path d="M6 18l8.5-6L6 6v12zM16 6v12h2V6h-2z" />
                </svg>
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* ── Fullscreen ───────────────────────────────────────────────────── */}
      {expanded && (
        <FullscreenPlayer
          song={currentSong} isPlaying={isPlaying} isLoading={isLoading}
          position={position} duration={duration} queue={queue} queueIndex={queueIndex}
          onClose={() => setExpanded(false)} onPlayPause={togglePlay}
          onNext={next} onPrev={prev} onSeek={seekTo} onJumpToQueue={jumpToQueueSong}
          volume={volume} isMuted={isMuted} onVolumeChange={setVolume} onToggleMute={toggleMute}
          shuffle={shuffle} repeatMode={repeatMode}
          onToggleShuffle={toggleShuffle} onCycleRepeat={cycleRepeat}
          onPlaySuggestion={(song) => playSong(song)}
        />
      )}

      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
        @keyframes miniPulse {
          0%, 100% { box-shadow: 0 0 10px rgba(29,185,84,0.2); }
          50% { box-shadow: 0 0 20px rgba(29,185,84,0.45); }
        }
      `}</style>
    </>
  );
}

const miniBtn = {
  background: 'none', border: 'none', cursor: 'pointer',
  display: 'flex', alignItems: 'center', justifyContent: 'center',
  padding: 7, borderRadius: '50%', WebkitTapHighlightColor: 'transparent',
};
