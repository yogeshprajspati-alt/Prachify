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
 *  - Language check at PLAY TIME (not just fetch) to catch cached offline songs
 *  - Chapri blocklist is a CDN-fetched JSON, not hardcoded — community-maintained
 *  - Filter default: OFF (safer for new users, per §1.6)
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

// ── Play-time language gate ───────────────────────────────────────────────────

const ALLOWED_LANGUAGES = new Set(['hindi', 'punjabi', 'english']);

/**
 * Check if a song can be played given the current filter settings.
 * Called at PLAY TIME (not just at fetch time) — catches cached offline songs.
 *
 * @param {Object} song  - Prachify song object with .language field
 * @returns {boolean}
 */
export const canPlaySong = (song) => {
  // § final.md §1.5, §1.6 — default OFF (safer for new users)
  // Filter is only active when user has explicitly enabled it
  const enabled = safeStorage.get('languageFilterEnabled') === 'true';
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
export const isFilterEnabled = () => safeStorage.get('languageFilterEnabled') === 'true';

export const setFilterEnabled = (enabled) => {
  safeStorage.set('languageFilterEnabled', enabled ? 'true' : 'false');
  logEvent('filter_setting_changed', { enabled });
};

// ── Post-fetch results filter ─────────────────────────────────────────────────

/**
 * Filter an array of song results to allowed languages only.
 * Used after a search fetch when bypassFilter is false.
 *
 * @param {Array} songs
 * @returns {Array}
 */
export const filterSongsByLanguage = (songs) => {
  if (!isFilterEnabled()) return songs;
  const before = songs.length;
  const filtered = songs.filter(song => {
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

// ── Chapri blocklist (community-curated CDN) ──────────────────────────────────

export const chapriBlocklist = {
  artists: new Set(),
  labels: new Set(),
};

/**
 * Fetch the community chapri blocklist from CDN.
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

export default {
  shouldBypassFilter,
  canPlaySong,
  filterSongsByLanguage,
  isFilterEnabled,
  setFilterEnabled,
  fetchChapriBlocklist,
};
