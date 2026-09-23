/**
 * Lazy-initialized Supabase Admin client for Cloudflare Workers.
 *
 * CRITICAL FIX: On CF Workers, process.env is only available at request time.
 * - createAdminClient() returns null if SUPABASE_SERVICE_ROLE_KEY is not yet available.
 * - We NEVER cache a null result — always retry on next call.
 * - We ONLY cache a successful (non-null) client.
 */
import { createAdminClient, getSupabaseAdminAuth } from '@/lib/supabase/admin'

let _adminClient: ReturnType<typeof createAdminClient> | null = null
let _initSucceeded = false

/**
 * Get the Supabase admin client (lazy-initialized).
 * Retries on every call until success — caches only the successful client.
 * This is safe because env vars become available at request time on CF Workers.
 *
 * @returns Supabase admin client, or null if SUPABASE_SERVICE_ROLE_KEY is not configured
 */
export function getSupabaseAdmin() {
  // Return cached client if we previously succeeded
  if (_initSucceeded && _adminClient) return _adminClient

  // Try to create — env vars may now be available at request time
  const client = createAdminClient()

  if (client) {
    // Success! Cache it
    _adminClient = client
    _initSucceeded = true
    return _adminClient
  }

  // Don't cache failure — env vars might arrive on the next request
  return null
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
  return getSupabaseAdminAuth(client as any)
}
