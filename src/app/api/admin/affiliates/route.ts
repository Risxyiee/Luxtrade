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

// GET /api/admin/affiliates - Get all affiliates with stats (admin only)
export async function GET(request: NextRequest) {
  try {
    const authUser = await getAuthUser(request)
    if (!authUser) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    if (!(await isAdmin(authUser.id))) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    // Get all affiliates with referral counts
    const affiliates = await db.affiliate.findMany({
      orderBy: { createdAt: 'desc' },
      include: {
        referrals: {
          select: { id: true },
        },
      },
    })

    // Enrich with profile email
    const enrichedAffiliates = await Promise.all(
      affiliates.map(async (affiliate) => {
        const profile = await db.profile.findUnique({
          where: { id: affiliate.userId },
          select: { email: true },
        })

        return {
          userId: affiliate.userId,
          email: profile?.email || null,
          referralCode: affiliate.referralCode,
          totalEarned: affiliate.totalEarned,
          totalPaid: affiliate.totalPaid,
          currentBalance: affiliate.currentBalance,
          referralCount: affiliate.referrals.length,
        }
      })
    )

    return NextResponse.json({ affiliates: enrichedAffiliates })
  } catch (error) {
    console.error('Admin affiliates GET error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}