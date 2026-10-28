'use client'

/**
 * ============================================================
 * ChartTab — DITOTAL-GANTI dengan Vela™ by LuxAlgo (Task 36)
 * ============================================================
 * Chart lama (lightweight-charts CandlestickChart + selector
 * manual) digantikan VelaChartTerminal: workspace penuh dengan
 * symbol search, timeframe bar, 70+ indikator bawaan, drawing
 * tools, Pine Script® editor (kuota free 2×/bulan) dan panel
 * Alert Telegram (kuota free 2×/hari).
 *
 * Data XAUUSD/forex tetap dari /api/forex (via LuxtradeeForexProvider).
 */

import dynamic from 'next/dynamic'
import { TrendingUp } from 'lucide-react'

const VelaChartTerminal = dynamic(() => import('@/components/VelaChartTerminal'), {
  ssr: false, // Vela menyentuh WebGL/canvas sejak konstruktor — wajib client-only
  loading: () => (
    <div className="flex items-center justify-center h-[420px] rounded-2xl border border-white/5 bg-white/[0.02]">
      <div className="flex flex-col items-center gap-2">
        <div className="w-6 h-6 border-2 border-purple-400 border-t-transparent rounded-full animate-spin" />
        <span className="text-white/40 text-xs">Memuat trading terminal…</span>
      </div>
    </div>
  ),
})

/* TabContent lama masih mem-passing `isPro` — diterima tapi tak dipakai:
   kuota kini dicek SERVER-SIDE per-aksi (/api/pine/save & /api/send-alert). */
export default function ChartTab({ isPro: _isPro }: { isPro?: boolean } = {}) {
  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold flex items-center gap-2">
            <TrendingUp className="w-6 h-6 text-purple-400" />
            Luxtradee Trading Terminal
          </h2>
          <p className="text-white/60 text-sm">
            Terminal profesional — tekan <kbd className="px-1 rounded bg-white/10 text-[10px]">0</kbd> untuk ganti simbol, <kbd className="px-1 rounded bg-white/10 text-[10px]">1–9</kbd> untuk timeframe
          </p>
        </div>
      </div>

      {/* Vela terminal (chart + Pine editor + Alert Telegram) */}
      <VelaChartTerminal defaultSymbol="XAUUSD" defaultTimeframe="60" />
    </div>
  )
}
