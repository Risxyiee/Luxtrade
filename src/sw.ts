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

// ─── Precaching & Cleanup ─────────────────────────────────────────────────────

precacheAndRoute((self as unknown as { __SW_MANIFEST: SerwistPrecacheEntry[] }).__SW_MANIFEST)
cleanupOutdatedCaches()

// ─── Offline Fallback Strategy ───────────────────────────────────────────────
// PWABuilder requires fast offline support — return cached page or offline.html

const OFFLINE_URL = '/offline.html'
const CACHE_NAME = 'luxtradee-offline-v1'

// Pre-cache the offline fallback page on install
const sw = self as unknown as ServiceWorkerGlobalScope

sw.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.add(OFFLINE_URL))
  )
})

// ─── Cache Static Assets — CacheFirst, 30 days ───────────────────────────────

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

// ─── Cache API — StaleWhileRevalidate, 5 min ─────────────────────────────────

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

// ─── Navigation / HTML — NetworkFirst + Offline Fallback ─────────────────────
// This is the critical route for PWABuilder "Offline Support" test:
// 1. Try network first (fast when online)
// 2. If network fails, return cached page from precache
// 3. If no cached page, return offline.html fallback

registerRoute(
  ({ request }) => request.mode === 'navigate',
  async ({ event }) => {
    const request = (event as FetchEvent).request

    try {
      // Try network first — with 3 second timeout for fast fallback
      const networkResponse = await fetchWithTimeout(request, 3000)
      if (networkResponse && networkResponse.ok) {
        // Cache the successful response for offline use
        const cache = await caches.open('luxtradee-pages')
        cache.put(request, networkResponse.clone())
        return networkResponse
      }
    } catch {
      // Network failed — fall through to cache
    }

    // Try cache
    try {
      const cachedResponse = await caches.match(request)
      if (cachedResponse) return cachedResponse
    } catch {
      // Cache miss — fall through to offline
    }

    // Return offline fallback page
    try {
      const offlineResponse = await caches.match(OFFLINE_URL)
      if (offlineResponse) return offlineResponse
    } catch {
      // Even offline page not cached
    }

    // Last resort: basic HTML response
    return new Response(
      '<!DOCTYPE html><html><head><meta charset="utf-8"><title>LuxTradee — Offline</title></head><body style="background:#050507;color:#fff;display:flex;align-items:center;justify-content:center;min-height:100vh;font-family:sans-serif"><div style="text-align:center"><h1>📡 Offline</h1><p>Kamu sedang offline. Coba lagi saat koneksi kembali.</p></div></body></html>',
      { headers: { 'Content-Type': 'text/html; charset=utf-8' } }
    )
  }
)

/**
 * Fetch with timeout — prevents hanging network requests.
 * Returns null on timeout (instead of throwing), so we can fall back to cache.
 */
async function fetchWithTimeout(request: Request, timeoutMs: number): Promise<Response | null> {
  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs)

  try {
    const response = await fetch(request, { signal: controller.signal })
    clearTimeout(timeoutId)
    return response
  } catch {
    clearTimeout(timeoutId)
    return null
  }
}

// ─── Push Notification Handlers ──────────────────────────────────────────────

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
      for (const client of clientList) {
        if (client.url.includes(sw.location.origin) && 'focus' in client) {
          return (client as WindowClient).navigate(urlToOpen).then((c) => {
            if (c) return c.focus()
          })
        }
      }
      return sw.clients.openWindow(urlToOpen)
    })
  )
})

// Handle subscription push change (e.g., browser refreshed keys)
sw.addEventListener('pushsubscriptionchange', () => {
  console.log('[sw] Push subscription changed, app will re-subscribe on next launch')
})
