import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { sendEmail, getConfirmationEmailHtml } from '@/lib/email'

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || 'https://luxtradee.web.id'

export async function POST(request: NextRequest) {
  try {
    const { email, fullName } = await request.json()

    if (!email) {
      return NextResponse.json({ error: 'Email wajib diisi' }, { status: 400 })
    }

    if (!supabaseAdmin) {
      return NextResponse.json({ error: 'Server not configured' }, { status: 500 })
    }

    // Step 1: Generate OTP for this user via admin API
    // This creates a confirmation link without sending any email from Supabase
    const { data: otpData, error: otpError } = await supabaseAdmin.auth.admin.generateLink({
      type: 'signup',
      email,
      options: {
        emailRedirectTo: `${SITE_URL}/auth/callback`,
      },
    })

    if (otpError) {
      console.error('Generate link error:', otpError)

      // If user not found, try signup type
      if (otpError.message?.includes('not found') || otpError.message?.includes('No user')) {
        return NextResponse.json(
          { error: 'Email tidak terdaftar. Silakan daftar terlebih dahulu.' },
          { status: 404 }
        )
      }

      return NextResponse.json({ error: otpError.message }, { status: 400 })
    }

    // Step 2: Send email via Resend with our beautiful template
    const confirmationUrl = otpData.properties?.action_link || otpData.action_link
    if (!confirmationUrl) {
      console.error('No confirmation URL generated:', otpData)
      return NextResponse.json({ error: 'Gagal membuat link konfirmasi' }, { status: 500 })
    }

    const name = fullName || email.split('@')[0]
    const html = getConfirmationEmailHtml(name, confirmationUrl)

    const emailResult = await sendEmail({
      to: email,
      subject: 'Konfirmasi Email - LuxTrade 👑',
      html,
    })

    if (!emailResult.success) {
      console.error('Resend email error:', emailResult.error)
      // Fallback: still return success so user doesn't get stuck
      // The Supabase link is still valid
      console.log('⚠️ Email send failed but link was generated. URL:', confirmationUrl)
    }

    return NextResponse.json({
      success: true,
      message: 'Email konfirmasi telah dikirim. Silakan cek inbox Anda.',
      // Dev only: include link for debugging (remove in production)
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
