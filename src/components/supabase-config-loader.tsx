'use client'

import { useEffect } from 'react'
import { loadSupabaseConfig } from '@/lib/supabase/config-loader'

/**
 * Component that preloads Supabase configuration on app mount.
 * This should be placed near the root of the app to ensure config is loaded
 * before any Supabase operations are attempted.
 */
export function SupabaseConfigLoader() {
  useEffect(() => {
    // Load config in the background
    loadSupabaseConfig().catch(error => {
      console.error('[SupabaseConfigLoader] Failed to load config:', error)
    })
  }, [])

  // This component doesn't render anything
  return null
}