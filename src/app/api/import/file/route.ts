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
  
  // Extract numbers
  const numbers: { value: number; raw: string }[] = []
  for (const cell of cells) {
    const numMatches = cell.matchAll(/[-+]?\d{1,3}[.,]\d{0,5}/g)
    for (const match of numMatches) {
      const raw = match[0]
      const value = parseFloat(raw.replace(',', '.'))
      if (!isNaN(value) && value !== 0) {
        numbers.push({ value, raw })
      }
    }
  }
  
  if (numbers.length < 2) return null
  
  // Find profit (usually last or with sign)
  let profitLoss = 0
  for (let i = numbers.length - 1; i >= 0; i--) {
    const num = numbers[i]
    if (num.raw.startsWith('-') || num.raw.startsWith('+')) {
      profitLoss = num.value
      break
    }
  }
  
  if (profitLoss === 0) {
    // Use last number as profit
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
    
    // Extract numbers
    const numMatches = line.matchAll(/[-+]?\d{1,3}[.,]\d{0,5}/g)
    const numbers: number[] = []
    for (const match of numMatches) {
      const value = parseFloat(match[0].replace(',', '.'))
      if (!isNaN(value)) {
        numbers.push(value)
      }
    }
    
    if (numbers.length < 2) continue
    
    // Simple assignment
    const lotSize = numbers.find(n => n > 0 && n < 100) || 0.1
    const profitLoss = numbers[numbers.length - 1] || 0
    const openPrice = numbers.find(n => n > 100) || numbers[0] || 0
    const closePrice = numbers.find(n => n > 100 && n !== openPrice) || openPrice
    
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
function parseCSV(content: string): ParsedTrade[] {
  const trades: ParsedTrade[] = []
  const lines = content.split('\n').filter(l => l.trim())
  
  if (lines.length < 2) return []
  
  // Parse header
  const headers = lines[0].toLowerCase().split(',').map(h => h.trim().replace(/"/g, ''))
  
  // Find column indices
  const findIndex = (...keywords: string[]) => {
    for (let i = 0; i < headers.length; i++) {
      for (const kw of keywords) {
        if (headers[i].includes(kw)) return i
      }
    }
    return -1
  }
  
  const symbolIdx = findIndex('symbol', 'pair', 'instrument')
  const typeIdx = findIndex('type', 'side', 'direction', 'action')
  const lotIdx = findIndex('lot', 'volume', 'size', 'qty')
  const openPriceIdx = findIndex('open', 'entry_price', 'entry')
  const closePriceIdx = findIndex('close', 'exit_price', 'exit')
  const profitIdx = findIndex('profit', 'pnl', 'p/l', 'pl')
  const timeIdx = findIndex('time', 'date', 'open_time')
  
  console.log(`📊 CSV columns - Symbol: ${symbolIdx}, Type: ${typeIdx}, Lot: ${lotIdx}, Open: ${openPriceIdx}, Close: ${closePriceIdx}, Profit: ${profitIdx}`)
  
  // Parse rows
  for (let i = 1; i < lines.length; i++) {
    const values = lines[i].split(',').map(v => v.trim().replace(/"/g, ''))
    if (values.length < 3) continue
    
    const symbol = symbolIdx >= 0 ? values[symbolIdx]?.toUpperCase() : ''
    if (!symbol || !TRADING_SYMBOLS.some(s => symbol.includes(s))) continue
    
    const typeStr = typeIdx >= 0 ? values[typeIdx]?.toLowerCase() : ''
    const type: 'BUY' | 'SELL' = typeStr?.includes('sell') ? 'SELL' : 'BUY'
    
    const lotSize = lotIdx >= 0 ? parseFloat(values[lotIdx]) || 0.1 : 0.1
    const openPrice = openPriceIdx >= 0 ? parseFloat(values[openPriceIdx]) || 0 : 0
    const closePrice = closePriceIdx >= 0 ? parseFloat(values[closePriceIdx]) || openPrice : openPrice
    const profitLoss = profitIdx >= 0 ? parseFloat(values[profitIdx]) || 0 : 0
    
    let openTime = new Date().toISOString()
    if (timeIdx >= 0 && values[timeIdx]) {
      const parsed = parseMT5Date(values[timeIdx])
      if (parsed) openTime = parsed
    }
    
    trades.push({
      symbol,
      type,
      open_price: openPrice,
      close_price: closePrice,
      lot_size: lotSize,
      profit_loss: profitLoss,
      open_time: openTime,
      close_time: openTime,
      session: getSessionFromHour(openTime),
      notes: 'Imported from CSV file'
    })
  }
  
  return trades
}

// ==================== MAIN HANDLER ====================
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { fileBase64, fileType, fileName } = body
    
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
      content = Buffer.from(base64Data, 'base64').toString('utf-8')
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
    
    if (mimeType === 'text/html' || name.endsWith('.html') || name.endsWith('.htm')) {
      console.log('📄 Parsing as HTML...')
      trades = parseHTMLReport(content)
    } else if (mimeType === 'text/csv' || name.endsWith('.csv')) {
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
      // PDF needs special handling - extract text first
      console.log('📕 PDF detected - extracting text...')
      
      // For PDF, we try to extract readable text
      // The content from base64 might be binary, so we look for readable strings
      const readableText = content
        .replace(/[^\x20-\x7E\n\r]/g, ' ')
        .replace(/\s+/g, ' ')
        .trim()
      
      console.log('📝 Extracted text length:', readableText.length)
      
      if (readableText.length < 50) {
        return NextResponse.json({
          success: false,
          error: 'PDF Tidak Terbaca',
          message: '⚠️ PDF tidak dapat dibaca secara langsung.\n\nSolusi:\n1. Buka PDF di browser\n2. Screenshot halaman yang berisi daftar transaksi\n3. Upload screenshot tersebut\n\nAtau export dari MT5 dalam format HTML/CSV.',
          fileType: 'pdf_unreadable'
        }, { status: 422 })
      }
      
      trades = parseTextTrades(readableText)
      
      if (trades.length === 0) {
        return NextResponse.json({
          success: false,
          error: 'PDF Perlu Screenshot',
          message: '⚠️ PDF terdeteksi sebagai file SUMMARY atau tidak dapat diparse.\n\nSolusi:\n1. Buka PDF di browser\n2. Screenshot halaman yang berisi daftar transaksi\n3. Upload screenshot melalui tab "Screenshot OCR"',
          fileType: 'pdf_needs_screenshot'
        }, { status: 422 })
      }
    } else {
      return NextResponse.json({ 
        success: false,
        error: 'Tipe file tidak didukung',
        message: `Tipe file "${mimeType || 'unknown'}" tidak didukung. Gunakan PDF, HTML, CSV, atau TXT.`
      }, { status: 400 })
    }
    
    console.log(`✅ Parsed ${trades.length} trades`)
    
    // Validate trades
    const validTrades = trades.filter(t => 
      t.symbol && 
      t.symbol.length >= 3 &&
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
