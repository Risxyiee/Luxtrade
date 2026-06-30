import { NextRequest, NextResponse } from 'next/server'
import { createClientForApi } from '@/lib/supabase/server'
import { db } from '@/lib/db'
import { verifyMidtransSignature, getMidtransConfig } from '@/lib/payment/midtrans'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/**
 * POST /api/midtrans/webhook
 * 
 * Midtrans sends this when payment status changes.
 * Secured by SHA512 signature verification.
 * 
 * Transaction statuses we care about:
 * - settlement  → payment success
 * - capture     → payment success (for BCA KlikPay, card)
 * - pending     → waiting payment
 * - deny        → payment rejected
 * - expire      → payment expired
 * - cancel      → payment cancelled
 * - refund      → payment refunded
 * - chargeback  → dispute
 * - partial_refund → partial refund
 */
export async function POST(request: NextRequest) {
  try {
    // ── 1. Parse Midtrans notification body ────────────────────
    const notification = await request.json()

    const {
      transaction_status: transactionStatus,
      transaction_id: transactionId,
      order_id: orderId,
      gross_amount: grossAmount,
      fraud_status: fraudStatus,
      status_code: statusCode,
      signature_key: signatureKey,
      payment_type: paymentType,
      // Custom fields we sent during create-transaction
      custom_field1: userId,
      custom_field2: plan,
      custom_field3: durationMonths,
    } = notification

    console.log('📩 [Midtrans Webhook] Received:', {
      orderId,
      transactionStatus,
      fraudStatus,
      paymentType,
      userId,
      plan,
      grossAmount,
    })

    // ── 2. Verify signature ────────────────────────────────────
    const serverKey = process.env.MIDTRANS_SERVER_KEY
    if (!serverKey) {
      console.error('❌ [Midtrans Webhook] MIDTRANS_SERVER_KEY not set')
      return NextResponse.json({ error: 'Server key not configured' }, { status: 500 })
    }

    const isValid = verifyMidtransSignature(
      orderId,
      String(statusCode),
      String(grossAmount),
      serverKey,
      signatureKey
    )

    if (!isValid) {
      console.error('❌ [Midtrans Webhook] Invalid signature for order:', orderId)
      return NextResponse.json({ error: 'Invalid signature' }, { status: 403 })
    }

    // ── 3. Handle transaction status ───────────────────────────
    const ourStatus = mapMidtransStatus(transactionStatus, fraudStatus)
    console.log(`🔀 [Midtrans Webhook] ${orderId}: ${transactionStatus} → ${ourStatus}`)

    // ── 4. Update payment order in DB ──────────────────────────
    try {
      const existingOrder = await db.paymentOrder.findUnique({
        where: { invoiceNumber: orderId },
      })

      if (existingOrder) {
        const updateData: any = {
          status: ourStatus,
          paymentChannel: paymentType || existingOrder.paymentChannel,
        }

        if (ourStatus === 'SUCCESS') {
          updateData.paidAt = new Date()
          updateData.dokuTransactionId = transactionId || existingOrder.dokuTransactionId
        }

        await db.paymentOrder.update({
          where: { id: existingOrder.id },
          data: updateData,
        })

        console.log('✅ [Midtrans Webhook] Order updated:', {
          orderId,
          status: ourStatus,
        })

        // ── 5. Activate subscription on SUCCESS ────────────────
        if (ourStatus === 'SUCCESS' && existingOrder.userId) {
          await activateSubscription(
            existingOrder.userId,
            existingOrder.plan,
            existingOrder.durationMonths
          )
        }
      } else {
        // Order not in DB — create it + activate if paid
        console.warn('⚠️ [Midtrans Webhook] Order not in DB, creating:', orderId)

        if (userId && ourStatus === 'SUCCESS') {
          await db.paymentOrder.create({
            data: {
              userId,
              invoiceNumber: orderId,
              amount: Number(grossAmount),
              plan: plan === 'LIFETIME' ? 'LIFETIME' : 'PRO',
              durationMonths: Number(durationMonths) || null,
              status: 'SUCCESS',
              customerName: 'Midtrans Customer',
              customerEmail: '',
              paymentMethod: 'MIDTRANS',
              paymentChannel: paymentType,
              dokuTransactionId: transactionId,
              paidAt: new Date(),
            },
          })

          await activateSubscription(
            userId,
            plan === 'LIFETIME' ? 'LIFETIME' : 'PRO',
            Number(durationMonths) || null
          )
        }
      }
    } catch (dbErr: any) {
      if (dbErr.code === 'P2021' || dbErr.code === 'P1001' || dbErr.message?.includes('does not exist')) {
        console.warn('⚠️ [Midtrans Webhook] DB table not found — skipping DB operations')

        // Fallback: still try to activate if we have userId
        if (userId && (transactionStatus === 'settlement' || transactionStatus === 'capture')) {
          try {
            await activateSubscription(
              userId,
              plan === 'LIFETIME' ? 'LIFETIME' : 'PRO',
              Number(durationMonths) || null
            )
          } catch {
            // Best effort
          }
        }
      } else {
        throw dbErr
      }
    }

    // Midtrans expects a 200 OK with this body
    return NextResponse.json({ status: 'ok' })
  } catch (error: any) {
    console.error('❌ [Midtrans Webhook] Error:', error.message)
    // Still return 200 so Midtrans doesn't retry endlessly
    return NextResponse.json({ status: 'ok', error: error.message })
  }
}

// ── Helpers ──────────────────────────────────────────────────────

function mapMidtransStatus(
  transactionStatus: string,
  fraudStatus?: string
): string {
  switch (transactionStatus) {
    case 'capture':
      return fraudStatus === 'challenge' ? 'CHALLENGE' : 'SUCCESS'
    case 'settlement':
      return 'SUCCESS'
    case 'pending':
      return 'PENDING'
    case 'deny':
      return 'FAILED'
    case 'expire':
      return 'EXPIRED'
    case 'cancel':
      return 'CANCELLED'
    case 'refund':
      return 'REFUNDED'
    case 'partial_refund':
      return 'REFUNDED'
    case 'chargeback':
      return 'CHARGEBACK'
    default:
      return 'PENDING'
  }
}

async function activateSubscription(
  userId: string,
  plan: string,
  durationMonths: number | null
) {
  const months = durationMonths || (plan === 'LIFETIME' ? 60 : 3)
  const startDate = new Date()
  const endDate = new Date(startDate.getFullYear(), startDate.getMonth() + months, startDate.getDate(), 23, 59, 59, 999)

  await db.profile.update({
    where: { id: userId },
    data: {
      plan: plan === 'LIFETIME' ? 'LIFETIME' : 'PRO',
      is_pro: true,
      subscription_until: endDate,
      proExpiry: endDate,
    },
  })

  await db.userSubscription.create({
    data: {
      userId,
      plan,
      status: 'active',
      startDate,
      endDate,
      discountPercent: 0,
    },
  }).catch(() => {
    // Subscription might already exist — ignore
  })

  console.log(`🎉 [Midtrans Webhook] Activated ${plan} for user ${userId} until ${endDate.toISOString()}`)

  // Sync to Supabase Auth metadata
  try {
    const { supabaseAdmin: adminClient } = await import('@/lib/supabase-admin-alt')
    if (adminClient) {
      const { data: { user: authUser } } = await adminClient.auth.admin.getUserById(userId)
      const currentMeta = authUser?.user_metadata || {}
      await adminClient.auth.admin.updateUserById(userId, {
        user_metadata: {
          ...currentMeta,
          is_pro: true,
          subscription_status: 'active',
          subscription_until: endDate.toISOString(),
          has_ever_been_pro: true,
          updated_at: new Date().toISOString(),
        },
      })
      console.log('✅ [Midtrans Webhook] Synced Supabase metadata for', userId)
    }
  } catch {
    // Non-critical
  }
}