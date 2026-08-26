import { NextResponse } from 'next/server'
import { sendEmailFromTemplate, getConfirmationEmailHtml } from '@/lib/email'

// DEBUG ONLY - Hapus setelah testing
export async function GET() {
  const envStatus = {
    RESEND_API_KEY: process.env.RESEND_API_KEY ? `✅ Set (ends with ...${process.env.RESEND_API_KEY.slice(-4)})` : '❌ NOT SET',
    RESEND_TEMPLATE_CONFIRM: process.env.RESEND_TEMPLATE_CONFIRM || '❌ NOT SET (will use inline HTML fallback)',
    RESEND_TEMPLATE_RESET: process.env.RESEND_TEMPLATE_RESET || '❌ NOT SET (will use inline HTML fallback)',
    NEXT_PUBLIC_SITE_URL: process.env.NEXT_PUBLIC_SITE_URL || '❌ NOT SET',
  }

  return NextResponse.json({
    message: 'Resend Email Debug Info',
    env: envStatus,
    instructions: 'POST ke endpoint ini dengan body { email: "your@email.com" } untuk test kirim email',
  })
}

export async function POST(request: Request) {
  try {
    const { email } = await request.json()

    if (!email) {
      return NextResponse.json({ error: 'Email wajib diisi. Contoh: { "email": "test@gmail.com" }' }, { status: 400 })
    }

    const testUrl = 'https://luxtradee.web.id/auth/callback?test=1'
    const testName = 'Test User'
    const fallbackHtml = getConfirmationEmailHtml(testName, testUrl)

    console.log('📧 Sending test email to:', email)
    console.log('📧 RESEND_API_KEY set:', !!process.env.RESEND_API_KEY)
    console.log('📧 RESEND_TEMPLATE_CONFIRM:', process.env.RESEND_TEMPLATE_CONFIRM || '(not set, using inline)')

    const result = await sendEmailFromTemplate({
      to: email,
      subject: '🧪 TEST - LuxTrade Email Template',
      templateId: process.env.RESEND_TEMPLATE_CONFIRM || '',
      templateParams: {
        name: testName,
        confirmationUrl: testUrl,
      },
      fallbackHtml,
    })

    return NextResponse.json({
      success: result.success,
      error: result.error ? String(result.error) : null,
      data: result.data,
      env: {
        RESEND_API_KEY: process.env.RESEND_API_KEY ? `✅ Set` : '❌ NOT SET',
        RESEND_TEMPLATE_CONFIRM: process.env.RESEND_TEMPLATE_CONFIRM || '(using inline HTML)',
      },
    })
  } catch (error) {
    return NextResponse.json({
      success: false,
      error: String(error),
      env: {
        RESEND_API_KEY: process.env.RESEND_API_KEY ? '✅ Set' : '❌ NOT SET',
      },
    }, { status: 500 })
  }
}
