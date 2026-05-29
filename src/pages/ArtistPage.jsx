import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { searchSongs } from '../services/jiosaavn';
import usePlayerStore from '../store/playerStore';
import { usePlayer } from '../hooks/usePlayer';

const _artistCache = {};

export default function ArtistPage() {
  const { artistName } = useParams();
  const navigate = useNavigate();
  const decoded = decodeURIComponent(artistName);
  const [songs, setSongs] = useState([]);
  const [loading, setLoading] = useState(true);
  const { playSong } = usePlayer();
  const { currentSong, isPlaying, setQueue } = usePlayerStore();

  useEffect(() => {
    if (_artistCache[decoded]) {
      setSongs(_artistCache[decoded]);
      setLoading(false);
      return;
    }
    setLoading(true);
    searchSongs(decoded, 20)
      .then(results => {
        _artistCache[decoded] = results;
        setSongs(results);
      })
      .catch(() => setSongs([]))
      .finally(() => setLoading(false));
  }, [decoded]);

  const playAll = (startIdx = 0) => {
    setQueue(songs, startIdx);
    playSong(songs[startIdx]);
  };

  return (
    <div className="page" style={{ background: '#121212', minHeight: '100vh', paddingBottom: 120 }}>
      {/* Header */}
      <div style={{ padding: '52px 16px 0' }}>
        <button onClick={() => navigate(-1)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'rgba(255,255,255,0.6)', display: 'flex', alignItems: 'center', gap: 6, marginBottom: 20, padding: 0, fontFamily: 'inherit', fontSize: 14 }}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="M19 12H5M12 5l-7 7 7 7"/></svg>
          Back
        </button>

        {/* Artist hero */}
        <div style={{ marginBottom: 24 }}>
          <div style={{ width: 80, height: 80, borderRadius: '50%', background: 'linear-gradient(135deg, #1DB954, #191414)', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 16, fontSize: 32 }}>
            🎤
          </div>
          <h1 style={{ fontSize: 28, fontWeight: 800, marginBottom: 4 }}>{decoded}</h1>
          <p style={{ fontSize: 13, color: 'rgba(255,255,255,0.4)' }}>{songs.length} songs</p>

          {songs.length > 0 && (
            <button
              onClick={() => playAll(0)}
              style={{ marginTop: 16, background: '#1DB954', border: 'none', borderRadius: 24, padding: '10px 28px', color: '#000', fontWeight: 700, fontSize: 14, cursor: 'pointer', fontFamily: 'inherit' }}
            >
              ▶ Play all
            </button>
          )}
        </div>
      </div>

      {/* Songs list */}
      <div style={{ padding: '0 16px' }}>
        {loading ? (
          [1,2,3,4,5].map(i => (
            <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 0' }}>
              <div style={{ width: 50, height: 50, borderRadius: 6, background: 'rgba(255,255,255,0.06)', flexShrink: 0, animation: 'shimmer 1.4s ease-in-out infinite' }} />
              <div style={{ flex: 1 }}>
                <div style={{ height: 13, borderRadius: 6, background: 'rgba(255,255,255,0.06)', marginBottom: 6, width: '65%', animation: 'shimmer 1.4s ease-in-out infinite' }} />
                <div style={{ height: 11, borderRadius: 6, background: 'rgba(255,255,255,0.04)', width: '40%', animation: 'shimmer 1.4s ease-in-out infinite' }} />
              </div>
            </div>
          ))
        ) : songs.length === 0 ? (
          <p style={{ color: 'rgba(255,255,255,0.3)', textAlign: 'center', marginTop: 60 }}>No songs found</p>
        ) : (
          songs.map((song, idx) => {
            const isActive = currentSong?.id === song.id;
            return (
              <button
                key={song.id}
                onClick={() => playAll(idx)}
                style={{ display: 'flex', alignItems: 'center', gap: 12, width: '100%', background: isActive ? 'rgba(29,185,84,0.08)' : 'none', border: 'none', borderRadius: 10, padding: '10px 8px', cursor: 'pointer', textAlign: 'left', fontFamily: 'inherit' }}
              >
                <img src={song.cover} alt="" style={{ width: 50, height: 50, borderRadius: 6, objectFit: 'cover', flexShrink: 0 }} onError={e => e.target.style.background = '#333'} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 14, fontWeight: 600, color: isActive ? '#1DB954' : '#fff', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{song.title}</div>
                  <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.4)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{song.album || song.artist}</div>
                </div>
                {isActive && isPlaying && (
                  <div style={{ display: 'flex', alignItems: 'flex-end', gap: 2, height: 16, flexShrink: 0 }}>
                    <span className="eq-bar" /><span className="eq-bar" /><span className="eq-bar" />
                  </div>
                )}
              </button>
            );
          })
        )}
      </div>
    </div>
  );
}
