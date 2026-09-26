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

// ─── Offline Fallback & Critical Asset Caching ────────────────────────────────

const OFFLINE_URL = '/offline.html'
const CACHE_NAME = 'luxtradee-offline-v2'

// ServiceWorker global scope
const sw = self as unknown as ServiceWorkerGlobalScope

// Pre-cache offline page + critical dashboard assets on install
sw.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) =>
      cache.addAll([
        OFFLINE_URL,
        '/',
        '/icon-192x192.png',
        '/icon-512x512.png',
        '/manifest.webmanifest',
      ]).catch(() => cache.add(OFFLINE_URL)) // partial cache is ok
    )
  )
  // Activate immediately - don't wait for old SW to finish
  sw.skipWaiting?.()
})

// Claim all clients immediately on activate for faster SW control
sw.addEventListener('activate', (event) => {
  event.waitUntil(
    Promise.all([
      sw.clients.claim?.(),
      // Clean up old caches
      caches.keys().then((names) =>
        Promise.all(
          names
            .filter((name) => name.startsWith('luxtradee-') && name !== CACHE_NAME)
            .map((name) => caches.delete(name))
        )
      ),
    ])
  )
})

// ─── Cache JS/CSS Build Chunks - CacheFirst, 1 year (immutable) ──────────────
// Next.js static chunks are content-hashed - never change, cache aggressively
// This makes dashboard load near-instant on repeat visits

registerRoute(
  ({ request, url }) =>
    (request.destination === 'script' || request.destination === 'style') &&
    url.pathname.startsWith('/_next/static/'),
  new CacheFirst({
    cacheName: 'luxtradee-static-chunks',
    plugins: [
      new ExpirationPlugin({
        maxEntries: 200,
        maxAgeSeconds: 365 * 24 * 60 * 60, // 1 year
      }),
      new CacheableResponsePlugin({
        statuses: [0, 200],
      }),
    ],
  })
)

// ─── Cache Static Assets - CacheFirst, 30 days ───────────────────────────────

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

// ─── Cache API - StaleWhileRevalidate, 5 min ─────────────────────────────────
// Return stale immediately (instant UI), then update in background

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

// ─── Navigation / HTML - NetworkFirst + Offline Fallback ─────────────────────
// 1. Try network (2s timeout - fast for WebView/TWA)
// 2. Cache fallback (previously visited pages)
// 3. offline.html (pre-cached on install)

registerRoute(
  ({ request }) => request.mode === 'navigate',
  async ({ event }) => {
    const request = (event as FetchEvent).request

    try {
      const networkResponse = await fetchWithTimeout(request, 2000)
      if (networkResponse && networkResponse.ok) {
        const cache = await caches.open('luxtradee-pages')
        cache.put(request, networkResponse.clone())
        return networkResponse
      }
    } catch {
      // Network failed
    }

    try {
      const cachedResponse = await caches.match(request)
      if (cachedResponse) return cachedResponse
    } catch {
      // Cache miss
    }

    try {
      const offlineResponse = await caches.match(OFFLINE_URL)
      if (offlineResponse) return offlineResponse
    } catch {
      // Even offline page not cached
    }

    return new Response(
      '<!DOCTYPE html><html><head><meta charset="utf-8"><title>LuxTradee - Offline</title></head><body style="background:#050507;color:#fff;display:flex;align-items:center;justify-content:center;min-height:100vh;font-family:sans-serif"><div style="text-align:center"><h1>Offline</h1><p>Kamu sedang offline. Coba lagi saat koneksi kembali.</p></div></body></html>',
      { headers: { 'Content-Type': 'text/html; charset=utf-8' } }
    )
  }
)

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

sw.addEventListener('pushsubscriptionchange', () => {
  console.log('[sw] Push subscription changed, app will re-subscribe on next launch')
})
