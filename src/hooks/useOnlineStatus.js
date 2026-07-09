/**
 * useOnlineStatus.js
 * React hook that returns current online/offline status.
 *
 * Uses centralized offlineManager (singleton) instead of duplicating
 * window.addEventListener calls in every component.
 *
 * § final.md §12
 */

import { useState, useEffect } from 'react';
import { getOnlineStatus, onOnlineChange } from '../utils/offlineManager';

export function useOnlineStatus() {
  const [isOnline, setIsOnline] = useState(getOnlineStatus());

  useEffect(() => {
    // Subscribe and return the unsubscribe function directly as cleanup
    return onOnlineChange(setIsOnline);
  }, []);

  return isOnline;
}
