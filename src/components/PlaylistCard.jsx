import React from 'react';

export default function PlaylistCard({ playlist, onClick }) {
  return (
    <div
      onClick={onClick}
      className="group bg-[#181818] hover:bg-[#282828] rounded-lg p-3 cursor-pointer transition-all duration-300 relative"
    >
      <div className="relative aspect-square w-full rounded-md overflow-hidden bg-white/10 mb-3 shadow-lg">
        <img
          src={playlist.cover}
          alt={playlist.title}
          className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
          loading="lazy"
          onError={(e) => {
            e.target.style.display = 'none';
            e.target.parentNode.style.background = '#282828';
          }}
        />
        {/* Play button overlay */}
        <div className="absolute right-2 bottom-2 w-10 h-10 rounded-full bg-[#1DB954] shadow-xl flex items-center justify-center translate-y-2 opacity-0 group-hover:opacity-100 group-hover:translate-y-0 transition-all duration-300">
          <svg viewBox="0 0 24 24" fill="black" className="w-5 h-5 ml-0.5">
            <path d="M8 5v14l11-7z"/>
          </svg>
        </div>
      </div>
      <h3 className="text-sm font-bold text-white truncate">{playlist.title}</h3>
      <p className="text-xs text-white/60 truncate mt-1">{playlist.description}</p>
    </div>
  );
}
