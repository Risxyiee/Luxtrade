'use client'

import { useState, useEffect, useMemo, useCallback, useRef } from 'react'
import { useRouter } from 'next/navigation'
import {
  DollarSign, Target, Activity, TrendingUp, TrendingDown,
  Sparkles, AlertTriangle, Clock, BarChart3, RefreshCw, Plus,
  Link2, Zap, Trophy, CheckCircle2, XCircle, Loader2, ArrowRight, Star, Settings, Flame
} from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { motion, AnimatePresence } from 'framer-motion'
import { formatCurrency } from '@/lib/supabase'
import QuickStats from '@/components/QuickStats'
import ActivityFeed from '@/components/ActivityFeed'
import ParticleBackground from '@/components/ParticleBackground'
import { useConfetti } from '@/hooks/useConfetti'
import {
  AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, BarChart, Bar, Cell
} from 'recharts'

// ==================== INTERFACES ====================

interface Trade {
  id: string
  symbol: string
  type: 'BUY' | 'SELL'
  open_price: number
  close_price: number
  lot_size: number
  profit_loss: number
  open_time: string
  close_time: string
  session: string | null
  notes?: string
  image_url?: string | null
  trade_duration?: number | null
  risk_reward_ratio?: number | null
  tags?: string | null
  setup_type?: string | null
  linked_journal_id?: string | null
}

interface JournalEntry {
  id: string
  title: string
  content: string
  mood: string | null
  market_condition: string | null
  created_at: string
  tags?: string | null
  image_url?: string | null
  linked_trades_count?: number
}

interface Analytics {
  totalTrades: number
  winningTrades: number
  losingTrades: number
  winRate: number
  totalPL: number
  avgProfit: number
  avgLoss: number
  profitFactor: number
  maxDrawdown: number
  sharpeRatio: number
  equityCurve: { date: string; equity: number }[]
  sessionPerformance: { session: string; trades: number; pl: number; winRate: number }[]
  monthlyPerformance: { month: string; pl: number; trades: number }[]
}

// ==================== ANIMATED NUMBER HOOK ====================

function useCountUp(end: number, duration: number = 1500, start: number = 0, decimals: number = 2) {
  const [count, setCount] = useState(start)
  const countRef = useRef(start)
  const startTimeRef = useRef<number | null>(null)
  const rafRef = useRef<number | null>(null)
  const prevEndRef = useRef(end)

  useEffect(() => {
    // Reset animation when end value changes
    if (prevEndRef.current !== end) {
      startTimeRef.current = null
      prevEndRef.current = end
    }

    const animate = (timestamp: number) => {
      if (!startTimeRef.current) startTimeRef.current = timestamp
      const progress = Math.min((timestamp - startTimeRef.current) / duration, 1)

      // Smooth easing function
      const easeOutQuart = 1 - Math.pow(1 - progress, 4)
      const current = start + (end - start) * easeOutQuart

      countRef.current = current
      setCount(current)

      if (progress < 1) {
        rafRef.current = requestAnimationFrame(animate)
      }
    }

    rafRef.current = requestAnimationFrame(animate)

    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current)
    }
  }, [end, duration, start])

  return count
}

// Animated number display component
function AnimatedNumber({ value, prefix = '', suffix = '', decimals = 2, className = '' }: {
  value: number
  prefix?: string
  suffix?: string
  decimals?: number
  className?: string
}) {
  const animatedValue = useCountUp(value, 1500, 0, decimals)

  return (
    <span className={className}>
      {prefix}{animatedValue.toFixed(decimals)}{suffix}
    </span>
  )
}

// ==================== SKELETON LOADING COMPONENT ====================

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

// ==================== ENHANCED ANIMATED STAT CARD WITH GLASSMORPHISM ====================

function AnimatedStatCard({
  title,
  value,
  subtitle,
  icon: Icon,
  iconColor,
  iconBgColor,
  gradientBg = 'from-purple-500/20 to-pink-500/20',
  valueColor = 'text-white',
  prefix = '',
  suffix = '',
  decimals = 2
}: {
  title: string
  value: number
  subtitle?: string
  icon: React.ElementType
  iconColor: string
  iconBgColor: string
  gradientBg?: string
  valueColor?: string
  prefix?: string
  suffix?: string
  decimals?: number
}) {
  const [isHovered, setIsHovered] = useState(false)

  return (
    <motion.div
      onHoverStart={() => setIsHovered(true)}
      onHoverEnd={() => setIsHovered(false)}
      whileHover={{ scale: 1.05, y: -8 }}
      transition={{ type: "spring", stiffness: 300, damping: 20 }}
    >
      <Card className={`relative overflow-hidden bg-gradient-to-br from-[#0f0b18]/90 to-[#12091a]/90 backdrop-blur-md border transition-all duration-300 ${isHovered ? 'shadow-2xl shadow-purple-500/30 border-purple-500/40' : 'border-white/10'}`}>
        {/* Glassmorphism Effect with More Depth */}
        <div className="absolute inset-0 bg-gradient-to-br from-white/8 to-white/2 opacity-0 hover:opacity-100 transition-opacity duration-300" />

        {/* Animated Background Glow - Always Present, Brighter on Hover */}
        <motion.div
          className={`absolute -inset-0.5 bg-gradient-to-br ${gradientBg} blur-2xl opacity-20 transition-opacity duration-300`}
          animate={{
            opacity: isHovered ? [0.3, 0.5, 0.3] : [0.15, 0.25, 0.15],
          }}
          transition={{
            duration: 3,
            repeat: Infinity,
            ease: "easeInOut"
          }}
        />

        {/* Hover Glow Effect */}
        {isHovered && (
          <motion.div
            className="absolute inset-0 bg-gradient-to-br from-purple-500/10 via-violet-500/10 to-pink-500/10"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
          />
        )}

        <CardHeader className="flex flex-row items-center justify-between pb-2 relative">
          <CardTitle className="text-xs lg:text-sm font-medium text-gray-300">{title}</CardTitle>
          <motion.div
            className={`w-12 h-12 rounded-xl ${iconBgColor} flex items-center justify-center shadow-xl relative overflow-hidden`}
            animate={isHovered ? { scale: 1.15, rotate: 8 } : { scale: 1, rotate: 0 }}
            transition={{ type: "spring", stiffness: 300 }}
          >
            <motion.div
              className="absolute inset-0 bg-white/20"
              animate={isHovered ? {
                x: ['-100%', '100%'],
              } : {}}
              transition={{
                duration: 0.6,
                ease: "easeInOut"
              }}
            />
            <Icon className={`w-6 h-6 ${iconColor} relative z-10`} />
          </motion.div>
        </CardHeader>
        <CardContent className="relative">
          <div className={`text-3xl lg:text-4xl font-bold ${valueColor} drop-shadow-lg mb-1`}>
            <AnimatedNumber value={value} prefix={prefix} suffix={suffix} decimals={decimals} />
          </div>
          {subtitle && <p className="text-sm text-gray-400 font-medium">{subtitle}</p>}
        </CardContent>
      </Card>
    </motion.div>
  )
}

// ==================== HELPER FUNCTIONS ====================

function calculateConsecutiveStreaks(trades: Trade[], type: 'win' | 'lose'): number {
  if (trades.length === 0) return 0
  const sorted = [...trades].sort((a, b) => new Date(a.close_time).getTime() - new Date(b.close_time).getTime())
  let maxStreak = 0
  let currentStreak = 0
  for (const trade of sorted) {
    const isMatch = type === 'win' ? trade.profit_loss > 0 : trade.profit_loss < 0
    if (isMatch) {
      currentStreak++
      maxStreak = Math.max(maxStreak, currentStreak)
    } else {
      currentStreak = 0
    }
  }
  return maxStreak
}

// Helper: Calculate current active streak (most recent)
function calculateActiveStreak(trades: Trade[]): { type: 'win' | 'lose' | null; count: number } {
  if (trades.length === 0) return { type: null, count: 0 }
  
  const sorted = [...trades].sort((a, b) => new Date(b.close_time).getTime() - new Date(a.close_time).getTime())
  let streakCount = 0
  let streakType: 'win' | 'lose' | null = null
  
  for (const trade of sorted) {
    const isWin = trade.profit_loss > 0
    const isLoss = trade.profit_loss < 0
    
    if (streakType === null) {
      // Initialize streak type based on first trade
      if (isWin) {
        streakType = 'win'
        streakCount = 1
      } else if (isLoss) {
        streakType = 'lose'
        streakCount = 1
      }
    } else if (streakType === 'win' && isWin) {
      streakCount++
    } else if (streakType === 'lose' && isLoss) {
      streakCount++
    } else {
      break // Streak broken
    }
  }
  
  return { type: streakType, count: streakCount }
}

// Helper: Get today's trades and performance
function getTodayPerformance(trades: Trade[]) {
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  
  const todayTrades = trades.filter(t => {
    const tradeDate = new Date(t.close_time)
    tradeDate.setHours(0, 0, 0, 0)
    return tradeDate.getTime() === today.getTime()
  })
  
  const totalPL = todayTrades.reduce((sum, t) => sum + t.profit_loss, 0)
  const wins = todayTrades.filter(t => t.profit_loss > 0).length
  const losses = todayTrades.filter(t => t.profit_loss < 0).length
  
  return {
    trades: todayTrades.length,
    totalPL,
    wins,
    losses,
    winRate: todayTrades.length > 0 ? (wins / todayTrades.length) * 100 : 0
  }
}

// Helper: Get week's start date (Monday)
function getWeekStart(date: Date = new Date()): Date {
  const d = new Date(date)
  const day = d.getDay()
  const diff = d.getDate() - day + (day === 0 ? -6 : 1) // Adjust when Sunday
  return new Date(d.setDate(diff))
}

// Helper: Get weekly trades and performance
function getWeeklyPerformance(trades: Trade[]) {
  const weekStart = getWeekStart()
  weekStart.setHours(0, 0, 0, 0)
  
  const weekTrades = trades.filter(t => {
    const tradeDate = new Date(t.close_time)
    tradeDate.setHours(0, 0, 0, 0)
    return tradeDate.getTime() >= weekStart.getTime()
  })
  
  const totalPL = weekTrades.reduce((sum, t) => sum + t.profit_loss, 0)
  const wins = weekTrades.filter(t => t.profit_loss > 0).length
  const losses = weekTrades.filter(t => t.profit_loss < 0).length
  
  return {
    trades: weekTrades.length,
    totalPL,
    wins,
    losses,
    winRate: weekTrades.length > 0 ? (wins / weekTrades.length) * 100 : 0
  }
}

// ==================== DASHBOARD TAB COMPONENT ====================

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
  profile
}: DashboardTabProps) {

  if (loading) {
    return (
      <div className="space-y-6 relative">
        {/* Particle Background */}
        <ParticleBackground />

        {/* Skeleton Hero with Shimmer */}
        <div className="relative overflow-hidden bg-gradient-to-br from-purple-600/20 via-violet-600/10 to-amber-500/10 border-purple-500/30 backdrop-blur-sm rounded-xl">
          <div className="p-6 lg:p-8">
            <div className="flex flex-col lg:flex-row gap-6">
              <div className="flex-1">
                <div className="h-4 w-32 bg-gradient-to-r from-white/10 via-white/15 to-white/10 animate-shimmer rounded mb-3" />
                <div className="h-8 w-64 bg-gradient-to-r from-white/10 via-white/15 to-white/10 animate-shimmer rounded mb-2" />
                <div className="h-4 w-96 bg-gradient-to-r from-white/5 via-white/10 to-white/5 animate-shimmer rounded" />
              </div>
              <div className="flex gap-3">
                <div className="h-16 w-24 bg-gradient-to-r from-white/10 via-white/15 to-white/10 animate-shimmer rounded-xl" />
                <div className="h-16 w-24 bg-gradient-to-r from-white/10 via-white/15 to-white/10 animate-shimmer rounded-xl" />
              </div>
            </div>
          </div>
        </div>

        {/* Skeleton Stats with Shimmer */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 lg:gap-4">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="relative overflow-hidden bg-gradient-to-br from-white/5 to-white/[0.02] backdrop-blur-sm border border-white/10 rounded-xl p-4">
              <div className="flex flex-row items-center justify-between pb-2">
                <div className="h-4 w-20 bg-gradient-to-r from-white/10 via-white/15 to-white/10 animate-shimmer rounded" />
                <div className="w-10 h-10 bg-gradient-to-r from-white/10 via-white/15 to-white/10 animate-shimmer rounded-xl" />
              </div>
              <div className="h-8 w-24 bg-gradient-to-r from-white/10 via-white/15 to-white/10 animate-shimmer rounded mb-2" />
              <div className="h-3 w-16 bg-gradient-to-r from-white/5 via-white/10 to-white/5 animate-shimmer rounded" />
            </div>
          ))}
        </div>
      </div>
    )
  }

  const hasData = trades.length > 0
  const todayPerf = getTodayPerformance(trades)
  const weeklyPerf = getWeeklyPerformance(trades)
  const activeStreak = calculateActiveStreak(trades)
  const { triggerMilestoneConfetti } = useConfetti()

  // Trigger confetti on milestones
  useEffect(() => {
    if (!hasData) {
      // First trade celebration
      triggerMilestoneConfetti('first-trade')
    }
  }, [hasData, triggerMilestoneConfetti])

  useEffect(() => {
    // Win streak celebration
    if (activeStreak.type === 'win' && activeStreak.count >= 3) {
      triggerMilestoneConfetti('win-streak')
    }
  }, [activeStreak, triggerMilestoneConfetti])

  useEffect(() => {
    // Weekly target celebration
    if (weeklyPerf.trades >= 10) {
      triggerMilestoneConfetti('weekly-target')
    }
  }, [weeklyPerf.trades, triggerMilestoneConfetti])

  return (
    <div className="space-y-6 relative min-h-screen">
      {/* Particle Background - Subtle Floating Particles */}
      <ParticleBackground />

      {/* Hero Section - Premium Welcome with Visual Impact */}
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, ease: "easeOut" }}
        className="relative"
      >
        <Card className="relative overflow-hidden bg-gradient-to-br from-purple-600/15 via-violet-600/10 to-amber-500/10 backdrop-blur-md border border-purple-500/20 transition-all duration-500 hover:border-purple-500/40 hover:shadow-lg hover:shadow-purple-500/10">
          {/* Animated Background Patterns - Premium Glowing Orbs */}
          <div className="absolute inset-0 overflow-hidden pointer-events-none">
            <motion.div
              className="absolute -top-24 -right-24 w-64 h-64 bg-purple-500/15 rounded-full blur-3xl"
              animate={{
                scale: [1, 1.3, 1],
                opacity: [0.3, 0.5, 0.3],
                x: [0, 20, 0],
                y: [0, -20, 0],
              }}
              transition={{
                duration: 6,
                repeat: Infinity,
                ease: "easeInOut"
              }}
            />
            <motion.div
              className="absolute -bottom-24 -left-24 w-64 h-64 bg-amber-500/15 rounded-full blur-3xl"
              animate={{
                scale: [1, 1.4, 1],
                opacity: [0.2, 0.4, 0.2],
                x: [0, -20, 0],
                y: [0, 20, 0],
              }}
              transition={{
                duration: 7,
                repeat: Infinity,
                ease: "easeInOut",
                delay: 0.5
              }}
            />
            <motion.div
              className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-48 h-48 bg-violet-500/10 rounded-full blur-3xl"
              animate={{
                scale: [1, 1.2, 1],
                opacity: [0.15, 0.3, 0.15],
              }}
              transition={{
                duration: 5,
                repeat: Infinity,
                ease: "easeInOut",
                delay: 1
              }}
            />
          </div>

          <CardContent className="relative p-6 lg:p-8">
            <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-6">
              {/* Left: Welcome Message */}
              <div className="flex-1">
                <motion.div
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ duration: 0.5, delay: 0.2 }}
                >
                  <div className="flex items-center gap-2 mb-2">
                    <motion.div
                      animate={{ rotate: [0, 360] }}
                      transition={{ duration: 20, repeat: Infinity, ease: "linear" }}
                    >
                      <Sparkles className="w-5 h-5 text-amber-400" />
                    </motion.div>
                    <span className="text-xs font-semibold text-purple-300 uppercase tracking-wider">
                      {language === 'id' ? 'Selamat Datang Kembali' : 'Welcome Back'}
                    </span>
                  </div>
                  <h1 className="text-2xl lg:text-3xl font-display font-bold mb-2 bg-gradient-to-r from-white via-purple-200 to-amber-200 bg-clip-text text-transparent">
                    {language === 'id' 
                      ? `Halo, ${profile?.full_name?.split(' ')[0] || 'Trader'}! 👋`
                      : `Hello, ${profile?.full_name?.split(' ')[0] || 'Trader'}! 👋`
                    }
                  </h1>
                  <p className="text-sm lg:text-base text-gray-300 max-w-lg">
                    {hasData 
                      ? (language === 'id'
                          ? 'Luar biasa! Anda sudah mencatat ' + trades.length + ' trade. Terus konsisten untuk mencapai target Anda!'
                          : 'Amazing! You\'ve logged ' + trades.length + ' trades. Keep consistent to reach your targets!')
                      : (language === 'id'
                          ? 'Mulai perjalanan trading Anda dengan mencatat trade pertama hari ini!'
                          : 'Start your trading journey by logging your first trade today!')
                    }
                  </p>
                </motion.div>
              </div>

              {/* Right: Quick Stats Summary */}
              {hasData && (
                <motion.div
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ duration: 0.5, delay: 0.3 }}
                  className="flex flex-col sm:flex-row gap-3"
                >
                  <div className="bg-white/10 backdrop-blur-md border border-white/20 rounded-xl p-4 min-w-[140px] transition-all duration-300 hover:bg-white/15 hover:border-white/30 hover:-translate-y-1 hover:shadow-lg hover:shadow-purple-500/10">
                    <div className="flex items-center gap-2 mb-1">
                      <TrendingUp className="w-4 h-4 text-emerald-400" />
                      <span className="text-xs text-gray-400">{language === 'id' ? 'Total P/L' : 'Total P/L'}</span>
                    </div>
                    <div className={`text-xl font-bold ${(analytics?.totalPL || 0) >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                      {(analytics?.totalPL || 0) >= 0 ? '+' : ''}${(analytics?.totalPL || 0).toFixed(2)}
                    </div>
                  </div>
                  <div className="bg-white/10 backdrop-blur-md border border-white/20 rounded-xl p-4 min-w-[140px] transition-all duration-300 hover:bg-white/15 hover:border-white/30 hover:-translate-y-1 hover:shadow-lg hover:shadow-amber-500/10">
                    <div className="flex items-center gap-2 mb-1">
                      <Target className="w-4 h-4 text-amber-400" />
                      <span className="text-xs text-gray-400">{language === 'id' ? 'Win Rate' : 'Win Rate'}</span>
                    </div>
                    <div className="text-xl font-bold text-amber-400">
                      {(analytics?.winRate || 0).toFixed(1)}%
                    </div>
                  </div>
                  <div className="bg-white/10 backdrop-blur-md border border-white/20 rounded-xl p-4 min-w-[140px] transition-all duration-300 hover:bg-white/15 hover:border-white/30 hover:-translate-y-1 hover:shadow-lg hover:shadow-purple-500/10">
                    <div className="flex items-center gap-2 mb-1">
                      <Activity className="w-4 h-4 text-purple-400" />
                      <span className="text-xs text-gray-400">{language === 'id' ? 'Total Trade' : 'Total Trades'}</span>
                    </div>
                    <div className="text-xl font-bold text-purple-400">
                      {analytics?.totalTrades || 0}
                    </div>
                  </div>
                </motion.div>
              )}
            </div>

            {/* Bottom: Progress Indicator for Goals */}
            {hasData && (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5, delay: 0.4 }}
                className="mt-6 pt-6 border-t border-white/10"
              >
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <Trophy className="w-4 h-4 text-amber-400" />
                    <span className="text-xs font-semibold text-gray-300">
                      {language === 'id' ? 'Target Minggu Ini' : 'Weekly Target'}
                    </span>
                  </div>
                  <span className="text-xs text-gray-400">
                    {trades.length} / 10 {language === 'id' ? 'trades' : 'trades'}
                  </span>
                </div>
                <div className="h-2 bg-white/10 rounded-full overflow-hidden">
                  <motion.div
                    className="h-full bg-gradient-to-r from-purple-500 via-violet-500 to-amber-500 rounded-full"
                    initial={{ width: 0 }}
                    animate={{ width: `${Math.min((trades.length / 10) * 100, 100)}%` }}
                    transition={{ duration: 1.5, ease: "easeOut" }}
                  />
                </div>
              </motion.div>
            )}
          </CardContent>
        </Card>
      </motion.div>

      {/* Today's Performance Card */}
      {hasData && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.1 }}
        >
          <Card className="relative overflow-hidden bg-gradient-to-br from-emerald-500/15 to-cyan-500/10 backdrop-blur-md border border-emerald-500/20 transition-all duration-300 hover:border-emerald-500/40 hover:shadow-lg hover:shadow-emerald-500/10 hover:-translate-y-1">
            <div className="absolute top-0 right-0 w-40 h-40 bg-emerald-500/10 rounded-full blur-3xl" />
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2 text-emerald-300">
                <Clock className="w-4 h-4" />
                Today's Performance
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-4 gap-3">
                <div>
                  <p className="text-xs text-gray-400 mb-1">Trades</p>
                  <p className="text-lg font-bold text-white">{todayPerf.trades}</p>
                </div>
                <div>
                  <p className="text-xs text-gray-400 mb-1">P/L</p>
                  <p className={`text-lg font-bold ${todayPerf.totalPL >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                    {todayPerf.totalPL >= 0 ? '+' : ''}{todayPerf.totalPL.toFixed(2)}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-gray-400 mb-1">Win Rate</p>
                  <p className="text-lg font-bold text-amber-400">{todayPerf.winRate.toFixed(0)}%</p>
                </div>
                <div>
                  <p className="text-xs text-gray-400 mb-1">W/L</p>
                  <p className="text-lg font-bold text-purple-400">
                    {todayPerf.wins}/{todayPerf.losses}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </motion.div>
      )}

      {/* Weekly Goal Progress Card */}
      {hasData && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.15 }}
        >
          <Card className="relative overflow-hidden bg-gradient-to-br from-amber-500/15 to-orange-500/10 backdrop-blur-md border border-amber-500/20 transition-all duration-300 hover:border-amber-500/40 hover:shadow-lg hover:shadow-amber-500/10 hover:-translate-y-1">
            <div className="absolute top-0 right-0 w-40 h-40 bg-amber-500/10 rounded-full blur-3xl" />
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2 text-amber-300">
                <Trophy className="w-4 h-4" />
                Weekly Goal Progress
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <p className="text-sm text-gray-400">Trade Count Goal</p>
                    <p className="text-sm font-bold text-white">
                      {weeklyPerf.trades} / 10 trades
                    </p>
                  </div>
                  <div className="h-2 bg-white/10 rounded-full overflow-hidden">
                    <motion.div
                      className="h-full bg-gradient-to-r from-amber-500 to-orange-500 rounded-full"
                      initial={{ width: 0 }}
                      animate={{ width: `${Math.min((weeklyPerf.trades / 10) * 100, 100)}%` }}
                      transition={{ duration: 1.5, ease: "easeOut" }}
                    />
                  </div>
                </div>
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <p className="text-sm text-gray-400">Weekly P/L</p>
                    <p className={`text-sm font-bold ${weeklyPerf.totalPL >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                      {weeklyPerf.totalPL >= 0 ? '+' : ''}{weeklyPerf.totalPL.toFixed(2)}
                    </p>
                  </div>
                  <div className="grid grid-cols-2 gap-2 mt-2">
                    <div className="p-2 rounded-lg bg-white/5 text-center">
                      <p className="text-xs text-gray-400">Win Rate</p>
                      <p className="text-sm font-bold text-amber-400">{weeklyPerf.winRate.toFixed(0)}%</p>
                    </div>
                    <div className="p-2 rounded-lg bg-white/5 text-center">
                      <p className="text-xs text-gray-400">W/L Ratio</p>
                      <p className="text-sm font-bold text-purple-400">
                        {weeklyPerf.losses > 0 ? (weeklyPerf.wins / weeklyPerf.losses).toFixed(2) : weeklyPerf.wins}
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </motion.div>
      )}

      {/* Active Streak Display */}
      {hasData && activeStreak.count > 0 && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.2 }}
        >
          <Card className={`relative overflow-hidden bg-gradient-to-br backdrop-blur-md transition-all duration-300 hover:-translate-y-1 ${
            activeStreak.type === 'win'
              ? 'from-emerald-500/20 to-green-500/10 border-emerald-500/20 hover:border-emerald-500/40 hover:shadow-lg hover:shadow-emerald-500/10'
              : 'from-red-500/20 to-rose-500/10 border-red-500/20 hover:border-red-500/40 hover:shadow-lg hover:shadow-red-500/10'
          }`}>
            <div className={`absolute top-0 right-0 w-40 h-40 ${
              activeStreak.type === 'win' ? 'bg-emerald-500/10' : 'bg-red-500/10'
            } rounded-full blur-3xl`} />
            <CardHeader className="pb-3">
              <CardTitle className={`text-base flex items-center gap-2 ${
                activeStreak.type === 'win' ? 'text-emerald-300' : 'text-red-300'
              }`}>
                <Flame className="w-4 h-4" />
                Active {activeStreak.type === 'win' ? 'Winning' : 'Losing'} Streak
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <div className={`text-4xl font-bold ${
                    activeStreak.type === 'win' ? 'text-emerald-400' : 'text-red-400'
                  }`}>
                    {activeStreak.count}
                  </div>
                  <div>
                    <p className={`text-sm font-medium ${
                      activeStreak.type === 'win' ? 'text-emerald-300' : 'text-red-300'
                    }`}>
                      {activeStreak.type === 'win' ? '🔥 On fire!' : '🧘 Stay calm'}
                    </p>
                    <p className="text-xs text-gray-400">
                      {activeStreak.type === 'win' 
                        ? 'Keep the momentum going!' 
                        : 'Take a break and reset your mindset.'}
                    </p>
                  </div>
                </div>
                {activeStreak.type === 'win' && activeStreak.count >= 3 && (
                  <motion.div
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    className="text-5xl"
                  >
                    🏆
                  </motion.div>
                )}
              </div>
            </CardContent>
          </Card>
        </motion.div>
      )}

      {/* Stats Cards with Animation */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 lg:gap-4">
        <AnimatedStatCard
          title="Total P/L"
          value={analytics?.totalPL || 0}
          prefix="$"
          subtitle={`${analytics?.totalTrades || 0} trades`}
          icon={DollarSign}
          iconColor="text-white"
          iconBgColor={(analytics?.totalPL || 0) >= 0 ? 'bg-gradient-to-br from-emerald-500/20 to-emerald-600/10' : 'bg-gradient-to-br from-red-500/20 to-red-600/10'}
          gradientBg={(analytics?.totalPL || 0) >= 0 ? 'from-emerald-500/30 to-emerald-600/20' : 'from-red-500/30 to-red-600/20'}
          valueColor={(analytics?.totalPL || 0) >= 0 ? 'text-emerald-400' : 'text-red-400'}
        />
        <AnimatedStatCard
          title="Win Rate"
          value={analytics?.winRate || 0}
          suffix="%"
          subtitle="Success rate"
          icon={Target}
          iconColor="text-amber-400"
          iconBgColor="bg-gradient-to-br from-amber-500/20 to-orange-600/10"
          gradientBg="from-amber-500/30 to-orange-600/20"
          valueColor="text-amber-400"
          decimals={1}
        />
        <AnimatedStatCard
          title="Win / Loss"
          value={analytics?.winningTrades || 0}
          subtitle={`${analytics?.losingTrades || 0} losses`}
          icon={Activity}
          iconColor="text-purple-400"
          iconBgColor="bg-gradient-to-br from-purple-500/20 to-violet-600/10"
          gradientBg="from-purple-500/30 to-violet-600/20"
          valueColor="text-purple-400"
          decimals={0}
        />
        <AnimatedStatCard
          title="Profit Factor"
          value={analytics?.profitFactor || 0}
          subtitle={analytics && analytics.profitFactor >= 1.5 ? 'Good' : 'Needs work'}
          icon={TrendingUp}
          iconColor="text-blue-400"
          iconBgColor="bg-gradient-to-br from-blue-500/20 to-cyan-600/10"
          gradientBg="from-blue-500/30 to-cyan-600/20"
          valueColor="text-blue-400"
          decimals={2}
        />
      </div>

      {/* Additional Stats Row - Streak & Best/Worst with Glassmorphism */}
      {hasData && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 lg:gap-4">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3, delay: 0.15 }}
            whileHover={{ y: -3 }}
          >
            <Card className="relative overflow-hidden bg-gradient-to-br from-emerald-500/15 to-emerald-600/5 backdrop-blur-md border border-emerald-500/20 transition-all duration-300 hover:border-emerald-500/40 hover:shadow-lg hover:shadow-emerald-500/10">
              <div className="absolute top-0 right-0 w-20 h-20 bg-emerald-500/20 rounded-full blur-2xl" />
              <CardContent className="relative p-4">
                <div className="flex items-center gap-2 mb-1">
                  <div className="p-1.5 bg-emerald-500/20 rounded-lg">
                    <TrendingUp className="w-4 h-4 text-emerald-400" />
                  </div>
                  <span className="text-xs text-gray-400 font-medium">Win Streak</span>
                </div>
                <div className="text-2xl font-bold text-emerald-400 drop-shadow-sm">
                  {calculateConsecutiveStreaks(trades, 'win')}
                </div>
              </CardContent>
            </Card>
          </motion.div>
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3, delay: 0.2 }}
            whileHover={{ y: -3 }}
          >
            <Card className="relative overflow-hidden bg-gradient-to-br from-red-500/15 to-red-600/5 backdrop-blur-md border border-red-500/20 transition-all duration-300 hover:border-red-500/40 hover:shadow-lg hover:shadow-red-500/10">
              <div className="absolute top-0 right-0 w-20 h-20 bg-red-500/20 rounded-full blur-2xl" />
              <CardContent className="relative p-4">
                <div className="flex items-center gap-2 mb-1">
                  <div className="p-1.5 bg-red-500/20 rounded-lg">
                    <TrendingDown className="w-4 h-4 text-red-400" />
                  </div>
                  <span className="text-xs text-gray-400 font-medium">Lose Streak</span>
                </div>
                <div className="text-2xl font-bold text-red-400 drop-shadow-sm">
                  {calculateConsecutiveStreaks(trades, 'lose')}
                </div>
              </CardContent>
            </Card>
          </motion.div>
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3, delay: 0.25 }}
            whileHover={{ y: -3 }}
          >
            <Card className="relative overflow-hidden bg-gradient-to-br from-amber-500/15 to-orange-600/5 backdrop-blur-md border border-amber-500/20 transition-all duration-300 hover:border-amber-500/40 hover:shadow-lg hover:shadow-amber-500/10">
              <div className="absolute top-0 right-0 w-20 h-20 bg-amber-500/20 rounded-full blur-2xl" />
              <CardContent className="relative p-4">
                <div className="flex items-center gap-2 mb-1">
                  <div className="p-1.5 bg-amber-500/20 rounded-lg">
                    <Sparkles className="w-4 h-4 text-amber-400" />
                  </div>
                  <span className="text-xs text-gray-400 font-medium">Best Trade</span>
                </div>
                <div className="text-2xl font-bold text-amber-400 drop-shadow-sm">
                  +${trades.length > 0 ? Math.max(...trades.map(t => t.profit_loss)) : 0}
                </div>
              </CardContent>
            </Card>
          </motion.div>
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3, delay: 0.3 }}
            whileHover={{ y: -3 }}
          >
            <Card className="relative overflow-hidden bg-gradient-to-br from-purple-500/15 to-violet-600/5 backdrop-blur-md border border-purple-500/20 transition-all duration-300 hover:border-purple-500/40 hover:shadow-lg hover:shadow-purple-500/10">
              <div className="absolute top-0 right-0 w-20 h-20 bg-purple-500/20 rounded-full blur-2xl" />
              <CardContent className="relative p-4">
                <div className="flex items-center gap-2 mb-1">
                  <div className="p-1.5 bg-purple-500/20 rounded-lg">
                    <AlertTriangle className="w-4 h-4 text-purple-400" />
                  </div>
                  <span className="text-xs text-gray-400 font-medium">Worst Trade</span>
                </div>
                <div className="text-2xl font-bold text-purple-400 drop-shadow-sm">
                  ${trades.length > 0 ? Math.min(...trades.map(t => t.profit_loss)) : 0}
                </div>
              </CardContent>
            </Card>
          </motion.div>
        </div>
      )}

      {/* Quick Stats Grid */}
      {hasData && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.12 }}
        >
          <QuickStats trades={trades} analytics={analytics} language={language} />
        </motion.div>
      )}

      {/* Session Performance Chart */}
      {hasData && analytics?.sessionPerformance && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.15 }}
        >
          <Card className="bg-gradient-to-br from-[#0f0b18]/80 to-[#12091a]/80 backdrop-blur-md border-purple-500/20 transition-all duration-300 hover:border-purple-500/40 hover:shadow-lg hover:shadow-purple-500/10">
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <Clock className="w-5 h-5 text-purple-400" />
                Session Performance
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="h-[200px]">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={analytics.sessionPerformance}>
                    <XAxis dataKey="session" tick={{ fill: 'rgba(255,255,255,0.5)', fontSize: 11 }} axisLine={false} tickLine={false} />
                    <YAxis tick={{ fill: 'rgba(255,255,255,0.3)', fontSize: 10 }} axisLine={false} tickLine={false} />
                    <Tooltip
                      contentStyle={{ background: '#0f0b18', border: '1px solid rgba(139,92,246,0.3)', borderRadius: 8 }}
                      formatter={(value: number) => formatCurrency(value)}
                    />
                    <Bar dataKey="pl" radius={[4, 4, 0, 0]}>
                      {analytics.sessionPerformance.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.pl >= 0 ? '#22c55e' : '#ef4444'} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>
        </motion.div>
      )}

      {/* Equity Curve with Animation */}
      {hasData && analytics?.equityCurve && analytics.equityCurve.length > 1 && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.2 }}
        >
          <Card className="bg-gradient-to-br from-[#0f0b18]/80 to-[#12091a]/80 backdrop-blur-md border-purple-500/20 transition-all duration-300 hover:border-purple-500/40 hover:shadow-lg hover:shadow-purple-500/10">
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="text-lg">Equity Curve</CardTitle>
              <div className="flex items-center gap-2">
                <span className="text-sm text-gray-400">Current:</span>
                <span className={`text-lg font-bold ${(analytics?.totalPL || 0) >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                  <AnimatedNumber value={10000 + (analytics?.totalPL || 0)} prefix="$" decimals={0} />
                </span>
              </div>
            </CardHeader>
            <CardContent>
              <div className="h-[200px] lg:h-[250px]">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={analytics.equityCurve}>
                    <defs>
                      <linearGradient id="equityGradient" x1="0" y1="0" x2="1" y2="0">
                        <stop offset="0%" stopColor="#f59e0b" stopOpacity={0.8} />
                        <stop offset="100%" stopColor="#8b5cf6" stopOpacity={0.8} />
                      </linearGradient>
                      <linearGradient id="equityFill" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#8b5cf6" stopOpacity={0.3} />
                        <stop offset="100%" stopColor="#8b5cf6" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <XAxis dataKey="date" tick={{ fill: 'rgba(255,255,255,0.3)', fontSize: 10 }} axisLine={false} tickLine={false} />
                    <YAxis tick={{ fill: 'rgba(255,255,255,0.3)', fontSize: 10 }} axisLine={false} tickLine={false} />
                    <Tooltip
                      contentStyle={{ background: '#0f0b18', border: '1px solid rgba(139,92,246,0.3)', borderRadius: 8 }}
                      labelStyle={{ color: 'rgba(255,255,255,0.6)' }}
                      formatter={(value: number) => formatCurrency(value)}
                    />
                    <Area
                      type="monotone"
                      dataKey="equity"
                      stroke="url(#equityGradient)"
                      strokeWidth={2.5}
                      fill="url(#equityFill)"
                      animationDuration={1500}
                      animationEasing="ease-out"
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>
        </motion.div>
      )}

      {/* Empty State - Enhanced */}
      {!hasData && (
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.5 }}
        >
          <Card className="bg-gradient-to-br from-[#0f0b18]/80 to-[#12091a]/80 backdrop-blur-md border-purple-500/20 transition-all duration-300 hover:border-purple-500/40">
            <CardContent className="py-16 lg:py-20 text-center">
              <motion.div
                className="w-16 h-16 lg:w-20 lg:h-20 rounded-full bg-gradient-to-br from-purple-500/20 to-violet-500/20 flex items-center justify-center mx-auto mb-6"
                animate={{ scale: [1, 1.05, 1] }}
                transition={{ duration: 2, repeat: Infinity }}
              >
                <BarChart3 className="w-8 h-8 lg:w-10 lg:h-10 text-purple-400" />
              </motion.div>
              <h3 className="text-xl lg:text-2xl font-bold mb-3 bg-gradient-to-r from-purple-200 to-purple-400 bg-clip-text text-transparent">Welcome to LuxTrade!</h3>
              <p className="text-gray-400 mb-6 max-w-md mx-auto">Start tracking your trades to see powerful analytics and insights.</p>
              
              <div className="flex flex-col sm:flex-row gap-4 justify-center">
                <Button onClick={() => setAddTradeOpen(true)} className="bg-gradient-to-r from-purple-500 to-violet-600 shadow-lg shadow-purple-500/20">
                  <Plus className="w-4 h-4 mr-2" />Add Your First Trade
                </Button>
              </div>
            </CardContent>
          </Card>
        </motion.div>
      )}

      {/* Recent Trades Preview */}
      {hasData && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.3 }}
        >
          <Card className="bg-gradient-to-br from-[#0f0b18] to-[#12091a] border-purple-900/30">
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="text-lg">Recent Trades</CardTitle>
              <span className="text-xs text-gray-400">{trades.length} total</span>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {trades.slice(0, 5).map((trade, index) => (
                  <motion.div
                    key={trade.id}
                    className="flex items-center justify-between p-3 rounded-lg bg-white/5 hover:bg-white/10 transition-all cursor-pointer group"
                    onClick={() => onView(trade)}
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ duration: 0.3, delay: index * 0.05 }}
                    whileHover={{ x: 4 }}
                  >
                    <div className="flex items-center gap-3">
                      <motion.div
                        className={`w-2 h-2 rounded-full ${trade.profit_loss >= 0 ? 'bg-emerald-400' : 'bg-red-400'}`}
                        animate={{ scale: [1, 1.2, 1] }}
                        transition={{ duration: 2, repeat: Infinity, delay: index * 0.2 }}
                      />
                      <span className="font-bold">{trade.symbol}</span>
                      <Badge variant={trade.type === 'BUY' ? 'default' : 'destructive'} className="text-xs">
                        {trade.type}
                      </Badge>
                      <span className="text-xs text-gray-500 hidden sm:inline">{trade.session || '-'}</span>
                    </div>
                    <span className={`font-bold ${trade.profit_loss >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                      {trade.profit_loss >= 0 ? '+' : ''}{formatCurrency(trade.profit_loss)}
                    </span>
                  </motion.div>
                ))}
              </div>
            </CardContent>
          </Card>
        </motion.div>
      )}

      {/* Activity Feed */}
      {hasData && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.35 }}
        >
          <Card className="bg-gradient-to-br from-[#0f0b18] to-[#12091a] border-purple-900/30">
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="text-lg flex items-center gap-2">
                <Activity className="w-5 h-5 text-purple-400" />
                {language === 'id' ? 'Aktivitas Terbaru' : 'Recent Activity'}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <ActivityFeed trades={trades} journalEntries={journalEntries} language={language} />
            </CardContent>
          </Card>
        </motion.div>
      )}
    </div>
  )
}

export default DashboardTab
