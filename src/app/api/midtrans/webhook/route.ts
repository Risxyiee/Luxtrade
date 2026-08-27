/**
 * POST /api/midtrans/webhook
 * Handle Midtrans payment callbacks
 * Replaces DOKU payment callbacks
 */

import { NextRequest, NextResponse } from 'next/server'
import { verifyMidtransSignature, mapMidtransStatus, logMidtransEvent } from '@/lib/payment/midtrans-helpers'
import { db } from '@/lib/db'
import { logger } from '@/lib/logger'
import { handleApiError } from '@/lib/error-handler'

export async function POST(request: NextRequest) {
  const startTime = performance.now()

  try {
    const body = await request.json()
    const {
      order_id,
      transaction_id,
      transaction_status,
      payment_type,
      gross_amount,
      signature_key,
    } = body

    // Validate required fields
    if (!order_id || !transaction_id || !transaction_status || !signature_key) {
      logger.warn('Invalid Midtrans webhook payload', { body })
      return NextResponse.json({ error: 'Invalid payload' }, { status: 400 })
    }

    // Verify signature
    const isValid = verifyMidtransSignature(order_id, transaction_status, String(gross_amount), signature_key)
    if (!isValid) {
      logger.warn('Invalid Midtrans signature', { order_id, transaction_id })
      return NextResponse.json({ error: 'Invalid signature' }, { status: 401 })
    }

    logMidtransEvent('webhook_received', {
      order_id,
      transaction_id,
      transaction_status,
      gross_amount: Number(gross_amount),
    })

    // Map Midtrans status to app status
    const appStatus = mapMidtransStatus(transaction_status)

    // Update payment order in database
    const updated = await db.paymentOrder.updateMany({
      where: {
        invoiceNumber: order_id,
        status: { not: 'SUCCESS' }, // Prevent double-processing
      },
      data: {
        status: appStatus === 'success' ? 'SUCCESS' : 'FAILED',
        paymentMethod: payment_type,
        paidAt: appStatus === 'success' ? new Date() : null,
        updatedAt: new Date(),
      },
    })

    if (updated.count === 0) {
      logger.info('Payment already processed', { order_id, transaction_id })
      return NextResponse.json({ success: true, message: 'Already processed' })
    }

    // If payment successful, activate subscription
    if (appStatus === 'success') {
      const order = await db.paymentOrder.findUnique({
        where: { invoiceNumber: order_id },
        select: { userId: true, plan: true, durationMonths: true },
      })

      if (order) {
        const subscriptionEnd = new Date()
        subscriptionEnd.setMonth(subscriptionEnd.getMonth() + (order.durationMonths || 1))

        await db.profile.update({
          where: { id: order.userId },
          data: {
            is_pro: true,
            plan: order.plan,
            subscription_until: subscriptionEnd,
          },
        })

        logMidtransEvent('subscription_activated', {
          order_id,
          transaction_id,
          transaction_status,
          gross_amount: Number(gross_amount),
        }, { userId: order.userId })
      }
    }

    const duration = Math.round(performance.now() - startTime)
    logger.info('Midtrans webhook processed', { order_id, status: appStatus, ms: duration })

    return NextResponse.json({ success: true })
  } catch (error) {
    logger.error('Midtrans webhook error', error, { ms: Math.round(performance.now() - startTime) })
    return handleApiError(error, { endpoint: '/api/midtrans/webhook' })
  }
}
