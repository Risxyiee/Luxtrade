/**
 * ============================================================
 * marketListener — ALERT ENGINE Sinyal VIP Luxtradee
 * (produksi CF Workers: cron poll 15-menitan · dev/VPS: WS tick-by-tick)
 * ============================================================
 * Mendengarkan harga tick-by-tick XAU/USD dari WebSocket Twelve
 * Data, memproses ke indikator custom `evaluateCustomIndicator()`,
 * lalu menyebar Web Push Notification (Arah + Entry + SL + TP) ke
 * seluruh user PRO, dan menyimpan log sinyal ke tabel `market_alerts`.
 *
 * DUA JALUR EKSEKUSI — SATU OTAK:
 *   1. NODE (dev server / VPS)      → startMarketListener()
 *      WebSocket persisten wss://ws.twelvedata.com, tick-by-tick,
 *      auto-reconnect 5 detik. Dipanggil dari src/instrumentation.ts.
 *      ⚠️ `ws` TIDAK JALAN di runtime Cloudflare Workers (terbukti
 *      commit e4c7abc5 saat uji SDK twelvedata-node) — makanya
 *      import-nya LAZY dan hanya dieksekusi di Node runtime.
 *   2. CLOUDFLARE WORKERS (produksi) → /api/cron/vip-signals
 *      Cron 15-menitan polling harga via /api/candles (SELF binding,
 *      pola price-alerts) lalu memanggil evaluateCustomIndicator()
 *      + broadcastVipSignal() yang SAMA. Tick tidak serapat WS, tapi
 *      sinyal tetap jalan 24/7 di produksi tanpa server tambahan.
 *
 * BROADCAST (spesifikasi Sinyal VIP):
 *   Title : 🚨 Sinyal VIP Luxtradee
 *   Body  : 🟢 BUY XAU/USD @ 2025.50 | 🛑 SL: 2020.00 | 🎯 TP: 2035.00
 *           (🔴 untuk SELL)
 *   - User PRO  : profiles.is_pro = true (Supabase service-role)
 *   - Paralel   : sendPushToUser → Promise.allSettled per device
 *   - Cooldown  : 1 menit (env VIP_SIGNAL_COOLDOWN_MS) — in-memory
 *                 + cek baris terakhir market_alerts (tahan tik cron
 *                 ganda antar-isolate)
 *   - Log       : tabel market_alerts (supabase-migrations/041)
 *
 * CF-SAFE: modul ini di-import route cron di Workers → TANPA import
 * Node di level atas. Satu-satunya API Node (`ws`) di-import di dalam
 * startMarketListener() yang TIDAK PERNAH dipanggil di Workers.
 * ============================================================
 */

import { getSupabaseAdminAsync } from '@/lib/supabase-admin-alt'
import { pushToUsers } from '@/lib/push-notify'
import { isXauLikeSymbol, isXauMarketOpen } from '@/lib/market-hours'
import { kvGet, kvSet } from '@/lib/kv-cache'

/* ════════════════════════════════════════════════════════════════
   TIPE KETAT — kontrak publik engine
   ════════════════════════════════════════════════════════════════ */

/** Tick harga mentah — dari WebSocket Twelve Data ATAU poll REST cron */
export interface PriceTick {
  /** Simbol kanonik, mis. 'XAU/USD' */
  symbol: string
  /** Harga terakhir (close tick / close candle) */
  price: number
  /** Waktu tick, epoch MILI-DETIK */
  timestamp: number
  /** Perubahan harian % bila disediakan feed */
  dayChangePercent?: number
  /** Pasar buka? (forex = false saat weekend) */
  isMarketOpen?: boolean
  /** asal tick: 'ws' = listener Node, 'poll' = cron REST (Workers) */
  source: 'ws' | 'poll' | 'demo'
}

/**
 * Kontrak ketat hasil indikator custom — TIDAK BOLEH diubah.
 * `evaluateCustomIndicator()` WAJIB mengembalikan bentuk ini.
 */
export interface SignalPayload {
  /** true = ada sinyal valid → broadcast ke seluruh user PRO */
  isTriggered: boolean
  /** Arah posisi */
  action: 'BUY' | 'SELL'
  /** Harga entry yang disarankan */
  entryPrice: number
  /** Stop loss (BUY: < entry, SELL: > entry) */
  sl: number
  /** Take profit (BUY: > entry, SELL: < entry) */
  tp: number
}

export interface VipBroadcastResult {
  /** true = sinyal diteruskan ke pipeline push (terlepas dari jumlah penerima) */
  sent: boolean
  skipped?: 'cooldown' | 'rearm' | 'disabled' | 'no-supabase' | 'db-error' | 'invalid-levels' | 'market-closed'
  /** Jumlah user PRO yang ≥1 push-nya sukses terkirim */
  receivers?: number
  /** Jumlah user PRO yang gagal kirim (subscription error, dsb.) */
  failed?: number
  error?: string
  /** id baris market_alerts yang tercipta */
  alertId?: string
}

export type ListenerState =
  | 'no-key'      // TWELVE_DATA_API_KEY tidak ada → mode cron REST saja
  | 'idle'        // belum/berhenti jalan (mis. runtime bukan Node)
  | 'connecting'
  | 'open'
  | 'reconnecting'
  | 'stopped'

/* ════════════════════════════════════════════════════════════════
   KONFIGURASI
   ════════════════════════════════════════════════════════════════ */

/** Simbol yang didengarkan — spesifikasi Bos: XAU/USD (gold spot) */
export const VIP_SYMBOLS = ['XAU/USD'] as const

const TWELVE_DATA_WS_URL = 'wss://ws.twelvedata.com/v1/quotes/price'
const RECONNECT_DELAY_MS = 5_000

/** Cooldown antar sinyal (anti-spam). Default 1 menit sesuai spesifikasi. */
export const VIP_SIGNAL_COOLDOWN_MS = Math.max(
  5_000,
  Number(process.env.VIP_SIGNAL_COOLDOWN_MS || 60_000) || 60_000
)

/** Re-arm: sinyal SEARAH yang sama untuk simbol sama maks 1× per window
 *  (default 4 jam) — cross yang sama tak boleh spam cron 15-menitan.
 *  Arah BERLAWANAN (cross balik) tetap langsung boleh lewat. */
export const VIP_SIGNAL_REARM_MS = Math.max(
  VIP_SIGNAL_COOLDOWN_MS,
  Number(process.env.VIP_SIGNAL_REARM_MS || 4 * 60 * 60_000) || 4 * 60 * 60_000
)

/** Jeda minimal antar sinyal APA PUN (arah apa pun). Default 45 menit
 *  (= 3 tik cron 15-menit, senada gerbang bar-basi di route cron).
 *  Re-arm 4 jam HANYA menahan arah sama — arah berlawanan lolos langsung.
 *  Tanpa jeda global ini, cross bolak-balik (pasar choppy / data basi)
 *  bisa ping-pong BUY→SELL→BUY tiap tik cron (kasus nyata: Minggu
 *  2026-11-08, pasar TUTUP, BUY 10:00 WIB → SELL 10:30 WIB). */
export const VIP_SIGNAL_MIN_GAP_MS = Math.max(
  VIP_SIGNAL_COOLDOWN_MS,
  Number(process.env.VIP_SIGNAL_MIN_GAP_MS || 45 * 60_000) || 45 * 60_000
)

/** Kill-switch darurat: VIP_SIGNALS_ENABLED=false mematikan broadcast */
function signalsEnabled(): boolean {
  return String(process.env.VIP_SIGNALS_ENABLED ?? 'true').toLowerCase() !== 'false'
}

/** Throttle log "pasar tutup" — jalur WS kirim tick per detik; log tiap
 *  tick akan membanjiri output. Cukup 1× per 10 menit. */
let lastMarketClosedLogAt = 0
function logMarketClosedOnce(symbol: string): void {
  const now = Date.now()
  if (now - lastMarketClosedLogAt < 10 * 60_000) return
  lastMarketClosedLogAt = now
  log(`sinyal ${symbol} DITAHAN — pasar XAU tutup (kalender New York: Jumat 17:00 ET → Minggu 18:00 ET + jeda harian 17:00–17:59 ET)`)
}

/** XAU/USD tampil 2 desimal */
const fmt = (n: number): string => Number(n).toFixed(2)

/* ════════════════════════════════════════════════════════════════
   🧠 OTAK SINYAL — evaluateCloses (murni & stateless) + wrapper WS
   ════════════════════════════════════════════════════════════════ */

/** Buffer tick terakhir per simbol — bahan jalur WS (Node) */
const tickBuffers = new Map<string, number[]>()
const TICK_BUFFER_MAX = 600

function pushTick(symbol: string, price: number): number[] {
  let buf = tickBuffers.get(symbol)
  if (!buf) { buf = []; tickBuffers.set(symbol, buf) }
  buf.push(price)
  if (buf.length > TICK_BUFFER_MAX) buf.splice(0, buf.length - TICK_BUFFER_MAX)
  return buf
}

/** EMA (exponential moving average) seri — indeks terakhir = terbaru */
export function emaSeries(values: number[], period: number): number[] {
  if (values.length < period) return []
  const k = 2 / (period + 1)
  const out: number[] = []
  let prev = values.slice(0, period).reduce((a, b) => a + b, 0) / period // SMA seed
  out.push(prev)
  for (let i = period; i < values.length; i++) {
    prev = values[i] * k + prev * (1 - k)
    out.push(prev)
  }
  return out
}

/** RSI (Wilder) seri — indeks terakhir = terbaru; flat series → 50 */
export function rsiSeries(values: number[], period: number): number[] {
  if (values.length <= period) return []
  let gain = 0
  let loss = 0
  for (let i = 1; i <= period; i++) {
    const d = values[i] - values[i - 1]
    if (d >= 0) gain += d
    else loss -= d
  }
  let avgG = gain / period
  let avgL = loss / period
  const out: number[] = []
  const wilder = (g: number, l: number): number =>
    l === 0 ? 100 : 100 - 100 / (1 + g / l)
  out.push(wilder(avgG, avgL))
  for (let i = period + 1; i < values.length; i++) {
    const d = values[i] - values[i - 1]
    avgG = (avgG * (period - 1) + Math.max(d, 0)) / period
    avgL = (avgL * (period - 1) + Math.max(-d, 0)) / period
    out.push(wilder(avgG, avgL))
  }
  return out
}

/* Strategi default (GANTI BEBAS — cukup edit fungsi ini):
   ─ Sinyal = CROSS EVENT EMA9 × EMA21 (golden → BUY, death → SELL).
     Karena mendeteksi PERISTIWA (bukan level), sinyal LANGKA — tidak
     menembak berulang selama tren, cocok untuk cron 15-menitan yang
     isolatenya selalu baru (tanpa memori antar-run).
   ─ Filter RSI14: BUY dibatalkan saat overbought (RSI ≥ 72), SELL
     dibatalkan saat oversold (RSI ≤ 28) — jangan kejar ujung gerak.
   ─ Level: SL 0,30% dari entry, TP 0,90% (risk:reward 1:3) — wajar
     untuk scalping XAU/USD timeframe 15m.
   Butuh ≥ 30 close (EMA21 + RSI14 + ruang cross). */
const MIN_CLOSES = 30
const SL_PCT = 0.003
const TP_PCT = 0.009

/**
 * 🧠 OTAK SINYAL — murni, stateless, dipakai BERSAMA jalur WS (Node)
 * dan jalur cron REST (Cloudflare Workers). `closes` = urut LAMA→BARU.
 *
 * Bos bisa mengganti isi fungsi ini kapan saja dengan rumus pribadi —
 * kontrak return tetap SignalPayload dan guard `signalLevelsValid`
 * tetap menjaga notif sampah tidak lolos.
 */
export function evaluateCloses(
  symbol: string,
  closes: number[],
  lastPrice?: number
): SignalPayload {
  const price = Number.isFinite(lastPrice) && Number(lastPrice) > 0
    ? Number(lastPrice)
    : closes[closes.length - 1]
  const blank = (): SignalPayload => ({
    isTriggered: false, action: 'BUY', entryPrice: price || 0, sl: 0, tp: 0,
  })
  if (!closes.length || closes.length < MIN_CLOSES || !Number.isFinite(price) || price <= 0) {
    return blank()
  }

  const e9 = emaSeries(closes, 9)
  const e21 = emaSeries(closes, 21)
  const rsi = rsiSeries(closes, 14)
  if (e9.length < 2 || e21.length < 2 || !rsi.length) return blank()

  const i = e9.length - 1
  const j = e21.length - 1
  const r = rsi[rsi.length - 1]
  if (!Number.isFinite(r)) return blank()

  // Kedua seri EMA berakhir di bar yang sama (close terakhir) →
  // prev = selisih di bar kedua-terakhir, curr = di bar terakhir.
  const e21Prev = e21[j - 1] ?? e21[j]
  const prevDiff = e9[i - 1] - e21Prev
  const currDiff = e9[i] - e21[j]

  const round2 = (n: number): number => Number(n.toFixed(2))

  // Golden cross + tidak overbought → BUY
  if (prevDiff <= 0 && currDiff > 0 && r < 72) {
    return {
      isTriggered: true,
      action: 'BUY',
      entryPrice: round2(price),
      sl: round2(price * (1 - SL_PCT)),
      tp: round2(price * (1 + TP_PCT)),
    }
  }
  // Death cross + tidak oversold → SELL
  if (prevDiff >= 0 && currDiff < 0 && r > 28) {
    return {
      isTriggered: true,
      action: 'SELL',
      entryPrice: round2(price),
      sl: round2(price * (1 + SL_PCT)),
      tp: round2(price * (1 - TP_PCT)),
    }
  }
  return blank()
}

/**
 * Jalur WS (Node): per tick → push ke buffer → jalankan otak yang
 * SAMA (evaluateCloses) di atas isi buffer + gerbang arah anti-whipsaw
 * (tidak menembak dua kali berurutan dengan arah sama — menghitung
 * cross event pada tick mentah bisa bolak-balik dalam satu bar).
 * Fungsi ini TIDAK dipakai jalur cron (Workers) — di sana route
 * memanggil evaluateCloses langsung dengan closes candle 15m.
 */
let lastFiredAction: 'BUY' | 'SELL' | null = null

export function evaluateCustomIndicator(tick: PriceTick): SignalPayload {
  const buf = pushTick(tick.symbol, tick.price)
  const signal = evaluateCloses(tick.symbol, buf, tick.price)
  if (signal.isTriggered) {
    if (signal.action === lastFiredAction) return noSignal(tick)
    lastFiredAction = signal.action
  }
  return signal
}

/** Sinyal kosong yang tetap memenuhi kontrak tipe */
export function noSignal(tick: PriceTick): SignalPayload {
  return { isTriggered: false, action: 'BUY', entryPrice: tick.price, sl: 0, tp: 0 }
}

/** Guard kewajaran level SL/TP sebelum notif disebar ke user PRO */
export function signalLevelsValid(s: SignalPayload): boolean {
  if (!Number.isFinite(s.entryPrice) || s.entryPrice <= 0) return false
  if (!Number.isFinite(s.sl) || s.sl <= 0) return false
  if (!Number.isFinite(s.tp) || s.tp <= 0) return false
  if (s.action === 'BUY') return s.sl < s.entryPrice && s.tp > s.entryPrice
  return s.tp < s.entryPrice && s.sl > s.entryPrice
}

/* ════════════════════════════════════════════════════════════════
   BROADCAST — Web Push ke seluruh user PRO + log market_alerts
   ════════════════════════════════════════════════════════════════ */

let lastBroadcastAt = 0
let missingTableWarned = false

/** Cooldown aktif? Cek in-memory (cepat) + baris terakhir DB (tahan tik ganda
 *  antar-isolate). Re-arm: arah SAMA untuk simbol sama ditahan lebih lama
 *  (default 4 jam) — arah berlawanan tidak terpengaruh. */
async function isCooldownActive(
  admin: NonNullable<Awaited<ReturnType<typeof getSupabaseAdminAsync>>>,
  symbol: string,
  action: 'BUY' | 'SELL'
): Promise<boolean> {
  if (lastBroadcastAt && Date.now() - lastBroadcastAt < VIP_SIGNAL_COOLDOWN_MS) return true
  try {
    const { data, error } = await admin
      .from('market_alerts')
      .select('created_at, action, symbol')
      .order('created_at', { ascending: false })
      .limit(1)
    if (!error && data?.[0]?.created_at) {
      const t = new Date(String(data[0].created_at)).getTime()
      if (Number.isFinite(t)) {
        const age = Date.now() - t
        if (age < VIP_SIGNAL_COOLDOWN_MS) return true
        // Jeda global: sinyal apa pun (arah apa pun) max 1× per 30 menit —
        // tameng ping-pong BUY↔SELL saat cross noise/basi.
        if (age < VIP_SIGNAL_MIN_GAP_MS) return true
        if (String(data[0].symbol) === symbol && String(data[0].action) === action && age < VIP_SIGNAL_REARM_MS) return true
      }
    }
  } catch { /* DB belum siap → biarkan lewat, jangan blok sinyal */ }
  return false
}

/**
 * Sebar sinyal VIP ke seluruh user PRO + simpan log ke market_alerts.
 * Dipakai dari jalur WS maupun jalur cron — cooldown & guard level
 * berlaku di kedua jalur.
 *
 * opts.demo=true → judul diawali 🧪 [TES] (verifikasi pipeline tanpa
 * menipu user PRO dengan sinyal palsu).
 */
export async function broadcastVipSignal(
  signal: SignalPayload,
  tick: PriceTick,
  opts?: { demo?: boolean }
): Promise<VipBroadcastResult> {
  if (!signalsEnabled()) return { sent: false, skipped: 'disabled' }
  if (!signalLevelsValid(signal)) {
    return { sent: false, skipped: 'invalid-levels' }
  }
  /* GERBANG TERAKHIR — kalender pasar New York (lapisan ke-3):
     1) route cron vip-signals sudah menahan evaluasi saat tutup;
     2) jalur WS (Node) menahan di handleWsMessage;
     3) DI SINI — corong final sebelum push, melindungi SEMUA jalur
        (termasuk demo tanpa sadar dipanggil saat weekend) dari notif
        "sinyal XAU" yang tidak bisa ditrade karena pasar tutup
        (keluhan Bos 8 Nov 2026: notif sel XAU pasaran tutup).
        demo=true TETAP lolos — gerbang ini untuk sinyal LIVE. */
  if (!opts?.demo && isXauLikeSymbol(tick.symbol) && !isXauMarketOpen(new Date(tick.timestamp || Date.now()))) {
    logMarketClosedOnce(tick.symbol)
    return { sent: false, skipped: 'market-closed' }
  }

  const admin = await getSupabaseAdminAsync()
  if (!admin) return { sent: false, skipped: 'no-supabase' }

  if (await isCooldownActive(admin, tick.symbol, signal.action)) return { sent: false, skipped: 'cooldown' }

  const emoji = signal.action === 'BUY' ? '🟢' : '🔴'
  const payload = {
    title: opts?.demo ? '🧪 [TES] Sinyal VIP Luxtradee' : '🚨 Sinyal VIP Luxtradee',
    body: `${emoji} ${signal.action} ${tick.symbol} @ ${fmt(signal.entryPrice)} | 🛑 SL: ${fmt(signal.sl)} | 🎯 TP: ${fmt(signal.tp)}`,
    icon: '/icon-192x192.png',
    tag: opts?.demo ? 'vip-signal-demo' : 'vip-signal',
    type: 'trade' as const,
    url: '/',
    urgency: 'high' as const,
  }

  // 1) Seluruh user PRO (service-role, RLS bypass)
  const { data: pros, error: proErr } = await admin
    .from('profiles')
    .select('id')
    .eq('is_pro', true)
    .limit(1000)
  if (proErr) return { sent: false, skipped: 'db-error', error: proErr.message }

  const ids = ((pros ?? []) as { id: string }[]).map((r) => String(r.id)).filter(Boolean)

  let receivers = 0
  let failed = 0
  if (ids.length) {
    // 2) Kirim per user — sendPushToUser di dalamnya pakai
    //    Promise.allSettled per device + buang endpoint 410/404.
    const results = await pushToUsers(
      admin,
      ids,
      payload,
      { delayMs: 50, dedupe: false }
    )
    receivers = results.filter((r) => r.sent > 0).length
    failed = results.filter((r) => r.sent === 0 && r.skipped !== 'no-subs').length
  }

  // 3) Log sinyal (action, entry, sl, tp) — WAJIB sesuai spesifikasi
  let alertId: string | undefined
  try {
    const { data: ins, error: insErr } = await admin
      .from('market_alerts')
      .insert({
        symbol: tick.symbol,
        action: signal.action,
        entry_price: signal.entryPrice,
        sl: signal.sl,
        tp: signal.tp,
        trigger_price: tick.price,
        source: tick.source === 'ws' ? 'ws-listener' : tick.source,
        broadcast_count: receivers,
      })
      .select('id')
    if (insErr && !missingTableWarned) {
      missingTableWarned = true
      console.warn('[vip-signal] market_alerts gagal (jalankan supabase-migrations/041_market_alerts.sql):', insErr.message)
    }
    alertId = Array.isArray(ins) && ins[0]?.id ? String(ins[0].id) : undefined
  } catch { /* log best-effort — push utama sudah terkirim */ }

  lastBroadcastAt = Date.now()
  console.log(
    `[vip-signal] ${signal.action} ${tick.symbol} @ ${fmt(signal.entryPrice)} ` +
    `SL ${fmt(signal.sl)} TP ${fmt(signal.tp)} → ${receivers} user PRO${failed ? `, ${failed} gagal` : ''}`
  )

  /* FREEMIUM BARU — user FREE dapat sinyal yang SAMA dengan jeda satu
     siklus cron (±15–30 menit). Antrian di KV lintas-isolate; cron
     15-menitan berikutnya (flushDueFreeSignals) yang menge-drop ke
     user free. demo TIDAK diantrikan — sinyal palsu tak boleh sampai
     ke user mana pun. CATATAN COPY: jangan janjikan kecepatan di
     notifikasi (amanat Bos — tunggu terbukti dulu). */
  if (!opts?.demo) {
    try {
      await enqueueFreeSignal(payload)
    } catch (err) {
      console.warn('[vip-signal] antrian free gagal (non-fatal):', err instanceof Error ? err.message : err)
    }
  }

  return { sent: true, receivers, failed, alertId }
}

/* ════════════════════════════════════════════════════════════════
   TIER FREE — SINYAL TUNDA SATU SIKLUS CRON (antrian KV lintas-isolate)
   ════════════════════════════════════════════════════════════════
   broadcastVipSignal() mengantrikan payload sinyal + due = now+15m.
   /api/cron/vip-signals (slot cron 15-menitan yang sudah ada) memanggil
   flushDueFreeSignals() di awal tiap run → sinyal jatuh tempo di-push
   ke seluruh user free. Tanpa KV (dev tanpa binding) semua no-op aman.
   Sinyal basi (>45 mnt) atau masuk saat pasar tutup → DIBUANG, bukan
   ditunda — sama seperti gerbang "bar basi" user PRO (keluhan Bos:
   notifikasi sinyal saat pasar tutup tak bisa ditrade). */

const FREE_Q_KEY = 'vip-free-q'
const FREE_SIG_PREFIX = 'vip-free-sig:'
const FREE_DELAY_MS = 15 * 60_000
const FREE_SIG_TTL_SEC = 2 * 3600 // KV TTL item & antrian: 2 jam
const FREE_SIG_MAX_AGE_MS = 45 * 60_000 // lebih tua = basi, buang
const FREE_Q_MAX_ITEMS = 20 // batas aman antrian (15-menitan, jarang >1)

interface FreeSignalItem {
  k: string
  due: number
}

interface FreeSignalPayload {
  title: string
  body: string
  icon: string
  tag: string
  type: string
  url: string
  urgency: string
  created: number
}

/** Antrikan payload sinyal untuk tier free — due sekarang + 15 menit. */
async function enqueueFreeSignal(payload: {
  title: string
  body: string
  icon: string
  tag: string
  type: string
  url: string
  urgency: string
}): Promise<void> {
  const now = Date.now()
  const item: FreeSignalPayload = { ...payload, created: now }
  const key = `${FREE_SIG_PREFIX}${now}`

  const saved = await kvSet(key, item, { ttl: FREE_SIG_TTL_SEC })
  if (!saved) return // KV tidak tersedia (dev) — tier free skip diam

  const q = (await kvGet<{ items: FreeSignalItem[] }>(FREE_Q_KEY))?.items ?? []
  q.push({ k: key, due: now + FREE_DELAY_MS })
  // Cap antrian: buang tertua (kron 15-menitan praktis tak pernah
  // menumpuk — cooldown global 30 menit membatasi laju sinyal)
  while (q.length > FREE_Q_MAX_ITEMS) q.shift()
  await kvSet(FREE_Q_KEY, { items: q }, { ttl: FREE_SIG_TTL_SEC })
  console.log(`[vip-signal] antrian free +1 (due ${new Date(now + FREE_DELAY_MS).toISOString()})`)
}

/**
 * Kirim semua sinyal free yang jatuh tempo ke seluruh user free.
 * Dipanggil di awal tiap run /api/cron/vip-signals. Semua kegagalan
 * non-fatal — jalur sinyal PRO TIDAK boleh terganggu.
 */
export async function flushDueFreeSignals(): Promise<{
  flushed: number
  dropped: number
  receivers: number
}> {
  const q = (await kvGet<{ items: FreeSignalItem[] }>(FREE_Q_KEY))?.items ?? []
  if (q.length === 0) return { flushed: 0, dropped: 0, receivers: 0 }

  const now = Date.now()
  const due = q.filter((i) => i.due <= now)
  const keep = q.filter((i) => i.due > now)
  if (due.length === 0) return { flushed: 0, dropped: 0, receivers: 0 }

  /* Pasar tutup → sinyal tak bisa ditrade: buang semua yang jatuh
     tempo (jangan ditunda sampai Senin — basi). */
  if (!isXauMarketOpen()) {
    await kvSet(FREE_Q_KEY, { items: keep }, { ttl: FREE_SIG_TTL_SEC })
    return { flushed: 0, dropped: due.length, receivers: 0 }
  }

  const admin = await getSupabaseAdminAsync()
  if (!admin) return { flushed: 0, dropped: 0, receivers: 0 } // item tinggal — dicoba run berikutnya

  // User free = profile TANPA is_pro (null maupun false) — filter di JS
  // karena `neq` PostgREST meng-exclude baris NULL.
  const { data: profiles, error } = await admin
    .from('profiles')
    .select('id, is_pro')
    .limit(2000)
  if (error) {
    console.warn('[vip-signal] flush free: query profiles gagal:', error.message)
    return { flushed: 0, dropped: 0, receivers: 0 }
  }
  const freeIds = ((profiles ?? []) as { id: string; is_pro: boolean | null }[])
    .filter((p) => !p.is_pro)
    .map((p) => String(p.id))

  let flushed = 0
  let dropped = 0
  let receivers = 0

  for (const item of due) {
    const sig = await kvGet<FreeSignalPayload>(item.k)
    // Item hilang dari KV (expired/evicted) ATAU basi >45 mnt → buang
    if (!sig || now - sig.created > FREE_SIG_MAX_AGE_MS) {
      dropped++
      continue
    }

    if (freeIds.length) {
      const results = await pushToUsers(
        admin,
        freeIds,
        {
          /* Laporan Bos: "jangan janjiin sinyal masuk realtime — belum
             pernah nyoba, nunggu dulu". Jadi TANPA janji kecepatan
             apa pun: label cuma menjelaskan status tier free
             (tertunda — faktanya memang di-drop cron berikutnya),
             tanpa klaim "Pro real-time" dan tanpa hook promo. */
          title: (sig.title || '📈 Sinyal Luxtradee') + ' (Gratis · tertunda)',
          body: sig.body,
          icon: sig.icon || '/icon-192x192.png',
          tag: 'vip-signal-free',
          type: 'trade' as const,
          url: sig.url || '/',
          urgency: 'normal' as const,
        },
        { delayMs: 50, dedupe: false }
      )
      const ok = results.filter((r) => r.sent > 0).length
      receivers += ok
      console.log(`[vip-signal] flush free: "${sig.title}" → ${ok} user free`)
    }
    flushed++
  }

  // Tulis balik antrian tanpa item yang sudah diproses
  await kvSet(FREE_Q_KEY, { items: keep }, { ttl: FREE_SIG_TTL_SEC })
  return { flushed, dropped, receivers }
}

/* ════════════════════════════════════════════════════════════════
   JALUR 1 — WEBSOCKET LISTENER (Node.js saja: dev server / VPS)
   ════════════════════════════════════════════════════════════════ */

interface ListenerRuntime {
  ws: { close: () => void } | null
  state: ListenerState
  startedAt: number
  lastTickAt: number
  reconnects: number
  ticks: number
  lastError: string
  reconnectTimer: ReturnType<typeof setTimeout> | null
}

/** Singleton di globalThis — aman terhadap hot-reload Next dev */
function runtime(): ListenerRuntime {
  const g = globalThis as unknown as { __vipMarketListener?: ListenerRuntime }
  if (!g.__vipMarketListener) {
    g.__vipMarketListener = {
      ws: null, state: 'idle', startedAt: Date.now(),
      lastTickAt: 0, reconnects: 0, ticks: 0, lastError: '', reconnectTimer: null,
    }
  }
  return g.__vipMarketListener
}

const log = (...a: unknown[]): void => console.log('[market-listener]', ...a)

/** Event dari WS Twelve Data (bentuk sesuai dokumen resmi) */
interface TdMessage {
  event?: string
  symbol?: string
  price?: number | string
  timestamp?: number
  day_change_percent?: string | number
  isMarketOpen?: boolean
  status?: string
  message?: string
}

function handleWsMessage(rt: ListenerRuntime, raw: string): void {
  let msg: TdMessage
  try { msg = JSON.parse(raw) as TdMessage } catch { return }

  if (msg.event === 'subscribe-status') {
    if (msg.status === 'ok') log('subscribe OK →', VIP_SYMBOLS.join(','))
    else {
      rt.lastError = String(msg.message || 'subscribe-status error')
      console.error('[market-listener] subscribe DITOLAK Twelve Data:', rt.lastError,
        '(cek plan/kunci WS di dashboard Twelve Data — cron REST tetap jalan)')
    }
    return
  }

  if (msg.event === 'price') {
    const price = Number(msg.price)
    if (!Number.isFinite(price) || price <= 0) return
    const ts = Number(msg.timestamp)
    const tick: PriceTick = {
      symbol: String(msg.symbol || VIP_SYMBOLS[0]),
      price,
      timestamp: Number.isFinite(ts) && ts > 0 ? ts * 1000 : Date.now(),
      dayChangePercent: msg.day_change_percent != null ? Number(msg.day_change_percent) : undefined,
      isMarketOpen: msg.isMarketOpen,
      source: 'ws',
    }
    rt.ticks++
    rt.lastTickAt = Date.now()

    // ── GERBANG PASAR TUTUP (hemat CPU + tanpa sinyal basi):
    //    Twelve Data mengirim isMarketOpen=false saat weekend/rollover,
    //    dan kalender New York sebagai cadangan bila flag tak dikirim.
    //    Evaluasi indikator TIDAK jalan atas data beku — cross palsu
    //    tidak boleh tercipta sejak awal (lapisan 2 dari 3). ──
    if (tick.isMarketOpen === false || (isXauLikeSymbol(tick.symbol) && !isXauMarketOpen(new Date(tick.timestamp)))) {
      logMarketClosedOnce(tick.symbol)
      return
    }

    // ── OTAK: indikator custom Bos ──
    let signal: SignalPayload
    try { signal = evaluateCustomIndicator(tick) } catch (e) {
      rt.lastError = `indikator error: ${e instanceof Error ? e.message : String(e)}`
      console.error('[market-listener] evaluateCustomIndicator error:', rt.lastError)
      return
    }
    if (!signal.isTriggered) return

    // ── AKSI: broadcast + log (cooldown & guard di dalam) ──
    broadcastVipSignal(signal, tick)
      .then((r) => {
        if (!r.sent && r.skipped) log('sinyal dilewati:', r.skipped)
      })
      .catch((e) => console.error('[market-listener] broadcast error:', e?.message || e))
  }
}

interface WsLike {
  on: (ev: string, cb: (...args: never[]) => void) => void
  send: (data: string) => void
  close: () => void
}

/**
 * Mulai WebSocket listener (Node runtime SAJA). Idempoten — panggil
 * berulang aman. Tanpa TWELVE_DATA_API_KEY → state 'no-key' (mode
 * cron REST di produksi tetap bekerja tanpa listener ini).
 */
export async function startMarketListener(): Promise<void> {
  const rt = runtime()
  if (rt.ws || rt.state === 'connecting' || rt.state === 'open' || rt.state === 'reconnecting') return

  // 1) Hanya Node — di CF Workers `ws` mustahil jalan (workerd tanpa net/tls)
  const isNode =
    typeof process !== 'undefined' &&
    !!process.versions &&
    String((process.versions as Record<string, string>).node || '') !== ''
  if (!isNode) { rt.state = 'idle'; return }

  // 2) Kunci API Twelve Data
  const key = String(process.env.TWELVE_DATA_API_KEY || '').trim()
  if (!key) {
    rt.state = 'no-key'
    log('TWELVE_DATA_API_KEY kosong → listener IDLE. Sinyal tetap jalan via cron REST (/api/cron/vip-signals).')
    return
  }

  rt.state = 'connecting'
  try {
    // LAZY import — modul Node `ws` tidak boleh menyentuh bundle Workers
    const wsMod = await import('ws')
    const Ctor = (wsMod as unknown as { default?: unknown }).default ?? wsMod
    const ws = new (Ctor as new (url: string) => WsLike)(
      `${TWELVE_DATA_WS_URL}?apikey=${encodeURIComponent(key)}`
    )
    rt.ws = ws

    ws.on('open', () => {
      rt.state = 'open'
      log(`terhubung → subscribe ${VIP_SYMBOLS.join(',')}`)
      try {
        ws.send(JSON.stringify({ action: 'subscribe', params: { symbols: VIP_SYMBOLS.join(',') } }))
      } catch (e) {
        rt.lastError = `subscribe send gagal: ${e instanceof Error ? e.message : String(e)}`
      }
    })

    ws.on('message', ((raw: unknown) => {
      try { handleWsMessage(rt, String(raw)) } catch { /* pesan rusak → abaikan */ }
    }) as never)

    ws.on('error', ((err: Error) => {
      rt.lastError = String(err?.message || err)
      console.warn('[market-listener] ws error:', rt.lastError)
    }) as never)

    ws.on('close', (() => {
      rt.ws = null
      rt.state = 'reconnecting'
      rt.reconnects++
      log(`koneksi putus → reconnect ${RECONNECT_DELAY_MS / 1000} dtk (total ${rt.reconnects}×)`)
      if (rt.reconnectTimer) clearTimeout(rt.reconnectTimer)
      rt.reconnectTimer = setTimeout(() => {
        rt.reconnectTimer = null
        void startMarketListener()
      }, RECONNECT_DELAY_MS)
    }) as never)

    log('memulai —', TWELVE_DATA_WS_URL.replace(/apikey=[^&]+/, 'apikey=***'))
  } catch (e) {
    rt.state = 'idle'
    rt.lastError = `start gagal: ${e instanceof Error ? e.message : String(e)}`
    console.warn('[market-listener]', rt.lastError)
  }
}

/** Hentikan listener (untuk shutdown anggun / pengujian) */
export function stopMarketListener(): void {
  const rt = runtime()
  if (rt.reconnectTimer) { clearTimeout(rt.reconnectTimer); rt.reconnectTimer = null }
  try { rt.ws?.close() } catch { /* sudah tertutup */ }
  rt.ws = null
  rt.state = 'stopped'
}

/* ════════════════════════════════════════════════════════════════
   DIAGNOSTIK — untuk /api/health & /api/vip-signals/latest
   (tanpa nilai secret — hanya kehadiran konfigurasi, aman publik)
   ════════════════════════════════════════════════════════════════ */

export interface MarketListenerStatus {
  state: ListenerState
  mode: 'ws+poll' | 'poll'
  symbols: string[]
  ticks: number
  lastTickAt: number | null
  reconnects: number
  lastError: string | null
  hasTwelveDataKey: boolean
  cooldownMs: number
  rearmMs: number
  minGapMs: number
  lastBroadcastAt: number | null
  enabled: boolean
}

export function getMarketListenerStatus(): MarketListenerStatus {
  const rt = runtime()
  /* Mode = apa yang BENAR-BENAR jalan, bukan sekadar kapabilitas:
     di CF Workers shim unenv membuat process.versions.node terbaca
     walau ws mustahil jalan — ikuti state listener, jangan env. */
  const wsActive = rt.state === 'connecting' || rt.state === 'open' || rt.state === 'reconnecting'
  return {
    state: rt.state,
    mode: wsActive ? 'ws+poll' : 'poll',
    symbols: [...VIP_SYMBOLS],
    ticks: rt.ticks,
    lastTickAt: rt.lastTickAt || null,
    reconnects: rt.reconnects,
    lastError: rt.lastError || null,
    hasTwelveDataKey: Boolean(String(process.env.TWELVE_DATA_API_KEY || '').trim()),
    cooldownMs: VIP_SIGNAL_COOLDOWN_MS,
    rearmMs: VIP_SIGNAL_REARM_MS,
    minGapMs: VIP_SIGNAL_MIN_GAP_MS,
    lastBroadcastAt: lastBroadcastAt || null,
    enabled: signalsEnabled(),
  }
}
