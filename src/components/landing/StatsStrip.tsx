'use client'

import React, { useState, useEffect, useRef } from 'react'
import { motion, useInView } from 'framer-motion'
import { StatsSvg } from './SectionSvgArt'

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

export default function StatsStrip({ language, t, landingStats }: StatsStripProps) {
  const stats = landingStats ?? { totalUsers: 38, activeUsers: 0, tradesLogged: 8 }
  const loaded = landingStats !== null

  const items = [
    { value: stats.totalUsers, suffix: '+', label: language === 'id' ? 'Trader Terdaftar' : 'Registered Traders' },
    { value: stats.tradesLogged, suffix: '+', label: language === 'id' ? 'Trade Tercatat' : 'Trades Logged' },
  ]

  return (
    <section className="relative w-full py-16 px-4 sm:px-6 lg:px-8">
      <StatsSvg />
      <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-start sm:items-center gap-8 sm:gap-16">
        {items.map((item, index) => (
          <motion.div
            key={index}
            initial={{ opacity: loaded ? 0 : 1, y: loaded ? 12 : 0 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5, delay: index * 0.08 }}
            className="flex items-baseline gap-2"
          >
            <span className="text-2xl font-medium text-blue-400 tabular-nums">
              {loaded ? (
                <AnimatedCounter target={item.value} suffix={item.suffix} />
              ) : (
                <span>{item.value}{item.suffix}</span>
              )}
            </span>
            <span className="text-[13px] text-[#8892b0]">
              {item.label}
            </span>
          </motion.div>
        ))}
      </div>
    </section>
  )
}
