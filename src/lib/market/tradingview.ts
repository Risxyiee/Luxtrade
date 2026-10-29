/**
 * ============================================================
 * tradingview.ts — fetcher candle TradingView (websocket, keyless)
 * ============================================================
 * Sumber candle UTAMA Luxtradee (urutan FINAL Bos: TradingView →
 * TwelveData → Yahoo — BINANCE DIBUANG). Protokol websocket publik
 * TradingView (token tamu `unauthorized_user_token`) — tanpa akun,
 * tanpa API key, data grade broker (OANDA:XAUUSD, BINANCE:BTCUSDT).
 *
 * Sudah diverifikasi hidup dari infra kita: XAUUSD 1h candle masuk.
 * Syarat: koneksi wajib membawa header browser (Origin tradingview)
 * — tanpa itu server TradingView menolak 403.
 *
 * Kompatibel dua runtime:
 *  - Cloudflare Workers (produksi): fetch + header Upgrade: websocket
 *    → resp.webSocket (client websocket resmi workerd).
 *  - Bun (dev): new WebSocket(url, { headers }) (ekstensi Bun).
 *  - Node lain: WebSocket polos — kalau ditolak Origin, return null
 *    → rantai lanjut ke sumber berikutnya (tidak pernah crash).
 *
 * HANYA untuk server (API route). Tidak boleh diimpor client.
 */

import type { YahooCandle } from './yahoo'

const WS_URL = 'wss://data.tradingview.com/socket.io/websocket?from=chart%2F'
const ORIGIN = 'https://www.tradingview.com'
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36'
const ATTEMPT_TIMEOUT_MS = 9000
/* TIMEOUT ADAPTIF — series besar butuh napas lebih (Bos: 3.000–5.000
   bar per request, bukan lagi 500). Baseline 9s + 1.5s per 1000 bar,
   mentok 20s. */
const ATTEMPT_TIMEOUT_MAX_MS = 20000
function attemptTimeoutMs(count: number): number {
  return Math.min(ATTEMPT_TIMEOUT_MS + Math.floor(Math.max(count, 0) / 1000) * 1500, ATTEMPT_TIMEOUT_MAX_MS)
}

/* ---------- Simbol Luxtradee → kandidat simbol TradingView ---------- */
const CRYPTO_RE = /^(BTC|ETH|BNB|SOL|XRP|DOGE|ADA|DOT|AVAX|LINK|LTC|TRX|TON|SUI|PEPE)(USDT?|USD)$/i

const TV_SYMBOL_CANDIDATES: Record<string, string[]> = {
  'XAUUSD': ['OANDA:XAUUSD', 'FX:XAUUSD'],
  'XAGUSD': ['OANDA:XAGUSD', 'FX:XAGUSD'],
  'US100': ['OANDA:US100', 'NASDAQ:NDX', 'PEPPERSTONE:NAS100'],
}

export function tvCandidates(symbol: string): string[] {
  const s = String(symbol || '').trim().toUpperCase()
  if (!s) return []
  if (TV_SYMBOL_CANDIDATES[s]) return TV_SYMBOL_CANDIDATES[s]
  if (CRYPTO_RE.test(s)) return [`BINANCE:${s}`]
  return [`OANDA:${s}`, `FX:${s}`]
}

/* ---------- Timeframe kanonik → format TradingView ---------- */
const TV_INTERVALS: Record<string, string> = {
  '5m': '5', '15m': '15', '30m': '30', '1h': '60',
  '2h': '120', '4h': '240', '1d': '1D', '1w': '1W',
}

/* ---------- Adapter websocket lintas-runtime ---------- */
interface WSHandle {
  send(data: string): void
  close(): void
  onOpen(cb: () => void): void
  onMessage(cb: (raw: string) => void): void
  onError(cb: (e: string) => void): void
  onClose(cb: () => void): void
}

async function connectTradingView(): Promise<WSHandle> {
  const g = globalThis as any
  const isBun = typeof process !== 'undefined' && !!(process as any).versions?.bun
  const isWorkers = typeof g.WebSocketPair !== 'undefined' && !isBun

  /* Cloudflare Workers — upgrade via fetch (res.webSocket) */
  if (isWorkers && typeof fetch === 'function') {
    const resp = await fetch(WS_URL, {
      headers: { 'Upgrade': 'websocket', 'Origin': ORIGIN, 'User-Agent': UA },
    } as any)
    const ws = (resp as any).webSocket
    if (!ws) throw new Error(`TV: upgrade worker gagal (HTTP ${resp.status})`)
    ws.accept()
    return {
      send: (d: string) => ws.send(d),
      close: () => { try { ws.close() } catch { /* diam */ } },
      /* fetch-upgrade Workers: socket sudah OPEN setelah accept() */
      onOpen: (cb) => { setTimeout(cb, 0) },
      onMessage: (cb) => ws.addEventListener('message', (ev: any) => cb(String(ev?.data ?? ''))),
      onError: (cb) => ws.addEventListener('error', () => cb('worker ws error')),
      onClose: (cb) => ws.addEventListener('close', () => cb()),
    }
  }

  /* Bun / Node — global WebSocket. Bun menerima opsi { headers };
     runtime lain abaikan — kalau Origin ditolak, attempt gagal → null. */
  const WSCtor = g.WebSocket
  if (typeof WSCtor !== 'function') throw new Error('TV: runtime tanpa WebSocket')
  let ws: any
  try {
    ws = new WSCtor(WS_URL, { headers: { 'Origin': ORIGIN, 'User-Agent': UA } })
  } catch {
    ws = new WSCtor(WS_URL)
  }
  return {
    send: (d: string) => ws.send(d),
    close: () => { try { ws.close() } catch { /* diam */ } },
    onOpen: (cb) => {
      if (ws.readyState === 1) { cb(); return }
      ws.onopen = () => cb()
    },
    onMessage: (cb) => { ws.onmessage = (ev: any) => cb(String(ev?.data ?? '')) },
    onError: (cb) => { ws.onerror = (ev: any) => cb(String(ev?.message || 'ws error')) },
    onClose: (cb) => { ws.onclose = () => cb() },
  }
}

/* ---------- Protokol frame "~m~<len>~m~<json>" + heartbeat "~h~N" ---------- */
function frame(payload: string): string {
  return `~m~${payload.length}~m~${payload}`
}
function sendMsg(ws: WSHandle, m: string, ...p: unknown[]) {
  ws.send(frame(JSON.stringify({ m, p })))
}

/** Pisahkan frame raw → daftar payload JSON (heartbeat di-echo otomatis). */
function parseFrames(raw: string, ws: WSHandle): any[] {
  const out: any[] = []
  const hb = raw.match(/~h~(\d+)/)
  if (hb) ws.send(frame(`~h~${hb[1]}`)) // wajib di-echo agar koneksi hidup
  const re = /~m~(\d+)~m~/g
  let m: RegExpExecArray | null
  while ((m = re.exec(raw))) {
    const start = m.index + m[0].length
    const payload = raw.slice(start, start + Number(m[1]))
    try { out.push(JSON.parse(payload)) } catch { /* frame non-json */ }
  }
  return out
}

/* ---------- Ekstraksi bar OHLC dari payload du/timescale_update ----------
   Format nyata TradingView (terverifikasi live):
     sds_1: { s: [{i:0, v:[t,o,h,l,c,vol]}, …] }  — baris OBJEK {i,v}
   (sebagian versi memakai st / array polos — ketiganya ditangani) */
function extractBars(d: any): number[][] {
  if (!d) return []
  let rows: any[] | null = null
  if (Array.isArray(d.s)) rows = d.s
  else if (Array.isArray(d.st)) rows = d.st
  if (!rows) return []
  return rows
    .map((r: any) => (Array.isArray(r) ? r : (Array.isArray(r?.v) ? r.v : null)))
    .filter((v: any): v is number[] => Array.isArray(v))
}

/** Satu percobaan: sambungkan, minta series, kumpulkan bar sampai selesai/timeout. */
async function runOneAttempt(tvSymbol: string, tf: string, count: number): Promise<number[][] | null> {
  return await new Promise<number[][] | null>((resolve) => {
    let settled = false
    let bars: number[][] = []
    const done = (result: number[][] | null) => {
      if (settled) return
      settled = true
      clearTimeout(timer)
      try { handle?.close() } catch { /* diam */ }
      resolve(result)
    }
    const timer = setTimeout(() => done(bars.length ? bars : null), attemptTimeoutMs(count))

    let handle: WSHandle | null = null
    connectTradingView()
      .then((ws) => {
        if (settled) { try { ws.close() } catch { /* diam */ } return }
        handle = ws
        ws.onError(() => done(bars.length ? bars : null))
        ws.onClose(() => done(bars.length ? bars : null))
        ws.onMessage((raw) => {
          for (const msg of parseFrames(raw, ws)) {
            const m = msg?.m
            if (m === 'series_completed') { done(bars.length >= Math.min(count, 30) ? bars : (bars.length ? bars : null)); return }
            if (m === 'du' || m === 'timescale_update') {
              try {
                for (const key of Object.keys(msg.p?.[1] || {})) {
                  if (key.startsWith('sds_')) bars = extractBars(msg.p[1][key])
                }
              } catch { /* payload aneh — lanjut tunggu */ }
            } else if (m === 'symbol_error' || m === 'series_error' || m === 'critical_error') {
              done(null)
              return
            }
          }
        })
        /* Handshake WAJIB setelah socket OPEN (Bun: send saat CONNECTING
           → "The object is in an invalid state") */
        ws.onOpen(() => {
          sendMsg(ws, 'set_auth_token', 'unauthorized_user_token')
          sendMsg(ws, 'set_locale', 'en', 'US')
          sendMsg(ws, 'chart_create_session', 'cs_ltx1', '')
          sendMsg(ws, 'resolve_symbol', 'cs_ltx1', 'sym_1', '=' + JSON.stringify({ symbol: tvSymbol, adjustment: 'splits' }))
          sendMsg(ws, 'create_series', 'cs_ltx1', 'sds_1', 's1', 'sym_1', tf, count, '')
        })
      })
      .catch(() => done(null))
  })
}

/**
 * Ambil candle OHLC dari TradingView (keyless).
 * @returns candle bentuk LuxCandle (epoch detik) terurut naik, atau null
 *          bila semua kandidat simbol gagal — penelepon lanjut sumber berikutnya.
 */
export async function fetchTradingViewCandles(
  symbol: string,
  interval: string,
  limit = 300,
): Promise<YahooCandle[] | null> {
  const tf = TV_INTERVALS[interval]
  if (!tf) return null
  /* KEDALAMAN (Bos): sampai 5000 bar per percobaan — series websocket
     publik TV mampu; kalau server memotong, bar yang datang tetap
     dipakai (done(bars) saat timeout — tidak pernah null gara-gara
     count tidak tercapai). */
  const count = Math.min(Math.max(limit, 60), 5000)

  for (const tvSymbol of tvCandidates(symbol)) {
    try {
      const bars = await runOneAttempt(tvSymbol, tf, count)
      if (!bars || !bars.length) continue
      const out: YahooCandle[] = bars
        .map((v) => ({
          time: Math.floor(Number(v[0]) / (Number(v[0]) > 1e12 ? 1000 : 1)),
          open: Number(v[1]), high: Number(v[2]),
          low: Number(v[3]), close: Number(v[4]),
          volume: v[5] != null && Number.isFinite(Number(v[5])) ? Number(v[5]) : undefined,
        }))
        .filter((c) => Number.isFinite(c.time) && Number.isFinite(c.close) && c.close > 0)
      if (!out.length) continue
      out.sort((a, b) => a.time - b.time)
      /* Dedupe per open-time lalu ambil `limit` terakhir */
      const seen = new Map<number, YahooCandle>()
      for (const c of out) seen.set(c.time, c)
      const uniq = [...seen.values()]
      return uniq.slice(Math.max(0, uniq.length - limit))
    } catch { /* kandidat berikutnya */ }
  }
  return null
}
