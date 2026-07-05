import { createAdminClient, getSupabaseAdminAuth } from '@/lib/supabase/admin'

/**
 * Supabase Admin client instance (lazy loaded)
 * Uses SERVICE_ROLE_KEY to bypass RLS
 */
let _adminClient: ReturnType<typeof createAdminClient> | null = null

export function getSupabaseAdmin() {
  if (!_adminClient) {
    try {
      _adminClient = createAdminClient()
    } catch (error: any) {
      console.error('❌ [Supabase Admin] Failed to create admin client:', error.message)
      return null
    }
  }
  return _adminClient
}

/** Singleton admin client */
export const supabaseAdmin = getSupabaseAdmin()

/** Check if admin client is available */
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
 * Get the admin Auth API for the singleton admin client.
 * Returns null if admin client is not available.
 */
export function getAdminAuth() {
  const client = getSupabaseAdmin()
  if (!client) return null
  return getSupabaseAdminAuth(client)
}
