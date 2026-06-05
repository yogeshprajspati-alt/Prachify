/**
 * toast.js
 * Lightweight imperative toast utility.
 *
 * No React dependency — works from hooks and services.
 * Creates a temporary DOM element, auto-removes after duration.
 *
 * § final.md §1.5, §2.1, §12
 *
 * Usage:
 *   import { showToast } from '../utils/toast';
 *   showToast('Song blocked by language filter');
 *   showToast('You\'re offline', { persist: true, id: 'offline-banner' });
 *   dismissToast('offline-banner');
 */

const DEFAULT_DURATION = 3000; // ms
const activeToasts = new Map(); // id → DOM element

/**
 * Show a toast notification.
 * @param {string} message
 * @param {{ persist?: boolean, id?: string, type?: 'info'|'warn'|'error' }} opts
 */
export const showToast = (message, opts = {}) => {
  const { persist = false, id = null, type = 'info' } = opts;

  // Dismiss existing toast with same id
  if (id) dismissToast(id);

  const el = document.createElement('div');
  el.textContent = message;

  const bgColor = type === 'error' ? 'rgba(200,50,50,0.95)'
    : type === 'warn'  ? 'rgba(200,140,50,0.95)'
    : 'rgba(30,30,30,0.95)';

  Object.assign(el.style, {
    position: 'fixed',
    bottom: '90px', // above BottomPlayer
    left: '50%',
    transform: 'translateX(-50%) translateY(20px)',
    background: bgColor,
    color: '#fff',
    padding: '10px 18px',
    borderRadius: '24px',
    fontSize: '13px',
    fontWeight: '600',
    fontFamily: 'inherit',
    zIndex: '9999',
    maxWidth: '80vw',
    textAlign: 'center',
    boxShadow: '0 4px 20px rgba(0,0,0,0.4)',
    transition: 'opacity 0.3s ease, transform 0.3s ease',
    opacity: '0',
    pointerEvents: 'none',
    whiteSpace: 'nowrap',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
  });

  document.body.appendChild(el);

  // Animate in
  requestAnimationFrame(() => {
    el.style.opacity = '1';
    el.style.transform = 'translateX(-50%) translateY(0)';
  });

  if (id) activeToasts.set(id, el);

  if (!persist) {
    setTimeout(() => _removeToast(el, id), DEFAULT_DURATION);
  }

  return el;
};

/**
 * Dismiss a persistent toast by id.
 * @param {string} id
 */
export const dismissToast = (id) => {
  const el = activeToasts.get(id);
  if (el) _removeToast(el, id);
};

const _removeToast = (el, id) => {
  el.style.opacity = '0';
  el.style.transform = 'translateX(-50%) translateY(10px)';
  setTimeout(() => {
    el.remove();
    if (id) activeToasts.delete(id);
  }, 300);
};

export default showToast;
