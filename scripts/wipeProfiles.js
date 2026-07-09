const url = "https://neneqwreqjgofdrdsxcw.supabase.co/rest/v1";
const key = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5lbmVxd3JlcWpnb2ZkcmRzeGN3Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzk5NzE2MjUsImV4cCI6MjA5NTU0NzYyNX0.kKfMaNwp4AT34FZDc00_NO_Bz6K_9vHpl8I6UF4DVIM";

async function clearDB(userId) {
  const headers = {
    'apikey': key,
    'Authorization': `Bearer ${key}`,
    'Content-Type': 'application/json'
  };

  const res1 = await fetch(`${url}/user_tracks?user_id=eq.${userId}`, { method: 'DELETE', headers });
  console.log(`Deleted tracks for ${userId}: ${res1.status}`);

  const res2 = await fetch(`${url}/user_playlists?user_id=eq.${userId}`, { method: 'DELETE', headers });
  console.log(`Deleted playlists for ${userId}: ${res2.status}`);
}

async function run() {
  await clearDB('prachify_chanchal');
  await clearDB('prachify_deepak');
  console.log("Done");
}

run();
