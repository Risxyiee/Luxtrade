'use client'

import React, { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { X, ExternalLink, GraduationCap, Handshake } from 'lucide-react'
import Image from 'next/image'

const PARTNER_URL = 'https://primeacademyfx.com/'

interface PartnerBannerProps {
  language?: 'id' | 'en'
}

export default function PartnerBanner({ language = 'id' }: PartnerBannerProps) {
  const DISMISS_KEY = 'lux-partner-banner-dismissed'
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
          <div className="absolute inset-0 bg-gradient-to-r from-emerald-900/30 via-teal-800/20 to-emerald-900/30" />
          <div className="absolute inset-0 bg-gradient-to-b from-transparent via-emerald-500/5 to-transparent" />
          <div className="absolute inset-0 border border-emerald-500/20 rounded-2xl" />

          {/* Animated glow orbs */}
          <motion.div
            className="absolute -top-16 -right-16 w-48 h-48 bg-emerald-500/10 rounded-full blur-3xl"
            animate={{ scale: [1, 1.2, 1], opacity: [0.5, 0.8, 0.5] }}
            transition={{ duration: 4, repeat: Infinity, ease: 'easeInOut' }}
          />
          <motion.div
            className="absolute -bottom-12 -left-12 w-36 h-36 bg-teal-400/10 rounded-full blur-3xl"
            animate={{ scale: [1, 1.15, 1], opacity: [0.4, 0.7, 0.4] }}
            transition={{ duration: 5, repeat: Infinity, ease: 'easeInOut', delay: 1 }}
          />

          {/* Content */}
          <div className="relative flex flex-col sm:flex-row items-center gap-4 sm:gap-6 px-6 py-5 sm:px-8 sm:py-6">
            {/* Logo + Partner Badge */}
            <a
              href={PARTNER_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-3 flex-shrink-0 group/logo"
            >
              <div className="relative">
                <div className="absolute -inset-1 bg-emerald-500/20 rounded-xl blur-sm group-hover/logo:bg-emerald-500/30 transition-colors" />
                <Image
                  src="/primeacademyfx-logo.jpeg"
                  alt="Prime Academy FX"
                  width={52}
                  height={52}
                  className="relative rounded-xl object-contain"
                />
              </div>
              <div className="hidden sm:flex flex-col items-center gap-0.5">
                <Handshake className="w-5 h-5 text-emerald-400/80" />
                <span className="text-[9px] uppercase tracking-widest text-emerald-400/60 font-medium">
                  Partner
                </span>
              </div>
            </a>

            {/* Text Content */}
            <div className="flex-1 text-center sm:text-left min-w-0">
              <div className="flex items-center justify-center sm:justify-start gap-2 mb-1.5">
                <GraduationCap className="w-4 h-4 text-emerald-400 flex-shrink-0" />
                <span className="text-[11px] uppercase tracking-widest text-emerald-400/80 font-semibold">
                  {isEn ? 'Official Education Partner' : 'Partner Edukasi Resmi'}
                </span>
              </div>
              <p className="text-base sm:text-lg font-bold text-white/95 leading-snug">
                {isEn
                  ? 'LuxTradee x Prime Academy FX — Level up your trading skills with professional education!'
                  : 'LuxTradee x Prime Academy FX — Tingkatkan skill trading kamu dengan edukasi profesional!'}
              </p>
              <p className="text-xs sm:text-sm text-white/40 mt-1 leading-relaxed">
                {isEn
                  ? 'Structured courses, mentorship, and community for serious forex traders.'
                  : 'Kursus terstruktur, mentorship, dan komunitas untuk trader forex yang serius.'}
              </p>
            </div>

            {/* CTA Button */}
            <div className="flex-shrink-0 flex flex-col items-center gap-2">
              <a
                href={PARTNER_URL}
                target="_blank"
                rel="noopener noreferrer"
                className="group inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-500 text-sm font-bold text-white hover:from-emerald-400 hover:to-teal-400 active:scale-[0.97] transition-all duration-200 shadow-lg shadow-emerald-500/25 hover:shadow-emerald-400/30"
              >
                {isEn ? 'Learn More' : 'Pelajari Lebih Lanjut'}
                <ExternalLink className="w-4 h-4 group-hover:translate-x-0.5 transition-transform" />
              </a>
              <span className="text-[10px] text-white/25">
                {isEn ? 'PrimeAcademyFX.com' : 'PrimeAcademyFX.com'}
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
