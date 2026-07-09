/**
 * languageFilter.js
 * Language & Vibe filter system for Prachify.
 *
 * Allowed:  Hindi, Punjabi, English
 * Blocked:  Tamil, Telugu, Bhojpuri, Bihari, Marathi, Haryanvi
 *
 * Key design decisions:
 *  - Bypass keywords use EXACT word-boundary matching (Set + split), NOT substring match
 *    Prevents blocking "dil", "naina", "maang" which are valid Hindi/Punjabi words
 *  - Language check at PLAY TIME (not just fetch) to catch cached offline songs,
 *    AND at fetch time (via filterSongsByLanguage) so bad songs never even
 *    appear in Home/Explore/Search lists in the first place
 *  - Chapri blocklist is a CDN-fetched JSON, not hardcoded — community-maintained
 *  - Filter default: ON. A stored value of exactly 'false' is the only way to
 *    turn it off — anything else (unset, or 'true') keeps it on. Flip via
 *    Settings if you want everything unfiltered.
 *
 * § final.md §1
 */

import { logEvent } from './errorBus.js';
import safeStorage from './safeStorage.js';

// ── Language bypass (blocked language explicit keywords) ──────────────────────

/**
 * When user explicitly types one of these keywords, they WANT this content.
 * So bypass the language filter entirely for that search.
 * Uses word-boundary matching via split (not .includes which would match substrings).
 */
const BYPASS_KEYWORDS = new Set([
  'bhojpuri',
  'marathi',
  'tamil',
  'telugu',
  'haryanvi',
  'bihari',
]);

/**
 * Check if a query explicitly requests a blocked language.
 * If so, show raw results without filtering (user intent overrides auto-filter).
 *
 * @param {string} query
 * @returns {boolean}
 */
export const shouldBypassFilter = (query) => {
  const words = query.toLowerCase().trim().split(/\s+/);
  const matched = words.find(w => BYPASS_KEYWORDS.has(w));
  if (matched) logEvent('filter_bypass', { matched });
  return Boolean(matched);
};

// ── Chapri blocklist (community-curated CDN) ──────────────────────────────────

export const chapriBlocklist = {
  artists: new Set(),
  labels: new Set(),
};

/**
 * Fetch the community chapri blocklist from CDN. Call once at app startup.
 * Non-blocking — SW caches it. Falls back to empty blocklist silently.
 *
 * § final.md §1.2
 */
export const fetchChapriBlocklist = async () => {
  try {
    const res = await fetch('https://cdn.prachify.app/blocklist.json', {
      cache: 'no-cache',
    });
    if (!res.ok) return;
    const { artists = [], labels = [] } = await res.json();
    chapriBlocklist.artists = new Set(artists.map(a => a.toLowerCase()));
    chapriBlocklist.labels = new Set(labels.map(l => l.toLowerCase()));
  } catch {
    // Use stale cached version from SW — silent degradation
  }
};

// True if a song's artist(s) or album match the community chapri blocklist.
// Checked inside both canPlaySong() and filterSongsByLanguage() — always
// active, independent of the language toggle (it's about spam/quality, not
// a language preference). Safe no-op until fetchChapriBlocklist() resolves.
function isChapriBlocked(song) {
  if (chapriBlocklist.artists.size === 0 && chapriBlocklist.labels.size === 0) return false;
  const artistNames = (song?.artist || '').split(',').map(a => a.trim().toLowerCase()).filter(Boolean);
  if (artistNames.some(name => chapriBlocklist.artists.has(name))) return true;
  const album = (song?.album || '').trim().toLowerCase();
  if (album && chapriBlocklist.labels.has(album)) return true;
  return false;
}

// ── Play-time language gate ───────────────────────────────────────────────────

const ALLOWED_LANGUAGES = new Set(['hindi', 'punjabi', 'english']);

function readFilterEnabled() {
  return safeStorage.get('languageFilterEnabled') !== 'false';
}

/**
 * Check if a song can be played given the current filter settings.
 * Called at PLAY TIME (not just at fetch time) — catches cached offline songs.
 *
 * @param {Object} song  - Prachify song object with .language field
 * @returns {boolean}
 */
export const canPlaySong = (song) => {
  if (isChapriBlocked(song)) return false;

  const enabled = readFilterEnabled();
  if (!enabled) return true;

  const songLang = (song?.language || '').toLowerCase().trim();

  // Missing language metadata (old cache entries) — allow but log
  if (!songLang) {
    logEvent('song_language_unknown', { songId: song?.id });
    return true;
  }

  return ALLOWED_LANGUAGES.has(songLang);
};

/**
 * Get/set the language filter enabled state.
 * Stored in safeStorage for cross-session persistence.
 */
export const isFilterEnabled = () => readFilterEnabled();

export const setFilterEnabled = (enabled) => {
  safeStorage.set('languageFilterEnabled', enabled ? 'true' : 'false');
  logEvent('filter_setting_changed', { enabled });
};

// ── Post-fetch results filter ─────────────────────────────────────────────────

/**
 * Filter an array of song results down to allowed languages + not on the
 * chapri blocklist. Used after every fetch — Search, Home sections, and
 * Explore — so bad songs never make it into a list in the first place.
 * The chapri check ALWAYS runs, even when languageCheck is skipped (e.g.
 * user explicitly bypassed the language filter by typing "telugu" — that
 * doesn't mean they want spam/low-quality uploads too).
 *
 * @param {Array} songs
 * @param {{languageCheck?: boolean}} [opts] - pass { languageCheck: false } to skip the language allow-list check (chapri check still applies)
 * @returns {Array}
 */
export const filterSongsByLanguage = (songs, opts = {}) => {
  const { languageCheck = true } = opts;
  const enabled = languageCheck && readFilterEnabled();
  const before = songs.length;
  const filtered = songs.filter(song => {
    if (isChapriBlocked(song)) return false;
    if (!enabled) return true;
    const lang = (song.language || '').toLowerCase().trim();
    if (!lang) return true; // no metadata → allow
    return ALLOWED_LANGUAGES.has(lang);
  });
  const removedCount = before - filtered.length;
  if (removedCount > 0) {
    logEvent('filter_applied', { before, after: filtered.length, removed: removedCount });
  }
  return filtered;
};

export default {
  shouldBypassFilter,
  canPlaySong,
  filterSongsByLanguage,
  isFilterEnabled,
  setFilterEnabled,
  fetchChapriBlocklist,
  chapriBlocklist,
};
