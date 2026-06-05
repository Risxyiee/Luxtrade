import { NextRequest, NextResponse } from 'next/server'
import { analyzeImageWithOpenAI } from '@/lib/openai-vision'
import { promises as fs } from 'fs'
import path from 'path'

/**
 * API Route: Analyze Trading Screenshot
 * Extracts trading data from screenshot using AI Vision
 */

const UPLOAD_DIR = '/home/z/my-project/upload'

// Ensure upload directory exists
async function ensureUploadDir() {
  try {
    await fs.access(UPLOAD_DIR)
  } catch {
    await fs.mkdir(UPLOAD_DIR, { recursive: true })
  }
}

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
    console.log('📷 [Analyze Screenshot] Starting analysis...')

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

    // Ensure upload directory exists
    await ensureUploadDir()

    // Save image to filesystem
    const fileName = `${Date.now()}_${image.name}`
    const filePath = path.join(UPLOAD_DIR, fileName)
    const bytes = await image.arrayBuffer()
    const buffer = Buffer.from(bytes)

    await fs.writeFile(filePath, buffer)
    console.log(`✅ [Analyze Screenshot] Image saved to: ${filePath}`)

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

    console.log('🤖 [Analyze Screenshot] Sending to AI Vision...')

    // Analyze image with AI Vision
    const aiResponse = await analyzeImageWithOpenAI(
      base64Image,
      image.type,
      prompt,
      'gpt-4o'
    )

    console.log('✅ [Analyze Screenshot] AI response received')

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
      image_url: `/upload/${fileName}`,
      raw_response: aiResponse // Include for debugging
    })

  } catch (error: any) {
    console.error('❌ [Analyze Screenshot] Error:', error)

    // Handle specific errors
    if (error.message?.includes('OPENAI_API_KEY')) {
      return NextResponse.json(
        { error: 'AI Vision service is not configured. Please contact support.' },
        { status: 503 }
      )
    }

    if (error.message?.includes('timeout') || error.message?.includes('took too long')) {
      return NextResponse.json(
        { error: 'Analysis timeout. Please try again or use a simpler image.' },
        { status: 504 }
      )
    }

    if (error.message?.includes('rate limit')) {
      return NextResponse.json(
        { error: 'AI service rate limit exceeded. Please try again in a moment.' },
        { status: 429 }
      )
    }

    return NextResponse.json(
      { error: error.message || 'Failed to analyze screenshot' },
      { status: 500 }
    )
  }
}