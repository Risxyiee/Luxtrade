import { NextRequest, NextResponse } from 'next/server'
import { createClientForApi } from '@/lib/supabase/server'
import { createClient } from '@supabase/supabase-js'

/**
 * Get the authenticated user from a request using Supabase.
 * Tries TWO strategies:
 *   1. Cookie-based auth via createClientForApi (SSR cookies)
 *   2. Bearer token via Authorization header (client-side session)
 *
 * Returns { id, email } or null if not authenticated.
 */
export async function getAuthUser(request: NextRequest): Promise<{ id: string; email: string } | null> {
  // Strategy 1: Cookie-based (SSR standard)
  try {
    const { supabase } = createClientForApi(request)
    const { data: { user }, error } = await supabase.auth.getUser()

    if (!error && user?.id) {
      return { id: user.id, email: user.email || '' }
    }
  } catch {
    // Fall through to Strategy 2
  }

  // Strategy 2: Bearer token (fallback for Vercel production where cookies
  // may not propagate correctly from Edge middleware to Serverless functions)
  const authHeader = request.headers.get('Authorization')
  if (authHeader?.startsWith('Bearer ')) {
    const token = authHeader.slice(7)
    if (token) {
      try {
        const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
        const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
        const client = createClient(supabaseUrl, supabaseAnonKey)
        const { data: { user }, error } = await client.auth.getUser(token)

        if (!error && user?.id) {
          return { id: user.id, email: user.email || '' }
        }
      } catch {
        // Ignore
      }
    }
  }

  return null
}

/**
 * Require authentication — returns the user or a 401 Response.
 * Usage:
 *   const { error, user } = await requireAuth(request)
 *   if (error) return error
 */
export async function requireAuth(request: NextRequest) {
  const user = await getAuthUser(request)
  if (!user) {
    return { error: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }), user: null }
  }
  return { error: null, user }
}