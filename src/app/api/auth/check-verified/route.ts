import { NextRequest, NextResponse } from 'next/server'
import { createClientForApi } from '@/lib/supabase/server'
import { getSupabaseAdmin } from '@/lib/supabase-admin-alt'

/**
 * GET /api/auth/check-verified
 * Checks if the authenticated user's email is verified.
 * Source of truth: Supabase Auth `email_confirmed_at`.
 * Falls back to profiles table email_verified for edge cases.
 * Exception: If user has a successful payment, always allow login.
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
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
    }

    const admin = getSupabaseAdmin()

    // Check if user has a successful payment — webhook auto-verifies email
    if (admin) {
      try {
        const { data: successfulPayment } = await admin
          .from('payment_orders')
          .select('id')
          .eq('user_id', user.id)
          .eq('status', 'SUCCESS')
          .limit(1)
          .single()

        if (successfulPayment) {
          // User paid — always allow login
          return NextResponse.json({ verified: true, justPaid: true })
        }
      } catch { /* payment check failure is non-critical */ }
    }

    // PRIMARY CHECK: Supabase Auth email_confirmed_at is the source of truth
    if (user.email_confirmed_at) {
      // Also sync to profiles table if it exists and isn't marked verified
      if (admin) {
        try {
          const { data: profile } = await admin
            .from('profiles')
            .select('email_verified')
            .eq('id', user.id)
            .single()

          if (profile && !profile.email_verified) {
            await admin.from('profiles').update({
              email_verified: true
            }).eq('id', user.id)
          }
        } catch { /* sync failure is non-critical */ }
      }

      return NextResponse.json({ verified: true })
    }

    // FALLBACK: Check profiles table email_verified
    if (admin) {
      try {
        const { data: profile } = await admin
          .from('profiles')
          .select('email_verified')
          .eq('id', user.id)
          .single()

        if (profile?.email_verified) {
          return NextResponse.json({ verified: true })
        }
      } catch { /* ignore */ }
    }

    // Not verified anywhere
    return NextResponse.json({ verified: false })
  } catch (error: any) {
    console.error('Check verified error:', error)
    // On error, DON'T block login — return verified: true to avoid locking users out
    return NextResponse.json({ verified: true })
  }
}
