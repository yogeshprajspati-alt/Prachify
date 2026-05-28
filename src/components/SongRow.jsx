import React from 'react';

export default function SongRow({ song, isActive, isPlaying, onClick, onAddToPlaylist }) {
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
        <p className="text-xs text-white/50 truncate mt-0.5">{song.artist}</p>
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
      </div>
    </div>
  );
}
