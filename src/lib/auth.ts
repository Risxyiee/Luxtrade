/**
 * Auth utility - provides a NextAuth-compatible auth() interface
 * that wraps Supabase authentication for server-side use.
 */

import { createClient } from '@/lib/supabase/server'

interface Session {
  user: {
    id: string
    email?: string
    name?: string
  } | null
}

/**
 * Get the current authenticated session.
 * Works in Server Components and Route Handlers.
 * 
 * @returns Session object with user info, or null user if not authenticated
 */
export async function auth(): Promise<Session> {
  try {
    const supabase = await createClient()
    const { data: { user }, error } = await supabase.auth.getUser()

    if (error || !user) {
      return { user: null }
    }

    return {
      user: {
        id: user.id,
        email: user.email || undefined,
        name: user.user_metadata?.full_name || user.email?.split('@')[0] || undefined,
      }
    }
  } catch (error) {
    console.error('[auth] Error getting session:', error)
    return { user: null }
  }
}
