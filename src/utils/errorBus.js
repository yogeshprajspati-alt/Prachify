/**
 * errorBus.js
 * Lightweight client-side event bus for observability.
 *
 * - Ring buffer (max 200 entries) — never leaks memory
 * - Batches events and flushes to /api/events every 5 minutes
 * - Also flushes on visibilitychange → hidden (covers tab close + backgrounding)
 * - Silent on all failures — analytics NEVER affects UX
 * - In dev mode: logs to console.debug instead of flushing
 *
 * § final.md §10
 *
 * Usage:
 *   import { logEvent } from './errorBus';
 *   logEvent('ai_search_timeout', { query: rawQuery, elapsedMs: 4000 });
 */

const MAX_EVENTS = 200;   // ring buffer size
const FLUSH_INTERVAL_MS = 5 * 60 * 1000; // 5 minutes

const events = [];
const pendingFlush = [];
let flushTimer = null;

const isDev = typeof import.meta !== 'undefined'
  ? import.meta.env?.MODE === 'development'
  : true;

// ── Core log function ──────────────────────────────────────────────────────────

/**
 * Log an event to the ring buffer.
 * In production, schedules a batched flush to the backend.
 *
 * @param {string} type  - event name (e.g. 'ai_search_timeout')
 * @param {Object} data  - extra payload (keep PII-free: no raw query text)
 */
export const logEvent = (type, data = {}) => {
  const entry = {
    type,
    ts: Date.now(),
    url: typeof location !== 'undefined' ? location.pathname : '/',
    ...data,
  };

  // Ring buffer — drop oldest if full
  if (events.length >= MAX_EVENTS) events.shift();
  events.push(entry);

  if (isDev) {
    console.debug('[Prachify Event]', entry);
  } else {
    scheduleFlush(entry);
  }
};

// ── Flush logic ────────────────────────────────────────────────────────────────

const scheduleFlush = (entry) => {
  pendingFlush.push(entry);
  if (!flushTimer) {
    flushTimer = setTimeout(flush, FLUSH_INTERVAL_MS);
  }
};

export const flush = async () => {
  flushTimer = null;
  if (!pendingFlush.length) return;
  if (typeof navigator !== 'undefined' && !navigator.onLine) return; // retry on reconnect

  const batch = pendingFlush.splice(0); // take all, clear array

  try {
    await fetch('/api/events', {
      method: 'POST',
      body: JSON.stringify(batch),
      headers: { 'Content-Type': 'application/json' },
      keepalive: true, // survives page unload on modern browsers
    });
  } catch {
    // Silently drop — analytics is best-effort. Never crash the app.
    // Events are already removed from pendingFlush, which is intentional:
    // we don't retry failed batches to avoid memory accumulation.
  }
};

// ── Lifecycle hooks ────────────────────────────────────────────────────────────

// Flush on tab hide (covers: tab close, Android back, iOS backgrounding)
if (typeof document !== 'undefined') {
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') flush();
  });
}

// ── Debug utility ─────────────────────────────────────────────────────────────

/**
 * Returns a snapshot of the in-memory ring buffer.
 * Useful in debug panels or DevTools.
 */
export const getEventLog = () => [...events];

export default logEvent;
