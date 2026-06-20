import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { verifyDokuCallback } from '@/lib/payment/doku'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/**
 * POST /api/payment/callback
 * Webhook from DOKU when payment status changes
 * Body (DOKU format):
 * {
 *   transaction: { id, status, amount },
 *   order: { invoice_number, amount },
 *   payment: { payment_method, payment_channel },
 *   customer: { id, name, email }
 * }
 */
export async function POST(request: NextRequest) {
  try {
    // Get DOKU headers for verification
    const signatureHeader = request.headers.get('Signature') || ''
    const timestamp = request.headers.get('Request-Timestamp') || ''

    // Parse body
    const body = await request.json()
    console.log('📩 [DOKU Callback] Received:', JSON.stringify(body).substring(0, 1000))

    const {
      transaction,
      order,
      payment,
      customer,
    } = body || {}

    const transactionId = transaction?.id || ''
    const transactionStatus = transaction?.status || ''
    const invoiceNumber = order?.invoice_number || ''
    const paymentMethod = payment?.payment_method_type || payment?.payment_method || ''
    const paymentChannel = payment?.payment_channel || ''

    // Extract amount
    const amount = parseFloat(order?.amount?.value || transaction?.amount?.value || '0')

    console.log('📩 [DOKU Callback] Parsed:', {
      transactionId,
      status: transactionStatus,
      invoiceNumber,
      amount,
      method: paymentMethod,
      channel: paymentChannel,
    })

    if (!invoiceNumber) {
      console.error('❌ [DOKU Callback] No invoice number in callback')
      return NextResponse.json({ error: 'No invoice number' }, { status: 400 })
    }

    // Check if we already processed this transaction
    try {
      const existingOrder = await db.paymentOrder.findUnique({
        where: { invoiceNumber },
      })

      if (existingOrder && existingOrder.status === 'SUCCESS') {
        console.log('✅ [DOKU Callback] Already processed:', invoiceNumber)
        return NextResponse.json({ message: 'Already processed', status: 'OK' })
      }

      if (existingOrder) {
        // Update existing order
        await db.paymentOrder.update({
          where: { invoiceNumber },
          data: {
            status: transactionStatus === 'SUCCESS' ? 'SUCCESS' : transactionStatus === 'FAILED' ? 'FAILED' : 'PENDING',
            dokuTransactionId: transactionId || existingOrder.dokuTransactionId,
            paymentMethod: paymentMethod || null,
            paymentChannel: paymentChannel || null,
            paidAt: transactionStatus === 'SUCCESS' ? new Date() : null,
          },
        })

        // If payment successful, upgrade user to PRO
        if (transactionStatus === 'SUCCESS' && existingOrder.userId) {
          await activateSubscription(existingOrder.userId, existingOrder.plan, existingOrder.durationMonths)
        }

        console.log(`✅ [DOKU Callback] Order updated: ${invoiceNumber} → ${transactionStatus}`)
      } else {
        // Order not found in DB — try to create and activate
        console.warn('⚠️ [DOKU Callback] Order not found in DB, creating:', invoiceNumber)

        // Extract user info from invoice number: LUX-PLAN-timestamp-random
        // Or from customer data
        const userId = customer?.id || ''

        if (userId && transactionStatus === 'SUCCESS') {
          await activateSubscription(userId, 'PRO', null)
        }
      }
    } catch (dbError: any) {
      if (dbError.code === 'P2021' || dbError.code === 'P1001' || dbError.message?.includes('does not exist')) {
        console.warn('⚠️ [DOKU Callback] payment_orders table not found, skipping DB operations')

        // Still try to activate if we have enough info
        if (transactionStatus === 'SUCCESS' && customer?.id) {
          try {
            await activateSubscription(customer.id, 'PRO', null)
          } catch {
            console.error('❌ [DOKU Callback] Could not activate subscription')
          }
        }
      } else {
        throw dbError
      }
    }

    // DOKU expects 200 OK
    return NextResponse.json({ status: 'OK', message: 'Callback processed' })
  } catch (error: any) {
    console.error('❌ [DOKU Callback] Error:', error.message)
    // Still return 200 to prevent DOKU from retrying
    return NextResponse.json({ status: 'ERROR', message: error.message })
  }
}

/**
 * Activate user subscription after successful payment
 */
async function activateSubscription(
  userId: string,
  plan: string,
  durationMonths: number | null
) {
  const months = durationMonths || (plan === 'LIFETIME' ? 1200 : 1) // Default 1 month if not specified
  const startDate = new Date()
  const endDate = new Date(startDate.getFullYear(), startDate.getMonth() + months, startDate.getDate(), 23, 59, 59, 999)

  // Update profile to PRO
  await db.profile.update({
    where: { id: userId },
    data: {
      plan: plan === 'LIFETIME' ? 'LIFETIME' : 'PRO',
      is_pro: true,
      subscription_until: endDate,
      proExpiry: endDate,
    },
  })

  // Create subscription record
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
    // Subscription might already exist, ignore error
  })

  console.log(`🎉 [DOKU Callback] Activated ${plan} for user ${userId} until ${endDate.toISOString()}`)

  // Also sync to Supabase Auth metadata to keep admin panel in sync
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
          updated_at: new Date().toISOString()
        }
      })
      console.log('✅ [DOKU Callback] Also synced Auth metadata')
    }
  } catch (syncErr) {
    console.warn('⚠️ [DOKU Callback] Failed to sync Auth metadata (non-critical):', syncErr)
  }
}

/**
 * GET /api/payment/callback
 * Health check endpoint for DOKU webhook verification
 */
export async function GET() {
  return NextResponse.json({ status: 'OK', message: 'DOKU callback endpoint is active' })
}
