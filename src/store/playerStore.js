import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import playlistData from '../data/playlist.json';
import { setEqPreset as setAudioEngineEq, getCurrentEqPreset } from '../services/audioEngine';
import { syncLike, syncUnlike, syncPlaylist, deletePlaylistFromDB, fetchLikedSongs, fetchPlaylists, syncSharedPlaylist, fetchSharedPlaylist, SHARED_PLAYLIST_ID } from '../services/db';
import { generatePlaylistCover } from '../utils/generatePlaylistCover';
import { getActiveProfileId, getProfileById } from './profileStore';

// ── Profile-Scoped Storage ────────────────────────────────────────────────────
// Each profile (Prachi / Chanchal / Deepak / Guest) gets a fully separate
// localStorage slot, so liked songs, playlists, queue, recents etc. never mix
// between profiles. Falls back to a shared 'no-profile' slot if somehow
// nothing is selected yet (shouldn't normally happen — App.jsx gates on it).
const profileScopedStorage = {
  getItem: (name) => {
    const profileId = getActiveProfileId() || 'no-profile';
    const newKey = `${name}::v8::${profileId}`;
    let data = localStorage.getItem(newKey);
    
    // If it's Prachi or Deepak and they don't have v8 data yet, migrate legacy local data
    if (!data && (profileId === 'prachi' || profileId === 'deepak')) {
      const keysToTry = [
        `${name}::v6::${profileId}`,
        `${name}::v3::${profileId}`,
        `${name}::${profileId}`,
        name, // legacy un-scoped key e.g. 'prachify-v2'
        'prachify-v6',
        'prachify-v3',
        'prachify-player-storage'
      ];
      for (const key of keysToTry) {
        const item = localStorage.getItem(key);
        if (item) {
          try {
            const parsed = JSON.parse(item);
            if (parsed && typeof parsed === 'object') {
              // Ensure it is wrapped in Zustand persist structure { state: { ... }, version: 0 }
              const formatted = parsed.state ? item : JSON.stringify({ state: parsed, version: 0 });
              data = formatted;
              localStorage.setItem(newKey, data);
              break;
            }
          } catch {
            // invalid JSON, ignore
          }
        }
      }
    }
    
    return data;
  },
  setItem: (name, value) => {
    const profileId = getActiveProfileId() || 'no-profile';
    localStorage.setItem(`${name}::v8::${profileId}`, value);
  },
  removeItem: (name) => {
    const profileId = getActiveProfileId() || 'no-profile';
    localStorage.removeItem(`${name}::v8::${profileId}`);
  },
};

// TASK-16: playlist.json is always empty — buildAllSongs was dead computation.
// Keeping the import for getPlaylistById which still reads playlistData.playlists.
const localSongs = []; // no local songs currently

const usePlayerStore = create(
  persist(
    (set, get) => ({
      // ── Data ──────────────────────────────────────────────────────────────
      playlists: playlistData.playlists,      // local curated playlists
      customPlaylists: [],                     // user-created playlists
      // "Shared Playlist" — shared between Prachi/Chanchal/Deepak only (never
      // Guest). All three read/write the same Supabase row via a fixed id.
      sharedPlaylist: {
        id: SHARED_PLAYLIST_ID,
        title: 'Shared Playlist',
        description: 'Shared by Prachi, Chanchal & Deepak',
        mood: 'Shared',
        cover: 'https://images.unsplash.com/photo-1493225457124-a3eb161ffa5f?w=400',
        gradient: 'from-purple-900 to-bg',
        songs: [],
      },
      allSongs: localSongs,                    // local songs cache
      jiosaavnCache: {},                       // id → normalized song object

      // ── Player ────────────────────────────────────────────────────────────
      currentSong: null,
      currentPlaylistId: null,
      queue: [],
      queueIndex: -1,
      isPlaying: false,
      duration: 0,
      position: 0,
      isLoading: false,
      hasError: false,
      smartQueueEnabled: true,
      radioSeeds: [],

      // ── Modes ─────────────────────────────────────────────────────────────
      shuffle: false,
      repeatMode: 'off',   // 'off' | 'all' | 'one'
      volume: 1.0,
      isMuted: false,
      playbackRate: 1.0,
      eqPreset: 'Flat',
      abLoop: { active: false, a: null, b: null },

      setEqPreset: (preset) => {
        setAudioEngineEq(preset);
        // Engine may reject the preset on mobile and revert to 'Flat'.
        // Always read back from engine to keep UI in sync.
        set({ eqPreset: getCurrentEqPreset() });
      },

      // ── Persistence ───────────────────────────────────────────────────────
      recentSongs: [],
      likedSongs: [],       // song ids
      likedSongObjects: [], // full song objects (for JioSaavn songs)
      skippedSongs: {},     // { songId: skipCount }

      // ── Setters ───────────────────────────────────────────────────────────
      setCurrentSong: (song) => {
        set({ 
          currentSong: song, 
          isLoading: true, 
          hasError: false, 
          position: 0,
          abLoop: { active: false, a: null, b: null }
        });
        
        // Add to recents
        if (song) {
          const s = get();
          const filtered = s.recentSongs.filter(id => id !== song.id);
          set({ recentSongs: [song.id, ...filtered].slice(0, 30) });
        }

        // TASK-13: Cap jiosaavnCache at 100 entries at runtime (not just at persist time)
        // to prevent unbounded memory growth on long sessions.
        if (song?.source === 'jiosaavn') {
          // P1 §3.4: Strip streamUrl before caching
          const cachedSong = { ...song };
          delete cachedSong.url;
          
          set(s => {
            const entries = Object.entries(s.jiosaavnCache);
            const trimmed = entries.length >= 100
              ? Object.fromEntries(entries.slice(-99))
              : s.jiosaavnCache;
            return { jiosaavnCache: { ...trimmed, [cachedSong.id]: cachedSong } };
          });
        }
      },
      recordSkip: (songId) => {
        if (!songId) return;
        set(s => ({
          skippedSongs: {
            ...s.skippedSongs,
            [songId]: (s.skippedSongs[songId] || 0) + 1,
          },
        }));
      },
      // TASK-14: Prune skippedSongs on startup — drop single-skip noise, cap at 200
      pruneSkippedSongs: () => {
        set(s => {
          const filtered = Object.entries(s.skippedSongs)
            .filter(([, count]) => count >= 2) // only keep genuinely disliked songs
            .slice(-200);                       // cap total to 200 entries max
          return { skippedSongs: Object.fromEntries(filtered) };
        });
      },
      setQueue: (songs, startIndex = 0, playlistId = null) =>
        set({ queue: songs, queueIndex: startIndex, currentPlaylistId: playlistId }),
      setIsPlaying: val => set({ isPlaying: val }),
      setDuration: val => set({ duration: val }),
      setPosition: val => set({ position: val }),
      setIsLoading: val => set({ isLoading: val }),
      setHasError: val => set({ hasError: val }),

      // ── Volume ────────────────────────────────────────────────────────────
      setVolume: val => set({ volume: val, isMuted: val === 0 }),
      toggleMute: () => set(s => ({ isMuted: !s.isMuted })),

      // ── Modes ─────────────────────────────────────────────────────────────
      toggleShuffle: () => set(s => ({ shuffle: !s.shuffle })),
      cycleRepeat: () => {
        const modes = ['off', 'all', 'one'];
        const cur = get().repeatMode;
        set({ repeatMode: modes[(modes.indexOf(cur) + 1) % modes.length] });
      },
      toggleSmartQueue: () => set(s => ({ smartQueueEnabled: !s.smartQueueEnabled })),
      setRadioSeeds: (songs) => set({ radioSeeds: songs }),
      setPlaybackRate: (rate) => set({ playbackRate: rate }),
      
      setAbPoint: (point) => set(s => {
        const { a, b } = s.abLoop;
        if (point === 'a' || (point === 'auto' && a === null)) {
          return { abLoop: { active: false, a: s.position, b: null } };
        }
        if (point === 'b' || (point === 'auto' && a !== null && b === null)) {
          const newB = s.position;
          if (newB <= a) return s;
          return { abLoop: { active: true, a, b: newB } };
        }
        return { abLoop: { active: false, a: null, b: null } };
      }),
      resetAbLoop: () => set({ abLoop: { active: false, a: null, b: null } }),

      // ── Navigation ────────────────────────────────────────────────────────
      nextSong: () => {
        const { queue, queueIndex, shuffle, repeatMode } = get();
        if (repeatMode === 'one') return queue[queueIndex] || null;
        if (shuffle) {
          const idx = Math.floor(Math.random() * queue.length);
          set({ queueIndex: idx });
          return queue[idx];
        }
        if (queueIndex < queue.length - 1) {
          const next = queue[queueIndex + 1];
          set({ queueIndex: queueIndex + 1 });
          return next;
        }
        if (repeatMode === 'all') {
          set({ queueIndex: 0 });
          return queue[0];
        }
        return null;
      },

      prevSong: () => {
        const { queue, queueIndex, position } = get();
        if (position > 3) return queue[queueIndex] || null;
        if (queueIndex > 0) {
          const prev = queue[queueIndex - 1];
          set({ queueIndex: queueIndex - 1 });
          return prev;
        }
        return queue[0] || null;
      },

      jumpToQueueIndex: (index) => {
        const { queue } = get();
        if (index >= 0 && index < queue.length) {
          set({ queueIndex: index });
          return queue[index];
        }
        return null;
      },

      shuffleQueue: () => {
        const { queue, currentSong } = get();
        const shuffled = [...queue].sort(() => Math.random() - 0.5);
        const idx = shuffled.findIndex(s => s.id === currentSong?.id);
        set({ queue: shuffled, queueIndex: idx >= 0 ? idx : 0 });
      },

      // ── Liked Songs ───────────────────────────────────────────────────────
      toggleLike: async (song) => {
        // Accept full song object OR just id (for local songs)
        const songObj = typeof song === 'string'
          ? get().allSongs.find(s => s.id === song) || get().jiosaavnCache[song]
          : song;
        if (!songObj) return;

        const { likedSongs, likedSongObjects } = get();
        const isLiked = likedSongs.includes(songObj.id);

        if (isLiked) {
          set({
            likedSongs: likedSongs.filter(id => id !== songObj.id),
            likedSongObjects: likedSongObjects.filter(s => s.id !== songObj.id),
          });
          syncUnlike(songObj.id);
        } else {
          const songToSave = { ...songObj };
          delete songToSave.url;
          
          set({
            likedSongs: [songObj.id, ...likedSongs],
            likedSongObjects: [songToSave, ...likedSongObjects],
          });
          syncLike(songToSave);
        }
      },

      isLiked: (songId) => get().likedSongs.includes(songId),

      // Load liked songs from DB on startup
      hydrateLikedFromDB: async () => {
        const profileAtStart = getActiveProfileId();
        const dbSongs = await fetchLikedSongs();
        if (!dbSongs) return;
        if (getActiveProfileId() !== profileAtStart) return;

        const localLikedSongObjects = get().likedSongObjects || [];
        const dbSongIds = new Set(dbSongs.map(s => s.id));
        const mergedSongs = [...dbSongs];

        for (const localSong of localLikedSongObjects) {
          if (!dbSongIds.has(localSong.id)) {
            await syncLike(localSong);
            mergedSongs.push(localSong);
            dbSongIds.add(localSong.id);
          }
        }

        if (getActiveProfileId() === profileAtStart) {
          set({
            likedSongs: mergedSongs.map(s => s.id),
            likedSongObjects: mergedSongs,
          });
        }
      },

      // ── Custom Playlists ──────────────────────────────────────────────────
      createPlaylist: (title, cover = '') => {
        const newPl = {
          id: `custom-${Date.now()}`,
          title,
          description: `Created ${new Date().toLocaleDateString()}`,
          mood: 'Custom',
          cover: cover || 'https://images.unsplash.com/photo-1514525253161-7a46d19cd819?w=400',
          gradient: 'from-purple-900 to-bg',
          songs: [],
        };
        set(s => ({ customPlaylists: [...s.customPlaylists, newPl] }));
        syncPlaylist(newPl);
        return newPl;
      },

      deletePlaylist: (id) => {
        set(s => ({ customPlaylists: s.customPlaylists.filter(p => p.id !== id) }));
        deletePlaylistFromDB(id);
      },

      playNext: (song) => {
        const { queue, queueIndex } = get();
        if (!queue.length) {
          // Queue empty hai — directly play karo
          set({ queue: [song], queueIndex: 0 });
          return;
        }
        const insertAt = queueIndex + 1;
        const newQueue = [
          ...queue.slice(0, insertAt),
          song,
          ...queue.slice(insertAt),
        ];
        set({ queue: newQueue });
      },

      addToQueue: (song) => {
        const { queue } = get();
        // Already queue mein hai to skip karo
        if (queue.some(s => s.id === song.id)) return;
        set({ queue: [...queue, song] });
      },

      removeFromQueue: (index) => {
        const { queue, queueIndex } = get();
        if (index < 0 || index >= queue.length) return;
        // Currently playing song ko mat hatao
        if (index === queueIndex) return;

        const newQueue = queue.filter((_, i) => i !== index);
        // agar removed item current se pehle tha to index adjust karo
        const newIndex = index < queueIndex ? queueIndex - 1 : queueIndex;
        set({ queue: newQueue, queueIndex: newIndex });
      },

      addSongToPlaylist: async (playlistId, song) => {
        set(s => {
          const updated = s.customPlaylists.map(pl => {
            if (pl.id !== playlistId) return pl;
            if (pl.songs.some(s => s.id === song.id)) return pl;
            return { ...pl, songs: [...pl.songs, song] };
          });
          const pl = updated.find(p => p.id === playlistId);
          if (pl) syncPlaylist(pl);
          return { customPlaylists: updated };
        });

        // Cover auto-update karo agar pehle 4 songs mein se hai
        const pl = get().customPlaylists.find(p => p.id === playlistId);
        if (!pl) return;
        const first4 = pl.songs.slice(0, 4).map(s => s.cover).filter(Boolean);
        if (first4.length >= 2) {
          const newCover = await generatePlaylistCover(first4);
          if (newCover) {
            set(s => ({
              customPlaylists: s.customPlaylists.map(p =>
                p.id === playlistId ? { ...p, cover: newCover } : p
              ),
            }));
          }
        }
      },

      removeSongFromPlaylist: (playlistId, songId) => {
        set(s => {
          const updated = s.customPlaylists.map(pl => {
            if (pl.id !== playlistId) return pl;
            return { ...pl, songs: pl.songs.filter(s => s.id !== songId) };
          });
          const pl = updated.find(p => p.id === playlistId);
          if (pl) syncPlaylist(pl);
          return { customPlaylists: updated };
        });
      },

      renamePlaylist: (playlistId, newTitle) => {
        set(s => {
          const updated = s.customPlaylists.map(pl =>
            pl.id === playlistId ? { ...pl, title: newTitle } : pl
          );
          const pl = updated.find(p => p.id === playlistId);
          if (pl) syncPlaylist(pl);
          return { customPlaylists: updated };
        });
      },

      reorderPlaylistSongs: (playlistId, newSongs) => {
        set(s => {
          const updated = s.customPlaylists.map(pl =>
            pl.id === playlistId ? { ...pl, songs: newSongs } : pl
          );
          const pl = updated.find(p => p.id === playlistId);
          if (pl) syncPlaylist(pl);
          return { customPlaylists: updated };
        });
      },

      hydratePlaylistsFromDB: async () => {
        const profileAtStart = getActiveProfileId();
        const dbPlaylists = await fetchPlaylists();
        if (!dbPlaylists) return;
        if (getActiveProfileId() !== profileAtStart) return;

        const localPlaylists = get().customPlaylists || [];
        const mergedPlaylists = [...dbPlaylists];

        for (const localPl of localPlaylists) {
          const dbPlIdx = mergedPlaylists.findIndex(p => p.id === localPl.id);
          if (dbPlIdx === -1) {
            // Local-only playlist: sync to DB and add to merged list
            await syncPlaylist(localPl);
            mergedPlaylists.push(localPl);
          } else {
            // Playlist exists in both: merge songs
            const dbPl = mergedPlaylists[dbPlIdx];
            const mergedSongs = [...dbPl.songs];
            let changed = false;

            for (const localSong of localPl.songs) {
              if (!mergedSongs.some(s => s.id === localSong.id)) {
                mergedSongs.push(localSong);
                changed = true;
              }
            }

            if (changed) {
              const updatedPl = { ...dbPl, songs: mergedSongs };
              await syncPlaylist(updatedPl);
              mergedPlaylists[dbPlIdx] = updatedPl;
            }
          }
        }

        if (getActiveProfileId() === profileAtStart) {
          set({ customPlaylists: mergedPlaylists });
        }
      },

      // ── Shared "Family" Playlist ─────────────────────────────────────────
      // Guest never touches these — Library.jsx doesn't render the entry for
      // Guest, and App.jsx never calls hydrateSharedPlaylistFromDB for Guest.
      addSongToSharedPlaylist: async (song) => {
        set(s => {
          if (s.sharedPlaylist.songs.some(sg => sg.id === song.id)) return s;
          const updated = { ...s.sharedPlaylist, songs: [...s.sharedPlaylist.songs, song] };
          syncSharedPlaylist(updated);
          return { sharedPlaylist: updated };
        });

        // Cover auto-update from first 4 songs, same as custom playlists
        const pl = get().sharedPlaylist;
        const first4 = pl.songs.slice(0, 4).map(s => s.cover).filter(Boolean);
        if (first4.length >= 2) {
          const newCover = await generatePlaylistCover(first4);
          if (newCover) {
            set(s => ({ sharedPlaylist: { ...s.sharedPlaylist, cover: newCover } }));
          }
        }
      },

      removeSongFromSharedPlaylist: (songId) => {
        set(s => {
          const updated = { ...s.sharedPlaylist, songs: s.sharedPlaylist.songs.filter(sg => sg.id !== songId) };
          syncSharedPlaylist(updated);
          return { sharedPlaylist: updated };
        });
      },

      reorderSharedPlaylistSongs: (newSongs) => {
        set(s => {
          const updated = { ...s.sharedPlaylist, songs: newSongs };
          syncSharedPlaylist(updated);
          return { sharedPlaylist: updated };
        });
      },

      hydrateSharedPlaylistFromDB: async () => {
        if (getActiveProfileId() === 'guest') return; // Guest never syncs this
        const dbPl = await fetchSharedPlaylist();
        const localPl = get().sharedPlaylist;

        if (!dbPl) {
          // If DB has no shared playlist yet, sync our local one up if it has songs
          if (localPl.songs.length > 0) {
            await syncSharedPlaylist(localPl);
          }
          return;
        }

        // Merge: union of local + DB songs, same pattern as personal playlists,
        // so an offline add on one profile isn't silently lost by another's fetch.
        const mergedSongs = [...dbPl.songs];
        let changed = false;
        for (const localSong of localPl.songs) {
          if (!mergedSongs.some(sg => sg.id === localSong.id)) {
            mergedSongs.push(localSong);
            changed = true;
          }
        }
        const merged = { ...dbPl, songs: mergedSongs };
        if (changed) await syncSharedPlaylist(merged);
        set({ sharedPlaylist: merged });
      },

      // ── Lookups ───────────────────────────────────────────────────────────
      getPlaylistById: (id) => {
        if (id === 'liked') {
          return {
            id: 'liked',
            title: 'Liked Songs',
            cover: 'https://images.unsplash.com/photo-1518609878373-06d740f60d8b?w=500&auto=format&fit=crop&q=60',
            songs: get().likedSongObjects || [],
          };
        }
        if (id === 'history') {
          const { recentSongs, allSongs, jiosaavnCache } = get();
          const recentObjects = (recentSongs || []).map(songId =>
            allSongs.find(s => s.id === songId) || jiosaavnCache[songId]
          ).filter(Boolean);
          return {
            id: 'history',
            title: 'Recently Played History',
            cover: 'https://images.unsplash.com/photo-1470225620780-dba8ba36b745?w=500&auto=format&fit=crop&q=60',
            songs: recentObjects,
          };
        }
        const local = playlistData.playlists.find(p => p.id === id);
        if (local) return local;
        if (id === SHARED_PLAYLIST_ID) return get().sharedPlaylist;
        return get().customPlaylists.find(p => p.id === id);
      },

      getSongById: (id) => {
        return get().allSongs.find(s => s.id === id)
          || get().jiosaavnCache[id]
          || null;
      },

      // ── Add to playlist modal ─────────────────────────────────────────────
      addToPlaylistSong: null,
      setAddToPlaylistSong: song => set({ addToPlaylistSong: song }),
    }),
    {
      name: 'prachify-v2',
      storage: createJSONStorage(() => profileScopedStorage),
      partialize: s => ({
        currentSong: s.currentSong,
        currentPlaylistId: s.currentPlaylistId,
        queue: s.queue,
        queueIndex: s.queueIndex,
        position: s.position,
        recentSongs: s.recentSongs,
        likedSongs: s.likedSongs,
        likedSongObjects: s.likedSongObjects,
        skippedSongs: s.skippedSongs,
        // Guest is session-only for playlists: never write them to
        // localStorage, so a reload or profile switch wipes them clean.
        customPlaylists: getActiveProfileId() === 'guest' ? [] : s.customPlaylists,
        sharedPlaylist: s.sharedPlaylist,
        shuffle: s.shuffle,
        repeatMode: s.repeatMode,
        smartQueueEnabled: s.smartQueueEnabled,
        volume: s.volume,
        isMuted: s.isMuted,
        playbackRate: s.playbackRate,
        eqPreset: s.eqPreset,
        // jiosaavnCache intentionally excluded — memory-only session cache.
        // Persisting it to localStorage bloats the key by up to 100KB and
        // causes main-thread jank on mobile devices during every profile switch.
      }),
      merge: (persistedState, currentState) => {
        const p = (persistedState && typeof persistedState === 'object') ? persistedState : {};
        return {
          ...currentState,
          ...p,
          eqPreset: p.eqPreset || 'Flat',
          playlists: Array.isArray(p.playlists) ? p.playlists : (currentState.playlists || []),
          customPlaylists: Array.isArray(p.customPlaylists) ? p.customPlaylists : [],
          recentSongs: Array.isArray(p.recentSongs) ? p.recentSongs : [],
          likedSongs: Array.isArray(p.likedSongs) ? p.likedSongs : [],
          likedSongObjects: Array.isArray(p.likedSongObjects) ? p.likedSongObjects : [],
          skippedSongs: (p.skippedSongs && typeof p.skippedSongs === 'object') ? p.skippedSongs : {},
          jiosaavnCache: {}, // Always start fresh — no longer persisted to localStorage
          queue: Array.isArray(p.queue) ? p.queue : [],
          sharedPlaylist: (p.sharedPlaylist && typeof p.sharedPlaylist === 'object' && Array.isArray(p.sharedPlaylist.songs))
            ? p.sharedPlaylist
            : currentState.sharedPlaylist,
        };
      },
    }
  )
);

export function loadProfileState(profileId) {
  if (!profileId) return;
  const raw = profileScopedStorage.getItem('prachify-v2');
  if (raw) {
    try {
      const parsed = JSON.parse(raw);
      const p = parsed.state || parsed;
      usePlayerStore.setState({
        currentSong: p.currentSong || null,
        currentPlaylistId: p.currentPlaylistId || null,
        queue: Array.isArray(p.queue) ? p.queue : [],
        queueIndex: typeof p.queueIndex === 'number' ? p.queueIndex : -1,
        position: typeof p.position === 'number' ? p.position : 0,
        isPlaying: false, // Keep paused state on start — user manually taps play
        customPlaylists: Array.isArray(p.customPlaylists) ? p.customPlaylists : [],
        likedSongs: Array.isArray(p.likedSongs) ? p.likedSongs : [],
        likedSongObjects: Array.isArray(p.likedSongObjects) ? p.likedSongObjects : [],
        recentSongs: Array.isArray(p.recentSongs) ? p.recentSongs : [],
        skippedSongs: (p.skippedSongs && typeof p.skippedSongs === 'object') ? p.skippedSongs : {},
        // jiosaavnCache is memory-only — reset on profile switch
        jiosaavnCache: {},
      });
      return;
    } catch (e) {}
  }

  usePlayerStore.setState({
    currentSong: null,
    isPlaying: false,
    queue: [],
    queueIndex: -1,
    position: 0,
    customPlaylists: [],
    likedSongs: [],
    likedSongObjects: [],
    recentSongs: [],
    skippedSongs: {},
  });
}

export default usePlayerStore;
