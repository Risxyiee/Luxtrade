import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseAdmin } from '@/lib/supabase-admin-alt'
import { sendEmailFromTemplate, getConfirmationEmailHtml } from '@/lib/email'
import { rateLimitByEmail } from '@/lib/rate-limit'
import { edgeCrypto } from '@/lib/edge-crypto'

const getSiteUrl = () => process.env.NEXT_PUBLIC_SITE_URL || 'https://luxtradee.web.id'

export async function POST(request: NextRequest) {
  try {
    const { email } = await request.json()

    if (!email) {
      return NextResponse.json({ error: 'Email wajib diisi' }, { status: 400 })
    }

    // Rate limit: 3 per 15 minutes per email
    const rl = rateLimitByEmail('resend-verification', email, {
      maxRequests: 3,
      windowMs: 15 * 60 * 1000,
      message: 'Terlalu banyak permintaan kirim ulang verifikasi. Tunggu 15 menit.',
    })
    if (rl) return rl

    const admin = getSupabaseAdmin()
    if (!admin) {
      return NextResponse.json({ error: 'Server tidak dikonfigurasi dengan benar.' }, { status: 500 })
    }

    // Find profile by email in Supabase
    const { data: profile, error: findErr } = await admin
      .from('profiles')
      .select('*')
      .eq('email', email.toLowerCase())
      .limit(1)
      .single()

    if (findErr || !profile) {
      return NextResponse.json(
        { error: 'Email nggak ketemu. Belum daftar ya?' },
        { status: 404 }
      )
    }

    if (profile.email_verified) {
      return NextResponse.json(
        { error: 'Email kamu sudah terverifikasi. Langsung login aja!' },
        { status: 400 }
      )
    }

    // Generate new verification token
    const newToken = edgeCrypto.randomBytesHex(32)
    const newExpAt = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString() // 24 hours

    // Save token to profile
    const { error: updateErr } = await admin
      .from('profiles')
      .update({
        email_verify_token: newToken,
        email_verify_exp_at: newExpAt,
        updated_at: new Date().toISOString(),
      })
      .eq('id', profile.id)

    if (updateErr) {
      console.error('❌ Failed to update verify token:', updateErr.message)
      return NextResponse.json(
        { error: 'Gagal mengupdate token. Coba lagi nanti.' },
        { status: 500 }
      )
    }

    console.log('✅ New verification token generated')

    // Build verification URL (points to our custom verify page)
    const confirmationUrl = `${getSiteUrl()}/auth/verify?token=${newToken}`
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

    console.log('✅ Resend verification email sent')
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
