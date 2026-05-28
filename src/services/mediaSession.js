/**
 * MediaSession API — updates lock screen / notification controls
 */

export function updateMediaSession(song) {
  if (!('mediaSession' in navigator)) return;

  navigator.mediaSession.metadata = new MediaMetadata({
    title: song.title,
    artist: song.artist,
    album: 'Prachify',
    artwork: [
      { src: song.cover, sizes: '512x512', type: 'image/jpeg' },
      { src: song.cover, sizes: '256x256', type: 'image/jpeg' },
    ],
  });
}

export function setMediaSessionHandlers({ onPlay, onPause, onNext, onPrev, onSeek }) {
  if (!('mediaSession' in navigator)) return;

  navigator.mediaSession.setActionHandler('play', onPlay);
  navigator.mediaSession.setActionHandler('pause', onPause);
  navigator.mediaSession.setActionHandler('nexttrack', onNext);
  navigator.mediaSession.setActionHandler('previoustrack', onPrev);

  if (onSeek) {
    navigator.mediaSession.setActionHandler('seekto', (details) => {
      if (details.seekTime != null) onSeek(details.seekTime);
    });
  }
}

export function setMediaSessionState(state, position, duration) {
  if (!('mediaSession' in navigator)) return;
  navigator.mediaSession.playbackState = state; // 'playing' | 'paused'
  try {
    navigator.mediaSession.setPositionState({
      duration: duration || 0,
      playbackRate: 1,
      position: Math.min(position, duration || 0),
    });
  } catch (err) { console.warn('Failed to set media position state:', err); }
}
