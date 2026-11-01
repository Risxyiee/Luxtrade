/**
 * Supabase Server Client Helper for API Routes
 * Compatible with Next.js 16 and App Router
 */

import { NextRequest } from 'next/server'
import { createServerClient, type CookieOptions } from '@supabase/ssr'
import { getSecureCookieOptions } from './cookie-options'

/**
 * Create a Supabase client for API routes
 * Uses NextRequest cookies for authentication
 */
export async function createSupabaseClient(request: NextRequest) {
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      // SECURITY (audit #5): override default library dengan cookie flags aman
      cookieOptions: getSecureCookieOptions(),
      cookies: {
        get(name: string) {
          return request.cookies.get(name)?.value
        },
        set(name: string, value: string, options: CookieOptions) {
          // Not needed for read operations in API routes
        },
        remove(name: string, options: CookieOptions) {
          // Not needed for read operations in API routes
        },
      },
    }
  )

  return supabase
}