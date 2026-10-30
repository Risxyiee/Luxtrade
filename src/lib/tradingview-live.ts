/**
 * ============================================================
 * tradingview-live.ts — TICK REAL-TIME TradingView dari BROWSER
 * ============================================================
 * Tujuan Bos: "biar chartnya sama kayak trading view". Akar beda
 * chart kita vs TV: harga live di-overlay dari gold-api (±10 detik)
 * dan sejarah bisa dari sumber lain — level & kecepatan gerak tak
 * pernah persis TV.
 *
 * SOLUSI: browser user langsung koneksi WebSocket ke
 * wss://data.tradingview.com (sumber yang sama dengan chart TV asli).
 * IP yang dipakai = IP RUMAH USER (bukan IP datacenter Cloudflare
 * yang sering ditolak TV) → tick-per-tick level OANDA/BINANCE,
 * anchor bucket identik TradingView.
 *
 * PROTOKOL (adaptasi Apache-2.0 dari deepentropy/tvscreener
 * _websocket.py + quotes.py — attribusi wajib sesuai lisensi):
 *   - Frame    : "~m~<len>~m~<payload JSON>"
 *   - Payload  : {"m": method, "p": [params]}
 *   - Heartbeat: server kirim payload "~h~<n>" → WAJIB di-echo frame
 *   - Handshake: set_auth_token "unauthorized_user_token" →
 *                quote_create_session qs → quote_set_fields →
 *                quote_add_symbols
 *   - Data     : "qsd"/"du" → { n: session, s: "ok", v: { lp, lp_time, … } }
 *
 * GAGAL-SAFE: WS gagal / timeout 6 dtk / symbol error / koneksi putus
 * → onDown() → pemanggil menjalankan jalur polling lama (gold-api
 * overlay). Chart TIDAK PERNAH mati karena modul ini.
 *
 * CLIENT-ONLY: dipakai dari LuxtradeeProvider (komponen client).
 * Berisi 0 dependensi — WebSocket API browser bawaan.
 */

/* Simbol Luxtradee → simbol ber-prefiks TradingView.
   OANDA = spot forex/metals real-time logged-out; BINANCE = crypto. */
export const TV_SYMBOL_MAP: Record<string, string> = {
  XAUUSD: 'OANDA:XAUUSD',
  XAGUSD: 'OANDA:XAGUSD',
  US100: 'OANDA:US100USD',
  EURUSD: 'OANDA:EURUSD',
  GBPUSD: 'OANDA:GBPUSD',
  USDJPY: 'OANDA:USDJPY',
  EURGBP: 'OANDA:EURGBP',
  EURJPY: 'OANDA:EURJPY',
  GBPJPY: 'OANDA:GBPJPY',
  AUDUSD: 'OANDA:AUDUSD',
  NZDUSD: 'OANDA:NZDUSD',
  USDCAD: 'OANDA:USDCAD',
  USDCHF: 'OANDA:USDCHF',
  BTCUSDT: 'BINANCE:BTCUSDT',
  ETHUSDT: 'BINANCE:ETHUSDT',
  SOLUSDT: 'BINANCE:SOLUSDT',
  XRPUSDT: 'BINANCE:XRPUSDT',
  DOGEUSDT: 'BINANCE:DOGEUSDT',
  ADAUSDT: 'BINANCE:ADAUSDT',
  LTCUSDT: 'BINANCE:LTCUSDT',
  BNBUSDT: 'BINANCE:BNBUSDT',
  LINKUSDT: 'BINANCE:LINKUSDT',
  AVAXUSDT: 'BINANCE:AVAXUSDT',
}

const TV_WS_URL = 'wss://data.tradingview.com/socket.io/websocket'

/** Field quote yang diminta — lp & lp_time wajib; sisanya pelengkap. */
const QUOTE_FIELDS = [
  'lp', 'lp_time', 'ch', 'chp', 'volume',
  'bid', 'ask', 'open_price', 'high_price', 'low_price',
  'prev_close_price', 'current_session', 'update_mode',
]

/** Interval kanonik → detik per bar (agregasi tick → bar berjalan). */
const INTERVAL_SEC: Record<string, number> = {
  '5m': 300, '15m': 900, '30m': 1800, '1h': 3600,
  '2h': 7200, '4h': 14400, '1d': 86400, '1w': 604800,
}

export interface TVLiveBar {
  time: number // epoch MILLISECOND open bucket (kontrak OHLCV Vela)
  open: number
  high: number
  low: number
  close: number
  volume?: number
}

export interface TVLiveOptions {
  /** Simbol ber-prefiks TV, mis. "OANDA:XAUUSD" */
  tvSymbol: string
  /** Interval kanonik, mis. "5m" */
  interval: string
  onBar: (bar: TVLiveBar) => void
  /** Stream mati (gagal connect / timeout / putus / error simbol) */
  onDown?: (reason: string) => void
  /** Sinkron tick pertama (bila stream mati SEBELUM tick pertama) */
  onUp?: () => void
  /** Batas menunggu data pertama (default 6000 ms) */
  readyTimeoutMs?: number
}

/** Pecah raw WS message TV menjadi daftar payload ("~m~len~m~..."). */
export function parseTVFrames(raw: string): string[] {
  const out: string[] = []
  let pos = 0
  while (pos < raw.length) {
    const head = raw.slice(pos, pos + 8)
    const m = /^~m~(\d+)~m~/.exec(head) || /^~m~(\d+)~m~/.exec(raw.slice(pos))
    if (!m) break
    const start = pos + m[0].length
    const end = start + Number(m[1])
    if (end > raw.length) break
    out.push(raw.slice(start, end))
    pos = end
  }
  return out
}

/** Session ID ala TV: prefix + 12 huruf kecil acak. */
function tvSessionId(prefix: string): string {
  const abc = 'abcdefghijklmnopqrstuvwxyz'
  let s = ''
  for (let i = 0; i < 12; i++) s += abc[Math.floor(Math.random() * abc.length)]
  return prefix + s
}

/** Agregasi tick → bar berjalan (unit test langsung tanpa jaringan). */
export function applyTickToBar(
  cur: TVLiveBar | null,
  prevClose: number | null,
  lp: number,
  tSec: number,
  intervalSec: number,
): TVLiveBar {
  const bucketMs = Math.floor(tSec / intervalSec) * intervalSec * 1000
  if (!cur || bucketMs > cur.time) {
    // Bar baru: open = close sebelumnya bila tersedia (mirip open TV),
    // tanpa itu = tick pertama.
    const open = prevClose && prevClose > 0 ? prevClose : lp
    return { time: bucketMs, open, high: Math.max(open, lp), low: Math.min(open, lp), close: lp }
  }
  return {
    ...cur,
    close: lp,
    high: Math.max(cur.high, lp),
    low: Math.min(cur.low, lp),
  }
}

export class TVLiveStream {
  private ws: WebSocket | null = null
  private stopped = false
  private up = false
  private qs = tvSessionId('qs_')
  private cur: TVLiveBar | null = null
  private lastClose: number | null = null // close bar terakhir (seed history ATAU tick)
  private readyTimer: ReturnType<typeof setTimeout> | null = null
  private opts: TVLiveOptions

  constructor(opts: TVLiveOptions) {
    this.opts = opts
  }

  /** Seed close bar terakhir dari history (supaya open bar berjalan pas). */
  seed(prevClose: number | null): void {
    if (prevClose && prevClose > 0 && this.lastClose == null) this.lastClose = prevClose
  }

  start(): void {
    if (this.stopped || typeof WebSocket === 'undefined') { this.down('ws unavailable'); return }
    let ws: WebSocket
    try {
      ws = new WebSocket(TV_WS_URL)
    } catch (x: any) {
      this.down(String(x?.message || 'ws constructor failed'))
      return
    }
    this.ws = ws

    /* Timeout menunggu data pertama — TV menolak / jaringan macet */
    this.readyTimer = setTimeout(() => {
      if (!this.up) this.down('ready timeout')
    }, this.opts.readyTimeoutMs ?? 6000)

    ws.onopen = () => {
      this.send('set_auth_token', ['unauthorized_user_token'])
      this.send('set_locale', ['en', 'US'])
      this.send('quote_create_session', [this.qs])
      this.send('quote_set_fields', [this.qs, ...QUOTE_FIELDS])
      this.send('quote_add_symbols', [this.qs, this.opts.tvSymbol])
    }

    ws.onmessage = (ev: MessageEvent) => {
      if (this.stopped) return
      const raw = typeof ev.data === 'string' ? ev.data : ''
      if (!raw) return
      for (const payload of parseTVFrames(raw)) this.handlePayload(payload)
    }

    ws.onerror = () => { if (!this.up) this.down('ws error') }
    ws.onclose = () => { if (!this.stopped) this.down('ws closed') }
  }

  stop(): void {
    this.stopped = true
    if (this.readyTimer) { clearTimeout(this.readyTimer); this.readyTimer = null }
    try { this.ws?.close() } catch { /* diam */ }
    this.ws = null
  }

  isUp(): boolean {
    return this.up && !this.stopped
  }

  /* ---------- internal ---------- */

  private rawSend(payload: string): void {
    try { this.ws?.send(`~m~${payload.length}~m~${payload}`) } catch { /* diam */ }
  }

  private send(method: string, params: unknown[]): void {
    if (this.stopped || !this.ws || this.ws.readyState !== WebSocket.OPEN) return
    this.rawSend(JSON.stringify({ m: method, p: params }))
  }

  private handlePayload(payload: string): void {
    /* HEARTBEAT: echo persis payloadnya (WAJIB — tanpa ini TV memutus) */
    if (payload.startsWith('~h~')) { this.rawSend(payload); return }

    let msg: any
    try { msg = JSON.parse(payload) } catch { return }
    if (!msg || typeof msg.m !== 'string') return

    switch (msg.m) {
      case 'qsd':
      case 'du': {
        const d = msg.p?.[msg.m === 'qsd' ? 1 : 0]
        if (!d) return
        if (d.s === 'error') { this.down(`symbol error: ${d.errmsg ?? this.opts.tvSymbol}`); return }
        const v = d.v || {}
        const lp = Number(v.lp)
        if (!Number.isFinite(lp) || lp <= 0) return
        const ivSec = INTERVAL_SEC[this.opts.interval]
        if (!ivSec) { this.down(`interval tak didukung: ${this.opts.interval}`); return }
        const tSec = Number(v.lp_time) || Math.floor(Date.now() / 1000)
        const bucketMs = Math.floor(tSec / ivSec) * ivSec * 1000

        const bucketBaru = !this.cur || bucketMs > this.cur.time
        this.cur = applyTickToBar(bucketBaru ? null : this.cur, this.lastClose, lp, tSec, ivSec)
        this.lastClose = lp
        if (!this.up) {
          this.up = true
          if (this.readyTimer) { clearTimeout(this.readyTimer); this.readyTimer = null }
          this.opts.onUp?.()
        }
        this.opts.onBar({ ...this.cur })
        return
      }
      case 'server_error':
      case 'fatal_error':
        this.down(String(msg.p?.[0]?.errmsg || msg.m))
        return
      case 'quote_completed':
      case 'qsm':
      case 'quote_created':
      default:
        return // event pelengkap — abaikan
    }
  }

  private down(reason: string): void {
    if (this.stopped) return
    this.stopped = true
    if (this.readyTimer) { clearTimeout(this.readyTimer); this.readyTimer = null }
    try { this.ws?.close() } catch { /* diam */ }
    this.ws = null
    this.opts.onDown?.(reason)
  }
}
