'use client'

import { useState, useEffect, useCallback, useMemo } from 'react'
import { motion } from 'framer-motion'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { CalendarDays, RefreshCw } from 'lucide-react'

// Interface
interface CalendarEvent {
  date: string
  time: string
  currency: string
  impact: 'high' | 'medium' | 'low'
  event: string
  forecast: string
  previous: string
  flag?: string
}

interface EconomicCalendarTabProps {
  language: 'id' | 'en'
}

// Component
function EconomicCalendarTab({ language }: EconomicCalendarTabProps) {
  const [events, setEvents] = useState<CalendarEvent[]>([])
  const [calLoading, setCalLoading] = useState(true)
  const [calFilter, setCalFilter] = useState<'all' | 'high' | 'medium' | 'low'>('all')
  const [currencyFilter, setCurrencyFilter] = useState<string>('all')
  const [lastFetched, setLastFetched] = useState<string>('')

  const fetchCalendar = useCallback(async () => {
    setCalLoading(true)
    try {
      const res = await fetch('/api/news/calendar')
      if (res.ok) {
        const data = await res.json()
        setEvents(data.events || [])
        setLastFetched(data.fetchedAt || '')
      }
    } catch { /* keep existing */ } finally { setCalLoading(false) }
  }, [])

  useEffect(() => {
    fetchCalendar()
    const interval = setInterval(fetchCalendar, 60 * 60 * 1000)
    return () => clearInterval(interval)
  }, [fetchCalendar])

  // Get unique currencies
  const currencies = useMemo(() => {
    const unique = [...new Set(events.map(e => e.currency))]
    return unique.sort((a, b) => {
      const priority: Record<string, number> = { USD: 0, EUR: 1, GBP: 2, JPY: 3, AUD: 4, CAD: 5, CHF: 6, NZD: 7, CNY: 8, IDR: 9 }
      return (priority[a] ?? 99) - (priority[b] ?? 99)
    })
  }, [events])

  // Filtering
  const filtered = useMemo(() => {
    let result = events
    if (calFilter !== 'all') result = result.filter(e => e.impact === calFilter)
    if (currencyFilter !== 'all') result = result.filter(e => e.currency === currencyFilter)
    return result
  }, [events, calFilter, currencyFilter])

  // Group by day
  const eventsByDay = useMemo(() => {
    return filtered.reduce((acc, evt) => {
      const day = evt.date || 'Other'
      if (!acc[day]) acc[day] = []
      acc[day].push(evt)
      return acc
    }, {} as Record<string, CalendarEvent[]>)
  }, [filtered])

  const dayOrder = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday']
  const sortedDays = useMemo(() => {
    return Object.keys(eventsByDay).sort((a, b) => {
      const ai = dayOrder.indexOf(a)
      const bi = dayOrder.indexOf(b)
      return (ai === -1 ? 99 : ai) - (bi === -1 ? 99 : bi)
    })
  }, [eventsByDay])

  const highCount = events.filter(e => e.impact === 'high').length
  const medCount = events.filter(e => e.impact === 'medium').length

  const labels = {
    id: {
      title: 'Kalender Ekonomi',
      subtitle: 'Jadwal event ekonomi berdampak dari Investing.com',
      source: 'Data dari Investing.com Economic Calendar',
      high: 'Dampak Tinggi', medium: 'Dampak Sedang', low: 'Dampak Rendah',
      all: 'Semua', allCurrencies: 'Semua Mata Uang',
      noEvents: 'Belum ada jadwal event',
      refresh: 'Refresh', lastUpdated: 'Terakhir diperbarui',
      waktu: 'Waktu', mataUang: 'Mata Uang',
      perkiraan: 'Perkiraan', sebelumnya: 'Sebelumnya', aktual: 'Aktual',
      events: 'event', fetching: 'Mengambil kalender ekonomi...',
      highEvents: 'Event berdampak tinggi minggu ini',
    },
    en: {
      title: 'Economic Calendar',
      subtitle: 'High-impact economic events from Investing.com',
      source: 'Data from Investing.com Economic Calendar',
      high: 'High Impact', medium: 'Medium Impact', low: 'Low Impact',
      all: 'All', allCurrencies: 'All Currencies',
      noEvents: 'No events available',
      refresh: 'Refresh', lastUpdated: 'Last updated',
      waktu: 'Time', mataUang: 'Currency',
      perkiraan: 'Forecast', sebelumnya: 'Previous', aktual: 'Actual',
      events: 'events', fetching: 'Fetching economic calendar...',
      highEvents: 'High-impact events this week',
    }
  }

  const t = labels[language]

  const impactConfig = {
    high: { bg: 'bg-red-500/10 border-red-500/30', badge: 'bg-red-500/20 text-red-400', dot: 'bg-red-500', label: t.high },
    medium: { bg: 'bg-amber-500/10 border-amber-500/30', badge: 'bg-amber-500/20 text-amber-400', dot: 'bg-amber-500', label: t.medium },
    low: { bg: 'bg-emerald-500/10 border-emerald-500/30', badge: 'bg-emerald-500/20 text-emerald-400', dot: 'bg-emerald-500', label: t.low },
  }

  const getCurrencyFlag = (c: string) => {
    const flags: Record<string, string> = { USD: '🇺🇸', EUR: '🇪🇺', GBP: '🇬🇧', JPY: '🇯🇵', AUD: '🇦🇺', NZD: '🇳🇿', CAD: '🇨🇦', CHF: '🇨🇭', CNY: '🇨🇳', IDR: '🇮🇩' }
    return flags[c] || '🌐'
  }

  return (
    <div className="space-y-6">
      {/* Source Badge */}
      <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-white/[0.02] border border-white/[0.05] w-fit">
        <div className="w-2 h-2 rounded-full bg-purple-500 animate-pulse" />
        <span className="text-xs text-gray-500">{t.source}</span>
      </div>

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h2 className="text-xl font-bold flex items-center gap-2">
            <CalendarDays className="w-5 h-5 text-purple-400" />
            {t.title}
          </h2>
          <p className="text-sm text-gray-500 mt-1">{t.subtitle}</p>
        </div>
        <div className="flex items-center gap-3">
          {lastFetched && (
            <span className="text-xs text-gray-600 hidden sm:inline">
              {t.lastUpdated}: {new Date(lastFetched).toLocaleTimeString(language === 'id' ? 'id-ID' : 'en-US', { hour: '2-digit', minute: '2-digit' })}
            </span>
          )}
          <Button variant="outline" size="sm" onClick={fetchCalendar} disabled={calLoading} className="border-purple-900/30 hover:bg-purple-500/10">
            <RefreshCw className={`w-4 h-4 mr-1.5 ${calLoading ? 'animate-spin' : ''}`} />
            {t.refresh}
          </Button>
        </div>
      </div>

      {/* Summary Badges */}
      {!calLoading && events.length > 0 && (
        <div className="flex flex-wrap gap-3">
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-red-500/10 border border-red-500/20">
            <div className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
            <span className="text-sm font-medium text-red-400">{highCount} {t.high}</span>
          </div>
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-amber-500/10 border border-amber-500/20">
            <div className="w-2 h-2 rounded-full bg-amber-500" />
            <span className="text-sm font-medium text-amber-400">{medCount} {t.medium}</span>
          </div>
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-white/[0.03] border border-white/[0.06]">
            <span className="text-sm font-medium text-gray-400">{events.length} {t.events}</span>
          </div>
        </div>
      )}

      {/* Filters Row */}
      <div className="flex flex-col sm:flex-row gap-3">
        {/* Impact Filter */}
        <div className="flex gap-2 flex-wrap">
          {(['all', 'high', 'medium', 'low'] as const).map(f => (
            <button
              key={f}
              onClick={() => setCalFilter(f)}
              className={`px-4 py-1.5 rounded-full text-sm font-medium transition-all ${
                calFilter === f
                  ? 'bg-purple-500/20 text-purple-300 border border-purple-500/40'
                  : 'bg-white/[0.03] text-gray-400 border border-white/[0.06] hover:bg-white/[0.06] hover:text-gray-300'
              }`}
            >
              {f === 'all' ? t.all : impactConfig[f].label}
            </button>
          ))}
        </div>

        {/* Currency Filter */}
        <div className="flex gap-1.5 flex-wrap">
          <button
            onClick={() => setCurrencyFilter('all')}
            className={`px-3 py-1.5 rounded-full text-xs font-medium transition-all ${
              currencyFilter === 'all'
                ? 'bg-white/[0.08] text-gray-200 border border-white/[0.15]'
                : 'bg-white/[0.02] text-gray-500 border border-white/[0.05] hover:bg-white/[0.05]'
            }`}
          >
            {t.allCurrencies}
          </button>
          {currencies.slice(0, 8).map(c => (
            <button
              key={c}
              onClick={() => setCurrencyFilter(c)}
              className={`px-3 py-1.5 rounded-full text-xs font-medium transition-all flex items-center gap-1 ${
                currencyFilter === c
                  ? 'bg-white/[0.08] text-gray-200 border border-white/[0.15]'
                  : 'bg-white/[0.02] text-gray-500 border border-white/[0.05] hover:bg-white/[0.05]'
              }`}
            >
              <span>{getCurrencyFlag(c)}</span>
              <span>{c}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Loading */}
      {calLoading && (
        <div className="flex flex-col items-center justify-center py-16 gap-3">
          <RefreshCw className="w-8 h-8 animate-spin text-purple-400" />
          <span className="text-sm text-gray-500">{t.fetching}</span>
        </div>
      )}

      {/* Empty */}
      {!calLoading && filtered.length === 0 && (
        <div className="text-center py-16">
          <CalendarDays className="w-12 h-12 text-gray-700 mx-auto mb-3" />
          <p className="text-gray-500">{t.noEvents}</p>
        </div>
      )}

      {/* Calendar Events grouped by day */}
      {!calLoading && sortedDays.length > 0 && (
        <div className="space-y-6">
          {sortedDays.map(day => (
            <div key={day}>
              {/* Day header */}
              <div className="flex items-center gap-2 mb-3">
                <div className={`w-2 h-2 rounded-full ${
                  day === dayOrder[new Date().getDay() === 0 ? 6 : new Date().getDay() - 1] ? 'bg-purple-500 animate-pulse' : 'bg-white/20'
                }`} />
                <h3 className="text-sm font-bold text-gray-300 uppercase tracking-wider">{day}</h3>
                <span className="text-xs text-gray-600">({eventsByDay[day].length} {t.events})</span>
              </div>

              {/* Events list - Desktop Table View */}
              <div className="hidden md:block">
                {/* Table Header */}
                <div className="grid grid-cols-[60px_40px_1fr_80px_80px_80px] gap-2 px-3 py-2 text-[10px] font-bold text-gray-600 uppercase tracking-wider border-b border-white/[0.06]">
                  <span>{t.waktu}</span>
                  <span></span>
                  <span>{t.mataUang} / Event</span>
                  <span className="text-right">{t.aktual}</span>
                  <span className="text-right">{t.perkiraan}</span>
                  <span className="text-right">{t.sebelumnya}</span>
                </div>

                {/* Table Rows */}
                <div className="grid gap-1 mt-1">
                  {eventsByDay[day].map((evt, idx) => {
                    const cfg = impactConfig[evt.impact]
                    return (
                      <motion.div
                        key={`${evt.event}-${idx}`}
                        initial={{ opacity: 0, x: -10 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ duration: 0.15, delay: idx * 0.02 }}
                        className={`grid grid-cols-[60px_40px_1fr_80px_80px_80px] gap-2 items-center px-3 py-2.5 rounded-lg border ${cfg.bg} hover:bg-white/[0.02] transition-all`}
                      >
                        {/* Time */}
                        <span className="text-xs font-mono text-gray-400">{evt.time || '--:--'}</span>
                        {/* Flag */}
                        <span className="text-base">{getCurrencyFlag(evt.currency)}</span>
                        {/* Event Name */}
                        <div className="min-w-0">
                          <div className="flex items-center gap-2">
                            <Badge variant="outline" className={`${cfg.badge} text-[9px] px-1.5 py-0 border-0 flex-shrink-0`}>{cfg.label}</Badge>
                            <span className="text-[11px] font-mono text-gray-500 flex-shrink-0">{evt.currency}</span>
                          </div>
                          <p className={`text-sm font-medium mt-0.5 truncate ${evt.impact === 'high' ? 'text-white' : 'text-gray-200'}`}>
                            {evt.event}
                          </p>
                        </div>
                        {/* Actual */}
                        <div className="text-right">
                          {evt.actual ? (
                            <span className="text-xs font-mono text-white font-medium">{evt.actual}</span>
                          ) : (
                            <span className="text-xs text-gray-600">—</span>
                          )}
                        </div>
                        {/* Forecast */}
                        <div className="text-right">
                          {evt.forecast ? (
                            <span className="text-xs font-mono text-amber-400/80">{evt.forecast}</span>
                          ) : (
                            <span className="text-xs text-gray-600">—</span>
                          )}
                        </div>
                        {/* Previous */}
                        <div className="text-right">
                          {evt.previous ? (
                            <span className="text-xs font-mono text-gray-400">{evt.previous}</span>
                          ) : (
                            <span className="text-xs text-gray-600">—</span>
                          )}
                        </div>
                      </motion.div>
                    )
                  })}
                </div>
              </div>

              {/* Events list - Mobile Card View */}
              <div className="md:hidden grid gap-2 ml-1 border-l border-white/[0.06] pl-4">
                {eventsByDay[day].map((evt, idx) => {
                  const cfg = impactConfig[evt.impact]
                  return (
                    <motion.div
                      key={`${evt.event}-m-${idx}`}
                      initial={{ opacity: 0, x: -10 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ duration: 0.15, delay: idx * 0.03 }}
                      className={`rounded-lg border p-3 ${cfg.bg} relative`}
                    >
                      <div className={`absolute -left-[21px] top-1/2 -translate-y-1/2 w-2.5 h-2.5 rounded-full border-2 border-[#0a0712] ${cfg.dot}`} />
                      <div className="flex items-center gap-3">
                        <div className="text-lg flex-shrink-0">{getCurrencyFlag(evt.currency)}</div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1">
                            <span className="text-xs font-mono text-gray-400">{evt.time || '--:--'}</span>
                            <Badge variant="outline" className={`${cfg.badge} text-[9px] px-1.5 py-0 border-0`}>{cfg.label}</Badge>
                          </div>
                          <p className={`text-sm font-medium truncate ${evt.impact === 'high' ? 'text-white' : 'text-gray-200'}`}>
                            {evt.event}
                          </p>
                          <div className="flex items-center gap-3 mt-1.5 text-[11px]">
                            {evt.actual && <span className="text-gray-500">{t.aktual}: <span className="text-white font-mono">{evt.actual}</span></span>}
                            {evt.forecast && <span className="text-gray-500">{t.perkiraan}: <span className="text-amber-400/80 font-mono">{evt.forecast}</span></span>}
                            {evt.previous && <span className="text-gray-500">{t.sebelumnya}: <span className="text-gray-400 font-mono">{evt.previous}</span></span>}
                          </div>
                        </div>
                      </div>
                    </motion.div>
                  )
                })}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

export default EconomicCalendarTab
