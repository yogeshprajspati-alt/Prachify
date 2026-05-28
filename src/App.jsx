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
import './styles/globals.css';

export default function App() {
  usePlayerEngine();
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
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/search" element={<Search />} />
          <Route path="/explore" element={<Explore />} />
          <Route path="/library" element={<Library />} />
          <Route path="/playlist/:id" element={<PlaylistPage />} />
        </Routes>
        <BottomPlayer />
        <Navbar />
        <InstallPrompt show={showModal} canInstall={canInstall} onInstall={install} onDismiss={dismiss} />
        <AddToPlaylistModal
          show={!!addToPlaylistSong}
          song={addToPlaylistSong}
          onClose={() => setAddToPlaylistSong(null)}
        />
      </div>
    </Router>
  );
}
