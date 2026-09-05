import { NextRequest, NextResponse } from 'next/server'
import { createClientForApi } from '@/lib/supabase/server'
import { getSupabaseAdmin } from '@/lib/supabase-admin-alt'

/**
 * GET /api/auth/check-verify-status
 * Checks if the currently logged-in user's email is verified.
 * Used by the pending-verification page for polling.
 *
 * FIXED LOGIC:
 * 1. Get user from Supabase Auth session (real-time)
 * 2. Check email_confirmed_at on the Supabase user object (primary source)
 * 3. ALSO fetch fresh data from Supabase admin API (bypasses cached session)
 * 4. Check profiles table as secondary source
 * Returns: { verified, email, timeLeftSeconds, source }
 */
export async function GET(request: NextRequest) {
  try {
    const result = await createClientForApi(request)
    const supabase = result.supabase
    if (!supabase) {
      return NextResponse.json({ error: 'Server error' }, { status: 500 })
    }

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
    const admin = getSupabaseAdmin()
    if (!isConfirmedInSupabase && admin) {
      try {
        const { data: adminUser, error: adminError } = await admin.auth.admin.getUserById(userId)
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
    // Step 3: Check profiles table (secondary)
    // ============================================
    let profile: any = null
    if (admin) {
      const { data, error: profErr } = await admin
        .from('profiles')
        .select('email_verified, email, email_verify_exp_at')
        .eq('id', userId)
        .single()

      if (!profErr && data) {
        profile = data
      }
    }

    // Determine final verified status: verified if EITHER source says yes
    const isVerified = isConfirmedInSupabase || !!profile?.email_verified

    // If Supabase says verified but profiles table doesn't — sync them
    if (isConfirmedInSupabase && profile && !profile.email_verified && admin) {
      console.log(`🔄 Syncing profile: Supabase confirmed but profiles table not yet for user ${userId}`)
      await admin.from('profiles').update({
        email_verified: true,
        email_verify_token: null,
        email_verify_exp_at: null,
      }).eq('id', userId)
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
    if (profile?.email_verify_exp_at && !isVerified) {
      const expDate = new Date(profile.email_verify_exp_at)
      const now = new Date()
      const diffMs = expDate.getTime() - now.getTime()
      timeLeftSeconds = Math.max(0, Math.floor(diffMs / 1000))
    }

    return NextResponse.json({
      verified: isVerified,
      email: profile?.email || userEmail,
      timeLeftSeconds,
      source: isConfirmedInSupabase ? 'supabase' : (profile?.email_verified ? 'profiles' : 'none')
    })
  } catch (error: any) {
    console.error('❌ Check verify status error:', error)
    return NextResponse.json(
      { error: 'Server error', email: '' },
      { status: 500 }
    )
  }
}
