/**
 * API Route: Sync Deals from MetaApi
 * GET - Fetch deals/trades from MetaApi and sync to local database
 */

import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'
import { getMetaApiDeals } from '@/lib/metaapi'

// GET: Fetch and sync deals from MetaApi
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

    // Get query parameters
    const searchParams = req.nextUrl.searchParams
    const tradingAccountId = searchParams.get('tradingAccountId')
    const startTime = searchParams.get('startTime')
    const endTime = searchParams.get('endTime')
    const limit = searchParams.get('limit')
    const offset = searchParams.get('offset')

    if (!tradingAccountId) {
      return NextResponse.json(
        { error: 'Missing tradingAccountId parameter' },
        { status: 400 }
      )
    }

    // Get trading account
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

    // Check if connected to MetaApi
    if (!tradingAccount.metaapi_account_id) {
      return NextResponse.json(
        { error: 'Trading account not connected to MetaApi' },
        { status: 400 }
      )
    }

    // Fetch deals from MetaApi
    let deals
    try {
      deals = await getMetaApiDeals(tradingAccount.metaapi_account_id, {
        startTime: startTime || undefined,
        endTime: endTime || undefined,
        limit: limit ? parseInt(limit) : undefined,
        offset: offset ? parseInt(offset) : undefined
      })
    } catch (metaApiError) {
      console.error('MetaApi deals fetch error:', metaApiError)
      return NextResponse.json(
        {
          error: 'Failed to fetch deals from MetaApi',
          details: metaApiError instanceof Error ? metaApiError.message : 'Unknown error'
        },
        { status: 500 }
      )
    }

    // Sync deals to local trades table
    let syncedCount = 0
    let skippedCount = 0
    const errors: string[] = []

    if (Array.isArray(deals) && deals.length > 0) {
      for (const deal of deals) {
        try {
          // Check if deal already exists (by dealId)
          const { data: existingTrade } = await supabase
            .from('trades')
            .select('id')
            .eq('deal_id', String(deal.id))
            .single()

          if (existingTrade) {
            skippedCount++
            continue
          }

          // Map MetaApi deal to trade format
          const tradeData = {
            user_id: user.id,
            symbol: deal.symbol || 'UNKNOWN',
            type: deal.type?.toUpperCase() || 'BUY',
            lot_size: deal.volume || 0,
            open_price: deal.price || 0,
            close_price: deal.closePrice || deal.price || 0,
            profit_loss: deal.profit || 0,
            session: 'MetaApi',
            open_time: deal.time ? new Date(deal.time).toISOString() : new Date().toISOString(),
            close_time: deal.closeTime ? new Date(deal.closeTime).toISOString() : new Date().toISOString(),
            deal_id: String(deal.id),
            comment: deal.comment || '',
            swap: deal.swap || 0,
            commission: deal.commission || 0,
            platform: tradingAccount.platform,
            trading_account_id: tradingAccountId
          }

          // Insert trade
          const { error: insertError } = await supabase
            .from('trades')
            .insert(tradeData)

          if (insertError) {
            console.error('Error inserting trade:', insertError)
            errors.push(`Deal ${deal.id}: ${insertError.message}`)
          } else {
            syncedCount++
          }
        } catch (error) {
          console.error('Error processing deal:', error)
          errors.push(`Deal ${deal.id}: ${error instanceof Error ? error.message : 'Unknown error'}`)
        }
      }
    }

    return NextResponse.json({
      success: true,
      data: {
        deals: deals || [],
        sync: {
          totalFetched: Array.isArray(deals) ? deals.length : 0,
          synced: syncedCount,
          skipped: skippedCount,
          errors: errors.length > 0 ? errors : undefined
        }
      }
    })
  } catch (error) {
    console.error('Error in MetaApi deals sync:', error)
    return NextResponse.json(
      {
        error: 'Internal server error',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
}
