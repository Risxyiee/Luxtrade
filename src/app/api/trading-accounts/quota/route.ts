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
    // Get Authorization header from request
    const authHeader = req.headers.get('authorization')

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      console.log('🔴 [QUOTA API] No Authorization header found')
      return NextResponse.json(
        { error: 'Unauthorized - No token provided' },
        { status: 401 }
      )
    }

    const token = authHeader.substring(7) // Remove 'Bearer ' prefix

    // Verify token with Supabase
    const { data: { user }, error: authError } = await supabase.auth.getUser(token)

    if (authError || !user) {
      console.log('🔴 [QUOTA API] Invalid token:', authError?.message)
      return NextResponse.json(
        { error: 'Unauthorized - Invalid token' },
        { status: 401 }
      )
    }

    console.log('🟢 [QUOTA API] User authenticated:', user.id)

    // Get user's subscription plan
    const { data: profile } = await supabase
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
