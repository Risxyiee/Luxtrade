'use client'

import React from 'react'
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
    <div className="fixed top-0 left-0 right-0 z-[60] h-9 flex items-center justify-center bg-[#00E5C3] overflow-hidden">
      <div className="flex items-center gap-2 text-[13px] font-medium text-black">
        <Sparkles className="w-3.5 h-3.5" />
        <span>{language === 'id' ? `PROMO ${codeDisplay}` : `${codeDisplay} PROMO`}</span>
        <span className="hidden sm:inline">—</span>
        <span className="hidden sm:inline font-medium">{language === 'id' ? '3 Bulan PRO Gratis!' : '3 Months PRO Free!'}</span>
        <a href="#promo" onClick={scrollToPromo} className="ml-1 text-[12px] font-medium text-black hover:underline flex items-center gap-1 transition-colors duration-300">
          {language === 'id' ? 'Klaim' : 'Claim'} <ArrowRight className="w-3 h-3" />
        </a>
      </div>
    </div>
  )
}