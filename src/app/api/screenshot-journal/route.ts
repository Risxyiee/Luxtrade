import { NextRequest, NextResponse } from 'next/server'
import { getAuthUser } from '@/lib/api-auth'
import { isUserPro } from '@/lib/pro-check'
import { analyzeImageWithAiml } from '@/lib/aiml-vision'

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
  // Using fallback - returning empty template

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

// ==================== HELPER: Call AIML GLM-4V-OCR ====================
async function analyzeScreenshotWithVLM(
  imageBuffer: Buffer
): Promise<VLMResponse> {
  // Primary: AIML API (GLM-4V-OCR)
  try {
    const result = await analyzeImageWithAiml(imageBuffer, VLM_PROMPT)
    const parsed = parseVLMResponse(result.text)
    return parsed
  } catch (error: any) {
    console.error('❌ [Screenshot Journal] AIML failed:', error.message)
  }

  // Fallback: empty template for manual input
  return analyzeWithFallback()
}

// ==================== MAIN HANDLER ====================
export async function POST(request: NextRequest) {
  try {
    // Step 1: Authenticate user
    const authUser = await getAuthUser(request)

    if (!authUser) {
        return NextResponse.json(
        { error: 'Unauthorized - Please login' },
        { status: 401 }
      )
    }

    // PRO check - screenshot journal uses AI Vision, a PRO feature
    const pro = await isUserPro(authUser.id)
    if (!pro) {
      return NextResponse.json({
        error: 'Screenshot Analysis adalah fitur PRO. Upgrade ke PRO untuk menggunakan AI screenshot analysis!',
        code: 'PRO_REQUIRED',
        requiresUpgrade: true
      }, { status: 403 })
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
        return NextResponse.json(
          { error: 'No image provided. Please upload a screenshot (JPEG/PNG).' },
          { status: 400 }
        )
      }

      const allowedTypes = ['image/jpeg', 'image/png', 'image/jpg', 'image/webp']
      mimeType = imageFile.type || 'image/jpeg'

      if (!allowedTypes.includes(mimeType)) {
        return NextResponse.json(
          { error: `Invalid file type "${mimeType}". Only JPEG and PNG images are supported.` },
          { status: 400 }
        )
      }

      const bytes = await imageFile.arrayBuffer()
      const buffer = Buffer.from(bytes)
      base64Image = buffer.toString('base64')
    } else {
      // JSON: extract base64 string from body
      const body = await request.json()
      const { imageBase64, mimeType: bodyMime } = body

      if (!imageBase64) {
        return NextResponse.json(
          { error: 'No image provided. Please upload a screenshot (JPEG/PNG).' },
          { status: 400 }
        )
      }

      mimeType = bodyMime || 'image/jpeg'

      // Strip data URL prefix if present
      base64Image = imageBase64.replace(/^data:[^;]+;base64,/, '')

      // Processing JSON base64 image
    }

    // Step 4: Call VLM (try all free services first)
    const parsed = await analyzeScreenshotWithVLM(Buffer.from(base64Image, 'base64'))

    // If we only got raw_analysis (JSON parsing failed), still return it
    const hasTradeData = parsed.trade.symbol && parsed.trade.symbol.length > 0

    if (!hasTradeData && !parsed.journal.title) {
      return NextResponse.json({
        success: true,
        trade: parsed.trade,
        journal: parsed.journal,
        raw_analysis: parsed.raw_analysis,
        warning: 'Could not extract structured trading data from the screenshot. AI Vision service may have limitations with this image.'
      })
    }

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