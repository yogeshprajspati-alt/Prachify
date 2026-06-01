import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import usePlayerStore from '../store/playerStore';
import { useChangelog } from '../hooks/useChangelog';
import ChangelogModal from '../components/ChangelogModal';

export default function Library() {
  const navigate = useNavigate();
  const customPlaylists = usePlayerStore(s => s.customPlaylists);
  const likedSongs = usePlayerStore(s => s.likedSongs);
  const createPlaylist = usePlayerStore(s => s.createPlaylist);
  const [filter, setFilter] = useState('All');
  const { changelog, hasNew, isOpen: changelogOpen, openChangelog, closeChangelog } = useChangelog();

  const filters = ['All', 'Playlists'];

  return (
    <div className="page" style={{ background: '#121212' }}>
      <div style={{ padding: '52px 16px 0' }}>
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
          <div style={{ width: 36, height: 36, borderRadius: '50%', background: '#b3b3b3', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="#121212">
              <path d="M12 2a5 5 0 100 10A5 5 0 0012 2zM2 20c0-4.418 4.477-8 10-8s10 3.582 10 8" />
            </svg>
          </div>
          <span style={{ fontSize: 18, fontWeight: 800 }}>Your Library</span>
          <div style={{ marginLeft: 'auto', display: 'flex', gap: 8 }}>
            {/* What's New Button */}
            <button onClick={openChangelog} style={{ ...smallIconBtn, position: 'relative' }} title="What's New">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#b3b3b3" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="10"/>
                <line x1="12" y1="8" x2="12" y2="12"/>
                <line x1="12" y1="16" x2="12.01" y2="16"/>
              </svg>
              {hasNew && (
                <span style={{
                  position: 'absolute', top: 4, right: 4,
                  width: 8, height: 8, borderRadius: '50%',
                  background: '#ff2d55',
                  border: '1.5px solid #121212',
                }} />
              )}
            </button>
            <button onClick={() => { const t = prompt('Playlist name:'); if (t) navigate(`/playlist/${createPlaylist(t.trim()).id}`); }} style={smallIconBtn} title="New playlist">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.5" strokeLinecap="round">
                <path d="M12 5v14M5 12h14" />
              </svg>
            </button>
          </div>
        </div>

        {/* Filter chips */}
        <div style={{ display: 'flex', gap: 8, marginBottom: 20, overflowX: 'auto' }}>
          {filters.map(f => (
            <button key={f} onClick={() => setFilter(f)}
              style={{ padding: '6px 14px', borderRadius: 20, border: 'none', cursor: 'pointer', fontFamily: 'inherit', fontWeight: 600, fontSize: 13, whiteSpace: 'nowrap', background: filter === f ? '#fff' : '#2a2a2a', color: filter === f ? '#121212' : '#fff' }}>
              {f}
            </button>
          ))}
        </div>
      </div>

      {/* Liked Songs */}
      <button onClick={() => navigate('/playlist/liked')} style={{ display: 'flex', alignItems: 'center', gap: 12, width: '100%', background: 'none', border: 'none', cursor: 'pointer', padding: '8px 16px', marginBottom: 4 }}>
        <div style={{ width: 56, height: 56, borderRadius: 6, background: 'linear-gradient(135deg, #450af5, #c4efd9)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
          <svg width="24" height="24" viewBox="0 0 24 24" fill="#fff">
            <path d="M20.84 4.61a5.5 5.5 0 00-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 00-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 000-7.78z" />
          </svg>
        </div>
        <div style={{ textAlign: 'left', flex: 1 }}>
          <div style={{ fontSize: 14, fontWeight: 700, color: '#fff' }}>Liked Songs</div>
          <div style={{ fontSize: 12, color: '#b3b3b3' }}>Playlist · {likedSongs.length} songs</div>
        </div>
      </button>

      {/* Playlist list */}
      {customPlaylists.map(pl => (
        <button key={pl.id} onClick={() => navigate(`/playlist/${pl.id}`)}
          style={{ display: 'flex', alignItems: 'center', gap: 12, width: '100%', background: 'none', border: 'none', cursor: 'pointer', padding: '8px 16px', marginBottom: 4 }}>
          <img src={pl.cover} alt="" style={{ width: 56, height: 56, borderRadius: 6, objectFit: 'cover', flexShrink: 0 }} onError={e => e.target.style.background = '#333'} />
          <div style={{ textAlign: 'left', flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 14, fontWeight: 700, color: '#fff', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{pl.title}</div>
            <div style={{ fontSize: 12, color: '#b3b3b3' }}>Playlist · {pl.songs.length} songs</div>
          </div>
        </button>
      ))}

      {changelogOpen && <ChangelogModal changelog={changelog} onClose={closeChangelog} />}
    </div>
  );
}

const smallIconBtn = {
  width: 36, height: 36, borderRadius: '50%', background: 'none',
  border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
};
