import React, { useEffect, Suspense, Component } from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { usePlayerEngine, usePlayer } from './hooks/usePlayer';
import { usePWAInstall } from './hooks/usePWAInstall';
import Navbar from './components/Navbar';
import BottomPlayer from './components/BottomPlayer';
import InstallPrompt from './components/InstallPrompt';
import AddToPlaylistModal from './components/AddToPlaylistModal';
import ProfileSelector from './components/ProfileSelector';
import usePlayerStore, { loadProfileState } from './store/playerStore';
import useProfileStore from './store/profileStore';
import { useOnlineStatus } from './hooks/useOnlineStatus';
import useChatStore from './store/chatStore';
import './styles/globals.css';
// P0: import offlineManager to initialize its singleton event listeners
import { onOnlineChange } from './utils/offlineManager.js';
import { fetchChapriBlocklist } from './utils/languageFilter.js';
import { logEvent } from './utils/errorBus.js';
import { showToast, dismissToast } from './utils/toast.js';
import { getCacheStats } from './utils/lruCache.js';
import { useRegisterSW } from 'virtual:pwa-register/react';

class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    console.error('[ErrorBoundary caught error]', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div style={{
          minHeight: '100dvh', background: '#121212', color: '#fff',
          display: 'flex', flexDirection: 'column', alignItems: 'center',
          justifyContent: 'center', padding: 24, textAlign: 'center',
        }}>
          <div style={{ fontSize: 48, marginBottom: 16 }}>⚡</div>
          <h2 style={{ fontSize: 20, fontWeight: 800, marginBottom: 8 }}>Something went wrong</h2>
          <p style={{ fontSize: 14, color: '#b3b3b3', marginBottom: 24, maxWidth: 320 }}>
            An unexpected error occurred while loading this view.
          </p>
          <button
            onClick={() => window.location.reload()}
            style={{
              background: '#1DB954', color: '#000', border: 'none',
              borderRadius: 24, padding: '12px 28px', fontWeight: 700,
              fontSize: 14, cursor: 'pointer', fontFamily: 'inherit',
            }}
          >
            Reload App
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}

function PWABanner() {
  const {
    needRefresh: [needRefresh, setNeedRefresh],
    updateServiceWorker,
  } = useRegisterSW({
    onRegistered(r) {},
    onRegisterError(error) {
      console.error('SW registration error', error);
    },
  });

  if (!needRefresh) return null;

  return (
    <div style={{
      position: 'fixed', top: 16, left: '50%', transform: 'translateX(-50%)', zIndex: 9999,
      background: '#282828', padding: '12px 20px', borderRadius: 8,
      display: 'flex', alignItems: 'center', gap: 16, boxShadow: '0 8px 32px rgba(0,0,0,0.5)',
      border: '1px solid rgba(255,255,255,0.1)', color: '#fff', fontSize: 14
    }}>
      <span>A new version is available!</span>
      <button 
        onClick={() => updateServiceWorker(true)}
        style={{
          background: '#fff', color: '#000', border: 'none', padding: '6px 16px',
          borderRadius: 20, fontWeight: 700, cursor: 'pointer', fontSize: 13
        }}
      >
        Update
      </button>
      <button onClick={() => setNeedRefresh(false)} style={{ background: 'transparent', border: 'none', color: 'rgba(255,255,255,0.5)', cursor: 'pointer', padding: 0 }}>✕</button>
    </div>
  );
}

// § final.md §G.8 — Proactively check storage quota on startup
async function checkStorageQuota() {
  if (!navigator.storage?.estimate) return;
  try {
    const { usage, quota } = await navigator.storage.estimate();
    const usedPercent = (usage / quota) * 100;
    if (usedPercent > 80) {
      logEvent('storage_pressure', { usedPercent: usedPercent.toFixed(1) });
      showToast('Storage space is low. Clearing cache may be needed soon.');
    }
  } catch {
    // non-critical — ignore
  }
}

// TASK-01: Lazy-load all route pages — each becomes a separate JS chunk.
// BottomPlayer, Navbar, modals stay static (always needed immediately).
const Home         = React.lazy(() => import('./pages/Home'));
const Search       = React.lazy(() => import('./pages/Search'));
const Library      = React.lazy(() => import('./pages/Library'));
const PlaylistPage = React.lazy(() => import('./pages/PlaylistPage'));
const Explore      = React.lazy(() => import('./pages/Explore'));
const ArtistPage   = React.lazy(() => import('./pages/ArtistPage'));
// HannahChat is 39KB — lazy-load it so it doesn't bloat the initial bundle
const HannahChat   = React.lazy(() => import('./components/HannahChat'));

function GlobalShortcuts() {
  const { togglePlay, next, prev } = usePlayer();
  
  useEffect(() => {
    const handleKeyDown = (e) => {
      // Allow shortcut if pressing Alt+H or Cmd+K or Ctrl+H
      if ((e.code === 'KeyH' && (e.ctrlKey || e.altKey)) || (e.code === 'KeyK' && (e.ctrlKey || e.metaKey))) {
        e.preventDefault();
        useChatStore.getState().toggleChat();
        return;
      }

      if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA' || e.target.isContentEditable) return;
      
      if (e.code === 'Space') {
        e.preventDefault();
        togglePlay();
      } else if (e.code === 'ArrowRight' && e.ctrlKey) {
        e.preventDefault();
        next();
      } else if (e.code === 'ArrowLeft' && e.ctrlKey) {
        e.preventDefault();
        prev();
      }
    };
    
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [togglePlay, next, prev]);
  
  return null;
}

function DraggableHannahFab() {
  const toggleChat = useChatStore(s => s.toggleChat);
  const isChatOpen = useChatStore(s => s.isOpen);

  // Initial position: bottom right (above bottom player)
  const [pos, setPos] = React.useState(() => ({
    x: Math.max(16, (window.innerWidth || 360) - 70),
    y: Math.max(100, (window.innerHeight || 640) - 170),
  }));

  const isDragging = React.useRef(false);
  const dragStartPos = React.useRef({ x: 0, y: 0 });
  const elementStartPos = React.useRef({ x: 0, y: 0 });
  const hasMoved = React.useRef(false);

  // Update bounds if window resizes
  React.useEffect(() => {
    const handleResize = () => {
      setPos(prev => ({
        x: Math.min(Math.max(10, prev.x), window.innerWidth - 64),
        y: Math.min(Math.max(10, prev.y), window.innerHeight - 64),
      }));
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const handleStart = (clientX, clientY) => {
    isDragging.current = true;
    hasMoved.current = false;
    dragStartPos.current = { x: clientX, y: clientY };
    elementStartPos.current = { ...pos };
  };

  const handleMove = (clientX, clientY) => {
    if (!isDragging.current) return;
    const dx = clientX - dragStartPos.current.x;
    const dy = clientY - dragStartPos.current.y;

    if (Math.abs(dx) > 4 || Math.abs(dy) > 4) {
      hasMoved.current = true;
    }

    if (hasMoved.current) {
      const newX = Math.min(Math.max(10, elementStartPos.current.x + dx), window.innerWidth - 64);
      const newY = Math.min(Math.max(10, elementStartPos.current.y + dy), window.innerHeight - 64);
      setPos({ x: newX, y: newY });
    }
  };

  const handleEnd = () => {
    if (!isDragging.current) return;
    isDragging.current = false;
  };

  const handleClick = (e) => {
    if (hasMoved.current) {
      e.stopPropagation();
      e.preventDefault();
      return;
    }
    toggleChat();
  };

  if (isChatOpen) return null;

  return (
    <div
      onClick={handleClick}
      onMouseDown={e => handleStart(e.clientX, e.clientY)}
      onTouchStart={e => {
        if (e.touches[0]) handleStart(e.touches[0].clientX, e.touches[0].clientY);
      }}
      onMouseMove={e => handleMove(e.clientX, e.clientY)}
      onMouseUp={handleEnd}
      onMouseLeave={handleEnd}
      onTouchMove={e => {
        if (e.touches[0]) handleMove(e.touches[0].clientX, e.touches[0].clientY);
      }}
      onTouchEnd={handleEnd}
      title="Ask Hannah AI (Alt+H)"
      style={{
        position: 'fixed',
        left: pos.x,
        top: pos.y,
        width: 58,
        height: 58,
        borderRadius: '50%',
        background: 'linear-gradient(135deg, #ff4fa3 0%, #a855f7 50%, #3b82f6 100%)',
        padding: 3,
        boxShadow: '0 10px 32px rgba(255, 79, 163, 0.55), 0 0 24px rgba(168, 85, 247, 0.45)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        cursor: isDragging.current ? 'grabbing' : 'grab',
        zIndex: 9900,
        touchAction: 'none',
        userSelect: 'none',
        WebkitUserSelect: 'none',
        transition: isDragging.current ? 'none' : 'transform 0.2s ease, box-shadow 0.2s ease',
      }}
    >
      <div style={{
        position: 'relative',
        width: '100%',
        height: '100%',
        borderRadius: '50%',
        overflow: 'hidden',
        background: '#0e0b18',
      }}>
        <img
          src="/hannah-avatar.png"
          alt="Hannah AI"
          draggable={false}
          onError={e => e.currentTarget.style.display = 'none'}
          style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: '50%', pointerEvents: 'none' }}
        />
        {/* Pulsating green online dot badge */}
        <span style={{
          position: 'absolute', bottom: 2, right: 2,
          width: 10, height: 10, borderRadius: '50%',
          background: '#10b981', border: '2px solid #0e0b18',
          boxShadow: '0 0 8px #10b981',
          pointerEvents: 'none',
        }} />
      </div>
    </div>
  );
}

export default function App() {
  usePlayerEngine();
  const isOnline = useOnlineStatus();
  const { canInstall, showModal, install, dismiss } = usePWAInstall();
  const addToPlaylistSong = usePlayerStore(s => s.addToPlaylistSong);
  const setAddToPlaylistSong = usePlayerStore(s => s.setAddToPlaylistSong);
  const hydrateLikedFromDB = usePlayerStore(s => s.hydrateLikedFromDB);
  const hydratePlaylistsFromDB = usePlayerStore(s => s.hydratePlaylistsFromDB);
  const hydrateSharedPlaylistFromDB = usePlayerStore(s => s.hydrateSharedPlaylistFromDB);
  const pruneSkippedSongs = usePlayerStore(s => s.pruneSkippedSongs);
  const activeProfileId = useProfileStore(s => s.activeProfileId);
  const hydratePinsFromDB = useProfileStore(s => s.hydratePinsFromDB);

  // Fetch custom PINs on app boot
  useEffect(() => {
    hydratePinsFromDB();
  }, [hydratePinsFromDB]);

  // On startup or profile switch: load profile player state + sync from Supabase
  useEffect(() => {
    if (!activeProfileId) return; // wait until a profile is chosen
    loadProfileState(activeProfileId);
    hydrateLikedFromDB();
    hydratePlaylistsFromDB();
    hydrateSharedPlaylistFromDB(); // no-op for Guest — see profileStore.js
    pruneSkippedSongs(); // TASK-14: cap skippedSongs to prevent localStorage bloat
    checkStorageQuota(); // § final.md §G.8
    fetchChapriBlocklist(); // § final.md §1.2 — populate the community blocklist once
  }, [activeProfileId, hydrateLikedFromDB, hydratePlaylistsFromDB, hydrateSharedPlaylistFromDB, pruneSkippedSongs]);

  // § final.md §12 — Offline banner (persistent toast on disconnect)
  useEffect(() => {
    return onOnlineChange((online) => {
      if (!online) {
        showToast("You're offline — playback continues from cache", { persist: true, id: 'offline-banner' });
      } else {
        dismissToast('offline-banner');
      }
    });
  }, []);

  // § final.md §3.1 — Log cache stats before tab is hidden (understand cache state before memory loss)
  useEffect(() => {
    const handleHide = () => {
      if (document.visibilityState === 'hidden') {
        logEvent('cache_stats_on_hide', getCacheStats());
      }
    };
    document.addEventListener('visibilitychange', handleHide);
    return () => document.removeEventListener('visibilitychange', handleHide);
  }, []);

  // Netflix-style "who's listening?" gate — nothing else renders until a
  // profile is picked, so no data ever gets read/written to the wrong slot.
  if (!activeProfileId) {
    return <ProfileSelector />;
  }

  return (
    <ErrorBoundary>
      <Router>
        <div className="app-container">
          {!isOnline && (
            <div style={{
              position: 'fixed', top: 0, left: 0, right: 0, zIndex: 9999,
              background: '#b91c1c',
              padding: '10px 16px',
              display: 'flex', alignItems: 'center', gap: 10,
              fontSize: 13, fontWeight: 600, color: '#fff',
              animation: 'slideDown 0.3s ease',
            }}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.5" strokeLinecap="round">
                <line x1="1" y1="1" x2="23" y2="23" />
                <path d="M16.72 11.06A10.94 10.94 0 0 1 19 12.55M5 12.55a10.94 10.94 0 0 1 5.17-2.39M10.71 5.05A16 16 0 0 1 22.56 9M1.42 9a15.91 15.91 0 0 1 4.7-2.88M8.53 16.11a6 6 0 0 1 6.95 0M12 20h.01" />
              </svg>
              No internet — currently playing song will continue
            </div>
          )}
          {/* TASK-01: Suspense wraps all lazy route pages — null fallback means no flash */}
          <main style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0 }}>
            <Suspense fallback={null}>
              <Routes>
                <Route path="/" element={<Home />} />
                <Route path="/search" element={<Search />} />
                <Route path="/explore" element={<Explore />} />
                <Route path="/library" element={<Library />} />
                <Route path="/playlist/:id" element={<PlaylistPage />} />
                <Route path="/artist/:artistName" element={<ArtistPage />} />
              </Routes>
            </Suspense>
          </main>
          <BottomPlayer />
          <Navbar />
          <PWABanner />
          <GlobalShortcuts />
          <InstallPrompt show={showModal} canInstall={canInstall} onInstall={install} onDismiss={dismiss} />
          <AddToPlaylistModal
            show={!!addToPlaylistSong}
            song={addToPlaylistSong}
            onClose={() => setAddToPlaylistSong(null)}
          />

          {/* Draggable Hannah Chat Floating Bubble */}
          <DraggableHannahFab />

          {/* Lazy Loaded Chat Interface */}
          <Suspense fallback={null}>
            <HannahChat />
          </Suspense>

        </div>
      </Router>
    </ErrorBoundary>
  );
}
