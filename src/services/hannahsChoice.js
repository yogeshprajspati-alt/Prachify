/**
 * hannahsChoice.js
 * AI-powered personalized music recommendations for the Home page.
 *
 * Pipeline:
 *   1. Check if today's cache is valid → if yes, skip AI call (§4.2)
 *   2. Collect likedSongs + recentSongs titles (§4)
 *   3. New user guard: < 5 songs → skip AI, show trending instead (§4.1)
 *   4. Call Groq Llama-3 70B for 10 song suggestions (§4)
 *   5. Write raw AI suggestions to safeStorage IMMEDIATELY (before JioSaavn) (§4.6, iOS kill fix)
 *   6. Parallel-resolve suggestions from JioSaavn via Promise.allSettled (§4.4)
 *   7. Deduplicate by artist (max 2 per artist) (§4.8)
 *   8. Taste drift: aggressively unlike 3+ songs → invalidate cache (§4)
 *
 * § final.md §4
 */

import safeStorage from '../utils/safeStorage.js';
import { logEvent } from '../utils/errorBus.js';
import { searchSongs } from './jiosaavn.js';
import { getActiveKey, markKeyExhausted } from './aiSearch.js';

const GROQ_URL = 'https://api.groq.com/openai/v1/chat/completions';
const CACHE_KEY = 'hannahsChoice_v1';

// ── Taste drift tracking (§4 — Taste Drift Handling) ────────────────────────

const SIGNIFICANT_CHANGE_THRESHOLD = 3; // unlikes in one session
let unlikeCountThisSession = 0;

/**
 * Call this when user unlikes a song.
 * After 3 unlikes in a session, Hannah's cache is invalidated to force refresh.
 */
export const onUnlike = (songId) => {
  unlikeCountThisSession++;
  if (unlikeCountThisSession >= SIGNIFICANT_CHANGE_THRESHOLD) {
    safeStorage.remove(CACHE_KEY);
    logEvent('hannah_cache_invalidated', {
      reason: 'taste_drift',
      unlikeCount: unlikeCountThisSession,
    });
    unlikeCountThisSession = 0; // reset after invalidation
  }
};

// ── Cache helpers ─────────────────────────────────────────────────────────────

const today = () => new Date().toISOString().split('T')[0]; // "2025-06-05"

/**
 * Returns cached resolved songs if today's cache exists.
 * @returns {Array|null}
 */
export const getCachedHannahsChoice = () => {
  const cached = safeStorage.getJSON(CACHE_KEY);
  if (!cached || cached.cachedDate !== today()) return null;
  return cached.songs || null;
};

// ── AI Response parsing ───────────────────────────────────────────────────────

/**
 * Parse and validate AI JSON response.
 * Handles Llama-3 formatting artifacts (markdown fences, leading text).
 *
 * § final.md §4.5
 * @param {string} raw
 * @returns {Array<{title: string, artist: string}>|null}
 */
export const parseAIResponse = (raw) => {
  const cleaned = raw
    .replace(/```json|```/g, '')
    .replace(/^[^[{]*/s, '') // strip any leading text before JSON
    .trim();
  try {
    const parsed = JSON.parse(cleaned);
    if (!Array.isArray(parsed)) return null;
    return parsed.filter(item => item.title && item.artist);
  } catch {
    logEvent('hannah_json_parse_fail', { rawLength: raw.length });
    return null;
  }
};

// ── Artist deduplication ──────────────────────────────────────────────────────

/**
 * Remove songs that push any artist beyond maxPerArtist.
 * Prevents Llama-3 from clustering around Arijit Singh / Jubin Nautiyal.
 *
 * § final.md §4.8
 * @param {Array} songs
 * @param {number} maxPerArtist
 * @returns {Array}
 */
export const deduplicateByArtist = (songs, maxPerArtist = 2) => {
  const counts = {};
  return songs.filter(song => {
    const key = (song.artist || '').toLowerCase().trim();
    counts[key] = (counts[key] || 0) + 1;
    return counts[key] <= maxPerArtist;
  });
};

// ── System prompt ─────────────────────────────────────────────────────────────

const buildSystemPrompt = (songList) => `
You are a music recommendation engine for an Indian music app called Prachify.
The user enjoys the following songs: ${songList}

Return exactly 10 song recommendations that match this taste.
STRICT RULES:
- Only Hindi, Punjabi, or English songs
- NO Tamil, Telugu, Bhojpuri, Haryanvi, Marathi songs
- NO DJ remixes, no crude lyric tracks, no viral cringe content
- Prefer mainstream Bollywood, indie, and quality commercial music
- Vary the artists — do NOT repeat the same artist more than twice
- Do NOT suggest any song that appears in the input list
- Return ONLY valid JSON, no markdown, no explanation:
  [{"title": "...", "artist": "..."}, ...]
`.trim();

// ── JioSaavn resolution ───────────────────────────────────────────────────────

/**
 * Resolve an array of {title, artist} pairs to Prachify song objects via JioSaavn search.
 * Uses Promise.allSettled — partial results are acceptable.
 *
 * § final.md §4.4
 * @param {Array<{title: string, artist: string}>} suggestions
 * @returns {Promise<Array>}  — valid resolved songs only
 */
const resolveSongsFromJioSaavn = async (suggestions) => {
  const results = await Promise.allSettled(
    suggestions.map(({ title, artist }) =>
      searchSongs(`${title} ${artist}`, 1).then(songs => songs[0] || null)
    )
  );
  return results
    .filter(r => r.status === 'fulfilled' && r.value)
    .map(r => r.value);
};

// ── Module-level singleton guard ─────────────────────────────────────────────

let isLoadingHannahsChoice = false; // prevents concurrent loads (§4.7)

// ── Main export ───────────────────────────────────────────────────────────────

/**
 * Load Hannah's Choice recommendations.
 *
 * @param {Array} likedSongObjects  — full song objects from store
 * @param {Array} recentSongObjects — recent song objects
 * @param {string[]} groqKeys       — Groq API keys (comma-separated from env, pre-split)
 * @returns {Promise<Array|null>}   — resolved Prachify song objects, or null if unavailable
 */
export const loadHannahsChoice = async (likedSongObjects = [], recentSongObjects = []) => {
  // § final.md §4.7 — concurrent load guard
  if (isLoadingHannahsChoice) return null;
  isLoadingHannahsChoice = true;

  try {
    // § final.md §4.2 — daily cache check
    const cached = getCachedHannahsChoice();
    if (cached) return cached;

    // § final.md §4.1 — new user guard
    const totalSongs = likedSongObjects.length + recentSongObjects.length;
    if (totalSongs < 5) {
      logEvent('hannah_skipped', { reason: 'new_user', totalSongs });
      return null; // caller shows "Trending Today" instead
    }

    // Build song list for prompt (use most recent/liked 10, avoid overwhelming prompt)
    const seedSongs = [...likedSongObjects, ...recentSongObjects]
      .slice(0, 10)
      .map(s => `"${s.title}" by ${s.artist}`)
      .join(', ');

    // Pick an available Groq key from aiSearch logic
    const keyObj = getActiveKey();
    if (!keyObj || !keyObj.key) {
      logEvent('hannah_no_key', {});
      return null;
    }
    const key = keyObj.key;

    // AI call
    const res = await fetch(GROQ_URL, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${key}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'llama-3.3-70b-versatile',
        messages: [{ role: 'user', content: buildSystemPrompt(seedSongs) }],
        max_tokens: 800,
        temperature: 0.7,
      }),
    });

    if (res.status === 429) {
      markKeyExhausted(keyObj.index);
      logEvent('hannah_rate_limited', { keyIndex: keyObj.index });
      return null;
    }

    if (!res.ok) {
      logEvent('hannah_api_error', { status: res.status });
      return null;
    }

    const data = await res.json();
    const rawContent = data.choices?.[0]?.message?.content || '';
    const parsed = parseAIResponse(rawContent);

    if (!parsed || parsed.length === 0) {
      logEvent('hannah_parse_failed', {});
      return null;
    }

    // § final.md §4.6 — write raw AI suggestions to storage BEFORE JioSaavn fetch
    // This protects against iOS killing the PWA tab mid-resolution
    safeStorage.setJSON(`${CACHE_KEY}_raw`, { suggestions: parsed, cachedDate: today() });

    // Resolve from JioSaavn
    const resolved = await resolveSongsFromJioSaavn(parsed);

    // § final.md §4.4 — fallback if too few songs resolved
    if (resolved.length < 5) {
      logEvent('hannah_fallback', { validCount: resolved.length, totalAttempted: parsed.length });
      // Could trigger a second AI call here with different seed songs (future enhancement)
      if (resolved.length === 0) return null;
    }

    // § final.md §4.8 — deduplicate by artist (max 2 per artist)
    const deduped = deduplicateByArtist(resolved);

    // Cache the final resolved songs
    const success = safeStorage.setJSON(CACHE_KEY, { songs: deduped, cachedDate: today() });
    if (!success) {
      logEvent('hannah_cache_write_fail', {});
      // Keep in-memory only — silent degradation (§4.3)
    }

    return deduped;
  } catch (e) {
    logEvent('hannah_error', { message: e.message });
    return null;
  } finally {
    isLoadingHannahsChoice = false;
  }
};

export const fetchFullscreenAISuggestions = async (currentSong, signal) => {
  if (!currentSong) return null;
  const keyObj = getActiveKey();
  if (!keyObj) return null;

  const prompt = `
You are a music taste engine for Prachify, an Indian music app.
The user is currently playing: "${currentSong.title}" by ${currentSong.artist}
Genre hints from metadata: ${currentSong.album || ''}
Mood tags: Bollywood, Indie, Pop

Suggest exactly 5 songs that match this song's vibe and mood.
RULES:
- Different artists from each other AND from ${currentSong.artist}
- Only Hindi, Punjabi, or English songs
- NO DJ remixes or chapri tracks
- Do NOT suggest: "${currentSong.title}" by ${currentSong.artist}
- Return ONLY valid JSON, no markdown, no explanation:
  [{"title": "...", "artist": "..."}]
  `.trim();

  try {
    const res = await fetch(GROQ_URL, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${keyObj.key}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'llama-3.3-70b-versatile',
        messages: [{ role: 'user', content: prompt }],
        max_tokens: 500,
        temperature: 0.7,
      }),
      signal,
    });

    if (res.status === 429) {
      markKeyExhausted(keyObj.index);
      logEvent('fullscreen_ai_rate_limited', { keyIndex: keyObj.index });
      return null;
    }

    if (!res.ok) return null;

    const data = await res.json();
    const rawContent = data.choices?.[0]?.message?.content || '';
    const parsed = parseAIResponse(rawContent);

    if (!parsed || parsed.length === 0) return null;

    // Filter out current song client-side just in case
    const filtered = parsed.filter(s => 
      s.title.toLowerCase() !== currentSong.title.toLowerCase() &&
      s.artist.toLowerCase() !== currentSong.artist.toLowerCase()
    );

    const resolved = await resolveSongsFromJioSaavn(filtered);
    return deduplicateByArtist(resolved);
  } catch (e) {
    if (e.name !== 'AbortError') {
      logEvent('fullscreen_ai_error', { message: e.message });
    }
    return null;
  }
};

export default {
  loadHannahsChoice,
  getCachedHannahsChoice,
  onUnlike,
  parseAIResponse,
  deduplicateByArtist,
  fetchFullscreenAISuggestions,
};
