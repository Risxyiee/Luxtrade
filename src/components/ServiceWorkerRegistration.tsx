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
 */

const SW_UPDATE_INTERVAL = 30 * 60 * 1000 // 30 minutes

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

        if (!registration) {
          // No registration found — register now as fallback
          const reg = await navigator.serviceWorker.register('/sw.js', {
            scope: '/',
            updateViaCache: 'none',
          })
          console.log('[SW] Fallback registered, scope:', reg.scope)
          return
        }

        console.log('[SW] Existing registration found, scope:', registration.scope)

        // Listen for SW updates
        registration.addEventListener('updatefound', () => {
          const newWorker = registration.installing
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
          registration.update().catch(() => {})
        }, SW_UPDATE_INTERVAL)

      } catch (error) {
        console.warn('[SW] Update handler failed:', error)
      }
    }

    // Run after page load to avoid blocking rendering
    if (document.readyState === 'complete') {
      handleSWUpdates()
    } else {
      window.addEventListener('load', handleSWUpdates)
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
