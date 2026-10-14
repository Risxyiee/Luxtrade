'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Shield, AlertTriangle, ChevronRight, Loader2 } from 'lucide-react'
import { motion } from 'framer-motion'

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

export default function PropFirmGuardSummary({ language, onOpenGuard }: PropFirmGuardSummaryProps) {
  const [challenges, setChallenges] = useState<Challenge[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)

  useEffect(() => {
    let cancelled = false
    async function fetchChallenges() {
      try {
        const res = await fetch('/api/prop-firm-guard')
        if (!res.ok) throw new Error('Failed to fetch')
        const data = await res.json()
        if (!cancelled) {
          setChallenges(data.challenges || [])
          setError(false)
        }
      } catch {
        if (!cancelled) setError(true)
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    fetchChallenges()
    return () => { cancelled = true }
  }, [])

  // ─── Derived metrics ────────────────────────────────────────────
  const activeChallenges = challenges.filter(c => c.isActive && !c.isBreached)
  const breachedChallenges = challenges.filter(c => c.isBreached)
  const activeCount = activeChallenges.length
  const breachedCount = breachedChallenges.length

  // Highest drawdown % across all challenges (daily + total, as % of limit)
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

  // Determine alert level: green / amber / red
  let ddLevel: 'green' | 'amber' | 'red' = 'green'
  if (breachedCount > 0 || highestDD >= 90) {
    ddLevel = 'red'
  } else if (highestDD >= 70) {
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

        <CardContent className="relative p-4">
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
              <div className="flex items-center gap-3 text-xs">
                <span className="text-lux-text-muted dark:text-gray-400">
                  {activeCount} {language === 'id' ? 'aktif' : 'active'}
                </span>
                <span className="text-lux-text-muted dark:text-gray-600">•</span>
                <span className={`font-medium ${ddLevel === 'red' ? 'text-red-400' : ddLevel === 'amber' ? 'text-amber-400' : 'text-emerald-400'}`}>
                  DD {highestDD.toFixed(1)}%
                </span>
                {activeCount > 0 && bestProgress > 0 && (
                  <>
                    <span className="text-lux-text-muted dark:text-gray-600">•</span>
                    <span className="text-blue-300 font-medium">
                      {language === 'id' ? 'Target' : 'Target'} {bestProgress.toFixed(1)}%
                    </span>
                  </>
                )}
              </div>
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
        </CardContent>
      </Card>
    </motion.div>
  )
}
