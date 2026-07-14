/**
 * Tesseract.js OCR Helper
 * Free OCR alternative to OpenAI Vision
 */

import Tesseract from 'tesseract.js'

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
 * Perform OCR on image using Tesseract.js (Free)
 */
export async function performOCR(
  imageBuffer: Buffer | string,
  options: {
    language?: string
    oem?: number
    psm?: number
  } = {}
): Promise<OCRResult> {
  const {
    language = 'eng',
    oem = 3, // LSTM OCR Engine mode
    psm = 6  // Assume uniform block of text
  } = options

  try {
    console.log('🔍 [Tesseract] Starting OCR...')

    const result = await Tesseract.recognize(
      imageBuffer,
      language,
      {
        logger: (m: any) => {
          if (m.status === 'recognizing text') {
            console.log(`🔍 [Tesseract] Progress: ${(m.progress * 100).toFixed(0)}%`)
          }
        },
      }
    )

    const confidence = result.data.confidence
    const text = result.data.text

    console.log(`✅ [Tesseract] OCR completed with ${confidence.toFixed(1)}% confidence`)
    console.log(`📝 [Tesseract] Extracted text length: ${text.length} chars`)

    return {
      text,
      confidence
    }
  } catch (error) {
    console.error('❌ [Tesseract] OCR failed:', error)
    throw new Error('Tesseract OCR failed: ' + (error instanceof Error ? error.message : String(error)))
  }
}

/**
 * Parse MT5/MT4 trade data from OCR text
 */
export function parseMT5TradeData(ocrText: string): ParsedTradeData[] {
  const trades: ParsedTradeData[] = []

  console.log('🔍 [Tesseract] Parsing trade data from OCR text...')

  // Split text into lines
  const lines = ocrText.split('\n').filter(line => line.trim())

  // Pattern for MT5/MT4 trade rows
  // Format: Symbol Type Lot Open Close Profit
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
        console.log(`✅ [Tesseract] Parsed trade: ${trade.symbol} ${trade.type}`)
        break
      }
    }
  }

  console.log(`📊 [Tesseract] Parsed ${trades.length} trades from OCR text`)
  return trades
}

/**
 * Parse trading journal data from OCR text
 */
export function parseJournalData(ocrText: string): any {
  console.log('🔍 [Tesseract] Parsing journal data from OCR text...')

  // Extract symbol
  const symbolMatch = ocrText.match(/([A-Z]{3,8})/i)
  const symbol = symbolMatch ? symbolMatch[1].toUpperCase() : ''

  // Extract trade type
  const typeMatch = ocrText.match(/(BUY|SELL)/i)
  const type = typeMatch ? typeMatch[1].toUpperCase() : 'BUY'

  // Extract profit/loss
  const profitMatch = ocrText.match(/(-?\d+\.?\d*)\s*(USD|profit|pips)/i)
  const profit_loss = profitMatch ? parseFloat(profitMatch[1]) : 0

  // Extract prices
  const priceMatches = ocrText.match(/\d+\.\d+/g)
  const open_price = priceMatches && priceMatches[0] ? parseFloat(priceMatches[0]) : 0
  const close_price = priceMatches && priceMatches[1] ? parseFloat(priceMatches[1]) : open_price

  console.log(`📊 [Tesseract] Parsed: ${symbol} ${type} P/L: $${profit_loss}`)

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
      content: 'Trade imported from screenshot using OCR. Please add your analysis and notes.',
      mood: profit_loss >= 0 ? 'confident' : 'neutral',
      market_condition: 'ranging',
      tags: [symbol.toLowerCase(), 'ocr-import'],
      setup_type: 'imported',
      risk_reward_ratio: 0
    },
    raw_analysis: ocrText
  }
}

/**
 * Cleanup Tesseract worker
 */
export async function cleanupOCR() {
  try {
    await Tesseract.terminate()
    console.log('🧹 [Tesseract] Worker terminated')
  } catch (error) {
    console.warn('⚠️ [Tesseract] Cleanup warning:', error)
  }
}