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

// GET /api/admin/affiliate-withdrawals - Supabase direct (NO Prisma)
export async function GET(request: NextRequest) {
  try {
    const { error: authError } = await requireAdmin(request)
    if (authError) return authError

    const status = new URL(request.url).searchParams.get('status') || 'REQUESTED'

    const svc = getSupabaseAdmin()
    if (!svc) {
      return NextResponse.json({ error: 'Database not configured' }, { status: 500 })
    }

    let query = svc.from('affiliate_withdrawals').select('*').order('requested_at', { ascending: true })
    if (status) query = query.eq('status', status)
    const { data, error } = await query

    if (error) {
      console.error('Supabase affiliate_withdrawals error:', error.message)
      return NextResponse.json({ withdrawals: [] })
    }

    return NextResponse.json({ withdrawals: data || [] })
  } catch (error) {
    console.error('Admin affiliate withdrawals GET error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// POST /api/admin/affiliate-withdrawals - Mark as paid (Supabase direct only)
export async function POST(request: NextRequest) {
  try {
    const { error: authError } = await requireAdmin(request)
    if (authError) return authError

    const body = await request.json()
    const { withdrawalId } = body as { withdrawalId: string }

    if (!withdrawalId || typeof withdrawalId !== 'string') {
      return NextResponse.json({ error: 'withdrawalId is required' }, { status: 400 })
    }

    const svc = getSupabaseAdmin()
    if (!svc) {
      return NextResponse.json({ error: 'Database not configured' }, { status: 500 })
    }

    const { data: w, error: fetchErr } = await svc
      .from('affiliate_withdrawals')
      .select('*')
      .eq('id', withdrawalId)
      .single()

    if (fetchErr || !w) {
      return NextResponse.json({ error: 'Withdrawal not found' }, { status: 404 })
    }
    if (w.status !== 'REQUESTED') {
      return NextResponse.json({ error: `Cannot process withdrawal with status: ${w.status}` }, { status: 400 })
    }

    await svc.from('affiliate_withdrawals').update({ status: 'PAID', paid_at: new Date().toISOString() }).eq('id', withdrawalId)

    // Update affiliate total_paid if affiliate_id exists
    if (w.affiliate_id) {
      try {
        const { data: aff } = await svc.from('affiliates').select('total_paid').eq('id', w.affiliate_id).single()
        if (aff) {
          await svc.from('affiliates').update({ total_paid: (aff.total_paid || 0) + w.amount }).eq('id', w.affiliate_id)
        }
      } catch (affUpdateErr) {
        console.warn('[admin/affiliate-withdrawals] Failed to update affiliate total_paid:', affUpdateErr)
      }
    }

    return NextResponse.json({ success: true, withdrawal: { id: w.id, amount: w.amount, status: 'PAID', paidAt: new Date().toISOString() } })
  } catch (error) {
    console.error('Admin affiliate withdrawals POST error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}