import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { searchSongs, searchArtists } from '../services/jiosaavn';
import usePlayerStore from '../store/playerStore';
import { usePlayer } from '../hooks/usePlayer';

const _artistCache = {};
const _artistDetailsCache = {};

export default function ArtistPage() {
  const { artistName } = useParams();
  const navigate = useNavigate();
  const decoded = decodeURIComponent(artistName);
  const [songs, setSongs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [artistDetails, setArtistDetails] = useState(null);
  
  const { playSong } = usePlayer();
  const { currentSong, isPlaying, setQueue } = usePlayerStore();

  useEffect(() => {
    setPage(1);
    setHasMore(true);

    if (_artistDetailsCache[decoded]) {
      setArtistDetails(_artistDetailsCache[decoded]);
    } else {
      searchArtists(decoded, 1).then(res => {
        if (res.length > 0) {
          _artistDetailsCache[decoded] = res[0];
          setArtistDetails(res[0]);
        }
      }).catch(() => {});
    }

    if (_artistCache[decoded]) {
      setSongs(_artistCache[decoded]);
      setPage(Math.ceil(_artistCache[decoded].length / 20));
      setLoading(false);
      return;
    }
    setLoading(true);
    searchSongs(decoded, 20, 1)
      .then(results => {
        _artistCache[decoded] = results;
        setSongs(results);
        if (results.length < 20) setHasMore(false);
      })
      .catch(() => setSongs([]))
      .finally(() => setLoading(false));
  }, [decoded]);

  const handleLoadMore = () => {
    if (loadingMore || !hasMore) return;
    setLoadingMore(true);
    const nextPage = page + 1;
    
    searchSongs(decoded, 20, nextPage)
      .then(newResults => {
        if (newResults.length < 20) setHasMore(false);
        const combined = [...songs, ...newResults];
        _artistCache[decoded] = combined;
        setSongs(combined);
        setPage(nextPage);
      })
      .catch(err => console.error(err))
      .finally(() => setLoadingMore(false));
  };

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
        <div style={{ marginBottom: 40, display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center' }}>
          {artistDetails?.image ? (
            <img 
              src={artistDetails.image} 
              alt={decoded} 
              style={{ width: 180, height: 180, borderRadius: '50%', objectFit: 'cover', marginBottom: 20, boxShadow: '0 16px 40px rgba(0,0,0,0.5)' }} 
              onError={e => e.target.src = 'https://www.jiosaavn.com/_i/3.0/artist-default-music.png'}
            />
          ) : (
            <div style={{ width: 140, height: 140, borderRadius: '50%', background: 'linear-gradient(135deg, #1DB954, #191414)', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 20, fontSize: 48, boxShadow: '0 16px 40px rgba(0,0,0,0.5)' }}>
              🎤
            </div>
          )}
          <h1 style={{ fontSize: 44, fontWeight: 900, marginBottom: 8, letterSpacing: '-0.04em' }}>{decoded}</h1>
          <p style={{ fontSize: 14, color: 'rgba(255,255,255,0.6)', marginBottom: 24, fontWeight: 500 }}>{songs.length > 0 ? `${songs.length} popular tracks` : 'Loading...'}</p>

          {songs.length > 0 && (
            <button
              onClick={() => playAll(0)}
              style={{ 
                background: '#1DB954', 
                border: 'none', 
                borderRadius: 32, 
                padding: '14px 44px', 
                color: '#000', 
                fontWeight: 800, 
                fontSize: 15, 
                cursor: 'pointer', 
                fontFamily: 'inherit',
                transition: 'all 0.2s',
                boxShadow: '0 8px 24px rgba(29,185,84,0.3)'
              }}
              onMouseEnter={e => e.currentTarget.style.transform = 'scale(1.05)'}
              onMouseLeave={e => e.currentTarget.style.transform = 'scale(1)'}
            >
              ▶ Play All
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
        
        {/* Load More Button */}
        {songs.length > 0 && hasMore && (
          <div style={{ display: 'flex', justifyContent: 'center', margin: '24px 0 40px' }}>
            <button
              onClick={handleLoadMore}
              disabled={loadingMore}
              style={{
                background: 'transparent',
                border: '1px solid rgba(255,255,255,0.3)',
                borderRadius: 24,
                padding: '10px 32px',
                color: '#fff',
                fontSize: 14,
                fontWeight: 600,
                cursor: loadingMore ? 'default' : 'pointer',
                opacity: loadingMore ? 0.5 : 1,
                fontFamily: 'inherit',
                transition: 'all 0.2s'
              }}
              onMouseEnter={e => !loadingMore && (e.currentTarget.style.background = 'rgba(255,255,255,0.1)')}
              onMouseLeave={e => !loadingMore && (e.currentTarget.style.background = 'transparent')}
            >
              {loadingMore ? 'Loading...' : 'Load more'}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
