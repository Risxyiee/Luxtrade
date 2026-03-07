import { NextRequest, NextResponse } from 'next/server'

// Payment configuration
const PAYMENT_CONFIG = {
  bankName: 'Bank Jago',
  accountNumber: '104051474194',
  accountHolder: 'RIZQI AKBAR PRATAMA',
  amount: 49000, // Rp 49.000
  waNumber: '6287874831212', // WhatsApp number for confirmation
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { userId, email } = body

    // Generate WhatsApp link with pre-filled message
    const message = encodeURIComponent(
      `Halo Admin LuxTrade! 👋\n\n` +
      `Saya ingin konfirmasi pembayaran PRO Membership:\n\n` +
      `📧 Email: ${email || 'Not provided'}\n` +
      `🆔 User ID: ${userId || 'Not provided'}\n\n` +
      `Saya sudah transfer Rp 49.000 ke:\n` +
      `Bank: ${PAYMENT_CONFIG.bankName}\n` +
      `Rekening: ${PAYMENT_CONFIG.accountNumber}\n` +
      `Atas Nama: ${PAYMENT_CONFIG.accountHolder}\n\n` +
      `Mohon diaktivasi ya, terima kasih! 🙏`
    )

    const waLink = `https://wa.me/${PAYMENT_CONFIG.waNumber}?text=${message}`

    return NextResponse.json({
      success: true,
      bankDetails: {
        bankName: PAYMENT_CONFIG.bankName,
        accountNumber: PAYMENT_CONFIG.accountNumber,
        accountHolder: PAYMENT_CONFIG.accountHolder,
        amount: PAYMENT_CONFIG.amount,
      },
      waLink,
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
