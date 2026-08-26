'use client'

import React from 'react'
import { motion } from 'framer-motion'

interface HowItWorksSectionProps {
  language: 'id' | 'en'
  t: (key: string) => string
}

const steps = [
  {
    num: '01',
    titleId: 'Daftar Gratis',
    titleEn: 'Sign Up Free',
    descId: 'Buat akun 30 detik. 10 trade per bulan gratis, nggak perlu kartu kredit.',
    descEn: '30-second signup. 10 trades/month free, no credit card needed.',
  },
  {
    num: '02',
    titleId: 'Screenshot → AI Extract',
    titleEn: 'Screenshot → AI Extract',
    descId: 'Screenshot trade dari MT4/MT5, upload ke LuxTrade, AI otomatis extract data dan buat jurnal.',
    descEn: 'Screenshot your MT4/MT5 trade, upload to LuxTrade, AI auto-extracts data and creates a journal.',
  },
  {
    num: '03',
    titleId: 'Lihat Pola Kesalahan',
    titleEn: 'See Your Mistake Patterns',
    descId: 'AI scan histori trade kamu dan nunjukin pola loss yang berulang. Data kamu, insight personal.',
    descEn: 'AI scans your trade history and shows repeating loss patterns. Your data, personal insights.',
  },
]

const ease = [0.32, 0.72, 0, 1] as const

export default function HowItWorksSection({ language }: HowItWorksSectionProps) {
  return (
    <section id="how-it-works" className="py-28 lg:py-36 px-4 sm:px-6 lg:px-8">
      <div className="max-w-3xl mx-auto">
        {/* Eyebrow */}
        <motion.span
          initial={{ opacity: 0, y: 12 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, amount: 0.3 }}
          transition={{ duration: 0.6, ease }}
          className="inline-flex items-center rounded-full px-4 py-1.5 text-[10px] uppercase tracking-[0.2em] font-medium text-[var(--lux-text-label-2)] bg-[var(--lux-inline-hover-bg)] border border-[var(--lux-inline-border)] mb-12"
        >
          {language === 'id' ? 'Cara Kerja' : 'How It Works'}
        </motion.span>

        {/* Steps */}
        <div className="space-y-0">
          {steps.map((step, i) => (
            <motion.div
              key={step.num}
              initial={{ opacity: 0, y: 24 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, amount: 0.2 }}
              transition={{ duration: 0.7, delay: i * 0.12, ease }}
              className={`group flex gap-6 sm:gap-10 py-8 lg:py-10 ${i < steps.length - 1 ? 'border-b border-[var(--lux-inline-border)]' : ''}`}
            >
              {/* Step Number — monospace, subtle */}
              <span className="text-[11px] lg:text-xs font-mono tracking-widest text-[var(--lux-text-label)] pt-1.5 select-none shrink-0">
                {step.num}
              </span>
              <div className="flex flex-col justify-center min-w-0">
                <h3 className="text-lg lg:text-xl font-semibold text-[var(--lux-text-primary)] mb-2 tracking-[-0.01em]">
                  {language === 'id' ? step.titleId : step.titleEn}
                </h3>
                <p className="text-[var(--lux-text-body)] text-sm lg:text-[15px] leading-[1.75]">
                  {language === 'id' ? step.descId : step.descEn}
                </p>
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  )
}
