import { NextRequest } from 'next/server'
import { createClientForApi } from '@/lib/supabase/server'
import { createClient } from '@supabase/supabase-js'
import { User, SupabaseClient } from '@supabase/supabase-js'

interface AuthResult {
  user: User | null
  client: SupabaseClient | null
  error?: string
}

/**
 * Get authenticated user and Supabase client from request.
 * Handles both cookie-based and Bearer token authentication.
 *
 * @param request - NextRequest object
 * @returns AuthResult with user, client, and optional error
 */
export async function getAuthenticatedUser(request: NextRequest): Promise<AuthResult> {
  try {
    const result = await createClientForApi(request)
    const cookieClient = result.supabase

    // Check if Supabase client was created successfully
    if (!cookieClient) {
      console.error('[getAuthenticatedUser] createClientForApi returned null - environment variables may not be configured')
      return { user: null, client: null, error: 'Server configuration error' }
    }

    let { data: { user }, error } = await cookieClient.auth.getUser()
    if (user) {
      console.log('[getAuthenticatedUser] User authenticated via cookies:', user.email)
      return { user, client: cookieClient }
    }

    console.warn('[getAuthenticatedUser] No user from cookies, trying Bearer token...')

    // Try Bearer token authentication
    const authHeader = request.headers.get('Authorization')
    if (authHeader?.startsWith('Bearer ')) {
      const token = authHeader.slice(7)
      const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://klxkdrfsfcoankbaoejn.supabase.co'
      const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

      if (!supabaseKey) {
        console.error('[getAuthenticatedUser] NEXT_PUBLIC_SUPABASE_ANON_KEY not configured')
        return { user: null, client: null, error: 'Server configuration error' }
      }

      const bearerClient = createClient(supabaseUrl, supabaseKey, {
        auth: { persistSession: false, autoRefreshToken: false }
      })
      const result = await bearerClient.auth.getUser(token)
      if (result.data.user) {
        console.log('[getAuthenticatedUser] User authenticated via Bearer token:', result.data.user.email)
        return { user: result.data.user, client: bearerClient }
      } else {
        console.warn('[getAuthenticatedUser] Bearer token invalid or expired')
      }
    }

    return { user: null, client: cookieClient }
  } catch (error) {
    console.error('[getAuthenticatedUser] Error:', error)
    return { user: null, client: null, error: 'Authentication failed' }
  }
}

/**
 * Require authentication - returns error response if not authenticated.
 *
 * @param request - NextRequest object
 * @returns Object with user and client, or error response if not authenticated
 */
export async function requireAuth(request: NextRequest) {
  const { user, client, error } = await getAuthenticatedUser(request)

  if (!user || !client) {
    return {
      user: null,
      client: null,
      response: new Response(
        JSON.stringify({ error: error || 'Unauthorized - Please login' }),
        { status: 401, headers: { 'Content-Type': 'application/json' } }
      )
    }
  }

  return { user, client, response: null }
}