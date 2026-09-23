import { createClient, SupabaseClient } from '@supabase/supabase-js'

/**
 * Create a Supabase admin client with SERVICE_ROLE_KEY.
 * This client has full access to bypass RLS policies and perform admin operations.
 * WARNING: Only use this on the server side, never expose to the client.
 *
 * CRITICAL: Returns null if SUPABASE_SERVICE_ROLE_KEY is not available.
 * On Cloudflare Workers, env vars are only available at request time.
 * Callers MUST check for null return value.
 *
 * @returns Supabase client with admin privileges, or null if key not available
 */
export function createAdminClient(): SupabaseClient | null {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!supabaseUrl) {
    // During build time, env vars may not be available — return null
    return null
  }

  if (!supabaseServiceKey) {
    // On CF Workers, the service role key must be set as a secret
    // If missing, all admin operations will fail — return null so callers can detect
    return null
  }

  return createClient(supabaseUrl, supabaseServiceKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    }
  })
}

/**
 * Get the admin Auth API from a Supabase client.
 * Uses `as any` to bypass Turbopack type resolution issues with .auth.admin chain.
 * At runtime, this is fully valid — supabase-js v2 exposes auth.admin on service role clients.
 */
export function getSupabaseAdminAuth(client: ReturnType<typeof createClient>) {
  return (client.auth as any).admin
}
