/**
 * safeStorage.js
 * Safe wrapper around localStorage.
 *
 * localStorage throws in:
 *   - Private / incognito mode (some browsers)
 *   - Storage quota exceeded
 *   - iOS Safari PWA with restricted storage permissions
 *
 * All methods fail silently — callers should handle null returns gracefully.
 *
 * § final.md §3.2, §1.6, §9.4
 */

import { logEvent } from './errorBus.js';

export const safeStorage = {
  /**
   * Read a value. Returns null on any error or if key is missing.
   * @param {string} key
   * @returns {string|null}
   */
  get(key) {
    try {
      return localStorage.getItem(key);
    } catch {
      return null;
    }
  },

  /**
   * Write a value. Returns true on success, false on failure.
   * @param {string} key
   * @param {string} val  — must be a string (use JSON.stringify for objects)
   * @returns {boolean}
   */
  set(key, val) {
    try {
      localStorage.setItem(key, val);
      return true;
    } catch (e) {
      logEvent('localstorage_write_fail', { key, errorName: e.name });
      return false;
    }
  },

  /**
   * Remove a key. Silent on error.
   * @param {string} key
   */
  remove(key) {
    try {
      localStorage.removeItem(key);
    } catch {
      // silent — best effort
    }
  },

  /**
   * Read and JSON-parse a stored value.
   * Returns null if missing or parse fails.
   * @param {string} key
   * @returns {any|null}
   */
  getJSON(key) {
    const raw = this.get(key);
    if (raw === null) return null;
    try {
      return JSON.parse(raw);
    } catch {
      return null;
    }
  },

  /**
   * JSON-stringify and store a value.
   * Returns true on success, false on failure.
   * @param {string} key
   * @param {any} val
   * @returns {boolean}
   */
  setJSON(key, val) {
    try {
      return this.set(key, JSON.stringify(val));
    } catch {
      return false;
    }
  },
};

export default safeStorage;
