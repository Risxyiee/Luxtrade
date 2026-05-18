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
    // Get authenticated user
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    // Get user's subscription plan
    const { data: profile } = await supabase
      .from('profiles')
      .select('subscription_plan')
      .eq('id', user.id)
      .single()

    // Check quota
    const quota = await checkAccountQuota(user.id, profile?.subscription_plan || 'free')

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
