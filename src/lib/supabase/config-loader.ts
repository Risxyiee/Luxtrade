'use client'

// ============================================
// Client-side Supabase configuration loader
// ============================================

interface SupabaseConfig {
  url: string
  anonKey: string | null
  isConfigured: boolean
}

// Fallback key hardcoded for production
const FALLBACK_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtseGtkcmZzZmNvYW5rYmFvZWpuIiwicm9sZSI6ImFub24iLCJpYXQiOjE3MzAwNTQwMjksImV4cCI6MjA0NTYzMDAyOX0.DkCkO4z3D9Yk_2VZQ_M4pC0eJ8xwJ-5D8x_7kK9F4w8'

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
      console.warn('[Supabase Config] API not available, using fallback')
      return {
        url: 'https://klxkdrfsfcoankbaoejn.supabase.co',
        anonKey: FALLBACK_ANON_KEY,
        isConfigured: true
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
    console.warn('[Supabase Config] Failed to fetch, using fallback:', error)
    return {
      url: 'https://klxkdrfsfcoankbaoejn.supabase.co',
      anonKey: FALLBACK_ANON_KEY,
      isConfigured: true
    }
  }
}

/**
 * Load Supabase configuration from multiple sources:
 * 1. API endpoint - primary source
 * 2. Fallback hardcoded key - when API fails
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