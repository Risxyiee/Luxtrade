/**
 * API Route: FxBlue Webhook
 * POST - Receive trade data from FxBlue and save to Supabase
 *
 * FxBlue will send trade updates via webhook when connected accounts have new trades
 */

import { NextRequest, NextResponse } from 'next/server'

interface FxBlueTrade {
  id: string | number
  symbol: string
  type: 'BUY' | 'SELL' | 'buy' | 'sell'
  lots: number
  openPrice: number
  closePrice?: number
  openTime: string
  closeTime?: string
  profit: number
  pips?: number
  commission?: number
  swap?: number
  comment?: string
}

interface FxBlueWebhookPayload {
  event: 'new_trade' | 'close_trade' | 'modify_trade'
  account: {
    id: string
    login: string
    server: string
    name?: string
  }
  trade: FxBlueTrade
  timestamp: string
}

// POST: Receive webhook from FxBlue
export async function POST(req: NextRequest) {
  try {
    // SECURITY: Webhook secret is REQUIRED — fail-safe if not configured.
    const webhookSecret = process.env.WEBHOOK_SECRET
    if (!webhookSecret) {
      console.error('🚨 [FXBLUE WEBHOOK] WEBHOOK_SECRET env var is not set — rejecting all webhook calls')
      return NextResponse.json(
        { error: 'Webhook not configured' },
        { status: 503 }
      )
    }

    const authHeader = req.headers.get('authorization') || req.headers.get('x-webhook-secret')
    if (authHeader !== `Bearer ${webhookSecret}`) {
      console.warn('⚠️ [FXBLUE WEBHOOK] Invalid or missing webhook secret')
      return NextResponse.json({ error: 'Invalid webhook secret' }, { status: 401 })
    }

    console.log('🔔 [FXBLUE WEBHOOK] Received webhook request')

    // Parse request body
    const body: FxBlueWebhookPayload = await req.json()
    console.log('📋 [FXBLUE WEBHOOK] Payload:', body)

    // Validate required fields
    if (!body.event || !body.account || !body.trade) {
      console.log('❌ [FXBLUE WEBHOOK] Invalid payload structure')
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
      console.log('❌ [FXBLUE WEBHOOK] Supabase admin client not configured')
      return NextResponse.json(
        { error: 'Database not configured' },
        { status: 500 }
      )
    }

    // Find the user account linked to this FxBlue account ID
    const { data: tradingAccount, error: accountError } = await supabaseAdmin
      .from('trading_accounts')
      .select('user_id, account_number, broker_server')
      .eq('metaapi_account_id', `fxblue-${body.account.id}`)
      .single()

    if (accountError || !tradingAccount) {
      console.log('⚠️ [FXBLUE WEBHOOK] Trading account not found for FxBlue ID:', body.account.id)
      // Still return 200 to prevent FxBlue from retrying
      return NextResponse.json({ success: true, message: 'Account not linked' })
    }

    console.log('✅ [FXBLUE WEBHOOK] Found trading account:', tradingAccount.account_number)

    const trade = body.trade

    // Determine trade status
    const isClosed = body.event === 'close_trade' || !!trade.closePrice
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
      console.log('⏭️ [FXBLUE WEBHOOK] Trade already exists, updating...')

      // Update existing trade
      const { data: updatedTrade, error: updateError } = await supabaseAdmin
        .from('trades')
        .update({
          exit_price: trade.closePrice || null,
          exit_date: trade.closeTime || null,
          status: status,
          profit_loss: trade.profit + (trade.commission || 0) + (trade.swap || 0),
          lot_size: trade.lots,
          notes: trade.comment || `Synced from FxBlue - Account: ${tradingAccount.account_number}`,
          updated_at: new Date().toISOString()
        })
        .eq('id', existingTrade.id)
        .select()
        .single()

      if (updateError) {
        console.error('❌ [FXBLUE WEBHOOK] Error updating trade:', updateError)
        return NextResponse.json(
          { error: 'Failed to update trade' },
          { status: 500 }
        )
      }

      console.log('✅ [FXBLUE WEBHOOK] Trade updated successfully')

      return NextResponse.json({
        success: true,
        message: 'Trade updated successfully',
        trade: updatedTrade
      })
    }

    console.log('➕ [FXBLUE WEBHOOK] Creating new trade...')

    // Create new trade
    const { data: newTrade, error: insertError } = await supabaseAdmin
      .from('trades')
      .insert({
        user_id: tradingAccount.user_id,
        symbol: trade.symbol,
        type: trade.type.toUpperCase() as 'BUY' | 'SELL',
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
        notes: trade.comment || `Synced from FxBlue - Account: ${tradingAccount.account_number}`,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      })
      .select()
      .single()

    if (insertError) {
      console.error('❌ [FXBLUE WEBHOOK] Error creating trade:', insertError)
      return NextResponse.json(
        { error: 'Failed to create trade' },
        { status: 500 }
      )
    }

    console.log('✅ [FXBLUE WEBHOOK] Trade created successfully')

    return NextResponse.json({
      success: true,
      message: 'Trade created successfully',
      trade: newTrade
    })

  } catch (error: any) {
    console.error('❌ [FXBLUE WEBHOOK] Error processing webhook:', error)
    return NextResponse.json(
      { error: 'Failed to process webhook' },
      { status: 500 }
    )
  }
}

// GET: Verify webhook is working (for testing)
export async function GET(req: NextRequest) {
  return NextResponse.json({
    success: true,
    message: 'FxBlue Webhook API is ready',
    endpoint: '/api/webhook/fxblue',
    method: 'POST',
    expectedPayload: {
      event: 'new_trade | close_trade | modify_trade',
      account: {
        id: 'string',
        login: 'string',
        server: 'string',
        name: 'string (optional)'
      },
      trade: {
        id: 'string | number',
        symbol: 'string',
        type: 'BUY | SELL',
        lots: 'number',
        openPrice: 'number',
        closePrice: 'number (optional)',
        openTime: 'ISO string',
        closeTime: 'ISO string (optional)',
        profit: 'number',
        pips: 'number (optional)',
        commission: 'number (optional)',
        swap: 'number (optional)',
        comment: 'string (optional)'
      },
      timestamp: 'ISO string'
    }
  })
}
