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
} from 'lucide-react'

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
      classes += ' text-gray-500 hover:bg-white/5 hover:text-gray-300'
    }

    return classes
  }

  return (
    <div className="space-y-6">
      {/* ── Calendar Card ──────────────────────────────────────────────── */}
      <Card className="bg-gradient-to-br from-[#0f0b18] to-[#12091a] border-purple-900/30">
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
                className="p-2 rounded-lg text-gray-400 hover:text-purple-300 hover:bg-purple-500/15 transition-colors"
                aria-label="Previous month"
              >
                <ChevronLeft className="w-4 h-4" />
              </motion.button>
              <motion.button
                whileHover={{ scale: 1.1 }}
                whileTap={{ scale: 0.9 }}
                onClick={goToNextMonth}
                className="p-2 rounded-lg text-gray-400 hover:text-purple-300 hover:bg-purple-500/15 transition-colors"
                aria-label="Next month"
              >
                <ChevronRight className="w-4 h-4" />
              </motion.button>
            </div>
          </div>
        </CardHeader>

        <CardContent>
          {/* Day-of-week headers */}
          <div className="grid grid-cols-7 gap-1 text-center text-xs text-gray-500 mb-2">
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
        </CardContent>
      </Card>

      {/* ── Trade Detail Panel ─────────────────────────────────────────── */}
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
            <Card className="bg-gradient-to-br from-[#0f0b18] to-[#12091a] border-purple-900/30">
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
              </CardHeader>
              <CardContent>
                {selectedTrades.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-10 text-gray-500">
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
                                  <span className="text-[11px] text-gray-500">
                                    {trade.lot_size} {t('lots', lang)}
                                  </span>
                                </div>
                                <div className="flex items-center gap-1.5 mt-0.5 text-[11px] text-gray-500">
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

      {/* ── Month Summary Card ─────────────────────────────────────────── */}
      <Card className="bg-gradient-to-br from-[#0f0b18] to-[#12091a] border-purple-900/30">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <BarChart3 className="w-4 h-4 text-purple-400" />
            {t('monthActivity', lang)}
            <span className="text-xs font-normal text-gray-500 ml-1">
              ({monthName} {currentYear})
            </span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-center">
            {/* Total Trades */}
            <div className="p-3 rounded-xl bg-purple-500/10">
              <div className="text-2xl sm:text-3xl font-bold text-purple-400">
                {monthStats.total}
              </div>
              <div className="text-xs text-gray-500 mt-1">
                {t('totalTrades', lang)}
              </div>
            </div>

            {/* Profit */}
            <div className="p-3 rounded-xl bg-emerald-500/10">
              <div className="text-2xl sm:text-3xl font-bold text-emerald-400 flex items-center justify-center gap-1">
                <TrendingUp className="w-4 h-4 sm:w-5 sm:h-5" />
                {monthStats.wins}
              </div>
              <div className="text-xs text-gray-500 mt-1">
                {t('profit', lang)}
              </div>
            </div>

            {/* Loss */}
            <div className="p-3 rounded-xl bg-red-500/10">
              <div className="text-2xl sm:text-3xl font-bold text-red-400 flex items-center justify-center gap-1">
                <TrendingDown className="w-4 h-4 sm:w-5 sm:h-5" />
                {monthStats.losses}
              </div>
              <div className="text-xs text-gray-500 mt-1">
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
                <span className="text-xs text-gray-500">{t('winRate', lang)}</span>
                <span className="text-xs font-semibold text-purple-300">
                  {monthStats.winRate}%
                </span>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

export default CalendarTab