import { NextRequest, NextResponse } from 'next/server'
import { sendEmailFromTemplate, getConfirmationEmailHtml } from '@/lib/email'
import { supabaseAdmin } from '@/lib/supabase'

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || 'https://luxtradee.web.id'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { email } = body

    if (!email) {
      return NextResponse.json(
        { error: 'Email wajib diisi' },
        { status: 400 }
      )
    }

    if (!supabaseAdmin) {
      return NextResponse.json(
        { error: 'Server not configured' },
        { status: 500 }
      )
    }

    // Step 1: Generate new confirmation link via admin API
    const { data: linkData, error: linkError } = await supabaseAdmin.auth.admin.generateLink({
      type: 'signup',
      email,
      options: {
        emailRedirectTo: `${SITE_URL}/auth/callback`,
      },
    })

    if (linkError) {
      console.error('Generate link error:', linkError)
      if (linkError.message?.includes('not found') || linkError.message?.includes('No user')) {
        return NextResponse.json(
          { error: 'Email tidak terdaftar. Silakan daftar terlebih dahulu.' },
          { status: 404 }
        )
      }
      return NextResponse.json({ error: linkError.message }, { status: 400 })
    }

    // Step 2: Send email via Resend (template or inline fallback)
    const confirmationUrl = linkData.properties?.action_link || linkData.action_link
    if (!confirmationUrl) {
      console.error('No confirmation URL generated:', linkData)
      return NextResponse.json({ error: 'Gagal membuat link konfirmasi' }, { status: 500 })
    }

    const name = linkData.user?.user_metadata?.full_name ||
                 linkData.user?.user_metadata?.display_name ||
                 email.split('@')[0]

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
      message: 'Email konfirmasi telah dikirim ulang. Silakan cek inbox Anda.',
    })
  } catch (error) {
    console.error('Resend verification error:', error)
    return NextResponse.json(
      { error: 'Terjadi kesalahan. Silakan coba lagi.' },
      { status: 500 }
    )
  }
}
