'use client'

import React from 'react'
import Image from 'next/image'
import { motion } from 'framer-motion'

const screenshots = [
  { src: '/screenshots/dashboard-1.jpeg', w: 800, h: 600, captionId: 'Dashboard utama — ringkasan performa trading', captionEn: 'Main dashboard — trading performance overview' },
  { src: '/screenshots/dashboard-2.jpeg', w: 800, h: 600, captionId: 'Daftar trade dengan detail lengkap', captionEn: 'Trade list with full details' },
  { src: '/screenshots/dashboard-3.jpeg', w: 800, h: 600, captionId: 'Analitik win rate per pair dan session', captionEn: 'Win rate analytics per pair and session' },
  { src: '/screenshots/dashboard-4.jpeg', w: 800, h: 600, captionId: 'Jurnal trading otomatis dari screenshot', captionEn: 'Auto journal from screenshot' },
  { src: '/screenshots/dashboard-5.jpeg', w: 800, h: 600, captionId: 'Equity curve dan performa bulanan', captionEn: 'Equity curve and monthly performance' },
  { src: '/screenshots/dashboard-6.jpeg', w: 800, h: 600, captionId: 'Kalkulator risiko dan lot size', captionEn: 'Risk calculator and lot sizing' },
]

export default function DashboardShowcaseSection({ language }: { language: 'id' | 'en' }) {
  return (
    <section className="py-24 lg:py-32 px-4 sm:px-6 lg:px-8">
      <div className="max-w-6xl mx-auto">
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, amount: 0.3 }}
          transition={{ duration: 0.5 }}
          className="mb-12"
        >
          <p className="text-[12px] font-medium tracking-[0.18em] uppercase text-[#939599] mb-3">
            {language === 'id' ? 'Intip Dashboard-nya' : 'Take a Look Inside'}
          </p>
          <p className="text-[#939599] max-w-lg text-base leading-relaxed">
            {language === 'id'
              ? 'Ini tampilan dashboard yang kamu dapatkan setelah daftar.'
              : 'This is what your dashboard looks like after signing up.'}
          </p>
        </motion.div>

        {/* Bento grid: 2 rows, 3 cols on desktop */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {screenshots.map((s, i) => (
            <motion.div
              key={s.src}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, amount: 0.1 }}
              transition={{ duration: 0.5, delay: i * 0.08 }}
              className={`overflow-hidden rounded-2xl border border-white/[0.08] bg-[#0a0a0a] ${
                i === 0 ? 'md:col-span-2 md:row-span-2' : ''
              }`}
            >
              <div className={`relative ${i === 0 ? 'aspect-[4/3]' : 'aspect-[4/3]'}`}>
                <Image
                  src={s.src}
                  alt={language === 'id' ? s.captionId : s.captionEn}
                  width={s.w}
                  height={s.h}
                  className="object-cover w-full h-full"
                  loading="lazy"
                />
              </div>
              <div className="px-4 py-3">
                <p className="text-xs text-white/60 leading-snug">
                  {language === 'id' ? s.captionId : s.captionEn}
                </p>
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  )
}
