'use client'

// ============================================
// Client-side Supabase configuration loader
// ============================================

/**
 * Load Supabase configuration from multiple sources:
 * 1. Build-time env vars (process.env.NEXT_PUBLIC_*)
 * 2. Runtime config from __NEXT_DATA__
 * 3. Fallback to defaults
 */
export function loadSupabaseConfig(): {
  url: string
  anonKey: string | null
  isConfigured: boolean
} {
  // Default URL
  const defaultUrl = 'https://klxkdrfsfcoankbaoejn.supabase.co'

  // Try to get from build-time env vars (Next.js standard)
  let url = typeof process !== 'undefined' && process.env?.NEXT_PUBLIC_SUPABASE_URL
    ? process.env.NEXT_PUBLIC_SUPABASE_URL
    : defaultUrl

  let anonKey = null

  // Try build-time env vars
  if (typeof process !== 'undefined' && process.env?.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
    anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  }

  // In Cloudflare Pages, try to get from window object
  if (typeof window !== 'undefined') {
    // Try to get from a global config object (we'll inject this via next.config)
    const globalConfig = (window as any).__NEXT_PUBLIC_SUPABASE_CONFIG__
    if (globalConfig) {
      url = globalConfig.url || url
      anonKey = globalConfig.anonKey || anonKey
    }

    // Debug logging in browser console
    console.log('[Supabase Config] URL:', url)
    console.log('[Supabase Config] Anon Key:', anonKey ? `${anonKey.substring(0, 10)}...` : 'MISSING')
    console.log('[Supabase Config] Environment:', process.env?.NODE_ENV || 'unknown')
  }

  return {
    url,
    anonKey,
    isConfigured: !!anonKey
  }
}

// Export singleton config
let cachedConfig: ReturnType<typeof loadSupabaseConfig> | null = null

export function getSupabaseConfig() {
  if (!cachedConfig) {
    cachedConfig = loadSupabaseConfig()
  }
  return cachedConfig
}