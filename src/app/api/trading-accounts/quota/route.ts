/**
 * API Route: Trading Account Quota Check
 * GET - Check if user can add more trading accounts based on their subscription plan
 */

import { NextRequest, NextResponse } from 'next/server'
import { checkAccountQuota } from '@/lib/trading-account'
import { createSupabaseClient } from '@/lib/supabase/server-client'

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

    // Create admin client
    const { createClient: createAdminClient } = await import('@supabase/supabase-js')
    const supabaseAdmin = createAdminClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    )

    // Get user's subscription plan
    const { data: profile } = await supabaseAdmin
      .from('profiles')
      .select('subscription_plan')
      .eq('id', user.id)
      .single()

    // Check quota
    const quota = await checkAccountQuota(user.id, profile?.subscription_plan || 'free')

    console.log('🟢 [QUOTA API] Quota check result:', quota)

    return NextResponse.json({
      success: true,
      quota,
      plan: profile?.subscription_plan || 'free',
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
