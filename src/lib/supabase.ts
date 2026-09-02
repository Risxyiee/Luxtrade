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
 */
export const supabase: SupabaseClient = createClient(
  readEnv('NEXT_PUBLIC_SUPABASE_URL') || 'https://klxkdrfsfcoankbaoejn.supabase.co',
  readEnv('NEXT_PUBLIC_SUPABASE_ANON_KEY') || '',
  {
    auth: { autoRefreshToken: true, persistSession: true, detectSessionInUrl: true },
    global: { headers: { 'X-Client-Info': 'luxtrade-web' } }
  }
)

let _adminSingleton: SupabaseClient | null = null
export const supabaseAdmin: SupabaseClient | null = (() => {
  if (_adminSingleton) return _adminSingleton
  const url = getSupabaseUrl()
  const key = getSupabaseServiceRoleKey()
  if (!key) return null
  _adminSingleton = createClient(url, key, {
    auth: { autoRefreshToken: false, persistSession: false }
  })
  return _adminSingleton
})()
