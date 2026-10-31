'use client'

import { useEffect } from 'react'
import { loadSupabaseConfig } from '@/lib/supabase/config-loader'

/**
 * Component that preloads Supabase configuration on app mount.
 * Fires immediately (deduped by config-loader's shared promise) so auth
 * resolves faster — especially on slow mobile connections.
 * Includes proper cleanup on unmount.
 */
export function SupabaseConfigLoader() {
  useEffect(() => {
    let mounted = true

    // PERF FIX: preload config SEKARANG (tanpa delay 2s).
    // Dulu ditunda 2s demi audit PWA network-idle — padahal config-loader
    // sudah punya dedupe (fetchPromise) & cache memori, jadi request ini
    // tidak pernah dobel dengan auth. Mulai awal = auth & halaman lebih
    // cepat siap; audit PWA tetap aman karena request selesai jauh sebelum
    // window 20s network-idle.
    loadSupabaseConfig().catch(error => {
      if (mounted) {
        console.error('[SupabaseConfigLoader] Failed to load config:', error)
      }
    })

    return () => {
      mounted = false
    }
  }, [])

  return null
}
