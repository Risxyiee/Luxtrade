'use client'

import React, { useState, useRef, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import Link from 'next/link'
import { Sparkles, ArrowRight, Play, Star, Users, Shield } from 'lucide-react'
import EquityWidget from './EquityWidget'
import AnimatedForexTrades from './AnimatedForexTrades'

interface HeroSectionProps {
  language: 'id' | 'en'
  t: (key: string) => string
}

export default function HeroSection({ language, t }: HeroSectionProps) {
  const [videoReady, setVideoReady] = useState(false)
  const videoRef = useRef<HTMLVideoElement>(null)

  useEffect(() => {
    const video = videoRef.current
    if (!video) return

    const handleCanPlay = () => setVideoReady(true)
    const handleLoadedData = () => setVideoReady(true)

    video.addEventListener('canplaythrough', handleCanPlay)
    video.addEventListener('loadeddata', handleLoadedData)

    // Fallback: jika event tidak trigger dalam 8 detik, tetap tampilkan
    const fallbackTimer = setTimeout(() => setVideoReady(true), 8000)

    return () => {
      video.removeEventListener('canplaythrough', handleCanPlay)
      video.removeEventListener('loadeddata', handleLoadedData)
      clearTimeout(fallbackTimer)
    }
  }, [])

  return (
    <section className="relative w-full pt-28 sm:pt-32 pb-12 overflow-hidden">
      {/* Video Background */}
      <AnimatePresence>
        <motion.div
          className="absolute inset-0 z-0"
          initial={{ opacity: 0 }}
          animate={{ opacity: videoReady ? 1 : 0 }}
          transition={{ duration: 1.2, ease: 'easeInOut' }}
          style={{ pointerEvents: 'none' }}
        >
          <video
            ref={videoRef}
            autoPlay
            muted
            loop
            playsInline
            preload="auto"
            className="absolute inset-0 w-full h-full object-cover scale-105"
            style={{ filter: 'brightness(0.12) saturate(1.2)' }}
          >
            <source src="/hero-video.mp4" type="video/mp4" />
          </video>
          {/* Gradient overlays for text readability */}
          <div className="absolute inset-0 bg-gradient-to-r from-[var(--lux-bg-primary)] via-[var(--lux-bg-primary)]/80 to-transparent" />
          <div className="absolute inset-0 bg-gradient-to-t from-[var(--lux-bg-primary)] via-transparent to-[var(--lux-bg-primary)]/60" />
          <div className="absolute bottom-0 left-0 right-0 h-32 bg-gradient-to-t from-[var(--lux-bg-primary)] to-transparent" />
        </motion.div>
      </AnimatePresence>

      {/* Content */}
      <div className="relative z-20 max-w-7xl mx-auto flex flex-col lg:flex-row">
        <div className="w-full lg:w-1/2 flex flex-col justify-center px-4 sm:px-6 lg:px-8 lg:pr-12">
          <motion.div initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6 }}>
            {/* Badge */}
            <div className="flex items-center h-9 w-max bg-[var(--lux-badge-bg)] backdrop-blur-sm border border-[var(--lux-inline-border)] rounded-xl mb-8">
              <div className="w-4 h-full" />
              <div className="flex items-center gap-2 text-sm font-medium text-[var(--lux-text-on-surface)]">
                <Sparkles className="w-4 h-4 text-purple-400" />
                {language === 'id' ? 'AI-Powered Trading Journal' : 'AI-Powered Trading Journal'}
              </div>
              <div className="w-4 h-full" />
            </div>

            <h1 className="text-3xl sm:text-[44px] md:text-6xl font-semibold leading-[1.08] tracking-tight mb-6">
              {t('hero.title').split('.').slice(0, -1).join('.')}
              <span className="text-purple-400">.</span>
              <br />
              <span className="bg-gradient-to-r from-purple-400 via-blue-400 to-cyan-400 bg-clip-text text-transparent">
                {t('hero.title').split('.').pop()}
              </span>
            </h1>

            <p className="text-[var(--lux-text-body-2)] max-w-md text-base md:text-lg leading-relaxed mb-8">
              {t('hero.subtitle')}
            </p>

            <div className="flex flex-col sm:flex-row items-start gap-4 w-full sm:w-max">
              <Link href="/auth/signup" className="w-full sm:w-max">
                <button className="flex items-center justify-center w-full h-14 rounded-2xl bg-gradient-to-r from-purple-500 to-blue-600 hover:from-purple-600 hover:to-blue-700 transition shadow-lg shadow-purple-500/20 active:scale-95 group">
                  <div className="w-6 h-full" />
                  <div className="flex items-center gap-2 text-[15px] font-bold text-white">
                    {t('hero.cta.primary')}
                    <ArrowRight className="w-5 h-5 transition-transform group-hover:translate-x-1" />
                  </div>
                  <div className="w-6 h-full" />
                </button>
              </Link>
              <a href="#demo" className="w-full sm:w-max">
                <button className="flex items-center justify-center w-full h-14 rounded-2xl bg-[var(--lux-badge-bg)] backdrop-blur-sm border border-[var(--lux-inline-border)] hover:bg-[var(--lux-inline-hover-bg-3)] transition active:scale-95 group">
                  <div className="w-6 h-full" />
                  <div className="flex items-center gap-2 text-[15px] font-bold text-[var(--lux-text-on-surface)]">
                    <Play className="w-4 h-4" />
                    {t('hero.cta.secondary')}
                    <ArrowRight className="w-5 h-5 opacity-50 transition-transform group-hover:translate-x-1" />
                  </div>
                  <div className="w-6 h-full" />
                </button>
              </a>
            </div>

            {/* Trust Signals */}
            <div className="flex flex-wrap items-center gap-5 mt-8">
              <div className="flex items-center gap-2">
                <div className="flex -space-x-0.5">
                  {[...Array(5)].map((_, i) => (
                    <Star key={i} className="w-4 h-4 text-amber-400 fill-amber-400" />
                  ))}
                </div>
                <span className="text-[var(--lux-text-body-2)] text-sm font-medium">4.8/5</span>
              </div>
              <div className="w-px h-4 bg-[var(--lux-inline-border)]" />
              <div className="flex items-center gap-1.5 text-sm text-[var(--lux-text-body)]">
                <Users className="w-4 h-4 text-purple-400" />
                <span className="font-semibold text-[var(--lux-text-body-2)]">20+</span>
                <span>{language === 'id' ? 'trader' : 'traders'}</span>
              </div>
              <div className="w-px h-4 bg-[var(--lux-inline-border)]" />
              <div className="flex items-center gap-1.5 text-sm text-[var(--lux-text-body)]">
                <Shield className="w-4 h-4 text-emerald-400" />
                <span>{language === 'id' ? 'Data Aman' : 'Secure Data'}</span>
              </div>
            </div>
          </motion.div>
        </div>

        {/* Right Side - Widgets */}
        <motion.div
          className="relative w-full lg:w-1/2 flex items-center justify-center mt-8 lg:mt-0 lg:-mt-4"
          initial={{ opacity: 0, x: 40 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.8, delay: 0.3 }}
        >
          <div className="w-full max-w-md space-y-4">
            <EquityWidget />
            <AnimatedForexTrades />
            <p className="text-center text-[var(--lux-text-label-3)] text-xs">{language === 'id' ? 'Data simulasi untuk demo' : 'Simulated data for demo'}</p>
          </div>
        </motion.div>
      </div>
    </section>
  )
}