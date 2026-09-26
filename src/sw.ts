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
const CACHE_NAME = 'luxtradee-offline-v3'

// ServiceWorker global scope
const sw = self as unknown as ServiceWorkerGlobalScope

// Pre-cache offline page + critical assets on install
sw.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) =>
      cache.addAll([
        OFFLINE_URL,
        '/',
        '/icon-192x192.png',
        '/icon-512x512.png',
        '/icon-maskable-512x512.png',
        '/manifest.webmanifest',
        '/logo-hd-1024.png',
      ]).catch(() => cache.add(OFFLINE_URL)) // partial cache is ok
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
            .filter((name) => name.startsWith('luxtradee-') && name !== CACHE_NAME)
            .map((name) => caches.delete(name))
        )
      ),
    ])
  )
})

// ─── Cache JS/CSS Build Chunks — CacheFirst, 1 year (immutable) ──────────────
// Next.js static chunks are content-hashed — never change, cache aggressively
// This makes dashboard load near-instant on repeat visits

registerRoute(
  ({ request, url }) =>
    (request.destination === 'script' || request.destination === 'style') &&
    url.pathname.startsWith('/_next/static/'),
  new CacheFirst({
    cacheName: 'luxtradee-static-chunks-v2',
    plugins: [
      new ExpirationPlugin({
        maxEntries: 300,
        maxAgeSeconds: 365 * 24 * 60 * 60, // 1 year
      }),
      new CacheableResponsePlugin({
        statuses: [0, 200],
      }),
    ],
  })
)

// ─── Cache Static Assets — CacheFirst, 60 days ───────────────────────────────
// Images, fonts, icons, logos — cached long for smooth repeat visits

registerRoute(
  ({ request }) =>
    request.destination === 'image' ||
    request.destination === 'font' ||
    request.url.includes('/icon-') ||
    request.url.includes('/apple-icon') ||
    request.url.includes('/logo'),
  new CacheFirst({
    cacheName: 'luxtradee-static-assets-v2',
    plugins: [
      new ExpirationPlugin({
        maxEntries: 150,
        maxAgeSeconds: 60 * 24 * 60 * 60, // 60 days
      }),
      new CacheableResponsePlugin({
        statuses: [0, 200],
      }),
    ],
  })
)

// ─── Cache API — StaleWhileRevalidate, 5 min ─────────────────────────────────
// Return stale immediately (instant UI), then update in background
// Chat API excluded — always needs fresh data

registerRoute(
  ({ url }) => url.pathname.startsWith('/api/') && !url.pathname.startsWith('/api/chat'),
  new StaleWhileRevalidate({
    cacheName: 'luxtradee-api-v2',
    plugins: [
      new ExpirationPlugin({
        maxEntries: 80,
        maxAgeSeconds: 5 * 60,
      }),
      new CacheableResponsePlugin({
        statuses: [0, 200],
      }),
    ],
  })
)

// ─── Dashboard Route — StaleWhileRevalidate, 1 day ────────────────────────────
// Serve cached dashboard instantly, update in background
// This eliminates the "lag" on dashboard revisit

registerRoute(
  ({ url, request }) =>
    (url.pathname === '/dashboard' || url.pathname.startsWith('/dashboard/')) &&
    request.mode === 'navigate',
  new StaleWhileRevalidate({
    cacheName: 'luxtradee-dashboard-v2',
    plugins: [
      new ExpirationPlugin({
        maxEntries: 5,
        maxAgeSeconds: 24 * 60 * 60, // 1 day
      }),
      new CacheableResponsePlugin({
        statuses: [0, 200],
      }),
    ],
  })
)

// ─── Navigation / HTML — NetworkFirst + Offline Fallback ─────────────────────
// 1. Try network (3s timeout for fast-fail)
// 2. Cache fallback (previously visited pages)
// 3. offline.html (pre-cached on install)
// 4. Inline HTML fallback (last resort)

registerRoute(
  ({ request }) => request.mode === 'navigate',
  async ({ event, url }) => {
    const request = (event as FetchEvent).request
    const isDashboard = url.pathname.startsWith('/dashboard')
    const timeoutMs = isDashboard ? 5000 : 3000

    try {
      const networkResponse = await fetchWithTimeout(request, timeoutMs)
      if (networkResponse && networkResponse.ok) {
        const cache = await caches.open('luxtradee-pages-v2')
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

    // Try offline fallback
    try {
      const offlineResponse = await caches.match(OFFLINE_URL)
      if (offlineResponse) return offlineResponse
    } catch {
      // Even offline page not cached
    }

    // Last resort: inline offline page
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
// Queue failed POST/PUT requests and replay when online

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
      // Focus existing window if available
      for (const client of clientList) {
        if (client.url.includes(sw.location.origin) && 'focus' in client) {
          return (client as WindowClient).navigate(urlToOpen).then((c) => {
            if (c) return c.focus()
          })
        }
      }
      // Open new window
      return sw.clients.openWindow(urlToOpen)
    })
  )
})

sw.addEventListener('pushsubscriptionchange', () => {
  console.log('[sw] Push subscription changed — app will re-subscribe on next launch')
})

// ─── Online/Offline Status Detection ─────────────────────────────────────────
// Notify all clients when connectivity changes

sw.addEventListener('message', (event) => {
  if (event.data?.type === 'SKIP_WAITING') {
    sw.skipWaiting?.()
  }
})
