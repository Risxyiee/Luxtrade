import { NextRequest, NextResponse } from 'next/server'
import { createClientForApi } from '@/lib/supabase/server'
import { db } from '@/lib/db'

/**
 * GET /api/auth/check-verified
 * Checks if the authenticated user's email is verified.
 * Source of truth: Supabase Auth `email_confirmed_at`.
 * Falls back to Prisma profile.emailVerified for edge cases.
 * Exception: If user has a successful payment, always allow login.
 */
export async function GET(request: NextRequest) {
  try {
    const { supabase } = createClientForApi(request)
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
    }

    // Check if user has a successful payment — webhook auto-verifies email
    const successfulPayment = await db.paymentOrder.findFirst({
      where: {
        userId: user.id,
        status: 'SUCCESS',
      },
      select: { id: true },
    })

    if (successfulPayment) {
      // User paid — always allow login
      return NextResponse.json({ verified: true, justPaid: true })
    }

    // PRIMARY CHECK: Supabase Auth email_confirmed_at is the source of truth
    // This is set by ensureSupabaseConfirmed() in the verify-email flow
    if (user.email_confirmed_at) {
      // Also sync to local profile if it exists and isn't marked verified
      try {
        const profile = await db.profile.findUnique({
          where: { id: user.id },
          select: { emailVerified: true }
        })
        if (profile && !profile.emailVerified) {
          await db.profile.update({
            where: { id: user.id },
            data: { emailVerified: true },
          })
        }
      } catch { /* local DB sync failure is non-critical */ }

      return NextResponse.json({ verified: true })
    }

    // FALLBACK: Check Prisma profile.emailVerified
    try {
      const profile = await db.profile.findUnique({
        where: { id: user.id },
        select: { emailVerified: true }
      })
      if (profile?.emailVerified) {
        return NextResponse.json({ verified: true })
      }
    } catch { /* ignore */ }

    // Not verified anywhere
    return NextResponse.json({ verified: false })
  } catch (error: any) {
    console.error('Check verified error:', error)
    // On error, DON'T block login — return verified: true to avoid locking users out
    return NextResponse.json({ verified: true })
  }
}