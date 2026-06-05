/**
 * haptic.js
 * Mobile haptic feedback utility using the Vibration API.
 *
 * Key design decisions:
 *  - iOS does NOT support navigator.vibrate — always guard (§9.1)
 *  - Battery saver / OS vibration disabled → vibrate() silently returns false — OK
 *  - User preference stored in safeStorage as 'hapticsEnabled' (§9.4)
 *  - CRITICAL: Check is `=== 'false'` NOT `!safeStorage.get(...) === 'false'`
 *    (operator precedence bug fixed — original had `!x === 'false'` which is always false)
 *
 * § final.md §9
 *
 * Usage:
 *   import { haptic, HAPTIC } from '../utils/haptic';
 *   haptic(HAPTIC.LIKE);          // double pulse on like
 *   haptic(HAPTIC.TAP);           // single short on button tap
 */

import safeStorage from './safeStorage.js';

/**
 * Haptic pattern constants.
 * Values are ms durations (vibrate) or arrays [on, off, on, ...].
 */
export const HAPTIC = {
  /** Single short tap — button presses */
  TAP: 10,
  /** Double pulse — song liked */
  LIKE: [15, 50, 15],
  /** Long buzz — error or blocked action */
  ERROR: 100,
  /** Short snap — sheet closed */
  SHEET_SNAP: 8,
};

/**
 * Trigger haptic feedback with the given pattern.
 * Silent on iOS, silent when user has disabled haptics, silent in battery saver.
 *
 * @param {number | number[]} pattern — vibration pattern (see HAPTIC constants)
 */
export const haptic = (pattern) => {
  // § final.md §9.1 — iOS PWA does not support Vibration API
  if (!navigator.vibrate) return;

  // § final.md §9.4 — respect user preference
  // IMPORTANT: Must be `=== 'false'`, NOT `!safeStorage.get(...) === 'false'`
  // because !x evaluates first: !(null) === 'false' → true === 'false' → false (wrong!)
  if (safeStorage.get('hapticsEnabled') === 'false') return;

  navigator.vibrate(pattern);
};

/**
 * Check whether haptics are enabled (for settings UI).
 * @returns {boolean}
 */
export const isHapticsEnabled = () =>
  safeStorage.get('hapticsEnabled') !== 'false'; // default: ON

/**
 * Set haptics enabled/disabled preference.
 * @param {boolean} enabled
 */
export const setHapticsEnabled = (enabled) => {
  safeStorage.set('hapticsEnabled', enabled ? 'true' : 'false');
};

export default haptic;
