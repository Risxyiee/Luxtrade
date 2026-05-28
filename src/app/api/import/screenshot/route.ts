import { NextRequest, NextResponse } from 'next/server'
import { analyzeImageWithOpenAI } from '@/lib/openai-vision'

// ==================== TYPES ====================
interface ParsedTrade {
  symbol: string
  type: 'BUY' | 'SELL'
  open_price: number
  close_price: number
  lot_size: number
  profit_loss: number
  open_time: string
  close_time: string
  session: string | null
  notes: string
}

// ==================== PARSE DATE - IMPROVED ====================
function parseMT5Date(dateStr: string): string {
  if (!dateStr) return new Date().toISOString()

  // Try MT5 format: 2026.03.03 16:44:06
  let match = dateStr.match(/(\d{4})\.(\d{2})\.(\d{2})\s+(\d{2}):(\d{2}):?(\d{2})?/)
  if (match) {
    const [, year, month, day, hour, minute, second = '00'] = match
    return `${year}-${month}-${day}T${hour}:${minute}:${second.padStart(2, '0')}Z`
  }

  // Try MT4 format: 2026.03.03
  match = dateStr.match(/(\d{4})\.(\d{2})\.(\d{2})/)
  if (match) {
    const [, year, month, day] = match
    return `${year}-${month}-${day}T12:00:00Z`
  }

  // Try standard ISO format
  try {
    const date = new Date(dateStr)
    if (!isNaN(date.getTime())) {
      return date.toISOString()
    }
  } catch {
    // Ignore date parsing errors
  }

  return new Date().toISOString()
}

// ==================== GET SESSION ====================
function getSessionFromHour(isoDate: string): string | null {
  const match = isoDate.match(/T(\d{2}):/)
  if (!match) return null

  const hour = parseInt(match[1])
  if (hour >= 0 && hour < 8) return 'Asia'
  if (hour >= 8 && hour < 16) return 'London'
  return 'New York'
}

// ==================== CLEAN JSON RESPONSE ====================
function cleanJsonContent(content: string): any {
  let cleanContent = content.trim()

  // Remove markdown code blocks
  if (cleanContent.startsWith('```json')) cleanContent = cleanContent.slice(7)
  if (cleanContent.startsWith('```')) cleanContent = cleanContent.slice(3)
  if (cleanContent.endsWith('```')) cleanContent = cleanContent.slice(0, -3)
  cleanContent = cleanContent.trim()

  // Try to extract JSON if there's extra text
  const jsonMatch = cleanContent.match(/\[.*\]/s) || cleanContent.match(/\{.*\}/s)
  if (jsonMatch) {
    cleanContent = jsonMatch[0]
  }

  return JSON.parse(cleanContent)
}

// ==================== VLM OCR ====================
async function ocrWithVLM(imageBase64: string, retryCount = 0): Promise<any[]> {
  console.log(`🔍 Starting VLM OCR (attempt ${retryCount + 1})...`)

  const imageUrl = imageBase64.startsWith('data:')
    ? imageBase64
    : `data:image/png;base64,${imageBase64}`

  // Enhanced prompt with more specific instructions
  const prompt = `You are a professional trading data extractor. Extract ALL trades from this MT5/MT4 screenshot.

For EACH trade row, extract these fields:
- symbol: Currency pair (e.g., XAUUSD, EURUSD, GBPJPY)
- type: Either "BUY" or "SELL" (uppercase)
- lot_size: Lot size as a number (e.g., 0.1, 0.5, 1.0)
- open_price: Entry price (e.g., 5135.40)
- close_price: Exit price (e.g., 5072.37)
- profit_loss: Profit/Loss value (can be negative for losses)
- time: Date and time in format YYYY.MM.DD HH:MM:SS

CRITICAL RULES:
1. Return ONLY a valid JSON array - no markdown, no explanation, no extra text
2. Every trade MUST have symbol, type, lot_size, open_price, close_price, profit_loss
3. If profit is red or has parentheses, it's negative (e.g., -$50 = -50)
4. Extract ALL visible trades from the table
5. If no trades found, return empty array []

Example output:
[{"symbol": "XAUUSD", "type": "BUY", "lot_size": 0.2, "open_price": 5135.40, "close_price": 5072.37, "profit_loss": 1228.20, "time": "2026.03.03 16:44:06"}, {"symbol": "EURUSD", "type": "SELL", "lot_size": 0.5, "open_price": 1.0850, "close_price": 1.0870, "profit_loss": -100.00, "time": "2026.03.03 15:30:00"}]`

  try {
    const content = await analyzeImageWithOpenAI(imageBase64, 'image/png', prompt)
    const cleanContent = content.trim()
    
    // Remove markdown code blocks if present
    if (cleanContent.startsWith('```json')) {
      const jsonStr = cleanContent.slice(7, -3).trim()
      const parsed = JSON.parse(jsonStr)
      const trades = Array.isArray(parsed) ? parsed : [parsed]
      console.log(`✅ VLM found ${trades.length} trades`)
      return trades
    }
    
    if (cleanContent.startsWith('```')) {
      const jsonStr = cleanContent.slice(3, -3).trim()
      const parsed = JSON.parse(jsonStr)
      const trades = Array.isArray(parsed) ? parsed : [parsed]
      console.log(`✅ VLM found ${trades.length} trades`)
      return trades
    }
    
    // Try direct JSON parse
    const parsed = JSON.parse(cleanContent)
    const trades = Array.isArray(parsed) ? parsed : [parsed]
    console.log(`✅ VLM found ${trades.length} trades`)
    return trades

  } catch (error) {
    console.error('❌ VLM Error:', error)

    // Retry logic for transient errors
    const errorMsg = error instanceof Error ? error.message : String(error)
    const isTransientError =
      errorMsg.includes('timeout') ||
      errorMsg.includes('network') ||
      errorMsg.includes('rate limit') ||
      errorMsg.includes('ECONNREFUSED') ||
      errorMsg.includes('ETIMEDOUT')

    if (isTransientError && retryCount < 2) {
      console.log(`🔄 Retrying VLM OCR (${retryCount + 1}/2)...`)
      await new Promise(resolve => setTimeout(resolve, 2000)) // Wait 2 seconds
      return ocrWithVLM(imageBase64, retryCount + 1)
    }

    if (errorMsg.includes('OPENAI_API_KEY')) {
      throw new Error('VLM_SERVICE_NOT_CONFIGURED')
    }

    throw error
  }
}

// ==================== TRANSFORM TRADES ====================
function transformTrades(vlmTrades: any[]): ParsedTrade[] {
  return vlmTrades
    .filter(t => {
      // Filter out invalid trades
      if (!t) return false
      if (!t.symbol || typeof t.symbol !== 'string') return false
      if (t.profit_loss === undefined || t.profit_loss === null) return false

      // Ensure symbol has at least 3 characters after cleaning
      const cleanSymbol = String(t.symbol).toUpperCase().replace(/[^A-Z]/g, '')
      if (cleanSymbol.length < 3) return false

      return true
    })
    .map(t => {
      const openTime = parseMT5Date(t.time || '')

      // Clean symbol - remove non-alphabetic characters
      const cleanSymbol = String(t.symbol || 'UNKNOWN').toUpperCase().replace(/[^A-Z]/g, '')
      const finalSymbol = cleanSymbol.length >= 3 ? cleanSymbol : 'UNKNOWN'

      // Normalize trade type
      const typeStr = String(t.type || 'BUY').toUpperCase()
      const finalType = typeStr.includes('SELL') ? 'SELL' : 'BUY'

      // Parse numeric values safely
      const openPrice = parseFloat(String(t.open_price || 0))
      const closePrice = parseFloat(String(t.close_price || 0))
      const lotSize = parseFloat(String(t.lot_size || 0.1))
      const profitLoss = parseFloat(String(t.profit_loss || 0))

      return {
        symbol: finalSymbol,
        type: finalType,
        open_price: isNaN(openPrice) ? 0 : openPrice,
        close_price: isNaN(closePrice) ? 0 : closePrice,
        lot_size: isNaN(lotSize) || lotSize <= 0 ? 0.01 : lotSize,
        profit_loss: isNaN(profitLoss) ? 0 : profitLoss,
        open_time: openTime,
        close_time: openTime,
        session: getSessionFromHour(openTime),
        notes: 'Imported from MT5/MT4 screenshot'
      }
    })
}

// ==================== MAIN HANDLER ====================
export async function POST(request: NextRequest) {
  const startTime = Date.now()

  try {
    const body = await request.json()
    const { imageBase64 } = body

    // Validate input
    if (!imageBase64 || typeof imageBase64 !== 'string') {
      return NextResponse.json({
        success: false,
        error: 'No image provided',
        message: 'Please upload an image file.'
      }, { status: 400 })
    }

    // Validate image size (max 10MB)
    const imageSize = Buffer.from(imageBase64, 'base64').length
    if (imageSize > 10 * 1024 * 1024) {
      return NextResponse.json({
        success: false,
        error: 'Image too large',
        message: 'Please upload an image smaller than 10MB.'
      }, { status: 400 })
    }

    console.log('📸 Processing screenshot with VLM...')

    // Use VLM for OCR
    const vlmTrades = await ocrWithVLM(imageBase64)

    // Transform trades
    const trades = transformTrades(vlmTrades)

    // Additional validation
    const validTrades = trades.filter(t =>
      t.symbol &&
      t.symbol.length >= 3 &&
      t.symbol !== 'UNKNOWN' &&
      !isNaN(t.profit_loss) &&
      t.lot_size > 0
    )

    const processingTime = ((Date.now() - startTime) / 1000).toFixed(2)
    console.log(`📊 Valid trades extracted: ${validTrades.length}/${vlmTrades.length} (took ${processingTime}s)`)

    if (validTrades.length === 0) {
      return NextResponse.json({
        success: false,
        error: 'Tidak ada transaksi terdeteksi',
        message: 'Tidak dapat menemukan transaksi di gambar. Tips:\n• Pastikan screenshot menampilkan history MT5/MT4 dengan jelas\n• Pastikan kolom Symbol, Type, Price, dan Profit terlihat\n• Gunakan screenshot dengan resolusi yang cukup tinggi\n• Pastikan screenshot tidak blur atau gelap\n\nAlternatif: Gunakan tab "Upload File" untuk import CSV/HTML dari MT5.',
        method: 'VLM OCR',
        debug: {
          rawTradesCount: vlmTrades.length,
          processingTime: `${processingTime}s`
        }
      }, { status: 422 })
    }

    return NextResponse.json({
      success: true,
      trades: validTrades,
      count: validTrades.length,
      method: 'VLM OCR',
      processingTime: `${processingTime}s`,
      timestamp: new Date().toISOString()
    })

  } catch (error) {
    console.error('❌ Screenshot OCR error:', error)

    const errorMessage = error instanceof Error ? error.message : 'Unknown error'
    console.error('Error details:', errorMessage)

    // If SDK is not available, provide helpful fallback message
    if (errorMessage.includes('VLM_SERVICE_NOT_CONFIGURED') ||
        errorMessage.includes('OPENAI_API_KEY')) {
      return NextResponse.json({
        success: false,
        error: 'AI Service Tidak Dikonfigurasi',
        message: 'Maaf, fitur Screenshot OCR saat ini sedang tidak tersedia karena OpenAI API Key belum dikonfigurasi.\n\nAlternatif yang tersedia:\n1. Gunakan tab "Upload File" untuk import file CSV/HTML dari MT5/MT4\n2. Ekspor trade history dari MT5/MT4 ke format HTML atau CSV\n3. Atau tambahkan trade secara manual melalui tombol "+ Add Trade"\n\nUntuk mengaktifkan fitur ini, hubungi admin untuk mengkonfigurasi OpenAI API Key.',
        method: 'unavailable',
        suggestions: [
          'Use File Import tab instead (CSV/HTML format)',
          'Export trade history from MT5/MT4',
          'Add trades manually'
        ]
      }, { status: 503 })
    }

    // Handle timeout errors
    if (errorMessage.includes('timeout') || errorMessage.includes('ETIMEDOUT')) {
      return NextResponse.json({
        success: false,
        error: 'Timeout',
        message: 'Proses OCR membutuhkan waktu terlalu lama. Silakan coba lagi atau gunakan file dengan ukuran lebih kecil.\n\nTips:\n• Gunakan gambar dengan resolusi lebih rendah\n• Pastikan koneksi internet stabil\n• Atau gunakan tab "Upload File" sebagai alternatif',
        method: 'timeout'
      }, { status: 504 })
    }

    return NextResponse.json({
      success: false,
      error: 'Gagal memproses screenshot',
      message: `Terjadi kesalahan: ${errorMessage}.\n\nSilakan:\n1. Coba upload ulang screenshot\n2. Pastikan screenshot menampilkan data trade dengan jelas\n3. Gunakan tab "Upload File" sebagai alternatif\n\nJika masalah berlanjut, hubungi support.`,
      method: 'error',
      errorMessage: errorMessage
    }, { status: 500 })
  }
}
