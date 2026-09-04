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
    const isProduction = process.env.NODE_ENV === 'production'
    const errorMsg = isProduction
      ? 'CRITICAL: NEXT_PUBLIC_SUPABASE_ANON_KEY is required in production. Please set this environment variable in Cloudflare Pages settings.'
      : '⚠️ NEXT_PUBLIC_SUPABASE_ANON_KEY not set. Supabase features will not work in development.'

    console.error(errorMsg)

    if (isProduction) {
      throw new Error(errorMsg)
    }

    // In development, create client with placeholder for build to succeed
    const cookieStore = await cookies()
    return createServerClient(url, 'dev-placeholder-key', {
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

  console.log('[createClientForApi] URL:', url, 'Key length:', key?.length || 0)

  // Check if env vars are available
  if (!key) {
    const isProduction = process.env.NODE_ENV === 'production'
    const errorMsg = isProduction
      ? 'CRITICAL: NEXT_PUBLIC_SUPABASE_ANON_KEY is required in production. Please set this environment variable in Cloudflare Pages settings.'
      : '⚠️ NEXT_PUBLIC_SUPABASE_ANON_KEY not set. Supabase features will not work in development.'

    console.error('[createClientForApi]', errorMsg)
    console.error('[createClientForApi] NODE_ENV:', process.env.NODE_ENV)
    console.error('[createClientForApi] Available env keys:', Object.keys(process.env).filter(k => k.includes('SUPABASE')))

    // Return null instead of throwing to allow graceful error handling
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