'use client'

import React from 'react'
import { motion } from 'framer-motion'
import { HowItWorksSvg } from './SectionSvgArt'
import { UserPlus, Camera, BrainCircuit } from 'lucide-react'

interface HowItWorksSectionProps {
  language: 'id' | 'en'
  t: (key: string) => string
}

const steps = [
  {
    num: '01',
    icon: UserPlus,
    titleId: 'Daftar Gratis',
    titleEn: 'Sign Up Free',
    descId: 'Buat akun 30 detik. 10 trade per bulan gratis, nggak perlu kartu kredit.',
    descEn: '30-second signup. 10 trades/month free, no credit card needed.',
  },
  {
    num: '02',
    icon: Camera,
    titleId: 'Screenshot → AI Extract',
    titleEn: 'Screenshot → AI Extract',
    descId: 'Screenshot trade dari MT4/MT5, upload ke LuxTrade, AI otomatis extract data dan buat jurnal.',
    descEn: 'Screenshot your MT4/MT5 trade, upload to LuxTrade, AI auto-extracts data and creates a journal.',
  },
  {
    num: '03',
    icon: BrainCircuit,
    titleId: 'Lihat Pola Kesalahan',
    titleEn: 'See Your Mistake Patterns',
    descId: 'AI scan histori trade kamu dan nunjukin pola loss yang berulang. Data kamu, insight personal.',
    descEn: 'AI scans your trade history and shows repeating loss patterns. Your data, personal insights.',
  },
]

export default function HowItWorksSection({ language }: HowItWorksSectionProps) {
  return (
    <section id="how-it-works" className="relative py-24 lg:py-32 px-4 sm:px-6 lg:px-8 overflow-hidden">
      <HowItWorksSvg />
      <div className="max-w-3xl mx-auto">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, amount: 0.3 }}
          transition={{ duration: 0.5 }}
          className="mb-14"
        >
          <p className="text-[12px] font-medium tracking-[0.18em] uppercase text-[#8892b0] mb-3">
            {language === 'id' ? 'CARA KERJA' : 'HOW IT WORKS'}
          </p>
          <h2 className="text-3xl md:text-[40px] font-medium tracking-tight text-[#f0f2ff]">
            {language === 'id' ? 'Tiga langkah. Trade pertama live dalam hitungan menit.' : 'Three steps. First trade logged in minutes.'}
          </h2>
        </motion.div>

        {/* Steps */}
        <div className="border-t border-white/[0.06]">
          {steps.map((step, i) => {
            const Icon = step.icon
            return (
              <motion.div
                key={step.num}
                initial={{ opacity: 0, y: 16 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, amount: 0.2 }}
                transition={{ duration: 0.5, delay: i * 0.1 }}
                className={`py-8 ${i < steps.length - 1 ? 'border-b border-white/[0.06]' : ''}`}
              >
                <div className="flex gap-6">
                  <div className="shrink-0 flex flex-col items-center gap-2">
                    <div className="w-10 h-10 rounded-xl bg-blue-500/10 border border-blue-500/20 flex items-center justify-center">
                      <Icon className="w-5 h-5 text-blue-400" />
                    </div>
                    <span className="text-[14px] font-mono text-blue-400/60">{step.num}</span>
                  </div>
                  <div>
                    <h3 className="text-[16px] font-medium text-[#f0f2ff] mb-1.5">
                      {language === 'id' ? step.titleId : step.titleEn}
                    </h3>
                    <p className="text-[14px] text-[#8892b0] leading-relaxed">
                      {language === 'id' ? step.descId : step.descEn}
                    </p>
                  </div>
                </div>
              </motion.div>
            )
          })}
        </div>
      </div>
    </section>
  )
}
