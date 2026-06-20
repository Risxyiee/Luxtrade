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
    console.log('🔍 Verify email attempt, token length:', token?.length, 'token prefix:', token?.substring(0, 10))

    if (!token || typeof token !== 'string' || token.length < 10) {
      console.warn('⚠️ Invalid token format received')
      return NextResponse.json(
        { error: 'Token verifikasi nggak valid. Format salah.', code: 'INVALID_TOKEN' },
        { status: 400 }
      )
    }

    // Find profile with matching token
    const profile = await db.profile.findUnique({
      where: { emailVerifyToken: token }
    })

    if (!profile) {
      console.warn('⚠️ No profile found with matching token. Token prefix:', token.substring(0, 10))
      
      // Check if user exists at all (might have been auto-confirmed or token corrupted)
      const anyProfile = await db.profile.findFirst({
        where: {
          OR: [
            { emailVerifyToken: { contains: token.substring(0, 20) } },
            { emailVerified: true }
          ]
        },
        take: 1
      })
      
      if (anyProfile?.emailVerified) {
        return NextResponse.json({
          success: true,
          message: 'Email kamu sudah pernah diverifikasi sebelumnya. Langsung login aja!'
        })
      }
      
      return NextResponse.json(
        { error: 'Link verifikasi nggak valid. Mungkin sudah pernah dipakai atau kedaluarsa. Minta link baru dari halaman login.', code: 'NO_PROFILE' },
        { status: 400 }
      )
    }

    console.log(`🔍 Found profile: id=${profile.id}, email=${profile.email}, verified=${profile.emailVerified}, expAt=${profile.emailVerifyExpAt}`)

    // Check if already verified first
    if (profile.emailVerified) {
      return NextResponse.json({
        success: true,
        message: 'Email kamu sudah pernah diverifikasi sebelumnya. Langsung login aja!'
      })
    }

    // Check token expiry
    if (profile.emailVerifyExpAt && new Date() > profile.emailVerifyExpAt) {
      console.warn(`⚠️ Token expired for user ${profile.id}. ExpAt: ${profile.emailVerifyExpAt}, Now: ${new Date().toISOString()}`)
      return NextResponse.json(
        { error: 'Link verifikasi sudah kadaluarsa. Minta kirim ulang dari halaman login ya.', code: 'EXPIRED' },
        { status: 410 }
      )
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
      message: 'Email berhasil diverifikasi! Sekarang kamu bisa login.',
      email: profile.email
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
