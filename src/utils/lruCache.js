/**
 * lruCache.js
 * Proper LRU (Least-Recently-Used) cache using Map insertion-order guarantees.
 *
 * Why private fields (#):
 *   Prevents accidental direct mutation of #cache from outside the class,
 *   which would bypass LRU ordering logic.
 *
 * Why Map (not Object):
 *   Map preserves insertion order reliably — the first key is always LRU.
 *   Object key order is not guaranteed for non-string keys and numeric strings.
 *
 * § final.md §3
 */

import { logEvent } from './errorBus.js';

// ── Device-adaptive limits ─────────────────────────────────────────────────────

/**
 * Returns device class based on navigator.deviceMemory.
 * - 'high': >= 4 GB or unknown (iOS doesn't expose this)
 * - 'mid': 2–3 GB
 * - 'low': < 2 GB
 */
export const getDeviceClass = () => {
  const mem = navigator.deviceMemory; // GB, undefined on iOS
  if (!mem || mem >= 4) return 'high';
  if (mem >= 2) return 'mid';
  return 'low';
};

export const LRU_LIMITS = {
  high: { search: 50,  songs: 150, aiRefinements: 30 },
  mid:  { search: 30,  songs: 100, aiRefinements: 20 },
  low:  { search: 15,  songs: 50,  aiRefinements: 10 },
};

// Compute once at module load time (device class doesn't change mid-session)
export const deviceClass = getDeviceClass();
export const limits = LRU_LIMITS[deviceClass];

// ── LRU Cache implementation ───────────────────────────────────────────────────

export class LRUCache {
  #limit;
  #cache;
  #id;

  /**
   * @param {number} limit  - max number of entries before eviction
   * @param {string} id     - identifier for logging (set by createCache)
   */
  constructor(limit = 50, id = 'unnamed') {
    this.#limit = limit;
    this.#cache = new Map();
    this.#id = id;
  }

  /**
   * Get a value by key. Promotes the entry to most-recently-used.
   * @param {string} key
   * @returns {any|null}
   */
  get(key) {
    if (!this.#cache.has(key)) return null;
    const value = this.#cache.get(key);
    // Move to end = most recently used
    this.#cache.delete(key);
    this.#cache.set(key, value);
    return value;
  }

  /**
   * Set a key-value pair. Evicts LRU entry if at capacity.
   * @param {string} key
   * @param {any} value
   */
  set(key, value) {
    if (this.#cache.has(key)) {
      this.#cache.delete(key); // re-insert to update position
    } else if (this.#cache.size >= this.#limit) {
      // Evict least recently used (= first entry in Map)
      const lruKey = this.#cache.keys().next().value;
      this.#cache.delete(lruKey);
      // Log AFTER synchronous eviction (never await inside set/get)
      logEvent('lru_eviction', { cacheId: this.#id, evictedKey: String(lruKey) });
    }
    this.#cache.set(key, value);
  }

  /** @param {string} key */
  has(key) { return this.#cache.has(key); }

  /** @param {string} key */
  delete(key) { return this.#cache.delete(key); }

  /** Remove all entries */
  clear() { this.#cache.clear(); }

  /** Current number of entries */
  get size() { return this.#cache.size; }

  /** Cache id (for registry / logging) */
  get id() { return this.#id; }
}

// ── Centralized Cache Registry ────────────────────────────────────────────────

/**
 * Registry of all named caches.
 * Enables cache-stats snapshots for observability.
 */
const registry = new Map();

/**
 * Create and register a named LRU cache.
 * @param {string} id     - unique identifier (e.g. 'search', 'songs', 'aiRefinements')
 * @param {number} limit  - max entries
 * @returns {LRUCache}
 */
export const createCache = (id, limit) => {
  const cache = new LRUCache(limit, id);
  registry.set(id, cache);
  return cache;
};

/**
 * Get a snapshot of all registered cache sizes.
 * Useful for debug panels:
 *   logEvent('cache_stats', getCacheStats())
 * @returns {Object}
 */
export const getCacheStats = () =>
  Object.fromEntries([...registry.entries()].map(([id, c]) => [id, { size: c.size }]));

/**
 * Get a registered cache by id.
 * @param {string} id
 * @returns {LRUCache|undefined}
 */
export const getCache = (id) => registry.get(id);

// ── Key normalization ─────────────────────────────────────────────────────────

/**
 * Normalize a search query string for use as a cache key.
 * Prevents collisions between "Arijit singh " and "arijit singh".
 * @param {string} q
 * @returns {string}
 */
export const normalizeKey = (q) =>
  q.toLowerCase().trim().replace(/\s+/g, ' ');

export default { LRUCache, createCache, getCache, getCacheStats, normalizeKey, limits, deviceClass };
