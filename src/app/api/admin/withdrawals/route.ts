import { NextRequest, NextResponse } from 'next/server'
import { db, isDatabaseAvailable } from '@/lib/db'
import { sendAdminNotification } from '@/lib/admin-notify'
import { requireAdmin } from '@/lib/admin-auth'
import { createClient } from '@supabase/supabase-js'

/** Get Supabase admin client (service role, bypasses RLS) */
function getSupabaseAdmin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) return null
  return createClient(url, key)
}

export async function GET(request: NextRequest) {
  try {
    const { error } = await requireAdmin(request)
    if (error) return error

    const { searchParams } = new URL(request.url)
    const status = searchParams.get('status')

    // Try Prisma first, fall back to Supabase direct query
    if (isDatabaseAvailable()) {
      try {
        const where: any = {}
        if (status) where.status = status

        const withdrawals = await db.withdrawal.findMany({
          where,
          orderBy: { createdAt: 'desc' },
        })
        return NextResponse.json({ success: true, withdrawals })
      } catch (prismaErr: any) {
        // Prisma failed (e.g. missing column) — fall through to Supabase
        console.warn('⚠️ Prisma withdrawal query failed, falling back to Supabase:', prismaErr?.message?.substring(0, 100))
      }
    }

    // Fallback: query Supabase directly
    const supabaseAdmin = getSupabaseAdmin()
    if (supabaseAdmin) {
      let query = supabaseAdmin.from('withdrawals').select('*').order('created_at', { ascending: false })
      if (status) query = query.eq('status', status)
      const { data, error } = await query
      if (!error && data) {
        return NextResponse.json({ success: true, withdrawals: data })
      }
    }

    // No data available
    return NextResponse.json({ success: true, withdrawals: [], notice: 'Withdrawal data unavailable' })
  } catch (error) {
    console.error('Admin withdrawals GET error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const { error } = await requireAdmin(request)
    if (error) return error

    const body = await request.json()
    const { withdrawalId, status, adminNote } = body

    if (!withdrawalId || !status || !['approved', 'rejected'].includes(status)) {
      return NextResponse.json({ error: 'Invalid parameters' }, { status: 400 })
    }

    // Try Prisma first
    let withdrawal: any = null
    if (isDatabaseAvailable()) {
      try {
        withdrawal = await db.withdrawal.findUnique({ where: { id: withdrawalId } })
      } catch (prismaWErr) {
        console.warn('[admin/withdrawals] Prisma lookup failed, falling through to Supabase:', prismaWErr)
      }
    }

    // Fallback: fetch from Supabase
    if (!withdrawal) {
      const supabaseAdmin = getSupabaseAdmin()
      if (supabaseAdmin) {
        const { data } = await supabaseAdmin.from('withdrawals').select('*').eq('id', withdrawalId).single()
        withdrawal = data
      }
    }

    if (!withdrawal) {
      return NextResponse.json({ error: 'Withdrawal not found' }, { status: 404 })
    }

    // Update via Supabase (more reliable)
    const supabaseAdmin = getSupabaseAdmin()
    if (supabaseAdmin) {
      const { error: updateError } = await supabaseAdmin
        .from('withdrawals')
        .update({ status, admin_note: adminNote || null, updated_at: new Date().toISOString() })
        .eq('id', withdrawalId)

      if (updateError) {
        console.error('Failed to update withdrawal in Supabase:', updateError.message)
      }
    }

    // If rejected, try to refund balance
    if (status === 'rejected' && withdrawal.user_id) {
      const supabaseAdmin2 = getSupabaseAdmin()
      if (supabaseAdmin2) {
        try {
          const { data: affData } = await supabaseAdmin2
            .from('affiliates')
            .select('current_balance')
            .eq('user_id', withdrawal.user_id)
            .single()

          if (affData) {
            await supabaseAdmin2
              .from('affiliates')
              .update({ current_balance: (affData.current_balance || 0) + withdrawal.amount })
              .eq('user_id', withdrawal.user_id)
          }
        } catch (error) {
          console.warn('[admin/withdrawals] Non-critical: failed to refund affiliate balance on rejection:', error)
        }
      }
    }

    // Send admin notification
    const statusEmoji = status === 'approved' ? '✅' : '❌'
    const msg = `${statusEmoji} <b>PENARIKAN SALDO ${status === 'approved' ? 'APPROVED' : 'DITOLAK'}</b>\n\n📧 ${withdrawal.email || withdrawal.user_id || 'Unknown'}\n💵 Rp${(withdrawal.amount || 0).toLocaleString('id-ID')}\n${adminNote ? `📝 Catatan: ${adminNote}\n\n` : ''}⏰ ${new Date().toLocaleString('id-ID')}`
    await sendAdminNotification(msg)

    return NextResponse.json({ success: true, withdrawal: { ...withdrawal, status, adminNote } })
  } catch (error) {
    console.error('Admin withdrawal PATCH error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}