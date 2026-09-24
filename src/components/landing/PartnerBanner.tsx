'use client'

import React, { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { X, ExternalLink, Building2 } from 'lucide-react'
import Image from 'next/image'

const PARTNER_URL = 'https://primeacademyfx.com/'

interface PartnerBannerProps {
  language?: 'id' | 'en'
}

export default function PartnerBanner({ language = 'id' }: PartnerBannerProps) {
  const DISMISS_KEY = 'luxtradee-partner-banner-dismissed'
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
    <section className="relative py-8 px-4 sm:px-6 lg:px-8 overflow-hidden">
      <AnimatePresence>
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, amount: 0.1 }}
          transition={{ duration: 0.5 }}
          className="relative max-w-4xl mx-auto rounded-2xl overflow-hidden"
        >
          {/* Background */}
          <div className="absolute inset-0 bg-gradient-to-br from-emerald-950/40 via-[#0a1a15] to-teal-950/40" />
          <div className="absolute inset-0 border border-emerald-500/15 rounded-2xl" />

          {/* Subtle glow */}
          <motion.div
            className="absolute -top-20 -right-20 w-56 h-56 bg-emerald-500/8 rounded-full blur-3xl"
            animate={{ scale: [1, 1.15, 1], opacity: [0.3, 0.6, 0.3] }}
            transition={{ duration: 5, repeat: Infinity, ease: 'easeInOut' }}
          />

          {/* Content */}
          <div className="relative flex flex-col sm:flex-row items-center gap-5 sm:gap-8 px-6 py-6 sm:px-8 sm:py-7">
            {/* Logo — BIG and clickable */}
            <a
              href={PARTNER_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="flex-shrink-0 group/logo"
            >
              <div className="relative">
                {/* Glow ring behind logo */}
                <div className="absolute -inset-2 bg-emerald-500/15 rounded-2xl blur-md group-hover/logo:bg-emerald-500/25 transition-colors" />
                <div className="relative w-20 h-20 sm:w-24 sm:h-24 rounded-2xl bg-white/5 border border-white/10 p-1.5 flex items-center justify-center">
                  <Image
                    src="/primeacademyfx-logo.png"
                    alt="PrimeAcademyFX"
                    width={96}
                    height={96}
                    className="w-full h-full object-contain rounded-xl"
                    unoptimized
                  />
                </div>
              </div>
            </a>

            {/* Text Content */}
            <div className="flex-1 text-center sm:text-left min-w-0">
              <div className="flex items-center justify-center sm:justify-start gap-2 mb-2">
                <Building2 className="w-4 h-4 text-emerald-400 flex-shrink-0" />
                <span className="text-[11px] uppercase tracking-[0.15em] text-emerald-400/90 font-bold">
                  {isEn ? 'Partner ProFirm' : 'Partner ProFirm'}
                </span>
              </div>
              <p className="text-lg sm:text-xl font-bold text-white leading-snug">
                {isEn
                  ? 'LuxTradee × PrimeAcademyFX'
                  : 'LuxTradee × PrimeAcademyFX'}
              </p>
              <p className="text-sm text-white/50 mt-1.5 leading-relaxed">
                {isEn
                  ? 'Pass your prop firm challenge with structured courses & mentorship.'
                  : 'Lulus challenge prop firm kamu dengan kursus terstruktur & mentorship.'}
              </p>
            </div>

            {/* CTA Button */}
            <div className="flex-shrink-0 flex flex-col items-center gap-2">
              <a
                href={PARTNER_URL}
                target="_blank"
                rel="noopener noreferrer"
                className="group inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-500 text-sm font-bold text-white hover:from-emerald-400 hover:to-teal-400 active:scale-[0.97] transition-all duration-200 shadow-lg shadow-emerald-500/20 hover:shadow-emerald-400/25"
              >
                {isEn ? 'Visit Partner' : 'Kunjungi Partner'}
                <ExternalLink className="w-3.5 h-3.5 group-hover:translate-x-0.5 transition-transform" />
              </a>
              <span className="text-[10px] text-white/20">
                primeacademyfx.com
              </span>
            </div>
          </div>

          {/* Dismiss */}
          <button
            onClick={() => {
              setDismissed(true)
              try { localStorage.setItem(DISMISS_KEY, 'true') } catch {}
            }}
            className="absolute top-3 right-3 p-1.5 rounded-lg hover:bg-white/10 transition-colors z-10"
            aria-label={isEn ? 'Close' : 'Tutup'}
          >
            <X className="w-4 h-4 text-white/25 hover:text-white/50" />
          </button>
        </motion.div>
      </AnimatePresence>
    </section>
  )
}
