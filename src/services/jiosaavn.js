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
export function extractCover(image) {
  if (!image?.length) return '';
  // Prefer highest quality (index 2 = 500x500)
  return image[2]?.url || image[1]?.url || image[0]?.url || '';
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
    title: raw.name,
    artist,
    album: raw.album?.name || '',
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
  } catch (e1) {
    try {
      return await apiFetch(subpath);
    } catch (e2) {
      throw new Error(`API unreachable: ${e2.message}`);
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
    const results = await searchSongs(`trending ${lang} songs 2024`, 20);
    return results;
  } catch {
    return [];
  }
}

export async function searchAll(query) {
  return fetchWithFallback(`/search?query=${encodeURIComponent(query)}`);
}
