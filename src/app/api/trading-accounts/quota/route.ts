/**
 * API Route: Trading Account Quota Check
 * GET - Check if user can add more trading accounts based on their subscription plan
 */

import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'
import { checkAccountQuota } from '@/lib/trading-account'

// GET: Check account quota
export async function GET(req: NextRequest) {
  try {
    // Get session from cookie
    const { data: { session }, error: authError } = await supabase.auth.getSession()

    if (authError || !session?.user) {
      console.log('🔴 [QUOTA API] No session found:', { authError: authError?.message, hasSession: !!session })
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    console.log('🟢 [QUOTA API] User authenticated:', session.user.id)

    // Get user's subscription plan
    const { data: profile } = await supabase
      .from('profiles')
      .select('subscription_plan')
      .eq('id', session.user.id)
      .single()

    // Check quota
    const quota = await checkAccountQuota(session.user.id, profile?.subscription_plan || 'free')

    console.log('🟢 [QUOTA API] Quota check result:', quota)

    return NextResponse.json({
      success: true,
      quota,
      plan: profile?.subscription_plan || 'free'
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
