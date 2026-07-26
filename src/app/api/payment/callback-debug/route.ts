import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requireAdmin } from '@/lib/admin-auth'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/**
 * POST /api/payment/callback-debug
 * Admin-only: Manual trigger for testing callback flow — simulates SakuraPay callback
 *
 * Body: { invoiceNumber: string, status?: 'berhasil'|'pending'|'expired', status_kode?: number }
 *
 * SECURITY: Requires admin authentication in all environments
 */
export async function POST(request: NextRequest) {
  try {
    // SECURITY: Require admin authentication (replaces weak debug key check)
    const { error: authError } = await requireAdmin(request)
    if (authError) return authError

    const body = await request.json()
    const { invoiceNumber, status = 'berhasil', status_kode = 1 } = body

    if (!invoiceNumber) {
      return NextResponse.json({ error: 'invoiceNumber is required' }, { status: 400 })
    }

    // Find order
    const existingOrder = await db.paymentOrder.findUnique({
      where: { invoiceNumber },
    })

    if (!existingOrder) {
      return NextResponse.json({ error: 'Order not found', invoiceNumber }, { status: 404 })
    }

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
    console.error('[Callback Debug] Error:', error.message)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

/**
 * GET /api/payment/callback-debug
 * Admin-only: Check recent orders for debugging
 */
export async function GET(request: NextRequest) {
  try {
    // SECURITY: Require admin authentication (replaces weak debug key check)
    const { error: authError } = await requireAdmin(request)
    if (authError) return authError

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
    console.error('[Callback Debug GET] Error:', error.message)
    return NextResponse.json({ error: 'Internal server error', orders: [] }, { status: 500 })
  }
}