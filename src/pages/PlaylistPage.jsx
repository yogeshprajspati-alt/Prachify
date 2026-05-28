import React, { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { usePlayer } from '../hooks/usePlayer';
import usePlayerStore from '../store/playerStore';

function fmt(s) {
  if (!s || isNaN(s)) return '0:00';
  return `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`;
}

/* ── small pill icon button ─────────────────────────────────── */
function PillBtn({ onClick, children, danger }) {
  return (
    <button
      onClick={onClick}
      style={{
        display: 'flex', alignItems: 'center', gap: 6,
        padding: '7px 14px', borderRadius: 30,
        border: `1px solid ${danger ? 'rgba(255,77,77,0.35)' : 'rgba(255,255,255,0.12)'}`,
        background: danger ? 'rgba(255,77,77,0.08)' : 'rgba(255,255,255,0.06)',
        color: danger ? '#ff6b6b' : '#e0e0e0',
        fontSize: 12, fontWeight: 600, cursor: 'pointer',
        backdropFilter: 'blur(8px)', WebkitBackdropFilter: 'blur(8px)',
        transition: 'background 0.15s, transform 0.12s',
        fontFamily: 'inherit',
        whiteSpace: 'nowrap',
      }}
      onMouseDown={e => e.currentTarget.style.transform = 'scale(0.95)'}
      onMouseUp={e => e.currentTarget.style.transform = 'scale(1)'}
      onTouchStart={e => e.currentTarget.style.transform = 'scale(0.95)'}
      onTouchEnd={e => e.currentTarget.style.transform = 'scale(1)'}
    >
      {children}
    </button>
  );
}

export default function PlaylistPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { getPlaylistById, currentSong, isPlaying, playPlaylist, playSong, currentPlaylistId, togglePlay, shuffleQueue } = usePlayer();
  const setAddToPlaylistSong = usePlayerStore(s => s.setAddToPlaylistSong);
  const removeSongFromPlaylist = usePlayerStore(s => s.removeSongFromPlaylist);
  const deletePlaylist = usePlayerStore(s => s.deletePlaylist);
  const renamePlaylist = usePlayerStore(s => s.renamePlaylist);
  const reorderPlaylistSongs = usePlayerStore(s => s.reorderPlaylistSongs);

  const [editingName, setEditingName] = useState(false);
  const [nameInput, setNameInput] = useState('');
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [reorderMode, setReorderMode] = useState(false);
  const [dragIndex, setDragIndex] = useState(null);
  const [dragOverIndex, setDragOverIndex] = useState(null);

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
    ? `${Math.floor(totalDur / 3600)} hr ${Math.floor((totalDur % 3600) / 60)} min`
    : `${Math.floor(totalDur / 60)} min`;

  /* ── Rename ── */
  const startRename = () => { setNameInput(playlist.title); setEditingName(true); };
  const commitRename = () => {
    const t = nameInput.trim();
    if (t && t !== playlist.title) renamePlaylist(id, t);
    setEditingName(false);
  };

  /* ── Drag reorder ── */
  const handleDrop = () => {
    if (dragIndex === null || dragOverIndex === null || dragIndex === dragOverIndex) {
      setDragIndex(null); setDragOverIndex(null); return;
    }
    const songs = [...playlist.songs];
    const [moved] = songs.splice(dragIndex, 1);
    songs.splice(dragOverIndex, 0, moved);
    reorderPlaylistSongs(id, songs);
    setDragIndex(null); setDragOverIndex(null);
  };

  const moveUp = (i) => {
    if (i === 0) return;
    const songs = [...playlist.songs];
    [songs[i - 1], songs[i]] = [songs[i], songs[i - 1]];
    reorderPlaylistSongs(id, songs);
  };

  const moveDown = (i) => {
    if (i === playlist.songs.length - 1) return;
    const songs = [...playlist.songs];
    [songs[i], songs[i + 1]] = [songs[i + 1], songs[i]];
    reorderPlaylistSongs(id, songs);
  };

  /* ── Delete playlist ── */
  const handleDeletePlaylist = () => { deletePlaylist(id); navigate('/library'); };

  return (
    <div className="page" style={{ background: '#121212', paddingBottom: 140 }}>

      {/* ── Hero ───────────────────────────────────────────────────── */}
      <div style={{ background: 'linear-gradient(180deg, #5a3a7e 0%, #121212 100%)', paddingBottom: 24 }}>

        {/* Top bar */}
        <div style={{ padding: '52px 16px 20px', display: 'flex', alignItems: 'center', gap: 8 }}>
          <button onClick={() => navigate(-1)} style={circleBtn}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.5" strokeLinecap="round">
              <path d="M15 18l-6-6 6-6" />
            </svg>
          </button>
        </div>

        {/* Cover */}
        <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 20 }}>
          <div style={{ width: 200, height: 200, borderRadius: 12, overflow: 'hidden', boxShadow: '0 20px 60px rgba(0,0,0,0.7)' }}>
            <img src={playlist.cover} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }}
              onError={e => e.target.style.background = '#333'} />
          </div>
        </div>

        {/* Title */}
        <div style={{ padding: '0 16px' }}>
          {editingName ? (
            <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 4 }}>
              <input
                autoFocus
                value={nameInput}
                onChange={e => setNameInput(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') commitRename(); if (e.key === 'Escape') setEditingName(false); }}
                style={{
                  fontSize: 22, fontWeight: 900, flex: 1,
                  background: 'rgba(255,255,255,0.08)',
                  border: '1.5px solid rgba(255,255,255,0.25)',
                  borderRadius: 10, padding: '6px 12px',
                  color: '#fff', outline: 'none', fontFamily: 'inherit',
                }}
              />
              <button onClick={commitRename} style={{ background: '#1DB954', border: 'none', borderRadius: 10, padding: '8px 16px', color: '#000', fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}>Save</button>
              <button onClick={() => setEditingName(false)} style={{ background: 'rgba(255,255,255,0.1)', border: 'none', borderRadius: 10, padding: '8px 12px', color: '#fff', cursor: 'pointer' }}>✕</button>
            </div>
          ) : (
            <h1 style={{ fontSize: 22, fontWeight: 900, marginBottom: 4 }}>{playlist.title}</h1>
          )}
          <p style={{ fontSize: 13, color: '#b3b3b3', marginBottom: 4 }}>{playlist.description}</p>
          <p style={{ fontSize: 12, color: '#b3b3b3' }}>{playlist.songs.length} songs · {durLabel}</p>
        </div>
      </div>

      {/* ── Action pill row (custom playlists only) ──────────────── */}
      {isCustom && (
        <div style={{
          display: 'flex', gap: 8, padding: '14px 16px 6px',
          overflowX: 'auto', scrollbarWidth: 'none',
        }}>
          <PillBtn onClick={startRename}>
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
              <path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7" />
              <path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z" />
            </svg>
            Edit name
          </PillBtn>
          <PillBtn onClick={() => setReorderMode(r => !r)}>
            {reorderMode ? (
              <>
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#1DB954" strokeWidth="2.5" strokeLinecap="round">
                  <polyline points="20 6 9 17 4 12" />
                </svg>
                <span style={{ color: '#1DB954' }}>Done</span>
              </>
            ) : (
              <>
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                  <line x1="3" y1="6" x2="21" y2="6" />
                  <line x1="3" y1="12" x2="21" y2="12" />
                  <line x1="3" y1="18" x2="21" y2="18" />
                </svg>
                Reorder
              </>
            )}
          </PillBtn>
          <PillBtn onClick={() => setShowDeleteConfirm(true)} danger>
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
              <polyline points="3 6 5 6 21 6" />
              <path d="M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6" />
              <path d="M10 11v6M14 11v6M9 6V4h6v2" />
            </svg>
            Delete
          </PillBtn>
        </div>
      )}

      {/* ── Playback controls ────────────────────────────────────── */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '8px 16px 4px', justifyContent: 'flex-end' }}>
        <button
          onClick={() => { if (!isCurrent) playPlaylist(playlist, 0); shuffleQueue(); }}
          style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 6, opacity: playlist.songs.length === 0 ? 0.4 : 1 }}>
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#b3b3b3" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="16 3 21 3 21 8" /><line x1="4" y1="20" x2="21" y2="3" />
            <polyline points="21 16 21 21 16 21" /><line x1="15" y1="15" x2="21" y2="21" />
          </svg>
        </button>
        <button
          onClick={() => isCurrent ? togglePlay() : playPlaylist(playlist, 0)}
          disabled={playlist.songs.length === 0}
          style={{
            width: 56, height: 56, borderRadius: '50%', background: '#1DB954',
            border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center',
            justifyContent: 'center', boxShadow: '0 8px 24px rgba(29,185,84,0.4)',
            opacity: playlist.songs.length === 0 ? 0.4 : 1, transition: 'transform 0.1s',
          }}>
          {isCurrent && isPlaying
            ? <svg width="22" height="22" viewBox="0 0 24 24" fill="#000"><rect x="6" y="4" width="4" height="16" /><rect x="14" y="4" width="4" height="16" /></svg>
            : <svg width="22" height="22" viewBox="0 0 24 24" fill="#000"><polygon points="5,3 19,12 5,21" /></svg>
          }
        </button>
      </div>

      {/* ── Song list ────────────────────────────────────────────── */}
      <div style={{ padding: '4px 0' }}>
        {playlist.songs.map((song, i) => {
          const active = currentSong?.id === song.id;
          const isDragging = dragIndex === i;
          const isDragOver = dragOverIndex === i;

          return (
            <div
              key={song.id}
              draggable={reorderMode}
              onDragStart={() => setDragIndex(i)}
              onDragEnter={() => setDragOverIndex(i)}
              onDragOver={e => e.preventDefault()}
              onDrop={handleDrop}
              style={{
                display: 'flex', alignItems: 'center', gap: 10,
                padding: reorderMode ? '10px 12px' : '10px 16px',
                background: isDragOver
                  ? 'rgba(29,185,84,0.1)'
                  : active ? 'rgba(255,255,255,0.06)' : 'transparent',
                borderTop: isDragOver ? '2px solid #1DB954' : '2px solid transparent',
                borderRadius: reorderMode ? 12 : 0,
                margin: reorderMode ? '2px 8px' : 0,
                opacity: isDragging ? 0.35 : 1,
                cursor: reorderMode ? 'grab' : 'pointer',
                transition: 'background 0.15s, opacity 0.15s',
              }}
            >
              {/* Left: number / EQ / reorder handle */}
              {reorderMode ? (
                <div style={{ display: 'flex', alignItems: 'center', gap: 2, flexShrink: 0 }}>
                  <button onClick={() => moveUp(i)} disabled={i === 0} style={arrowBtn(i === 0)}>↑</button>
                  <button onClick={() => moveDown(i)} disabled={i === playlist.songs.length - 1} style={arrowBtn(i === playlist.songs.length - 1)}>↓</button>
                  <span style={{ color: '#555', fontSize: 18, paddingLeft: 4, cursor: 'grab' }}>⠿</span>
                </div>
              ) : (
                <div style={{ width: 16, textAlign: 'center', flexShrink: 0 }}>
                  {active && isPlaying
                    ? <div style={{ display: 'flex', alignItems: 'flex-end', gap: 2, height: 16, justifyContent: 'center' }}>
                      <span className="eq-bar" /><span className="eq-bar" /><span className="eq-bar" />
                    </div>
                    : <span style={{ fontSize: 13, color: active ? '#1DB954' : '#666', fontWeight: 600 }}>{active ? '▶' : i + 1}</span>
                  }
                </div>
              )}

              {/* Song info */}
              <div onClick={() => !reorderMode && playSong(song, playlist)} style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 14, fontWeight: 600, color: active ? '#1DB954' : '#fff', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', marginBottom: 2 }}>
                  {song.title}
                </div>
                <div style={{ fontSize: 12, color: '#888', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {song.artist}
                </div>
              </div>

              {/* Duration */}
              {!reorderMode && (
                <span style={{ fontSize: 12, color: '#666', flexShrink: 0 }}>{fmt(song.duration)}</span>
              )}

              {/* Actions */}
              {!reorderMode && (
                <div style={{ display: 'flex', alignItems: 'center', gap: 2, flexShrink: 0 }}>
                  <button
                    onClick={e => { e.stopPropagation(); setAddToPlaylistSong(song); }}
                    title="Add to playlist"
                    style={actionBtn('#888')}>
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                      <circle cx="12" cy="12" r="1" /><circle cx="19" cy="12" r="1" /><circle cx="5" cy="12" r="1" />
                    </svg>
                  </button>
                  {isCustom && (
                    <button
                      onClick={e => { e.stopPropagation(); removeSongFromPlaylist(id, song.id); }}
                      title="Remove from playlist"
                      style={actionBtn('#ff6b6b')}>
                      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                        <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
                      </svg>
                    </button>
                  )}
                </div>
              )}
            </div>
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

      {/* ── Delete confirmation modal ─────────────────────────── */}
      {showDeleteConfirm && (
        <div
          onClick={() => setShowDeleteConfirm(false)}
          style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.75)', display: 'flex', alignItems: 'flex-end', justifyContent: 'center', zIndex: 300, padding: '0 0 24px' }}>
          <div
            onClick={e => e.stopPropagation()}
            className="slide-up"
            style={{
              background: '#1e1e1e', borderRadius: '20px 20px 16px 16px',
              padding: '20px 20px 12px', width: '100%', maxWidth: 430,
              border: '1px solid rgba(255,255,255,0.08)',
            }}>
            {/* Handle */}
            <div style={{ width: 36, height: 4, borderRadius: 2, background: '#444', margin: '0 auto 20px' }} />
            <div style={{ fontSize: 16, fontWeight: 700, marginBottom: 4 }}>Delete playlist?</div>
            <div style={{ fontSize: 13, color: '#888', marginBottom: 24 }}>
              "<b style={{ color: '#ccc' }}>{playlist.title}</b>" will be permanently deleted.
            </div>
            <button
              onClick={handleDeletePlaylist}
              style={{ width: '100%', padding: '14px', borderRadius: 12, border: 'none', background: 'rgba(255,77,77,0.15)', color: '#ff6b6b', fontWeight: 700, fontSize: 15, cursor: 'pointer', marginBottom: 10, fontFamily: 'inherit' }}>
              Delete
            </button>
            <button
              onClick={() => setShowDeleteConfirm(false)}
              style={{ width: '100%', padding: '14px', borderRadius: 12, border: 'none', background: 'rgba(255,255,255,0.06)', color: '#fff', fontWeight: 600, fontSize: 15, cursor: 'pointer', fontFamily: 'inherit' }}>
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

const circleBtn = {
  width: 34, height: 34, borderRadius: '50%',
  background: 'rgba(0,0,0,0.35)', border: 'none',
  cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
  backdropFilter: 'blur(6px)',
};

const arrowBtn = (disabled) => ({
  background: disabled ? 'transparent' : 'rgba(255,255,255,0.06)',
  border: 'none', borderRadius: 8,
  cursor: disabled ? 'default' : 'pointer',
  color: disabled ? '#3a3a3a' : '#b3b3b3',
  fontSize: 15, padding: '4px 7px', lineHeight: 1,
  transition: 'background 0.15s',
});

const actionBtn = (color) => ({
  width: 30, height: 30, borderRadius: '50%', border: 'none',
  background: 'none', cursor: 'pointer', display: 'flex',
  alignItems: 'center', justifyContent: 'center', color,
  transition: 'background 0.15s',
});
