/**
 * ============================================================
 * StrategyPnlIndicator — native indicator Vela "luxtradee-strategy-pnl"
 * ============================================================
 * FITUR (jawaban Bos: "buy and sell ga ada propertiesnya didalem
 * ga kaya trading view"): skrip STRATEGY Pine milik user memang
 * menggambar panah BUY/SELL via tradeMarkers bawaan Vela, TAPI
 * panah itu "telanjang" — tidak ada harga entry, tidak ada garis
 * ke exit, tidak ada PnL. TradingView menampilkan semua itu.
 *
 * Instance ini DIGERAKKAN dari luar (VelaChartTerminal):
 * setiap kali engine menyelesaikan run strategy, terminal menarik
 * daftar trade (ScriptRun.trades()) lalu memasang/memperbarui
 * instance ini via addNativeIndicator(TYPE, { inputs: { trades } }).
 *
 * Digambar per trade (ala "Trades on chart" TradingView):
 *   - Garis ENTRY → EXIT  (putus-putus; hijau profit / merah rugi;
 *     posisi masih terbuka = garis solid menjulur ke bar terakhir)
 *   - Label HARGA ENTRY di titik entry  (warna arah: hijau long / merah short)
 *   - Label PnL di titik exit  ("+23.40" / "-12.10", tebal)
 *
 * Catatan kontrak Vela: emit adalah SNAPSHOT penuh — setiap emit
 * memuat ulang SEMUA garis & label milik instance ini (bukan diff).
 * Batas 400 trade terakhir = max_lines_count/max_labels_count Pine.
 */

/** Tipe registrasi native (harus unik di katalog native). */
export const STRATEGY_PNL_TYPE = 'luxtradee-strategy-pnl'

/** Trade ringkas yang dikirim terminal → indikator (JSON di inputs). */
export interface StrategyPnlTrade {
  side: 'long' | 'short'
  entryTime: number // epoch ms (bar open time)
  entryPrice: number
  exitTime: number | null
  exitPrice: number | null
  pnl: number | null
  open: boolean
}

const WIN = '#22ab94'
const LOSS = '#ef5350'
const MAX_TRADES = 400 // Pine max_lines_count/max_labels_count

/** Format harga ringkas (potong desimal berlebih). */
function fmtPrice(p: number): string {
  if (!Number.isFinite(p)) return '-'
  const abs = Math.abs(p)
  const digits = abs >= 1000 ? 2 : abs >= 10 ? 3 : 5
  return p.toFixed(digits)
}

/** Format PnL ala TradingView: selalu bertanda, 2 desimal. */
function fmtPnl(p: number): string {
  if (!Number.isFinite(p)) return ''
  return `${p >= 0 ? '+' : '-'}${Math.abs(p).toFixed(2)}`
}

export function parseStrategyPnlTrades(raw: unknown): StrategyPnlTrade[] {
  try {
    const arr = typeof raw === 'string' ? JSON.parse(raw) : raw
    if (!Array.isArray(arr)) return []
    const out: StrategyPnlTrade[] = []
    for (const t of arr.slice(-MAX_TRADES)) {
      const entryTime = Number(t?.entryTime)
      const entryPrice = Number(t?.entryPrice)
      if (!Number.isFinite(entryTime) || !Number.isFinite(entryPrice)) continue
      const exitTimeRaw = t?.exitTime
      const exitPriceRaw = t?.exitPrice
      const pnlRaw = t?.pnl
      out.push({
        side: t?.side === 'short' ? 'short' : 'long',
        entryTime,
        entryPrice,
        exitTime: exitTimeRaw == null ? null : Number(exitTimeRaw),
        exitPrice: exitPriceRaw == null ? null : Number(exitPriceRaw),
        pnl: pnlRaw == null ? null : Number(pnlRaw),
        open: t?.open === true || exitTimeRaw == null,
      })
    }
    return out
  } catch {
    return []
  }
}

function buildOutput(trades: StrategyPnlTrade[], lastBarTime: number) {
  const lines: any[] = []
  const labels: any[] = []

  for (let i = 0; i < trades.length; i++) {
    const t = trades[i]
    const win = (t.pnl ?? 0) >= 0
    const col = t.open ? WIN : win ? WIN : LOSS
    const t1 = t.entryTime
    const isOpen = t.open || t.exitTime == null || !Number.isFinite(t.exitPrice ?? NaN)
    const t2 = isOpen ? (lastBarTime > t1 ? lastBarTime : t1 + 1) : (t.exitTime as number)
    if (!t2 || t2 < t1) continue

    /* Garis entry→exit ala trade TradingView: dotted hijau/merah,
       posisi terbuka = solid menjulur ke bar terakhir. */
    lines.push({
      id: `ltxsp-line-${i}`,
      paneId: 'price',
      xloc: 'bar_time',
      x1: t1, y1: t.entryPrice, x2: t2, y2: isOpen ? t.entryPrice : (t.exitPrice as number),
      extend: 'none',
      color: col,
      invisible: false,
      width: isOpen ? 2 : 1,
      style: isOpen ? 'solid' : 'dotted',
      arrowLeft: false,
      arrowRight: false,
    })

    /* Label harga entry di titik entry (warna arah) — "properties"
       yang diminta Bos: setiap BUY/SELL kelihatan harganya. */
    labels.push({
      id: `ltxsp-en-${i}`,
      paneId: 'price',
      xloc: 'bar_time',
      x: t1,
      yloc: 'price',
      y: t.entryPrice,
      text: fmtPrice(t.entryPrice),
      style: 'none',
      noFill: true,
      textColor: t.side === 'short' ? LOSS : WIN,
      size: 'tiny',
      textAlign: 'center',
      fontFamily: 'default',
      bold: true,
    })

    /* Label PnL di titik exit — "+23.40" / "-12.10" ala Strategy
       Tester TradingView (label TP/SL pada jalur protected). */
    if (!isOpen && t.exitPrice != null && Number.isFinite(t.exitPrice)) {
      const pnlText = t.pnl != null && Number.isFinite(t.pnl) ? fmtPnl(t.pnl) : ''
      labels.push({
        id: `ltxsp-ex-${i}`,
        paneId: 'price',
        xloc: 'bar_time',
        x: t2,
        yloc: 'price',
        y: t.exitPrice,
        text: pnlText || fmtPrice(t.exitPrice),
        style: 'none',
        noFill: true,
        textColor: col,
        size: 'tiny',
        textAlign: 'center',
        fontFamily: 'default',
        bold: true,
      })
    }
  }

  return { lines, labels }
}

function createStrategyPnlInstance() {
  let ctx: any = null
  let trades: StrategyPnlTrade[] = []

  const emit = () => {
    if (!ctx) return
    try {
      let lastBarTime = 0
      try {
        const bars = typeof ctx?.bars === 'function' ? ctx.bars() : []
        lastBarTime = bars.length ? Number(bars[bars.length - 1]?.time) : 0
      } catch { /* bars belum siap — pakai 0 */ }
      const { lines, labels } = buildOutput(trades, lastBarTime)
      ctx.emit({ ...(lines.length ? { lines } : {}), ...(labels.length ? { labels } : {}) })
    } catch { /* satu emit gagal tak boleh mengguncang chart */ }
  }

  return {
    start: (c: any, i: Record<string, any>) => {
      ctx = c
      trades = parseStrategyPnlTrades(i?.trades)
      emit()
    },
    onBars: () => emit(), // bar baru → posisi terbuka menjulur ke bar terakhir
    onViewport: () => { /* tidak tergantung viewport */ },
    setInputs: (i: Record<string, any>) => {
      trades = parseStrategyPnlTrades(i?.trades)
      emit()
    },
    suspend: () => { /* biarkan tergambar */ },
    resume: () => emit(),
    stop: () => { ctx = null },
  }
}

let strategyPnlRegistered = false
/**
 * Daftarkan tipe ke katalog native Vela — WAJIB dipanggil SEBELUM
 * workspace dibuat (pola sama dengan registerTradeMarkerNative).
 */
export function registerStrategyPnlNative(register: (d: any) => void): void {
  if (strategyPnlRegistered) return
  strategyPnlRegistered = true
  register({
    type: STRATEGY_PNL_TYPE,
    title: 'Luxtradee Strategy PnL',
    shortTitle: 'Strategy PnL',
    paneHint: 'price',
    overlay: true,
    multiInstance: true,
    inputsSchema: () => [
      { key: 'trades', type: 'text', defval: '', title: 'Trades (JSON)', visible: false },
    ] as any,
    defaultInputs: () => ({ trades: '' }),
    create: createStrategyPnlInstance,
  })
}
