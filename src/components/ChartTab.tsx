'use client'

/**
 * ============================================================
 * ChartTab — 100% TRADINGVIEW (direktif Bos 2026-11-11)
 * ============================================================
 * Bos: "vela lab hapus aja, ganti semuanya ke tradingview mulai
 * dari pine alert dan gedein dikit chartnya."
 *
 * Revisi Bos (11-11, tahap kedua): "untuk marketing dan promosi
 * pine di website semuanya dihapus dulu, biarin chart di
 * websiteku kek gitu, alert pine hapus aja dulu" →
 *   - Tombol "Buat Alert" + AlertCreatorModal DIHAPUS (mesin alert
 *     ala Pine + alert indikator RSI/EMA/MACD dinonaktifkan sampai
 *     waktu yang tidak ditentukan — Bos coba Pine sendiri dulu).
 *   - Alert level harga tetap ada lewat Watchlist (target harga →
 *     cron /api/cron/price-alerts) — tidak tersentuh.
 *   - Yang tersisa: chart TradingView murni (tv.js, daftar
 *     awesome-tradingview). Data feed ditarik LANGSUNG oleh chart
 *     TradingView (OANDA / FX / NASDAQ / BINANCE) di browser user —
 *     bukan lewat /api/candles milik server Luxtradee — sehingga
 *     masalah 503/422 upstream tidak menyentuh chart lagi.
 *   - Chart DIGEDEIN: 85vh (sebelumnya 70vh).
 *
 * Pemilihan simbol & timeframe disimpan di localStorage.
 * ============================================================
 */

import dynamic from 'next/dynamic'
import { useCallback, useEffect, useRef, useState } from 'react'
import { TrendingUp, Maximize2, Minimize2, Lock, Unlock } from 'lucide-react'
import { TV_WIDGET_SYMBOLS } from '@/components/tradingview/TradingViewChart'

const TradingViewChartClient = dynamic(() => import('@/components/tradingview/TradingViewChart'), {
  ssr: false, // tv.js menyentuh window/document — wajib client-only
  loading: () => (
    <div className="flex items-center justify-center h-full rounded-2xl border border-white/5 bg-white/[0.02]">
      <div className="flex flex-col items-center gap-2">
        <div className="w-6 h-6 border-2 border-purple-400 border-t-transparent rounded-full animate-spin" />
        <span className="text-white/40 text-xs">Memuat chart TradingView…</span>
      </div>
    </div>
  ),
})

/* ---------- Chip simbol (kanonik → label tampilan) ---------- */
const SYMBOL_CHIPS: Array<{ id: string; label: string }> = [
  { id: 'XAUUSD', label: 'XAU/USD' },
  { id: 'XAGUSD', label: 'XAG/USD' },
  { id: 'EURUSD', label: 'EUR/USD' },
  { id: 'GBPUSD', label: 'GBP/USD' },
  { id: 'USDJPY', label: 'USD/JPY' },
  { id: 'GBPJPY', label: 'GBP/JPY' },
  { id: 'AUDUSD', label: 'AUD/USD' },
  { id: 'US100', label: 'US100' },
  { id: 'BTCUSDT', label: 'BTC/USDT' },
  { id: 'ETHUSDT', label: 'ETH/USDT' },
  { id: 'SOLUSDT', label: 'SOL/USDT' },
]

/* ---------- Chip timeframe (kanonik) ---------- */
const TF_CHIPS: Array<{ id: string; label: string }> = [
  { id: '5m', label: '5m' },
  { id: '15m', label: '15m' },
  { id: '30m', label: '30m' },
  { id: '1h', label: '1H' },
  { id: '4h', label: '4H' },
  { id: '1d', label: '1D' },
  { id: '1w', label: '1W' },
]

const LS_SYM = 'lux:chart-symbol'
const LS_TF = 'lux:chart-tf'

/* TabContent lama masih mem-passing `isPro` — diterima tapi tak dipakai. */
export default function ChartTab({ isPro: _isPro }: { isPro?: boolean } = {}) {
  const [symbol, setSymbol] = useState('XAUUSD')
  const [tf, setTf] = useState('15m')
  const [hydrated, setHydrated] = useState(false)
  /* MODE FOKUS — dua jalur (laporan Bos 13-11: "mau bikin garis make tool
     tradingview website gerak-gerak jadi gabisa narik garis"):
     1. Native fullscreen (desktop/Android) via requestFullscreen.
     2. FALLBACK CSS — Safari iPhone TIDAK PUNYA Fullscreen API, tombol lama
        diam-diam gagal (catch menelan error). Sekarang: wrapper dipaku
        position:fixed inset:0 → chart mengisi satu layar penuh di iPhone. */
  const shellRef = useRef<HTMLDivElement | null>(null)
  const [isFullscreen, setIsFullscreen] = useState(false)
  const [cssFullscreen, setCssFullscreen] = useState(false)
  /* KUNCI GESER — saat aktif halaman DIBEKUKAN (overflow hidden + position
     fixed, resep scroll-lock iOS) dan wrapper chart dapat touch-action:none →
     drag di chart TIDAK lagi menyeret halaman, garis bisa ditarik dengan
     fokus. Otomatis aktif selama mode fokus. */
  const [gestureLock, setGestureLock] = useState(false)
  const lockPage = gestureLock || cssFullscreen || isFullscreen

  /* AUTO-KUNCI di perangkat SENTUH (laporan Bos 14-11: "masih gabisa
     narik garis") — dulu Kunci Geser harus dinyalakan manual, Bos tidak
     tahu/ketemu tombolnya. Sekarang di HP/tablet kunci langsung ON begitu
     tab chart dibuka: chart sudah mengisi ±85vh, halaman memang jarang
     perlu di-scroll saat menggambar. Bisa dimatikan manual lewat tombol
     yang sama. Desktop (mouse) tidak dibekukan. */
  const autoLockTried = useRef(false)
  useEffect(() => {
    if (autoLockTried.current) return
    autoLockTried.current = true
    try {
      const coarse = window.matchMedia?.('(pointer: coarse)')?.matches ?? false
      const touch = 'ontouchstart' in window || (navigator.maxTouchPoints ?? 0) > 0
      if (coarse || touch) setGestureLock(true)
    } catch { /* diam — pakai default tidak dikunci */ }
  }, [])

  /* overscroll-behavior: contain permanen di scroller dashboard selama tab
     chart terpasang — memutus scroll-chaining dari iframe TradingView ke
     halaman induk (sumber "website gerak sendiri" di iOS). */
  useEffect(() => {
    const main = document.getElementById('main-content')
    if (!main) return
    const prev = main.style.overscrollBehavior ?? ''
    main.style.overscrollBehavior = 'contain'
    return () => { main.style.overscrollBehavior = prev }
  }, [])

  useEffect(() => {
    const onChange = () => setIsFullscreen(Boolean(document.fullscreenElement))
    document.addEventListener('fullscreenchange', onChange)
    return () => document.removeEventListener('fullscreenchange', onChange)
  }, [])

  /* ESC untuk keluar dari fallback fullscreen CSS (desktop) */
  useEffect(() => {
    if (!cssFullscreen) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setCssFullscreen(false)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [cssFullscreen])

  /* Scroll-lock iOS: html/body overflow hidden + body position fixed dengan
     top = -scrollY → halaman BENAR-BENAR tidak bisa bergeser (overflow:hidden
     saja sering diabaikan Safari iPhone), posisi scroll dipulihkan saat
     dilepas. Jalan selama mode fokus maupun kunci geser manual.

     FIX (laporan Bos 14-11: masih gabisa narik garis): dulu cuma html/body
     yang dibekukan — padahal scroller yang sesungguhnya di dashboard ini
     adalah <main id="main-content" class="overflow-auto">. Sentuhan yang
     tidak dikonsumsi iframe TradingView di-chain jadi scroll ke elemen ini
     → halaman tetap ikut bergeser. Kini main juga diberi overflow:hidden
     + overscroll-behavior:none selama kunci aktif. */
  useEffect(() => {
    if (!lockPage || typeof document === 'undefined') return
    const html = document.documentElement
    const body = document.body
    const main = document.getElementById('main-content')
    const prevScrollY = window.scrollY
    const prevMainOverflow = main?.style.overflow ?? ''
    const prevMainOverscroll = main?.style.overscrollBehavior ?? ''
    html.style.overflow = 'hidden'
    body.style.overflow = 'hidden'
    body.style.position = 'fixed'
    body.style.left = '0'
    body.style.right = '0'
    body.style.width = '100%'
    body.style.top = `-${prevScrollY}px`
    if (main) {
      main.style.overflow = 'hidden'
      main.style.overscrollBehavior = 'none'
    }
    return () => {
      html.style.overflow = ''
      body.style.overflow = ''
      body.style.position = ''
      body.style.left = ''
      body.style.right = ''
      body.style.width = ''
      body.style.top = ''
      if (main) {
        main.style.overflow = prevMainOverflow
        main.style.overscrollBehavior = prevMainOverscroll
      }
      window.scrollTo(0, prevScrollY)
    }
  }, [lockPage])

  const toggleFullscreen = useCallback(() => {
    if (document.fullscreenElement) {
      void document.exitFullscreen().catch(() => {})
      return
    }
    if (cssFullscreen) {
      setCssFullscreen(false)
      return
    }
    const el = shellRef.current
    if (!el) return
    const anyEl = el as HTMLDivElement & { webkitRequestFullscreen?: () => void }
    try {
      if (el.requestFullscreen) {
        el.requestFullscreen().catch(() => setCssFullscreen(true))
      } else if (typeof anyEl.webkitRequestFullscreen === 'function') {
        anyEl.webkitRequestFullscreen() // iPad; iPhone Safari tidak punya
      } else {
        setCssFullscreen(true) // iPhone → fallback CSS fullscreen
      }
    } catch {
      setCssFullscreen(true)
    }
  }, [cssFullscreen])

  /* Pulihkan pilihan terakhir user (tanpa hydration mismatch: state
     default server = XAUUSD/15m, pembacaan localStorage di mount) */
  useEffect(() => {
    try {
      const s = localStorage.getItem(LS_SYM)
      if (s && TV_WIDGET_SYMBOLS[s]) setSymbol(s)
      const t = localStorage.getItem(LS_TF)
      if (t && TF_CHIPS.some((c) => c.id === t)) setTf(t)
      /* Bersihkan key mode lama (Vela Lab sudah dihapus) */
      localStorage.removeItem('lux:chart-mode')
    } catch { /* storage non-aktif — pakai default */ }
    setHydrated(true)
  }, [])

  useEffect(() => {
    if (!hydrated) return
    try { localStorage.setItem(LS_SYM, symbol) } catch { /* diam */ }
  }, [symbol, hydrated])

  useEffect(() => {
    if (!hydrated) return
    try { localStorage.setItem(LS_TF, tf) } catch { /* diam */ }
  }, [tf, hydrated])

  const activeTvSymbol = TV_WIDGET_SYMBOLS[symbol] || `OANDA:${symbol}`

  return (
    <div className="space-y-4">
      {/* ---------- Header ---------- */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-2xl font-bold flex items-center gap-2">
            <TrendingUp className="w-6 h-6 text-purple-400" />
            Luxtradee Trading Terminal
          </h2>
          <p className="text-white/60 text-sm">
            Chart &amp; data feed resmi <span className="text-white/80 font-medium">TradingView</span> — indikator, drawing tools &amp; alert lengkap di dalam chart
          </p>
        </div>

        {/* Kontrol fokus & kunci geser */}
        <div className="flex shrink-0 flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => setGestureLock((v) => !v)}
            className={`inline-flex items-center gap-2 rounded-xl border px-4 py-2.5 text-xs font-semibold transition-colors min-h-[44px] ${
              gestureLock
                ? 'bg-emerald-500/20 border-emerald-400/40 text-emerald-200 hover:bg-emerald-500/30'
                : 'bg-white/[0.04] border-white/15 text-white/60 hover:bg-white/10 hover:text-white/90'
            }`}
            title={gestureLock
              ? 'Halaman terkunci — matikan ini kalau mau scroll halaman lagi'
              : 'Kunci halaman supaya tidak ikut bergeser saat menggambar garis di chart (penting di iPhone/Android)'}
          >
            {gestureLock ? <Lock className="w-4 h-4" /> : <Unlock className="w-4 h-4" />}
            {gestureLock ? 'Halaman Terkunci' : 'Kunci Geser'}
          </button>
          <button
            type="button"
            onClick={toggleFullscreen}
            className="inline-flex shrink-0 items-center gap-2 rounded-xl bg-purple-500/20 border border-purple-400/30 px-4 py-2.5 text-xs font-semibold text-purple-200 hover:bg-purple-500/30 hover:text-purple-100 transition-colors min-h-[44px]"
            title={isFullscreen || cssFullscreen ? 'Keluar dari mode fokus (ESC)' : 'Mode fokus — chart penuh 1 layar, bebas gangguan untuk menggambar'}
          >
            {isFullscreen || cssFullscreen ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
            {isFullscreen || cssFullscreen ? 'Keluar Fokus' : 'Mode Fokus'}
          </button>
        </div>
      </div>

      {/* ---------- Shell: bar simbol/TF + chart (satuan fullscreen) ---------- */}
      <div
        ref={shellRef}
        className={
          cssFullscreen
            ? 'fixed inset-0 z-[9999] bg-[#07070c] p-3 flex flex-col gap-3 overflow-hidden'
            : 'rounded-2xl border border-white/10 bg-[#07070c] p-3 space-y-3'
        }
        style={isFullscreen ? { height: '100vh', borderRadius: 0, overflow: 'hidden' } : undefined}
      >
        {cssFullscreen && (
          <div className="flex items-center justify-between shrink-0">
            <span className="text-xs font-semibold text-white/70">
              Mode Fokus — chart penuh satu layar
            </span>
            <button
              type="button"
              onClick={toggleFullscreen}
              className="inline-flex items-center gap-2 rounded-lg bg-purple-500/20 border border-purple-400/30 px-3 py-2 text-xs font-semibold text-purple-200 hover:bg-purple-500/30 min-h-[40px]"
            >
              <Minimize2 className="w-4 h-4" />
              Keluar Fokus
            </button>
          </div>
        )}
        <div className="rounded-2xl border border-white/10 bg-white/[0.02] p-3 space-y-2">
          <div className="flex items-center gap-2">
            <span className="text-[10px] uppercase tracking-wider text-white/40 font-semibold w-12 shrink-0">Simbol</span>
            <div className="flex gap-1.5 overflow-x-auto pb-1 flex-1 [scrollbar-width:thin]">
              {SYMBOL_CHIPS.map((c) => (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => setSymbol(c.id)}
                  aria-pressed={symbol === c.id}
                  className={`shrink-0 rounded-lg px-2.5 py-1.5 text-xs font-semibold transition-colors border min-h-[32px] ${
                    symbol === c.id
                      ? 'bg-purple-500/20 text-purple-200 border-purple-400/40'
                      : 'bg-white/[0.03] text-white/60 border-white/10 hover:bg-white/10 hover:text-white/90'
                  }`}
                >
                  {c.label}
                </button>
              ))}
            </div>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-[10px] uppercase tracking-wider text-white/40 font-semibold w-12 shrink-0">TF</span>
            <div className="flex gap-1.5 overflow-x-auto pb-1 flex-1 [scrollbar-width:thin]">
              {TF_CHIPS.map((c) => (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => setTf(c.id)}
                  aria-pressed={tf === c.id}
                  className={`shrink-0 rounded-lg px-2.5 py-1.5 text-xs font-semibold transition-colors border min-h-[32px] ${
                    tf === c.id
                      ? 'bg-purple-500/20 text-purple-200 border-purple-400/40'
                      : 'bg-white/[0.03] text-white/60 border-white/10 hover:bg-white/10 hover:text-white/90'
                  }`}
                >
                  {c.label}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* ---------- Widget chart resmi TradingView (DIGEDEIN: 85vh) ----------
            isolate + z-0: stacking context sendiri — tidak ada elemen halaman
            (banner/overlay) yang bisa menyela di atas iframe chart.
            select-none: drag di sekitar chart tidak ikut menyeleksi teks.
            touch-action none saat halaman terkunci → gesture sentuh di chart
            tidak menyeret halaman (laporan Bos 13-11).
            Mode fokus: tinggi menyesuaikan sisa layar supaya seluruh chart
            terlihat tanpa scroll. */}
        <div
          className={`relative isolate z-0 rounded-2xl border border-white/10 bg-[#0b0b12] overflow-hidden select-none ${cssFullscreen ? 'h-full' : ''}`}
          style={{ touchAction: lockPage ? 'none' : undefined }}
        >
          <div
            className={
              cssFullscreen
                ? 'h-full'
                : isFullscreen
                  ? 'h-[calc(100vh-150px)]'
                  : 'h-[85vh] min-h-[560px]'
            }
          >
            <TradingViewChartClient symbol={symbol} interval={tf} />
          </div>
        </div>
      </div>

      {/* ---------- Info mode ---------- */}
      <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:justify-between text-[11px] text-white/40">
        <p>
          Data feed: <span className="text-white/70 font-medium">TradingView</span> · {activeTvSymbol} · zona waktu Asia/Jakarta.
          Simbol lain bisa diketik langsung di kotak simbol chart.
        </p>
        <p>
          Di HP halaman otomatis <span className="text-emerald-300 font-semibold">terkunci</span> saat tab chart aktif —
          narik garis aman, halaman tidak ikut bergeser. Matikan lewat tombol <span className="text-emerald-300 font-semibold">Kunci Geser</span> kalau mau scroll,
          atau pakai <span className="text-purple-300 font-semibold">Mode Fokus</span> untuk chart penuh satu layar. Berfungsi juga di iPhone.
        </p>
      </div>
    </div>
  )
}
