/**
 * Lazy-initialized Supabase Admin client for Cloudflare Workers.
 * 
 * CRITICAL FIX: On CF Workers, process.env is only available at request time.
 * The previous implementation cached `_adminInitFailed = true` which meant
 * if the first call happened before env vars were available, ALL subsequent
 * calls returned null forever (for the entire isolate lifetime).
 * 
 * Fixed: Now retries on every call until success, caching only the SUCCESS.
 */
import { createAdminClient, getSupabaseAdminAuth } from '@/lib/supabase/admin'

let _adminClient: ReturnType<typeof createAdminClient> | null = null

/**
 * Get the Supabase admin client (lazy-initialized).
 * Retries on every call until success — caches only the successful client.
 * This is safe because env vars become available at request time on CF Workers.
 */
export function getSupabaseAdmin() {
  // Return cached client if available
  if (_adminClient) return _adminClient

  // Always try to create — env vars may now be available
  try {
    _adminClient = createAdminClient()
    return _adminClient
  } catch (error: any) {
    // Don't cache failure — try again on next request
    console.error('❌ [Supabase Admin] Failed to create admin client:', error.message)
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
