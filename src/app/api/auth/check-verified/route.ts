import { NextRequest, NextResponse } from 'next/server'
import { createClientForApi } from '@/lib/supabase/server'
import { db } from '@/lib/db'

/**
 * GET /api/auth/check-verified
 * Checks if the authenticated user's email is verified.
 * Exception: If user has a successful payment, allow login (email was auto-verified by webhook).
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
      // User paid — webhook should have verified their email.
      // Double-check and force-verify if needed.
      const profile = await db.profile.findUnique({
        where: { id: user.id },
        select: { emailVerified: true }
      })

      if (profile && !profile.emailVerified) {
        // Webhook might have failed to update — fix it now
        await db.profile.update({
          where: { id: user.id },
          data: { emailVerified: true },
        })
      }

      return NextResponse.json({ verified: true, justPaid: true })
    }

    // No successful payment — enforce email verification
    const profile = await db.profile.findUnique({
      where: { id: user.id },
      select: { emailVerified: true, email: true }
    })

    if (!profile) {
      const verified = !!user.email_confirmed_at
      return NextResponse.json({ verified })
    }

    const isVerified = !!profile.emailVerified
    return NextResponse.json({ verified: isVerified })
  } catch (error: any) {
    console.error('Check verified error:', error)
    return NextResponse.json({ verified: false, error: 'Gagal memeriksa verifikasi email. Coba lagi.' })
  }
}