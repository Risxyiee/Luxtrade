'use client'

import React, { useState, useEffect, useRef } from 'react'
import { motion, useInView } from 'framer-motion'
import { Users, Zap, Brain, Shield } from 'lucide-react'

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
  // Progressive enhancement: show sensible defaults immediately, animate when real data arrives
  const stats = landingStats ?? { totalUsers: 38, activeUsers: 0, tradesLogged: 8 }
  const loaded = landingStats !== null

  const items = [
    { value: stats.totalUsers, suffix: '+', label: language === 'id' ? 'Trader Terdaftar' : 'Registered Traders', icon: Users, color: 'text-purple-400' },
    { value: stats.activeUsers, suffix: '', label: language === 'id' ? 'Trader Aktif' : 'Active Traders', icon: Zap, color: 'text-emerald-400' },
    { value: stats.tradesLogged, suffix: '+', label: language === 'id' ? 'Trade Tercatat' : 'Trades Logged', icon: Brain, color: 'text-cyan-400' },
    { value: 100, suffix: '%', label: language === 'id' ? 'Data Terenkripsi' : 'Data Encrypted', icon: Shield, color: 'text-amber-400' },
  ]

  return (
    <section className="w-full pb-16 px-4 sm:px-6 lg:px-8">
      <div className="max-w-7xl mx-auto">
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {items.map((item, index) => (
            <motion.div
              key={index}
              initial={{ opacity: loaded ? 0 : 1, y: loaded ? 20 : 0 }}
              animate={{ opacity: 1, y: 0 }}
              viewport={{ once: true, amount: 0.1 }}
              transition={{ delay: loaded ? index * 0.1 : 0 }}
              className="flex flex-col bg-[var(--lux-card-surface)] backdrop-blur-sm border border-[var(--lux-inline-border)] rounded-2xl p-5 hover:bg-[var(--lux-card-surface-hover)] transition-colors"
            >
              <div className="flex items-center gap-3 mb-3">
                <div className="w-10 h-10 md:w-12 md:h-12 rounded-full bg-[var(--lux-icon-circle-bg)] border border-[var(--lux-inline-border)] flex items-center justify-center shrink-0">
                  <item.icon className={`w-4 h-4 md:w-5 md:h-5 ${item.color}`} />
                </div>
                <h3 className={`${item.color} font-bold text-2xl md:text-3xl leading-tight`}>
                  {loaded ? (
                    <AnimatedCounter target={item.value} suffix={item.suffix} />
                  ) : (
                    <span>{item.value}{item.suffix}</span>
                  )}
                </h3>
              </div>
              <p className="text-[var(--lux-text-body)] text-xs md:text-sm font-medium leading-relaxed">{item.label}</p>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  )
}
