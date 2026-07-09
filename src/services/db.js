/**
 * Frictionless Cloud Storage — No Login Required
 * 
 * Uses anonymous UUID stored in localStorage.
 * Data syncs to Supabase under that UUID.
 * Cache-proof: UUID regenerates if localStorage wiped,
 * but same device = same UUID = same likes/playlists.
 * 
 * SETUP: Replace SUPABASE_URL and SUPABASE_ANON_KEY below.
 * Run this SQL in Supabase dashboard first:
 * 
 *   create table user_tracks (
 *     id uuid default gen_random_uuid() primary key,
 *     user_id text not null,
 *     song_id text not null,
 *     song_data jsonb not null,
 *     created_at timestamptz default now(),
 *     unique(user_id, song_id)
 *   );
 * 
 *   create table user_playlists (
 *     id uuid default gen_random_uuid() primary key,
 *     user_id text not null,
 *     playlist_id text not null,
 *     playlist_data jsonb not null,
 *     updated_at timestamptz default now(),
 *     unique(user_id, playlist_id)
 *   );
 * 
 *   -- Enable Row Level Security (public anon read/write for now)
 *   alter table user_tracks enable row level security;
 *   alter table user_playlists enable row level security;
 *   create policy "anon all" on user_tracks for all using (true) with check (true);
 *   create policy "anon all" on user_playlists for all using (true) with check (true);
 */

// ─── CONFIGURE THESE ───────────────────────────────────────────────────────────
const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL || '';
const SUPABASE_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY || '';
// ───────────────────────────────────────────────────────────────────────────────

const ENABLED = !!(SUPABASE_URL && SUPABASE_KEY);

// Each profile (Prachi / Chanchal / Deepak / Guest) syncs to its own row-set
// in Supabase, so cloud-synced liked songs/playlists never mix between them.
import { getActiveProfileId } from '../store/profileStore';

export function getUserId() {
  const profileId = getActiveProfileId();
  return `prachify_${profileId || 'admin'}`;
}

// Guest profile is intentionally session-only: playlists it creates must
// never reach Supabase (paired with the local partialize guard in
// playerStore.js, they also never survive a page reload).
function isGuest() {
  return getActiveProfileId() === 'guest';
}

async function supabase(path, method = 'GET', body = null) {
  if (!ENABLED) return null;
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
    method,
    headers: {
      'apikey': SUPABASE_KEY,
      'Authorization': `Bearer ${SUPABASE_KEY}`,
      'Content-Type': 'application/json',
      'Prefer': method === 'POST' ? 'resolution=merge-duplicates' : '',
    },
    body: body ? JSON.stringify(body) : null,
  });
  if (!res.ok) {
    console.warn('[DB]', method, path, res.status, await res.text());
    return null;
  }
  const text = await res.text();
  return text ? JSON.parse(text) : null;
}

// ── Liked Songs ─────────────────────────────────────────────────────────────

export async function syncLike(song) {
  if (!ENABLED || isGuest()) return;
  const userId = getUserId();
  await supabase('user_tracks?on_conflict=user_id,song_id', 'POST', {
    user_id: userId,
    song_id: song.id,
    song_data: song,
  });
}

export async function syncUnlike(songId) {
  if (!ENABLED || isGuest()) return;
  const userId = getUserId();
  await supabase(`user_tracks?user_id=eq.${userId}&song_id=eq.${songId}`, 'DELETE');
}

export async function fetchLikedSongs() {
  if (!ENABLED || isGuest()) return null;
  const userId = getUserId();
  const data = await supabase(`user_tracks?user_id=eq.${userId}&order=created_at.desc`);
  return data?.map(row => row.song_data) || [];
}

// ── Playlists ────────────────────────────────────────────────────────────────

export async function syncPlaylist(playlist) {
  if (!ENABLED || isGuest()) return;
  const userId = getUserId();
  await supabase('user_playlists?on_conflict=user_id,playlist_id', 'POST', {
    user_id: userId,
    playlist_id: playlist.id,
    playlist_data: playlist,
    updated_at: new Date().toISOString(),
  });
}

export async function deletePlaylistFromDB(playlistId) {
  if (!ENABLED || isGuest()) return;
  const userId = getUserId();
  await supabase(`user_playlists?user_id=eq.${userId}&playlist_id=eq.${playlistId}`, 'DELETE');
}

export async function fetchPlaylists() {
  if (!ENABLED || isGuest()) return null;
  const userId = getUserId();
  const data = await supabase(`user_playlists?user_id=eq.${userId}&order=updated_at.desc`);
  return data?.map(row => row.playlist_data) || [];
}

export { ENABLED as dbEnabled };

// ── Shared "Family" Playlist ────────────────────────────────────────────────
// One playlist visible to Prachi, Chanchal & Deepak (NOT Guest) — all three
// read/write the SAME Supabase row via a fixed user_id, regardless of which
// profile is actually active. Reuses the same user_playlists table.
const SHARED_USER_ID = 'prachify_shared_family';
export const SHARED_PLAYLIST_ID = 'shared-family';

export async function syncSharedPlaylist(playlist) {
  if (!ENABLED) return;
  await supabase('user_playlists?on_conflict=user_id,playlist_id', 'POST', {
    user_id: SHARED_USER_ID,
    playlist_id: SHARED_PLAYLIST_ID,
    playlist_data: playlist,
    updated_at: new Date().toISOString(),
  });
}

export async function fetchSharedPlaylist() {
  if (!ENABLED) return null;
  const data = await supabase(`user_playlists?user_id=eq.${SHARED_USER_ID}&playlist_id=eq.${SHARED_PLAYLIST_ID}`);
  return data?.[0]?.playlist_data || null;
}
