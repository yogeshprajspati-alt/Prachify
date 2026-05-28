import React from 'react';
import usePlayerStore from '../store/playerStore';

export default function AddToPlaylistModal({ show, song, onClose }) {
  const customPlaylists = usePlayerStore(s => s.customPlaylists);
  const addSongToPlaylist = usePlayerStore(s => s.addSongToPlaylist);
  const createPlaylist = usePlayerStore(s => s.createPlaylist);

  if (!show || !song) return null;

  const handle = (playlistId) => {
    addSongToPlaylist(playlistId, song);
    onClose();
  };

  const handleNew = () => {
    const title = prompt('New playlist name:');
    if (!title?.trim()) return;
    const pl = createPlaylist(title.trim());
    addSongToPlaylist(pl.id, song);
    onClose();
  };

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 200, display: 'flex', alignItems: 'flex-end', justifyContent: 'center' }}>
      <div onClick={onClose} style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.7)' }} />
      <div style={{ position: 'relative', width: '100%', maxWidth: 430, background: '#282828', borderRadius: '16px 16px 0 0', padding: '20px 0', maxHeight: '70vh', overflowY: 'auto' }}>
        {/* Song preview */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '0 20px 16px', borderBottom: '1px solid #3e3e3e' }}>
          <img src={song.cover} alt="" style={{ width: 44, height: 44, borderRadius: 4, objectFit: 'cover' }} onError={e => e.target.style.background='#333'} />
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 14, fontWeight: 700, color: '#fff', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{song.title}</div>
            <div style={{ fontSize: 12, color: '#b3b3b3' }}>{song.artist}</div>
          </div>
        </div>
        <div style={{ padding: '12px 20px 4px', fontSize: 13, fontWeight: 700, color: '#b3b3b3' }}>Add to playlist</div>
        {/* New playlist */}
        <button onClick={handleNew} style={{ display: 'flex', alignItems: 'center', gap: 14, width: '100%', background: 'none', border: 'none', cursor: 'pointer', padding: '14px 20px' }}>
          <div style={{ width: 44, height: 44, borderRadius: 4, background: '#3e3e3e', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.5" strokeLinecap="round"><path d="M12 5v14M5 12h14"/></svg>
          </div>
          <span style={{ fontSize: 14, fontWeight: 600, color: '#fff' }}>New playlist</span>
        </button>
        {/* Existing playlists */}
        {customPlaylists.map(pl => (
          <button key={pl.id} onClick={() => handle(pl.id)}
            style={{ display: 'flex', alignItems: 'center', gap: 14, width: '100%', background: 'none', border: 'none', cursor: 'pointer', padding: '10px 20px' }}>
            <img src={pl.cover} alt="" style={{ width: 44, height: 44, borderRadius: 4, objectFit: 'cover' }} onError={e => e.target.style.background='#333'} />
            <div style={{ textAlign: 'left' }}>
              <div style={{ fontSize: 14, fontWeight: 600, color: '#fff' }}>{pl.title}</div>
              <div style={{ fontSize: 12, color: '#b3b3b3' }}>{pl.songs.length} songs</div>
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}
