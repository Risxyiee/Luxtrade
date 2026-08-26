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
    <section className="relative w-full pt-36 sm:pt-44 lg:pt-48 pb-16">
      <div className="max-w-7xl mx-auto flex flex-col lg:flex-row items-start lg:items-center">
        {/* Left — Editorial Copy, Left-Aligned */}
        <div className="w-full lg:w-[55%] flex flex-col px-4 sm:px-6 lg:px-8 lg:pr-16">
          {/* Eyebrow — minimal, no background */}
          <motion.p
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, ease }}
            className="text-[13px] font-medium tracking-[0.15em] text-[var(--lux-text-secondary)] uppercase mb-8"
          >
            {language === 'id' ? 'Trading Journal Indonesia' : 'Trading Journal for Traders'}
          </motion.p>

          {/* Headline — font-normal (400), 56px, tracking-tight */}
          <motion.h1
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.1, ease }}
            className="text-4xl sm:text-5xl md:text-[56px] lg:text-[60px] font-normal leading-[1.08] tracking-[-0.04em] text-[var(--lux-text-primary)] mb-7"
          >
            {headline}
            <span className="text-[var(--lux-text-primary)]">.</span>
            <br className="hidden sm:block" />
            {lastSentence && (
              <span className="block mt-1 text-[var(--lux-text-secondary)]">{lastSentence}</span>
            )}
          </motion.h1>

          {/* Subtitle — 14px, weight-500, gray */}
          <motion.p
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, delay: 0.2, ease }}
            className="text-[var(--lux-text-secondary)] max-w-md text-sm leading-[1.7] font-medium mb-12"
          >
            {t('hero.subtitle')}
          </motion.p>

          {/* CTA — Cyan pill with glow, text-only style */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, delay: 0.35, ease }}
            className="flex flex-col sm:flex-row items-start gap-4"
          >
            <Link href="/auth/signup" prefetch={false}>
              <button className="relative h-10 px-6 rounded-full bg-[#00E5C3] text-black text-[13px] font-normal hover:brightness-110 active:scale-[0.97] transition-all duration-500 ease-[cubic-bezier(0.32,0.72,0,1)] shadow-[0_0_20px_rgba(0,229,195,0.2),0_0_40px_rgba(0,229,195,0.1)]">
                {t('hero.cta.primary')}
              </button>
            </Link>

            <a href="#demo">
              <button className="h-10 px-6 rounded-full border border-[var(--lux-inline-border)] text-[var(--lux-text-secondary)] text-[13px] font-normal hover:text-[var(--lux-text-primary)] hover:border-white/10 active:scale-[0.97] transition-all duration-500 ease-[cubic-bezier(0.32,0.72,0,1)]">
                {t('hero.cta.secondary')}
              </button>
            </a>
          </motion.div>

          {/* Social proof — minimal */}
          {landingStats && landingStats.totalUsers > 0 && (
            <motion.p
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.6, delay: 0.6 }}
              className="mt-12 text-[13px] text-[var(--lux-text-label)] font-normal"
            >
              {language === 'id'
                ? `${landingStats.totalUsers}+ trader sudah terdaftar`
                : `${landingStats.totalUsers}+ traders registered`}
            </motion.p>
          )}
        </div>

        {/* Right — Video Showcase */}
        <motion.div
          className="relative w-full lg:w-[45%] flex flex-col items-center mt-16 lg:mt-0 px-4 sm:px-6 lg:px-0"
          initial={{ opacity: 0, y: 32 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.9, delay: 0.25, ease }}
        >
          <div className="w-full max-w-md rounded-2xl overflow-hidden border border-[var(--lux-inline-border)] bg-[var(--lux-video-bg)]">
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

          <div className="w-full max-w-md flex flex-col gap-4 mt-6">
            <EquityWidget />
            <AnimatedForexTrades />
          </div>

          <p className="text-center text-[var(--lux-text-label)] text-[12px] mt-4 font-normal">
            {language === 'id' ? 'Data simulasi untuk demo' : 'Simulated data for demo'}
          </p>
        </motion.div>
      </div>
    </section>
  )
}
