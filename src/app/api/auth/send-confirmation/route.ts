import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin, getSupabaseAdminAuthFromClient } from '@/lib/supabase'
import { sendEmailFromTemplate, getConfirmationEmailHtml } from '@/lib/email'
import { rateLimitByEmail, checkRateLimit } from '@/lib/rate-limit'

const getSiteUrl = () => process.env.NEXT_PUBLIC_SITE_URL || 'https://luxtradee.web.id'

export async function POST(request: NextRequest) {
  try {
    const { email, fullName } = await request.json()

    if (!email) {
      return NextResponse.json({ error: 'Email wajib diisi' }, { status: 400 })
    }

    // SECURITY (audit #8): dulu route ini TANPA rate limit → bisa dipakai
    // email-bombing atas nama domain kita + enumerasi user via 404.
    // Limit IP (dilindungi cf-connecting-ip) + limit per-email.
    const rlIp = checkRateLimit(request, 'send-confirmation', {
      maxRequests: 10,
      windowMs: 15 * 60 * 1000,
      message: 'Terlalu banyak permintaan. Tunggu 15 menit.',
    })
    if (rlIp) return rlIp

    const rlEmail = rateLimitByEmail('send-confirmation', email, {
      maxRequests: 3,
      windowMs: 15 * 60 * 1000,
      message: 'Terlalu banyak permintaan konfirmasi. Tunggu 15 menit.',
    })
    if (rlEmail) return rlEmail

    const authAdmin = getSupabaseAdminAuthFromClient()
    if (!authAdmin) {
      return NextResponse.json({ error: 'Server not configured' }, { status: 500 })
    }

    // Step 1: Generate confirmation link via admin API
    const { data: otpData, error: otpError } = await authAdmin.generateLink({
      type: 'signup',
      email,
      options: {
        emailRedirectTo: `${getSiteUrl()}/auth/callback`,
      },
    })

    if (otpError) {
      console.error('Generate link error:', otpError)
      if (otpError.message?.includes('not found') || otpError.message?.includes('No user')) {
        // SECURITY: respons generik — jangan bedakan "terdaftar" vs tidak
        // (anti-enumerasi). Route ini tidak dipanggil UI manapun, jadi aman.
        return NextResponse.json({
          success: true,
          message: 'Jika email Anda terdaftar, link konfirmasi telah dikirim. Silakan cek inbox.',
        })
      }
      return NextResponse.json({ error: 'Gagal memproses permintaan' }, { status: 400 })
    }

    // Step 2: Send email via Resend (template or inline fallback)
    const confirmationUrl = otpData.properties?.action_link || otpData.action_link
    if (!confirmationUrl) {
      console.error('No confirmation URL generated:', otpData)
      return NextResponse.json({ error: 'Gagal membuat link konfirmasi' }, { status: 500 })
    }

    const name = fullName || email.split('@')[0]
    const fallbackHtml = getConfirmationEmailHtml(name, confirmationUrl)

    const emailResult = await sendEmailFromTemplate({
      to: email,
      subject: 'Konfirmasi Email - LuxTradee 👑',
      templateId: process.env.RESEND_TEMPLATE_CONFIRM || '',
      templateParams: {
        name,
        confirmationUrl,
      },
      fallbackHtml,
    })

    if (!emailResult.success) {
      console.error('Email error:', emailResult.error)
    }

    return NextResponse.json({
      success: true,
      message: 'Email konfirmasi telah dikirim. Silakan cek inbox Anda.',
      ...(process.env.NODE_ENV === 'development' ? { debugUrl: confirmationUrl } : {}),
    })
  } catch (error) {
    console.error('Send confirmation error:', error)
    return NextResponse.json(
      { error: 'Terjadi kesalahan. Silakan coba lagi.' },
      { status: 500 }
    )
  }
}
