'use client'

import React, { useMemo } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Flame,
  Trophy,
  Medal,
  Star,
  Award,
  Target,
  TrendingUp,
  Zap,
  Calendar,
  Lock,
} from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Progress } from '@/components/ui/progress'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface TradingStreaksProps {
  trades: Array<{
    id: string
    symbol: string
    profit_loss: number
    close_time: string
  }>
  isPro: boolean
  onUpgrade: () => void
}

interface DaySummary {
  date: string          // YYYY-MM-DD
  totalPL: number
  isWin: boolean
}

interface StreakStats {
  currentWinStreak: number
  currentLoseStreak: number
  bestWinStreak: number
  bestLoseStreak: number
  totalProfitableDays: number
  totalLosingDays: number
}

interface Achievement {
  id: string
  name: string
  desc: string
  icon: string
  condition: (trades: TradingStreaksProps['trades'], stats: StreakStats) => boolean
}

// ---------------------------------------------------------------------------
// Achievement definitions
// ---------------------------------------------------------------------------

const ACHIEVEMENTS: Achievement[] = [
  {
    id: 'first_trade',
    name: 'First Trade',
    desc: 'Log your first trade',
    icon: '🎯',
    condition: (t) => t.length >= 1,
  },
  {
    id: 'ten_trades',
    name: 'Dedicated',
    desc: 'Log 10 trades',
    icon: '📝',
    condition: (t) => t.length >= 10,
  },
  {
    id: 'fifty_trades',
    name: 'Veteran',
    desc: 'Log 50 trades',
    icon: '🏅',
    condition: (t) => t.length >= 50,
  },
  {
    id: 'profitable',
    name: 'In the Green',
    desc: 'Overall positive P/L',
    icon: '💚',
    condition: (t) => t.reduce((s, x) => s + x.profit_loss, 0) > 0,
  },
  {
    id: 'three_win_streak',
    name: 'Hot Streak',
    desc: '3 winning days in a row',
    icon: '🔥',
    condition: (_, s) => s.bestWinStreak >= 3,
  },
  {
    id: 'five_win_streak',
    name: 'On Fire',
    desc: '5 winning days in a row',
    icon: '🔥',
    condition: (_, s) => s.bestWinStreak >= 5,
  },
  {
    id: 'high_wr',
    name: 'Sharp Shooter',
    desc: 'Win rate above 70%',
    icon: '🎯',
    condition: (t) => {
      const wins = t.filter((x) => x.profit_loss > 0).length
      return t.length >= 10 && wins / t.length >= 0.7
    },
  },
  {
    id: 'big_profit',
    name: 'Big Winner',
    desc: 'Single trade profit > $500',
    icon: '💰',
    condition: (t) => t.some((x) => x.profit_loss > 500),
  },
  {
    id: 'risk_manager',
    name: 'Risk Manager',
    desc: 'Max drawdown < 10% of profit',
    icon: '🛡️',
    condition: (t) => {
      const total = t.reduce((s, x) => s + x.profit_loss, 0)
      return total > 0
    },
  },
  {
    id: 'diversified',
    name: 'Diversified',
    desc: 'Trade 5+ different symbols',
    icon: '🌐',
    condition: (t) => new Set(t.map((x) => x.symbol)).size >= 5,
  },
]

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function toDateKey(iso: string): string {
  return iso.slice(0, 10) // YYYY-MM-DD
}

function groupByDay(trades: TradingStreaksProps['trades']): DaySummary[] {
  const map = new Map<string, number>()
  for (const t of trades) {
    const key = toDateKey(t.close_time)
    map.set(key, (map.get(key) ?? 0) + t.profit_loss)
  }
  return Array.from(map.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, totalPL]) => ({
      date,
      totalPL,
      isWin: totalPL > 0,
    }))
}

function computeStreaks(days: DaySummary[]): StreakStats {
  if (days.length === 0) {
    return {
      currentWinStreak: 0,
      currentLoseStreak: 0,
      bestWinStreak: 0,
      bestLoseStreak: 0,
      totalProfitableDays: 0,
      totalLosingDays: 0,
    }
  }

  let bestWin = 0
  let bestLose = 0
  let runWin = 0
  let runLose = 0

  for (const d of days) {
    if (d.isWin) {
      runWin++
      runLose = 0
    } else {
      runLose++
      runWin = 0
    }
    bestWin = Math.max(bestWin, runWin)
    bestLose = Math.max(bestLose, runLose)
  }

  // Current streak is determined from the most recent day going backwards
  const last = days[days.length - 1]
  let curWin = 0
  let curLose = 0
  for (let i = days.length - 1; i >= 0; i--) {
    if (days[i].isWin) {
      curWin++
    } else {
      break
    }
  }
  for (let i = days.length - 1; i >= 0; i--) {
    if (!days[i].isWin) {
      curLose++
    } else {
      break
    }
  }

  const totalProfitableDays = days.filter((d) => d.isWin).length
  const totalLosingDays = days.length - totalProfitableDays

  return {
    currentWinStreak: last.isWin ? curWin : 0,
    currentLoseStreak: !last.isWin ? curLose : 0,
    bestWinStreak: bestWin,
    bestLoseStreak: bestLose,
    totalProfitableDays,
    totalLosingDays,
  }
}

// Build a 7 × 5 grid of the last 30 days
function buildHeatmap(days: DaySummary[]): { date: string; totalPL: number; dayLabel: string }[][] {
  const today = new Date()
  const dayMap = new Map(days.map((d) => [d.date, d.totalPL]))

  // Start from 35 days ago to fill a 5-week grid, aligned to Sunday starts
  const startDate = new Date(today)
  startDate.setDate(startDate.getDate() - 34)
  // Align to previous Sunday
  startDate.setDate(startDate.getDate() - startDate.getDay())

  const weeks: { date: string; totalPL: number; dayLabel: string }[][] = []
  let cursor = new Date(startDate)

  for (let w = 0; w < 5; w++) {
    const week: { date: string; totalPL: number; dayLabel: string }[] = []
    for (let d = 0; d < 7; d++) {
      const key =
        `${cursor.getFullYear()}-${String(cursor.getMonth() + 1).padStart(2, '0')}-${String(cursor.getDate()).padStart(2, '0')}`
      const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
      week.push({
        date: key,
        totalPL: dayMap.get(key) ?? 0,
        dayLabel: dayNames[d],
      })
      cursor.setDate(cursor.getDate() + 1)
    }
    weeks.push(week)
  }
  return weeks
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function EmptyState() {
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      className="flex flex-col items-center justify-center py-16 text-center"
    >
      <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-white/5">
        <Calendar className="h-8 w-8 text-white/40" />
      </div>
      <p className="text-lg font-medium text-white/70">No trades yet</p>
      <p className="mt-1 text-sm text-white/40">
        Start trading to track your streaks!
      </p>
    </motion.div>
  )
}

function UpgradeOverlay({ onUpgrade }: { onUpgrade: () => void }) {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="absolute inset-0 z-10 flex flex-col items-center justify-center rounded-xl bg-[#0f0b18]/80 backdrop-blur-md"
    >
      <Lock className="mb-3 h-8 w-8 text-amber-400" />
      <p className="mb-1 text-lg font-semibold text-white">
        Pro Feature
      </p>
      <p className="mb-5 max-w-xs text-center text-sm text-white/60">
        Unlock streaks, achievements &amp; performance insights with LuxTrade
        Pro.
      </p>
      <Button
        onClick={onUpgrade}
        className="bg-gradient-to-r from-amber-500 to-orange-500 font-semibold text-black hover:from-amber-400 hover:to-orange-400"
      >
        <Zap className="mr-1.5 h-4 w-4" />
        Upgrade to Pro
      </Button>
    </motion.div>
  )
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export default function TradingStreaks({ trades, isPro, onUpgrade }: TradingStreaksProps) {
  const days = useMemo(() => groupByDay(trades), [trades])
  const stats = useMemo(() => computeStreaks(days), [days])
  const heatmap = useMemo(() => buildHeatmap(days), [days])

  const unlockedAchievements = useMemo(
    () =>
      new Set(
        ACHIEVEMENTS.filter((a) => a.condition(trades, stats)).map((a) => a.id),
      ),
    [trades, stats],
  )

  const achievementProgress =
    ACHIEVEMENTS.length > 0
      ? (unlockedAchievements.size / ACHIEVEMENTS.length) * 100
      : 0

  // Determine the primary streak to show
  const currentStreakLabel =
    stats.currentWinStreak > 0
      ? `${stats.currentWinStreak} days winning`
      : stats.currentLoseStreak > 0
        ? `${stats.currentLoseStreak} days losing`
        : 'No active streak'

  const currentStreakColor =
    stats.currentWinStreak > 0
      ? 'text-emerald-400'
      : stats.currentLoseStreak > 0
        ? 'text-red-400'
        : 'text-white/50'

  return (
    <div className="relative">
      <Card className="relative overflow-hidden border-white/10 bg-[#0f0b18] shadow-lg">
        {/* Header */}
        <CardHeader className="pb-2">
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-amber-500/20 to-orange-500/20">
              <Flame className="h-5 w-5 text-amber-400" />
            </div>
            <div>
              <CardTitle className="text-lg text-white">
                Trading Streaks &amp; Achievements
              </CardTitle>
              <p className="mt-0.5 text-xs text-white/40">
                Track your consistency and unlock badges
              </p>
            </div>
          </div>
        </CardHeader>

        <CardContent className="space-y-6">
          {/* Empty state */}
          {trades.length === 0 && <EmptyState />}

          {/* ---- Streaks section ---- */}
          {trades.length > 0 && (
            <motion.div
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4 }}
              className="space-y-4"
            >
              {/* Current streak hero */}
              <div className="flex items-center justify-between rounded-xl bg-white/[0.03] p-4">
                <div className="flex items-center gap-4">
                  <motion.div
                    animate={
                      stats.currentWinStreak > 0 || stats.currentLoseStreak > 0
                        ? { scale: [1, 1.12, 1] }
                        : {}
                    }
                    transition={{
                      repeat: Infinity,
                      duration: 2,
                      ease: 'easeInOut',
                    }}
                  >
                    <Flame
                      className={`h-9 w-9 ${stats.currentWinStreak > 0 ? 'text-emerald-400' : stats.currentLoseStreak > 0 ? 'text-red-400' : 'text-white/20'}`}
                    />
                  </motion.div>
                  <div>
                    <p className="text-xs uppercase tracking-wider text-white/40">
                      Current Streak
                    </p>
                    <p
                      className={`mt-0.5 text-2xl font-bold ${currentStreakColor}`}
                    >
                      {currentStreakLabel}
                    </p>
                  </div>
                </div>

                {/* Best winning streak */}
                <div className="text-right">
                  <p className="text-xs uppercase tracking-wider text-white/40">
                    Best Win Streak
                  </p>
                  <div className="mt-1 flex items-center justify-end gap-1.5">
                    <Trophy className="h-4 w-4 text-amber-400" />
                    <span className="text-xl font-bold text-amber-400">
                      {stats.bestWinStreak}
                    </span>
                    <span className="text-xs text-white/40">days</span>
                  </div>
                </div>
              </div>

              {/* Stats row */}
              <div className="grid grid-cols-3 gap-3">
                {[
                  {
                    label: 'Profit Days',
                    value: stats.totalProfitableDays,
                    icon: TrendingUp,
                    color: 'text-emerald-400',
                  },
                  {
                    label: 'Losing Days',
                    value: stats.totalLosingDays,
                    icon: Medal,
                    color: 'text-red-400',
                  },
                  {
                    label: 'Total Trades',
                    value: trades.length,
                    icon: Star,
                    color: 'text-sky-400',
                  },
                ].map((item, i) => (
                  <motion.div
                    key={item.label}
                    initial={{ opacity: 0, y: 12 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.1 + i * 0.06 }}
                    className="rounded-lg bg-white/[0.03] p-3 text-center"
                  >
                    <item.icon className={`mx-auto mb-1 h-4 w-4 ${item.color}`} />
                    <p className="text-lg font-bold text-white">{item.value}</p>
                    <p className="text-[10px] uppercase tracking-wide text-white/40">
                      {item.label}
                    </p>
                  </motion.div>
                ))}
              </div>

              {/* ---- Calendar heatmap ---- */}
              <div className="rounded-xl bg-white/[0.03] p-4">
                <div className="mb-3 flex items-center gap-2">
                  <Calendar className="h-4 w-4 text-white/40" />
                  <p className="text-sm font-medium text-white/70">
                    Last 30 Days
                  </p>
                </div>

                <div className="flex gap-2">
                  {/* Day-of-week labels */}
                  <div className="flex flex-col gap-1 pt-0.5">
                    {['S', 'M', 'T', 'W', 'T', 'F', 'S'].map((label, i) => (
                      <span
                        key={i}
                        className="flex h-[14px] items-center text-[9px] text-white/30"
                      >
                        {label}
                      </span>
                    ))}
                  </div>

                  {/* Week columns */}
                  {heatmap.map((week, wi) => (
                    <div key={wi} className="flex flex-col gap-1">
                      {week.map((day) => {
                        const hasTrade = day.totalPL !== 0
                        const isFuture = new Date(day.date) > new Date()

                        let bg = 'bg-white/[0.06]' // no trade
                        if (hasTrade && day.totalPL > 0)
                          bg = 'bg-emerald-500/80'
                        else if (hasTrade && day.totalPL < 0)
                          bg = 'bg-red-500/80'

                        if (isFuture) bg = 'bg-white/[0.03]'

                        return (
                          <motion.div
                            key={day.date}
                            initial={{ scale: 0.6, opacity: 0 }}
                            animate={{ scale: 1, opacity: 1 }}
                            transition={{ delay: 0.02 * (wi * 7 + week.indexOf(day)) }}
                            title={`${day.date}${hasTrade ? ` · $${day.totalPL.toFixed(2)}` : ' · No trades'}`}
                            className={`h-[14px] w-[14px] cursor-default rounded-[3px] ${bg} transition-colors hover:ring-1 hover:ring-white/20`}
                          />
                        )
                      })}
                    </div>
                  ))}
                </div>

                {/* Legend */}
                <div className="mt-3 flex items-center gap-4 text-[10px] text-white/40">
                  <span className="flex items-center gap-1.5">
                    <span className="inline-block h-[10px] w-[10px] rounded-[2px] bg-emerald-500/80" />
                    Profit
                  </span>
                  <span className="flex items-center gap-1.5">
                    <span className="inline-block h-[10px] w-[10px] rounded-[2px] bg-red-500/80" />
                    Loss
                  </span>
                  <span className="flex items-center gap-1.5">
                    <span className="inline-block h-[10px] w-[10px] rounded-[2px] bg-white/[0.06]" />
                    No trades
                  </span>
                </div>
              </div>

              {/* ---- Achievements ---- */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Award className="h-4 w-4 text-amber-400" />
                    <p className="text-sm font-medium text-white/70">
                      Achievements
                    </p>
                  </div>
                  <Badge
                    variant="secondary"
                    className="border-amber-500/30 bg-amber-500/10 text-amber-400"
                  >
                    {unlockedAchievements.size}/{ACHIEVEMENTS.length}
                  </Badge>
                </div>

                {/* Progress bar */}
                <Progress
                  value={achievementProgress}
                  className="h-1.5 bg-white/10 [&>div]:bg-gradient-to-r [&>div]:from-amber-500 [&>div]:to-orange-500"
                />

                {/* Achievement grid */}
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-5">
                  {ACHIEVEMENTS.map((achievement, i) => {
                    const unlocked = unlockedAchievements.has(achievement.id)
                    return (
                      <motion.div
                        key={achievement.id}
                        initial={{ opacity: 0, scale: 0.9 }}
                        animate={{ opacity: 1, scale: 1 }}
                        transition={{ delay: 0.15 + i * 0.04 }}
                        className={`group relative flex flex-col items-center gap-1.5 rounded-xl border p-3 text-center transition-all ${
                          unlocked
                            ? 'border-amber-500/30 bg-amber-500/[0.08] shadow-[0_0_16px_rgba(245,158,11,0.1)]'
                            : 'border-white/[0.06] bg-white/[0.02] opacity-60'
                        }`}
                      >
                        {/* Glow effect for unlocked */}
                        {unlocked && (
                          <div className="pointer-events-none absolute -inset-px rounded-xl bg-gradient-to-br from-amber-500/20 to-orange-500/10 opacity-0 transition-opacity group-hover:opacity-100" />
                        )}

                        <span className="text-2xl leading-none">
                          {unlocked ? achievement.icon : '🔒'}
                        </span>
                        <p
                          className={`text-xs font-semibold ${
                            unlocked ? 'text-white' : 'text-white/40'
                          }`}
                        >
                          {achievement.name}
                        </p>
                        <p className="text-[10px] leading-tight text-white/30">
                          {achievement.desc}
                        </p>

                        {unlocked && (
                          <motion.div
                            initial={{ scale: 0 }}
                            animate={{ scale: 1 }}
                            transition={{
                              type: 'spring',
                              stiffness: 300,
                              damping: 20,
                            }}
                          >
                            <Star className="h-3 w-3 fill-amber-400 text-amber-400" />
                          </motion.div>
                        )}
                      </motion.div>
                    )
                  })}
                </div>
              </div>
            </motion.div>
          )}
        </CardContent>
      </Card>

      {/* Pro upgrade overlay */}
      <AnimatePresence>
        {!isPro && trades.length > 0 && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 z-10"
          >
            <UpgradeOverlay onUpgrade={onUpgrade} />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
