'use client'

import React from 'react'
import { motion } from 'framer-motion'
import Link from 'next/link'
import { Sparkles, ArrowRight } from 'lucide-react'

interface AnnouncementBarProps {
  language: 'id' | 'en'
}

export default function AnnouncementBar({ language }: AnnouncementBarProps) {
  return (
    <div className="fixed top-0 left-0 right-0 z-[60] h-10 flex items-center justify-center bg-purple-500/10 border-b border-white/10 backdrop-blur-md overflow-hidden">
      <div className="flex items-center gap-2 text-sm font-medium tracking-wide">
        <motion.div animate={{ boxShadow: ['0 0 0 0 rgba(139, 92, 246, 0.7)', '0 0 0 8px rgba(139, 92, 246, 0)', '0 0 0 0 rgba(139, 92, 246, 0.7)'] }} transition={{ duration: 2, repeat: Infinity }}>
          <Sparkles className="w-4 h-4 text-purple-400" />
        </motion.div>
        <span className="text-white/90">{language === 'id' ? 'PROMO TRADERCEPAT' : 'TRADERCEPAT PROMO'}</span>
        <span className="hidden sm:inline text-white/60">—</span>
        <span className="hidden sm:inline text-purple-300 font-bold">{language === 'id' ? '3 Bulan PRO Gratis! Sisa slot terbatas' : '3 Months PRO Free! Limited slots'}</span>
        <Link href="/auth/signup" className="ml-2 text-xs font-bold text-purple-300 hover:text-white flex items-center gap-1 transition-colors">
          {language === 'id' ? 'Daftar' : 'Sign Up'} <ArrowRight className="w-3 h-3" />
        </Link>
      </div>
    </div>
  )
}