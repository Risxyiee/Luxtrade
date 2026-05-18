/**
 * API Route: Trading Accounts
 * GET - Get all trading accounts for current user
 * POST - Create a new trading account
 */

import { NextRequest, NextResponse } from 'next/server'
import { supabase, supabaseAdmin } from '@/lib/supabase'
import { checkAccountQuota, checkAccountNumberExists, getUserTradingAccounts } from '@/lib/trading-account'

// Helper: Create trading account using admin client (bypasses RLS)
async function createTradingAccountAdmin(
  userId: string,
  accountData: {
    account_number: string
    broker_server: string
    platform: 'MT4' | 'MT5'
    metaapi_account_id?: string
  }
) {
  if (!supabaseAdmin) {
    throw new Error('Supabase admin client not configured')
  }

  const { data, error } = await supabaseAdmin
    .from('trading_accounts')
    .insert({
      user_id: userId,
      account_number: accountData.account_number,
      broker_server: accountData.broker_server,
      platform: accountData.platform,
      metaapi_account_id: accountData.metaapi_account_id || null,
      status: 'PENDING'
    })
    .select()
    .single()

  if (error) {
    console.error('Error creating trading account (admin):', error)
    throw error
  }

  return data
}

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
    // Get Authorization header from request
    const authHeader = req.headers.get('authorization')

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      console.log('🔴 [TRADING ACCOUNTS API POST] No Authorization header found')
      return NextResponse.json(
        { error: 'Unauthorized - No token provided' },
        { status: 401 }
      )
    }

    const token = authHeader.substring(7) // Remove 'Bearer ' prefix

    // Verify token with Supabase
    const { data: { user }, error: authError } = await supabase.auth.getUser(token)

    if (authError || !user) {
      console.log('🔴 [TRADING ACCOUNTS API POST] Invalid token:', authError?.message)
      return NextResponse.json(
        { error: 'Unauthorized - Invalid token' },
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
      .eq('id', user.id)
      .single()

    // Check account quota
    const quota = await checkAccountQuota(user.id, profile?.subscription_plan || 'free')

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
    const accountExists = await checkAccountNumberExists(user.id, account_number)
    if (accountExists) {
      return NextResponse.json(
        {
          error: 'Account number already exists',
          message: 'This trading account is already connected to your account'
        },
        { status: 409 }
      )
    }

    // Create the trading account using admin client (bypasses RLS)
    const newAccount = await createTradingAccountAdmin(user.id, {
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
  } catch (error: any) {
    console.error('Error creating trading account:', error)

    // Handle duplicate key error specifically
    if (error?.code === '23505') {
      console.log('🟡 [TRADING ACCOUNTS API POST] Duplicate account detected:', error.details)
      return NextResponse.json(
        {
          error: 'Account number already exists',
          message: 'This trading account is already connected to your account',
          details: error.details
        },
        { status: 409 }
      )
    }

    return NextResponse.json(
      {
        error: 'Failed to create trading account',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
}
