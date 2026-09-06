import { createClient, SupabaseClient } from '@supabase/supabase-js'
import { createBrowserClient } from '@supabase/ssr'
import { getSupabaseAdminAuth } from '@/lib/supabase/admin'

function readEnv(name: string): string | undefined {
  // For NEXT_PUBLIC_SUPABASE_ANON_KEY, always use SUPABASE_ANON_KEY
  if (name === 'NEXT_PUBLIC_SUPABASE_ANON_KEY') {
    const v = process.env.SUPABASE_ANON_KEY
    if (v && v !== 'undefined') {
      // Debug: Log env var value (without showing full key)
      if (process.env.NODE_ENV === 'production') {
        console.log(`[Supabase] ${name}: ${v.substring(0, 10)}... (length: ${v.length})`)
      }
      return v.trim()
    }
    return undefined
  }

  const v = process.env[name]
  if (!v || v === 'undefined') return undefined

  // Debug: Log env var value (without showing full key)
  if (name.includes('KEY') && process.env.NODE_ENV === 'production') {
    console.log(`[Supabase] ${name}: ${v.substring(0, 10)}... (length: ${v.length})`)
  }

  return v.trim() // Remove any whitespace
}

export function getSupabaseUrl(): string {
  return readEnv('NEXT_PUBLIC_SUPABASE_URL') || 'https://klxkdrfsfcoankbaoejn.supabase.co'
}
export function getSupabaseAnonKey(): string | undefined {
  return readEnv('NEXT_PUBLIC_SUPABASE_ANON_KEY')
}
export function getSupabaseServiceRoleKey(): string | undefined {
  return readEnv('SUPABASE_SERVICE_ROLE_KEY')
}

// ============================================
// Browser client singleton with async initialization
// ============================================
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

/** Server-side non-admin client (safe to call at request time) */
export function getServerClient(): SupabaseClient | null {
  const url = getSupabaseUrl()
  const anon = getSupabaseAnonKey()
  if (!anon) return null
  return createClient(url, anon, {
    auth: { autoRefreshToken: true, persistSession: true, detectSessionInUrl: true },
    global: { headers: { 'X-Client-Info': 'luxtrade-web' } }
  })
}

/** Admin client (service role); returns null if service key missing */
export function getSupabaseAdmin(): SupabaseClient | null {
  const url = getSupabaseUrl()
  const key = getSupabaseServiceRoleKey()
  if (!key) return null
  return createClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } })
}

/** Admin auth helper */
export function getSupabaseAdminAuthFromClient(client?: SupabaseClient) {
  const c = client || getSupabaseAdmin()
  if (!c) return null
  return getSupabaseAdminAuth(c as any)
}

/** Format a number as USD currency string */
export function formatCurrency(value: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(value)
}

/** Helper: base URL detection */
export const getBaseUrl = () => {
  if (typeof window !== 'undefined') return window.location.origin
  return process.env.NEXT_PUBLIC_APP_URL || process.env.NEXT_PUBLIC_SITE_URL || 'https://luxtradee.web.id'
}

/**
 * Convenience exports for backward compatibility.
 * - `supabase`  → anon client using createClient (works in both server & browser)
 * - `supabaseAdmin` → admin client singleton (for server API routes)
 *
 * Note: `createBrowserClient` from @supabase/ssr is intentionally NOT used here
 * because this module is also imported by server-side API routes.
 * Client components that need SSR cookie handling should use `getClientBrowser()`.
 *
 * IMPORTANT: In production environments like Cloudflare Workers, env vars may not be
 * available at module load time. We use a Proxy pattern to access env vars at runtime.
 */
let _cachedClient: SupabaseClient | null = null

export const supabase: SupabaseClient = new Proxy({} as any, {
  get(_target, prop) {
    // Initialize client on first access (runtime)
    if (!_cachedClient) {
      const url = readEnv('NEXT_PUBLIC_SUPABASE_URL') || 'https://klxkdrfsfcoankbaoejn.supabase.co'
      const anon = readEnv('NEXT_PUBLIC_SUPABASE_ANON_KEY')

      // Check if this is a build-time or missing env situation
      const isProduction = process.env.NODE_ENV === 'production'

      console.log(`[Supabase] Initializing client - URL: ${url}, Env: ${process.env.NODE_ENV}, Anon Key: ${anon ? anon.substring(0, 10) + '...' : 'MISSING'}`)

      if (!anon) {
        const errorMsg = isProduction
          ? 'CRITICAL: NEXT_PUBLIC_SUPABASE_ANON_KEY is required in production. Please set this environment variable in Cloudflare Pages settings.'
          : '⚠️ NEXT_PUBLIC_SUPABASE_ANON_KEY not set. Supabase features will not work in development.'

        console.error(errorMsg)

        if (isProduction) {
          throw new Error(errorMsg)
        }

        // In development, create a mock client that won't crash
        _cachedClient = createClient(url, 'dev-placeholder-key', {
          auth: { autoRefreshToken: false, persistSession: false, detectSessionInUrl: false },
          global: { headers: { 'X-Client-Info': 'luxtrade-web-dev' } }
        })
      } else {
        // Valid key provided, create real client
        console.log(`[Supabase] Creating client with valid key (length: ${anon.length})`)
        _cachedClient = createClient(url, anon, {
          auth: { autoRefreshToken: true, persistSession: true, detectSessionInUrl: true },
          global: { headers: { 'X-Client-Info': 'luxtrade-web' } }
        })
      }
    }

    return _cachedClient[prop]
  },
  has(_target, prop) {
    return prop in SupabaseClient.prototype || prop === 'then'
  }
})

let _adminSingleton: SupabaseClient | null = null

/**
 * Lazy-initialized admin client singleton.
 * Retries on every call until success — safe for Cloudflare Workers where env vars
 * may not be available at module load time.
 */
export function getSupabaseAdminSingleton(): SupabaseClient | null {
  if (_adminSingleton) return _adminSingleton

  const url = getSupabaseUrl()
  const key = getSupabaseServiceRoleKey()
  if (!key) return null

  _adminSingleton = createClient(url, key, {
    auth: { autoRefreshToken: false, persistSession: false }
  })
  return _adminSingleton
}

/**
 * Legacy export for backward compatibility.
 * Returns null if admin client cannot be created (e.g., missing env vars).
 * Note: In Cloudflare Workers, may return null on first module load before env vars are available.
 * Use getSupabaseAdminSingleton() for reliable runtime access.
 */
export const supabaseAdmin: SupabaseClient | null = getSupabaseAdminSingleton()