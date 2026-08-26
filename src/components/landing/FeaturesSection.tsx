'use client'

import React from 'react'
import { motion } from 'framer-motion'

interface FeaturesSectionProps {
  language: 'id' | 'en'
  t: (key: string) => string
}

const ease = [0.32, 0.72, 0, 1] as const

export default function FeaturesSection({ language, t }: FeaturesSectionProps) {
  const features = language === 'id'
    ? [
        {
          title: 'Analitik Performa',
          desc: 'Win rate, profit factor, performa bulanan — semua divisualisasi biar kamu tahu seberapa konsisten kamu sebenarnya.',
          accent: '#a855f7',
          large: true,
        },
        {
          title: 'Jurnal Trading',
          desc: 'Catat entry, exit, emosi, dan alasan di balik setiap trade. Review-nya nanti biar kamu nggak ngulangin kesalahan yang sama.',
          accent: '#c084fc',
          large: false,
        },
        {
          title: 'AI Deteksi Pola',
          desc: 'AI menganalisis histori trade kamu dan nunjukin pola kerugian yang kamu sendiri nggak sadar sudah berulang puluhan kali.',
          accent: '#22d3ee',
          large: false,
        },
        {
          title: 'Watchlist Cerdas',
          desc: 'Pantau pair yang kamu incar, catat setup yang muncul, dan jangan sampai kehilangan momen karena lupa.',
          accent: '#4ade80',
          large: true,
        },
      ]
    : [
        {
          title: 'Performance Analytics',
          desc: 'Win rate, profit factor, monthly performance — all visualized so you know how consistent you really are.',
          accent: '#a855f7',
          large: true,
        },
        {
          title: 'Trading Journal',
          desc: "Log entry, exit, emotions, and reasoning behind every trade. Review later so you don't repeat the same mistakes.",
          accent: '#c084fc',
          large: false,
        },
        {
          title: 'AI Pattern Detection',
          desc: 'AI analyzes your trade history and shows losing patterns you didn\'t even realize you\'ve repeated dozens of times.',
          accent: '#22d3ee',
          large: false,
        },
        {
          title: 'Smart Watchlist',
          desc: 'Watch the pairs you\'re targeting, log setups that appear, and don\'t miss moments because you forgot.',
          accent: '#4ade80',
          large: true,
        },
      ]

  return (
    <section id="features" className="py-28 lg:py-36 px-4 sm:px-6 lg:px-8">
      <div className="max-w-7xl mx-auto">
        {/* Section Header */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, amount: 0.3 }}
          transition={{ duration: 0.6, ease }}
          className="mb-16 lg:mb-20"
        >
          <span className="inline-flex items-center rounded-full px-4 py-1.5 text-[10px] uppercase tracking-[0.2em] font-medium text-[var(--lux-text-label-2)] bg-[var(--lux-inline-hover-bg)] border border-[var(--lux-inline-border)] mb-6">
            {t('features.title')}
          </span>
          <p className="text-[var(--lux-text-subtitle)] max-w-lg text-base md:text-[17px] leading-[1.7]">
            {t('features.subtitle')}
          </p>
        </motion.div>

        {/* Asymmetrical Bento Grid */}
        <div className="grid grid-cols-1 md:grid-cols-12 gap-4 lg:gap-5">
          {features.map((feature, index) => (
            <motion.div
              key={index}
              initial={{ opacity: 0, y: 24, blur: 8 }}
              whileInView={{ opacity: 1, y: 0, blur: 0 }}
              viewport={{ once: true, amount: 0.15 }}
              transition={{ duration: 0.7, delay: index * 0.1, ease }}
              className={feature.large ? 'md:col-span-7' : 'md:col-span-5'}
            >
              {/* Outer Shell — Double-Bezel */}
              <div
                className="h-full p-[1.5px] rounded-[1.75rem] ring-1 ring-white/[0.05] hover:ring-white/[0.1] transition-all duration-700 ease-[cubic-bezier(0.32,0.72,0,1)]"
                style={{
                  background: `linear-gradient(135deg, ${feature.accent}15, ${feature.accent}05)`,
                }}
              >
                {/* Inner Core */}
                <div className="h-full rounded-[calc(1.75rem-2px)] bg-[var(--lux-card-surface)] p-7 lg:p-9 shadow-[inset_0_1px_1px_rgba(255,255,255,0.06)] hover:bg-[var(--lux-card-surface-hover)] transition-colors duration-700">
                  {/* Accent dot + Title */}
                  <div className="flex items-center gap-3 mb-4">
                    <span
                      className="w-2 h-2 rounded-full"
                      style={{ background: feature.accent, boxShadow: `0 0 12px ${feature.accent}60` }}
                    />
                    <h3 className="text-[var(--lux-text-primary)] font-semibold text-[15px] lg:text-base">
                      {feature.title}
                    </h3>
                  </div>
                  <p className="text-[var(--lux-text-body)] text-sm leading-[1.75]">
                    {feature.desc}
                  </p>
                </div>
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  )
}
