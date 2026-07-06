import { NextRequest, NextResponse } from 'next/server'
import { db, isDatabaseAvailable } from '@/lib/db'
import { requireAdmin } from '@/lib/admin-auth'
import { createClient } from '@supabase/supabase-js'

function getSupabaseAdmin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) return null
  return createClient(url, key)
}

// GET /api/admin/affiliates - Get all affiliates with stats (admin only)
export async function GET(request: NextRequest) {
  try {
    const { error } = await requireAdmin(request)
    if (error) return error

    // Try Prisma first
    if (isDatabaseAvailable()) {
      try {
        const affiliates = await db.affiliate.findMany({
          orderBy: { createdAt: 'desc' },
          include: { referrals: { select: { id: true } } },
        })

        const enrichedAffiliates = await Promise.all(
          affiliates.map(async (affiliate) => {
            let email: string | null = null
            try {
              const profile = await db.profile.findUnique({
                where: { id: affiliate.userId },
                select: { email: true },
              })
              email = profile?.email || null
            } catch { /* skip */ }

            return {
              userId: affiliate.userId,
              email,
              referralCode: affiliate.referralCode,
              totalEarned: affiliate.totalEarned,
              totalPaid: affiliate.totalPaid,
              currentBalance: affiliate.currentBalance,
              referralCount: affiliate.referrals.length,
            }
          })
        )

        return NextResponse.json({ affiliates: enrichedAffiliates })
      } catch (prismaErr) {
        console.warn('⚠️ Prisma affiliate query failed, falling back to Supabase:', prismaErr)
      }
    }

    // Fallback: Supabase direct query
    const svc = getSupabaseAdmin()
    if (svc) {
      const { data: affiliates, error } = await svc
        .from('affiliates')
        .select('*, affiliate_referrals(count), profiles(email)')
        .order('created_at', { ascending: false })

      if (!error && affiliates) {
        const formatted = affiliates.map((a: any) => ({
          userId: a.user_id,
          email: a.profiles?.email || null,
          referralCode: a.referral_code,
          totalEarned: a.total_earned,
          totalPaid: a.total_paid,
          currentBalance: a.current_balance,
          referralCount: a.affiliate_referrals?.[0]?.count || 0,
        }))
        return NextResponse.json({ affiliates: formatted })
      }
    }

    return NextResponse.json({ affiliates: [], notice: 'No affiliate data available' })
  } catch (error) {
    console.error('Admin affiliates GET error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}