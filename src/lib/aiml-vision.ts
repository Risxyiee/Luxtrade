/**
 * Vision AI Integration — Google Gemini Vision (Free & Unlimited)
 * 
 * Uses Google Gemini Pro Vision for:
 * - Trading screenshot OCR/extraction (vision)
 * - Journal content generation
 * 
 * Benefits:
 * - ✅ GRATIS (60 calls/menit = 86,400 calls/hari)
 * - ✅ Akurat untuk membaca text, angka, chart
 * - ✅ Cepat responsnya
 */

import sharp from 'sharp'

const GEMINI_API_URL = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-pro-vision:generateContent'

// ==================== TYPES ====================

interface VisionOptions {
  timeout?: number
  maxRetries?: number
}

interface VisionResult {
  text: string
  raw?: any
}

// ==================== GOOGLE GEMINI VISION ====================

/**
 * Call Google Gemini Vision API
 */
async function callGemini(
  messages: any[],
  options: VisionOptions = {}
): Promise<VisionResult> {
  const { timeout = 90000, maxRetries = 2 } = options

  const apiKey = process.env.GOOGLE_GEMINI_API_KEY
  if (!apiKey) {
    throw new Error('GOOGLE_GEMINI_API_KEY is not configured')
  }

  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      console.log(`🤖 [Gemini] Attempt ${attempt + 1}/${maxRetries}`)

      const response = await fetch(`${GEMINI_API_URL}?key=${apiKey}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          contents: messages,
          generationConfig: {
            temperature: 0.1,
            maxOutputTokens: 2048,
          },
        }),
        signal: AbortSignal.timeout(timeout),
      })

      if (!response.ok) {
        const errText = await response.text()
        console.error(`❌ [Gemini] Error ${response.status}:`, errText)

        if (response.status === 429 && attempt < maxRetries - 1) {
          const wait = 3000 * (attempt + 1)
          console.log(`⏳ [Gemini] Rate limited, waiting ${wait}ms...`)
          await new Promise(r => setTimeout(r, wait))
          continue
        }

        throw new Error(`Gemini API error (${response.status}): ${errText.slice(0, 200)}`)
      }

      const data = await response.json()
      const text = data.candidates?.[0]?.content?.parts?.[0]?.text || ''

      if (!text.trim()) {
        throw new Error('Empty response from Gemini API')
      }

      console.log(`✅ [Gemini] Success: ${text.length} chars`)
      return { text, raw: data }
    } catch (error: any) {
      if (error.name === 'AbortError' || error.name === 'TimeoutError') {
        if (attempt < maxRetries - 1) {
          await new Promise(r => setTimeout(r, 3000))
          continue
        }
        throw new Error('Gemini API timeout.')
      }

      if (attempt === maxRetries - 1) throw error

      console.warn(`⚠️ [Gemini] Retrying...`, error.message)
      await new Promise(r => setTimeout(r, 2000 * (attempt + 1)))
    }
  }

  throw new Error('All Gemini API attempts failed')
}

/**
 * Analyze image with vision model (Google Gemini Vision)
 */
export async function analyzeImageWithAiml(
  imageBuffer: Buffer,
  prompt: string,
  options: VisionOptions = {}
): Promise<VisionResult> {
  // Optimize image: resize + JPEG compression
  const optimized = await sharp(imageBuffer)
    .resize(1920, 1080, { fit: 'inside', withoutEnlargement: true })
    .jpeg({ quality: 85 })
    .toBuffer()

  const base64Image = optimized.toString('base64')

  const messages = [
    {
      role: 'user',
      parts: [
        {
          text: prompt,
        },
        {
          inline_data: {
            mime_type: 'image/jpeg',
            data: base64Image,
          },
        },
      ],
    },
  ]

  return callGemini(messages, options)
}

/**
 * Text-only analysis (no image). Used for journal generation fallback.
 */
export async function analyzeTextWithZyloo(
  prompt: string,
  options: VisionOptions = {}
): Promise<VisionResult> {
  const messages = [
    {
      role: 'user',
      parts: [
        {
          text: prompt,
        },
      ],
    },
  ]

  return callGemini(messages, options)
}

/**
 * Unified fallback: tries vision (image + prompt), falls back to text-only.
 */
export async function analyzeWithFallback(
  imageBuffer: Buffer,
  imagePrompt: string,
  textFallbackPrompt: string,
  options: VisionOptions = {}
): Promise<VisionResult> {
  // Try vision first
  try {
    return await analyzeImageWithAiml(imageBuffer, imagePrompt, options)
  } catch (error: any) {
    console.warn(`⚠️ [Fallback] Vision failed: ${error.message}. Trying text-only...`)
  }

  // Fallback to text-only
  return analyzeTextWithZyloo(textFallbackPrompt, options)
}

// ==================== PROMPTS ====================

/**
 * Trade-specific extraction prompt
 * Optimized for MT4/MT5 trading screenshots and trade detail panels
 */
export const TRADE_EXTRACTION_PROMPT = `You are an expert at reading trading platform screenshots and extracting trade information.

Analyze this trading screenshot and extract ALL trade information visible.
The screenshot could be:
1. A trade history table (MT4/MT5 list view) showing multiple or single trades
2. A trading chart with trade markers/entry-exit points
3. A trade details/summary panel
4. Any combination of the above

Extract these fields:
- symbol: Currency pair or asset name (e.g., XAUUSD, EURUSD, GBPJPY, BTC/USD)
- type: "buy" or "sell" (lowercase)
- openPrice: Opening/entry price as number
- closePrice: Closing/exit price as number
- profitLoss: Profit/loss amount as number (negative for loss, e.g., -99.75)
- openTime: Opening/entry date and time (format: YYYY-MM-DD HH:mm:ss)
- closeTime: Closing/exit date and time (format: YYYY-MM-DD HH:mm:ss)
- stopLoss: Stop loss price if visible (number)
- takeProfit: Take profit price if visible (number)
- volume: Lot size if visible (number, e.g., 0.05)
- ticketNumber: Trade ticket/order number if visible (string)

RULES:
1. Return ONLY valid JSON, no markdown, no explanation, no backticks
2. All prices must be numbers not strings
3. type must be exactly "buy" or "sell" (lowercase)
4. If a field is not visible in the screenshot, use null (not undefined, not empty string)
5. For dates like "2026.06.23 06:04:10" convert to "2026-06-23 06:04:10"
6. For profit shown as "-99.75" or "$ -1995" or "-1995 (-0.48%)", extract just the number: -99.75
7. Look for:
   - S/L (stop loss), TP (take profit) labels
   - Entry and exit prices on chart
   - Bid/ask prices on table rows
   - Timestamps near prices
8. If it's a chart, look for:
   - Horizontal lines marking entry, stop loss, take profit
   - Labels with "BUY" or "SELL"
   - Timestamps on the bottom
   - Price levels on the right
9. If multiple trades visible, extract ONLY the most recent or active one
10. For profit calculation, if entry is 4140.35 and exit is 4120.40, the difference is -19.95

Example outputs:
{"symbol":"XAUUSD","type":"buy","openPrice":4140.35,"closePrice":4120.40,"profitLoss":-99.75,"openTime":"2026-06-23 06:04:10","closeTime":"2026-06-23 07:59:11","stopLoss":4120.40,"takeProfit":4182.15,"volume":0.05,"ticketNumber":"918673848"}

{"symbol":"EURUSD","type":"sell","openPrice":1.0875,"closePrice":1.0850,"profitLoss":250,"openTime":"2026-06-23 10:30:00","closeTime":"2026-06-23 11:45:00","stopLoss":1.0900,"takeProfit":1.0825,"volume":0.1,"ticketNumber":null}

Return the JSON now:
`
