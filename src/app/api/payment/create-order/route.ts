import { NextRequest, NextResponse } from 'next/server'
import { createClientForApi } from '@/lib/supabase/server'
import { db } from '@/lib/db'
import { createDokuOrder, getDokuConfig } from '@/lib/payment/doku'
import crypto from 'crypto'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/**
 * POST /api/payment/create-order
 * Body: { amount: number, plan: string, durationMonths?: number }
 * Returns: { paymentUrl, orderId, invoiceNumber }
 */
export async function POST(request: NextRequest) {
  try {
    // Get authenticated user
    const { supabase } = createClientForApi(request)
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Parse request body
    const body = await request.json()
    const { amount, plan, durationMonths } = body

    if (!amount || amount < 1) {
      return NextResponse.json({ error: 'Amount is required and must be > 0' }, { status: 400 })
    }

    if (!plan || !['PRO', 'LIFETIME'].includes(plan)) {
      return NextResponse.json({ error: 'Plan must be PRO or LIFETIME' }, { status: 400 })
    }

    // Check DOKU config
    const dokuConfig = getDokuConfig()
    if (!dokuConfig.configured) {
      console.error('❌ [Payment] DOKU not configured:', dokuConfig)
      return NextResponse.json(
        { error: 'Payment gateway not configured', config: dokuConfig },
        { status: 503 }
      )
    }

    // Generate unique invoice number
    const timestamp = Date.now()
    const random = crypto.randomBytes(4).toString('hex').toUpperCase()
    const invoiceId = `LUX-${plan}-${timestamp}-${random}`

    // Get customer info from profile
    const profile = await db.profile.findUnique({
      where: { id: user.id },
    })

    const customerName = profile?.full_name || user.email?.split('@')[0] || 'Customer'
    const customerEmail = user.email || 'unknown@luxtradee.web.id'

    console.log('🛒 [Payment] Creating order:', {
      userId: user.id,
      email: customerEmail,
      amount,
      plan,
      invoiceId,
    })

    // Create order in DB first (status: PENDING)
    try {
      const order = await db.paymentOrder.create({
        data: {
          userId: user.id,
          invoiceNumber: invoiceId,
          amount,
          plan,
          durationMonths: durationMonths || null,
          status: 'PENDING',
          customerName,
          customerEmail,
          // Order expires in 24 hours
          expiredAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
        },
      })

      // Create DOKU payment
      const dokuResult = await createDokuOrder({
        amount,
        invoiceId,
        customerName,
        customerEmail,
        plan,
        durationMonths,
      })

      // Update order with DOKU details
      await db.paymentOrder.update({
        where: { id: order.id },
        data: {
          dokuPaymentUrl: dokuResult.paymentUrl,
          dokuTransactionId: dokuResult.orderId,
        },
      })

      console.log('✅ [Payment] Order created:', {
        orderId: order.id,
        invoiceId,
        paymentUrl: dokuResult.paymentUrl?.substring(0, 50) + '...',
      })

      return NextResponse.json({
        success: true,
        paymentUrl: dokuResult.paymentUrl,
        orderId: order.id,
        invoiceNumber: invoiceId,
        amount,
        plan,
        expiresAt: order.expiredAt,
      })
    } catch (dbError: any) {
      // If table doesn't exist yet (not migrated), create DOKU order without DB save
      if (dbError.code === 'P2021' || dbError.code === 'P1001' || dbError.message?.includes('does not exist')) {
        console.warn('⚠️ [Payment] payment_orders table not found, creating DOKU order without DB save')

        const dokuResult = await createDokuOrder({
          amount,
          invoiceId,
          customerName,
          customerEmail,
          plan,
          durationMonths,
        })

        return NextResponse.json({
          success: true,
          paymentUrl: dokuResult.paymentUrl,
          orderId: dokuResult.orderId,
          invoiceNumber: invoiceId,
          amount,
          plan,
          warning: 'Payment created but local DB save skipped',
        })
      }

      throw dbError
    }
  } catch (error: any) {
    console.error('❌ [Payment] Create order error:', error.message)
    return NextResponse.json(
      { error: error.message || 'Failed to create payment order' },
      { status: 500 }
    )
  }
}

/**
 * GET /api/payment/create-order
 * Returns DOKU config status (for debugging)
 */
export async function GET() {
  return NextResponse.json(getDokuConfig())
}
