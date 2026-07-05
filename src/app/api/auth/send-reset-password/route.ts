import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin, getSupabaseAdminAuthFromClient } from '@/lib/supabase'
import { sendEmailFromTemplate, getResetPasswordEmailHtml } from '@/lib/email'

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || 'https://luxtradee.web.id'

export async function POST(request: NextRequest) {
  try {
    const { email } = await request.json()

    if (!email) {
      return NextResponse.json({ error: 'Email wajib diisi' }, { status: 400 })
    }

    const authAdmin = getSupabaseAdminAuthFromClient()
    if (!authAdmin) {
      return NextResponse.json({ error: 'Server not configured' }, { status: 500 })
    }

    // Step 1: Generate reset password link via admin API
    // Include email in redirect URL so the reset page can use it as admin API fallback
    const emailEncoded = encodeURIComponent(email)
    const { data: linkData, error: linkError } = await authAdmin.generateLink({
      type: 'recovery',
      email,
      options: {
        redirectTo: `${SITE_URL}/auth/reset-password?email=${emailEncoded}`,
      },
    })

    if (linkError) {
      console.error('Generate reset link error:', linkError)
      if (linkError.message?.includes('not found') || linkError.message?.includes('No user')) {
        return NextResponse.json(
          { error: 'Email tidak terdaftar di LuxTrade.' },
          { status: 404 }
        )
      }
      return NextResponse.json({ error: linkError.message }, { status: 400 })
    }

    // Step 2: Send email via Resend (template or inline fallback)
    const resetUrl = linkData.properties?.action_link || linkData.action_link
    if (!resetUrl) {
      console.error('No reset URL generated:', linkData)
      return NextResponse.json({ error: 'Gagal membuat link reset password' }, { status: 500 })
    }

    const name = linkData.user?.user_metadata?.full_name ||
                 linkData.user?.user_metadata?.display_name ||
                 email.split('@')[0]

    const fallbackHtml = getResetPasswordEmailHtml(name, resetUrl)

    const emailResult = await sendEmailFromTemplate({
      to: email,
      subject: 'Reset Password - LuxTrade 🔒',
      templateId: process.env.RESEND_TEMPLATE_RESET || '',
      templateParams: {
        name,
        resetUrl,
      },
      fallbackHtml,
    })

    if (!emailResult.success) {
      console.error('Email error:', emailResult.error)
    }

    return NextResponse.json({
      success: true,
      message: 'Link reset password telah dikirim ke email Anda.',
      ...(process.env.NODE_ENV === 'development' ? { debugUrl: resetUrl } : {}),
    })
  } catch (error) {
    console.error('Send reset password error:', error)
    return NextResponse.json(
      { error: 'Terjadi kesalahan. Silakan coba lagi.' },
      { status: 500 }
    )
  }
}
