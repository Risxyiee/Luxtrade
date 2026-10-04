/**
 * Lazy-initialized Supabase Admin client for Cloudflare Workers.
 *
 * CRITICAL FIX: On CF Workers, process.env is only available at request time.
 * - We now use createAdminClientAsync() which checks both process.env AND CF ctx.env
 * - We NEVER cache a null result — always retry on next call.
 * - We ONLY cache a successful (non-null) client.
 */
import { createAdminClient, createAdminClientAsync, getSupabaseAdminAuth } from '@/lib/supabase/admin'

let _adminClient: ReturnType<typeof createAdminClient> | null = null
let _initSucceeded = false

/**
 * Get the Supabase admin client (lazy-initialized).
 * Uses the synchronous createAdminClient() for backwards compatibility.
 * Retries on every call until success — caches only the successful client.
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

/**
 * Get the Supabase admin client asynchronously.
 * This is the PREFERRED way in API route handlers on CF Workers.
 * Checks both process.env AND CF ctx.env for the service role key.
 *
 * @returns Supabase admin client, or null if SUPABASE_SERVICE_ROLE_KEY is not configured
 */
export async function getSupabaseAdminAsync() {
  // Return cached client if we previously succeeded
  if (_initSucceeded && _adminClient) return _adminClient

  // Try sync first (fast path)
  const syncClient = createAdminClient()
  if (syncClient) {
    _adminClient = syncClient
    _initSucceeded = true
    return _adminClient
  }

  // Try async (checks CF ctx.env)
  const asyncClient = await createAdminClientAsync()
  if (asyncClient) {
    _adminClient = asyncClient
    _initSucceeded = true
    console.log('[supabase-admin-alt] Admin client initialized via CF ctx.env fallback')
    return _adminClient
  }

  // Don't cache failure
  console.warn('[supabase-admin-alt] SUPABASE_SERVICE_ROLE_KEY not available from any source')
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
