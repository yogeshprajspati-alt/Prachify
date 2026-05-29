import React, { useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { usePlayerEngine } from './hooks/usePlayer';
import { usePWAInstall } from './hooks/usePWAInstall';
import Navbar from './components/Navbar';
import BottomPlayer from './components/BottomPlayer';
import InstallPrompt from './components/InstallPrompt';
import AddToPlaylistModal from './components/AddToPlaylistModal';
import usePlayerStore from './store/playerStore';
import Home from './pages/Home';
import Search from './pages/Search';
import Library from './pages/Library';
import PlaylistPage from './pages/PlaylistPage';
import Explore from './pages/Explore';
import ArtistPage from './pages/ArtistPage';
import { useOnlineStatus } from './hooks/useOnlineStatus';
import useChatStore from './store/chatStore';
import './styles/globals.css';

const HannahChat = React.lazy(() => import('./components/HannahChat'));

export default function App() {
  usePlayerEngine();
  const isOnline = useOnlineStatus();
  const { canInstall, showModal, install, dismiss } = usePWAInstall();
  const addToPlaylistSong = usePlayerStore(s => s.addToPlaylistSong);
  const setAddToPlaylistSong = usePlayerStore(s => s.setAddToPlaylistSong);
  const hydrateLikedFromDB = usePlayerStore(s => s.hydrateLikedFromDB);
  const hydratePlaylistsFromDB = usePlayerStore(s => s.hydratePlaylistsFromDB);

  // On startup: sync from Supabase (overrides localStorage if DB available)
  useEffect(() => {
    hydrateLikedFromDB();
    hydratePlaylistsFromDB();
  }, [hydrateLikedFromDB, hydratePlaylistsFromDB]);

  return (
    <Router>
      <div style={{ display: 'flex', flexDirection: 'column', minHeight: '100dvh', background: '#121212' }}>
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
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/search" element={<Search />} />
          <Route path="/explore" element={<Explore />} />
          <Route path="/library" element={<Library />} />
          <Route path="/playlist/:id" element={<PlaylistPage />} />
          <Route path="/artist/:artistName" element={<ArtistPage />} />
        </Routes>
        <BottomPlayer />
        <Navbar />
        <InstallPrompt show={showModal} canInstall={canInstall} onInstall={install} onDismiss={dismiss} />
        <AddToPlaylistModal
          show={!!addToPlaylistSong}
          song={addToPlaylistSong}
          onClose={() => setAddToPlaylistSong(null)}
        />

        {/* Hannah Chat FAB */}
        <button
          onClick={() => useChatStore.getState().toggleChat()}
          style={{
            position: 'fixed',
            bottom: 120, // above bottom player
            right: 16,
            width: 54,
            height: 54,
            borderRadius: '50%',
            background: '#282828',
            border: '1px solid rgba(255, 255, 255, 0.1)',
            boxShadow: '0 8px 24px rgba(0, 0, 0, 0.5)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            cursor: 'pointer',
            zIndex: 150,
            transition: 'transform 0.2s',
          }}
          onMouseDown={e => e.currentTarget.style.transform = 'scale(0.9)'}
          onMouseUp={e => e.currentTarget.style.transform = 'scale(1)'}
          onTouchStart={e => e.currentTarget.style.transform = 'scale(0.9)'}
          onTouchEnd={e => e.currentTarget.style.transform = 'scale(1)'}
        >
          <span style={{ fontSize: 28, lineHeight: 1, filter: 'drop-shadow(0 2px 4px rgba(0,0,0,0.1))', transform: 'translateY(-1px)' }}>
            🌸
          </span>
        </button>

        {/* Lazy Loaded Chat Interface */}
        <React.Suspense fallback={null}>
          <HannahChat />
        </React.Suspense>

      </div>
    </Router>
  );
}
