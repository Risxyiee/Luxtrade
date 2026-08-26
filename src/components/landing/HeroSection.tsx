'use client'

import React, { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import Link from 'next/link'
import Image from 'next/image'
import { HeroSvg } from './SectionSvgArt'
import CandlestickBackground from './CandlestickBackground'
import { Monitor, CalendarDays, ListOrdered, ChevronLeft, ChevronRight } from 'lucide-react'

interface HeroSectionProps {
  language: 'id' | 'en'
  t: (key: string) => string
  landingStats?: { totalUsers: number; activeUsers: number; tradesLogged: number } | null
}

const screenshots = [
  {
    id: 'dashboard',
    src: '/screenshot-dashboard.jpeg',
    labelId: 'Dashboard',
    labelEn: 'Dashboard',
    icon: Monitor,
  },
  {
    id: 'trades',
    src: '/screenshot-trades.jpeg',
    labelId: 'Riwayat Trade',
    labelEn: 'Trade History',
    icon: ListOrdered,
  },
  {
    id: 'calendar',
    src: '/screenshot-calendar.jpeg',
    labelId: 'Kalender Trading',
    labelEn: 'Trading Calendar',
    icon: CalendarDays,
  },
]

export default function HeroSection({ language, t, landingStats }: HeroSectionProps) {
  const titleParts = t('hero.title').split('.')
  const headline = titleParts.slice(0, -1).join('.')
  const lastSentence = titleParts.pop()
  const [activeScreenshot, setActiveScreenshot] = useState(0)

  const goNext = () => setActiveScreenshot(prev => (prev + 1) % screenshots.length)
  const goPrev = () => setActiveScreenshot(prev => (prev - 1 + screenshots.length) % screenshots.length)

  return (
    <section className="relative w-full pt-28 sm:pt-36 lg:pt-44 pb-20 overflow-hidden">
      <CandlestickBackground />
      <HeroSvg />
      <div className="max-w-7xl mx-auto flex flex-col lg:flex-row items-start gap-12 lg:gap-8 px-4 sm:px-6 lg:px-8 relative z-10">
        {/* Left column — copy */}
        <div className="w-full lg:w-1/2 flex flex-col">
          {/* Section label */}
          <motion.p
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
            className="text-[12px] font-medium tracking-[0.18em] uppercase text-[#8892b0] mb-5"
          >
            {language === 'id' ? 'Trading Journal Indonesia' : 'AI Trading Journal'}
          </motion.p>

          {/* Headline */}
          <motion.h1
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.08 }}
            className="text-4xl sm:text-5xl md:text-[56px] lg:text-[64px] font-medium leading-[1.05] tracking-tight text-[#f0f2ff] mb-6"
          >
            {headline}
            <span className="text-blue-400">.</span>
            {lastSentence && (
              <span className="block mt-1 text-[#8892b0]">{lastSentence}</span>
            )}
          </motion.h1>

          {/* Subtitle */}
          <motion.p
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.16 }}
            className="text-[15px] text-[#8892b0] leading-relaxed max-w-md mb-10"
          >
            {t('hero.subtitle')}
          </motion.p>

          {/* CTAs */}
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.24 }}
            className="flex items-center gap-3"
          >
            <Link href="/auth/signup" prefetch={false}>
              <span className="inline-flex items-center gap-2 bg-blue-500 text-white text-[14px] font-medium px-5 py-2.5 rounded-full shadow-[0_0_30px_rgba(59,130,246,0.3)] hover:bg-blue-600 active:scale-[0.97] transition-all duration-200">
                {t('hero.cta.primary')}
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12h14M12 5l7 7-7 7"/></svg>
              </span>
            </Link>
            <a href="#demo">
              <span className="inline-flex items-center gap-2 border border-blue-500/30 text-blue-400 text-[14px] font-medium px-5 py-2.5 rounded-full hover:border-blue-500/50 hover:bg-blue-500/5 active:scale-[0.97] transition-all duration-200">
                {t('hero.cta.secondary')}
              </span>
            </a>
          </motion.div>

          {/* Social proof */}
          {landingStats && landingStats.totalUsers > 0 && (
            <motion.p
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.5, delay: 0.4 }}
              className="mt-8 text-[12px] text-[#8892b0]"
            >
              {language === 'id'
                ? `${landingStats.totalUsers}+ trader sudah terdaftar`
                : `${landingStats.totalUsers}+ traders registered`}
            </motion.p>
          )}
        </div>

        {/* Right column — real screenshot showcase */}
        <motion.div
          className="w-full lg:w-1/2 flex flex-col items-center mt-6 lg:mt-0 relative"
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, delay: 0.2 }}
        >
          {/* Blue glow behind card */}
          <div className="absolute -inset-10 bg-blue-500/[0.08] rounded-full blur-[80px] -z-10" aria-hidden="true" />

          {/* Screenshot card */}
          <div className="w-full max-w-lg rounded-2xl border border-white/[0.08] bg-[#0f0f25] overflow-hidden shadow-[0_0_80px_rgba(59,130,246,0.08)]">
            {/* Top bar */}
            <div className="h-10 bg-[#0a0a1a] border-b border-white/[0.06] flex items-center justify-between px-4">
              <div className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full bg-white/10" />
                <span className="w-2.5 h-2.5 rounded-full bg-white/10" />
                <span className="w-2.5 h-2.5 rounded-full bg-white/10" />
              </div>
              {/* Tab selector — dots */}
              <div className="flex items-center gap-1.5">
                {screenshots.map((ss, i) => {
                  const Icon = ss.icon
                  return (
                    <button
                      key={ss.id}
                      onClick={() => setActiveScreenshot(i)}
                      className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[10px] font-medium transition-all duration-200 cursor-pointer ${
                        activeScreenshot === i
                          ? 'bg-blue-500/20 text-blue-400 border border-blue-500/30'
                          : 'text-[#8892b0] hover:text-[#f0f2ff] hover:bg-white/[0.05] border border-transparent'
                      }`}
                    >
                      <Icon className="w-3 h-3" />
                      <span className="hidden sm:inline">{language === 'id' ? ss.labelId : ss.labelEn}</span>
                    </button>
                  )
                })}
              </div>
            </div>

            {/* Screenshot display */}
            <div className="relative aspect-[9/16] sm:aspect-[9/14] bg-[#0a0b14] overflow-hidden">
              <AnimatePresence mode="wait">
                <motion.div
                  key={activeScreenshot}
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -20 }}
                  transition={{ duration: 0.3, ease: 'easeInOut' }}
                  className="absolute inset-0"
                >
                  <Image
                    src={screenshots[activeScreenshot].src}
                    alt={language === 'id' ? screenshots[activeScreenshot].labelId : screenshots[activeScreenshot].labelEn}
                    fill
                    className="object-cover object-top"
                    sizes="(max-width: 768px) 100vw, 50vw"
                    priority={activeScreenshot === 0}
                  />
                </motion.div>
              </AnimatePresence>

              {/* Nav arrows */}
              <button
                onClick={goPrev}
                className="absolute left-2 top-1/2 -translate-y-1/2 w-8 h-8 rounded-full bg-black/50 backdrop-blur-md border border-white/10 flex items-center justify-center hover:bg-black/70 transition-colors z-10"
                aria-label="Previous screenshot"
              >
                <ChevronLeft className="w-4 h-4 text-white" />
              </button>
              <button
                onClick={goNext}
                className="absolute right-2 top-1/2 -translate-y-1/2 w-8 h-8 rounded-full bg-black/50 backdrop-blur-md border border-white/10 flex items-center justify-center hover:bg-black/70 transition-colors z-10"
                aria-label="Next screenshot"
              >
                <ChevronRight className="w-4 h-4 text-white" />
              </button>

              {/* Bottom label overlay */}
              <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/60 to-transparent pt-12 pb-3 px-4 z-10">
                <div className="flex items-center gap-2">
                  <div className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                  <span className="text-[11px] text-white/80 font-medium">
                    {language === 'id' ? 'Tampilan Asli Dashboard' : 'Real Dashboard Preview'}
                  </span>
                </div>
              </div>
            </div>
          </div>

          <p className="text-center text-[#8892b0] text-[11px] mt-3">
            {language === 'id' ? 'Tampilan asli dari aplikasi LuxTrade' : 'Real interface from LuxTrade app'}
          </p>
        </motion.div>
      </div>
    </section>
  )
}
