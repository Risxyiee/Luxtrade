// ==================== SHARED CSV/TSV TRADE PARSER ====================
// Dipakai client (dialog Import CSV) & server (/api/import/file).
// Self-contained (tanpa import eksternal) supaya bisa dites langsung via bun.
//
// Mendukung:
//  1. CSV/TSV DENGAN header (export MT5, Excel, jurnal manual) — delimiter
//     koma / tab / titik-koma dideteksi otomatis.
//  2. File TANPA HEADER — format export jurnal sinyal, contoh (TAB):
//     ticket | open | close | open_utc | close_utc | symbol | tf | type |
//     lot | open_price | sl | fill | tp | reason | profit | fee | net |
//     R | balance | durasi(menit)
//     Posisi kolom TIDAK dianggap kaku — tiap token dikenali dari polanya
//     (tanggal, simbol, BUY/SELL, alesan close, harga, angka keuangan).
//     Zona waktu ganda (WIB & UTC) ditangani: pasangan open/close dipilih
//     yang durasinya paling cocok dengan kolom durasi (menit).

export interface CsvTrade {
  symbol: string
  type: 'BUY' | 'SELL'
  open_price: number
  close_price: number
  lot_size: number
  profit_loss: number
  open_time: string
  close_time: string
  session: string | null
  notes: string | null
  stop_loss?: number | null
  take_profit?: number | null
  ticket_number?: string | null
  trade_duration?: number | null // menit
  risk_reward_ratio?: number | null // kelipatan R (hasil real, bisa minus)
}

// ==================== KONSTANTA ====================
const KNOWN_SYMBOLS = [
  'XAUUSD', 'XAGUSD', 'XPTUSD', 'XAU', 'XAG', 'GOLD', 'SILVER',
  'EURUSD', 'GBPUSD', 'USDJPY', 'EURJPY', 'GBPJPY', 'AUDUSD', 'NZDUSD',
  'USDCHF', 'USDCAD', 'EURGBP', 'EURAUD', 'GBPAUD', 'GBPCAD', 'AUDJPY',
  'CADJPY', 'CHFJPY', 'NZDJPY', 'EURNZD', 'GBPNZD', 'AUDNZD', 'AUDCAD',
  'CADCHF', 'EURCHF', 'EURCAD', 'GBPCHF', 'GBPCAD',
  'BTCUSD', 'ETHUSD', 'BTCUSDm', 'US30', 'US500', 'US100', 'NAS100',
  'GER40', 'UK100', 'JP225', 'USOIL', 'UKOIL', 'WTI', 'SPX'
].sort((a, b) => b.length - a.length) // cek yang terpanjang dulu (EURUSD sebelum EUR)

const TIMEFRAMES = /^(m1|m5|m15|m30|h1|h4|d1|w1|mn1?|1m|5m|15m|30m|1h|4h|1d|1w)$/i

// Alesan penutupan posisi
const REASONS = /^(stop loss|take profit|stoploss|takeprofit|sl|tp|manual|market|close|closed|cancelled|canceled|expired|partial|so|stop out|target hit)$/i

/* FIX CSV JURNAL RINGKAS (laporan Bos: "upload file csv isinya tabel
   tanggal trade pair trade pnl dll juga masih gabisa"): kata kunci
   header dulu CUMA Inggris — header Indonesia (Tanggal, Tipe, Hasil,
   Simbol, Waktu, Jam, Arah) tak terdeteksi → baris masuk jalur
   "tanpa header" → kolom PnL salah petakan / baris dibuang. */
const HEADER_KEYWORDS = [
  'symbol', 'pair', 'time', 'type', 'side', 'direction', 'profit', 'p/l',
  'pnl', 'lots', 'lot', 'volume', 'price', 'ticket', 'order', 'date',
  'notes', 'session', 'duration', 'balance', 'entry', 'exit', 'action',
  'open', 'close', 'swap', 'commission', 'item', 'deal', 'position', 'sl', 'tp',
  'tanggal', 'waktu', 'jam', 'tipe', 'arah', 'hasil', 'simbol', 'buy/sell',
  'beli', 'jual', 'trade'
]

// ==================== HELPER: ANGKA ====================
// Toleran format Eropa (1.234,56) & US (1,234.56) + grup ribuan
// ber-spasi/nbsp/apostrof (1 234,56 / 1'234.56) + multi-titik
// ribuan (1.234.567). FIX 2026-11-05 (laporan Bos: profit $40
// terbaca $4000): dulu titik-ganda & spasi di-strip buta —
// "1.234.567" jadi 1.234 dan "40 000" jadi 40000 salah arah.
export function parseNum(raw: string | undefined | null): number | null {
  if (!raw) return null
  // NBSP/thin-space/apostrof = pemisah ribuan gaya lokal → spasi biasa
  let s = String(raw).replace(/[\u00A0\u202F\u2009']/g, ' ')
  s = s.replace(/[^0-9.,+\- ]/g, '').trim()
  if (!s || s === '-' || s === '+') return null
  if (!/\d/.test(s)) return null

  /* Grup ribuan ber-spasi: "1 234 567,89" / "40 000" — kelompok
     PAS 3 digit setelah digit pertama; kalau polanya cocok, spasi
     adalah separator ribuan (bukan sampah) → buang semua spasi. */
  if (/^\+?\d{1,3}( \d{3})+(?=[.,]|$)/.test(s)) s = s.replace(/ /g, '')
  else s = s.replace(/ /g, '') // spasi bukan pola ribuan → sampah

  const cleaned = s
  let normalized = cleaned
  if (cleaned.includes(',') && cleaned.includes('.')) {
    // Ada koma DAN titik → yang paling kanan = desimal
    normalized = cleaned.lastIndexOf(',') > cleaned.lastIndexOf('.')
      ? cleaned.replace(/\./g, '').replace(',', '.')
      : cleaned.replace(/,/g, '')
  } else if (cleaned.includes(',')) {
    const parts = cleaned.split(',')
    // "2,016" (ribuan) vs "2,016.5"? Kalau koma diikuti 3 digit & tak ada titik → ribuan
    normalized = parts.length === 2 && parts[1].length === 3
      ? cleaned.replace(/,/g, '')
      : cleaned.replace(/,/g, '.')
  } else if ((cleaned.match(/\./g) || []).length >= 2) {
    // FIX: multi-titik tanpa koma = separator ribuan ("1.234.567" → 1234567)
    normalized = cleaned.replace(/\./g, '')
  }
  const n = parseFloat(normalized)
  return isNaN(n) ? null : n
}

// ==================== HELPER: TANGGAL ====================
// Terima YYYY-MM-DD HH:MM[:SS] / YYYY.MM.DD / YYYY/MM/DD / ISO-T /
// DD/MM/YYYY (locale Indonesia). Balikin ISO string "…THH:MM:SSZ".
export function parseFlexibleDate(dateStr: string): string | null {
  if (!dateStr) return null
  const s = dateStr.trim()

  // 2024-03-05 / 2024.03.05 / 2024/03/05 (+ jam opsional, T atau spasi)
  const ymd = s.match(/(\d{4})[.\-/](\d{1,2})[.\-/](\d{1,2})(?:[ T](\d{1,2}):(\d{2})(?::(\d{2}))?)?/)
  if (ymd) {
    const [, y, m, d, hh = '00', mm = '00', ss = '00'] = ymd
    return `${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}T${hh.padStart(2, '0')}:${mm}:${ss.padStart(2, '0')}Z`
  }

  // DD/MM/YYYY atau MM/DD/YYYY (ambigu → asumsi DD/MM, umum di Indonesia)
  const dmy = s.match(/(\d{1,2})[.\-/](\d{1,2})[.\-/](\d{2,4})(?:[ T](\d{1,2}):(\d{2})(?::(\d{2}))?)?/)
  if (dmy) {
    const [, a, b, c, hh = '00', mm = '00', ss = '00'] = dmy
    const day = a.padStart(2, '0')
    const month = b.padStart(2, '0')
    const year = c.length === 2 ? `20${c}` : c
    return `${year}-${month}-${day}T${hh.padStart(2, '0')}:${mm}:${ss.padStart(2, '0')}Z`
  }

  return null
}

/* Token tanggal: YYYY-MM-DD[ HH:MM[:SS]] ATAU DD/MM/YYYY[ HH:MM[:SS]]
   (FIX jurnal Indonesia: dulu DD/MM/YYYY TIDAK dianggap tanggal → baris
   jurnal "08/11/2026,XAUUSD,buy,25.5" kehilangan kolom waktunya).
   Pola angka biasa (25.5, 2.016, 2.650,50, 2650.50) TIDAK kena — butuh
   2 pemisah + panjang kelompok yang cocok tanggal. */
const DATE_TOKEN_REGEX = /^(?:\d{4}[.\-/]\d{1,2}[.\-/]\d{1,2}|\d{1,2}[.\-/]\d{1,2}[.\-/]\d{2,4})([ T]\d{1,2}:\d{2}(:\d{2})?)?$/

export function getSessionFromHour(isoDate: string): string | null {
  const match = isoDate.match(/T(\d{2}):/)
  if (!match) return null
  const hour = parseInt(match[1])
  if (hour >= 0 && hour < 8) return 'Asia'
  if (hour >= 8 && hour < 16) return 'London'
  return 'New York'
}

// ==================== HELPER: DELIMITER & HEADER ====================
function detectDelimiter(lines: string[]): string {
  const candidates = ['\t', ';', ',']
  let best = ','
  let bestScore = 0
  const sample = lines.slice(0, 5)
  for (const d of candidates) {
    const counts = sample.map(l => l.split(d).length - 1)
    const minCount = Math.min(...counts)
    if (minCount > bestScore) {
      best = d
      bestScore = minCount
    }
  }
  return best
}

function cleanToken(t: string): string {
  return t.trim().replace(/^"(.*)"$/, '$1').trim()
}

function isHeaderLine(tokens: string[]): boolean {
  // Baris data selalu punya token tanggal; baris header tidak.
  if (tokens.some(t => DATE_TOKEN_REGEX.test(t))) return false
  let hits = 0
  for (const tok of tokens) {
    const t = tok.toLowerCase()
    if (HEADER_KEYWORDS.some(k => t === k || t.includes(k))) hits++
  }
  return hits >= 2
}
// ==================== MODE 1: CSV DENGAN HEADER ====================
function parseWithHeader(lines: string[], delimiter: string): CsvTrade[] {
  const trades: CsvTrade[] = []
  const headers = lines[0].toLowerCase().split(delimiter).map(h => cleanToken(h))

  // Pencarian kolom 2 tingkat: EXACT dulu (anti salah kolom), baru includes.
  // BUG lama (laporan Bos): findIndex('open') menangkap 'open time' →
  // open_price berisi tahun. SL/TP/notes/ticket gak kepetakan sama sekali.
  const norm = (s: string): string => s.toLowerCase().replace(/[\s_]/g, '')
  const normHeaders = headers.map(norm)
  const findExact = (...names: string[]): number => {
    for (const n of names) {
      const i = headers.indexOf(n)
      if (i >= 0) return i
    }
    return -1
  }
  // Pencarian versi ternormalisasi: "Open Price" / "open_price" / "OpenPrice"
  // semuanya cocok — export tiap platform beda-beda gaya penulisannya.
  const findNorm = (...names: string[]): number => {
    for (const n of names) {
      const nn = norm(n)
      const i = normHeaders.indexOf(nn)
      if (i >= 0) return i
    }
    return -1
  }
  const findIncludes = (...keywords: string[]): number => {
    for (const kw of keywords) {
      for (let i = 0; i < headers.length; i++) {
        /* Kw NON-waktu (mis. 'trade' utk kolom tipe) tidak boleh kepetak ke
           header waktu ("Tanggal Trade" mengandung 'trade') — skip. */
        if (isTimeHeader(headers[i]) && !isTimeHeader(kw)) continue
        if (headers[i].includes(kw)) return i
      }
    }
    return -1
  }
  /* Kolom HARGA harus melewati header berisi waktu ("Entry Time" mengandung
     "entry" — dulu kepetak jadi harga open → close_price = 51120261430).
     Kini includes untuk kolom harga skip header time/date/tanggal/waktu/jam. */
  const isTimeHeader = (h: string) => /time|date|tanggal|waktu|jam/.test(h)
  const findPriceIncludes = (...keywords: string[]): number => {
    for (const kw of keywords) {
      for (let i = 0; i < headers.length; i++) {
        if (isTimeHeader(headers[i])) continue
        if (headers[i].includes(kw)) return i
      }
    }
    return -1
  }
  const findPriceCol = (exact: string[], incl: string[]): number => {
    const e = findExact(...exact)
    if (e >= 0) return e
    const n = findNorm(...exact)
    if (n >= 0) return n
    return findPriceIncludes(...incl)
  }
  const findCol = (exact: string[], incl: string[]): number => {
    const e = findExact(...exact)
    if (e >= 0) return e
    const n = findNorm(...exact)
    if (n >= 0) return n
    return findIncludes(...incl)
  }

  const symbolIdx = findCol(['symbol', 'pair', 'instrument', 'simbol'], ['symbol', 'pair', 'instrument', 'simbol', 'pair trade'])
  /* FIX CSV JURNAL RINGKAS: kolom tipe dulu cuma kenal type/side/direction/
     action/posisi — header "Trade" atau "Buy/Sell" (jurnal Bos) luput →
     SEMUA baris dianggap BUY. Tambah alias Indonesia + 'trade' (diletakkan
     TERAKHIR + findIncludes skip header waktu, supaya "Tanggal Trade" tidak
     kepetak sebagai kolom tipe). */
  const typeIdx = findCol(
    ['type', 'side', 'direction', 'action', 'posisi', 'tipe', 'buy/sell', 'beli/jual', 'trade'],
    ['type', 'side', 'direction', 'action', 'posisi', 'tipe', 'buy/sell', 'beli/jual', 'trade'],
  )
  const lotIdx = findCol(['volume', 'lots', 'lot size', 'lot_size', 'size', 'qty'], ['volume', 'lots', 'lot', 'size', 'qty'])
  const openPriceIdx = findPriceCol(['open price', 'open_price', 'entry price', 'entry_price', 'harga entry', 'harga masuk', 'harga buka', 'entry'], ['entry price', 'entry_price', 'open price', 'open_price', 'harga entry', 'harga masuk', 'harga buka', 'entry'])
  const closePriceIdx = findPriceCol(['close price', 'close_price', 'exit price', 'exit_price', 'harga keluar', 'harga exit', 'harga tutup', 'exit'], ['close price', 'close_price', 'exit price', 'exit_price', 'harga keluar', 'harga exit', 'harga tutup', 'exit'])
  /* FIX: 'hasil' = PnL dlm jurnal Indonesia ("Hasil", "Hasil Trade") — dulu
     tidak dikenali → SEMUA pnl tercatat 0 (data hilang diam-diam). */
  const profitIdx = findCol(['profit', 'p/l', 'pnl', 'pl', 'net profit', 'profit/loss', 'laba', 'hasil', 'profit loss', 'hasil trade'], ['profit', 'pnl', 'p/l', 'laba', 'hasil'])
  const openTimeIdx = findCol(['open time', 'open_time', 'open date', 'waktu masuk', 'waktu buka', 'time', 'date', 'tanggal', 'tanggal trade', 'waktu trade', 'jam trade'], ['open time', 'open_time', 'open date', 'waktu masuk', 'waktu buka', 'tanggal', 'waktu', 'jam'])
  const closeTimeIdx = findCol(['close time', 'close_time', 'close date', 'exit time', 'waktu keluar', 'waktu tutup'], ['close time', 'close_time', 'close date', 'exit time', 'waktu keluar', 'waktu tutup'])
  const genericTimeIdx = openTimeIdx >= 0 ? openTimeIdx : findIncludes('time', 'date', 'tanggal', 'waktu')
  const slIdx = findCol(['sl', 's/l', 'stop loss', 'stop_loss', 'stoploss', 'stop'], ['stop loss', 'stop_loss', 'stoploss', 's/l'])
  const tpIdx = findCol(['tp', 't/p', 'take profit', 'take_profit', 'takeprofit'], ['take profit', 'take_profit', 'takeprofit', 't/p'])
  const notesIdx = findCol(['notes', 'note', 'reason', 'alesan entry', 'alesan', 'alasan', 'comment', 'comments', 'keterangan', 'strategy', 'setup', 'catatan'], ['alesan', 'alasan', 'reason', 'comment', 'keterangan', 'notes', 'catatan'])
  const ticketIdx = findCol(['ticket', 'ticket_number', 'order', 'position id', 'deal', 'no. order'], ['ticket', 'order', 'position'])

  console.log(`📊 CSV columns (delimiter: ${delimiter === '\t' ? 'TAB' : delimiter}) - Symbol: ${symbolIdx}, Type: ${typeIdx}, Lot: ${lotIdx}, Open: ${openPriceIdx}, Close: ${closePriceIdx}, Profit: ${profitIdx}, OpenTime: ${genericTimeIdx}, CloseTime: ${closeTimeIdx}, SL: ${slIdx}, TP: ${tpIdx}, Notes: ${notesIdx}, Ticket: ${ticketIdx}`)

  for (let i = 1; i < lines.length; i++) {
    const values = lines[i].split(delimiter).map(cleanToken)
    if (values.length < 3) continue

    /* FIX (laporan Bos 8 Nov 2026): pair "EUR/USD", "eur_usd", "XAUUSD-M"
       sebelumnya DITOLAK karena match mentah — sekarang dinormalisasi
       (buang non-alnum) dulu. Pair tak dikenal (SOLUSD, XRPUSD, dll)
       tetap diterima selalu formatnya wajar + bukan kata kunci ringkasan. */
    const symRaw = (symbolIdx >= 0 ? values[symbolIdx] : '').toUpperCase().trim()
    const symNorm = symRaw.replace(/[^A-Z0-9]/g, '')
    let symbol = ''
    if (symNorm) {
      const known = KNOWN_SYMBOLS.find(s => symNorm.includes(s))
      if (known) {
        symbol = known === 'BTCUSDm' ? 'BTCUSD' : known
      } else if (
        /^[A-Z]{3,10}$/.test(symNorm) &&
        !/^(TOTAL|SUMMARY|BALANCE|PROFIT|LOSS|EQUITY|DEPOSIT|WITHDRAWAL)$/.test(symNorm) &&
        !REASONS.test(symNorm) &&
        !TIMEFRAMES.test(symNorm)
      ) {
        symbol = symNorm
      }
    }
    if (!symbol) continue

    const typeStr = typeIdx >= 0 ? values[typeIdx]?.toLowerCase() : ''
    const type: 'BUY' | 'SELL' = typeStr?.includes('sell') || typeStr?.includes('short') || typeStr?.includes('jual') ? 'SELL' : 'BUY'

    const lotSize = lotIdx >= 0 ? (parseNum(values[lotIdx]) ?? 0.01) : 0.01
    const openPrice = openPriceIdx >= 0 ? (parseNum(values[openPriceIdx]) ?? 0) : 0
    const closePrice = closePriceIdx >= 0 ? (parseNum(values[closePriceIdx]) ?? openPrice) : openPrice
    const profitLoss = profitIdx >= 0 ? (parseNum(values[profitIdx]) ?? 0) : 0
    const stopLoss = slIdx >= 0 ? parseNum(values[slIdx]) : null
    const takeProfit = tpIdx >= 0 ? parseNum(values[tpIdx]) : null
    const ticketNumber = ticketIdx >= 0 && values[ticketIdx] ? String(values[ticketIdx]).replace(/[^0-9a-zA-Z#]/g, '') : null

    let openTime = new Date().toISOString()
    if (genericTimeIdx >= 0 && values[genericTimeIdx]) {
      const parsed = parseFlexibleDate(values[genericTimeIdx])
      if (parsed) openTime = parsed
    }
    let closeTime = openTime
    if (closeTimeIdx >= 0 && values[closeTimeIdx]) {
      const parsed = parseFlexibleDate(values[closeTimeIdx])
      if (parsed) closeTime = parsed
    }

    const notesRaw = notesIdx >= 0 ? values[notesIdx]?.trim() : ''
    const notes = notesRaw && notesRaw.length > 0 ? notesRaw : null

    // Durasi trade (menit) kalau kedua waktu valid
    let tradeDuration: number | null = null
    const openMs = Date.parse(openTime)
    const closeMs = Date.parse(closeTime)
    if (!isNaN(openMs) && !isNaN(closeMs) && closeMs >= openMs) {
      tradeDuration = Math.round((closeMs - openMs) / 60000)
    }

    trades.push({
      symbol,
      type,
      open_price: openPrice,
      close_price: closePrice,
      lot_size: lotSize,
      profit_loss: profitLoss,
      open_time: openTime,
      close_time: closeTime,
      session: getSessionFromHour(openTime),
      notes,
      stop_loss: stopLoss,
      take_profit: takeProfit,
      ticket_number: ticketNumber,
      trade_duration: tradeDuration,
    })
  }

  return trades
}

// ==================== MODE 2: FILE TANPA HEADER ====================
// Setiap token dikenali dari POLA, bukan posisi kolom yang kaku:
//  - tanggal   → kandidat open/close (2 zona waktu = 2 pasang)
//  - symbol    → XAUUSD dll.
//  - BUY/SELL  → arah
//  - angka kecil setelah arah → lot
//  - alesan    → STOP_LOSS / TAKE_PROFIT
//  - angka antara lot & alesan → harga (open, SL, fill, TP)
//  - angka setelah alesan → profit, fee, net, R, balance, durasi(menit)
function parseWithoutHeader(lines: string[], delimiter: string): CsvTrade[] {
  const trades: CsvTrade[] = []
  let skipped = 0

  for (let i = 0; i < lines.length; i++) {
    const tokens = lines[i].split(delimiter).map(cleanToken)
    /* FIX CSV JURNAL RINGKAS: dulu < 5 token langsung dibuang — jurnal polos
       "tanggal, pair, buy/sell, pnl" cuma 4 kolom → SEMUA baris jurnal
       hilang sebelum parsing dimulai. Turunkan ke 4. */
    if (tokens.length < 4) { skipped++; continue }

    // --- ticket (token pertama, angka/kode pendek, bukan tanggal) ---
    let ticket: string | null = null
    if (tokens[0] && /^\d{1,10}$/.test(tokens[0]) && !DATE_TOKEN_REGEX.test(tokens[0])) {
      ticket = tokens[0]
    }

    // --- tanggal-tanggal ---
    const dateTokens = tokens.filter(t => DATE_TOKEN_REGEX.test(t))

    // --- symbol ---
    let symbol = ''
    for (const tok of tokens) {
      if (DATE_TOKEN_REGEX.test(tok)) continue
      const up = tok.toUpperCase()
      if (/^(BUY|SELL)$/.test(up)) continue
      const known = KNOWN_SYMBOLS.find(s => up.includes(s))
      if (known) { symbol = known === 'BTCUSDm' ? 'BTCUSD' : known; break }
      if (/^[A-Z]{3,10}$/.test(up) && !REASONS.test(up) && !TIMEFRAMES.test(up)) { symbol = up; break }
    }
    if (!symbol) { skipped++; continue }

    // --- arah BUY/SELL ---
    const typeIdx = tokens.findIndex(t => /^(BUY|SELL)/i.test(t) && !DATE_TOKEN_REGEX.test(t))
    if (typeIdx < 0) { skipped++; continue }
    const type: 'BUY' | 'SELL' = /^SELL/i.test(tokens[typeIdx]) ? 'SELL' : 'BUY'

    // --- timeframe (opsional) ---
    const tfToken = tokens.find(t => TIMEFRAMES.test(t) && !DATE_TOKEN_REGEX.test(t))
    const tf = tfToken ? tfToken.toUpperCase() : null

    // --- alesan close ---
    const reasonIdx = tokens.findIndex(t => REASONS.test(t.replace(/[_\s]+/g, ' ').trim()) && !DATE_TOKEN_REGEX.test(t))
    const reasonRaw = reasonIdx >= 0 ? tokens[reasonIdx].replace(/[_\s]+/g, ' ').trim().toUpperCase() : null

    // --- lot: angka pertama setelah arah (lot selalu kecil, < 100) ---
    let lotSize = 0.01
    let volIdx = -1
    for (let j = typeIdx + 1; j < tokens.length; j++) {
      if (DATE_TOKEN_REGEX.test(tokens[j])) continue
      const v = parseNum(tokens[j])
      if (v !== null && v > 0 && v <= 100) { lotSize = v; volIdx = j; break }
    }
    // Mulai cari harga SETELAH kolom lot (kalau ketemu), biar lot 0.01
    // gak ikut kebaca sebagai harga open
    const priceStartIdx = volIdx >= 0 ? volIdx + 1 : typeIdx + 1

    // --- harga: token numerik antara lot dan alesan ---
    const priceTokens: number[] = []
    const endIdx = reasonIdx >= 0 ? reasonIdx : tokens.length
    for (let j = priceStartIdx; j < endIdx; j++) {
      if (DATE_TOKEN_REGEX.test(tokens[j])) continue
      if (TIMEFRAMES.test(tokens[j])) continue
      const v = parseNum(tokens[j])
      if (v !== null && v > 0) priceTokens.push(v)
    }
    /* FIX CSV JURNAL RINGKAS (laporan Bos: CSV "tanggal, pair, trade, pnl,
       dll" masih gabisa): baris TANPA harga dulu SELALU dibuang — padahal
       itu format jurnal manual paling umum. Aturan baru:
       • tanpa harga + ada angka (boleh minus = loss) setelah arah → itu PnL
       • tepat 1 angka harga tanpa alesan close → itu PnL (jurnal dgn lot)
       Export MT5 sejati selalu punya alesan close + ≥2 harga → jalur lama
       tetap utuh untuk mereka. */
    let journalPnl: number | null = null
    if (priceTokens.length === 0) {
      for (let j = typeIdx + 1; j < tokens.length; j++) {
        if (DATE_TOKEN_REGEX.test(tokens[j])) continue
        if (TIMEFRAMES.test(tokens[j])) continue
        const v = parseNum(tokens[j])
        if (v !== null) { journalPnl = v; break }
      }
    } else if (priceTokens.length === 1 && reasonIdx < 0) {
      journalPnl = priceTokens[0]
    }
    const isJournalRow = journalPnl !== null
    if (!isJournalRow && priceTokens.length === 0) { skipped++; continue }

    // --- angka keuangan setelah alesan ---
    const trailing: number[] = []
    if (reasonIdx >= 0) {
      for (let j = reasonIdx + 1; j < tokens.length; j++) {
        const v = parseNum(tokens[j])
        if (v !== null) trailing.push(v)
      }
    }

    // profit = angka pertama; net = profit - fee (diverifikasi, anti salah kolom)
    // Baris jurnal: PnL = angka tunggal (bukan trailing alesan)
    const profitRaw = trailing.length > 0 ? trailing[0] : (journalPnl ?? 0)
    const fee = trailing.length >= 2 ? trailing[1] : 0
    let profitLoss = profitRaw
    if (trailing.length >= 3) {
      const netCandidate = trailing[2]
      const expected = profitRaw - fee
      if (Math.abs(expected - netCandidate) <= Math.max(0.05, Math.abs(profitRaw) * 0.02)) {
        profitLoss = netCandidate // balance bergerak sesuai NET → pakai net
      }
    }

    // R multiple & durasi (menit)
    const rMultiple = trailing.length >= 4 && Math.abs(trailing[3]) <= 100 ? trailing[3] : null
    const durationMin = trailing.length >= 6
      && Number.isFinite(trailing[5]) && trailing[5] >= 0 && trailing[5] <= 60 * 24 * 365
      ? Math.round(trailing[5]) : null

    // --- open/close price ---
    // Baris jurnal tidak punya harga → 0/0 (valid sejak fix 8 Nov)
    const openPrice = isJournalRow ? 0 : priceTokens[0]
    const candidates = isJournalRow ? [] : priceTokens.slice(1)
    let closePrice = openPrice
    if (candidates.length > 0 && trailing.length > 0) {
      // Harga close = kandidat yang selisihnya dari open paling cocok dengan
      // profit (dihitung searah posisi). Jauh lebih andal daripada nebak
      // posisi kolom SL/fill/TP yang urutannya beda-beda tiap export.
      const dir = type === 'BUY' ? 1 : -1
      let best = candidates[0]
      let bestDiff = Infinity
      for (const c of candidates) {
        const implied = (c - openPrice) * dir
        const diff = Math.abs(implied - profitRaw)
        if (diff < bestDiff) { bestDiff = diff; best = c }
      }
      closePrice = best
    }

    // --- SL / TP dari kandidat harga (arah posisi jadi penentu) ---
    let stopLoss: number | null = null
    let takeProfit: number | null = null
    if (candidates.length > 0) {
      if (type === 'BUY') {
        const below = candidates.filter(c => c < openPrice)
        const above = candidates.filter(c => c > openPrice)
        stopLoss = below.length > 0 ? Math.max(...below) : null
        takeProfit = above.length > 0 ? Math.min(...above) : null
      } else {
        const above = candidates.filter(c => c > openPrice)
        const below = candidates.filter(c => c < openPrice)
        stopLoss = above.length > 0 ? Math.min(...above) : null
        takeProfit = below.length > 0 ? Math.max(...below) : null
      }
    }

    // --- waktu open/close: pasangan yang durasinya paling cocok ---
    // (file punya 2 pasang zona waktu; baris pertama bahkan urutannya
    //  kebalik — pasangan dicocokkan ke kolom durasi biar selalu benar)
    const times = dateTokens
      .map(t => { const iso = parseFlexibleDate(t); const ms = iso ? Date.parse(iso) : NaN; return { iso: iso as string | null, ms } })
      .filter(t => t.iso !== null && !isNaN(t.ms))
    let openTime = new Date().toISOString()
    let closeTime = openTime
    if (times.length >= 2) {
      let bestPair: [number, number] | null = null
      let bestDiff = Infinity
      for (let a = 0; a < times.length; a++) {
        for (let b = a + 1; b < times.length; b++) {
          if (times[b].ms <= times[a].ms) continue
          const diff = durationMin ? Math.abs((times[b].ms - times[a].ms) - durationMin * 60000) : 0
          if (diff < bestDiff) { bestDiff = diff; bestPair = [a, b] }
          if (!durationMin) break
        }
        if (!durationMin && bestPair) break
      }
      if (!bestPair && !durationMin) {
        // fallback: pasangan pertama yang urut
        for (let a = 0; a < times.length && !bestPair; a++) {
          for (let b = a + 1; b < times.length; b++) {
            if (times[b].ms > times[a].ms) { bestPair = [a, b]; break }
          }
        }
      }
      if (bestPair) {
        openTime = times[bestPair[0]].iso as string
        closeTime = times[bestPair[1]].iso as string
      }
    } else if (times.length === 1) {
      openTime = times[0].iso as string
      closeTime = openTime
    }

    // --- catatan: alesan close + timeframe ---
    const reasonPretty = reasonRaw
      ? reasonRaw.split(' ').map(w => w.charAt(0) + w.slice(1).toLowerCase()).join(' ')
      : null
    const noteParts = [reasonPretty, tf ? `TF ${tf}` : null].filter(Boolean)
    const notes = noteParts.length > 0 ? noteParts.join(' · ') : null

    trades.push({
      symbol,
      type,
      open_price: openPrice,
      close_price: closePrice,
      lot_size: priceTokens.length === 0 && isJournalRow ? 0.01 : lotSize,
      profit_loss: profitLoss,
      open_time: openTime,
      close_time: closeTime,
      session: getSessionFromHour(openTime),
      notes,
      stop_loss: stopLoss,
      take_profit: takeProfit,
      ticket_number: ticket,
      trade_duration: durationMin,
      risk_reward_ratio: rMultiple,
    })
  }

  if (skipped > 0) {
    console.log(`📊 Headerless CSV: ${trades.length} trades parsed, ${skipped} baris dilewati`)
  }

  return trades
}

// ==================== ENTRY POINT ====================
export function parseTradesFromCsv(text: string): CsvTrade[] {
  const lines = text.split(/\r?\n/).map(l => l.trim()).filter(l => l.length > 0)
  if (lines.length === 0) return []

  const delimiter = detectDelimiter(lines)
  const firstTokens = lines[0].split(delimiter).map(cleanToken)

  if (isHeaderLine(firstTokens)) {
    if (lines.length < 2) return []
    return parseWithHeader(lines, delimiter)
  }

  // Tanpa header: SEMUA baris adalah data
  return parseWithoutHeader(lines, delimiter)
}
