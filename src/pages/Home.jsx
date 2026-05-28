import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { usePlayer } from '../hooks/usePlayer';
import usePlayerStore from '../store/playerStore';
import { getTrending } from '../services/jiosaavn';

export default function Home() {
  const navigate = useNavigate();
  const { playlists, currentSong, playSong, isPlaying, togglePlay } = usePlayer();
  const recentSongs = usePlayerStore(s => s.recentSongs);
  const jiosaavnCache = usePlayerStore(s => s.jiosaavnCache);
  const allSongs = usePlayerStore(s => s.allSongs);
  const [trending, setTrending] = useState([]);

  const hour = new Date().getHours();
  const greeting = hour < 12 ? 'Good morning Prachi🎀' : hour < 18 ? 'Good afternoon Prachi🎀' : 'Good evening Prachi🎀';

  useEffect(() => {
    getTrending().then(songs => setTrending(songs.slice(0, 10))).catch(() => { });
  }, []);

  const recentObjects = recentSongs.slice(0, 6).map(id =>
    allSongs.find(s => s.id === id) || jiosaavnCache[id]
  ).filter(Boolean);

  return (
    <div className="page" style={{ background: 'linear-gradient(180deg, #1a1a2e 0%, #121212 35%)' }}>
      {/* Header */}
      <div style={{ padding: '52px 16px 16px' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
          <h1 style={{ fontSize: 22, fontWeight: 800, color: '#fff' }}>{greeting}</h1>
          <button onClick={() => navigate('/search')} style={iconBtn} title="Search">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round">
              <circle cx="11" cy="11" r="8" /><path d="M21 21l-4.35-4.35" />
            </svg>
          </button>
        </div>

        {/* Quick picks 2-col grid */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 8 }}>
          {playlists.slice(0, 6).map(pl => (
            <button key={pl.id} onClick={() => navigate(`/playlist/${pl.id}`)} style={quickCard}>
              <img src={pl.cover} alt="" style={{ width: 56, height: 56, objectFit: 'cover', flexShrink: 0, borderRadius: '4px 0 0 4px' }}
                onError={e => { e.target.style.display = 'none'; }} />
              <span style={{ fontSize: 12, fontWeight: 700, color: '#fff', padding: '0 10px', textAlign: 'left', lineHeight: 1.3 }}>
                {pl.title}
              </span>
            </button>
          ))}
        </div>
      </div>

      {/* Jump back in */}
      {currentSong && (
        <Section title="Jump back in">
          <div onClick={() => isPlaying ? togglePlay() : playSong(currentSong)}
            style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '8px 16px', cursor: 'pointer' }}>
            <img src={currentSong.cover} alt="" style={{ width: 64, height: 64, borderRadius: 6, objectFit: 'cover' }}
              onError={e => e.target.style.background = '#333'} />
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 14, fontWeight: 700, color: '#fff', marginBottom: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{currentSong.title}</div>
              <div style={{ fontSize: 12, color: '#b3b3b3' }}>{currentSong.artist}</div>
            </div>
            <div style={greenPlay}>
              {isPlaying
                ? <svg width="22" height="22" viewBox="0 0 24 24" fill="#000"><rect x="6" y="4" width="4" height="16" /><rect x="14" y="4" width="4" height="16" /></svg>
                : <svg width="22" height="22" viewBox="0 0 24 24" fill="#000"><polygon points="5,3 19,12 5,21" /></svg>
              }
            </div>
          </div>
        </Section>
      )}

      {/* Trending on JioSaavn */}
      {trending.length > 0 && (
        <Section title="Trending now" onSeeAll={() => navigate('/search')}>
          <div style={{ display: 'flex', gap: 12, overflowX: 'auto', padding: '0 16px 8px' }}>
            {trending.map(song => (
              <SongCard key={song.id} song={song} isActive={currentSong?.id === song.id} isPlaying={isPlaying}
                onClick={() => playSong(song, { id: 'trending', songs: trending, title: 'Trending' })} />
            ))}
          </div>
        </Section>
      )}

      {/* Your playlists */}
      <Section title="Your playlists" onSeeAll={() => navigate('/library')}>
        <div style={{ display: 'flex', gap: 12, overflowX: 'auto', padding: '0 16px 8px' }}>
          {playlists.map(pl => (
            <PlayCard key={pl.id} item={pl} onClick={() => navigate(`/playlist/${pl.id}`)} />
          ))}
        </div>
      </Section>

      {/* Recently played */}
      {recentObjects.length > 0 && (
        <Section title="Recently played">
          <div style={{ display: 'flex', gap: 12, overflowX: 'auto', padding: '0 16px 8px' }}>
            {recentObjects.map(song => (
              <SongCard key={song.id} song={song} isActive={currentSong?.id === song.id} isPlaying={isPlaying}
                onClick={() => playSong(song)} />
            ))}
          </div>
        </Section>
      )}
    </div>
  );
}

function Section({ title, onSeeAll, children }) {
  return (
    <div style={{ marginBottom: 28 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 16px', marginBottom: 12 }}>
        <span style={{ fontSize: 18, fontWeight: 800, color: '#fff' }}>{title}</span>
        {onSeeAll && (
          <button onClick={onSeeAll} style={{ fontSize: 12, fontWeight: 700, color: '#b3b3b3', background: 'none', border: 'none', cursor: 'pointer' }}>
            See all
          </button>
        )}
      </div>
      {children}
    </div>
  );
}

function SongCard({ song, isActive, isPlaying, onClick }) {
  return (
    <button onClick={onClick} style={{ background: 'none', border: 'none', cursor: 'pointer', textAlign: 'left', flexShrink: 0, width: 140 }}>
      <div style={{ position: 'relative', width: 140, height: 140, borderRadius: 6, overflow: 'hidden', marginBottom: 8, background: '#282828' }}>
        <img src={song.cover} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }}
          onError={e => { e.target.style.display = 'none'; }} />
        {isActive && isPlaying && (
          <div style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'flex-end', justifyContent: 'center', paddingBottom: 8, gap: 2 }}>
            <span className="eq-bar" /><span className="eq-bar" /><span className="eq-bar" />
          </div>
        )}
      </div>
      <div style={{ fontSize: 13, fontWeight: 700, color: isActive ? '#1DB954' : '#fff', marginBottom: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{song.title}</div>
      <div style={{ fontSize: 11, color: '#b3b3b3', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{song.artist}</div>
    </button>
  );
}

function PlayCard({ item, onClick }) {
  return (
    <button onClick={onClick} style={{ background: 'none', border: 'none', cursor: 'pointer', textAlign: 'left', flexShrink: 0, width: 148 }}>
      <div style={{ width: 148, height: 148, borderRadius: 6, overflow: 'hidden', marginBottom: 8, background: '#282828' }}>
        <img src={item.cover} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }}
          onError={e => { e.target.style.display = 'none'; }} />
      </div>
      <div style={{ fontSize: 13, fontWeight: 700, color: '#fff', marginBottom: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{item.title}</div>
      <div style={{ fontSize: 11, color: '#b3b3b3', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{item.description || item.mood}</div>
    </button>
  );
}

const iconBtn = { background: 'rgba(255,255,255,0.1)', border: 'none', borderRadius: '50%', width: 36, height: 36, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' };
const quickCard = { display: 'flex', alignItems: 'center', background: 'rgba(255,255,255,0.15)', borderRadius: 6, height: 56, overflow: 'hidden', border: 'none', cursor: 'pointer', textAlign: 'left' };
const greenPlay = { width: 48, height: 48, borderRadius: '50%', background: '#1DB954', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, boxShadow: '0 8px 16px rgba(0,0,0,0.3)' };
