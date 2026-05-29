
import fs from 'fs';
const env = fs.readFileSync('.env', 'utf-8');
const url = env.match(/VITE_SUPABASE_URL=(.+)/)[1].trim();
const key = env.match(/VITE_SUPABASE_ANON_KEY=(.+)/)[1].trim();

const NEW_ID = 'prachify_private_admin_user';

async function migrate() {
  const headers = { 'apikey': key, 'Authorization': 'Bearer ' + key, 'Content-Type': 'application/json', 'Prefer': 'resolution=merge-duplicates' };
  
  // Migrate Playlists
  const res1 = await fetch(url + '/rest/v1/user_playlists', { headers: { ...headers, 'Prefer': '' } });
  const playlists = await res1.json();
  
  for (const p of playlists) {
    if (p.user_id !== NEW_ID) {
      await fetch(url + '/rest/v1/user_playlists?on_conflict=user_id,playlist_id', {
        method: 'POST',
        headers,
        body: JSON.stringify({ user_id: NEW_ID, playlist_id: p.playlist_id, playlist_data: p.playlist_data })
      });
      console.log('Migrated playlist:', p.playlist_data.name);
    }
  }

  // Migrate Tracks (Liked Songs)
  const res2 = await fetch(url + '/rest/v1/user_tracks', { headers: { ...headers, 'Prefer': '' } });
  const tracks = await res2.json();
  
  for (const t of tracks) {
    if (t.user_id !== NEW_ID) {
      await fetch(url + '/rest/v1/user_tracks?on_conflict=user_id,song_id', {
        method: 'POST',
        headers,
        body: JSON.stringify({ user_id: NEW_ID, song_id: t.song_id, song_data: t.song_data })
      });
      console.log('Migrated track:', t.song_data.title);
    }
  }
  
  console.log('Migration complete!');
}
migrate();

