import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { supabaseAdmin } from '@/lib/supabase'

/**
 * POST /api/auth/verify-email
 * Body: { token: string }
 * Verifies email confirmation token, confirms user in Supabase Auth
 */
export async function POST(request: NextRequest) {
  try {
    const { token } = await request.json()

    if (!token || typeof token !== 'string' || token.length < 10) {
      return NextResponse.json(
        { error: 'Token verifikasi tidak valid.' },
        { status: 400 }
      )
    }

    // Find profile with matching token
    const profile = await db.profile.findUnique({
      where: { emailVerifyToken: token }
    })

    if (!profile) {
      return NextResponse.json(
        { error: 'Token verifikasi tidak valid atau sudah digunakan.' },
        { status: 400 }
      )
    }

    // Check token expiry
    if (profile.emailVerifyExpAt && new Date() > profile.emailVerifyExpAt) {
      return NextResponse.json(
        { error: 'Token verifikasi sudah kadaluarsa. Silakan kirim ulang email verifikasi.' },
        { status: 410 }
      )
    }

    // Check if already verified
    if (profile.emailVerified) {
      return NextResponse.json({
        success: true,
        message: 'Email sudah terverifikasi sebelumnya.'
      })
    }

    // Mark as verified in Prisma profile
    await db.profile.update({
      where: { id: profile.id },
      data: {
        emailVerified: true,
        emailVerifyToken: null, // Remove token after use
        emailVerifyExpAt: null,
      }
    })

    // Also confirm in Supabase Auth
    try {
      await supabaseAdmin.auth.admin.updateUserById(profile.id, {
        email_confirm: true,
        user_metadata: {
          email_verified: true,
          updated_at: new Date().toISOString()
        }
      })
      console.log('✅ User confirmed in Supabase Auth:', profile.id)
    } catch (authErr) {
      console.error('⚠️ Failed to confirm in Supabase Auth (non-fatal):', authErr)
    }

    // Also update Supabase profiles table
    try {
      await supabaseAdmin
        .from('profiles')
        .update({ email_verified: true, updated_at: new Date().toISOString() })
        .eq('id', profile.id)
    } catch {}

    console.log('✅ Email verified for user:', profile.id, profile.email)

    return NextResponse.json({
      success: true,
      message: 'Email berhasil diverifikasi! Silakan login.'
    })
  } catch (error: any) {
    console.error('❌ Verify email error:', error)
    return NextResponse.json(
      { error: 'Terjadi kesalahan pada server.' },
      { status: 500 }
    )
  }
}

/**
 * POST /api/auth/resend-verification
 * Body: { email: string }
 * Resends verification email
 */
export async function PUT(request: NextRequest) {
  try {
    const { email } = await request.json()

    if (!email) {
      return NextResponse.json({ error: 'Email diperlukan.' }, { status: 400 })
    }

    // Find profile by email
    const profile = await db.profile.findFirst({
      where: { email: email.toLowerCase() }
    })

    if (!profile) {
      return NextResponse.json({ error: 'Email tidak ditemukan.' }, { status: 404 })
    }

    if (profile.emailVerified) {
      return NextResponse.json({ error: 'Email sudah terverifikasi.' }, { status: 400 })
    }

    // Generate new token
    const crypto = await import('crypto')
    const newToken = crypto.randomBytes(32).toString('hex')
    const newExpAt = new Date(Date.now() + 24 * 60 * 60 * 1000)

    await db.profile.update({
      where: { id: profile.id },
      data: {
        emailVerifyToken: newToken,
        emailVerifyExpAt: newExpAt,
      }
    })

    // Send email via Resend
    const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || 'https://luxtradee.web.id'
    const confirmationUrl = `${SITE_URL}/auth/verify?token=${newToken}`
    const name = profile.full_name || email.split('@')[0]

    const { sendEmailFromTemplate, getConfirmationEmailHtml } = await import('@/lib/email')
    const fallbackHtml = getConfirmationEmailHtml(name, confirmationUrl)

    const emailResult = await sendEmailFromTemplate({
      to: email,
      subject: 'Kirim Ulang: Konfirmasi Email - LuxTrade 👑',
      templateId: process.env.RESEND_TEMPLATE_CONFIRM || '',
      templateParams: { name, confirmationUrl },
      fallbackHtml,
    })

    if (emailResult.success) {
      return NextResponse.json({
        success: true,
        message: 'Email verifikasi baru telah dikirim.'
      })
    } else {
      return NextResponse.json(
        { error: 'Gagal mengirim email. Coba lagi nanti.' },
        { status: 500 }
      )
    }
  } catch (error: any) {
    console.error('❌ Resend verification error:', error)
    return NextResponse.json(
      { error: 'Terjadi kesalahan pada server.' },
      { status: 500 }
    )
  }
}
