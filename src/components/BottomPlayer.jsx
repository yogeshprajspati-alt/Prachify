import React, { useState } from 'react';
import { usePlayer } from '../hooks/usePlayer';
import FullscreenPlayer from './FullscreenPlayer';
import usePlayerStore from '../store/playerStore';

export default function BottomPlayer() {
  const { currentSong, isPlaying, isLoading, position, duration, queue, queueIndex, togglePlay, next, prev, seekTo, volume, isMuted, setVolume, toggleMute, jumpToQueueSong } = usePlayer();
  const shuffle = usePlayerStore(s => s.shuffle);
  const repeatMode = usePlayerStore(s => s.repeatMode);
  const toggleShuffle = usePlayerStore(s => s.toggleShuffle);
  const cycleRepeat = usePlayerStore(s => s.cycleRepeat);
  const likedSongs = usePlayerStore(s => s.likedSongs);
  const toggleLike = usePlayerStore(s => s.toggleLike);
  const [expanded, setExpanded] = useState(false);

  if (!currentSong) return null;

  const pct = duration > 0 ? (position / duration) * 100 : 0;
  const isLiked = likedSongs.includes(currentSong.id);

  return (
    <>
      {/* Mini player — sits just above the nav bar */}
      <div
        style={{
          position: 'fixed', bottom: 56, left: '50%', transform: 'translateX(-50%)',
          width: 'calc(100% - 0px)', maxWidth: 430,
          background: '#282828',
          zIndex: 45,
        }}
      >
        {/* Thin progress bar on top */}
        <div style={{ height: 2, background: '#535353', position: 'relative' }}>
          <div style={{ position: 'absolute', top: 0, left: 0, height: '100%', background: '#1DB954', width: `${pct}%`, transition: 'width 0.1s linear' }} />
        </div>

        {/* Content */}
        <div
          style={{ display: 'flex', alignItems: 'center', padding: '8px 12px', gap: 10, cursor: 'pointer' }}
          onClick={() => setExpanded(true)}
        >
          {/* Art */}
          <img
            src={currentSong.cover}
            alt=""
            style={{ width: 44, height: 44, borderRadius: 4, objectFit: 'cover', flexShrink: 0 }}
            onError={e => e.target.style.background = '#333'}
          />
          {/* Info */}
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: '#fff', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{currentSong.title}</div>
            <div style={{ fontSize: 11, color: '#b3b3b3', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{currentSong.artist}</div>
          </div>
          {/* Controls */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 4 }} onClick={e => e.stopPropagation()}>
            <button onClick={() => toggleLike(currentSong)} style={ctrlBtn}>
              <svg width="22" height="22" viewBox="0 0 24 24" fill={isLiked ? '#1DB954' : 'none'} stroke={isLiked ? '#1DB954' : '#b3b3b3'} strokeWidth="2">
                <path d="M20.84 4.61a5.5 5.5 0 00-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 00-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 000-7.78z"/>
              </svg>
            </button>
            <button onClick={togglePlay} style={ctrlBtn}>
              {isLoading
                ? <div style={{ width: 22, height: 22, borderRadius: '50%', border: '2px solid #535353', borderTop: '2px solid #fff', animation: 'spin 0.8s linear infinite' }} />
                : isPlaying
                  ? <svg width="28" height="28" viewBox="0 0 24 24" fill="#fff"><rect x="6" y="4" width="4" height="16"/><rect x="14" y="4" width="4" height="16"/></svg>
                  : <svg width="28" height="28" viewBox="0 0 24 24" fill="#fff"><polygon points="5,3 19,12 5,21"/></svg>
              }
            </button>
            <button onClick={next} style={ctrlBtn}>
              <svg width="22" height="22" viewBox="0 0 24 24" fill="#b3b3b3">
                <path d="M6 18l8.5-6L6 6v12zM16 6v12h2V6h-2z"/>
              </svg>
            </button>
          </div>
        </div>
      </div>

      {/* Fullscreen */}
      {expanded && (
        <FullscreenPlayer
          song={currentSong} isPlaying={isPlaying} isLoading={isLoading}
          position={position} duration={duration} queue={queue} queueIndex={queueIndex}
          onClose={() => setExpanded(false)} onPlayPause={togglePlay}
          onNext={next} onPrev={prev} onSeek={seekTo} onJumpToQueue={jumpToQueueSong}
          volume={volume} isMuted={isMuted} onVolumeChange={setVolume} onToggleMute={toggleMute}
          shuffle={shuffle} repeatMode={repeatMode}
          onToggleShuffle={toggleShuffle} onCycleRepeat={cycleRepeat}
        />
      )}

      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </>
  );
}

const ctrlBtn = {
  background: 'none', border: 'none', cursor: 'pointer',
  display: 'flex', alignItems: 'center', justifyContent: 'center',
  padding: 6, borderRadius: '50%',
};
