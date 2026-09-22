'use client'

import React, { useState, useEffect, useRef } from 'react'
import { motion, useInView } from 'framer-motion'

interface TrustStatsProps {
  language?: 'id' | 'en'
}

interface StatItem {
  target: number
  suffix: string
  prefix?: string
  labelId: string
  labelEn: string
  isDecimal?: boolean
}

const stats: StatItem[] = [
  { target: 150, suffix: '+', labelId: 'Trader Aktif', labelEn: 'Active Traders' },
  { target: 12000, suffix: '+', labelId: 'Trade Tercatat', labelEn: 'Trades Logged' },
  { target: 8, suffix: '', labelId: 'Prop Firm Lolos', labelEn: 'Prop Firms Passed' },
  { target: 4.9, suffix: '', labelId: 'Rating Pengguna', labelEn: 'User Rating', isDecimal: true },
]

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
      // Ease-out cubic
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

export default function TrustStats({ language = 'id' }: TrustStatsProps) {
  return (
    <section
      id="trust-stats"
      className="relative w-full py-14 sm:py-16 px-4 sm:px-6 lg:px-8"
    >
      {/* Subtle top/bottom dividers */}
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
          {/* Inner glow */}
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
                  <AnimatedCounter
                    target={stat.target}
                    suffix={stat.suffix}
                    isDecimal={stat.isDecimal}
                  />
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
