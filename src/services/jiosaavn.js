/**
 * JioSaavn API Service
 * Base: https://jiosaavn-api-9pw6.onrender.com
 * 
 * The API uses /api prefix (based on source: this.app.route('/api', route.controller))
 * CORS is enabled in the API source (hono/cors middleware)
 * 
 * Response schema (saavn.dev format):
 *   { success: true, data: { results: [...], total, start } }
 * 
 * Song object key fields:
 *   id, name, duration, image[2].url (500x500), downloadUrl[4] (320kbps),
 *   artists.primary[].name, album.name
 */

const BASE = 'https://jiosaavn-api-9pw6.onrender.com';

// Extract 320kbps stream URL
export function extractStreamUrl(downloadUrl) {
  if (!downloadUrl?.length) return null;
  const priority = ['320kbps', '160kbps', '96kbps', '48kbps'];
  for (const q of priority) {
    const match = downloadUrl.find(d => d.quality === q);
    if (match?.url) return match.url;
  }
  return downloadUrl.at(-1)?.url || null;
}

// Extract best cover art
export function extractCover(image, quality = 'high') {
  if (!image || !Array.isArray(image)) return '';
  if (quality === 'high') {
    // image[2] = 500x500, replace with higher if URL pattern allows
    const base = image[2]?.url || image[1]?.url || image[0]?.url || '';
    // JioSaavn URLs mein 150x150 → 500x500 already image[2] hai
    // Aur 500x500 → 1000x1000 bhi try kar sakte hain
    return base.replace('150x150', '500x500').replace('50x50', '500x500');
  }
  return image[1]?.url || image[0]?.url || '';
}

// Decode HTML entities in titles
export function decodeHtml(text) {
  if (!text) return '';
  return text
    .replace(/&quot;/g, '"')
    .replace(/&amp;/g, '&')
    .replace(/&#039;/g, "'")
    .replace(/&apos;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>');
}

// Normalize raw API song → Prachify internal format
export function normalizeSong(raw) {
  if (!raw) return null;

  // Handle both old schema (primaryArtists string) and new schema (artists.primary array)
  let artist = 'Unknown';
  if (raw.artists?.primary?.length) {
    artist = raw.artists.primary.map(a => a.name).join(', ');
  } else if (typeof raw.primaryArtists === 'string' && raw.primaryArtists) {
    artist = raw.primaryArtists;
  } else if (Array.isArray(raw.primaryArtists)) {
    artist = raw.primaryArtists.map(a => a.name || a).join(', ');
  }

  const url = extractStreamUrl(raw.downloadUrl);
  if (!url) return null; // skip songs without playable URL

  return {
    id: raw.id,
    title: decodeHtml(raw.name),
    artist: decodeHtml(artist),
    album: decodeHtml(raw.album?.name || ''),
    url,
    cover: extractCover(raw.image),
    duration: Number(raw.duration) || 0,
    language: raw.language || '',
    year: raw.year || '',
    source: 'jiosaavn',
  };
}

// Core fetch with timeout + retry logic
async function apiFetch(path, retries = 1) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 12000); // 12s timeout (render cold start)

  try {
    const res = await fetch(`${BASE}${path}`, {
      signal: controller.signal,
      headers: { 'Accept': 'application/json' },
    });
    clearTimeout(timeout);

    if (!res.ok) {
      // Try /api prefix if non-api path fails, and vice versa
      throw new Error(`HTTP ${res.status}`);
    }
    return await res.json();
  } catch (err) {
    clearTimeout(timeout);
    if (retries > 0 && err.name !== 'AbortError') {
      // Retry once after short delay (handles Render cold start)
      await new Promise(r => setTimeout(r, 1500));
      return apiFetch(path, retries - 1);
    }
    throw err;
  }
}

// Try both /api/path and /path prefixes, return whichever works
async function fetchWithFallback(subpath) {
  try {
    return await apiFetch(`/api${subpath}`);
  } catch {
    try {
      return await apiFetch(subpath);
    } catch (err) {
      throw new Error(`API unreachable: ${err.message}`);
    }
  }
}

// ── Public API ──────────────────────────────────────────────────────────────

export async function searchSongs(query, limit = 20) {
  const json = await fetchWithFallback(`/search/songs?query=${encodeURIComponent(query)}&limit=${limit}`);
  
  // Handle multiple response shapes
  const results = 
    json?.data?.results ||  // { data: { results: [] } }
    json?.data ||           // { data: [] }
    json?.results ||        // { results: [] }
    [];

  return results.map(normalizeSong).filter(Boolean);
}

export async function getSong(id) {
  const json = await fetchWithFallback(`/songs/${id}`);
  const raw = json?.data?.[0] || json?.data || json;
  return raw ? normalizeSong(raw) : null;
}

export async function getAlbum(id) {
  const json = await fetchWithFallback(`/albums?id=${id}`);
  const album = json?.data || json;
  if (!album) return null;
  return {
    id: album.id,
    title: album.name,
    cover: extractCover(album.image),
    artist: album.artists?.primary?.[0]?.name || album.primaryArtists || '',
    year: album.year || '',
    songs: (album.songs || []).map(normalizeSong).filter(Boolean),
  };
}

export async function getPlaylist(id) {
  const json = await fetchWithFallback(`/playlists?id=${id}`);
  const pl = json?.data || json;
  if (!pl) return null;
  return {
    id: pl.id,
    title: pl.name,
    cover: extractCover(pl.image),
    description: pl.description || '',
    songs: (pl.songs || []).map(normalizeSong).filter(Boolean),
  };
}

export async function getTrending(lang = 'hindi') {
  try {
    const results = await searchSongs(`trending ${lang} songs ${new Date().getFullYear()}`, 20);
    return results;
  } catch {
    return [];
  }
}


// ── Smart Recommendations ─────────────────────────────────────────────────────
// Picks top artists from liked songs & recently played, fetches more of their music.
export async function getRecommendations(likedSongObjects = [], recentlyPlayedSongs = [], skippedSongs = {}) {
  try {
    // Count artist frequency across liked + recent
    const artistCount = {};
    const allSongs = [...likedSongObjects, ...recentlyPlayedSongs];
    for (const song of allSongs) {
      if (!song?.artist) continue;
      // Split "Artist A, Artist B" into individual names
      const names = song.artist.split(',').map(a => a.trim()).filter(Boolean);
      for (const name of names) {
        artistCount[name] = (artistCount[name] || 0) + 1;
      }
    }

    // Pick top 3 most common artists
    const topArtists = Object.entries(artistCount)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3)
      .map(([name]) => name);

    if (topArtists.length === 0) return [];

    const knownIds = new Set(allSongs.map(s => s?.id).filter(Boolean));

    // Fetch songs for each artist in parallel
    const results = await Promise.all(
      topArtists.map(artist => searchSongs(artist, 10).catch(() => []))
    );

    // Flatten, deduplicate, filter out already-known songs
    const seen = new Set();
    const allResults = results.flat().filter(song => {
      if (!song || seen.has(song.id) || knownIds.has(song.id)) return false;
      seen.add(song.id);
      return true;
    });

    // 3+ baar skip hue songs ko hata do
    const SKIP_THRESHOLD = 3;
    const filtered = allResults.filter(song =>
      (skippedSongs[song.id] || 0) < SKIP_THRESHOLD
    );
    return filtered.slice(0, 15);
  } catch {
    return [];
  }
}

// ── Daily Mix ─────────────────────────────────────────────────────────────────
// Generates a fresh mix every day based on liked artists. Cached in localStorage.
export async function getDailyMix(likedSongObjects = []) {
  const today = new Date().toISOString().slice(0, 10); // "2026-05-29"
  const cacheKey = `prachify_daily_mix_${today}`;

  // Return cached mix if it already exists for today
  try {
    const cached = localStorage.getItem(cacheKey);
    if (cached) return JSON.parse(cached);
  } catch (e) { console.warn('Failed to read daily mix cache:', e); }

  try {
    // Pick up to 4 distinct artists from liked songs
    const artists = [];
    const seen = new Set();
    for (const song of likedSongObjects) {
      if (!song?.artist) continue;
      const name = song.artist.split(',')[0].trim();
      if (!seen.has(name)) { seen.add(name); artists.push(name); }
      if (artists.length >= 4) break;
    }

    // Fallback queries if no liked songs yet
    const queries = artists.length > 0
      ? artists.map(a => `${a} hits`)
      : ['top hindi hits 2024', 'trending bollywood', 'popular punjabi songs'];

    const knownIds = new Set(likedSongObjects.map(s => s?.id).filter(Boolean));

    const results = await Promise.all(
      queries.map(q => searchSongs(q, 8).catch(() => []))
    );

    const seenIds = new Set();
    const mix = results.flat().filter(song => {
      if (!song || seenIds.has(song.id) || knownIds.has(song.id)) return false;
      seenIds.add(song.id);
      return true;
    });

    // Shuffle for variety
    const shuffled = mix.sort(() => Math.random() - 0.5).slice(0, 20);

    // Cache for the day
    try { localStorage.setItem(cacheKey, JSON.stringify(shuffled)); } catch (e) { console.warn('Failed to cache daily mix:', e); }

    return shuffled;
  } catch {
    return [];
  }
}

// ── Hidden Gems ───────────────────────────────────────────────────────────────
// Searches niche/underplayed queries and filters out songs the user already knows.
export async function getHiddenGems(likedSongObjects = [], recentlyPlayedSongs = []) {
  const nicheQueries = [
    'indie hindi underrated 2023',
    'underground punjabi new',
    'lesser known bollywood gems',
    'hidden hindi songs 2022',
    'indie pop india 2024',
    'underrated romantic hindi',
  ];

  try {
    const knownIds = new Set(
      [...likedSongObjects, ...recentlyPlayedSongs].map(s => s?.id).filter(Boolean)
    );

    // Pick 3 random niche queries so it feels different each session
    const picked = nicheQueries.sort(() => Math.random() - 0.5).slice(0, 3);
    const results = await Promise.all(
      picked.map(q => searchSongs(q, 10).catch(() => []))
    );

    const seen = new Set();
    return results.flat().filter(song => {
      if (!song || seen.has(song.id) || knownIds.has(song.id)) return false;
      seen.add(song.id);
      return true;
    }).slice(0, 15);
  } catch {
    return [];
  }
}

export async function getLyrics(songId) {
  try {
    const json = await fetchWithFallback(`/songs/${songId}/lyrics`);
    const raw = json?.data?.lyrics || json?.lyrics || '';
    if (!raw) return null;
    // Lines mein tod do, empty lines hata do
    return raw
      .replace(/<br\s*\/?>/gi, '\n')
      .replace(/<[^>]+>/g, '')
      .split('\n')
      .map(l => l.trim())
      .filter(l => l.length > 0);
  } catch {
    return null;
  }
}
