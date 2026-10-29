'use client'
/**
 * ============================================================
 * VelaChartTerminal — Chart terminal baru Luxtradee (Task 36)
 * ============================================================
 * Menggantikan chart lama (lightweight-charts) dengan Vela™ by
 * LuxAlgo (@luxalgo/vela) — WebGL2, workspace lengkap (symbol
 * search, timeframe, indikator bawaan 70+, drawing tools), tema
 * gelap elegan ala Luxtradee.
 *
 * DATAFEED (urutan FINAL Bos — BINANCE DIBUANG, satu pintu keyless):
 *   Semua simbol (FX/Gold/US100/crypto) → LuxtradeeForexProvider
 *   via /api/candles: TradingView keyless → Twelve Data
 *   (TWELVE_DATA_API_KEY) → Yahoo keyless. Chart tak pernah
 *   mati 401.
 * - Pine Script®           : @luxalgo/vela-pinets (PineEngine)
 *                            + editor Save/Compile dengan kuota
 *                            FREE 2×/bulan (/api/pine/save)
 * - Indikator DEFAULT      : Luxtradee Candle Impulsif (v5, master
 *                            Bos) — aktif otomatis, semua user bisa
 *                            lihat; alert Telegram khusus Pro (🔔)
 * - Alert Telegram         : panel kirim alert dengan kuota
 *                            FREE 2×/hari (/api/send-alert)
 *
 * CATATAN SSR: komponen ini WAJIB dimuat via next/dynamic dengan
 * { ssr: false } (dilakukan di ChartTab) — Vela menyentuh
 * WebGL/canvas sejak konstruktor.
 */

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react'
import type { VelaWorkspace } from '@luxalgo/vela/workspace'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Loader2, ScrollText, Bell, X, Send, GraduationCap, TriangleAlert, Trash2 } from 'lucide-react'
import { DEFAULT_PINE_SLUG } from '@/lib/pine-default-meta'
import { TRADE_MARKER_TYPE, registerTradeMarkerNative } from '@/components/vela/TradeMarkerIndicator'
import {
  consumePendingTradeHighlight,
  TRADE_HIGHLIGHT_EVENT,
  type TradeMarkerPayload,
} from '@/lib/trade-highlight'

/* ---------- Luxtradee Pine® presets (muncul di indicator picker) ---------- */
const PINE_PRESETS = [
  {
    name: 'Luxtradee — EMA 20/50',
    category: 'Luxtradee',
    enabled: true,
    script: `//@version=6
indicator("Luxtradee EMA 20/50", overlay=true)
plot(ta.ema(close, 20), color=color.orange, linewidth=2)
plot(ta.ema(close, 50), color=color.teal, linewidth=2)`,
  },
  {
    name: 'Luxtradee — RSI 14',
    category: 'Luxtradee',
    script: `//@version=6
indicator("Luxtradee RSI 14", overlay=false)
plot(ta.rsi(close, 14), color=color.purple, linewidth=2)
hline(70), hline(30)`,
  },
  {
    name: 'Luxtradee — VWAP',
    category: 'Luxtradee',
    script: `//@version=6
indicator("Luxtradee VWAP", overlay=true)
plot(ta.vwap, color=color.aqua, linewidth=2)`,
  },
]

/* ---------- Batas indikator preset (SOP Bos: free 1, pro buka semua) ---------- */
const FREE_INDICATOR_LIMIT = 1

/* ============================================================
   PROTECTED CUSTOM PINE SCRIPT® (Task 41) — client-side glue
   ============================================================
   Source Pine TIDAK PERNAH dikirim ke browser. Server
   (/api/compile-pine) menjalankan engine PineTS headless dan
   HANYA mengembalikan hasil plot {time, value}. Client menggambar
   hasilnya via NATIVE INDICATOR Vela (registerNativeIndicator)
   — tanpa tab editor, tanpa source, tanpa cara menyalin kodenya.
   ============================================================ */
const PROTECTED_TYPE = 'luxtradee-protected'

interface ProtectedPlot { key: string; title: string; color: string; data: Array<{ time: number; value: number | null }> }
interface ProtectedScriptMeta { id: string; slug: string; name: string; description: string | null }

/* Event status protected → UI (error tidak lagi DIAM — Bos: chip
   diklik tapi garis tidak muncul tanpa jejak penyebabnya). */
const PROTECTED_STATUS_EVENT = 'ltx-protected-status'
function emitProtectedStatus(key: string, message: string) {
  try { window.dispatchEvent(new CustomEvent(PROTECTED_STATUS_EVENT, { detail: { key, message } })) } catch { /* diam */ }
}

/* Cache plot per (scriptKey, symbol, tf) — 45 detik. Refetch ringan
   ini sekaligus jadi loop LISTENER alert: tiap refresh, server
   mengevaluasi ulang sinyal Entry/SL/TP → Telegram user Pro. */
const protectedPlotCache = new Map<string, { at: number; plots: ProtectedPlot[] }>()

function emitProtectedPlots(ctx: any, plots: ProtectedPlot[], scriptId: string) {
  try {
    const barsArr: Array<{ time: number }> = typeof ctx?.bars === 'function' ? ctx.bars() : []
    const series = plots.map((p) => {
      const m = new Map<number, number | null>()
      for (const d of p.data) m.set(d.time, d.value)
      return {
        id: `ltxp-${scriptId}-${p.key}`,
        title: p.title,
        paneId: 'price',
        kind: 'line' as const,
        /* Index-aligned terhadap bars() SAAT EMIT (kontrak Vela) */
        points: barsArr.map((b) => ({ time: b.time, value: m.get(b.time) ?? null })),
        style: { color: p.color, width: 2, lineStyle: 'solid' as const },
      }
    })
    ctx?.emit?.({ series })
  } catch { /* jangan biarkan satu emit mengguncang chart */ }
}

function createProtectedInstance() {
  let ctx: any = null
  let scriptKey = '' // id ATAU slug (default auto-load pakai slug)
  let busy = false
  let lastEmit = 0
  let lastFail = 0 // backoff: jangan hammer server saat gagal
  let lastPlots: ProtectedPlot[] | null = null
  let lastBarsSig = '' // anti re-emit sia-sia saat bars tak berubah
  const reemitTimers: ReturnType<typeof setTimeout>[] = []

  const clearTimers = () => {
    while (reemitTimers.length) { try { clearTimeout(reemitTimers.pop() as any) } catch { /* diam */ } }
  }

  /* Re-emit beberapa kali setelah plot siap — history chart bisa
     datang TERLAMBAT dari boot (getBars 5000 bar). Tanpa ini garis
     Entry/SL/TP kadang tidak tampak sampai tick berikutnya. */
  const scheduleReEmits = () => {
    clearTimers()
    for (const d of [700, 1800, 3500, 6000]) {
      reemitTimers.push(setTimeout(() => { try { if (ctx && lastPlots) emitProtectedPlots(ctx, lastPlots, scriptKey) } catch { /* diam */ } }, d))
    }
  }

  /* Emit hanya bila bars berubah (jumlah/ujung waktu) — plot
     bergantung pada TIME saja, bukan nilai close live. */
  const maybeEmit = (c: any) => {
    if (!lastPlots) return
    try {
      const barsArr: Array<{ time: number }> = typeof c?.bars === 'function' ? c.bars() : []
      const sig = `${barsArr.length}:${barsArr[0]?.time ?? 0}:${barsArr[barsArr.length - 1]?.time ?? 0}`
      if (sig === lastBarsSig) return
      lastBarsSig = sig
      emitProtectedPlots(c, lastPlots, scriptKey)
    } catch { try { emitProtectedPlots(c, lastPlots, scriptKey) } catch { /* diam */ } }
  }

  const run = async (force: boolean) => {
    const c = ctx
    if (!c || !scriptKey || busy) return
    /* simbol bisa berprefiks provider — buang sebelum ':'] */
    const sym = String(c.symbol || '').split(':').pop() || ''
    const tf = String(c.timeframe || '60')
    const ck = `${scriptKey}:${sym.toUpperCase()}:${tf}`
    const cached = protectedPlotCache.get(ck)
    if (cached && Date.now() - cached.at < 45000) {
      lastPlots = cached.plots
      lastBarsSig = '' // paksa emit ulang utk ctx baru
      maybeEmit(c)
      return
    }
    if (!force && Date.now() - lastEmit < 15000) return // anti-jitter live tick
    if (!force && Date.now() - lastFail < 20000) return // backoff pasca gagal (jangan banjir server)
    busy = true
    try {
      c.setStatus?.('loading')
      const res = await fetch('/api/compile-pine', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ scriptId: scriptKey, symbol: sym.toUpperCase(), interval: tf }),
      })
      if (res.ok) {
        const j: any = await res.json()
        if (Array.isArray(j?.plots) && j.plots.length) {
          protectedPlotCache.set(ck, { at: Date.now(), plots: j.plots })
          lastPlots = j.plots
          lastBarsSig = ''
          maybeEmit(c)
          lastEmit = Date.now()
          c.setStatus?.('live')
          scheduleReEmits()
          return
        }
        emitProtectedStatus(scriptKey, '⚠️ Skrip berjalan tapi belum menghasilkan plot — coba lagi sebentar.')
      } else if (res.status === 403) {
        /* Pro kadaluarsa di tengah sesi — chip UI akan menutup akses
           pada pemakaian berikutnya */
        emitProtectedStatus(scriptKey, '🔒 Indikator eksklusif ini khusus member Pro.')
      } else {
        let msg = `HTTP ${res.status}`
        try { const je: any = await res.json(); if (je?.error) msg = String(je.error) } catch { /* diam */ }
        emitProtectedStatus(scriptKey, `⚠️ Gagal memuat indikator: ${msg}`)
        lastFail = Date.now()
      }
      c.setStatus?.('idle')
    } catch (x: any) {
      lastFail = Date.now()
      emitProtectedStatus(scriptKey, `⚠️ Jaringan gagal memuat indikator: ${String(x?.message || x).slice(0, 100)}`)
      try { c?.setStatus?.('idle') } catch { /* diam */ }
    } finally { busy = false }
  }

  return {
    start: (c: any, inputs: Record<string, any>) => {
      ctx = c
      scriptKey = String(inputs?.scriptId || inputs?.slug || '')
      lastPlots = null
      lastBarsSig = ''
      run(true)
    },
    onBars: () => {
      /* History termuat / tick live → gambar ulang dari plot terakhir
         TANPA fetch (instan) — fix: garis Entry/SL/TP kadang kosong
         karena plot siap SEBELUM history chart selesai dimuat. */
      if (lastPlots && ctx) { maybeEmit(ctx); return }
      run(false)
    },
    onViewport: () => { if (lastPlots && ctx) maybeEmit(ctx) },
    setInputs: (i: Record<string, any>) => {
      const s = String(i?.scriptId || i?.slug || '')
      if (s && s !== scriptKey) { scriptKey = s; lastPlots = null; lastBarsSig = ''; run(true) }
    },
    suspend: () => { /* tetap hidup — data murah dari cache */ },
    resume: () => { if (lastPlots && ctx) maybeEmit(ctx); else run(false) },
    stop: () => { clearTimers(); ctx = null },
  }
}

let protectedRegistered = false
function ensureProtectedNativeRegistered(register: (d: any) => void) {
  if (protectedRegistered) return
  protectedRegistered = true
  register({
    type: PROTECTED_TYPE,
    title: 'Luxtradee Pro Script',
    shortTitle: 'LTX Pro',
    paneHint: 'price',
    overlay: true,
    multiInstance: true,
    inputsSchema: () => [{ key: 'scriptId', type: 'text', defval: '', title: 'Script ID', visible: false } as any],
    defaultInputs: () => ({ scriptId: '' }),
    create: createProtectedInstance,
  })
}

/* ---------- Template awal editor ---------- */
const PINE_TEMPLATE = `//@version=6
indicator("Luxtradee Skrip Saya", overlay=true)
plot(ta.ema(close, 20), color=color.orange, linewidth=2)`

/* ============================================================
   AUTO-SAVE INDIKATOR (localStorage) — permintaan Bos:
   "kalau keluar halaman chart semua kembali, semua pengaturan chart
   pine hilang harus masukin lagi" → state indikator aktif + draft
   editor Pine disimpan dan dipanggil ulang setiap terminal dibuka.
   ============================================================ */
const INDICATOR_STORE_KEY = 'luxtradee_active_indicators'
const PINE_DRAFT_KEY = 'luxtradee_pine_draft'

interface StoredIndicatorState { v: 1; presets: number[]; protected: string[]; savedAt: number }

function loadStoredIndicators(): StoredIndicatorState | null {
  try {
    const raw = localStorage.getItem(INDICATOR_STORE_KEY)
    if (!raw) return null
    const j = JSON.parse(raw)
    if (!j || !Array.isArray(j.presets) || !Array.isArray(j.protected)) return null
    return {
      v: 1,
      presets: j.presets.filter((n: any) => Number.isInteger(n) && n >= 0 && n < PINE_PRESETS.length).slice(0, PINE_PRESETS.length),
      protected: j.protected.filter((s: any) => typeof s === 'string' && s).slice(0, 12),
      savedAt: Number(j.savedAt) || 0,
    }
  } catch { return null }
}

function saveStoredIndicators(state: { presets: number[]; protected: string[] }) {
  try {
    localStorage.setItem(INDICATOR_STORE_KEY, JSON.stringify({ v: 1, presets: state.presets, protected: state.protected, savedAt: Date.now() }))
  } catch { /* storage penuh / private mode — diam */ }
}

/** Timeframe Vela (menit, string) → ms per bar — utk jendela viewport marker trade. */
const TF_MS: Record<string, number> = {
  '5': 5 * 60_000, '15': 15 * 60_000, '30': 30 * 60_000, '60': 60 * 60_000,
  '120': 2 * 3_600_000, '240': 4 * 3_600_000,
  '1D': 86_400_000, 'D': 86_400_000, '1440': 86_400_000,
  '1W': 604_800_000, 'W': 604_800_000, '10080': 604_800_000,
}

interface PineScriptRow { id: string; name: string; source: string }
interface QuotaBadge { isPro: boolean; used: number; limit: number | null; remaining: number | null }

/* ---------- Alert otomatis Pine (Task 44 — klik 🔔 aktif 24 jam) ---------- */
interface AlertSubRow { id: string; scriptId: string; scriptName: string; symbol: string; interval: string; enabled: boolean }
const ALERT_TFS: Array<{ v: string; label: string }> = [
  { v: '5m', label: '5 Menit' }, { v: '15m', label: '15 Menit' }, { v: '30m', label: '30 Menit' },
  { v: '1h', label: '1 Jam' }, { v: '2h', label: '2 Jam' }, { v: '4h', label: '4 Jam' },
  { v: '1d', label: '1 Hari' }, { v: '1w', label: '1 Minggu' },
]
/* Timeframe chart Vela → interval kanonik server */
const TF_TO_ALERT: Record<string, string> = {
  '5': '5m', '15': '15m', '30': '30m', '60': '1h', '120': '2h', '240': '4h',
  '1D': '1d', 'D': '1d', '1440': '1d', '1W': '1w', 'W': '1w', '10080': '1w',
}
function tfToAlert(tf: string): string {
  const t = String(tf || '').trim()
  return TF_TO_ALERT[t] || (/^\d+m$|^\d+h$|^1d$|^1w$/.test(t) ? t : '1h')
}
/** Hasil test alert → kalimat manusiawi untuk dialog */
function alertTestMsg(tj: any): { kind: 'ok' | 'warn'; text: string } {
  if (tj?.telegramBound !== true) {
    return { kind: 'warn', text: '✅ Alert aktif, tapi Telegram belum terhubung — buka Settings → Telegram agar sinyal bisa terkirim.' }
  }
  const n = Array.isArray(tj?.triggers) ? tj.triggers.length : 0
  if (tj?.sent > 0 && n > 0 && !tj?.testMessage) return { kind: 'ok', text: '🚀 Sinyal ditemukan & terkirim ke Telegram! Alert tetap aktif 24 jam.' }
  if (tj?.sent > 0 && tj?.testMessage) return { kind: 'ok', text: '🧪 Tes pipeline BERHASIL — cek Telegram kamu (pesan tes sudah masuk). Alert aktif 24 jam, dicek otomatis tiap 5 menit.' }
  if (tj?.sent > 0) return { kind: 'ok', text: `✅ ${n} sinyal di bar ini terkirim ke Telegram. Alert aktif 24 jam.` }
  return { kind: 'ok', text: '✅ Berjalan normal — belum ada sinyal di bar terakhir. Alert dicek server otomatis tiap 5 menit, 24 jam.' }
}

/**
 * Hitung tinggi auto-fit (REVISI Bos: "ukuran chart agak dikasih
 * celah dikit dibawahnya 20%/30% lah biar ga full bgt"):
 * chart memakai ±75% sisa viewport (viewport − header sticky −
 * footer − jarak napas) → SISANYA ±25% jadi celah kosong di
 * BAWAH chart. Diklem min 420px (mobile) / max 1400px.
 */
function computeFitHeight(host: HTMLElement): string | null {
  try {
    const head = document.querySelector('header')
    const headH = head ? head.offsetHeight : 0
    const foot = document.querySelector('footer')
    const footH = foot ? foot.offsetHeight : 0
    const avail = window.innerHeight - headH - footH - 28
    const fit = Math.round(avail * 0.75) // celah ±25% di bawah chart
    return `${Math.round(Math.min(Math.max(fit, 420), 1400))}px`
  } catch {
    return null
  }
}
export default function VelaChartTerminal({
  height = 'clamp(420px, 62vh, 640px)',
  defaultSymbol = 'XAUUSD',
  defaultTimeframe = '60',
}: {
  /** Tinggi awal sebelum auto-fit aktif (setelah mount, chart otomatis
   *  mengisi sisa ruang viewport sampai footer — lihat effect AUTO-FIT). */
  height?: string
  defaultSymbol?: string
  defaultTimeframe?: string
}) {
  const hostRef = useRef<HTMLDivElement | null>(null)
  const wsRef = useRef<VelaWorkspace | null>(null)
  const [booting, setBooting] = useState(true)
  const [bootError, setBootError] = useState<string | null>(null)

  /* ---------- AUTO-FIT tinggi chart ----------
   * Bos: "ukuran chart agak dikasih celah dikit dibawahnya
   * 20%/30% lah biar ga full bgt" → tinggi = 75% sisa viewport
   * (lihat computeFitHeight) — sisanya celah kosong di bawah.
   * Dua pasang — kunci anti-crash (error openTime saat Vela boot
   * kena resize container di tengah inisialisasi):
   *   Pass 1 useLayoutEffect: hitung & set tinggi SEBELUM effect
   *     boot Vela jalan → workspace lahir dengan ukuran final.
   *   Pass 2 (booting=false): ResizeObserver baru dipasang —
   *     adaptif banner PWA/promo muncul/hilang & viewport resize.
   * Tidak bisa loop: tinggi host tidak memengaruhi header/footer,
   * dan setState di-guard sama-nilai. Min 420px (mobile). */
  const [autoH, setAutoH] = useState<string | null>(null)

  useLayoutEffect(() => {
    /* Pass 1 — sebelum Vela boot: pasang ukuran final dari awal */
    const host = hostRef.current
    if (!host) return
    const h = computeFitHeight(host)
    if (h) setAutoH(h)
  }, [])

  useEffect(() => {
    /* Pass 2 — setelah boot selesai: reaksi perubahan layout */
    if (booting) return
    const host = hostRef.current
    if (!host) return
    let raf = 0
    const apply = () => {
      const h = computeFitHeight(host)
      if (h) setAutoH((prev) => (prev === h ? prev : h))
    }
    apply()
    const ro = new ResizeObserver(() => {
      cancelAnimationFrame(raf)
      raf = requestAnimationFrame(apply)
    })
    ro.observe(document.body)
    if (host.parentElement) ro.observe(host.parentElement)
    window.addEventListener('resize', apply)
    return () => {
      ro.disconnect()
      cancelAnimationFrame(raf)
      window.removeEventListener('resize', apply)
    }
  }, [booting])

  /* ---------- Pine editor state ---------- */
  const [pineOpen, setPineOpen] = useState(false)
  const [pineName, setPineName] = useState('Skrip saya')
  const [pineSource, setPineSource] = useState(PINE_TEMPLATE)
  const [pineBusy, setPineBusy] = useState(false)
  const [pineMsg, setPineMsg] = useState<{ kind: 'ok' | 'err'; text: string } | null>(null)
  const [pineScripts, setPineScripts] = useState<PineScriptRow[]>([])
  const [pineQuota, setPineQuota] = useState<QuotaBadge | null>(null)

  /* ---------- Alert Telegram state ---------- */
  const [alertOpen, setAlertOpen] = useState(false)
  const [alertMsg, setAlertMsg] = useState('')
  const [alertBusy, setAlertBusy] = useState(false)
  const [alertResult, setAlertResult] = useState<{ kind: 'ok' | 'err'; text: string } | null>(null)
  const [alertQuota, setAlertQuota] = useState<QuotaBadge | null>(null)

  /* ---------- Upgrade paywall dialog ---------- */
  const [upgradeMsg, setUpgradeMsg] = useState<string | null>(null)

  /* ---------- Preset indikator (chip) — free 1 · pro 3 ---------- */
  const [activePresets, setActivePresets] = useState<Record<number, boolean>>({})
  const [presetBusy, setPresetBusy] = useState<number | null>(null)
  const [presetMsg, setPresetMsg] = useState<string | null>(null)

  /* ---------- Indikator Eksklusif (Protected Pine — Pro saja) ---------- */
  const [protectedScripts, setProtectedScripts] = useState<ProtectedScriptMeta[]>([])
  const [protectedIsPro, setProtectedIsPro] = useState(false)
  const [activeProtected, setActiveProtected] = useState<Record<string, boolean>>({})
  const [protectedBusy, setProtectedBusy] = useState<string | null>(null)
  const [protectedMsg, setProtectedMsg] = useState<string | null>(null)

  /* ---------- Alert otomatis Pine (🔔 klik aktif 24 jam) ---------- */
  const [alertDlg, setAlertDialog] = useState<ProtectedScriptMeta | null>(null)
  const [alertSubs, setAlertSubs] = useState<AlertSubRow[]>([])
  const [alertTgBound, setAlertTgBound] = useState<boolean | null>(null)
  const [alertSymbol, setAlertSymbol] = useState('XAUUSD')
  const [alertInterval, setAlertInterval] = useState('1h')
  const [alertSaving, setAlertSaving] = useState(false)
  const [alertDlgMsg, setAlertDlgMsg] = useState<{ kind: 'ok' | 'err' | 'warn'; text: string } | null>(null)

  /* ---------- Boot Vela workspace (sekali) ---------- */
  useEffect(() => {
    let dead = false
    ;(async () => {
      try {
        const [{ VelaWorkspace: WS }, { LuxtradeeForexProvider }, { PineEngine }, velaCore] = await Promise.all([
          import('@luxalgo/vela/workspace'),
          import('@/components/vela/LuxtradeeProvider'),
          import('@luxalgo/vela-pinets'),
          import('@luxalgo/vela'),
        ])
        if (dead || !hostRef.current) return
        /* Native indicator utk hasil Protected Pine (server-computed)
           + Trade Marker (klik Riwayat Trade → garis/marker di chart)
           — daftar SEBELUM chart dibuat supaya addNativeIndicator hidup */
        ensureProtectedNativeRegistered((velaCore as any).registerNativeIndicator)
        registerTradeMarkerNative((velaCore as any).registerNativeIndicator)
        const ws = new WS(hostRef.current, {
          layout: false, // satu chart penuh
          symbol: defaultSymbol,
          timeframe: defaultTimeframe,
          live: true,
          theme: 'dark',
          /* Branding Vela dimatikan via opsi resmi (bukan hack DOM) —
             area chart bersih, fokus ke identitas Luxtradee */
          watermark: false,
          /* Gaya candle Luxtradee: emerald naik / merah turun */
          upColor: '#10b981',
          downColor: '#ef4444',
          /* Datafeed (urutan FINAL Bos — BINANCE DIBUANG, semua via feed
             Luxtradee /api/candles: TradingView → Twelve Data →
             Yahoo; FX/Gold/US100/crypto satu pintu keyless) */
          providers: {
            luxtradee: () => new LuxtradeeForexProvider(), // TV→TD→Yahoo
          },
          /* Pine Script® engine — in-process (paling stabil).
             Skrip berat nanti bisa ganti PineWorkerEngine. */
          engines: { pine: () => new PineEngine() },
          indicators: PINE_PRESETS,
          persist: 'luxtradee-vela-v1', // restore layout/indikator/gambar user
        })
        wsRef.current = ws
        setBooting(false)
      } catch (x: any) {
        if (!dead) {
          setBootError(String(x?.message || x).slice(0, 160))
          setBooting(false)
        }
      }
    })()
    return () => {
      dead = true
      try { wsRef.current?.destroy() } catch { /* ignore */ }
      wsRef.current = null
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  /* ---------- Alert otomatis Pine: muat langganan + status Telegram ---------- */
  const loadAlertSubs = useCallback(async () => {
    try {
      const r = await fetch('/api/pine/alerts', { cache: 'no-store' })
      if (!r.ok) return
      const j: any = await r.json()
      setAlertSubs(Array.isArray(j?.subscriptions) ? j.subscriptions : [])
      setAlertTgBound(j?.telegramBound === true)
      if (typeof j?.isPro === 'boolean') setProtectedIsPro(j.isPro)
    } catch { /* belum login — dot bell cukup kosong */ }
  }, [])

  /* ---------- Kuota badge (mount) ---------- */
  const refreshQuotas = useCallback(async () => {
    try {
      const [p, a, pr] = await Promise.all([
        fetch('/api/pine/save', { cache: 'no-store' }).then((r) => (r.ok ? r.json() : null)).catch(() => null),
        fetch('/api/send-alert', { cache: 'no-store' }).then((r) => (r.ok ? r.json() : null)).catch(() => null),
        fetch('/api/compile-pine', { cache: 'no-store' }).then((r) => (r.ok ? r.json() : null)).catch(() => null),
      ])
      if (p?.quota) setPineQuota(p.quota)
      if (p?.scripts) setPineScripts(p.scripts)
      if (a && !a.error) setAlertQuota(a)
      if (pr) {
        setProtectedIsPro(pr.isPro === true)
        if (Array.isArray(pr.scripts)) setProtectedScripts(pr.scripts)
      }
      loadAlertSubs()
    } catch { /* belum login — badge disembunyikan */ }
  }, [loadAlertSubs])
  useEffect(() => { refreshQuotas() }, [refreshQuotas])

  /* ============================================================
     AUTO-SAVE & RESTORE INDIKATOR (localStorage) — permintaan Bos:
     "kalau keluar halaman chart semua kembali, semua pengaturan
     chart pine hilang harus masukin lagi" + Pine Master otomatis
     termuat secara DEFAULT saat terminal dibuka.
     ============================================================
     - Preset Pine (EMA/RSI/VWAP) = script indicator "external" yang
       TIDAK di-persist Vela → kita panggil ulang sendiri dari
       localStorage.
     - Protected Pine = native indicator (di-persist Vela bila
       tersimpan) → yang belum ada kita tambahkan; yang sudah
       dipulihkan persist cukup ditandai aktif.
     - Pine Master (Luxtradee Candle Impulsif) SELALU dimuat BY SLUG
       TANPA menunggu daftar API (fix Bos: "harus masukin pine dulu
       baru keluar log entry sl tp" — bila API list lambat/gagal,
       indikator default tetap tampil di chart seketika). */
  const restoredRef = useRef(false) // write-guard: state aman ditulis ke localStorage
  const restoredPresetsRef = useRef(false)
  const restoredProtectedRef = useRef(false)
  const [restoreRetry, setRestoreRetry] = useState(0)
  useEffect(() => {
    if (booting) return
    /* Restore dua BAGIAN yang saling lepas (fix bug lama: sebelumnya
       seluruh restore menunggu daftar protected — bila API list gagal/
       401, preset EMA/RSI/VWAP ikut tidak dipulihkan = "pengaturan
       hilang"). Sekarang:
       - PRESETS     → dipulihkan segera setelah chart siap.
       - PROTECTED   → Pine Master default dipulihkan SEKETIKA (by
                       slug); skrip eksklusif lain menyusul saat
                       daftar skrip tersedia. */
    const needPresets = !restoredPresetsRef.current
    const needProtected = !restoredProtectedRef.current
    if (!needPresets && !needProtected) return
    const t = setTimeout(async () => {
      /* Tunggu chart siap (maks ±20 detik) — boot bisa lambat saat
         compile/dev; kalau belum siap juga, retry otomatis via
         restoreRetry (efek terpicu ulang, refs belum terisi). */
      let chart: any = null
      for (let i = 0; i < 20; i++) {
        chart = (wsRef.current as any)?.chart
        if (chart && typeof chart.addNativeIndicator === 'function') break
        await new Promise((r) => setTimeout(r, 1000))
      }
      if (!chart || typeof chart.addNativeIndicator !== 'function') {
        setRestoreRetry((n) => n + 1)
        return
      }
      restoredRef.current = true
      const stored = loadStoredIndicators()

      /* ---- 1) RESTORE preset Pine dari localStorage ---- */
      if (needPresets) {
        restoredPresetsRef.current = true
        const presetIdx = stored ? stored.presets : []
        for (const i of presetIdx) {
          try {
            const handles = ((typeof chart.indicators === 'function' ? chart.indicators() : []) || []) as any[]
            const already = handles.some((h) => h?.source === PINE_PRESETS[i].script)
            if (!already) await runOnChart(PINE_PRESETS[i].script)
            setActivePresets((m) => ({ ...m, [i]: true }))
          } catch { /* satu preset gagal → lanjut yang lain */ }
        }
      }

      /* ---- 2) RESTORE protected — Pine Master selalu dijamin ada,
              by slug / id (dua-duanya diterima server) ---- */
      if (needProtected) {
        restoredProtectedRef.current = true
        try {
          /* kunci = id ATAU slug (default auto-load pakai slug) */
          const keys = new Set<string>([DEFAULT_PINE_SLUG])
          for (const id of stored?.protected || []) keys.add(String(id))
          for (const s of protectedScripts) {
            if ((stored?.protected || []).includes(s.id) || s.slug === DEFAULT_PINE_SLUG) keys.add(s.id)
          }
          /* default punya dua kunci ekuivalen (slug & id) — jangan
             pasang dobel: satu saja cukup */
          const defMeta = protectedScripts.find((s) => s.slug === DEFAULT_PINE_SLUG)
          const defKeys = new Set<string>([DEFAULT_PINE_SLUG, ...(defMeta ? [defMeta.id] : [])])
          /* baca scriptId instance yang SUDAH ada di chart (persist Vela) */
          const have = new Set<string>()
          try {
            for (const h of ((typeof chart.indicators === 'function' ? chart.indicators() : []) || []) as any[]) {
              if (h?.nativeType === PROTECTED_TYPE) have.add(String(h?.inputValues?.()?.scriptId || ''))
            }
          } catch { /* diam */ }
          const present: string[] = typeof chart.presentNativeIndicators === 'function'
            ? chart.presentNativeIndicators()
            : []
          const presentCount = present.filter((x) => x === PROTECTED_TYPE).length
          for (const key of keys) {
            const equivalents = defKeys.has(key) ? defKeys : new Set([key])
            if ([...equivalents].some((k) => have.has(k))) {
              setActiveProtected((m) => ({ ...m, [key]: true })) // sudah dipulihkan persist
              continue
            }
            if (presentCount > 0 && have.size < presentCount) {
              /* persist memulihkan instance tapi id tak terbaca —
                 jangan tambah dobel, cukup tandai aktif */
              setActiveProtected((m) => ({ ...m, [key]: true }))
              continue
            }
            chart.addNativeIndicator(PROTECTED_TYPE, { inputs: { scriptId: key } })
            setActiveProtected((m) => ({ ...m, [key]: true }))
          }
        } catch { /* diam — chip manual tetap tersedia */ }
      }
    }, 2000)
    return () => clearTimeout(t)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [booting, protectedScripts, restoreRetry])

  /* ---------- Tulis state → localStorage tiap perubahan ----------
     (hanya SETELAH restore pertama selesai — jangan menimpa state
     tersimpan dengan state kosong sebelum restore jalan). */
  useEffect(() => {
    if (!restoredRef.current) return
    const presets = Object.entries(activePresets).filter(([, v]) => v).map(([k]) => Number(k))
    const prot = Object.entries(activeProtected).filter(([, v]) => v).map(([k]) => k)
    saveStoredIndicators({ presets, protected: prot })
  }, [activePresets, activeProtected])

  /* ---------- Draft editor Pine ikut tersimpan (tak hilang saat pindah menu) ---------- */
  useEffect(() => {
    try {
      const raw = localStorage.getItem(PINE_DRAFT_KEY)
      if (!raw) return
      const j = JSON.parse(raw)
      if (typeof j?.name === 'string' && j.name.trim()) setPineName(j.name)
      if (typeof j?.source === 'string' && j.source.trim()) setPineSource(j.source)
    } catch { /* diam */ }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])
  useEffect(() => {
    const t = setTimeout(() => {
      try { localStorage.setItem(PINE_DRAFT_KEY, JSON.stringify({ name: pineName, source: pineSource, savedAt: Date.now() })) } catch { /* diam */ }
    }, 600)
    return () => clearTimeout(t)
  }, [pineName, pineSource])

  /* ---------- Status protected → pesan UI (error tidak diam lagi:
     sebelumnya POST gagal = tidak ada garis TANPA penjelasan) ---------- */
  useEffect(() => {
    const onStatus = (e: Event) => {
      const d = (e as CustomEvent)?.detail
      if (d && typeof d.message === 'string' && d.message) setProtectedMsg(d.message)
    }
    window.addEventListener(PROTECTED_STATUS_EVENT, onStatus)
    return () => window.removeEventListener(PROTECTED_STATUS_EVENT, onStatus)
  }, [])

  /* ============================================================
     KLIK RIWAYAT TRADE → MARKER CHART (fitur Bos)
     highlightTradeOnChart: lompat ke timestamp trade, gambar garis
     Entry (biru) / Exit (putih) / SL (merah) / TP (hijau) + marker
     panah Buy/Sell + callout di candle terkait.
     ============================================================ */
  const [tradeHighlightMsg, setTradeHighlightMsg] = useState<string | null>(null)
  const highlightTradeOnChart = useCallback(async (t: TradeMarkerPayload): Promise<boolean> => {
    const chart: any = (wsRef.current as any)?.chart
    if (!chart || typeof chart.addNativeIndicator !== 'function') return false // terminal belum siap
    try {
      /* 0) singkirkan marker trade sebelumnya (tipe multi-instance) */
      try {
        for (const h of ((typeof chart.indicators === 'function' ? chart.indicators() : []) || []) as any[]) {
          if (h?.nativeType === TRADE_MARKER_TYPE) { try { h.remove() } catch { /* diam */ } }
        }
      } catch { /* diam */ }

      /* 1) pindah simbol bila trade bukan simbol chart sekarang */
      const cur = String(chart.symbol || '').split(':').pop()?.toUpperCase() || ''
      const want = String(t.symbol || '').split(':').pop()?.toUpperCase() || cur
      if (want && cur && want !== cur && typeof chart.setSymbol === 'function') {
        chart.setSymbol(want)
        await new Promise((r) => setTimeout(r, 1400)) // beri waktu candle termuat
      }

      /* 2) pasang marker: garis Entry/Exit/SL/TP + panah Buy/Sell + callout */
      chart.addNativeIndicator(TRADE_MARKER_TYPE, {
        inputs: {
          entryPrice: t.entryPrice || 0,
          exitPrice: t.exitPrice || 0,
          slPrice: t.slPrice || 0,
          tpPrice: t.tpPrice || 0,
          timestamp: t.timestamp || 0,
          side: t.type === 'SELL' ? 'SELL' : 'BUY',
          symbol: want || cur || '',
          label: t.label || '',
        },
      })

      /* 3) arahkan viewport ke sekitar timestamp transaksi */
      if (typeof chart.setVisibleRange === 'function' && t.timestamp > 0) {
        const barMs = TF_MS[String(chart.timeframe || '60')] || 3_600_000
        try { chart.setVisibleRange({ from: t.timestamp - barMs * 40, to: t.timestamp + barMs * 20 }) } catch { /* diam */ }
      }
      return true
    } catch { return false }
  }, [])

  /* ---------- Konsumsi pesan highlight (Riwayat Trade / Jurnal / chat) ---------- */
  useEffect(() => {
    if (booting) return
    let alive = true
    const run = async (t: TradeMarkerPayload) => {
      /* tunggu chart + sejarah siap (maks ±8 detik) sebelum menggambar */
      for (let i = 0; i < 20 && alive; i++) {
        const chart: any = (wsRef.current as any)?.chart
        let n = 0
        try { n = (chart?.bars?.() || []).length } catch { /* diam */ }
        if (chart && n > 5) break
        await new Promise((r) => setTimeout(r, 400))
      }
      if (!alive) return
      const ok = await highlightTradeOnChart(t)
      if (!ok) return // chart belum siap → pesan tetap menunggu di localStorage
      try { consumePendingTradeHighlight({ remove: true }) } catch { /* diam */ }
      const when = t.timestamp > 0 ? new Date(t.timestamp).toLocaleString('id-ID', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }) : ''
      setTradeHighlightMsg(`📍 Trade ${t.type} ${t.symbol} @ ${t.entryPrice}${when ? ` · ${when}` : ''} dimuat ke chart`)
      setTimeout(() => setTradeHighlightMsg(null), 8000)
    }
    /* pesan tertunda (user datang dari tab lain) */
    const pending = consumePendingTradeHighlight({ remove: false })
    if (pending) void run(pending)
    /* pesan live (chart sedang terbuka — mis. klik trade di chat) */
    const onEvt = (e: Event) => {
      const d = (e as CustomEvent).detail
      if (d && typeof d.entryPrice === 'number' && typeof d.timestamp === 'number') void run(d as TradeMarkerPayload)
    }
    window.addEventListener(TRADE_HIGHLIGHT_EVENT, onEvt)
    return () => {
      alive = false
      window.removeEventListener(TRADE_HIGHLIGHT_EVENT, onEvt)
    }
  }, [booting, highlightTradeOnChart])

  /* ---------- Aksi alert otomatis (klik 🔔 → aktif + test / toggle / hapus) ---------- */
  const openAlertDialog = useCallback((s: ProtectedScriptMeta) => {
    /* Default simbol & TF ikut chart yang sedang dibuka */
    let sym = 'XAUUSD'
    let tf = '1h'
    try {
      const c: any = (wsRef.current as any)?.chart
      const cs = String(c?.symbol || '').split(':').pop()?.toUpperCase()
      if (cs) sym = cs
      if (c?.timeframe) tf = tfToAlert(String(c.timeframe))
    } catch { /* default tetap dipakai */ }
    setAlertSymbol(sym)
    setAlertInterval(tf)
    setAlertDlgMsg(null)
    setAlertDialog(s)
    loadAlertSubs()
  }, [loadAlertSubs])

  const saveAlertSub = useCallback(async (opts: { scriptId: string; symbol: string; interval: string; enabled: boolean; withTest?: boolean }) => {
    setAlertSaving(true)
    setAlertDlgMsg(null)
    try {
      const res = await fetch('/api/pine/alerts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ scriptId: opts.scriptId, symbol: opts.symbol.trim(), timeframe: opts.interval, enabled: opts.enabled }),
      })
      const j: any = await res.json().catch(() => null)
      if (res.status === 403) { setAlertDialog(null); setUpgradeMsg(String(j?.error || 'Alert otomatis khusus member Pro.')); return }
      if (res.status === 401) { setAlertDlgMsg({ kind: 'err', text: 'Sesi habis — login ulang dulu ya.' }); return }
      if (!res.ok) { setAlertDlgMsg({ kind: 'err', text: String(j?.error || `HTTP ${res.status}`) }); return }
      await loadAlertSubs()
      if (!opts.withTest) {
        setAlertDlgMsg({ kind: 'ok', text: opts.enabled ? `✅ Alert ${opts.symbol} ${opts.interval} dinyalakan.` : `Alert ${opts.symbol} ${opts.interval} dimatikan.` })
        return
      }
      /* Test langsung — user langsung lihat hasil evaluasi bar terakhir */
      const t = await fetch('/api/pine/alerts/test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ scriptId: opts.scriptId, symbol: opts.symbol.trim(), timeframe: opts.interval }),
      })
      const tj: any = await t.json().catch(() => null)
      if (!t.ok) {
        setAlertDlgMsg({ kind: 'ok', text: `✅ Alert aktif 24 jam — dicek otomatis tiap 5 menit. (Test gagal: ${String(tj?.error || t.status)})` })
        return
      }
      setAlertDlgMsg(alertTestMsg(tj))
    } catch (x: any) {
      setAlertDlgMsg({ kind: 'err', text: String(x?.message || x).slice(0, 140) })
    } finally { setAlertSaving(false) }
  }, [loadAlertSubs])

  const testAlertSub = useCallback(async (sub: AlertSubRow) => {
    setAlertSaving(true)
    setAlertDlgMsg(null)
    try {
      const t = await fetch('/api/pine/alerts/test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ scriptId: sub.scriptId, symbol: sub.symbol, timeframe: sub.interval }),
      })
      const tj: any = await t.json().catch(() => null)
      if (!t.ok) { setAlertDlgMsg({ kind: 'err', text: String(tj?.error || `HTTP ${t.status}`) }); return }
      setAlertDlgMsg(alertTestMsg(tj))
    } catch (x: any) {
      setAlertDlgMsg({ kind: 'err', text: String(x?.message || x).slice(0, 140) })
    } finally { setAlertSaving(false) }
  }, [])

  const deleteAlertSub = useCallback(async (id: string) => {
    try {
      await fetch(`/api/pine/alerts?id=${encodeURIComponent(id)}`, { method: 'DELETE' })
      setAlertSubs((l) => l.filter((s) => s.id !== id))
    } catch { /* diam — daftar segar saat dialog dibuka lagi */ }
  }, [])

  /* ---------- Jalankan Pine ke chart ---------- */
  const runOnChart = useCallback(async (source: string): Promise<string | null> => {
    const chart: any = (wsRef.current as any)?.chart
    if (!chart) return 'Chart belum siap — tunggu sebentar lalu coba lagi.'
    try {
      if (typeof chart.runIndicator === 'function') await chart.runIndicator(source)
      else await chart.addIndicator(source)
      return null
    } catch (x: any) {
      /* runIndicator Vela mengembalikan error terstruktur — tampilkan apa adanya */
      const m = String(x?.message || x?.reason || x).replace(/https?:\/\/\S+/g, '').slice(0, 180)
      return m || 'Skrip gagal dikompilasi.'
    }
  }, [])

  /* ---------- Save/Compile Pine (kuota 2×/bulan untuk free) ---------- */
  const pineSave = useCallback(async () => {
    setPineBusy(true); setPineMsg(null)
    try {
      const res = await fetch('/api/pine/save', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: pineName, source: pineSource }),
      })
      const r: any = await res.json()
      if (res.status === 403) { // kuota free habis
        setUpgradeMsg(String(r?.error || 'Batas edit tercapai.'))
        return
      }
      if (!res.ok) { setPineMsg({ kind: 'err', text: String(r?.error || `HTTP ${res.status}`) }); return }
      /* Sukses simpan → compile langsung ke chart */
      const err = await runOnChart(pineSource)
      if (err) { setPineMsg({ kind: 'err', text: `Tersimpan, tapi gagal tampil di chart: ${err}` }) }
      else { setPineMsg({ kind: 'ok', text: `✅ "${r?.script?.name || pineName}" tersimpan & tampil di chart.` }) }
      if (r?.quota) setPineQuota(r.quota)
      if (r?.script) setPineScripts((l) => [r.script, ...l].slice(0, 30))
    } catch (x: any) {
      setPineMsg({ kind: 'err', text: String(x?.message || x).slice(0, 140) })
    } finally { setPineBusy(false) }
  }, [pineName, pineSource, runOnChart])

  /* ---------- Alert Telegram (kuota 2×/hari untuk free) ---------- */
  const alertSend = useCallback(async () => {
    if (!alertMsg.trim()) return
    setAlertBusy(true); setAlertResult(null)
    try {
      const res = await fetch('/api/send-alert', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: alertMsg.trim() }),
      })
      const r: any = await res.json()
      if (res.status === 429) { // kuota alert free habis
        setUpgradeMsg(String(r?.error || 'Kuota alert habis.'))
        return
      }
      if (!res.ok) { setAlertResult({ kind: 'err', text: String(r?.error || `HTTP ${res.status}`) }); return }
      setAlertResult({ kind: 'ok', text: r?.isPro ? '✅ Terkirim ke Telegram (Pro — tanpa batas).' : `✅ Terkirim ke Telegram! Sisa kuota hari ini: ${r?.remaining ?? 0}.` })
      setAlertMsg('')
      if (typeof r?.used === 'number') setAlertQuota((q) => q ? { ...q, used: r.used, remaining: r.remaining } : q)
    } catch (x: any) {
      setAlertResult({ kind: 'err', text: String(x?.message || x).slice(0, 140) })
    } finally { setAlertBusy(false) }
  }, [alertMsg])

  const quotaLabel = (q: QuotaBadge | null, unit: string) =>
    !q ? '' : q.isPro ? 'PRO ∞' : `${q.remaining ?? 0} ${unit} lagi`

  /* ---------- Preset chip: tambah/lepas indikator Luxtradee ----------
     Free: 1 indikator (EMA 20/50). Pro: semua terbuka. Kuota nyata
     (alert & Pine edit) tetap dijaga server-side di API.
     Klik chip AKTIF → indikator dilepas dari chart (state ikut). */
  const isProUser = alertQuota?.isPro === true
  const runPreset = useCallback(async (i: number) => {
    if (presetBusy !== null) return
    /* --- TOGGLE OFF: chip aktif diklik lagi → lepas dari chart --- */
    if (activePresets[i]) {
      setPresetBusy(i); setPresetMsg(null)
      try {
        const chart: any = (wsRef.current as any)?.chart
        const handles = ((typeof chart?.indicators === 'function' ? chart.indicators() : []) || []) as any[]
        const h = handles.find((x) => x?.source === PINE_PRESETS[i].script)
        if (h) { try { h.remove() } catch { /* diam */ } }
        setActivePresets((m) => ({ ...m, [i]: false }))
        setPresetMsg(`✕ ${PINE_PRESETS[i].name.replace('Luxtradee — ', '')} dilepas dari chart.`)
      } finally { setPresetBusy(null) }
      return
    }
    setPresetBusy(i); setPresetMsg(null)
    const err = await runOnChart(PINE_PRESETS[i].script)
    const short = PINE_PRESETS[i].name.replace('Luxtradee — ', '')
    if (err) setPresetMsg(`⚠️ ${short}: ${err}`)
    else {
      setActivePresets((s) => ({ ...s, [i]: true }))
      setPresetMsg(`✅ ${short} tampil di chart. Klik chipnya lagi untuk melepas.`)
    }
    setPresetBusy(null)
  }, [presetBusy, activePresets, runOnChart])

  const lockedPresetMsg = (i: number) => {
    const names = PINE_PRESETS.slice(FREE_INDICATOR_LIMIT).map((x) => x.name.replace('Luxtradee — ', ''))
    return `Paket gratis hanya ${FREE_INDICATOR_LIMIT} indikator (${PINE_PRESETS[0].name.replace('Luxtradee — ', '')}). Upgrade ke Pro (Rp39rb/bulan) untuk membuka ${names.join(' + ')} dan pasang indikator sepuasnya!`
  }

  /* ---------- Indikator Eksklusif (Protected Pine — Pro) ----------
     Source tidak pernah keluar dari server: chip ini hanya menambah
     NATIVE indicator yang menggambar hasil plot dari /api/compile-pine.
     Free → dialog upgrade. Pro kadaluarsa di tengah sesi → server 403. */
  const addProtected = useCallback(async (s: ProtectedScriptMeta) => {
    if (protectedBusy) return
    const isDef = s.slug === DEFAULT_PINE_SLUG
    /* --- TOGGLE OFF: chip aktif diklik lagi → lepas dari chart --- */
    if (activeProtected[s.id] || (isDef && activeProtected[DEFAULT_PINE_SLUG])) {
      setProtectedBusy(s.id); setProtectedMsg(null)
      try {
        const chart: any = (wsRef.current as any)?.chart
        const handles = ((typeof chart?.indicators === 'function' ? chart.indicators() : []) || []) as any[]
        const h = handles.find((x) => {
          if (x?.nativeType !== PROTECTED_TYPE) return false
          const sid = String(x?.inputValues?.()?.scriptId || '')
          return sid === s.id || (isDef && sid === DEFAULT_PINE_SLUG)
        })
        if (h) { try { h.remove() } catch { /* diam */ } }
        setActiveProtected((m) => ({ ...m, [s.id]: false, ...(isDef ? { [DEFAULT_PINE_SLUG]: false } : {}) }))
        setProtectedMsg(`✕ ${s.name} dilepas dari chart. (Pine Master akan muncul lagi otomatis saat terminal dibuka berikutnya.)`)
      } finally { setProtectedBusy(null) }
      return
    }
    setProtectedBusy(s.id); setProtectedMsg(null)
    try {
      const chart: any = (wsRef.current as any)?.chart
      if (!chart) { setProtectedMsg('⚠️ Chart belum siap — coba lagi sebentar.'); return }
      if (typeof chart.addNativeIndicator !== 'function') {
        setProtectedMsg('⚠️ Terminal belum mendukung indikator eksklusif (update chart).'); return
      }
      chart.addNativeIndicator(PROTECTED_TYPE, { inputs: { scriptId: s.id } })
      setActiveProtected((m) => ({ ...m, [s.id]: true }))
      setProtectedMsg('🛡️ ' + s.name + ' tampil di chart. Klik 🔔 di sebelah nama skrip untuk alert otomatis 24 jam ke Telegram.')
    } catch (x: any) {
      setProtectedMsg('⚠️ ' + String(x?.message || x).slice(0, 120))
    } finally { setProtectedBusy(null) }
  }, [protectedBusy, activeProtected])

  return (
    <div className="space-y-2">
      {/* ---------- Toolbar atas (di luar canvas — tidak menutupi UI Vela) ---------- */}
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <div className="text-[11px] text-white/40 flex items-center gap-1.5">
          <span className="inline-block w-1.5 h-1.5 rounded-full bg-purple-400 animate-pulse" />
          Luxtradee Trading Terminal · Forex · Gold · US100 · Crypto · data live
        </div>
        <div className="flex items-center gap-1.5">
          {pineQuota && (
            <span className="text-[10px] px-2 py-0.5 rounded-full border border-white/10 bg-white/5 text-white/60">
              📐 {quotaLabel(pineQuota, 'edit')}
            </span>
          )}
          {alertQuota && (
            <span className="text-[10px] px-2 py-0.5 rounded-full border border-white/10 bg-white/5 text-white/60">
              🔔 {quotaLabel(alertQuota, 'alert')}
            </span>
          )}
          <Button size="sm" variant="outline" className="text-xs h-8" onClick={() => { setPineOpen((v) => !v); setAlertOpen(false) }}>
            <ScrollText className="w-3.5 h-3.5 mr-1" /> Pine Script
          </Button>
          <Button size="sm" variant="outline" className="text-xs h-8" onClick={() => { setAlertOpen((v) => !v); setPineOpen(false) }}>
            <Bell className="w-3.5 h-3.5 mr-1" /> Alert TG
          </Button>
        </div>
      </div>

      {/* ---------- Indikator preset Luxtradee — free 1 · pro 3 ---------- */}
      <div className="flex items-center gap-1.5 flex-wrap">
        <span className="text-[10px] uppercase tracking-wider text-white/35">Indikator</span>
        {PINE_PRESETS.map((p, i) => {
          const short = p.name.replace('Luxtradee — ', '')
          const locked = !isProUser && i >= FREE_INDICATOR_LIMIT
          if (locked) {
            return (
              <button key={p.name}
                onClick={() => setUpgradeMsg(lockedPresetMsg(i))}
                className="text-[11px] px-2.5 py-1.5 rounded-full border border-white/10 bg-white/[0.03] text-white/35 hover:text-white/60 hover:border-white/20 transition-colors inline-flex items-center gap-1 min-h-[32px]"
                aria-label={`${short} — khusus Pro, klik untuk info upgrade`}>
                🔒 {short} <span className="text-[9px] font-bold text-amber-300/80">PRO</span>
              </button>
            )
          }
          const active = !!activePresets[i]
          return (
            <button key={p.name} onClick={() => runPreset(i)} disabled={presetBusy !== null}
              className={`text-[11px] px-2.5 py-1.5 rounded-full border transition-colors inline-flex items-center gap-1 min-h-[32px] disabled:opacity-50 ${active ? 'border-purple-400/40 bg-purple-400/15 text-purple-200' : 'border-white/10 bg-white/[0.03] text-white/70 hover:bg-white/10 hover:text-white'}`}
              aria-label={`Tambah ${short} ke chart`}>
              {active ? '✓' : '+'} {short}
            </button>
          )
        })}
        {presetMsg && (
          <span className={`text-[10.5px] ${presetMsg.startsWith('✅') ? 'text-emerald-300/80' : 'text-red-300/80'}`}>{presetMsg}</span>
        )}
      </div>

      {/* ---------- Indikator Eksklusif (Protected Pine® — Pro) ----------
          Skrip master Bos: source tak pernah ke browser, user hanya
          melihat garis + sinyal. Free melihat chip terkunci. */}
      {protectedScripts.length > 0 && (
        <div className="flex items-center gap-1.5 flex-wrap">
          <span className="text-[10px] uppercase tracking-wider text-purple-300/50">Eksklusif</span>
          {protectedScripts.map((s) => {
            const isDefaultScript = s.slug === DEFAULT_PINE_SLUG
            const active = !!activeProtected[s.id] || (isDefaultScript && !!activeProtected[DEFAULT_PINE_SLUG])
            /* Free: skrip DEFAULT tetap bisa dilihat (permintaan Bos),
               skrip eksklusif lain tetap terkunci → paywall. */
            if (!protectedIsPro && !isDefaultScript) {
              return (
                <button key={s.id}
                  onClick={() => setUpgradeMsg(`🛡️ ${s.name} adalah indikator EKSKLUSIF member Pro. Source code dijamin aman (tidak pernah dikirim ke browser) — kamu hanya melihat garis & sinyal Entry/SL/TP-nya di chart, plus alert otomatis ke Telegram. Upgrade ke Pro (Rp39rb/bulan) untuk mengaktifkannya!`)}
                  className="text-[11px] px-2.5 py-1.5 rounded-full border border-white/10 bg-white/[0.03] text-white/35 hover:text-white/60 hover:border-white/20 transition-colors inline-flex items-center gap-1 min-h-[32px]"
                  aria-label={`${s.name} — khusus Pro, klik untuk info upgrade`}>
                  🔒 {s.name} <span className="text-[9px] font-bold text-purple-300/80">PRO</span>
                </button>
              )
            }
            const hasSub = alertSubs.some((x) => x.scriptId === s.id && x.enabled)
            return (
              <span key={s.id} className={`inline-flex items-stretch rounded-full border overflow-hidden min-h-[32px] ${active ? 'border-purple-400/40 bg-purple-400/15' : 'border-purple-400/20 bg-purple-400/[0.06]'}`}>
                <button onClick={() => addProtected(s)} disabled={protectedBusy === s.id}
                  className={`text-[11px] pl-2.5 pr-2 py-1.5 inline-flex items-center gap-1 transition-colors disabled:opacity-50 ${active ? 'text-purple-200' : 'text-purple-100/80 hover:text-white'}`}
                  aria-label={`Aktifkan ${s.name} (indikator terproteksi)`}
                  title={s.description || s.name}>
                  {protectedBusy === s.id ? <Loader2 className="w-3 h-3 animate-spin" /> : active ? '✓' : isDefaultScript ? '⚡' : '🛡️'} {s.name}
                </button>
                <span className="w-px bg-purple-400/20" aria-hidden="true" />
                <button onClick={() => {
                  /* Free → paywall: notifikasi sinyal khusus Pro */
                  if (!protectedIsPro) {
                    setUpgradeMsg(`🔔 Alert otomatis sinyal ${s.name} ke Telegram adalah fitur PRO. Kamu tetap bisa melihat garis & sinyalnya di chart secara gratis — upgrade ke Pro (Rp39rb/bulan) untuk menerima notifikasi Entry/SL/TP otomatis 24 jam!`)
                    return
                  }
                  openAlertDialog(s)
                }}
                  className="relative px-2 inline-flex items-center text-purple-100/80 hover:bg-purple-400/15 hover:text-white transition-colors"
                  aria-label={`Alert otomatis 24 jam untuk ${s.name} — klik untuk mengaktifkan`}
                  title="Alert otomatis 24 jam — sinyal Entry/SL/TP ke Telegram">
                  <Bell className="w-3 h-3" />
                  {hasSub && <span className="absolute top-1 right-0.5 w-1.5 h-1.5 rounded-full bg-emerald-400" aria-hidden="true" />}
                </button>
              </span>
            )
          })}
          {protectedMsg && (
            <span className={`text-[10.5px] ${protectedMsg.startsWith('🛡️') || protectedMsg.startsWith('✅') ? 'text-emerald-300/80' : 'text-red-300/80'}`}>{protectedMsg}</span>
          )}
        </div>
      )}

      {/* ---------- Vela workspace ---------- */}
      <div className="relative rounded-2xl border border-white/10 bg-[#05070d] overflow-hidden">
        <div ref={hostRef} style={{ height: autoH || height }} className="w-full" />

        {booting && (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-[#05070d] gap-2">
            <Loader2 className="w-7 h-7 text-purple-400 animate-spin" />
            <div className="text-white/50 text-xs">Menyalakan mesin chart…</div>
          </div>
        )}
        {bootError && (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-[#05070d] gap-2 p-6 text-center">
            <TriangleAlert className="w-8 h-8 text-red-400" />
            <div className="text-white text-sm font-semibold">Chart gagal dimuat</div>
            <div className="text-white/50 text-xs max-w-md">{bootError}</div>
            <Button size="sm" variant="outline" className="mt-1" onClick={() => window.location.reload()}>
              Muat ulang
            </Button>
          </div>
        )}

        {/* ---------- Badge: trade dari Riwayat/Jurnal dimuat ke chart ---------- */}
        {tradeHighlightMsg && (
          <div className="absolute left-2 top-2 z-30 max-w-[85%] rounded-lg border border-sky-400/30 bg-sky-400/10 backdrop-blur px-2.5 py-1.5 text-[11px] text-sky-100 shadow-lg" role="status">
            {tradeHighlightMsg}
          </div>
        )}

        {/* ---------- Drawer: Pine Script editor ---------- */}
        {pineOpen && (
          <div className="absolute right-2 top-2 bottom-2 w-[min(92vw,380px)] z-30 flex flex-col rounded-xl border border-white/10 bg-[#0a0f16]/95 backdrop-blur shadow-2xl">
            <div className="flex items-center justify-between px-3 py-2 border-b border-white/10">
              <div className="text-xs font-semibold text-purple-300">📐 Pine Script® Editor</div>
              <button className="text-white/40 hover:text-white" onClick={() => setPineOpen(false)} aria-label="Tutup editor"><X className="w-4 h-4" /></button>
            </div>
            <div className="px-3 py-2 space-y-2 flex-1 min-h-0 flex flex-col">
              <input
                value={pineName} onChange={(e) => setPineName(e.target.value)}
                placeholder="Nama skrip"
                className="w-full text-xs bg-black/40 border border-white/10 rounded-lg px-2.5 py-2 text-white/90 outline-none focus:border-purple-400/40"
              />
              <textarea
                value={pineSource} onChange={(e) => setPineSource(e.target.value)}
                spellCheck={false}
                className="w-full flex-1 min-h-[160px] text-[11.5px] leading-relaxed font-mono bg-black/40 border border-white/10 rounded-lg px-2.5 py-2 text-purple-100/90 outline-none focus:border-purple-400/40 resize-none kscroll"
              />
              {pineMsg && (
                <div className={`text-[11px] rounded-lg px-2.5 py-1.5 border ${pineMsg.kind === 'ok' ? 'border-emerald-400/30 bg-emerald-400/10 text-emerald-200' : 'border-red-400/30 bg-red-400/10 text-red-200'}`}>
                  {pineMsg.text}
                </div>
              )}
              <Button size="sm" className="w-full bg-purple-600 hover:bg-purple-500 text-white font-semibold" disabled={pineBusy} onClick={pineSave}>
                {pineBusy ? <Loader2 className="w-4 h-4 animate-spin" /> : '▶ Save / Compile ke Chart'}
              </Button>
              {pineQuota && !pineQuota.isPro && (
                <div className="text-[10px] text-white/40 leading-relaxed">
                  Paket gratis: 2× edit/bulan · terpakai {pineQuota.used}. Pro = tanpa batas (Rp39rb/bulan).
                </div>
              )}
              {pineScripts.length > 0 && (
                <div className="min-h-0 overflow-y-auto kscroll space-y-1">
                  <div className="text-[10px] text-white/40 uppercase tracking-wider">Skrip tersimpan</div>
                  {pineScripts.map((s) => (
                    <button key={s.id} onClick={() => { setPineName(s.name); setPineSource(s.source) }}
                      className="w-full text-left text-[11px] px-2 py-1.5 rounded-lg border border-white/5 bg-white/5 hover:bg-white/10 text-white/70 truncate">
                      📄 {s.name}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* ---------- Drawer: Alert Telegram ---------- */}
        {alertOpen && (
          <div className="absolute right-2 top-2 w-[min(92vw,340px)] z-30 rounded-xl border border-white/10 bg-[#0a0f16]/95 backdrop-blur shadow-2xl">
            <div className="flex items-center justify-between px-3 py-2 border-b border-white/10">
              <div className="text-xs font-semibold text-sky-300">🔔 Alert → Telegram Bot</div>
              <button className="text-white/40 hover:text-white" onClick={() => setAlertOpen(false)} aria-label="Tutup alert"><X className="w-4 h-4" /></button>
            </div>
            <div className="px-3 py-2 space-y-2">
              <textarea
                value={alertMsg} onChange={(e) => setAlertMsg(e.target.value)}
                placeholder="Contoh: XAUUSD tembus 2350 — cek setup long!"
                className="w-full h-20 text-[11.5px] bg-black/40 border border-white/10 rounded-lg px-2.5 py-2 text-white/90 outline-none focus:border-sky-400/40 resize-none"
              />
              {alertResult && (
                <div className={`text-[11px] rounded-lg px-2.5 py-1.5 border ${alertResult.kind === 'ok' ? 'border-emerald-400/30 bg-emerald-400/10 text-emerald-200' : 'border-red-400/30 bg-red-400/10 text-red-200'}`}>
                  {alertResult.text}
                </div>
              )}
              <Button size="sm" className="w-full bg-sky-500 hover:bg-sky-400 text-black font-semibold" disabled={alertBusy || !alertMsg.trim()} onClick={alertSend}>
                {alertBusy ? <Loader2 className="w-4 h-4 animate-spin" /> : <><Send className="w-3.5 h-3.5 mr-1" /> Kirim Alert</>}
              </Button>
              {alertQuota && !alertQuota.isPro && (
                <div className="text-[10px] text-white/40 leading-relaxed">
                  Paket gratis: 2 alert/hari · terpakai {alertQuota.used}. Pro = tanpa batas.
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* ---------- Dialog paywall upgrade ---------- */}
      <Dialog open={!!upgradeMsg} onOpenChange={(v) => !v && setUpgradeMsg(null)}>
        <DialogContent className="max-w-sm bg-[#0a0f16] border-white/10">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-amber-300">
              <GraduationCap className="w-5 h-5" /> Batas Gratis Tercapai
            </DialogTitle>
            <DialogDescription className="text-white/70 text-sm leading-relaxed pt-1">
              {upgradeMsg}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="outline" size="sm" onClick={() => setUpgradeMsg(null)}>Nanti saja</Button>
            <Button size="sm" className="bg-amber-400 hover:bg-amber-300 text-black font-semibold" onClick={() => { window.location.href = '/#pricing' }}>
              Upgrade ke Pro
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ---------- Dialog: Alert otomatis Pine (klik 🔔) ---------- */}
      <Dialog open={!!alertDlg} onOpenChange={(v) => !v && setAlertDialog(null)}>
        <DialogContent className="max-w-sm bg-[#0a0f16] border-white/10 max-h-[85vh] overflow-y-auto kscroll">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-sky-300 text-base">
              <Bell className="w-4 h-4" /> Alert Otomatis — {alertDlg?.name}
            </DialogTitle>
            <DialogDescription className="text-white/60 text-xs leading-relaxed pt-0.5">
              Sinyal Entry/SL/TP skrip ini dicek server tiap 5 menit & dikirim ke Telegram — tanpa buka chart.
            </DialogDescription>
          </DialogHeader>

          {alertTgBound === false && (
            <div className="rounded-lg border border-amber-400/30 bg-amber-400/10 px-3 py-2 text-[11px] text-amber-200 flex items-center justify-between gap-2">
              <span>Telegram belum terhubung — alert tidak bisa terkirim.</span>
              <a href="/dashboard/settings/telegram" className="underline font-semibold whitespace-nowrap">Hubungkan</a>
            </div>
          )}

          <div className="space-y-2">
            <div className="flex gap-2">
              <input
                value={alertSymbol}
                onChange={(e) => setAlertSymbol(e.target.value.toUpperCase())}
                placeholder="SIMBOL (mis. XAUUSD)"
                aria-label="Simbol alert"
                className="flex-1 min-w-0 text-xs bg-black/40 border border-white/10 rounded-lg px-2.5 py-2 text-white/90 outline-none focus:border-sky-400/40"
              />
              <select
                value={alertInterval}
                onChange={(e) => setAlertInterval(e.target.value)}
                aria-label="Timeframe alert"
                className="text-xs bg-black/40 border border-white/10 rounded-lg px-2 py-2 text-white/90 outline-none focus:border-sky-400/40"
              >
                {ALERT_TFS.map((t) => (
                  <option key={t.v} value={t.v} className="bg-[#0a0f16]">{t.label}</option>
                ))}
              </select>
            </div>
            <Button
              size="sm"
              className="w-full bg-sky-500 hover:bg-sky-400 text-black font-semibold"
              disabled={alertSaving || !alertDlg || alertSymbol.trim().length < 3}
              onClick={() => alertDlg && saveAlertSub({ scriptId: alertDlg.id, symbol: alertSymbol.trim(), interval: alertInterval, enabled: true, withTest: true })}
            >
              {alertSaving
                ? <Loader2 className="w-4 h-4 animate-spin" />
                : <>Aktifkan {alertSymbol.trim() || 'Alert'} · {ALERT_TFS.find((t) => t.v === alertInterval)?.label}</>}
            </Button>
            {alertDlgMsg && (
              <div className={`text-[11px] rounded-lg px-2.5 py-1.5 border ${alertDlgMsg.kind === 'ok' ? 'border-emerald-400/30 bg-emerald-400/10 text-emerald-200' : alertDlgMsg.kind === 'warn' ? 'border-amber-400/30 bg-amber-400/10 text-amber-200' : 'border-red-400/30 bg-red-400/10 text-red-200'}`}>
                {alertDlgMsg.text}
              </div>
            )}
          </div>

          {alertDlg && alertSubs.filter((s) => s.scriptId === alertDlg.id).length > 0 && (
            <div className="space-y-1">
              <div className="text-[10px] text-white/40 uppercase tracking-wider">Langganan skrip ini</div>
              <div className="max-h-40 overflow-y-auto kscroll space-y-1 pr-0.5">
                {alertSubs.filter((s) => s.scriptId === alertDlg.id).map((s) => (
                  <div key={s.id} className="flex items-center gap-1.5 rounded-lg border border-white/5 bg-white/5 px-2 py-1.5">
                    <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${s.enabled ? 'bg-emerald-400' : 'bg-white/20'}`} aria-hidden="true" />
                    <span className="text-[11px] text-white/80 flex-1 truncate">{s.symbol} · {s.interval}</span>
                    <button
                      onClick={() => testAlertSub(s)}
                      disabled={alertSaving}
                      className="text-[10px] px-1.5 py-0.5 rounded border border-sky-400/30 text-sky-200/90 hover:bg-sky-400/15 disabled:opacity-50"
                      title="Jalankan pengecekan sinyal sekarang"
                    >⚡ Test</button>
                    <button
                      onClick={() => saveAlertSub({ scriptId: s.scriptId, symbol: s.symbol, interval: s.interval, enabled: !s.enabled })}
                      disabled={alertSaving}
                      className="text-[10px] px-1.5 py-0.5 rounded border border-white/10 text-white/60 hover:text-white disabled:opacity-50"
                    >{s.enabled ? 'Matikan' : 'Nyalakan'}</button>
                    <button onClick={() => deleteAlertSub(s.id)} disabled={alertSaving} aria-label={`Hapus langganan ${s.symbol} ${s.interval}`} className="text-white/35 hover:text-red-300 disabled:opacity-50">
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}
