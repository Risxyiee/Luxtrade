import { NextRequest, NextResponse } from 'next/server'
import { getAuthUser } from '@/lib/api-auth'
import { createClient } from '@supabase/supabase-js'

// Hardcoded admin identifiers (used as ultimate fallback)
const ADMIN_EMAILS = ['luxtradee@gmail.com', 'riskiakbarp123@gmail.com']
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
  const user = await getAuthUser(request)

  if (!user) {
    return {
      error: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }),
      user: null,
    }
  }

  // Check 1: Hardcoded admin list (fastest, no DB call)
  if (ADMIN_EMAILS.includes(user.email.toLowerCase()) || ADMIN_IDS.includes(user.id)) {
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
        return { error: null, user }
      }
    }
  } catch {
    // Supabase check failed
  }

  return {
    error: NextResponse.json({ error: 'Forbidden. Admin access required.' }, { status: 403 }),
    user: null,
  }
}
