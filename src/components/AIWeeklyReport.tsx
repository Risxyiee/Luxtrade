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
  notes?: string
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
    d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
  return `${fmt(monday)} – ${fmt(sunday)}, ${now.getFullYear()}`
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

  // ── Executive Summary ──────────────────────────────────────────────────
  const performanceLabel =
    weekWinRate >= 70
      ? 'outstanding'
      : weekWinRate >= 55
        ? 'solid'
        : weekWinRate >= 45
          ? 'mixed'
          : 'challenging'

  const plAdjective =
    weekTotalPL > 0
      ? `a net profit of ${formatCurrency(weekTotalPL)}`
      : weekTotalPL < 0
        ? `a net loss of ${formatCurrency(Math.abs(weekTotalPL))}`
        : 'break-even results'

  const winRateComment =
    weekWinRate >= 70
      ? 'Your win rate is excellent — keep doing what works and protect your edge.'
      : weekWinRate >= 55
        ? 'Your win rate is healthy. Small improvements in execution could push it higher.'
        : weekWinRate >= 45
          ? 'Your win rate is near break-even. Focus on higher-conviction setups next week.'
          : 'Your win rate needs attention. Consider reducing trade frequency and raising entry criteria.'

  const profitFactorComment =
    weekProfitFactor >= 2
      ? ' Your profit factor is exceptional, indicating a strong positive expectancy.'
      : weekProfitFactor >= 1.5
        ? ' Your profit factor is healthy and sustainable.'
        : weekProfitFactor >= 1
          ? ' Your profit factor is slightly above breakeven — look to widen your winners.'
          : weekProfitFactor > 0
            ? ' Your profit factor is below 1, meaning losses outweigh gains. Prioritize risk management.'
            : ''

  const summary = `Over the past trading period, you executed ${weekTotal} trades with ${performanceLabel} results, achieving ${plAdjective} and a ${weekWinRate.toFixed(1)}% win rate. ${winRateComment}${profitFactorComment}`

  // ── Key Metrics ────────────────────────────────────────────────────────
  const metrics: WeeklyReport['metrics'] = [
    {
      label: 'Win Rate',
      value: `${weekWinRate.toFixed(1)}%`,
      trend: weekWinRate >= 55 ? 'up' : weekWinRate < 45 ? 'down' : 'neutral',
    },
    {
      label: 'Profit Factor',
      value: weekProfitFactor === Infinity ? '∞' : weekProfitFactor.toFixed(2),
      trend: weekProfitFactor >= 1.5 ? 'up' : weekProfitFactor < 1 ? 'down' : 'neutral',
    },
    {
      label: 'Total P/L',
      value: `${weekTotalPL >= 0 ? '+' : ''}${formatCurrency(weekTotalPL)}`,
      trend: weekTotalPL > 0 ? 'up' : weekTotalPL < 0 ? 'down' : 'neutral',
    },
    {
      label: 'Avg Profit',
      value: `+${formatCurrency(weekAvgProfit)}`,
      trend: weekAvgProfit > 0 ? 'up' : 'neutral',
    },
    {
      label: 'Avg Loss',
      value: `-${formatCurrency(weekAvgLoss)}`,
      trend: weekAvgLoss > weekAvgProfit ? 'down' : 'neutral',
    },
    {
      label: 'Sharpe Ratio',
      value: (analytics?.sharpeRatio ?? 0).toFixed(2),
      trend: (analytics?.sharpeRatio ?? 0) >= 1 ? 'up' : (analytics?.sharpeRatio ?? 0) < 0.5 ? 'down' : 'neutral',
    },
    {
      label: 'Max Drawdown',
      value: `${formatCurrency(analytics?.maxDrawdown ?? 0)}`,
      trend: (analytics?.maxDrawdown ?? 0) > 500 ? 'down' : 'neutral',
    },
    {
      label: 'Total Trades',
      value: `${weekTotal}`,
      trend: 'neutral',
    },
  ]

  // ── Session Analysis ───────────────────────────────────────────────────
  const sessionPerf = analytics?.sessionPerformance ?? []
  let sessionAnalysis: string

  if (sessionPerf.length === 0) {
    sessionAnalysis = 'No session performance data available. Track your trading sessions to get session-level insights next week.'
  } else {
    const sortedSessions = [...sessionPerf].sort((a, b) => b.pl - a.pl)
    const bestSession = sortedSessions[0]
    const worstSession = sortedSessions[sortedSessions.length - 1]

    const parts: string[] = []
    parts.push(
      `Your best performing session was ${bestSession.session} with ${formatCurrency(bestSession.pl)} across ${bestSession.trades} trades (${bestSession.winRate.toFixed(1)}% win rate).`
    )

    if (sortedSessions.length > 1 && worstSession.pl !== bestSession.pl) {
      parts.push(
        `${worstSession.session} was your weakest session at ${formatCurrency(worstSession.pl)} over ${worstSession.trades} trades.`
      )
    }

    // Check for session concentration
    const topSessionPct = bestSession.trades / weekTotal
    if (topSessionPct > 0.6 && weekTotal > 5) {
      parts.push(
        `You're heavily concentrated in ${bestSession.session} (${(topSessionPct * 100).toFixed(0)}% of trades). Consider exploring other sessions for diversification.`
      )
    }

    sessionAnalysis = parts.join(' ')
  }

  // ── Recommendations ────────────────────────────────────────────────────
  const recommendations: string[] = []

  if (weekWinRate < 50) {
    recommendations.push(
      'Raise your entry criteria — wait for A+ setups instead of forcing trades. Quality over quantity.'
    )
  } else if (weekWinRate >= 70) {
    recommendations.push(
      "Your win rate is excellent. Focus on scaling into winners and letting profits run to maximize your edge."
    )
  }

  if (weekProfitFactor < 1.3 && weekProfitFactor > 0) {
    recommendations.push(
      'Your profit factor suggests losses are too large relative to wins. Tighten stop-losses and aim for at least a 1:2 risk-to-reward ratio.'
    )
  } else if (weekProfitFactor >= 2) {
    recommendations.push(
      'Outstanding profit factor! Document your current strategy rules so you can replicate these results consistently.'
    )
  }

  if (weekAvgLoss > weekAvgProfit * 1.5 && weekAvgLoss > 0) {
    recommendations.push(
      `Your average loss (${formatCurrency(weekAvgLoss)}) significantly exceeds your average win (${formatCurrency(weekAvgProfit)}). Focus on cutting losers faster.`
    )
  }

  if ((analytics?.maxDrawdown ?? 0) > 300) {
    recommendations.push(
      'Your maximum drawdown is elevated. Consider reducing position sizes by 25-50% until you rebuild consistency.'
    )
  }

  if (weekTotal > 40) {
    recommendations.push(
      `With ${weekTotal} trades this period, you may be overtrading. Focus on fewer, higher-conviction setups next week.`
    )
  } else if (weekTotal < 5 && weekTotal > 0) {
    recommendations.push(
      'Low trade count this period. While selectivity is good, ensure you are not missing valid setups due to hesitation.'
    )
  }

  // Session-based recommendation
  if (sessionPerf.length >= 2) {
    const sorted = [...sessionPerf].sort((a, b) => b.pl - a.pl)
    if (sorted[sorted.length - 1].pl < 0 && sorted[0].pl > 0) {
      recommendations.push(
        `Consider reducing activity in ${sorted[sorted.length - 1].session} sessions and increasing focus on ${sorted[0].session} where you perform best.`
      )
    }
  }

  if (weekTotalPL < 0) {
    recommendations.push(
      'After a losing period, take a step back to review your journal notes. Avoid revenge trading and stick to your plan.'
    )
  }

  // Ensure we have at least 3 recommendations
  if (recommendations.length < 3) {
    recommendations.push(
      'Review your trading journal notes weekly — patterns in behavior often reveal more than the numbers alone.'
    )
  }
  if (recommendations.length < 3) {
    recommendations.push(
      'Set a daily loss limit and stick to it. Protecting your capital is the foundation of longevity in trading.'
    )
  }

  // ── Next Week Goals ────────────────────────────────────────────────────
  const nextWeekGoals: string[] = []

  if (weekWinRate < 55) {
    nextWeekGoals.push(`Improve win rate to at least 55% by being more selective with entries.`)
  } else {
    nextWeekGoals.push(`Maintain or improve your current ${weekWinRate.toFixed(1)}% win rate.`)
  }

  if (weekProfitFactor < 1.5) {
    nextWeekGoals.push(`Push profit factor above 1.5 by letting winners run and cutting losers early.`)
  } else {
    nextWeekGoals.push(`Keep profit factor above 1.5 — your current edge is strong.`)
  }

  if (weekTotalPL < 0) {
    nextWeekGoals.push(`Return to profitability — target a positive week of at least ${formatCurrency(Math.abs(weekTotalPL) * 0.5)}.`)
  } else {
    nextWeekGoals.push(`Target at least ${formatCurrency(weekTotalPL * 0.8)} in profit for consistency.`)
  }

  if ((analytics?.maxDrawdown ?? 0) > 200) {
    nextWeekGoals.push(`Keep maximum drawdown below ${formatCurrency(200)} by using stricter position sizing.`)
  }

  nextWeekGoals.push('Log every trade with detailed notes for next week\'s analysis.')
  nextWeekGoals.push('Review and refine your trading plan before the week begins.')

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

// ─── Report to Plain Text ───────────────────────────────────────────────────

function reportToText(report: WeeklyReport): string {
  const lines: string[] = []

  lines.push('╔══════════════════════════════════════════════════════╗')
  lines.push('║            LUXTRADE AI WEEKLY REPORT                ║')
  lines.push('╚══════════════════════════════════════════════════════╝')
  lines.push('')
  lines.push(`📅 Period:     ${report.period}`)
  lines.push(`🕐 Generated:  ${new Date(report.generatedAt).toLocaleString()}`)
  lines.push('')
  lines.push('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
  lines.push('  EXECUTIVE SUMMARY')
  lines.push('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
  lines.push('')
  lines.push(report.summary)
  lines.push('')

  lines.push('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
  lines.push('  KEY METRICS')
  lines.push('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
  lines.push('')
  report.metrics.forEach((m) => {
    const icon = m.trend === 'up' ? '▲' : m.trend === 'down' ? '▼' : '◆'
    lines.push(`  ${icon}  ${m.label.padEnd(16)} ${m.value}`)
  })
  lines.push('')

  if (report.bestTrade || report.worstTrade) {
    lines.push('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
    lines.push('  BEST & WORST TRADES')
    lines.push('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
    lines.push('')
    if (report.bestTrade) {
      lines.push(
        `  ✅ Best:  ${report.bestTrade.symbol} (${report.bestTrade.type}) → +${formatCurrency(report.bestTrade.pl)}`
      )
    }
    if (report.worstTrade) {
      lines.push(
        `  ❌ Worst: ${report.worstTrade.symbol} (${report.worstTrade.type}) → ${formatCurrency(report.worstTrade.pl)}`
      )
    }
    lines.push('')
  }

  lines.push('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
  lines.push('  SESSION ANALYSIS')
  lines.push('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
  lines.push('')
  lines.push(report.sessionAnalysis)
  lines.push('')

  lines.push('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
  lines.push('  AI RECOMMENDATIONS')
  lines.push('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
  lines.push('')
  report.recommendations.forEach((r, i) => {
    lines.push(`  ${i + 1}. ${r}`)
  })
  lines.push('')

  lines.push('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
  lines.push('  NEXT WEEK GOALS')
  lines.push('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
  lines.push('')
  report.nextWeekGoals.forEach((g, i) => {
    lines.push(`  ☐ ${g}`)
  })
  lines.push('')
  lines.push('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
  lines.push('  Powered by LuxTrade AI  •  luxtrade.app')
  lines.push('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')

  return lines.join('\n')
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
      <Icon className="h-4 w-4 text-purple-400" />
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

    const text = reportToText(report)
    const blob = new Blob([text], { type: 'text/plain' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `luxtrade-weekly-report-${new Date().toISOString().slice(0, 10)}.txt`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
  }

  // ── Render ───────────────────────────────────────────────────────────
  return (
    <Card className="relative overflow-hidden border-white/[0.06] bg-[#0f0b18] shadow-2xl shadow-purple-500/5">
      {/* Ambient glow */}
      <div className="pointer-events-none absolute -top-24 right-0 h-48 w-48 rounded-full bg-purple-600/10 blur-[80px]" />
      <div className="pointer-events-none absolute -bottom-24 left-0 h-48 w-48 rounded-full bg-emerald-600/5 blur-[80px]" />

      {/* ─── Header ──────────────────────────────────────────────────── */}
      <CardHeader className="relative z-10 pb-0">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-purple-500/20 to-purple-600/10 border border-purple-500/20">
              <Brain className="h-5 w-5 text-purple-400" />
            </div>
            <div>
              <CardTitle className="text-base font-bold text-white">
                AI Weekly Report
              </CardTitle>
              <CardDescription className="text-xs text-slate-500">
                <Calendar className="mr-1 inline h-3 w-3" />
                {getWeekPeriod()} · {weekTrades.length} trade{weekTrades.length !== 1 ? 's' : ''}
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
              className="gap-1.5 bg-gradient-to-r from-purple-600 to-purple-500 text-white shadow-lg shadow-purple-500/20 hover:from-purple-500 hover:to-purple-400"
            >
              {isGenerating ? (
                <>
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  Analyzing…
                </>
              ) : isExpanded ? (
                <>
                  <ChevronUp className="h-3.5 w-3.5" />
                  Collapse
                </>
              ) : (
                <>
                  <Sparkles className="h-3.5 w-3.5" />
                  {report ? 'View Report' : 'Generate Report'}
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
            Get an AI-powered analysis of your weekly trading performance including key metrics,
            session breakdowns, personalized recommendations, and next-week goals.
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
                  className="absolute inset-0 z-50 flex flex-col items-center justify-center gap-4 rounded-xl bg-[#0f0b18]/90 backdrop-blur-md"
                >
                  <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-purple-500/30 to-purple-600/20 border border-purple-500/30">
                    <Sparkles className="h-7 w-7 text-purple-400" />
                  </div>
                  <div className="text-center">
                    <h3 className="text-lg font-bold text-white">Pro Feature</h3>
                    <p className="mt-1 max-w-xs text-sm text-slate-400">
                      Unlock AI-powered weekly reports with personalized insights and recommendations.
                    </p>
                  </div>
                  <Button
                    onClick={onUpgrade}
                    className="mt-2 bg-gradient-to-r from-purple-600 to-purple-500 text-white shadow-lg shadow-purple-500/25 hover:from-purple-500 hover:to-purple-400"
                  >
                    <Sparkles className="mr-2 h-4 w-4" />
                    Upgrade to Pro
                  </Button>
                </motion.div>
              )}

              {/* ── No Trades Message ────────────────────────────────── */}
              {hasNoTrades && (
                <div className="flex flex-col items-center gap-3 py-8 text-center">
                  <FileText className="h-10 w-10 text-slate-600" />
                  <p className="text-sm text-slate-500">No trades this week to analyze.</p>
                  <p className="text-xs text-slate-600">
                    Start logging your trades to receive AI-generated weekly insights.
                  </p>
                </div>
              )}

              {/* ── Executive Summary ────────────────────────────────── */}
              {!hasNoTrades && (
                <>
                  <div className="rounded-xl border border-white/[0.04] bg-white/[0.02] p-4">
                    <SectionHeader icon={FileText} title="Executive Summary" delay={0.1} />
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
                    <SectionHeader icon={TrendingUp} title="Key Metrics" delay={0.15} />
                    <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                      {report.metrics.map((metric, i) => (
                        <MetricCard key={metric.label} metric={metric} index={i} />
                      ))}
                    </div>
                  </div>

                  {/* ── Best & Worst Trades ──────────────────────────── */}
                  {(report.bestTrade || report.worstTrade) && (
                    <div className="rounded-xl border border-white/[0.04] bg-white/[0.02] p-4">
                      <SectionHeader icon={FileText} title="Best & Worst Trades" delay={0.2} />
                      <div className="grid gap-3 sm:grid-cols-2">
                        {report.bestTrade && (
                          <motion.div
                            initial={{ opacity: 0, y: 8 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: 0.3 }}
                            className="rounded-lg border border-emerald-500/15 bg-emerald-500/5 p-3"
                          >
                            <div className="mb-1 text-[10px] font-semibold uppercase tracking-widest text-emerald-500/70">
                              Best Trade
                            </div>
                            <div className="flex items-baseline justify-between">
                              <span className="font-bold text-white">{report.bestTrade.symbol}</span>
                              <span className="text-sm font-bold text-emerald-400">
                                +{formatCurrency(report.bestTrade.pl)}
                              </span>
                            </div>
                            <div className="mt-1 text-xs text-slate-500">
                              {report.bestTrade.type} position
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
                              Worst Trade
                            </div>
                            <div className="flex items-baseline justify-between">
                              <span className="font-bold text-white">{report.worstTrade.symbol}</span>
                              <span className="text-sm font-bold text-red-400">
                                {formatCurrency(report.worstTrade.pl)}
                              </span>
                            </div>
                            <div className="mt-1 text-xs text-slate-500">
                              {report.worstTrade.type} position
                            </div>
                          </motion.div>
                        )}
                      </div>
                    </div>
                  )}

                  {/* ── Session Analysis ──────────────────────────────── */}
                  <div className="rounded-xl border border-white/[0.04] bg-white/[0.02] p-4">
                    <SectionHeader icon={Calendar} title="Session Analysis" delay={0.25} />
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
                    <SectionHeader icon={Brain} title="AI Recommendations" delay={0.3} />
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
                    <SectionHeader icon={Sparkles} title="Next Week Goals" delay={0.35} />
                    <ul className="space-y-2.5">
                      {report.nextWeekGoals.map((goal, i) => (
                        <motion.li
                          key={i}
                          initial={{ opacity: 0, x: -8 }}
                          animate={{ opacity: 1, x: 0 }}
                          transition={{ delay: 0.4 + i * 0.06 }}
                          className="flex gap-2.5 text-sm text-slate-300"
                        >
                          <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-md border border-purple-500/25 bg-purple-500/10 text-[10px] font-bold text-purple-400">
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
                      Powered by LuxTrade AI
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
                            Copied!
                          </>
                        ) : (
                          <>
                            <Copy className="h-3 w-3" />
                            Copy Report
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
                        Download
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
