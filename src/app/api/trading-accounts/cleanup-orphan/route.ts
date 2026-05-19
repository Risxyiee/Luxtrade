/**
 * API Route: Cleanup Orphan Trading Accounts
 * DELETE - Remove trading accounts in PENDING status without metaapi_account_id
 * This helps clean up accounts that failed MetaApi connection
 */

import { NextRequest, NextResponse } from 'next/server'
import { supabase, supabaseAdmin } from '@/lib/supabase'

// DELETE: Cleanup orphan accounts (no metaapi_account_id and PENDING status)
export async function DELETE(req: NextRequest) {
  try {
    console.log('🧹 [CLEANUP ORPHAN] Starting cleanup of orphan trading accounts...')

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

    console.log('✅ [CLEANUP ORPHAN] User authenticated:', user.id)

    const dbClient = supabaseAdmin || supabase

    if (!dbClient) {
      return NextResponse.json({ error: 'Database client not configured' }, { status: 500 })
    }

    console.log('🔍 [CLEANUP ORPHAN] Using database client:', supabaseAdmin ? 'Admin' : 'Regular')

    // Find PENDING accounts without metaapi_account_id for this user
    const { data: orphanAccounts, error: fetchError } = await dbClient
      .from('trading_accounts')
      .select('*')
      .eq('user_id', user.id)
      .eq('status', 'PENDING')
      .is('metaapi_account_id', null)

    if (fetchError) {
      console.error('🔴 [CLEANUP ORPHAN] Error fetching orphan accounts:', fetchError)
      throw fetchError
    }

    console.log(`📊 [CLEANUP ORPHAN] Found ${orphanAccounts?.length || 0} orphan accounts`)

    if (!orphanAccounts || orphanAccounts.length === 0) {
      return NextResponse.json({
        success: true,
        message: 'No orphan accounts found',
        deleted: 0
      })
    }

    // Delete orphan accounts
    const { error: deleteError } = await dbClient
      .from('trading_accounts')
      .delete()
      .eq('user_id', user.id)
      .eq('status', 'PENDING')
      .is('metaapi_account_id', null)

    if (deleteError) {
      console.error('🔴 [CLEANUP ORPHAN] Error deleting orphan accounts:', deleteError)
      throw deleteError
    }

    console.log(`✅ [CLEANUP ORPHAN] Successfully deleted ${orphanAccounts.length} orphan accounts`)

    return NextResponse.json({
      success: true,
      message: `Successfully deleted ${orphanAccounts.length} orphan account(s)`,
      deleted: orphanAccounts.length,
      accounts: orphanAccounts.map(acc => ({
        id: acc.id,
        account_number: acc.account_number,
        platform: acc.platform,
        broker_server: acc.broker_server,
        created_at: acc.created_at
      }))
    })
  } catch (error: any) {
    console.error('🔴 [CLEANUP ORPHAN] Error during cleanup:', error)
    return NextResponse.json(
      {
        error: 'Failed to cleanup orphan accounts',
        details: error.message
      },
      { status: 500 }
    )
  }
}
