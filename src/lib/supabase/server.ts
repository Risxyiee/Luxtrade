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

  // Cloudflare Workers fix: request.cookies may be empty even when
  // the Cookie header is present. Parse the raw header as fallback.
  const rawCookieHeader = request.headers.get('cookie')
  const parsedCookieNames = request.cookies.getAll().map(c => c.name)
  const sbCookiePrefix = 'sb-' + url.split('//')[1].split('.')[0]
  const hasSbCookie = parsedCookieNames.some(n => n.startsWith(sbCookiePrefix))

  // If Next.js parsed cookies are missing Supabase cookies but the raw header exists,
  // we need manual parsing (common in Cloudflare Workers / opennextjs-cloudflare)
  const needsManualParse = !hasSbCookie && !!rawCookieHeader

  if (needsManualParse) {
    console.warn('[createClientForApi] request.cookies missing Supabase cookies, falling back to raw Cookie header parsing')
  }

  /** Parse a cookie value from the raw Cookie header string */
  function getCookieFromHeader(name: string): string | undefined {
    if (!rawCookieHeader) return undefined
    const prefix = name + '='
    for (const part of rawCookieHeader.split(';')) {
      const trimmed = part.trimStart()
      if (trimmed.startsWith(prefix)) {
        return trimmed.slice(prefix.length)
      }
    }
    return undefined
  }

  const supabase = createServerClient(url, key, {
    cookies: {
      get(name: string) {
        // Try Next.js parsed cookies first
        const parsed = request.cookies.get(name)?.value
        if (parsed) return parsed
        // Fallback: parse raw Cookie header (Cloudflare Workers fix)
        return getCookieFromHeader(name)
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