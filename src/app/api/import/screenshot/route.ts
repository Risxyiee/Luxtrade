import { NextRequest, NextResponse } from 'next/server'
import { performOCR, parseMT5TradeData, cleanupOCR } from '@/lib/tesseract-ocr'

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

// ==================== TESSERACT OCR ====================
async function ocrWithTesseract(imageBase64: string, retryCount = 0): Promise<any[]> {
  console.log(`🔍 Starting Tesseract OCR (attempt ${retryCount + 1})...`)

  try {
    // Convert base64 to buffer
    const imageBuffer = Buffer.from(imageBase64, 'base64')

    // Perform OCR
    const ocrResult = await performOCR(imageBuffer, {
      language: 'eng',
      oem: 3,
      psm: 6
    })

    // Parse trade data from OCR text
    const trades = parseMT5TradeData(ocrResult.text)

    console.log(`✅ Tesseract OCR completed: ${trades.length} trades found`)
    return trades

  } catch (error) {
    console.error('❌ Tesseract OCR Error:', error)

    const errorMsg = error instanceof Error ? error.message : String(error)

    // Retry logic for transient errors
    const isTransientError =
      errorMsg.includes('timeout') ||
      errorMsg.includes('network') ||
      errorMsg.includes('ETIMEDOUT')

    if (isTransientError && retryCount < 2) {
      console.log(`🔄 Retrying Tesseract OCR (${retryCount + 1}/2)...`)
      await new Promise(resolve => setTimeout(resolve, 2000))
      return ocrWithTesseract(imageBase64, retryCount + 1)
    }

    throw error
  }
}

// ==================== TRANSFORM TRADES ====================
function transformTrades(tesseractTrades: any[]): ParsedTrade[] {
  return tesseractTrades
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
        notes: 'Imported from MT5/MT4 screenshot using OCR'
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

    console.log('📸 Processing screenshot with Tesseract OCR (FREE)...')

    // Use Tesseract for OCR
    const tesseractTrades = await ocrWithTesseract(imageBase64)

    // Transform trades
    const trades = transformTrades(tesseractTrades)

    // Additional validation
    const validTrades = trades.filter(t =>
      t.symbol &&
      t.symbol.length >= 3 &&
      t.symbol !== 'UNKNOWN' &&
      !isNaN(t.profit_loss) &&
      t.lot_size > 0
    )

    const processingTime = ((Date.now() - startTime) / 1000).toFixed(2)
    console.log(`📊 Valid trades extracted: ${validTrades.length}/${tesseractTrades.length} (took ${processingTime}s)`)

    // Cleanup OCR worker
    await cleanupOCR().catch(err => console.warn('Cleanup warning:', err))

    if (validTrades.length === 0) {
      return NextResponse.json({
        success: false,
        error: 'Tidak ada transaksi terdeteksi',
        message: 'Tidak dapat menemukan transaksi di gambar. Tips:\n• Pastikan screenshot menampilkan history MT5/MT4 dengan jelas\n• Pastikan kolom Symbol, Type, Price, dan Profit terlihat\n• Gunakan screenshot dengan resolusi yang cukup tinggi\n• Pastikan screenshot tidak blur atau gelap\n• OCR gratis (Tesseract) mungkin tidak seakurat OpenAI Vision\n\nAlternatif:\n1. Gunakan tab "Upload File" untuk import CSV/HTML dari MT5\n2. Atau tambahkan trade secara manual melalui tombol "+ Add Trade"',
        method: 'Tesseract OCR (FREE)',
        debug: {
          rawTradesCount: tesseractTrades.length,
          processingTime: `${processingTime}s`
        }
      }, { status: 422 })
    }

    return NextResponse.json({
      success: true,
      trades: validTrades,
      count: validTrades.length,
      method: 'Tesseract OCR (FREE)',
      processingTime: `${processingTime}s`,
      timestamp: new Date().toISOString()
    })

  } catch (error) {
    console.error('❌ Screenshot OCR error:', error)

    const errorMessage = error instanceof Error ? error.message : 'Unknown error'
    console.error('Error details:', errorMessage)

    // Cleanup OCR worker on error
    await cleanupOCR().catch(err => console.warn('Cleanup warning:', err))

    // Handle timeout errors
    if (errorMessage.includes('timeout') || errorMessage.includes('ETIMEDOUT')) {
      return NextResponse.json({
        success: false,
        error: 'Timeout',
        message: 'Proses OCR membutuhkan waktu terlalu lama. Tesseract OCR memerlukan lebih banyak waktu daripada OpenAI Vision.\n\nTips:\n• Gunakan gambar dengan resolusi lebih rendah\n• Pastikan koneksi internet stabil\n• Atau gunakan tab "Upload File" sebagai alternatif',
        method: 'Tesseract OCR (FREE)'
      }, { status: 504 })
    }

    return NextResponse.json({
      success: false,
      error: 'Gagal memproses screenshot',
      message: `Terjadi kesalahan OCR: ${errorMessage}.\n\nSilakan:\n1. Coba upload ulang screenshot\n2. Pastikan screenshot menampilkan data trade dengan jelas\n3. Gunakan tab "Upload File" sebagai alternatif\n\nTesseract OCR adalah layanan gratis, jadi mungkin tidak seakurat OpenAI Vision.`,
      method: 'Tesseract OCR (FREE)',
      errorMessage: errorMessage
    }, { status: 500 })
  }
}