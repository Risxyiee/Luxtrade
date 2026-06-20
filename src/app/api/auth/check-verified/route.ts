import { NextRequest, NextResponse } from 'next/server'
import { createClientForApi } from '@/lib/supabase/server'
import { db } from '@/lib/db'

/**
 * GET /api/auth/check-verified
 * Checks if the authenticated user's email is verified.
 * IMPORTANT: Email verification is ENFORCED to prevent bots.
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

    // If no profile exists yet (e.g., old user before verification system), 
    // check Supabase Auth's built-in email confirmation
    if (!profile) {
      // Fall back to Supabase's email_confirm field
      const verified = !!user.email_confirmed_at
      if (!verified) {
        console.warn(`⚠️ No profile found for user ${user.id}, Supabase email_confirmed_at is null - blocking login`)
      }
      return NextResponse.json({ verified })
    }

    const isVerified = !!profile.emailVerified
    if (!isVerified) {
      console.log(`🚫 Email NOT verified for user: ${user.id} (${profile.email}) - blocking login`)
    }
    return NextResponse.json({ verified: isVerified })
  } catch (error: any) {
    console.error('❌ Check verified error:', error)
    // On error, BLOCK login to enforce email verification.
    // This prevents bypassing verification through server errors.
    return NextResponse.json({ verified: false, error: 'Gagal memeriksa verifikasi email. Coba lagi.' })
  }
}
