import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { supabase } from '@/lib/supabase'

// Commission rate: 30% of Rp 49,000 = Rp 14,700
const COMMISSION_PER_PRO = 14700

export async function GET() {
  try {
    console.log('📊 API affiliate-stats called')

    // ========================================
    // Get all affiliate profiles from Prisma
    // ========================================
    console.log('📋 Step 1: Fetching affiliate profiles...')
    const affiliateProfiles = await db.affiliateProfile.findMany({
      include: {
        user: {
          select: {
            email: true,
            name: true
          }
        }
      }
    })

    console.log(`   Found ${affiliateProfiles.length} affiliate profiles`)

    // ========================================
    // Get all active subscriptions to calculate PRO users
    // ========================================
    console.log('📋 Step 2: Fetching active subscriptions...')
    const activeSubscriptions = await db.userSubscription.findMany({
      where: {
        isActive: true
      },
      select: {
        userId: true
      }
    })

    const activeProUserIds = new Set(activeSubscriptions.map(s => s.userId))
    console.log(`   Found ${activeProUserIds.size} active PRO users`)

    // ========================================
    // Build affiliate stats with referral tracking
    // ========================================
    console.log('📋 Step 3: Building affiliate stats...')
    const affiliateStats = []

    for (const affiliate of affiliateProfiles) {
      // Get referral tracking from Supabase
      const { data: referrals } = await supabase
        .from('referral_tracking')
        .select('*')
        .eq('referral_code_used', affiliate.myReferralCode)

      const totalReferred = referrals?.length || 0

      // Count active PRO users among referrals
      let activePro = 0
      if (referrals && referrals.length > 0) {
        for (const referral of referrals) {
          const refereeId = referral.referee_id
          if (refereeId && activeProUserIds.has(refereeId)) {
            activePro++
          }
        }
      }

      // Calculate total commission: Active PRO x Rp 14,700
      const totalCommission = activePro * COMMISSION_PER_PRO

      affiliateStats.push({
        affiliateId: affiliate.userId,
        myReferralCode: affiliate.myReferralCode,
        email: affiliate.email,
        name: affiliate.user?.name || affiliate.email,
        affiliateBalance: affiliate.affiliateBalance,
        totalReferred,
        activePro,
        totalCommission,
        totalCommissionPending: totalCommission - affiliate.totalCommission,
        createdAt: affiliate.createdAt
      })
    }

    console.log('✅ Affiliate stats built successfully!')

    return NextResponse.json({
      success: true,
      data: affiliateStats,
      summary: {
        totalAffiliates: affiliateStats.length,
        totalReferred: affiliateStats.reduce((sum, a) => sum + a.totalReferred, 0),
        totalActivePro: affiliateStats.reduce((sum, a) => sum + a.activePro, 0),
        totalCommission: affiliateStats.reduce((sum, a) => sum + a.totalCommission, 0)
      }
    })
  } catch (error) {
    console.error('❌ ERROR DETAIL:', error)
    console.error('   Error type:', error?.constructor?.name)
    console.error('   Error message:', error instanceof Error ? error.message : String(error))
    console.error('   Error stack:', error instanceof Error ? error.stack : 'No stack trace')

    return NextResponse.json(
      {
        error: 'Failed to fetch affiliate stats',
        details: error instanceof Error ? error.message : String(error)
      },
      { status: 500 }
    )
  }
}
