
import fs from 'fs';
const env = fs.readFileSync('.env', 'utf-8');
const url = env.match(/VITE_SUPABASE_URL=(.+)/)[1].trim();
const key = env.match(/VITE_SUPABASE_ANON_KEY=(.+)/)[1].trim();

async function run() {
  const res = await fetch(url + '/rest/v1/user_playlists', {
    headers: { 'apikey': key, 'Authorization': 'Bearer ' + key }
  });
  const data = await res.json();
  console.log('Playlists:', data.length);
  const userIds = [...new Set(data.map(d => d.user_id))];
  console.log('User IDs:', userIds);
}
run();

