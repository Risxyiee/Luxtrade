'use client'

import React from 'react'
import { ArrowRight } from 'lucide-react'

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

  if (promoActive === false && promoCode) {
    return null
  }

  const codeDisplay = promoCode || 'PROMO'

  return (
    <div className="w-full border-b border-white/[0.08] bg-[#050510]">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-2.5 flex items-center justify-center">
        <div className="flex items-center gap-2 text-[12px] text-[#8892b0]">
          <span className="bg-blue-500 text-white px-1.5 py-0.5 rounded text-[10px] font-medium">PROMO</span>
          <span>{codeDisplay}</span>
          <span className="hidden sm:inline">— {language === 'id' ? '3 Bulan PRO Gratis' : '3 Months PRO Free'}</span>
          <a
            href="#promo"
            onClick={scrollToPromo}
            className="ml-0.5 text-blue-400 hover:underline flex items-center gap-0.5 transition-colors duration-200"
          >
            {language === 'id' ? 'Klaim' : 'Claim'} <ArrowRight className="w-3 h-3" />
          </a>
        </div>
      </div>
    </div>
  )
}
