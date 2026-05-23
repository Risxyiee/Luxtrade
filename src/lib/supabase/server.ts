import { createServerClient, type CookieOptions } from '@supabase/ssr'
import { cookies } from 'next/headers'

/**
 * Create a Supabase client for server-side use (Server Components and Route Handlers)
 * This function should be used in:
 * - Server Components (async components)
 * - Route Handlers (app/api/*/route.ts)
 * - Server Actions
 *
 * @returns Supabase client configured for server-side use
 */
export function createClient() {
  const cookieStore = cookies()

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
            cookieStore.set({
              name,
              value,
              ...options,
            })
          } catch (error) {
            // The `set` method was called from a Server Component.
            // This can be ignored if you have middleware refreshing user sessions.
          }
        },
        remove(name: string, options: CookieOptions) {
          try {
            cookieStore.set({
              name,
              value: '',
              ...options,
            })
          } catch (error) {
            // The `delete` method was called from a Server Component.
            // This can be ignored if you have be middleware refreshing user sessions.
          }
        },
      },
    }
  )
}
