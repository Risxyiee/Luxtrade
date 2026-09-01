import { NextRequest, NextResponse } from 'next/server'
import { verifyMidtransSignature } from '@/lib/payment/midtrans'
import { getAdminAuth, getSupabaseAdmin } from '@/lib/supabase-admin-alt'

export const dynamic = 'force-dynamic'

/**
 * POST /api/midtrans/webhook
 *
 * Midtrans HTTP Notification (Webhook)
 * Uses Supabase only — no Prisma (CF Workers compatible).
 */
export async function POST(request: NextRequest) {
  try {
    // ── 1. Parse notification body ──────────────────────────────
    const body = await request.json()

    const {
      order_id: orderId,
      transaction_status: transactionStatus,
      transaction_time: transactionTime,
      status_code: statusCode,
      gross_amount: grossAmount,
      signature_key: signatureKey,
      payment_type: paymentType,
      fraud_status: fraudStatus,
    } = body as {
      order_id: string
      transaction_status: string
      transaction_time: string
      status_code: string
      gross_amount: string
      signature_key: string
      payment_type: string
      fraud_status?: string
    }

    // ── 2. Verify signature ────────────────────────────────────
    const serverKey = process.env.MIDTRANS_SERVER_KEY
    if (!serverKey) {
      console.error('❌ [Midtrans Webhook] MIDTRANS_SERVER_KEY not set')
      return NextResponse.json({ status: 'ok', error: 'Server key not configured' })
    }

    const isValid = await verifyMidtransSignature(orderId, statusCode, grossAmount, serverKey, signatureKey)

    if (!isValid) {
      console.error('❌ [Midtrans Webhook] Invalid signature for order:', orderId)
      return NextResponse.json({ status: 'ok', error: 'Invalid signature' })
    }

    // ── 3. Determine final status ──────────────────────────────
    let finalStatus: string
    let shouldUpgrade = false

    if (transactionStatus === 'capture') {
      if (fraudStatus === 'accept') {
        finalStatus = 'SUCCESS'
        shouldUpgrade = true
      } else if (fraudStatus === 'challenge') {
        finalStatus = 'PENDING'
      } else {
        finalStatus = 'FAILED'
      }
    } else if (transactionStatus === 'settlement') {
      finalStatus = 'SUCCESS'
      shouldUpgrade = true
    } else if (transactionStatus === 'pending') {
      finalStatus = 'PENDING'
    } else if (transactionStatus === 'cancel' || transactionStatus === 'deny' || transactionStatus === 'failure') {
      finalStatus = 'FAILED'
    } else if (transactionStatus === 'expire') {
      finalStatus = 'EXPIRED'
    } else if (transactionStatus === 'refund') {
      finalStatus = 'REFUNDED'
    } else if (transactionStatus === 'partial_refund') {
      finalStatus = 'PARTIAL_REFUND'
    } else {
      finalStatus = transactionStatus?.toUpperCase() || 'UNKNOWN'
    }

    // ── 4. Find the payment order in Supabase ──────────────────
    const svc = getSupabaseAdmin()
    if (!svc) {
      console.error('❌ [Midtrans Webhook] Supabase admin client not available')
      return NextResponse.json({ status: 'ok', error: 'DB not configured' })
    }

    const { data: paymentOrder } = await svc
      .from('payment_orders')
      .select('*')
      .eq('invoice_number', orderId)
      .single()

    if (!paymentOrder) {
      return NextResponse.json({ status: 'ok', message: 'Order not found, acknowledged' })
    }

    // ── 5. Skip if already processed ───────────────────────────
    if (paymentOrder.status === 'SUCCESS' && finalStatus === 'SUCCESS') {
      return NextResponse.json({ status: 'ok', message: 'Already processed' })
    }

    // ── 6. Update payment order status ─────────────────────────
    await svc.from('payment_orders').update({
      status: finalStatus,
      payment_channel: paymentType || paymentOrder.payment_channel,
      ...(shouldUpgrade && transactionTime ? { paid_at: transactionTime } : {}),
      updated_at: new Date().toISOString(),
    }).eq('invoice_number', orderId)

    // ── 7. Upgrade user to PRO on successful payment ───────────
    if (shouldUpgrade) {
      const userId = paymentOrder.user_id
      const durationMonths = paymentOrder.duration_months || 1

      // Calculate subscription end date
      const now = new Date()
      const subscriptionUntil = new Date(now)

      // If user already has active subscription, extend from current expiry
      const { data: existingProfile } = await svc
        .from('profiles')
        .select('subscription_until, is_pro')
        .eq('id', userId)
        .single()

      if (existingProfile?.is_pro && existingProfile?.subscription_until && new Date(existingProfile.subscription_until) > now) {
        subscriptionUntil.setTime(new Date(existingProfile.subscription_until).getTime())
      }

      if (paymentOrder.plan === 'LIFETIME') {
        subscriptionUntil.setFullYear(subscriptionUntil.getFullYear() + 50)
      } else {
        subscriptionUntil.setMonth(subscriptionUntil.getMonth() + durationMonths)
      }

      const subUntilIso = subscriptionUntil.toISOString()

      // Update profile
      await svc.from('profiles').update({
        is_pro: true,
        subscription_until: subUntilIso,
        pro_expiry: subUntilIso,
        plan: paymentOrder.plan === 'LIFETIME' ? 'LIFETIME' : 'PRO',
        subscription_status: 'active',
        pro_status: 'active',
        has_ever_been_pro: true,
        email_verified: true,
        updated_at: new Date().toISOString(),
      }).eq('id', userId)

      // Also create UserSubscription record for tracking
      try {
        await svc.from('user_subscriptions').insert({
          user_id: userId,
          plan: paymentOrder.plan === 'LIFETIME' ? 'LIFETIME' : 'PRO',
          status: 'active',
          start_date: now.toISOString(),
          end_date: subUntilIso,
          created_at: now.toISOString(),
        })
      } catch (subErr) {
        // Duplicate or missing table — non-critical
        console.warn('⚠️ [Midtrans Webhook] user_subscriptions insert failed (non-critical):', subErr)
      }

      // Auto-verify email in Supabase Auth so user can login
      try {
        const authAdmin = getAdminAuth()
        if (authAdmin) {
          await authAdmin.updateUserById(userId, {
            email_confirm: true,
            user_metadata: {
              email_verified: true,
              is_pro: true,
              subscription_status: 'active',
              subscription_until: subUntilIso,
              has_ever_been_pro: true,
              updated_at: new Date().toISOString(),
            }
          })
        }
      } catch (verifyErr) {
        console.error('⚠️ [Midtrans Webhook] Failed to auto-verify email (non-critical):', verifyErr)
      }
    }

    // ── 8. Return 200 to acknowledge ───────────────────────────
    return NextResponse.json({ status: 'ok' })
  } catch (error: any) {
    console.error('❌ [Midtrans Webhook] Error:', error)
    return NextResponse.json({ status: 'ok', error: 'Internal error' })
  }
}
