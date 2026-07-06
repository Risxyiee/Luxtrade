import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getAuthUser } from '@/lib/api-auth'

// GET /api/affiliate/referrals - Get current user's referral list
export async function GET(request: NextRequest) {
  try {
    const authUser = await getAuthUser(request)
    if (!authUser) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Find the affiliate record for this user
    const affiliate = await db.affiliate.findUnique({
      where: { userId: authUser.id },
    })

    if (!affiliate) {
      return NextResponse.json({ referrals: [] })
    }

    // Get all referrals for this affiliate
    const referrals = await db.affiliateReferral.findMany({
      where: { affiliateId: affiliate.id },
      orderBy: { createdAt: 'desc' },
      include: {
        affiliate: {
          select: { userId: true },
        },
      },
    })

    // Enrich with referred user's email from Profile table
    const enrichedReferrals = await Promise.all(
      referrals.map(async (referral) => {
        const profile = await db.profile.findUnique({
          where: { id: referral.referredUserId },
          select: { email: true, full_name: true },
        })

        return {
          id: referral.id,
          referredEmail: profile?.email || null,
          referredName: profile?.full_name || null,
          subscriptionType: referral.subscriptionType,
          commissionAmount: referral.commissionAmount,
          status: referral.status,
          createdAt: referral.createdAt,
        }
      })
    )

    return NextResponse.json({ referrals: enrichedReferrals })
  } catch (error) {
    console.error('Affiliate referrals GET error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}