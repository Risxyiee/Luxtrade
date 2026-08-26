'use client'

import React from 'react'
import { motion } from 'framer-motion'
import Link from 'next/link'

export default function CTASectionBreak({ language }: { language: 'id' | 'en' }) {
  return (
    <section className="py-24 lg:py-32 px-4 sm:px-6 lg:px-8">
      <div className="max-w-3xl mx-auto text-center">
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, amount: 0.3 }}
          transition={{ duration: 0.5 }}
        >
          <h2 className="text-3xl md:text-[40px] font-medium tracking-tight text-white mb-5 leading-tight">
            {language === 'id'
              ? 'Mulai Catat Trade Kamu Sekarang.'
              : 'Start Logging Your Trades Now.'}
          </h2>
          <p className="text-[15px] text-[#939599] mb-10 max-w-md mx-auto leading-relaxed">
            {language === 'id'
              ? 'Gratis, 10 trade per bulan. Kalau serius, upgrade kapan saja.'
              : "Free, 10 trades/month. Upgrade anytime when you're ready."}
          </p>

          <Link href="/auth/signup">
            <span className="inline-flex items-center gap-2 bg-[#d5ff45] text-black text-[14px] font-medium px-6 py-3 rounded-full hover:brightness-110 active:scale-[0.97] transition-all duration-200">
              {language === 'id' ? 'Daftar Gratis' : 'Sign Up Free'}
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12h14M12 5l7 7-7 7"/></svg>
            </span>
          </Link>

          <p className="text-[#939599] text-[12px] mt-8">
            {language === 'id'
              ? 'Tidak perlu kartu kredit · Setup 30 detik'
              : 'No credit card required · 30 second setup'}
          </p>
        </motion.div>
      </div>
    </section>
  )
}
