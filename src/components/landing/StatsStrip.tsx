'use client'

import React, { useState, useEffect, useRef } from 'react'
import { motion, useInView } from 'framer-motion'

function AnimatedCounter({ target, suffix = '', duration = 2000 }: { target: number; suffix?: string; duration?: number }) {
  const [count, setCount] = useState(0)
  const ref = useRef<HTMLSpanElement>(null)
  const isInView = useInView(ref, { once: true })
  const hasAnimated = useRef(false)

  useEffect(() => {
    if (!isInView || hasAnimated.current) return
    hasAnimated.current = true

    const startTime = performance.now()
    const step = (currentTime: number) => {
      const elapsed = currentTime - startTime
      const progress = Math.min(elapsed / duration, 1)
      const eased = 1 - Math.pow(1 - progress, 3)
      setCount(Math.round(eased * target))
      if (progress < 1) requestAnimationFrame(step)
    }
    requestAnimationFrame(step)
  }, [isInView, target, duration])

  return <span ref={ref}>{count}{suffix}</span>
}

interface StatsStripProps {
  language: 'id' | 'en'
  t: (key: string) => string
  landingStats?: { totalUsers: number; activeUsers: number; tradesLogged: number } | null
}

const ease = [0.32, 0.72, 0, 1] as const

export default function StatsStrip({ language, t, landingStats }: StatsStripProps) {
  const stats = landingStats ?? { totalUsers: 38, activeUsers: 0, tradesLogged: 8 }
  const loaded = landingStats !== null

  const items = [
    { value: stats.totalUsers, suffix: '+', label: language === 'id' ? 'Trader Terdaftar' : 'Registered Traders' },
    { value: stats.tradesLogged, suffix: '+', label: language === 'id' ? 'Trade Tercatat' : 'Trades Logged' },
  ]

  return (
    <section className="w-full py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-7xl mx-auto">
        {items.map((item, index) => (
          <motion.div
            key={index}
            initial={{ opacity: loaded ? 0 : 1, y: loaded ? 16 : 0 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, amount: 0.1 }}
            transition={{ duration: 0.6, delay: index * 0.08, ease }}
            className={`flex items-center py-4 ${index < items.length - 1 ? 'border-b border-[var(--lux-inline-border)]' : ''}`}
          >
            <span
              className="text-2xl font-normal tracking-tight tabular-nums text-[#00E5C3]"
            >
              {loaded ? (
                <AnimatedCounter target={item.value} suffix={item.suffix} />
              ) : (
                <span>{item.value}{item.suffix}</span>
              )}
            </span>
            <span className="text-[13px] font-normal text-[var(--lux-text-secondary)] ml-3">
              {item.label}
            </span>
          </motion.div>
        ))}
      </div>
    </section>
  )
}
