import { createServerClient, type CookieOptions } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { NextRequest, NextResponse } from 'next/server'

/**
 * Create a Supabase client for server-side use
 * This function should be used in Server Components
 *
 * @returns Supabase client configured for server-side use
 */
export async function createClient() {
  const cookieStore = await cookies()

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get(name: string) {
          return cookieStore.get(name)?.value
        },
        set(name: string, value: string, options: CookieOptions) {
          try {
            // In Server Components we cannot reliably mutate the incoming request's cookie store.
            // Use the cookie store provided by next/headers which writes cookies for the current response.
            cookieStore.set({ name, value, ...options })
          } catch (error) {
            // Ignore - handled by middleware or calling code
          }
        },
        remove(name: string, options: CookieOptions) {
          try {
            cookieStore.set({ name, value: '', ...options })
          } catch (error) {
            // Ignore - handled by middleware or calling code
          }
        },
      },
    }
  )
}

/**
 * Create a Supabase client for API routes
 * This function should be used in Route Handlers
 * Returns both client and response to ensure cookies are set
 *
 * IMPORTANT FIX:
 * - Do NOT attempt to mutate `request.cookies` (read-only in Next.js/Edge runtimes)
 * - Only set cookies on the generated `response.cookies`
 *
 * @param request - NextRequest object
 * @returns Object with supabase client and response
 */
export function createClientForApi(request: NextRequest) {
  // Create a fresh response that we can set cookies on.
  let response = NextResponse.next({ request: { headers: request.headers } })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get(name: string) {
          return request.cookies.get(name)?.value
        },
        async set(name: string, value: string, options: CookieOptions) {
          // DO NOT modify request.cookies (it's read-only in many runtimes)
          // Instead, set cookie on the response which will be returned by the API handler.
          try {
            response.cookies.set({ name, value, ...options })
          } catch (error) {
            console.warn('[createClientForApi] Failed to set cookie on response:', error)
          }
        },
        async remove(name: string, options: CookieOptions) {
          try {
            response.cookies.set({ name, value: '', ...options })
          } catch (error) {
            console.warn('[createClientForApi] Failed to remove cookie on response:', error)
          }
        },
      },
    }
  )

  return { supabase, response }
}
