import { NextRequest, NextResponse } from 'next/server'
import { createClientForApi } from '@/lib/supabase/server'

/**
 * Get the authenticated user from a request using Supabase.
 * Returns { id, email } or null if not authenticated.
 */
export async function getAuthUser(request: NextRequest): Promise<{ id: string; email: string } | null> {
  try {
    const { supabase } = createClientForApi(request)
    const { data: { user }, error } = await supabase.auth.getUser()

    if (error) {
      return null
    }

    if (!user) {
      return null
    }

    return { id: user.id, email: user.email || '' }
  } catch (_error) {
    return null
  }
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