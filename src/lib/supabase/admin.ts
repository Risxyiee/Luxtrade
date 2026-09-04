import { createClient } from '@supabase/supabase-js'

/**
 * Create a Supabase admin client with SERVICE_ROLE_KEY
 * This client has full access to bypass RLS policies and perform admin operations
 * WARNING: Only use this on the server side, never expose to the client
 *
 * @returns Supabase client with admin privileges
 */
export function createAdminClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!supabaseUrl) {
    console.warn('[Supabase Admin] NEXT_PUBLIC_SUPABASE_URL not defined. Will be available at runtime.')
    // Return placeholder for build
    return createClient('https://klxkdrfsfcoankbaoejn.supabase.co', 'placeholder-key-for-build', {
      auth: {
        autoRefreshToken: false,
        persistSession: false
      }
    })
  }

  if (!supabaseServiceKey) {
    console.warn('[Supabase Admin] SUPABASE_SERVICE_ROLE_KEY not defined. Will be available at runtime.')
    // Return placeholder for build
    return createClient(supabaseUrl, 'placeholder-key-for-build', {
      auth: {
        autoRefreshToken: false,
        persistSession: false
      }
    })
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