import { createClient, SupabaseClient } from '@supabase/supabase-js'
import { createBrowserClient } from '@supabase/ssr'
import { getSupabaseAdminAuth } from '@/lib/supabase/admin'

function readEnv(name: string): string | undefined {
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

/** Browser-only client (call only from client code) */
export function getClientBrowser(): SupabaseClient | null {
  if (typeof window === 'undefined') {
    console.warn('[Supabase getClientBrowser] Called on server side. Returning null.')
    return null
  }

  // Import the config loader dynamically to avoid SSR issues
  try {
    const { getSupabaseConfig } = require('./config-loader')
    const config = getSupabaseConfig()

    if (!config.anonKey) {
      console.error('[Supabase getClientBrowser] NEXT_PUBLIC_SUPABASE_ANON_KEY is not set. Client operations will fail.')
      console.error('[Supabase] Please check Cloudflare Pages environment variables.')
      return null
    }

    console.log(`[Supabase] Creating browser client with URL: ${config.url}`)
    return createBrowserClient(config.url, config.anonKey) as any
  } catch (error) {
    console.error('[Supabase getClientBrowser] Error loading config:', error)
    return null
  }
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