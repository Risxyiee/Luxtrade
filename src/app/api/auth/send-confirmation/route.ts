export const runtime = 'edge'
import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin, getSupabaseAdminAuthFromClient } from '@/lib/supabase'
import { sendEmailFromTemplate, getConfirmationEmailHtml } from '@/lib/email'

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || 'https://luxtradee.web.id'

export async function POST(request: NextRequest) {
  try {
    const { email, fullName } = await request.json()

    if (!email) {
      return NextResponse.json({ error: 'Email wajib diisi' }, { status: 400 })
    }

    const authAdmin = getSupabaseAdminAuthFromClient()
    if (!authAdmin) {
      return NextResponse.json({ error: 'Server not configured' }, { status: 500 })
    }

    // Step 1: Generate confirmation link via admin API
    const { data: otpData, error: otpError } = await authAdmin.generateLink({
      type: 'signup',
      email,
      options: {
        emailRedirectTo: `${SITE_URL}/auth/callback`,
      },
    })

    if (otpError) {
      console.error('Generate link error:', otpError)
      if (otpError.message?.includes('not found') || otpError.message?.includes('No user')) {
        return NextResponse.json(
          { error: 'Email tidak terdaftar. Silakan daftar terlebih dahulu.' },
          { status: 404 }
        )
      }
      return NextResponse.json({ error: otpError.message }, { status: 400 })
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
      subject: 'Konfirmasi Email - LuxTrade 👑',
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
