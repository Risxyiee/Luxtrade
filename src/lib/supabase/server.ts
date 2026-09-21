import { createServerClient, type CookieOptions } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { NextRequest, NextResponse } from 'next/server'

function readEnv(name: string): string | undefined {
  const v = process.env[name]
  if (!v || v === 'undefined') return undefined
  return v
}

function getSupabaseUrl(): string {
  return readEnv('NEXT_PUBLIC_SUPABASE_URL') || 'https://klxkdrfsfcoankbaoejn.supabase.co'
}

function getSupabaseAnonKey(): string | undefined {
  return readEnv('NEXT_PUBLIC_SUPABASE_ANON_KEY')
}

/**
 * Create a Supabase client for server-side use
 * This function should be used in Server Components
 *
 * @returns Supabase client configured for server-side use
 */
export async function createClient() {
  const url = getSupabaseUrl()
  const key = getSupabaseAnonKey()

  // Check if env vars are available
  if (!key) {
    console.error('⚠️ NEXT_PUBLIC_SUPABASE_ANON_KEY not set. Supabase features will not work until this is configured.')
    console.error('Available SUPABASE env keys:', Object.keys(process.env).filter(k => k.includes('SUPABASE')))

    // Return a placeholder client so the app doesn't crash
    // API routes will get auth errors gracefully instead of throwing
    const cookieStore = await cookies()
    return createServerClient(url, 'placeholder-key-not-configured', {
      cookies: {
        get(name: string) {
          return cookieStore.get(name)?.value
        },
        set(name: string, value: string, options: CookieOptions) {
          try {
            cookieStore.set({ name, value, ...options })
          } catch (error) {}
        },
        remove(name: string, options: CookieOptions) {
          try {
            cookieStore.set({ name, value: '', ...options })
          } catch (error) {}
        },
      },
    })
  }

  const cookieStore = await cookies()

  return createServerClient(url, key, {
    cookies: {
      get(name: string) {
        return cookieStore.get(name)?.value
      },
      set(name: string, value: string, options: CookieOptions) {
        try {
          cookieStore.set({ name, value, ...options })
        } catch (error) {}
      },
      remove(name: string, options: CookieOptions) {
        try {
          cookieStore.set({ name, value: '', ...options })
        } catch (error) {}
      },
    },
  })
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
export async function createClientForApi(request: NextRequest) {
  const url = getSupabaseUrl()
  const key = getSupabaseAnonKey()

  // Check if env vars are available
  if (!key) {
    console.error('[createClientForApi] ⚠️ NEXT_PUBLIC_SUPABASE_ANON_KEY not set. Supabase features will not work until this is configured.')
    console.error('[createClientForApi] Available SUPABASE env keys:', Object.keys(process.env).filter(k => k.includes('SUPABASE')))

    // Return null supabase so API routes can handle gracefully
    return { supabase: null, response: NextResponse.next() }
  }

  // Create a fresh response that we can set cookies on.
  let response = NextResponse.next({ request: { headers: request.headers } })

  const supabase = createServerClient(url, key, {
    cookies: {
      get(name: string) {
        return request.cookies.get(name)?.value
      },
      async set(name: string, value: string, options: CookieOptions) {
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
  })

  return { supabase, response }
}