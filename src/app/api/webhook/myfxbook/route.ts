/**
 * API Route: Myfxbook Webhook
 * POST - Receive trade data from Myfxbook and save to Supabase
 *
 * Myfxbook will send trade updates via webhook when connected accounts have new trades
 */

import { NextRequest, NextResponse } from 'next/server'

interface MyfxbookTrade {
  tradeId: string | number
  symbol: string
  action: 'buy' | 'sell'
  lots: number
  openPrice: number
  closePrice?: number
  openTime: string
  closeTime?: string
  profit: number
  commission?: number
  swap?: number
  accountId: string
}

interface MyfxbookWebhookPayload {
  event: 'trade_opened' | 'trade_closed' | 'trade_modified'
  account: {
    id: string
    name?: string
  }
  trades: MyfxbookTrade[]
  timestamp: string
}

// POST: Receive webhook from Myfxbook
export async function POST(req: NextRequest) {
  try {
    console.log('🔔 [MYFXBOOK WEBHOOK] Received webhook request')

    // Parse request body
    const body: MyfxbookWebhookPayload = await req.json()
    console.log('📋 [MYFXBOOK WEBHOOK] Payload:', body)

    // Validate required fields
    if (!body.event || !body.account || !body.trades || !Array.isArray(body.trades)) {
      console.log('❌ [MYFXBOOK WEBHOOK] Invalid payload structure')
      return NextResponse.json(
        { error: 'Invalid payload structure' },
        { status: 400 }
      )
    }

    // Create admin client for database operations
    const { createClient: createAdminClient } = await import('@supabase/supabase-js')
    const supabaseAdmin = createAdminClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    )

    if (!supabaseAdmin) {
      console.log('❌ [MYFXBOOK WEBHOOK] Supabase admin client not configured')
      return NextResponse.json(
        { error: 'Database not configured' },
        { status: 500 }
      )
    }

    // Find the user account linked to this Myfxbook account ID
    const { data: tradingAccount, error: accountError } = await supabaseAdmin
      .from('trading_accounts')
      .select('user_id, account_number, broker_server')
      .eq('metaapi_account_id', body.account.id)
      .single()

    if (accountError || !tradingAccount) {
      console.log('⚠️ [MYFXBOOK WEBHOOK] Trading account not found for Myfxbook ID:', body.account.id)
      // Still return 200 to prevent Myfxbook from retrying
      return NextResponse.json({ success: true, message: 'Account not linked' })
    }

    console.log('✅ [MYFXBOOK WEBHOOK] Found trading account:', tradingAccount.account_number)

    // Process each trade
    const processedTrades = []
    for (const trade of body.trades) {
      console.log('📊 [MYFXBOOK WEBHOOK] Processing trade:', trade.tradeId)

      // Determine trade status
      const isClosed = body.event === 'trade_closed' || !!trade.closePrice
      const status = isClosed ? 'CLOSED' : 'OPEN'

      // Check if trade already exists
      const { data: existingTrade } = await supabaseAdmin
        .from('trades')
        .select('id')
        .eq('user_id', tradingAccount.user_id)
        .eq('symbol', trade.symbol)
        .eq('entry_price', trade.openPrice)
        .eq('entry_date', trade.openTime)
        .maybeSingle()

      if (existingTrade) {
        console.log('⏭️ [MYFXBOOK WEBHOOK] Trade already exists, updating...')
        // Update existing trade
        const { data: updatedTrade, error: updateError } = await supabaseAdmin
          .from('trades')
          .update({
            exit_price: trade.closePrice || null,
            exit_date: trade.closeTime || null,
            status: status,
            profit_loss: trade.profit + (trade.commission || 0) + (trade.swap || 0),
            lot_size: trade.lots,
            updated_at: new Date().toISOString()
          })
          .eq('id', existingTrade.id)
          .select()
          .single()

        if (updateError) {
          console.error('❌ [MYFXBOOK WEBHOOK] Error updating trade:', updateError)
        } else {
          processedTrades.push(updatedTrade)
          console.log('✅ [MYFXBOOK WEBHOOK] Trade updated successfully')
        }
      } else {
        console.log('➕ [MYFXBOOK WEBHOOK] Creating new trade...')

        // Create new trade
        const { data: newTrade, error: insertError } = await supabaseAdmin
          .from('trades')
          .insert({
            user_id: tradingAccount.user_id,
            symbol: trade.symbol,
            type: trade.action.toUpperCase() as 'BUY' | 'SELL',
            entry_price: trade.openPrice,
            exit_price: trade.closePrice || null,
            quantity: trade.lots,
            lot_size: trade.lots,
            entry_date: trade.openTime,
            exit_date: trade.closeTime || null,
            status: status,
            profit_loss: trade.profit + (trade.commission || 0) + (trade.swap || 0),
            session: null,
            strategy: null,
            notes: `Synced from Myfxbook - Account: ${tradingAccount.account_number}`,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
          })
          .select()
          .single()

        if (insertError) {
          console.error('❌ [MYFXBOOK WEBHOOK] Error creating trade:', insertError)
        } else {
          processedTrades.push(newTrade)
          console.log('✅ [MYFXBOOK WEBHOOK] Trade created successfully')
        }
      }
    }

    console.log('🎉 [MYFXBOOK WEBHOOK] Successfully processed', processedTrades.length, 'trade(s)')

    return NextResponse.json({
      success: true,
      message: `Processed ${processedTrades.length} trade(s)`,
      processed: processedTrades.length,
      trades: processedTrades
    })

  } catch (error: any) {
    console.error('❌ [MYFXBOOK WEBHOOK] Error processing webhook:', error)
    return NextResponse.json(
      {
        error: 'Failed to process webhook',
        details: error.message
      },
      { status: 500 }
    )
  }
}

// GET: Verify webhook is working (for testing)
export async function GET(req: NextRequest) {
  return NextResponse.json({
    success: true,
    message: 'Myfxbook Webhook API is ready',
    endpoint: '/api/webhook/myfxbook',
    method: 'POST',
    expectedPayload: {
      event: 'trade_opened | trade_closed | trade_modified',
      account: { id: 'string' },
      trades: [
        {
          tradeId: 'string | number',
          symbol: 'string',
          action: 'buy | sell',
          lots: 'number',
          openPrice: 'number',
          closePrice: 'number (optional)',
          openTime: 'ISO string',
          closeTime: 'ISO string (optional)',
          profit: 'number',
          commission: 'number (optional)',
          swap: 'number (optional)',
          accountId: 'string'
        }
      ],
      timestamp: 'ISO string'
    }
  })
}
