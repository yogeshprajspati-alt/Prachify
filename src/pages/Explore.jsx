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

// ── Language filter — sirf Hindi, Punjabi, English chahiye ──
// Tamil, Bhojpuri, Nagpuri, Haryanvi, Telugu etc. bahar!
const ALLOWED_LANGUAGES = ['hindi', 'punjabi', 'english'];
function filterByLanguage(songs) {
  return songs.filter(song => {
    if (!song.language) return true; // language field missing = don't drop it
    return ALLOWED_LANGUAGES.includes(song.language.toLowerCase());
  });
}

export default function Explore() {
  const navigate = useNavigate();
  const { currentSong, isPlaying, playSong } = usePlayer();

  // ── DEDICATED TO PRACHI (USER EDITABLE) ──
  // 🎵 Bas song ka naam (aur chahiye toh artist bhi) likho — baaki sab automatic!
  // Format: "Song Name" ya "Song Name - Artist Name"
  const dedicatedSongNames = [
    "Sooiyan",
    "Tum Todo Na (Female Version)",
    "Pretty Woman",
    "Main Koi Aisa Geet Gaoon",
    "Tumhe Jo Maine Dekha (From 'Main Hoon Na')",
    "Gulabi Aankhen - Sanam",
    "Tum Se Hi",
    "Sajni",
    "Kaise Hua",
    "Maskhari",
    "Jag Ghoomeya - Salman Khan Version",
    "Arz Kiya Hai - Coke Studio Bharat",
  ];

  const [dedicatedSongs, setDedicatedSongs] = useState([]);
  const [dedicatedLoading, setDedicatedLoading] = useState(false);

  // Explore categories
  const exploreCats = [
    {
      label: 'Romantic 💖', color: '#e8115b',
      queries: [
        'romantic bollywood hits 2024', 'love songs top hits',
        'lofi romantic hindi', 'soulful bollywood love songs', 'trending romantic hindi',
      ],
    },
    {
      label: 'Party 🎉', color: '#bc5900',
      queries: [
        'party songs bollywood 2024', 'dance hits chartbusters',
        'bollywood club anthems', 'upbeat punjabi party', 'trending party hindi',
      ],
    },
    {
      label: 'Chill ☕', color: '#477d95',
      queries: [
        'chill lofi hindi', 'acoustic bollywood covers',
        'soft hindi indie', 'peaceful bollywood music', 'lo-fi hindi beats',
      ],
    },
    {
      label: '90s Hits 📻', color: '#537aa1',
      queries: [
        '90s bollywood superhits', 'evergreen bollywood classics',
        'retro hindi songs', '90s romantic hindi hits', '90s top hits hd',
      ],
    },
    {
      label: 'Punjabi 🥁', color: '#e8a020',
      queries: [
        'punjabi pop blockbusters', 'urban punjabi top hits',
        'punjabi viral hits', 'punjabi pop anthems', 'urban punjabi hits',
      ],
    },
    {
      label: 'Sad 🌙', color: '#503750',
      queries: [
        'sad romantic hindi blockbusters', 'emotional bollywood hits',
        'heartbreak hindi lo-fi', 'soulful sad hindi songs', 'sad acoustic hindi',
      ],
    },
    {
      label: 'Workout 💪', color: '#1DB954',
      queries: [
        'workout energetic hindi hits', 'bollywood gym anthems',
        'high energy punjabi workout', 'power bollywood hits', 'trending workout hindi',
      ],
    },
    {
      label: 'Devotional 🙏', color: '#c9a227',
      queries: [
        'soothing hindi bhajan', 'divine chants hindi',
        'krishna bhajan lofi', 'morning aarti premium', 'peaceful devotional hindi',
      ],
    },
  ];

  const [catData, setCatData] = useState({});

  // Dedicated songs — search each name and pick top result
  useEffect(() => {
    if (dedicatedSongNames.length === 0) return;
    const cacheKey = `dedicated_${dedicatedSongNames.join('|')}`;
    const cached = getCached(cacheKey);
    if (cached) { setDedicatedSongs(cached); return; }

    setDedicatedLoading(true);
    Promise.all(
      dedicatedSongNames.map(name =>
        searchSongs(name, 3).then(results => results[0] || null).catch(() => null)
      )
    ).then(results => {
      const found = results.filter(Boolean);
      setCached(cacheKey, found);
      setDedicatedSongs(found);
      setDedicatedLoading(false);
    });
  }, []); // eslint-disable-line

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

      searchSongs(query, 20).then(songs => {
        // Sirf Hindi/Punjabi/English chahiye — baaki filter out
        const filtered = filterByLanguage(songs).slice(0, 12);
        setCached(cacheKey, filtered);
        setCatData(prev => ({ ...prev, [cat.label]: filtered }));
      }).catch(() => { });
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

        {dedicatedLoading ? (
          <SkeletonRow />
        ) : dedicatedSongs.length > 0 ? (
          <SongScroll songs={dedicatedSongs} currentSong={currentSong} isPlaying={isPlaying} onPlay={song => playSong(song, { id: 'dedicated', songs: dedicatedSongs, title: 'Dedicated to Prachi' })} />
        ) : (
          <div style={{ padding: '0 16px' }}>
            <div style={{ background: 'linear-gradient(135deg, rgba(232,17,91,0.15), rgba(0,0,0,0.5))', border: '1px dashed rgba(232,17,91,0.3)', borderRadius: 12, padding: '24px 16px', textAlign: 'center' }}>
              <div style={{ fontSize: 32, marginBottom: 12 }}>💝</div>
              <div style={{ fontSize: 14, color: '#fff', fontWeight: 700, marginBottom: 6 }}>This section is waiting for your songs!</div>
              <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.5)', lineHeight: 1.5 }}>
                Open <code>Explore.jsx</code> and add song names to <br /><code>dedicatedSongNames</code> — baaki sab automatic!
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
                    searchSongs(query, 20).then(songs => {
                      const filtered = filterByLanguage(songs).slice(0, 12);
                      setCached(`${cat.label}_${query}`, filtered);
                      setCatData(prev => ({ ...prev, [cat.label]: filtered }));
                    }).catch(() => { });
                  }}
                  style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'rgba(255,255,255,0.3)', padding: 4, transition: 'color 0.15s' }}
                  onMouseOver={e => e.currentTarget.style.color = '#fff'}
                  onMouseOut={e => e.currentTarget.style.color = 'rgba(255,255,255,0.3)'}
                  title="Refresh"
                >
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                    <polyline points="23 4 23 10 17 10" />
                    <path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10" />
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

