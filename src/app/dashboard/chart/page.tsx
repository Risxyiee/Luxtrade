'use client'

/**
 * ============================================================
 * /dashboard/chart — ROUTE CHART (REVISI TOTAL)
 * ============================================================
 * Riwayat (kasus "file hantu"): halaman lama di file ini
 * (lightweight-charts + paywall "Indikator Terkunci 80% Momentum")
 * pernah dihapus lalu KEMBALI lewat commit revert lama — user yang
 * membuka /dashboard/chart melihat chart BUKAN terminal baru.
 * Alih-alih menghapus lagi (rawan di-restore revert berikutnya),
 * isinya DIGANTI memakai terminal resmi yang sama dengan tab Chart
 * di dashboard: VelaChartTerminal (Vela™ + Pine Script + pineku
 * default "Impulsive Breakout XAUUSD v5" auto-load + alert Telegram).
 *
 * Semua logika ada di komponen ChartTab — file ini hanya jembatan.
 */

import ChartTab from '@/components/ChartTab'

export default function LuxtradeChart() {
  return (
    <div className="p-4 md:p-6">
      <ChartTab />
    </div>
  )
}
