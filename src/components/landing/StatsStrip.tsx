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
    { value: 50, suffix: '%', label: language === 'id' ? 'Avg. Win Rate' : 'Avg. Win Rate', isStatic: true },
    { value: 3, suffix: '', label: language === 'id' ? 'Pair Tersedia' : 'Pairs Supported', isStatic: true },
  ]

  return (
    <section className="relative w-full py-16 px-4 sm:px-6 lg:px-8">
      <StatsSvg />
      <div className="max-w-7xl mx-auto grid grid-cols-2 md:grid-cols-4 gap-6 md:gap-8">
        {items.map((item, index) => (
          <motion.div
            key={index}
            initial={{ opacity: 0, y: 12 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5, delay: index * 0.08 }}
            className="text-center md:text-left"
          >
            <span className="text-2xl md:text-3xl font-medium text-blue-400 tabular-nums block">
              {item.isStatic || !loaded ? (
                <span>{item.value}{item.suffix}</span>
              ) : (
                <AnimatedCounter target={item.value} suffix={item.suffix} />
              )}
            </span>
            <span className="text-[13px] text-[#8892b0] block mt-1">
              {item.label}
            </span>
          </motion.div>
        ))}
      </div>
    </section>
  )
}