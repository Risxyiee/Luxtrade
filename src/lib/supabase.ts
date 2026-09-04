import { createClient, SupabaseClient } from '@supabase/supabase-js'
import { createBrowserClient } from '@supabase/ssr'
import { getSupabaseAdminAuth } from '@/lib/supabase/admin'

function readEnv(name: string): string | undefined {
  const v = process.env[name]
  if (!v || v === 'undefined') return undefined
  return v
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
  const url = getSupabaseUrl()
  const anon = getSupabaseAnonKey()
  if (!anon) return null
  if (typeof window === 'undefined') return null
  return createBrowserClient(url, anon) as any
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

      if (!anon) {
        throw new Error('NEXT_PUBLIC_SUPABASE_ANON_KEY is required')
      }

      _cachedClient = createClient(url, anon, {
        auth: { autoRefreshToken: true, persistSession: true, detectSessionInUrl: true },
        global: { headers: { 'X-Client-Info': 'luxtrade-web' } }
      })
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