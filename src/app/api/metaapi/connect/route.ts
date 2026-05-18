/**
 * API Route: Connect Trading Account to MetaApi
 * POST - Create MetaApi account and connect it to user's trading account
 */

import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'
import { createMetaApiAccount } from '@/lib/metaapi'

// POST: Connect trading account to MetaApi
export async function POST(req: NextRequest) {
  console.log('🟢 [METAAPI CONNECT] POST request received')

  try {
    // Get authenticated user
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      console.log('🔴 [METAAPI CONNECT] Auth failed:', authError)
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    console.log('✅ [METAAPI CONNECT] User authenticated:', user.id)

    // Parse request body
    const body = await req.json()
    const { tradingAccountId, accountNumber, password, brokerServer, platform } = body

    console.log('📋 [METAAPI CONNECT] Request body:', {
      tradingAccountId,
      accountNumber: accountNumber ? '***' : 'MISSING',
      password: password ? '***' : 'MISSING',
      brokerServer,
      platform
    })

    // Validate required fields
    if (!tradingAccountId || !accountNumber || !password || !brokerServer || !platform) {
      console.log('🔴 [METAAPI CONNECT] Missing required fields')
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
      console.log('🔵 [METAAPI CONNECT] Creating MetaApi account for:', accountNumber, 'on', brokerServer)
      console.log('DEBUG: Menggunakan Token MetaApi:', process.env.METAAPI_TOKEN ? 'Tersedia' : 'KOSONG')
      console.log('DEBUG: Token length:', process.env.METAAPI_TOKEN?.length || 0)

      metaApiAccount = await createMetaApiAccount({
        accountNumber,
        password,
        server: brokerServer,
        platform: platform as 'MT4' | 'MT5',
        name: `${platform} Account ${accountNumber}`
      })
      console.log('✅ [METAAPI CONNECT] MetaApi account created successfully:', metaApiAccount.id)
    } catch (metaApiError) {
      console.error('🔴 METAAPI ERROR DETAIL:', metaApiError)

      // Get detailed error information
      const errorDetails = {
        name: metaApiError instanceof Error ? metaApiError.name : 'Unknown',
        message: metaApiError instanceof Error ? metaApiError.message : String(metaApiError),
        stack: metaApiError instanceof Error ? metaApiError.stack : undefined,
        fullError: metaApiError
      }

      console.error('🔴 [METAAPI CONNECT] Error details:', errorDetails)

      // ROLLBACK: Delete the trading account record to avoid duplicate key error on retry
      console.log('🔄 [METAAPI CONNECT] Rolling back - deleting trading account record:', tradingAccountId)
      const { error: deleteError } = await supabase
        .from('trading_accounts')
        .delete()
        .eq('id', tradingAccountId)

      if (deleteError) {
        console.error('🔴 [METAAPI CONNECT] Failed to delete trading account during rollback:', deleteError)
      } else {
        console.log('✅ [METAAPI CONNECT] Successfully deleted trading account during rollback')
      }

      return NextResponse.json(
        {
          error: 'Failed to connect to MetaApi',
          message: metaApiError instanceof Error ? metaApiError.message : 'Unknown error',
          details: errorDetails
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
      console.error('🔴 [METAAPI CONNECT] Error updating trading account:', updateError)
      // ROLLBACK: Delete the trading account since update failed
      await supabase
        .from('trading_accounts')
        .delete()
        .eq('id', tradingAccountId)
        .catch(err => console.error('Failed to delete during rollback:', err))
      return NextResponse.json(
        { error: 'Failed to update trading account' },
        { status: 500 }
      )
    }

    console.log('✅ [METAAPI CONNECT] Trading account updated successfully:', updatedAccount)
    console.log('✅ [METAAPI CONNECT] Sending success response to client...')

    const response = NextResponse.json({
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

    console.log('✅ [METAAPI CONNECT] Response created, returning to client')
    return response
  } catch (error) {
    console.error('🔴 METAAPI ERROR DETAIL:', error)

    // Get detailed error information
    const errorDetails = {
      name: error instanceof Error ? error.name : 'Unknown',
      message: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
      fullError: error
    }

    console.error('🔴 [METAAPI CONNECT] Main error details:', errorDetails)

    // ROLLBACK: Try to clean up trading account if possible
    const body = await req.json().catch(() => ({}))
    if (body.tradingAccountId) {
      console.log('🔄 [METAAPI CONNECT] Rolling back - deleting trading account record in main catch:', body.tradingAccountId)
      await supabase
        .from('trading_accounts')
        .delete()
        .eq('id', body.tradingAccountId)
        .catch(err => console.error('Failed to delete during rollback in main catch:', err))
    }

    return NextResponse.json(
      {
        error: 'Internal server error',
        message: error instanceof Error ? error.message : 'Unknown error',
        details: errorDetails
      },
      { status: 500 }
    )
  }
}
