export const runtime = 'edge'
import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/admin-auth'
import { createClient } from '@supabase/supabase-js'

function getSupabaseAdmin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) return null
  return createClient(url, key)
}

// GET /api/admin/affiliates - Supabase direct (NO Prisma N+1)
export async function GET(request: NextRequest) {
  try {
    const { error: authError } = await requireAdmin(request)
    if (authError) return authError

    const svc = getSupabaseAdmin()
    if (!svc) {
      return NextResponse.json({ affiliates: [] })
    }

    const { data: affiliates, error } = await svc
      .from('affiliates')
      .select('*, affiliate_referrals(count)')
      .order('created_at', { ascending: false })

    if (error || !affiliates) {
      return NextResponse.json({ affiliates: [] })
    }

    // Get all user emails in a single batch
    const userIds = affiliates.map((a: any) => a.user_id).filter(Boolean)
    let emailMap = new Map<string, string>()
    if (userIds.length > 0) {
      try {
        const { data: profiles } = await svc
          .from('profiles')
          .select('id, email')
          .in('id', userIds)
        if (profiles) {
          emailMap = new Map(profiles.map((p: any) => [p.id, p.email]))
        }
      } catch (emailMapErr) {
        console.warn('[admin/affiliates] Failed to build email map:', emailMapErr)
      }
    }

    const formatted = affiliates.map((a: any) => ({
      userId: a.user_id,
      email: emailMap.get(a.user_id) || null,
      referralCode: a.referral_code,
      totalEarned: a.total_earned,
      totalPaid: a.total_paid,
      currentBalance: a.current_balance,
      referralCount: a.affiliate_referrals?.[0]?.count || 0,
    }))

    return NextResponse.json({ affiliates: formatted })
  } catch (error) {
    console.error('Admin affiliates GET error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}