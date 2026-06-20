import { NextRequest, NextResponse } from 'next/server'
import { createClientForApi } from '@/lib/supabase/server'
import { db } from '@/lib/db'

/**
 * GET /api/auth/check-verified
 * Checks if the authenticated user's email is verified
 */
export async function GET(request: NextRequest) {
  try {
    const { supabase } = createClientForApi(request)
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
    }

    // Check Prisma profile for custom email verification
    const profile = await db.profile.findUnique({
      where: { id: user.id },
      select: { emailVerified: true, email: true }
    })

    // If no profile exists yet (e.g., old user), allow through
    if (!profile) {
      return NextResponse.json({ verified: true })
    }

    return NextResponse.json({ verified: !!profile.emailVerified })
  } catch (error: any) {
    console.error('❌ Check verified error:', error)
    // On error, allow through to prevent lockout
    return NextResponse.json({ verified: true })
  }
}
