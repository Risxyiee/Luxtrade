import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import crypto from 'crypto'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/**
 * POST /api/payment/callback-debug
 * Manual trigger for testing callback flow — simulates SakuraPay callback
 *
 * Body: { invoiceNumber: string, status?: 'berhasil'|'pending'|'expired', status_kode?: number }
 *
 * This endpoint:
 * 1. Finds the order by invoiceNumber
 * 2. Updates status to SUCCESS (if berhasil)
 * 3. Activates subscription
 *
 * SECURITY: Only works in development or with admin auth
 */
export async function POST(request: NextRequest) {
  try {
    // Only allow in development or with debug key
    const isDev = process.env.NODE_ENV === 'development'
    const debugKey = request.headers.get('X-Debug-Key') || ''
    if (!isDev && debugKey !== 'luxtrade-debug-2024') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const body = await request.json()
    const { invoiceNumber, status = 'berhasil', status_kode = 1 } = body

    if (!invoiceNumber) {
      return NextResponse.json({ error: 'invoiceNumber is required' }, { status: 400 })
    }

    console.log('🔧 [Callback Debug] Manual trigger:', { invoiceNumber, status, status_kode })

    // Find order
    const existingOrder = await db.paymentOrder.findUnique({
      where: { invoiceNumber },
    })

    if (!existingOrder) {
      console.warn('🔧 [Callback Debug] Order not found:', invoiceNumber)
      return NextResponse.json({ error: 'Order not found', invoiceNumber }, { status: 404 })
    }

    console.log('🔧 [Callback Debug] Found order:', {
      id: existingOrder.id,
      status: existingOrder.status,
      userId: existingOrder.userId,
      plan: existingOrder.plan,
      amount: existingOrder.amount,
    })

    const isSuccess = status === 'berhasil' && Number(status_kode) === 1
    const ourStatus = isSuccess ? 'SUCCESS' : status === 'expired' ? 'EXPIRED' : 'PENDING'

    // Update order
    const updatedOrder = await db.paymentOrder.update({
      where: { invoiceNumber },
      data: {
        status: ourStatus,
        paidAt: isSuccess ? new Date() : null,
      },
    })

    console.log('🔧 [Callback Debug] Updated order:', {
      oldStatus: existingOrder.status,
      newStatus: updatedOrder.status,
      paidAt: updatedOrder.paidAt,
    })

    // Activate subscription if success
    if (isSuccess && existingOrder.userId) {
      const months = existingOrder.durationMonths || (existingOrder.plan === 'LIFETIME' ? 1200 : 1)
      const startDate = new Date()
      const endDate = new Date(startDate.getFullYear(), startDate.getMonth() + months, startDate.getDate(), 23, 59, 59, 999)

      await db.profile.update({
        where: { id: existingOrder.userId },
        data: {
          plan: existingOrder.plan === 'LIFETIME' ? 'LIFETIME' : 'PRO',
          is_pro: true,
          subscription_until: endDate,
          proExpiry: endDate,
        },
      })

      await db.userSubscription.create({
        data: {
          userId: existingOrder.userId,
          plan: existingOrder.plan,
          status: 'active',
          startDate,
          endDate,
          discountPercent: 0,
        },
      }).catch(() => {})

      console.log('🔧 [Callback Debug] Activated subscription:', { userId: existingOrder.userId, plan: existingOrder.plan, until: endDate })
    }

    return NextResponse.json({
      success: true,
      message: 'Callback debug processed',
      invoiceNumber,
      orderStatus: updatedOrder.status,
      paidAt: updatedOrder.paidAt,
      previousStatus: existingOrder.status,
    })
  } catch (error: any) {
    console.error('🔧 [Callback Debug] Error:', error.message)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

/**
 * GET /api/payment/callback-debug
 * Check recent orders for debugging
 */
export async function GET() {
  try {
    const isDev = process.env.NODE_ENV === 'development'
    const debugKey = new URL(process.env.APP_URL || 'http://localhost:3000').searchParams.get('debug') === 'true'
    if (!isDev && !debugKey) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    // Get recent orders
    const orders = await db.paymentOrder.findMany({
      orderBy: { createdAt: 'desc' },
      take: 10,
      select: {
        id: true,
        invoiceNumber: true,
        amount: true,
        status: true,
        plan: true,
        paymentMethod: true,
        paidAt: true,
        createdAt: true,
        expiredAt: true,
      },
    })

    return NextResponse.json({
      count: orders.length,
      orders,
    })
  } catch (error: any) {
    return NextResponse.json({ error: error.message, orders: [] }, { status: 500 })
  }
}
