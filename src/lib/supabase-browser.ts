import { createClient, SupabaseClient } from '@supabase/supabase-js'
import { createBrowserClient } from '@supabase/ssr'

function readEnv(name: string): string | undefined {
  const v = process.env[name]
  if (!v || v === 'undefined') return undefined
  return v.trim()
}

export function getSupabaseUrl(): string {
  return readEnv('NEXT_PUBLIC_SUPABASE_URL') || 'https://klxkdrfsfcoankbaoejn.supabase.co'
}

export function getSupabaseAnonKey(): string | undefined {
  return readEnv('NEXT_PUBLIC_SUPABASE_ANON_KEY')
}

// Browser client singleton with async initialization
let browserClient: SupabaseClient | null = null
let browserClientPromise: Promise<SupabaseClient | null> | null = null

/** Browser-only client (call only from client code) - async version */
export async function getClientBrowserAsync(): Promise<SupabaseClient | null> {
  if (typeof window === 'undefined') {
    console.warn('[Supabase] getClientBrowserAsync called on server side.')
    return null
  }

  // Return cached client if available
  if (browserClient) {
    return browserClient
  }

  // Return ongoing initialization if exists
  if (browserClientPromise) {
    return browserClientPromise
  }

  // Start initialization
  browserClientPromise = (async () => {
    try {
      const { loadSupabaseConfig } = await import('./supabase/config-loader')
      const config = await loadSupabaseConfig()

      if (!config.anonKey) {
        console.error('[Supabase] NEXT_PUBLIC_SUPABASE_ANON_KEY not available. Client operations will fail.')
        return null
      }

      console.log(`[Supabase] Creating browser client with URL: ${config.url}`)
      browserClient = createBrowserClient(config.url, config.anonKey) as any
      return browserClient
    } catch (error) {
      console.error('[Supabase] Error initializing browser client:', error)
      browserClientPromise = null // Allow retry
      return null
    }
  })()

  return browserClientPromise
}

/** Browser-only client (call only from client code) - synchronous fallback */
/** NOTE: This may return null on first call. Use getClientBrowserAsync() for reliable initialization. */
export function getClientBrowser(): SupabaseClient | null {
  if (typeof window === 'undefined') {
    console.warn('[Supabase getClientBrowser] Called on server side. Returning null.')
    return null
  }

  // Return cached client if available
  if (browserClient) {
    return browserClient
  }

  // Try to get config synchronously from cache
  const { getSupabaseConfigSync } = require('./supabase/config-loader')
  const config = getSupabaseConfigSync()

  if (config && config.anonKey) {
    console.log(`[Supabase] Creating browser client (sync) with URL: ${config.url}`)
    browserClient = createBrowserClient(config.url, config.anonKey) as any
    return browserClient
  }

  // Config not loaded yet - trigger async load and return null
  getClientBrowserAsync().catch(err => {
    console.error('[Supabase] Async client initialization failed:', err)
  })

  console.warn('[Supabase] getClientBrowser called before config loaded. Use getClientBrowserAsync() or wait for initialization.')
  return null
}

/**
 * Format a number as USD currency string
 */
export function formatCurrency(value: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(value)
}

/**
 * Helper: base URL detection
 */
export const getBaseUrl = () => {
  if (typeof window !== 'undefined') return window.location.origin
  return process.env.NEXT_PUBLIC_APP_URL || process.env.NEXT_PUBLIC_SITE_URL || 'https://luxtradee.web.id'
}