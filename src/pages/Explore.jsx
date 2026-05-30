import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { usePlayer } from '../hooks/usePlayer';
import { searchSongs } from '../services/jiosaavn';
import { SongScroll, SkeletonRow } from '../components/SongScroll';

// Time-based cache — 30 min baad expire
const _exploreCache = {};
const CACHE_TTL = 30 * 60 * 1000; // 30 minutes

function getCached(key) {
  const entry = _exploreCache[key];
  if (!entry) return null;
  if (Date.now() - entry.time > CACHE_TTL) {
    delete _exploreCache[key];
    return null;
  }
  return entry.data;
}

function setCached(key, data) {
  _exploreCache[key] = { data, time: Date.now() };
}

// Random item picker
function pickRandom(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

export default function Explore() {
  const navigate = useNavigate();
  const { currentSong, isPlaying, playSong } = usePlayer();

  // ── DEDICATED TO PRACHI (USER EDITABLE) ──
  const dedicatedSongs = [];

  // Explore categories
  const exploreCats = [
    {
      label: 'Romantic 💖', color: '#e8115b',
      queries: [
        'romantic hindi songs', 'love songs bollywood',
        'romantic hits arijit', 'pyaar ke gaane', 'dil songs hindi',
      ],
    },
    {
      label: 'Party 🎉', color: '#bc5900',
      queries: [
        'party hits punjabi', 'dance songs bollywood',
        'party anthem hindi', 'club hits india', 'dj hits 2024',
      ],
    },
    {
      label: 'Chill ☕', color: '#477d95',
      queries: [
        'chill lofi hindi', 'relaxing songs bollywood',
        'soft hindi songs', 'peaceful music india', 'acoustic hindi',
      ],
    },
    {
      label: '90s Hits 📻', color: '#537aa1',
      queries: [
        '90s bollywood hits', 'purane gaane hindi',
        'classic bollywood 90s', 'retro hindi songs', '80s 90s bollywood',
      ],
    },
    {
      label: 'Punjabi 🥁', color: '#e8a020',
      queries: [
        'punjabi hits 2024', 'punjabi songs new',
        'diljit dosanjh songs', 'ap dhillon songs', 'punjabi pop',
      ],
    },
    {
      label: 'Sad 🌙', color: '#503750',
      queries: [
        'sad hindi songs', 'emotional bollywood',
        'heartbreak songs hindi', 'dard songs', 'tanha songs',
      ],
    },
    {
      label: 'Workout 💪', color: '#1DB954',
      queries: [
        'workout songs hindi', 'gym motivation songs',
        'high energy bollywood', 'power songs india', 'running songs hindi',
      ],
    },
    {
      label: 'Devotional 🙏', color: '#c9a227',
      queries: [
        'bhajan songs', 'devotional hindi',
        'morning prayer songs', 'aarti songs', 'mantra music',
      ],
    },
  ];

  const [catData, setCatData] = useState({});

  useEffect(() => {
    exploreCats.forEach(cat => {
      // Har category ke liye random query pick karo
      const query = pickRandom(cat.queries);
      const cacheKey = `${cat.label}_${query}`;

      const cached = getCached(cacheKey);
      if (cached) {
        setCatData(prev => ({ ...prev, [cat.label]: cached }));
        return;
      }

      searchSongs(query, 12).then(songs => {
        setCached(cacheKey, songs);
        setCatData(prev => ({ ...prev, [cat.label]: songs }));
      }).catch(() => {});
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
        const songs = catData[cat.label];
        return (
          <div key={cat.label} style={{ marginBottom: 32 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 16px', marginBottom: 12 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <h2 style={{ fontSize: 18, fontWeight: 800, color: '#fff', margin: 0 }}>{cat.label}</h2>
                <button
                  onClick={() => {
                    const query = pickRandom(cat.queries);
                    setCatData(prev => ({ ...prev, [cat.label]: null })); // skeleton dikhao
                    searchSongs(query, 12).then(songs => {
                      setCached(`${cat.label}_${query}`, songs);
                      setCatData(prev => ({ ...prev, [cat.label]: songs }));
                    }).catch(() => {});
                  }}
                  style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'rgba(255,255,255,0.3)', padding: 4, transition: 'color 0.15s' }}
                  onMouseOver={e => e.currentTarget.style.color = '#fff'}
                  onMouseOut={e => e.currentTarget.style.color = 'rgba(255,255,255,0.3)'}
                  title="Refresh"
                >
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                    <polyline points="23 4 23 10 17 10"/>
                    <path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"/>
                  </svg>
                </button>
              </div>
              <button onClick={() => navigate(`/search?q=${encodeURIComponent(cat.queries[0])}`)} style={{ fontSize: 12, fontWeight: 700, color: '#b3b3b3', background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'inherit' }}>
                See all
              </button>
            </div>
            {songs ? (
              <SongScroll songs={songs} currentSong={currentSong} isPlaying={isPlaying} onPlay={song => playSong(song, { id: cat.label, songs, title: cat.label })} />
            ) : (
              <SkeletonRow />
            )}
          </div>
        );
      })}
      
    </div>
  );
}

