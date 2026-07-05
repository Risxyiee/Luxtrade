import { NextRequest, NextResponse } from 'next/server'
import { createClientForApi } from '@/lib/supabase/server'
import { db } from '@/lib/db'
import { getMidtransConfig } from '@/lib/payment/midtrans'
import { PRICING, getPlanPrice, type PricingPlan } from '@/lib/pricing'
import crypto from 'crypto'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/**
 * POST /api/midtrans/create-transaction
 * 
 * Body: {
 *   plan: 'PRO_30_DAYS' | 'PRO_ANNUAL' | 'PRO_LIFETIME',
 *   promoCode?: string
 * }
 * 
 * Returns: { token, redirectUrl } for Midtrans Snap
 */
export async function POST(request: NextRequest) {
  try {
    // ── 1. Auth check ──────────────────────────────────────────
    const { supabase } = createClientForApi(request)
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // ── 2. Check Midtrans config ───────────────────────────────
    const midtransConfig = getMidtransConfig()
    if (!midtransConfig.configured) {
      return NextResponse.json(
        { error: 'Payment gateway not configured. Add MIDTRANS_SERVER_KEY and MIDTRANS_CLIENT_KEY to your .env' },
        { status: 503 }
      )
    }

    // ── 3. Parse body ──────────────────────────────────────────
    const body = await request.json()
    const { plan, promoCode } = body as { plan: PricingPlan; promoCode?: string }

    if (!plan || !['PRO_30_DAYS', 'PRO_ANNUAL', 'PRO_LIFETIME', 'PRO_180_DAYS'].includes(plan)) {
      return NextResponse.json({ error: 'Invalid plan' }, { status: 400 })
    }

    // ── 4. Check if user already PRO ───────────────────────────
    const profile = await db.profile.findUnique({ where: { id: user.id } })
    if (profile?.is_pro && profile?.subscription_until && new Date(profile.subscription_until) > new Date()) {
      return NextResponse.json({ error: 'Akun kamu sudah PRO aktif.' }, { status: 400 })
    }

    // ── 5. Calculate price & duration ──────────────────────────
    let grossAmount = getPlanPrice(plan)
    let durationMonths = plan === 'PRO_LIFETIME' ? 60 : plan === 'PRO_ANNUAL' ? 12 : plan === 'PRO_180_DAYS' ? 6 : 1
    let discountPercent = 0

    // ── 6. Validate promo code (TRADERCEPAT etc.) ──────────────
    if (promoCode) {
      try {
        const origin = request.headers.get('origin') || process.env.NEXT_PUBLIC_APP_URL || 'https://luxtradee.web.id'
        const promoRes = await fetch(`${origin}/api/promo/validate`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ code: promoCode }),
        })
        const promoData = await promoRes.json()

        if (promoData.valid) {
          discountPercent = promoData.promoCode.discountPercent
          if (promoData.promoCode.durationMonths) {
            durationMonths = promoData.promoCode.durationMonths
          }
          grossAmount = Math.round(grossAmount * (1 - discountPercent / 100))
        }
      } catch {
        // Ignore promo errors — proceed without discount
      }
    }

    // Minimum Midtrans transaction is 1 IDR
    if (grossAmount < 1) grossAmount = 1

    // ── 7. Build Midtrans parameter ────────────────────────────
    const orderId = `LUX-${plan}-${Date.now()}-${crypto.randomBytes(4).toString('hex').toUpperCase()}`
    const customerName = profile?.full_name || user.email?.split('@')[0] || 'Customer'
    const customerEmail = user.email || 'unknown@luxtradee.web.id'
    const customerPhone = profile?.phone || '08123456789'

    const planLabel: Record<string, string> = {
      PRO_30_DAYS: 'LuxTrade PRO 30 Hari',
      PRO_ANNUAL: 'LuxTrade PRO Annual',
      PRO_180_DAYS: 'LuxTrade PRO 180 Hari',
      PRO_LIFETIME: 'LuxTrade Lifetime',
    }

    const itemDetails = [
      {
        id: plan,
        price: grossAmount,
        quantity: 1,
        name: planLabel[plan] || plan,
        category: 'Subscription',
        merchant_name: 'LuxTrade',
      },
    ]

    // If promo applied, add discount as separate item (Midtrans best practice)
    if (discountPercent > 0) {
      const originalPrice = getPlanPrice(plan)
      const discountAmount = originalPrice - grossAmount
      itemDetails.push({
        id: `PROMO-${promoCode}`,
        price: -discountAmount,
        quantity: 1,
        name: `Diskon ${discountPercent}% (${promoCode})`,
        category: 'Discount',
        merchant_name: 'LuxTrade',
      })
    }

    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://luxtradee.web.id'

    const parameter = {
      transaction_details: {
        order_id: orderId,
        gross_amount: grossAmount,
      },
      item_details: itemDetails,
      customer_details: {
        first_name: customerName.split(' ')[0],
        last_name: customerName.split(' ').slice(1).join(' ') || '',
        email: customerEmail,
        phone: customerPhone,
      },
      callbacks: {
        finish: `${baseUrl}/dashboard?payment=finish`,
        error: `${baseUrl}/dashboard?payment=error`,
        pending: `${baseUrl}/dashboard?payment=pending`,
      },
      custom_field1: user.id,
      custom_field2: plan,
      custom_field3: String(durationMonths),
    }

    // ── 8. Create Snap transaction via Midtrans API ────────────
    const isProduction = process.env.MIDTRANS_IS_PRODUCTION === 'true'
    const snapBaseUrl = isProduction
      ? 'https://app.midtrans.com/snap/v1/transactions'
      : 'https://app.sandbox.midtrans.com/snap/v1/transactions'

    const authString = Buffer.from(process.env.MIDTRANS_SERVER_KEY! + ':').toString('base64')

    const snapRes = await fetch(snapBaseUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
        Authorization: `Basic ${authString}`,
      },
      body: JSON.stringify(parameter),
    })

    if (!snapRes.ok) {
      const errText = await snapRes.text()
      console.error('❌ [Midtrans] Snap API error:', snapRes.status, errText)
      let userMessage = 'Gagal membuat transaksi pembayaran'
      try {
        const errJson = JSON.parse(errText)
        if (errJson.validation_messages) {
          userMessage = `Payment error: ${Array.isArray(errJson.validation_messages) ? errJson.validation_messages.join(', ') : errJson.validation_messages}`
        } else if (errJson.status_message) {
          userMessage = errJson.status_message
        }
      } catch { /* keep default message */ }
      return NextResponse.json(
        { error: userMessage },
        { status: 500 }
      )
    }

    const snapData = await snapRes.json()

    // ── 9. Save order to DB ────────────────────────────────────
    try {
      await db.paymentOrder.create({
        data: {
          userId: user.id,
          invoiceNumber: orderId,
          amount: grossAmount,
          plan: plan === 'PRO_LIFETIME' ? 'LIFETIME' : 'PRO',
          durationMonths,
          status: 'PENDING',
          customerName,
          customerEmail,
          paymentMethod: 'MIDTRANS',
          expiredAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
        },
      })
    } catch (dbErr: any) {
      console.warn('⚠️ [Midtrans] DB save skipped:', dbErr.message)
    }

    // ── 10. Consume promo quota if applied ─────────────────────
    if (promoCode && discountPercent > 0) {
      try {
        const origin = request.headers.get('origin') || process.env.NEXT_PUBLIC_APP_URL || 'https://luxtradee.web.id'
        await fetch(`${origin}/api/promo/apply`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ code: promoCode, userId: user.id }),
        })
      } catch {
        // Non-critical
      }
    }

    console.log('✅ [Midtrans] Transaction created')

    return NextResponse.json({
      success: true,
      token: snapData.token,
      redirectUrl: snapData.redirect_url,
      orderId,
    })
  } catch (error: any) {
    console.error('❌ [Midtrans] Create transaction error:', error)
    return NextResponse.json(
      { error: error.message || 'Gagal membuat transaksi' },
      { status: 500 }
    )
  }
}

/**
 * GET /api/midtrans/create-transaction
 * Returns Midtrans config status + client key
 */
export async function GET() {
  const config = getMidtransConfig()
  return NextResponse.json({
    ...config,
    snapUrl: config.clientKey ? (
      process.env.MIDTRANS_IS_PRODUCTION === 'true'
        ? 'https://app.midtrans.com/snap/snap.js'
        : 'https://app.sandbox.midtrans.com/snap/snap.js'
    ) : null,
  })
}