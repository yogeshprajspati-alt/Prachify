import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { usePlayer } from '../hooks/usePlayer';
import { searchSongs } from '../services/jiosaavn';
import { SongScroll, SkeletonRow } from '../components/SongScroll';

// Module-level cache — survives navigation, resets on hard reload
const _exploreCache = {};

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
    // Serve from cache if available; only fetch missing categories
    exploreCats.forEach(cat => {
      if (_exploreCache[cat.query]) {
        setCatData(prev => ({ ...prev, [cat.query]: _exploreCache[cat.query] }));
        return;
      }
      searchSongs(cat.query, 12).then(songs => {
        _exploreCache[cat.query] = songs;
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

