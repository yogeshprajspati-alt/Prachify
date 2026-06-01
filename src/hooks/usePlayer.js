import { useEffect, useRef, useCallback } from 'react';
import usePlayerStore from '../store/playerStore';
import * as audio from '../services/audioEngine';
import { updateMediaSession, setMediaSessionHandlers, setMediaSessionState } from '../services/mediaSession';
import { searchSongs } from '../services/jiosaavn';

/**
 * Core player hook — bridges Zustand store ↔ Howler engine.
 * Mount this ONCE in App.jsx.
 */
export function usePlayerEngine() {
  const store = usePlayerStore();
  const positionRaf = useRef(null);
  const playbackRate = usePlayerStore(s => s.playbackRate);

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

      if (dur > 0) setMediaSessionState('playing', pos, dur);
    }, 500); // 500ms is plenty for the seek bar and doesn't waste battery
  }, [store]);

  const stopPositionTick = useCallback(() => {
    clearInterval(positionRaf.current);
  }, []);

  const playSong = useCallback((song, startPos = 0) => {
    store.setCurrentSong(song);
    audio.loadAndPlay(song.url, startPos);
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
      audio.loadOnly(currentSong.url, position || 0); // sirf load, auto-play nahi
      updateMediaSession(currentSong);
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
