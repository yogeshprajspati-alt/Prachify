import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import playlistData from '../data/playlist.json';
import { syncLike, syncUnlike, syncPlaylist, deletePlaylistFromDB, fetchLikedSongs, fetchPlaylists } from '../services/db';
import { generatePlaylistCover } from '../utils/generatePlaylistCover';

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
      smartQueueEnabled: true,
      radioSeeds: [],

      // ── Modes ─────────────────────────────────────────────────────────────
      shuffle: false,
      repeatMode: 'off',   // 'off' | 'all' | 'one'
      volume: 1.0,
      isMuted: false,
      playbackRate: 1.0,
      abLoop: { active: false, a: null, b: null },

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

        // Cache jio songs
        if (song?.source === 'jiosaavn') {
          set(s => ({ jiosaavnCache: { ...s.jiosaavnCache, [song.id]: song } }));
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
        skippedSongs: s.skippedSongs,
        customPlaylists: s.customPlaylists,
        shuffle: s.shuffle,
        repeatMode: s.repeatMode,
        smartQueueEnabled: s.smartQueueEnabled,
        volume: s.volume,
        isMuted: s.isMuted,
        playbackRate: s.playbackRate,
        jiosaavnCache: (() => {
          const entries = Object.entries(s.jiosaavnCache);
          return entries.length > 100
            ? Object.fromEntries(entries.slice(-100))
            : s.jiosaavnCache;
        })(),
      }),
    }
  )
);

export default usePlayerStore;
