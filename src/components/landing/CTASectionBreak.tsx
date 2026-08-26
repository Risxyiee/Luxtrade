'use client'

import React from 'react'
import { motion } from 'framer-motion'
import Link from 'next/link'

export default function CTASectionBreak({ language }: { language: 'id' | 'en' }) {
  return (
    <section className="py-28 lg:py-36 px-4 sm:px-6 lg:px-8">
      <div className="max-w-2xl mx-auto">
        {/* Outer Shell — Double-Bezel */}
        <motion.div
          initial={{ opacity: 0, y: 24, scale: 0.98 }}
          whileInView={{ opacity: 1, y: 0, scale: 1 }}
          viewport={{ once: true, amount: 0.3 }}
          transition={{ duration: 0.8, ease: [0.32, 0.72, 0, 1] }}
          className="p-[1.5px] rounded-[2rem] bg-gradient-to-br from-white/[0.08] to-white/[0.02] ring-1 ring-white/[0.05]"
        >
          {/* Inner Core */}
          <div className="rounded-[calc(2rem-2px)] bg-[var(--lux-card-surface)] px-8 py-14 sm:px-12 sm:py-16 text-center shadow-[inset_0_1px_1px_rgba(255,255,255,0.06)]">
            <h2 className="text-2xl sm:text-3xl lg:text-4xl font-bold text-[var(--lux-text-primary)] mb-5 leading-[1.15] tracking-[-0.02em]">
              {language === 'id'
                ? 'Mulai Catat Trade Kamu Sekarang.'
                : 'Start Logging Your Trades Now.'}
            </h2>
            <p className="text-[var(--lux-text-body)] text-base max-w-sm mx-auto leading-[1.7] mb-10">
              {language === 'id'
                ? 'Gratis, 10 trade per bulan. Kalau serius, upgrade kapan saja.'
                : "Free, 10 trades/month. Upgrade anytime when you're ready."}
            </p>

            {/* CTA — Button-in-Button */}
            <Link href="/auth/signup" className="group inline-flex">
              <button className="relative flex items-center gap-3 h-[52px] pl-8 pr-3 rounded-full bg-white text-black font-semibold text-sm hover:bg-white/90 active:scale-[0.97] transition-all duration-700 ease-[cubic-bezier(0.32,0.72,0,1)]">
                {language === 'id' ? 'Daftar Gratis' : 'Sign Up Free'}
                <span className="w-9 h-9 rounded-full bg-black/10 flex items-center justify-center group-hover:translate-x-0.5 group-hover:-translate-y-[1px] transition-all duration-500 ease-[cubic-bezier(0.32,0.72,0,1)]">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12h14"/><path d="m12 5 7 7-7 7"/></svg>
                </span>
              </button>
            </Link>

            <p className="text-[var(--lux-text-label-3)] text-[11px] mt-8 tracking-wide">
              {language === 'id'
                ? 'Tidak perlu kartu kredit · Setup 30 detik'
                : 'No credit card required · 30 second setup'}
            </p>
          </div>
        </motion.div>
      </div>
    </section>
  )
}
