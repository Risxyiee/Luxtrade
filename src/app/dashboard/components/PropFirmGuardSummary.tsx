'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Shield, AlertTriangle, ChevronRight, Loader2, Clock, XCircle } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import { authFetch } from '@/lib/api-fetch'

// ─── Challenge type (mirrors PropFirmGuardTab) ─────────────────────
interface Challenge {
  id: string
  firmName: string
  challengePhase: string
  accountSize: number
  maxDailyLoss: number
  maxTotalDD: number
  profitTarget: number
  currentBalance: number
  dailyPL: number
  totalPL: number
  currentDailyDD: number
  currentTotalDD: number
  currentProgress: number
  alertAtPercent: number
  isBreached: boolean
  breachReason: string | null
  breachedAt: string | null
  isActive: boolean
  tradingAccountId: string | null
  consistencyRule: number
  bestDayPL: number
  createdAt: string
  updatedAt: string
}

interface PropFirmGuardSummaryProps {
  language: 'id' | 'en'
  onOpenGuard?: () => void
}

// ─── Alert severity type ───────────────────────────────────────────
type AlertSeverity = 'breach' | 'urgent' | 'warning'

interface ChallengeAlert {
  challengeId: string
  firmName: string
  severity: AlertSeverity
  ddType: 'daily' | 'total'
  currentDD: number
  ddLimit: number
  percentOfLimit: number
  isBreached: boolean
  breachReason: string | null
}

// ─── Compute % of DD limit for a challenge ────────────────────────
function computeChallengeAlerts(c: Challenge): ChallengeAlert[] {
  const alerts: ChallengeAlert[] = []

  // Breached challenges always produce a breach alert
  if (c.isBreached) {
    const dailyDDLimitPct = c.accountSize > 0 ? (c.maxDailyLoss / c.accountSize) * 100 : 0
    const dailyPctOfLimit = dailyDDLimitPct > 0 ? (c.currentDailyDD / dailyDDLimitPct) * 100 : 0
    alerts.push({
      challengeId: c.id,
      firmName: c.firmName,
      severity: 'breach',
      ddType: 'daily',
      currentDD: c.currentDailyDD,
      ddLimit: dailyDDLimitPct,
      percentOfLimit: dailyPctOfLimit,
      isBreached: true,
      breachReason: c.breachReason,
    })
    return alerts
  }

  // Daily DD check
  const dailyDDLimitPct = c.accountSize > 0 ? (c.maxDailyLoss / c.accountSize) * 100 : 0
  const dailyPctOfLimit = dailyDDLimitPct > 0 ? (c.currentDailyDD / dailyDDLimitPct) * 100 : 0
  if (dailyPctOfLimit >= c.alertAtPercent) {
    let severity: AlertSeverity = 'warning'
    if (dailyPctOfLimit >= 100) severity = 'breach'
    else if (dailyPctOfLimit >= 80) severity = 'urgent'
    alerts.push({
      challengeId: c.id,
      firmName: c.firmName,
      severity,
      ddType: 'daily',
      currentDD: c.currentDailyDD,
      ddLimit: dailyDDLimitPct,
      percentOfLimit: dailyPctOfLimit,
      isBreached: false,
      breachReason: null,
    })
  }

  // Total DD check
  const totalDDLimitPct = c.accountSize > 0 ? (c.maxTotalDD / c.accountSize) * 100 : 0
  const totalPctOfLimit = totalDDLimitPct > 0 ? (c.currentTotalDD / totalDDLimitPct) * 100 : 0
  if (totalPctOfLimit >= c.alertAtPercent) {
    let severity: AlertSeverity = 'warning'
    if (totalPctOfLimit >= 100) severity = 'breach'
    else if (totalPctOfLimit >= 80) severity = 'urgent'
    alerts.push({
      challengeId: c.id,
      firmName: c.firmName,
      severity,
      ddType: 'total',
      currentDD: c.currentTotalDD,
      ddLimit: totalDDLimitPct,
      percentOfLimit: totalPctOfLimit,
      isBreached: false,
      breachReason: null,
    })
  }

  return alerts
}

// ─── Pick the most urgent alert (breach > urgent > warning) ───────
const SEVERITY_ORDER: Record<AlertSeverity, number> = { breach: 3, urgent: 2, warning: 1 }

function pickMostUrgent(alerts: ChallengeAlert[]): ChallengeAlert | null {
  if (alerts.length === 0) return null
  return alerts.reduce((worst, cur) =>
    SEVERITY_ORDER[cur.severity] > SEVERITY_ORDER[worst.severity] ? cur : worst
  , alerts[0])
}

// ─── Relative time formatter ───────────────────────────────────────
function formatRelativeTime(isoString: string, language: 'id' | 'en'): string {
  const now = Date.now()
  const then = new Date(isoString).getTime()
  const diffSec = Math.floor((now - then) / 1000)

  if (diffSec < 60) return language === 'id' ? 'Baru saja' : 'Just now'
  if (diffSec < 3600) {
    const mins = Math.floor(diffSec / 60)
    return language === 'id' ? `${mins} mnt lalu` : `${mins}m ago`
  }
  if (diffSec < 86400) {
    const hrs = Math.floor(diffSec / 3600)
    return language === 'id' ? `${hrs} jam lalu` : `${hrs}h ago`
  }
  const days = Math.floor(diffSec / 86400)
  return language === 'id' ? `${days} hr lalu` : `${days}d ago`
}

export default function PropFirmGuardSummary({ language, onOpenGuard }: PropFirmGuardSummaryProps) {
  const [challenges, setChallenges] = useState<Challenge[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)
  const [fetchedAt, setFetchedAt] = useState<Date | null>(null)

  useEffect(() => {
    let cancelled = false
    async function fetchChallenges() {
      try {
        const res = await authFetch('/api/prop-firm-guard')
        if (!res.ok) throw new Error('Failed to fetch')
        const data = await res.json()
        if (!cancelled) {
          setChallenges(data.challenges || [])
          setFetchedAt(new Date())
          setError(false)
        }
      } catch {
        if (!cancelled) setError(true)
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    fetchChallenges()

    // Listen for data changes from PropFirmGuardTab (cross-component reactivity)
    const handleDataChanged = () => { fetchChallenges() }
    window.addEventListener('propfirm-data-changed', handleDataChanged)
    return () => {
      cancelled = true
      window.removeEventListener('propfirm-data-changed', handleDataChanged)
    }
  }, [])

  // ─── Derived metrics ────────────────────────────────────────────
  const activeChallenges = challenges.filter(c => c.isActive && !c.isBreached)
  const breachedChallenges = challenges.filter(c => c.isBreached)
  const activeCount = activeChallenges.length
  const breachedCount = breachedChallenges.length

  // Compute % of limit for each challenge (matching PropFirmGuardTab logic)
  const allAlerts = challenges.flatMap(computeChallengeAlerts)
  const topAlert = pickMostUrgent(allAlerts)

  // Highest DD as % of limit (for display)
  const highestDailyDDPctOfLimit = challenges.length > 0
    ? Math.max(...challenges.map(c => {
        const limitPct = c.accountSize > 0 ? (c.maxDailyLoss / c.accountSize) * 100 : 0
        return limitPct > 0 ? (c.currentDailyDD / limitPct) * 100 : 0
      }))
    : 0
  const highestTotalDDPctOfLimit = challenges.length > 0
    ? Math.max(...challenges.map(c => {
        const limitPct = c.accountSize > 0 ? (c.maxTotalDD / c.accountSize) * 100 : 0
        return limitPct > 0 ? (c.currentTotalDD / limitPct) * 100 : 0
      }))
    : 0
  const highestDDPctOfLimit = Math.max(highestDailyDDPctOfLimit, highestTotalDDPctOfLimit)

  // Highest raw DD % of account size (for label)
  const highestDailyDD = challenges.length > 0
    ? Math.max(...challenges.map(c => c.currentDailyDD))
    : 0
  const highestTotalDD = challenges.length > 0
    ? Math.max(...challenges.map(c => c.currentTotalDD))
    : 0
  const highestDD = Math.max(highestDailyDD, highestTotalDD)

  // Best profit progress across active challenges
  const bestProgress = activeChallenges.length > 0
    ? Math.max(...activeChallenges.map(c => c.currentProgress))
    : 0

  // Total P/L across all challenges (for dashboard stats)
  const totalChallengePL = challenges.reduce((sum, c) => sum + (c.totalPL || 0), 0)

  // Total account size across all active challenges
  const totalAccountSize = activeChallenges.reduce((sum, c) => sum + c.accountSize, 0)

  // Last checked timestamp (most recent updatedAt)
  const lastChecked = challenges.length > 0
    ? challenges.reduce((latest, c) => {
        const t = new Date(c.updatedAt).getTime()
        return t > latest ? t : latest
      }, 0)
    : null

  // Determine alert level: green / amber / red
  let ddLevel: 'green' | 'amber' | 'red' = 'green'
  if (breachedCount > 0 || highestDDPctOfLimit >= 90) {
    ddLevel = 'red'
  } else if (highestDDPctOfLimit >= 70) {
    ddLevel = 'amber'
  }

  const levelStyles = {
    green: {
      indicator: 'bg-emerald-400',
      ring: 'ring-emerald-400/30',
      badgeClass: 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30',
      cardBorder: 'dark:border-emerald-500/20',
      glowFrom: 'from-emerald-500/10',
      glowTo: 'to-emerald-600/5',
    },
    amber: {
      indicator: 'bg-amber-400',
      ring: 'ring-amber-400/30',
      badgeClass: 'bg-amber-500/15 text-amber-300 border-amber-500/30',
      cardBorder: 'dark:border-amber-500/20',
      glowFrom: 'from-amber-500/10',
      glowTo: 'to-amber-600/5',
    },
    red: {
      indicator: 'bg-red-400',
      ring: 'ring-red-400/30',
      badgeClass: 'bg-red-500/15 text-red-300 border-red-500/30',
      cardBorder: 'dark:border-red-500/30',
      glowFrom: 'from-red-500/10',
      glowTo: 'to-red-600/5',
    },
  }

  const styles = levelStyles[ddLevel]

  // ─── Alert banner config ────────────────────────────────────────
  const alertConfig = topAlert ? {
    breach: {
      bg: 'bg-red-500/15 dark:bg-red-500/20',
      border: 'border-red-500/40',
      icon: <XCircle className="w-4 h-4 text-red-400 flex-shrink-0" />,
      text: 'text-red-300',
      pulseClass: 'animate-pulse',
    },
    urgent: {
      bg: 'bg-orange-500/15 dark:bg-orange-500/20',
      border: 'border-orange-500/40',
      icon: <AlertTriangle className="w-4 h-4 text-orange-400 flex-shrink-0" />,
      text: 'text-orange-300',
      pulseClass: '',
    },
    warning: {
      bg: 'bg-amber-500/15 dark:bg-amber-500/20',
      border: 'border-amber-500/40',
      icon: <AlertTriangle className="w-4 h-4 text-amber-400 flex-shrink-0" />,
      text: 'text-amber-300',
      pulseClass: '',
    },
  }[topAlert.severity] : null

  // ─── Loading state ──────────────────────────────────────────────
  if (loading) {
    return (
      <Card className="bg-lux-bg-card dark:bg-gradient-to-br dark:from-[#060810] dark:to-[#060810] border-lux-border dark:border-blue-900/30 overflow-hidden">
        <CardContent className="p-4 flex items-center justify-center gap-2">
          <Loader2 className="w-4 h-4 text-blue-400 animate-spin" />
          <span className="text-xs text-lux-text-secondary dark:text-gray-500">
            {language === 'id' ? 'Memuat PropFirm...' : 'Loading PropFirm...'}
          </span>
        </CardContent>
      </Card>
    )
  }

  // ─── Error / no-challenges state ────────────────────────────────
  if (challenges.length === 0 || error) {
    return (
      <Card className="bg-lux-bg-card dark:bg-gradient-to-br dark:from-[#060810] dark:to-[#060810] border-lux-border dark:border-blue-900/30 overflow-hidden group hover:border-blue-500/40 transition-all duration-300">
        <CardContent className="p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-blue-500/10">
              <Shield className="w-4 h-4 text-blue-400" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-lux-text-secondary dark:text-gray-300">
                {language === 'id' ? 'PropFirm Guard' : 'PropFirm Guard'}
              </p>
              <p className="text-xs text-lux-text-muted dark:text-gray-500 mt-0.5">
                {language === 'id'
                  ? 'Atur challenge prop firm kamu'
                  : 'Set up your prop firm challenges'}
              </p>
            </div>
            {onOpenGuard && (
              <Button
                variant="ghost"
                size="sm"
                onClick={onOpenGuard}
                className="text-blue-400 hover:text-blue-300 hover:bg-blue-500/10 text-xs gap-1"
              >
                {language === 'id' ? 'Atur' : 'Set Up'}
                <ChevronRight className="w-3 h-3" />
              </Button>
            )}
          </div>
        </CardContent>
      </Card>
    )
  }

  // ─── Main summary card ──────────────────────────────────────────
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay: 0.05 }}
    >
      <Card className={`bg-lux-bg-card dark:bg-gradient-to-br dark:${styles.glowFrom} dark:${styles.glowTo} border-lux-border ${styles.cardBorder} overflow-hidden group hover:border-blue-500/40 transition-all duration-300 relative`}>
        {/* Decorative glow */}
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          <div className={`absolute -top-8 -right-8 w-24 h-24 ${ddLevel === 'red' ? 'bg-red-500/10' : ddLevel === 'amber' ? 'bg-amber-500/10' : 'bg-emerald-500/10'} rounded-full blur-3xl`} />
        </div>

        <CardContent className="relative p-4 space-y-3">
          {/* ── Row 1: Icon + Title + Stats ── */}
          <div className="flex items-center gap-3">
            {/* Icon + indicator */}
            <div className="relative flex-shrink-0">
              <div className="p-2 rounded-lg bg-blue-500/10">
                <Shield className="w-4 h-4 text-blue-400" />
              </div>
              {/* Colored status dot */}
              <div className={`absolute -top-1 -right-1 w-2.5 h-2.5 rounded-full ${styles.indicator} ring-2 ${styles.ring}`} />
            </div>

            {/* Text content */}
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-0.5">
                <p className="text-sm font-semibold text-lux-text-secondary dark:text-gray-200">
                  {language === 'id' ? 'PropFirm Guard' : 'PropFirm Guard'}
                </p>
                {/* Breach warning badge */}
                {breachedCount > 0 && (
                  <Badge variant="destructive" className="text-[10px] px-1.5 py-0 h-4 gap-0.5">
                    <AlertTriangle className="w-2.5 h-2.5" />
                    {breachedCount} {language === 'id' ? 'breach' : 'breach'}
                  </Badge>
                )}
              </div>

              {/* Compact stats row */}
              <div className="flex items-center gap-2 text-xs flex-wrap">
                <span className="text-lux-text-muted dark:text-gray-400">
                  {activeCount} {language === 'id' ? 'aktif' : 'active'}
                </span>
                <span className="text-lux-text-muted dark:text-gray-600">•</span>
                {/* ── Prominent DD% Badge ── */}
                <Badge
                  variant="outline"
                  className={`text-[11px] px-2 py-0 h-5 font-semibold ${
                    ddLevel === 'red'
                      ? 'bg-red-500/15 text-red-300 border-red-500/30'
                      : ddLevel === 'amber'
                        ? 'bg-amber-500/15 text-amber-300 border-amber-500/30'
                        : 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30'
                  }`}
                >
                  DD {highestDD.toFixed(1)}%
                  <span className="text-[9px] opacity-60 ml-0.5">
                    ({highestDDPctOfLimit.toFixed(0)}%{language === 'id' ? ' limit' : ' limit'})
                  </span>
                </Badge>
                {activeCount > 0 && bestProgress > 0 && (
                  <>
                    <span className="text-lux-text-muted dark:text-gray-600">•</span>
                    <span className="text-blue-300 font-medium">
                      {language === 'id' ? 'Target' : 'Target'} {bestProgress.toFixed(1)}%
                    </span>
                  </>
                )}
              </div>

              {/* Total P/L row — connects prop firm data to main dashboard metrics */}
              {(totalChallengePL !== 0 || totalAccountSize > 0) && (
                <div className="flex items-center gap-2 text-xs mt-1">
                  <span className="text-lux-text-muted dark:text-gray-500">
                    {language === 'id' ? 'Total P/L' : 'Total P/L'}:
                  </span>
                  <span className={`font-semibold ${totalChallengePL >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                    {totalChallengePL >= 0 ? '+' : ''}${Math.abs(totalChallengePL).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </span>
                  {totalAccountSize > 0 && (
                    <>
                      <span className="text-lux-text-muted dark:text-gray-600">•</span>
                      <span className="text-lux-text-muted dark:text-gray-500">
                        {language === 'id' ? 'Modal' : 'Capital'}: ${totalAccountSize.toLocaleString('en-US', { maximumFractionDigits: 0 })}
                      </span>
                    </>
                  )}
                </div>
              )}
            </div>

            {/* Open full tab button */}
            {onOpenGuard && (
              <Button
                variant="ghost"
                size="sm"
                onClick={onOpenGuard}
                className="text-blue-400 hover:text-blue-300 hover:bg-blue-500/10 text-xs gap-1 flex-shrink-0"
              >
                <ChevronRight className="w-4 h-4" />
              </Button>
            )}
          </div>

          {/* ── Row 2: Alert Banner (animated, visible when alert active) ── */}
          <AnimatePresence>
            {topAlert && alertConfig && (
              <motion.div
                initial={{ opacity: 0, height: 0, scale: 0.95 }}
                animate={{ opacity: 1, height: 'auto', scale: 1 }}
                exit={{ opacity: 0, height: 0, scale: 0.95 }}
                transition={{ duration: 0.3, ease: 'easeOut' }}
              >
                <button
                  type="button"
                  onClick={onOpenGuard}
                  className={`w-full rounded-lg border ${alertConfig.border} ${alertConfig.bg} px-3 py-2 flex items-center gap-2 text-left transition-colors hover:brightness-110 ${alertConfig.pulseClass}`}
                  role="alert"
                >
                  {/* Pulsing glow ring for breach */}
                  {topAlert.severity === 'breach' && (
                    <span className="absolute inset-0 rounded-lg ring-2 ring-red-500/40 animate-ping pointer-events-none" />
                  )}
                  {alertConfig.icon}
                  <div className="flex-1 min-w-0">
                    <p className={`text-xs font-semibold ${alertConfig.text} leading-tight`}>
                      {topAlert.isBreached
                        ? (language === 'id'
                            ? `BREACH: ${topAlert.firmName}`
                            : `BREACH: ${topAlert.firmName}`)
                        : topAlert.severity === 'urgent'
                          ? (language === 'id'
                              ? `URGENT: ${topAlert.firmName}`
                              : `URGENT: ${topAlert.firmName}`)
                          : (language === 'id'
                              ? `Peringatan: ${topAlert.firmName}`
                              : `Warning: ${topAlert.firmName}`)
                      }
                    </p>
                    <p className="text-[10px] text-lux-text-muted dark:text-gray-400 leading-tight mt-0.5 truncate">
                      {topAlert.isBreached && topAlert.breachReason
                        ? topAlert.breachReason
                        : (language === 'id'
                            ? `${topAlert.ddType === 'daily' ? 'DD Harian' : 'DD Total'} ${topAlert.currentDD.toFixed(1)}% / ${topAlert.ddLimit.toFixed(1)}% limit (${topAlert.percentOfLimit.toFixed(0)}%)`
                            : `${topAlert.ddType === 'daily' ? 'Daily DD' : 'Total DD'} ${topAlert.currentDD.toFixed(1)}% / ${topAlert.ddLimit.toFixed(1)}% limit (${topAlert.percentOfLimit.toFixed(0)}%)`)
                      }
                    </p>
                  </div>
                  <ChevronRight className="w-3.5 h-3.5 text-lux-text-muted dark:text-gray-500 flex-shrink-0" />
                </button>
              </motion.div>
            )}
          </AnimatePresence>

          {/* ── Row 3: Last Checked Timestamp ── */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1 text-[10px] text-lux-text-muted dark:text-gray-500">
              <Clock className="w-3 h-3" />
              <span>
                {language === 'id' ? 'Terakhir dicek' : 'Last checked'}{' '}
                {lastChecked
                  ? formatRelativeTime(new Date(lastChecked).toISOString(), language)
                  : (language === 'id' ? 'Baru saja' : 'Just now')
                }
              </span>
            </div>
            {onOpenGuard && (
              <button
                type="button"
                onClick={onOpenGuard}
                className="text-[10px] text-blue-400 hover:text-blue-300 transition-colors"
              >
                {language === 'id' ? 'Lihat detail →' : 'View details →'}
              </button>
            )}
          </div>
        </CardContent>
      </Card>
    </motion.div>
  )
}
