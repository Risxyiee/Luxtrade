/// <reference lib="webworker" />
import type { PrecacheEntry } from '@serwist/precaching'
import { install, activate } from '@serwist/precaching'
import { skipWaiting, clientsClaim } from 'serwist'
import { ExpirationPlugin } from '@serwist/expiration'
import { CacheableResponsePlugin } from '@serwist/cacheable-response'
import { registerRoute } from '@serwist/routing'
import { StaleWhileRevalidate, CacheFirst, NetworkFirst } from '@serwist/strategies'

// This is required — serwist replaces this with the precache manifest at build time
declare const self: ServiceWorkerGlobalScope
const _SW_MANIFEST = self.__SW_MANIFEST

// Skip waiting and claim clients immediately
skipWaiting()
clientsClaim()

// Precache & cleanup old precache entries
install((_SW_MANIFEST as PrecacheEntry[]) as unknown as PrecacheEntry[])
activate((_SW_MANIFEST as PrecacheEntry[]) as unknown as PrecacheEntry[])

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
        maxAgeSeconds: 30 * 24 * 60 * 60, // 30 days
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
        maxAgeSeconds: 5 * 60, // 5 minutes
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
        maxAgeSeconds: 10 * 60, // 10 minutes
      }),
      new CacheableResponsePlugin({
        statuses: [0, 200],
      }),
    ],
  })
)
