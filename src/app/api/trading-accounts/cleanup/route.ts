/**
 * API Route: Cleanup Stuck Trading Accounts
 * DELETE - Remove trading accounts that are stuck in PENDING status for more than 1 hour
 * This helps clean up accounts that failed MetaApi connection but weren't rolled back
 */

import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'

// DELETE: Cleanup stuck accounts (admin only or internal use)
export async function DELETE(req: NextRequest) {
  try {
    console.log('🧹 [CLEANUP] Starting cleanup of stuck trading accounts...')

    if (!supabaseAdmin) {
      throw new Error('Supabase admin client not configured')
    }

    // Find accounts in PENDING status for more than 1 hour
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString()

    const { data: stuckAccounts, error: fetchError } = await supabaseAdmin
      .from('trading_accounts')
      .select('*')
      .eq('status', 'PENDING')
      .lt('created_at', oneHourAgo)

    if (fetchError) {
      console.error('🔴 [CLEANUP] Error fetching stuck accounts:', fetchError)
      throw fetchError
    }

    console.log(`📊 [CLEANUP] Found ${stuckAccounts?.length || 0} stuck accounts`)

    if (!stuckAccounts || stuckAccounts.length === 0) {
      return NextResponse.json({
        success: true,
        message: 'No stuck accounts found',
        deleted: 0
      })
    }

    // Delete stuck accounts
    const { error: deleteError } = await supabaseAdmin
      .from('trading_accounts')
      .delete()
      .eq('status', 'PENDING')
      .lt('created_at', oneHourAgo)

    if (deleteError) {
      console.error('🔴 [CLEANUP] Error deleting stuck accounts:', deleteError)
      throw deleteError
    }

    console.log(`✅ [CLEANUP] Successfully deleted ${stuckAccounts.length} stuck accounts`)

    return NextResponse.json({
      success: true,
      message: `Successfully deleted ${stuckAccounts.length} stuck accounts`,
      deleted: stuckAccounts.length,
      accounts: stuckAccounts.map(acc => ({
        id: acc.id,
        account_number: acc.account_number,
        created_at: acc.created_at
      }))
    })
  } catch (error) {
    console.error('🔴 [CLEANUP] Error during cleanup:', error)
    return NextResponse.json(
      {
        error: 'Failed to cleanup stuck accounts',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
}
