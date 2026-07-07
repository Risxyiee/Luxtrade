'use client'

import { useState, useEffect } from 'react'
import {
  DollarSign, Target, Activity, TrendingUp, TrendingDown,
  Sparkles, AlertTriangle, Clock, BarChart3, Plus,
  Trophy, Flame, Loader2, Wallet, ArrowUpRight, ArrowDownRight, Gem, CircleDot
} from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { motion } from 'framer-motion'
import { formatCurrency } from '@/lib/supabase'
import ActivityFeed from '@/components/ActivityFeed'
import { useConfetti } from '@/hooks/useConfetti'
import AnimatedStatCard from '../components/AnimatedStatCard'
import type { Trade, JournalEntry, Analytics } from '@/types'
import {
  AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, BarChart, Bar, Cell, CartesianGrid, ReferenceLine
} from 'recharts'

// Helpers extracted to dashboard/helpers.ts
import {
  calculateConsecutiveStreaks,
  calculateActiveStreak,
  getTodayPerformance,
  getWeeklyPerformance,
} from './dashboard/helpers'

// ==================== NUMBER FORMAT STANDARD ====================

function fmtPL(value: number): string {
  const sign = value >= 0 ? '+' : '-'
  return `${sign}$${Math.abs(value).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

function fmtPct(value: number): string {
  return `${value.toFixed(1)}%`
}

// ==================== SKELETON LOADING ====================

function SkeletonCard() {
  return (
    <Card className="bg-gradient-to-br from-[#0f0b18]/80 to-[#12091a]/80 backdrop-blur-sm border border-white/10">
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <div className="h-4 w-20 bg-white/10 rounded animate-pulse" />
        <div className="w-10 h-10 bg-white/10 rounded-xl animate-pulse" />
      </CardHeader>
      <CardContent>
        <div className="h-8 w-24 bg-white/10 rounded animate-pulse mb-2" />
        <div className="h-3 w-16 bg-white/5 rounded animate-pulse" />
      </CardContent>
    </Card>
  )
}

function SkeletonEquityCurve() {
  return (
    <Card className="bg-gradient-to-br from-[#0f0b18]/80 to-[#12091a]/80 backdrop-blur-md border-purple-500/20">
      <CardHeader className="flex flex-row items-center justify-between">
        <div className="h-5 w-40 bg-white/10 rounded animate-pulse" />
        <div className="h-4 w-20 bg-white/10 rounded animate-pulse" />
      </CardHeader>
      <CardContent>
        <div className="h-[320px] lg:h-[400px] bg-white/5 rounded-lg animate-pulse" />
      </CardContent>
    </Card>
  )
}

// ==================== STAT CARD (inline, no animation) ====================

function StatCard({ label, value, icon: Icon, color }: { label: string; value: string; icon: any; color: 'green' | 'red' | 'purple' }) {
  const colorMap = {
    green: { iconBg: 'bg-emerald-500/15', iconText: 'text-emerald-400', valueText: 'text-emerald-400' },
    red: { iconBg: 'bg-red-500/15', iconText: 'text-red-400', valueText: 'text-red-400' },
    purple: { iconBg: 'bg-purple-500/15', iconText: 'text-purple-400', valueText: 'text-purple-300' },
  }
  const c = colorMap[color]
  return (
    <Card className="bg-[#0a0712] border-purple-900/30 overflow-hidden relative group hover:border-purple-500/50 transition-all duration-300">
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm font-medium text-gray-400">{label}</CardTitle>
          {Icon && <div className={`p-2 rounded-lg ${c.iconBg}`}><Icon className={`w-4 h-4 ${c.iconText}`} /></div>}
        </div>
      </CardHeader>
      <CardContent>
        <div className={`text-xl font-bold ${c.valueText}`}>{value}</div>
      </CardContent>
    </Card>
  )
}

// ==================== LUXURIOUS EQUITY CURVE COMPONENT ====================

// Custom tooltip uses a ref pattern
const equityTooltipRef = { current: { curve: [] as { date: string; equity: number }[], first: 0 } }

function EquityTooltipContent({ active, payload, label }: any) {
  if (active && payload && payload.length) {
    const { curve, first } = equityTooltipRef.current
    const equity = payload[0].value
    const prevIdx = curve.findIndex((d) => d.date === label) - 1
    const prevEquity = prevIdx >= 0 ? curve[prevIdx].equity : first
    const change = equity - prevEquity
    return (
      <div className="bg-gradient-to-br from-[#0f0b18] to-[#1a1030] border border-purple-500/40 rounded-xl p-3 shadow-2xl shadow-purple-500/10">
        <p className="text-xs text-gray-400 mb-1.5">{label}</p>
        <p className="text-lg font-bold bg-gradient-to-r from-purple-300 to-amber-300 bg-clip-text text-transparent">
          ${equity.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
        </p>
        {prevIdx >= 0 && (
          <p className={`text-xs mt-1 flex items-center gap-1 ${change >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
            {change >= 0 ? <ArrowUpRight className="w-3 h-3" /> : <ArrowDownRight className="w-3 h-3" />}
            {change >= 0 ? '+' : ''}{change.toFixed(2)} ({((change / prevEquity) * 100).toFixed(1)}%)
          </p>
        )}
      </div>
    )
  }
  return null
}

function LuxuryEquityCurve({
  equityCurve,
  tradingAccounts,
  totalPL,
  language,
  chartAnimated
}: {
  equityCurve: { date: string; equity: number }[]
  tradingAccounts?: any[]
  totalPL: number
  language: 'id' | 'en'
  chartAnimated: boolean
}) {
  const lastEquity = equityCurve.length > 0 ? equityCurve[equityCurve.length - 1].equity : 0
  const firstEquity = equityCurve.length > 0 ? equityCurve[0].equity : 0
  const equityChange = lastEquity - firstEquity
  const equityChangePct = firstEquity > 0 ? ((equityChange / firstEquity) * 100) : 0
  const isPositive = totalPL >= 0

  // Find peak and trough
  const peakEquity = equityCurve.length > 0 ? Math.max(...equityCurve.map(d => d.equity)) : 0
  const troughEquity = equityCurve.length > 0 ? Math.min(...equityCurve.map(d => d.equity)) : 0
  const maxDD = peakEquity > 0 ? ((peakEquity - troughEquity) / peakEquity) * 100 : 0

  // Get default account
  const defaultAccount = tradingAccounts?.find((a: any) => a.is_default) || tradingAccounts?.[0]

  // Keep tooltip data in sync via effect
  useEffect(() => {
    equityTooltipRef.current = { curve: equityCurve, first: firstEquity }
  }, [equityCurve, firstEquity])

  const chartTooltipStyle = {
    background: 'linear-gradient(135deg, #0f0b18 0%, #1a1030 100%)',
    border: '1px solid rgba(139,92,246,0.4)',
    borderRadius: 12,
    boxShadow: '0 8px 32px rgba(0,0,0,0.5), 0 0 20px rgba(139,92,246,0.15)',
    padding: '12px 16px'
  }

  return (
    <Card className="relative overflow-hidden bg-gradient-to-br from-[#0f0b18] via-[#110d1f] to-[#0d0820] backdrop-blur-xl border border-purple-500/20 transition-all duration-500 hover:border-purple-500/40 hover:shadow-2xl hover:shadow-purple-500/10">
      {/* Background ambient effects */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden">
        <motion.div
          className="absolute -top-20 -left-20 w-60 h-60 bg-purple-500/8 rounded-full blur-3xl"
          animate={{ scale: [1, 1.3, 1], opacity: [0.3, 0.5, 0.3] }}
          transition={{ duration: 8, repeat: Infinity, ease: "easeInOut" }}
        />
        <motion.div
          className="absolute -bottom-16 -right-16 w-48 h-48 bg-amber-500/6 rounded-full blur-3xl"
          animate={{ scale: [1, 1.2, 1], opacity: [0.2, 0.4, 0.2] }}
          transition={{ duration: 10, repeat: Infinity, ease: "easeInOut", delay: 2 }}
        />
        {/* Subtle grid pattern */}
        <div className="absolute inset-0 opacity-[0.03]" style={{
          backgroundImage: 'linear-gradient(rgba(139,92,246,0.3) 1px, transparent 1px), linear-gradient(90deg, rgba(139,92,246,0.3) 1px, transparent 1px)',
          backgroundSize: '40px 40px'
        }} />
      </div>

      <CardHeader className="relative z-10 pb-2">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div className="flex items-center gap-3">
            <div className="relative">
              <div className={`p-2.5 rounded-xl bg-gradient-to-br ${isPositive ? 'from-emerald-500/20 to-emerald-600/10' : 'from-red-500/20 to-red-600/10'} border ${isPositive ? 'border-emerald-500/20' : 'border-red-500/20'}`}>
                <Gem className={`w-5 h-5 ${isPositive ? 'text-emerald-400' : 'text-red-400'}`} />
              </div>
              <motion.div
                className="absolute -top-0.5 -right-0.5 w-2.5 h-2.5 rounded-full"
                style={{ backgroundColor: isPositive ? '#22c55e' : '#ef4444' }}
                animate={{ scale: [1, 1.4, 1], opacity: [1, 0.5, 1] }}
                transition={{ duration: 2, repeat: Infinity }}
              />
            </div>
            <div>
              <CardTitle className="text-lg font-bold bg-gradient-to-r from-white via-purple-200 to-amber-200 bg-clip-text text-transparent">
                {language === 'id' ? 'Kurva Ekuitas' : 'Equity Curve'}
              </CardTitle>
              <p className="text-xs text-gray-500 mt-0.5">{equityCurve.length} {language === 'id' ? 'data poin' : 'data points'}</p>
            </div>
          </div>

          {/* Summary badges */}
          <div className="flex items-center gap-2">
            <div className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg border ${isPositive ? 'bg-emerald-500/10 border-emerald-500/20' : 'bg-red-500/10 border-red-500/20'}`}>
              {isPositive ? <ArrowUpRight className="w-3.5 h-3.5 text-emerald-400" /> : <ArrowDownRight className="w-3.5 h-3.5 text-red-400" />}
              <span className={`text-sm font-bold ${isPositive ? 'text-emerald-400' : 'text-red-400'}`}>
                {fmtPL(equityChange)}
              </span>
            </div>
            <div className={`px-3 py-1.5 rounded-lg border bg-purple-500/10 border-purple-500/20`}>
              <span className="text-sm font-bold text-purple-300">
                {equityChangePct >= 0 ? '+' : ''}{equityChangePct.toFixed(1)}%
              </span>
            </div>
          </div>
        </div>
      </CardHeader>

      <CardContent className="relative z-10">
        {/* Account Info Bar */}
        {defaultAccount && (
          <div className="mb-4 p-3.5 rounded-xl bg-gradient-to-r from-white/[0.03] to-white/[0.01] border border-white/[0.06]">
            <div className="flex items-center justify-between flex-wrap gap-3">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-purple-500/20 to-violet-500/20 border border-purple-500/20 flex items-center justify-center">
                  <Wallet className="w-4 h-4 text-purple-400" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-semibold text-white/90">{defaultAccount.name}</span>
                    <Badge className={`text-[10px] px-1.5 py-0 h-4 ${
                      defaultAccount.account_type === 'BACKTEST' ? 'bg-amber-500/15 text-amber-400 border-amber-500/30' :
                      defaultAccount.account_type === 'DEMO' ? 'bg-blue-500/15 text-blue-400 border-blue-500/30' :
                      'bg-emerald-500/15 text-emerald-400 border-emerald-500/30'
                    }`}>
                      {defaultAccount.account_type}
                    </Badge>
                    {defaultAccount.is_default && (
                      <Badge className="text-[10px] px-1.5 py-0 h-4 bg-purple-500/15 text-purple-300 border-purple-500/30">
                        DEFAULT
                      </Badge>
                    )}
                  </div>
                  <div className="flex items-center gap-3 mt-0.5 text-xs text-gray-500">
                    {defaultAccount.broker && <span>{defaultAccount.broker}</span>}
                    {defaultAccount.account_number && <span>#{defaultAccount.account_number}</span>}
                    <span>1:{defaultAccount.leverage}</span>
                  </div>
                </div>
              </div>
              <div className="text-right">
                <p className="text-[10px] uppercase tracking-wider text-gray-500 mb-0.5">{language === 'id' ? 'Saldo Saat Ini' : 'Current Balance'}</p>
                <p className="text-xl font-bold bg-gradient-to-r from-emerald-300 via-white to-purple-200 bg-clip-text text-transparent">
                  {defaultAccount.currency || 'USD'} {lastEquity.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </p>
                <div className="flex items-center gap-3 mt-1 text-[10px] text-gray-500 justify-end">
                  <span>{language === 'id' ? 'Awal' : 'Initial'}: {defaultAccount.currency || 'USD'} {firstEquity.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                  <span className="text-gray-700">|</span>
                  <span>DD: <span className="text-red-400/80">{maxDD.toFixed(1)}%</span></span>
                </div>
              </div>
            </div>

            {/* All accounts summary row */}
            {tradingAccounts && tradingAccounts.length > 1 && (
              <div className="mt-3 pt-3 border-t border-white/[0.06]">
                <div className="flex items-center gap-4 overflow-x-auto pb-1 scrollbar-none">
                  {tradingAccounts.map((acc: any) => {
                    const accEquity = acc.current_balance || acc.initial_balance || 0
                    const isAccDefault = acc.is_default
                    return (
                      <div key={acc.id} className={`flex items-center gap-2 px-3 py-1.5 rounded-lg border flex-shrink-0 transition-all ${isAccDefault ? 'bg-purple-500/10 border-purple-500/30' : 'bg-white/[0.02] border-white/[0.06] hover:border-white/[0.12]'}`}>
                        <CircleDot className={`w-3 h-3 ${isAccDefault ? 'text-purple-400' : 'text-gray-600'}`} />
                        <div>
                          <p className="text-xs font-medium text-white/70 truncate max-w-[120px]">{acc.name}</p>
                          <p className="text-[10px] text-gray-500">{acc.currency || 'USD'} {accEquity.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Chart Area */}
        <div className="h-[300px] lg:h-[380px] relative">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={equityCurve} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
              <defs>
                {/* Main gradient stroke */}
                <linearGradient id="luxEquityStroke" x1="0" y1="0" x2="1" y2="0">
                  <stop offset="0%" stopColor="#a78bfa" stopOpacity={1} />
                  <stop offset="30%" stopColor="#c084fc" stopOpacity={1} />
                  <stop offset="60%" stopColor="#f59e0b" stopOpacity={1} />
                  <stop offset="100%" stopColor="#fbbf24" stopOpacity={1} />
                </linearGradient>
                {/* Fill gradient - top to bottom fade */}
                <linearGradient id="luxEquityFill" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={isPositive ? '#22c55e' : '#ef4444'} stopOpacity={0.25} />
                  <stop offset="40%" stopColor="#8b5cf6" stopOpacity={0.12} />
                  <stop offset="100%" stopColor="#8b5cf6" stopOpacity={0} />
                </linearGradient>
                {/* Glow filter */}
                <filter id="glow">
                  <feGaussianBlur stdDeviation="3" result="coloredBlur" />
                  <feMerge>
                    <feMergeNode in="coloredBlur" />
                    <feMergeNode in="SourceGraphic" />
                  </feMerge>
                </filter>
                {/* Dot glow */}
                <radialGradient id="dotGlow" cx="50%" cy="50%" r="50%">
                  <stop offset="0%" stopColor="#c084fc" stopOpacity={0.8} />
                  <stop offset="100%" stopColor="#c084fc" stopOpacity={0} />
                </radialGradient>
              </defs>

              {/* Reference line at starting balance */}
              <ReferenceLine
                y={firstEquity}
                stroke="rgba(255,255,255,0.08)"
                strokeDasharray="6 4"
              />

              <CartesianGrid
                strokeDasharray="3 6"
                stroke="rgba(255,255,255,0.04)"
                vertical={false}
              />

              <XAxis
                dataKey="date"
                tick={{ fill: 'rgba(255,255,255,0.25)', fontSize: 10 }}
                axisLine={false}
                tickLine={false}
                interval="preserveStartEnd"
              />
              <YAxis
                tick={{ fill: 'rgba(255,255,255,0.25)', fontSize: 10 }}
                axisLine={false}
                tickLine={false}
                tickFormatter={(v: number) => `$${(v / 1000).toFixed(1)}k`}
                width={55}
                domain={['auto', 'auto']}
              />

              <Tooltip content={EquityTooltipContent} />

              {/* Glow layer behind the main line */}
              <Area
                type="monotone"
                dataKey="equity"
                stroke="url(#luxEquityStroke)"
                strokeWidth={1}
                fill="transparent"
                filter="url(#glow)"
                animationDuration={chartAnimated ? 2000 : 0}
                animationEasing="ease-out"
                isAnimationActive={chartAnimated}
              />
              {/* Main area */}
              <Area
                type="monotone"
                dataKey="equity"
                stroke="url(#luxEquityStroke)"
                strokeWidth={2.5}
                fill="url(#luxEquityFill)"
                animationDuration={chartAnimated ? 2000 : 0}
                animationEasing="ease-out"
                isAnimationActive={chartAnimated}
                dot={false}
                activeDot={{
                  r: 6,
                  fill: '#c084fc',
                  stroke: '#fff',
                  strokeWidth: 2,
                  filter: 'url(#glow)'
                }}
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>

        {/* Bottom stats bar */}
        <div className="mt-4 flex items-center justify-between flex-wrap gap-3 pt-3 border-t border-white/[0.06]">
          <div className="flex items-center gap-5">
            <div>
              <p className="text-[10px] uppercase tracking-wider text-gray-500">{language === 'id' ? 'Ekuitas Tertinggi' : 'Peak Equity'}</p>
              <p className="text-sm font-bold text-emerald-400">${peakEquity.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>
            </div>
            <div>
              <p className="text-[10px] uppercase tracking-wider text-gray-500">{language === 'id' ? 'Ekuitas Terendah' : 'Trough Equity'}</p>
              <p className="text-sm font-bold text-red-400">${troughEquity.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>
            </div>
            <div>
              <p className="text-[10px] uppercase tracking-wider text-gray-500">{language === 'id' ? 'Max Drawdown' : 'Max Drawdown'}</p>
              <p className="text-sm font-bold text-amber-400">-{maxDD.toFixed(1)}%</p>
            </div>
          </div>
          <div className="text-right">
            <p className="text-[10px] uppercase tracking-wider text-gray-500">{language === 'id' ? 'Total Return' : 'Total Return'}</p>
            <p className={`text-sm font-bold flex items-center gap-1 justify-end ${equityChangePct >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
              {equityChangePct >= 0 ? <TrendingUp className="w-3.5 h-3.5" /> : <TrendingDown className="w-3.5 h-3.5" />}
              {equityChangePct >= 0 ? '+' : ''}{equityChangePct.toFixed(2)}%
            </p>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

// ==================== PERFORMANCE TOGGLE ====================

function PerformanceSection({ trades, language }: { trades: Trade[]; language: 'id' | 'en' }) {
  const [tab, setTab] = useState<'today' | 'weekly'>('today')
  const todayPerf = getTodayPerformance(trades)
  const weeklyPerf = getWeeklyPerformance(trades)
  const perf = tab === 'today' ? todayPerf : weeklyPerf

  return (
    <Card className="bg-gradient-to-br from-[#0f0b18]/80 to-[#12091a]/80 backdrop-blur-md border-purple-500/20 transition-all duration-300 hover:border-purple-500/40 hover:shadow-lg hover:shadow-purple-500/10">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base flex items-center gap-2">
            <Clock className="w-4 h-4 text-purple-400" />
            {tab === 'today'
              ? (language === 'id' ? 'Performa Hari Ini' : "Today's Performance")
              : (language === 'id' ? 'Performa Minggu Ini' : 'Weekly Performance')}
          </CardTitle>
          <div className="flex gap-1 bg-white/5 rounded-lg p-0.5">
            <button
              onClick={() => setTab('today')}
              className={`px-3 py-1 text-xs font-medium rounded-md transition-all ${tab === 'today' ? 'bg-purple-500/20 text-purple-300 border border-purple-500/30' : 'text-gray-500 hover:text-gray-300'}`}
            >
              {language === 'id' ? 'Hari Ini' : 'Today'}
            </button>
            <button
              onClick={() => setTab('weekly')}
              className={`px-3 py-1 text-xs font-medium rounded-md transition-all ${tab === 'weekly' ? 'bg-purple-500/20 text-purple-300 border border-purple-500/30' : 'text-gray-500 hover:text-gray-300'}`}
            >
              {language === 'id' ? 'Minggu Ini' : 'Weekly'}
            </button>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-4 gap-3">
          <div><p className="text-xs text-gray-400 mb-1">{language === 'id' ? 'Transaksi' : 'Trades'}</p><p className="text-lg font-bold text-purple-300">{perf.trades}</p></div>
          <div><p className="text-xs text-gray-400 mb-1">P/L</p><p className={`text-lg font-bold ${perf.totalPL >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>{fmtPL(perf.totalPL)}</p></div>
          <div><p className="text-xs text-gray-400 mb-1">Win Rate</p><p className="text-lg font-bold text-purple-300">{fmtPct(perf.winRate)}</p></div>
          <div><p className="text-xs text-gray-400 mb-1">W/L</p><p className="text-lg font-bold text-purple-300">{perf.wins}/{perf.losses}</p></div>
        </div>
        {tab === 'weekly' && (
          <div className="mt-4 pt-4 border-t border-white/10">
            <div className="flex items-center justify-between mb-2">
              <p className="text-sm text-gray-400">{language === 'id' ? 'Target Mingguan' : 'Weekly Target'}</p>
              <p className="text-sm font-bold text-purple-300">{weeklyPerf.trades} / 10 {language === 'id' ? 'transaksi' : 'trades'}</p>
            </div>
            <div className="h-2 bg-white/10 rounded-full overflow-hidden">
              <motion.div
                className="h-full bg-gradient-to-r from-purple-500 via-violet-500 to-amber-500 rounded-full"
                initial={{ width: 0 }}
                animate={{ width: `${Math.min((weeklyPerf.trades / 10) * 100, 100)}%` }}
                transition={{ duration: 1.5, ease: "easeOut" }}
              />
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  )
}

// ==================== DASHBOARD TAB ====================

interface DashboardTabProps {
  analytics: Analytics | null
  trades: Trade[]
  journalEntries: JournalEntry[]
  loading: boolean
  setAddTradeOpen: (open: boolean) => void
  onView: (trade: Trade) => void
  onEdit: (trade: Trade) => void
  onDelete: (trade: Trade) => void
  chartAnimated: boolean
  language: 'id' | 'en'
  isPro: boolean
  profile?: any
  tradingAccounts?: any[]
}

function DashboardTab({
  analytics,
  trades,
  journalEntries,
  loading,
  setAddTradeOpen,
  onView,
  onEdit,
  onDelete,
  chartAnimated,
  language,
  isPro,
  profile,
  tradingAccounts
}: DashboardTabProps) {
  const hasData = trades.length > 0
  const todayPerf = getTodayPerformance(trades)
  const weeklyPerf = getWeeklyPerformance(trades)
  const activeStreak = calculateActiveStreak(trades)
  const { triggerMilestoneConfetti } = useConfetti()

  // Confetti triggers
  useEffect(() => {
    if (!hasData) triggerMilestoneConfetti('first-trade')
  }, [hasData, triggerMilestoneConfetti])

  useEffect(() => {
    if (activeStreak.type === 'win' && activeStreak.count >= 3) triggerMilestoneConfetti('win-streak')
  }, [activeStreak, triggerMilestoneConfetti])

  useEffect(() => {
    if (weeklyPerf.trades >= 10) triggerMilestoneConfetti('weekly-target')
  }, [weeklyPerf.trades, triggerMilestoneConfetti])

  // Derived stats
  const totalPL = analytics?.totalPL || 0
  const winRate = analytics?.winRate || 0
  const profitFactor = analytics?.profitFactor || 0
  const bestTrade = trades.length > 0 ? Math.max(...trades.map(t => t.profit_loss)) : 0
  const bestTradeSymbol = trades.length > 0 ? trades.find(t => t.profit_loss === bestTrade)?.symbol : ''
  const worstTrade = trades.length > 0 ? Math.min(...trades.map(t => t.profit_loss)) : 0
  const worstTradeSymbol = trades.length > 0 ? trades.find(t => t.profit_loss === worstTrade)?.symbol : ''
  const winStreak = calculateConsecutiveStreaks(trades, 'win')
  const loseStreak = calculateConsecutiveStreaks(trades, 'lose')

  const chartTooltipStyle = { background: '#0f0b18', border: '1px solid rgba(139,92,246,0.3)', borderRadius: 8 }

  if (loading) {
    return (
      <div className="space-y-6 relative">
        {/* Skeleton Banner */}
        <div className="relative overflow-hidden bg-gradient-to-br from-purple-600/20 via-violet-600/10 to-amber-500/10 border-purple-500/30 backdrop-blur-sm rounded-xl p-6">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 bg-white/10 rounded-xl animate-pulse" />
            <div className="flex-1 space-y-2">
              <div className="h-5 w-64 bg-white/10 rounded animate-pulse" />
              <div className="h-4 w-96 bg-white/5 rounded animate-pulse" />
            </div>
          </div>
        </div>
        {/* Skeleton Equity Curve */}
        <SkeletonEquityCurve />
        {/* Skeleton Stats */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 lg:gap-4">
          {[1, 2, 3, 4, 5, 6].map((i) => <SkeletonCard key={i} />)}
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6 relative min-h-screen">

      {/* ============================================ */}
      {/* 1. COMPACT WELCOME BANNER                    */}
      {/* ============================================ */}
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, ease: "easeOut" }}
      >
        <Card className="relative overflow-hidden bg-gradient-to-br from-purple-600/15 via-violet-600/10 to-amber-500/10 backdrop-blur-md border border-purple-500/20">
          <div className="absolute inset-0 overflow-hidden pointer-events-none">
            <motion.div className="absolute -top-12 -right-12 w-40 h-40 bg-purple-500/15 rounded-full blur-3xl" animate={{ scale: [1, 1.2, 1] }} transition={{ duration: 6, repeat: Infinity }} />
          </div>
          <CardContent className="relative p-5 lg:p-6">
            <div className="flex items-center gap-4">
              <div className="w-10 h-10 rounded-full bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center text-sm font-bold shadow-lg shadow-purple-500/30 flex-shrink-0">
                {profile?.full_name?.split(' ').map((n: string) => n[0]).join('').slice(0, 2).toUpperCase() || 'T'}
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2 mb-0.5">
                  <span className="text-xs font-semibold text-purple-300 uppercase tracking-wider">
                    {language === 'id' ? 'Selamat Datang' : 'Welcome Back'}
                  </span>
                  <motion.div animate={{ rotate: [0, 360] }} transition={{ duration: 20, repeat: Infinity, ease: "linear" }}>
                    <Sparkles className="w-3.5 h-3.5 text-amber-400" />
                  </motion.div>
                </div>
                <h1 className="text-lg lg:text-xl font-display font-bold bg-gradient-to-r from-white via-purple-200 to-amber-200 bg-clip-text text-transparent truncate">
                  {language === 'id' ? `Halo, ${profile?.full_name?.split(' ')[0] || 'Trader'}! 👋` : `Hello, ${profile?.full_name?.split(' ')[0] || 'Trader'}! 👋`}
                </h1>
              </div>
              {/* Single highlight: Total P/L */}
              {hasData && (
                <div className="hidden sm:block text-right flex-shrink-0">
                  <p className="text-xs text-gray-400 mb-0.5">{language === 'id' ? 'Total P/L' : 'Total P/L'}</p>
                  <p className={`text-xl font-bold ${totalPL >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>{fmtPL(totalPL)}</p>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </motion.div>

      {/* ============================================ */}
      {/* 2. LUXURIOUS EQUITY CURVE                    */}
      {/* ============================================ */}
      {hasData && analytics?.equityCurve && analytics.equityCurve.length >= 1 && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.05 }}
          aria-label="Equity curve chart"
        >
          <LuxuryEquityCurve
            equityCurve={analytics.equityCurve}
            tradingAccounts={tradingAccounts}
            totalPL={totalPL}
            language={language}
            chartAnimated={chartAnimated}
          />
        </motion.div>
      )}

      {/* ============================================ */}
      {/* 3. CONSOLIDATED STATS GRID (single source)   */}
      {/* ============================================ */}
      {hasData && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 lg:gap-4" aria-live="polite" aria-label="Trading statistics overview">
          {/* P/L — green if positive, red if negative */}
          <AnimatedStatCard
            title={language === 'id' ? 'Total P/L' : 'Total P/L'}
            value={totalPL}
            prefix="$"
            subtitle={`${analytics?.totalTrades || 0} ${language === 'id' ? 'transaksi' : 'trades'}`}
            icon={DollarSign}
            iconColor={totalPL >= 0 ? 'text-emerald-400' : 'text-red-400'}
            iconBgColor={totalPL >= 0 ? 'bg-emerald-500/15' : 'bg-red-500/15'}
            gradientBg={totalPL >= 0 ? 'from-emerald-500/30 to-emerald-600/20' : 'from-red-500/30 to-red-600/20'}
            valueColor={totalPL >= 0 ? 'text-emerald-400' : 'text-red-400'}
            color={totalPL >= 0 ? 'emerald' : 'red'}
          />
          {/* Win Rate — green if >= 50%, purple otherwise */}
          <AnimatedStatCard
            title="Win Rate"
            value={winRate}
            suffix="%"
            subtitle={language === 'id' ? 'Tingkat menang' : 'Success rate'}
            icon={Target}
            iconColor={winRate >= 50 ? 'text-emerald-400' : 'text-purple-400'}
            iconBgColor={winRate >= 50 ? 'bg-emerald-500/15' : 'bg-purple-500/15'}
            gradientBg={winRate >= 50 ? 'from-emerald-500/30 to-emerald-600/20' : 'from-purple-500/30 to-violet-600/20'}
            valueColor={winRate >= 50 ? 'text-emerald-400' : 'text-purple-300'}
            color={winRate >= 50 ? 'emerald' : 'purple'}
            decimals={1}
          />
          {/* Profit Factor — neutral (purple) */}
          <AnimatedStatCard
            title="Profit Factor"
            value={profitFactor}
            subtitle={profitFactor === Infinity ? (language === 'id' ? 'Tanpa kerugian!' : 'No losses!') : profitFactor >= 1.5 ? (language === 'id' ? 'Sangat bagus' : 'Excellent') : profitFactor >= 1 ? (language === 'id' ? 'Cukup baik' : 'Good') : (language === 'id' ? 'Perlu perbaikan' : 'Needs work')}
            icon={TrendingUp}
            iconColor="text-purple-400"
            iconBgColor="bg-purple-500/15"
            gradientBg="from-purple-500/30 to-violet-600/20"
            valueColor="text-purple-300"
            color="purple"
            decimals={2}
          />
          {/* Win/Loss count — neutral (purple) */}
          <AnimatedStatCard
            title={language === 'id' ? 'Menang / Kalah' : 'Win / Loss'}
            value={analytics?.winningTrades || 0}
            subtitle={`${analytics?.losingTrades || 0} ${language === 'id' ? 'kekalahan' : 'losses'}`}
            icon={Activity}
            iconColor="text-purple-400"
            iconBgColor="bg-purple-500/15"
            gradientBg="from-purple-500/30 to-violet-600/20"
            valueColor="text-purple-300"
            color="purple"
            decimals={0}
          />
          {/* Best Trade — green */}
          <StatCard
            label={language === 'id' ? 'Trade Terbaik' : 'Best Trade'}
            value={`${fmtPL(bestTrade)}${bestTradeSymbol ? ` ${bestTradeSymbol}` : ''}`}
            icon={Sparkles}
            color="green"
          />
          {/* Worst Trade — red */}
          <StatCard
            label={language === 'id' ? 'Trade Terburuk' : 'Worst Trade'}
            value={`${fmtPL(worstTrade)}${worstTradeSymbol ? ` ${worstTradeSymbol}` : ''}`}
            icon={AlertTriangle}
            color="red"
          />
          {/* Win Streak — green */}
          <StatCard
            label={language === 'id' ? 'Win Streak' : 'Win Streak'}
            value={String(winStreak)}
            icon={TrendingUp}
            color="green"
          />
          {/* Lose Streak — red */}
          <StatCard
            label={language === 'id' ? 'Lose Streak' : 'Lose Streak'}
            value={String(loseStreak)}
            icon={TrendingDown}
            color="red"
          />
        </div>
      )}

      {/* ============================================ */}
      {/* 4. PERFORMANCE TOGGLE (Today / Weekly)        */}
      {/* ============================================ */}
      {hasData && (
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5, delay: 0.1 }}>
          <PerformanceSection trades={trades} language={language} />
        </motion.div>
      )}

      {/* Active Streak Banner */}
      {hasData && activeStreak.count > 0 && (
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5, delay: 0.12 }}>
          <Card className={`relative overflow-hidden bg-gradient-to-br backdrop-blur-md transition-all duration-300 hover:-translate-y-1 ${activeStreak.type === 'win' ? 'from-emerald-500/20 to-green-500/10 border-emerald-500/20' : 'from-red-500/20 to-rose-500/10 border-red-500/20'}`}>
            <CardContent className="relative p-4 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Flame className={`w-5 h-5 ${activeStreak.type === 'win' ? 'text-emerald-400' : 'text-red-400'}`} />
                <div>
                  <p className={`text-sm font-medium ${activeStreak.type === 'win' ? 'text-emerald-300' : 'text-red-300'}`}>
                    {activeStreak.type === 'win'
                      ? (language === 'id' ? `Win Streak Aktif: ${activeStreak.count} 🔥` : `Active Win Streak: ${activeStreak.count} 🔥`)
                      : (language === 'id' ? `Lose Streak Aktif: ${activeStreak.count} 🧘` : `Active Lose Streak: ${activeStreak.count} 🧘`)}
                  </p>
                  <p className="text-xs text-gray-400">
                    {activeStreak.type === 'win'
                      ? (language === 'id' ? 'Pertahankan momentum!' : 'Keep the momentum going!')
                      : (language === 'id' ? 'Istirahat sejenak dan reset mindset.' : 'Take a break and reset your mindset.')}
                  </p>
                </div>
              </div>
              {activeStreak.type === 'win' && activeStreak.count >= 3 && <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} className="text-4xl">🏆</motion.div>}
            </CardContent>
          </Card>
        </motion.div>
      )}

      {/* ============================================ */}
      {/* 5. RECENT TRADES                             */}
      {/* ============================================ */}
      {hasData && (
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5, delay: 0.2 }}>
          <Card className="bg-gradient-to-br from-[#0f0b18] to-[#12091a] border-purple-900/30">
            <CardHeader className="flex flex-row items-center justify-between"><CardTitle className="text-lg">{language === 'id' ? 'Transaksi Terbaru' : 'Recent Trades'}</CardTitle><span className="text-xs text-gray-400">{trades.length} {language === 'id' ? 'total' : 'total'}</span></CardHeader>
            <CardContent>
              <div className="space-y-2">
                {trades.slice(0, 5).map((trade, index) => (
                  <motion.div key={trade.id} className="flex items-center justify-between p-3 rounded-lg bg-white/5 hover:bg-white/10 transition-all cursor-pointer group" onClick={() => onView(trade)} initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} transition={{ duration: 0.3, delay: index * 0.05 }} whileHover={{ x: 4 }}>
                    <div className="flex items-center gap-3">
                      <motion.div className={`w-2 h-2 rounded-full ${trade.profit_loss >= 0 ? 'bg-emerald-400' : 'bg-red-400'}`} animate={{ scale: [1, 1.2, 1] }} transition={{ duration: 2, repeat: Infinity, delay: index * 0.2 }} />
                      <span className="font-bold">{trade.symbol}</span>
                      <Badge variant={trade.type === 'BUY' ? 'default' : 'destructive'} className="text-xs">{trade.type}</Badge>
                      <span className="text-xs text-gray-500 hidden sm:inline">{trade.session || '-'}</span>
                    </div>
                    <span className={`font-bold ${trade.profit_loss >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>{fmtPL(trade.profit_loss)}</span>
                  </motion.div>
                ))}
              </div>
            </CardContent>
          </Card>
        </motion.div>
      )}

      {/* ============================================ */}
      {/* 6. SESSION PERFORMANCE CHART                 */}
      {/* ============================================ */}
      {hasData && analytics?.sessionPerformance && (
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5, delay: 0.25 }} aria-label="Trading session performance chart">
          <Card className="bg-gradient-to-br from-[#0f0b18]/80 to-[#12091a]/80 backdrop-blur-md border-purple-500/20 transition-all duration-300 hover:border-purple-500/40 hover:shadow-lg hover:shadow-purple-500/10">
            <CardHeader><CardTitle className="text-lg flex items-center gap-2"><Clock className="w-5 h-5 text-purple-400" /> {language === 'id' ? 'Performa Sesi' : 'Session Performance'}</CardTitle></CardHeader>
            <CardContent>
              <div className="h-[220px]">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={analytics.sessionPerformance}>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" vertical={false} />
                    <XAxis dataKey="session" tick={{ fill: 'rgba(255,255,255,0.5)', fontSize: 11 }} axisLine={false} tickLine={false} />
                    <YAxis tick={{ fill: 'rgba(255,255,255,0.3)', fontSize: 10 }} axisLine={false} tickLine={false} tickFormatter={(v: number) => `$${v}`} />
                    <Tooltip contentStyle={chartTooltipStyle} formatter={(value: number) => formatCurrency(value)} />
                    <Bar dataKey="pl" radius={[4, 4, 0, 0]} label={{ position: 'top', fill: 'rgba(255,255,255,0.5)', fontSize: 10, formatter: (v: number) => v >= 0 ? `+$${v}` : `-$${Math.abs(v)}` }}>
                      {analytics.sessionPerformance.map((entry, index) => <Cell key={`cell-${index}`} fill={entry.pl >= 0 ? '#22c55e' : '#ef4444'} />)}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>
        </motion.div>
      )}

      {/* ============================================ */}
      {/* 7. ACTIVITY FEED                             */}
      {/* ============================================ */}
      {hasData && (
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5, delay: 0.3 }}>
          <Card className="bg-gradient-to-br from-[#0f0b18] to-[#12091a] border-purple-900/30">
            <CardHeader className="flex flex-row items-center justify-between"><CardTitle className="text-lg flex items-center gap-2"><Activity className="w-5 h-5 text-purple-400" />{language === 'id' ? 'Aktivitas Terbaru' : 'Recent Activity'}</CardTitle></CardHeader>
            <CardContent><ActivityFeed trades={trades} journalEntries={journalEntries} language={language} /></CardContent>
          </Card>
        </motion.div>
      )}

      {/* ============================================ */}
      {/* EMPTY STATE                                  */}
      {/* ============================================ */}
      {!hasData && (
        <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} transition={{ duration: 0.5 }}>
          <Card className="bg-gradient-to-br from-[#0f0b18]/80 to-[#12091a]/80 backdrop-blur-md border-purple-500/20 transition-all duration-300 hover:border-purple-500/40">
            <CardContent className="py-16 lg:py-20 text-center">
              <motion.div className="w-16 h-16 lg:w-20 lg:h-20 rounded-full bg-gradient-to-br from-purple-500/20 to-violet-500/20 flex items-center justify-center mx-auto mb-6" animate={{ scale: [1, 1.05, 1] }} transition={{ duration: 2, repeat: Infinity }}><BarChart3 className="w-8 h-8 lg:w-10 lg:h-10 text-purple-400" /></motion.div>
              <h3 className="text-xl lg:text-2xl font-bold mb-3 bg-gradient-to-r from-purple-200 to-purple-400 bg-clip-text text-transparent">Welcome to LuxTrade!</h3>
              <p className="text-gray-400 mb-6 max-w-md mx-auto">Start tracking your trades to see powerful analytics and insights.</p>
              <div className="flex flex-col sm:flex-row gap-4 justify-center">
                <Button onClick={() => setAddTradeOpen(true)} className="bg-gradient-to-r from-purple-500 to-violet-600 shadow-lg shadow-purple-500/20"><Plus className="w-4 h-4 mr-2" />Add Your First Trade</Button>
              </div>
            </CardContent>
          </Card>
        </motion.div>
      )}
    </div>
  )
}

export default DashboardTab