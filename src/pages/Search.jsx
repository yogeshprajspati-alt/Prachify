import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';
import { usePlayer } from '../hooks/usePlayer';
import usePlayerStore from '../store/playerStore';
import { searchSongs } from '../services/jiosaavn';
import SongRow from '../components/SongRow';

const CATEGORIES = [
  { label: 'Arijit Singh', color: '#1e3264', query: 'arijit singh hits' },
  { label: 'Bollywood', color: '#8d67ab', query: 'bollywood top songs' },
  { label: 'Trending Hindi', color: '#e8115b', query: 'trending hindi 2024' },
  { label: 'Romantic', color: '#477d95', query: 'romantic hindi songs' },
  { label: 'Punjabi Hits', color: '#bc5900', query: 'punjabi songs 2024' },
  { label: 'Sad Songs', color: '#503750', query: 'sad hindi songs' },
  { label: 'Party', color: '#e61e32', query: 'party songs hindi' },
  { label: 'AR Rahman', color: '#006450', query: 'ar rahman songs' },
  { label: 'Old is Gold', color: '#537aa1', query: 'evergreen hindi classics' },
  { label: '90s Hindi', color: '#ba5d07', query: '90s bollywood hits' },
  { label: 'Lofi Beats', color: '#1e3264', query: 'lofi hindi chill' },
  { label: 'Devotional', color: '#2d5016', query: 'devotional bhajan hindi' },
];

function formatDur(s) {
  if (!s) return '';
  return `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`;
}

const _searchCache = {};

export default function Search() {
  const { currentSong, isPlaying, playSong } = usePlayer();
  const setAddToPlaylistSong = usePlayerStore(s => s.setAddToPlaylistSong);
  const [searchParams, setSearchParams] = useSearchParams();

  const [query, setQuery] = useState(searchParams.get('q') || '');
  const [results, setResults] = useState([]);
  const [status, setStatus] = useState('idle'); // idle | searching | done | error
  const [errorMsg, setErrorMsg] = useState('');
  const debounceRef = useRef(null);
  const abortRef = useRef(null);
  const inputRef = useRef(null);

  const doSearch = useCallback(async (q) => {
    if (!q.trim()) { setResults([]); setStatus('idle'); return; }

    // Offline check
    if (!navigator.onLine) {
      setStatus('error');
      setErrorMsg('No internet connection. Please check your network.');
      return;
    }

    // Cache check — instant results for repeat queries
    if (_searchCache[q]) {
      setResults(_searchCache[q]);
      setStatus('done');
      return;
    }

    // Abort in-flight request
    abortRef.current?.abort();
    abortRef.current = { aborted: false, abort() { this.aborted = true; } };
    const token = abortRef.current;

    setStatus('searching');
    setErrorMsg('');
    // Results clear nahi karo — purane results tab tak dikhe jab tak naye na aayein

    try {
      const songs = await searchSongs(q, 25);
      if (token.aborted) return;
      _searchCache[q] = songs; // cache kar lo
      setResults(songs);
      setStatus('done');
    } catch (err) {
      if (token.aborted) return;
      console.error('[Search error]', err);
      // Give helpful error message based on error type
      if (err.name === 'AbortError' || err.message?.includes('abort')) {
        setStatus('idle');
      } else if (err.message?.includes('fetch') || err.message?.includes('network') || err.message?.includes('Failed')) {
        setErrorMsg('Could not reach JioSaavn API. The server may be waking up — try again in a few seconds.');
        setStatus('error');
      } else {
        setErrorMsg(`Search error: ${err.message}`);
        setStatus('error');
      }
    }
  }, []);

  useEffect(() => {
    clearTimeout(debounceRef.current);
    if (!query.trim()) { setResults([]); setStatus('idle'); setSearchParams({}); return; }
    setStatus('searching'); // immediate feedback
    setSearchParams({ q: query });
    debounceRef.current = setTimeout(() => doSearch(query), 450);
    return () => clearTimeout(debounceRef.current);
  }, [query, doSearch, setSearchParams]);

  const clear = () => { setQuery(''); setResults([]); setStatus('idle'); setSearchParams({}); inputRef.current?.focus(); };

  const handlePlay = (song) => {
    playSong(song, { id: 'search-results', songs: results, title: 'Search Results' });
  };

  return (
    <div className="page" style={{ background: '#121212' }}>
      <div style={{ padding: '52px 16px 0' }}>
        <h1 style={{ fontSize: 22, fontWeight: 800, marginBottom: 16 }}>Search</h1>

        {/* Search input */}
        <div style={{ position: 'relative', marginBottom: 20 }}>
          <svg width="17" height="17" viewBox="0 0 24 24" fill="none"
            style={{ position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none', zIndex: 1 }}>
            <circle cx="11" cy="11" r="8" stroke="#121212" strokeWidth="2.5"/>
            <path d="M21 21l-4.35-4.35" stroke="#121212" strokeWidth="2.5" strokeLinecap="round"/>
          </svg>
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={e => {
              setQuery(e.target.value);
              if (e.target.value.trim()) setStatus('searching');
              else setStatus('idle');
            }}
            placeholder="Songs, artists..."
            autoCorrect="off"
            autoCapitalize="off"
            spellCheck={false}
            style={{
              width: '100%', height: 48, borderRadius: 6, border: 'none',
              background: '#fff', color: '#121212', fontSize: 15, fontWeight: 500,
              padding: '0 44px', outline: 'none', fontFamily: 'inherit',
            }}
          />
          {query && (
            <button onClick={clear}
              style={{ position: 'absolute', right: 14, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', padding: 4 }}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#121212" strokeWidth="2.5" strokeLinecap="round">
                <path d="M18 6L6 18M6 6l12 12"/>
              </svg>
            </button>
          )}
        </div>
      </div>

      {/* Status: Searching */}
      {status === 'searching' && (
        <div style={{ padding: '0 16px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
            <div style={{ width: 18, height: 18, borderRadius: '50%', border: '2px solid #333', borderTop: '2px solid #1DB954', animation: 'spin 0.7s linear infinite', flexShrink: 0 }} />
            <span style={{ fontSize: 13, color: '#b3b3b3' }}>Searching Geet...</span>
          </div>
          {[1,2,3,4,5].map(i => (
            <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '8px 0' }}>
              <div style={{ width: 50, height: 50, borderRadius: 4, background: 'rgba(255,255,255,0.06)', flexShrink: 0, animation: 'shimmer 1.4s ease-in-out infinite' }} />
              <div style={{ flex: 1 }}>
                <div style={{ height: 13, borderRadius: 6, background: 'rgba(255,255,255,0.06)', marginBottom: 8, width: '65%', animation: 'shimmer 1.4s ease-in-out infinite' }} />
                <div style={{ height: 11, borderRadius: 6, background: 'rgba(255,255,255,0.04)', width: '40%', animation: 'shimmer 1.4s ease-in-out infinite' }} />
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Status: Error */}
      {status === 'error' && (
        <div style={{ margin: '0 16px 16px', padding: '14px 16px', background: 'rgba(241,94,108,0.1)', border: '1px solid rgba(241,94,108,0.3)', borderRadius: 8 }}>
          <div style={{ fontSize: 13, color: '#f15e6c', marginBottom: 8 }}>{errorMsg}</div>
          <button onClick={() => doSearch(query)}
            style={{ fontSize: 12, fontWeight: 700, color: '#1DB954', background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}>
            Try again →
          </button>
        </div>
      )}

      {/* Results */}
      {status === 'done' && results.length > 0 && (
        <div style={{ padding: '0 16px' }}>
          <div style={{ fontSize: 12, color: '#727272', fontWeight: 600, marginBottom: 12 }}>
            {results.length} results for "{query}"
          </div>
          {results.map((song) => (
            <div key={song.id} style={{ margin: '0 -8px' }}>
              <SongRow
                song={song}
                isActive={currentSong?.id === song.id}
                isPlaying={isPlaying}
                onClick={() => handlePlay(song)}
                onAddToPlaylist={(s) => setAddToPlaylistSong(s)}
              />
            </div>
          ))}
        </div>
      )}

      {/* No results */}
      {status === 'done' && results.length === 0 && (
        <div style={{ textAlign: 'center', padding: '60px 24px' }}>
          <div style={{ fontSize: 46, marginBottom: 16 }}>🎵</div>
          <div style={{ fontSize: 20, fontWeight: 800, marginBottom: 8 }}>No results found</div>
          <div style={{ fontSize: 14, color: '#b3b3b3' }}>Try a different search</div>
        </div>
      )}

      {/* Browse — shown when no query */}
      {status === 'idle' && (
        <div style={{ padding: '0 16px' }}>
          <div style={{ fontSize: 16, fontWeight: 700, marginBottom: 12 }}>Browse categories</div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
            {CATEGORIES.map(cat => (
              <button key={cat.label} onClick={() => setQuery(cat.query)}
                style={{ height: 96, borderRadius: 8, background: cat.color, border: 'none', cursor: 'pointer', textAlign: 'left', padding: 14, position: 'relative', overflow: 'hidden' }}>
                <span style={{ fontSize: 14, fontWeight: 800, color: '#fff', display: 'block', lineHeight: 1.3, position: 'relative', zIndex: 1 }}>{cat.label}</span>
                <span style={{ position: 'absolute', bottom: -10, right: -4, fontSize: 60, transform: 'rotate(20deg)', opacity: 0.5, pointerEvents: 'none' }}>🎵</span>
              </button>
            ))}
          </div>
          <div style={{ height: 20 }} />
        </div>
      )}

      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
        @keyframes shimmer {
          0%, 100% { opacity: 0.4; }
          50% { opacity: 1; }
        }
      `}</style>
    </div>
  );
}
