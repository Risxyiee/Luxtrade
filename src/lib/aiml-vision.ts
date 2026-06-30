/**
 * Vision AI Integration — Zyloo Claude Opus 4.7 (Primary)
 * Fallback chain: Zyloo Claude Opus (vision) → Zyloo Claude Opus (text) → Basic template
 *
 * Uses Claude Opus 4.7 via Zyloo for:
 * - Trading screenshot OCR/extraction (vision)
 * - Journal content generation (vision or text)
 */

import sharp from 'sharp'

const ZYLOO_API_URL = 'https://api.zyloo.io/v1/chat/completions'

// ==================== TYPES ====================

interface VisionOptions {
  timeout?: number
  maxRetries?: number
}

interface VisionResult {
  text: string
  raw?: any
}

// ==================== ZYLOO CLAUDE OPUS (PRIMARY) ====================

/**
 * Call Zyloo API (Claude Opus 4.7) — supports both vision (image + text) and text-only.
 * Claude Opus natively supports multimodal input.
 */
async function callZyloo(
  messages: any[],
  options: VisionOptions = {}
): Promise<VisionResult> {
  const { timeout = 90000, maxRetries = 2 } = options

  const apiKey = process.env.ZYLOO_API_KEY
  if (!apiKey) {
    throw new Error('ZYLOO_API_KEY is not configured')
  }

  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      console.log(`🤖 [Zyloo] Claude Opus attempt ${attempt + 1}/${maxRetries}`)

      const response = await fetch(ZYLOO_API_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          model: 'zyloo/claude-opus-4-7',
          messages,
          max_tokens: 4096,
          temperature: 0.1,
        }),
        signal: AbortSignal.timeout(timeout),
      })

      if (!response.ok) {
        const errText = await response.text()
        console.error(`❌ [Zyloo] Error ${response.status}:`, errText)

        if (response.status === 429 && attempt < maxRetries - 1) {
          const wait = 3000 * (attempt + 1)
          console.log(`⏳ [Zyloo] Rate limited, waiting ${wait}ms...`)
          await new Promise(r => setTimeout(r, wait))
          continue
        }

        throw new Error(`Zyloo API error (${response.status}): ${errText.slice(0, 200)}`)
      }

      const data = await response.json()
      const text = data.choices?.[0]?.message?.content || ''

      if (!text.trim()) {
        throw new Error('Empty response from Zyloo API')
      }

      console.log(`✅ [Zyloo] Success: ${text.length} chars`)
      return { text, raw: data }
    } catch (error: any) {
      if (error.name === 'AbortError' || error.name === 'TimeoutError') {
        if (attempt < maxRetries - 1) {
          await new Promise(r => setTimeout(r, 3000))
          continue
        }
        throw new Error('Zyloo API timeout.')
      }

      if (attempt === maxRetries - 1) throw error

      console.warn(`⚠️ [Zyloo] Retrying...`, error.message)
      await new Promise(r => setTimeout(r, 2000 * (attempt + 1)))
    }
  }

  throw new Error('All Zyloo API attempts failed')
}

/**
 * Analyze image with vision model (Claude Opus via Zyloo).
 * Sends image + text prompt together.
 */
export async function analyzeImageWithAiml(
  imageBuffer: Buffer,
  prompt: string,
  options: VisionOptions = {}
): Promise<VisionResult> {
  // Optimize image: resize + JPEG compression for faster upload
  const optimized = await sharp(imageBuffer)
    .resize(1920, 1080, { fit: 'inside', withoutEnlargement: true })
    .jpeg({ quality: 85 })
    .toBuffer()

  const base64Image = optimized.toString('base64')

  const messages = [
    {
      role: 'user',
      content: [
        {
          type: 'image_url',
          image_url: {
            url: `data:image/jpeg;base64,${base64Image}`,
          },
        },
        {
          type: 'text',
          text: prompt,
        },
      ],
    },
  ]

  return callZyloo(messages, options)
}

/**
 * Text-only analysis (no image). Used for journal generation fallback.
 */
export async function analyzeTextWithZyloo(
  prompt: string,
  options: VisionOptions = {}
): Promise<VisionResult> {
  const messages = [
    { role: 'user', content: prompt },
  ]

  return callZyloo(messages, options)
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
  // Try vision first (Claude Opus supports multimodal)
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
 * Optimized for MT4/MT5 trading screenshots
 */
export const TRADE_EXTRACTION_PROMPT = `Analyze this trading screenshot (MT5/MT4 or similar platform) and extract ALL trade information.

Extract these fields from the screenshot:
- symbol: Currency pair or asset name (e.g., XAUUSD, EURUSD, GBPJPY)
- type: "buy" or "sell" (lowercase)
- openPrice: Opening price as number
- closePrice: Closing price as number
- profitLoss: Profit/loss amount as number (negative for loss, e.g., -99.75)
- openTime: Opening date and time (format: YYYY-MM-DD HH:mm:ss)
- closeTime: Closing date and time (format: YYYY-MM-DD HH:mm:ss)
- stopLoss: Stop loss price if visible (number)
- takeProfit: Take profit price if visible (number)
- volume: Lot size if visible (number, e.g., 0.05)
- ticketNumber: Trade ticket number if visible (string)

RULES:
1. Return ONLY valid JSON, no markdown, no explanation
2. Prices must be numbers not strings
3. type must be exactly "buy" or "sell"
4. If a field is not visible in the screenshot, use null
5. For date like "2026.06.23 06:04:10" convert to "2026-06-23 06:04:10"
6. For profit shown as "$ -1995 (-0.48%)" the profitLoss is -1995
7. Focus on the specific trade entry, not summary stats

Example output:
{"symbol":"XAUUSD","type":"buy","openPrice":4140.35,"closePrice":4120.40,"profitLoss":-99.75,"openTime":"2026-06-23 06:04:10","closeTime":"2026-06-23 07:59:11","stopLoss":4120.40,"takeProfit":4182.15,"volume":0.05,"ticketNumber":"9186738488"}`
