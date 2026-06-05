import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { usePlayer } from '../hooks/usePlayer';
import usePlayerStore from '../store/playerStore';
import { searchSongs, searchArtists } from '../services/jiosaavn';
import SongRow from '../components/SongRow';
import { createCache, normalizeKey, limits } from '../utils/lruCache.js';
import { shouldBypassFilter, filterSongsByLanguage } from '../utils/languageFilter.js';
import { optimizeWithCancel } from '../services/aiSearch.js';
import { getOnlineStatus } from '../utils/offlineManager.js';

const SONG_CATEGORIES = [
  { label: 'Bollywood', gradient: 'linear-gradient(135deg, #8A2387, #E94057)', query: 'latest bollywood hits premium' },
  { label: 'Trending Hindi', gradient: 'linear-gradient(135deg, #f12711, #f5af19)', query: 'trending hindi chartbusters' },
  { label: 'Romantic', gradient: 'linear-gradient(135deg, #FF416C, #FF4B2B)', query: 'romantic bollywood love hits' },
  { label: 'Punjabi Hits', gradient: 'linear-gradient(135deg, #F09819, #ff5858)', query: 'top punjabi chartbusters' },
  { label: 'Global English', gradient: 'linear-gradient(135deg, #11998e, #38ef7d)', query: 'global top 50 english pop' },
  { label: 'English Chill', gradient: 'linear-gradient(135deg, #36D1DC, #5B86E5)', query: 'chill pop hits' },
  { label: 'Sad Songs', gradient: 'linear-gradient(135deg, #141E30, #243B55)', query: 'emotional bollywood sad hits' },
  { label: 'Party', gradient: 'linear-gradient(135deg, #8E2DE2, #4A00E0)', query: 'party anthems bollywood hits' },
  { label: 'Old is Gold', gradient: 'linear-gradient(135deg, #3CA55C, #B5AC49)', query: 'evergreen hindi classics hd' },
  { label: '90s Hindi', gradient: 'linear-gradient(135deg, #FF8008, #FFC837)', query: '90s bollywood superhits' },
  { label: 'Desi Hip Hop', gradient: 'linear-gradient(135deg, #ee0979, #ff6a00)', query: 'desi hip hop top hits' },
  { label: 'Haryanvi Swagger', gradient: 'linear-gradient(135deg, #ff9966, #ff5e62)', query: 'haryanvi top chartbusters' },
  { label: 'Workout English', gradient: 'linear-gradient(135deg, #0F2027, #203A43, #2C5364)', query: 'workout energetic hits' },
  { label: 'Lofi Beats', gradient: 'linear-gradient(135deg, #2c3e50, #3498db)', query: 'lofi bollywood aesthetic' },
  { label: 'Sufi & Ghazals', gradient: 'linear-gradient(135deg, #DCE35B, #45B649)', query: 'sufi rock fusion premium' },
  { label: 'Devotional', gradient: 'linear-gradient(135deg, #e65c00, #F9D423)', query: 'soothing divine chants premium' },
];

const ARTIST_CATEGORIES = [
  { label: 'Lata Mangeshkar', image: 'https://c.saavncdn.com/artists/Lata_Mangeshkar_004_20230623105323_500x500.jpg' },
  { label: 'Kishore Kumar', image: 'https://c.saavncdn.com/artists/Kishore_Kumar_500x500.jpg' },
  { label: 'Arijit Singh', image: 'https://c.saavncdn.com/artists/Arijit_Singh_004_20241118063717_500x500.jpg' },
  { label: 'AP Dhillon', image: 'https://c.saavncdn.com/artists/AP_Dhillon_004_20251023102150_500x500.jpg' },
  { label: 'AR Rahman', image: 'https://c.saavncdn.com/artists/AR_Rahman_002_20210120084455_500x500.jpg' },
  { label: 'Atif Aslam', image: 'https://www.jiosaavn.com/_i/3.0/artist-default-music.png' },
  { label: 'Shreya Ghoshal', image: 'https://c.saavncdn.com/artists/Shreya_Ghoshal_007_20241101074144_500x500.jpg' },
  { label: 'Diljit Dosanjh', image: 'https://c.saavncdn.com/artists/Diljit_Dosanjh_005_20231025073054_500x500.jpg' },
  { label: 'Darshan Raval', image: 'https://c.saavncdn.com/artists/Darshan_Raval_006_20250807060352_500x500.jpg' },
  { label: 'Badshah', image: 'https://c.saavncdn.com/artists/Badshah_006_20241118064015_500x500.jpg' },
  { label: 'Neha Kakkar', image: 'https://c.saavncdn.com/artists/Neha_Kakkar_007_20241212115832_500x500.jpg' },
  { label: 'KK', image: 'https://c.saavncdn.com/artists/KK_500x500.jpg' },
  { label: 'Honey Singh', image: 'https://c.saavncdn.com/artists/Yo_Yo_Honey_Singh_002_20221216102650_500x500.jpg' },
  { label: 'B Praak', image: 'https://c.saavncdn.com/artists/B_Praak_001_20191118112005_500x500.jpg' },
  { label: 'Udit Narayan', image: 'https://c.saavncdn.com/artists/Udit_Narayan_004_20241029065120_500x500.jpg' },
  { label: 'Alka Yagnik', image: 'https://c.saavncdn.com/artists/Alka_Yagnik_002_20220314192930_500x500.jpg' },
  { label: 'Sonu Nigam', image: 'https://c.saavncdn.com/artists/Sonu_Nigam_500x500.jpg' },
  { label: 'Mohammed Rafi', image: 'https://c.saavncdn.com/artists/Mohammed_Rafi_500x500.jpg' },
  { label: 'Mukesh', image: 'https://c.saavncdn.com/artists/Mukesh_500x500.jpg' },
  { label: 'Kumar Sanu', image: 'https://c.saavncdn.com/artists/Kumar_Sanu_500x500.jpg' },
  { label: 'Sunidhi Chauhan', image: 'https://c.saavncdn.com/artists/Sunidhi_Chauhan_005_20250515061617_500x500.jpg' },
  { label: 'Javed Ali', image: 'https://c.saavncdn.com/artists/Javed_Ali_005_20240516065846_500x500.jpg' },
  { label: 'Mohit Chauhan', image: 'https://c.saavncdn.com/artists/Mohit_Chauhan_500x500.jpg' },
  { label: 'Shaan', image: 'https://c.saavncdn.com/artists/Shaan_004_20250422120221_500x500.jpg' },
  { label: 'Kailash Kher', image: 'https://c.saavncdn.com/artists/Kailash_Kher_003_20200114120508_500x500.jpg' },
  { label: 'Armaan Malik', image: 'https://c.saavncdn.com/artists/Armaan_Malik_005_20240819091627_500x500.jpg' },
  { label: 'Jubin Nautiyal', image: 'https://c.saavncdn.com/artists/Jubin_Nautiyal_003_20231130204020_500x500.jpg' },
  { label: 'Guru Randhawa', image: 'https://c.saavncdn.com/artists/Guru_Randhawa_004_20250701125845_500x500.jpg' },
  { label: 'Harrdy Sandhu', image: 'https://c.saavncdn.com/artists/Hardy_Sandhu_001_20190913112018_500x500.jpg' },
  { label: 'Mika Singh', image: 'https://c.saavncdn.com/artists/Mika_Singh_003_20250321072715_500x500.jpg' },
  { label: 'Daler Mehndi', image: 'https://c.saavncdn.com/artists/Daler_Mehndi_500x500.jpg' },
  { label: 'Pritam', image: 'https://c.saavncdn.com/artists/Pritam_Chakraborty-20170711073326_500x500.jpg' },
  { label: 'Vishal-Shekhar', image: 'https://c.saavncdn.com/artists/Vishal-Shekhar_20191130071357_500x500.jpg' },
  { label: 'Shankar Mahadevan', image: 'https://c.saavncdn.com/artists/Shankar_Mahadevan_500x500.jpg' },
  { label: 'Hariharan', image: 'https://c.saavncdn.com/artists/Hariharan_500x500.jpg' },
  { label: 'K. S. Chithra', image: 'https://c.saavncdn.com/artists/K_S_Chithra_002_20190906071921_500x500.jpg' },
  { label: 'S. P. Balasubrahmanyam', image: 'https://c.saavncdn.com/artists/S_P_Balasubrahmanyam_500x500.jpg' },
  { label: 'Anu Malik', image: 'https://c.saavncdn.com/artists/Anu_Malik_500x500.jpg' },
  { label: 'Bappi Lahiri', image: 'https://c.saavncdn.com/artists/Bappi_Lahiri_003_20220216115108_500x500.jpg' },
  { label: 'Ammy Virk', image: 'https://c.saavncdn.com/artists/Ammy_Virk_005_20241101070506_500x500.jpg' },
  { label: 'Garry Sandhu', image: 'https://c.saavncdn.com/artists/Garry_Sandhu_500x500.jpg' },
  { label: 'Sidhu Moose Wala', image: 'https://c.saavncdn.com/artists/Sidhu_Moose_Wala_004_20250617183705_500x500.jpg' },
  { label: 'Karan Aujla', image: 'https://c.saavncdn.com/artists/Karan_Aujla_003_20260218102828_500x500.jpg' },
  { label: 'Parmish Verma', image: 'https://c.saavncdn.com/artists/Parmish_Verma_001_20240220103750_500x500.jpg' },
  { label: 'Jass Manak', image: 'https://c.saavncdn.com/artists/Jass_Manak_001_20240119064204_500x500.jpg' },
  { label: 'Mankirt Aulakh', image: 'https://c.saavncdn.com/artists/Mankirt_Aulakh_007_20260522100331_500x500.jpg' },
  { label: 'Gippy Grewal', image: 'https://c.saavncdn.com/artists/Gippy_Grewal_004_20191118143844_500x500.jpg' },
  { label: 'Fazilpuria', image: 'https://c.saavncdn.com/artists/Fazilpuria_500x500.jpg' },
  { label: 'Renuka Panwar', image: 'https://c.saavncdn.com/artists/Renuka_Panwar_004_20240715112921_500x500.jpg' },
  { label: 'Taylor Swift', image: 'https://c.saavncdn.com/artists/Taylor_Swift_003_20200226074119_500x500.jpg' },
  { label: 'Ed Sheeran', image: 'https://c.saavncdn.com/artists/Ed_Sheeran_002_20250625073038_500x500.jpg' },
  { label: 'Justin Bieber', image: 'https://c.saavncdn.com/artists/Justin_Bieber_005_20201127112218_500x500.jpg' },
  { label: 'The Weeknd', image: 'https://c.saavncdn.com/artists/The_Weeknd_002_20241003071400_500x500.jpg' },
  { label: 'Dua Lipa', image: 'https://c.saavncdn.com/artists/Dua_Lipa_004_20231120090922_500x500.jpg' },
  { label: 'Ariana Grande', image: 'https://c.saavncdn.com/artists/Ariana_Grande_005_20201127111716_500x500.jpg' },
  { label: 'Billie Eilish', image: 'https://c.saavncdn.com/artists/Billie_Eilish_20190211151539_500x500.jpg' },
  { label: 'Post Malone', image: 'https://c.saavncdn.com/artists/Post_Malone_004_20190911070147_500x500.jpg' },
  { label: 'Drake', image: 'https://c.saavncdn.com/artists/Drake_006_20260520062317_500x500.jpg' },
  { label: 'Eminem', image: 'https://c.saavncdn.com/artists/Eminem_003_20240403152835_500x500.jpg' }
];

function formatDur(s) {
  if (!s) return '';
  return `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`;
}

// LRU caches replace plain {} objects — device-adaptive limits + eviction
const _searchCache = createCache('search', limits.search);
const _artistSearchCache = createCache('artistSearch', 20);

export default function Search() {
  const { currentSong, isPlaying, playSong } = usePlayer();
  const setAddToPlaylistSong = usePlayerStore(s => s.setAddToPlaylistSong);
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();

  const [searchType, setSearchType] = useState('songs'); // 'songs' | 'artists'
  const [visibleIdleArtists, setVisibleIdleArtists] = useState(20);
  const [query, setQuery] = useState(searchParams.get('q') || '');
  const [results, setResults] = useState([]);
  const [status, setStatus] = useState('idle'); // idle | searching | done | error
  const [errorMsg, setErrorMsg] = useState('');
  const [aiStatus, setAiStatus] = useState('idle'); // idle | loading | refined | error
  const [aiRefinedQuery, setAiRefinedQuery] = useState(''); // last AI-refined query shown as label
  
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);

  const debounceRef = useRef(null);
  const abortRef = useRef(null);
  const inputRef = useRef(null);

  const doSearch = useCallback(async (q) => {
    if (!q.trim()) { setResults([]); setStatus('idle'); return; }

    setPage(1);
    setHasMore(true);

    // Offline check — use offlineManager (more reliable than direct navigator.onLine)
    if (!getOnlineStatus()) {
      setStatus('error');
      setErrorMsg('No internet connection. Please check your network.');
      return;
    }

    // Language filter bypass check — if user explicitly asked for a blocked language, skip filter
    const bypass = shouldBypassFilter(q);

    // Cache check — instant results for repeat queries
    const cacheKey = normalizeKey(q);
    const cache = searchType === 'artists' ? _artistSearchCache : _searchCache;
    const cached = cache.get(cacheKey);
    if (cached) {
      setResults(cached);
      setPage(Math.ceil(cached.length / 25));
      if (cached.length % 25 !== 0) setHasMore(false);
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
      const data = searchType === 'artists' 
        ? await searchArtists(q, 25, 1) 
        : await searchSongs(q, 25, 1);
        
      if (token.aborted) return;
      // § final.md §1 — apply language filter to results (unless user bypassed it explicitly)
      const filtered = (searchType === 'songs' && !bypass) ? filterSongsByLanguage(data) : data;
      cache.set(cacheKey, filtered); // LRU cache
      setResults(filtered);
      if (data.length < 25) setHasMore(false);
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
  }, [searchType]);

  const handleLoadMore = () => {
    if (loadingMore || !hasMore) return;
    setLoadingMore(true);
    const nextPage = page + 1;
    const cache = searchType === 'artists' ? _artistSearchCache : _searchCache;
    const cacheKey = normalizeKey(query);

    const fetchPromise = searchType === 'artists' 
      ? searchArtists(query, 25, nextPage) 
      : searchSongs(query, 25, nextPage);

    fetchPromise
      .then(newResults => {
        if (newResults.length < 25) setHasMore(false);
        const existing = cache.get(cacheKey) || [];
        const combined = [...existing, ...newResults];
        cache.set(cacheKey, combined); // update LRU cache
        setResults(combined);
        setPage(nextPage);
      })
      .catch(err => console.error(err))
      .finally(() => setLoadingMore(false));
  };

  useEffect(() => {
    clearTimeout(debounceRef.current);
    if (!query.trim()) { setResults([]); setStatus('idle'); setSearchParams({}); return; }
    setStatus('searching'); // immediate feedback
    setSearchParams({ q: query });
    debounceRef.current = setTimeout(() => doSearch(query), 450);
    return () => clearTimeout(debounceRef.current);
  }, [query, searchType, doSearch, setSearchParams]);

  // AI ✨ button handler — 500ms debounce built into optimizeWithCancel
  const aiDebounceRef = useRef(null);
  const handleAISearch = useCallback(async () => {
    if (!query.trim()) return; // §2.4 — never send empty query
    if (!getOnlineStatus()) return; // §2.5 — offline guard
    if (aiStatus === 'loading') return;

    setAiStatus('loading');
    try {
      const { query: refined, wasRefined } = await optimizeWithCancel(query);
      if (wasRefined && refined !== query) {
        setAiRefinedQuery(refined);
        setQuery(refined);         // auto-execute refined query
        setAiStatus('refined');
      } else {
        setAiStatus('idle');       // no change — silent
      }
    } catch {
      setAiStatus('error');
      setTimeout(() => setAiStatus('idle'), 2000);
    }
  }, [query, aiStatus]);

  // Reset AI status when query changes manually
  useEffect(() => { setAiStatus('idle'); setAiRefinedQuery(''); }, [query]);

  const clear = () => { setQuery(''); setResults([]); setStatus('idle'); setSearchParams({}); setAiStatus('idle'); setAiRefinedQuery(''); inputRef.current?.focus(); };

  const handlePlay = (song) => {
    playSong(song, { id: 'search-results', songs: results, title: 'Search Results' });
  };

  return (
    <div className="page" style={{ background: '#121212' }}>
      <div style={{ padding: '52px 16px 0' }}>
        <h1 style={{ fontSize: 22, fontWeight: 800, marginBottom: 16 }}>Search</h1>

        {/* Search input */}
        <div style={{ position: 'relative', marginBottom: query ? 8 : 20 }}>
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

        {/* AI Search button row — visible when query is non-empty */}
        {query.trim() && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
            <button
              id="ai-search-btn"
              onClick={handleAISearch}
              disabled={aiStatus === 'loading' || !getOnlineStatus()}
              title={!getOnlineStatus() ? 'AI search requires internet' : 'Refine with AI'}
              style={{
                display: 'flex', alignItems: 'center', gap: 6,
                background: aiStatus === 'refined' ? 'rgba(29,185,84,0.15)' : 'rgba(255,255,255,0.08)',
                border: `1px solid ${aiStatus === 'refined' ? 'rgba(29,185,84,0.4)' : 'rgba(255,255,255,0.15)'}`,
                borderRadius: 24, padding: '5px 14px', cursor: aiStatus === 'loading' ? 'default' : 'pointer',
                fontSize: 13, fontWeight: 600, color: aiStatus === 'refined' ? '#1DB954' : '#fff',
                opacity: (!getOnlineStatus() || aiStatus === 'loading') ? 0.5 : 1,
                transition: 'all 0.2s', fontFamily: 'inherit',
              }}
            >
              {aiStatus === 'loading' ? (
                <div style={{ width: 12, height: 12, borderRadius: '50%', border: '2px solid #333', borderTop: '2px solid #1DB954', animation: 'spin 0.7s linear infinite' }} />
              ) : (
                <span style={{ fontSize: 14 }}>✨</span>
              )}
              {aiStatus === 'loading' ? 'Refining...' : aiStatus === 'refined' ? 'Refined by AI' : 'AI Search'}
            </button>
            {aiStatus === 'refined' && aiRefinedQuery && (
              <span style={{ fontSize: 12, color: '#b3b3b3' }}>
                Showing results for "{aiRefinedQuery}"
              </span>
            )}
          </div>
        )}

        
        {/* Toggle Songs/Artists */}
        <div style={{ display: 'flex', gap: 8, marginBottom: 20 }}>
          <button 
            onClick={() => { setSearchType('songs'); setResults([]); }}
            style={{ 
              background: searchType === 'songs' ? '#fff' : '#282828', 
              color: searchType === 'songs' ? '#000' : '#fff',
              border: 'none', borderRadius: 24, padding: '6px 16px', fontSize: 13, fontWeight: 600, cursor: 'pointer', transition: 'all 0.2s'
            }}>
            Songs
          </button>
          <button 
            onClick={() => { setSearchType('artists'); setResults([]); }}
            style={{ 
              background: searchType === 'artists' ? '#fff' : '#282828', 
              color: searchType === 'artists' ? '#000' : '#fff',
              border: 'none', borderRadius: 24, padding: '6px 16px', fontSize: 13, fontWeight: 600, cursor: 'pointer', transition: 'all 0.2s'
            }}>
            Artists
          </button>
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
          {searchType === 'songs' ? (
            results.map((song) => (
              <div key={song.id} style={{ margin: '0 -8px' }}>
                <SongRow
                  song={song}
                  isActive={currentSong?.id === song.id}
                  isPlaying={isPlaying}
                  onClick={() => handlePlay(song)}
                  onAddToPlaylist={(s) => setAddToPlaylistSong(s)}
                />
              </div>
            ))
          ) : (
            results.map((artist) => (
              <button
                key={artist.id}
                onClick={() => navigate(`/artist/${encodeURIComponent(artist.name)}`)}
                style={{ display: 'flex', alignItems: 'center', gap: 16, width: '100%', background: 'none', border: 'none', padding: '10px 0', cursor: 'pointer', textAlign: 'left', fontFamily: 'inherit' }}
              >
                <img src={artist.image} alt="" style={{ width: 64, height: 64, borderRadius: '50%', objectFit: 'cover', background: '#282828' }} onError={e => e.target.src = 'https://www.jiosaavn.com/_i/3.0/artist-default-music.png'} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 16, fontWeight: 600, color: '#fff', marginBottom: 4, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{artist.name}</div>
                  <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.6)' }}>Artist</div>
                </div>
              </button>
            ))
          )}
        </div>
      )}
      
      {/* Load More Button */}
      {status === 'done' && results.length > 0 && hasMore && (
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
          <div style={{ fontSize: 16, fontWeight: 700, marginBottom: 12 }}>
            {searchType === 'songs' ? 'Browse categories' : 'Popular artists'}
          </div>
          <div className="search-grid" style={{ gridTemplateColumns: searchType === 'artists' ? 'repeat(auto-fill, minmax(140px, 1fr))' : undefined, gap: searchType === 'artists' ? 24 : 16 }}>
            {searchType === 'songs' ? SONG_CATEGORIES.map(cat => (
              <button key={cat.label} onClick={() => setQuery(cat.query)}
                style={{ height: 110, borderRadius: 12, background: cat.gradient, border: 'none', cursor: 'pointer', textAlign: 'left', padding: '16px 20px', position: 'relative', overflow: 'hidden', boxShadow: '0 4px 14px rgba(0,0,0,0.2)', transition: 'all 0.2s', display: 'flex', alignItems: 'flex-start' }}
                onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-4px) scale(1.02)'; e.currentTarget.style.boxShadow = '0 8px 24px rgba(0,0,0,0.4)'; }}
                onMouseLeave={e => { e.currentTarget.style.transform = 'translateY(0) scale(1)'; e.currentTarget.style.boxShadow = '0 4px 14px rgba(0,0,0,0.2)'; }}
              >
                <span style={{ fontSize: 18, fontWeight: 900, color: '#fff', display: 'block', lineHeight: 1.2, position: 'relative', zIndex: 1, textShadow: '0 2px 4px rgba(0,0,0,0.3)' }}>{cat.label}</span>
                <span style={{ position: 'absolute', bottom: -12, right: -8, fontSize: 64, transform: 'rotate(20deg)', opacity: 0.3, pointerEvents: 'none' }}>🎵</span>
              </button>
            )) : ARTIST_CATEGORIES.slice(0, visibleIdleArtists).map(artist => (
              <button key={artist.label} onClick={() => navigate(`/artist/${encodeURIComponent(artist.label)}`)}
                style={{ background: 'none', border: 'none', cursor: 'pointer', textAlign: 'center', padding: '10px 0', transition: 'transform 0.2s', display: 'flex', flexDirection: 'column', alignItems: 'center' }}
                onMouseEnter={e => e.currentTarget.style.transform = 'scale(1.05)'}
                onMouseLeave={e => e.currentTarget.style.transform = 'scale(1)'}
              >
                <img src={artist.image} alt={artist.label} style={{ width: 140, height: 140, borderRadius: '50%', objectFit: 'cover', marginBottom: 12, boxShadow: '0 8px 24px rgba(0,0,0,0.5)', background: '#282828' }} onError={e => e.target.src = 'https://www.jiosaavn.com/_i/3.0/artist-default-music.png'} />
                <span style={{ fontSize: 14, fontWeight: 700, color: '#fff', display: 'block', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: '100%' }}>{artist.label}</span>
                <span style={{ fontSize: 12, color: 'rgba(255,255,255,0.6)', marginTop: 4 }}>Artist</span>
              </button>
            ))}
          </div>
          
          {searchType === 'artists' && visibleIdleArtists < ARTIST_CATEGORIES.length && (
            <div style={{ display: 'flex', justifyContent: 'center', margin: '32px 0 20px' }}>
              <button
                onClick={() => setVisibleIdleArtists(prev => prev + 20)}
                style={{ background: 'transparent', border: '1px solid rgba(255,255,255,0.3)', borderRadius: 24, padding: '10px 32px', color: '#fff', fontSize: 14, fontWeight: 600, cursor: 'pointer', transition: 'all 0.2s', fontFamily: 'inherit' }}
                onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,255,255,0.1)'}
                onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
              >
                Load more artists
              </button>
            </div>
          )}
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
