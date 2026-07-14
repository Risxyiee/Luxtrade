'use client'

import { createBrowserClient } from '@supabase/ssr'

/**
 * Create a Supabase client for client-side use
 * This function should be used in Client Components
 *
 * @returns Supabase client configured for client-side use
 */
export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )
}
