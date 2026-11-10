'use client'
/**
 * TEMPORARY verification page (dev only) — renders the chart terminal
 * in isolation so visual/interaksi checks bisa jalan tanpa login.
 * WAJIB DIHAPUS sebelum commit!
 */
import dynamic from 'next/dynamic'

const VelaChartTerminal = dynamic(() => import('@/components/VelaChartTerminal'), {
  ssr: false,
  loading: () => (
    <div className="min-h-screen bg-[#05070d] flex items-center justify-center text-white/50 text-sm">
      Menyalakan terminal…
    </div>
  ),
})

export default function TestPinePage() {
  return (
    <main className="min-h-screen bg-[#05070d] p-3">
      <VelaChartTerminal defaultSymbol="XAUUSD" defaultTimeframe="60" />
    </main>
  )
}
