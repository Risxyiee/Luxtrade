import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseAdmin } from '@/lib/supabase-admin-alt'
import { sendEmail } from '@/lib/email'
import { requireAdmin } from '@/lib/admin-auth'

/**
 * Debug endpoint untuk test email spesifik
 * Gunakan untuk investigasi kenapa broadcast gagal
 */
export async function POST(request: NextRequest) {
  try {
    const { error, user } = await requireAdmin(request)
    if (error) return error

    const body = await request.json()
    const { email } = body

    if (!email) {
      return NextResponse.json({ error: 'Email wajib diisi' }, { status: 400 })
    }

    console.log(`[debug-email] Testing send to: ${email}`)

    // Test basic email
    const result1 = await sendEmail({
      to: email,
      subject: 'Test Debug - LuxTrade',
      html: `
        <!DOCTYPE html>
        <html>
        <body>
          <h1>Test Email</h1>
          <p>Ini adalah email test dari LuxTrade debugging system.</p>
          <p>Email: ${email}</p>
          <p>Waktu: ${new Date().toISOString()}</p>
        </body>
        </html>
      `,
      replyTo: 'luxtradee@gmail.com',
    })

    console.log(`[debug-email] First attempt result:`, result1)

    // If first attempt failed, try with simpler content
    if (!result1.success) {
      console.log(`[debug-email] First attempt failed, retrying with simple content...`)

      await new Promise(r => setTimeout(r, 1000))

      const result2 = await sendEmail({
        to: email,
        subject: 'Test Simple',
        html: '<p>Simple test</p>',
      })

      console.log(`[debug-email] Second attempt result:`, result2)

      return NextResponse.json({
        email,
        attempt1: result1,
        attempt2: result2,
        message: 'Debug test completed'
      })
    }

    return NextResponse.json({
      email,
      result: result1,
      message: 'Email sent successfully'
    })

  } catch (error: unknown) {
    console.error('[debug-email] Error:', error)
    return NextResponse.json({
      error: 'Debug failed',
      details: error instanceof Error ? error.message : String(error)
    }, { status: 500 })
  }
}

/**
 * GET - Test send ke admin email sendiri
 */
export async function GET(request: NextRequest) {
  try {
    const { error, user } = await requireAdmin(request)
    if (error) return error

    const adminEmail = user!.email || 'admin'
    const testEmails = [
      'gantengbetguagilak@gmail.com',
      'atletterbaik@gmail.com',
      'akunppuki@gmail.com',
      'putrawesta0@gmail.com',
      'fvian9072@gmail.com'
    ]

    const results: any = {}

    for (const email of testEmails) {
      console.log(`[debug-email] Testing: ${email}`)

      const result = await sendEmail({
        to: email,
        subject: 'Test Broadcast Debug - LuxTrade',
        html: `
          <h1>Test Email</h1>
          <p>Halo, ini adalah test email dari LuxTrade untuk debugging broadcast.</p>
          <p>Email tujuan: ${email}</p>
        `,
      })

      results[email] = result
      console.log(`[debug-email] Result for ${email}:`, result.success ? 'SUCCESS' : 'FAILED', result.error)

      // Delay untuk rate limiting
      await new Promise(r => setTimeout(r, 1000))
    }

    return NextResponse.json({
      adminEmail,
      testEmails,
      results,
      summary: {
        tested: testEmails.length,
        success: Object.values(results).filter((r: any) => r.success).length,
        failed: Object.values(results).filter((r: any) => !r.success).length
      }
    })

  } catch (error: unknown) {
    console.error('[debug-email] GET Error:', error)
    return NextResponse.json({
      error: 'Debug GET failed',
      details: error instanceof Error ? error.message : String(error)
    }, { status: 500 })
  }
}