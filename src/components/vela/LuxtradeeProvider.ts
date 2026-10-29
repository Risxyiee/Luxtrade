/**
 * ============================================================
 * LuxtradeeForexProvider — DataProvider untuk Vela™ yang menyajikan
 * XAUUSD / XAGUSD / major forex / US100 (Nasdaq) dari datafeed
 * Luxtradee (/api/candles — rantai spot dulu: Twelve Data
 * XAU/USD dkk via TWELVE_DATA_API_KEY, lalu Yahoo publik
 * TANPA API KEY → chart tak pernah mati 401).
 * ============================================================
 * Kenapa provider ini? Provider native bawaan Vela (Binance/
 * Coinbase/Hyperliquid) semuanya CRYPTO — tidak menyajikan XAUUSD,
 * pasangan forex, maupun indeks. Provider ini di-plug dengan
 * interface DataProvider yang SAMA seperti provider native, jadi
 * chart Vela tetap satu aplikasi penuh (symbol search,
 * multi-timeframe, live) untuk multi-asset.
 *
 * ROUTING DATAFEED (Task 42 + urutan FINAL Bos — BINANCE DIBUANG):
 *   - Forex / Gold / Silver / Nasdaq (US100) / Crypto → /api/candles
 *     (TradingView keyless → Twelve Data spot → Yahoo keyless;
 *     alias NASDAQ, NAS100, GOLD, XAU/USD, BTC, …
 *     dinormalisasi otomatis)
 *   - BINANCE PROVIDER DIBUANG (keputusan Bos) — semua simbol
 *     dilayani feed Luxtradee via /api/candles.
 *
 * Vela memanggil:
 *   getBars(ticker, timeframe, range)  → sejarah candle (wajib)
 *   subscribe(ticker, timeframe, onBar) → TICK LIVE — polling 3 detik
 *   info()                             → metadata (capabilities)
 *   listSymbols()                      → daftar simbol (symbol search)
 * LIVE (permintaan Bos — "data chart candle masih sm kek binance untuk
 * forex saya gasuka"): capabilities.stream = true + subscribe() yang
 * mempoll TAIL candle tiap 3 DETIK via /api/candles?nocache (server
 * punya micro-cache 2.5s supaya upstream tidak banjir). Hasilnya ujung
 * candle Close/High/Low bergerak dinamis layaknya websocket Binance —
 * tanpa WebSocket pun.
 */

import type {
  BarRange,
  DataProvider,
  OHLCV,
  ProviderInfo,
  SymbolDescriptor,
} from '@luxalgo/vela'
import { normalizeSymbol } from '@/lib/market/yahoo'

/* Timeframe kanonik Vela (menit, string) → format /api/candles.
   Kunci lama ('1D'/'D'/'W') tetap dihormati biar aman. */
const TF_MAP: Record<string, string> = {
  '5': '5m', '15': '15m', '30': '30m',
  '60': '1h', '120': '2h', '240': '4h',
  '1D': '1d', 'D': '1d', '1440': '1d',
  '1W': '1w', 'W': '1w', '10080': '1w',
}

const SYMBOLS: SymbolDescriptor[] = [
  { ticker: 'XAUUSD', description: 'Gold / US Dollar — Emas', type: 'forex', group: 'METALS', default: true },
  { ticker: 'XAGUSD', description: 'Silver / US Dollar — Perak', type: 'forex', group: 'METALS' },
  { ticker: 'US100', description: 'Nasdaq 100 — US Tech 100 (NASDAQ/NAS100)', type: 'index', group: 'INDICES' },
  { ticker: 'EURUSD', description: 'Euro / US Dollar', type: 'forex', group: 'MAJOR' },
  { ticker: 'GBPUSD', description: 'British Pound / US Dollar', type: 'forex', group: 'MAJOR' },
  { ticker: 'USDJPY', description: 'US Dollar / Japanese Yen', type: 'forex', group: 'MAJOR' },
  { ticker: 'EURGBP', description: 'Euro / British Pound', type: 'forex', group: 'MAJOR' },
  { ticker: 'EURJPY', description: 'Euro / Japanese Yen', type: 'forex', group: 'MAJOR' },
  { ticker: 'GBPJPY', description: 'British Pound / Japanese Yen', type: 'forex', group: 'MAJOR' },
  { ticker: 'AUDUSD', description: 'Australian Dollar / US Dollar', type: 'forex', group: 'MAJOR' },
  { ticker: 'NZDUSD', description: 'New Zealand Dollar / US Dollar', type: 'forex', group: 'MAJOR' },
  { ticker: 'USDCAD', description: 'US Dollar / Canadian Dollar', type: 'forex', group: 'MAJOR' },
  { ticker: 'USDCHF', description: 'US Dollar / Swiss Franc', type: 'forex', group: 'MAJOR' },
  // Crypto (via TradingView BINANCE:* → Yahoo BTC-USD — tanpa key, tanpa BinanceProvider)
  { ticker: 'BTCUSDT', description: 'Bitcoin / USDT', type: 'crypto', group: 'CRYPTO' },
  { ticker: 'ETHUSDT', description: 'Ethereum / USDT', type: 'crypto', group: 'CRYPTO' },
  { ticker: 'SOLUSDT', description: 'Solana / USDT', type: 'crypto', group: 'CRYPTO' },
  { ticker: 'XRPUSDT', description: 'XRP / USDT', type: 'crypto', group: 'CRYPTO' },
  { ticker: 'DOGEUSDT', description: 'Dogecoin / USDT', type: 'crypto', group: 'CRYPTO' },
  { ticker: 'ADAUSDT', description: 'Cardano / USDT', type: 'crypto', group: 'CRYPTO' },
  { ticker: 'LTCUSDT', description: 'Litecoin / USDT', type: 'crypto', group: 'CRYPTO' },
  { ticker: 'BNBUSDT', description: 'BNB / USDT', type: 'crypto', group: 'CRYPTO' },
  { ticker: 'LINKUSDT', description: 'Chainlink / USDT', type: 'crypto', group: 'CRYPTO' },
  { ticker: 'AVAXUSDT', description: 'Avalanche / USDT', type: 'crypto', group: 'CRYPTO' },
]

const SYMBOL_SET = new Set(SYMBOLS.map((s) => s.ticker))

/** Interval polling tick live (ms) — permintaan Bos: 3 detik. */
const LIVE_POLL_MS = 3000

/** Konversi epoch detik/ms campuran → epoch ms (Vela: Millis). */
function toMillis(t: number | string): number {
  const n = typeof t === 'string' ? Number(t) : t
  if (!Number.isFinite(n) || n <= 0) return Date.now()
  return n < 1e12 ? n * 1000 : n // < 1e12 ≈ sebelum 2001 dalam ms → pasti detik
}

/** Baris API { time(sec|ms|iso), open, high, low, close, volume? } → OHLCV Vela. */
function rowsToOHLCV(rows: any[]): OHLCV[] {
  const bars: OHLCV[] = (rows || [])
    .map((r) => {
      const raw = r.time ?? r.timestamp ?? r.date
      const ms = typeof raw === 'string' && !/^\d+(\.\d+)?$/.test(raw)
        ? new Date(raw).getTime()
        : toMillis(raw)
      return {
        time: ms,
        open: Number(r.open), high: Number(r.high),
        low: Number(r.low), close: Number(r.close),
        volume: r.volume != null ? Number(r.volume) : undefined,
      }
    })
    .filter((b) => Number.isFinite(b.time) && Number.isFinite(b.open) && Number.isFinite(b.close))
    .sort((a, b) => a.time - b.time)
  /* Dedup by open-time (kontrak Vela: sorted + de-duplicated) */
  const seen = new Map<number, OHLCV>()
  for (const b of bars) seen.set(b.time, b)
  return [...seen.values()]
}

export class LuxtradeeForexProvider implements DataProvider {
  /** Cache in-flight per (symbol,tf) — cegah double-fetch saat boot. */
  private inflight = new Map<string, Promise<OHLCV[]>>()

  info(): ProviderInfo {
    return {
      name: 'luxtradee',
      displayName: 'Luxtradee FX',
      capabilities: { enumerate: true, stream: true, symbolInfo: false },
    }
  }

  async listSymbols(): Promise<SymbolDescriptor[]> {
    return SYMBOLS
  }

  async getBars(ticker: string, timeframe: string, range: BarRange): Promise<OHLCV[]> {
    /* Alias diterima: NASDAQ/NAS100/USTEC→US100, GOLD/XAU→XAUUSD,
       "XAU/USD", "EUR/USD", … → simbol kanonik Luxtradee.
       (Ticker kosong TETAP ditolak — normalizeSymbol punya default
       EURUSD yang tidak boleh menyala untuk simbol tak dikenal.) */
    const raw = ticker.trim().toUpperCase()
    const clean = raw ? normalizeSymbol(raw) : ''
    if (!SYMBOL_SET.has(clean)) return [] // simbol di luar daftar → park (feed Vela yang tangani)

    const interval = TF_MAP[timeframe] || '1h'
    /* 1D/1W butuh depth lebih kecil; intraminut lebih besar (ambil 300 bar) */
    const limit = interval === '1w' ? 160 : interval === '1d' ? 300 : 300

    const key = `${clean}:${interval}`
    let p = this.inflight.get(key)
    if (!p) {
      p = this.fetchCandles(clean, interval, limit)
      this.inflight.set(key, p)
      p.finally(() => this.inflight.delete(key)).catch(() => {})
    }
    let bars = await p

    /* range.from diminta (deep history / backfill)? Vela minta window lama —
       potong sesuai permintaan bila data mencakupnya. */
    if (range?.from && bars.length) {
      const filtered = bars.filter((b) => b.time >= range.from!)
      if (filtered.length) bars = filtered
    }
    if (range?.to && bars.length) {
      const filtered = bars.filter((b) => b.time <= range.to!)
      if (filtered.length) bars = filtered
    }
    if (range?.limit && bars.length > range.limit) bars = bars.slice(-range.limit)
    return bars
  }

  private async fetchCandles(symbol: string, interval: string, limit: number): Promise<OHLCV[]> {
    const res = await fetch(`/api/candles?symbol=${encodeURIComponent(symbol)}&interval=${encodeURIComponent(interval)}&limit=${limit}&_t=${Date.now()}`, {
      headers: { accept: 'application/json' },
    })
    if (!res.ok) throw new Error(`/api/candles HTTP ${res.status}`)
    const json: any = await res.json()
    return rowsToOHLCV(Array.isArray(json?.data) ? json.data : [])
  }

  /* ============================================================
     SUBSCRIBE — TICK LIVE (polling 3 detik)
     ============================================================
     Vela memanggil ini begitu chart siap (capabilities.stream=true).
     Tiap 3 detik ambil TAIL candle (nocache → server micro-cache 2.5s)
     lalu kirim bar terakhir via onBar: ujung candle (O/H/L/C) bergerak
     live layaknya websocket Binance, dan saat bar baru terbentuk Vela
     otomatis menutup bar lama & membuka bar baru.
     Pause saat tab tersembunyi (hemat request), lanjut saat kembali. */
  subscribe(ticker: string, timeframe: string, onBar: (bar: OHLCV) => void): () => void {
    const raw = ticker.trim().toUpperCase()
    const clean = raw ? normalizeSymbol(raw) : ''
    const interval = TF_MAP[timeframe] || '1h'
    if (!SYMBOL_SET.has(clean)) return () => {} // simbol di luar daftar → tanpa live

    let stopped = false
    let timer: ReturnType<typeof setTimeout> | null = null
    let lastKey = ''

    const schedule = () => {
      if (stopped || timer) return
      if (typeof document !== 'undefined' && document.hidden) return
      timer = setTimeout(() => { timer = null; void tick() }, LIVE_POLL_MS)
    }

    const tick = async () => {
      if (stopped) return
      try {
        const res = await fetch(`/api/candles?symbol=${encodeURIComponent(clean)}&interval=${encodeURIComponent(interval)}&limit=3&nocache=true&_t=${Date.now()}`, {
          headers: { accept: 'application/json' },
          cache: 'no-store',
        })
        if (res.ok) {
          const json: any = await res.json()
          const bars = rowsToOHLCV(Array.isArray(json?.data) ? json.data : [])
          const last = bars[bars.length - 1]
          if (last) {
            const key = `${last.time}|${last.open}|${last.high}|${last.low}|${last.close}`
            if (key !== lastKey) {
              lastKey = key
              onBar(last) // forming candle ATAU bar baru tertutup — Vela paham keduanya
            }
          }
        }
      } catch { /* jaringan gagal — poll berikutnya mencoba lagi */ }
      schedule()
    }

    const onVisibility = () => {
      if (typeof document === 'undefined') return
      if (document.hidden) {
        if (timer) { clearTimeout(timer); timer = null }
      } else if (!stopped) {
        void tick() // langsung segar saat user kembali ke tab
      }
    }

    if (typeof document !== 'undefined') {
      document.addEventListener('visibilitychange', onVisibility)
    }
    void tick() // tick pertama segera (sinkron dgn sejarah yang baru dimuat)

    return () => {
      stopped = true
      if (timer) { clearTimeout(timer); timer = null }
      if (typeof document !== 'undefined') {
        document.removeEventListener('visibilitychange', onVisibility)
      }
    }
  }
}
