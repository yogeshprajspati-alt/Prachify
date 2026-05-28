import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import playlistData from '../data/playlist.json';
import { syncLike, syncUnlike, syncPlaylist, deletePlaylistFromDB, fetchLikedSongs, fetchPlaylists } from '../services/db';

function buildAllSongs(playlists) {
  return playlists.flatMap(pl =>
    pl.songs.map(s => ({ ...s, playlistId: pl.id, playlistTitle: pl.title }))
  );
}

const localSongs = buildAllSongs(playlistData.playlists);

const usePlayerStore = create(
  persist(
    (set, get) => ({
      // ── Data ──────────────────────────────────────────────────────────────
      playlists: playlistData.playlists,      // local curated playlists
      customPlaylists: [],                     // user-created playlists
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

      // ── Modes ─────────────────────────────────────────────────────────────
      shuffle: false,
      repeatMode: 'off',   // 'off' | 'all' | 'one'
      volume: 1.0,
      isMuted: false,

      // ── Persistence ───────────────────────────────────────────────────────
      recentSongs: [],
      likedSongs: [],       // song ids
      likedSongObjects: [], // full song objects (for JioSaavn songs)

      // ── Search ────────────────────────────────────────────────────────────
      searchResults: [],
      isSearching: false,
      searchQuery: '',

      // ── Setters ───────────────────────────────────────────────────────────
      setCurrentSong: (song) => {
        set({ currentSong: song, isLoading: true, hasError: false, position: 0 });
        // Update recent
        const prev = get().recentSongs.filter(id => id !== song.id);
        set({ recentSongs: [song.id, ...prev].slice(0, 30) });
        // Cache jio songs
        if (song.source === 'jiosaavn') {
          set(s => ({ jiosaavnCache: { ...s.jiosaavnCache, [song.id]: song } }));
        }
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
          set({
            likedSongs: [songObj.id, ...likedSongs],
            likedSongObjects: [songObj, ...likedSongObjects],
          });
          syncLike(songObj);
        }
      },

      isLiked: (songId) => get().likedSongs.includes(songId),

      // Load liked songs from DB on startup
      hydrateLikedFromDB: async () => {
        const dbSongs = await fetchLikedSongs();
        if (!dbSongs) return;

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

        set({
          likedSongs: mergedSongs.map(s => s.id),
          likedSongObjects: mergedSongs,
        });
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

      addSongToPlaylist: (playlistId, song) => {
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
        const dbPlaylists = await fetchPlaylists();
        if (!dbPlaylists) return;

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

        set({ customPlaylists: mergedPlaylists });
      },

      // ── Lookups ───────────────────────────────────────────────────────────
      getPlaylistById: (id) => {
        const local = playlistData.playlists.find(p => p.id === id);
        if (local) return local;
        return get().customPlaylists.find(p => p.id === id);
      },

      getSongById: (id) => {
        return get().allSongs.find(s => s.id === id)
          || get().jiosaavnCache[id]
          || null;
      },

      // ── Search state ──────────────────────────────────────────────────────
      setSearchResults: results => set({ searchResults: results }),
      setIsSearching: val => set({ isSearching: val }),
      setSearchQuery: q => set({ searchQuery: q }),

      // ── Add to playlist modal ─────────────────────────────────────────────
      addToPlaylistSong: null,
      setAddToPlaylistSong: song => set({ addToPlaylistSong: song }),
    }),
    {
      name: 'prachify-v2',
      partialize: s => ({
        currentSong: s.currentSong,
        currentPlaylistId: s.currentPlaylistId,
        queue: s.queue,
        queueIndex: s.queueIndex,
        position: s.position,
        recentSongs: s.recentSongs,
        likedSongs: s.likedSongs,
        likedSongObjects: s.likedSongObjects,
        customPlaylists: s.customPlaylists,
        shuffle: s.shuffle,
        repeatMode: s.repeatMode,
        volume: s.volume,
        isMuted: s.isMuted,
        jiosaavnCache: s.jiosaavnCache,
      }),
    }
  )
);

export default usePlayerStore;
