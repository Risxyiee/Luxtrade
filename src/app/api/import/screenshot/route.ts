import { NextRequest, NextResponse } from 'next/server'
import { parseMT5TradeData } from '@/lib/simple-parser'

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

    console.log('📸 Processing screenshot...')

    // Since we can't do OCR on server-side with Tesseract.js in this environment,
    // return a helpful message directing user to alternatives
    const processingTime = ((Date.now() - startTime) / 1000).toFixed(2)

    return NextResponse.json({
      success: false,
      error: 'Fitur Screenshot OCR membutuhkan client-side processing',
      message: 'Maaf, fitur import dari screenshot saat ini tidak tersedia di server environment ini.\n\nAlternatif yang tersedia:\n1. Gunakan tab "Upload File" untuk import CSV/HTML dari MT5/MT4 (REKOMENDASI)\n2. Ekspor trade history dari MT5/MT4 ke format HTML atau CSV\n3. Atau tambahkan trade secara manual melalui tombol "+ Add Trade"\n\nFitur Screenshot OCR akan bekerja setelah deploy ke production environment yang mendukung client-side processing.',
      method: 'unavailable',
      suggestions: [
        'Use File Import tab (CSV/HTML format from MT5/MT4)',
        'Export trade history from MT5/MT4 terminal',
        'Add trades manually'
      ],
      debug: {
        processingTime: `${processingTime}s`,
        note: 'OCR processing requires client-side environment'
      }
    }, { status: 503 })

  } catch (error) {
    console.error('❌ Screenshot import error:', error)

    const errorMessage = error instanceof Error ? error.message : 'Unknown error'
    console.error('Error details:', errorMessage)

    return NextResponse.json({
      success: false,
      error: 'Gagal memproses screenshot',
      message: `Terjadi kesalahan: ${errorMessage}.\n\nSilakan:\n1. Coba upload ulang screenshot\n2. Gunakan tab "Upload File" untuk import CSV/HTML (REKOMENDASI)\n3. Atau tambahkan trade secara manual`,
      method: 'error',
      errorMessage: errorMessage
    }, { status: 500 })
  }
}