/**
 * aiSearch.js
 * AI Search Optimizer — refines user natural language queries via Groq Llama-3.
 *
 * Key design decisions:
 *  - Hard 4s timeout via AbortController (§2.1)
 *  - Falls back silently to original query on any failure
 *  - API key rotation with in-memory exhaustion tracking (NOT localStorage — §2.6)
 *  - Module-level cancel ref for cancel-on-retype (§2.3)
 *  - LRU cache for refined queries (1hr TTL, §2.7)
 *  - `isValidQuery()` validates response before use (§2.2)
 *  - Offline guard before API call (§2.5)
 *
 * § final.md §2
 */

import { logEvent } from '../utils/errorBus.js';
import { createCache, normalizeKey, limits } from '../utils/lruCache.js';
import { getOnlineStatus } from '../utils/offlineManager.js';

// ── API Key Rotation ───────────────────────────────────────────────────────────

const GROQ_URL = 'https://api.groq.com/openai/v1/chat/completions';

const API_KEYS = (import.meta.env.VITE_GROQ_API_KEY || '')
  .split(',')
  .map(k => k.trim())
  .filter(Boolean);

// { keyIndex: timestamp } — in-memory only (hot path, localStorage too slow)
const exhaustedUntil = {};
let roundRobinIndex = 0;

/**
 * Returns the next available key using round-robin + exhaustion check.
 * @returns {{ key: string, index: number } | null}
 */
export const getActiveKey = () => {
  const now = Date.now();
  for (let i = 0; i < API_KEYS.length; i++) {
    const idx = (roundRobinIndex + i) % API_KEYS.length;
    if (!exhaustedUntil[idx] || exhaustedUntil[idx] < now) {
      roundRobinIndex = (idx + 1) % API_KEYS.length; // advance for next call
      return { key: API_KEYS[idx], index: idx };
    }
  }
  return null; // all keys exhausted
};

/**
 * Mark a key as exhausted for retryAfterMs.
 * @param {number} keyIndex
 * @param {number} retryAfterMs
 */
export const markKeyExhausted = (keyIndex, retryAfterMs = 60000) => {
  exhaustedUntil[keyIndex] = Date.now() + retryAfterMs;
  logEvent('groq_rate_limit_hit', { keyIndex, retryAfterMs });
};

// ── AI Refinements LRU Cache ──────────────────────────────────────────────────

const AI_CACHE_TTL = 60 * 60 * 1000; // 1 hour
const aiRefinementsLRU = createCache('aiRefinements', limits.aiRefinements);

/**
 * Get a cached refinement for a raw query.
 * Returns null if not cached or expired.
 * @param {string} rawQuery
 * @returns {string|null}
 */
const getCachedRefinement = (rawQuery) => {
  const key = normalizeKey(rawQuery);
  const cached = aiRefinementsLRU.get(key);
  if (!cached) return null;
  if (Date.now() - cached.cachedAt > AI_CACHE_TTL) {
    aiRefinementsLRU.delete(key);
    return null;
  }
  return cached.refinedQuery;
};

const setCachedRefinement = (rawQuery, refinedQuery) => {
  aiRefinementsLRU.set(normalizeKey(rawQuery), { refinedQuery, cachedAt: Date.now() });
};

// ── Query validation ──────────────────────────────────────────────────────────

/**
 * Validate an AI-returned query string.
 * Rejects: long strings, disallowed characters, non-music output.
 * Allows: Latin, Devanagari (Hindi), Gurmukhi (Punjabi).
 *
 * § final.md §2.2
 * @param {string} str
 * @returns {boolean}
 */
export const isValidQuery = (str) =>
  Boolean(str) &&
  str.length < 60 &&
  // eslint-disable-next-line no-misleading-character-class
  /^[a-zA-Z0-9\u0900-\u097F\u0A00-\u0A7F\s,]+$/.test(str.trim());

// ── System prompt ─────────────────────────────────────────────────────────────

const SYSTEM_PROMPT = `You are a music search query optimizer for an Indian music streaming app called Prachify.
Convert the user's natural language input into a clean, short search query (2-5 words max).
STRICT OUTPUT RULES:
- Return ONLY the search query string — no explanation, no punctuation except commas
- Maximum 60 characters
- Must be in Hindi (Devanagari or romanized), Punjabi, or English
- If the input is already a clean query, return it unchanged
- If the input is ambiguous or untranslatable to a music query, return the original input

Examples:
Input: "sad songs for a rainy evening" → "sad hindi songs rain"
Input: "arijit ki latest wali" → "Arijit Singh latest"
Input: "workout gym pump up" → "gym workout hindi"`;

// ── Core API call ─────────────────────────────────────────────────────────────

/**
 * Call Groq API with the given query. Handles 429 → key rotation.
 * @param {string} query
 * @param {AbortSignal} signal
 * @returns {Promise<string|null>}
 */
const callGroqAPI = async (query, signal) => {
  const active = getActiveKey();
  if (!active) {
    logEvent('groq_all_keys_exhausted', {});
    return null;
  }

  const res = await fetch(GROQ_URL, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${active.key}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: 'llama-3.3-70b-versatile',
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        { role: 'user', content: query },
      ],
      max_tokens: 30,
      temperature: 0.3,
    }),
    signal,
  });

  if (res.status === 429) {
    const retryAfter = parseInt(res.headers.get('retry-after') || '60', 10) * 1000;
    markKeyExhausted(active.index, retryAfter);
    // Retry recursively with next key (AbortSignal still respected)
    return callGroqAPI(query, signal);
  }

  if (!res.ok) throw new Error(`Groq API ${res.status}`);

  const data = await res.json();
  return data.choices?.[0]?.message?.content?.trim() || null;
};

// ── Main exported function ────────────────────────────────────────────────────

/**
 * Optimize a search query using Groq Llama-3.
 * Falls back to original query on any failure.
 *
 * @param {string} rawQuery
 * @param {AbortSignal} [signal]  — optional external abort signal
 * @returns {Promise<{ query: string, wasRefined: boolean }>}
 */
export const optimizeSearchQuery = async (rawQuery, signal) => {
  // Guard: empty query
  if (!rawQuery?.trim()) return { query: rawQuery, wasRefined: false };

  // Guard: offline
  if (!getOnlineStatus()) return { query: rawQuery, wasRefined: false };

  // Guard: no API keys configured
  if (API_KEYS.length === 0) return { query: rawQuery, wasRefined: false };

  // Cache hit
  const cached = getCachedRefinement(rawQuery);
  if (cached) return { query: cached, wasRefined: true };

  // 4 second timeout (§2.1)
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 4000);

  // Combine external signal + our timeout signal
  const combinedSignal = signal
    ? AbortSignal.any
      ? AbortSignal.any([signal, controller.signal])
      : controller.signal  // fallback if AbortSignal.any not supported
    : controller.signal;

  const start = Date.now();

  try {
    const result = await callGroqAPI(rawQuery, combinedSignal);
    clearTimeout(timeout);

    if (!result || !isValidQuery(result)) {
      logEvent('ai_search_garbage_output', {
        inputLen: rawQuery.length,
        outputLen: result?.length ?? 0,
      });
      return { query: rawQuery, wasRefined: false };
    }

    // Cache the successful refinement
    setCachedRefinement(rawQuery, result);
    return { query: result, wasRefined: true };
  } catch (e) {
    clearTimeout(timeout);
    logEvent('ai_search_timeout', { elapsedMs: Date.now() - start, reason: e.name });
    return { query: rawQuery, wasRefined: false };
  }
};

// ── Cancel-on-retype ──────────────────────────────────────────────────────────

let currentController = null;

/**
 * Optimize with automatic cancellation of any in-flight request.
 * Use this in the UI to cancel the previous call when user types again.
 *
 * § final.md §2.3
 * @param {string} query
 * @returns {Promise<{ query: string, wasRefined: boolean }>}
 */
export const optimizeWithCancel = async (query) => {
  if (currentController) currentController.abort();
  currentController = new AbortController();
  const result = await optimizeSearchQuery(query, currentController.signal);
  currentController = null;
  return result;
};

export default { optimizeWithCancel, optimizeSearchQuery, isValidQuery, getActiveKey };
