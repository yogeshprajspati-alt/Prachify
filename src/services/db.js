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
console.log('[DB] Supabase initialization:', { enabled: ENABLED, url: SUPABASE_URL });

// Since this is a private app for a single user, we hardcode the ID.
// This ensures every device (PC, phone, tablet) shares the exact same database.
export function getUserId() {
  return 'prachify_private_admin_user';
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
  if (!ENABLED) return;
  const userId = getUserId();
  await supabase('user_tracks?on_conflict=user_id,song_id', 'POST', {
    user_id: userId,
    song_id: song.id,
    song_data: song,
  });
}

export async function syncUnlike(songId) {
  if (!ENABLED) return;
  const userId = getUserId();
  await supabase(`user_tracks?user_id=eq.${userId}&song_id=eq.${songId}`, 'DELETE');
}

export async function fetchLikedSongs() {
  if (!ENABLED) return null;
  const userId = getUserId();
  const data = await supabase(`user_tracks?user_id=eq.${userId}&order=created_at.desc`);
  return data?.map(row => row.song_data) || [];
}

// ── Playlists ────────────────────────────────────────────────────────────────

export async function syncPlaylist(playlist) {
  if (!ENABLED) return;
  const userId = getUserId();
  await supabase('user_playlists?on_conflict=user_id,playlist_id', 'POST', {
    user_id: userId,
    playlist_id: playlist.id,
    playlist_data: playlist,
    updated_at: new Date().toISOString(),
  });
}

export async function deletePlaylistFromDB(playlistId) {
  if (!ENABLED) return;
  const userId = getUserId();
  await supabase(`user_playlists?user_id=eq.${userId}&playlist_id=eq.${playlistId}`, 'DELETE');
}

export async function fetchPlaylists() {
  if (!ENABLED) return null;
  const userId = getUserId();
  const data = await supabase(`user_playlists?user_id=eq.${userId}&order=updated_at.desc`);
  return data?.map(row => row.playlist_data) || [];
}

export { ENABLED as dbEnabled };
