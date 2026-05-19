import { createClient, SupabaseClient } from '@supabase/supabase-js'

// Alternative approach: Try multiple methods to get admin access

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://klxkdrfsfcoankbaoejn.supabase.co'

// Method 1: Use SERVICE_ROLE_KEY (standard approach)
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY

// Method 2: Try using anon key with admin operations (less secure but might work)
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''

// Method 3: Check for alternative env var names
const altServiceRoleKey = process.env.SERVICE_ROLE_KEY || process.env.SUPABASE_ADMIN_KEY

function getAdminClient(): SupabaseClient | null {
  // Try service role key first
  if (serviceRoleKey && serviceRoleKey.trim() !== '' && serviceRoleKey !== 'undefined') {
    console.log('✅ [SUPABASE ADMIN] Using SUPABASE_SERVICE_ROLE_KEY')
    return createClient(supabaseUrl, serviceRoleKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false
      }
    })
  }

  // Try alternative key names
  if (altServiceRoleKey && altServiceRoleKey.trim() !== '' && altServiceRoleKey !== 'undefined') {
    console.log('✅ [SUPABASE ADMIN] Using alternative service role key')
    return createClient(supabaseUrl, altServiceRoleKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false
      }
    })
  }

  // Fallback: Try with anon key (not recommended but might work for some operations)
  if (anonKey && anonKey.trim() !== '' && anonKey !== 'undefined') {
    console.warn('⚠️ [SUPABASE ADMIN] Falling back to anon key - admin operations may be limited')
    return createClient(supabaseUrl, anonKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false
      }
    })
  }

  console.error('❌ [SUPABASE ADMIN] No valid admin key found')
  return null
}

// Export the admin client
export const supabaseAdmin = getAdminClient()

// Export helper to check if admin is available
export function isAdminAvailable(): boolean {
  return supabaseAdmin !== null
}

// Export helper to get admin status
export function getAdminStatus() {
  return {
    serviceRoleKeySet: !!(serviceRoleKey && serviceRoleKey !== 'undefined' && serviceRoleKey.trim() !== ''),
    altKeySet: !!(altServiceRoleKey && altServiceRoleKey !== 'undefined' && altServiceRoleKey.trim() !== ''),
    anonKeySet: !!(anonKey && anonKey !== 'undefined' && anonKey.trim() !== ''),
    adminAvailable: isAdminAvailable()
  }
}
