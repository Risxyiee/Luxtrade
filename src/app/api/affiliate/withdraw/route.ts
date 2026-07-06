import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getAuthUser } from '@/lib/api-auth'

const MIN_WITHDRAWAL = 100000 // Rp100.000

// POST /api/affiliate/withdraw - Request a withdrawal
export async function POST(request: NextRequest) {
  try {
    const authUser = await getAuthUser(request)
    if (!authUser) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const { amount, bankAccountInfo } = body as {
      amount: number
      bankAccountInfo: string
    }

    // Validate input
    if (!amount || typeof amount !== 'number' || amount <= 0) {
      return NextResponse.json(
        { error: 'Invalid withdrawal amount' },
        { status: 400 }
      )
    }

    if (!bankAccountInfo || typeof bankAccountInfo !== 'string' || bankAccountInfo.trim().length === 0) {
      return NextResponse.json(
        { error: 'Bank account information is required' },
        { status: 400 }
      )
    }

    // Find the affiliate record
    const affiliate = await db.affiliate.findUnique({
      where: { userId: authUser.id },
    })

    if (!affiliate) {
      return NextResponse.json(
        { error: 'No affiliate account found' },
        { status: 404 }
      )
    }

    // Validate minimum withdrawal
    if (amount < MIN_WITHDRAWAL) {
      return NextResponse.json(
        { error: `Minimum withdrawal is Rp${MIN_WITHDRAWAL.toLocaleString('id-ID')}` },
        { status: 400 }
      )
    }

    // Validate sufficient balance
    if (amount > affiliate.currentBalance) {
      return NextResponse.json(
        { error: `Insufficient balance. Current balance: Rp${affiliate.currentBalance.toLocaleString('id-ID')}` },
        { status: 400 }
      )
    }

    // Create withdrawal and deduct balance in a transaction
    const withdrawal = await db.$transaction(async (tx) => {
      // Create the withdrawal request
      const newWithdrawal = await tx.affiliateWithdrawal.create({
        data: {
          affiliateId: affiliate.id,
          amount,
          bankAccountInfo: bankAccountInfo.trim(),
          status: 'REQUESTED',
        },
      })

      // Deduct from current balance
      await tx.affiliate.update({
        where: { id: affiliate.id },
        data: { currentBalance: { decrement: amount } },
      })

      return newWithdrawal
    })

    return NextResponse.json({
      success: true,
      withdrawal: {
        id: withdrawal.id,
        amount: withdrawal.amount,
        status: withdrawal.status,
        requestedAt: withdrawal.requestedAt,
      },
    })
  } catch (error) {
    console.error('Affiliate withdraw POST error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// GET /api/affiliate/withdraw - Get user's withdrawal history
export async function GET(request: NextRequest) {
  try {
    const authUser = await getAuthUser(request)
    if (!authUser) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Find the affiliate record
    const affiliate = await db.affiliate.findUnique({
      where: { userId: authUser.id },
    })

    if (!affiliate) {
      return NextResponse.json({ withdrawals: [] })
    }

    // Get all withdrawals for this affiliate
    const withdrawals = await db.affiliateWithdrawal.findMany({
      where: { affiliateId: affiliate.id },
      orderBy: { requestedAt: 'desc' },
    })

    return NextResponse.json({
      withdrawals: withdrawals.map((w) => ({
        id: w.id,
        amount: w.amount,
        status: w.status,
        bankAccountInfo: w.bankAccountInfo,
        requestedAt: w.requestedAt,
        paidAt: w.paidAt,
      })),
    })
  } catch (error) {
    console.error('Affiliate withdraw GET error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}