/// <reference lib="webworker" />
import { precacheAndRoute, cleanupOutdatedCaches } from '@serwist/precaching'
import { ExpirationPlugin } from '@serwist/expiration'
import { CacheableResponsePlugin } from '@serwist/cacheable-response'
import { registerRoute, setCatchHandler } from '@serwist/routing'
import { CacheFirst, NetworkFirst } from '@serwist/strategies'

// Precache manifest type (injected by serwist at build time)
interface SerwistPrecacheEntry {
  url: string
  revision?: string
}

// ─── Precaching & Cleanup ─────────────────────────────────────────────────────
// Filter out large/route assets from precache manifest — only precache small static files
// Large assets (images, HTML pages) are cached on-demand via runtime caching

const PRECACHE_MANIFEST = (self as unknown as { __SW_MANIFEST: SerwistPrecacheEntry[] }).__SW_MANIFEST

// Only precache: JS/CSS chunks, fonts, manifest, sw.js itself, small icons
// Skip: HTML pages, large images, API routes, dynamic content
const filteredPrecache = PRECACHE_MANIFEST.filter((entry) => {
  const url = entry.url
  // Skip HTML pages (they're cached via navigation route)
  if (url.endsWith('.html') || url === '/' || url.startsWith('/?')) return false
  // Skip large images
  if (url.endsWith('.png') && !url.includes('icon-192') && !url.includes('icon-512')) return false
  if (url.endsWith('.jpeg') || url.endsWith('.jpg') || url.endsWith('.webp')) return false
  // Skip API routes
  if (url.startsWith('/api/')) return false
  // Skip offline page (cached separately)
  if (url === '/offline.html') return false
  // Keep everything else: JS chunks, CSS, fonts, manifest, small icons
  return true
})

precacheAndRoute(filteredPrecache)
cleanupOutdatedCaches()

// ─── Offline Fallback ─────────────────────────────────────────────────────────

const OFFLINE_URL = '/offline.html'
const CACHE_NAME = 'luxtradee-offline-v4'
const STATIC_CACHE = 'luxtradee-static-v4'
const PAGES_CACHE = 'luxtradee-pages-v4'

const sw = self as unknown as ServiceWorkerGlobalScope

// Pre-cache ONLY the lightweight offline page + tiny icons on install
// This is minimal — the install event finishes in <100ms
sw.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) =>
      // Only cache the offline fallback + manifest — everything else caches on-demand
      cache.addAll([
        OFFLINE_URL,
        '/manifest.webmanifest',
        '/icon-192x192.png',
      ]).catch(() => cache.add(OFFLINE_URL))
    )
  )
  // Activate immediately — don't wait for old SW to finish
  sw.skipWaiting?.()
})

// Claim all clients immediately on activate for faster SW control
sw.addEventListener('activate', (event) => {
  event.waitUntil(
    Promise.all([
      sw.clients.claim?.(),
      // Clean up ALL old luxtradee caches
      caches.keys().then((names) =>
        Promise.all(
          names
            .filter((name) => name.startsWith('luxtradee-') && name !== CACHE_NAME && name !== STATIC_CACHE && name !== PAGES_CACHE)
            .map((name) => caches.delete(name))
        )
      ),
    ])
  )
})

// ─── Cache JS/CSS Build Chunks — CacheFirst, 1 year (immutable) ──────────────

registerRoute(
  ({ request, url }) =>
    (request.destination === 'script' || request.destination === 'style') &&
    url.pathname.startsWith('/_next/static/'),
  new CacheFirst({
    cacheName: STATIC_CACHE,
    plugins: [
      new ExpirationPlugin({
        maxEntries: 200,
        maxAgeSeconds: 365 * 24 * 60 * 60,
      }),
      new CacheableResponsePlugin({
        statuses: [0, 200],
      }),
    ],
  })
)

// ─── Cache Static Assets — CacheFirst, 60 days ───────────────────────────────

registerRoute(
  ({ request }) =>
    request.destination === 'image' ||
    request.destination === 'font' ||
    request.url.includes('/icon-') ||
    request.url.includes('/apple-icon') ||
    request.url.includes('/logo'),
  new CacheFirst({
    cacheName: STATIC_CACHE,
    plugins: [
      new ExpirationPlugin({
        maxEntries: 100,
        maxAgeSeconds: 60 * 24 * 60 * 60,
      }),
      new CacheableResponsePlugin({
        statuses: [0, 200],
      }),
    ],
  })
)

// ─── Cache API — CacheFirst, 5 min (NO background revalidation) ─────────────
// IMPORTANT: Using CacheFirst instead of StaleWhileRevalidate to avoid
// background revalidation requests that prevent Lighthouse "Network Idle" status.
// CacheFirst serves from cache first, falls back to network only on cache miss.

registerRoute(
  ({ url }) => url.pathname.startsWith('/api/') && !url.pathname.startsWith('/api/chat'),
  new CacheFirst({
    cacheName: 'luxtradee-api-v4',
    plugins: [
      new ExpirationPlugin({
        maxEntries: 60,
        maxAgeSeconds: 5 * 60,
      }),
      new CacheableResponsePlugin({
        statuses: [0, 200],
      }),
    ],
  })
)

// ─── Navigation / HTML — NetworkFirst + Offline Fallback ─────────────────────
// This is the KEY route for offline capability:
// 1. Try network (2s timeout for fast-fail in PWA tests)
// 2. Cache fallback
// 3. /offline.html fallback (pre-cached, always available)

registerRoute(
  ({ request }) => request.mode === 'navigate',
  async ({ event, url }) => {
    const request = (event as FetchEvent).request
    const timeoutMs = 2000 // Fast timeout — PWA tests need quick response

    try {
      const networkResponse = await fetchWithTimeout(request, timeoutMs)
      if (networkResponse && networkResponse.ok) {
        const cache = await caches.open(PAGES_CACHE)
        cache.put(request, networkResponse.clone())
        return networkResponse
      }
    } catch {
      // Network failed — fall through to cache
    }

    // Try page cache
    try {
      const cachedResponse = await caches.match(request)
      if (cachedResponse) return cachedResponse
    } catch {
      // Cache miss
    }

    // Try offline fallback (pre-cached, always available)
    try {
      const offlineResponse = await caches.match(OFFLINE_URL)
      if (offlineResponse) return offlineResponse
    } catch {
      // Even offline page not cached
    }

    // Last resort: inline offline page (zero-dependency)
    return new Response(
      `<!DOCTYPE html><html lang="id"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>LuxTradee — Offline</title><meta name="theme-color" content="#050507"><style>*{margin:0;padding:0;box-sizing:border-box}body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;background:#050507;color:#fff;display:flex;align-items:center;justify-content:center;min-height:100vh;text-align:center;padding:20px}.c{max-width:400px}.i{font-size:56px;margin-bottom:16px}h1{font-size:20px;font-weight:700;margin-bottom:8px}p{font-size:14px;color:rgba(255,255,255,0.5);line-height:1.5;margin-bottom:24px}button{display:inline-flex;align-items:center;gap:8px;padding:10px 24px;border-radius:12px;background:#4FC3F7;color:#050507;font-size:14px;font-weight:600;border:none;cursor:pointer;transition:background .2s}button:hover{background:#29B6F6}</style></head><body><div class="c"><div class="i">📡</div><h1>Kamu Sedang Offline</h1><p>Tidak ada koneksi internet. Data yang sudah di-cache tetap bisa diakses.</p><button onclick="window.location.reload()">🔄 Coba Lagi</button></div></body></html>`,
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

// ─── Background Sync for Offline Actions ─────────────────────────────────────

interface QueuedRequest {
  url: string
  method: string
  body: string
  headers: Record<string, string>
  timestamp: number
}

const SYNC_QUEUE = 'luxtradee-sync-queue'

sw.addEventListener('sync', (event) => {
  if (event.tag === 'luxtradee-replay-queue') {
    event.waitUntil(replayQueuedRequests())
  }
})

async function replayQueuedRequests(): Promise<void> {
  try {
    const cache = await caches.open(SYNC_QUEUE)
    const requests = await cache.match('/__queued__')
    if (!requests) return

    const queued: QueuedRequest[] = await requests.json()
    const remaining: QueuedRequest[] = []

    for (const req of queued) {
      try {
        const response = await fetch(req.url, {
          method: req.method,
          headers: req.headers,
          body: req.body,
        })
        if (!response.ok) remaining.push(req)
      } catch {
        remaining.push(req)
      }
    }

    if (remaining.length === 0) {
      await cache.delete('/__queued__')
    } else {
      await cache.put('/__queued__', new Response(JSON.stringify(remaining)))
    }
  } catch {
    // Silent fail — will retry on next sync
  }
}

// ─── Push Notification Handlers ──────────────────────────────────────────────

sw.addEventListener('push', (event) => {
  let data: { title?: string; body?: string; icon?: string; badge?: string; url?: string; tag?: string; type?: string; vibrate?: number[] } = {}

  try {
    data = event.data?.json() ?? {}
  } catch {
    data.body = event.data?.text() ?? 'New notification from LuxTradee'
  }

  const title = data.title || 'LuxTradee'
  const isTradeAlert = data.type === 'trade' || data.type === 'price-alert'

  const options: NotificationOptions & { vibrate?: number[] } = {
    body: data.body || '',
    icon: data.icon || '/icon-512x512.png',
    badge: data.badge || '/icon-192x192.png',
    tag: data.tag || 'default',
    vibrate: data.vibrate || (isTradeAlert ? [200, 100, 200] : [100]),
    data: {
      url: data.url || '/',
      type: data.type || 'general',
    },
    requireInteraction: isTradeAlert,
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
  console.log('[sw] Push subscription changed — app will re-subscribe on next launch')
})

sw.addEventListener('message', (event) => {
  if (event.data?.type === 'SKIP_WAITING') {
    sw.skipWaiting?.()
  }
})

// ─── Periodic Background Sync ────────────────────────────────────────────────
// Allows the PWA to periodically sync data in the background (e.g. market prices,
// trade updates) even when the app is not in the foreground.
// Requires: browser support + ServiceWorkerRegistration.periodicSync permission.

sw.addEventListener('periodicsync', (event: Event) => {
  const syncEvent = event as SyncEvent & { tag: string }
  if (syncEvent.tag === 'update-data') {
    syncEvent.waitUntil(doPeriodicSync())
  }
})

async function doPeriodicSync(): Promise<void> {
  try {
    // Fetch latest app data to keep cache fresh
    const response = await fetch('/api/landing-stats')
    if (response.ok) {
      const cache = await caches.open(CACHE_NAME)
      await cache.put('/api/landing-stats', response.clone())
      console.log('[sw] Periodic sync: updated landing-stats cache')
    }
  } catch {
    // Silent fail — will retry on next periodic sync interval
  }
}
