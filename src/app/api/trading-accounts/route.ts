/**
 * API Route: Trading Accounts
 * GET - Get all trading accounts for current user
 * POST - Create a new trading account
 */

import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { checkAccountQuota, checkAccountNumberExists, getUserTradingAccounts } from '@/lib/trading-account'
import { Database } from '@/types/supabase'

// Helper: Create trading account using admin client (bypasses RLS)
async function createTradingAccountAdmin(
  userId: string,
  accountData: {
    account_number: string
    broker_server: string
    platform: 'MT4' | 'MT5'
    metaapi_account_id?: string
  },
  supabaseAdmin: any
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
    console.log('🔵 [TRADING ACCOUNTS API GET] Fetching trading accounts...')

    // Create Supabase client with SSR
    const cookieStore = cookies()
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll() {
            return cookieStore.getAll()
          },
          setAll(cookiesToSet) {
            try {
              cookiesToSet.forEach(({ name, value, options }) =>
                cookieStore.set(name, value, options)
              )
            } catch {
              // Ignore in route handlers
            }
          },
        },
      }
    )

    // Get user from session
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      console.log('🔴 [TRADING ACCOUNTS API GET] No session found', authError?.message)
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    console.log('✅ [TRADING ACCOUNTS API GET] User authenticated:', user.id)

    // Create admin client for data access
    const { createClient: createAdminClient } = await import('@supabase/supabase-js')
    const supabaseAdmin = createAdminClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    )

    // Get user's trading accounts
    const accounts = await getUserTradingAccounts(user.id)
    console.log('📊 [TRADING ACCOUNTS API GET] Found accounts:', accounts.length)
    console.log('📋 [TRADING ACCOUNTS API GET] Accounts data:', accounts)

    // Get user's quota information
    const { data: profile } = await supabaseAdmin
      .from('profiles')
      .select('subscription_plan')
      .eq('id', user.id)
      .single()

    const quota = await checkAccountQuota(user.id, profile?.subscription_plan || 'free')
    console.log('📊 [TRADING ACCOUNTS API GET] Quota:', quota)

    const response = {
      success: true,
      data: accounts,
      quota
    }

    console.log('✅ [TRADING ACCOUNTS API GET] Sending response:', response)

    return NextResponse.json(response)
  } catch (error) {
    console.error('🔴 [TRADING ACCOUNTS API GET] Error fetching trading accounts:', error)
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
    // Create Supabase client with SSR
    const cookieStore = cookies()
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll() {
            return cookieStore.getAll()
          },
          setAll(cookiesToSet) {
            try {
              cookiesToSet.forEach(({ name, value, options }) =>
                cookieStore.set(name, value, options)
              )
            } catch {
              // Ignore in route handlers
            }
          },
        },
      }
    )

    // Get user from session
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      console.log('🔴 [TRADING ACCOUNTS API POST] No session found', authError?.message)
      return NextResponse.json(
        { error: 'Unauthorized - No session' },
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
    }, supabaseAdmin)

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
