import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { notifyWithdrawalRequest } from '@/lib/telegram'

const WITHDRAWAL_MIN = 50000

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { userId, email, fullName, amount, bankName, bankAccount, bankHolder } = body

    // Validate
    if (!userId || !amount || !bankName || !bankAccount || !bankHolder) {
      return NextResponse.json({ error: 'Semua field wajib diisi' }, { status: 400 })
    }

    if (amount < WITHDRAWAL_MIN) {
      return NextResponse.json({ error: `Minimal penarikan Rp${WITHDRAWAL_MIN.toLocaleString('id-ID')}` }, { status: 400 })
    }

    // Check affiliate balance
    const affiliate = await db.affiliateProfile.findUnique({
      where: { userId },
    })

    if (!affiliate) {
      return NextResponse.json({ error: 'Profil afiliasi tidak ditemukan' }, { status: 404 })
    }

    if (affiliate.affiliateBalance < amount) {
      return NextResponse.json({ error: 'Saldo komisi tidak mencukupi' }, { status: 400 })
    }

    // Create withdrawal record
    const withdrawal = await db.withdrawal.create({
      data: {
        userId,
        email: email || affiliate.email,
        fullName: fullName || affiliate.fullName,
        amount,
        bankName,
        bankAccount,
        bankHolder,
        status: 'pending',
      },
    })

    // Deduct balance
    await db.affiliateProfile.update({
      where: { userId },
      data: { affiliateBalance: { decrement: amount } },
    })

    // Send Telegram notification to admin
    await notifyWithdrawalRequest(
      fullName || affiliate.fullName || '',
      email || affiliate.email,
      amount,
      bankName,
      bankAccount,
      bankHolder
    )

    return NextResponse.json({
      success: true,
      withdrawal,
      newBalance: affiliate.affiliateBalance - amount,
    })
  } catch (error) {
    console.error('Withdrawal POST error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function GET(request: NextRequest) {
  try {
    const userId = request.headers.get('x-user-id')
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const withdrawals = await db.withdrawal.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
    })

    return NextResponse.json({ success: true, withdrawals })
  } catch (error) {
    console.error('Withdrawal GET error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
