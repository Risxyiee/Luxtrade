import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { sendEmailFromTemplate, getConfirmationEmailHtml } from '@/lib/email'
import crypto from 'crypto'

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || 'https://luxtradee.web.id'

/**
 * POST /api/auth/resend-verification
 * Body: { email: string }
 * Generates new token in Prisma, sends email via Resend.
 * NO dependency on Supabase generateLink.
 */
export async function POST(request: NextRequest) {
  try {
    const { email } = await request.json()

    if (!email) {
      return NextResponse.json(
        { error: 'Email wajib diisi' },
        { status: 400 }
      )
    }

    // Find profile by email in Prisma
    const profile = await db.profile.findFirst({
      where: { email: email.toLowerCase() }
    })

    if (!profile) {
      return NextResponse.json(
        { error: 'Email nggak ketemu. Belum daftar ya?' },
        { status: 404 }
      )
    }

    if (profile.emailVerified) {
      return NextResponse.json(
        { error: 'Email kamu sudah terverifikasi. Langsung login aja!' },
        { status: 400 }
      )
    }

    // Generate new verification token
    const newToken = crypto.randomBytes(32).toString('hex')
    const newExpAt = new Date(Date.now() + 24 * 60 * 60 * 1000) // 24 hours

    // Save token to Prisma profile
    await db.profile.update({
      where: { id: profile.id },
      data: {
        emailVerifyToken: newToken,
        emailVerifyExpAt: newExpAt,
      }
    })

    console.log(`✅ New verification token generated for: ${profile.email}`)

    // Build verification URL (points to our custom verify page)
    const confirmationUrl = `${SITE_URL}/auth/verify?token=${newToken}`
    const name = profile.full_name || email.split('@')[0]

    // Send email via Resend (template or inline fallback)
    const fallbackHtml = getConfirmationEmailHtml(name, confirmationUrl)

    const emailResult = await sendEmailFromTemplate({
      to: email,
      subject: 'Kirim Ulang Verifikasi Akun LuxTrade 👑',
      templateId: process.env.RESEND_TEMPLATE_CONFIRM || '',
      templateParams: {
        name,
        confirmationUrl,
      },
      fallbackHtml,
    })

    if (!emailResult.success) {
      console.error('❌ Resend email failed:', emailResult.error)
      return NextResponse.json(
        { error: 'Gagal mengirim email. Coba lagi nanti ya.' },
        { status: 500 }
      )
    }

    console.log(`✅ Resend verification email sent to: ${email}`)
    return NextResponse.json({
      success: true,
      message: 'Link verifikasi baru sudah dikirim ke email kamu. Cek inbox/spam ya!',
    })
  } catch (error: any) {
    console.error('❌ Resend verification error:', error)
    return NextResponse.json(
      { error: 'Terjadi kesalahan server. Coba lagi nanti.' },
      { status: 500 }
    )
  }
}
