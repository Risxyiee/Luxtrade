import { NextRequest, NextResponse } from 'next/server'
import { notifyPaymentConfirmation } from '@/lib/admin-notify'
import { PRICING, formatRupiah } from '@/lib/pricing'

// Payment configuration
const PAYMENT_CONFIG = {
  bankName: 'Bank Jago',
  accountNumber: '104051474194',
  accountHolder: 'RIZQI AKBAR PRATAMA',
  amount: PRICING.PRO_30_DAYS,
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { userId, email, fullName } = body

    // Send background notification to admin
    notifyPaymentConfirmation({
      email: email || 'Not provided',
      userId: userId || 'guest',
      fullName: fullName || '',
      amount: PAYMENT_CONFIG.amount,
      bankName: PAYMENT_CONFIG.bankName,
      accountNumber: PAYMENT_CONFIG.accountNumber,
      accountHolder: PAYMENT_CONFIG.accountHolder,
    }).catch(() => {
      // Silent fail — don't block the payment flow
    })

    return NextResponse.json({
      success: true,
      bankDetails: {
        bankName: PAYMENT_CONFIG.bankName,
        accountNumber: PAYMENT_CONFIG.accountNumber,
        accountHolder: PAYMENT_CONFIG.accountHolder,
        amount: PAYMENT_CONFIG.amount,
      },
      discordLink: 'https://discord.gg/KkYYFP9nC',
      message: 'Payment details generated successfully',
    })
  } catch (error) {
    console.error('Payment API error:', error)
    return NextResponse.json(
      { error: 'Failed to generate payment details' },
      { status: 500 }
    )
  }
}

export async function GET() {
  return NextResponse.json({
    bankDetails: {
      bankName: PAYMENT_CONFIG.bankName,
      accountNumber: PAYMENT_CONFIG.accountNumber,
      accountHolder: PAYMENT_CONFIG.accountHolder,
      amount: PAYMENT_CONFIG.amount,
    },
  })
}