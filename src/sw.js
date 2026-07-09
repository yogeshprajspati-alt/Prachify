import { precacheAndRoute } from 'workbox-precaching';
import { registerRoute } from 'workbox-routing';
import { CacheFirst, StaleWhileRevalidate } from 'workbox-strategies';
import { ExpirationPlugin } from 'workbox-expiration';
import { CacheableResponsePlugin } from 'workbox-cacheable-response';

// Precache app shell injected by Vite
precacheAndRoute(self.__WB_MANIFEST);

// Cache Google Fonts (Stylesheets)
registerRoute(
  /^https:\/\/fonts\.googleapis\.com\/.*/i,
  new CacheFirst({
    cacheName: 'google-fonts-cache',
    plugins: [
      new CacheableResponsePlugin({ statuses: [0, 200] }),
      new ExpirationPlugin({ maxEntries: 10, maxAgeSeconds: 60 * 60 * 24 * 365 }),
    ],
  })
);

// Cache Google Fonts (Webfonts)
registerRoute(
  /^https:\/\/fonts\.gstatic\.com\/.*/i,
  new CacheFirst({
    cacheName: 'gstatic-fonts-cache',
    plugins: [
      new CacheableResponsePlugin({ statuses: [0, 200] }),
      new ExpirationPlugin({ maxEntries: 10, maxAgeSeconds: 60 * 60 * 24 * 365 }),
    ],
  })
);

// P3 §8: Cover Art Caching (Stale-While-Revalidate, max 200)
registerRoute(
  ({ url }) => url.href.includes('saavn') && url.href.includes('image'),
  new StaleWhileRevalidate({
    cacheName: 'cover-art-v1',
    plugins: [
      new ExpirationPlugin({ maxEntries: 200 }),
    ],
  })
);

// P2 §7: Gapless Playback Audio Prefetching
const PREFETCH_CACHE = 'audio-prefetch-v1';
const prefetchControllers = new Map();

self.addEventListener('message', async (event) => {
  if (!event.data) return;

  const { type, url, songId } = event.data;

  if (type === 'PREFETCH' && url && songId) {
    if (prefetchControllers.has(songId)) return; // Already prefetching

    const controller = new AbortController();
    prefetchControllers.set(songId, controller);

    try {
      // Store in cache
      const cache = await caches.open(PREFETCH_CACHE);
      const req = new Request(url);
      
      const cachedResponse = await cache.match(req);
      if (cachedResponse) {
        prefetchControllers.delete(songId);
        return; // Already cached
      }

      const response = await fetch(req, { signal: controller.signal });
      if (response.ok || response.status === 206) {
        // Save the timestamp to avoid stale streamUrls
        const responseToCache = new Response(response.body, {
          status: response.status,
          statusText: response.statusText,
          headers: new Headers(response.headers)
        });
        responseToCache.headers.append('X-Prefetched-At', Date.now().toString());
        await cache.put(req, responseToCache);
      }
    } catch (err) {
      if (err.name !== 'AbortError') {
        console.error('[SW] Prefetch failed for', songId, err);
      }
    } finally {
      prefetchControllers.delete(songId);
    }
  }

  if (type === 'CANCEL_PREFETCH' && songId) {
    const controller = prefetchControllers.get(songId);
    if (controller) {
      controller.abort();
      prefetchControllers.delete(songId);
    }
  }
  
  if (type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});
