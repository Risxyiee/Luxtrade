import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getAuthUser } from '@/lib/api-auth'

// Helper function to check if user is admin
async function isAdmin(userId: string): Promise<boolean> {
  try {
    const profile = await db.profile.findUnique({
      where: { id: userId },
      select: { role: true },
    })
    return profile?.role === 'ADMIN' || profile?.role === 'SUPER_ADMIN'
  } catch (error) {
    console.error('Error checking admin status:', error)
    return false
  }
}

// GET /api/admin/affiliate-withdrawals - Get all pending withdrawals (admin only)
export async function GET(request: NextRequest) {
  try {
    const authUser = await getAuthUser(request)
    if (!authUser) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    if (!(await isAdmin(authUser.id))) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const status = new URL(request.url).searchParams.get('status')

    const where: { status?: string } = {}
    if (status) {
      where.status = status
    } else {
      where.status = 'REQUESTED'
    }

    const withdrawals = await db.affiliateWithdrawal.findMany({
      where,
      orderBy: { requestedAt: 'asc' },
      include: {
        affiliate: {
          select: { userId: true, referralCode: true },
        },
      },
    })

    // Enrich with affiliate user email
    const enrichedWithdrawals = await Promise.all(
      withdrawals.map(async (withdrawal) => {
        const profile = await db.profile.findUnique({
          where: { id: withdrawal.affiliate.userId },
          select: { email: true, full_name: true },
        })

        return {
          id: withdrawal.id,
          affiliateId: withdrawal.affiliateId,
          userId: withdrawal.affiliate.userId,
          email: profile?.email || null,
          name: profile?.full_name || null,
          referralCode: withdrawal.affiliate.referralCode,
          amount: withdrawal.amount,
          status: withdrawal.status,
          bankAccountInfo: withdrawal.bankAccountInfo,
          requestedAt: withdrawal.requestedAt,
          paidAt: withdrawal.paidAt,
        }
      })
    )

    return NextResponse.json({ withdrawals: enrichedWithdrawals })
  } catch (error) {
    console.error('Admin affiliate withdrawals GET error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// POST /api/admin/affiliate-withdrawals - Mark a withdrawal as paid (admin only)
export async function POST(request: NextRequest) {
  try {
    const authUser = await getAuthUser(request)
    if (!authUser) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    if (!(await isAdmin(authUser.id))) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const body = await request.json()
    const { withdrawalId } = body as { withdrawalId: string }

    if (!withdrawalId || typeof withdrawalId !== 'string') {
      return NextResponse.json(
        { error: 'withdrawalId is required' },
        { status: 400 }
      )
    }

    // Find the withdrawal
    const withdrawal = await db.affiliateWithdrawal.findUnique({
      where: { id: withdrawalId },
      include: { affiliate: true },
    })

    if (!withdrawal) {
      return NextResponse.json(
        { error: 'Withdrawal not found' },
        { status: 404 }
      )
    }

    if (withdrawal.status !== 'REQUESTED') {
      return NextResponse.json(
        { error: `Cannot process withdrawal with status: ${withdrawal.status}` },
        { status: 400 }
      )
    }

    // Update withdrawal to PAID and increment affiliate's totalPaid in a transaction
    const updatedWithdrawal = await db.$transaction(async (tx) => {
      const updated = await tx.affiliateWithdrawal.update({
        where: { id: withdrawalId },
        data: {
          status: 'PAID',
          paidAt: new Date(),
        },
      })

      // Increment totalPaid on the affiliate record
      await tx.affiliate.update({
        where: { id: withdrawal.affiliateId },
        data: { totalPaid: { increment: withdrawal.amount } },
      })

      return updated
    })

    return NextResponse.json({
      success: true,
      withdrawal: {
        id: updatedWithdrawal.id,
        amount: updatedWithdrawal.amount,
        status: updatedWithdrawal.status,
        paidAt: updatedWithdrawal.paidAt,
      },
    })
  } catch (error) {
    console.error('Admin affiliate withdrawals POST error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}