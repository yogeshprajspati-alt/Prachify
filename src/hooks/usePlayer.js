import { useEffect, useRef, useCallback } from 'react';
import usePlayerStore from '../store/playerStore';
import * as audio from '../services/audioEngine';
import { updateMediaSession, setMediaSessionHandlers, setMediaSessionState } from '../services/mediaSession';
import { searchSongs, getSong } from '../services/jiosaavn';
import { canPlaySong } from '../utils/languageFilter.js';
import { logEvent } from '../utils/errorBus.js';
import { showToast } from '../utils/toast.js';

/**
 * Core player hook — bridges Zustand store ↔ Howler engine.
 * Mount this ONCE in App.jsx.
 */
export function usePlayerEngine() {
  const store = usePlayerStore();
  const positionRaf = useRef(null);
  const playbackRate = usePlayerStore(s => s.playbackRate);
  
  // P2 §7: Gapless prefetch refs
  const prefetchDone = useRef(false);
  const prefetchingSongId = useRef(null);

  // Sync playback rate immediately when store changes
  useEffect(() => {
    audio.setPlaybackRate(playbackRate);
  }, [playbackRate]);

  const startPositionTick = useCallback(() => {
    // Use setInterval instead of requestAnimationFrame so the ticker keeps
    // running when the screen is turned off (rAF is paused by the OS/browser
    // in background/screen-off state which causes next-song logic to break).
    clearInterval(positionRaf.current);
    positionRaf.current = setInterval(() => {
      const pos = audio.getPosition();
      const dur = audio.getDuration();
      store.setPosition(pos);

      // A-B loop check
      const { abLoop } = usePlayerStore.getState();
      if (abLoop.active && abLoop.a !== null && abLoop.b !== null) {
        if (pos >= abLoop.b) {
          audio.seek(abLoop.a);
        }
      }

      if (dur > 0) {
        setMediaSessionState('playing', pos, dur);
        
        // P2 §7: Gapless Playback Prefetch (80% completion)
        if (pos / dur >= 0.8 && !prefetchDone.current) {
          prefetchDone.current = true;
          const { queue, queueIndex } = usePlayerStore.getState();
          if (queueIndex < queue.length - 1) {
            const nextSong = queue[queueIndex + 1];
            // Check network conditions (PWA Mobile Data Saver)
            const conn = navigator.connection;
            const shouldPrefetch = !conn || (!conn.saveData && !['slow-2g', '2g'].includes(conn.effectiveType));
            
            if (shouldPrefetch && nextSong.source === 'jiosaavn') {
              getSong(nextSong.id).then(fullSong => {
                if (fullSong && fullSong.url) {
                  prefetchingSongId.current = nextSong.id;
                  navigator.serviceWorker.controller?.postMessage({
                    type: 'PREFETCH',
                    url: fullSong.url,
                    songId: nextSong.id,
                  });
                }
              }).catch(() => {});
            }
          }
        }
      }
    }, 500); // 500ms is plenty for the seek bar and doesn't waste battery
  }, [store]);

  const stopPositionTick = useCallback(() => {
    clearInterval(positionRaf.current);
  }, []);

  const playSong = useCallback(async (song, startPos = 0) => {
    prefetchDone.current = false;
    
    // Cancel any in-flight prefetch if we're jumping to a new song manually
    if (prefetchingSongId.current && prefetchingSongId.current !== song.id) {
      navigator.serviceWorker.controller?.postMessage({
        type: 'CANCEL_PREFETCH',
        songId: prefetchingSongId.current
      });
      prefetchingSongId.current = null;
    }
    
    store.setCurrentSong(song);
    
    let playableUrl = song.url;
    if (!playableUrl && song.source === 'jiosaavn') {
      try {
        const fullSong = await getSong(song.id);
        if (fullSong && fullSong.url) {
          playableUrl = fullSong.url;
          song.url = playableUrl; // Temporarily attach it for this session
        }
      } catch (err) {
        logEvent('playback_error', { songId: song.id, reason: 'failed_refetch_url' });
        showToast('Failed to play song. Try again later.');
        return;
      }
    }
    
    if (!playableUrl) {
      logEvent('playback_error', { songId: song.id, reason: 'missing_url' });
      showToast('Song unavailable.');
      return;
    }

    audio.loadAndPlay(playableUrl, startPos);
    // Sync volume on new song
    const { volume, isMuted } = usePlayerStore.getState();
    audio.setVolume(isMuted ? 0 : volume);
    updateMediaSession(song);
  }, [store]);

  const handleQueueEnd = useCallback(async () => {
    const { smartQueueEnabled, currentSong, radioSeeds, queue } = usePlayerStore.getState();
    if (!smartQueueEnabled || !currentSong) return;

    // radioSeeds mein songs hain to wahan se lo
    if (radioSeeds.length > 0) {
      const next = radioSeeds[0];
      const remaining = radioSeeds.slice(1);
      usePlayerStore.getState().setRadioSeeds(remaining);

      // Queue mein add karo aur play karo
      const newQueue = [...queue, next];
      usePlayerStore.getState().setQueue(newQueue, newQueue.length - 1);
      playSong(next);

      // Background mein aur songs fetch karo agar buffer low hai
      if (remaining.length < 3) {
        const artistName = currentSong.artist?.split(',')[0]?.trim();
        if (artistName) {
          searchSongs(artistName, 10).then(results => {
            const queueIds = new Set(usePlayerStore.getState().queue.map(s => s.id));
            const fresh = results.filter(s => !queueIds.has(s.id)).slice(0, 6);
            usePlayerStore.getState().setRadioSeeds(fresh);
          }).catch(() => {});
        }
      }
      return;
    }

    // Buffer khali hai — fresh fetch karo
    const artistName = currentSong.artist?.split(',')[0]?.trim();
    if (!artistName) return;

    try {
      const results = await searchSongs(artistName, 10);
      const queueIds = new Set(usePlayerStore.getState().queue.map(s => s.id));
      const filtered = results.filter(s => s.id !== currentSong.id && !queueIds.has(s.id)).slice(0, 6);

      if (filtered.length > 0) {
        const next = filtered[0];
        usePlayerStore.getState().setRadioSeeds(filtered.slice(1));
        const newQueue = [...usePlayerStore.getState().queue, next];
        usePlayerStore.getState().setQueue(newQueue, newQueue.length - 1);
        playSong(next);
      }
    } catch (err) {
      console.error('Failed to fetch next song for smart queue:', err);
    }
  }, [playSong]);

  const handleNext = useCallback(() => {
    const { currentSong, position } = usePlayerStore.getState();
    if (currentSong && position < 30) {
      usePlayerStore.getState().recordSkip(currentSong.id);
    }
    const nextSong = store.nextSong();
    if (nextSong) {
      playSong(nextSong);

      // Background playback guard — browser background mein play() suppress ho
      // sakta hai. 800ms baad check karo: agar song load ho gaya par play nahi
      // hua toh manually trigger karo.
      setTimeout(() => {
        if (!audio.isPlaying()) {
          audio.play();
        }
      }, 800);
    } else {
      handleQueueEnd();
    }
  }, [store, playSong, handleQueueEnd]);

  const handlePrev = useCallback(() => {
    const pos = audio.getPosition();
    if (pos > 3) {
      audio.seek(0);
      store.setPosition(0);
    } else {
      const prev = store.prevSong();
      if (prev) playSong(prev);
    }
  }, [store, playSong]);

  useEffect(() => {
    audio.setCallbacks({
      onPlay: () => {
        store.setIsPlaying(true);
        store.setIsLoading(false);
        startPositionTick();
      },
      onPause: () => {
        store.setIsPlaying(false);
        stopPositionTick();
        setMediaSessionState('paused', audio.getPosition(), audio.getDuration());
      },
      onEnd: () => {
        stopPositionTick();
        store.setIsPlaying(false);
        store.setPosition(0);
        handleNext();
      },
      onLoad: (dur) => {
        audio.setPlaybackRate(usePlayerStore.getState().playbackRate);
        store.setDuration(dur);
        store.setIsLoading(false);
      },
      onError: () => {
        store.setIsLoading(false);
        store.setHasError(true);
      },
    });

    setMediaSessionHandlers({
      onPlay: () => { audio.play(); store.setIsPlaying(true); },
      onPause: () => { audio.pause(); store.setIsPlaying(false); },
      onNext: handleNext,
      onPrev: handlePrev,
      onSeek: (t) => { audio.seek(t); store.setPosition(t); },
    });

    // Resume from last position on app start
    const { currentSong, position, volume, isMuted } = usePlayerStore.getState();
    if (currentSong) {
      audio.setVolume(isMuted ? 0 : volume);
      
      const loadSession = async () => {
        let playableUrl = currentSong.url;
        if (!playableUrl && currentSong.source === 'jiosaavn') {
          try {
            const fullSong = await getSong(currentSong.id);
            if (fullSong && fullSong.url) playableUrl = fullSong.url;
          } catch (e) {
            console.error('Session restore failed to fetch url');
          }
        }
        if (playableUrl) {
          audio.loadOnly(playableUrl, position || 0);
          updateMediaSession(currentSong);
        }
      };
      loadSession();
      // UI ko paused state mein rakho — user manually play karega
      usePlayerStore.getState().setIsPlaying(false);
    }

    return () => { stopPositionTick(); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return { playSong, handleNext, handlePrev };
}

/**
 * Lightweight hook for components — reads store + gets action funcs.
 */
export function usePlayer() {
  const store = usePlayerStore();

  const togglePlay = useCallback(() => {
    const { isLoading, currentSong, position } = usePlayerStore.getState();
    if (audio.isPlaying()) {
      audio.pause();
    } else if (isLoading) {
      // Abort loading if user clicks spinner
      audio.unload();
      store.setIsLoading(false);
      store.setIsPlaying(false);
    } else {
      // If audio was unloaded due to timeout/error, reload it
      if (!audio.hasHowl() && currentSong) {
        store.setIsLoading(true);
        store.setHasError(false);
        audio.loadAndPlay(currentSong.url, position || 0);
      } else {
        audio.play();
      }
    }
  }, [store]);

  const seekTo = useCallback((seconds) => {
    audio.seek(seconds);
    store.setPosition(seconds);
  }, [store]);

  const setVolume = useCallback((vol) => {
    store.setVolume(vol);
    audio.setVolume(store.isMuted ? 0 : vol);
  }, [store]);

  const toggleMute = useCallback(() => {
    const { isMuted, volume } = usePlayerStore.getState();
    store.toggleMute();
    audio.setVolume(!isMuted ? 0 : volume);
  }, [store]);

  const playSong = useCallback((song, playlist = null) => {
    if (playlist) {
      const idx = playlist.songs.findIndex((s) => s.id === song.id);
      store.setQueue(playlist.songs, idx >= 0 ? idx : 0, playlist.id);
    }

    // § final.md §1.5 / §1.6 — language filter check AT PLAY TIME
    // This catches offline-cached songs that pre-date the filter setting
    if (!canPlaySong(song)) {
      logEvent('filter_blocked_at_play', { songId: song.id, language: song.language });
      showToast("This song doesn't match your language preferences");
      // Skip to next — never leave user in silence
      const nextSong = store.nextSong();
      if (nextSong) {
        // Re-call playSong so filter applies recursively through the queue
        // (safe: queue is finite; filter should rarely trigger back-to-back)
        setTimeout(() => playSong(nextSong), 0);
      }
      return;
    }

    store.setCurrentSong(song);
    audio.loadAndPlay(song.url, 0);
    const { volume, isMuted } = usePlayerStore.getState();
    audio.setVolume(isMuted ? 0 : volume);
    updateMediaSession(song);

    // Timeout to break out of infinite loading if CDN is blocked.
    // getDuration() === 0 confirms song never loaded at all.
    // If duration > 0, song loaded successfully — isPlaying() may be false
    // due to browser background throttling, not an actual error. Do not unload.
    setTimeout(() => {
      const state = usePlayerStore.getState();
      if (state.isLoading && state.currentSong?.id === song.id && !audio.isPlaying() && audio.getDuration() === 0) {
        audio.unload();
        store.setIsLoading(false);
        store.setHasError(true);
      }
    }, 15000);
  }, [store]);

  const playPlaylist = useCallback((playlist, startIndex = 0) => {
    store.setQueue(playlist.songs, startIndex, playlist.id);
    const song = playlist.songs[startIndex];
    if (song) {
      store.setCurrentSong(song);
      audio.loadAndPlay(song.url, 0);
      const { volume, isMuted } = usePlayerStore.getState();
      audio.setVolume(isMuted ? 0 : volume);
      updateMediaSession(song);
    }
  }, [store]);

  const next = useCallback(() => {
    const { currentSong, position } = usePlayerStore.getState();
    if (currentSong && position < 30) {
      usePlayerStore.getState().recordSkip(currentSong.id);
    }
    const nextSong = store.nextSong();
    if (nextSong) {
      store.setCurrentSong(nextSong);
      audio.loadAndPlay(nextSong.url, 0);
      const { volume, isMuted } = usePlayerStore.getState();
      audio.setVolume(isMuted ? 0 : volume);
      updateMediaSession(nextSong);
    }
  }, [store]);

  const prev = useCallback(() => {
    const pos = audio.getPosition();
    if (pos > 3) {
      audio.seek(0);
      store.setPosition(0);
    } else {
      const p = store.prevSong();
      if (p) {
        store.setCurrentSong(p);
        audio.loadAndPlay(p.url, 0);
        const { volume, isMuted } = usePlayerStore.getState();
        audio.setVolume(isMuted ? 0 : volume);
        updateMediaSession(p);
      }
    }
  }, [store]);

  const jumpToQueueSong = useCallback((index) => {
    const song = store.jumpToQueueIndex(index);
    if (song) {
      store.setCurrentSong(song);
      audio.loadAndPlay(song.url, 0);
      const { volume, isMuted } = usePlayerStore.getState();
      audio.setVolume(isMuted ? 0 : volume);
      updateMediaSession(song);
    }
  }, [store]);

  return {
    ...store,
    togglePlay,
    seekTo,
    setVolume,
    toggleMute,
    playSong,
    playPlaylist,
    next,
    prev,
    jumpToQueueSong,
  };
}
