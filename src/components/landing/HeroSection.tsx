'use client'

import React from 'react'
import { motion } from 'framer-motion'
import Link from 'next/link'
import dynamic from 'next/dynamic'
import { HeroSvg } from './SectionSvgArt'

const EquityWidget = dynamic(() => import('./EquityWidget'), { ssr: false })
const AnimatedForexTrades = dynamic(() => import('./AnimatedForexTrades'), { ssr: false })

interface HeroSectionProps {
  language: 'id' | 'en'
  t: (key: string) => string
  landingStats?: { totalUsers: number; activeUsers: number; tradesLogged: number } | null
}

export default function HeroSection({ language, t, landingStats }: HeroSectionProps) {
  const titleParts = t('hero.title').split('.')
  const headline = titleParts.slice(0, -1).join('.')
  const lastSentence = titleParts.pop()

  return (
    <section className="relative w-full pt-28 sm:pt-36 lg:pt-44 pb-20 overflow-hidden">
      <HeroSvg />
      <div className="max-w-7xl mx-auto flex flex-col lg:flex-row items-start gap-12 lg:gap-8 px-4 sm:px-6 lg:px-8">
        {/* Left column — copy */}
        <div className="w-full lg:w-1/2 flex flex-col">
          {/* Section label — RECON style */}
          <motion.p
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
            className="text-[12px] font-medium tracking-[0.18em] uppercase text-[#8892b0] mb-5"
          >
            {language === 'id' ? 'Trading Journal Indonesia' : 'AI Trading Journal'}
          </motion.p>

          {/* Headline — large, normal weight */}
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

        {/* Right column — product visual */}
        <motion.div
          className="w-full lg:w-1/2 flex flex-col items-center mt-6 lg:mt-0 relative"
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, delay: 0.2 }}
        >
          {/* Blue glow behind card */}
          <div className="absolute -inset-10 bg-blue-500/[0.08] rounded-full blur-[80px] -z-10" aria-hidden="true" />
          {/* Dashboard mockup card — dark card with border */}
          <div className="w-full max-w-lg rounded-2xl border border-white/[0.08] bg-[#0f0f25] overflow-hidden shadow-[0_0_80px_rgba(59,130,246,0.08)]">
            {/* Fake top bar */}
            <div className="h-8 bg-[#0a0a1a] border-b border-white/[0.06] flex items-center px-3 gap-1.5">
              <span className="w-2 h-2 rounded-full bg-white/10" />
              <span className="w-2 h-2 rounded-full bg-white/10" />
              <span className="w-2 h-2 rounded-full bg-white/10" />
            </div>
            <div className="p-4">
              <div className="rounded-xl overflow-hidden border border-white/[0.06] bg-[#0c1445]">
                <video
                  autoPlay
                  muted
                  loop
                  playsInline
                  preload="auto"
                  className="w-full object-contain"
                >
                  <source src="/hero-video.mp4" type="video/mp4" />
                </video>
              </div>
            </div>
          </div>

          {/* Terminal-style live feed below */}
          <div className="w-full max-w-lg mt-4 grid grid-cols-2 gap-3">
            <div className="rounded-xl border border-white/[0.08] bg-[#0a0a1a] p-3">
              <EquityWidget />
            </div>
            <div className="rounded-xl border border-white/[0.08] bg-[#0a0a1a] p-3">
              <AnimatedForexTrades />
            </div>
          </div>

          <p className="text-center text-[#8892b0] text-[11px] mt-3">
            {language === 'id' ? 'Data simulasi untuk demo' : 'Simulated data for demo'}
          </p>
        </motion.div>
      </div>
    </section>
  )
}
