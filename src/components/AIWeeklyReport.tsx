'use client'

import React, { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  FileText,
  Sparkles,
  Download,
  Loader2,
  Calendar,
  TrendingUp,
  Brain,
  ChevronDown,
  ChevronUp,
  Copy,
  Check,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'

// ─── Types ───────────────────────────────────────────────────────────────────

interface Trade {
  id: string
  symbol: string
  type: 'BUY' | 'SELL'
  profit_loss: number
  close_time: string
  session: string | null
  notes?: string | null
}

interface Analytics {
  totalTrades: number
  winRate: number
  profitFactor: number
  totalPL: number
  avgProfit: number
  avgLoss: number
  maxDrawdown: number
  sharpeRatio: number
  equityCurve: Array<{ date: string; equity: number }>
  sessionPerformance: Array<{ session: string; trades: number; pl: number; winRate: number }>
  monthlyPerformance: Array<{ month: string; profit: number; trades: number; winRate: number }>
}

interface WeeklyReport {
  generatedAt: string
  period: string
  summary: string
  metrics: { label: string; value: string; trend: 'up' | 'down' | 'neutral' }[]
  bestTrade: { symbol: string; pl: number; type: string } | null
  worstTrade: { symbol: string; pl: number; type: string } | null
  sessionAnalysis: string
  recommendations: string[]
  nextWeekGoals: string[]
}

interface AIWeeklyReportProps {
  analytics: Analytics | null
  trades: Trade[]
  isPro: boolean
  onUpgrade: () => void
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function formatCurrency(value: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
  }).format(value)
}

function getWeekPeriod(): string {
  const now = new Date()
  const dayOfWeek = now.getDay()
  const diffToMonday = dayOfWeek === 0 ? -6 : 1 - dayOfWeek

  const monday = new Date(now)
  monday.setDate(now.getDate() + diffToMonday)

  const sunday = new Date(monday)
  sunday.setDate(monday.getDate() + 6)

  const fmt = (d: Date) =>
    d.toLocaleDateString('id-ID', { day: 'numeric', month: 'short' })
  return `${fmt(monday)} – ${fmt(sunday)} ${now.getFullYear()}`
}

/** Tanggal-jam format Indonesia untuk header laporan. */
function formatTanggal(iso: string): string {
  return new Date(iso).toLocaleString('id-ID', {
    day: '2-digit',
    month: 'long',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

function getWeekTrades(trades: Trade[]): Trade[] {
  const now = new Date()
  const startOfWeek = new Date(now)
  const dayOfWeek = now.getDay()
  const diffToMonday = dayOfWeek === 0 ? -6 : 1 - dayOfWeek
  startOfWeek.setDate(now.getDate() + diffToMonday)
  startOfWeek.setHours(0, 0, 0, 0)

  const weekTrades = trades.filter((t) => new Date(t.close_time) >= startOfWeek)
  return weekTrades.length > 0 ? weekTrades : trades.slice(-7)
}

// ─── Report Generation Engine ───────────────────────────────────────────────

function generateReport(analytics: Analytics | null, trades: Trade[]): WeeklyReport {
  const weekTrades = getWeekTrades(trades)
  const period = getWeekPeriod()

  // Calculate week-specific stats
  const wins = weekTrades.filter((t) => t.profit_loss > 0).length
  const losses = weekTrades.filter((t) => t.profit_loss <= 0).length
  const weekTotal = weekTrades.length
  const weekWinRate = weekTotal > 0 ? (wins / weekTotal) * 100 : 0
  const weekTotalPL = weekTrades.reduce((sum, t) => sum + t.profit_loss, 0)
  const weekAvgProfit =
    wins > 0
      ? weekTrades.filter((t) => t.profit_loss > 0).reduce((s, t) => s + t.profit_loss, 0) / wins
      : 0
  const weekAvgLoss =
    losses > 0
      ? Math.abs(
          weekTrades
            .filter((t) => t.profit_loss <= 0)
            .reduce((s, t) => s + t.profit_loss, 0) / losses
        )
      : 0
  const grossProfit = weekTrades.filter((t) => t.profit_loss > 0).reduce((s, t) => s + t.profit_loss, 0)
  const grossLoss = Math.abs(weekTrades.filter((t) => t.profit_loss <= 0).reduce((s, t) => s + t.profit_loss, 0))
  const weekProfitFactor = grossLoss > 0 ? grossProfit / grossLoss : grossProfit > 0 ? Infinity : 0

  // Best & Worst trades
  const sortedByPL = [...weekTrades].sort((a, b) => b.profit_loss - a.profit_loss)
  const bestTrade =
    sortedByPL.length > 0 && sortedByPL[0].profit_loss > 0
      ? { symbol: sortedByPL[0].symbol, pl: sortedByPL[0].profit_loss, type: sortedByPL[0].type }
      : null
  const worstTrade =
    sortedByPL.length > 0 && sortedByPL[sortedByPL.length - 1].profit_loss < 0
      ? {
          symbol: sortedByPL[sortedByPL.length - 1].symbol,
          pl: sortedByPL[sortedByPL.length - 1].profit_loss,
          type: sortedByPL[sortedByPL.length - 1].type,
        }
      : null

  // ── Ringkasan ──────────────────────────────────────────────────────
  const performanceLabel =
    weekWinRate >= 70
      ? 'sangat bagus'
      : weekWinRate >= 55
        ? 'solid'
        : weekWinRate >= 45
          ? 'campuran'
          : 'menantang'

  const plAdjective =
    weekTotalPL > 0
      ? `laba bersih ${formatCurrency(weekTotalPL)}`
      : weekTotalPL < 0
        ? `rugi bersih ${formatCurrency(Math.abs(weekTotalPL))}`
        : 'hasil impas (break-even)'

  const winRateComment =
    weekWinRate >= 70
      ? 'Win rate kamu bagus sekali — pertahankan yang sudah jalan dan jaga keunggulannya.'
      : weekWinRate >= 55
        ? 'Win rate kamu sehat. Perbaikan kecil di eksekusi bisa menaikkannya lagi.'
        : weekWinRate >= 45
          ? 'Win rate kamu hampir impas. Minggu depan fokus ke setup dengan keyakinan tinggi.'
          : 'Win rate kamu perlu perhatian. Kurangi frekuensi trade dan naikkan standar entry.'

  const profitFactorComment =
    weekProfitFactor >= 2
      ? ' Profit factor kamu luar biasa — ekspektansi positifmu kuat.'
      : weekProfitFactor >= 1.5
        ? ' Profit factor kamu sehat dan berkelanjutan.'
        : weekProfitFactor >= 1
          ? ' Profit factor kamu sedikit di atas impas — perbesar porsi profilmu.'
          : weekProfitFactor > 0
            ? ' Profit factor kamu di bawah 1, artinya loss lebih besar dari profit. Prioritaskan manajemen risiko.'
            : ''

  const summary = `Selama periode ini kamu mengeksekusi ${weekTotal} trade dengan hasil ${performanceLabel}, mencatatkan ${plAdjective} dan win rate ${weekWinRate.toFixed(1)}%. ${winRateComment}${profitFactorComment}`

  // ── Key Metrics ────────────────────────────────────────────────────────
  const metrics: WeeklyReport['metrics'] = [
    {
      label: 'Rasio Menang',
      value: `${weekWinRate.toFixed(1)}%`,
      trend: weekWinRate >= 55 ? 'up' : weekWinRate < 45 ? 'down' : 'neutral',
    },
    {
      label: 'Faktor Profit',
      value: weekProfitFactor === Infinity ? '∞' : weekProfitFactor.toFixed(2),
      trend: weekProfitFactor >= 1.5 ? 'up' : weekProfitFactor < 1 ? 'down' : 'neutral',
    },
    {
      label: 'Total Laba/Rugi',
      value: `${weekTotalPL >= 0 ? '+' : ''}${formatCurrency(weekTotalPL)}`,
      trend: weekTotalPL > 0 ? 'up' : weekTotalPL < 0 ? 'down' : 'neutral',
    },
    {
      label: 'Rata-rata Profit',
      value: `+${formatCurrency(weekAvgProfit)}`,
      trend: weekAvgProfit > 0 ? 'up' : 'neutral',
    },
    {
      label: 'Rata-rata Loss',
      value: `-${formatCurrency(weekAvgLoss)}`,
      trend: weekAvgLoss > weekAvgProfit ? 'down' : 'neutral',
    },
    {
      label: 'Rasio Sharpe',
      value: (analytics?.sharpeRatio ?? 0).toFixed(2),
      trend: (analytics?.sharpeRatio ?? 0) >= 1 ? 'up' : (analytics?.sharpeRatio ?? 0) < 0.5 ? 'down' : 'neutral',
    },
    {
      label: 'Drawdown Maksimal',
      value: `${formatCurrency(analytics?.maxDrawdown ?? 0)}`,
      trend: (analytics?.maxDrawdown ?? 0) > 500 ? 'down' : 'neutral',
    },
    {
      label: 'Jumlah Trade',
      value: `${weekTotal}`,
      trend: 'neutral',
    },
  ]

  // ── Session Analysis ───────────────────────────────────────────────────
  const sessionPerf = analytics?.sessionPerformance ?? []
  let sessionAnalysis: string

  if (sessionPerf.length === 0) {
    sessionAnalysis = 'Catat sesi pada tiap trade-mu — minggu depan analisis per sesi bisa muncul otomatis.'
  } else {
    const sortedSessions = [...sessionPerf].sort((a, b) => b.pl - a.pl)
    const bestSession = sortedSessions[0]
    const worstSession = sortedSessions[sortedSessions.length - 1]

    const parts: string[] = []
    parts.push(
      `Sesi terbaik kamu ${bestSession.session}: ${formatCurrency(bestSession.pl)} dari ${bestSession.trades} trade (win rate ${bestSession.winRate.toFixed(1)}%).`
    )

    if (sortedSessions.length > 1 && worstSession.pl !== bestSession.pl) {
      parts.push(
        `${worstSession.session} jadi sesi terlemah: ${formatCurrency(worstSession.pl)} dari ${worstSession.trades} trade.`
      )
    }

    // Check for session concentration
    const topSessionPct = bestSession.trades / weekTotal
    if (topSessionPct > 0.6 && weekTotal > 5) {
      parts.push(
        `${(topSessionPct * 100).toFixed(0)}% trade-mu terpusat di sesi ${bestSession.session} — coba sesi lain supaya tidak bergantung pada satu sesi.`
      )
    }

    sessionAnalysis = parts.join(' ')
  }

  // ── Recommendations ────────────────────────────────────────────────────
  const recommendations: string[] = []

  if (weekWinRate < 50) {
    recommendations.push(
      'Naikkan standar entry-mu — tunggu setup terbaik, jangan paksa trade. Kualitas lebih penting daripada jumlah.'
    )
  } else if (weekWinRate >= 70) {
    recommendations.push(
      'Win rate kamu bagus sekali. Fokus membesarkan posisi yang sudah profit dan biarkan profit jalan.'
    )
  }

  if (weekProfitFactor < 1.3 && weekProfitFactor > 0) {
    recommendations.push(
      'Profit factor menunjukkan loss kamu terlalu besar dibanding profit. Perketat stop-loss dan targetkan minimal rasio 1:2.'
    )
  } else if (weekProfitFactor >= 2) {
    recommendations.push(
      'Profit factor luar biasa! Catat aturan strategi yang kamu pakai sekarang supaya hasilnya bisa diulang konsisten.'
    )
  }

  if (weekAvgLoss > weekAvgProfit * 1.5 && weekAvgLoss > 0) {
    recommendations.push(
      `Rata-rata loss kamu (${formatCurrency(weekAvgLoss)}) jauh melebihi rata-rata profit (${formatCurrency(weekAvgProfit)}). Biasakan potong loss lebih cepat.`
    )
  }

  if ((analytics?.maxDrawdown ?? 0) > 300) {
    recommendations.push(
      'Max drawdown kamu tinggi. Kurangi ukuran posisi 25–50% sampai konsistensimu pulih.'
    )
  }

  if (weekTotal > 40) {
    recommendations.push(
      `Dengan ${weekTotal} trade di periode ini kamu berpotensi overtrading. Minggu depan kurangi jumlah dan pilih setup paling yakin.`
    )
  } else if (weekTotal < 5 && weekTotal > 0) {
    recommendations.push(
      'Jumlah trade minggu ini sedikit. Selektif itu bagus, tapi pastikan kamu tidak melewatkan setup valid karena ragu.'
    )
  }

  // Session-based recommendation
  if (sessionPerf.length >= 2) {
    const sorted = [...sessionPerf].sort((a, b) => b.pl - a.pl)
    if (sorted[sorted.length - 1].pl < 0 && sorted[0].pl > 0) {
      recommendations.push(
        `Pertimbangkan mengurangi aktivitas di sesi ${sorted[sorted.length - 1].session} dan perbesar fokus di sesi ${sorted[0].session} tempat kamu tampil paling baik.`
      )
    }
  }

  if (weekTotalPL < 0) {
    recommendations.push(
      'Setelah periode rugi, berhenti sejenak dan baca ulang catatan jurnalmu. Hindari revenge trading dan pegang rencana.'
    )
  }

  // Ensure we have at least 3 recommendations
  if (recommendations.length < 3) {
    recommendations.push(
      'Baca ulang catatan jurnalmu tiap minggu — pola perilaku sering bicara lebih jujur daripada angka.'
    )
  }
  if (recommendations.length < 3) {
    recommendations.push(
      'Tetapkan batas loss harian dan patuhi. Melindungi modal adalah fondasi umur panjang di trading.'
    )
  }

  // ── Next Week Goals ────────────────────────────────────────────────────
  const nextWeekGoals: string[] = []

  if (weekWinRate < 55) {
    nextWeekGoals.push('Naikkan win rate ke minimal 55% dengan lebih selektif memilih entry.')
  } else {
    nextWeekGoals.push(`Pertahankan atau tingkatkan win rate ${weekWinRate.toFixed(1)}% kamu.`)
  }

  if (weekProfitFactor < 1.5) {
    nextWeekGoals.push('Dorong profit factor di atas 1,5 dengan membiarkan profit jalan dan memotong loss lebih awal.')
  } else {
    nextWeekGoals.push('Jaga profit factor tetap di atas 1,5 — keunggulanmu sedang kuat.')
  }

  if (weekTotalPL < 0) {
    nextWeekGoals.push(`Kembali profit — targetkan minggu positif minimal ${formatCurrency(Math.abs(weekTotalPL) * 0.5)}.`)
  } else {
    nextWeekGoals.push(`Targetkan profit minimal ${formatCurrency(weekTotalPL * 0.8)} untuk konsistensi.`)
  }

  if ((analytics?.maxDrawdown ?? 0) > 200) {
    nextWeekGoals.push(`Jaga max drawdown di bawah ${formatCurrency(200)} dengan ukuran posisi lebih ketat.`)
  }

  nextWeekGoals.push('Catat semua trade beserta catatan detail untuk analisis minggu depan.')
  nextWeekGoals.push('Tinjau dan rapikan trading plan-mu sebelum minggu dimulai.')

  return {
    generatedAt: new Date().toISOString(),
    period,
    summary,
    metrics,
    bestTrade,
    worstTrade,
    sessionAnalysis,
    recommendations: recommendations.slice(0, 5),
    nextWeekGoals: nextWeekGoals.slice(0, 5),
  }
}

// ─── Report to Plain Text (untuk salin ke clipboard) ────────────────────────

function reportToText(report: WeeklyReport): string {
  const lines: string[] = []

  lines.push('LAPORAN MINGGUAN AI — LUXTRADEE')
  lines.push(`Periode: ${report.period} · Dibuat: ${formatTanggal(report.generatedAt)}`)
  lines.push('')
  lines.push('RINGKASAN')
  lines.push(report.summary)
  lines.push('')
  lines.push('METRIK KUNCI')
  report.metrics.forEach((m) => {
    const icon = m.trend === 'up' ? '▲' : m.trend === 'down' ? '▼' : '◆'
    lines.push(`  ${icon} ${m.label}: ${m.value}`)
  })
  lines.push('')

  if (report.bestTrade || report.worstTrade) {
    lines.push('TRADE TERBAIK & TERBURUK')
    if (report.bestTrade) {
      lines.push(
        `  ✅ Terbaik: ${report.bestTrade.symbol} (${report.bestTrade.type}) → +${formatCurrency(report.bestTrade.pl)}`
      )
    }
    if (report.worstTrade) {
      lines.push(
        `  ❌ Terburuk: ${report.worstTrade.symbol} (${report.worstTrade.type}) → ${formatCurrency(report.worstTrade.pl)}`
      )
    }
    lines.push('')
  }

  lines.push('ANALISIS SESI')
  lines.push(report.sessionAnalysis)
  lines.push('')
  lines.push('REKOMENDASI AI')
  report.recommendations.forEach((r, i) => {
    lines.push(`  ${i + 1}. ${r}`)
  })
  lines.push('')
  lines.push('TARGET MINGGU DEPAN')
  report.nextWeekGoals.forEach((g) => {
    lines.push(`  ☐ ${g}`)
  })
  lines.push('')
  lines.push('LuxTradee AI · luxtradee.web.id')

  return lines.join('\n')
}

// ─── Report to Styled HTML (unduhan yang rapi, bisa dicetak jadi PDF) ───────

function reportToHtml(report: WeeklyReport): string {
  const esc = (s: string) =>
    s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')

  const metricsHtml = report.metrics
    .map(
      (m) => `<div class="metric ${m.trend}">
        <span class="m-label">${esc(m.label)}</span>
        <span class="m-value">${esc(m.value)}</span>
      </div>`
    )
    .join('')

  const bestBlock = report.bestTrade
    ? `<div class="trade best">
         <div class="trade-label">Trade Terbaik</div>
         <div class="trade-row"><b>${esc(report.bestTrade.symbol)}</b><span>+${formatCurrency(report.bestTrade.pl)}</span></div>
         <div class="trade-sub">Posisi ${esc(report.bestTrade.type)}</div>
       </div>`
    : ''
  const worstBlock = report.worstTrade
    ? `<div class="trade worst">
         <div class="trade-label">Trade Terburuk</div>
         <div class="trade-row"><b>${esc(report.worstTrade.symbol)}</b><span>${formatCurrency(report.worstTrade.pl)}</span></div>
         <div class="trade-sub">Posisi ${esc(report.worstTrade.type)}</div>
       </div>`
    : ''

  const recs = report.recommendations
    .map((r, i) => `<li><span class="num">${i + 1}</span>${esc(r)}</li>`)
    .join('')
  const goals = report.nextWeekGoals
    .map((g) => `<li><span class="box"></span>${esc(g)}</li>`)
    .join('')

  const tradesSection =
    bestBlock || worstBlock
      ? `<section><h2>Trade Terbaik &amp; Terburuk</h2><div class="trades">${bestBlock}${worstBlock}</div></section>`
      : ''

  return `<!DOCTYPE html>
<html lang="id">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>Laporan Mingguan LuxTradee — ${esc(report.period)}</title>
<style>
  :root { color-scheme: dark; }
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body {
    background: #080b12; color: #e2e8f0;
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
    padding: 24px 12px; line-height: 1.55;
  }
  .card {
    max-width: 720px; margin: 0 auto;
    background: linear-gradient(180deg, #0d1119 0%, #0b0e17 100%);
    border: 1px solid rgba(255,255,255,0.08); border-top: 3px solid #f59e0b;
    border-radius: 20px;
    padding: 28px 24px;
  }
  .brand-row { display: flex; align-items: center; gap: 10px; }
  .brand { font-size: 16px; font-weight: 800; color: #fff; letter-spacing: .02em; }
  .brand span { display: block; font-size: 10px; font-weight: 600; color: #64748b; letter-spacing: .22em; text-transform: uppercase; }
  h1 { font-size: 22px; color: #fff; margin-top: 16px; }
  .period { font-size: 12px; color: #94a3b8; margin-top: 4px; }
  section { margin-top: 22px; padding-top: 18px; border-top: 1px solid rgba(255,255,255,0.06); }
  h2 { font-size: 12px; font-weight: 700; text-transform: uppercase; letter-spacing: .14em; color: #fbbf24; margin-bottom: 12px; }
  .grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 8px; }
  @media (max-width: 560px) { .grid { grid-template-columns: repeat(2, 1fr); } }
  .metric { border-radius: 12px; padding: 10px 8px; text-align: center; border: 1px solid rgba(255,255,255,0.08); background: rgba(255,255,255,0.03); }
  .metric.up { border-color: rgba(16,185,129,0.3); background: rgba(16,185,129,0.08); }
  .metric.down { border-color: rgba(239,68,68,0.3); background: rgba(239,68,68,0.08); }
  .m-label { display: block; font-size: 10px; font-weight: 600; text-transform: uppercase; letter-spacing: .08em; color: #94a3b8; }
  .m-value { display: block; font-size: 17px; font-weight: 800; color: #cbd5e1; margin-top: 2px; }
  .metric.up .m-value { color: #34d399; }
  .metric.down .m-value { color: #f87171; }
  .trades { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; }
  @media (max-width: 560px) { .trades { grid-template-columns: 1fr; } }
  .trade { border-radius: 12px; padding: 12px 14px; border: 1px solid; }
  .trade.best { border-color: rgba(16,185,129,0.25); background: rgba(16,185,129,0.06); }
  .trade.worst { border-color: rgba(239,68,68,0.25); background: rgba(239,68,68,0.06); }
  .trade-label { font-size: 10px; font-weight: 700; text-transform: uppercase; letter-spacing: .14em; margin-bottom: 6px; }
  .trade.best .trade-label { color: #10b981; }
  .trade.worst .trade-label { color: #ef4444; }
  .trade-row { display: flex; justify-content: space-between; align-items: baseline; color: #fff; font-size: 15px; }
  .trade.best .trade-row span { color: #34d399; font-weight: 700; }
  .trade.worst .trade-row span { color: #f87171; font-weight: 700; }
  .trade-sub { font-size: 11px; color: #64748b; margin-top: 4px; }
  .list { list-style: none; display: flex; flex-direction: column; gap: 10px; }
  .list li { display: flex; gap: 10px; font-size: 13px; color: #cbd5e1; align-items: flex-start; }
  .num { flex-shrink: 0; width: 20px; height: 20px; border-radius: 6px; background: rgba(245,158,11,0.15); color: #fbbf24; font-size: 11px; font-weight: 700; display: inline-flex; align-items: center; justify-content: center; margin-top: 1px; }
  .box { flex-shrink: 0; width: 16px; height: 16px; border-radius: 4px; border: 1.5px solid rgba(245,158,11,0.5); background: rgba(245,158,11,0.08); margin-top: 2px; }
  footer { margin-top: 24px; padding-top: 16px; border-top: 1px solid rgba(255,255,255,0.06); font-size: 11px; color: #64748b; text-align: center; letter-spacing: .08em; text-transform: uppercase; }
  .print-hint { margin-top: 8px; font-size: 10px; color: #475569; text-align: center; letter-spacing: .04em; }
  @media print {
    body { background: #fff; color: #0f172a; padding: 0; }
    .card { background: #fff; border: none; border-top: 3px solid #d97706; border-radius: 0; }
    h1, .brand, .trade-row b { color: #0f172a; }
    .m-value, .metric.up .m-value { color: #059669; }
    .metric.down .m-value { color: #dc2626; }
    .metric, .trade, .num, .box { background: #f8fafc; }
    .m-label, .period, .trade-sub, footer { color: #475569; }
    section { border-color: #e2e8f0; }
    h2 { color: #b45309; }
    .num { color: #b45309; }
    .print-hint { display: none; }
  }
</style>
</head>
<body>
  <main class="card">
    <header>
      <div class="brand-row">
        <svg width="34" height="34" viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
          <defs><linearGradient id="lg" x1="0" y1="0" x2="48" y2="48" gradientUnits="userSpaceOnUse"><stop offset="0" stop-color="#fbbf24"/><stop offset="0.55" stop-color="#f59e0b"/><stop offset="1" stop-color="#b45309"/></linearGradient></defs>
          <rect x="1" y="1" width="46" height="46" rx="12" fill="url(#lg)"/>
          <rect x="10" y="26" width="5" height="12" rx="1.5" fill="rgba(255,255,255,0.92)"/>
          <rect x="19" y="19" width="5" height="12" rx="1.5" fill="rgba(255,255,255,0.92)"/>
          <path d="M16 21 L24 13 L29 17.5 L36 10" stroke="#0a0c12" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round" fill="none"/>
          <path d="M31.5 9.5 H36.5 V14.5" stroke="#0a0c12" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round" fill="none"/>
        </svg>
        <div class="brand">LuxTradee <span>Jurnal Trading</span></div>
      </div>
      <h1>Laporan Mingguan AI</h1>
      <p class="period">${esc(report.period)} · Dibuat ${formatTanggal(report.generatedAt)}</p>
    </header>
    <section><h2>Ringkasan</h2><p>${esc(report.summary)}</p></section>
    <section><h2>Metrik Kunci</h2><div class="grid">${metricsHtml}</div></section>
    ${tradesSection}
    <section><h2>Analisis Sesi</h2><p>${esc(report.sessionAnalysis)}</p></section>
    <section><h2>Rekomendasi AI</h2><ol class="list">${recs}</ol></section>
    <section><h2>Target Minggu Depan</h2><ul class="list">${goals}</ul></section>
    <footer>LuxTradee AI · luxtradee.web.id</footer>
    <p class="print-hint">Mau simpan jadi PDF? Buka file ini di browser lalu tekan Ctrl/Cmd + P → Save as PDF.</p>
  </main>
</body>
</html>`
}

// ─── Sub-components ─────────────────────────────────────────────────────────

function MetricCard({
  metric,
  index,
}: {
  metric: WeeklyReport['metrics'][0]
  index: number
}) {
  const trendColor =
    metric.trend === 'up'
      ? 'text-emerald-400'
      : metric.trend === 'down'
        ? 'text-red-400'
        : 'text-slate-400'

  const trendBg =
    metric.trend === 'up'
      ? 'bg-emerald-500/10 border-emerald-500/20'
      : metric.trend === 'down'
        ? 'bg-red-500/10 border-red-500/20'
        : 'bg-slate-500/10 border-slate-500/20'

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.05 + 0.2, duration: 0.35 }}
      className={`flex flex-col items-center gap-1 rounded-xl border p-3 ${trendBg}`}
    >
      <span className="text-[11px] font-medium uppercase tracking-wider text-slate-400">
        {metric.label}
      </span>
      <span className={`text-lg font-bold ${trendColor}`}>{metric.value}</span>
    </motion.div>
  )
}

function SectionHeader({
  icon: Icon,
  title,
  delay = 0,
}: {
  icon: React.ElementType
  title: string
  delay?: number
}) {
  return (
    <motion.div
      initial={{ opacity: 0, x: -10 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ delay, duration: 0.3 }}
      className="flex items-center gap-2 mb-3"
    >
      <Icon className="h-4 w-4 text-cyan-400" />
      <h3 className="text-sm font-semibold tracking-wide text-white uppercase">{title}</h3>
      <div className="flex-1 h-px bg-white/5" />
    </motion.div>
  )
}

// ─── Main Component ─────────────────────────────────────────────────────────

export default function AIWeeklyReport({
  analytics,
  trades,
  isPro,
  onUpgrade,
}: AIWeeklyReportProps) {
  const [isExpanded, setIsExpanded] = useState(false)
  const [isGenerating, setIsGenerating] = useState(false)
  const [report, setReport] = useState<WeeklyReport | null>(null)
  const [copied, setCopied] = useState(false)

  const weekTrades = getWeekTrades(trades)
  const hasNoTrades = trades.length === 0

  // ── Generate handler ─────────────────────────────────────────────────
  const handleGenerate = async () => {
    if (!isPro) {
      onUpgrade()
      return
    }

    setIsGenerating(true)

    // Simulate AI processing delay for UX
    await new Promise((resolve) => setTimeout(resolve, 1200))

    const generated = generateReport(analytics, trades)
    setReport(generated)
    setIsGenerating(false)
    setIsExpanded(true)
  }

  // ── Copy handler ─────────────────────────────────────────────────────
  const handleCopy = async () => {
    if (!report) return

    const text = reportToText(report)
    await navigator.clipboard.writeText(text)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  // ── Download handler ─────────────────────────────────────────────────
  const handleDownload = () => {
    if (!report) return

    /* Laporan diunduh sebagai HTML rapi (laporan Bos 13-11: file .txt
       kotak-kotak jelek). Bisa langsung dibuka di browser, dibagikan,
       atau dicetak jadi PDF via menu Bagikan/Screenshot. */
    const html = reportToHtml(report)
    const blob = new Blob([html], { type: 'text/html;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `luxtradee-laporan-mingguan-${new Date().toISOString().slice(0, 10)}.html`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
  }

  // ── Render ───────────────────────────────────────────────────────────
  return (
    <Card className="relative overflow-hidden border-white/[0.06] bg-[#080b12] shadow-2xl shadow-blue-500/5">
      {/* Ambient glow */}
      <div className="pointer-events-none absolute -top-24 right-0 h-48 w-48 rounded-full bg-blue-600/10 blur-[80px]" />
      <div className="pointer-events-none absolute -bottom-24 left-0 h-48 w-48 rounded-full bg-emerald-600/5 blur-[80px]" />

      {/* ─── Header ──────────────────────────────────────────────────── */}
      <CardHeader className="relative z-10 pb-0">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-blue-500/20 to-blue-600/10 border border-blue-500/20">
              <Brain className="h-5 w-5 text-cyan-400" />
            </div>
            <div>
              <CardTitle className="text-base font-bold text-white">
                Laporan Mingguan AI
              </CardTitle>
              <CardDescription className="text-xs text-slate-500">
                <Calendar className="mr-1 inline h-3 w-3" />
                {getWeekPeriod()} · {weekTrades.length} trade
              </CardDescription>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {report && (
              <motion.div
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1 }}
                className="flex items-center gap-1"
              >
                <Button
                  size="icon"
                  variant="ghost"
                  onClick={handleCopy}
                  className="h-8 w-8 text-slate-400 hover:text-white hover:bg-white/5"
                >
                  {copied ? (
                    <Check className="h-4 w-4 text-emerald-400" />
                  ) : (
                    <Copy className="h-4 w-4" />
                  )}
                </Button>
                <Button
                  size="icon"
                  variant="ghost"
                  onClick={handleDownload}
                  className="h-8 w-8 text-slate-400 hover:text-white hover:bg-white/5"
                >
                  <Download className="h-4 w-4" />
                </Button>
              </motion.div>
            )}

            <Button
              size="sm"
              onClick={() => {
                if (!isExpanded && !report) {
                  handleGenerate()
                } else {
                  setIsExpanded(!isExpanded)
                }
              }}
              disabled={isGenerating}
              className="gap-1.5 bg-gradient-to-r from-blue-600 to-blue-500 text-white shadow-lg shadow-blue-500/20 hover:from-blue-500 hover:to-cyan-400"
            >
              {isGenerating ? (
                <>
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  Menganalisis…
                </>
              ) : isExpanded ? (
                <>
                  <ChevronUp className="h-3.5 w-3.5" />
                  Tutup
                </>
              ) : (
                <>
                  <Sparkles className="h-3.5 w-3.5" />
                  {report ? 'Lihat Laporan' : 'Buat Laporan'}
                </>
              )}
            </Button>
          </div>
        </div>
      </CardHeader>

      {/* ─── Collapsed State ─────────────────────────────────────────── */}
      {!isExpanded && (
        <CardContent className="relative z-10">
          <p className="text-xs leading-relaxed text-slate-500">
            Analisis performa trading mingguanmu oleh AI: metrik kunci, performa per sesi,
            rekomendasi personal, dan target minggu depan.
          </p>
        </CardContent>
      )}

      {/* ─── Expanded Report ─────────────────────────────────────────── */}
      <AnimatePresence>
        {isExpanded && report && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.4, ease: 'easeInOut' }}
            className="overflow-hidden"
          >
            <div className="relative z-10 space-y-6 px-6 pb-6">
              {/* ── Pro Upgrade Overlay ──────────────────────────────── */}
              {!isPro && (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="absolute inset-0 z-50 flex flex-col items-center justify-center gap-4 rounded-xl bg-[#080b12]/90 backdrop-blur-md"
                >
                  <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-blue-500/30 to-blue-600/20 border border-blue-500/30">
                    <Sparkles className="h-7 w-7 text-cyan-400" />
                  </div>
                  <div className="text-center">
                    <h3 className="text-lg font-bold text-white">Fitur Pro</h3>
                    <p className="mt-1 max-w-xs text-sm text-slate-400">
                      Buka laporan mingguan bertenaga AI berisi insight dan rekomendasi personal.
                    </p>
                  </div>
                  <Button
                    onClick={onUpgrade}
                    className="mt-2 bg-gradient-to-r from-blue-600 to-blue-500 text-white shadow-lg shadow-blue-500/25 hover:from-blue-500 hover:to-cyan-400"
                  >
                    <Sparkles className="mr-2 h-4 w-4" />
                    Upgrade ke Pro
                  </Button>
                </motion.div>
              )}

              {/* ── No Trades Message ────────────────────────────────── */}
              {hasNoTrades && (
                <div className="flex flex-col items-center gap-3 py-8 text-center">
                  <FileText className="h-10 w-10 text-slate-600" />
                  <p className="text-sm text-slate-500">Belum ada trade minggu ini untuk dianalisis.</p>
                  <p className="text-xs text-slate-600">
                    Mulai catat trade-mu supaya insight mingguan dari AI bisa muncul.
                  </p>
                </div>
              )}

              {/* ── Executive Summary ────────────────────────────────── */}
              {!hasNoTrades && (
                <>
                  <div className="rounded-xl border border-white/[0.04] bg-white/[0.02] p-4">
                    <SectionHeader icon={FileText} title="Ringkasan" delay={0.1} />
                    <motion.p
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      transition={{ delay: 0.25 }}
                      className="text-sm leading-relaxed text-slate-300"
                    >
                      {report.summary}
                    </motion.p>
                  </div>

                  {/* ── Key Metrics Grid ──────────────────────────────── */}
                  <div className="rounded-xl border border-white/[0.04] bg-white/[0.02] p-4">
                    <SectionHeader icon={TrendingUp} title="Metrik Kunci" delay={0.15} />
                    <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                      {report.metrics.map((metric, i) => (
                        <MetricCard key={metric.label} metric={metric} index={i} />
                      ))}
                    </div>
                  </div>

                  {/* ── Best & Worst Trades ──────────────────────────── */}
                  {(report.bestTrade || report.worstTrade) && (
                    <div className="rounded-xl border border-white/[0.04] bg-white/[0.02] p-4">
                      <SectionHeader icon={FileText} title="Trade Terbaik & Terburuk" delay={0.2} />
                      <div className="grid gap-3 sm:grid-cols-2">
                        {report.bestTrade && (
                          <motion.div
                            initial={{ opacity: 0, y: 8 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: 0.3 }}
                            className="rounded-lg border border-emerald-500/15 bg-emerald-500/5 p-3"
                          >
                            <div className="mb-1 text-[10px] font-semibold uppercase tracking-widest text-emerald-500/70">
                              Trade Terbaik
                            </div>
                            <div className="flex items-baseline justify-between">
                              <span className="font-bold text-white">{report.bestTrade.symbol}</span>
                              <span className="text-sm font-bold text-emerald-400">
                                +{formatCurrency(report.bestTrade.pl)}
                              </span>
                            </div>
                            <div className="mt-1 text-xs text-slate-500">
                              Posisi {report.bestTrade.type}
                            </div>
                          </motion.div>
                        )}
                        {report.worstTrade && (
                          <motion.div
                            initial={{ opacity: 0, y: 8 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: 0.35 }}
                            className="rounded-lg border border-red-500/15 bg-red-500/5 p-3"
                          >
                            <div className="mb-1 text-[10px] font-semibold uppercase tracking-widest text-red-500/70">
                              Trade Terburuk
                            </div>
                            <div className="flex items-baseline justify-between">
                              <span className="font-bold text-white">{report.worstTrade.symbol}</span>
                              <span className="text-sm font-bold text-red-400">
                                {formatCurrency(report.worstTrade.pl)}
                              </span>
                            </div>
                            <div className="mt-1 text-xs text-slate-500">
                              Posisi {report.worstTrade.type}
                            </div>
                          </motion.div>
                        )}
                      </div>
                    </div>
                  )}

                  {/* ── Session Analysis ──────────────────────────────── */}
                  <div className="rounded-xl border border-white/[0.04] bg-white/[0.02] p-4">
                    <SectionHeader icon={Calendar} title="Analisis Sesi" delay={0.25} />
                    <motion.p
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      transition={{ delay: 0.35 }}
                      className="text-sm leading-relaxed text-slate-300"
                    >
                      {report.sessionAnalysis}
                    </motion.p>
                  </div>

                  {/* ── AI Recommendations ────────────────────────────── */}
                  <div className="rounded-xl border border-white/[0.04] bg-white/[0.02] p-4">
                    <SectionHeader icon={Brain} title="Rekomendasi AI" delay={0.3} />
                    <ul className="space-y-2.5">
                      {report.recommendations.map((rec, i) => (
                        <motion.li
                          key={i}
                          initial={{ opacity: 0, x: -8 }}
                          animate={{ opacity: 1, x: 0 }}
                          transition={{ delay: 0.35 + i * 0.06 }}
                          className="flex gap-2.5 text-sm text-slate-300"
                        >
                          <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-md bg-emerald-500/15 text-[10px] font-bold text-emerald-400">
                            ✓
                          </span>
                          <span className="leading-relaxed">{rec}</span>
                        </motion.li>
                      ))}
                    </ul>
                  </div>

                  {/* ── Next Week Goals ───────────────────────────────── */}
                  <div className="rounded-xl border border-white/[0.04] bg-white/[0.02] p-4">
                    <SectionHeader icon={Sparkles} title="Target Minggu Depan" delay={0.35} />
                    <ul className="space-y-2.5">
                      {report.nextWeekGoals.map((goal, i) => (
                        <motion.li
                          key={i}
                          initial={{ opacity: 0, x: -8 }}
                          animate={{ opacity: 1, x: 0 }}
                          transition={{ delay: 0.4 + i * 0.06 }}
                          className="flex gap-2.5 text-sm text-slate-300"
                        >
                          <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-md border border-blue-500/25 bg-blue-500/10 text-[10px] font-bold text-cyan-400">
                            {i + 1}
                          </span>
                          <span className="leading-relaxed">{goal}</span>
                        </motion.li>
                      ))}
                    </ul>
                  </div>

                  {/* ── Footer ───────────────────────────────────────── */}
                  <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: 0.6 }}
                    className="flex items-center justify-between border-t border-white/[0.04] pt-4"
                  >
                    <p className="text-[10px] uppercase tracking-widest text-slate-600">
                      Didukung oleh LuxTradee AI
                    </p>
                    <div className="flex items-center gap-2">
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={handleCopy}
                        className="h-7 gap-1.5 text-xs text-slate-500 hover:text-white hover:bg-white/5"
                      >
                        {copied ? (
                          <>
                            <Check className="h-3 w-3 text-emerald-400" />
                            Tersalin!
                          </>
                        ) : (
                          <>
                            <Copy className="h-3 w-3" />
                            Salin Laporan
                          </>
                        )}
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={handleDownload}
                        className="h-7 gap-1.5 text-xs text-slate-500 hover:text-white hover:bg-white/5"
                      >
                        <Download className="h-3 w-3" />
                        Unduh
                      </Button>
                    </div>
                  </motion.div>
                </>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </Card>
  )
}
