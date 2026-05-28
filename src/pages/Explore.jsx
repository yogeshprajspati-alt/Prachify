import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { usePlayer } from '../hooks/usePlayer';
import { searchSongs } from '../services/jiosaavn';

export default function Explore() {
  const navigate = useNavigate();
  const { currentSong, isPlaying, playSong } = usePlayer();

  // ── DEDICATED TO PRACHI (USER EDITABLE) ──
  const dedicatedSongs = [];

  // Explore categories
  const exploreCats = [
    { label: 'Romantic 💖', color: '#e8115b', query: 'romantic hindi' },
    { label: 'Party 🎉', color: '#bc5900', query: 'party hits' },
    { label: 'Chill ☕', color: '#477d95', query: 'chill lofi' },
    { label: '90s Hits 📻', color: '#537aa1', query: '90s bollywood' },
    { label: 'Punjabi 🥁', color: '#bc5900', query: 'punjabi hits' },
    { label: 'Sad 🌙', color: '#503750', query: 'sad hindi' },
  ];

  const [catData, setCatData] = useState({});

  useEffect(() => {
    // Fetch top 12 songs for each category to display them directly
    exploreCats.forEach(cat => {
      searchSongs(cat.query, 12).then(songs => {
        setCatData(prev => ({ ...prev, [cat.query]: songs }));
      }).catch(err => console.error(err));
    });
  }, []); // eslint-disable-line

  return (
    <div className="page" style={{ background: '#121212', paddingBottom: 100 }}>
      <div style={{ padding: '52px 16px 24px' }}>
        <h1 style={{ fontSize: 28, fontWeight: 800, color: '#fff', marginBottom: 8 }}>Explore</h1>
        <p style={{ fontSize: 14, color: '#b3b3b3', margin: 0 }}>Find new favorites or jump into hand-picked collections.</p>
      </div>

      {/* ── Dedicated to Prachi ── */}
      <div style={{ marginBottom: 32 }}>
        <div style={{ padding: '0 16px', marginBottom: 12 }}>
          <h2 style={{ fontSize: 18, fontWeight: 800, color: '#fff', margin: 0 }}>Dedicated to Prachi 💖</h2>
        </div>
        
        {dedicatedSongs.length > 0 ? (
          <SongScroll songs={dedicatedSongs} currentSong={currentSong} isPlaying={isPlaying} onPlay={song => playSong(song, { id: 'dedicated', songs: dedicatedSongs, title: 'Dedicated to Prachi' })} />
        ) : (
          <div style={{ padding: '0 16px' }}>
            <div style={{ background: 'linear-gradient(135deg, rgba(232,17,91,0.15), rgba(0,0,0,0.5))', border: '1px dashed rgba(232,17,91,0.3)', borderRadius: 12, padding: '24px 16px', textAlign: 'center' }}>
              <div style={{ fontSize: 32, marginBottom: 12 }}>💝</div>
              <div style={{ fontSize: 14, color: '#fff', fontWeight: 700, marginBottom: 6 }}>This section is waiting for your songs!</div>
              <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.5)', lineHeight: 1.5 }}>
                Add your special song objects to the <br/><code>dedicatedSongs</code> array in <code>Explore.jsx</code>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* ── Direct Songs by Mood ── */}
      {exploreCats.map(cat => {
        const songs = catData[cat.query];
        return (
          <div key={cat.label} style={{ marginBottom: 32 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 16px', marginBottom: 12 }}>
              <h2 style={{ fontSize: 18, fontWeight: 800, color: '#fff', margin: 0 }}>{cat.label}</h2>
              <button onClick={() => navigate(`/search?q=${encodeURIComponent(cat.query)}`)} style={{ fontSize: 12, fontWeight: 700, color: '#b3b3b3', background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'inherit' }}>
                See all
              </button>
            </div>
            {songs ? (
              <SongScroll songs={songs} currentSong={currentSong} isPlaying={isPlaying} onPlay={song => playSong(song, { id: cat.query, songs, title: cat.label })} />
            ) : (
              <SkeletonRow />
            )}
          </div>
        );
      })}
      
    </div>
  );
}

function SongScroll({ songs, currentSong, isPlaying, onPlay }) {
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

function SkeletonRow() {
  return (
    <div style={{ display: 'flex', gap: 12, padding: '0 16px 8px', overflowX: 'hidden' }}>
      {[1, 2, 3].map(i => (
        <div key={i} style={{ flexShrink: 0, width: 136 }}>
          <div style={{ width: 136, height: 136, borderRadius: 10, background: 'rgba(255,255,255,0.06)', marginBottom: 8, animation: 'shimmer 1.4s ease-in-out infinite' }} />
          <div style={{ height: 12, borderRadius: 6, background: 'rgba(255,255,255,0.06)', marginBottom: 6, width: '80%', animation: 'shimmer 1.4s ease-in-out infinite' }} />
          <div style={{ height: 10, borderRadius: 6, background: 'rgba(255,255,255,0.04)', width: '55%', animation: 'shimmer 1.4s ease-in-out infinite' }} />
        </div>
      ))}
      <style>{`@keyframes shimmer { 0%,100%{opacity:0.4} 50%{opacity:1} }`}</style>
    </div>
  );
}

function SongCard({ song, isActive, isPlaying, onClick }) {
  return (
    <button onClick={onClick} style={{ background: 'none', border: 'none', cursor: 'pointer', textAlign: 'left', flexShrink: 0, width: 136, fontFamily: 'inherit' }}>
      <div style={{ position: 'relative', width: 136, height: 136, borderRadius: 10, overflow: 'hidden', marginBottom: 8, background: '#282828' }}>
        <img src={song.cover} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }}
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
}
