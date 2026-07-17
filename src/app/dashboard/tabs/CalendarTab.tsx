'use client'

import { useState, useMemo, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { ScrollArea } from '@/components/ui/scroll-area'
import {
  Calendar,
  ChevronLeft,
  ChevronRight,
  TrendingUp,
  TrendingDown,
  Minus,
  ArrowUpRight,
  ArrowDownRight,
  Clock,
  Activity,
  BarChart3,
  Flame,
  Trophy,
  Skull,
} from 'lucide-react'
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from 'recharts'

// ── Interfaces ──────────────────────────────────────────────────────────────

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
}

interface CalendarTabProps {
  trades: Trade[]
  language: string
}

// ── Helpers ─────────────────────────────────────────────────────────────────

function sameDay(a: Date, b: Date) {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  )
}

function formatTime(iso: string) {
  const d = new Date(iso)
  return d.toLocaleTimeString('en-US', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  })
}

function formatCurrency(n: number) {
  const prefix = n >= 0 ? '+' : ''
  return `${prefix}$${n.toFixed(2)}`
}

// ── Translations ────────────────────────────────────────────────────────────

function t(key: string, lang: string) {
  const dict: Record<string, Record<string, string>> = {
    monthActivity: { id: 'Aktivitas Bulan Ini', en: 'Month Activity' },
    totalTrades: { id: 'Total Transaksi', en: 'Total Trades' },
    profit: { id: 'Profit', en: 'Profit' },
    loss: { id: 'Loss', en: 'Loss' },
    netPL: { id: 'P/L Bersih', en: 'Net P/L' },
    today: { id: 'Hari Ini', en: 'Today' },
    selectedDay: { id: 'Transaksi', en: 'Trades for' },
    noTrades: { id: 'Tidak ada transaksi', en: 'No trades' },
    noTradesDesc: { id: 'Tidak ada transaksi pada hari ini.', en: 'No trades on this day.' },
    buy: { id: 'Beli', en: 'BUY' },
    sell: { id: 'Jual', en: 'SELL' },
    lots: { id: 'lot', en: 'lot' },
    winRate: { id: 'Win Rate', en: 'Win Rate' },
    bestDay: { id: 'Hari Terbaik', en: 'Best Day' },
    worstDay: { id: 'Hari Terburuk', en: 'Worst Day' },
    tradingStreak: { id: 'Streak Trading', en: 'Trading Streak' },
    days: { id: 'hari', en: 'days' },
    legendProfit: { id: 'Hari Profit', en: 'Profit day' },
    legendLoss: { id: 'Hari Loss', en: 'Loss day' },
    legendBreakeven: { id: 'Breakeven', en: 'Breakeven' },
    legendNoTrades: { id: 'Tidak ada transaksi', en: 'No trades' },
    dailyPL: { id: 'P/L Harian', en: 'Daily P/L' },
    daySummaryTrades: { id: 'transaksi', en: 'trades' },
    daySummaryWinRate: { id: 'Win Rate', en: 'Win Rate' },
    dayHeader: {
      id: (d: number, m: string, y: number) =>
        `Transaksi — ${d} ${m} ${y}`,
      en: (d: number, m: string, y: number) =>
        `Trades — ${m} ${d}, ${y}`,
    },
  }
  return dict[key]?.[lang] ?? dict[key]?.['en'] ?? key
}

const MONTH_NAMES: Record<string, string[]> = {
  id: [
    'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
    'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember',
  ],
  en: [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December',
  ],
}

const DAY_NAMES: Record<string, string[]> = {
  id: ['Min', 'Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab'],
  en: ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'],
}

// ── Animation variants ─────────────────────────────────────────────────────

const calendarVariants = {
  enter: (direction: number) => ({
    x: direction > 0 ? 60 : -60,
    opacity: 0,
  }),
  center: {
    x: 0,
    opacity: 1,
  },
  exit: (direction: number) => ({
    x: direction > 0 ? -60 : 60,
    opacity: 0,
  }),
}

const panelVariants = {
  hidden: { opacity: 0, height: 0, marginTop: 0 },
  visible: {
    opacity: 1,
    height: 'auto',
    marginTop: 24,
    transition: { duration: 0.3, ease: 'easeOut' },
  },
  exit: {
    opacity: 0,
    height: 0,
    marginTop: 0,
    transition: { duration: 0.2, ease: 'easeIn' },
  },
}

const tradeItemVariants = {
  hidden: { opacity: 0, y: 12 },
  visible: (i: number) => ({
    opacity: 1,
    y: 0,
    transition: { delay: i * 0.05, duration: 0.25, ease: 'easeOut' },
  }),
  exit: { opacity: 0, y: -8, transition: { duration: 0.15 } },
}

// ── Custom tooltip for mini bar chart ────────────────────────────────────────

function CustomTooltip({ active, payload, label }: { active?: boolean; payload?: Array<{ value: number; payload: { day: number } }>; label?: string }) {
  if (!active || !payload || payload.length === 0) return null
  const value = payload[0].value
  return (
    <div className="bg-[#1a1028] border border-purple-900/40 rounded-lg px-3 py-2 shadow-xl">
      <p className="text-xs text-lux-text-secondary dark:text-gray-400">{label}</p>
      <p className={`text-sm font-bold ${value >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
        {formatCurrency(value)}
      </p>
    </div>
  )
}

// ── Component ───────────────────────────────────────────────────────────────

function CalendarTab({ trades, language }: CalendarTabProps) {
  const lang = language === 'id' ? 'id' : 'en'
  const today = new Date()
  today.setHours(0, 0, 0, 0)

  const [currentYear, setCurrentYear] = useState(today.getFullYear())
  const [currentMonth, setCurrentMonth] = useState(today.getMonth())
  const [selectedDay, setSelectedDay] = useState<number | null>(null)
  const [direction, setDirection] = useState(0)

  // ── Derived: calendar grid ──────────────────────────────────────────────

  const daysInMonth = new Date(currentYear, currentMonth + 1, 0).getDate()
  const firstDayOfWeek = new Date(currentYear, currentMonth, 1).getDay()
  const emptyCells = Array.from({ length: firstDayOfWeek }, (_, i) => i)
  const dayCells = Array.from({ length: daysInMonth }, (_, i) => i + 1)

  // ── Derived: trades grouped by date key "YYYY-M-D" ─────────────────────

  const tradesByKey = useMemo(() => {
    const map: Record<string, Trade[]> = {}
    for (const trade of trades) {
      const d = new Date(trade.open_time)
      const key = `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`
      if (!map[key]) map[key] = []
      map[key].push(trade)
    }
    return map
  }, [trades])

  // ── Derived: net P/L per day for the current month ──────────────────────

  const netPLByDay = useMemo(() => {
    const map: Record<number, number> = {}
    for (const trade of trades) {
      const d = new Date(trade.open_time)
      if (d.getFullYear() === currentYear && d.getMonth() === currentMonth) {
        const day = d.getDate()
        map[day] = (map[day] ?? 0) + trade.profit_loss
      }
    }
    return map
  }, [trades, currentYear, currentMonth])

  // ── Derived: trades for selected day ────────────────────────────────────

  const selectedTrades = useMemo(() => {
    if (selectedDay === null) return []
    const key = `${currentYear}-${currentMonth}-${selectedDay}`
    return tradesByKey[key] ?? []
  }, [selectedDay, currentYear, currentMonth, tradesByKey])

  const selectedDayNetPL = useMemo(() => {
    if (selectedDay === null) return 0
    return netPLByDay[selectedDay] ?? 0
  }, [selectedDay, netPLByDay])

  // ── Derived: selected day summary stats ────────────────────────────────

  const selectedDayStats = useMemo(() => {
    if (selectedDay === null || selectedTrades.length === 0) return null
    const wins = selectedTrades.filter((t) => t.profit_loss >= 0).length
    const winRate = ((wins / selectedTrades.length) * 100).toFixed(1)
    return { count: selectedTrades.length, winRate }
  }, [selectedDay, selectedTrades])

  // ── Derived: month summary stats ────────────────────────────────────────

  const monthTrades = useMemo(
    () =>
      trades.filter((t) => {
        const d = new Date(t.open_time)
        return d.getFullYear() === currentYear && d.getMonth() === currentMonth
      }),
    [trades, currentYear, currentMonth]
  )

  const monthStats = useMemo(() => {
    const total = monthTrades.length
    const wins = monthTrades.filter((t) => t.profit_loss >= 0).length
    const losses = total - wins
    const netPL = monthTrades.reduce((s, t) => s + t.profit_loss, 0)
    const winRate = total > 0 ? ((wins / total) * 100).toFixed(1) : '0.0'
    return { total, wins, losses, netPL, winRate }
  }, [monthTrades])

  // ── Derived: best day and worst day ────────────────────────────────────

  const { bestDay, worstDay } = useMemo(() => {
    let best: { day: number; pl: number } | null = null
    let worst: { day: number; pl: number } | null = null
    for (const [dayStr, pl] of Object.entries(netPLByDay)) {
      const day = Number(dayStr)
      if (!best || pl > best.pl) best = { day, pl }
      if (!worst || pl < worst.pl) worst = { day, pl }
    }
    return {
      bestDay: best && best.pl > 0 ? best : null,
      worstDay: worst && worst.pl < 0 ? worst : null,
    }
  }, [netPLByDay])

  // ── Derived: trading day streak ─────────────────────────────────────────

  const tradingStreak = useMemo(() => {
    // Calculate consecutive trading days ending at today (or the most recent trading day before today)
    const streakDays: number[] = []
    const checkDate = new Date(today)

    // If today has no trades, check if yesterday was a trading day to continue streak
    let startOffset = 0
    const todayKey = `${checkDate.getFullYear()}-${checkDate.getMonth()}-${checkDate.getDate()}`
    if (!tradesByKey[todayKey]) {
      // Check yesterday
      checkDate.setDate(checkDate.getDate() - 1)
      const yesterdayKey = `${checkDate.getFullYear()}-${checkDate.getMonth()}-${checkDate.getDate()}`
      if (!tradesByKey[yesterdayKey]) return 0
      startOffset = 1
    }

    // Count backwards from the last trading day
    const startDate = new Date(today)
    startDate.setDate(startDate.getDate() - startOffset)

    for (let i = 0; i < 365; i++) {
      const d = new Date(startDate)
      d.setDate(d.getDate() - i)
      const key = `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`
      if (tradesByKey[key] && tradesByKey[key].length > 0) {
        streakDays.push(d.getDate())
      } else {
        break
      }
    }

    return streakDays.length
  }, [tradesByKey, today])

  // ── Derived: mini bar chart data ────────────────────────────────────────

  // Build daily P/L chart data (not memoized to avoid React Compiler issues)
  const dailyPLChartData = (() => {
    const netPLMap = new Map(Object.entries(netPLByDay).map(([k, v]) => [Number(k), v] as const))
    return Array.from({ length: daysInMonth }, (_, i) => {
      const day = i + 1
      const pl = netPLMap.get(day) ?? 0
      return { day, pl, hasTrades: netPLMap.has(day) }
    }).filter((d) => d.hasTrades)
  })()

  // ── Navigation handlers ─────────────────────────────────────────────────

  function goToPrevMonth() {
    setDirection(-1)
    setSelectedDay(null)
    setCurrentMonth((m) => {
      if (m === 0) {
        setCurrentYear((y) => y - 1)
        return 11
      }
      return m - 1
    })
  }

  function goToNextMonth() {
    setDirection(1)
    setSelectedDay(null)
    setCurrentMonth((m) => {
      if (m === 11) {
        setCurrentYear((y) => y + 1)
        return 0
      }
      return m + 1
    })
  }

  function goToToday() {
    setDirection(0)
    setCurrentYear(today.getFullYear())
    setCurrentMonth(today.getMonth())
    setSelectedDay(today.getDate())
  }

  function handleDayClick(day: number) {
    setSelectedDay((prev) => (prev === day ? null : day))
  }

  // ── Render helpers ──────────────────────────────────────────────────────

  const monthName = MONTH_NAMES[lang][currentMonth]
  const dayLabels = DAY_NAMES[lang]

  function getDayCellClasses(day: number) {
    const net = netPLByDay[day]
    const isSelected = selectedDay === day
    const isToday = sameDay(
      new Date(currentYear, currentMonth, day),
      today
    )
    const hasTrades = net !== undefined

    // Base
    let classes =
      'aspect-square flex flex-col items-center justify-center rounded-xl text-sm relative cursor-pointer transition-colors duration-150'

    if (isToday && !isSelected) {
      classes += ' ring-2 ring-purple-400/60'
    }

    if (isSelected) {
      if (net > 0) {
        classes +=
          ' bg-emerald-500/20 text-emerald-300 ring-1 ring-emerald-500/50'
      } else if (net < 0) {
        classes += ' bg-red-500/20 text-red-300 ring-1 ring-red-500/50'
      } else {
        classes += ' bg-purple-500/20 text-purple-300 ring-1 ring-purple-500/50'
      }
    } else if (net > 0) {
      classes += ' bg-emerald-500/10 text-emerald-300/90 hover:bg-emerald-500/20'
    } else if (net < 0) {
      classes += ' bg-red-500/10 text-red-300/90 hover:bg-red-500/20'
    } else if (hasTrades) {
      classes += ' bg-purple-500/10 text-purple-300/90 hover:bg-purple-500/20'
    } else {
      classes += ' text-lux-text-muted dark:text-gray-500 hover:bg-lux-surface-hover dark:hover:bg-lux-surface-hover dark:bg-white/5 hover:text-lux-text-primary dark:text-gray-300'
    }

    return classes
  }

  return (
    <div className="space-y-6">
      {/* ── Calendar Card ──────────────────────────────────────────────── */}
      <Card className="bg-lux-bg-card dark:bg-gradient-to-br dark:from-[#0f0b18] dark:to-[#12091a] border-lux-border dark:border-purple-900/30">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2 text-base sm:text-lg">
              <Calendar className="w-5 h-5 text-purple-400" />
              <AnimatePresence mode="wait" custom={direction}>
                <motion.span
                  key={`${currentYear}-${currentMonth}`}
                  custom={direction}
                  variants={calendarVariants}
                  initial="enter"
                  animate="center"
                  exit="exit"
                  transition={{ duration: 0.2, ease: 'easeInOut' }}
                  className="inline-block"
                >
                  {monthName} {currentYear}
                </motion.span>
              </AnimatePresence>
            </CardTitle>

            <div className="flex items-center gap-1">
              <motion.button
                whileHover={{ scale: 1.1 }}
                whileTap={{ scale: 0.95 }}
                onClick={goToToday}
                className="px-2.5 py-1.5 text-xs font-medium rounded-lg text-purple-300 bg-purple-500/15 hover:bg-purple-500/25 transition-colors mr-1"
              >
                {t('today', lang)}
              </motion.button>
              <motion.button
                whileHover={{ scale: 1.1 }}
                whileTap={{ scale: 0.9 }}
                onClick={goToPrevMonth}
                className="p-2 rounded-lg text-lux-text-secondary dark:text-gray-400 hover:text-purple-300 hover:bg-purple-500/15 transition-colors"
                aria-label="Previous month"
              >
                <ChevronLeft className="w-4 h-4" />
              </motion.button>
              <motion.button
                whileHover={{ scale: 1.1 }}
                whileTap={{ scale: 0.9 }}
                onClick={goToNextMonth}
                className="p-2 rounded-lg text-lux-text-secondary dark:text-gray-400 hover:text-purple-300 hover:bg-purple-500/15 transition-colors"
                aria-label="Next month"
              >
                <ChevronRight className="w-4 h-4" />
              </motion.button>
            </div>
          </div>
        </CardHeader>

        <CardContent>
          {/* Day-of-week headers */}
          <div className="grid grid-cols-7 gap-1 text-center text-xs text-lux-text-muted dark:text-gray-500 mb-2">
            {dayLabels.map((day) => (
              <div key={day} className="py-2 font-medium">
                {day}
              </div>
            ))}
          </div>

          {/* Calendar grid */}
          <AnimatePresence mode="wait" custom={direction}>
            <motion.div
              key={`${currentYear}-${currentMonth}`}
              custom={direction}
              variants={calendarVariants}
              initial="enter"
              animate="center"
              exit="exit"
              transition={{ duration: 0.2, ease: 'easeInOut' }}
              className="grid grid-cols-7 gap-1"
            >
              {emptyCells.map((_, i) => (
                <div key={`empty-${i}`} className="aspect-square" />
              ))}
              {dayCells.map((day) => {
                const net = netPLByDay[day]
                const key = `${currentYear}-${currentMonth}-${day}`
                const dayTrades = tradesByKey[key] ?? []
                const count = dayTrades.length
                const isToday = sameDay(
                  new Date(currentYear, currentMonth, day),
                  today
                )

                return (
                  <motion.div
                    key={day}
                    whileHover={{ scale: 1.08 }}
                    whileTap={{ scale: 0.95 }}
                    onClick={() => handleDayClick(day)}
                    className={getDayCellClasses(day)}
                    role="button"
                    tabIndex={0}
                    aria-label={`${day} ${monthName} ${currentYear}, ${count} trades`}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault()
                        handleDayClick(day)
                      }
                    }}
                  >
                    <span className={`leading-none ${isToday ? 'font-bold' : 'font-medium'}`}>
                      {day}
                    </span>
                    {count > 0 && (
                      <Badge
                        className="absolute -bottom-0.5 left-1/2 -translate-x-1/2 min-w-[16px] h-4 px-1 text-[10px] leading-none rounded-full border-0"
                        style={
                          net > 0
                            ? { backgroundColor: 'rgba(52,211,153,0.25)', color: '#34d399' }
                            : net < 0
                              ? { backgroundColor: 'rgba(248,113,113,0.25)', color: '#f87171' }
                              : { backgroundColor: 'rgba(168,85,247,0.25)', color: '#c084fc' }
                        }
                      >
                        {count}
                      </Badge>
                    )}
                  </motion.div>
                )
              })}
            </motion.div>
          </AnimatePresence>

          {/* ── Legend ─────────────────────────────────────────────────────── */}
          <div className="flex items-center justify-center gap-4 mt-4 pt-3 border-t border-white/5">
            <div className="flex items-center gap-1.5">
              <div className="w-3 h-3 rounded-sm bg-emerald-500/30 border border-emerald-500/40" />
              <span className="text-[11px] text-lux-text-muted dark:text-gray-500">{t('legendProfit', lang)}</span>
            </div>
            <div className="flex items-center gap-1.5">
              <div className="w-3 h-3 rounded-sm bg-red-500/30 border border-red-500/40" />
              <span className="text-[11px] text-lux-text-muted dark:text-gray-500">{t('legendLoss', lang)}</span>
            </div>
            <div className="flex items-center gap-1.5">
              <div className="w-3 h-3 rounded-sm bg-purple-500/30 border border-purple-500/40" />
              <span className="text-[11px] text-lux-text-muted dark:text-gray-500">{t('legendBreakeven', lang)}</span>
            </div>
            <div className="flex items-center gap-1.5">
              <div className="w-3 h-3 rounded-sm bg-lux-surface-hover dark:bg-white/5 border border-white/10" />
              <span className="text-[11px] text-lux-text-muted dark:text-gray-500">{t('legendNoTrades', lang)}</span>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* ── Trade Detail Panel (enhanced with summary stats) ────────────── */}
      <AnimatePresence>
        {selectedDay !== null && (
          <motion.div
            key="detail-panel"
            variants={panelVariants}
            initial="hidden"
            animate="visible"
            exit="exit"
            className="overflow-hidden"
          >
            <Card className="bg-lux-bg-card dark:bg-gradient-to-br dark:from-[#0f0b18] dark:to-[#12091a] border-lux-border dark:border-purple-900/30">
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <CardTitle className="flex items-center gap-2 text-base">
                    <Activity className="w-4 h-4 text-purple-400" />
                    <span>
                      {lang === 'id'
                        ? `${t('selectedDay', lang)} — ${selectedDay} ${monthName} ${currentYear}`
                        : `${t('selectedDay', lang)} ${monthName} ${selectedDay}, ${currentYear}`}
                    </span>
                  </CardTitle>
                  <Badge
                    className="text-xs font-semibold border-0"
                    style={
                      selectedDayNetPL > 0
                        ? { backgroundColor: 'rgba(52,211,153,0.2)', color: '#34d399' }
                        : selectedDayNetPL < 0
                          ? { backgroundColor: 'rgba(248,113,113,0.2)', color: '#f87171' }
                          : { backgroundColor: 'rgba(168,85,247,0.2)', color: '#c084fc' }
                    }
                  >
                    {selectedDayNetPL > 0 && <TrendingUp className="w-3 h-3 mr-1" />}
                    {selectedDayNetPL < 0 && <TrendingDown className="w-3 h-3 mr-1" />}
                    {selectedDayNetPL === 0 && <Minus className="w-3 h-3 mr-1" />}
                    {formatCurrency(selectedDayNetPL)}
                  </Badge>
                </div>
                {/* Day summary row */}
                {selectedDayStats && (
                  <div className="flex items-center gap-4 mt-2">
                    <span className="text-xs text-lux-text-secondary dark:text-gray-400">
                      {selectedDayStats.count} {t('daySummaryTrades', lang)}
                    </span>
                    <span className="text-xs text-lux-text-secondary dark:text-gray-400">
                      {t('daySummaryWinRate', lang)}: <span className="text-purple-300 font-medium">{selectedDayStats.winRate}%</span>
                    </span>
                  </div>
                )}
              </CardHeader>
              <CardContent>
                {selectedTrades.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-10 text-lux-text-muted dark:text-gray-500">
                    <Calendar className="w-10 h-10 mb-3 text-gray-600" />
                    <p className="text-sm font-medium">{t('noTrades', lang)}</p>
                    <p className="text-xs mt-1">{t('noTradesDesc', lang)}</p>
                  </div>
                ) : (
                  <ScrollArea className="max-h-96 overflow-y-auto">
                    <div className="space-y-2 pr-2">
                      <AnimatePresence>
                        {selectedTrades.map((trade, i) => {
                          const isProfit = trade.profit_loss >= 0
                          return (
                            <motion.div
                              key={trade.id}
                              custom={i}
                              variants={tradeItemVariants}
                              initial="hidden"
                              animate="visible"
                              exit="exit"
                              className="flex items-center gap-3 p-3 rounded-xl border transition-colors"
                              style={{
                                borderColor: isProfit
                                  ? 'rgba(16,185,129,0.15)'
                                  : 'rgba(239,68,68,0.15)',
                                backgroundColor: isProfit
                                  ? 'rgba(16,185,129,0.04)'
                                  : 'rgba(239,68,68,0.04)',
                              }}
                            >
                              {/* Type icon */}
                              <div
                                className="flex-shrink-0 w-9 h-9 rounded-lg flex items-center justify-center"
                                style={{
                                  backgroundColor: isProfit
                                    ? 'rgba(52,211,153,0.15)'
                                    : 'rgba(248,113,113,0.15)',
                                }}
                              >
                                {trade.type === 'BUY' ? (
                                  <ArrowUpRight
                                    className="w-4 h-4"
                                    style={{
                                      color: isProfit ? '#34d399' : '#f87171',
                                    }}
                                  />
                                ) : (
                                  <ArrowDownRight
                                    className="w-4 h-4"
                                    style={{
                                      color: isProfit ? '#34d399' : '#f87171',
                                    }}
                                  />
                                )}
                              </div>

                              {/* Trade info */}
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2">
                                  <span className="font-semibold text-sm text-gray-200 truncate">
                                    {trade.symbol}
                                  </span>
                                  <Badge
                                    className="text-[10px] px-1.5 py-0 h-4 rounded border-0 font-medium"
                                    style={{
                                      backgroundColor: trade.type === 'BUY'
                                        ? 'rgba(52,211,153,0.15)'
                                        : 'rgba(248,113,113,0.15)',
                                      color: trade.type === 'BUY'
                                        ? '#34d399'
                                        : '#f87171',
                                    }}
                                  >
                                    {t(trade.type.toLowerCase(), lang)}
                                  </Badge>
                                  <span className="text-[11px] text-lux-text-muted dark:text-gray-500">
                                    {trade.lot_size} {t('lots', lang)}
                                  </span>
                                </div>
                                <div className="flex items-center gap-1.5 mt-0.5 text-[11px] text-lux-text-muted dark:text-gray-500">
                                  <Clock className="w-3 h-3" />
                                  <span>
                                    {formatTime(trade.open_time)}
                                    {' → '}
                                    {formatTime(trade.close_time)}
                                  </span>
                                </div>
                              </div>

                              {/* P/L */}
                              <div className="flex-shrink-0 text-right">
                                <span
                                  className={`text-sm font-bold ${
                                    isProfit ? 'text-emerald-400' : 'text-red-400'
                                  }`}
                                >
                                  {formatCurrency(trade.profit_loss)}
                                </span>
                              </div>
                            </motion.div>
                          )
                        })}
                      </AnimatePresence>
                    </div>
                  </ScrollArea>
                )}
              </CardContent>
            </Card>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Month Summary Card (enhanced) ──────────────────────────────── */}
      <Card className="bg-lux-bg-card dark:bg-gradient-to-br dark:from-[#0f0b18] dark:to-[#12091a] border-lux-border dark:border-purple-900/30">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <BarChart3 className="w-4 h-4 text-purple-400" />
            {t('monthActivity', lang)}
            <span className="text-xs font-normal text-lux-text-muted dark:text-gray-500 ml-1">
              ({monthName} {currentYear})
            </span>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Stats grid */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-center">
            {/* Total Trades */}
            <div className="p-3 rounded-xl bg-purple-500/10">
              <div className="text-2xl sm:text-3xl font-bold text-purple-400">
                {monthStats.total}
              </div>
              <div className="text-xs text-lux-text-muted dark:text-gray-500 mt-1">
                {t('totalTrades', lang)}
              </div>
            </div>

            {/* Profit */}
            <div className="p-3 rounded-xl bg-emerald-500/10">
              <div className="text-2xl sm:text-3xl font-bold text-emerald-400 flex items-center justify-center gap-1">
                <TrendingUp className="w-4 h-4 sm:w-5 sm:h-5" />
                {monthStats.wins}
              </div>
              <div className="text-xs text-lux-text-muted dark:text-gray-500 mt-1">
                {t('profit', lang)}
              </div>
            </div>

            {/* Loss */}
            <div className="p-3 rounded-xl bg-red-500/10">
              <div className="text-2xl sm:text-3xl font-bold text-red-400 flex items-center justify-center gap-1">
                <TrendingDown className="w-4 h-4 sm:w-5 sm:h-5" />
                {monthStats.losses}
              </div>
              <div className="text-xs text-lux-text-muted dark:text-gray-500 mt-1">
                {t('loss', lang)}
              </div>
            </div>

            {/* Net P/L & Win Rate */}
            <div className="p-3 rounded-xl bg-purple-500/10">
              <div
                className={`text-2xl sm:text-3xl font-bold ${
                  monthStats.netPL >= 0 ? 'text-emerald-400' : 'text-red-400'
                }`}
              >
                {formatCurrency(monthStats.netPL)}
              </div>
              <div className="flex items-center justify-center gap-2 mt-1">
                <span className="text-xs text-lux-text-muted dark:text-gray-500">{t('winRate', lang)}</span>
                <span className="text-xs font-semibold text-purple-300">
                  {monthStats.winRate}%
                </span>
              </div>
            </div>
          </div>

          {/* Best Day / Worst Day / Streak row */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {/* Best Day */}
            <div className="p-3 rounded-xl bg-emerald-500/5 border border-emerald-500/10">
              <div className="flex items-center gap-2 mb-1">
                <Trophy className="w-4 h-4 text-emerald-400" />
                <span className="text-xs text-lux-text-muted dark:text-gray-500">{t('bestDay', lang)}</span>
              </div>
              {bestDay ? (
                <>
                  <div className="text-lg font-bold text-emerald-400">
                    {formatCurrency(bestDay.pl)}
                  </div>
                  <div className="text-[11px] text-lux-text-muted dark:text-gray-500">
                    {bestDay.day} {monthName} {currentYear}
                  </div>
                </>
              ) : (
                <div className="text-sm text-gray-600">—</div>
              )}
            </div>

            {/* Worst Day */}
            <div className="p-3 rounded-xl bg-red-500/5 border border-red-500/10">
              <div className="flex items-center gap-2 mb-1">
                <Skull className="w-4 h-4 text-red-400" />
                <span className="text-xs text-lux-text-muted dark:text-gray-500">{t('worstDay', lang)}</span>
              </div>
              {worstDay ? (
                <>
                  <div className="text-lg font-bold text-red-400">
                    {formatCurrency(worstDay.pl)}
                  </div>
                  <div className="text-[11px] text-lux-text-muted dark:text-gray-500">
                    {worstDay.day} {monthName} {currentYear}
                  </div>
                </>
              ) : (
                <div className="text-sm text-gray-600">—</div>
              )}
            </div>

            {/* Trading Streak */}
            <div className="p-3 rounded-xl bg-amber-500/5 border border-amber-500/10">
              <div className="flex items-center gap-2 mb-1">
                <Flame className="w-4 h-4 text-amber-400" />
                <span className="text-xs text-lux-text-muted dark:text-gray-500">{t('tradingStreak', lang)}</span>
              </div>
              <div className="flex items-baseline gap-1.5">
                <span className="text-lg font-bold text-amber-400">
                  {tradingStreak}
                </span>
                <span className="text-xs text-lux-text-muted dark:text-gray-500">
                  {t('days', lang)}
                </span>
              </div>
              <div className="text-[11px] text-lux-text-muted dark:text-gray-500">
                🔥 {tradingStreak > 0 ? 'Keep going!' : 'Start trading!'}
              </div>
            </div>
          </div>

          {/* Mini Bar Chart — Daily P/L */}
          {dailyPLChartData.length > 0 && (
            <div>
              <div className="flex items-center gap-2 mb-3">
                <BarChart3 className="w-4 h-4 text-purple-400" />
                <span className="text-sm font-medium text-lux-text-primary dark:text-gray-300">{t('dailyPL', lang)}</span>
              </div>
              <div className="h-40 sm:h-52">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={dailyPLChartData} margin={{ top: 4, right: 4, left: -10, bottom: 0 }}>
                    <XAxis
                      dataKey="day"
                      tick={{ fontSize: 10, fill: '#6b7280' }}
                      axisLine={false}
                      tickLine={false}
                    />
                    <YAxis
                      tick={{ fontSize: 10, fill: '#6b7280' }}
                      axisLine={false}
                      tickLine={false}
                      tickFormatter={(v: number) => `$${v}`}
                    />
                    <Tooltip content={<CustomTooltip />} cursor={{ fill: 'rgba(168,85,247,0.08)' }} />
                    <Bar dataKey="pl" radius={[3, 3, 0, 0]} maxBarSize={20}>
                      {dailyPLChartData.map((entry, index) => (
                        <Cell
                          key={`cell-${index}`}
                          fill={entry.pl >= 0 ? 'rgba(52,211,153,0.6)' : 'rgba(248,113,113,0.6)'}
                        />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}

export default CalendarTab