import React, { useState } from 'react';
import usePlayerStore from '../store/playerStore';
import { getPlaylist } from '../services/jiosaavn';

export default function ImportPlaylistModal({ show, onClose, onSuccess }) {
  const [url, setUrl] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const importSpotifyPlaylist = usePlayerStore(s => s.importSpotifyPlaylist);

  if (!show) return null;

  // Extract JioSaavn playlist ID from URL
  // e.g. https://www.jiosaavn.com/featured/some-playlist/abc123
  const extractId = (input) => {
    const trimmed = input.trim();
    // If they pasted just an ID
    if (!trimmed.includes('/') && trimmed.length > 4) return trimmed;
    // Try to extract from URL
    const match = trimmed.match(/\/([a-zA-Z0-9_-]{8,})(?:\?|$)/);
    return match?.[1] || null;
  };

  const handleImport = async () => {
    const id = extractId(url);
    if (!id) { setError('Invalid URL. Paste a JioSaavn playlist link.'); return; }

    setLoading(true);
    setError('');
    try {
      const pl = await getPlaylist(id);
      if (!pl || !pl.songs?.length) throw new Error('Playlist empty or not found.');
      const created = importSpotifyPlaylist(pl.title, pl.songs, pl.cover);
      setUrl('');
      onSuccess?.(created);
    } catch (e) {
      setError(e.message || 'Import failed. Check the URL and try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div onClick={onClose} style={{
      position: 'fixed', inset: 0, zIndex: 200,
      background: 'rgba(0,0,0,0.8)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      padding: 24,
    }}>
      <div onClick={e => e.stopPropagation()} style={{
        width: '100%', maxWidth: 360,
        background: '#1a1a1a',
        borderRadius: 16,
        overflow: 'hidden',
        boxShadow: '0 24px 64px rgba(0,0,0,0.8)',
      }}>
        {/* Header */}
        <div style={{ padding: '20px 20px 0', display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
          <div>
            <h2 style={{ fontSize: 18, fontWeight: 800, color: '#fff', marginBottom: 4 }}>Import Playlist</h2>
            <p style={{ fontSize: 13, color: '#b3b3b3' }}>Paste a JioSaavn playlist link</p>
          </div>
          <button onClick={onClose} style={{ background: 'rgba(255,255,255,0.1)', border: 'none', borderRadius: '50%', width: 32, height: 32, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.5" strokeLinecap="round">
              <path d="M18 6L6 18M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div style={{ padding: 20 }}>
          {loading ? (
            <div style={{ textAlign: 'center', padding: '32px 0' }}>
              <div style={{ width: 40, height: 40, borderRadius: '50%', border: '3px solid #282828', borderTop: '3px solid #1DB954', animation: 'spin 0.8s linear infinite', margin: '0 auto 16px' }} />
              <p style={{ fontSize: 14, color: '#b3b3b3' }}>Importing playlist...</p>
            </div>
          ) : (
            <>
              {/* URL Input */}
              <div style={{ marginBottom: 12 }}>
                <label style={{ fontSize: 11, fontWeight: 700, color: '#b3b3b3', textTransform: 'uppercase', letterSpacing: 1, display: 'block', marginBottom: 8 }}>
                  JioSaavn Playlist URL
                </label>
                <input
                  type="text"
                  value={url}
                  onChange={e => { setUrl(e.target.value); setError(''); }}
                  placeholder="https://www.jiosaavn.com/featured/..."
                  autoCorrect="off"
                  autoCapitalize="off"
                  style={{
                    width: '100%', height: 46, borderRadius: 8,
                    background: '#282828',
                    border: error ? '1px solid #f15e6c' : '1px solid #3e3e3e',
                    color: '#fff', fontSize: 13, padding: '0 14px',
                    outline: 'none', fontFamily: 'inherit',
                  }}
                  onKeyDown={e => e.key === 'Enter' && handleImport()}
                />
              </div>

              {/* Error */}
              {error && (
                <div style={{ background: 'rgba(241,94,108,0.1)', border: '1px solid rgba(241,94,108,0.3)', borderRadius: 8, padding: '10px 14px', marginBottom: 12 }}>
                  <p style={{ fontSize: 13, color: '#f15e6c', margin: 0 }}>{error}</p>
                </div>
              )}

              {/* Info note */}
              <div style={{ background: '#282828', borderRadius: 8, padding: '10px 14px', marginBottom: 20, display: 'flex', gap: 10, alignItems: 'flex-start' }}>
                <span style={{ fontSize: 16, flexShrink: 0 }}>💡</span>
                <p style={{ fontSize: 12, color: '#b3b3b3', margin: 0, lineHeight: 1.5 }}>
                  Only <span style={{ color: '#fff', fontWeight: 600 }}>JioSaavn</span> playlists are supported. Go to JioSaavn → open any playlist → copy the URL.
                </p>
              </div>

              {/* Import button */}
              <button
                onClick={handleImport}
                disabled={!url.trim()}
                style={{
                  width: '100%', height: 48, borderRadius: 24,
                  background: url.trim() ? '#1DB954' : '#282828',
                  border: 'none', cursor: url.trim() ? 'pointer' : 'not-allowed',
                  color: url.trim() ? '#000' : '#727272',
                  fontSize: 15, fontWeight: 700, fontFamily: 'inherit',
                  transition: 'all 0.2s',
                }}
              >
                Import Playlist
              </button>
            </>
          )}
        </div>
      </div>
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}
