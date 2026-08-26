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

const ease = [0.32, 0.72, 0, 1] as const

export default function HeroSection({ language, t, landingStats }: HeroSectionProps) {
  const titleParts = t('hero.title').split('.')
  const headline = titleParts.slice(0, -1).join('.')
  const lastSentence = titleParts.pop()

  return (
    <section className="relative w-full pt-36 sm:pt-44 lg:pt-52 pb-8 lg:pb-16">
      <div className="max-w-7xl mx-auto flex flex-col lg:flex-row items-start lg:items-center">
        {/* Left — Editorial Copy */}
        <div className="w-full lg:w-[55%] flex flex-col px-4 sm:px-6 lg:px-8 lg:pr-16">
          {/* Eyebrow Tag */}
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, ease }}
            className="mb-8"
          >
            <span className="inline-flex items-center rounded-full px-4 py-1.5 text-[10px] uppercase tracking-[0.2em] font-medium text-[var(--lux-text-label-2)] bg-[var(--lux-inline-hover-bg)] border border-[var(--lux-inline-border)]">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 mr-2.5 animate-pulse" />
              {language === 'id' ? 'Trading Journal Indonesia' : 'Trading Journal for Traders'}
            </span>
          </motion.div>

          {/* Headline */}
          <motion.h1
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.1, ease }}
            className="text-4xl sm:text-5xl md:text-[56px] lg:text-[64px] font-bold leading-[1.06] tracking-[-0.03em] text-[var(--lux-text-primary)] mb-7"
          >
            {headline}
            <span className="text-[var(--lux-accent-purple)]">.</span>
            <br className="hidden sm:block" />
            {lastSentence && (
              <span className="block mt-1 text-[var(--lux-text-subtitle)]">{lastSentence}</span>
            )}
          </motion.h1>

          {/* Subtitle */}
          <motion.p
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, delay: 0.2, ease }}
            className="text-[var(--lux-text-body-2)] max-w-lg text-base md:text-[17px] leading-[1.7] mb-12"
          >
            {t('hero.subtitle')}
          </motion.p>

          {/* CTA Group */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, delay: 0.35, ease }}
            className="flex flex-col sm:flex-row items-start gap-4"
          >
            {/* Primary CTA — Button-in-Button pattern */}
            <Link href="/auth/signup" prefetch={false} className="group">
              <button className="relative flex items-center gap-3 h-[52px] pl-7 pr-2.5 rounded-full bg-white text-black font-semibold text-sm hover:bg-white/90 active:scale-[0.97] transition-all duration-700 ease-[cubic-bezier(0.32,0.72,0,1)]">
                {t('hero.cta.primary')}
                <span className="w-9 h-9 rounded-full bg-black/10 flex items-center justify-center group-hover:translate-x-0.5 group-hover:-translate-y-[1px] transition-all duration-500 ease-[cubic-bezier(0.32,0.72,0,1)]">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12h14"/><path d="m12 5 7 7-7 7"/></svg>
                </span>
              </button>
            </Link>

            {/* Secondary CTA */}
            <a href="#demo">
              <button className="flex items-center gap-3 h-[52px] pl-7 pr-2.5 rounded-full border border-[var(--lux-inline-border)] text-[var(--lux-text-on-surface)] font-semibold text-sm hover:bg-[var(--lux-inline-hover-bg-2)] active:scale-[0.97] transition-all duration-700 ease-[cubic-bezier(0.32,0.72,0,1)] group">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polygon points="5 3 19 12 5 21 5 3"/></svg>
                {t('hero.cta.secondary')}
              </button>
            </a>
          </motion.div>

          {/* Social proof — minimal, real only */}
          {landingStats && landingStats.totalUsers > 0 && (
            <motion.p
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.6, delay: 0.6 }}
              className="mt-12 text-xs text-[var(--lux-text-label-3)] tracking-wide"
            >
              {language === 'id'
                ? `${landingStats.totalUsers}+ trader sudah terdaftar`
                : `${landingStats.totalUsers}+ traders registered`}
            </motion.p>
          )}
        </div>

        {/* Right — Video Showcase in Double-Bezel frame */}
        <motion.div
          className="relative w-full lg:w-[45%] flex flex-col items-center mt-16 lg:mt-0 px-4 sm:px-6 lg:px-0"
          initial={{ opacity: 0, y: 32 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.9, delay: 0.25, ease }}
        >
          {/* Outer Shell — Double-Bezel */}
          <div className="w-full max-w-lg p-[3px] rounded-[28px] bg-gradient-to-br from-white/[0.08] to-white/[0.02] ring-1 ring-white/[0.06]">
            {/* Inner Core */}
            <div className="rounded-[25px] overflow-hidden bg-[var(--lux-video-bg)] shadow-[inset_0_1px_1px_rgba(255,255,255,0.08)]">
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

          {/* Widgets Row */}
          <div className="w-full max-w-lg flex flex-col gap-4 mt-6">
            <EquityWidget />
            <AnimatedForexTrades />
          </div>

          <p className="text-center text-[var(--lux-text-label-3)] text-[11px] mt-4 tracking-wide">
            {language === 'id' ? 'Data simulasi untuk demo' : 'Simulated data for demo'}
          </p>
        </motion.div>
      </div>
    </section>
  )
}
