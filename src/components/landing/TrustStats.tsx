'use client'

import React, { useState, useEffect, useRef } from 'react'
import { motion, useInView } from 'framer-motion'

interface TrustStatsProps {
  language?: 'id' | 'en'
}

interface LandingStats {
  totalUsers: number
  activeUsers: number
  tradesLogged: number
}

interface StatItem {
  target: number
  suffix: string
  labelId: string
  labelEn: string
  isDecimal?: boolean
}

function AnimatedCounter({
  target,
  suffix = '',
  duration = 2200,
  isDecimal = false,
}: {
  target: number
  suffix?: string
  duration?: number
  isDecimal?: boolean
}) {
  const [count, setCount] = useState(0)
  const ref = useRef<HTMLSpanElement>(null)
  const isInView = useInView(ref, { once: true, margin: '-80px' })
  const hasAnimated = useRef(false)

  useEffect(() => {
    if (!isInView || hasAnimated.current) return
    hasAnimated.current = true
    const startTime = performance.now()
    const step = (currentTime: number) => {
      const elapsed = currentTime - startTime
      const progress = Math.min(elapsed / duration, 1)
      const eased = 1 - Math.pow(1 - progress, 3)
      if (isDecimal) {
        setCount(parseFloat((eased * target).toFixed(1)))
      } else {
        setCount(Math.round(eased * target))
      }
      if (progress < 1) requestAnimationFrame(step)
    }
    requestAnimationFrame(step)
  }, [isInView, target, duration, isDecimal])

  const displayValue = isDecimal ? count.toFixed(1) : count.toLocaleString()

  return (
    <span ref={ref} className="tabular-nums">
      {displayValue}
      {suffix}
    </span>
  )
}

// Format large numbers: 1200 → 1.2K, 15000 → 15K
function formatStat(num: number): { display: string; target: number; suffix: string } {
  if (num >= 1000) {
    const k = num / 1000
    if (k >= 10) {
      return { display: `${Math.round(k)}K+`, target: Math.round(k), suffix: 'K+' }
    }
    return { display: `${k.toFixed(1)}K+`, target: parseFloat(k.toFixed(1)), suffix: 'K+', isDecimal: true }
  }
  return { display: `${num}+`, target: num, suffix: '+' }
}

export default function TrustStats({ language = 'id' }: TrustStatsProps) {
  const [stats, setStats] = useState<StatItem[]>([
    { target: 0, suffix: '+', labelId: 'Trader Aktif', labelEn: 'Active Traders' },
    { target: 0, suffix: '+', labelId: 'Trade Tercatat', labelEn: 'Trades Logged' },
    { target: 0, suffix: '', labelId: 'Prop Firm Lolos', labelEn: 'Prop Firms Passed' },
    { target: 4.9, suffix: '', labelId: 'Rating Pengguna', labelEn: 'User Rating', isDecimal: true },
  ])

  useEffect(() => {
    const fetchStats = async () => {
      try {
        const res = await fetch('/api/landing-stats')
        if (!res.ok) return
        const data: LandingStats = await res.json()

        const usersCount = data.activeUsers || data.totalUsers || 0
        const tradesCount = data.tradesLogged || 0

        const usersFormatted = usersCount >= 1000
          ? formatStat(usersCount)
          : { target: usersCount, suffix: usersCount > 0 ? '+' : '' }

        const tradesFormatted = tradesCount >= 1000
          ? formatStat(tradesCount)
          : { target: tradesCount, suffix: tradesCount > 0 ? '+' : '' }

        setStats([
          { target: usersFormatted.target, suffix: usersFormatted.suffix, labelId: 'Trader Aktif', labelEn: 'Active Traders', isDecimal: usersCount >= 1000 && usersCount < 10000 },
          { target: tradesFormatted.target, suffix: tradesFormatted.suffix, labelId: 'Trade Tercatat', labelEn: 'Trades Logged', isDecimal: tradesCount >= 1000 && tradesCount < 10000 },
          { target: 8, suffix: '', labelId: 'Prop Firm Lolos', labelEn: 'Prop Firms Passed' },
          { target: 4.9, suffix: '', labelId: 'Rating Pengguna', labelEn: 'User Rating', isDecimal: true },
        ])
      } catch {
        // Fallback: use reasonable defaults if API fails
        setStats([
          { target: 50, suffix: '+', labelId: 'Trader Aktif', labelEn: 'Active Traders' },
          { target: 500, suffix: '+', labelId: 'Trade Tercatat', labelEn: 'Trades Logged' },
          { target: 8, suffix: '', labelId: 'Prop Firm Lolos', labelEn: 'Prop Firms Passed' },
          { target: 4.9, suffix: '', labelId: 'Rating Pengguna', labelEn: 'User Rating', isDecimal: true },
        ])
      }
    }
    fetchStats()
  }, [])

  // Don't render if all stats are still 0 (loading)
  const hasData = stats.some(s => s.target > 0)

  return (
    <section
      id="trust-stats"
      className="relative w-full py-14 sm:py-16 px-4 sm:px-6 lg:px-8"
    >
      <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/[0.06] to-transparent" />
      <div className="absolute inset-x-0 bottom-0 h-px bg-gradient-to-r from-transparent via-white/[0.06] to-transparent" />

      <div className="max-w-5xl mx-auto">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: '-60px' }}
          transition={{ duration: 0.5 }}
          className="relative rounded-2xl bg-white/[0.03] border border-white/[0.08] backdrop-blur-xl p-6 sm:p-8"
        >
          <div className="absolute inset-0 rounded-2xl bg-gradient-to-br from-blue-500/[0.04] via-transparent to-cyan-500/[0.04] pointer-events-none" />

          <div className="relative grid grid-cols-2 lg:grid-cols-4 gap-6 sm:gap-8">
            {stats.map((stat, index) => (
              <motion.div
                key={index}
                initial={{ opacity: 0, y: 16 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.45, delay: index * 0.1 }}
                className="flex flex-col items-center text-center gap-1.5"
              >
                <span className="text-3xl sm:text-4xl font-bold bg-gradient-to-r from-blue-400 to-cyan-400 bg-clip-text text-transparent">
                  {hasData ? (
                    <AnimatedCounter
                      target={stat.target}
                      suffix={stat.suffix}
                      isDecimal={stat.isDecimal}
                    />
                  ) : (
                    '—'
                  )}
                </span>
                <span className="text-xs sm:text-sm text-gray-400 font-medium tracking-wide">
                  {language === 'id' ? stat.labelId : stat.labelEn}
                </span>
              </motion.div>
            ))}
          </div>
        </motion.div>
      </div>
    </section>
  )
}
