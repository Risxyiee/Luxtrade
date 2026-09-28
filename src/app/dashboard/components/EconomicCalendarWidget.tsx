'use client'

import { useState, useEffect, useCallback, useMemo, useRef } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { CalendarDays, RefreshCw, AlertTriangle, Zap } from 'lucide-react'

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
}

interface EconomicCalendarWidgetProps {
  language: 'id' | 'en'
  onViewAll?: () => void
}

// ─── Timezone Helpers ─────────────────────────────────────────────────────────
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

function toLocalTime(utcDateTime: string): string {
  try {
    const d = new Date(utcDateTime)
    if (isNaN(d.getTime())) return ''
    return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false })
  } catch {
    return ''
  }
}

// ─── Countdown Hook ───────────────────────────────────────────────────────────
function useCountdown(targetDate: string): string {
  const [countdown, setCountdown] = useState('')

  useEffect(() => {
    const target = new Date(targetDate).getTime()
    if (isNaN(target)) { setCountdown(''); return }

    const update = () => {
      const diff = target - Date.now()
      if (diff <= 0) { setCountdown('LIVE'); return }
      const hours = Math.floor(diff / 3600000)
      const minutes = Math.floor((diff % 3600000) / 60000)
      if (hours > 24) { setCountdown(Math.floor(hours / 24) + 'd') }
      else if (hours > 0) { setCountdown(hours + 'h ' + minutes + 'm') }
      else if (minutes > 0) { setCountdown(minutes + 'm') }
      else { setCountdown(Math.floor(diff / 1000) + 's') }
    }

    update()
    const interval = setInterval(update, 1000)
    return () => clearInterval(interval)
  }, [targetDate])

  return countdown
}

function MiniCountdown({ dateTime }: { dateTime: string }) {
  const countdown = useCountdown(dateTime)
  const isLive = countdown === 'LIVE'
  const isUrgent = !countdown.includes('h') && !countdown.includes('d') && countdown.includes('m') && !isLive

  return (
    <span className={`text-[10px] font-mono ${isLive ? 'text-red-400 font-bold' : isUrgent ? 'text-amber-400 animate-pulse' : 'text-gray-500'}`}>
      {isLive ? '🔴 LIVE' : countdown ? '⏱ ' + countdown : ''}
    </span>
  )
}

// ─── Widget Component ─────────────────────────────────────────────────────────
export default function EconomicCalendarWidget({ language, onViewAll }: EconomicCalendarWidgetProps) {
  const [events, setEvents] = useState<CalendarEvent[]>([])
  const [loading, setLoading] = useState(true)
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const userOffset = useMemo(() => getUserUtcOffset(), [])

  const L = language === 'id'

  const fetchCalendar = useCallback(async () => {
    try {
      const res = await fetch('/api/economic-calendar?impact=high&currency=USD&tz=' + encodeURIComponent(userOffset))
      if (res.ok) {
        const data = await res.json()
        setEvents((data.events || []).slice(0, 5))
      }
    } catch { /* silent */ } finally { setLoading(false) }
  }, [userOffset])

  useEffect(() => {
    // Fetch immediately — no artificial delay for widget data
    fetchCalendar()
    intervalRef.current = setInterval(fetchCalendar, 30 * 60 * 1000)
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current)
    }
  }, [fetchCalendar])

  const getCurrencyFlag = (c: string) => {
    const flags: Record<string, string> = { USD: '🇺🇸', EUR: '🇪🇺', GBP: '🇬🇧', JPY: '🇯🇵', AUD: '🇦🇺', CAD: '🇨🇦', CHF: '🇨🇭', IDR: '🇮🇩' }
    return flags[c] || '🌐'
  }

  // Find next upcoming event
  const nextEvent = useMemo(() => {
    const nowMs = Date.now()
    return events
      .filter(e => new Date(e.dateTime).getTime() > nowMs)
      .sort((a, b) => new Date(a.dateTime).getTime() - new Date(b.dateTime).getTime())[0] || null
  }, [events])

  return (
    <Card className="bg-lux-bg-card dark:bg-[#0a0c12] border-lux-border dark:border-blue-900/30">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm font-bold flex items-center gap-2">
            <CalendarDays className="w-4 h-4 text-red-400" />
            {L ? 'Event Berdampak Tinggi' : 'High-Impact Events'}
          </CardTitle>
          <div className="flex items-center gap-1">
            <Badge className="bg-red-500/20 text-red-400 text-[9px] border-0">HIGH</Badge>
            {onViewAll && (
              <button
                onClick={onViewAll}
                className="text-[10px] text-blue-400 hover:text-blue-300 ml-2 transition-colors"
              >
                {L ? 'Lihat Semua →' : 'View All →'}
              </button>
            )}
          </div>
        </div>
      </CardHeader>
      <CardContent className="pt-0">
        {loading ? (
          <div className="flex items-center justify-center py-6">
            <RefreshCw className="w-5 h-5 animate-spin text-blue-400" />
          </div>
        ) : events.length === 0 ? (
          <div className="text-center py-4">
            <AlertTriangle className="w-5 h-5 text-gray-600 mx-auto mb-2" />
            <p className="text-xs text-gray-500">{L ? 'Data tidak tersedia' : 'Data unavailable'}</p>
          </div>
        ) : (
          <div className="space-y-2">
            {/* Next Event Highlight */}
            {nextEvent && (
              <div className="flex items-center gap-2 p-2 rounded-lg bg-red-500/10 border border-red-500/20 mb-2">
                <Zap className="w-3.5 h-3.5 text-red-400 flex-shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-[10px] text-red-400 font-bold uppercase">{L ? 'Segera!' : 'Up Next!'}</p>
                  <p className="text-xs font-medium text-white truncate">{nextEvent.event}</p>
                </div>
                <MiniCountdown dateTime={nextEvent.dateTime} />
              </div>
            )}
            {events.filter(e => e.id !== nextEvent?.id).map((evt, idx) => (
              <div
                key={evt.id || idx}
                className="flex items-center gap-2 p-2 rounded-lg bg-red-500/5 border border-red-500/10 hover:bg-red-500/10 transition-colors"
              >
                <span className="text-sm flex-shrink-0">{getCurrencyFlag(evt.currency)}</span>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-medium text-white truncate">{evt.event}</p>
                  <div className="flex items-center gap-2 mt-0.5">
                    <span className="text-[10px] font-mono text-gray-500">
                      {toLocalTime(evt.dateTime) || evt.time} {userOffset}
                    </span>
                    {evt.forecast && (
                      <span className="text-[10px] text-amber-400/70">F: {evt.forecast}</span>
                    )}
                  </div>
                </div>
                <div className="flex-shrink-0">
                  <MiniCountdown dateTime={evt.dateTime} />
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  )
}
