import { NextRequest, NextResponse } from 'next/server'
import { createClientForApi } from '@/lib/supabase/server'
import { analyzeImageWithHuggingFace } from '@/lib/huggingface-vision'
import { analyzeImageWithOllama, generateJournalEntry, checkOllamaHealth } from '@/lib/ollama-vision'
import { analyzeImageWithZAIVision } from '@/lib/zai-vision'

// ==================== TYPES ====================
interface ExtractedTrade {
  symbol: string
  type: string
  open_price: number
  close_price: number
  stop_loss: number
  take_profit: number
  lot_size: number
  profit_loss: number
  open_time: string
  close_time: string
  swap: number
  commission: number
  order_id: string
  platform: string
}

interface ExtractedJournal {
  title: string
  content: string
  mood: string
  market_condition: string
  tags: string[]
  setup_type: string
  risk_reward_ratio: number
}

interface VLMResponse {
  trade: ExtractedTrade
  journal: ExtractedJournal
  raw_analysis: string
}

// ==================== VLM PROMPT ====================
const VLM_PROMPT = `Analyze this trading screenshot. Extract ALL trading data and return ONLY valid JSON (no markdown, no code blocks, no explanation). The JSON must have this exact structure:

{
  "trade": {
    "symbol": "XAUUSD",
    "type": "BUY",
    "open_price": 4503.38,
    "close_price": 4533.40,
    "stop_loss": 4480.00,
    "take_profit": 4560.00,
    "lot_size": 0.1,
    "profit_loss": 300.20,
    "open_time": "2026-05-22T17:13:16Z",
    "close_time": "2026-05-25T01:15:00Z",
    "swap": 0,
    "commission": 0,
    "order_id": "",
    "platform": "MT5"
  },
  "journal": {
    "title": "XAUUSD Buy - Profit $300.20",
    "content": "Detailed journal entry in English describing the trade setup, entry reason, exit reason, risk management, emotional state, and lessons learned. Write 3-5 sentences.",
    "mood": "confident",
    "market_condition": "trending_up",
    "tags": ["gold", "breakout", "tp_hit"],
    "setup_type": "breakout",
    "risk_reward_ratio": 2.5
  },
  "raw_analysis": "Brief description of what was seen in the screenshot"
}

Rules:
- Convert date format YYYY.MM.DD HH:MM:SS to ISO 8601 (YYYY-MM-DDTHH:MM:SSZ)
- Determine session from open_time hour: 0-7=Asia, 8-15=London, 16-23=New York
- mood must be one of: confident, calm, excited, anxious, fearful, greedy, frustrated, regretful, neutral
- market_condition must be one of: trending_up, trending_down, ranging, volatile, breakout, reversal
- tags should be 2-5 relevant lowercase tags
- setup_type: breakout, pullback, reversal, range, scalping, swing
- risk_reward_ratio: calculate as (potential profit / potential loss) or estimate
- If stop_loss or take_profit not visible, set to 0
- profit_loss should be negative for losing trades
- Return ONLY the JSON, no other text`

// ==================== HELPER: Parse VLM JSON response ====================
function parseVLMResponse(content: string): VLMResponse {
  // Try direct JSON parse first
  try {
    const parsed = JSON.parse(content)
    return validateAndNormalize(parsed)
  } catch {
    // Try extracting JSON from markdown code blocks
    const codeBlockMatch = content.match(/```(?:json)?\s*([\s\S]*?)```/)
    if (codeBlockMatch) {
      try {
        const parsed = JSON.parse(codeBlockMatch[1].trim())
        return validateAndNormalize(parsed)
      } catch {
        // Fall through to brace extraction
      }
    }

    // Try extracting JSON by finding the outermost { ... }
    const firstBrace = content.indexOf('{')
    const lastBrace = content.lastIndexOf('}')
    if (firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace) {
      try {
        const jsonStr = content.substring(firstBrace, lastBrace + 1)
        const parsed = JSON.parse(jsonStr)
        return validateAndNormalize(parsed)
      } catch {
        // Fall through to raw fallback
      }
    }

    // Could not parse JSON — return raw text fallback
    return {
      trade: {
        symbol: '',
        type: 'BUY',
        open_price: 0,
        close_price: 0,
        stop_loss: 0,
        take_profit: 0,
        lot_size: 0,
        profit_loss: 0,
        open_time: '',
        close_time: '',
        swap: 0,
        commission: 0,
        order_id: '',
        platform: ''
      },
      journal: {
        title: '',
        content: '',
        mood: 'neutral',
        market_condition: 'ranging',
        tags: [],
        setup_type: '',
        risk_reward_ratio: 0
      },
      raw_analysis: content
    }
  }
}

// ==================== HELPER: Validate and normalize parsed data ====================
function validateAndNormalize(data: Record<string, unknown>): VLMResponse {
  const trade = (data.trade as Record<string, unknown>) || {}
  const journal = (data.journal as Record<string, unknown>) || {}

  return {
    trade: {
      symbol: String(trade.symbol || ''),
      type: normalizeTradeType(String(trade.type || 'BUY')),
      open_price: Number(trade.open_price) || 0,
      close_price: Number(trade.close_price) || 0,
      stop_loss: Number(trade.stop_loss) || 0,
      take_profit: Number(trade.take_profit) || 0,
      lot_size: Number(trade.lot_size) || 0,
      profit_loss: Number(trade.profit_loss) || 0,
      open_time: String(trade.open_time || ''),
      close_time: String(trade.close_time || ''),
      swap: Number(trade.swap) || 0,
      commission: Number(trade.commission) || 0,
      order_id: String(trade.order_id || ''),
      platform: String(trade.platform || '')
    },
    journal: {
      title: String(journal.title || ''),
      content: String(journal.content || ''),
      mood: normalizeMood(String(journal.mood || 'neutral')),
      market_condition: normalizeMarketCondition(String(journal.market_condition || 'ranging')),
      tags: Array.isArray(journal.tags) ? journal.tags.map(String) : [],
      setup_type: String(journal.setup_type || ''),
      risk_reward_ratio: Number(journal.risk_reward_ratio) || 0
    },
    raw_analysis: String(data.raw_analysis || '')
  }
}

function normalizeTradeType(type: string): string {
  const upper = type.toUpperCase().trim()
  if (upper.includes('SELL') || upper.includes('SHORT')) return 'SELL'
  return 'BUY'
}

function normalizeMood(mood: string): string {
  const validMoods = ['confident', 'calm', 'excited', 'anxious', 'fearful', 'greedy', 'frustrated', 'regretful', 'neutral']
  const lower = mood.toLowerCase().trim()
  if (validMoods.includes(lower)) return lower
  // Map common alternatives
  if (lower === 'happy') return 'confident'
  if (lower === 'sad') return 'regretful'
  if (lower === 'angry') return 'frustrated'
  return 'neutral'
}

function normalizeMarketCondition(condition: string): string {
  const validConditions = ['trending_up', 'trending_down', 'ranging', 'volatile', 'breakout', 'reversal']
  const lower = condition.toLowerCase().trim()
  if (validConditions.includes(lower)) return lower
  // Map common alternatives
  if (lower === 'trending') return 'trending_up'
  if (lower === 'calm' || lower === 'sideways') return 'ranging'
  return 'ranging'
}

// ==================== HELPER: Parse with Fallback (No OCR) ====================
async function analyzeWithFallback(): Promise<VLMResponse> {
  console.log('⚠️ [Screenshot Journal] Using fallback - returning empty template')

  // Return empty template for manual input
  return {
    trade: {
      symbol: '',
      type: 'BUY',
      open_price: 0,
      close_price: 0,
      stop_loss: 0,
      take_profit: 0,
      lot_size: 0,
      profit_loss: 0,
      open_time: new Date().toISOString(),
      close_time: new Date().toISOString(),
      swap: 0,
      commission: 0,
      order_id: '',
      platform: 'MT5'
    },
    journal: {
      title: 'New Trade',
      content: 'Please fill in the trade details manually. Screenshot analysis is currently unavailable.',
      mood: 'neutral',
      market_condition: 'ranging',
      tags: ['manual'],
      setup_type: '',
      risk_reward_ratio: 0
    },
    raw_analysis: 'No OCR services available in this environment'
  }
}

// ==================== HELPER: Call VLM with Hugging Face + Ollama + Z.ai Vision Fallback ====================
async function analyzeScreenshotWithVLM(
  base64Image: string,
  mimeType: string
): Promise<VLMResponse> {
  // Step 1: Try Hugging Face (FREE, but network blocked in some environments)
  console.log('🤖 [Screenshot Journal] Checking Hugging Face availability...')

  try {
    // Try to get token from process.env first, then from .env file
    let hfApiKey = process.env.HUGGING_FACE_API_TOKEN

    // If not in process.env, try to read from .env file
    if (!hfApiKey) {
      try {
        const fs = await import('fs')
        const path = await import('path')
        const envPath = path.join(process.cwd(), '.env')
        const envContent = fs.readFileSync(envPath, 'utf-8')
        const match = envContent.match(/HUGGING_FACE_API_TOKEN=([^\s\n]+)/)
        if (match && match[1]) {
          hfApiKey = match[1]
          console.log('📝 [Screenshot Journal] Loaded Hugging Face token from .env file')
        }
      } catch (error) {
        console.log('⚠️ [Screenshot Journal] Could not read .env file')
      }
    }

    if (hfApiKey && hfApiKey.startsWith('hf_')) {
      console.log('✅ [Screenshot Journal] Using Hugging Face Vision (FREE)...')

      // Temporarily set the env var for the function
      const originalToken = process.env.HUGGING_FACE_API_TOKEN
      process.env.HUGGING_FACE_API_TOKEN = hfApiKey

      try {
        const result = await analyzeImageWithHuggingFace(base64Image, VLM_PROMPT, {
          timeout: 45000,
          maxRetries: 2
        })
        const parsed = parseVLMResponse(result.text)
        console.log(`✅ [Screenshot Journal] Hugging Face analysis completed`)
        return parsed
      } finally {
        // Restore original env var
        if (originalToken) {
          process.env.HUGGING_FACE_API_TOKEN = originalToken
        }
      }
    } else {
      console.log('⚠️ [Screenshot Journal] No valid Hugging Face token found, skipping...')
    }
  } catch (error: any) {
    console.log('⚠️ [Screenshot Journal] Hugging Face failed:', error.message)
  }

  // Step 2: Try Ollama (FREE, local installation)
  console.log('🤖 [Screenshot Journal] Checking Ollama availability...')

  try {
    const ollamaHealth = await checkOllamaHealth()

    if (ollamaHealth.running) {
      console.log('✅ [Screenshot Journal] Ollama is available, using it for analysis')

      // Extract trading data using Ollama
      const ollamaResult = await analyzeImageWithOllama(
        base64Image,
        mimeType,
        'Analyze this trading screenshot and extract all relevant information including symbol, type, entry/exit prices, profit/loss, lot size, timeframe, strategy, and notes. Return in JSON format.'
      )

      console.log('📊 [Screenshot Journal] Ollama extraction result:', ollamaResult)

      // Convert Ollama result to VLMResponse format
      const trade: ExtractedTrade = {
        symbol: ollamaResult.symbol || '',
        type: ollamaResult.type?.toUpperCase() || 'BUY',
        open_price: ollamaResult.entry_price || 0,
        close_price: ollamaResult.exit_price || 0,
        stop_loss: 0,
        take_profit: 0,
        lot_size: ollamaResult.lot_size || 0,
        profit_loss: ollamaResult.profit_loss || 0,
        open_time: new Date().toISOString(),
        close_time: ollamaResult.exit_price ? new Date().toISOString() : '',
        swap: 0,
        commission: 0,
        order_id: '',
        platform: 'MT5'
      }

      const journalContent = generateJournalEntry(ollamaResult)

      const journal: ExtractedJournal = {
        title: `${trade.symbol || 'Trade'} ${trade.type} - ${trade.profit_loss >= 0 ? 'Profit' : 'Loss'} $${Math.abs(trade.profit_loss).toFixed(2)}`,
        content: journalContent,
        mood: 'neutral',
        market_condition: 'ranging',
        tags: [trade.symbol?.toLowerCase() || 'trade'],
        setup_type: ollamaResult.strategy || '',
        risk_reward_ratio: 0
      }

      return {
        trade,
        journal,
        raw_analysis: JSON.stringify(ollamaResult)
      }
    } else {
      console.log('⚠️ [Screenshot Journal] Ollama is not available, trying Z.ai Vision')
    }
  } catch (error: any) {
    console.log('⚠️ [Screenshot Journal] Ollama analysis failed, trying Z.ai Vision:', error.message)
  }

  // Step 3: Try Z.ai Vision (Build-required SDK) - SKIP IN PRODUCTION
  console.log('🤖 [Screenshot Journal] Checking Z.ai Vision availability...')

  // Skip Z.ai Vision in production (internal API not accessible from Vercel)
  if (process.env.NODE_ENV === 'production') {
    console.log('⚠️ [Screenshot Journal] Skipping Z.ai Vision in production (internal API not accessible)')
  } else {
    try {
      console.log('🔄 [Screenshot Journal] Calling analyzeImageWithZAIVision...')
      const result = await analyzeImageWithZAIVision(base64Image, VLM_PROMPT, {})
      const parsed = parseVLMResponse(result.text)
      console.log(`✅ [Screenshot Journal] Z.ai Vision analysis completed`)
      return parsed
    } catch (error: any) {
      console.log('⚠️ [Screenshot Journal] Z.ai Vision failed, using fallback:', error.message || 'Connection timeout')
    }
  }

  // Step 4: Use fallback (no OCR available)
  console.log('⚠️ [Screenshot Journal] All AI services failed, using fallback template')
  return analyzeWithFallback()
}

// ==================== HELPER: Get authenticated user ====================
async function getAuthUser(request: NextRequest): Promise<{ id: string; email: string } | null> {
  try {
    const { supabase } = createClientForApi(request)
    const { data: { user }, error } = await supabase.auth.getUser()

    if (error) {
      console.error('❌ [Screenshot Journal] Supabase auth error:', error.message)
      return null
    }

    if (!user) {
      console.log('❌ [Screenshot Journal] No user found in session')
      return null
    }

    console.log('✅ [Screenshot Journal] Authenticated user:', { id: user.id, email: user.email })
    return { id: user.id, email: user.email || '' }
  } catch (error) {
    console.error('❌ [Screenshot Journal] Auth error:', error)
    return null
  }
}

// ==================== MAIN HANDLER ====================
export async function POST(request: NextRequest) {
  try {
    console.log('🟢 [Screenshot Journal] Starting screenshot analysis...')

    // Step 1: Authenticate user
    const authUser = await getAuthUser(request)

    if (!authUser) {
      console.log('❌ [Screenshot Journal] Unauthorized - no valid user')
      return NextResponse.json(
        { error: 'Unauthorized - Please login' },
        { status: 401 }
      )
    }

    // Step 2: Parse image - support both JSON (base64) and multipart/form-data
    let base64Image: string
    let mimeType = 'image/jpeg'

    const contentType = request.headers.get('content-type') || ''

    if (contentType.includes('multipart/form-data')) {
      // Multipart: extract file from form data
      const formData = await request.formData()
      const imageFile = formData.get('image') as File | null

      if (!imageFile) {
        console.log('❌ [Screenshot Journal] No image in form data')
        return NextResponse.json(
          { error: 'No image provided. Please upload a screenshot (JPEG/PNG).' },
          { status: 400 }
        )
      }

      const allowedTypes = ['image/jpeg', 'image/png', 'image/jpg', 'image/webp']
      mimeType = imageFile.type || 'image/jpeg'

      if (!allowedTypes.includes(mimeType)) {
        console.log('❌ [Screenshot Journal] Invalid file type:', mimeType)
        return NextResponse.json(
          { error: `Invalid file type "${mimeType}". Only JPEG and PNG images are supported.` },
          { status: 400 }
        )
      }

      console.log(`📷 [Screenshot Journal] Processing multipart image: ${imageFile.name} (${mimeType}, ${imageFile.size} bytes)`)
      const bytes = await imageFile.arrayBuffer()
      const buffer = Buffer.from(bytes)
      base64Image = buffer.toString('base64')
    } else {
      // JSON: extract base64 string from body
      const body = await request.json()
      const { imageBase64, mimeType: bodyMime } = body

      if (!imageBase64) {
        console.log('❌ [Screenshot Journal] No imageBase64 in JSON body')
        return NextResponse.json(
          { error: 'No image provided. Please upload a screenshot (JPEG/PNG).' },
          { status: 400 }
        )
      }

      mimeType = bodyMime || 'image/jpeg'

      // Strip data URL prefix if present
      base64Image = imageBase64.replace(/^data:[^;]+;base64,/, '')

      console.log(`📷 [Screenshot Journal] Processing JSON base64 image (${mimeType}, ${Math.round(base64Image.length * 0.75)} bytes)`)
    }

    // Step 4: Call VLM (try all free services first)
    console.log('🤖 [Screenshot Journal] Starting VLM analysis...')

    const parsed = await analyzeScreenshotWithVLM(base64Image, mimeType)

    // If we only got raw_analysis (JSON parsing failed), still return it
    const hasTradeData = parsed.trade.symbol && parsed.trade.symbol.length > 0

    if (!hasTradeData && !parsed.journal.title) {
      console.warn('⚠️ [Screenshot Journal] No structured data extracted, returning raw analysis')
      return NextResponse.json({
        success: true,
        trade: parsed.trade,
        journal: parsed.journal,
        raw_analysis: parsed.raw_analysis,
        warning: 'Could not extract structured trading data from the screenshot. AI Vision service may have limitations with this image.'
      })
    }

    console.log('✅ [Screenshot Journal] Successfully extracted trade data:', {
      symbol: parsed.trade.symbol,
      type: parsed.trade.type,
      profit_loss: parsed.trade.profit_loss,
      mood: parsed.journal.mood
    })

    // Step 6: Return structured data
    return NextResponse.json({
      success: true,
      trade: parsed.trade,
      journal: parsed.journal,
      raw_analysis: parsed.raw_analysis
    })

  } catch (error) {
    console.error('❌ [Screenshot Journal] Error:', error)

    if (error instanceof Error) {
      // Handle network/connection errors
      if (error.message.includes('Connect Timeout') || error.message.includes('ETIMEDOUT') || error.message.includes('fetch failed')) {
        console.error('❌ [Screenshot Journal] Network/Connection Error:', error.message)
        return NextResponse.json(
          { error: 'Tidak dapat terhubung ke AI/OCR service. Masalah jaringan atau server sedang sibuk. Silakan coba lagi dalam beberapa saat.' },
          { status: 503 }
        )
      }

      // Handle AI Vision specific errors
      if (error.message.includes('timeout')) {
        return NextResponse.json(
          { error: 'Analisis AI Vision terlalu lama. Screenshot mungkin terlalu kompleks. Silakan coba dengan screenshot yang lebih sederhana atau gunakan input manual.' },
          { status: 500 }
        )
      }

      if (error.message.includes('file too large') || error.message.includes('size')) {
        return NextResponse.json(
          { error: 'Gambar terlalu besar. Gunakan screenshot di bawah 10MB.' },
          { status: 400 }
        )
      }
    }

    return NextResponse.json(
      {
        error: 'Gagal menganalisis screenshot',
        details: error instanceof Error ? error.message : 'Terjadi kesalahan tidak diketahui'
      },
      { status: 500 }
    )
  }
}