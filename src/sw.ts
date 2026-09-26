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

// ─── Push Notification Handlers ───────────────────────────────────────────

// ServiceWorker global scope reference
const sw = self as unknown as ServiceWorkerGlobalScope

// Handle push events — display notification even when app is closed
sw.addEventListener('push', (event) => {
  let data: { title?: string; body?: string; icon?: string; badge?: string; url?: string; tag?: string; type?: string } = {}

  try {
    data = event.data?.json() ?? {}
  } catch {
    data.body = event.data?.text() ?? 'New notification from LuxTradee'
  }

  const title = data.title || 'LuxTradee'
  const options: NotificationOptions = {
    body: data.body || '',
    icon: data.icon || '/icon-192x192.png',
    badge: data.badge || '/icon-72x72.png',
    tag: data.tag || 'default',
    data: {
      url: data.url || '/',
      type: data.type || 'general',
    },
    requireInteraction: data.type === 'trade' || data.type === 'price-alert',
    silent: false,
  }

  event.waitUntil(sw.registration.showNotification(title, options))
})

// Handle notification click — open/focus the app
sw.addEventListener('notificationclick', (event) => {
  event.notification.close()

  const urlToOpen = (event.notification.data as { url?: string })?.url || '/'

  event.waitUntil(
    sw.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      // If app is already open, focus it and navigate
      for (const client of clientList) {
        if (client.url.includes(sw.location.origin) && 'focus' in client) {
          return (client as WindowClient).navigate(urlToOpen).then((c) => {
            if (c) return c.focus()
          })
        }
      }
      // Otherwise open new window
      return sw.clients.openWindow(urlToOpen)
    })
  )
})

// Handle subscription push change (e.g., browser refreshed keys)
sw.addEventListener('pushsubscriptionchange', () => {
  // We'll let the app re-subscribe on next launch
  console.log('[sw] Push subscription changed, app will re-subscribe on next launch')
})
