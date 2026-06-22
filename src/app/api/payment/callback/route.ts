import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { verifyCallbackSignature, getSakuraConfig } from '@/lib/payment/sakura'

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
    const contentType = request.headers.get('content-type') || ''

    // ===== COMPREHENSIVE DEBUG LOGGING =====
    console.log('═══════════════════════════════════════════')
    console.log('📩 [SakuraPay Callback] REQUEST RECEIVED')
    console.log('📩 [Callback] Headers:')
    console.log('   X-Callback-Signature:', callbackSignature ? `${callbackSignature.substring(0, 20)}...` : '(EMPTY)')
    console.log('   X-Callback-Event:', callbackEvent || '(EMPTY)')
    console.log('   Content-Type:', contentType)
    console.log('📩 [Callback] Raw Body:', rawBody.substring(0, 500))
    console.log('📩 [Callback] Body Length:', rawBody.length)

    // Log SakuraPay config status
    const sakuraConfig = getSakuraConfig()
    console.log('📩 [Callback] SakuraPay Config:', {
      apiIdSet: !!process.env.SAKURA_API_ID,
      apiKeySet: !!process.env.SAKURA_API_KEY,
      apiKeyLen: process.env.SAKURA_API_KEY?.length || 0,
      callbackUrl: process.env.SAKURA_CALLBACK_URL || '(NOT SET)',
      env: process.env.SAKURA_ENV || 'sandbox',
    })

    // Check callback event type — must be payment_status
    if (callbackEvent !== 'payment_status') {
      console.error('❌ [Callback] Unrecognized callback event:', callbackEvent)
      // Don't reject — SakuraPay sandbox may send different events
      // Only log a warning
    }

    // ===== SIGNATURE VERIFICATION =====
    const skipSignatureCheck = process.env.SAKURA_SKIP_SIGNATURE === 'true'

    if (!skipSignatureCheck) {
      if (!verifyCallbackSignature(rawBody, callbackSignature)) {
        // Debug: recompute expected signature to show mismatch
        const crypto = await import('crypto')
        const apiKey = process.env.SAKURA_API_KEY || ''
        if (apiKey) {
          const expected = crypto.createHmac('sha256', apiKey).update(rawBody).digest('hex')
          console.error('❌ [Callback] SIGNATURE MISMATCH!')
          console.error('   Expected:', expected)
          console.error('   Received:', callbackSignature)
          console.error('   Body used for HMAC:', rawBody.substring(0, 200))
        } else {
          console.error('❌ [Callback] SAKURA_API_KEY is not set! Cannot verify signature.')
          console.error('   Please set SAKURA_API_KEY in Vercel Environment Variables.')
        }
        return NextResponse.json({ success: false, message: 'Invalid signature' }, { status: 400 })
      }
      console.log('✅ [Callback] Signature verified OK')
    } else {
      console.log('⚠️ [Callback] Signature verification SKIPPED (SAKURA_SKIP_SIGNATURE=true)')
    }

    // Parse body
    let data: any
    try {
      data = JSON.parse(rawBody)
    } catch (parseErr) {
      console.error('❌ [Callback] Failed to parse body as JSON:', parseErr)
      return NextResponse.json({ success: false, message: 'Invalid JSON body' }, { status: 400 })
    }

    console.log('📩 [Callback] Parsed data:', {
      trx_id: data.trx_id,
      merchant_ref: data.merchant_ref,
      status: data.status,
      status_kode: data.status_kode,
      amount: data.total,
      payment_kode: data.payment_kode,
      via: data.via,
    })

    const trxId = data.trx_id || ''
    const merchantRef = data.merchant_ref || ''
    const status = data.status || '' // "berhasil", "pending", "expired"
    const statusKode = data.status_kode // 0=pending, 1=berhasil, 2=expired

    // Map SakuraPay status to our internal status
    const isSuccess = status === 'berhasil' && Number(statusKode) === 1
    const isExpired = status === 'expired' && Number(statusKode) === 2
    const ourStatus = isSuccess ? 'SUCCESS' : isExpired ? 'EXPIRED' : 'PENDING'

    console.log('📩 [Callback] Status mapping:', {
      raw: `${status} + ${statusKode}`,
      isSuccess,
      isExpired,
      ourStatus,
    })

    if (!merchantRef) {
      console.error('❌ [Callback] No merchant_ref in callback')
      return NextResponse.json({ success: false, message: 'No merchant_ref' }, { status: 400 })
    }

    // ===== DATABASE UPDATE =====
    try {
      const existingOrder = await db.paymentOrder.findUnique({
        where: { invoiceNumber: merchantRef },
      })

      if (!existingOrder) {
        console.warn('⚠️ [Callback] Order not found in DB for merchant_ref:', merchantRef)
        console.warn('⚠️ [Callback] This means the create-order API did not save to DB.')
        // Still return success so SakuraPay doesn't retry
        return NextResponse.json({ success: true, message: 'Callback processed (order not found)' })
      }

      console.log('📩 [Callback] Found order:', {
        id: existingOrder.id,
        invoiceNumber: existingOrder.invoiceNumber,
        currentStatus: existingOrder.status,
        userId: existingOrder.userId,
        amount: existingOrder.amount,
        plan: existingOrder.plan,
      })

      if (existingOrder.status === 'SUCCESS') {
        console.log('✅ [Callback] Already processed (status=SUCCESS):', merchantRef)
        return NextResponse.json({ success: true, message: 'Already processed' })
      }

      // Update existing order
      const updatedOrder = await db.paymentOrder.update({
        where: { invoiceNumber: merchantRef },
        data: {
          status: ourStatus,
          dokuTransactionId: trxId || existingOrder.dokuTransactionId,
          paidAt: isSuccess ? new Date() : null,
          paymentChannel: data.payment_kode || existingOrder.paymentChannel,
        },
      })

      console.log('✅ [Callback] Order updated:', {
        invoiceNumber: updatedOrder.invoiceNumber,
        oldStatus: existingOrder.status,
        newStatus: updatedOrder.status,
        paidAt: updatedOrder.paidAt,
      })

      // If payment successful, upgrade user
      if (isSuccess && existingOrder.userId) {
        await activateSubscription(existingOrder.userId, existingOrder.plan, existingOrder.durationMonths)
      }

      console.log('✅ [Callback] FULLY PROCESSED:', merchantRef, '→', ourStatus)
    } catch (dbError: any) {
      console.error('❌ [Callback] Database error:', dbError.message)
      console.error('❌ [Callback] DB Error code:', dbError.code)
      if (dbError.code === 'P2021' || dbError.code === 'P1001' || dbError.message?.includes('does not exist')) {
        console.warn('⚠️ [Callback] payment_orders table not found — DB not migrated')
      } else {
        throw dbError
      }
    }

    console.log('═══════════════════════════════════════════')

    // SakuraPay expects success response
    return NextResponse.json({ success: true, message: 'Callback processed' })
  } catch (error: any) {
    console.error('═══════════════════════════════════════════')
    console.error('❌ [SakuraPay Callback] FATAL ERROR:', error.message)
    console.error('❌ [Callback] Stack:', error.stack?.substring(0, 500))
    console.error('═══════════════════════════════════════════')
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

  console.log(`🎉 [Callback] Activated ${plan} for user ${userId} until ${endDate.toISOString()}`)

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
      console.log('✅ [Callback] Also synced Auth metadata')
    }
  } catch (syncErr) {
    console.warn('⚠️ [Callback] Failed to sync Auth metadata (non-critical):', syncErr)
  }
}

/**
 * GET /api/payment/callback
 * Health check + config debug
 */
export async function GET() {
  const sakuraConfig = getSakuraConfig()
  return NextResponse.json({
    status: 'OK',
    message: 'SakuraPay callback endpoint is active',
    config: sakuraConfig,
    envCheck: {
      SAKURA_API_ID_SET: !!process.env.SAKURA_API_ID,
      SAKURA_API_KEY_SET: !!process.env.SAKURA_API_KEY,
      SAKURA_API_KEY_LEN: process.env.SAKURA_API_KEY?.length || 0,
      SAKURA_CALLBACK_URL: process.env.SAKURA_CALLBACK_URL || '(not set)',
      SAKURA_ENV: process.env.SAKURA_ENV || 'sandbox',
    },
    tip: 'If SAKURA_API_KEY is not set, add it in Vercel Environment Variables and redeploy.',
  })
}
