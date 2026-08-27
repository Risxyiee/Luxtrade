'use client'

import { useState, useEffect } from 'react'
import dynamic from 'next/dynamic'
import {
  DollarSign, Target, Activity, TrendingUp, TrendingDown,
  Sparkles, AlertTriangle, Clock, BarChart3, Plus,
  Trophy, Flame, Loader2
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
  BarChart, Bar, Cell, CartesianGrid, Tooltip, ResponsiveContainer, XAxis, YAxis
} from 'recharts'

// Lightweight equity curve - lazy loaded, zero recharts/framer-motion dependency
const EquityCurveCard = dynamic(() => import('../components/EquityCurveCard'), {
  ssr: false,
  loading: () => <Card className="bg-lux-bg-card dark:bg-gradient-to-br dark:from-[#0a0c12] dark:to-[#080a14] border border-lux-border dark:border-blue-500/20"><CardContent className="py-16 flex items-center justify-center"><Loader2 className="w-6 h-6 text-blue-400 animate-spin" /></CardContent></Card>
})

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
    <Card className="bg-lux-bg-card dark:bg-gradient-to-br dark:from-[#0a0c12]/80 dark:to-[#080a14]/80 backdrop-blur-sm border border-lux-border dark:border-white/10">
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
    <Card className="bg-lux-bg-card dark:bg-gradient-to-br dark:from-[#0a0c12]/80 dark:to-[#080a14]/80 backdrop-blur-md border-lux-border dark:border-blue-500/20">
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

function StatCard({ label, value, icon: Icon, color }: { label: string; value: string; icon: any; color: 'green' | 'red' | 'blue' }) {
  const colorMap = {
    green: { iconBg: 'bg-emerald-500/15', iconText: 'text-emerald-400', valueText: 'text-emerald-400' },
    red: { iconBg: 'bg-red-500/15', iconText: 'text-red-400', valueText: 'text-red-400' },
    blue: { iconBg: 'bg-blue-500/15', iconText: 'text-blue-400', valueText: 'text-blue-300' },
  }
  const c = colorMap[color]
  return (
    <Card className="bg-lux-bg-card dark:bg-[#060810] border-lux-border dark:border-blue-900/30 overflow-hidden relative group hover:border-blue-500/50 transition-all duration-300">
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm font-medium text-lux-text-secondary dark:text-gray-400">{label}</CardTitle>
          {Icon && <div className={`p-2 rounded-lg ${c.iconBg}`}><Icon className={`w-4 h-4 ${c.iconText}`} /></div>}
        </div>
      </CardHeader>
      <CardContent>
        <div className={`text-xl font-bold ${c.valueText}`}>{value}</div>
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
    <Card className="bg-lux-bg-card dark:bg-gradient-to-br dark:from-[#0a0c12]/80 dark:to-[#080a14]/80 backdrop-blur-md border-lux-border dark:border-blue-500/20 transition-all duration-300 hover:border-blue-500/40 hover:shadow-lg hover:shadow-blue-500/10">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base flex items-center gap-2">
            <Clock className="w-4 h-4 text-blue-400" />
            {tab === 'today'
              ? (language === 'id' ? 'Performa Hari Ini' : "Today's Performance")
              : (language === 'id' ? 'Performa Minggu Ini' : 'Weekly Performance')}
          </CardTitle>
          <div className="flex gap-1 bg-white/5 rounded-lg p-0.5">
            <button
              onClick={() => setTab('today')}
              className={`px-3 py-1 text-xs font-medium rounded-md transition-all ${tab === 'today' ? 'bg-blue-500/20 text-blue-300 border border-blue-500/30' : 'text-lux-text-muted dark:text-gray-500 dark:hover:text-gray-300'}`}
            >
              {language === 'id' ? 'Hari Ini' : 'Today'}
            </button>
            <button
              onClick={() => setTab('weekly')}
              className={`px-3 py-1 text-xs font-medium rounded-md transition-all ${tab === 'weekly' ? 'bg-blue-500/20 text-blue-300 border border-blue-500/30' : 'text-lux-text-muted dark:text-gray-500 dark:hover:text-gray-300'}`}
            >
              {language === 'id' ? 'Minggu Ini' : 'Weekly'}
            </button>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-4 gap-3">
          <div><p className="text-xs text-lux-text-secondary dark:text-gray-400 mb-1">{language === 'id' ? 'Transaksi' : 'Trades'}</p><p className="text-lg font-bold text-blue-300">{perf.trades}</p></div>
          <div><p className="text-xs text-lux-text-secondary dark:text-gray-400 mb-1">P/L</p><p className={`text-lg font-bold ${perf.totalPL >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>{fmtPL(perf.totalPL)}</p></div>
          <div><p className="text-xs text-lux-text-secondary dark:text-gray-400 mb-1">Win Rate</p><p className="text-lg font-bold text-blue-300">{fmtPct(perf.winRate)}</p></div>
          <div><p className="text-xs text-lux-text-secondary dark:text-gray-400 mb-1">W/L</p><p className="text-lg font-bold text-blue-300">{perf.wins}/{perf.losses}</p></div>
        </div>
        {tab === 'weekly' && (
          <div className="mt-4 pt-4 border-t border-white/10">
            <div className="flex items-center justify-between mb-2">
              <p className="text-sm text-lux-text-secondary dark:text-gray-400">{language === 'id' ? 'Target Mingguan' : 'Weekly Target'}</p>
              <p className="text-sm font-bold text-blue-300">{weeklyPerf.trades} / 10 {language === 'id' ? 'transaksi' : 'trades'}</p>
            </div>
            <div className="h-2 bg-white/10 rounded-full overflow-hidden">
              <motion.div
                className="h-full bg-gradient-to-r from-blue-500 via-blue-400 to-amber-500 rounded-full"
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

  const chartTooltipStyle = { background: '#0a0c12', border: '1px solid rgba(59,130,246,0.3)', borderRadius: 8 }

  if (loading) {
    return (
      <div className="space-y-6 relative">
        {/* Skeleton Banner */}
        <div className="relative overflow-hidden bg-gradient-to-br from-blue-600/20 via-blue-600/10 to-amber-500/10 border-blue-500/30 backdrop-blur-sm rounded-xl p-6">
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
        <Card className="relative overflow-hidden bg-gradient-to-br from-blue-600/15 via-blue-600/10 to-amber-500/10 backdrop-blur-md border border-lux-border dark:border-blue-500/20">
          <div className="absolute inset-0 overflow-hidden pointer-events-none">
            <motion.div className="absolute -top-12 -right-12 w-40 h-40 bg-blue-500/15 rounded-full blur-3xl" animate={{ scale: [1, 1.2, 1] }} transition={{ duration: 6, repeat: Infinity }} />
          </div>
          <CardContent className="relative p-5 lg:p-6">
            <div className="flex items-center gap-4">
              <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-500 to-cyan-500 flex items-center justify-center text-sm font-bold shadow-lg shadow-blue-500/30 flex-shrink-0">
                {profile?.full_name?.split(' ').map((n: string) => n[0]).join('').slice(0, 2).toUpperCase() || 'T'}
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2 mb-0.5">
                  <span className="text-xs font-semibold text-blue-300 uppercase tracking-wider">
                    {language === 'id' ? 'Selamat Datang' : 'Welcome Back'}
                  </span>
                  <motion.div animate={{ rotate: [0, 360] }} transition={{ duration: 20, repeat: Infinity, ease: "linear" }}>
                    <Sparkles className="w-3.5 h-3.5 text-amber-400" />
                  </motion.div>
                </div>
                <h1 className="text-lg lg:text-xl font-display font-bold bg-gradient-to-r from-white via-blue-200 to-amber-200 bg-clip-text text-transparent truncate">
                  {language === 'id' ? `Halo, ${profile?.full_name?.split(' ')[0] || 'Trader'}! 👋` : `Hello, ${profile?.full_name?.split(' ')[0] || 'Trader'}! 👋`}
                </h1>
              </div>
              {/* Single highlight: Total P/L */}
              {hasData && (
                <div className="hidden sm:block text-right flex-shrink-0">
                  <p className="text-xs text-lux-text-secondary dark:text-gray-400 mb-0.5">{language === 'id' ? 'Total P/L' : 'Total P/L'}</p>
                  <p className={`text-xl font-bold ${totalPL >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>{fmtPL(totalPL)}</p>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </motion.div>

      {/* ============================================ */}
      {/* 2. LIGHTWEIGHT EQUITY CURVE (SVG, no recharts) */}
      {/* ============================================ */}
      {hasData && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.05 }}
          aria-label="Equity curve chart"
        >
          <EquityCurveCard
            language={language}
            tradingAccounts={tradingAccounts}
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
          {/* Win Rate — green if >= 50%, blue otherwise */}
          <AnimatedStatCard
            title="Win Rate"
            value={winRate}
            suffix="%"
            subtitle={language === 'id' ? 'Tingkat menang' : 'Success rate'}
            icon={Target}
            iconColor={winRate >= 50 ? 'text-emerald-400' : 'text-blue-400'}
            iconBgColor={winRate >= 50 ? 'bg-emerald-500/15' : 'bg-blue-500/15'}
            gradientBg={winRate >= 50 ? 'from-emerald-500/30 to-emerald-600/20' : 'from-blue-500/30 to-blue-600/20'}
            valueColor={winRate >= 50 ? 'text-emerald-400' : 'text-blue-300'}
            color={winRate >= 50 ? 'emerald' : 'blue'}
            decimals={1}
          />
          {/* Profit Factor — neutral (blue) */}
          <AnimatedStatCard
            title="Profit Factor"
            value={profitFactor}
            subtitle={profitFactor === Infinity ? (language === 'id' ? 'Tanpa kerugian!' : 'No losses!') : profitFactor >= 1.5 ? (language === 'id' ? 'Sangat bagus' : 'Excellent') : profitFactor >= 1 ? (language === 'id' ? 'Cukup baik' : 'Good') : (language === 'id' ? 'Perlu perbaikan' : 'Needs work')}
            icon={TrendingUp}
            iconColor="text-blue-400"
            iconBgColor="bg-blue-500/15"
            gradientBg="from-blue-500/30 to-blue-600/20"
            valueColor="text-blue-300"
            color="blue"
            decimals={2}
          />
          {/* Win/Loss count — neutral (blue) */}
          <AnimatedStatCard
            title={language === 'id' ? 'Menang / Kalah' : 'Win / Loss'}
            value={analytics?.winningTrades || 0}
            subtitle={`${analytics?.losingTrades || 0} ${language === 'id' ? 'kekalahan' : 'losses'}`}
            icon={Activity}
            iconColor="text-blue-400"
            iconBgColor="bg-blue-500/15"
            gradientBg="from-blue-500/30 to-blue-600/20"
            valueColor="text-blue-300"
            color="blue"
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
          <Card className={`relative overflow-hidden bg-gradient-to-br backdrop-blur-md transition-all duration-300 hover:-translate-y-1 ${activeStreak.type === 'win' ? 'from-emerald-500/20 to-green-500/10 border-emerald-500/20' : 'from-red-500/20 to-rose-500/10 border-lux-border dark:border-red-500/20'}`}>
            <CardContent className="relative p-4 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Flame className={`w-5 h-5 ${activeStreak.type === 'win' ? 'text-emerald-400' : 'text-red-400'}`} />
                <div>
                  <p className={`text-sm font-medium ${activeStreak.type === 'win' ? 'text-emerald-300' : 'text-red-300'}`}>
                    {activeStreak.type === 'win'
                      ? (language === 'id' ? `Win Streak Aktif: ${activeStreak.count} 🔥` : `Active Win Streak: ${activeStreak.count} 🔥`)
                      : (language === 'id' ? `Lose Streak Aktif: ${activeStreak.count} 🧘` : `Active Lose Streak: ${activeStreak.count} 🧘`)}
                  </p>
                  <p className="text-xs text-lux-text-secondary dark:text-gray-400">
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
          <Card className="bg-lux-bg-card dark:bg-gradient-to-br dark:from-[#0a0c12] dark:to-[#080a14] border-lux-border dark:border-blue-900/30">
            <CardHeader className="flex flex-row items-center justify-between"><CardTitle className="text-lg">{language === 'id' ? 'Transaksi Terbaru' : 'Recent Trades'}</CardTitle><span className="text-xs text-lux-text-secondary dark:text-gray-400">{trades.length} {language === 'id' ? 'total' : 'total'}</span></CardHeader>
            <CardContent>
              <div className="space-y-2">
                {trades.slice(0, 5).map((trade, index) => (
                  <motion.div key={trade.id} className="flex items-center justify-between p-3 rounded-lg bg-white/5 hover:bg-white/10 transition-all cursor-pointer group" onClick={() => onView(trade)} initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} transition={{ duration: 0.3, delay: index * 0.05 }} whileHover={{ x: 4 }}>
                    <div className="flex items-center gap-3">
                      <motion.div className={`w-2 h-2 rounded-full ${trade.profit_loss >= 0 ? 'bg-emerald-400' : 'bg-red-400'}`} animate={{ scale: [1, 1.2, 1] }} transition={{ duration: 2, repeat: Infinity, delay: index * 0.2 }} />
                      <span className="font-bold">{trade.symbol}</span>
                      <Badge variant={trade.type === 'BUY' ? 'default' : 'destructive'} className="text-xs">{trade.type}</Badge>
                      <span className="text-xs text-lux-text-muted dark:text-gray-500 hidden sm:inline">{trade.session || '-'}</span>
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
          <Card className="bg-lux-bg-card dark:bg-gradient-to-br dark:from-[#0a0c12]/80 dark:to-[#080a14]/80 backdrop-blur-md border-lux-border dark:border-blue-500/20 transition-all duration-300 hover:border-blue-500/40 hover:shadow-lg hover:shadow-blue-500/10">
            <CardHeader><CardTitle className="text-lg flex items-center gap-2"><Clock className="w-5 h-5 text-blue-400" /> {language === 'id' ? 'Performa Sesi' : 'Session Performance'}</CardTitle></CardHeader>
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
          <Card className="bg-lux-bg-card dark:bg-gradient-to-br dark:from-[#0a0c12] dark:to-[#080a14] border-lux-border dark:border-blue-900/30">
            <CardHeader className="flex flex-row items-center justify-between"><CardTitle className="text-lg flex items-center gap-2"><Activity className="w-5 h-5 text-blue-400" />{language === 'id' ? 'Aktivitas Terbaru' : 'Recent Activity'}</CardTitle></CardHeader>
            <CardContent><ActivityFeed trades={trades} journalEntries={journalEntries} language={language} /></CardContent>
          </Card>
        </motion.div>
      )}

      {/* ============================================ */}
      {/* EMPTY STATE                                  */}
      {/* ============================================ */}
      {!hasData && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, ease: 'easeOut' }}
        >
          <Card className="bg-lux-bg-card dark:bg-gradient-to-br dark:from-[#0a0c12]/80 dark:to-[#080a14]/80 backdrop-blur-md border-lux-border dark:border-blue-500/20 transition-all duration-300 hover:border-blue-500/40 overflow-hidden">
            {/* Decorative background glow */}
            <div className="absolute inset-0 overflow-hidden pointer-events-none">
              <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-64 h-64 bg-blue-500/10 rounded-full blur-[100px]" />
              <div className="absolute bottom-0 left-1/4 w-40 h-40 bg-amber-500/5 rounded-full blur-[80px]" />
            </div>

            <CardContent className="relative py-14 lg:py-20 px-6">
              {/* Decorative icon composition */}
              <motion.div
                className="flex items-center justify-center gap-4 lg:gap-6 mb-8"
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ duration: 0.6, delay: 0.15 }}
              >
                {/* Left icon — BarChart3 */}
                <motion.div
                  className="w-14 h-14 lg:w-16 lg:h-16 rounded-2xl bg-gradient-to-br from-blue-500/20 to-blue-400/10 border border-blue-500/20 flex items-center justify-center"
                  animate={{ y: [0, -6, 0] }}
                  transition={{ duration: 3, repeat: Infinity, ease: 'easeInOut', delay: 0 }}
                >
                  <BarChart3 className="w-7 h-7 lg:w-8 lg:h-8 text-blue-400" />
                </motion.div>

                {/* Center icon — TrendingUp (prominent) */}
                <motion.div
                  className="w-20 h-20 lg:w-24 lg:h-24 rounded-3xl bg-gradient-to-br from-amber-500/20 to-orange-500/10 border border-amber-500/20 flex items-center justify-center shadow-lg shadow-amber-500/10"
                  animate={{ y: [0, -8, 0] }}
                  transition={{ duration: 3, repeat: Infinity, ease: 'easeInOut', delay: 0.3 }}
                >
                  <TrendingUp className="w-10 h-10 lg:w-12 lg:h-12 text-amber-400" />
                </motion.div>

                {/* Right icon — Target */}
                <motion.div
                  className="w-14 h-14 lg:w-16 lg:h-16 rounded-2xl bg-gradient-to-br from-cyan-500/20 to-blue-500/10 border border-cyan-500/20 flex items-center justify-center"
                  animate={{ y: [0, -6, 0] }}
                  transition={{ duration: 3, repeat: Infinity, ease: 'easeInOut', delay: 0.6 }}
                >
                  <Target className="w-7 h-7 lg:w-8 lg:h-8 text-cyan-400" />
                </motion.div>
              </motion.div>

              {/* Heading */}
              <motion.h3
                className="text-2xl lg:text-3xl font-bold mb-3 bg-gradient-to-r from-white via-blue-200 to-amber-200 bg-clip-text text-transparent"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5, delay: 0.25 }}
              >
                {language === 'id' ? 'Dashboard kamu masih kosong' : 'Your dashboard is empty'}
              </motion.h3>

              {/* Subtitle */}
              <motion.p
                className="text-lux-text-secondary dark:text-gray-400 mb-8 max-w-lg mx-auto text-sm lg:text-base leading-relaxed"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5, delay: 0.35 }}
              >
                {language === 'id'
                  ? 'Mulai catat trade pertamamu untuk melihat statistik dan insight'
                  : 'Start logging your first trade to unlock powerful statistics and insights'}
              </motion.p>

              {/* CTA Buttons */}
              <motion.div
                className="flex flex-col items-center gap-4"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5, delay: 0.45 }}
              >
                <Button
                  onClick={() => setAddTradeOpen(true)}
                  size="lg"
                  className="bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-400 hover:to-orange-400 text-white font-semibold shadow-lg shadow-amber-500/25 hover:shadow-amber-500/40 transition-all duration-300 px-8 py-6 text-base"
                >
                  <Plus className="w-5 h-5 mr-2" />
                  {language === 'id' ? 'Tambah Trade Pertama' : 'Add Your First Trade'}
                </Button>

                <button
                  onClick={() => setAddTradeOpen(true)}
                  className="text-sm text-blue-400 hover:text-blue-300 transition-colors duration-200 cursor-pointer group"
                >
                  {language === 'id'
                    ? 'atau muat data contoh untuk melihat demo →'
                    : 'or load sample data to see a demo →'}
                </button>
              </motion.div>
            </CardContent>
          </Card>
        </motion.div>
      )}
    </div>
  )
}

export default DashboardTab