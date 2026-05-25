import { NextRequest, NextResponse } from 'next/server'
import { createClientForApi } from '@/lib/supabase/server'
import ZAI from 'z-ai-web-dev-sdk'

// ==================== TYPES ====================
interface ExtractedTrade {
  symbol: string
  type: string
  open_price: number
  close_price: number
  lot_size: number
  profit_loss: number
  open_time: string
  close_time: string
  session: string
  notes: string
  image_url: string
}

interface ExtractedJournal {
  title: string
  content: string
  mood: string
  market_condition: string
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
    "lot_size": 0.1,
    "profit_loss": 300.20,
    "open_time": "2026-05-22T17:13:16Z",
    "close_time": "2026-05-25T01:15:00Z",
    "session": "New York",
    "notes": "",
    "image_url": ""
  },
  "journal": {
    "title": "XAUUSD Buy - Profit $300.20",
    "content": "AI-generated journal entry describing the trade, including analysis of entry/exit, risk management, and lessons learned.",
    "mood": "confident",
    "market_condition": "trending"
  },
  "raw_analysis": "Brief raw text analysis of what was seen in the screenshot"
}

Rules:
- Convert date format YYYY.MM.DD HH:MM:SS to ISO 8601 (YYYY-MM-DDTHH:MM:SSZ)
- Determine session from open_time hour: 0-7=Asia, 8-15=London, 16-23=New York
- Determine mood: profitable trades=confident/happy, losing trades=frustrated/regretful, breakeven=neutral
- Determine market_condition: look for clues like trending/ranging/volatile
- If any field cannot be determined, use reasonable defaults
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
        lot_size: 0,
        profit_loss: 0,
        open_time: '',
        close_time: '',
        session: '',
        notes: '',
        image_url: ''
      },
      journal: {
        title: '',
        content: '',
        mood: 'neutral',
        market_condition: 'unknown'
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
      lot_size: Number(trade.lot_size) || 0,
      profit_loss: Number(trade.profit_loss) || 0,
      open_time: String(trade.open_time || ''),
      close_time: String(trade.close_time || ''),
      session: String(trade.session || ''),
      notes: String(trade.notes || ''),
      image_url: String(trade.image_url || '')
    },
    journal: {
      title: String(journal.title || ''),
      content: String(journal.content || ''),
      mood: normalizeMood(String(journal.mood || 'neutral')),
      market_condition: normalizeMarketCondition(String(journal.market_condition || 'unknown'))
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
  const validMoods = ['confident', 'happy', 'frustrated', 'regretful', 'neutral', 'anxious', 'calm', 'excited']
  const lower = mood.toLowerCase().trim()
  if (validMoods.includes(lower)) return lower
  return 'neutral'
}

function normalizeMarketCondition(condition: string): string {
  const validConditions = ['trending', 'ranging', 'volatile', 'calm', 'breakout', 'reversal', 'unknown']
  const lower = condition.toLowerCase().trim()
  if (validConditions.includes(lower)) return lower
  return 'unknown'
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

    // Step 2: Parse multipart form data
    const formData = await request.formData()
    const imageFile = formData.get('image') as File | null
    const accountId = formData.get('accountId') as string | null

    if (!imageFile) {
      console.log('❌ [Screenshot Journal] No image provided')
      return NextResponse.json(
        { error: 'No image provided. Please upload a screenshot (JPEG/PNG).' },
        { status: 400 }
      )
    }

    // Validate file type
    const allowedTypes = ['image/jpeg', 'image/png', 'image/jpg', 'image/webp']
    const mimeType = imageFile.type || 'image/jpeg'

    if (!allowedTypes.includes(mimeType)) {
      console.log('❌ [Screenshot Journal] Invalid file type:', mimeType)
      return NextResponse.json(
        { error: `Invalid file type "${mimeType}". Only JPEG and PNG images are supported.` },
        { status: 400 }
      )
    }

    // Step 3: Convert image to base64
    console.log(`📷 [Screenshot Journal] Processing image: ${imageFile.name} (${mimeType}, ${imageFile.size} bytes)`)
    const bytes = await imageFile.arrayBuffer()
    const buffer = Buffer.from(bytes)
    const base64Image = buffer.toString('base64')

    if (accountId) {
      console.log(`🔗 [Screenshot Journal] Account ID: ${accountId}`)
    }

    // Step 4: Call VLM for analysis
    console.log('🤖 [Screenshot Journal] Sending to VLM for analysis...')
    const zai = await ZAI.create()

    const vlmResponse = await zai.chat.completions.createVision({
      messages: [
        {
          role: 'user',
          content: [
            { type: 'text', text: VLM_PROMPT },
            {
              type: 'image_url',
              image_url: { url: `data:${mimeType};base64,${base64Image}` }
            }
          ]
        }
      ],
      thinking: { type: 'disabled' }
    })

    const content = vlmResponse.choices?.[0]?.message?.content

    if (!content) {
      console.error('❌ [Screenshot Journal] VLM returned empty content')
      return NextResponse.json(
        { error: 'AI analysis failed - no response from vision model. Please try again with a clearer screenshot.' },
        { status: 500 }
      )
    }

    console.log('📝 [Screenshot Journal] VLM response length:', content.length)
    console.log('📝 [Screenshot Journal] VLM preview:', content.substring(0, 200))

    // Step 5: Parse the VLM response
    const parsed = parseVLMResponse(content)

    // If we only got raw_analysis (JSON parsing failed), still return it
    const hasTradeData = parsed.trade.symbol && parsed.trade.symbol.length > 0

    if (!hasTradeData && !parsed.journal.title) {
      console.warn('⚠️ [Screenshot Journal] No structured data extracted, returning raw analysis')
      return NextResponse.json({
        success: true,
        data: {
          trade: parsed.trade,
          journal: parsed.journal,
          raw_analysis: parsed.raw_analysis || content
        },
        warning: 'Could not extract structured trading data from the screenshot. The raw analysis is provided for reference.'
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
      data: {
        trade: parsed.trade,
        journal: parsed.journal,
        raw_analysis: parsed.raw_analysis
      }
    })

  } catch (error) {
    console.error('❌ [Screenshot Journal] Error:', error)

    if (error instanceof Error) {
      // Handle specific SDK errors
      if (error.message.includes('ZAI') || error.message.includes('vision') || error.message.includes('VLM')) {
        return NextResponse.json(
          { error: 'AI vision service is currently unavailable. Please try again in a moment.' },
          { status: 500 }
        )
      }

      if (error.message.includes('timeout')) {
        return NextResponse.json(
          { error: 'AI analysis timed out. The screenshot might be too complex. Please try with a simpler screenshot.' },
          { status: 500 }
        )
      }

      if (error.message.includes('file too large') || error.message.includes('size')) {
        return NextResponse.json(
          { error: 'Image is too large. Please use a screenshot under 10MB.' },
          { status: 400 }
        )
      }
    }

    return NextResponse.json(
      {
        error: 'Failed to analyze screenshot',
        details: error instanceof Error ? error.message : 'Unknown error occurred'
      },
      { status: 500 }
    )
  }
}
