import { NextRequest, NextResponse } from 'next/server'

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

// ==================== VLM OCR ====================
async function ocrWithVLM(imageBase64: string): Promise<any[]> {
  console.log('🔍 Starting VLM OCR...')

  // Dynamic import - SDK only available in sandbox environment
  let ZAI: any
  try {
    ZAI = (await import('z-ai-web-dev-sdk')).default
  } catch {
    throw new Error('VLM service is currently unavailable. Please use the File Import tab instead (CSV/HTML format).')
  }

  const zai = await ZAI.create()

  const imageUrl = imageBase64.startsWith('data:')
    ? imageBase64
    : `data:image/png;base64,${imageBase64}`

  // EXACT PROMPT yang berhasil di CLI
  const prompt = `Extract ALL trades from this MT5 screenshot. For each trade row, extract: symbol (like XAUUSD), type (buy/sell), lot size, entry price, exit price, profit, and time. Return as JSON array with fields: symbol, type, lot_size, open_price, close_price, profit_loss, time. Example: [{"symbol": "XAUUSD", "type": "BUY", "lot_size": 0.2, "open_price": 5135.40, "close_price": 5072.37, "profit_loss": 1228.20, "time": "2026.03.03 16:44:06"}]

IMPORTANT: Return ONLY the JSON array, no markdown, no explanation.`

  try {
    const response = await zai.chat.completions.createVision({
      messages: [
        {
          role: 'user',
          content: [
            { type: 'text', text: prompt },
            { type: 'image_url', image_url: { url: imageUrl } }
          ]
        }
      ],
      thinking: { type: 'disabled' }
    })

    const content = response.choices?.[0]?.message?.content || '[]'
    console.log('📝 VLM Raw Response:', content.substring(0, 300) + '...')

    // Clean and parse JSON
    let cleanContent = content.trim()
    if (cleanContent.startsWith('```json')) cleanContent = cleanContent.slice(7)
    if (cleanContent.startsWith('```')) cleanContent = cleanContent.slice(3)
    if (cleanContent.endsWith('```')) cleanContent = cleanContent.slice(0, -3)
    cleanContent = cleanContent.trim()

    const parsed = JSON.parse(cleanContent)
    const trades = Array.isArray(parsed) ? parsed : [parsed]

    console.log(`✅ VLM found ${trades.length} trades`)
    return trades
  } catch (error) {
    console.error('VLM Error:', error)
    throw error
  }
}

// ==================== PARSE DATE ====================
function parseMT5Date(dateStr: string): string {
  if (!dateStr) return new Date().toISOString()

  const match = dateStr.match(/(\d{4})\.(\d{2})\.(\d{2})\s+(\d{2}):(\d{2}):?(\d{2})?/)
  if (match) {
    const [, year, month, day, hour, minute, second = '00'] = match
    return `${year}-${month}-${day}T${hour}:${minute}:${second.padStart(2, '0')}Z`
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

// ==================== TRANSFORM TRADES ====================
function transformTrades(vlmTrades: any[]): ParsedTrade[] {
  return vlmTrades
    .filter(t => t && t.symbol && t.profit_loss !== undefined)
    .map(t => {
      const openTime = parseMT5Date(t.time || '')

      return {
        symbol: String(t.symbol || 'UNKNOWN').toUpperCase().replace(/[^A-Z]/g, ''),
        type: String(t.type || 'BUY').toUpperCase() === 'SELL' ? 'SELL' : 'BUY',
        open_price: parseFloat(String(t.open_price || 0)) || 0,
        close_price: parseFloat(String(t.close_price || 0)) || 0,
        lot_size: parseFloat(String(t.lot_size || 0.1)) || 0.1,
        profit_loss: parseFloat(String(t.profit_loss || 0)) || 0,
        open_time: openTime,
        close_time: openTime,
        session: getSessionFromHour(openTime),
        notes: 'Imported from MT5 screenshot'
      }
    })
}

// ==================== MAIN HANDLER ====================
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { imageBase64 } = body

    if (!imageBase64) {
      return NextResponse.json({
        success: false,
        error: 'No image provided',
        message: 'Please upload an image file.'
      }, { status: 400 })
    }

    console.log('📸 Processing screenshot with VLM...')

    // Use VLM for OCR
    const vlmTrades = await ocrWithVLM(imageBase64)

    // Transform trades
    const trades = transformTrades(vlmTrades)

    // Validate trades
    const validTrades = trades.filter(t =>
      t.symbol &&
      t.symbol.length >= 3 &&
      !isNaN(t.profit_loss)
    )

    console.log(`📊 Valid trades extracted: ${validTrades.length}`)

    if (validTrades.length === 0) {
      return NextResponse.json({
        success: false,
        error: 'Tidak ada transaksi terdeteksi',
        message: 'Tidak dapat menemukan transaksi di gambar. Pastikan screenshot menampilkan history MT5 dengan jelas.',
        method: 'VLM'
      }, { status: 422 })
    }

    return NextResponse.json({
      success: true,
      trades: validTrades,
      count: validTrades.length,
      method: 'VLM OCR'
    })

  } catch (error) {
    console.error('Screenshot OCR error:', error)

    const errorMessage = error instanceof Error ? error.message : 'Unknown error'
    console.error('Error details:', errorMessage)

    // If SDK is not available, provide helpful fallback message
    if (errorMessage.includes('VLM service is currently unavailable') || errorMessage.includes('Cannot find module')) {
      return NextResponse.json({
        success: false,
        error: 'VLM Tidak Tersedia',
        message: 'Fitur screenshot OCR memerlukan AI service yang saat ini hanya tersedia di demo.\n\nAlternatif:\n1. Gunakan tab "Upload File" untuk import CSV/HTML dari MT5\n2. Atau tambahkan trade secara manual melalui tombol "+ Add Trade"',
        method: 'unavailable'
      }, { status: 503 })
    }

    return NextResponse.json({
      success: false,
      error: 'Gagal memproses screenshot',
      message: `Error: ${errorMessage}. Silakan coba lagi.`
    }, { status: 500 })
  }
}
