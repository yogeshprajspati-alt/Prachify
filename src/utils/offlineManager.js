/**
 * offlineManager.js
 * Centralized online/offline state manager.
 *
 * Why not just navigator.onLine?
 *   navigator.onLine = true doesn't mean internet is reachable (captive portals,
 *   metered connections). Always wrap critical network calls in try/catch too.
 *
 * Usage:
 *   import { getOnlineStatus, onOnlineChange } from './offlineManager';
 *
 *   // Subscribe to changes
 *   const unsubscribe = onOnlineChange((isOnline) => {
 *     if (!isOnline) showOfflineBanner();
 *     else hideOfflineBanner();
 *   });
 *   // Cleanup: unsubscribe()
 *
 *   // Point-in-time check
 *   if (!getOnlineStatus()) return showOfflineError();
 *
 * § final.md §12, §G.4
 */

import { flush } from './errorBus.js';

let isOnline = typeof navigator !== 'undefined' ? navigator.onLine : true;

/** @type {Set<(online: boolean) => void>} */
const listeners = new Set();

// ── Subscription ───────────────────────────────────────────────────────────────

/**
 * Subscribe to online/offline changes.
 * @param {(isOnline: boolean) => void} fn
 * @returns {() => void}  unsubscribe function
 */
export const onOnlineChange = (fn) => {
  listeners.add(fn);
  return () => listeners.delete(fn);
};

/**
 * Get the current online status.
 * @returns {boolean}
 */
export const getOnlineStatus = () => isOnline;

// ── Internal handlers ──────────────────────────────────────────────────────────

const handleOnline = () => {
  isOnline = true;
  listeners.forEach(fn => fn(true));
  // Flush buffered analytics events now that we're back online
  flush();
};

const handleOffline = () => {
  isOnline = false;
  listeners.forEach(fn => fn(false));
};

// ── Network quality change (§G.4) ─────────────────────────────────────────────

/**
 * Notify listeners on significant network quality change.
 * Does NOT change isOnline status — that's what online/offline events are for.
 * Used by gapless prefetch to disable on slow connections.
 */
export const onNetworkChange = (fn) => {
  const conn = navigator?.connection;
  if (!conn) return () => {};
  conn.addEventListener('change', fn);
  return () => conn.removeEventListener('change', fn);
};

/**
 * Returns true if current connection is good enough for prefetching.
 * @returns {boolean}
 */
export const shouldPrefetch = () => {
  const conn = navigator?.connection;
  if (!conn) return true; // unknown → allow prefetch
  return !conn.saveData && !['slow-2g', '2g'].includes(conn.effectiveType);
};

// ── Initialization ─────────────────────────────────────────────────────────────
// Wire up event listeners once at module load time.
// Module is a singleton — this block runs exactly once.

if (typeof window !== 'undefined') {
  window.addEventListener('online', handleOnline);
  window.addEventListener('offline', handleOffline);
}

export default { getOnlineStatus, onOnlineChange, onNetworkChange, shouldPrefetch };
