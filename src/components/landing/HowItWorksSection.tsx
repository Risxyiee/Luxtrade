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
    titleId: 'Screenshot \u2192 AI Extract',
    titleEn: 'Screenshot \u2192 AI Extract',
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
      <div className="max-w-2xl mx-auto">
        {/* Section Header — no eyebrow */}
        <motion.h2
          initial={{ opacity: 0, y: 16 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, amount: 0.3 }}
          transition={{ duration: 0.6, ease }}
          className="text-3xl md:text-[36px] font-normal tracking-[-0.02em] text-[var(--lux-text-primary)] mb-12"
        >
          {language === 'id' ? 'Cara Kerja' : 'How It Works'}
        </motion.h2>

        {/* Steps */}
        <div className="space-y-0">
          {steps.map((step, i) => (
            <motion.div
              key={step.num}
              initial={{ opacity: 0, y: 24, filter: 'blur(8px)' }}
              whileInView={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
              viewport={{ once: true, amount: 0.2 }}
              transition={{ duration: 0.7, delay: i * 0.12, ease }}
              className={`py-8 lg:py-10 ${i < steps.length - 1 ? 'border-b border-[var(--lux-inline-border)]' : ''}`}
            >
              <span className="text-[13px] font-mono text-[var(--lux-text-label)] tracking-wider block mb-2">
                {step.num}
              </span>
              <h3 className="text-base font-medium text-[var(--lux-text-primary)] mb-2">
                {language === 'id' ? step.titleId : step.titleEn}
              </h3>
              <p className="text-[13px] font-normal text-[var(--lux-text-body)] leading-[1.7]">
                {language === 'id' ? step.descId : step.descEn}
              </p>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  )
}
