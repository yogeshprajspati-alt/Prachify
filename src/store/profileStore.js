import { create } from 'zustand';
import { persist } from 'zustand/middleware';

// ─── Profile Definitions ─────────────────────────────────────────────────────
// Each profile gets its own isolated library (playlists, liked songs, recents)
// AND its own cartoon avatar. Drop an image at:
//   public/profile-avatars/<id>.png
// and it will automatically be used instead of the placeholder gradient.
// Recommended: square image, at least 256x256, transparent or solid background.
export const PROFILES = [
  {
    id: 'prachi',
    name: 'Prachi',
    color: '#ff4fa3',
    gradient: 'linear-gradient(135deg, #ff4fa3 0%, #ff8fd0 100%)',
    emoji: '🌸',
    avatar: '/profile-avatars/prachi.png',
  },
  {
    id: 'chanchal',
    name: 'Chanchal',
    color: '#a566ff',
    gradient: 'linear-gradient(135deg, #7a3fff 0%, #c299ff 100%)',
    emoji: '✨',
    avatar: '/profile-avatars/chanchal.png',
  },
  {
    id: 'deepak',
    name: 'Deepak',
    color: '#2fd4c4',
    gradient: 'linear-gradient(135deg, #0fb8a8 0%, #7cf0e4 100%)',
    emoji: '🎧',
    avatar: '/profile-avatars/deepak.png',
  },
  {
    id: 'guest',
    name: 'Guest',
    color: '#8a8a8a',
    gradient: 'linear-gradient(135deg, #5a5a5a 0%, #b3b3b3 100%)',
    emoji: '👤',
    avatar: '/profile-avatars/guest.png',
  },
];

export const getProfileById = (id) => PROFILES.find(p => p.id === id) || null;

// Plain (non-reactive) helper so other modules — like the scoped localStorage
// wrapper in playerStore.js and getUserId() in db.js — can read the active
// profile WITHOUT importing the zustand hook (avoids circular init issues
// since it must resolve before those stores hydrate).
const ACTIVE_PROFILE_KEY = 'prachify-active-profile';

export function getActiveProfileId() {
  try {
    const raw = localStorage.getItem(ACTIVE_PROFILE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    return parsed?.state?.activeProfileId || null;
  } catch {
    return null;
  }
}

const useProfileStore = create(
  persist(
    (set, get) => ({
      activeProfileId: null,

      profiles: PROFILES,

      getActiveProfile: () => {
        const id = get().activeProfileId;
        return id ? getProfileById(id) : null;
      },

      // Switching profiles requires a reload — the player store's persisted
      // data is keyed by profile id, and zustand persist only reads storage
      // once at hydration time. A reload is the simplest, most reliable way
      // to guarantee a fully clean slate (matches the "who's watching?"
      // pattern used by every profile-based app).
      selectProfile: (id) => {
        if (!getProfileById(id)) return;
        set({ activeProfileId: id });
        window.location.reload();
      },

      switchProfile: () => {
        set({ activeProfileId: null });
        window.location.reload();
      },
    }),
    {
      name: ACTIVE_PROFILE_KEY,
      partialize: s => ({ activeProfileId: s.activeProfileId }),
    }
  )
);

export default useProfileStore;
