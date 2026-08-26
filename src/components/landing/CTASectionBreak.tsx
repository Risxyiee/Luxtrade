'use client'

import React from 'react'
import { motion } from 'framer-motion'
import Link from 'next/link'
import { ArrowRight } from 'lucide-react'

export default function CTASectionBreak({ language }: { language: 'id' | 'en' }) {
  return (
    <section className="py-28 px-4 sm:px-6 lg:px-8">
      <div className="max-w-2xl mx-auto text-center">
        <motion.div
          initial={{ opacity: 0, y: 24 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, amount: 0.3 }}
          transition={{ duration: 0.7, ease: [0.32, 0.72, 0, 1] }}
        >
          <h2 className="text-2xl sm:text-3xl md:text-4xl font-semibold text-[var(--lux-text-primary)] mb-4 leading-tight">
            {language === 'id'
              ? 'Mulai Catat Trade Kamu Sekarang.'
              : 'Start Logging Your Trades Now.'}
          </h2>
          <p className="text-[var(--lux-text-body)] text-base mb-10 max-w-md mx-auto leading-relaxed">
            {language === 'id'
              ? 'Gratis, 10 trade per bulan. Kalau serius, upgrade kapan saja.'
              : 'Free, 10 trades/month. Upgrade anytime when you\'re ready.'}
          </p>

          <Link href="/auth/signup">
            <button className="inline-flex items-center gap-2 h-12 px-8 rounded-full bg-white text-black font-semibold text-sm hover:bg-white/90 active:scale-[0.98] transition-all duration-300 ease-[cubic-bezier(0.32,0.72,0,1)]">
              {language === 'id' ? 'Daftar Gratis' : 'Sign Up Free'}
              <ArrowRight className="w-4 h-4" />
            </button>
          </Link>

          <p className="text-[var(--lux-text-label-2)] text-xs mt-6">
            {language === 'id'
              ? 'Tidak perlu kartu kredit · Setup 30 detik'
              : 'No credit card required · 30 second setup'}
          </p>
        </motion.div>
      </div>
    </section>
  )
}
