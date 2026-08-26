'use client'

import React from 'react'
import { motion } from 'framer-motion'
import Link from 'next/link'
import { ArrowRight, Play } from 'lucide-react'
import dynamic from 'next/dynamic'

const EquityWidget = dynamic(() => import('./EquityWidget'), { ssr: false })
const AnimatedForexTrades = dynamic(() => import('./AnimatedForexTrades'), { ssr: false })

interface HeroSectionProps {
  language: 'id' | 'en'
  t: (key: string) => string
  landingStats?: { totalUsers: number; activeUsers: number; tradesLogged: number } | null
}

export default function HeroSection({ language, t, landingStats }: HeroSectionProps) {
  const totalUsers = landingStats?.totalUsers

  return (
    <section className="relative w-full pt-32 sm:pt-40 pb-16">
      <div className="max-w-7xl mx-auto flex flex-col lg:flex-row">
        {/* Left — Copy */}
        <div className="w-full lg:w-1/2 flex flex-col justify-center px-4 sm:px-6 lg:px-8 lg:pr-12">
          <motion.div
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, ease: [0.32, 0.72, 0, 1] }}
          >
            <p className="text-sm font-medium tracking-wide text-[var(--lux-text-label-2)] uppercase mb-6">
              {language === 'id' ? 'Trading Journal Indonesia' : 'Trading Journal for Traders'}
            </p>

            <h1 className="text-3xl sm:text-[42px] md:text-6xl font-semibold leading-[1.08] tracking-tight text-[var(--lux-text-primary)] mb-6">
              {t('hero.title').split('.').slice(0, -1).join('.')}
              <span className="text-[var(--lux-accent-purple)]">.</span>
              <br />
              <span className="text-[var(--lux-text-primary)]">
                {t('hero.title').split('.').pop()}
              </span>
            </h1>

            <p className="text-[var(--lux-text-body-2)] max-w-md text-base md:text-lg leading-relaxed mb-10">
              {t('hero.subtitle')}
            </p>

            <div className="flex flex-col sm:flex-row items-start gap-3 w-full sm:w-max">
              <Link href="/auth/signup" prefetch={false}>
                <button className="flex items-center gap-2 h-12 px-7 rounded-full bg-white text-black font-semibold text-sm hover:bg-white/90 active:scale-[0.98] transition-all duration-300 ease-[cubic-bezier(0.32,0.72,0,1)]">
                  {t('hero.cta.primary')}
                  <ArrowRight className="w-4 h-4" />
                </button>
              </Link>
              <a href="#demo">
                <button className="flex items-center gap-2 h-12 px-7 rounded-full border border-[var(--lux-inline-border)] text-[var(--lux-text-on-surface)] font-semibold text-sm hover:bg-[var(--lux-inline-hover-bg-2)] active:scale-[0.98] transition-all duration-300 ease-[cubic-bezier(0.32,0.72,0,1)]">
                  <Play className="w-4 h-4" />
                  {t('hero.cta.secondary')}
                </button>
              </a>
            </div>

            {totalUsers && totalUsers > 0 && (
              <p className="mt-10 text-xs text-[var(--lux-text-label-2)]">
                {language === 'id'
                  ? `Sudah dipakai ${totalUsers}+ trader Indonesia`
                  : `Used by ${totalUsers}+ Indonesian traders`}
              </p>
            )}
          </motion.div>
        </div>

        {/* Right — Video + Widgets */}
        <motion.div
          className="relative w-full lg:w-1/2 flex flex-col items-center justify-center mt-12 lg:mt-0 gap-4"
          initial={{ opacity: 0, y: 32 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 0.2, ease: [0.32, 0.72, 0, 1] }}
        >
          <div className="w-full max-w-md rounded-2xl overflow-hidden border border-[var(--lux-inline-border)] bg-[var(--lux-video-bg)] relative">
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

          <EquityWidget />
          <AnimatedForexTrades />

          <p className="text-center text-[var(--lux-text-label-3)] text-xs">
            {language === 'id' ? 'Data simulasi untuk demo' : 'Simulated data for demo'}
          </p>
        </motion.div>
      </div>
    </section>
  )
}
