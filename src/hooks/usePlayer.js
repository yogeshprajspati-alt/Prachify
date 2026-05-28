import { useEffect, useRef, useCallback } from 'react';
import usePlayerStore from '../store/playerStore';
import * as audio from '../services/audioEngine';
import { updateMediaSession, setMediaSessionHandlers, setMediaSessionState } from '../services/mediaSession';

/**
 * Core player hook — bridges Zustand store ↔ Howler engine.
 * Mount this ONCE in App.jsx.
 */
export function usePlayerEngine() {
  const store = usePlayerStore();
  const positionRaf = useRef(null);

  const startPositionTick = useCallback(() => {
    const tick = () => {
      const pos = audio.getPosition();
      const dur = audio.getDuration();
      store.setPosition(pos);
      if (dur > 0) setMediaSessionState('playing', pos, dur);
      positionRaf.current = requestAnimationFrame(tick);
    };
    cancelAnimationFrame(positionRaf.current);
    positionRaf.current = requestAnimationFrame(tick);
  }, [store]);

  const stopPositionTick = useCallback(() => {
    cancelAnimationFrame(positionRaf.current);
  }, []);

  const playSong = useCallback((song, startPos = 0) => {
    store.setCurrentSong(song);
    audio.loadAndPlay(song.url, startPos);
    // Sync volume on new song
    const { volume, isMuted } = usePlayerStore.getState();
    audio.setVolume(isMuted ? 0 : volume);
    updateMediaSession(song);
  }, [store]);

  const handleNext = useCallback(() => {
    const next = store.nextSong();
    if (next) playSong(next);
  }, [store, playSong]);

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
      onLoad: (duration) => {
        store.setDuration(duration);
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
      audio.loadAndPlay(currentSong.url, position || 0);
      updateMediaSession(currentSong);
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

    // Strict 10-second timeout to break out of infinite loading if CDN is blocked
    setTimeout(() => {
      if (usePlayerStore.getState().isLoading && usePlayerStore.getState().currentSong?.id === song.id) {
        audio.unload();
        store.setIsLoading(false);
        store.setHasError(true);
      }
    }, 10000);
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
    const next = store.nextSong();
    if (next) {
      store.setCurrentSong(next);
      audio.loadAndPlay(next.url, 0);
      const { volume, isMuted } = usePlayerStore.getState();
      audio.setVolume(isMuted ? 0 : volume);
      updateMediaSession(next);
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
