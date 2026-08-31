/**
 * Lazy-initialized Supabase Admin client for Cloudflare Workers.
 * 
 * CRITICAL: On CF Workers, process.env is only available at request time.
 * Module-level singletons like `export const x = ...` run at load time
 * when env vars may not be available yet. We use lazy init instead.
 */
import { createAdminClient, getSupabaseAdminAuth } from '@/lib/supabase/admin'

let _adminClient: ReturnType<typeof createAdminClient> | null = null
let _adminInitAttempted = false
let _adminInitFailed = false

/**
 * Get the Supabase admin client (lazy-initialized).
 * Safe to call multiple times — only creates client once per isolate.
 */
export function getSupabaseAdmin() {
  // Return cached client if available
  if (_adminClient) return _adminClient

  // Don't retry if we already failed (env vars don't change per isolate)
  if (_adminInitFailed) return null

  _adminInitAttempted = true
  try {
    _adminClient = createAdminClient()
    return _adminClient
  } catch (error: any) {
    console.error('❌ [Supabase Admin] Failed to create admin client:', error.message)
    _adminInitFailed = true
    return null
  }
}

/** DEPRECATED: Use getSupabaseAdmin() function instead. */
export function getAdminStatus() {
  const admin = getSupabaseAdmin()
  return {
    available: !!admin,
    error: admin ? null : 'SUPABASE_SERVICE_ROLE_KEY not configured'
  }
}

/** Check if admin is available (boolean) */
export function isAdminAvailable(): boolean {
  return !!getSupabaseAdmin()
}

/**
 * Get the admin Auth API for the admin client.
 * Returns null if admin client is not available.
 */
export function getAdminAuth() {
  const client = getSupabaseAdmin()
  if (!client) return null
  return getSupabaseAdminAuth(client)
}
