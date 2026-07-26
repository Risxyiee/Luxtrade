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
    const contentType = request.headers.get('content-type') || ''

    // ===== STRUCTURED LOGGING (no secrets) =====
    console.log('📩 [SakuraPay Callback] REQUEST RECEIVED', {
      hasSignature: !!callbackSignature,
      event: callbackEvent || '(EMPTY)',
      contentType,
      bodyLength: rawBody.length,
      env: process.env.SAKURA_ENV || 'sandbox',
    })

    // Check callback event type — must be payment_status
    if (callbackEvent !== 'payment_status') {
      console.error('❌ [Callback] Unrecognized callback event:', callbackEvent)
      // Don't reject — SakuraPay sandbox may send different events
      // Only log a warning
    }

    // ===== SIGNATURE VERIFICATION =====
    // SECURITY: In production (SAKURA_ENV=production), signature is REQUIRED.
    // Without this, attackers could POST fake payment notifications and get
    // free PRO subscriptions. Sandbox mode still allows skip for dev/testing.
    const isSandbox = process.env.SAKURA_ENV !== 'production' // fail-safe: treat unknown as sandbox
    const skipSignatureCheck = isSandbox

    if (skipSignatureCheck) {
      // Sandbox only — log loudly so we never accidentally run prod this way
      console.warn('⚠️ [Callback] Signature verification SKIPPED (sandbox mode). DO NOT use in production.')
    } else {
      // Production mode — signature is MANDATORY
      if (!callbackSignature) {
        console.error('🚨 [Callback] REJECTED: No X-Callback-Signature header in production mode')
        return NextResponse.json(
          { success: false, message: 'Missing signature' },
          { status: 401 }
        )
      }

      if (!verifyCallbackSignature(rawBody, callbackSignature)) {
        console.error('🚨 [Callback] REJECTED: Signature mismatch')
        // Log expected vs received for debugging (server-side only, not in response)
        const crypto = await import('crypto')
        const apiKey = process.env.SAKURA_API_KEY || ''
        if (apiKey) {
          const expected = crypto.createHmac('sha256', apiKey).update(rawBody).digest('hex')
          console.error('   Expected:', expected.substring(0, 16) + '...')
          console.error('   Received:', callbackSignature.substring(0, 16) + '...')
        } else {
          console.error('🚨 [Callback] SAKURA_API_KEY is not set! Cannot verify signature.')
        }
        return NextResponse.json(
          { success: false, message: 'Invalid signature' },
          { status: 401 }
        )
      }
      console.log('✅ [Callback] Signature verified OK')
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
    // Use BOTH status string AND status_kode for safety, but also accept either alone
    const isSuccess = status === 'berhasil' || Number(statusKode) === 1
    const isExpired = status === 'expired' || Number(statusKode) === 2
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

      // RACE CONDITION FIX: Use updateMany with conditional WHERE clause to ensure
      // only ONE request can transition an order to SUCCESS atomically.
      // If another concurrent request already set it to SUCCESS, count will be 0
      // and we skip activation (preventing duplicate subscription records).
      if (isSuccess) {
        const updateResult = await db.paymentOrder.updateMany({
          where: {
            invoiceNumber: merchantRef,
            status: { not: 'SUCCESS' }, // Only update if not already SUCCESS
          },
          data: {
            status: 'SUCCESS',
            dokuTransactionId: trxId || existingOrder.dokuTransactionId,
            paidAt: new Date(),
            paymentChannel: data.payment_kode || existingOrder.paymentChannel,
          },
        })

        if (updateResult.count === 0) {
          // Another request already processed this order — skip activation
          console.log('✅ [Callback] Order already processed by concurrent request:', merchantRef)
          return NextResponse.json({ success: true, message: 'Already processed' })
        }

        console.log('✅ [Callback] Order atomically transitioned to SUCCESS:', merchantRef)

        // Now safe to activate — only one request reaches here
        if (existingOrder.userId) {
          await activateSubscription(existingOrder.userId, existingOrder.plan, existingOrder.durationMonths)
        }
      } else {
        // Non-success status (PENDING / EXPIRED) — safe to update normally
        await db.paymentOrder.update({
          where: { invoiceNumber: merchantRef },
          data: {
            status: ourStatus,
            dokuTransactionId: trxId || existingOrder.dokuTransactionId,
            paymentChannel: data.payment_kode || existingOrder.paymentChannel,
          },
        })
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
    // Still return 200 to prevent SakuraPay from retrying with errors,
    // but do NOT leak internal error details to the caller.
    return NextResponse.json({ success: false, message: 'Internal error processing callback' })
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
 * Minimal health check — no config leak.
 */
export async function GET() {
  return NextResponse.json({
    status: 'OK',
    message: 'SakuraPay callback endpoint is active',
    env: process.env.SAKURA_ENV || 'sandbox',
  })
}
