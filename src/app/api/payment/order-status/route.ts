import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { createClientForApi } from '@/lib/supabase/server'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/**
 * GET /api/payment/order-status?invoiceNumber=xxx
 * Returns the current status of a payment order.
 * Used by the frontend to poll for payment completion.
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

    return NextResponse.json({
      status: order.status,           // PENDING, SUCCESS, FAILED, EXPIRED
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
      { error: error.message || 'Failed to check order status' },
      { status: 500 }
    )
  }
}
