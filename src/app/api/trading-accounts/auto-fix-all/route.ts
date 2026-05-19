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

    if (!supabaseAdmin) {
      return NextResponse.json({ error: 'Admin client not configured' }, { status: 500 })
    }

    // Get all accounts for this user
    const { data: accounts, error: fetchError } = await supabaseAdmin
      .from('trading_accounts')
      .select('*')
      .eq('user_id', user.id)

    if (fetchError) {
      console.error('🔴 [AUTO FIX] Error fetching accounts:', fetchError)
      return NextResponse.json({ error: 'Failed to fetch accounts' }, { status: 500 })
    }

    console.log('🔍 [AUTO FIX] Found accounts:', accounts?.length || 0)

    const fixedAccounts = []
    const skippedAccounts = []

    for (const account of accounts || []) {
      let shouldFix = false
      let newStatus = account.status
      let reason = ''

      if (account.metaapi_account_id && account.status === 'PENDING') {
        // Has MetaApi ID but still PENDING - should be CONNECTED
        shouldFix = true
        newStatus = 'CONNECTED'
        reason = 'Has metaapi_account_id but status is PENDING'
      } else if (!account.metaapi_account_id && account.status === 'CONNECTED') {
        // No MetaApi ID but CONNECTED - should be PENDING
        shouldFix = true
        newStatus = 'PENDING'
        reason = 'Missing metaapi_account_id but status is CONNECTED'
      }

      if (shouldFix) {
        console.log(`🔄 [AUTO FIX] Fixing account ${account.account_number}: ${account.status} -> ${newStatus}`)

        const { data: updatedAccount, error: updateError } = await supabaseAdmin
          .from('trading_accounts')
          .update({ status: newStatus })
          .eq('id', account.id)
          .select()
          .single()

        if (updateError) {
          console.error(`🔴 [AUTO FIX] Failed to fix account ${account.account_number}:`, updateError)
          skippedAccounts.push({
            accountNumber: account.account_number,
            error: updateError.message
          })
        } else {
          console.log(`✅ [AUTO FIX] Fixed account ${account.account_number}`)
          fixedAccounts.push({
            accountNumber: updatedAccount.account_number,
            before: account.status,
            after: newStatus,
            reason
          })
        }
      } else {
        skippedAccounts.push({
          accountNumber: account.account_number,
          reason: 'Status is already correct'
        })
      }
    }

    return NextResponse.json({
      success: true,
      message: `Fixed ${fixedAccounts.length} account(s)`,
      fixed: fixedAccounts,
      skipped: skippedAccounts,
      total: accounts?.length || 0
    })

  } catch (error: any) {
    console.error('🔴 [AUTO FIX] Error:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
