import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { createClientForApi } from '@/lib/supabase/server'
import { checkTransactionStatus, getTransactionHistory } from '@/lib/payment/sakura'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/**
 * GET /api/payment/order-status?invoiceNumber=xxx
 * Returns the current status of a payment order.
 * Used by the frontend to poll for payment completion.
 *
 * STRATEGY: Hybrid polling — if local DB still says PENDING, also check
 * SakuraPay directly (via merchant_ref in transaction history) to catch
 * cases where the callback didn't reach us.
 */
export async function GET(request: NextRequest) {
  try {
    const { supabase } = createClientForApi(request)
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const invoiceNumber = request.nextUrl.searchParams.get('invoiceNumber')

    if (!invoiceNumber) {
      return NextResponse.json({ error: 'invoiceNumber is required' }, { status: 400 })
    }

    // Check local DB
    let order = null
    try {
      order = await db.paymentOrder.findUnique({
        where: { invoiceNumber },
      })
    } catch {
      // Table might not exist
    }

    if (!order) {
      return NextResponse.json({
        status: 'UNKNOWN',
        invoiceNumber,
        message: 'Order not found in database',
      })
    }

    // If already SUCCESS/EXPIRED in our DB, return immediately (no SakuraPay check needed)
    if (order.status === 'SUCCESS' || order.status === 'EXPIRED') {
      return NextResponse.json({
        status: order.status,
        invoiceNumber: order.invoiceNumber,
        paidAt: order.paidAt ? order.paidAt.toISOString() : null,
        createdAt: order.createdAt.toISOString(),
        expiredAt: order.expiredAt ? order.expiredAt.toISOString() : null,
        paymentMethod: order.paymentMethod,
        paymentChannel: order.paymentChannel,
        plan: order.plan,
        amount: order.amount,
      })
    }

    // Order is PENDING — check SakuraPay directly as a fallback
    // This catches cases where SakuraPay callback failed to reach us
    let sakuraStatus: string | null = null
    let sakuraPaymentKode: string | null = null
    let sakuraTrxId: string | null = null

    try {
      // Method 1: Check by trx_id (if we have it)
      if (order.dokuTransactionId) {
        const trxResult = await checkTransactionStatus(order.dokuTransactionId)
        sakuraStatus = trxResult.status
        sakuraTrxId = order.dokuTransactionId
        console.log('🔍 [Order Status] SakuraPay trx check:', { trxId: order.dokuTransactionId, status: sakuraStatus })
      }

      // Method 2: Check by merchant_ref (our invoice number) via transaction history
      if (!sakuraStatus || sakuraStatus === 'pending') {
        const txHistory = await getTransactionHistory({ merchantRef: invoiceNumber })
        if (txHistory.length > 0) {
          const latestTx = txHistory[0]
          sakuraStatus = latestTx.status
          sakuraTrxId = latestTx.trx_id
          sakuraPaymentKode = latestTx.payment_kode
          console.log('🔍 [Order Status] SakuraPay history check:', { merchantRef: invoiceNumber, status: sakuraStatus, trx_id: sakuraTrxId })
        }
      }
    } catch (err: any) {
      // SakuraPay check failed — not critical, return local DB status
      console.warn('⚠️ [Order Status] SakuraPay check failed (non-blocking):', err.message)
    }

    // If SakuraPay says successful but our DB still says PENDING, update DB
    if (sakuraStatus === 'berhasil' && order.status === 'PENDING') {
      console.log('✅ [Order Status] SakuraPay confirms SUCCESS — updating local DB (callback likely missed)')

      try {
        await db.paymentOrder.update({
          where: { invoiceNumber },
          data: {
            status: 'SUCCESS',
            paidAt: new Date(),
            paymentChannel: sakuraPaymentKode || order.paymentChannel,
            dokuTransactionId: sakuraTrxId || order.dokuTransactionId,
          },
        })

        // Also activate subscription
        if (order.userId) {
          await activateSubscription(
            order.userId,
            order.plan,
            order.durationMonths,
          )
        }

        // Re-fetch to get updated data
        const updated = await db.paymentOrder.findUnique({
          where: { invoiceNumber },
        })

        if (updated) {
          order = updated
        }
      } catch (dbErr: any) {
        console.error('❌ [Order Status] Failed to update DB after SakuraPay confirmed:', dbErr.message)
      }
    }

    // If SakuraPay says expired but our DB still says PENDING
    if (sakuraStatus === 'expired' && order.status === 'PENDING') {
      console.log('⏰ [Order Status] SakuraPay confirms EXPIRED — updating local DB')
      try {
        await db.paymentOrder.update({
          where: { invoiceNumber },
          data: { status: 'EXPIRED' },
        })
        order = await db.paymentOrder.findUnique({ where: { invoiceNumber } }) || order
      } catch (dbErr: any) {
        console.error('❌ [Order Status] Failed to update DB for expired:', dbErr.message)
      }
    }

    return NextResponse.json({
      status: order.status,
      invoiceNumber: order.invoiceNumber,
      paidAt: order.paidAt ? order.paidAt.toISOString() : null,
      createdAt: order.createdAt.toISOString(),
      expiredAt: order.expiredAt ? order.expiredAt.toISOString() : null,
      paymentMethod: order.paymentMethod,
      paymentChannel: order.paymentChannel,
      plan: order.plan,
      amount: order.amount,
    })
  } catch (error: any) {
    console.error('❌ [Order Status] Error:', error.message)
    return NextResponse.json(
      { error: 'Failed to check order status' },
      { status: 500 }
    )
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
  const months = durationMonths || (plan === 'LIFETIME' ? 1200 : 1)
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
    // Subscription might already exist
  })

  console.log(`🎉 [Order Status] Activated ${plan} for user ${userId} until ${endDate.toISOString()}`)

  // Sync to Supabase Auth metadata
  try {
    const { getAdminAuth } = await import('@/lib/supabase-admin-alt')
    const authAdmin = getAdminAuth()
    if (authAdmin) {
      const { data: { user: authUser } } = await authAdmin.getUserById(userId)
      const currentMeta = authUser?.user_metadata || {}
      await authAdmin.updateUserById(userId, {
        user_metadata: {
          ...currentMeta,
          is_pro: true,
          subscription_status: 'active',
          subscription_until: endDate.toISOString(),
          has_ever_been_pro: true,
          updated_at: new Date().toISOString(),
        },
      })
      console.log('✅ [Order Status] Synced Auth metadata')
    }
  } catch (syncErr) {
    console.warn('⚠️ [Order Status] Failed to sync Auth metadata (non-critical)')
  }
}
