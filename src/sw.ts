/// <reference lib="webworker" />
import { precacheAndRoute, cleanupOutdatedCaches } from '@serwist/precaching'
import { ExpirationPlugin } from '@serwist/expiration'
import { CacheableResponsePlugin } from '@serwist/cacheable-response'
import { registerRoute } from '@serwist/routing'
import { StaleWhileRevalidate, CacheFirst, NetworkFirst } from '@serwist/strategies'

// Precache manifest type (injected by serwist at build time)
interface SerwistPrecacheEntry {
  url: string
  revision?: string
}

// Setup precaching & cleanup
precacheAndRoute((self as unknown as { __SW_MANIFEST: SerwistPrecacheEntry[] }).__SW_MANIFEST)
cleanupOutdatedCaches()

// Cache static assets (images, fonts, icons) — CacheFirst, 30 days
registerRoute(
  ({ request }) =>
    request.destination === 'image' ||
    request.destination === 'font' ||
    request.url.includes('/icon-') ||
    request.url.includes('/apple-icon') ||
    request.url.includes('/logo'),
  new CacheFirst({
    cacheName: 'luxtradee-static-assets',
    plugins: [
      new ExpirationPlugin({
        maxEntries: 100,
        maxAgeSeconds: 30 * 24 * 60 * 60,
      }),
      new CacheableResponsePlugin({
        statuses: [0, 200],
      }),
    ],
  })
)

// Cache API requests — StaleWhileRevalidate, 5 minutes
registerRoute(
  ({ url }) => url.pathname.startsWith('/api/') && !url.pathname.startsWith('/api/chat'),
  new StaleWhileRevalidate({
    cacheName: 'luxtradee-api',
    plugins: [
      new ExpirationPlugin({
        maxEntries: 50,
        maxAgeSeconds: 5 * 60,
      }),
      new CacheableResponsePlugin({
        statuses: [0, 200],
      }),
    ],
  })
)

// Cache pages (HTML) — NetworkFirst with cache fallback, 10 minutes
registerRoute(
  ({ request }) => request.mode === 'navigate',
  new NetworkFirst({
    cacheName: 'luxtradee-pages',
    plugins: [
      new ExpirationPlugin({
        maxEntries: 20,
        maxAgeSeconds: 10 * 60,
      }),
      new CacheableResponsePlugin({
        statuses: [0, 200],
      }),
    ],
  })
)
