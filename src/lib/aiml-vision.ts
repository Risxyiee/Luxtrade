/**
 * Vision AI Integration — Multi-provider fallback chain
 * 
 * Provider order:
 * 1. Gemini 2.5 Flash (Google AI Studio, GEMINI_API_KEY)
 * 2. OpenRouter free vision model (OPENROUTER_API_KEY)
 * 
 * If both fail, throws clear error for user to retry.
 */

import sharp from 'sharp'

// ==================== TYPES ====================

interface VisionOptions {
  timeout?: number
  maxRetries?: number
}

interface VisionResult {
  text: string
  raw?: any
  provider: string
}

// ==================== GEMINI 2.5 FLASH ====================

const GEMINI_API_URL = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent'

async function callGemini(
  messages: any[],
  options: VisionOptions = {}
): Promise<VisionResult> {
  const { timeout = 90000, maxRetries = 2 } = options

  const apiKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_GEMINI_API_KEY
  if (!apiKey) {
    throw new Error('GEMINI_API_KEY is not configured')
  }

  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      console.log(`🤖 [Gemini 2.5 Flash] Attempt ${attempt + 1}/${maxRetries}`)

      const response = await fetch(`${GEMINI_API_URL}?key=${apiKey}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
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
        console.error(`❌ [Gemini 2.5 Flash] Error ${response.status}:`, errText.slice(0, 200))

        // Rate limit / quota — retry with backoff
        if (response.status === 429 && attempt < maxRetries - 1) {
          const wait = 3000 * (attempt + 1)
          console.log(`⏳ [Gemini 2.5 Flash] Rate limited, waiting ${wait}ms...`)
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

      console.log(`✅ [Gemini 2.5 Flash] Success: ${text.length} chars`)
      return { text, raw: data, provider: 'gemini-2.5-flash' }
    } catch (error: any) {
      if (error.name === 'AbortError' || error.name === 'TimeoutError') {
        if (attempt < maxRetries - 1) {
          await new Promise(r => setTimeout(r, 3000))
          continue
        }
        throw new Error('Gemini API timeout.')
      }

      if (attempt === maxRetries - 1) throw error

      console.warn(`⚠️ [Gemini 2.5 Flash] Retrying...`, error.message)
      await new Promise(r => setTimeout(r, 2000 * (attempt + 1)))
    }
  }

  throw new Error('All Gemini API attempts failed')
}

// ==================== OPENROUTER FREE VISION ====================

const OPENROUTER_MODELS = [
  'meta-llama/llama-4-scout:free',
  'google/gemma-3-27b-it:free',
  'qwen/qwen3-235b-a22b:free',
]

let cachedOpenRouterModel: string | null = null

async function getOpenRouterModel(): Promise<string> {
  if (cachedOpenRouterModel) return cachedOpenRouterModel

  const apiKey = process.env.OPENROUTER_API_KEY
  if (!apiKey) throw new Error('OPENROUTER_API_KEY is not configured')

  // Try to find a working free vision model
  for (const model of OPENROUTER_MODELS) {
    try {
      console.log(`🔍 [OpenRouter] Checking model: ${model}`)
      const res = await fetch('https://openrouter.ai/api/v1/models', {
        headers: { 'Authorization': `Bearer ${apiKey}` },
        signal: AbortSignal.timeout(10000),
      })
      if (!res.ok) {
        console.warn(`⚠️ [OpenRouter] Failed to fetch models list`)
        break
      }
      const data = await res.json()
      const found = data.data?.find((m: any) => m.id === model)
      if (found) {
        cachedOpenRouterModel = model
        console.log(`✅ [OpenRouter] Using model: ${model}`)
        return model
      }
    } catch {
      // Continue to next model
    }
  }

  // Fallback to first model even if we couldn't verify
  cachedOpenRouterModel = OPENROUTER_MODELS[0]
  console.log(`⚠️ [OpenRouter] Using unverified model: ${cachedOpenRouterModel}`)
  return cachedOpenRouterModel!
}

async function callOpenRouter(
  imageBase64: string,
  prompt: string,
  options: VisionOptions = {}
): Promise<VisionResult> {
  const { timeout = 90000 } = options

  const apiKey = process.env.OPENROUTER_API_KEY
  if (!apiKey) {
    throw new Error('OPENROUTER_API_KEY is not configured')
  }

  const model = await getOpenRouterModel()

  console.log(`🤖 [OpenRouter] Attempting with model: ${model}`)

  const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`,
      'HTTP-Referer': 'https://luxtrade.id',
      'X-Title': 'LuxTrade',
    },
    body: JSON.stringify({
      model,
      messages: [
        {
          role: 'user',
          content: [
            { type: 'text', text: prompt },
            {
              type: 'image_url',
              image_url: { url: `data:image/jpeg;base64,${imageBase64}` },
            },
          ],
        },
      ],
      temperature: 0.1,
      max_tokens: 2048,
    }),
    signal: AbortSignal.timeout(timeout),
  })

  if (!response.ok) {
    const errText = await response.text()
    console.error(`❌ [OpenRouter] Error ${response.status}:`, errText.slice(0, 200))
    throw new Error(`OpenRouter API error (${response.status}): ${errText.slice(0, 200)}`)
  }

  const data = await response.json()
  const text = data.choices?.[0]?.message?.content || ''

  if (!text.trim()) {
    throw new Error('Empty response from OpenRouter API')
  }

  console.log(`✅ [OpenRouter] Success (${model}): ${text.length} chars`)
  return { text, raw: data, provider: `openrouter:${model}` }
}

// ==================== UNIFIED FUNCTIONS ====================

/**
 * Analyze image with vision model — tries Gemini first, then OpenRouter
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

  // === Provider 1: Gemini 2.5 Flash ===
  let geminiError: Error | null = null
  try {
    const geminiMessages = [
      {
        role: 'user',
        parts: [
          { text: prompt },
          { inline_data: { mime_type: 'image/jpeg', data: base64Image } },
        ],
      },
    ]
    return await callGemini(geminiMessages, options)
  } catch (error: any) {
    geminiError = error
    console.warn(`⚠️ [Fallback] Gemini 2.5 Flash failed: ${error.message}`)
  }

  // Short delay before fallback (unless it was a rate-limit, which already waited)
  if (!geminiError?.message?.includes('429')) {
    console.log(`⏳ [Fallback] Waiting 2s before trying OpenRouter...`)
    await new Promise(r => setTimeout(r, 2000))
  }

  // === Provider 2: OpenRouter Free Vision ===
  try {
    return await callOpenRouter(base64Image, prompt, options)
  } catch (error: any) {
    console.error(`❌ [Fallback] OpenRouter also failed: ${error.message}`)
  }

  // All providers failed
  throw new Error(
    'Semua provider AI gagal. Coba lagi nanti (biasanya karena rate limit sementara).'
  )
}

/**
 * Text-only analysis (no image). Tries Gemini, then OpenRouter.
 */
export async function analyzeTextWithZyloo(
  prompt: string,
  options: VisionOptions = {}
): Promise<VisionResult> {
  // === Provider 1: Gemini 2.5 Flash ===
  try {
    const geminiMessages = [{ role: 'user', parts: [{ text: prompt }] }]
    return await callGemini(geminiMessages, options)
  } catch (error: any) {
    console.warn(`⚠️ [Text Fallback] Gemini failed: ${error.message}`)
  }

  // Short delay before fallback
  await new Promise(r => setTimeout(r, 2000))

  // === Provider 2: OpenRouter Free ===
  try {
    const apiKey = process.env.OPENROUTER_API_KEY
    if (!apiKey) throw new Error('OPENROUTER_API_KEY not configured')

    const model = await getOpenRouterModel()
    console.log(`🤖 [OpenRouter Text] Using model: ${model}`)

    const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
        'HTTP-Referer': 'https://luxtrade.id',
        'X-Title': 'LuxTrade',
      },
      body: JSON.stringify({
        model,
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.1,
        max_tokens: 2048,
      }),
      signal: AbortSignal.timeout(options.timeout || 90000),
    })

    if (!response.ok) {
      const errText = await response.text()
      throw new Error(`OpenRouter error (${response.status}): ${errText.slice(0, 200)}`)
    }

    const data = await response.json()
    const text = data.choices?.[0]?.message?.content || ''
    if (!text.trim()) throw new Error('Empty response from OpenRouter')

    console.log(`✅ [OpenRouter Text] Success: ${text.length} chars`)
    return { text, raw: data, provider: `openrouter:${model}` }
  } catch (error: any) {
    console.error(`❌ [Text Fallback] OpenRouter also failed: ${error.message}`)
  }

  throw new Error(
    'Semua provider AI gagal. Coba lagi nanti.'
  )
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