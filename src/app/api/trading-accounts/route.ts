/**
 * API Route: Trading Accounts
 * GET - Get all trading accounts for current user
 * POST - Create a new trading account
 */

import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'
import { checkAccountQuota, checkAccountNumberExists, createTradingAccount, getUserTradingAccounts } from '@/lib/trading-account'

// GET: Fetch all trading accounts for the authenticated user
export async function GET(req: NextRequest) {
  try {
    // Get session from cookie
    const { data: { session }, error: authError } = await supabase.auth.getSession()

    if (authError || !session?.user) {
      console.log('🔴 [TRADING ACCOUNTS API GET] No session found')
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    // Get user's trading accounts
    const accounts = await getUserTradingAccounts(session.user.id)

    // Get user's quota information
    const { data: profile } = await supabase
      .from('profiles')
      .select('subscription_plan')
      .eq('id', session.user.id)
      .single()

    const quota = await checkAccountQuota(session.user.id, profile?.subscription_plan || 'free')

    return NextResponse.json({
      success: true,
      data: accounts,
      quota
    })
  } catch (error) {
    console.error('Error fetching trading accounts:', error)
    return NextResponse.json(
      {
        error: 'Failed to fetch trading accounts',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
}

// POST: Create a new trading account
export async function POST(req: NextRequest) {
  try {
    // Get session from cookie
    const { data: { session }, error: authError } = await supabase.auth.getSession()

    if (authError || !session?.user) {
      console.log('🔴 [TRADING ACCOUNTS API POST] No session found')
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    // Parse request body
    const body = await req.json()
    const { account_number, broker_server, platform } = body

    // Validate required fields
    if (!account_number || !broker_server || !platform) {
      return NextResponse.json(
        {
          error: 'Missing required fields',
          required: ['account_number', 'broker_server', 'platform']
        },
        { status: 400 }
      )
    }

    // Validate platform
    if (!['MT4', 'MT5'].includes(platform)) {
      return NextResponse.json(
        {
          error: 'Invalid platform',
          valid_platforms: ['MT4', 'MT5']
        },
        { status: 400 }
      )
    }

    // Get user's subscription plan
    const { data: profile } = await supabase
      .from('profiles')
      .select('subscription_plan')
      .eq('id', session.user.id)
      .single()

    // Check account quota
    const quota = await checkAccountQuota(session.user.id, profile?.subscription_plan || 'free')

    if (!quota.canAddMore) {
      return NextResponse.json(
        {
          error: 'Account quota exceeded',
          quota: {
            current: quota.currentAccounts,
            max: quota.maxAllowed,
            remaining: quota.remainingQuota
          },
          message: `You have reached your maximum limit of ${quota.maxAllowed} trading account(s). Upgrade your plan to add more.`
        },
        { status: 403 }
      )
    }

    // Check for duplicate account number
    const accountExists = await checkAccountNumberExists(session.user.id, account_number)
    if (accountExists) {
      return NextResponse.json(
        {
          error: 'Account number already exists',
          message: 'This trading account is already connected to your account'
        },
        { status: 409 }
      )
    }

    // Create the trading account
    const newAccount = await createTradingAccount(session.user.id, {
      account_number,
      broker_server,
      platform
    })

    return NextResponse.json({
      success: true,
      data: newAccount,
      quota: {
        ...quota,
        currentAccounts: quota.currentAccounts + 1,
        remainingQuota: quota.remainingQuota - 1
      }
    }, { status: 201 })
  } catch (error) {
    console.error('Error creating trading account:', error)
    return NextResponse.json(
      {
        error: 'Failed to create trading account',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
}
