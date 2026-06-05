/**
 * Simple Regex-based OCR Helper (Server-side)
 * Fallback when VLM services are not available
 */

export interface OCRResult {
  text: string
  confidence: number
}

export interface ParsedTradeData {
  symbol?: string
  type?: 'BUY' | 'SELL'
  lot_size?: number
  open_price?: number
  close_price?: number
  profit_loss?: number
  time?: string
}

/**
 * Parse MT5/MT4 trade data from text
 */
export function parseMT5TradeData(text: string): ParsedTradeData[] {
  const trades: ParsedTradeData[] = []

  console.log('🔍 [Simple Parser] Parsing trade data from text...')

  // Split text into lines
  const lines = text.split('\n').filter(line => line.trim())

  // Pattern for MT5/MT4 trade rows
  const tradePatterns = [
    // Pattern 1: XAUUSD BUY 0.1 4500.00 4510.00 100.00
    /([A-Z]{3,8})\s+(BUY|SELL)\s+(\d+\.?\d*)\s+(\d+\.?\d*)\s+(\d+\.?\d*)\s+(-?\d+\.?\d*)/i,
    // Pattern 2: Symbol,Type,Lot,Open,Close,Profit (with commas)
    /([A-Z]{3,8})[,;]\s*(BUY|SELL)[,;]\s*(\d+\.?\d*)[,;]\s*(\d+\.?\d*)[,;]\s*(\d+\.?\d*)[,;]\s*(-?\d+\.?\d*)/i,
  ]

  for (const line of lines) {
    for (const pattern of tradePatterns) {
      const match = line.match(pattern)
      if (match) {
        const trade: ParsedTradeData = {
          symbol: match[1].toUpperCase(),
          type: match[2].toUpperCase() as 'BUY' | 'SELL',
          lot_size: parseFloat(match[3]),
          open_price: parseFloat(match[4]),
          close_price: parseFloat(match[5]),
          profit_loss: parseFloat(match[6]),
        }
        trades.push(trade)
        console.log(`✅ [Simple Parser] Parsed trade: ${trade.symbol} ${trade.type}`)
        break
      }
    }
  }

  console.log(`📊 [Simple Parser] Parsed ${trades.length} trades`)
  return trades
}

/**
 * Parse trading journal data from text
 */
export function parseJournalData(text: string): any {
  console.log('🔍 [Simple Parser] Parsing journal data from text...')

  // Extract symbol
  const symbolMatch = text.match(/([A-Z]{3,8})/i)
  const symbol = symbolMatch ? symbolMatch[1].toUpperCase() : 'XAUUSD'

  // Extract trade type
  const typeMatch = text.match(/(BUY|SELL)/i)
  const type = typeMatch ? typeMatch[1].toUpperCase() : 'BUY'

  // Extract profit/loss
  const profitMatch = text.match(/(-?\d+\.?\d*)\s*(USD|profit|pips|\$)/i)
  const profit_loss = profitMatch ? parseFloat(profitMatch[1]) : 0

  // Extract prices
  const priceMatches = text.match(/\d+\.\d+/g)
  const open_price = priceMatches && priceMatches[0] ? parseFloat(priceMatches[0]) : 0
  const close_price = priceMatches && priceMatches[1] ? parseFloat(priceMatches[1]) : open_price

  console.log(`📊 [Simple Parser] Parsed: ${symbol} ${type} P/L: $${profit_loss}`)

  return {
    trade: {
      symbol,
      type,
      open_price,
      close_price,
      profit_loss,
      lot_size: 0.1,
      stop_loss: 0,
      take_profit: 0,
      open_time: new Date().toISOString(),
      close_time: new Date().toISOString(),
      swap: 0,
      commission: 0,
      order_id: '',
      platform: 'MT5'
    },
    journal: {
      title: `${symbol} ${type} - ${profit_loss >= 0 ? 'Profit' : 'Loss'} $${Math.abs(profit_loss).toFixed(2)}`,
      content: 'Trade imported from screenshot. Please add your analysis and notes manually.',
      mood: profit_loss >= 0 ? 'confident' : 'neutral',
      market_condition: 'ranging',
      tags: [symbol.toLowerCase(), 'imported'],
      setup_type: 'imported',
      risk_reward_ratio: 0
    },
    raw_analysis: text
  }
}

/**
 * Cleanup (no-op for simple parser)
 */
export async function cleanupOCR() {
  // No-op for simple parser
}