/**
 * KV Cache Utility — Shared cache across Cloudflare Worker isolates
 *
 * Use this instead of in-memory variables for data that needs to be
 * consistent across all isolates: Supabase config, analytics, forex rates, etc.
 */

import { getCloudflareEnv, type CloudflareBindings } from './cloudflare-bindings'

export interface KVCacheOptions {
  /** TTL in seconds (default: 300 = 5 minutes) */
  ttl?: number
  /** KV namespace binding key (default: 'luxtradee_kv') */
  binding?: string
}

/**
 * Get a value from KV cache.
 * Returns null if not found or expired.
 */
export async function kvGet<T>(key: string): Promise<T | null> {
  const env = await getCloudflareEnv()
  const kv = env.luxtradee_kv

  if (!kv) return null

  try {
    const raw = await kv.get(key, 'text')
    if (!raw) return null
    return JSON.parse(raw) as T
  } catch {
    return null
  }
}

/**
 * Set a value in KV cache with optional TTL.
 */
export async function kvSet(
  key: string,
  value: any,
  options: KVCacheOptions = {}
): Promise<boolean> {
  const env = await getCloudflareEnv()
  const kv = env.luxtradee_kv

  if (!kv) return false

  try {
    const ttl = options.ttl ?? 300
    await kv.put(key, JSON.stringify(value), { expirationTtl: ttl })
    return true
  } catch {
    return false
  }
}

/**
 * Delete a key from KV cache.
 */
export async function kvDelete(key: string): Promise<boolean> {
  const env = await getCloudflareEnv()
  const kv = env.luxtradee_kv

  if (!kv) return false

  try {
    await kv.delete(key)
    return true
  } catch {
    return false
  }
}

/**
 * Get-or-set pattern: return cached value if exists, otherwise compute, cache, and return.
 * Perfect for API responses that are expensive to compute.
 */
export async function kvGetOrSet<T>(
  key: string,
  compute: () => Promise<T>,
  options: KVCacheOptions = {}
): Promise<T> {
  const cached = await kvGet<T>(key)
  if (cached !== null) return cached

  const value = await compute()
  await kvSet(key, value, options)
  return value
}

/**
 * List keys in KV namespace with optional prefix filter.
 */
export async function kvList(
  prefix?: string,
  limit: number = 100
): Promise<string[]> {
  const env = await getCloudflareEnv()
  const kv = env.luxtradee_kv

  if (!kv) return []

  try {
    const result = await kv.list({ prefix, limit })
    return result.keys.map((k) => k.name)
  } catch {
    return []
  }
}
