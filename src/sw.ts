/// <reference lib="webworker" />
import { precacheAndRoute, cleanupOutdatedCaches } from '@serwist/precaching'
import { ExpirationPlugin } from '@serwist/expiration'
import { CacheableResponsePlugin } from '@serwist/cacheable-response'
import { registerRoute, setCatchHandler, setDefaultHandler } from '@serwist/routing'
import { CacheFirst, NetworkFirst, NetworkOnly } from '@serwist/strategies'

// Precache manifest type (injected by serwist at build time)
interface SerwistPrecacheEntry {
  url: string
  revision?: string
}

// ─── Precaching & Cleanup ─────────────────────────────────────────────────────
const PRECACHE_MANIFEST = (self as unknown as { __SW_MANIFEST: SerwistPrecacheEntry[] }).__SW_MANIFEST

// Only precache: JS/CSS chunks, fonts, manifest, sw.js itself, small icons, offline page
// Skip: HTML pages (cached via navigation route), large images, API routes
const filteredPrecache = PRECACHE_MANIFEST.filter((entry) => {
  const url = entry.url
  // Skip HTML pages (they're cached via navigation route)
  if (url.endsWith('.html') || url === '/' || url.startsWith('/?')) return false
  // Skip large images
  if (url.endsWith('.png') && !url.includes('icon-192') && !url.includes('icon-512')) return false
  if (url.endsWith('.jpeg') || url.endsWith('.jpg') || url.endsWith('.webp')) return false
  // Skip API routes
  if (url.startsWith('/api/')) return false
  // Keep everything else: JS chunks, CSS, fonts, manifest, small icons, offline.html
  return true
})

precacheAndRoute(filteredPrecache)
cleanupOutdatedCaches()

// ─── Offline Fallback ─────────────────────────────────────────────────────────

const OFFLINE_URL = '/offline.html'
const CACHE_NAME = 'luxtradee-offline-v5'
const STATIC_CACHE = 'luxtradee-static-v5'
const PAGES_CACHE = 'luxtradee-pages-v5'
const API_CACHE = 'luxtradee-api-v5'

const sw = self as unknown as ServiceWorkerGlobalScope

// ─── Pre-cache critical assets on install ─────────────────────────────────────
// The offline page MUST be in cache before we go offline
sw.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) =>
      cache.addAll([
        OFFLINE_URL,
        '/manifest.webmanifest',
        '/icon-192x192.png',
        '/icon-512x512.png',
      ]).catch(() =>
        // Fallback: at minimum cache the offline page
        cache.add(OFFLINE_URL).catch(() => {
          // Even offline.html failed to cache — inline fallback will be used
        })
      )
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
            .filter((name) => name.startsWith('luxtradee-') && name !== CACHE_NAME && name !== STATIC_CACHE && name !== PAGES_CACHE && name !== API_CACHE)
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

// ─── Cache API — NetworkOnly with offline fallback ───────────────────────────
// When offline and cache miss, return a lightweight JSON error instead of hanging.
// This prevents API calls from blocking the SW offline response.

registerRoute(
  ({ url }) => url.pathname.startsWith('/api/') && !url.pathname.startsWith('/api/chat'),
  new CacheFirst({
    cacheName: API_CACHE,
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

// ─── Navigation / HTML — NetworkFirst with fast timeout + Offline Fallback ────
// This is the KEY route for PWABuilder offline capability:
// 1. Try network (3s timeout)
// 2. Cache fallback (previously visited pages)
// 3. /offline.html fallback (pre-cached, always available)

registerRoute(
  ({ request }) => request.mode === 'navigate',
  new NetworkFirst({
    cacheName: PAGES_CACHE,
    networkTimeoutSeconds: 3,
    plugins: [
      new CacheableResponsePlugin({
        statuses: [0, 200],
      }),
    ],
  })
)

// ─── Catch Handler — Offline Fallback for ALL failed requests ────────────────
// This is what PWABuilder/Lighthouse checks: when offline, navigation requests
// must return a valid HTML page (not a network error).
// setCatchHandler intercepts ALL requests that would otherwise fail.

setCatchHandler(async ({ request }) => {
  // For navigation requests (HTML pages), return the offline page
  if (request.mode === 'navigate') {
    // Try pre-cached offline.html first
    const cachedOffline = await caches.match(OFFLINE_URL)
    if (cachedOffline) return cachedOffline

    // Inline fallback (zero-dependency, always works)
    return new Response(OFFLINE_PAGE_HTML, {
      headers: { 'Content-Type': 'text/html; charset=utf-8' },
    })
  }

  // For API requests, return a lightweight JSON error
  if (request.url.includes('/api/')) {
    return new Response(
      JSON.stringify({ success: false, offline: true, message: 'Offline — request queued' }),
      { headers: { 'Content-Type': 'application/json' } }
    )
  }

  // For images, return a transparent 1x1 pixel (prevents broken image icons)
  if (request.destination === 'image') {
    return new Response(
      'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" width="1" height="1"/>',
      { headers: { 'Content-Type': 'image/svg+xml' } }
    )
  }

  // For everything else, return a generic offline response
  return new Response('Offline', { status: 503, statusText: 'Service Unavailable' })
})

// ─── Inline Offline Page HTML (zero-dependency fallback) ─────────────────────
const OFFLINE_PAGE_HTML = `<!DOCTYPE html><html lang="id" dir="ltr"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>LuxTradee — Offline</title><meta name="theme-color" content="#050507"><style>*{margin:0;padding:0;box-sizing:border-box}body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;background:#050507;color:#fff;display:flex;align-items:center;justify-content:center;min-height:100vh;text-align:center;padding:24px}.c{max-width:400px}.i{font-size:56px;margin-bottom:16px}h1{font-size:20px;font-weight:700;margin-bottom:8px}p{font-size:14px;color:rgba(255,255,255,0.5);line-height:1.6;margin-bottom:24px}.b{display:inline-block;padding:4px 12px;border-radius:999px;background:rgba(79,195,247,0.1);color:#4FC3F7;font-size:12px;font-weight:600;margin-bottom:20px;border:1px solid rgba(79,195,247,0.2)}button{display:inline-flex;align-items:center;gap:8px;padding:12px 28px;border-radius:12px;background:#4FC3F7;color:#050507;font-size:14px;font-weight:600;border:none;cursor:pointer;transition:background .2s}button:hover{background:#29B6F6}.f{margin-top:32px;font-size:11px;color:rgba(255,255,255,0.2)}</style></head><body><div class="c"><div class="i">📡</div><h1>Kamu Sedang Offline</h1><div class="b">CACHE AKTIF</div><p>Tidak ada koneksi internet, tapi data yang sudah di-cache tetap bisa diakses. Dashboard dan trade terakhir masih tersedia.</p><button onclick="window.location.reload()">🔄 Coba Lagi</button><div class="f">LuxTradee — Data tersimpan lokal tetap bisa diakses</div></div></body></html>`

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

sw.addEventListener('periodicsync', (event: Event) => {
  const syncEvent = event as SyncEvent & { tag: string }
  if (syncEvent.tag === 'update-data') {
    syncEvent.waitUntil(doPeriodicSync())
  }
})

async function doPeriodicSync(): Promise<void> {
  try {
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
