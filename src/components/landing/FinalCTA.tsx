'use client'

import React from 'react'
import { motion } from 'framer-motion'
import { Rocket, ShieldCheck, ArrowRight } from 'lucide-react'
import Link from 'next/link'

interface FinalCTAProps {
  language?: 'id' | 'en'
}

export default function FinalCTA({ language = 'id' }: FinalCTAProps) {
  return (
    <section className="py-40 relative z-10 overflow-hidden">
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[100%] h-[100%] bg-blue-600/10 blur-[180px] rounded-full pointer-events-none" />
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[60%] h-[60%] bg-cyan-500/10 blur-[150px] rounded-full pointer-events-none" />

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, amount: 0.3 }}
        transition={{ duration: 0.5 }}
        className="relative z-10 max-w-4xl mx-auto px-6 text-center flex flex-col items-center gap-8"
      >
        <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full border border-white/10 bg-white/5 backdrop-blur-sm text-xs font-mono tracking-wider text-cyan-300">
          <Rocket className="w-3 h-3" /> {language === 'en' ? 'START YOUR TRADING JOURNEY' : 'MULAI PERJALANAN TRADING ANDA'}
        </div>
        <h2 className="text-5xl md:text-7xl font-bold tracking-tighter max-w-3xl bg-clip-text text-transparent bg-gradient-to-b from-white via-white to-gray-600">
          {language === 'en' ? 'Ready to Build Your Trading Edge?' : 'Siap Bangun Edge Trading Anda?'}
        </h2>
        <p className="max-w-2xl text-lg text-gray-400">
          {language === 'en'
            ? 'Join Indonesian traders who are controlling risk, disciplining psychology, and finding their best setups through LuxTradee.'
            : 'Bergabung bersama trader Indonesia yang sudah mengontrol risiko, mendisiplinkan psikologi, dan menemukan setup terbaik mereka lewat LuxTradee.'}
        </p>
        <div className="flex flex-col sm:flex-row gap-4 mt-4">
          <Link href="/auth/signup">
            <span className="inline-flex items-center gap-2 px-8 py-4 bg-gradient-to-r from-blue-500 to-cyan-400 text-white font-medium rounded-xl hover:opacity-90 transition-all glow-bg-luxury text-lg group">
              {language === 'en' ? 'Sign Up Free Now' : 'Daftar Gratis Sekarang'} 
              <ArrowRight className="w-5 h-5 transition-transform group-hover:translate-x-1" />
            </span>
          </Link>
        </div>
        <p className="text-xs text-gray-500 font-mono flex items-center gap-2 mt-2">
          <ShieldCheck className="w-3 h-3 text-emerald-500" /> 
          {language === 'en' ? 'No credit card required. Full basic features access forever.' : 'Tanpa kartu kredit. Akses penuh fitur dasar selamanya.'}
        </p>
      </motion.div>
    </section>
  )
}
