'use client'

import React from 'react'
import { motion } from 'framer-motion'
import Link from 'next/link'

export default function CTASectionBreak({ language }: { language: 'id' | 'en' }) {
  return (
    <section className="py-28 lg:py-36 px-4 sm:px-6 lg:px-8">
      <div className="max-w-2xl mx-auto">
        <motion.div
          initial={{ opacity: 0, scale: 0.97 }}
          whileInView={{ opacity: 1, scale: 1 }}
          viewport={{ once: true, amount: 0.3 }}
          transition={{ duration: 0.8, ease: [0.32, 0.72, 0, 1] }}
          className="text-center"
        >
          <h2 className="text-3xl md:text-[36px] font-normal tracking-[-0.02em] text-[var(--lux-text-primary)] mb-5 leading-[1.15]">
            {language === 'id'
              ? 'Mulai Catat Trade Kamu Sekarang.'
              : 'Start Logging Your Trades Now.'}
          </h2>
          <p className="text-[14px] font-medium text-[var(--lux-text-secondary)] mb-10 max-w-sm mx-auto leading-[1.7]">
            {language === 'id'
              ? 'Gratis, 10 trade per bulan. Kalau serius, upgrade kapan saja.'
              : "Free, 10 trades/month. Upgrade anytime when you're ready."}
          </p>

          {/* CTA — cyan pill */}
          <Link href="/auth/signup">
            <button className="bg-[#00E5C3] text-black text-[13px] font-normal rounded-full h-10 px-6 shadow-[0_0_20px_rgba(0,229,195,0.2),0_0_40px_rgba(0,229,195,0.1)] hover:brightness-110 active:scale-[0.97] transition-all duration-500 ease-[cubic-bezier(0.32,0.72,0,1)]">
              {language === 'id' ? 'Daftar Gratis' : 'Sign Up Free'}
            </button>
          </Link>

          <p className="text-[var(--lux-text-label)] text-[12px] mt-8">
            {language === 'id'
              ? 'Tidak perlu kartu kredit · Setup 30 detik'
              : 'No credit card required · 30 second setup'}
          </p>
        </motion.div>
      </div>
    </section>
  )
}
