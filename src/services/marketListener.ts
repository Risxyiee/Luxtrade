/**
 * ============================================================
 * marketListener — REAL-TIME ALERT ENGINE (Sinyal VIP Luxtradee)
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
  skipped?: 'cooldown' | 'disabled' | 'no-supabase' | 'db-error' | 'invalid-levels'
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

/** Kill-switch darurat: VIP_SIGNALS_ENABLED=false mematikan broadcast */
function signalsEnabled(): boolean {
  return String(process.env.VIP_SIGNALS_ENABLED ?? 'true').toLowerCase() !== 'false'
}

/** XAU/USD tampil 2 desimal */
const fmt = (n: number): string => Number(n).toFixed(2)

/* ════════════════════════════════════════════════════════════════
   🧠 OTAK SINYAL — evaluateCustomIndicator
   ════════════════════════════════════════════════════════════════ */

/** Buffer tick terakhir per simbol — bahan hitung EMA/RSI/structure */
const tickBuffers = new Map<string, number[]>()
const TICK_BUFFER_MAX = 600

function pushTick(symbol: string, price: number): number[] {
  let buf = tickBuffers.get(symbol)
  if (!buf) { buf = []; tickBuffers.set(symbol, buf) }
  buf.push(price)
  if (buf.length > TICK_BUFFER_MAX) buf.splice(0, buf.length - TICK_BUFFER_MAX)
  return buf
}

/**
 * 🧠 TEMPAT LOGIKA INDIKATOR PRIBADI BOS — satu-satunya fungsi yang
 * perlu diubah. Dipakai BERSAMA oleh jalur WS (Node) dan jalur cron
 * REST (Cloudflare Workers), jadi cukup isi DI SINI sekali.
 *
 * ATURAN MAIN:
 *   - WAJIB return objek SignalPayload (isTriggered, action, entryPrice, sl, tp).
 *   - isTriggered=true hanya saat sinyal valid; SL/TP WAJIB logis:
 *       BUY  → sl < entryPrice < tp
 *       SELL → tp < entryPrice < sl
 *     broadcastVipSignal() menolak sinyal dengan level kacau (guard
 *     'invalid-levels') supaya bug indikator tidak menembak notif
 *     sampah ke seluruh user PRO.
 *   - Fungsi ini dipanggil PER TICK (WS) / PER 15 MENIT (cron) —
 *     jangan di dalamnya melakukan fetch jaringan atau async kerja.
 *
 * CONTOH STRUKTUR (nonaktif — silakan ganti dengan rumus pribadi):
 *
 *   const buf = pushTick(tick.symbol, tick.price)      // buffer tersedia
 *   if (buf.length < 21) return noSignal(tick)         // data kurang
 *   // hitung EMA dari buf, lalu contoh sinyal:
 *   // if (e9 > e21) return { isTriggered: true, action: 'BUY',
 *   //     entryPrice: tick.price,
 *   //     sl: Number((tick.price - 5.50).toFixed(2)),
 *   //     tp: Number((tick.price + 15.00).toFixed(2)) }
 *   // if (e9 < e21) return { isTriggered: true, action: 'SELL',
 *   //     entryPrice: tick.price,
 *   //     sl: Number((tick.price + 5.50).toFixed(2)),
 *   //     tp: Number((tick.price - 15.00).toFixed(2)) }
 */
export function evaluateCustomIndicator(tick: PriceTick): SignalPayload {
  // Catat tick ke buffer (berguna saat Bos mengisi logika di atas)
  pushTick(tick.symbol, tick.price)

  /* ══════════════════════════════════════════════════════════════
     TODO(BOS): tempel logika indikator pribadi DI SINI.
     Sementara default: TIDAK ADA sinyal (aman — nol notif spam).
     ══════════════════════════════════════════════════════════════ */
  return noSignal(tick)
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

/** Cooldown aktif? Cek in-memory (cepat) + baris terakhir DB (tahan tik ganda antar-isolate) */
async function isCooldownActive(
  admin: NonNullable<Awaited<ReturnType<typeof getSupabaseAdminAsync>>>
): Promise<boolean> {
  if (lastBroadcastAt && Date.now() - lastBroadcastAt < VIP_SIGNAL_COOLDOWN_MS) return true
  try {
    const { data, error } = await admin
      .from('market_alerts')
      .select('created_at')
      .order('created_at', { ascending: false })
      .limit(1)
    if (!error && data?.[0]?.created_at) {
      const t = new Date(String(data[0].created_at)).getTime()
      if (Number.isFinite(t) && Date.now() - t < VIP_SIGNAL_COOLDOWN_MS) return true
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

  const admin = await getSupabaseAdminAsync()
  if (!admin) return { sent: false, skipped: 'no-supabase' }

  if (await isCooldownActive(admin)) return { sent: false, skipped: 'cooldown' }

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
  return { sent: true, receivers, failed, alertId }
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
  mode: 'ws+poll' | 'poll-only'
  symbols: string[]
  ticks: number
  lastTickAt: number | null
  reconnects: number
  lastError: string | null
  hasTwelveDataKey: boolean
  cooldownMs: number
  lastBroadcastAt: number | null
  enabled: boolean
}

export function getMarketListenerStatus(): MarketListenerStatus {
  const rt = runtime()
  const isNode =
    typeof process !== 'undefined' &&
    !!process.versions &&
    String((process.versions as Record<string, string>).node || '') !== ''
  return {
    state: rt.state,
    mode: isNode ? 'ws+poll' : 'poll-only',
    symbols: [...VIP_SYMBOLS],
    ticks: rt.ticks,
    lastTickAt: rt.lastTickAt || null,
    reconnects: rt.reconnects,
    lastError: rt.lastError || null,
    hasTwelveDataKey: Boolean(String(process.env.TWELVE_DATA_API_KEY || '').trim()),
    cooldownMs: VIP_SIGNAL_COOLDOWN_MS,
    lastBroadcastAt: lastBroadcastAt || null,
    enabled: signalsEnabled(),
  }
}
