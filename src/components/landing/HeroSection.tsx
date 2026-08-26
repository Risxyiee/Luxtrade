'use client'

import React from 'react'
import { motion } from 'framer-motion'
import Link from 'next/link'
import dynamic from 'next/dynamic'

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
    <section className="relative w-full pt-28 sm:pt-36 lg:pt-44 pb-20">
      <div className="max-w-7xl mx-auto flex flex-col lg:flex-row items-start gap-12 lg:gap-8 px-4 sm:px-6 lg:px-8">
        {/* Left column — copy */}
        <div className="w-full lg:w-1/2 flex flex-col">
          {/* Section label — RECON style */}
          <motion.p
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
            className="text-[12px] font-medium tracking-[0.18em] uppercase text-[#939599] mb-5"
          >
            {language === 'id' ? 'Trading Journal Indonesia' : 'AI Trading Journal'}
          </motion.p>

          {/* Headline — large, normal weight */}
          <motion.h1
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.08 }}
            className="text-4xl sm:text-5xl md:text-[56px] lg:text-[64px] font-medium leading-[1.05] tracking-tight text-white mb-6"
          >
            {headline}
            <span className="text-[#d5ff45]">.</span>
            {lastSentence && (
              <span className="block mt-1 text-[#939599]">{lastSentence}</span>
            )}
          </motion.h1>

          {/* Subtitle */}
          <motion.p
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.16 }}
            className="text-[15px] text-[#939599] leading-relaxed max-w-md mb-10"
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
              <span className="inline-flex items-center gap-2 bg-[#d5ff45] text-black text-[14px] font-medium px-5 py-2.5 rounded-full hover:brightness-110 active:scale-[0.97] transition-all duration-200">
                {t('hero.cta.primary')}
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12h14M12 5l7 7-7 7"/></svg>
              </span>
            </Link>
            <a href="#demo">
              <span className="inline-flex items-center gap-2 border border-white/[0.1] text-white text-[14px] font-medium px-5 py-2.5 rounded-full hover:border-white/20 hover:bg-white/[0.03] active:scale-[0.97] transition-all duration-200">
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
              className="mt-8 text-[12px] text-[#939599]"
            >
              {language === 'id'
                ? `${landingStats.totalUsers}+ trader sudah terdaftar`
                : `${landingStats.totalUsers}+ traders registered`}
            </motion.p>
          )}
        </div>

        {/* Right column — product visual */}
        <motion.div
          className="w-full lg:w-1/2 flex flex-col items-center mt-6 lg:mt-0"
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, delay: 0.2 }}
        >
          {/* Dashboard mockup card — dark card with border */}
          <div className="w-full max-w-lg rounded-2xl border border-white/[0.08] bg-[#0f0f0f] overflow-hidden shadow-2xl">
            {/* Fake top bar */}
            <div className="h-8 bg-[#0a0a0a] border-b border-white/[0.06] flex items-center px-3 gap-1.5">
              <span className="w-2 h-2 rounded-full bg-white/10" />
              <span className="w-2 h-2 rounded-full bg-white/10" />
              <span className="w-2 h-2 rounded-full bg-white/10" />
            </div>
            <div className="p-4">
              <div className="rounded-xl overflow-hidden border border-white/[0.06] bg-[#080a0e]">
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
            <div className="rounded-xl border border-white/[0.08] bg-[#0a0a0a] p-3">
              <EquityWidget />
            </div>
            <div className="rounded-xl border border-white/[0.08] bg-[#0a0a0a] p-3">
              <AnimatedForexTrades />
            </div>
          </div>

          <p className="text-center text-[#939599] text-[11px] mt-3">
            {language === 'id' ? 'Data simulasi untuk demo' : 'Simulated data for demo'}
          </p>
        </motion.div>
      </div>
    </section>
  )
}
