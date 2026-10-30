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
let _cachedAt = 0

// TTL cache 60 detik (2026-10-30): dulu cache PERMANEN selama isolate hidup —
// kalau Bos salah paste key lalu memperbaikinya di CF dashboard, isolate lama
// terus pakai client dengan key LAMA sampai restart (bisa berjam-jam). Dengan
// TTL, perbaikan secret di CF efektif <= 60 detik tanpa deploy ulang.
const ADMIN_CACHE_TTL_MS = 60_000

function cacheFresh(): boolean {
  return _initSucceeded && !!_adminClient && Date.now() - _cachedAt < ADMIN_CACHE_TTL_MS
}

/**
 * Get the Supabase admin client (lazy-initialized).
 * Uses the synchronous createAdminClient() for backwards compatibility.
 * Retries on every call until success — caches only the successful client.
 *
 * @returns Supabase admin client, or null if SUPABASE_SERVICE_ROLE_KEY is not configured
 */
export function getSupabaseAdmin() {
  // Return cached client if we previously succeeded (max 60s — lihat TTL di atas)
  if (cacheFresh()) return _adminClient

  // Try to create — env vars may now be available at request time
  const client = createAdminClient()

  if (client) {
    // Success! Cache it
    _adminClient = client
    _initSucceeded = true
    _cachedAt = Date.now()
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
  // Return cached client if we previously succeeded (max 60s — lihat TTL di atas)
  if (cacheFresh()) return _adminClient

  // Try sync first (fast path)
  const syncClient = createAdminClient()
  if (syncClient) {
    _adminClient = syncClient
    _initSucceeded = true
    _cachedAt = Date.now()
    return _adminClient
  }

  // Try async (checks CF ctx.env)
  const asyncClient = await createAdminClientAsync()
  if (asyncClient) {
    _adminClient = asyncClient
    _initSucceeded = true
    _cachedAt = Date.now()
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
