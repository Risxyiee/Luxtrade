'use client'

import { useEffect } from 'react'

/**
 * Service Worker Update Handler
 *
 * The actual SW registration is done via inline <script> in layout.tsx <head>
 * so that Lighthouse can detect it via HTML parsing.
 *
 * This component handles:
 * - Listening for SW updates
 * - Skip waiting for new SW activation
 * - Periodic update checks (every 30 minutes) with PROPER CLEANUP
 * - Periodic Background Sync registration (for PWABuilder audit)
 */

const SW_UPDATE_INTERVAL = 30 * 60 * 1000 // 30 minutes
const PERIODIC_SYNC_TAG = 'update-data'
const PERIODIC_SYNC_MIN_INTERVAL = 24 * 60 // 24 hours in minutes

// Periodic Background Sync API types (Chromium-only, not in standard lib)
interface PeriodicSyncManager {
  register(tag: string, options?: { minInterval?: number }): Promise<void>
  unregister(tag: string): Promise<void>
  getTags(): Promise<string[]>
}

interface ServiceWorkerRegistrationWithPeriodicSync extends ServiceWorkerRegistration {
  periodicSync: PeriodicSyncManager
}

export default function ServiceWorkerRegistration() {
  useEffect(() => {
    if (typeof window === 'undefined') return
    if (!('serviceWorker' in navigator)) return

    let updateIntervalId: ReturnType<typeof setInterval> | null = null
    let mounted = true

    const handleSWUpdates = async () => {
      try {
        const registration = await navigator.serviceWorker.getRegistration('/')
        if (!mounted) return

        let reg = registration

        if (!reg) {
          // No registration found — register now as fallback
          reg = await navigator.serviceWorker.register('/sw.js', {
            scope: '/',
            updateViaCache: 'none',
          })
          console.log('[SW] Fallback registered, scope:', reg.scope)
        } else {
          console.log('[SW] Existing registration found, scope:', reg.scope)
        }

        // Listen for SW updates
        reg.addEventListener('updatefound', () => {
          const newWorker = reg!.installing
          if (!newWorker) return

          newWorker.addEventListener('statechange', () => {
            if (newWorker.state === 'activated') {
              console.log('[SW] New service worker activated')
              if (navigator.serviceWorker.controller !== newWorker) {
                newWorker.postMessage({ type: 'SKIP_WAITING' })
              }
            }
          })
        })

        // Handle controller change (new SW took over)
        navigator.serviceWorker.addEventListener('controllerchange', () => {
          console.log('[SW] Controller changed — new SW is active')
        })

        // Check for updates periodically — with cleanup
        updateIntervalId = setInterval(() => {
          reg!.update().catch(() => {})
        }, SW_UPDATE_INTERVAL)

        // ─── Periodic Background Sync Registration ───────────────────────────
        // Register the 'update-data' tag so the SW receives periodicsync events.
        // Only available in Chromium-based browsers with the Periodic Background Sync API.
        try {
          if ('periodicSync' in reg) {
            const periodicSyncReg = (reg as unknown as ServiceWorkerRegistrationWithPeriodicSync).periodicSync
            // Check if already registered to avoid re-registering on every mount
            const tags = await periodicSyncReg.getTags()
            if (!tags.includes(PERIODIC_SYNC_TAG)) {
              await periodicSyncReg.register(PERIODIC_SYNC_TAG, {
                minInterval: PERIODIC_SYNC_MIN_INTERVAL * 60 * 1000, // ms
              })
              console.log('[SW] Periodic Background Sync registered:', PERIODIC_SYNC_TAG)
            } else {
              console.log('[SW] Periodic Background Sync already registered:', PERIODIC_SYNC_TAG)
            }
          }
        } catch (err) {
          // Periodic Background Sync not supported or permission denied — non-critical
          console.log('[SW] Periodic Background Sync not available:', err)
        }

      } catch (error) {
        console.warn('[SW] Update handler failed:', error)
      }
    }

    // Run after page load + 10s delay to avoid blocking Network Idle for PWA audit
    const startUpdates = () => {
      setTimeout(handleSWUpdates, 10000)
    }
    if (document.readyState === 'complete') {
      startUpdates()
    } else {
      window.addEventListener('load', startUpdates)
    }

    // Cleanup on unmount
    return () => {
      mounted = false
      if (updateIntervalId !== null) {
        clearInterval(updateIntervalId)
        updateIntervalId = null
      }
    }
  }, [])

  return null
}
