/**
 * API Route: Cleanup PENDING Trading Accounts
 * POST - Remove ALL trading accounts in PENDING status
 * This should be called automatically before checking quota
 */

import { NextRequest, NextResponse } from 'next/server'
import { createSupabaseClient } from '@/lib/supabase/server-client'

// POST: Cleanup ALL PENDING accounts
export async function POST(req: NextRequest) {
  try {
    console.log('🧹 [CLEANUP PENDING] Starting cleanup of ALL PENDING trading accounts...')

    // Create Supabase client with SSR
    const supabase = await createSupabaseClient(req)

    // Get user from session
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      console.log('🔴 [CLEANUP PENDING] No session found', authError?.message)
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
    }

    console.log('✅ [CLEANUP PENDING] User authenticated:', user.id)

    // Create admin client
    const { createClient: createAdminClient } = await import('@supabase/supabase-js')
    const supabaseAdmin = createAdminClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    )

    if (!supabaseAdmin) {
      return NextResponse.json({ error: 'Database client not configured' }, { status: 500 })
    }

    console.log('🔍 [CLEANUP PENDING] Using admin client')

    // Find ALL PENDING accounts for this user
    const { data: pendingAccounts, error: fetchError } = await supabaseAdmin
      .from('trading_accounts')
      .select('*')
      .eq('user_id', user.id)
      .eq('status', 'PENDING')

    if (fetchError) {
      console.error('🔴 [CLEANUP PENDING] Error fetching PENDING accounts:', fetchError)
      throw fetchError
    }

    console.log(`📊 [CLEANUP PENDING] Found ${pendingAccounts?.length || 0} PENDING accounts`)

    if (!pendingAccounts || pendingAccounts.length === 0) {
      return NextResponse.json({
        success: true,
        message: 'No PENDING accounts found',
        deleted: 0
      })
    }

    // Delete ALL PENDING accounts
    const { error: deleteError } = await supabaseAdmin
      .from('trading_accounts')
      .delete()
      .eq('user_id', user.id)
      .eq('status', 'PENDING')

    if (deleteError) {
      console.error('🔴 [CLEANUP PENDING] Error deleting PENDING accounts:', deleteError)
      throw deleteError
    }

    console.log(`✅ [CLEANUP PENDING] Successfully deleted ${pendingAccounts.length} PENDING accounts`)

    return NextResponse.json({
      success: true,
      message: `Successfully deleted ${pendingAccounts.length} PENDING account(s)`,
      deleted: pendingAccounts.length,
      accounts: pendingAccounts.map(acc => ({
        id: acc.id,
        account_number: acc.account_number,
        platform: acc.platform,
        broker_server: acc.broker_server,
        status: acc.status,
        created_at: acc.created_at
      }))
    })
  } catch (error: any) {
    console.error('🔴 [CLEANUP PENDING] Error during cleanup:', error)
    return NextResponse.json(
      {
        error: 'Failed to cleanup PENDING accounts'
      },
      { status: 500 }
    )
  }
}
