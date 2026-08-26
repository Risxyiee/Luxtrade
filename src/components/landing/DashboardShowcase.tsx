'use client'

import React, { useState, useRef, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import Image from 'next/image'
import { Monitor, CalendarDays, ListOrdered, ArrowRight } from 'lucide-react'

interface DashboardShowcaseProps {
  language: 'id' | 'en'
}

const screens = [
  {
    id: 'dashboard',
    src: '/screenshot-dashboard.jpeg',
    labelId: 'Dashboard',
    labelEn: 'Dashboard',
    descId: 'Pantau equity curve, win rate, profit factor, dan performa trading kamu secara real-time.',
    descEn: 'Monitor equity curve, win rate, profit factor, and your trading performance in real-time.',
    icon: Monitor,
  },
  {
    id: 'trades',
    src: '/screenshot-trades.jpeg',
    labelId: 'Riwayat Trade',
    labelEn: 'Trade History',
    descId: 'Lihat semua trade kamu dalam tabel terorganisir. Filter by pair, tipe, dan session.',
    descEn: 'See all your trades in an organized table. Filter by pair, type, and session.',
    icon: ListOrdered,
  },
  {
    id: 'calendar',
    src: '/screenshot-calendar.jpeg',
    labelId: 'Kalender Trading',
    labelEn: 'Trading Calendar',
    descId: 'Visualisasi performa harian dalam kalender. Lihat hari profit, loss, dan streak kamu.',
    descEn: 'Visualize daily performance in a calendar. See your profit days, loss days, and streaks.',
    icon: CalendarDays,
  },
]

export default function DashboardShowcase({ language }: DashboardShowcaseProps) {
  const [active, setActive] = useState(0)
  const [direction, setDirection] = useState(1)
  const intervalRef = useRef<NodeJS.Timeout | null>(null)

  const goTo = (index: number) => {
    setDirection(index > active ? 1 : -1)
    setActive(index)
    resetAutoPlay()
  }

  const goNext = () => {
    setDirection(1)
    setActive(prev => (prev + 1) % screens.length)
    resetAutoPlay()
  }

  const resetAutoPlay = () => {
    if (intervalRef.current) clearInterval(intervalRef.current)
    intervalRef.current = setInterval(() => {
      setDirection(1)
      setActive(prev => (prev + 1) % screens.length)
    }, 5000)
  }

  useEffect(() => {
    resetAutoPlay()
    return () => { if (intervalRef.current) clearInterval(intervalRef.current) }
  }, [])

  return (
    <section id="dashboard-showcase" className="py-24 lg:py-32 px-4 sm:px-6 lg:px-8 relative overflow-hidden">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, amount: 0.3 }}
          transition={{ duration: 0.5 }}
          className="text-center mb-12"
        >
          <p className="text-[12px] font-medium tracking-[0.18em] uppercase text-[#8892b0] mb-3">
            {language === 'id' ? 'TAMPILAN APLIKASI' : 'APP INTERFACE'}
          </p>
          <h2 className="text-3xl md:text-[40px] font-medium tracking-tight text-[#f0f2ff] mb-4">
            {language === 'id' ? 'Ini yang Kamu Dapatkan' : "Here's What You Get"}
          </h2>
          <p className="text-[15px] text-[#8892b0] max-w-lg mx-auto leading-relaxed">
            {language === 'id'
              ? 'Bukan mockup, bukan desain — ini screenshot asli dari aplikasi LuxTrade.'
              : 'Not a mockup, not a design — these are real screenshots from the LuxTrade app.'}
          </p>
        </motion.div>

        {/* Tab buttons */}
        <div className="flex items-center justify-center gap-2 mb-10">
          {screens.map((screen, i) => {
            const Icon = screen.icon
            return (
              <button
                key={screen.id}
                onClick={() => goTo(i)}
                className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-[13px] font-medium transition-all duration-200 cursor-pointer ${
                  active === i
                    ? 'bg-blue-500/15 text-blue-400 border border-blue-500/30 shadow-[0_0_20px_rgba(59,130,246,0.1)]'
                    : 'text-[#8892b0] hover:text-[#f0f2ff] hover:bg-white/[0.03] border border-transparent'
                }`}
              >
                <Icon className="w-4 h-4" />
                <span className="hidden sm:inline">{language === 'id' ? screen.labelId : screen.labelEn}</span>
              </button>
            )
          })}
        </div>

        {/* Screenshot display */}
        <div className="relative max-w-4xl mx-auto">
          {/* Glow */}
          <div className="absolute -inset-8 bg-blue-500/[0.05] rounded-3xl blur-[80px] pointer-events-none" aria-hidden="true" />

          {/* Main screenshot card */}
          <motion.div
            className="relative rounded-2xl overflow-hidden border border-white/[0.08] bg-[#0a0a1a] shadow-2xl"
            layout
          >
            <div className="relative aspect-[16/10] sm:aspect-[16/9] bg-[#0a0b14] overflow-hidden">
              <AnimatePresence mode="wait" custom={direction}>
                <motion.div
                  key={active}
                  custom={direction}
                  initial={{ opacity: 0, x: direction * 40 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: direction * -40 }}
                  transition={{ duration: 0.35, ease: 'easeInOut' }}
                  className="absolute inset-0"
                >
                  <Image
                    src={screens[active].src}
                    alt={language === 'id' ? screens[active].labelId : screens[active].labelEn}
                    fill
                    className="object-cover object-top"
                    sizes="(max-width: 768px) 100vw, 896px"
                    priority={active === 0}
                  />
                </motion.div>
              </AnimatePresence>

              {/* Bottom gradient overlay with description */}
              <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 via-black/50 to-transparent pt-16 pb-5 px-6 z-10">
                <h3 className="text-[16px] font-medium text-white mb-1.5">
                  {language === 'id' ? screens[active].labelId : screens[active].labelEn}
                </h3>
                <p className="text-[13px] text-white/60 max-w-md">
                  {language === 'id' ? screens[active].descId : screens[active].descEn}
                </p>
              </div>

              {/* "Real Screenshot" badge */}
              <div className="absolute top-4 left-4 z-10 flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-black/50 backdrop-blur-md border border-white/10">
                <div className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                <span className="text-[10px] text-white/80 font-medium">
                  {language === 'id' ? 'Screenshot Asli' : 'Real Screenshot'}
                </span>
              </div>
            </div>
          </motion.div>

          {/* Progress dots below */}
          <div className="flex items-center justify-center gap-2 mt-6">
            {screens.map((_, i) => (
              <button
                key={i}
                onClick={() => goTo(i)}
                className={`h-1.5 rounded-full transition-all duration-300 cursor-pointer ${
                  active === i ? 'w-8 bg-blue-500' : 'w-1.5 bg-white/20 hover:bg-white/40'
                }`}
                aria-label={`Go to slide ${i + 1}`}
              />
            ))}
          </div>
        </div>
      </div>
    </section>
  )
}