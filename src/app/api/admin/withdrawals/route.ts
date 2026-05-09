import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { sendTelegramNotification } from '@/lib/telegram'

const ADMIN_EMAIL = 'luxtradee@gmail.com'

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const adminEmail = searchParams.get('adminEmail')

    if (adminEmail !== ADMIN_EMAIL) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })
    }

    const status = searchParams.get('status')

    const where: any = {}
    if (status) {
      where.status = status
    }

    const withdrawals = await db.withdrawal.findMany({
      where,
      orderBy: { createdAt: 'desc' },
    })

    return NextResponse.json({ success: true, withdrawals })
  } catch (error) {
    console.error('Admin withdrawals GET error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const body = await request.json()
    const { adminEmail, withdrawalId, status, adminNote } = body

    if (adminEmail !== ADMIN_EMAIL) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })
    }

    if (!withdrawalId || !status || !['approved', 'rejected'].includes(status)) {
      return NextResponse.json({ error: 'Invalid parameters' }, { status: 400 })
    }

    const withdrawal = await db.withdrawal.findUnique({
      where: { id: withdrawalId },
    })

    if (!withdrawal) {
      return NextResponse.json({ error: 'Withdrawal not found' }, { status: 404 })
    }

    // Update withdrawal status
    const updated = await db.withdrawal.update({
      where: { id: withdrawalId },
      data: { status, adminNote: adminNote || null, updatedAt: new Date() },
    })

    // If rejected, refund the balance
    if (status === 'rejected') {
      await db.affiliateProfile.update({
        where: { userId: withdrawal.userId },
        data: { affiliateBalance: { increment: withdrawal.amount } },
      })
    }

    // Send Telegram notification
    const statusEmoji = status === 'approved' ? '✅' : '❌'
    const msg = `${statusEmoji} <b>PENARIKAN SALDO ${status === 'approved' ? 'APPROVED' : 'DITOLAK'}</b>\n\n👤 ${withdrawal.fullName}\n📧 ${withdrawal.email}\n💵 Rp${withdrawal.amount.toLocaleString('id-ID')}\n🏦 ${withdrawal.bankName} - ${withdrawal.bankAccount}\n\n${adminNote ? `📝 Catatan: ${adminNote}\n\n` : ''}⏰ ${new Date().toLocaleString('id-ID')}`
    await sendTelegramNotification(msg)

    return NextResponse.json({ success: true, withdrawal: updated })
  } catch (error) {
    console.error('Admin withdrawal PATCH error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
