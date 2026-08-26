'use client'

import React from 'react'
import { motion } from 'framer-motion'
import { FeaturesSvg } from './SectionSvgArt'

interface FeaturesSectionProps {
  language: 'id' | 'en'
  t: (key: string) => string
}

const features = {
  id: [
    {
      tag: 'ANALITIK',
      title: 'Performa Trading, Tervisualisasi',
      desc: 'Win rate, profit factor, performa bulanan — semua ditampilkan jelas biar kamu tahu seberapa konsisten kamu sebenarnya.',
    },
    {
      tag: 'JURNAL',
      title: 'Catat Setiap Trade, Review Nanti',
      desc: 'Log entry, exit, emosi, dan alasan di balik setiap trade. Review nanti biar nggak ngulangin kesalahan yang sama.',
    },
    {
      tag: 'AI',
      title: 'Deteksi Pola Kerugian Otomatis',
      desc: 'AI menganalisis histori trade kamu dan nunjukin pola loss yang berulang — yang kamu sendiri nggak sadar.',
    },
    {
      tag: 'WATCHLIST',
      title: 'Pantau Pair, Jangan Ketinggalan',
      desc: 'Monitor pair yang kamu incar, catat setup, dan jangan sampai kehilangan momen karena lupa.',
    },
  ],
  en: [
    {
      tag: 'ANALYTICS',
      title: 'Trading Performance, Visualized',
      desc: 'Win rate, profit factor, monthly performance — all visualized so you know how consistent you really are.',
    },
    {
      tag: 'JOURNAL',
      title: 'Log Every Trade, Review Later',
      desc: "Log entry, exit, emotions, and reasoning. Review later so you don't repeat the same mistakes.",
    },
    {
      tag: 'AI',
      title: 'Automatic Loss Pattern Detection',
      desc: "AI analyzes your trade history and surfaces losing patterns you didn't even realize you've repeated.",
    },
    {
      tag: 'WATCHLIST',
      title: 'Watch Pairs, Never Miss a Move',
      desc: "Watch the pairs you're targeting, log setups, and don't miss moments because you forgot.",
    },
  ],
}

export default function FeaturesSection({ language, t }: FeaturesSectionProps) {
  const items = features[language]

  return (
    <section id="features" className="relative py-24 lg:py-32 px-4 sm:px-6 lg:px-8 overflow-hidden">
      <FeaturesSvg />
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, amount: 0.3 }}
          transition={{ duration: 0.5 }}
          className="mb-14"
        >
          <p className="text-[12px] font-medium tracking-[0.18em] uppercase text-[#8892b0] mb-3">
            {language === 'id' ? 'FITUR' : 'FEATURES'}
          </p>
          <h2 className="text-3xl md:text-[40px] font-medium tracking-tight text-[#f0f2ff] leading-tight">
            {t('features.title')}
          </h2>
          <p className="text-[15px] text-[#8892b0] max-w-md mt-4 leading-relaxed">
            {t('features.subtitle')}
          </p>
        </motion.div>

        {/* Grid — 2 columns, bordered cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-px bg-white/[0.06] rounded-2xl overflow-hidden border border-white/[0.06]">
          {items.map((feature, index) => (
            <motion.div
              key={index}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, amount: 0.15 }}
              transition={{ duration: 0.5, delay: index * 0.08 }}
              className="bg-[#0a0a1a] p-8 lg:p-10 hover:bg-[#0f0f25] transition-colors duration-300"
            >
              <span className="text-[11px] font-medium tracking-[0.16em] text-blue-400 uppercase block mb-3">
                {feature.tag}
              </span>
              <h3 className="text-[18px] font-medium text-[#f0f2ff] mb-2 leading-snug">
                {feature.title}
              </h3>
              <p className="text-[14px] text-[#8892b0] leading-relaxed">
                {feature.desc}
              </p>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  )
}
