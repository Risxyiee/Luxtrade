/**
 * Google Gemini Vision AI untuk analisis screenshot trading
 * Replace Z.ai dan Ollama dengan Gemini Vision API
 */

import { logger } from '../logger'

export interface GeminiConfig {
  apiKey: string
  configured: boolean
}

export interface GeminiVisionResponse {
  text: string
  tradeData?: {
    symbol?: string
    type?: 'BUY' | 'SELL'
    entry_price?: number
    exit_price?: number
    lot_size?: number
    stop_loss?: number
    take_profit?: number
    profit_loss?: number
    setup_type?: string
    timeframe?: string
    open_time?: string
    close_time?: string
  }
}

/**
 * Get Gemini configuration
 */
export function getGeminiConfig(): GeminiConfig {
  const apiKey = process.env.GOOGLE_GEMINI_API_KEY
  return {
    apiKey: apiKey || '',
    configured: !!apiKey,
  }
}

/**
 * Analyze trading screenshot dengan Google Gemini Vision
 */
export async function analyzeTradeScreenshotWithGemini(
  base64Image: string,
  customPrompt?: string
): Promise<GeminiVisionResponse> {
  const config = getGeminiConfig()

  if (!config.configured) {
    throw new Error('Google Gemini API not configured. Set GOOGLE_GEMINI_API_KEY env var.')
  }

  const systemPrompt = `Kamu adalah AI trading analyst untuk LuxTrade. Analisis screenshot trading terminal ini dan extract:

1. TRADE DATA:
   - Symbol/Pair (e.g., EUR/USD, BTCUSD)
   - Direction: BUY atau SELL
   - Entry Price
   - Exit/Close Price
   - Lot Size / Position Size
   - Stop Loss (jika terlihat)
   - Take Profit (jika terlihat)
   - P&L (Profit/Loss)
   - Timeframe (jika terlihat)
   - Open Time dan Close Time
   - Setup Type (e.g., scalp, swing, breakout, pullback)

2. QUALITY METRICS:
   - Risk/Reward Ratio (jika bisa dihitung)
   - Trade Duration
   - Market Condition (trending/ranging/volatile)

RESPONS FORMAT JSON:
{
  "symbol": "EUR/USD",
  "type": "BUY",
  "entry_price": 1.0950,
  "exit_price": 1.0965,
  "lot_size": 0.5,
  "stop_loss": 1.0940,
  "take_profit": 1.0980,
  "profit_loss": 75,
  "setup_type": "pullback",
  "timeframe": "H1",
  "open_time": "2026-08-27T10:30:00Z",
  "close_time": "2026-08-27T11:45:00Z",
  "analysis": "Brief analysis of the trade setup and execution"
}

Jika tidak bisa extract data, return field sebagai null tapi berikan penjelasan di field "analysis".`

  const userPrompt = customPrompt || 'Analyze this trading screenshot and extract trade data in JSON format.'

  try {
    const response = await fetch('https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-goog-api-key': config.apiKey,
      },
      body: JSON.stringify({
        contents: [
          {
            role: 'user',
            parts: [
              { text: systemPrompt + '\n\n' + userPrompt },
              {
                inlineData: {
                  mimeType: 'image/png',
                  data: base64Image,
                },
              },
            ],
          },
        ],
        generationConfig: {
          temperature: 0.1,
          topP: 0.95,
          topK: 40,
          maxOutputTokens: 2048,
        },
      }),
      signal: AbortSignal.timeout(30000), // 30 second timeout
    })

    if (!response.ok) {
      const error = await response.json()
      throw new Error(`Gemini API error: ${error.error?.message || response.statusText}`)
    }

    const data = await response.json()
    const content = data.candidates?.[0]?.content?.parts?.[0]?.text

    if (!content) {
      throw new Error('No response from Gemini')
    }

    logger.info('Gemini vision analysis completed')

    // Parse JSON from response
    const jsonMatch = content.match(/\{[^{}]*(?:\{[^{}]*\}[^{}]*)*\}/)
    if (!jsonMatch) {
      return {
        text: content,
        tradeData: undefined,
      }
    }

    try {
      const tradeData = JSON.parse(jsonMatch[0])
      return {
        text: content,
        tradeData: {
          symbol: tradeData.symbol,
          type: tradeData.type,
          entry_price: parseFloat(tradeData.entry_price),
          exit_price: parseFloat(tradeData.exit_price),
          lot_size: parseFloat(tradeData.lot_size),
          stop_loss: tradeData.stop_loss ? parseFloat(tradeData.stop_loss) : undefined,
          take_profit: tradeData.take_profit ? parseFloat(tradeData.take_profit) : undefined,
          profit_loss: parseFloat(tradeData.profit_loss),
          setup_type: tradeData.setup_type,
          timeframe: tradeData.timeframe,
          open_time: tradeData.open_time,
          close_time: tradeData.close_time,
        },
      }
    } catch (parseError) {
      logger.warn('Failed to parse trade data from Gemini response', parseError)
      return {
        text: content,
        tradeData: undefined,
      }
    }
  } catch (error) {
    logger.error('Gemini vision analysis failed', error)
    throw error
  }
}

/**
 * Generate trading journal entry description dari screenshot analysis
 */
export async function generateJournalEntryFromAnalysis(
  tradeData: GeminiVisionResponse['tradeData'] | undefined,
  customAnalysisPrompt?: string
): Promise<string> {
  if (!tradeData || !tradeData.symbol) {
    return 'Auto-generated journal entry from trading screenshot.'
  }

  const config = getGeminiConfig()
  if (!config.configured) {
    return buildDefaultJournalEntry(tradeData)
  }

  const prompt = customAnalysisPrompt || `Based on this trade data, write a brief professional trading journal entry (3-5 sentences):

Symbol: ${tradeData.symbol}
Type: ${tradeData.type}
Entry: ${tradeData.entry_price}
Exit: ${tradeData.exit_price}
Lot Size: ${tradeData.lot_size}
Setup: ${tradeData.setup_type}
P&L: ${tradeData.profit_loss}

Focus on: setup quality, execution, and lessons learned.`

  try {
    const response = await fetch('https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-goog-api-key': config.apiKey,
      },
      body: JSON.stringify({
        contents: [
          {
            role: 'user',
            parts: [{ text: prompt }],
          },
        ],
        generationConfig: {
          temperature: 0.7,
          topP: 0.95,
          topK: 40,
          maxOutputTokens: 500,
        },
      }),
      signal: AbortSignal.timeout(15000),
    })

    if (!response.ok) {
      logger.warn('Failed to generate journal entry with Gemini')
      return buildDefaultJournalEntry(tradeData)
    }

    const data = await response.json()
    const journalText = data.candidates?.[0]?.content?.parts?.[0]?.text

    return journalText || buildDefaultJournalEntry(tradeData)
  } catch (error) {
    logger.warn('Error generating journal entry', error)
    return buildDefaultJournalEntry(tradeData)
  }
}

/**
 * Build default journal entry jika AI gagal
 */
function buildDefaultJournalEntry(tradeData: GeminiVisionResponse['tradeData']): string {
  if (!tradeData) return 'Auto-generated journal entry from trading screenshot.'

  const pl = tradeData.profit_loss || 0
  const plStr = pl >= 0 ? `+${pl.toFixed(2)}` : `${pl.toFixed(2)}`
  const duration = tradeData.open_time && tradeData.close_time
    ? `Duration: ${new Date(tradeData.close_time).getTime() - new Date(tradeData.open_time).getTime()} ms`
    : ''

  return `Trade Analysis: ${tradeData.symbol}

Setup: ${tradeData.type} @ ${tradeData.entry_price}
Exit: ${tradeData.exit_price}
Position Size: ${tradeData.lot_size} lots
Setup Type: ${tradeData.setup_type || 'N/A'}
Timeframe: ${tradeData.timeframe || 'N/A'}

Result: ${plStr} (P&L)
${duration}

This trade was auto-captured from your trading terminal screenshot.`
}
