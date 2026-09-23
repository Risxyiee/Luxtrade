'use client'

import React, { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { X, ExternalLink, Flame, Handshake } from 'lucide-react'
import Image from 'next/image'

const CTA_URL = 'https://app.fundingtraders.com/express_checkout?ref=pil14250337&promo=LUXTRADEE'

interface LandingPromoBannerProps {
  language?: 'id' | 'en'
}

export default function LandingPromoBanner({ language = 'id' }: LandingPromoBannerProps) {
  const DISMISS_KEY = 'lux-landing-promo-dismissed'
  const [dismissed, setDismissed] = useState(false)

  useEffect(() => {
    try {
      const stored = localStorage.getItem(DISMISS_KEY)
      if (stored === 'true') setDismissed(true)
    } catch {}
  }, [])

  if (dismissed) return null

  const isEn = language === 'en'

  return (
    <section className="relative py-6 px-4 sm:px-6 lg:px-8 overflow-hidden">
      <AnimatePresence>
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, amount: 0.1 }}
          transition={{ duration: 0.5 }}
          className="relative max-w-5xl mx-auto rounded-2xl overflow-hidden"
        >
          {/* Background layers */}
          <div className="absolute inset-0 bg-gradient-to-r from-orange-900/40 via-amber-800/30 to-orange-900/40" />
          <div className="absolute inset-0 bg-gradient-to-b from-transparent via-orange-500/5 to-transparent" />
          <div className="absolute inset-0 border border-orange-500/20 rounded-2xl" />

          {/* Animated glow orbs */}
          <motion.div
            className="absolute -top-16 -right-16 w-48 h-48 bg-orange-500/15 rounded-full blur-3xl"
            animate={{ scale: [1, 1.2, 1], opacity: [0.5, 0.8, 0.5] }}
            transition={{ duration: 4, repeat: Infinity, ease: 'easeInOut' }}
          />
          <motion.div
            className="absolute -bottom-12 -left-12 w-36 h-36 bg-amber-400/10 rounded-full blur-3xl"
            animate={{ scale: [1, 1.15, 1], opacity: [0.4, 0.7, 0.4] }}
            transition={{ duration: 5, repeat: Infinity, ease: 'easeInOut', delay: 1 }}
          />

          {/* Content */}
          <div className="relative flex flex-col sm:flex-row items-center gap-4 sm:gap-6 px-6 py-5 sm:px-8 sm:py-6">
            {/* Logo + Partnership Badge */}
            <div className="flex items-center gap-3 flex-shrink-0">
              <div className="relative">
                <div className="absolute -inset-1 bg-orange-500/20 rounded-xl blur-sm" />
                <Image
                  src="/fundingtraders-logo.jpeg"
                  alt="FundingTraders"
                  width={52}
                  height={52}
                  className="relative rounded-xl object-contain"
                />
              </div>
              <div className="hidden sm:flex flex-col items-center gap-0.5">
                <Handshake className="w-5 h-5 text-orange-400/80" />
                <span className="text-[9px] uppercase tracking-widest text-orange-400/60 font-medium">
                  Partner
                </span>
              </div>
            </div>

            {/* Text Content */}
            <div className="flex-1 text-center sm:text-left min-w-0">
              <div className="flex items-center justify-center sm:justify-start gap-2 mb-1.5">
                <Flame className="w-4 h-4 text-orange-400 flex-shrink-0" />
                <span className="text-[11px] uppercase tracking-widest text-orange-400/80 font-semibold">
                  {isEn ? 'Exclusive Partnership' : 'Kemitraan Eksklusif'}
                </span>
              </div>
              <p className="text-base sm:text-lg font-bold text-white/95 leading-snug">
                {isEn
                  ? 'LuxTrade x FundingTraders — Get a trading evaluation account & scale your capital!'
                  : 'LuxTrade x FundingTraders — Dapatkan akun evaluasi trading dan tingkatkan modalmu!'}
              </p>
              <p className="text-xs sm:text-sm text-white/40 mt-1 leading-relaxed">
                {isEn
                  ? 'Pass the challenge, get funded up to $200K. Special promo for LuxTrade users.'
                  : 'Lulus challenge, dapatkan funding hingga $200K. Promo spesial untuk pengguna LuxTrade.'}
              </p>
            </div>

            {/* CTA Button */}
            <div className="flex-shrink-0 flex flex-col items-center gap-2">
              <a
                href={CTA_URL}
                target="_blank"
                rel="noopener noreferrer"
                className="group inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-gradient-to-r from-orange-500 to-amber-500 text-sm font-bold text-white hover:from-orange-400 hover:to-amber-400 active:scale-[0.97] transition-all duration-200 shadow-lg shadow-orange-500/25 hover:shadow-orange-400/30"
              >
                {isEn ? 'Get Funded Now' : 'Daftar Sekarang'}
                <ExternalLink className="w-4 h-4 group-hover:translate-x-0.5 transition-transform" />
              </a>
              <span className="text-[10px] text-white/25">
                {isEn ? 'Powered by FundingTraders' : 'Didukung FundingTraders'}
              </span>
            </div>
          </div>

          {/* Dismiss button */}
          <button
            onClick={() => {
              setDismissed(true)
              try { localStorage.setItem(DISMISS_KEY, 'true') } catch {}
            }}
            className="absolute top-3 right-3 p-1.5 rounded-lg hover:bg-white/10 transition-colors z-10"
            aria-label={isEn ? 'Close banner' : 'Tutup banner'}
          >
            <X className="w-4 h-4 text-white/30 hover:text-white/60" />
          </button>
        </motion.div>
      </AnimatePresence>
    </section>
  )
}
