import { NextRequest, NextResponse } from 'next/server'
import { getAuthenticatedUser } from '@/lib/api-auth'
import pdf from 'pdf-parse-fixed'
import { edgeCrypto } from '@/lib/edge-crypto'
import { parseTradesFromCsv, parseNum } from '@/lib/trade-csv-parser'

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
  stop_loss?: number | null
  take_profit?: number | null
  ticket_number?: string | null
}

// ==================== TRADING SYMBOLS ====================
const TRADING_SYMBOLS = [
  'XAUUSD', 'XAGUSD', 'EURUSD', 'GBPUSD', 'USDJPY', 'EURJPY', 'GBPJPY',
  'AUDUSD', 'NZDUSD', 'USDCHF', 'EURGBP', 'EURAUD', 'GBPAUD', 'USDCAD',
  'XAU', 'XAG', 'GOLD', 'SILVER', 'BTCUSD', 'ETHUSD', 'US30', 'US500', 'US100'
]

// ==================== REGEX PATTERNS ====================
// MT5 date format: 2024.03.03 16:44:06
const DATE_REGEX = /(\d{4})[.\-/](\d{2})[.\-/](\d{2})\s+(\d{2}):(\d{2}):?(\d{2})?/g

// Number with optional sign and decimal
const NUMBER_REGEX = /[-+]?\d{1,3}[.,]?\d{0,5}/g

// Profit pattern with $ or currency
const PROFIT_REGEX = /[-+]?\$?\s*[\d,]+\.?\d*\s*(?:USD)?/gi

// ==================== HELPER: PARSE DATE ====================
function parseMT5Date(dateStr: string): string | null {
  if (!dateStr) return null
  
  const match = dateStr.match(/(\d{4})[.\-/](\d{2})[.\-/](\d{2})\s+(\d{2}):(\d{2}):?(\d{2})?/)
  if (match) {
    const [, year, month, day, hour, minute, second = '00'] = match
    return `${year}-${month}-${day}T${hour}:${minute}:${second.padStart(2, '0')}Z`
  }

  // Format DD/MM/YYYY (umum di export Excel Indonesia) — deteksi: komponen
  // pertama > 31 → pasti tahun. Kalau <= 31 dan komponen kedua > 12 → DD/MM.
  const dmy = dateStr.match(/(\d{1,4})[\-/](\d{1,2})[\-/](\d{2,4})(?:\s+(\d{1,2}):(\d{2})(?::(\d{2}))?)?/)
  if (dmy) {
    let [, a, b, c, hour = '00', minute = '00', second = '00'] = dmy
    let year: string, month: string, day: string
    if (a.length === 4) {
      year = a; month = b.padStart(2, '0'); day = c.padStart(2, '0')
    } else {
      const aa = parseInt(a), bb = parseInt(b)
      // DD/MM/YYYY kalau komponen pertama > 12, kalau enggak assume MM/DD → DD/MM (Indonesia)
      day = String(aa).padStart(2, '0')
      month = String(bb).padStart(2, '0')
      if (bb > 12 && aa <= 12) { day = String(aa).padStart(2, '0'); month = String(bb).padStart(2, '0') }
      year = c.length === 2 ? `20${c}` : c
    }
    return `${year}-${month}-${day}T${hour.padStart(2, '0')}:${minute}:${second.padStart(2, '0')}Z`
  }
  
  return null
}

// ==================== HELPER: GET SESSION ====================
function getSessionFromHour(isoDate: string): string | null {
  const match = isoDate.match(/T(\d{2}):/)
  if (!match) return null
  
  const hour = parseInt(match[1])
  if (hour >= 0 && hour < 8) return 'Asia'
  if (hour >= 8 && hour < 16) return 'London'
  return 'New York'
}

// ==================== DETECT FILE TYPE ====================
function detectFileType(content: string, fileName: string): 'summary' | 'detail' | 'unknown' {
  const lower = content.toLowerCase()
  const lowerName = fileName.toLowerCase()
  
  // Summary indicators
  const summaryKeywords = [
    'total profit', 'total loss', 'total p/l', 'net profit', 'net loss',
    'total trades', 'summary', 'balance', 'equity', 'margin',
    'deposit', 'withdrawal', 'profit factor', 'expected payoff',
    'absolute drawdown', 'maximal drawdown', 'relative drawdown'
  ]
  
  // Detail indicators
  const detailKeywords = [
    'closed positions', 'deals', 'orders', 'positions', 'history',
    'entry', 'exit', 'open', 'close', 'profit', 'swap', 'commission',
    '<table', '<tr', '<td', 'symbol', 'type', 'volume'
  ]
  
  const summaryScore = summaryKeywords.filter(k => lower.includes(k)).length
  const detailScore = detailKeywords.filter(k => lower.includes(k)).length
  
  console.log(`📊 File detection - Summary score: ${summaryScore}, Detail score: ${detailScore}`)
  
  if (summaryScore > detailScore && detailScore < 3) {
    return 'summary'
  }
  
  if (detailScore >= 3) {
    return 'detail'
  }
  
  return 'unknown'
}

// ==================== PARSE HTML REPORT ====================
function parseHTMLReport(html: string): ParsedTrade[] {
  const trades: ParsedTrade[] = []
  
  console.log('📄 Parsing HTML report...')
  
  // Remove scripts and styles
  let cleanHtml = html.replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
  cleanHtml = cleanHtml.replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
  
  // Find all table rows
  const rowMatches = cleanHtml.matchAll(/<tr[^>]*>([\s\S]*?)<\/tr>/gi)
  
  for (const rowMatch of rowMatches) {
    const row = rowMatch[1]
    
    // Extract cell contents
    const cells: string[] = []
    const cellMatches = row.matchAll(/<td[^>]*>([\s\S]*?)<\/td>/gi)
    for (const cellMatch of cellMatches) {
      // Remove HTML tags and clean
      const cell = cellMatch[1]
        .replace(/<[^>]*>/g, ' ')
        .replace(/&nbsp;/g, ' ')
        .replace(/\s+/g, ' ')
        .trim()
      cells.push(cell)
    }
    
    if (cells.length < 4) continue
    
    // Try to identify trade row
    const trade = parseTradeRow(cells)
    if (trade) {
      trades.push(trade)
    }
  }
  
  // Alternative: Parse text-based content
  if (trades.length === 0) {
    const textTrades = parseTextTrades(cleanHtml.replace(/<[^>]*>/g, '\n'))
    trades.push(...textTrades)
  }
  
  return trades
}

// ==================== PARSE TRADE ROW ====================
function parseTradeRow(cells: string[]): ParsedTrade | null {
  // Find symbol in cells
  let symbol = ''
  let symbolIndex = -1
  
  for (let i = 0; i < cells.length; i++) {
    const cell = cells[i].toUpperCase()
    for (const s of TRADING_SYMBOLS) {
      if (cell.includes(s)) {
        symbol = s
        symbolIndex = i
        break
      }
    }
    if (symbol) break
  }
  
  if (!symbol) return null
  
  // Combine all cell text for analysis
  const rowText = cells.join(' ')
  
  // Find type
  let type: 'BUY' | 'SELL' = 'BUY'
  const upperText = rowText.toUpperCase()
  if (upperText.includes('SELL') || upperText.includes('SHORT')) {
    type = 'SELL'
  }
  
  // Extract numbers — FIX 2026-11-05 (laporan Bos: profit $40 terbaca
  // $4000): dulu regex `/\d{1,3}[.,]\d{0,5}/` + `replace(',','.')` buta
  // format ("4000.00" terpotong, "1.234,56" salah). Sekarang per-SEL
  // pakai parseNum bersama: sel berisi angka murni → parse utuh; sel
  // campuran → scan per-token lalu parseNum.
  const numbers: { value: number; raw: string }[] = []
  for (const cell of cells) {
    const t = cell.trim()
    if (/^[^A-Za-z]{1,24}$/.test(t) && /\d/.test(t)) {
      const whole = parseNum(t)
      if (whole !== null && whole !== 0) { numbers.push({ value: whole, raw: t }); continue }
    }
    for (const match of t.matchAll(/[-+]?\d[\d.,\u00A0\u202F' ]*/g)) {
      const value = parseNum(match[0])
      if (value !== null && value !== 0) numbers.push({ value, raw: match[0].trim() })
    }
  }
  
  if (numbers.length < 2) return null
  
  // Find profit — FIX 2026-11-05: dulu "angka TERAKHIR = profit" →
  // profit positif (tanpa tanda) bikin yang keambil BALANCE ($4000
  // bukan $40). Urutan baru:
  //   1. Sel berlabel "profit / p/l / pnl" (nilai di sel tetangganya)
  //   2. Angka bertanda +/- (export MT5 selalu bertanda utk loss)
  //   3. Angka terakhir (fallback terakhir)
  let profitLoss = 0
  const isProfitLabel = (t: string) => /profit|p\/l|pnl/i.test(t)
  for (let i = 0; i < cells.length; i++) {
    if (!isProfitLabel(cells[i])) continue
    for (const off of [1, -1, 2]) {
      const c = String(cells[i + off] ?? '').trim()
      if (!c || /[A-Za-z]{3,}/.test(c)) continue // sel bukan angka
      const v = parseNum(c)
      if (v !== null && v !== 0 && Math.abs(v) < 1e7) { profitLoss = v; break }
    }
    if (profitLoss !== 0) break
  }
  if (profitLoss === 0) {
    for (let i = numbers.length - 1; i >= 0; i--) {
      const num = numbers[i]
      if (/^[-+]/.test(num.raw)) {
        profitLoss = num.value
        break
      }
    }
  }
  
  if (profitLoss === 0) {
    profitLoss = numbers[numbers.length - 1]?.value || 0
  }
  
  // Find lot size (small decimal)
  let lotSize = 0.1
  for (const num of numbers) {
    if (num.value > 0 && num.value <= 100 && num.raw.includes('.')) {
      lotSize = num.value
      break
    }
  }
  
  // Find prices (larger numbers)
  const prices: number[] = []
  for (const num of numbers) {
    if (num.value > 0.5 && num.value !== lotSize && num.value !== Math.abs(profitLoss)) {
      prices.push(num.value)
    }
  }
  
  const openPrice = prices[0] || 0
  const closePrice = prices[1] || openPrice
  
  // Find time
  let openTime = new Date().toISOString()
  for (const cell of cells) {
    const parsed = parseMT5Date(cell)
    if (parsed) {
      openTime = parsed
      break
    }
  }
  
  return {
    symbol,
    type,
    open_price: openPrice,
    close_price: closePrice,
    lot_size: lotSize,
    profit_loss: profitLoss,
    open_time: openTime,
    close_time: openTime,
    session: getSessionFromHour(openTime),
    notes: 'Imported from HTML report'
  }
}

// ==================== PARSE TEXT TRADES ====================
function parseTextTrades(text: string): ParsedTrade[] {
  const trades: ParsedTrade[] = []
  const lines = text.split('\n').map(l => l.trim()).filter(l => l.length > 0)
  
  for (const line of lines) {
    // Look for symbol + buy/sell + numbers pattern
    const upperLine = line.toUpperCase()
    
    // Find symbol
    let symbol = ''
    for (const s of TRADING_SYMBOLS) {
      if (upperLine.includes(s)) {
        symbol = s
        break
      }
    }
    
    if (!symbol) continue
    
    // Find type
    const type: 'BUY' | 'SELL' = upperLine.includes('SELL') ? 'SELL' : 'BUY'
    
    // Extract numbers — FIX 2026-11-05: parseNum bersama (anti salah format)
    const numbers: { value: number; raw: string }[] = []
    for (const match of line.matchAll(/[-+]?\d[\d.,\u00A0\u202F' ]*/g)) {
      const value = parseNum(match[0])
      if (value !== null && value !== 0) numbers.push({ value, raw: match[0].trim() })
    }
    
    if (numbers.length < 2) continue
    
    // Simple assignment (profit: tanda dulu, baru angka terakhir)
    let profitLoss = 0
    for (let i = numbers.length - 1; i >= 0; i--) {
      if (/^[-+]/.test(numbers[i].raw)) { profitLoss = numbers[i].value; break }
    }
    if (profitLoss === 0) profitLoss = numbers[numbers.length - 1]?.value || 0
    const lotSize = numbers.find(n => n.value > 0 && n.value < 100)?.value || 0.1
    const openPrice = numbers.find(n => n.value > 100)?.value || numbers[0]?.value || 0
    const closePrice = numbers.find(n => n.value > 100 && n.value !== openPrice)?.value || openPrice
    
    trades.push({
      symbol,
      type,
      open_price: openPrice,
      close_price: closePrice,
      lot_size: lotSize,
      profit_loss: profitLoss,
      open_time: new Date().toISOString(),
      close_time: new Date().toISOString(),
      session: null,
      notes: 'Imported from text file'
    })
  }
  
  return trades
}

// ==================== PARSE CSV ====================
// Parser CSV pindah ke src/lib/trade-csv-parser.ts (shared client + server):
// - delimiter koma / TAB / titik-koma auto-terdeteksi
// - file DENGAN header maupun TANPA header (export jurnal sinyal) terbaca
// - mapping kolom anti-salah (exact match dulu), SL/TP/ticket/durasi ikut
// Parser lama di file ini dihapus — dipanggil lewat helper di bawah.
function parseCSV(content: string): ParsedTrade[] {
  return parseTradesFromCsv(content).map(t => ({
    ...t,
    notes: t.notes || 'Imported from CSV file',
  }))
}

// ==================== MAIN HANDLER ====================
export async function POST(request: NextRequest) {
  try {
    const authResult = await getAuthenticatedUser(request)
    if (!authResult || !authResult.user) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
    }

    // Accept both FormData (from client) and JSON (from legacy callers)
    const contentType = request.headers.get('content-type') || ''
    let fileBase64: string | null = null
    let fileType = ''
    let fileName = ''

    if (contentType.includes('multipart/form-data')) {
      const form = await request.formData()
      const uploadedFile = form.get('file') as File | null
      if (!uploadedFile) {
        return NextResponse.json({ 
          success: false, error: 'No file provided', message: 'Please upload a file.'
        }, { status: 400 })
      }
      fileName = uploadedFile.name
      fileType = uploadedFile.type || ''
      const arrayBuffer = await uploadedFile.arrayBuffer()
      fileBase64 = edgeCrypto.base64EncodeBytes(arrayBuffer)
    } else {
      const body = await request.json()
      fileBase64 = body.fileBase64
      fileType = body.fileType || ''
      fileName = body.fileName || ''
    }
    
    if (!fileBase64) {
      return NextResponse.json({ 
        success: false,
        error: 'No file provided',
        message: 'Please upload a file.'
      }, { status: 400 })
    }
    
    const mimeType = fileType || ''
    const name = (fileName || '').toLowerCase()
    
    console.log(`📁 Processing file: ${fileName} (${mimeType})`)
    
    // Decode base64
    let content: string
    const base64Data = fileBase64.replace(/^data:[^;]+;base64,/, '').replace(/^data:.*;base64,/, '')
    
    try {
      content = edgeCrypto.base64DecodeUtf8(base64Data)
    } catch {
      return NextResponse.json({
        success: false,
        error: 'Gagal membaca file',
        message: 'File tidak dapat dibaca. Pastikan file tidak rusak.'
      }, { status: 400 })
    }
    
    // Detect if this is a summary file
    const fileTypeDetected = detectFileType(content, name)
    
    if (fileTypeDetected === 'summary') {
      return NextResponse.json({
        success: false,
        error: 'File Summary Terdeteksi',
        message: '⚠️ Ini adalah file SUMMARY (ringkasan), bukan detail transaksi.\n\nSilakan upload Screenshot Riwayat atau File Detail yang berisi daftar transaksi individual (Symbol, Type, Lots, Price, Profit per transaksi).',
        fileType: 'summary'
      }, { status: 422 })
    }
    
    // Parse based on file type
    let trades: ParsedTrade[] = []

    // FIX (laporan Bos: file trade gabisa dikirim): Windows/browser sering
    // kirim .csv dengan mime aneh (application/vnd.ms-excel, octet-stream,
    // atau kosong) → dulu langsung ditolak "Tipe file tidak didukung".
    // Sekarang: kalau isinya teks (bukan biner), coba parse CSV/heuristik.
    const looksTextual = !content.slice(0, 200).includes('\u0000')

    if (mimeType === 'text/html' || name.endsWith('.html') || name.endsWith('.htm')) {
      console.log('📄 Parsing as HTML...')
      trades = parseHTMLReport(content)
    } else if (mimeType === 'text/csv' || name.endsWith('.csv') || mimeType === 'application/vnd.ms-excel' || mimeType === 'application/excel') {
      console.log('📊 Parsing as CSV...')
      trades = parseCSV(content)
    } else if (mimeType === 'text/plain' || name.endsWith('.txt')) {
      console.log('📝 Parsing as TXT...')
      // Try CSV first, then text
      trades = parseCSV(content)
      if (trades.length === 0) {
        trades = parseTextTrades(content)
      }
    } else if (mimeType === 'application/pdf' || name.endsWith('.pdf')) {
      // PDF needs special handling - extract text using pdf-parse
      console.log('📕 PDF detected - extracting text...')

      try {
        // Convert base64 back to buffer for pdf-parse
        const pdfBuffer = edgeCrypto.base64Decode(base64Data)
        const data = await pdf(pdfBuffer)

        console.log('📝 Extracted text length:', data.text.length)
        console.log('📄 PDF pages:', data.numpages)

        const pdfText = data.text.trim()

        if (pdfText.length < 50) {
          return NextResponse.json({
            success: false,
            error: 'PDF Kosong atau Tidak Terbaca',
            message: '⚠️ PDF tidak mengandung teks yang dapat dibaca.\n\nSolusi:\n1. Buka PDF di browser\n2. Screenshot halaman yang berisi daftar transaksi\n3. Upload screenshot tersebut\n\nAtau export dari MT5 dalam format HTML/CSV.',
            fileType: 'pdf_empty'
          }, { status: 422 })
        }

        // Detect if this is a summary file
        const fileTypeDetected = detectFileType(pdfText, name)

        if (fileTypeDetected === 'summary') {
          return NextResponse.json({
            success: false,
            error: 'File Summary Terdeteksi',
            message: '⚠️ Ini adalah file SUMMARY (ringkasan), bukan detail transaksi.\n\nSilakan upload Screenshot Riwayat atau File Detail yang berisi daftar transaksi individual (Symbol, Type, Lots, Price, Profit per transaksi).',
            fileType: 'summary'
          }, { status: 422 })
        }

        trades = parseTextTrades(pdfText)

        if (trades.length === 0) {
          return NextResponse.json({
            success: false,
            error: 'PDF Perlu Screenshot',
            message: '⚠️ PDF tidak mengandung format transaksi yang dikenali.\n\nSolusi:\n1. Buka PDF di browser\n2. Screenshot halaman yang berisi daftar transaksi\n3. Upload screenshot melalui tab "Screenshot OCR"\n\nAtau export dari MT5 dalam format HTML/CSV.',
            fileType: 'pdf_no_trades'
          }, { status: 422 })
        }

        console.log(`✅ Successfully parsed ${trades.length} trades from PDF`)
      } catch (pdfError) {
        console.error('PDF parsing error:', pdfError)
        return NextResponse.json({
          success: false,
          error: 'Gagal Membaca PDF',
          message: '⚠️ Tidak dapat membaca file PDF.\n\nSolusi:\n1. Pastikan file PDF tidak rusak\n2. Buka PDF di browser dan screenshot\n3. Upload screenshot melalui tab "Screenshot OCR"\n\nAtau gunakan format HTML/CSV dari MT5.',
          fileType: 'pdf_error'
        }, { status: 422 })
      }
    } else if (looksTextual) {
      // Mime tidak dikenal (kosong / octet-stream) tapi isinya teks →
      // coba parse sebagai CSV, lalu heuristik teks. Jangan ditolak duluan.
      console.log('🔍 Unknown mime but textual content — trying CSV/text parse...')
      trades = parseCSV(content)
      if (trades.length === 0) {
        trades = parseTextTrades(content)
      }
    } else {
      return NextResponse.json({
        success: false,
        error: 'Tipe file tidak didukung',
        message: `Tipe file "${mimeType || 'unknown'}" tidak didukung. Gunakan PDF, HTML, CSV, atau TXT. Kalau filenya Excel (.xlsx/.xls), export dulu ke CSV dari Excel (File → Save As → CSV).`
      }, { status: 400 })
    }
    
    console.log(`✅ Parsed ${trades.length} trades`)
    
    // Validate trades
    const validTrades = trades.filter(t => 
      t.symbol && 
      t.symbol.length >= 2 &&
      t.symbol.length <= 12 &&
      !isNaN(t.profit_loss) &&
      t.open_price > 0
    )
    
    if (validTrades.length === 0) {
      return NextResponse.json({
        success: false,
        trades: [],
        count: 0,
        error: 'Tidak ada transaksi ditemukan',
        message: 'Tidak dapat menemukan transaksi di file. Pastikan file berisi daftar transaksi dengan kolom Symbol, Type, Lots, Price, dan Profit.'
      })
    }
    
    return NextResponse.json({
      success: true,
      trades: validTrades,
      count: validTrades.length,
      fileName,
      fileType: fileTypeDetected
    })
    
  } catch (error) {
    console.error('File parsing error:', error)
    return NextResponse.json({ 
      success: false,
      error: 'Gagal memproses file',
      message: error instanceof Error ? error.message : 'Unknown error occurred. Please check the file format.'
    }, { status: 500 })
  }
}
