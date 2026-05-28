import React, { useEffect, useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { usePlayer } from '../hooks/usePlayer';
import usePlayerStore from '../store/playerStore';
import { getTrending, getRecommendations, getDailyMix, getHiddenGems } from '../services/jiosaavn';

export default function Home() {
  const navigate = useNavigate();
  const { currentSong, playSong, isPlaying, togglePlay } = usePlayer();
  const recentSongs = usePlayerStore(s => s.recentSongs);
  const jiosaavnCache = usePlayerStore(s => s.jiosaavnCache);
  const allSongs = usePlayerStore(s => s.allSongs);
  const likedSongs = usePlayerStore(s => s.likedSongs);
  const likedSongObjects = usePlayerStore(s => s.likedSongObjects);
  const customPlaylists = usePlayerStore(s => s.customPlaylists);

  const [trending, setTrending] = useState([]);
  const [recommendations, setRecommendations] = useState([]);
  const [dailyMix, setDailyMix] = useState([]);
  const [hiddenGems, setHiddenGems] = useState([]);
  const [loadingRecs, setLoadingRecs] = useState(true);
  const [loadingMix, setLoadingMix] = useState(true);
  const [loadingGems, setLoadingGems] = useState(true);

  const fetched = useRef(false);

  const hour = new Date().getHours();
  const greeting =
    hour < 12 ? 'Good morning Prachi 🎀' :
    hour < 18 ? 'Good afternoon Prachi 🎀' :
    'Good evening Prachi 🎀';

  const recentObjects = recentSongs.slice(0, 8).map(id =>
    allSongs.find(s => s.id === id) || jiosaavnCache[id]
  ).filter(Boolean);

  useEffect(() => {
    if (fetched.current) return;
    fetched.current = true;

    // Load all sections in parallel — non-blocking
    getTrending().then(s => setTrending(s.slice(0, 10))).catch(() => {});

    getRecommendations(likedSongObjects, recentObjects)
      .then(setRecommendations)
      .finally(() => setLoadingRecs(false));

    getDailyMix(likedSongObjects)
      .then(setDailyMix)
      .finally(() => setLoadingMix(false));

    getHiddenGems(likedSongObjects, recentObjects)
      .then(setHiddenGems)
      .finally(() => setLoadingGems(false));
  }, []);  // eslint-disable-line

  // Sleek, compact quick-access tiles
  const statTiles = [
    { 
      label: 'Liked Songs', value: `${likedSongs.length} songs`, action: () => navigate('/library'),
      bg: 'linear-gradient(135deg, #450af5, #c4efd9)',
      icon: <svg width="22" height="22" viewBox="0 0 24 24" fill="#fff"><path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z"/></svg> 
    },
    { 
      label: 'Playlists', value: `${customPlaylists.length} lists`, action: () => navigate('/library'),
      bg: '#282828',
      icon: <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M9 18V5l12-2v13M9 9l12-2M5 21a3 3 0 100-6 3 3 0 000 6zM17 19a3 3 0 100-6 3 3 0 000 6z"/></svg>
    },
    { 
      label: 'History', value: `${recentSongs.length} played`, action: () => {},
      bg: '#282828',
      icon: <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
    },
    { 
      label: 'Surprise Me', value: 'Play random', action: () => {
        const pool = recommendations.length > 0 ? recommendations : trending;
        if (pool.length > 0) {
          const randomSong = pool[Math.floor(Math.random() * pool.length)];
          playSong(randomSong, { id: 'surprise', songs: pool, title: 'Surprise Me' });
        }
      },
      bg: '#282828',
      icon: <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="16 3 21 3 21 8"/><line x1="4" y1="20" x2="21" y2="3"/><polyline points="21 16 21 21 16 21"/><line x1="15" y1="15" x2="21" y2="21"/><line x1="4" y1="4" x2="9" y2="9"/></svg>
    },
  ];

  return (
    <div className="page" style={{ background: 'linear-gradient(180deg,#1a1a2e 0%,#121212 35%)' }}>

      {/* ── Header ── */}
      <div style={{ padding: '52px 16px 20px' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24 }}>
          <h1 style={{ fontSize: 22, fontWeight: 800, color: '#fff', lineHeight: 1.2 }}>{greeting}</h1>
          <button onClick={() => navigate('/search')} style={iconBtn} title="Search">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round">
              <circle cx="11" cy="11" r="8" /><path d="M21 21l-4.35-4.35" />
            </svg>
          </button>
        </div>

        {/* Sleek compact grid */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
          {statTiles.map(tile => (
            <button key={tile.label} onClick={tile.action}
              style={{
                background: 'rgba(255,255,255,0.08)',
                border: 'none',
                borderRadius: 6,
                display: 'flex',
                alignItems: 'center',
                overflow: 'hidden',
                cursor: 'pointer',
                transition: 'background 0.2s, transform 0.1s',
                fontFamily: 'inherit',
                padding: 0,
              }}
              onMouseOver={e => e.currentTarget.style.background = 'rgba(255,255,255,0.15)'}
              onMouseOut={e => e.currentTarget.style.background = 'rgba(255,255,255,0.08)'}
              onMouseDown={e => e.currentTarget.style.transform = 'scale(0.97)'}
              onMouseUp={e => e.currentTarget.style.transform = 'scale(1)'}
              onTouchStart={e => e.currentTarget.style.transform = 'scale(0.97)'}
              onTouchEnd={e => e.currentTarget.style.transform = 'scale(1)'}
            >
              <div style={{ width: 56, height: 56, background: tile.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, boxShadow: '4px 0 12px rgba(0,0,0,0.15)' }}>
                {tile.icon}
              </div>
              <div style={{ padding: '0 12px', display: 'flex', flexDirection: 'column', alignItems: 'flex-start', flex: 1, minWidth: 0 }}>
                <span style={{ fontSize: 13, fontWeight: 700, color: '#fff', marginBottom: 2, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', width: '100%', textAlign: 'left' }}>
                  {tile.label}
                </span>
                <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.6)', fontWeight: 500, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', width: '100%', textAlign: 'left' }}>
                  {tile.value}
                </span>
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* ── Jump back in ── */}
      {currentSong && (
        <Section title="Jump back in">
          <div onClick={() => isPlaying ? togglePlay() : playSong(currentSong)}
            style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '8px 16px', cursor: 'pointer' }}>
            <div style={{ position: 'relative', flexShrink: 0 }}>
              <img src={currentSong.cover} alt="" style={{ width: 64, height: 64, borderRadius: 10, objectFit: 'cover', display: 'block' }}
                onError={e => e.target.style.background = '#333'} />
              {isPlaying && (
                <div style={{ position: 'absolute', inset: 0, borderRadius: 10, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 2 }}>
                  <span className="eq-bar" /><span className="eq-bar" /><span className="eq-bar" />
                </div>
              )}
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 15, fontWeight: 700, color: '#fff', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', marginBottom: 3 }}>{currentSong.title}</div>
              <div style={{ fontSize: 12, color: '#b3b3b3', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{currentSong.artist}</div>
            </div>
            <div style={greenPlay}>
              {isPlaying
                ? <svg width="22" height="22" viewBox="0 0 24 24" fill="#000"><rect x="6" y="4" width="4" height="16" /><rect x="14" y="4" width="4" height="16" /></svg>
                : <svg width="22" height="22" viewBox="0 0 24 24" fill="#000"><polygon points="5,3 19,12 5,21" /></svg>}
            </div>
          </div>
        </Section>
      )}

      {/* ── Daily Mix ── */}
      {(loadingMix || dailyMix.length > 0) && (
        <Section title={`Daily Mix · ${new Date().toLocaleDateString('en', { month: 'short', day: 'numeric' })} 🎲`}>
          {loadingMix
            ? <SkeletonRow />
            : <SongScroll songs={dailyMix} currentSong={currentSong} isPlaying={isPlaying}
                onPlay={song => playSong(song, { id: 'daily-mix', songs: dailyMix, title: 'Daily Mix' })} />
          }
        </Section>
      )}

      {/* ── Smart Recommendations ── */}
      {(loadingRecs || recommendations.length > 0) && (
        <Section title="Recommended for you ✨">
          {loadingRecs
            ? <SkeletonRow />
            : <SongScroll songs={recommendations} currentSong={currentSong} isPlaying={isPlaying}
                onPlay={song => playSong(song, { id: 'recs', songs: recommendations, title: 'Recommended' })} />
          }
        </Section>
      )}

      {/* ── Liked Songs quick strip ── */}
      {likedSongObjects.length > 0 && (
        <Section title="Liked songs" onSeeAll={() => navigate('/library')}>
          <SongScroll songs={likedSongObjects.slice(0, 10)} currentSong={currentSong} isPlaying={isPlaying}
            onPlay={song => playSong(song, { id: 'liked', songs: likedSongObjects, title: 'Liked Songs' })} />
        </Section>
      )}

      {/* ── Hidden Gems ── */}
      {(loadingGems || hiddenGems.length > 0) && (
        <Section title="Hidden gems 💎">
          {loadingGems
            ? <SkeletonRow />
            : <SongScroll songs={hiddenGems} currentSong={currentSong} isPlaying={isPlaying}
                onPlay={song => playSong(song, { id: 'gems', songs: hiddenGems, title: 'Hidden Gems' })} />
          }
        </Section>
      )}

      {/* ── Your playlists ── */}
      {customPlaylists.length > 0 && (
        <Section title="Your playlists" onSeeAll={() => navigate('/library')}>
          <div style={{ display: 'flex', gap: 12, overflowX: 'auto', padding: '0 16px 8px', scrollbarWidth: 'none' }}>
            {customPlaylists.map(pl => (
              <PlayCard key={pl.id} item={pl} onClick={() => navigate(`/playlist/${pl.id}`)} />
            ))}
          </div>
        </Section>
      )}

      {/* ── Trending ── */}
      {trending.length > 0 && (
        <Section title="Trending now 🔥" onSeeAll={() => navigate('/search')}>
          <SongScroll songs={trending} currentSong={currentSong} isPlaying={isPlaying}
            onPlay={song => playSong(song, { id: 'trending', songs: trending, title: 'Trending' })} />
        </Section>
      )}

      {/* ── Recently played ── */}
      {recentObjects.length > 0 && (
        <Section title="Recently played">
          <SongScroll songs={recentObjects} currentSong={currentSong} isPlaying={isPlaying}
            onPlay={song => playSong(song)} />
        </Section>
      )}

      {/* ── Empty state ── */}
      {recentObjects.length === 0 && !loadingRecs && !loadingMix && !loadingGems && trending.length === 0 && (
        <div style={{ textAlign: 'center', padding: '48px 32px' }}>
          <div style={{ fontSize: 48, marginBottom: 16 }}>🎵</div>
          <div style={{ fontSize: 17, fontWeight: 700, marginBottom: 8 }}>Nothing playing yet</div>
          <div style={{ fontSize: 13, color: '#b3b3b3', marginBottom: 24 }}>Search for a song to get started</div>
          <button onClick={() => navigate('/search')} style={{ background: '#1DB954', color: '#000', border: 'none', borderRadius: 30, padding: '12px 28px', fontWeight: 700, fontSize: 14, cursor: 'pointer', fontFamily: 'inherit' }}>
            Find music
          </button>
        </div>
      )}
    </div>
  );
}

/* ── Shared horizontal song scroller ─────────────────────────────── */
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

/* ── Skeleton loading shimmer ─────────────────────────────────────── */
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

/* ── Section wrapper ──────────────────────────────────────────────── */
function Section({ title, onSeeAll, children }) {
  return (
    <div style={{ marginBottom: 28 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 16px', marginBottom: 12 }}>
        <span style={{ fontSize: 17, fontWeight: 800, color: '#fff' }}>{title}</span>
        {onSeeAll && (
          <button onClick={onSeeAll} style={{ fontSize: 12, fontWeight: 700, color: '#b3b3b3', background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'inherit' }}>
            See all
          </button>
        )}
      </div>
      {children}
    </div>
  );
}

/* ── Song card ────────────────────────────────────────────────────── */
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

/* ── Playlist card ────────────────────────────────────────────────── */
function PlayCard({ item, onClick }) {
  return (
    <button onClick={onClick} style={{ background: 'none', border: 'none', cursor: 'pointer', textAlign: 'left', flexShrink: 0, width: 136, fontFamily: 'inherit' }}>
      <div style={{ width: 136, height: 136, borderRadius: 10, overflow: 'hidden', marginBottom: 8, background: '#282828' }}>
        <img src={item.cover} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }}
          onError={e => { e.target.style.display = 'none'; }} />
      </div>
      <div style={{ fontSize: 13, fontWeight: 700, color: '#fff', marginBottom: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{item.title}</div>
      <div style={{ fontSize: 11, color: '#888' }}>{item.songs?.length} songs</div>
    </button>
  );
}

const iconBtn = { background: 'rgba(255,255,255,0.1)', border: 'none', borderRadius: '50%', width: 36, height: 36, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' };
const greenPlay = { width: 48, height: 48, borderRadius: '50%', background: '#1DB954', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, boxShadow: '0 4px 16px rgba(29,185,84,0.4)' };
