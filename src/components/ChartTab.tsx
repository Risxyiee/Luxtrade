'use client'

/**
 * ============================================================
 * ChartTab — CHART RESMI TRADINGVIEW (direktif Bos 2026-11-11)
 * ============================================================
 * Bos: "chart dan semua elemen chartnya ganti ke
 * https://github.com/tradingview/awesome-tradingview — data chart
 * juga ambil disitu, mau xau kek gbpusd kek semua ambil darisitu."
 *
 * MODE "TradingView" (DEFAULT):
 *   Widget "Advanced Real-Time Chart" resmi (tv.js, daftar
 *   awesome-tradingview). Data feed ditarik LANGSUNG oleh chart
 *   TradingView (OANDA / FX / NASDAQ / BINANCE) di browser user —
 *   bukan lagi lewat /api/candles milik server Luxtradee — sehingga
 *   masalah 503 (TV WS ditolak IP datacenter, kuota
 *   TwelveData habis) tidak menyentuh chart lagi.
 *   Pemilihan simbol & timeframe tetap tampil ala Luxtradee, hasilnya
 *   dipetakan ke simbol TradingView (OANDA:XAUUSD, FX:GBPUSD, dst).
 *
 * MODE "Vela Lab" (lanjutan):
 *   Terminal lama dipertahankan untuk fitur eksklusif yang tidak
 *   bisa digantikan widget embed: Pine Script® editor + strategy
 *   tester, trade marker jurnal, garis Entry/SL/TP otomatis (🔔).
 *
 * Pilihan mode/simbol/timeframe disimpan di localStorage.
 * ============================================================
 */

import dynamic from 'next/dynamic'
import { useEffect, useState } from 'react'
import { TrendingUp, Radio, FlaskConical, ExternalLink } from 'lucide-react'
import TradingViewChart, { TV_WIDGET_SYMBOLS } from '@/components/tradingview/TradingViewChart'

const VelaChartTerminal = dynamic(() => import('@/components/VelaChartTerminal'), {
  ssr: false, // Vela menyentuh WebGL/canvas sejak konstruktor — wajib client-only
  loading: () => (
    <div className="flex items-center justify-center h-[420px] rounded-2xl border border-white/5 bg-white/[0.02]">
      <div className="flex flex-col items-center gap-2">
        <div className="w-6 h-6 border-2 border-purple-400 border-t-transparent rounded-full animate-spin" />
        <span className="text-white/40 text-xs">Memuat Vela Lab…</span>
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

/* Interval kanonik → format Vela (menit string / '1D' / '1W') */
const VELA_TF: Record<string, string> = {
  '5m': '5', '15m': '15', '30m': '30', '1h': '60',
  '2h': '120', '4h': '240', '1d': '1D', '1w': '1W',
}

const LS_MODE = 'lux:chart-mode'
const LS_SYM = 'lux:chart-symbol'
const LS_TF = 'lux:chart-tf'

/* TabContent lama masih mem-passing `isPro` — diterima tapi tak dipakai:
   kuota kini dicek SERVER-SIDE per-aksi (/api/pine/save & /api/compile-pine). */
export default function ChartTab({ isPro: _isPro }: { isPro?: boolean } = {}) {
  const [mode, setMode] = useState<'tv' | 'vela'>('tv')
  const [symbol, setSymbol] = useState('XAUUSD')
  const [tf, setTf] = useState('15m')
  const [hydrated, setHydrated] = useState(false)

  /* Pulihkan pilihan terakhir user (tanpa hydration mismatch: state
     default server = TV/XAUUSD/15m, pembacaan localStorage di mount) */
  useEffect(() => {
    try {
      const m = localStorage.getItem(LS_MODE)
      if (m === 'tv' || m === 'vela') setMode(m)
      const s = localStorage.getItem(LS_SYM)
      if (s && TV_WIDGET_SYMBOLS[s]) setSymbol(s)
      const t = localStorage.getItem(LS_TF)
      if (t && TF_CHIPS.some((c) => c.id === t)) setTf(t)
    } catch { /* storage non-aktif — pakai default */ }
    setHydrated(true)
  }, [])

  useEffect(() => {
    if (!hydrated) return
    try { localStorage.setItem(LS_MODE, mode) } catch { /* diam */ }
  }, [mode, hydrated])

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
      {/* ---------- Header + pilih mode ---------- */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-2xl font-bold flex items-center gap-2">
            <TrendingUp className="w-6 h-6 text-purple-400" />
            Luxtradee Trading Terminal
          </h2>
          <p className="text-white/60 text-sm">
            {mode === 'tv'
              ? <>Chart & data feed resmi <span className="text-white/80 font-medium">TradingView</span> — indikator & drawing tools lengkap di dalam chart</>
              : 'Vela Lab — Pine Script®, strategy tester, trade marker & garis alert'}
          </p>
        </div>

        {/* Toggle mode */}
        <div
          className="inline-flex shrink-0 rounded-xl border border-white/10 bg-white/[0.03] p-1"
          role="tablist"
          aria-label="Pilih mode chart"
        >
          <button
            type="button"
            role="tab"
            aria-selected={mode === 'tv'}
            onClick={() => setMode('tv')}
            className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-2 text-xs font-semibold transition-colors min-h-[36px] ${
              mode === 'tv'
                ? 'bg-purple-500/20 text-purple-200 border border-purple-400/30'
                : 'text-white/50 hover:text-white/80 hover:bg-white/5 border border-transparent'
            }`}
          >
            <Radio className="w-3.5 h-3.5" />
            TradingView
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={mode === 'vela'}
            onClick={() => setMode('vela')}
            className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-2 text-xs font-semibold transition-colors min-h-[36px] ${
              mode === 'vela'
                ? 'bg-purple-500/20 text-purple-200 border border-purple-400/30'
                : 'text-white/50 hover:text-white/80 hover:bg-white/5 border border-transparent'
            }`}
          >
            <FlaskConical className="w-3.5 h-3.5" />
            Vela Lab
          </button>
        </div>
      </div>

      {mode === 'tv' ? (
        <>
          {/* ---------- Bar simbol & timeframe (mode TradingView) ---------- */}
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

          {/* ---------- Widget chart resmi TradingView ---------- */}
          <div className="rounded-2xl border border-white/10 bg-[#0b0b12] overflow-hidden">
            <div className="h-[70vh] min-h-[440px]">
              <TradingViewChart symbol={symbol} interval={tf} />
            </div>
          </div>

          {/* ---------- Info mode ---------- */}
          <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:justify-between text-[11px] text-white/40">
            <p>
              Data feed: <span className="text-white/70 font-medium">TradingView</span> · {activeTvSymbol} · zona waktu Asia/Jakarta.
              Simbol lain bisa diketik langsung di kotak simbol chart.
            </p>
            <p className="flex items-center gap-1">
              Butuh Pine Script® / garis Entry-SL-TP otomatis? Pindah ke mode
              <button
                type="button"
                onClick={() => setMode('vela')}
                className="inline-flex items-center gap-1 text-purple-300 hover:text-purple-200 font-semibold underline underline-offset-2"
              >
                Vela Lab <ExternalLink className="w-3 h-3" />
              </button>
            </p>
          </div>
        </>
      ) : (
        /* ---------- Vela Lab (terminal lama — Pine/tester/alert tetap utuh) ---------- */
        <VelaChartTerminal defaultSymbol={symbol} defaultTimeframe={VELA_TF[tf] || '60'} />
      )}
    </div>
  )
}
