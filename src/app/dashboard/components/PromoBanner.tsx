'use client'

import React, { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { X, ExternalLink, Flame } from 'lucide-react'
import Image from 'next/image'

const CTA_URL = 'https://app.fundingtraders.com/express_checkout?ref=pil14250337&promo=LUXTRADEE'
const DISMISS_KEY = 'lux-promo-banner-dismissed'

export default function PromoBanner() {
  const [dismissed, setDismissed] = useState(false)

  useEffect(() => {
    try {
      const stored = localStorage.getItem(DISMISS_KEY)
      if (stored === 'true') setDismissed(true)
    } catch {}
  }, [])

  if (dismissed) return null

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, height: 0 }}
        transition={{ duration: 0.3 }}
        className="relative mx-4 mt-3 mb-1 rounded-xl overflow-hidden"
      >
        {/* Background gradient */}
        <div className="absolute inset-0 bg-gradient-to-r from-orange-600/20 via-amber-500/15 to-orange-600/20" />
        <div className="absolute inset-0 border border-orange-500/20 rounded-xl" />

        {/* Subtle animated glow */}
        <div className="absolute -top-8 -right-8 w-32 h-32 bg-orange-500/10 rounded-full blur-2xl" />
        <div className="absolute -bottom-8 -left-8 w-24 h-24 bg-amber-400/10 rounded-full blur-2xl" />

        <div className="relative flex items-center gap-3 px-4 py-3 sm:px-5 sm:py-3.5">
          {/* Logo */}
          <div className="flex-shrink-0 hidden sm:block">
            <Image
              src="/fundingtraders-logo.jpeg"
              alt="FundingTraders"
              width={40}
              height={40}
              className="rounded-lg object-contain"
            />
          </div>

          {/* Mobile: smaller logo */}
          <div className="flex-shrink-0 sm:hidden">
            <Image
              src="/fundingtraders-logo.jpeg"
              alt="FundingTraders"
              width={32}
              height={32}
              className="rounded-lg object-contain"
            />
          </div>

          {/* Text + CTA */}
          <div className="flex-1 min-w-0 flex flex-col sm:flex-row sm:items-center gap-1.5 sm:gap-4">
            <p className="text-sm sm:text-[14px] font-semibold text-white/90 leading-snug truncate">
              <Flame className="w-4 h-4 inline text-orange-400 mr-1 -mt-0.5" />
              LuxTradee x FundingTraders: {typeof window !== 'undefined' && document?.documentElement?.lang === 'en' ? 'Get a trading evaluation account and grow your capital!' : 'Dapatkan akun evaluasi trading dan tingkatkan modalmu!'}
            </p>
            <a
              href={CTA_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="flex-shrink-0 inline-flex items-center gap-1.5 px-4 py-1.5 rounded-lg bg-gradient-to-r from-orange-500 to-amber-500 text-[12px] sm:text-[13px] font-bold text-white hover:from-orange-400 hover:to-amber-400 active:scale-[0.97] transition-all duration-200 shadow-lg shadow-orange-500/20"
            >
              {typeof window !== 'undefined' && document?.documentElement?.lang === 'en' ? 'Sign Up Now' : 'Daftar Sekarang'}
              <ExternalLink className="w-3 h-3" />
            </a>
          </div>

          {/* Dismiss button */}
          <button
            onClick={() => {
              setDismissed(true)
              try { localStorage.setItem(DISMISS_KEY, 'true') } catch {}
            }}
            className="flex-shrink-0 p-1 rounded-md hover:bg-white/10 transition-colors cursor-pointer"
            aria-label="Tutup banner"
          >
            <X className="w-4 h-4 text-white/40 hover:text-white/70" />
          </button>
        </div>
      </motion.div>
    </AnimatePresence>
  )
}
