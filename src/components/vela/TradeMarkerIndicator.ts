/**
 * ============================================================
 * TradeMarkerIndicator — native indicator Vela "luxtradee-trade-marker"
 * ============================================================
 * FITUR: klik trade di Riwayat Trade / Jurnal / chat → chart Vela
 * menggambar:
 *   - Garis ENTRY  (biru langit, solid)  — harga open
 *   - Garis EXIT   (putih, putus-putus)  — harga close (bila ada)
 *   - Garis SL     (merah, putus-putus)  — bila data SL ada
 *   - Garis TP     (hijau, putus-putus)  — bila data TP ada
 *   - MARKER panah ▲ BUY (hijau, di bawah bar) / ▼ SELL (merah, di
 *     atas bar) tepat di candle timestamp entry — via label
 *     style 'arrowup'/'arrowdown' (xloc bar_time)
 *   - Callout teks "BUY XAUUSD @ 3312.5" di titik entry
 *
 * Instance-nya MURNI dari inputs (tanpa fetch) — highlightTradeOnChart
 * di VelaChartTerminal memasangnya dengan addNativeIndicator(type,
 * { inputs }) lalu setVisibleRange ke sekitar timestamp.
 *
 * Catatan kontrak Vela: emit digambar ULANG PENUH setiap kali dipanggil
 * (snapshot, bukan diff) — jadi setiap emit selalu memuat SEMUA garis,
 * label, dan marker milik instance ini.
 */

/** Tipe registrasi native (harus unik di katalog native). */
export const TRADE_MARKER_TYPE = 'luxtradee-trade-marker'

/** Warna garis — permintaan Bos: Entry biru/putih, SL merah, TP hijau. */
export const TRADE_LINE_COLORS = {
  entry: '#38bdf8', // biru langit
  exit: 'rgba(255,255,255,0.65)', // putih transparan
  sl: '#ef4444', // merah
  tp: '#10b981', // hijau (emerald Luxtradee)
} as const

interface TradeMarkerInputs {
  entryPrice: number
  exitPrice: number
  slPrice: number
  tpPrice: number
  timestamp: number // epoch ms (bar open time anchor)
  side: string // 'BUY' | 'SELL'
  symbol: string
  label: string
}

function parseInputs(i: Record<string, any>): TradeMarkerInputs {
  return {
    entryPrice: Number(i?.entryPrice) || 0,
    exitPrice: Number(i?.exitPrice) || 0,
    slPrice: Number(i?.slPrice) || 0,
    tpPrice: Number(i?.tpPrice) || 0,
    timestamp: Number(i?.timestamp) || 0,
    side: String(i?.side || 'BUY').toUpperCase() === 'SELL' ? 'SELL' : 'BUY',
    symbol: String(i?.symbol || '').toUpperCase(),
    label: String(i?.label || ''),
  }
}

/** Format harga ringkas utk teks marker (potong desimal berlebih). */
function fmtPrice(p: number): string {
  if (!Number.isFinite(p)) return '-'
  const abs = Math.abs(p)
  const digits = abs >= 1000 ? 2 : abs >= 10 ? 3 : 5
  return p.toFixed(digits)
}

function buildOutput(inp: TradeMarkerInputs) {
  const priceLines: any[] = []
  if (inp.entryPrice > 0) {
    priceLines.push({
      id: 'ltx-tm-entry', paneId: 'price', price: inp.entryPrice,
      color: TRADE_LINE_COLORS.entry, lineStyle: 'solid' as const, width: 2,
      title: `Entry ${inp.side} ${fmtPrice(inp.entryPrice)}`,
    })
  }
  if (inp.exitPrice > 0) {
    priceLines.push({
      id: 'ltx-tm-exit', paneId: 'price', price: inp.exitPrice,
      color: TRADE_LINE_COLORS.exit, lineStyle: 'dashed' as const, width: 1,
      title: `Exit ${fmtPrice(inp.exitPrice)}`,
    })
  }
  if (inp.slPrice > 0) {
    priceLines.push({
      id: 'ltx-tm-sl', paneId: 'price', price: inp.slPrice,
      color: TRADE_LINE_COLORS.sl, lineStyle: 'dashed' as const, width: 1,
      title: `Stop Loss ${fmtPrice(inp.slPrice)}`,
    })
  }
  if (inp.tpPrice > 0) {
    priceLines.push({
      id: 'ltx-tm-tp', paneId: 'price', price: inp.tpPrice,
      color: TRADE_LINE_COLORS.tp, lineStyle: 'dashed' as const, width: 1,
      title: `Take Profit ${fmtPrice(inp.tpPrice)}`,
    })
  }

  const labels: any[] = []
  if (inp.entryPrice > 0 && inp.timestamp > 0) {
    const isBuy = inp.side === 'BUY'
    /* MARKER panah di candle entry — ▲ di bawah bar utk BUY,
       ▼ di atas bar utk SELL (konvensi TradingView/MT4). */
    labels.push({
      id: 'ltx-tm-arrow', paneId: 'price',
      xloc: 'bar_time' as const, x: inp.timestamp,
      yloc: isBuy ? 'belowbar' : 'abovebar',
      text: '',
      style: isBuy ? 'arrowup' : 'arrowdown',
      color: isBuy ? TRADE_LINE_COLORS.tp : TRADE_LINE_COLORS.sl,
      size: 'small' as const,
      textAlign: 'center' as const,
      fontFamily: 'default' as const,
    })
    /* Callout arah+harga di titik entry. */
    const caption = `${inp.label ? inp.label + '  ' : ''}${isBuy ? '🟢 BUY' : '🔴 SELL'} ${inp.symbol} @ ${fmtPrice(inp.entryPrice)}`
    labels.push({
      id: 'ltx-tm-callout', paneId: 'price',
      xloc: 'bar_time' as const, x: inp.timestamp,
      yloc: 'price' as const, y: inp.entryPrice,
      text: caption,
      style: isBuy ? 'label_down' : 'label_up',
      color: isBuy ? 'rgba(16,185,129,0.92)' : 'rgba(239,68,68,0.92)',
      textColor: '#0b0f14',
      size: 'small' as const,
      textAlign: 'center' as const,
      fontFamily: 'default' as const,
      bold: true,
    })
  }

  return { priceLines, labels }
}

function createTradeMarkerInstance() {
  let ctx: any = null
  let inputs: TradeMarkerInputs = parseInputs({})

  const emit = () => {
    if (!ctx) return
    try {
      const { priceLines, labels } = buildOutput(inputs)
      ctx.emit({ priceLines, labels })
    } catch { /* satu emit gagal tak boleh mengguncang chart */ }
  }

  return {
    start: (c: any, i: Record<string, any>) => {
      ctx = c
      inputs = parseInputs(i)
      emit()
    },
    onBars: () => emit(),
    onViewport: () => { /* tidak tergantung viewport */ },
    setInputs: (i: Record<string, any>) => {
      inputs = parseInputs(i)
      emit()
    },
    suspend: () => { /* biarkan tergambar */ },
    resume: () => emit(),
    stop: () => { ctx = null },
  }
}

let tradeMarkerRegistered = false
/**
 * Daftarkan tipe ke katalog native Vela — WAJIB dipanggil SEBELUM
 * workspace dibuat (pola sama dengan ensureProtectedNativeRegistered).
 */
export function registerTradeMarkerNative(register: (d: any) => void): void {
  if (tradeMarkerRegistered) return
  tradeMarkerRegistered = true
  register({
    type: TRADE_MARKER_TYPE,
    title: 'Luxtradee Trade Marker',
    shortTitle: 'Trade',
    paneHint: 'price',
    overlay: true,
    multiInstance: true,
    inputsSchema: () => [
      { key: 'entryPrice', type: 'float', defval: 0, title: 'Harga Entry', visible: false },
      { key: 'exitPrice', type: 'float', defval: 0, title: 'Harga Exit', visible: false },
      { key: 'slPrice', type: 'float', defval: 0, title: 'Stop Loss', visible: false },
      { key: 'tpPrice', type: 'float', defval: 0, title: 'Take Profit', visible: false },
      { key: 'timestamp', type: 'float', defval: 0, title: 'Waktu Entry', visible: false },
      { key: 'side', type: 'text', defval: 'BUY', title: 'Arah', visible: false },
      { key: 'symbol', type: 'text', defval: '', title: 'Simbol', visible: false },
      { key: 'label', type: 'text', defval: '', title: 'Label', visible: false },
    ] as any,
    defaultInputs: () => ({ entryPrice: 0, exitPrice: 0, slPrice: 0, tpPrice: 0, timestamp: 0, side: 'BUY', symbol: '', label: '' }),
    create: createTradeMarkerInstance,
  })
}
