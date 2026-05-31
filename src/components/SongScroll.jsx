import React, { memo } from 'react';

/* ── Horizontal song scroller ────────────────────────────────────── */
export function SongScroll({ songs, currentSong, isPlaying, onPlay }) {
  return (
    <div style={{ display: 'flex', gap: 12, overflowX: 'auto', padding: '0 16px 8px', scrollbarWidth: 'none' }}>
      {songs.map(song => (
        <SongCard key={song.id} song={song}
          isActive={currentSong?.id === song.id} isPlaying={isPlaying}
          onClick={() => onPlay(song)} />
      ))}
    </div>
  );
}

/* ── Skeleton loading shimmer ─────────────────────────────────────── */
export function SkeletonRow() {
  return (
    <div style={{ display: 'flex', gap: 12, padding: '0 16px 8px', overflowX: 'hidden' }}>
      {[1, 2, 3].map(i => (
        <div key={i} style={{ flexShrink: 0, width: 136 }}>
          <div className="shimmer" style={{ width: 136, height: 136, borderRadius: 10, background: 'rgba(255,255,255,0.06)', marginBottom: 8 }} />
          <div className="shimmer" style={{ height: 12, borderRadius: 6, background: 'rgba(255,255,255,0.06)', marginBottom: 6, width: '80%' }} />
          <div className="shimmer" style={{ height: 10, borderRadius: 6, background: 'rgba(255,255,255,0.04)', width: '55%' }} />
        </div>
      ))}
    </div>
  );
}

/* ── Song card — memoized to prevent re-renders on position ticks ── */
// TASK-08: React.memo — only re-renders when isActive/isPlaying/song changes
// TASK-04: loading="lazy" — off-screen artwork doesn't load until scrolled into view
// TASK-10: decoding="async" — image decode happens off main thread
export const SongCard = memo(function SongCard({ song, isActive, isPlaying, onClick }) {
  return (
    <button onClick={onClick} style={{ background: 'none', border: 'none', cursor: 'pointer', textAlign: 'left', flexShrink: 0, width: 136, fontFamily: 'inherit' }}>
      <div style={{ position: 'relative', width: 136, height: 136, borderRadius: 10, overflow: 'hidden', marginBottom: 8, background: '#282828' }}>
        <img src={song.cover} alt="" loading="lazy" decoding="async"
          style={{ width: '100%', height: '100%', objectFit: 'cover' }}
          onError={e => { e.target.style.display = 'none'; }} />
        {isActive && isPlaying && (
          <div style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'flex-end', justifyContent: 'center', paddingBottom: 8, gap: 2 }}>
            <span className="eq-bar" /><span className="eq-bar" /><span className="eq-bar" />
          </div>
        )}
      </div>
      <div style={{ fontSize: 13, fontWeight: 700, color: isActive ? '#1DB954' : '#fff', marginBottom: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{song.title}</div>
      <div style={{ fontSize: 11, color: '#888', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{song.artist}</div>
    </button>
  );
});
