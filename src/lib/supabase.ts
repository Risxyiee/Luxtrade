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

/** Helper: base URL detection */
export const getBaseUrl = () => {
  if (typeof window !== 'undefined') return window.location.origin
  return process.env.NEXT_PUBLIC_APP_URL || process.env.NEXT_PUBLIC_SITE_URL || 'https://luxtradee.web.id'
}
