import { NextRequest, NextResponse } from 'next/server'
import { getAuthenticatedUser } from '@/lib/api-auth'
import { createClient } from '@supabase/supabase-js'

// Hardcoded admin identifiers (used as ultimate fallback)
const ADMIN_EMAILS = ['luxtradee@gmail.com']
const ADMIN_IDS: string[] = []

/**
 * Get Supabase admin client (service role, bypasses RLS).
 * Created fresh every call — safe for CF Workers where env vars
 * populate at request time, not module load time.
 */
function getSupabaseServiceClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) return null
  return createClient(url, key, {
    auth: { autoRefreshToken: false, persistSession: false }
  })
}

/**
 * Require admin authentication.
 * Checks in order:
 *   1. Hardcoded ADMIN_EMAILS / ADMIN_IDS list (fastest)
 *   2. Supabase profiles table via service role
 *
 * NOTE: Prisma check removed — on CF Workers, Prisma's fs.readdir
 * causes errors. Supabase profiles table is the source of truth anyway.
 *
 * Returns { error, user } — if error is non-null, return it immediately.
 */
export async function requireAdmin(request: NextRequest) {
  const authResult = await getAuthenticatedUser(request)
  const user = authResult.user

  console.log('[requireAdmin] Auth result:', {
    hasUser: !!user,
    userEmail: user?.email,
    ADMIN_EMAILS,
  })

  if (!user) {
    return {
      error: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }),
      user: null,
    }
  }

  // Check 1: Hardcoded admin list (fastest, no DB call)
  const userEmail = user.email?.toLowerCase().trim() || ''
  const isAuthorized = ADMIN_EMAILS.some(adminEmail =>
    adminEmail.toLowerCase().trim() === userEmail
  )

  if (isAuthorized || ADMIN_IDS.includes(user.id)) {
    return { error: null, user }
  }

  // Check 2: Supabase profiles table via service role
  try {
    const supabaseSvc = getSupabaseServiceClient()
    if (supabaseSvc) {
      const { data: profile } = await supabaseSvc
        .from('profiles')
        .select('role')
        .eq('id', user.id)
        .single()

      if (profile && (profile.role === 'ADMIN' || profile.role === 'SUPER_ADMIN')) {
        console.log('[requireAdmin] ✓ Admin access granted via profile role')
        return { error: null, user }
      }
    }
  } catch (err) {
    console.error('[requireAdmin] Supabase check failed:', err)
  }

  console.log('[requireAdmin] ✗ Admin access denied')
  return {
    error: NextResponse.json({ error: 'Forbidden. Admin access required.' }, { status: 403 }),
    user: null,
  }
}
