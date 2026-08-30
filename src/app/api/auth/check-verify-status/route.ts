export const runtime = 'edge'
import { NextRequest, NextResponse } from 'next/server'
import { createClientForApi } from '@/lib/supabase/server'
import { db } from '@/lib/db'
import { supabaseAdmin } from '@/lib/supabase'

/**
 * GET /api/auth/check-verify-status
 * Checks if the currently logged-in user's email is verified.
 * Used by the pending-verification page for polling.
 *
 * FIXED LOGIC:
 * 1. Get user from Supabase Auth session (real-time)
 * 2. Check email_confirmed_at on the Supabase user object (primary source)
 * 3. ALSO fetch fresh data from Supabase admin API (bypasses cached session)
 * 4. Check Prisma profile as secondary source
 * Returns: { verified, email, timeLeftSeconds, source }
 */
export async function GET(request: NextRequest) {
  try {
    const { supabase } = createClientForApi(request)
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json(
        { error: 'Not authenticated', email: '' },
        { status: 401 }
      )
    }

    const userId = user.id
    const userEmail = user.email || ''

    // ============================================
    // Step 1: Check Supabase Auth real-time (primary)
    // The getUser() call above already returns fresh data
    // ============================================
    let isConfirmedInSupabase = !!user.email_confirmed_at

    // Step 2: Also check via admin API to bypass any cached session data
    if (!isConfirmedInSupabase && supabaseAdmin) {
      try {
        const { data: adminUser, error: adminError } = await supabaseAdmin.auth.admin.getUserById(userId)
        if (!adminError && adminUser.user) {
          isConfirmedInSupabase = !!adminUser.user.email_confirmed_at
          if (isConfirmedInSupabase) {
            console.log(`✅ Admin API confirmed email_confirmed_at is set for user ${userId}`)
          }
        }
      } catch (err) {
        console.warn('⚠️ Admin API getUserById failed:', err)
      }
    }

    // ============================================
    // Step 3: Check Prisma profile (secondary)
    // ============================================
    const profile = await db.profile.findUnique({
      where: { id: userId },
      select: {
        emailVerified: true,
        email: true,
        emailVerifyExpAt: true
      }
    })

    // Determine final verified status: verified if EITHER source says yes
    const isVerified = isConfirmedInSupabase || !!profile?.emailVerified

    // If Supabase says verified but Prisma doesn't — sync them
    if (isConfirmedInSupabase && profile && !profile.emailVerified) {
      console.log(`🔄 Syncing Prisma profile: Supabase confirmed but Prisma not yet for user ${userId}`)
      await db.profile.update({
        where: { id: userId },
        data: {
          emailVerified: true,
          emailVerifyToken: null,
          emailVerifyExpAt: null,
        }
      })
    }

    // If no profile exists but Supabase says confirmed — still allow login
    if (!profile && isConfirmedInSupabase) {
      return NextResponse.json({
        verified: true,
        email: userEmail,
        timeLeftSeconds: 0,
        source: 'supabase'
      })
    }

    // Calculate time left until token expiry
    let timeLeftSeconds = 0
    if (profile?.emailVerifyExpAt && !isVerified) {
      const expDate = new Date(profile.emailVerifyExpAt)
      const now = new Date()
      const diffMs = expDate.getTime() - now.getTime()
      timeLeftSeconds = Math.max(0, Math.floor(diffMs / 1000))
    }

    return NextResponse.json({
      verified: isVerified,
      email: profile?.email || userEmail,
      timeLeftSeconds,
      source: isConfirmedInSupabase ? 'supabase' : (profile?.emailVerified ? 'prisma' : 'none')
    })
  } catch (error: any) {
    console.error('❌ Check verify status error:', error)
    return NextResponse.json(
      { error: 'Server error', email: '' },
      { status: 500 }
    )
  }
}
