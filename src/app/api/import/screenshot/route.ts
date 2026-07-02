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

    // AI Vision analysis is available through the AI Vision service
    const processingTime = ((Date.now() - startTime) / 1000).toFixed(2)

    return NextResponse.json({
      success: false,
      error: 'Gunakan fitur Quick Import di Trade Form',
      message: 'Untuk import dari screenshot:\n\n1. Buka form Add Trade (+)\n2. Gunakan Quick Import section\n3. Upload screenshot untuk AI Vision extraction\n\nAtau gunakan alternatif:\n1. Gunakan MT5 Statement import (CSV/Excel/HTML)\n2. Atau tambahkan trade secara manual',
      method: 'use_quick_import',
      suggestions: [
        'Use Quick Import in Add Trade form for AI Vision analysis',
        'Use MT5 Statement file import (CSV/Excel/HTML)',
        'Add trades manually'
      ]
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