/**
 * Debug API Route: Trading Accounts
 * GET - Get all trading accounts (bypass RLS for debugging)
 */

import { NextRequest, NextResponse } from 'next/server'
import { supabase, supabaseAdmin } from '@/lib/supabase'

// GET: Debug - Fetch all trading accounts (admin mode)
export async function GET(req: NextRequest) {
  try {
    console.log('🔍 [DEBUG API] Fetching all trading accounts...')

    // Get session from cookie
    const { data: { session }, error: authError } = await supabase.auth.getSession()

    console.log('🔍 [DEBUG API] Session:', session?.user?.id || 'No session')

    if (authError || !session?.user) {
      console.log('🔴 [DEBUG API] No session found')
      return NextResponse.json(
        {
          error: 'Unauthorized',
          message: 'No session found',
          session: null
        },
        { status: 401 }
      )
    }

    console.log('✅ [DEBUG API] User authenticated:', session.user.id)

    // Fetch with regular client
    const { data: regularAccounts, error: regularError } = await supabase
      .from('trading_accounts')
      .select('*')
      .eq('user_id', session.user.id)

    console.log('📊 [DEBUG API] Regular client result:', {
      count: regularAccounts?.length || 0,
      error: regularError?.message || 'No error',
      accounts: regularAccounts
    })

    // Fetch with admin client (bypasses RLS)
    let adminAccounts = null
    let adminError = null

    if (supabaseAdmin) {
      const { data, error } = await supabaseAdmin
        .from('trading_accounts')
        .select('*')
        .eq('user_id', session.user.id)

      adminAccounts = data
      adminError = error

      console.log('📊 [DEBUG API] Admin client result:', {
        count: data?.length || 0,
        error: error?.message || 'No error',
        accounts: data
      })
    } else {
      console.log('🔴 [DEBUG API] Supabase admin client not configured')
    }

    return NextResponse.json({
      success: true,
      userId: session.user.id,
      regularAccounts: {
        count: regularAccounts?.length || 0,
        error: regularError?.message || null,
        data: regularAccounts || []
      },
      adminAccounts: supabaseAdmin ? {
        count: adminAccounts?.length || 0,
        error: adminError?.message || null,
        data: adminAccounts || []
      } : null,
      message: regularAccounts?.length === 0 && adminAccounts?.length === 0
        ? 'No accounts found for this user'
        : 'Accounts fetched successfully'
    })
  } catch (error) {
    console.error('🔴 [DEBUG API] Error:', error)
    return NextResponse.json(
      {
        error: 'Internal server error',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
}
