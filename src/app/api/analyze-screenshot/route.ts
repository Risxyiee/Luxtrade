import { NextRequest, NextResponse } from 'next/server'
import { createClient, SupabaseClient } from '@supabase/supabase-js'
import { analyzeImageWithOllama } from '@/lib/ollama-vision'
import { analyzeImageWithZAIVision } from '@/lib/zai-vision'
import { createClientForApi } from '@/lib/supabase/server'
import { isUserPro } from '@/lib/pro-check'
import { rateLimitByUser } from '@/lib/rate-limit'

/**
 * API Route: Analyze Trading Screenshot
 * Extracts trading data from screenshot using AI Vision
 * Uploads image to Supabase Storage and returns URL
 */

// Initialize Supabase admin client with service role key for uploads (lazy)
let _supabase: SupabaseClient | null = null
function getSupabase(): SupabaseClient {
  if (!_supabase) {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY
    if (!url || !key) throw new Error('Missing Supabase env vars')
    _supabase = createClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } })
  }
  return _supabase
}

const BUCKET_NAME = 'trade-screenshots'

/**
 * Parse trading data from AI response
 * Extract JSON object from AI response
 */
function parseTradingData(aiResponse: string): any {
  try {
    // Try to find JSON in the response
    const jsonMatch = aiResponse.match(/\{[\s\S]*\}/)
    if (jsonMatch) {
      const jsonData = JSON.parse(jsonMatch[0])
      return jsonData
    }

    // If no JSON found, try to parse key-value pairs
    const result: any = {}

    // Extract pair/symbol
    const pairMatch = aiResponse.match(/(?:pair|symbol)[:\s]*([a-zA-Z0-9]+)/i)
    if (pairMatch) result.pair = pairMatch[1].toUpperCase()

    // Extract type
    const typeMatch = aiResponse.match(/(?:type|direction)[:\s]*(buy|sell)/i)
    if (typeMatch) result.type = typeMatch[1].toUpperCase()

    // Extract size/lot
    const sizeMatch = aiResponse.match(/(?:size|lot|lot\s*size)[:\s]*([\d.]+)/i)
    if (sizeMatch) result.size = parseFloat(sizeMatch[1])

    // Extract entry price
    const entryMatch = aiResponse.match(/(?:entry|entry\s*price|open)[:\s]*([\d.]+)/i)
    if (entryMatch) result.entry_price = parseFloat(entryMatch[1])

    // Extract exit price
    const exitMatch = aiResponse.match(/(?:exit|exit\s*price|close)[:\s]*([\d.]+)/i)
    if (exitMatch) result.exit_price = parseFloat(exitMatch[1])

    // Extract stop loss
    const slMatch = aiResponse.match(/(?:s\/l|stop\s*loss|stoploss)[:\s]*([\d.]+)/i)
    if (slMatch) result.stop_loss = parseFloat(slMatch[1])

    // Extract take profit
    const tpMatch = aiResponse.match(/(?:t\/p|take\s*profit|takeprofit)[:\s]*([\d.]+)/i)
    if (tpMatch) result.take_profit = parseFloat(tpMatch[1])

    // Extract profit
    const profitMatch = aiResponse.match(/(?:profit|p\/l|pl)[:\s]*(-?[\d.]+)/i)
    if (profitMatch) result.profit = parseFloat(profitMatch[1])

    return result
  } catch (error) {
    console.error('Error parsing trading data:', error)
    return null
  }
}

/**
 * Normalize trading data to match form fields
 */
function normalizeTradingData(data: any): any {
  const result: any = {}

  if (data.pair || data.symbol) {
    result.symbol = (data.pair || data.symbol).toUpperCase()
  }

  if (data.type) {
    result.type = data.type.toUpperCase() === 'BUY' ? 'BUY' : 'SELL'
  }

  if (data.size || data.lot_size) {
    result.lot_size = data.size || data.lot_size
  }

  if (data.entry_price || data.open_price) {
    result.open_price = data.entry_price || data.open_price
  }

  if (data.exit_price || data.close_price) {
    result.close_price = data.exit_price || data.close_price
  }

  if (data.stop_loss) {
    result.stop_loss = data.stop_loss
  }

  if (data.take_profit) {
    result.take_profit = data.take_profit
  }

  if (data.profit || data.profit_loss) {
    result.profit_loss = data.profit || data.profit_loss
  }

  return result
}

export async function POST(request: NextRequest) {
  try {
    // Auth check — uses service-role client for storage, but user must be authenticated
    const { supabase: authClient } = createClientForApi(request)
    const { data: { user } } = await authClient.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Rate limit: 10 requests per minute per user
    const rl = rateLimitByUser('analyze-screenshot', user.id, {
      maxRequests: 10,
      windowMs: 60_000,
      message: 'Terlalu banyak permintaan analisis screenshot. Maksimal 10 per menit.',
    })
    if (rl) return rl

    const pro = await isUserPro(user.id)
    if (!pro) {
      return NextResponse.json({
        error: 'Fitur ini hanya untuk pengguna PRO. Upgrade ke PRO untuk akses!',
        code: 'PRO_REQUIRED',
        requiresUpgrade: true
      }, { status: 403 })
    }

    // Parse form data
    const formData = await request.formData()
    const image = formData.get('image') as File

    if (!image) {
      console.error('❌ [Analyze Screenshot] No image provided')
      return NextResponse.json(
        { error: 'Image file is required' },
        { status: 400 }
      )
    }

    // Validate file type
    if (!image.type.startsWith('image/')) {
      console.error('❌ [Analyze Screenshot] Invalid file type:', image.type)
      return NextResponse.json(
        { error: 'File must be an image (JPEG, PNG, WebP)' },
        { status: 400 }
      )
    }

    // Validate file size (10MB max)
    const maxSize = 10 * 1024 * 1024 // 10MB
    if (image.size > maxSize) {
      console.error('❌ [Analyze Screenshot] File too large:', image.size)
      return NextResponse.json(
        { error: 'File size must be less than 10MB' },
        { status: 400 }
      )
    }

    // Generate unique file name with timestamp
    const timestamp = Date.now()
    const randomString = Math.random().toString(36).substring(2, 10)
    const fileExt = image.name.split('.').pop()
    const fileName = `${timestamp}_${randomString}_ai.${fileExt}`

    console.log(`📁 [Analyze Screenshot] Bucket: ${BUCKET_NAME}, File: ${fileName}`)

    // Convert image to buffer
    const arrayBuffer = await image.arrayBuffer()
    const buffer = Buffer.from(arrayBuffer)

    // Upload to Supabase Storage
    const { data: uploadData, error: uploadError } = await getSupabase().storage
      .from(BUCKET_NAME)
      .upload(fileName, buffer, {
        contentType: image.type,
        cacheControl: '31536000', // 1 year cache
        upsert: false
      })

    if (uploadError) {
      console.error('❌ [Analyze Screenshot] Upload error:', uploadError)
      return NextResponse.json(
        { error: `Upload failed: ${uploadError.message}` },
        { status: 500 }
      )
    }

    console.log('✅ [Analyze Screenshot] Image uploaded to Supabase Storage:', uploadData.path)

    // Get public URL
    const { data: urlData } = getSupabase().storage
      .from(BUCKET_NAME)
      .getPublicUrl(fileName)

    const publicUrl = urlData.publicUrl
    console.log(`🔗 [Analyze Screenshot] Public URL: ${publicUrl}`)

    // Convert image to base64 for AI analysis
    const base64Image = buffer.toString('base64')

    // Create prompt for AI Vision
    const prompt = `Analyze this trading platform screenshot and extract the following trading data in JSON format:
{
  "pair": "Trading pair/symbol (e.g., XAUUSD, EURUSD)",
  "type": "Trade type - either 'BUY' or 'SELL'",
  "size": "Lot size (e.g., 0.03, 0.1)",
  "entry_price": "Entry/open price (e.g., 4484.57)",
  "exit_price": "Exit/close price (e.g., 4473.76)",
  "stop_loss": "Stop loss price if visible (null if not)",
  "take_profit": "Take profit price if visible (null if not)",
  "profit": "Profit/loss amount (e.g., 32.43, -50.00)"
}

Important guidelines:
- Return ONLY the JSON object, no additional text
- Use null for fields not visible in the screenshot
- Ensure all numbers are properly formatted
- Pair symbol should be uppercase
- Type must be exactly 'BUY' or 'SELL'
- Profit should be negative for losses, positive for gains`

    console.log('🤖 [Analyze Screenshot] Starting AI analysis with FREE services...')

    let aiResponse: string

    // Try Ollama first (FREE - local installation)
    try {
      console.log('🔄 [Analyze Screenshot] Trying Ollama (FREE)...')
      const ollamaResult = await analyzeImageWithOllama(
        base64Image,
        image.type,
        prompt
      )
      // Convert Ollama result to JSON string
      aiResponse = JSON.stringify(ollamaResult)
      console.log('✅ [Analyze Screenshot] Ollama analysis completed')
    } catch (ollamaError: any) {
      console.log('⚠️ [Analyze Screenshot] Ollama failed:', ollamaError.message)
      console.log('🔄 [Analyze Screenshot] Trying Z.ai Vision (FREE)...')

      // Fallback to Z.ai Vision (FREE - SDK built-in)
      try {
        const zaiResult = await analyzeImageWithZAIVision(base64Image, prompt, {})
        aiResponse = zaiResult.text
        console.log('✅ [Analyze Screenshot] Z.ai Vision analysis completed')
      } catch (zaiError: any) {
        console.error('❌ [Analyze Screenshot] Z.ai Vision also failed:', zaiError.message)
        return NextResponse.json(
          { error: 'AI Vision service tidak tersedia. Pastikan Ollama terinstall atau konfigurasi Z.ai benar.' },
          { status: 503 }
        )
      }
    }

    // Parse trading data from AI response
    const tradingData = parseTradingData(aiResponse)

    if (!tradingData) {
      console.error('❌ [Analyze Screenshot] Failed to parse trading data')
      return NextResponse.json(
        { error: 'Failed to extract trading data from image. Please try a clearer screenshot.' },
        { status: 500 }
      )
    }

    // Normalize data to match form fields
    const normalizedData = normalizeTradingData(tradingData)

    console.log('📊 [Analyze Screenshot] Extracted data:', normalizedData)

    // Return success response with extracted data
    return NextResponse.json({
      success: true,
      data: normalizedData,
      image_url: publicUrl,
      raw_response: aiResponse // Include for debugging
    })

  } catch (error: any) {
    console.error('❌ [Analyze Screenshot] Error:', error)

    // Handle timeout errors
    if (error.message?.includes('timeout') || error.message?.includes('AbortError') || error.message?.includes('took too long')) {
      return NextResponse.json(
        { error: 'Analisis timeout. Screenshot terlalu kompleks. Silakan coba lagi atau gunakan screenshot yang lebih sederhana.' },
        { status: 504 }
      )
    }

    // Handle rate limit errors (hanya untuk OpenAI fallback)
    if (error.message?.includes('rate limit')) {
      return NextResponse.json(
        { error: 'AI service rate limit exceeded. Silakan coba lagi dalam beberapa saat.' },
        { status: 429 }
      )
    }

    // Handle Ollama specific errors
    if (error.message?.includes('Ollama server is not running')) {
      return NextResponse.json(
        { error: 'Ollama server tidak berjalan. Silakan jalankan Ollama atau hubungi admin.' },
        { status: 503 }
      )
    }

    return NextResponse.json(
      { error: error.message || 'Gagal menganalisis screenshot' },
      { status: 500 }
    )
  }
}