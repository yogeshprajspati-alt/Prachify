import React, { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { usePlayer } from '../hooks/usePlayer';
import usePlayerStore from '../store/playerStore';

function fmt(s) {
  if (!s || isNaN(s)) return '0:00';
  return `${Math.floor(s/60)}:${String(Math.floor(s%60)).padStart(2,'0')}`;
}

export default function PlaylistPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { getPlaylistById, currentSong, isPlaying, playPlaylist, playSong, currentPlaylistId, togglePlay, shuffleQueue } = usePlayer();
  const likedSongs = usePlayerStore(s => s.likedSongs);
  const toggleLike = usePlayerStore(s => s.toggleLike);
  const setAddToPlaylistSong = usePlayerStore(s => s.setAddToPlaylistSong);
  const removeSongFromPlaylist = usePlayerStore(s => s.removeSongFromPlaylist);
  const deletePlaylist = usePlayerStore(s => s.deletePlaylist);

  const playlist = getPlaylistById(id);
  const isCustom = id?.startsWith('custom-');
  const isCurrent = currentPlaylistId === id;

  if (!playlist) return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100dvh', gap: 16 }}>
      <div style={{ fontSize: 40 }}>🌫️</div>
      <div style={{ fontSize: 18, fontWeight: 700 }}>Playlist not found</div>
      <button onClick={() => navigate('/')} style={{ background: '#1DB954', color: '#000', border: 'none', borderRadius: 20, padding: '12px 24px', fontWeight: 700, cursor: 'pointer' }}>Go home</button>
    </div>
  );

  const totalDur = playlist.songs.reduce((a, s) => a + (s.duration || 0), 0);
  const durLabel = totalDur > 3600
    ? `${Math.floor(totalDur/3600)} hr ${Math.floor((totalDur%3600)/60)} min`
    : `${Math.floor(totalDur/60)} min`;

  return (
    <div className="page" style={{ background: '#121212', paddingBottom: 140 }}>
      {/* Hero section with gradient */}
      <div style={{ background: 'linear-gradient(180deg, #5a3a7e 0%, #121212 100%)', paddingBottom: 24 }}>
        {/* Back */}
        <div style={{ padding: '52px 16px 20px', display: 'flex', alignItems: 'center', gap: 8 }}>
          <button onClick={() => navigate(-1)} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 4 }}>
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.5" strokeLinecap="round">
              <path d="M15 18l-6-6 6-6"/>
            </svg>
          </button>
        </div>

        {/* Cover art */}
        <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 20 }}>
          <div style={{ width: 200, height: 200, borderRadius: 8, overflow: 'hidden', boxShadow: '0 16px 48px rgba(0,0,0,0.6)' }}>
            <img src={playlist.cover} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} onError={e => e.target.style.background='#333'} />
          </div>
        </div>

        {/* Meta */}
        <div style={{ padding: '0 16px' }}>
          <h1 style={{ fontSize: 22, fontWeight: 900, marginBottom: 4 }}>{playlist.title}</h1>
          <p style={{ fontSize: 13, color: '#b3b3b3', marginBottom: 4 }}>{playlist.description}</p>
          <p style={{ fontSize: 12, color: '#b3b3b3' }}>{playlist.songs.length} songs · {durLabel}</p>
        </div>
      </div>

      {/* Controls row */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 16, padding: '12px 16px 4px' }}>
        <button style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 4 }}>
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#b3b3b3" strokeWidth="2" strokeLinecap="round">
            <path d="M20.84 4.61a5.5 5.5 0 00-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 00-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 000-7.78z"/>
          </svg>
        </button>
        <button style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 4 }}>
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#b3b3b3" strokeWidth="2" strokeLinecap="round">
            <circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/>
            <path d="M8.59 13.51l6.83 3.98M15.41 6.51l-6.82 3.98"/>
          </svg>
        </button>
        <button style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 4 }}>
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#b3b3b3" strokeWidth="2" strokeLinecap="round">
            <circle cx="12" cy="12" r="1"/><circle cx="19" cy="12" r="1"/><circle cx="5" cy="12" r="1"/>
          </svg>
        </button>
        <div style={{ marginLeft: 'auto', display: 'flex', gap: 12, alignItems: 'center' }}>
          <button
            onClick={() => { if (!isCurrent) playPlaylist(playlist, 0); shuffleQueue(); }}
            style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 4, opacity: playlist.songs.length === 0 ? 0.4 : 1 }}>
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#b3b3b3" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="16 3 21 3 21 8"/><line x1="4" y1="20" x2="21" y2="3"/><polyline points="21 16 21 21 16 21"/><line x1="15" y1="15" x2="21" y2="21"/>
            </svg>
          </button>
          <button
            onClick={() => isCurrent ? togglePlay() : playPlaylist(playlist, 0)}
            disabled={playlist.songs.length === 0}
            style={{ width: 56, height: 56, borderRadius: '50%', background: '#1DB954', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 8px 16px rgba(0,0,0,0.3)', opacity: playlist.songs.length === 0 ? 0.4 : 1 }}>
            {isCurrent && isPlaying
              ? <svg width="22" height="22" viewBox="0 0 24 24" fill="#000"><rect x="6" y="4" width="4" height="16"/><rect x="14" y="4" width="4" height="16"/></svg>
              : <svg width="22" height="22" viewBox="0 0 24 24" fill="#000"><polygon points="5,3 19,12 5,21"/></svg>
            }
          </button>
        </div>
      </div>

      {/* Song list */}
      <div style={{ padding: '8px 0' }}>
        {playlist.songs.map((song, i) => {
          const active = currentSong?.id === song.id;
          const liked = likedSongs.includes(song.id);
          return (
            <button key={song.id} onClick={() => playSong(song, playlist)}
              style={{ display: 'flex', alignItems: 'center', gap: 12, width: '100%', background: active ? 'rgba(255,255,255,0.07)' : 'none', border: 'none', cursor: 'pointer', padding: '10px 16px', textAlign: 'left' }}>
              <div style={{ width: 16, textAlign: 'center', flexShrink: 0 }}>
                {active && isPlaying
                  ? <div style={{ display: 'flex', alignItems: 'flex-end', gap: 2, height: 16, justifyContent: 'center' }}><span className="eq-bar"/><span className="eq-bar"/><span className="eq-bar"/></div>
                  : <span style={{ fontSize: 13, color: active ? '#1DB954' : '#b3b3b3', fontWeight: 600 }}>{active ? '▶' : i + 1}</span>
                }
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 14, fontWeight: 600, color: active ? '#1DB954' : '#fff', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', marginBottom: 2 }}>{song.title}</div>
                <div style={{ fontSize: 12, color: '#b3b3b3', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{song.artist}</div>
              </div>
              <span style={{ fontSize: 12, color: '#b3b3b3', flexShrink: 0 }}>{fmt(song.duration)}</span>
              <button onClick={e => { e.stopPropagation(); setAddToPlaylistSong(song); }}
                style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '4px', flexShrink: 0 }}>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#b3b3b3" strokeWidth="2" strokeLinecap="round">
                  <circle cx="12" cy="12" r="1"/><circle cx="19" cy="12" r="1"/><circle cx="5" cy="12" r="1"/>
                </svg>
              </button>
            </button>
          );
        })}
        {playlist.songs.length === 0 && (
          <div style={{ textAlign: 'center', padding: '60px 16px' }}>
            <div style={{ fontSize: 40, marginBottom: 16 }}>🎵</div>
            <div style={{ fontSize: 18, fontWeight: 700, marginBottom: 8 }}>No songs yet</div>
            <div style={{ fontSize: 14, color: '#b3b3b3' }}>Add songs from the search tab</div>
          </div>
        )}
      </div>
    </div>
  );
}
