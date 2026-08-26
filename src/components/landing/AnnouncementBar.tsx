'use client'

import React from 'react'
import { motion } from 'framer-motion'
import { Sparkles, ArrowRight } from 'lucide-react'

interface AnnouncementBarProps {
  language: 'id' | 'en'
  promoCode?: string
  promoActive?: boolean | null
}

export default function AnnouncementBar({ language, promoCode, promoActive }: AnnouncementBarProps) {
  const scrollToPromo = (e: React.MouseEvent<HTMLAnchorElement>) => {
    e.preventDefault()
    const el = document.getElementById('promo')
    if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' })
  }

  // Don't show announcement bar if no active promo
  if (promoActive === false && promoCode) {
    return null
  }

  const codeDisplay = promoCode || 'PROMO'

  return (
    <div className="fixed top-0 left-0 right-0 z-[60] h-10 flex items-center justify-center bg-[var(--lux-card-surface)]/80 border-b border-white/[0.06] backdrop-blur-2xl overflow-hidden">
      <div className="flex items-center gap-2.5 text-[13px] font-medium">
        <motion.div animate={{ boxShadow: ['0 0 0 0 rgba(168, 85, 247, 0.7)', '0 0 0 6px rgba(168, 85, 247, 0)', '0 0 0 0 rgba(168, 85, 247, 0.7)'] }} transition={{ duration: 2.5, repeat: Infinity }}>
          <Sparkles className="w-3.5 h-3.5 text-purple-400/80" />
        </motion.div>
        <span className="text-[var(--lux-text-on-surface)]">{language === 'id' ? `PROMO ${codeDisplay}` : `${codeDisplay} PROMO`}</span>
        <span className="hidden sm:inline text-[var(--lux-text-label)]">—</span>
        <span className="hidden sm:inline text-purple-300/80 font-medium">{language === 'id' ? '3 Bulan PRO Gratis!' : '3 Months PRO Free!'}</span>
        <a href="#promo" onClick={scrollToPromo} className="ml-1.5 text-[12px] font-semibold text-purple-300/80 hover:text-[var(--lux-text-primary)] flex items-center gap-1 transition-colors duration-300">
          {language === 'id' ? 'Klaim' : 'Claim'} <ArrowRight className="w-3 h-3" />
        </a>
      </div>
    </div>
  )
}
