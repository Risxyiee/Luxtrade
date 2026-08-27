/**
 * POST /api/auto-journal/from-image
 * Auto-generate journal entry from trading screenshot
 * Core feature: extract trade data + generate analysis
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClientForApi } from '@/lib/supabase/server'
import { isUserPro } from '@/lib/pro-check'
import { rateLimitByUser } from '@/lib/rate-limit'
import { logger } from '@/lib/logger'
import { db } from '@/lib/db'

interface TradeData {
  symbol?: string
  type?: 'BUY' | 'SELL'
  entry_price?: number
  exit_price?: number
  lot_size?: number
  stop_loss?: number
  take_profit?: number
  profit_loss?: number
  setup_type?: string
}

function normalizeTradingData(data: any): TradeData {
  const result: TradeData = {}

  if (data.pair || data.symbol) {
    result.symbol = (data.pair || data.symbol).toUpperCase()
  }

  if (data.type) {
    result.type = data.type.toUpperCase() === 'BUY' ? 'BUY' : 'SELL'
  }

  if (data.entry_price || data.openPrice || data.open_price) {
    result.entry_price = parseFloat(data.entry_price || data.openPrice || data.open_price)
  }

  if (data.exit_price || data.closePrice || data.close_price) {
    result.exit_price = parseFloat(data.exit_price || data.closePrice || data.close_price)
  }

  if (data.lot_size || data.size || data.volume) {
    result.lot_size = parseFloat(data.lot_size || data.size || data.volume)
  }

  if (data.stop_loss || data.stopLoss) {
    result.stop_loss = parseFloat(data.stop_loss || data.stopLoss)
  }

  if (data.take_profit || data.takeProfit) {
    result.take_profit = parseFloat(data.take_profit || data.takeProfit)
  }

  if (data.profit || data.profit_loss || data.profitLoss) {
    result.profit_loss = parseFloat(data.profit || data.profit_loss || data.profitLoss)
  }

  return result
}

export async function POST(request: NextRequest) {
  try {
    // Auth check
    const { supabase } = createClientForApi(request)
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Rate limit: 20 requests per hour per user
    const rl = rateLimitByUser('auto-journal', user.id, {
      maxRequests: 20,
      windowMs: 60 * 60 * 1000,
      message: 'Terlalu banyak permintaan auto-journal. Maksimal 20 per jam.',
    })
    if (rl) return rl

    // PRO check
    const pro = await isUserPro(user.id)
    if (!pro) {
      return NextResponse.json({
        error: 'Fitur auto-journal hanya untuk pengguna PRO. Upgrade sekarang!',
        code: 'PRO_REQUIRED',
        requiresUpgrade: true,
      }, { status: 403 })
    }

    // Parse form data
    const formData = await request.formData()
    const image = formData.get('image') as File
    const customPrompt = (formData.get('prompt') as string) || undefined

    if (!image) {
      return NextResponse.json({ error: 'Image file required' }, { status: 400 })
    }

    // Validate image type
    if (!image.type.startsWith('image/')) {
      return NextResponse.json({ error: 'File must be an image' }, { status: 400 })
    }

    logger.info('Auto-journal processing started', { userId: user.id, imageSize: image.size })

    // Convert to base64
    const buffer = await image.arrayBuffer()
    const base64 = Buffer.from(buffer).toString('base64')
    const dataUrl = `data:${image.type};base64,${base64}`

    // TODO: Call AI service to extract trade data from screenshot
    // For now, return placeholder
    const tradeData: TradeData = {
      symbol: 'EUR/USD',
      type: 'BUY',
      entry_price: 1.0950,
      exit_price: 1.0965,
      lot_size: 0.5,
      profit_loss: 75,
    }

    // Create trade record
    const trade = await db.trade.create({
      data: {
        user_id: user.id,
        symbol: tradeData.symbol!,
        type: tradeData.type!,
        open_price: tradeData.entry_price || 0,
        close_price: tradeData.exit_price || 0,
        lot_size: tradeData.lot_size || 0,
        profit_loss: tradeData.profit_loss || 0,
        open_time: new Date(),
        close_time: new Date(),
        stop_loss: tradeData.stop_loss,
        take_profit: tradeData.take_profit,
        setup_type: tradeData.setup_type,
        image_url: dataUrl, // Store screenshot as data URL
      },
    })

    // Create auto-generated journal entry
    const journal = await db.journalEntry.create({
      data: {
        user_id: user.id,
        title: `Trade: ${tradeData.symbol} ${tradeData.type} - ${new Date().toLocaleDateString('id-ID')}`,
        content: `Auto-generated journal entry from screenshot.\n\nTrade Details:\n- Symbol: ${tradeData.symbol}\n- Type: ${tradeData.type}\n- Entry: ${tradeData.entry_price}\n- Exit: ${tradeData.exit_price}\n- P&L: ${tradeData.profit_loss}`,
        image_url: dataUrl,
        linked_journal_id: trade.id,
      },
    })

    logger.info('Auto-journal created successfully', {
      userId: user.id,
      tradeId: trade.id,
      journalId: journal.id,
    })

    return NextResponse.json({
      success: true,
      trade,
      journal,
      extracted: tradeData,
    })
  } catch (error) {
    logger.error('Auto-journal error', error, { userId: (error as any)?.user?.id })
    return NextResponse.json(
      { error: 'Failed to process image' },
      { status: 500 }
    )
  }
}
