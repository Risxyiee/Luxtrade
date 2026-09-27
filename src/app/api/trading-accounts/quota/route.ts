/**
 * API Route: Trading Account Quota Check
 * GET - Check if user can add more trading accounts based on their subscription plan
 */

import { NextRequest, NextResponse } from 'next/server'
import { createSupabaseClient } from '@/lib/supabase/server-client'
import { isUserPro } from '@/lib/pro-check'

// GET: Check account quota
export async function GET(req: NextRequest) {
  try {
    // Create Supabase client with SSR
    const supabase = await createSupabaseClient(req)

    // Get user from session
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      console.log('🔴 [QUOTA API] No session found', authError?.message)
      return NextResponse.json(
        { error: 'Unauthorized - No session' },
        { status: 401 }
      )
    }

    console.log('🟢 [QUOTA API] User authenticated:', user.id)

    // Check PRO status using canonical isUserPro() which validates expiry
    const isPro = await isUserPro(user.id)

    // PRO users: unlimited accounts. FREE: 1 account only.
    const maxAllowed = isPro ? 999 : 1

    // Count current accounts
    const { createClient: createAdminClient } = await import('@supabase/supabase-js')
    const supabaseAdmin = createAdminClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    )

    const { count, error: countError } = await supabaseAdmin
      .from('trading_accounts')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', user.id)
      .eq('is_active', true)

    const currentAccounts = count || 0
    const remainingQuota = Math.max(0, maxAllowed - currentAccounts)
    const canAddMore = remainingQuota > 0

    console.log('🟢 [QUOTA API] Quota check result:', { currentAccounts, maxAllowed, canAddMore, isPro })

    return NextResponse.json({
      success: true,
      quota: {
        currentAccounts,
        maxAllowed,
        canAddMore,
        remainingQuota,
      },
      plan: isPro ? 'PRO' : 'FREE',
      isPro,
      userId: user.id
    })
  } catch (error) {
    console.error('Error checking account quota:', error)
    return NextResponse.json(
      {
        error: 'Failed to check account quota',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
}
