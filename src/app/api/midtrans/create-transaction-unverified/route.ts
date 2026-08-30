export const runtime = "edge"
import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getMidtransConfig } from '@/lib/payment/midtrans'
import { getPlanPrice, type PricingPlan } from '@/lib/pricing'
import { checkRateLimit } from '@/lib/rate-limit'
import { edgeCrypto } from '@/lib/edge-crypto'

export const dynamic = 'force-dynamic'

/**
 * POST /api/midtrans/create-transaction-unverified
 *
 * Allows creating a Midtrans transaction for a user who just signed up
 * but hasn't verified their email yet (no active session).
 *
 * Security: Validates that the user exists and was created recently (< 30 min ago).
 */
export async function POST(request: NextRequest) {
  try {
    // Rate limit: 5 transaction creation attempts per 5 minutes per IP
    const rl = checkRateLimit(request, 'create-transaction-unverified', {
      maxRequests: 5,
      windowMs: 5 * 60 * 1000,
      message: 'Terlalu banyak permintaan. Tunggu 5 menit.',
    })
    if (rl) return rl

    const body = await request.json()
    const { userId, email, fullName, plan } = body as {
      userId: string
      email: string
      fullName?: string
      plan: PricingPlan
    }

    if (!userId || !email || !plan) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
    }

    if (!['PRO_30_DAYS', 'PRO_ANNUAL', 'PRO_LIFETIME', 'PRO_180_DAYS'].includes(plan)) {
      return NextResponse.json({ error: 'Invalid plan' }, { status: 400 })
    }

    // Verify user exists in DB and was created recently
    const profile = await db.profile.findUnique({
      where: { id: userId },
      select: { id: true, email: true, full_name: true, createdAt: true, is_pro: true, subscription_until: true }
    })

    if (!profile) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }

    if (profile.email?.toLowerCase() !== email.toLowerCase()) {
      return NextResponse.json({ error: 'Email mismatch' }, { status: 403 })
    }

    // Only allow if user was created within the last 30 minutes
    const createdAt = profile.createdAt instanceof Date ? profile.createdAt : new Date(profile.createdAt as any)
    const minutesAgo = (Date.now() - createdAt.getTime()) / (1000 * 60)
    if (minutesAgo > 30) {
      return NextResponse.json({ error: 'Session expired. Please login and try again.' }, { status: 410 })
    }

    if (profile.is_pro && profile.subscription_until && new Date(profile.subscription_until) > new Date()) {
      return NextResponse.json({ error: 'Akun kamu sudah PRO aktif.' }, { status: 400 })
    }

    const midtransConfig = getMidtransConfig()
    if (!midtransConfig.configured) {
      return NextResponse.json({ error: 'Payment gateway not configured' }, { status: 503 })
    }

    let grossAmount = getPlanPrice(plan)
    let durationMonths = plan === 'PRO_LIFETIME' ? 60 : plan === 'PRO_ANNUAL' ? 12 : plan === 'PRO_180_DAYS' ? 6 : 1
    if (grossAmount < 1) grossAmount = 1

    const orderId = `LUX-${plan}-${Date.now()}-${edgeCrypto.randomBytesHex(4).toUpperCase()}`
    const customerName = fullName || profile.full_name || email.split('@')[0] || 'Customer'

    const planLabel: Record<string, string> = {
      PRO_30_DAYS: 'LuxTrade PRO 30 Hari',
      PRO_ANNUAL: 'LuxTrade PRO Annual',
      PRO_180_DAYS: 'LuxTrade PRO 180 Hari',
      PRO_LIFETIME: 'LuxTrade Lifetime',
    }

    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://luxtradee.web.id'

    const parameter = {
      transaction_details: {
        order_id: orderId,
        gross_amount: grossAmount,
      },
      item_details: [
        {
          id: plan,
          price: grossAmount,
          quantity: 1,
          name: planLabel[plan] || plan,
          category: 'Subscription',
          merchant_name: 'LuxTrade',
        },
      ],
      customer_details: {
        first_name: customerName.split(' ')[0],
        last_name: customerName.split(' ').slice(1).join(' ') || '',
        email,
        phone: '08123456789',
      },
      callbacks: {
        finish: `${baseUrl}/auth/checkout?plan=${plan}&payment=success`,
        error: `${baseUrl}/auth/checkout?plan=${plan}&payment=error`,
        pending: `${baseUrl}/auth/checkout?plan=${plan}&payment=pending`,
      },
      custom_field1: userId,
      custom_field2: plan,
      custom_field3: String(durationMonths),
    }

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
      console.error('[Midtrans Unverified] Snap API error:', snapRes.status, errText)
      return NextResponse.json({ error: 'Gagal membuat transaksi' }, { status: 500 })
    }

    const snapData = await snapRes.json()

    try {
      await db.paymentOrder.create({
        data: {
          userId,
          invoiceNumber: orderId,
          amount: grossAmount,
          plan: plan === 'PRO_LIFETIME' ? 'LIFETIME' : 'PRO',
          durationMonths,
          status: 'PENDING',
          customerName,
          customerEmail: email,
          paymentMethod: 'MIDTRANS',
          expiredAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
        },
      })
    } catch { /* non-critical */ }

    return NextResponse.json({
      success: true,
      token: snapData.token,
      redirectUrl: snapData.redirect_url,
      orderId,
    })
  } catch (error: any) {
    console.error('[Midtrans Unverified] Error:', error)
    return NextResponse.json({ error: 'Gagal membuat transaksi' }, { status: 500 })
  }
}