import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { sendEmail } from '@/lib/email'
import { checkRateLimit } from '@/lib/rate-limit'

/**
 * POST /api/marketing/send-promo
 * 
 * Body:
 *   email       — email tujuan (string, wajib)
 *   promoCode   — kode promo yang akan ditampilkan di email (string, wajib)
 *   subject?    — custom subject (opsional, default auto)
 *   discountPercent? — persentase diskon (opsional, default 50)
 *   planName?   — nama plan (opsional, default "PRO")
 *   durationMonths? — durasi bulan (opsional, default 1)
 *   expiryDate? — tanggal kadaluarsa promo (opsional)
 *   customMessage? — pesan kustom (opsional)
 *   adminSecret  — secret admin auth (string, wajib)
 * 
 * Dynamic Content:
 *   Semua kemunculan "LUXPRO50" di HTML akan otomatis di-replace
 *   dengan promoCode yang dikirim dari input API.
 */
export async function POST(request: NextRequest) {
  try {
    // Rate limit: 10 promo emails per minute per IP (prevents abuse even with valid secret)
    const limited = checkRateLimit(request, 'send-promo', {
      maxRequests: 10,
      windowMs: 60 * 1000,
      message: 'Terlalu banyak permintaan. Coba lagi dalam beberapa saat.',
    })
    if (limited) return limited

    const body = await request.json()
    const {
      email,
      promoCode,
      subject,
      discountPercent,
      planName,
      durationMonths,
      expiryDate,
      customMessage,
      adminSecret
    } = body

    // ============================================
    // Validate input
    // ============================================
    if (!email || !promoCode) {
      return NextResponse.json(
        { error: 'Email dan promoCode wajib diisi' },
        { status: 400 }
      )
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    if (!emailRegex.test(email)) {
      return NextResponse.json(
        { error: 'Format email tidak valid' },
        { status: 400 }
      )
    }

    // Admin auth — SECURITY: no hardcoded fallback. ADMIN_SECRET must be set in env.
    const ADMIN_SECRET = process.env.ADMIN_SECRET
    if (!ADMIN_SECRET) {
      console.error('🚨 [send-promo] ADMIN_SECRET env var is not set — rejecting request')
      return NextResponse.json(
        { error: 'Server not configured for admin operations' },
        { status: 503 }
      )
    }
    if (adminSecret !== ADMIN_SECRET) {
      return NextResponse.json(
        { error: 'Unauthorized — admin secret salah' },
        { status: 401 }
      )
    }

    // ============================================
    // Find user profile to get name
    // ============================================
    const profile = await db.profile.findFirst({
      where: { email: email.toLowerCase() }
    })

    const name = profile?.full_name || email.split('@')[0]

    // ============================================
    // Send promo email
    // ============================================
    const result = await sendEmail({
      to: email.toLowerCase(),
      type: 'promo',
      name,
      subject: subject || `🎁 Promo Eksklusif Buat Kamu - LuxTrade`,
      promoCode: promoCode.toUpperCase(),
      promoData: {
        discountPercent: discountPercent || 50,
        planName: planName || 'PRO',
        durationMonths: durationMonths || 1,
        expiryDate: expiryDate || '30 hari lagi',
        customMessage: customMessage || undefined
      }
    })

    if (!result.success) {
      console.error('❌ Promo email failed:', result.error)
      return NextResponse.json(
        { error: 'Gagal mengirim email promo' },
        { status: 500 }
      )
    }

    // Log broadcast
    try {
      await db.emailBroadcast.create({
        data: {
          target: email.toLowerCase(),
          subject: subject || `🎁 Promo ${promoCode.toUpperCase()}`,
          sentCount: 1,
          failedCount: 0,
          sentBy: 'admin-promo-api'
        }
      })
    } catch {}

    // PII redacted: do not log recipient email in server logs
    console.log(`✅ Promo email sent with code ${promoCode.toUpperCase()}`)

    return NextResponse.json({
      success: true,
      message: `Email promo berhasil dikirim ke ${email.toLowerCase()}`,
      details: {
        to: email.toLowerCase(),
        name,
        promoCode: promoCode.toUpperCase(),
        discountPercent: discountPercent || 50,
        planName: planName || 'PRO'
      }
    })
  } catch (error: any) {
    console.error('❌ Send promo error:', error)
    return NextResponse.json(
      { error: 'Terjadi kesalahan server' },
      { status: 500 }
    )
  }
}
