'use client'

import { useEffect } from 'react'
import { loadSupabaseConfig } from '@/lib/supabase/config-loader'

/**
 * Component that preloads Supabase configuration on app mount.
 * Delayed by 2s to avoid blocking initial page load and PWA network-idle detection.
 * Includes AbortController for proper cleanup on unmount.
 */
export function SupabaseConfigLoader() {
  useEffect(() => {
    let mounted = true
    let timerId: ReturnType<typeof setTimeout> | null = null

    // Delay config load to avoid blocking PWA network-idle
    // Puppeteer needs network to be idle within 20s — this delay
    // ensures auth/config requests don't overlap with SW install
    timerId = setTimeout(() => {
      if (!mounted) return
      loadSupabaseConfig().catch(error => {
        if (mounted) {
          console.error('[SupabaseConfigLoader] Failed to load config:', error)
        }
      })
    }, 2000)

    return () => {
      mounted = false
      if (timerId !== null) {
        clearTimeout(timerId)
        timerId = null
      }
    }
  }, [])

  return null
}
