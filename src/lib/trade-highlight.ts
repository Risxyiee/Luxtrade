/**
 * ============================================================
 * trade-highlight — jembatan "klik Riwayat Trade → marker chart"
 * ============================================================
 * Permintaan Bos: saat user klik trade di Riwayat Trade / Jurnal /
 * chat, chart Vela harus melompat ke timestamp transaksi itu lalu
 * menggambar garis Entry (biru), Exit, SL (merah), TP (hijau) plus
 * marker panah Buy/Sell di candle terkait.
 *
 * Karena tab chart VELA di-UNMOUNT saat user pindah menu (TabContent
 * me-render kondisional), komunikasi antar-tab memakai:
 *   1. localStorage `luxtradee_highlight_trade` — pesan tersimpan
 *      (dikonsumsi saat chart mount lagi — tab berpindah otomatis)
 *   2. CustomEvent `luxtradee:highlight-trade` — pesan live (chart
 *      sudah terbuka, mis. klik trade dari AI chat)
 *
 * AMAN di client — tanpa import server.
 */

export interface TradeMarkerPayload {
  /** Harga entry (open) — garis biru + titik marker. */
  entryPrice: number
  /** Harga exit (close) — garis putih putus-putus (opsional). */
  exitPrice?: number | null
  /** Stop loss — garis merah (opsional; 0/undefined = tidak digambar). */
  slPrice?: number | null
  /** Take profit — garis hijau (opsional; 0/undefined = tidak digambar). */
  tpPrice?: number | null
  /** Waktu OPEN trade (epoch ms) — anchor marker & pusat viewport. */
  timestamp: number
  /** Arah posisi. */
  type: 'BUY' | 'SELL'
  /** Simbol trade (mis. XAUUSD) — chart otomatis pindah simbol bila beda. */
  symbol: string
  /** Label pendek di marker (mis. "#12 · Setup Breakout"). */
  label?: string
}

/** localStorage key pesan tertunda (dikonsumsi VelaChartTerminal saat mount). */
export const TRADE_HIGHLIGHT_KEY = 'luxtradee_highlight_trade'
/** CustomEvent name pesan live. */
export const TRADE_HIGHLIGHT_EVENT = 'luxtradee:highlight-trade'

/** Bentuk minimum yang dibutuhkan (Trade dari dashboard / trade card chat). */
export interface TradeLike {
  symbol: string
  type: 'BUY' | 'SELL'
  open_price: number
  close_price?: number | null
  /** Stop loss (kolom `stop_loss` tabel trades) — garis merah di chart. */
  stop_loss?: number | string | null
  /** Take profit (kolom `take_profit` tabel trades) — garis hijau di chart. */
  take_profit?: number | string | null
  open_time: string | number
  id?: string
  setup_type?: string | null
  notes?: string | null
}

/** Konversi baris trade (DB) → payload marker chart. */
export function buildTradeMarkerPayload(trade: TradeLike): TradeMarkerPayload {
  const ts = typeof trade.open_time === 'number'
    ? trade.open_time
    : new Date(trade.open_time).getTime()
  const short = /^#/.test(String(trade.id || '')) ? String(trade.id) : trade.id ? `#${String(trade.id).slice(0, 8)}` : ''
  const label = trade.setup_type
    ? `${short} · ${trade.setup_type}`.trim()
    : short
  return {
    entryPrice: Number(trade.open_price) || 0,
    exitPrice: trade.close_price != null ? Number(trade.close_price) || 0 : 0,
    /* SL (merah) & TP (hijau) — kolom stop_loss/take_profit tabel trades
       (API /api/trades select('*') sudah menyertakannya). 0/null = tidak digambar. */
    slPrice: Number(trade.stop_loss) || 0,
    tpPrice: Number(trade.take_profit) || 0,
    timestamp: Number.isFinite(ts) ? ts : Date.now(),
    type: trade.type === 'SELL' ? 'SELL' : 'BUY',
    symbol: String(trade.symbol || '').trim().toUpperCase(),
    label,
  }
}

/**
 * Simpan pesan highlight + siarkan event live.
 * Dipanggil SIAPA PUN (TradesTab, chat AI, modal detail) — chart yang
 * menangkap: kalau sedang terbuka langsung gambar; kalau tidak, pesan
 * menunggu di localStorage sampai chart dibuka lagi.
 */
export function requestTradeHighlight(payload: TradeMarkerPayload): void {
  if (typeof window === 'undefined') return
  try {
    window.localStorage.setItem(TRADE_HIGHLIGHT_KEY, JSON.stringify({ ...payload, at: Date.now() }))
  } catch { /* storage penuh / private mode — event tetap dikirim */ }
  try {
    window.dispatchEvent(new CustomEvent(TRADE_HIGHLIGHT_EVENT, { detail: payload }))
  } catch { /* diam */ }
}

/**
 * Ambil pesan tertunda. `opts.remove` (default true) menghapus pesan —
 * chart memanggil dengan remove:false dulu, lalu menghapus SETELAH
 * marker sukses digambar (pesan tidak hilang bila chart belum siap).
 */
export function consumePendingTradeHighlight(opts?: { remove?: boolean }): TradeMarkerPayload | null {
  if (typeof window === 'undefined') return null
  try {
    const raw = window.localStorage.getItem(TRADE_HIGHLIGHT_KEY)
    if (!raw) return null
    if (opts?.remove !== false) window.localStorage.removeItem(TRADE_HIGHLIGHT_KEY)
    const j = JSON.parse(raw)
    if (!j || typeof j.entryPrice !== 'number' || typeof j.timestamp !== 'number') {
      if (opts?.remove !== false) window.localStorage.removeItem(TRADE_HIGHLIGHT_KEY)
      return null
    }
    return j as TradeMarkerPayload
  } catch {
    try { window.localStorage.removeItem(TRADE_HIGHLIGHT_KEY) } catch { /* diam */ }
    return null
  }
}
