import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { verifyCallbackSignature } from '@/lib/payment/sakura'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/**
 * POST /api/payment/callback
 * Webhook from SakuraPay when payment status changes
 *
 * Headers:
 *   X-Callback-Signature: HMAC-SHA256(json_body, api_key)
 *   X-Callback-Event: payment_status
 *   Content-Type: application/json
 *
 * Body:
 * {
 *   "trx_id": "SBXFsYv6tlHl-Tm8faWdA5-Jj0jXfb785",
 *   "merchant_ref": "575yhh-7967686gD",
 *   "status": "berhasil",       // pending, berhasil, expired
 *   "status_kode": 1           // 0=pending, 1=berhasil, 2=expired
 * }
 */
export async function POST(request: NextRequest) {
  try {
    // Get raw body for signature verification
    const rawBody = await request.text()
    const callbackSignature = request.headers.get('X-Callback-Signature') || ''
    const callbackEvent = request.headers.get('X-Callback-Event') || ''

    console.log('📩 [SakuraPay Callback] Received event:', callbackEvent)

    // Verify signature
    if (!verifyCallbackSignature(rawBody, callbackSignature)) {
      console.error('❌ [SakuraPay Callback] Invalid signature')
      return NextResponse.json({ success: false, message: 'Invalid signature' }, { status: 400 })
    }

    // Parse body
    const data = JSON.parse(rawBody)
    console.log('📩 [SakuraPay Callback] Body:', JSON.stringify(data).substring(0, 500))

    const trxId = data.trx_id || ''
    const merchantRef = data.merchant_ref || ''
    const status = data.status || '' // "berhasil", "pending", "expired"
    const statusKode = data.status_kode // 0=pending, 1=berhasil, 2=expired

    console.log('📩 [SakuraPay Callback] Parsed:', {
      trxId,
      merchantRef,
      status,
      statusKode,
    })

    // Map SakuraPay status to our status
    const isSuccess = status === 'berhasil' || statusKode === 1
    const isExpired = status === 'expired' || statusKode === 2
    const ourStatus = isSuccess ? 'SUCCESS' : isExpired ? 'EXPIRED' : 'PENDING'

    if (!merchantRef) {
      console.error('❌ [SakuraPay Callback] No merchant_ref in callback')
      return NextResponse.json({ success: false, message: 'No merchant_ref' }, { status: 400 })
    }

    // Check if we already processed this transaction
    try {
      const existingOrder = await db.paymentOrder.findUnique({
        where: { invoiceNumber: merchantRef },
      })

      if (existingOrder && existingOrder.status === 'SUCCESS') {
        console.log('✅ [SakuraPay Callback] Already processed:', merchantRef)
        return NextResponse.json({ success: true, message: 'Already processed' })
      }

      if (existingOrder) {
        // Update existing order
        await db.paymentOrder.update({
          where: { invoiceNumber: merchantRef },
          data: {
            status: ourStatus,
            dokuTransactionId: trxId || existingOrder.dokuTransactionId,
            paidAt: isSuccess ? new Date() : null,
          },
        })

        // If payment successful, upgrade user
        if (isSuccess && existingOrder.userId) {
          await activateSubscription(existingOrder.userId, existingOrder.plan, existingOrder.durationMonths)
        }

        console.log(`✅ [SakuraPay Callback] Order updated: ${merchantRef} → ${ourStatus}`)
      } else {
        console.warn('⚠️ [SakuraPay Callback] Order not found in DB:', merchantRef)
      }
    } catch (dbError: any) {
      if (dbError.code === 'P2021' || dbError.code === 'P1001' || dbError.message?.includes('does not exist')) {
        console.warn('⚠️ [SakuraPay Callback] payment_orders table not found, skipping DB operations')
      } else {
        throw dbError
      }
    }

    // SakuraPay expects success response
    return NextResponse.json({ success: true, message: 'Callback processed' })
  } catch (error: any) {
    console.error('❌ [SakuraPay Callback] Error:', error.message)
    // Still return 200 to prevent SakuraPay from retrying with errors
    return NextResponse.json({ success: false, message: error.message })
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

  console.log(`🎉 [SakuraPay Callback] Activated ${plan} for user ${userId} until ${endDate.toISOString()}`)

  // Also sync to Supabase Auth metadata
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
      console.log('✅ [SakuraPay Callback] Also synced Auth metadata')
    }
  } catch (syncErr) {
    console.warn('⚠️ [SakuraPay Callback] Failed to sync Auth metadata (non-critical):', syncErr)
  }
}

/**
 * GET /api/payment/callback
 * Health check endpoint
 */
export async function GET() {
  return NextResponse.json({ status: 'OK', message: 'SakuraPay callback endpoint is active' })
}
