export const runtime = "edge"
import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { verifyMidtransSignature } from '@/lib/payment/midtrans'
import { getAdminAuth } from '@/lib/supabase-admin-alt'

export const dynamic = 'force-dynamic'

/**
 * POST /api/midtrans/webhook
 *
 * Midtrans HTTP Notification (Webhook)
 * Docs: https://docs.midtrans.com/en/after-payment/notification-url
 *
 * This endpoint is called by Midtrans when payment status changes.
 * It verifies the SHA512 signature, then auto-upgrades user to PRO on success.
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
      return NextResponse.json(
        { error: 'Server key not configured' },
        { status: 500 }
      )
    }

    const isValid = await verifyMidtransSignature(orderId, statusCode, grossAmount, serverKey, signatureKey)

    if (!isValid) {
      console.error('❌ [Midtrans Webhook] Invalid signature for order:', orderId)
      return NextResponse.json(
        { error: 'Invalid signature' },
        { status: 403 }
      )
    }

    // ── 3. Determine final status ──────────────────────────────
    // Midtrans status mapping:
    // capture   + accept → SUCCESS
    // settlement → SUCCESS
    // pending → PENDING
    // deny / cancel / expire / failure → FAILED / EXPIRED
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

    // ── 4. Find the payment order in DB ────────────────────────
    const paymentOrder = await db.paymentOrder.findUnique({
      where: { invoiceNumber: orderId },
    })

    if (!paymentOrder) {
      // Still return 200 to prevent Midtrans retries
      return NextResponse.json({ status: 'ok', message: 'Order not found, acknowledged' })
    }

    // ── 5. Skip if already processed ───────────────────────────
    if (paymentOrder.status === 'SUCCESS' && finalStatus === 'SUCCESS') {
      return NextResponse.json({ status: 'ok', message: 'Already processed' })
    }

    // ── 6. Update payment order status ─────────────────────────
    await db.paymentOrder.update({
      where: { invoiceNumber: orderId },
      data: {
        status: finalStatus,
        paymentChannel: paymentType || paymentOrder.paymentChannel,
        ...(shouldUpgrade && transactionTime ? { paidAt: new Date(transactionTime) } : {}),
      },
    })

    // ── 7. Upgrade user to PRO on successful payment ───────────
    if (shouldUpgrade) {
      const userId = paymentOrder.userId
      const durationMonths = paymentOrder.durationMonths || 1

      // Calculate subscription end date
      const now = new Date()
      const subscriptionUntil = new Date(now)

      // If user already has active subscription, extend from current expiry
      const existingProfile = await db.profile.findUnique({
        where: { id: userId },
        select: { subscription_until: true, is_pro: true },
      })

      if (existingProfile?.is_pro && existingProfile?.subscription_until && new Date(existingProfile.subscription_until) > now) {
        // Extend from current expiry
        subscriptionUntil.setTime(new Date(existingProfile.subscription_until).getTime())
      }

      if (paymentOrder.plan === 'LIFETIME') {
        // 50 years = effectively lifetime
        subscriptionUntil.setFullYear(subscriptionUntil.getFullYear() + 50)
      } else {
        subscriptionUntil.setMonth(subscriptionUntil.getMonth() + durationMonths)
      }

      // Update profile
      await db.profile.update({
        where: { id: userId },
        data: {
          is_pro: true,
          subscription_until: subscriptionUntil,
          plan: paymentOrder.plan === 'LIFETIME' ? 'LIFETIME' : 'PRO',
          hasEverBeenPro: true,
          emailVerified: true,
        },
      })

      // Also update UserSubscription for tracking
      await db.userSubscription.create({
        data: {
          userId,
          plan: paymentOrder.plan === 'LIFETIME' ? 'LIFETIME' : 'PRO',
          status: 'active',
          startDate: now,
          endDate: subscriptionUntil,
        },
      })

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
              subscription_until: subscriptionUntil.toISOString(),
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
    // Return 200 to prevent Midtrans from retrying on server errors
    return NextResponse.json({ status: 'ok', error: 'Internal error' })
  }
}