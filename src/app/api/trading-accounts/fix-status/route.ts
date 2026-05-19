import { NextRequest, NextResponse } from 'next/server'
import { supabase, supabaseAdmin } from '@/lib/supabase'

export async function POST(req: NextRequest) {
  try {
    // Get authenticated user
    const authHeader = req.headers.get('authorization')
    let user = null

    if (authHeader && authHeader.startsWith('Bearer ')) {
      const token = authHeader.substring(7)
      const { data, error } = await supabase.auth.getUser(token)
      if (!error && data.user) {
        user = data.user
      }
    }

    if (!user) {
      const { data: { session } } = await supabase.auth.getSession()
      if (session?.user) {
        user = session.user
      }
    }

    if (!user) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
    }

    const body = await req.json()
    const { accountId } = body

    if (!accountId) {
      return NextResponse.json({ error: 'accountId is required' }, { status: 400 })
    }

    if (!supabaseAdmin) {
      return NextResponse.json({ error: 'Admin client not configured' }, { status: 500 })
    }

    // Get current account status
    const { data: currentAccount } = await supabaseAdmin
      .from('trading_accounts')
      .select('*')
      .eq('id', accountId)
      .eq('user_id', user.id)
      .single()

    if (!currentAccount) {
      return NextResponse.json({ error: 'Account not found' }, { status: 404 })
    }

    console.log('🔍 [FIX STATUS] Current account:', currentAccount)

    // Determine what status should be
    let newStatus = currentAccount.status
    let reason = 'No change needed'

    if (currentAccount.metaapi_account_id && currentAccount.status === 'PENDING') {
      // Has MetaApi ID but still PENDING - should be CONNECTED
      newStatus = 'CONNECTED'
      reason = 'Account has metaapi_account_id but status is PENDING'
    } else if (!currentAccount.metaapi_account_id && currentAccount.status === 'CONNECTED') {
      // No MetaApi ID but CONNECTED - should be PENDING
      newStatus = 'PENDING'
      reason = 'Account missing metaapi_account_id but status is CONNECTED'
    }

    if (newStatus !== currentAccount.status) {
      console.log('🔄 [FIX STATUS] Updating status from', currentAccount.status, 'to', newStatus, '-', reason)

      const { data: updatedAccount, error: updateError } = await supabaseAdmin
        .from('trading_accounts')
        .update({ status: newStatus })
        .eq('id', accountId)
        .eq('user_id', user.id)
        .select()
        .single()

      if (updateError) {
        console.error('🔴 [FIX STATUS] Error updating status:', updateError)
        return NextResponse.json({ error: 'Failed to update status', details: updateError }, { status: 500 })
      }

      return NextResponse.json({
        success: true,
        message: `Status updated from ${currentAccount.status} to ${newStatus}`,
        reason,
        before: currentAccount.status,
        after: newStatus,
        account: updatedAccount
      })
    }

    return NextResponse.json({
      success: true,
      message: 'Status is already correct',
      currentStatus: currentAccount.status,
      reason
    })

  } catch (error: any) {
    console.error('🔴 [FIX STATUS] Error:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
