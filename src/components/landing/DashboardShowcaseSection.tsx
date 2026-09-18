'use client'

import React, { useState } from 'react'
import Image from 'next/image'
import { motion } from 'framer-motion'

const tabs = [
  { key: 'overview', src: '/screenshots/dashboard-1.jpeg', captionId: 'Dashboard utama — ringkasan performa trading', captionEn: 'Main dashboard — trading performance overview' },
  { key: 'trades', src: '/screenshots/dashboard-2.jpeg', captionId: 'Daftar trade dengan detail lengkap', captionEn: 'Trade list with full details' },
  { key: 'analytics', src: '/screenshots/dashboard-3.jpeg', captionId: 'Analitik win rate per pair dan session', captionEn: 'Win rate analytics per pair and session' },
  { key: 'journal', src: '/screenshots/dashboard-4.jpeg', captionId: 'Jurnal trading otomatis dari screenshot', captionEn: 'Auto journal from screenshot' },
  { key: 'equity', src: '/screenshots/dashboard-5.jpeg', captionId: 'Equity curve dan performa bulanan', captionEn: 'Equity curve and monthly performance' },
  { key: 'calculator', src: '/screenshots/dashboard-6.jpeg', captionId: 'Kalkulator risiko dan lot size', captionEn: 'Risk calculator and lot sizing' },
]

const tabLabels = {
  id: ['Overview', 'Trades', 'Analitik', 'Jurnal', 'Equity', 'Kalkulator'],
  en: ['Overview', 'Trades', 'Analytics', 'Journal', 'Equity', 'Calculator'],
}

export default function DashboardShowcaseSection({ language }: { language: 'id' | 'en' }) {
  const [active, setActive] = useState(0)
  const current = tabs[active]

  return (
    <section className="py-24 lg:py-32 px-4 sm:px-6 lg:px-8">
      <div className="max-w-5xl mx-auto">
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, amount: 0.3 }}
          transition={{ duration: 0.5 }}
          className="mb-14"
        >
          <p className="text-[12px] font-medium tracking-[0.18em] uppercase text-[#8892b0] mb-3">
            {language === 'id' ? 'INTIP DASHBOARD' : 'INSIDE THE APP'}
          </p>
          <h2 className="text-3xl md:text-[40px] font-medium tracking-tight text-[#f0f2ff] leading-tight">
            {language === 'id'
              ? 'Lihat langsung gimana rasanya.'
              : 'See what it feels like inside.'}
          </h2>
          <p className="text-[15px] text-[#8892b0] max-w-md mt-4 leading-relaxed">
            {language === 'id'
              ? 'Dashboard lengkap untuk catat, analisa, dan perbaiki strategi trading kamu.'
              : 'A complete dashboard to log, analyze, and improve your trading strategy.'}
          </p>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, amount: 0.15 }}
          transition={{ duration: 0.5 }}
          className="rounded-2xl border border-white/[0.08] bg-[#0a0a1a] overflow-hidden"
        >
          {/* Tab bar — fake browser tabs */}
          <div className="flex items-center gap-0 border-b border-white/[0.08] overflow-x-auto">
            {/* Fake window controls */}
            <div className="flex items-center gap-1.5 px-4 py-3 shrink-0">
              <span className="w-2.5 h-2.5 rounded-full bg-white/10" />
              <span className="w-2.5 h-2.5 rounded-full bg-white/10" />
              <span className="w-2.5 h-2.5 rounded-full bg-white/10" />
            </div>
            {tabs.map((tab, i) => (
              <button
                key={tab.key}
                onClick={() => setActive(i)}
                className={`px-4 py-3 text-[12px] font-medium whitespace-nowrap transition-colors duration-200 border-b-2 -mb-px ${
                  active === i
                    ? 'text-blue-400 border-blue-400'
                    : 'text-[#8892b0] border-transparent hover:text-[#f0f2ff]'
                }`}
              >
                {tabLabels[language][i]}
              </button>
            ))}
          </div>

          {/* Screenshot display area */}
          <div className="relative bg-[#0c1445]">
            <div className="aspect-[16/10] w-full">
              {tabs.map((tab, i) => (
                <div
                  key={tab.key}
                  className={`absolute inset-0 transition-opacity duration-300 ${active === i ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}
                >
                  <Image
                    src={tab.src}
                    alt={language === 'id' ? tab.captionId : tab.captionEn}
                    fill
                    className="object-contain"
                    loading="lazy"
                    sizes="(max-width: 1024px) 100vw, 1024px"
                  />
                </div>
              ))}
            </div>
          </div>

          {/* Caption bar */}
          <div className="px-5 py-3 border-t border-white/[0.08] flex items-center justify-between">
            <p className="text-[12px] text-[#8892b0]">
              {language === 'id' ? current.captionId : current.captionEn}
            </p>
            <p className="text-[11px] text-[#4a5578]">
              {active + 1} / {tabs.length}
            </p>
          </div>
        </motion.div>
      </div>
    </section>
  )
}
