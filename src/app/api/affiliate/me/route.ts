import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getAuthUser } from '@/lib/api-auth'

function generateReferralCode(): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789'
  let code = 'LUX'
  for (let i = 0; i < 6; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length))
  }
  return code
}

async function generateUniqueReferralCode(): Promise<string> {
  let code = generateReferralCode()
  let exists = await db.affiliate.findUnique({ where: { referralCode: code } })
  let attempts = 0
  while (exists && attempts < 10) {
    code = generateReferralCode()
    exists = await db.affiliate.findUnique({ where: { referralCode: code } })
    attempts++
  }
  return code
}

// GET /api/affiliate/me - Get current user's affiliate data
export async function GET(request: NextRequest) {
  try {
    const authUser = await getAuthUser(request)
    if (!authUser) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Find or create affiliate record
    let affiliate = await db.affiliate.findUnique({
      where: { userId: authUser.id },
    })

    if (!affiliate) {
      const referralCode = await generateUniqueReferralCode()
      affiliate = await db.affiliate.create({
        data: {
          userId: authUser.id,
          referralCode,
        },
      })
    }

    // If for some reason the affiliate has no referral code, generate one
    if (!affiliate.referralCode) {
      const referralCode = await generateUniqueReferralCode()
      affiliate = await db.affiliate.update({
        where: { id: affiliate.id },
        data: { referralCode },
      })
    }

    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://luxtrade.id'
    const referralLink = `${baseUrl}?ref=${affiliate.referralCode}`

    return NextResponse.json({
      referralCode: affiliate.referralCode,
      totalEarned: affiliate.totalEarned,
      totalPaid: affiliate.totalPaid,
      currentBalance: affiliate.currentBalance,
      referralLink,
    })
  } catch (error) {
    console.error('Affiliate me GET error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}