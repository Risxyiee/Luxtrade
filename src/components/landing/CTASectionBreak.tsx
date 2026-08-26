'use client'

import React from 'react'
import { motion } from 'framer-motion'
import Link from 'next/link'
import { CtaSvg } from './SectionSvgArt'

export default function CTASectionBreak({ language }: { language: 'id' | 'en' }) {
  return (
    <section className="py-24 lg:py-32 px-4 sm:px-6 lg:px-8 relative overflow-hidden">
      <CtaSvg />
      {/* CTA ambient glow */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[300px] bg-blue-500/[0.1] rounded-full blur-[100px] pointer-events-none" aria-hidden="true" />
      <div className="max-w-3xl mx-auto text-center relative">
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, amount: 0.3 }}
          transition={{ duration: 0.5 }}
        >
          <h2 className="text-3xl md:text-[40px] font-medium tracking-tight text-[#f0f2ff] mb-5 leading-tight">
            {language === 'id'
              ? 'Mulai Catat Trade Kamu Sekarang.'
              : 'Start Logging Your Trades Now.'}
          </h2>
          <p className="text-[15px] text-[#8892b0] mb-10 max-w-md mx-auto leading-relaxed">
            {language === 'id'
              ? 'Gratis, 10 trade per bulan. Kalau serius, upgrade kapan saja.'
              : "Free, 10 trades/month. Upgrade anytime when you're ready."}
          </p>

          <Link href="/auth/signup">
            <span className="inline-flex items-center gap-2 bg-blue-500 text-white text-[14px] font-medium px-6 py-3 rounded-full shadow-[0_0_30px_rgba(59,130,246,0.3)] hover:bg-blue-600 active:scale-[0.97] transition-all duration-200">
              {language === 'id' ? 'Daftar Gratis' : 'Sign Up Free'}
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12h14M12 5l7 7-7 7"/></svg>
            </span>
          </Link>

          <p className="text-[#8892b0] text-[12px] mt-8">
            {language === 'id'
              ? 'Tidak perlu kartu kredit · Setup 30 detik'
              : 'No credit card required · 30 second setup'}
          </p>
        </motion.div>
      </div>
    </section>
  )
}
