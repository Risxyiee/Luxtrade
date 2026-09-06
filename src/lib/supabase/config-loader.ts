'use client'

// ============================================
// Client-side Supabase configuration loader
// ============================================

interface SupabaseConfig {
  url: string
  anonKey: string | null
  isConfigured: boolean
}

let cachedConfig: SupabaseConfig | null = null
let fetchPromise: Promise<SupabaseConfig> | null = null

/**
 * Fetch Supabase configuration from the API endpoint.
 * This allows the config to be set at runtime in Cloudflare Pages.
 */
async function fetchSupabaseConfig(): Promise<SupabaseConfig> {
  try {
    const response = await fetch('/api/supabase/config', {
      cache: 'no-store' // Always fetch fresh config
    })

    if (!response.ok) {
      const errorData = await response.json()
      console.error('[Supabase Config] API error:', errorData.error)
      return {
        url: 'https://klxkdrfsfcoankbaoejn.supabase.co',
        anonKey: null,
        isConfigured: false
      }
    }

    const data = await response.json()
    console.log('[Supabase Config] Loaded from API:', {
      url: data.url,
      hasAnonKey: !!data.anonKey,
      isConfigured: data.isConfigured
    })

    return {
      url: data.url,
      anonKey: data.anonKey,
      isConfigured: data.isConfigured
    }
  } catch (error) {
    console.error('[Supabase Config] Failed to fetch config:', error)
    return {
      url: 'https://klxkdrfsfcoankbaoejn.supabase.co',
      anonKey: null,
      isConfigured: false
    }
  }
}

/**
 * Load Supabase configuration from multiple sources:
 * 1. Build-time env vars (process.env.NEXT_PUBLIC_*) - fallback
 * 2. API endpoint - primary source for Cloudflare Pages
 */
export async function loadSupabaseConfig(): Promise<SupabaseConfig> {
  // Return cached config if available
  if (cachedConfig && cachedConfig.isConfigured) {
    return cachedConfig
  }

  // If there's an ongoing fetch, return that promise
  if (fetchPromise) {
    return await fetchPromise
  }

  // Start fetching config from API
  fetchPromise = fetchSupabaseConfig()

  const config = await fetchPromise
  fetchPromise = null

  // Cache the config
  cachedConfig = config
  return config
}

/**
 * Get Supabase config synchronously from cache.
 * Returns null if config hasn't been loaded yet.
 */
export function getSupabaseConfigSync(): SupabaseConfig | null {
  return cachedConfig
}

/**
 * Clear cached config (useful for testing or re-initializing)
 */
export function clearSupabaseConfigCache(): void {
  cachedConfig = null
  fetchPromise = null
}