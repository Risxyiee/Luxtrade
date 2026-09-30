/**
 * Vision AI Integration — Multi-provider fallback chain
 * 
 * Provider order:
 * 1. Gemini 2.5 Flash (Google AI Studio, GEMINI_API_KEY)
 * 2. OpenRouter free vision model (OPENROUTER_API_KEY)
 * 
 * If both fail, throws clear error for user to retry.
 * 
 * EDGE-COMPATIBLE: No sharp/Buffer/Node.js native dependencies.
 * Image optimization (resize/compress) should be done client-side before upload.
 */

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
  // maxRetries means total attempts (must be >= 1)
  const attempts = Math.max(1, options.maxRetries ?? 2)
  const timeout = options.timeout ?? 90000

  const apiKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_GEMINI_API_KEY
  if (!apiKey) {
    throw new Error('GEMINI_API_KEY is not configured')
  }

  for (let attempt = 0; attempt < attempts; attempt++) {
    try {
      console.log(`🤖 [Gemini 2.5 Flash] Attempt ${attempt + 1}/${attempts}`)

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
        if (response.status === 429 && attempt < attempts - 1) {
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
        if (attempt < attempts - 1) {
          await new Promise(r => setTimeout(r, 3000))
          continue
        }
        throw new Error('Gemini API timeout.')
      }

      if (attempt === attempts - 1) throw error

      console.warn(`⚠️ [Gemini 2.5 Flash] Retrying...`, error.message)
      await new Promise(r => setTimeout(r, 2000 * (attempt + 1)))
    }
  }

  throw new Error('All Gemini API attempts failed')
}

// ==================== OPENROUTER FREE VISION ====================

// OpenRouter free vision models — just use the first one directly.
// No model discovery API call (saves 2-3s on cold start / fallback).
const OPENROUTER_MODEL = 'meta-llama/llama-4-scout:free'

function getOpenRouterModel(): string {
  return OPENROUTER_MODEL
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
      'HTTP-Referer': 'https://luxtradee.web.id',
      'X-Title': 'LuxTradee',
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
 * Analyze image with vision model using raw bytes (Uint8Array/ArrayBuffer).
 * Edge-safe: no sharp, no Buffer, no Node.js natives.
 * The caller should pre-optimize the image client-side.
 */
export async function analyzeImageWithAiml(
  imageBytes: Uint8Array | ArrayBuffer,
  prompt: string,
  options: VisionOptions = {}
): Promise<VisionResult> {
  // Convert bytes to base64 using Web API (Edge-safe)
  const bytes = imageBytes instanceof Uint8Array ? imageBytes : new Uint8Array(imageBytes)
  let binary = ''
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i])
  }
  const base64Image = btoa(binary)
  return analyzeImageBase64WithAiml(base64Image, prompt, options)
}

/**
 * Analyze image with vision model using pre-encoded base64.
 * Skips sharp optimization — use when image is already optimized.
 * This avoids running sharp multiple times for the same image.
 */
export async function analyzeImageBase64WithAiml(
  base64Image: string,
  prompt: string,
  options: VisionOptions = {}
): Promise<VisionResult> {
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

  // All providers failed — give specific error message
  const geminiMsg = geminiError?.message || 'unknown error'
  const isKeyMissing = geminiMsg.includes('not configured')
  if (isKeyMissing) {
    throw new Error(
      'API key AI belum dikonfigurasi (GEMINI_API_KEY). Hubungi admin atau cek pengaturan environment.'
    )
  }
  throw new Error(
    `AI analysis gagal: ${geminiMsg}. Coba lagi dalam beberapa detik.`
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
        'HTTP-Referer': 'https://luxtradee.web.id',
        'X-Title': 'LuxTradee',
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

// Re-export for any code that was using the old name
export const analyzeImageBase64 = analyzeImageBase64WithAiml

/**
 * Unified fallback: tries vision (image + prompt), falls back to text-only.
 * Edge-safe: accepts Uint8Array/ArrayBuffer, no sharp/Buffer.
 */
export async function analyzeWithFallback(
  imageBytes: Uint8Array | ArrayBuffer,
  imagePrompt: string,
  textFallbackPrompt: string,
  options: VisionOptions = {}
): Promise<VisionResult> {
  // Try vision first
  try {
    return await analyzeImageWithAiml(imageBytes, imagePrompt, options)
  } catch (error: any) {
    console.warn(`⚠️ [Fallback] Vision failed: ${error.message}. Trying text-only...`)
  }

  // Fallback to text-only
  return analyzeTextWithZyloo(textFallbackPrompt, options)
}

// ==================== PROMPTS ====================

/**
 * Trade-specific extraction prompt
 * UNIVERSAL: Supports MT4/MT5, cTrader, TradingView, DxTrade, Match-Trade,
 *            proprietary mobile apps, and any trading platform screenshot.
 */
export const TRADE_EXTRACTION_PROMPT = `You are an expert at reading trading platform screenshots and extracting trade information from ANY trading platform.

Analyze this trading screenshot and extract ALL trade information visible.
The screenshot could come from ANY platform, including but not limited to:
1. MetaTrader 4/5 (MT4/MT5) — trade history, account history, deal list
2. cTrader — position details, trade history
3. TradingView — chart with trade markers, strategy tester results
4. DxTrade / Match-Trade / Prop firm dashboards
5. Any proprietary mobile trading app (Android/iOS)
6. Any custom trading dashboard or trade result screen
7. Any language (English, Indonesian, Arabic, Chinese, etc.)

CRITICAL: This may be in ANY language. Recognize these common multilingual patterns:
- "JUAL" / "VENDA" / "VERKAUF" = SELL
- "BELI" / "COMPRA" / "KAUF" = BUY
- "Harga Buka" / "Precio Apertura" / "Preis Öffnung" = Open Price
- "Harga Tutup" / "Precio Cierre" / "Preis Schließung" = Close Price
- "Perubahan" / "Cambio" / "Änderung" = Change/Pips
- "Waktu" / "Tiempo" / "Zeit" = Time
- "Untung" / "Lucro" / "Gewinn" = Profit
- "Rugi" / "Pérdida" / "Verlust" = Loss
- "Batas Rugi" / "Stop Kerugian" = Stop Loss
- "Ambil Untung" / "Tomar Ganancia" = Take Profit
- Any label next to a currency pair (XAUUSD, EURUSD, etc.) is likely the symbol

Extract these fields:
- symbol: Currency pair or asset name (e.g., XAUUSD, EURUSD, GBPJPY, BTC/USD)
- type: "buy" or "sell" (lowercase) — translate from any language if needed
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
3. type must be exactly "buy" or "sell" (lowercase) — ALWAYS translate to English
4. If a field is not visible in the screenshot, use null (not undefined, not empty string)
5. For dates like "2026.06.23 06:04:10" or "30/09/2026 04:10:43" convert to "2026-06-23 06:04:10"
6. For profit shown as "-99.75" or "$ -1995" or "-1995 (-0.48%)" or "38.45 USD", extract just the number: -99.75 or 38.45
7. Look for patterns in ANY layout:
   - S/L, SL, Stop Loss, Batas Rugi labels → stopLoss
   - TP, T/P, Take Profit, Ambil Untung labels → takeProfit
   - Entry/Open/Buka/Apertura prices → openPrice
   - Exit/Close/Tutup/Cierre prices → closePrice
   - Profit/Loss/Untung/Rugi/P&L labels → profitLoss
   - Lot/Volume/Size labels → volume
   - Ticket/Order/# labels → ticketNumber
8. If it's a chart, look for:
   - Horizontal lines marking entry, stop loss, take profit
   - Labels with "BUY", "SELL", "JUAL", "BELI" or up/down arrows
   - Timestamps on the bottom axis
   - Price levels on the right axis
9. If multiple trades visible, extract ONLY the most recent or active one
10. For profit calculation, if entry is 4140.35 and exit is 4120.40, the difference is -19.95
11. Recognize the platform and adapt: each platform has a different layout, but the data is the same
12. Look for color cues: green/profit colors often indicate profit, red/loss colors indicate loss
13. If text is in a non-English language, still extract the NUMBERS correctly and translate type to English

Example outputs:
{"symbol":"XAUUSD","type":"buy","openPrice":4140.35,"closePrice":4120.40,"profitLoss":-99.75,"openTime":"2026-06-23 06:04:10","closeTime":"2026-06-23 07:59:11","stopLoss":4120.40,"takeProfit":4182.15,"volume":0.05,"ticketNumber":"918673848"}

{"symbol":"XAUUSD","type":"sell","openPrice":4181.14,"closePrice":4173.36,"profitLoss":38.45,"openTime":"2026-09-30 03:00:00","closeTime":"2026-09-30 04:10:43","stopLoss":null,"takeProfit":null,"volume":null,"ticketNumber":null}

{"symbol":"EURUSD","type":"sell","openPrice":1.0875,"closePrice":1.0850,"profitLoss":250,"openTime":"2026-06-23 10:30:00","closeTime":"2026-06-23 11:45:00","stopLoss":1.0900,"takeProfit":1.0825,"volume":0.1,"ticketNumber":null}

Return the JSON now:
`

/**
 * COMBINED prompt: extracts trade data AND generates journal analysis in ONE call.
 * This halves the AI latency for the auto-journal feature (critical for Edge Runtime 30s limit).
 *
 * Language support:
 *   - 'id' (default): Indonesian — semua field teks (journalTitle, journalContent, tags)
 *                     ditulis dalam Bahasa Indonesia yang natural & professional.
 *   - 'en'          : English.
 * Trade data fields (symbol/type/prices/etc) tetap konsisten regardless of language.
 *
 * @param lang 'id' | 'en' (default 'id')
 */
export function buildTradeAndJournalPrompt(lang: 'id' | 'en' = 'id'): string {
  const isId = lang === 'id'

  const titleExample = isId
    ? 'Gold Long Ditolak di Resistance'
    : 'Gold Long Rejected at Resistance'

  const contentExample = isId
    ? 'Entry long XAUUSD di 4140.35 setelah breakout bullish. Harga ditolak di resistance dan berbalik tajam, menyentuh stop loss di 4120.40. Setup kurang konfirmasi dari timeframe lebih besar — hindari trading melawan resistance kuat tanpa konfluence. Contoh baik untuk belajar menahan diri saat belum ada konfirmasi jelas.'
    : 'Entered long on XAUUSD at 4140.35 after a bullish breakout attempt. Price was rejected at resistance and reversed sharply, hitting stop loss at 4120.40. The setup lacked confirmation from higher timeframe — avoid trading against strong resistance without confluence.'

  const tagsExample = isId
    ? 'gold,breakout,loss,resistance'
    : 'gold,breakout,loss,resistance'

  const part2Header = isId
    ? `PART 2 — Buat analisis jurnal trading singkat (3-4 kalimat) DALAM BAHASA INDONESIA:
- journalTitle: Judul singkat deskriptif (contoh: "Gold Short di Area Resistance")
- journalContent: Analisis 3-4 kalimat mencakup: setup/strategi yang dipakai, kondisi market, pelajaran utama. WAJIB ditulis dalam Bahasa Indonesia yang natural dan professional — bukan terjemahan kaku. Gunakan istilah trading yang umum dipakai trader Indonesia (entry, stop loss, take profit, breakout, pullback, dll).
- mood: Salah satu dari: confident, nervous, calm, fearful, greedy, neutral
- marketCondition: Salah satu dari: trending, ranging, volatile, bullish, bearish
- tags: 2-4 tag relevan sebagai string dipisah koma (contoh: "gold,breakout,loss")
- setupType: Nama strategi (contoh: breakout, pullback, momentum, scalping, swing)`
    : `PART 2 — Generate a brief trading journal analysis (3-4 sentences):
- journalTitle: Short descriptive title (e.g., "Gold Short at Resistance Level")
- journalContent: 3-4 sentence analysis covering: setup/strategy used, market condition, key takeaway
- mood: One of: confident, nervous, calm, fearful, greedy, neutral
- marketCondition: One of: trending, ranging, volatile, bullish, bearish
- tags: 2-4 relevant tags as comma-separated string (e.g., "gold,breakout,loss")
- setupType: Strategy name (e.g., breakout, pullback, momentum, scalping, swing)`

  const rule5 = isId
    ? '5. Journal content harus ringkas (maks 3-4 kalimat) agar respons tetap cepat. WAJIB dalam Bahasa Indonesia.'
    : '5. Journal content must be concise (3-4 sentences max) to keep response fast'

  const languageInstruction = isId
    ? `\nIMPORTANT: All text fields (journalTitle, journalContent, tags) MUST be written in Bahasa Indonesia. Trade data fields (symbol, type, prices, dates) tetap apa adanya sesuai screenshot.`
    : `\nAll journal text fields should be written in English.`

  return `You are an expert trading analyst. Analyze this trading screenshot from ANY platform and return a SINGLE JSON object with TWO parts.

This screenshot could come from ANY trading platform (MT4/MT5, cTrader, TradingView, DxTrade, proprietary mobile apps, custom dashboards, etc.) and may be in ANY language (English, Indonesian, Arabic, Chinese, etc.).

CRITICAL: Recognize multilingual trading terms:
- "JUAL" / "VENDA" / "VERKAUF" = SELL → type: "sell"
- "BELI" / "COMPRA" / "KAUF" = BUY → type: "buy"
- "Harga Buka" / "Precio Apertura" = Open Price → openPrice
- "Harga Tutup" / "Precio Cierre" = Close Price → closePrice
- "Perubahan" / "Cambio" = Change/Pips
- "Waktu" / "Tiempo" = Time
- "Untung" / "Lucro" = Profit → profitLoss
- "Rugi" / "Pérdida" = Loss → profitLoss (negative)
- "Batas Rugi" = Stop Loss → stopLoss
- "Ambil Untung" = Take Profit → takeProfit
- Green/teal numbers often = profit; Red/pink numbers often = loss
- Any label next to a currency pair (XAUUSD, EURUSD, etc.) = symbol

PART 1 — Extract trade data:
- symbol: Currency pair (e.g., XAUUSD, EURUSD)
- type: "buy" or "sell" (lowercase) — ALWAYS translate to English
- openPrice: Entry price (number)
- closePrice: Exit price (number)
- profitLoss: P/L amount (number, negative for loss)
- openTime: "YYYY-MM-DD HH:mm:ss"
- closeTime: "YYYY-MM-DD HH:mm:ss"
- stopLoss: SL price if visible (number or null)
- takeProfit: TP price if visible (number or null)
- volume: Lot size if visible (number or null)
- ticketNumber: Ticket number if visible (string or null)

${part2Header}

RULES:
1. Return ONLY a single JSON object, no markdown, no explanation, no backticks
2. All prices must be numbers
3. type must be exactly "buy" or "sell" (English) — translate from any language
4. Missing fields → null
${rule5}
6. Tags must be lowercase, comma-separated
7. If multiple trades visible, analyze the most recent one
8. For dates like "30/09/2026 04:10:43" convert to "2026-09-30 04:10:43"
9. For profit shown as "38.45 USD" extract just the number: 38.45
10. Recognize color cues: green/teal = profit, red/pink = loss
11. Adapt to any platform layout — the data is always the same, just presented differently
${languageInstruction}

Example (Indonesian platform screenshot):
{"symbol":"XAUUSD","type":"sell","openPrice":4181.14,"closePrice":4173.36,"profitLoss":38.45,"openTime":"2026-09-30 03:00:00","closeTime":"2026-09-30 04:10:43","stopLoss":null,"takeProfit":null,"volume":null,"ticketNumber":null,"journalTitle":"${titleExample}","journalContent":"${contentExample}","mood":"confident","marketCondition":"trending","tags":"${tagsExample}","setupType":"breakout"}

Example (MT5 English screenshot):
{"symbol":"XAUUSD","type":"buy","openPrice":4140.35,"closePrice":4120.40,"profitLoss":-99.75,"openTime":"2026-06-23 06:04:10","closeTime":"2026-06-23 07:59:11","stopLoss":4120.40,"takeProfit":4182.15,"volume":0.05,"ticketNumber":"918673848","journalTitle":"${titleExample}","journalContent":"${contentExample}","mood":"nervous","marketCondition":"ranging","tags":"${tagsExample}","setupType":"breakout"}

Return the JSON now:`
}

/**
 * Default export kept for backwards compatibility — defaults to Indonesian.
 * New code should call buildTradeAndJournalPrompt(lang) explicitly.
 */
export const TRADE_AND_JOURNAL_PROMPT = buildTradeAndJournalPrompt('id')
