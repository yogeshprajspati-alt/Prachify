# 🚀 Prachify: Enhanced Engineering Roadmap
### PWA-Optimized | Performance-First | AI-Enhanced | Production-Ready
> **Version:** 4.0 — Gap-Closed  
> **Platform:** Progressive Web App (PWA)  
> **Rule:** Zero performance compromise. Zero silent failures in production.

---

## 🗂️ Table of Contents

| # | Section |
|---|---|
| — | [PWA-Specific Constraints](#pwa-constraints) |
| — | [Performance Budget & Rules](#performance) |
| 1 | [Language & Vibe Filter System](#filter) |
| 2 | [AI Search Optimizer](#ai-search) |
| 3 | [LRU Cache System](#lru) |
| 4 | [Hannah's Choice — AI Home Recommendations](#hannah) |
| 5 | [Fullscreen Player AI Suggestions](#fullscreen) |
| 6 | [Liquid Slide Sheet (Touch Gestures)](#sheet) |
| 7 | [Gapless Playback (Audio Prefetching)](#gapless) |
| 8 | [Cover Art Caching (Service Worker Cache)](#cover-art) |
| 9 | [Mobile Haptic Feedback](#haptics) |
| 10 | [Error Monitoring & Observability](#observability) |
| 11 | [API Events Backend Spec *(NEW)*](#events-backend) |
| 12 | [Offline-First Strategy *(NEW)*](#offline) |
| — | [PWA-Specific Global Edge Cases](#global) |
| — | [Implementation Priority Matrix](#priority) |
| — | [Pre-Ship Checklist](#checklist) |

---

## ⚡ PWA-Specific Constraints (Read First)

Before any feature implementation, these PWA realities must be understood and internalized:

| Constraint | Impact | Mitigation Strategy |
|---|---|---|
| No persistent background threads | Audio prefetch must use Service Worker, not `setTimeout` | Use `postMessage` to SW for all background fetches |
| `localStorage` is sync & blocks main thread | Large cache reads must be deferred | Wrap in `requestIdleCallback` or defer to after render |
| iOS Safari PWA has strict audio policies | Playback requires user gesture to unlock `AudioContext` | Unlock on first `touchend` anywhere in app |
| Memory budget ~150MB on mid-range Android | LRU limits must be tuned per device class | Use `navigator.deviceMemory` to adjust limits |
| Service Worker lifecycle is unpredictable | Caches must be versioned and fallback-safe | Always implement `skipWaiting()` + `clients.claim()` |
| No push notifications without HTTPS + permission | Haptics and notifications need graceful degradation | Feature-detect before every call |
| iOS PWA kills background tabs aggressively | In-memory caches can disappear mid-session | Persist critical state to `sessionStorage` on change |
| `navigator.connection` not available on all browsers | Data-saver checks can silently fail | Always guard: `navigator.connection?.saveData` |
| IndexedDB operations are async | Can't block render waiting for IDB | Use optimistic UI, write IDB in background |

---

## 🛑 STRICT RULE: ZERO PERFORMANCE COMPROMISE

Every feature must pass these gates before shipping:

### 📌 Performance Budget

| Metric | Limit | How to Measure |
|---|---|---|
| First Contentful Paint (FCP) | < 1.5s on 4G | Lighthouse + Chrome DevTools |
| Time to Interactive (TTI) | < 3.5s on mid-range Android | Lighthouse (throttled CPU 4x) |
| Input Latency | < 100ms | DevTools Performance tab |
| Animation Frame Rate | 60 FPS constant (no jank) | DevTools → Rendering → Frame Rate Meter |
| JS Bundle delta per feature | < 5KB gzipped | `bundlephobia` or webpack-bundle-analyzer |
| Memory usage (steady state) | < 120MB | Chrome Task Manager |
| Largest Contentful Paint (LCP) | < 2.5s | Lighthouse |
| Cumulative Layout Shift (CLS) | < 0.1 | Lighthouse |

### 📌 Animation Rules
- **Only animate:** `transform` and `opacity` — GPU-composited, no reflow
- **Never animate:** `top`, `left`, `height`, `width`, `margin`, `padding`
- **Spring physics:** Use CSS `transition: transform 0.35s cubic-bezier(0.34, 1.56, 0.64, 1)` for sheet gestures
- **Reduced motion:** Always check `prefers-reduced-motion` media query and disable decorative animations
- **Will-change:** Use `will-change: transform` only on elements actively animating — remove it after animation ends to release GPU memory

```css
@media (prefers-reduced-motion: reduce) {
  * { transition-duration: 0.01ms !important; animation-duration: 0.01ms !important; }
}
```

### 📌 Device-Class Adaptive Strategy

Mid-range Android (< 4GB RAM) needs different treatment than flagship phones:

```js
const getDeviceClass = () => {
  const mem = navigator.deviceMemory; // in GB, undefined on iOS
  if (!mem || mem >= 4) return 'high';
  if (mem >= 2) return 'mid';
  return 'low';
};

const LRU_LIMITS = {
  high: { search: 50, songs: 150, aiRefinements: 30 },
  mid:  { search: 30, songs: 100, aiRefinements: 20 },
  low:  { search: 15, songs:  50, aiRefinements: 10 },
};

const deviceClass = getDeviceClass();
const limits = LRU_LIMITS[deviceClass];
```

---

## 📊 10. Error Monitoring & Observability *(NEW — Previously Missing)*

This section was entirely absent from v2.0. Without it, production failures are invisible.

### 📌 Why This Matters
- AI calls fail silently by design (good UX) — but you need to know if they fail 80% of the time
- Language filter false positives block legitimate songs — invisible without logging
- Stream URL expiry causing playback failures — no stack trace in the wild

### 📌 Lightweight Client-Side Error Bus

Do NOT reach for a full APM (Sentry, Datadog) on day one — too heavy for a PWA budget. Build a thin event bus first:

```js
// errorBus.js — central event collector
const MAX_EVENTS = 200; // ring buffer to avoid memory leak
const events = [];

export const logEvent = (type, data = {}) => {
  const entry = {
    type,
    ts: Date.now(),
    url: location.pathname,
    ...data,
  };
  if (events.length >= MAX_EVENTS) events.shift();
  events.push(entry);

  // In production, flush to your backend every 5 minutes or on page unload
  if (process.env.NODE_ENV === 'production') {
    scheduleFlush(entry);
  } else {
    console.debug('[Prachify Event]', entry);
  }
};

// Usage across the app:
logEvent('ai_search_timeout', { query: rawQuery, elapsedMs: 4000 });
logEvent('filter_bypass', { query, reason: 'blocked_keyword_found' });
logEvent('stream_url_expired', { songId, ageMs: Date.now() - prefetchedAt });
logEvent('hannah_fallback', { reason: 'jiosaavn_match_count_too_low', validCount: 3 });
```

### 📌 Key Events to Track

| Event Name | Trigger | Why It Matters |
|---|---|---|
| `ai_search_timeout` | Groq takes > 4s | Track AI reliability over time |
| `ai_search_garbage_output` | Response fails `isValidQuery()` | Detect model degradation |
| `groq_rate_limit_hit` | 429 received | Know when to upgrade tier |
| `filter_bypass` | User query contains blocked keyword | Understand bypass frequency |
| `filter_false_positive_reported` | User taps "Not the right song" | Surface filter tuning needs |
| `hannah_fallback` | < 5 songs resolved from JioSaavn | Track recommendation quality |
| `stream_url_expired` | Prefetch age > 10 min at play time | Monitor URL lifespan patterns |
| `sw_cache_quota_exceeded` | Cache Storage write fails | Alert on storage pressure |
| `lru_eviction` | LRU drops an item | Track cache pressure |
| `playback_error` | Audio element fires `error` event | Most critical — silence = bugs |

### 📌 Flush Strategy (Battery-Friendly)

```js
// Batch flush — don't ping server on every event
let flushTimer = null;
const pendingFlush = [];

const scheduleFlush = (entry) => {
  pendingFlush.push(entry);
  if (!flushTimer) {
    flushTimer = setTimeout(flush, 5 * 60 * 1000); // 5 min
  }
};

const flush = async () => {
  flushTimer = null;
  if (!pendingFlush.length || !navigator.onLine) return;
  const batch = pendingFlush.splice(0);
  try {
    await fetch('/api/events', {
      method: 'POST',
      body: JSON.stringify(batch),
      headers: { 'Content-Type': 'application/json' },
      keepalive: true, // survives page unload
    });
  } catch {
    // silently drop — don't crash the app for analytics
  }
};

// Also flush on page hide (covers tab close, backgrounding)
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'hidden') flush();
});
```

### ⚠️ Edge Cases

#### 10.1 — Analytics Calls Themselves Fail
- The flush `fetch` fails (offline, server down) → don't retry infinitely
- **Fix:** Drop the batch silently. Analytics is best-effort. Never let analytics affect UX.

#### 10.2 — Private Mode Blocks All Storage
- `localStorage` unavailable → can't persist event queue across sessions
- **Fix:** Keep ring buffer in-memory only. Events lost on tab close is acceptable.

#### 10.3 — GDPR / Privacy
- Event logs contain query strings → user's search history
- **Fix:** Hash or strip PII before sending. Never log full query text to backend — log only length and intent category.

---

## 🛡️ 1. Language & Vibe Filter System

### 📌 Core Rules
- **Allowed:** Hindi, Punjabi, English
- **Blocked:** Tamil, Telugu, Bhojpuri, Bihari, Marathi, Haryanvi, "chapri"

### 📌 Filter Architecture

```
User Search Query
      │
      ▼
Normalize: lowercase + trim
      │
      ▼
Does query contain a blocked language keyword? (exact word-boundary match)
      │
   YES ──► Set bypassFilter=true → show raw results
      │    Log: logEvent('filter_bypass', { query, matchedKeyword })
   NO  ──► Apply auto-filter to results
            (strip tracks where JioSaavn language ∉ ['hindi','punjabi','english'])
            │
            ▼
         Log filtered count for monitoring
```

### ⚠️ Edge Cases

#### 1.1 — Ambiguous Language Keywords
- Query: `"dil song"` — "dil" is valid Hindi/Punjabi, do NOT block
- Query: `"naina"` — common in Hindi + Punjabi, do NOT flag
- Query: `"maang"` — also valid, not Bhojpuri-specific
- **Fix:** Blocked keyword list must be a **curated exact-match list**, not substring match

```js
const BYPASS_KEYWORDS = new Set(['bhojpuri', 'marathi', 'tamil', 'telugu', 'haryanvi', 'bihari']);

const shouldBypass = (query) => {
  const words = query.toLowerCase().trim().split(/\s+/);
  const matched = words.find(w => BYPASS_KEYWORDS.has(w));
  if (matched) logEvent('filter_bypass', { matched });
  return Boolean(matched);
};
// Uses Set for O(1) lookup + word boundary check, not .includes()
```

#### 1.2 — "Chapri" Detection — Realistic Strategy *(Expanded)*
- "Chapri" is **subjective** — no metadata tag exists for it in JioSaavn
- AI-only detection is unreliable and will create false positives for legitimate songs
- **Multi-layer approach (in priority order):**
  1. **User-controlled artist/label blocklist** — stored in `localStorage`, user can add/remove
  2. **Community-curated blocklist** — maintained as a JSON file in your CDN, updated weekly; fetch on app start, cache in Service Worker
  3. **AI system prompt nudge** — describe chapri characteristics as a soft filter, NOT a hard gate
  4. **User feedback loop** — "Not my vibe" button on any song → logs to your event bus → feeds blocklist curation

```js
// Community blocklist fetch (non-blocking)
const fetchChapriBlocklist = async () => {
  try {
    const res = await fetch('https://cdn.prachify.app/blocklist.json', {
      cache: 'no-cache',
    });
    const { artists, labels } = await res.json();
    chapriBlocklist.artists = new Set(artists);
    chapriBlocklist.labels = new Set(labels);
  } catch {
    // use stale cached version from SW — silent degradation
  }
};
```

#### 1.3 — Mixed-Language Songs
- Many Bollywood songs have Tamil/Telugu bridges (e.g., AR Rahman tracks)
- JioSaavn metadata may tag them as Hindi but have regional elements
- **Decision:** Filter by JioSaavn's `language` metadata field only — do not NLP-analyze lyrics
- This is correct behaviour: if JioSaavn says Hindi, it's Hindi

#### 1.4 — Smart Queue Edge Cases
- If user manually adds a blocked-language song to queue → **allow it** (user intent overrides auto-filter)
- If Smart Queue runs out of allowed songs → show empty state + prompt to relax filter, never autoplay blocked content silently
- **New:** Log `logEvent('filter_empty_queue', { filterConfig })` when this happens — frequent occurrences mean filter is too aggressive

#### 1.5 — Offline Mode
- Cached songs before filter was enabled may include blocked language
- **Fix:** Apply filter check at **play time**, not just at fetch time
- Show toast: *"Some offline songs may not match your language preferences"*

```js
// playerStore.js — called before every song play
const canPlaySong = (song) => {
  const filterEnabled = safeStorage.get('languageFilterEnabled') !== 'false';
  if (!filterEnabled) return true;

  const allowedLanguages = new Set(['hindi', 'punjabi', 'english']);
  const songLang = (song.language || '').toLowerCase().trim();

  // If language metadata missing (e.g. old cache), allow with warning
  if (!songLang) {
    logEvent('song_language_unknown', { songId: song.id });
    return true;
  }

  return allowedLanguages.has(songLang);
};

// In playback controller:
const playSong = (song) => {
  if (!canPlaySong(song)) {
    showToast('This song doesn\'t match your language preferences');
    logEvent('filter_blocked_at_play', { songId: song.id, language: song.language });
    skipToNext(); // never leave user in silence
    return;
  }
  // ... normal play logic
};
```

#### 1.6 — Filter Config Sync Across Sessions *(NEW)*
- User enables filter on one session → closes app → filter state must persist
- **Fix:** Store `filterConfig` in `localStorage` via `safeStorage`. Load on app init before first render.
- If `filterConfig` missing → default to filter **off** (safer for new users)

---

## 🧠 2. AI Search Optimizer

### 📌 How It Works
User types natural language → taps **AI ✨** → Groq Llama-3 70B refines → clean query auto-executes.

### 📌 System Prompt (Improved)

```
You are a music search query optimizer for an Indian music streaming app.
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
Input: "workout gym pump up" → "gym workout hindi"
```

### ⚠️ Edge Cases

#### 2.1 — API Failure / Timeout
- Groq API timeout: set hard limit of **4 seconds**
- If timeout or error: **silently fall back** to original query
- Show subtle toast: *"AI search unavailable, showing results for your original query"*
- Log: `logEvent('ai_search_timeout', { elapsedMs })`

```js
const optimizeSearchQuery = async (rawQuery) => {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 4000);
  const start = Date.now();
  try {
    const result = await callGroqAPI(rawQuery, { signal: controller.signal });
    clearTimeout(timeout);
    if (!result || !isValidQuery(result)) {
      logEvent('ai_search_garbage_output', { inputLen: rawQuery.length, outputLen: result?.length });
      return rawQuery;
    }
    return result;
  } catch (e) {
    logEvent('ai_search_timeout', { elapsedMs: Date.now() - start, reason: e.name });
    return rawQuery;
  }
};
```

#### 2.2 — AI Returns Garbage / Off-Topic Output
- Llama-3 could return full sentences, explanations, or unrelated text
- **Fix:** Validate response — if length > 60 chars or contains disallowed characters, discard

```js
const isValidQuery = (str) =>
  str &&
  str.length < 60 &&
  /^[a-zA-Z0-9\u0900-\u097F\u0A00-\u0A7F\s,]+$/.test(str.trim());
  // Covers Latin, Devanagari (Hindi), Gurmukhi (Punjabi)
```

#### 2.3 — API Key Rotation Race Condition
- Multiple simultaneous AI calls may use different keys, causing uneven rate limit distribution
- **Fix:** Debounce the AI button (500ms) + cancel in-flight request before new one fires
- Use a module-level `currentController` ref, not component state (avoids stale closure issues)

```js
let currentController = null;

const optimizeWithCancel = async (query) => {
  if (currentController) currentController.abort();
  currentController = new AbortController();
  return optimizeSearchQuery(query, currentController.signal);
};
```

#### 2.4 — Empty or Whitespace Query
- User taps AI button with empty input → do nothing, show inline validation: `"Type something first"`
- Never send empty queries to Groq

#### 2.5 — PWA Offline State
- Check `navigator.onLine` before making Groq call
- Listen to `online`/`offline` events to show/hide the AI button with a subtle disabled state
- When offline: AI button shows tooltip *"AI search requires internet"*

#### 2.6 — Rate Limit on Free Groq Tier
- Groq free tier has RPM limits
- **Fix:** On 429 received, mark key as exhausted for 60s, rotate to next key
- Track key exhaustion in-memory — do NOT use localStorage (too slow for this hot path)
- Log: `logEvent('groq_rate_limit_hit', { keyIndex, retryAfterMs: 60000 })`

```js
// keyRotator.js — manages multiple Groq API keys
// Keys are loaded from environment variables at build time (never hardcoded)
const GROQ_KEYS = [
  import.meta.env.VITE_GROQ_KEY_1,
  import.meta.env.VITE_GROQ_KEY_2,
  import.meta.env.VITE_GROQ_KEY_3,
].filter(Boolean); // only include keys that are defined

const exhaustedUntil = {}; // { keyIndex: timestamp }
let roundRobinIndex = 0;

export const getActiveKey = () => {
  const now = Date.now();
  // Try each key starting from round-robin position
  for (let i = 0; i < GROQ_KEYS.length; i++) {
    const idx = (roundRobinIndex + i) % GROQ_KEYS.length;
    if (!exhaustedUntil[idx] || exhaustedUntil[idx] < now) {
      roundRobinIndex = (idx + 1) % GROQ_KEYS.length; // advance for next call
      return { key: GROQ_KEYS[idx], index: idx };
    }
  }
  return null; // all keys exhausted
};

export const markKeyExhausted = (keyIndex, retryAfterMs = 60000) => {
  exhaustedUntil[keyIndex] = Date.now() + retryAfterMs;
  logEvent('groq_rate_limit_hit', { keyIndex, retryAfterMs });
};

// Usage in callGroqAPI:
const callGroqAPI = async (query, signal) => {
  const active = getActiveKey();
  if (!active) {
    logEvent('groq_all_keys_exhausted', {});
    return null; // triggers fallback to raw query
  }
  try {
    const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: { Authorization: `Bearer ${active.key}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ model: 'llama3-70b-8192', messages: [{ role: 'user', content: query }] }),
      signal,
    });
    if (res.status === 429) {
      const retryAfter = parseInt(res.headers.get('retry-after') || '60', 10) * 1000;
      markKeyExhausted(active.index, retryAfter);
      return callGroqAPI(query, signal); // retry with next key
    }
    return res.json();
  } catch (e) {
    throw e;
  }
};
```

> **Key hygiene:** Never commit API keys to git. Use `.env.local` for local dev, environment variables in your CI/CD (Vercel/Netlify dashboard) for production. Rotate keys if ever exposed.

#### 2.7 — AI Cache for Repeated Queries *(NEW)*
- Same user searches "sad arijit songs" repeatedly → wastes API quota
- **Fix:** Cache refined queries in the `aiRefinements` LRU (20-30 entries)
- Cache key: `normalizeKey(rawQuery)` → value: `{ refinedQuery, cachedAt }`
- TTL: 1 hour (queries don't need to be fresh)

```js
const getCachedRefinement = (rawQuery) => {
  const key = normalizeKey(rawQuery);
  const cached = aiRefinementsLRU.get(key);
  if (!cached) return null;
  if (Date.now() - cached.cachedAt > 3600000) { // 1 hour
    aiRefinementsLRU.delete(key); // manual eviction of expired entry
    return null;
  }
  return cached.refinedQuery;
};
```

---

## 💾 3. LRU Cache System

### 📌 LRU Implementation

```js
class LRUCache {
  #limit;
  #cache;

  constructor(limit = 50) {
    this.#limit = limit;
    this.#cache = new Map();
  }

  get(key) {
    if (!this.#cache.has(key)) return null;
    const value = this.#cache.get(key);
    this.#cache.delete(key);
    this.#cache.set(key, value); // move to end (most recently used)
    return value;
  }

  set(key, value) {
    if (this.#cache.has(key)) this.#cache.delete(key);
    else if (this.#cache.size >= this.#limit) {
      // evict least recently used (first entry)
      const lruKey = this.#cache.keys().next().value;
      this.#cache.delete(lruKey);
      logEvent('lru_eviction', { cacheId: this.id, evictedKey: lruKey });
    }
    this.#cache.set(key, value);
  }

  has(key) { return this.#cache.has(key); }
  delete(key) { return this.#cache.delete(key); }
  clear() { this.#cache.clear(); }
  get size() { return this.#cache.size; }
}
```

> **Why private fields (`#`)**: Prevents accidental direct mutation of `#cache` from outside the class, which would bypass LRU ordering logic.

### 📌 Cache Registry (Centralized)

Instead of creating LRU instances ad hoc, register them centrally for observability:

```js
// cacheRegistry.js
const registry = new Map();

export const createCache = (id, limit) => {
  const cache = new LRUCache(limit);
  cache.id = id; // for logging
  registry.set(id, cache);
  return cache;
};

export const getCacheStats = () =>
  Object.fromEntries([...registry.entries()].map(([id, c]) => [id, { size: c.size }]));
// Expose via debug panel or event: logEvent('cache_stats', getCacheStats())
```

### 📌 Cache Limits (Device-Adaptive)

| Cache | High-end | Mid-range | Low-end | Location |
|---|---|---|---|---|
| Search results | 50 entries | 30 entries | 15 entries | `Search.jsx` (in-memory) |
| Song objects | 150 entries | 100 entries | 50 entries | `playerStore.js` (in-memory) |
| AI search refinements | 30 entries | 20 entries | 10 entries | `Search.jsx` (in-memory) |
| Hannah's Choice | 1 entry/day | 1 entry/day | 1 entry/day | `localStorage` |
| Fullscreen AI suggestions | 1 entry/song | 1 entry/song | 1 entry/song | `playerStore.js` (in-memory) |

### ⚠️ Edge Cases

#### 3.1 — PWA Memory Pressure (Android Mid-Range)
- OS can kill PWA tab under memory pressure → all in-memory LRU caches wiped
- **Fix:** For song cache, this is acceptable — songs will re-fetch
- **Do NOT** persist song cache to localStorage (too large, too slow to serialize)
- For search cache, memory wipe = cache miss = fresh search. This is correct behaviour.
- **New:** On `visibilitychange` → `hidden`, log `getCacheStats()` to understand cache state before loss

#### 3.2 — localStorage Unavailability
- `localStorage` throws in: private/incognito mode (some browsers), storage quota exceeded, iOS Safari PWA with restricted storage

```js
const safeStorage = {
  get: (key) => { try { return localStorage.getItem(key); } catch { return null; } },
  set: (key, val) => {
    try {
      localStorage.setItem(key, val);
      return true;
    } catch (e) {
      logEvent('localstorage_write_fail', { key, errorName: e.name });
      return false;
    }
  },
  remove: (key) => { try { localStorage.removeItem(key); } catch {} }
};
```

#### 3.3 — Cache Key Collisions
- Two different searches that normalize to same string would collide
- **Fix:** Normalize search keys: lowercase, trim, collapse spaces before using as cache key

```js
const normalizeKey = (q) => q.toLowerCase().trim().replace(/\s+/g, ' ');
```

#### 3.4 — Stale Song Objects
- JioSaavn stream URLs expire (typically after a few hours)
- **Fix:** Store song objects WITHOUT stream URL in LRU cache. Re-fetch stream URL at play time only.
- Cache key: `songId` → value: `{ id, title, artist, artwork, duration }` (no `streamUrl`)

#### 3.5 — Concurrent Writes
- JavaScript is single-threaded, so true concurrency is impossible
- However: ensure no `await` inside LRU `set`/`get` — must remain synchronous
- If `set` triggers an async side effect (e.g., logging), do it AFTER the synchronous LRU operation

---

## 🎀 4. Hannah's Choice — AI Home Recommendations

### 📌 How It Works
1. Collect `likedSongs` + `recentSongs` titles/artists on Home load
2. Check if today's cache is valid → if yes, skip AI call
3. Call Llama-3 70B → get 10 song suggestions
4. Cache AI suggestions to localStorage **immediately** (before JioSaavn fetch)
5. Parallel-fetch from JioSaavn via `Promise.allSettled`
6. Render as **"Hannah's Choice 🪄"** section

### 📌 System Prompt Template (Improved)

```
You are a music recommendation engine for an Indian music app called Prachify.
The user enjoys the following songs: {songList}

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
```

### 📌 Taste Drift Handling *(NEW — Previously Missing)*

The v2.0 roadmap accepted stale daily cache even when taste changes. This is partially acceptable but needs a signal:

```js
const SIGNIFICANT_CHANGE_THRESHOLD = 3; // unlikes in one session

// Track taste drift signals during session
let unlikeCountThisSession = 0;

const onUnlike = (songId) => {
  removeLike(songId);
  unlikeCountThisSession++;

  // If user has aggressively unliked songs, invalidate Hannah's cache
  if (unlikeCountThisSession >= SIGNIFICANT_CHANGE_THRESHOLD) {
    safeStorage.remove('hannahsChoice');
    logEvent('hannah_cache_invalidated', { reason: 'taste_drift', unlikeCount: unlikeCountThisSession });
    unlikeCountThisSession = 0; // reset
  }
};
```

- This avoids the "cache stuck on wrong taste all day" problem without requiring a manual refresh button
- Threshold of 3 unlikes is a tunable constant — log data will tell you the right number

### ⚠️ Edge Cases

#### 4.1 — New User (Zero Liked/Recent Songs)
- `likedSongs` and `recentSongs` both empty on first launch
- **Fix:** Do NOT call AI. Show *"Trending Today"* using JioSaavn's trending API
- Enable Hannah's Choice only after user has ≥ 5 liked/recent songs
- Progress hint: *"Like 3 more songs to unlock personalized picks"*

#### 4.2 — Daily Cache Validation
```js
const today = new Date().toISOString().split('T')[0]; // "2025-06-05"
const isStale = (cache) => !cache || cache.cachedDate !== today;
// Comparing date strings avoids timezone/clock-drift issues
```

#### 4.3 — localStorage Full
- **Fix:** On `safeStorage.set` failure for Hannah's cache, keep in-memory only (silent degradation)
- Do NOT toast the user — this is an implementation detail they don't need to know about

#### 4.4 — JioSaavn Returns No Match
```js
const results = await Promise.allSettled(songNames.map(fetchFromJioSaavn));
const valid = results.filter(r => r.status === 'fulfilled').map(r => r.value);

if (valid.length < 5) {
  logEvent('hannah_fallback', { validCount: valid.length, totalAttempted: songNames.length });
  // Trigger second AI call with different seed songs (rotate to next 5 recent songs)
  return triggerFallbackAICall();
}
```

#### 4.5 — AI Returns Invalid JSON
```js
const parseAIResponse = (raw) => {
  // Strip common Llama-3 formatting artifacts
  const cleaned = raw
    .replace(/```json|```/g, '')
    .replace(/^[^[{]*/s, '') // strip any leading text before JSON
    .trim();
  try {
    const parsed = JSON.parse(cleaned);
    if (!Array.isArray(parsed)) return null;
    return parsed.filter(item => item.title && item.artist); // validate shape
  } catch {
    logEvent('hannah_json_parse_fail', { rawLength: raw.length });
    return null;
  }
};
```

#### 4.6 — PWA Background Tab on iOS
- iOS kills PWA background tabs → Home unmounts → cache was never written
- **Fix:** Write cache to localStorage **immediately** when AI response arrives, before JioSaavn fetches
- Order: AI call → write raw AI suggestions → then fetch from JioSaavn

#### 4.7 — Concurrent Home Loads
- User fast-refreshes → two simultaneous AI calls fire
- **Fix:** Module-level `isLoadingHannahsChoice` flag, not component state

```js
let isLoadingHannahsChoice = false;

const loadHannahsChoice = async () => {
  if (isLoadingHannahsChoice) return;
  isLoadingHannahsChoice = true;
  try {
    await fetchAndRenderHannahsChoice();
  } finally {
    isLoadingHannahsChoice = false;
  }
};
```

#### 4.8 — AI Suggests Duplicate Artists *(NEW)*
- Llama-3 often clusters around 2-3 popular artists (Arijit Singh, Jubin Nautiyal)
- **Fix:** Client-side artist deduplication after parsing — max 2 songs per artist

```js
const deduplicateByArtist = (songs, maxPerArtist = 2) => {
  const counts = {};
  return songs.filter(song => {
    counts[song.artist] = (counts[song.artist] || 0) + 1;
    return counts[song.artist] <= maxPerArtist;
  });
};
```

---

## 🎤 5. Fullscreen Player AI Suggestions ("You Might Like") *(Expanded)*

### 📌 How It Works
- User opens fullscreen player tab → Llama-3 70B analyzes current track metadata → returns 5 mood/vibe-similar songs by **different artists**
- Results cached in-memory, keyed by `currentSongId`
- Tab opens with immediate skeleton UI → results populate within ~2-3s

### 📌 System Prompt Template *(NEW)*

```
You are a music taste engine for Prachify, an Indian music app.
The user is currently playing: "{title}" by {artist}
Genre hints from metadata: {genres}
Mood tags: {moodTags}

Suggest exactly 5 songs that match this song's vibe and mood.
RULES:
- Different artists from each other AND from {artist}
- Only Hindi, Punjabi, or English songs
- NO DJ remixes or chapri tracks
- Return ONLY JSON: [{"title": "...", "artist": "..."}]
```

### 📌 Loading States (New — Full Spec)

| State | UI | Duration |
|---|---|---|
| Tab just opened | Skeleton cards (3 rows, pulsing) | Until AI responds |
| AI responded, JioSaavn fetching | Skeleton fades → real cards appear per item | Per-item as resolved |
| All loaded | Full card list with artwork | — |
| AI failed | "More by {Artist}" list | Immediate fallback |

### ⚠️ Edge Cases

#### 5.1 — Cache Scope & Invalidation
- Cache key: `currentSongId` (not song title — same song re-released may have different ID)
- Invalidate only when `currentSongId` changes
- **Do NOT** invalidate on: pause, resume, seek, volume change
- **DO** invalidate on: skip, queue change, new song starts

#### 5.2 — AI Suggests Currently Playing Song
- **Fix (system prompt):** Explicitly include exclusion in prompt: *"Do NOT suggest: '{title}' by {artist}"*
- **Fix (client):** Deduplicate client-side before render — check title + artist match (case-insensitive)

#### 5.3 — AI Suggests Songs Already in Queue
- **Fix:** After resolving from JioSaavn, filter out any `songId` already in `queue`

```js
const suggestionsNotInQueue = suggestions.filter(
  s => !queue.some(q => q.id === s.id)
);
```

#### 5.4 — Tab Opens Before AI Responds
- User opens tab → spinner → closes tab → response arrives → setState on unmounted component
- **Fix:** `AbortController` on tab close + check `isMounted` ref in async continuation

```js
// In the component
const abortRef = useRef(null);
const isMountedRef = useRef(true);

useEffect(() => {
  return () => {
    isMountedRef.current = false;
    abortRef.current?.abort();
  };
}, []);

const loadSuggestions = async () => {
  abortRef.current = new AbortController();
  const results = await fetchAISuggestions(currentSong, abortRef.current.signal);
  if (!isMountedRef.current) return; // component was unmounted
  setSuggestions(results);
};
```

#### 5.5 — Very Niche or Instrumental Songs
- AI may return irrelevant or hallucinated suggestions for obscure tracks
- **Fix:** If JioSaavn can validate < 3 of 5 suggestions → fall back to *"More by {Artist}"* list
- Log: `logEvent('fullscreen_ai_low_match', { songId, validCount })`

#### 5.6 — Suggestion Cards Tap → Add to Queue *(NEW)*
- User taps a suggestion → song should add to queue (not replace current)
- Clarify UX: single tap = add to queue (with toast "Added to queue"), long press = play now
- Never replace the currently playing song silently

#### 5.7 — Network Change During AI Fetch *(NEW)*
- User starts on WiFi → moves to cellular → AI call times out mid-flight
- **Fix:** Cancel existing request on `navigator.connection` change event if request is > 2s old; retry on improved connection

---

## 📱 6. Liquid Slide Sheet (Touch Gestures)

### 📌 Implementation
- Use `transform: translateY` only — never `top` or `margin`
- Track `touchstart`, `touchmove`, `touchend` events
- Apply spring easing on release

### 📌 Gesture State Machine *(NEW)*

```
CLOSED ──(touchstart)──► DRAGGING
DRAGGING ──(touchend, pos < 40% OR velocity > 0.5)──► CLOSED (snap down)
DRAGGING ──(touchend, pos > 40% AND velocity < 0.5)──► OPEN (snap up)
OPEN ──(touchstart + downward drag)──► DRAGGING
```

Implement this explicitly — don't rely on implicit boolean flags.

### ⚠️ Edge Cases

#### 6.1 — iOS Scroll vs Swipe Conflict
- iOS PWA intercepts vertical swipes for page scroll, conflicting with sheet gestures
- **Fix:** Call `e.preventDefault()` on `touchmove` only when gesture is identified as a sheet drag (`dy > dx`)
- Use `{ passive: false }` on touchmove listener for this to work

```js
sheet.addEventListener('touchmove', (e) => {
  const dy = Math.abs(e.touches[0].clientY - startY);
  const dx = Math.abs(e.touches[0].clientX - startX);
  if (dy > dx) e.preventDefault(); // it's a vertical drag, own it
}, { passive: false });
```

#### 6.2 — Fast Flick vs Slow Drag
- Slow drag to 50% → snap to closed
- Fast flick (high velocity) → close even from 20%
- **Fix:** Check both position threshold (> 40% down) AND velocity threshold (> 0.5 px/ms)

```js
const onTouchEnd = () => {
  const elapsed = Date.now() - touchStartTime;
  const velocity = Math.abs(currentY - startY) / elapsed; // px/ms
  const percentDown = (currentY - sheetTopY) / sheetHeight;
  const shouldClose = percentDown > 0.4 || velocity > 0.5;
  snapTo(shouldClose ? 'closed' : 'open');
};
```

#### 6.3 — Multi-Touch Interruption
- Two fingers → `touches.length > 1` → calculations break
- **Fix:** Only track `touches[0]` — ignore events with `touches.length > 1`

#### 6.4 — Sheet Opens During Keyboard
- Virtual keyboard open → viewport shrunken → coordinate math is wrong
- **Fix:** Use `window.visualViewport` for all coordinate calculations

```js
window.visualViewport.addEventListener('resize', () => {
  if (sheetState === 'open') repositionSheet();
});
```

#### 6.5 — Accessibility
- Screen reader users cannot use swipe gestures
- **Fix:** Always include a visible ✕ close button
- Add `role="dialog"`, `aria-modal="true"`, `aria-label="Song options"` to sheet container
- Trap focus inside sheet when open: use `focus-trap` library or manual `Tab` key handling

#### 6.6 — Sheet Rendered Below Fold on Short Screens *(NEW)*
- On devices with vh < 600px (e.g., iPhone SE), sheet may clip content
- **Fix:** Cap sheet height at `min(70vh, 500px)` and add internal scroll for overflow content

---

## 🔊 7. Gapless Playback (Audio Prefetching)

### 📌 Implementation
- When current song reaches 80% playback → begin prefetching next song's stream URL
- Execute as background promise via Service Worker, non-blocking

### ⚠️ Edge Cases

#### 7.1 — PWA Service Worker Required
- `fetch()` in background PWA tab on iOS is throttled or blocked
- **Fix:** Route prefetch through Service Worker

```js
navigator.serviceWorker.controller?.postMessage({
  type: 'PREFETCH',
  url: nextSongStreamUrl,
  songId: nextSong.id,
});
```

#### 7.2 — Stream URL Expiry During Prefetch
- JioSaavn stream URLs may expire in 1-2 hours
- **Fix:** Store prefetch timestamp alongside URL; discard if age > 10 minutes at play time
- Log: `logEvent('stream_url_expired', { songId, ageMs })`

#### 7.3 — iOS AudioContext Unlock
- iOS requires user gesture to start AudioContext
- **Fix:** Unlock on first `touchend` anywhere in the app

```js
document.addEventListener('touchend', function unlock() {
  audioCtx.resume();
  document.removeEventListener('touchend', unlock);
}, { once: true });
```

#### 7.4 — User Skips Before Prefetch Completes
- **Fix:** Cancel in-flight prefetch `fetch()` using `AbortController` on skip event
- SW should listen for a `CANCEL_PREFETCH` message

```js
navigator.serviceWorker.controller?.postMessage({ type: 'CANCEL_PREFETCH', songId });
```

#### 7.5 — Queue End
- Do NOT prefetch when current song is last in queue
- Check `currentIndex < queue.length - 1` before initiating prefetch

#### 7.6 — Mobile Data Saver / Offline
```js
const shouldPrefetch = () => {
  const conn = navigator.connection;
  if (!conn) return true; // unknown connection → allow prefetch
  return !conn.saveData && !['slow-2g', '2g'].includes(conn.effectiveType);
};
```

#### 7.7 — Crossfade vs Gapless *(NEW)*
- True gapless requires `AudioContext.createBufferSource` and precise scheduling
- Simple prefetch + `<audio>` element swap has a ~200ms gap
- **Decision for v1:** Accept the ~200ms gap. True gapless is a P2 feature using `AudioContext`.
- Document this gap so the team doesn't accidentally promise gapless in marketing

**Progressive rollout plan:**
- **v1 (now):** Prefetch-only. ~200ms gap. Ship it — users notice gapless only on album/playlist flows.
- **v2:** `AudioContext` dual-buffer. Schedule next song exactly at `currentTime + remainingSeconds`. No gap.
- **Never advertise "gapless" in UI copy until v2 ships.**

```js
// v2 gapless skeleton (don't implement until v1 is stable):
// const nextBuffer = await fetchAndDecodeAudio(nextSong.streamUrl);
// const startAt = audioCtx.currentTime + remainingSeconds - 0.05; // 50ms crossfade
// const source = audioCtx.createBufferSource();
// source.buffer = nextBuffer;
// source.connect(audioCtx.destination);
// source.start(startAt);
```

---

## 🖼️ 8. Cover Art Caching (Service Worker Cache)

### 📌 Implementation
- Cache JioSaavn cover art images in Service Worker Cache Storage (not localStorage)
- Use Cache Storage API via SW for persistent image caching

### ⚠️ Edge Cases

#### 8.1 — Cache Storage Quota
- Browser limits Cache Storage (usually 50MB–1GB, varies by device)
- **Fix:** Implement cache versioning; purge old cache on SW update
- Limit cover art cache to last 200 unique images using a manifest in IndexedDB

```js
// In SW: trim cover art cache to 200 entries
const trimCoverArtCache = async () => {
  const cache = await caches.open('cover-art-v1');
  const keys = await cache.keys();
  if (keys.length > 200) {
    const toDelete = keys.slice(0, keys.length - 200);
    await Promise.all(toDelete.map(k => cache.delete(k)));
  }
};
```

#### 8.2 — Stale Cover Art
- JioSaavn CDN URLs may change for the same song
- **Fix:** Cache-bust by using `songId` as cache key, not full URL
- Store mapping `{ songId → cachedImageURL }` in IndexedDB

#### 8.3 — SW Not Yet Activated (First Load)
- On very first visit, SW is not yet controlling the page
- Cover art loads from network — correct behaviour, no fix needed
- SW will cache on first fetch for all subsequent visits

#### 8.4 — Placeholder While Loading *(NEW)*
- Cover art load can take 200–500ms on slow connections → jarring blank box
- **Fix:** Always render a blurred placeholder (dominant color from palette or a generic gradient) while actual art loads
- Use CSS: `background: linear-gradient(135deg, #1a1a2e, #16213e)` as default placeholder

---

## 📳 9. Mobile Haptic Feedback

### 📌 Implementation
- Use `navigator.vibrate()` for haptic clicks on buttons

### 📌 Haptic Pattern Guide *(NEW)*

| Action | Pattern | Code |
|---|---|---|
| Button tap | Single short | `navigator.vibrate(10)` |
| Song liked | Double pulse | `navigator.vibrate([15, 50, 15])` |
| Error / blocked action | Long buzz | `navigator.vibrate(100)` |
| Sheet snapped closed | Short tap | `navigator.vibrate(8)` |

### ⚠️ Edge Cases

#### 9.1 — iOS PWA — Vibration API Not Supported
- `navigator.vibrate` is **undefined on iOS** (Apple does not support Vibration API)
- **Fix:** Always guard: `if (navigator.vibrate) navigator.vibrate(10);`

#### 9.2 — User Has Disabled Vibration at OS Level
- `navigator.vibrate()` returns `false` silently — no error thrown
- Correct behaviour — no fix needed

#### 9.3 — Battery Saver Mode
- Some Android devices disable vibration in battery saver
- Same as above — `navigator.vibrate()` silently fails — acceptable

#### 9.4 — Haptic Settings Toggle *(NEW)*
- Some users find haptics annoying — add a Settings toggle
- Default: ON
- Store preference in `safeStorage` as `hapticsEnabled`

```js
export const haptic = (pattern) => {
  if (!navigator.vibrate) return;
  // BUG FIX: !safeStorage.get(...) === 'false' always evaluates to false
  // due to operator precedence. Correct form below:
  if (safeStorage.get('hapticsEnabled') === 'false') return;
  navigator.vibrate(pattern);
};
```

---

## 🖥️ 11. API Events Backend Spec *(NEW — Previously Missing)*

The v3.0 roadmap defined a complete client-side error bus but left the backend entirely unspecified. Without a backend contract, the flush calls go nowhere and errors stay invisible.

### 📌 Endpoint Contract

```
POST /api/events
Content-Type: application/json
Authorization: Bearer <internal-secret>  (optional for MVP, required before public launch)

Request body:
[
  {
    "type": "ai_search_timeout",
    "ts": 1718000000000,
    "url": "/search",
    "elapsedMs": 4012
  },
  ...
]

Response:
200 OK  — batch accepted
400     — malformed payload (log client-side, don't retry)
429     — server overloaded (back off, retry next flush cycle)
```

### 📌 MVP Backend Options (pick one)

| Option | Setup Time | Cost | Recommended For |
|---|---|---|---|
| Cloudflare Workers + D1 (SQLite) | ~2 hours | Free tier | Hackathon / early prod |
| Vercel Edge Function + Upstash Redis | ~1 hour | Free tier | If already on Vercel |
| Simple Express server + append-to-file | ~30 mins | Free (self-hosted) | Local dev / demo only |
| Sentry (full APM) | ~20 mins | Paid | After product-market fit |

**Recommended for Prachify MVP:** Cloudflare Workers + D1. Runs at edge (low latency from India), free for up to 100k requests/day, and D1 gives you SQL queries for dashboards.

### 📌 Minimal Cloudflare Worker

```js
// worker.js
export default {
  async fetch(request, env) {
    if (request.method !== 'POST') return new Response('Method not allowed', { status: 405 });

    let events;
    try {
      events = await request.json();
      if (!Array.isArray(events)) throw new Error('Expected array');
    } catch {
      return new Response('Bad request', { status: 400 });
    }

    // Sanitize: strip any PII before storing
    const sanitized = events.map(e => ({
      type: String(e.type).slice(0, 100),
      ts: Number(e.ts) || Date.now(),
      url: String(e.url || '').slice(0, 200),
      // Include only known safe numeric fields; drop free-text query fields
      elapsedMs: typeof e.elapsedMs === 'number' ? e.elapsedMs : undefined,
      keyIndex: typeof e.keyIndex === 'number' ? e.keyIndex : undefined,
      validCount: typeof e.validCount === 'number' ? e.validCount : undefined,
    }));

    const stmt = env.DB.prepare(
      'INSERT INTO events (type, ts, url, payload) VALUES (?, ?, ?, ?)'
    );
    const batch = sanitized.map(e =>
      stmt.bind(e.type, e.ts, e.url, JSON.stringify(e))
    );
    await env.DB.batch(batch);

    return new Response('OK', { status: 200 });
  },
};
```

### 📌 D1 Schema

```sql
CREATE TABLE IF NOT EXISTS events (
  id       INTEGER PRIMARY KEY AUTOINCREMENT,
  type     TEXT NOT NULL,
  ts       INTEGER NOT NULL,
  url      TEXT,
  payload  TEXT,
  created  DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_events_type ON events(type);
CREATE INDEX idx_events_ts   ON events(ts);
```

### 📌 Useful Queries (Dashboard / Debugging)

```sql
-- AI reliability: what % of searches time out?
SELECT
  SUM(CASE WHEN type = 'ai_search_timeout' THEN 1 ELSE 0 END) * 100.0 /
  NULLIF(SUM(CASE WHEN type IN ('ai_search_timeout', 'ai_search_success') THEN 1 ELSE 0 END), 0)
  AS timeout_pct
FROM events
WHERE ts > unixepoch('now', '-1 day') * 1000;

-- Filter aggressiveness: how often does it block queries?
SELECT COUNT(*) as bypass_count FROM events
WHERE type = 'filter_bypass' AND ts > unixepoch('now', '-7 days') * 1000;

-- Playback errors by hour (detect regional outages)
SELECT strftime('%Y-%m-%d %H:00', datetime(ts/1000, 'unixepoch')) as hour,
       COUNT(*) as errors
FROM events WHERE type = 'playback_error'
GROUP BY hour ORDER BY hour DESC LIMIT 48;
```

### 📌 Alerting (Simple)

For MVP, add a daily cron (Cloudflare Cron Trigger) that emails/Slacks you if:
- `ai_search_timeout` rate > 20% of total AI calls in last 24h
- `playback_error` count > 100 in last 1h
- Any `groq_all_keys_exhausted` event (means all keys exhausted simultaneously — critical)

### ⚠️ Edge Cases

#### 11.1 — GDPR / Privacy Compliance
- Events must NOT contain raw search queries, user IDs, or device fingerprints
- Strip or hash any PII in the worker before writing to D1
- Add `GDPR_SAFE: true` comment to every field written to DB as a review signal

#### 11.2 — D1 Quota Exceeded
- D1 free tier: 5M rows/day write limit
- At 1000 DAU × 20 events each = 20k events/day — well within free tier
- At 100k DAU: upgrade to paid ($0.001 per 1M writes)

#### 11.3 — Analytics Down ≠ App Down
- If Worker returns 5xx: client silently drops batch (already implemented in flush strategy)
- Never let analytics calls affect PWA performance or UX

---

## 📴 12. Offline-First Strategy *(NEW — Previously Missing)*

Offline handling was scattered across sections (1.5, 2.5, 7.6) but never unified. This section consolidates the full offline posture.

### 📌 Offline Capability Matrix

| Feature | Offline Behaviour | Implementation |
|---|---|---|
| Playback (cached songs) | ✅ Full | SW Cache Storage |
| Search (cached results) | ✅ Partial (LRU) | In-memory LRU |
| AI Search Optimizer | ❌ Disabled | Guard on `navigator.onLine` |
| Hannah's Choice | ✅ Shows stale cache | Read from `localStorage` |
| Fullscreen AI Suggestions | ❌ Falls back to "More by {Artist}" | Guard + fallback |
| Cover Art | ✅ Full (SW cached) | SW Cache Storage |
| Language Filter | ✅ Full | Client-side only |
| Haptic Feedback | ✅ Full | Local API |
| Event Logging | ✅ Buffered, flushes on reconnect | Ring buffer + `online` event |

### 📌 Unified Offline State Manager

```js
// offlineManager.js
let isOnline = navigator.onLine;
const listeners = new Set();

export const onOnlineChange = (fn) => { listeners.add(fn); return () => listeners.delete(fn); };
export const getOnlineStatus = () => isOnline;

window.addEventListener('online',  () => { isOnline = true;  listeners.forEach(fn => fn(true));  flush(); });
window.addEventListener('offline', () => { isOnline = false; listeners.forEach(fn => fn(false)); });
```

### 📌 Offline UI Indicators

```js
// In root component:
import { onOnlineChange } from './offlineManager';

useEffect(() => {
  return onOnlineChange((online) => {
    if (!online) showToast('You\'re offline — playback continues from cache', { persist: true });
    else dismissToast('offline-banner');
  });
}, []);
```

### 📌 Service Worker Offline Cache Strategy

```js
// sw.js — stale-while-revalidate for cover art, cache-first for app shell
const SHELL_CACHE  = 'prachify-shell-v1';
const COVER_CACHE  = 'cover-art-v1';
const AUDIO_CACHE  = 'audio-prefetch-v1';

self.addEventListener('fetch', (event) => {
  const { url } = event.request;

  // App shell: cache-first
  if (isAppShellRequest(url)) {
    event.respondWith(caches.match(event.request).then(r => r || fetch(event.request)));
    return;
  }

  // Cover art: stale-while-revalidate
  if (url.includes('saavn') && url.includes('image')) {
    event.respondWith(
      caches.open(COVER_CACHE).then(async cache => {
        const cached = await cache.match(event.request);
        const networkFetch = fetch(event.request).then(res => {
          cache.put(event.request, res.clone());
          return res;
        }).catch(() => cached); // network failed → serve stale
        return cached || networkFetch;
      })
    );
    return;
  }
});
```

### ⚠️ Edge Cases

#### 12.1 — `navigator.onLine` Lies
- `navigator.onLine = true` does NOT mean internet is reachable (captive portals, metered connections)
- **Fix:** On critical operations (AI calls, JioSaavn fetch), always wrap in try/catch; treat network errors as offline regardless of `navigator.onLine`

#### 12.2 — IndexedDB Unavailable Offline
- IndexedDB is available offline — it's local storage
- But: if SW hasn't cached the DB schema yet (first load), IDB may be empty
- **Fix:** Always provide in-memory fallback when IDB read returns null

#### 12.3 — Event Queue Grows Unbounded Offline
- User is offline for 2 hours, generates 500 events — exceeds ring buffer (200)
- This is correct behaviour — ring buffer intentionally drops oldest events
- **Decision:** This is acceptable; analytics is best-effort

---

## 🔄 PWA-Specific Global Edge Cases

### G.1 — Service Worker Update Conflict
- **Fix:** `skipWaiting()` + `clients.claim()` on install
- Show *"Update available — tap to refresh"* banner when new SW is waiting

### G.2 — Add to Home Screen vs Browser Tab
```js
const isInstalled = window.matchMedia('(display-mode: standalone)').matches;
// Use to conditionally show/hide install prompt, fullscreen controls, etc.
```

### G.3 — App Killed Mid-Playback (Android)
- **Fix:** Save `{ songId, position, queueIds }` to `sessionStorage` every 5 seconds
- On next launch, detect stale session and show *"Resume where you left off?"*

```js
setInterval(() => {
  if (isPlaying) {
    sessionStorage.setItem('lastSession', JSON.stringify({
      songId: currentSong.id,
      position: audio.currentTime,
      queueIds: queue.map(s => s.id),
      savedAt: Date.now(),
    }));
  }
}, 5000);
```

### G.4 — Network Change Mid-Session
```js
navigator.connection?.addEventListener('change', () => {
  const conn = navigator.connection;
  if (['slow-2g', '2g'].includes(conn.effectiveType)) {
    disablePrefetch();
    showToast('Slow connection detected — prefetch paused');
  } else {
    enablePrefetch();
  }
  logEvent('network_change', { type: conn.effectiveType, saveData: conn.saveData });
});
```

### G.5 — Dark Mode / Theme
```js
const darkModeQuery = window.matchMedia('(prefers-color-scheme: dark)');
darkModeQuery.addEventListener('change', (e) => applyTheme(e.matches ? 'dark' : 'light'));
```

### G.6 — PWA Install Prompt
- `beforeinstallprompt` fires only once — if dismissed, never fires again
- **Fix:** Intercept and store the event; show custom *"Add to Home Screen"* in Settings

```js
let deferredInstallPrompt = null;
window.addEventListener('beforeinstallprompt', (e) => {
  e.preventDefault();
  deferredInstallPrompt = e;
  showInstallButton(); // reveal custom button in Settings
});
```

### G.7 — App Update UX *(NEW)*
- New SW waiting → user is on stale code → features may mismatch server
- **Fix:** Show a non-intrusive banner at top: *"✨ Update ready — tap to refresh"*
- On tap: `swRegistration.waiting.postMessage({ type: 'SKIP_WAITING' })` → then `location.reload()`

### G.8 — Storage Quota Warning *(NEW)*
- Proactively check available storage before heavy operations (SW cache write, IndexedDB)

```js
const checkStorageQuota = async () => {
  if (!navigator.storage?.estimate) return;
  const { usage, quota } = await navigator.storage.estimate();
  const usedPercent = (usage / quota) * 100;
  if (usedPercent > 80) {
    logEvent('storage_pressure', { usedPercent: usedPercent.toFixed(1) });
    // Trigger LRU evictions + cover art cache trim
    trimCoverArtCache();
  }
};
```

---

## 📊 Implementation Priority Matrix

| Priority | Feature | Complexity | Impact | Ship Order | Owner |
|---|---|---|---|---|---|
| 🔴 P0 | LRU Cache (Search + Song) | Low | High | Week 1 | — |
| 🔴 P0 | localStorage safety wrapper | Low | High | Week 1 | — |
| 🔴 P0 | Error Monitoring Bus | Low | High | Week 1 | — |
| 🔴 P0 | Offline State Manager | Low | High | Week 1 | — |
| 🟠 P1 | AI Search Optimizer + Key Rotator | Medium | High | Week 2 | — |
| 🟠 P1 | Language Filter (exact-match + blocklist) | Medium | High | Week 2 | — |
| 🟠 P1 | API Events Backend (CF Worker + D1) | Medium | High | Week 2 | — |
| 🟡 P2 | Hannah's Choice + Taste Drift | High | High | Week 3-4 | — |
| 🟡 P2 | Gapless Playback v1 + SW Prefetch | High | High | Week 3-4 | — |
| 🟢 P3 | Liquid Slide Sheet | Medium | Medium | Week 5 | — |
| 🟢 P3 | Cover Art SW Cache | Medium | Medium | Week 5 | — |
| 🔵 P4 | Fullscreen Player AI Suggestions | High | Medium | Week 6 | — |
| 🔵 P4 | Haptic Feedback + Settings Toggle | Low | Low | Week 6 | — |
| ⬜ P5 | Storage Quota Monitoring | Low | Medium | Week 7 | — |
| ⬜ P5 | PWA Update Banner | Low | Medium | Week 7 | — |
| ⬜ P5 | Gapless Playback v2 (AudioContext) | High | Medium | Week 8+ | — |
| ⬜ P5 | Events Dashboard + Alerting | Medium | Medium | Week 8+ | — |

---

## ✅ Pre-Ship Checklist (Per Feature)

Before marking any feature done:

**Devices & Browsers**
- [ ] Tested on **Android Chrome** (primary target — Moto G Power or equivalent)
- [ ] Tested on **iOS Safari PWA** (installed to home screen — iPhone SE or equivalent)
- [ ] Tested on **Samsung Internet** (significant Indian market share)

**Network Conditions**
- [ ] Tested with **Network throttled to Slow 3G** in DevTools
- [ ] Tested with **offline mode** (Service Worker serving stale)
- [ ] Tested with **network switch mid-session** (WiFi → cellular)
- [ ] Offline state manager shows correct toast banner
- [ ] AI features correctly disabled/fallback when offline

**Storage**
- [ ] Tested with **localStorage disabled** (private/incognito mode)
- [ ] Tested with **localStorage quota exceeded** (use DevTools to limit quota)
- [ ] Verified **no data loss** when tab is killed and reopened

**Performance**
- [ ] Verified **no jank** using Chrome DevTools Performance tab (no red frames)
- [ ] Verified **memory usage** before and after in Chrome Task Manager
- [ ] JS bundle delta measured with `bundlephobia` or webpack-bundle-analyzer

**AI & API**
- [ ] All AI calls have **timeout (4s) + fallback**
- [ ] All AI responses have **JSON validation + sanitization**
- [ ] API key rotation tested with simulated 429 responses
- [ ] `getActiveKey()` returns null gracefully when all keys exhausted
- [ ] All API calls logged to **error monitoring bus**

**Backend & Observability**
- [ ] `/api/events` endpoint deployed and accepting events
- [ ] Test flush fires on `visibilitychange` → hidden
- [ ] D1 (or equivalent) receiving and storing events correctly
- [ ] PII sanitization verified — no raw query strings in DB
- [ ] Alerting thresholds set for AI timeout rate and playback errors

**Accessibility**
- [ ] `prefers-reduced-motion` respected
- [ ] All interactive elements have proper `aria-label`
- [ ] Keyboard navigation works for core flows (search, play, queue)
- [ ] Screen reader tested with TalkBack (Android) or VoiceOver (iOS)

**PWA Specifics**
- [ ] `navigator.vibrate` guarded for iOS — haptic utility uses `safeStorage.get(...) !== 'false'` (not `!...===`)
- [ ] `navigator.onLine` checked before all network calls
- [ ] `navigator.connection?.saveData` checked before prefetch
- [ ] Feature works when app is backgrounded for 5+ minutes (iOS memory kill test)
- [ ] Offline filter check (`canPlaySong`) fires at **play time**, not just fetch time

---

*Last updated: June 2025 | Prachify Engineering v4.0*

---

### What changed from v3.0 → v4.0

| Change | Type |
|---|---|
| Added Table of Contents | Navigation |
| Fixed haptic utility operator precedence bug (line 972) | Bug fix |
| Added `canPlaySong()` implementation for offline filter (1.5) | Bug fix |
| Added full API key rotation mechanism with `keyRotator.js` (2.6) | Implementation gap |
| Added gapless v1/v2 progressive rollout plan (7.7) | Clarity |
| Added Section 11: API Events Backend (CF Worker + D1 schema + queries + alerting) | New section |
| Added Section 12: Offline-First Strategy (unified matrix + SW strategy + `offlineManager.js`) | New section |
| Updated Priority Matrix (added Offline Manager, Key Rotator, Backend as P0/P1) | Updated |
| Updated Pre-Ship Checklist (backend, offline, haptic bug) | Updated |
