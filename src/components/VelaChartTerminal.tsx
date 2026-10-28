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
 * DATAFEED (Task 42 — bersih dari OANDA, spot-grade dulu):
 *   - Crypto (BTCUSDT, ETHUSDT, …)
 *       → BinanceProvider NATIVE bawaan paket @luxalgo/vela
 *         (REST + websocket publik Binance — datafeed standar)
 *   - Forex / Gold (XAUUSD) / Silver / Nasdaq (US100)
 *       → LuxtradeeForexProvider — interface DataProvider Vela
 *         yang sama; via /api/candles dengan rantai sumber:
 *         Twelve Data SPOT (XAU/USD dkk — paling dekat feed
 *         broker, TWELVE_DATA_API_KEY) → Yahoo keyless fallback
 *         (TANPA key Yahoo apa pun → chart tak pernah mati 401)
 *   Catatan: paket @luxalgo/vela hanya menyertakan provider
 *   crypto secara native (Binance/Coinbase/Hyperliquid); FX/
 *   Gold/US100 memakai port DataProvider yang sama, keyless.
 * - Pine Script®           : @luxalgo/vela-pinets (PineEngine)
 *                            + editor Save/Compile dengan kuota
 *                            FREE 2×/bulan (/api/pine/save)
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
import { Loader2, ScrollText, Bell, X, Send, GraduationCap, TriangleAlert } from 'lucide-react'

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

/* Cache plot per (scriptId, symbol, tf) — 45 detik. Refetch ringan
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
  let scriptId = ''
  let busy = false
  let lastEmit = 0

  const run = async (force: boolean) => {
    const c = ctx
    if (!c || !scriptId || busy) return
    /* simbol bisa berprefiks provider — buang sebelum ':'] */
    const sym = String(c.symbol || '').split(':').pop() || ''
    const tf = String(c.timeframe || '60')
    const ck = `${scriptId}:${sym.toUpperCase()}:${tf}`
    const cached = protectedPlotCache.get(ck)
    if (cached && Date.now() - cached.at < 45000) {
      emitProtectedPlots(c, cached.plots, scriptId)
      return
    }
    if (!force && Date.now() - lastEmit < 15000) return // anti-jitter live tick
    busy = true
    try {
      c.setStatus?.('loading')
      const res = await fetch('/api/compile-pine', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ scriptId, symbol: sym.toUpperCase(), interval: tf }),
      })
      if (res.ok) {
        const j: any = await res.json()
        if (Array.isArray(j?.plots) && j.plots.length) {
          protectedPlotCache.set(ck, { at: Date.now(), plots: j.plots })
          emitProtectedPlots(c, j.plots, scriptId)
          lastEmit = Date.now()
          c.setStatus?.('live')
          return
        }
      } else if (res.status === 403) {
        /* Pro kadaluarsa di tengah sesi — biarkan kosong; chip UI
           akan menutup akses pada pemakaian berikutnya */
      }
      c.setStatus?.('idle')
    } catch { try { c?.setStatus?.('idle') } catch {} }
    finally { busy = false }
  }

  return {
    start: (c: any, inputs: Record<string, any>) => {
      ctx = c; scriptId = String(inputs?.scriptId || ''); run(true)
    },
    onBars: () => { run(false) },
    onViewport: () => { /* tidak viewport-dependent */ },
    setInputs: (i: Record<string, any>) => {
      const s = String(i?.scriptId || '')
      if (s && s !== scriptId) { scriptId = s; run(true) }
    },
    suspend: () => { /* tetap hidup — data murah dari cache */ },
    resume: () => { run(false) },
    stop: () => { ctx = null },
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

interface PineScriptRow { id: string; name: string; source: string }
interface QuotaBadge { isPro: boolean; used: number; limit: number | null; remaining: number | null }

/**
 * Hitung tinggi auto-fit: chart mengisi VIEWPORT penuh — minus
 * header sticky dashboard (h-16) minus footer (bila ada) minus
 * jarak napas 28px. Diklem min 420px (mobile) / max 1800px
 * (monitor raksasa).
 *
 * FIX (keluhan Bos: "masih ada ruang kosong di bawah"): formula
 * lama mengurangi docTop (posisi chart di DOKUMEN, bisa ~900px)
 * dari innerHeight (VIEWPORT) → hasil negatif → selalu jatuh ke
 * min 420px. Formula baru tidak butuh docTop: begitu chart
 * di-scroll masuk, tepi bawahnya menempel di atas footer &
 * tepi atasnya mulus di bawah header sticky — gaya TradingView.
 */
function computeFitHeight(host: HTMLElement): string | null {
  try {
    const head = document.querySelector('header')
    const headH = head ? head.offsetHeight : 0
    const foot = document.querySelector('footer')
    const footH = foot ? foot.offsetHeight : 0
    const avail = window.innerHeight - headH - footH - 28
    return `${Math.round(Math.min(Math.max(avail, 420), 1800))}px`
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

  /* ---------- AUTO-FIT tinggi chart (Task 43) ----------
   * Keluhan Bos: chart max 640px menyisakan ruang kosong di bawah.
   * Solusi: ukur sisa ruang viewport riil
   *   (viewport − posisi atas chart − tinggi footer − jarak napas)
   * lalu pakai sebagai tinggi host.
   *
   * DUA PASUS — kunci anti-crash (error openTime saat Vela boot
   * kena resize container di tengah inisialisasi):
   *   Pass 1 useLayoutEffect: hitung & set tinggi SEBELUM effect
   *     boot Vela jalan → workspace lahir dengan ukuran final.
   *   Pass 2 (booting=false): ResizeObserver baru dipasang —
   *     adaptif banner PWA/promo muncul/hilang & viewport resize.
   * Tidak bisa loop: docTop & footer tidak bergantung pada tinggi
   * host, dan setState di-guard sama-nilai. Min 420px (mobile),
   * max 1800px (monitor raksasa). */
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

  /* ---------- Boot Vela workspace (sekali) ---------- */
  useEffect(() => {
    let dead = false
    ;(async () => {
      try {
        const [{ VelaWorkspace: WS }, { LuxtradeeForexProvider }, { BinanceProvider }, { PineEngine }, velaCore] = await Promise.all([
          import('@luxalgo/vela/workspace'),
          import('@/components/vela/LuxtradeeProvider'),
          import('@luxalgo/vela/providers/binance'),
          import('@luxalgo/vela-pinets'),
          import('@luxalgo/vela'),
        ])
        if (dead || !hostRef.current) return
        /* Native indicator untuk hasil Protected Pine (server-computed)
           — daftar SEBELUM chart dibuat supaya addNativeIndicator hidup */
        ensureProtectedNativeRegistered((velaCore as any).registerNativeIndicator)
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
          /* Datafeed (Task 42 — tanpa OANDA, tanpa API key):
             crypto → provider NATIVE bawaan Vela (websocket Binance);
             FX/Gold/Silver/US100 → feed keyless Luxtradee. */
          providers: {
            binance: () => new BinanceProvider(),          // native @luxalgo/vela
            luxtradee: () => new LuxtradeeForexProvider(), // keyless FX/Gold/US100
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
    } catch { /* belum login — badge disembunyikan */ }
  }, [])
  useEffect(() => { refreshQuotas() }, [refreshQuotas])

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

  /* ---------- Preset chip: tambah indikator Luxtradee ke chart ----------
     Free: 1 indikator (EMA 20/50). Pro: semua terbuka. Kuota nyata
     (alert & Pine edit) tetap dijaga server-side di API. */
  const isProUser = alertQuota?.isPro === true
  const runPreset = useCallback(async (i: number) => {
    if (presetBusy !== null) return
    setPresetBusy(i); setPresetMsg(null)
    const err = await runOnChart(PINE_PRESETS[i].script)
    const short = PINE_PRESETS[i].name.replace('Luxtradee — ', '')
    if (err) setPresetMsg(`⚠️ ${short}: ${err}`)
    else {
      setActivePresets((s) => ({ ...s, [i]: true }))
      setPresetMsg(`✅ ${short} tampil di chart.`)
    }
    setPresetBusy(null)
  }, [presetBusy, runOnChart])

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
    setProtectedBusy(s.id); setProtectedMsg(null)
    try {
      const chart: any = (wsRef.current as any)?.chart
      if (!chart) { setProtectedMsg('⚠️ Chart belum siap — coba lagi sebentar.'); return }
      if (typeof chart.addNativeIndicator !== 'function') {
        setProtectedMsg('⚠️ Terminal belum mendukung indikator eksklusif (update chart).'); return
      }
      chart.addNativeIndicator(PROTECTED_TYPE, { inputs: { scriptId: s.id } })
      setActiveProtected((m) => ({ ...m, [s.id]: true }))
      setProtectedMsg('🛡️ ' + s.name + ' tampil di chart — source tetap aman di server. Sinyal Entry/SL/TP otomatis ke Telegram.')
    } catch (x: any) {
      setProtectedMsg('⚠️ ' + String(x?.message || x).slice(0, 120))
    } finally { setProtectedBusy(null) }
  }, [protectedBusy])

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
            const active = !!activeProtected[s.id]
            if (!protectedIsPro) {
              return (
                <button key={s.id}
                  onClick={() => setUpgradeMsg(`🛡️ ${s.name} adalah indikator EKSKLUSIF member Pro. Source code dijamin aman (tidak pernah dikirim ke browser) — kamu hanya melihat garis & sinyal Entry/SL/TP-nya di chart, plus alert otomatis ke Telegram. Upgrade ke Pro (Rp39rb/bulan) untuk mengaktifkannya!`)}
                  className="text-[11px] px-2.5 py-1.5 rounded-full border border-white/10 bg-white/[0.03] text-white/35 hover:text-white/60 hover:border-white/20 transition-colors inline-flex items-center gap-1 min-h-[32px]"
                  aria-label={`${s.name} — khusus Pro, klik untuk info upgrade`}>
                  🔒 {s.name} <span className="text-[9px] font-bold text-purple-300/80">PRO</span>
                </button>
              )
            }
            return (
              <button key={s.id} onClick={() => addProtected(s)} disabled={protectedBusy === s.id}
                className={`text-[11px] px-2.5 py-1.5 rounded-full border transition-colors inline-flex items-center gap-1 min-h-[32px] disabled:opacity-50 ${active ? 'border-purple-400/40 bg-purple-400/15 text-purple-200' : 'border-purple-400/20 bg-purple-400/[0.06] text-purple-100/80 hover:bg-purple-400/15 hover:text-white'}`}
                aria-label={`Aktifkan ${s.name} (indikator terproteksi)`}
                title={s.description || s.name}>
                {protectedBusy === s.id ? <Loader2 className="w-3 h-3 animate-spin" /> : active ? '✓' : '🛡️'} {s.name}
              </button>
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
    </div>
  )
}
