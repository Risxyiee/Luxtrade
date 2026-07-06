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

// GET /api/admin/affiliate-withdrawals - Get all pending withdrawals (admin only)
export async function GET(request: NextRequest) {
  try {
    const { error } = await requireAdmin(request)
    if (error) return error

    const status = new URL(request.url).searchParams.get('status') || 'REQUESTED'

    // Try Prisma first
    if (isDatabaseAvailable()) {
      try {
        const where: { status?: string } = {}
        if (status) where.status = status

        const withdrawals = await db.affiliateWithdrawal.findMany({
          where,
          orderBy: { requestedAt: 'asc' },
          include: { affiliate: { select: { userId: true, referralCode: true } } },
        })

        const enriched = await Promise.all(
          withdrawals.map(async (w) => {
            let email: string | null = null
            let name: string | null = null
            try {
              const profile = await db.profile.findUnique({
                where: { id: w.affiliate.userId },
                select: { email: true, full_name: true },
              })
              email = profile?.email || null
              name = profile?.full_name || null
            } catch { /* skip */ }

            return {
              id: w.id,
              affiliateId: w.affiliateId,
              userId: w.affiliate.userId,
              email,
              name,
              referralCode: w.affiliate.referralCode,
              amount: w.amount,
              status: w.status,
              bankAccountInfo: w.bankAccountInfo,
              requestedAt: w.requestedAt,
              paidAt: w.paidAt,
            }
          })
        )
        return NextResponse.json({ withdrawals: enriched })
      } catch (prismaErr) {
        console.warn('⚠️ Prisma affiliate withdrawals failed, falling back:', prismaErr)
      }
    }

    // Fallback: Supabase direct
    const svc = getSupabaseAdmin()
    if (svc) {
      let query = svc.from('affiliate_withdrawals').select('*').order('requested_at', { ascending: true })
      if (status) query = query.eq('status', status)
      const { data, error } = await query
      if (!error && data) {
        return NextResponse.json({ withdrawals: data })
      }
    }

    return NextResponse.json({ withdrawals: [] })
  } catch (error) {
    console.error('Admin affiliate withdrawals GET error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// POST /api/admin/affiliate-withdrawals - Mark a withdrawal as paid (admin only)
export async function POST(request: NextRequest) {
  try {
    const { error } = await requireAdmin(request)
    if (error) return error

    const body = await request.json()
    const { withdrawalId } = body as { withdrawalId: string }

    if (!withdrawalId || typeof withdrawalId !== 'string') {
      return NextResponse.json({ error: 'withdrawalId is required' }, { status: 400 })
    }

    // Try Prisma
    if (isDatabaseAvailable()) {
      try {
        const withdrawal = await db.affiliateWithdrawal.findUnique({
          where: { id: withdrawalId },
          include: { affiliate: true },
        })

        if (!withdrawal) return NextResponse.json({ error: 'Withdrawal not found' }, { status: 404 })
        if (withdrawal.status !== 'REQUESTED') {
          return NextResponse.json({ error: `Cannot process withdrawal with status: ${withdrawal.status}` }, { status: 400 })
        }

        const updatedWithdrawal = await db.$transaction(async (tx) => {
          const updated = await tx.affiliateWithdrawal.update({
            where: { id: withdrawalId },
            data: { status: 'PAID', paidAt: new Date() },
          })
          await tx.affiliate.update({
            where: { id: withdrawal.affiliateId },
            data: { totalPaid: { increment: withdrawal.amount } },
          })
          return updated
        })

        return NextResponse.json({
          success: true,
          withdrawal: { id: updatedWithdrawal.id, amount: updatedWithdrawal.amount, status: updatedWithdrawal.status, paidAt: updatedWithdrawal.paidAt },
        })
      } catch (prismaErr) {
        console.warn('⚠️ Prisma affiliate withdrawal update failed, falling back:', prismaErr)
      }
    }

    // Fallback: Supabase direct
    const svc = getSupabaseAdmin()
    if (svc) {
      const { data: w, error: fetchErr } = await svc
        .from('affiliate_withdrawals')
        .select('*')
        .eq('id', withdrawalId)
        .single()

      if (fetchErr || !w) return NextResponse.json({ error: 'Withdrawal not found' }, { status: 404 })
      if (w.status !== 'REQUESTED') {
        return NextResponse.json({ error: `Cannot process withdrawal with status: ${w.status}` }, { status: 400 })
      }

      await svc.from('affiliate_withdrawals').update({ status: 'PAID', paid_at: new Date().toISOString() }).eq('id', withdrawalId)
      if (w.affiliate_id) {
        await svc.rpc('increment_total_paid', { p_affiliate_id: w.affiliate_id, p_amount: w.amount }).catch(() => {
          // rpc may not exist, try manual update
          return svc.from('affiliates').select('total_paid').eq('id', w.affiliate_id).single()
            .then(({ data: aff }) => aff ? svc.from('affiliates').update({ total_paid: (aff.total_paid || 0) + w.amount }).eq('id', w.affiliate_id) : null)
        })
      }

      return NextResponse.json({ success: true, withdrawal: { id: w.id, amount: w.amount, status: 'PAID', paidAt: new Date().toISOString() } })
    }

    return NextResponse.json({ error: 'Database unavailable' }, { status: 500 })
  } catch (error) {
    console.error('Admin affiliate withdrawals POST error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}