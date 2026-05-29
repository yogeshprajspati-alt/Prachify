import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import usePlayerStore from '../store/playerStore';

export default function SongRow({ song, isActive, isPlaying, onClick, onAddToPlaylist }) {
  const navigate = useNavigate();
  const playNext = usePlayerStore(s => s.playNext);
  const [menuOpen, setMenuOpen] = useState(false);

  const formatTime = (secs) => {
    if (!secs || isNaN(secs)) return '—';
    const m = Math.floor(secs / 60);
    const s = Math.floor(secs % 60);
    return `${m}:${s < 10 ? '0' : ''}${s}`;
  };

  return (
    <div
      onClick={onClick}
      className={`flex items-center gap-3 px-3 py-2.5 rounded-md cursor-pointer transition-all duration-150 group ${
        isActive ? 'bg-white/10' : 'hover:bg-white/5'
      }`}
    >
      {/* Thumbnail */}
      <div className="relative w-10 h-10 rounded overflow-hidden bg-white/10 flex-shrink-0">
        <img
          src={song.cover}
          alt={song.title}
          className="w-full h-full object-cover"
          loading="lazy"
          onError={(e) => { e.target.style.display='none'; e.target.parentNode.style.background='#282828'; }}
        />
        {/* Play overlay on hover */}
        <div className={`absolute inset-0 bg-black/40 flex items-center justify-center transition-opacity ${isActive && isPlaying ? 'opacity-0' : 'opacity-0 group-hover:opacity-100'}`}>
          <svg viewBox="0 0 24 24" fill="white" className="w-4 h-4 ml-0.5">
            <path d="M8 5v14l11-7z"/>
          </svg>
        </div>
        {/* EQ bars for active */}
        {isActive && isPlaying && (
          <div className="absolute inset-0 bg-black/40 flex items-end justify-center pb-1 gap-[2px]">
            <span className="eq-bar w-[3px]"></span>
            <span className="eq-bar w-[3px]"></span>
            <span className="eq-bar w-[3px]"></span>
          </div>
        )}
      </div>

      {/* Title + artist */}
      <div className="min-w-0 flex-1">
        <h4 className={`text-sm font-semibold truncate leading-tight ${isActive ? 'text-[#1DB954]' : 'text-white'}`}>
          {song.title}
        </h4>
        <p
          className="text-xs text-white/50 truncate mt-0.5 cursor-pointer hover:underline"
          onClick={(e) => { e.stopPropagation(); navigate(`/artist/${encodeURIComponent(song.artist?.split(',')[0]?.trim())}`); }}
        >
          {song.artist}
        </p>
      </div>

      {/* Duration + add */}
      <div className="flex items-center gap-2 flex-shrink-0">
        <span className="text-xs text-white/40 font-medium">{formatTime(song.duration)}</span>
        {onAddToPlaylist && (
          <button
            onClick={(e) => { e.stopPropagation(); onAddToPlaylist(song); }}
            className="w-7 h-7 rounded-full text-white/30 hover:text-white hover:bg-white/10 opacity-0 group-hover:opacity-100 transition-all flex items-center justify-center"
            title="Add to playlist"
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="w-4 h-4">
              <path d="M12 5v14M5 12h14" strokeLinecap="round"/>
            </svg>
          </button>
        )}
        
        {/* 3-dot menu */}
        <div style={{ position: 'relative', flexShrink: 0 }} onClick={e => e.stopPropagation()}>
          <button
            onClick={() => setMenuOpen(v => !v)}
            style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 8, color: 'rgba(255,255,255,0.4)' }}
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
              <circle cx="12" cy="5" r="1.5"/><circle cx="12" cy="12" r="1.5"/><circle cx="12" cy="19" r="1.5"/>
            </svg>
          </button>

          {menuOpen && (
            <>
              {/* Backdrop */}
              <div style={{ position: 'fixed', inset: 0, zIndex: 99 }} onClick={() => setMenuOpen(false)} />
              {/* Menu */}
              <div style={{
                position: 'absolute', right: 0, top: '100%', zIndex: 100,
                background: '#282828', borderRadius: 10, overflow: 'hidden',
                boxShadow: '0 8px 24px rgba(0,0,0,0.6)', minWidth: 160,
                border: '1px solid rgba(255,255,255,0.08)',
              }}>
                <button
                  onClick={() => { playNext(song); setMenuOpen(false); }}
                  style={{ display: 'flex', alignItems: 'center', gap: 10, width: '100%', padding: '12px 16px', background: 'none', border: 'none', cursor: 'pointer', color: '#fff', fontSize: 14, fontFamily: 'inherit' }}
                >
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                    <polygon points="5,3 19,12 5,21"/><line x1="19" y1="3" x2="19" y2="21"/>
                  </svg>
                  Play next
                </button>
                <button
                  onClick={() => {
                    const queue = usePlayerStore.getState().queue;
                    usePlayerStore.setState({ queue: [...queue, song] });
                    setMenuOpen(false);
                  }}
                  style={{ display: 'flex', alignItems: 'center', gap: 10, width: '100%', padding: '12px 16px', background: 'none', border: 'none', cursor: 'pointer', color: 'rgba(255,255,255,0.6)', fontSize: 14, fontFamily: 'inherit' }}
                >
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                    <line x1="8" y1="6" x2="21" y2="6"/><line x1="8" y1="12" x2="21" y2="12"/>
                    <line x1="8" y1="18" x2="21" y2="18"/><line x1="3" y1="6" x2="3.01" y2="6"/>
                    <line x1="3" y1="12" x2="3.01" y2="12"/><line x1="3" y1="18" x2="3.01" y2="18"/>
                  </svg>
                  Add to queue
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
