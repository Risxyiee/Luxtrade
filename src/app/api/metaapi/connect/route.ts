/**
 * API Route: Connect Trading Account to MetaApi
 * POST - Create MetaApi account and connect it to user's trading account
 */

import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'
import { createMetaApiAccount } from '@/lib/metaapi'

// POST: Connect trading account to MetaApi
export async function POST(req: NextRequest) {
  try {
    // Get authenticated user
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    // Parse request body
    const body = await req.json()
    const { tradingAccountId, accountNumber, password, brokerServer, platform } = body

    // Validate required fields
    if (!tradingAccountId || !accountNumber || !password || !brokerServer || !platform) {
      return NextResponse.json(
        {
          error: 'Missing required fields',
          required: ['tradingAccountId', 'accountNumber', 'password', 'brokerServer', 'platform']
        },
        { status: 400 }
      )
    }

    // Validate platform
    if (!['MT4', 'MT5'].includes(platform)) {
      return NextResponse.json(
        { error: 'Invalid platform. Must be MT4 or MT5' },
        { status: 400 }
      )
    }

    // Verify ownership of trading account
    const { data: tradingAccount, error: accountError } = await supabase
      .from('trading_accounts')
      .select('*')
      .eq('id', tradingAccountId)
      .eq('user_id', user.id)
      .single()

    if (accountError || !tradingAccount) {
      return NextResponse.json(
        { error: 'Trading account not found or access denied' },
        { status: 404 }
      )
    }

    // Check if already connected to MetaApi
    if (tradingAccount.metaapi_account_id) {
      return NextResponse.json(
        {
          error: 'Account already connected to MetaApi',
          metaapiAccountId: tradingAccount.metaapi_account_id
        },
        { status: 409 }
      )
    }

    // Create MetaApi account
    let metaApiAccount
    try {
      metaApiAccount = await createMetaApiAccount({
        accountNumber,
        password,
        server: brokerServer,
        platform: platform as 'MT4' | 'MT5',
        name: `${platform} Account ${accountNumber}`
      })
    } catch (metaApiError) {
      console.error('MetaApi connection error:', metaApiError)

      // Update trading account status to ERROR
      await supabase
        .from('trading_accounts')
        .update({
          status: 'ERROR',
          metaapi_account_id: null
        })
        .eq('id', tradingAccountId)

      return NextResponse.json(
        {
          error: 'Failed to connect to MetaApi',
          details: metaApiError instanceof Error ? metaApiError.message : 'Unknown error'
        },
        { status: 500 }
      )
    }

    // Update trading account with MetaApi account ID
    const { data: updatedAccount, error: updateError } = await supabase
      .from('trading_accounts')
      .update({
        metaapi_account_id: metaApiAccount.id,
        status: 'CONNECTED'
      })
      .eq('id', tradingAccountId)
      .select()
      .single()

    if (updateError) {
      console.error('Error updating trading account:', updateError)
      return NextResponse.json(
        { error: 'Failed to update trading account' },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      message: 'Account successfully connected to MetaApi',
      data: {
        tradingAccount: updatedAccount,
        metaApiAccount: {
          id: metaApiAccount.id,
          login: metaApiAccount.login,
          server: metaApiAccount.server,
          platform: metaApiAccount.platform
        }
      }
    })
  } catch (error) {
    console.error('Error in MetaApi connect:', error)
    return NextResponse.json(
      {
        error: 'Internal server error',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
}
