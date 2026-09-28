'use client'

import { useState, useEffect, useCallback, useMemo, useRef } from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Switch } from '@/components/ui/switch'
import { CalendarDays, RefreshCw, Crown, AlertTriangle, Bell, BellOff, Clock, Globe, Zap } from 'lucide-react'

// ─── Types ────────────────────────────────────────────────────────────────────
interface CalendarEvent {
  id: string
  date: string
  time: string
  dateTime: string
  currency: string
  impact: 'high' | 'medium' | 'low'
  event: string
  actual?: string
  forecast: string
  previous: string
  flag?: string
}

interface EconomicCalendarTabProps {
  language: 'id' | 'en'
  isPro?: boolean
  onUpgrade?: () => void
}

// ─── Timezone Detection ───────────────────────────────────────────────────────
function getUserTimezone(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone
  } catch {
    return 'UTC'
  }
}

function getUserUtcOffset(): string {
  try {
    const offset = new Date().getTimezoneOffset()
    const sign = offset <= 0 ? '+' : '-'
    const hours = Math.floor(Math.abs(offset) / 60)
    const minutes = Math.abs(offset) % 60
    return `UTC${sign}${hours}${minutes > 0 ? ':' + String(minutes).padStart(2, '0') : ''}`
  } catch {
    return 'UTC'
  }
}

/** Convert a UTC dateTime string to the user's local time string */
function toLocalTime(utcDateTime: string): string {
  try {
    const d = new Date(utcDateTime)
    if (isNaN(d.getTime())) return ''
    return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false })
  } catch {
    return ''
  }
}

/** Convert a UTC dateTime to local date string YYYY-MM-DD */
function toLocalDate(utcDateTime: string): string {
  try {
    const d = new Date(utcDateTime)
    if (isNaN(d.getTime())) return ''
    return d.toISOString().split('T')[0]
  } catch {
    return ''
  }
}

// ─── Countdown Hook ───────────────────────────────────────────────────────────
function useCountdown(targetDate: string): { text: string; diffMs: number } {
  const [result, setResult] = useState<{ text: string; diffMs: number }>({ text: '', diffMs: 0 })

  useEffect(() => {
    const target = new Date(targetDate).getTime()
    if (isNaN(target)) { setResult({ text: '', diffMs: 0 }); return }

    const update = () => {
      const now = Date.now()
      const diff = target - now

      if (diff <= 0) {
        setResult({ text: 'LIVE', diffMs: 0 })
        return
      }

      const hours = Math.floor(diff / 3600000)
      const minutes = Math.floor((diff % 3600000) / 60000)
      const seconds = Math.floor((diff % 60000) / 1000)

      let text = ''
      if (hours > 24) {
        const days = Math.floor(hours / 24)
        text = days + 'd ' + (hours % 24) + 'h'
      } else if (hours > 0) {
        text = hours + 'h ' + minutes + 'm'
      } else if (minutes > 0) {
        text = minutes + 'm ' + seconds + 's'
      } else {
        text = seconds + 's'
      }

      setResult({ text, diffMs: diff })
    }

    update()
    const interval = setInterval(update, 1000)
    return () => clearInterval(interval)
  }, [targetDate])

  return result
}

// ─── Countdown Display Component ──────────────────────────────────────────────
function EventCountdown({ dateTime, language }: { dateTime: string; language: 'id' | 'en' }) {
  const { text, diffMs } = useCountdown(dateTime)
  const isLive = text === 'LIVE'
  const isUrgent = diffMs > 0 && diffMs < 15 * 60 * 1000 && !isLive // Under 15 min
  const isClose = diffMs > 0 && diffMs < 60 * 60 * 1000 && !isLive // Under 1 hour

  return (
    <span className={`text-[10px] font-mono whitespace-nowrap ${
      isLive ? 'text-red-400 font-bold' : isUrgent ? 'text-amber-400 font-bold animate-pulse' : isClose ? 'text-amber-400/80' : 'text-gray-500'
    }`}>
      {isLive ? '🔴 LIVE' : text ? '⏱ ' + text : ''}
    </span>
  )
}

// ─── Push Notification Scheduler ─────────────────────────────────────────────
function scheduleBrowserNotification(title: string, body: string, dateTime: string) {
  try {
    if (!('Notification' in window) || Notification.permission !== 'granted') return
    const targetTime = new Date(dateTime).getTime()
    const now = Date.now()
    // Notify 15 minutes before
    const notifyAt = targetTime - 15 * 60 * 1000
    const delay = notifyAt - now
    if (delay <= 0 || delay > 24 * 60 * 60 * 1000) return // Skip if past or > 24h
    setTimeout(() => {
      try {
        new Notification(title, {
          body,
          icon: '/icon-192x192.png',
          badge: '/icon-72x72.png',
          tag: 'econ-cal-' + dateTime,
          requireInteraction: true,
        })
      } catch { /* Notification might fail in some contexts */ }
    }, delay)
  } catch { /* silent */ }
}

// ─── Main Component ───────────────────────────────────────────────────────────
function EconomicCalendarTab({ language, isPro, onUpgrade }: EconomicCalendarTabProps) {
  const [events, setEvents] = useState<CalendarEvent[]>([])
  const [calLoading, setCalLoading] = useState(true)
  const [calFilter, setCalFilter] = useState<'all' | 'high' | 'medium' | 'low'>('all')
  const [currencyFilter, setCurrencyFilter] = useState<string>('all')
  const [lastFetched, setLastFetched] = useState<string>('')
  const [source, setSource] = useState<string>('')
  const [unavailableMsg, setUnavailableMsg] = useState<string | null>(null)
  const [notifyEnabled, setNotifyEnabled] = useState(false)
  const [showLocalTime, setShowLocalTime] = useState(true)
  const [now, setNow] = useState<string>('')
  const [serverNow, setServerNow] = useState<string>('')
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const scheduledRef = useRef<Set<string>>(new Set())

  // Timezone
  const userTz = useMemo(() => getUserTimezone(), [])
  const userOffset = useMemo(() => getUserUtcOffset(), [])

  // Load preferences from localStorage
  useEffect(() => {
    setNotifyEnabled(localStorage.getItem('econ_cal_notify') === 'true')
    setShowLocalTime(localStorage.getItem('econ_cal_local_time') !== 'false')
  }, [])

  // Request notification permission when enabling
  useEffect(() => {
    if (notifyEnabled && 'Notification' in window && Notification.permission === 'default') {
      Notification.requestPermission().then(perm => {
        if (perm !== 'granted') {
          setNotifyEnabled(false)
          localStorage.setItem('econ_cal_notify', 'false')
        }
      })
    }
  }, [notifyEnabled])

  const fetchCalendar = useCallback(async () => {
    setCalLoading(true)
    setUnavailableMsg(null)
    try {
      const res = await fetch('/api/economic-calendar?tz=' + encodeURIComponent(userOffset))
      if (res.ok) {
        const data = await res.json()
        setEvents(data.events || [])
        setLastFetched(data.fetchedAt || '')
        setSource(data.source || '')
        setNow(data.now || '')
        setServerNow(data.now || '')
        if (data.unavailable) {
          setUnavailableMsg(data.message || 'Calendar data temporarily unavailable.')
        }
      }
    } catch { /* keep existing */ } finally { setCalLoading(false) }
  }, [userOffset])

  useEffect(() => {
    const delayTimeout = setTimeout(() => {
      fetchCalendar()
      intervalRef.current = setInterval(fetchCalendar, 30 * 60 * 1000)
    }, 3000) // Reduced from 5s for faster initial load
    return () => {
      clearTimeout(delayTimeout)
      if (intervalRef.current) clearInterval(intervalRef.current)
    }
  }, [fetchCalendar])

  // Schedule browser notifications for upcoming high-impact USD events
  useEffect(() => {
    if (!notifyEnabled) return
    events.forEach(evt => {
      if (evt.impact === 'high' && evt.currency === 'USD' && evt.dateTime && !scheduledRef.current.has(evt.id)) {
        scheduledRef.current.add(evt.id)
        scheduleBrowserNotification(
          `⚠️ High-Impact USD Event in 15 min`,
          `${evt.event} at ${evt.time} UTC — Get ready!`,
          evt.dateTime
        )
      }
    })
  }, [events, notifyEnabled])

  // Notification toggle
  const toggleNotify = useCallback(() => {
    const next = !notifyEnabled
    setNotifyEnabled(next)
    localStorage.setItem('econ_cal_notify', String(next))
  }, [notifyEnabled])

  // Local time toggle
  const toggleLocalTime = useCallback(() => {
    const next = !showLocalTime
    setShowLocalTime(next)
    localStorage.setItem('econ_cal_local_time', String(next))
  }, [showLocalTime])

  // Unique currencies
  const currencies = useMemo(() => {
    const unique = [...new Set(events.map(e => e.currency))]
    const priority: Record<string, number> = { USD: 0, EUR: 1, GBP: 2, JPY: 3, AUD: 4, CAD: 5, CHF: 6, NZD: 7, CNY: 8, IDR: 9 }
    return unique.sort((a, b) => (priority[a] ?? 99) - (priority[b] ?? 99))
  }, [events])

  // Filtering
  const filtered = useMemo(() => {
    let result = events
    if (calFilter !== 'all') result = result.filter(e => e.impact === calFilter)
    if (currencyFilter !== 'all') result = result.filter(e => e.currency === currencyFilter)
    return result
  }, [events, calFilter, currencyFilter])

  // Group by date — use local date when showLocalTime is on
  const eventsByDate = useMemo(() => {
    return filtered.reduce((acc, evt) => {
      const dayKey = showLocalTime && evt.dateTime
        ? toLocalDate(evt.dateTime) || evt.date
        : evt.date || 'Unknown'
      if (!acc[dayKey]) acc[dayKey] = []
      acc[dayKey].push(evt)
      return acc
    }, {} as Record<string, CalendarEvent[]>)
  }, [filtered, showLocalTime])

  const sortedDates = useMemo(() => Object.keys(eventsByDate).sort(), [eventsByDate])

  const highCount = events.filter(e => e.impact === 'high').length
  const medCount = events.filter(e => e.impact === 'medium').length
  const nextHighImpact = useMemo(() => {
    const nowMs = Date.now()
    return events
      .filter(e => e.impact === 'high' && new Date(e.dateTime).getTime() > nowMs)
      .sort((a, b) => new Date(a.dateTime).getTime() - new Date(b.dateTime).getTime())[0] || null
  }, [events])

  // ─── Paywall for free users ──────────────────────────────────────────────
  if (!isPro) {
    return (
      <div className="flex flex-col items-center justify-center py-20">
        <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-red-500 to-red-600 flex items-center justify-center mb-4">
          <CalendarDays className="w-8 h-8 text-white" />
        </div>
        <h3 className="text-xl font-bold text-white mb-2">{language === 'id' ? 'Fitur Premium' : 'Premium Feature'}</h3>
        <p className="text-lux-text-secondary dark:text-gray-400 text-center max-w-sm mb-6">
          {language === 'id' ? 'Kalender ekonomi hanya tersedia untuk pengguna PRO' : 'Economic calendar is only available for PRO users'}
        </p>
        <button onClick={onUpgrade} className="px-6 py-2.5 bg-gradient-to-r from-red-500 to-red-600 text-white rounded-lg font-medium hover:opacity-90 transition-opacity">
          {language === 'id' ? 'Upgrade ke PRO' : 'Upgrade to PRO'}
        </button>
      </div>
    )
  }

  const L = language === 'id'
  const t = {
    title: L ? 'Kalender Ekonomi' : 'Economic Calendar',
    subtitle: L ? 'Jadwal event ekonomi berdampak tinggi' : 'High-impact economic events schedule',
    high: L ? 'Dampak Tinggi' : 'High Impact',
    medium: L ? 'Dampak Sedang' : 'Medium Impact',
    low: L ? 'Dampak Rendah' : 'Low Impact',
    all: L ? 'Semua' : 'All',
    allCurrencies: L ? 'Semua Mata Uang' : 'All Currencies',
    noEvents: L ? 'Belum ada jadwal event' : 'No events available',
    refresh: L ? 'Refresh' : 'Refresh',
    lastUpdated: L ? 'Terakhir diperbarui' : 'Last updated',
    waktu: L ? 'Waktu' : 'Time',
    mataUang: L ? 'Mata Uang' : 'Currency',
    perkiraan: L ? 'Perkiraan' : 'Forecast',
    sebelumnya: L ? 'Sebelumnya' : 'Previous',
    aktual: L ? 'Aktual' : 'Actual',
    events: L ? 'event' : 'events',
    fetching: L ? 'Mengambil kalender ekonomi...' : 'Fetching economic calendar...',
    notifyOn: L ? 'Notifikasi Aktif' : 'Notifications On',
    notifyOff: L ? 'Notifikasi Mati' : 'Notifications Off',
    notifyHint: L ? 'Notifikasi 15 menit sebelum event USD berdampak tinggi' : 'Notified 15 min before high-impact USD events',
    countdown: L ? 'Hitung Mundur' : 'Countdown',
    localTime: L ? 'Waktu Lokal' : 'Local Time',
    utcTime: L ? 'Waktu UTC' : 'UTC Time',
    nextEvent: L ? 'Event Berikutnya' : 'Next Event',
    inLabel: L ? 'dalam' : 'in',
  }

  const impactConfig = {
    high: { bg: 'bg-red-500/10 border-red-500/30', badge: 'bg-red-500/20 text-red-400', dot: 'bg-red-500', label: t.high, glow: 'shadow-red-500/20' },
    medium: { bg: 'bg-amber-500/10 border-amber-500/30', badge: 'bg-amber-500/20 text-amber-400', dot: 'bg-amber-500', label: t.medium, glow: '' },
    low: { bg: 'bg-emerald-500/10 border-emerald-500/30', badge: 'bg-emerald-500/20 text-emerald-400', dot: 'bg-emerald-500', label: t.low, glow: '' },
  }

  const getCurrencyFlag = (c: string) => {
    const flags: Record<string, string> = { USD: '🇺🇸', EUR: '🇪🇺', GBP: '🇬🇧', JPY: '🇯🇵', AUD: '🇦🇺', NZD: '🇳🇿', CAD: '🇨🇦', CHF: '🇨🇭', CNY: '🇨🇳', IDR: '🇮🇩' }
    return flags[c] || '🌐'
  }

  const formatDate = (dateStr: string) => {
    try {
      const d = new Date(dateStr + 'T00:00:00Z')
      return d.toLocaleDateString(language === 'id' ? 'id-ID' : 'en-US', { weekday: 'short', month: 'short', day: 'numeric' })
    } catch { return dateStr }
  }

  const isToday = (dateStr: string) => {
    const todayStr = new Date().toISOString().split('T')[0]
    return dateStr === todayStr
  }

  /** Get display time for an event */
  const getDisplayTime = (evt: CalendarEvent) => {
    if (showLocalTime && evt.dateTime) {
      const local = toLocalTime(evt.dateTime)
      if (local) return local
    }
    return evt.time || '--:--'
  }

  const getTimeSuffix = () => {
    if (showLocalTime) return userOffset
    return 'UTC'
  }

  return (
    <div className="space-y-6">
      {/* Source & Notification Badge Row */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-white/[0.02] border border-white/[0.05]">
          <div className="w-2 h-2 rounded-full bg-blue-500 animate-pulse" />
          <span className="text-xs text-lux-text-muted dark:text-gray-500">
            {source ? (L ? 'Sumber: ' : 'Source: ') + source : (L ? 'Memuat...' : 'Loading...')}
          </span>
        </div>

        {/* Timezone display */}
        <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-white/[0.02] border border-white/[0.05]">
          <Globe className="w-3.5 h-3.5 text-gray-400" />
          <span className="text-xs text-lux-text-muted dark:text-gray-500">
            {showLocalTime ? userTz : 'UTC'}
          </span>
        </div>

        {/* Notification Toggle */}
        <button
          onClick={toggleNotify}
          className={`flex items-center gap-2 px-3 py-2 rounded-lg border transition-all ${
            notifyEnabled
              ? 'bg-blue-500/10 border-blue-500/30 text-blue-400'
              : 'bg-white/[0.02] border-white/[0.05] text-gray-500'
          }`}
        >
          {notifyEnabled ? <Bell className="w-3.5 h-3.5" /> : <BellOff className="w-3.5 h-3.5" />}
          <span className="text-xs font-medium">{notifyEnabled ? t.notifyOn : t.notifyOff}</span>
        </button>
        {notifyEnabled && (
          <span className="text-[10px] text-blue-400/70">{t.notifyHint}</span>
        )}

        {/* Local/UTC Time Toggle */}
        <div className="flex items-center gap-2 px-3 py-2 rounded-lg border bg-white/[0.02] border-white/[0.05]">
          <Clock className="w-3.5 h-3.5 text-gray-400" />
          <span className="text-xs text-gray-400">{showLocalTime ? t.localTime : t.utcTime}</span>
          <Switch
            checked={showLocalTime}
            onCheckedChange={toggleLocalTime}
            className="scale-75 data-[state=checked]:bg-blue-500"
          />
        </div>
      </div>

      {/* Next High-Impact Event Banner */}
      {nextHighImpact && (
        <div className="flex items-center gap-3 px-4 py-3 rounded-xl bg-gradient-to-r from-red-500/10 via-red-500/5 to-transparent border border-red-500/20">
          <Zap className="w-5 h-5 text-red-400 flex-shrink-0" />
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold text-red-400 uppercase">{t.nextEvent}</span>
              <span className="text-sm">{getCurrencyFlag(nextHighImpact.currency)}</span>
            </div>
            <p className="text-sm font-medium text-white truncate">{nextHighImpact.event}</p>
          </div>
          <div className="flex-shrink-0">
            <EventCountdown dateTime={nextHighImpact.dateTime} language={language} />
          </div>
        </div>
      )}

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h2 className="text-xl font-bold flex items-center gap-2">
            <CalendarDays className="w-5 h-5 text-red-400" />
            {t.title}
          </h2>
          <p className="text-sm text-lux-text-muted dark:text-gray-500 mt-1">{t.subtitle}</p>
        </div>
        <div className="flex items-center gap-3">
          {lastFetched && (
            <span className="text-xs text-gray-600 hidden sm:inline">
              {t.lastUpdated}: {new Date(lastFetched).toLocaleTimeString(language === 'id' ? 'id-ID' : 'en-US', { hour: '2-digit', minute: '2-digit' })}
            </span>
          )}
          <Button variant="outline" size="sm" onClick={fetchCalendar} disabled={calLoading} className="border-lux-border dark:border-blue-900/30 hover:bg-blue-500/10">
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
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-lux-surface-hover dark:bg-white/[0.03] border border-lux-border dark:border-white/[0.06]">
            <span className="text-sm font-medium text-lux-text-secondary dark:text-gray-400">{events.length} {t.events}</span>
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
                  ? f === 'high'
                    ? 'bg-red-500/20 text-red-300 border border-red-500/40'
                    : 'bg-blue-500/20 text-blue-300 border border-blue-500/40'
                  : 'bg-lux-surface-hover dark:bg-white/[0.03] text-lux-text-secondary dark:text-gray-400 border border-lux-border dark:border-white/[0.06] hover:bg-lux-surface-hover dark:bg-white/[0.06] hover:text-lux-text-primary dark:text-gray-300'
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
                ? 'bg-lux-surface-hover dark:bg-white/[0.08] text-lux-text-primary dark:text-gray-200 border border-lux-border dark:border-white/[0.15]'
                : 'bg-white/[0.02] text-lux-text-muted dark:text-gray-500 border border-white/[0.05] hover:bg-white/[0.05]'
            }`}
          >
            {t.allCurrencies}
          </button>
          {currencies.slice(0, 10).map(c => (
            <button
              key={c}
              onClick={() => setCurrencyFilter(c)}
              className={`px-3 py-1.5 rounded-full text-xs font-medium transition-all flex items-center gap-1 ${
                currencyFilter === c
                  ? 'bg-lux-surface-hover dark:bg-white/[0.08] text-lux-text-primary dark:text-gray-200 border border-lux-border dark:border-white/[0.15]'
                  : 'bg-white/[0.02] text-lux-text-muted dark:text-gray-500 border border-white/[0.05] hover:bg-white/[0.05]'
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
          <RefreshCw className="w-8 h-8 animate-spin text-blue-400" />
          <span className="text-sm text-lux-text-muted dark:text-gray-500">{t.fetching}</span>
        </div>
      )}

      {/* Empty / Unavailable */}
      {!calLoading && filtered.length === 0 && (
        <div className="text-center py-16">
          <CalendarDays className="w-12 h-12 text-gray-700 mx-auto mb-3" />
          {unavailableMsg ? (
            <>
              <AlertTriangle className="w-8 h-8 text-amber-500 mx-auto mb-2" />
              <p className="text-lux-text-secondary dark:text-gray-400">{unavailableMsg}</p>
            </>
          ) : (
            <p className="text-lux-text-muted dark:text-gray-500">{t.noEvents}</p>
          )}
        </div>
      )}

      {/* Calendar Events grouped by date */}
      {!calLoading && sortedDates.length > 0 && (
        <div className="space-y-6">
          {sortedDates.map(dateKey => (
            <div key={dateKey}>
              {/* Date header */}
              <div className="flex items-center gap-2 mb-3">
                <div className={`w-2 h-2 rounded-full ${isToday(dateKey) ? 'bg-red-500 animate-pulse' : 'bg-white/20'}`} />
                <h3 className="text-sm font-bold text-lux-text-primary dark:text-gray-300 uppercase tracking-wider">
                  {formatDate(dateKey)}{isToday(dateKey) ? ` (${L ? 'Hari Ini' : 'Today'})` : ''}
                </h3>
                <span className="text-xs text-gray-600">({eventsByDate[dateKey].length} {t.events})</span>
              </div>

              {/* Desktop Table View */}
              <div className="hidden md:block">
                {/* Table Header */}
                <div className="grid grid-cols-[70px_36px_1fr_70px_70px_70px_70px] gap-2 px-3 py-2 text-[10px] font-bold text-gray-600 uppercase tracking-wider border-b border-white/[0.06]">
                  <span>{t.waktu} ({getTimeSuffix()})</span>
                  <span></span>
                  <span>{t.mataUang} / Event</span>
                  <span className="text-right">{t.aktual}</span>
                  <span className="text-right">{t.perkiraan}</span>
                  <span className="text-right">{t.sebelumnya}</span>
                  <span className="text-right">{t.countdown}</span>
                </div>

                {/* Table Rows */}
                <div className="grid gap-1 mt-1">
                  {eventsByDate[dateKey].map((evt, idx) => {
                    const cfg = impactConfig[evt.impact]
                    const isNextHighImpact = evt.impact === 'high' && evt.currency === 'USD'
                    return (
                      <div
                        key={evt.id || idx}
                        className={`grid grid-cols-[70px_36px_1fr_70px_70px_70px_70px] gap-2 items-center px-3 py-2.5 rounded-lg border ${cfg.bg} ${isNextHighImpact ? 'ring-1 ring-red-500/20 ' + cfg.glow : ''} hover:bg-white/[0.02] transition-colors`}
                      >
                        {/* Time */}
                        <span className="text-xs font-mono text-lux-text-secondary dark:text-gray-400">{getDisplayTime(evt)}</span>
                        {/* Flag */}
                        <span className="text-base">{getCurrencyFlag(evt.currency)}</span>
                        {/* Event Name */}
                        <div className="min-w-0">
                          <div className="flex items-center gap-2">
                            <Badge variant="outline" className={`${cfg.badge} text-[9px] px-1.5 py-0 border-0 flex-shrink-0`}>{cfg.label}</Badge>
                            <span className="text-[11px] font-mono text-lux-text-muted dark:text-gray-500 flex-shrink-0">{evt.currency}</span>
                            {isNextHighImpact && notifyEnabled && <Bell className="w-3 h-3 text-blue-400 flex-shrink-0" />}
                          </div>
                          <p className={`text-sm font-medium mt-0.5 truncate ${evt.impact === 'high' ? 'text-white' : 'text-lux-text-primary dark:text-gray-200'}`}>
                            {evt.event}
                          </p>
                        </div>
                        {/* Actual */}
                        <div className="text-right">
                          {evt.actual ? <span className="text-xs font-mono text-white font-medium">{evt.actual}</span> : <span className="text-xs text-gray-600">&mdash;</span>}
                        </div>
                        {/* Forecast */}
                        <div className="text-right">
                          {evt.forecast ? <span className="text-xs font-mono text-amber-400/80">{evt.forecast}</span> : <span className="text-xs text-gray-600">&mdash;</span>}
                        </div>
                        {/* Previous */}
                        <div className="text-right">
                          {evt.previous ? <span className="text-xs font-mono text-lux-text-secondary dark:text-gray-400">{evt.previous}</span> : <span className="text-xs text-gray-600">&mdash;</span>}
                        </div>
                        {/* Countdown */}
                        <div className="text-right">
                          <EventCountdown dateTime={evt.dateTime} language={language} />
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>

              {/* Mobile Card View */}
              <div className="md:hidden grid gap-2 ml-1 border-l border-white/[0.06] pl-4">
                {eventsByDate[dateKey].map((evt, idx) => {
                  const cfg = impactConfig[evt.impact]
                  const isNextHighImpact = evt.impact === 'high' && evt.currency === 'USD'
                  return (
                    <div
                      key={evt.id || 'm-' + idx}
                      className={`rounded-lg border p-3 ${cfg.bg} ${isNextHighImpact ? 'ring-1 ring-red-500/20' : ''} relative`}
                    >
                      <div className={`absolute -left-[21px] top-1/2 -translate-y-1/2 w-2.5 h-2.5 rounded-full border-2 border-[#060810] ${cfg.dot}`} />
                      <div className="flex items-center gap-3">
                        <div className="text-lg flex-shrink-0">{getCurrencyFlag(evt.currency)}</div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1">
                            <span className="text-xs font-mono text-lux-text-secondary dark:text-gray-400">{getDisplayTime(evt)}</span>
                            <Badge variant="outline" className={`${cfg.badge} text-[9px] px-1.5 py-0 border-0`}>{cfg.label}</Badge>
                            {isNextHighImpact && notifyEnabled && <Bell className="w-3 h-3 text-blue-400" />}
                          </div>
                          <p className={`text-sm font-medium truncate ${evt.impact === 'high' ? 'text-white' : 'text-lux-text-primary dark:text-gray-200'}`}>
                            {evt.event}
                          </p>
                          <div className="flex items-center gap-3 mt-1.5 text-[11px]">
                            {evt.actual && <span className="text-lux-text-muted dark:text-gray-500">{t.aktual}: <span className="text-white font-mono">{evt.actual}</span></span>}
                            {evt.forecast && <span className="text-lux-text-muted dark:text-gray-500">{t.perkiraan}: <span className="text-amber-400/80 font-mono">{evt.forecast}</span></span>}
                            {evt.previous && <span className="text-lux-text-muted dark:text-gray-500">{t.sebelumnya}: <span className="text-lux-text-secondary dark:text-gray-400 font-mono">{evt.previous}</span></span>}
                          </div>
                          {/* Countdown on mobile */}
                          <div className="mt-1.5">
                            <EventCountdown dateTime={evt.dateTime} language={language} />
                          </div>
                        </div>
                      </div>
                    </div>
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
