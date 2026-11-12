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
import { useEffect, useState } from 'react'
import { TrendingUp } from 'lucide-react'
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
      </div>

      {/* ---------- Bar simbol & timeframe ---------- */}
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

      {/* ---------- Widget chart resmi TradingView (DIGEDEIN: 85vh) ---------- */}
      <div className="rounded-2xl border border-white/10 bg-[#0b0b12] overflow-hidden">
        <div className="h-[85vh] min-h-[560px]">
          <TradingViewChartClient symbol={symbol} interval={tf} />
        </div>
      </div>

      {/* ---------- Info mode ---------- */}
      <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:justify-between text-[11px] text-white/40">
        <p>
          Data feed: <span className="text-white/70 font-medium">TradingView</span> · {activeTvSymbol} · zona waktu Asia/Jakarta.
          Simbol lain bisa diketik langsung di kotak simbol chart.
        </p>
        <p>
          Butuh alert harga? Pasang <span className="text-purple-300 font-semibold">target harga di Watchlist</span> —
          server cek tiap 15 menit &amp; push ke HP saat level kena.
        </p>
      </div>
    </div>
  )
}
