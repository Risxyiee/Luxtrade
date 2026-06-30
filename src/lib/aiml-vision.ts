/**
 * AIML API — GLM-OCR Vision Integration
 * Docs: https://docs.aimlapi.com/api-references/vision-models/ocr-optical-character-recognition/zhipu/glm-ocr
 *
 * Uses GLM-4V-OCR model for high-accuracy trading screenshot extraction.
 * Returns structured JSON from trading platform screenshots (MT4/MT5).
 */

import sharp from 'sharp'

const AIML_API_URL = 'https://api.aimlapi.com/v1/chat/completions'

interface AimlVisionOptions {
  timeout?: number
  maxRetries?: number
}

interface VisionResult {
  text: string
  raw?: any
}

/**
 * Call AIML API (GLM-4V-OCR) with image + prompt
 */
export async function analyzeImageWithAiml(
  imageBuffer: Buffer,
  prompt: string,
  options: AimlVisionOptions = {}
): Promise<VisionResult> {
  const {
    timeout = 60000,
    maxRetries = 2,
  } = options

  const apiKey = process.env.AIML_API_KEY
  if (!apiKey) {
    throw new Error('AIML_API_KEY is not configured')
  }

  // Optimize image: resize + JPEG compression for faster upload
  const optimized = await sharp(imageBuffer)
    .resize(1920, 1080, { fit: 'inside', withoutEnlargement: true })
    .jpeg({ quality: 85 })
    .toBuffer()

  const base64Image = optimized.toString('base64')

  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      console.log(`🤖 [AIML Vision] GLM-OCR attempt ${attempt + 1}/${maxRetries}`)

      const response = await fetch(AIML_API_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          model: 'glm-4v-flash',
          messages: [
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
          ],
          max_tokens: 2048,
          temperature: 0.05,
        }),
        signal: AbortSignal.timeout(timeout),
      })

      if (!response.ok) {
        const errText = await response.text()
        console.error(`❌ [AIML Vision] Error ${response.status}:`, errText)

        if (response.status === 429 && attempt < maxRetries - 1) {
          await new Promise(r => setTimeout(r, 3000 * (attempt + 1)))
          continue
        }

        throw new Error(`AIML API error (${response.status}): ${errText.slice(0, 200)}`)
      }

      const data = await response.json()
      const text = data.choices?.[0]?.message?.content || ''

      if (!text.trim()) {
        throw new Error('Empty response from AIML API')
      }

      console.log(`✅ [AIML Vision] Success: ${text.length} chars`)

      return { text, raw: data }
    } catch (error: any) {
      if (error.name === 'AbortError' || error.name === 'TimeoutError') {
        if (attempt < maxRetries - 1) {
          await new Promise(r => setTimeout(r, 2000))
          continue
        }
        throw new Error('AIML API timeout. Coba lagi.')
      }

      if (attempt === maxRetries - 1) throw error

      console.warn(`⚠️ [AIML Vision] Retrying...`, error.message)
      await new Promise(r => setTimeout(r, 2000 * (attempt + 1)))
    }
  }

  throw new Error('All AIML API attempts failed')
}

/**
 * Trade-specific extraction prompt for GLM-OCR
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