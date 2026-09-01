import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseAdmin } from '@/lib/supabase-admin-alt'
import { sendAdminNotification } from '@/lib/admin-notify'
import { requireAdmin } from '@/lib/admin-auth'

export async function GET(request: NextRequest) {
  try {
    const { error } = await requireAdmin(request)
    if (error) return error

    const admin = getSupabaseAdmin()
    if (!admin) {
      return NextResponse.json({ error: 'Supabase admin not configured' }, { status: 500 })
    }

    const { searchParams } = new URL(request.url)
    const status = searchParams.get('status')

    let query = admin
      .from('withdrawals')
      .select('*')
      .order('created_at', { ascending: false })

    if (status) {
      query = query.eq('status', status)
    }

    const { data, error: dbError } = await query

    if (dbError) {
      console.error('Admin withdrawals GET error:', dbError.message)
      return NextResponse.json({ success: true, withdrawals: [], notice: 'Withdrawal data unavailable' })
    }

    return NextResponse.json({ success: true, withdrawals: data || [] })
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

    const admin = getSupabaseAdmin()
    if (!admin) {
      return NextResponse.json({ error: 'Supabase admin not configured' }, { status: 500 })
    }

    // Fetch withdrawal
    const { data: withdrawal, error: fetchErr } = await admin
      .from('withdrawals')
      .select('*')
      .eq('id', withdrawalId)
      .single()

    if (fetchErr || !withdrawal) {
      return NextResponse.json({ error: 'Withdrawal not found' }, { status: 404 })
    }

    // Update withdrawal
    const { error: updateError } = await admin
      .from('withdrawals')
      .update({
        status,
        admin_note: adminNote || null,
        updated_at: new Date().toISOString(),
      })
      .eq('id', withdrawalId)

    if (updateError) {
      console.error('Failed to update withdrawal:', updateError.message)
      return NextResponse.json({ error: 'Failed to update withdrawal' }, { status: 500 })
    }

    // If rejected, try to refund balance
    if (status === 'rejected' && withdrawal.user_id) {
      try {
        const { data: affData } = await admin
          .from('affiliates')
          .select('current_balance')
          .eq('user_id', withdrawal.user_id)
          .single()

        if (affData) {
          await admin
            .from('affiliates')
            .update({ current_balance: (affData.current_balance || 0) + withdrawal.amount })
            .eq('user_id', withdrawal.user_id)
        }
      } catch (error) {
        console.warn('[admin/withdrawals] Non-critical: failed to refund affiliate balance on rejection:', error)
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
