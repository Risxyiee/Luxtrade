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
        },
        {
          title: 'Jurnal Trading',
          desc: 'Catat entry, exit, emosi, dan alasan di balik setiap trade. Review-nya nanti biar kamu nggak ngulangin kesalahan yang sama.',
        },
        {
          title: 'AI Deteksi Pola',
          desc: 'AI menganalisis histori trade kamu dan nunjukin pola kerugian yang kamu sendiri nggak sadar sudah berulang puluhan kali.',
        },
        {
          title: 'Watchlist Cerdas',
          desc: 'Pantau pair yang kamu incar, catat setup yang muncul, dan jangan sampai kehilangan momen karena lupa.',
        },
      ]
    : [
        {
          title: 'Performance Analytics',
          desc: 'Win rate, profit factor, monthly performance — all visualized so you know how consistent you really are.',
        },
        {
          title: 'Trading Journal',
          desc: "Log entry, exit, emotions, and reasoning behind every trade. Review later so you don't repeat the same mistakes.",
        },
        {
          title: 'AI Pattern Detection',
          desc: 'AI analyzes your trade history and shows losing patterns you didn\'t even realize you\'ve repeated dozens of times.',
        },
        {
          title: 'Smart Watchlist',
          desc: 'Watch the pairs you\'re targeting, log setups that appear, and don\'t miss moments because you forgot.',
        },
      ]

  return (
    <section id="features" className="py-28 lg:py-36 px-4 sm:px-6 lg:px-8">
      <div className="max-w-7xl mx-auto">
        {/* Section Header — left-aligned, no badge */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, amount: 0.3 }}
          transition={{ duration: 0.6, ease }}
          className="mb-16 lg:mb-20"
        >
          <h2 className="text-3xl md:text-[36px] font-normal tracking-[-0.02em] text-[var(--lux-text-primary)]">
            {t('features.title')}
          </h2>
          <p className="text-[14px] font-medium text-[var(--lux-text-secondary)] max-w-md mt-4 leading-[1.7]">
            {t('features.subtitle')}
          </p>
        </motion.div>

        {/* 2x2 Grid — clean cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 lg:gap-5">
          {features.map((feature, index) => (
            <motion.div
              key={index}
              initial={{ opacity: 0, y: 24, filter: 'blur(8px)' }}
              whileInView={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
              viewport={{ once: true, amount: 0.15 }}
              transition={{ duration: 0.7, delay: index * 0.1, ease }}
            >
              <div className="h-full bg-[var(--lux-card-surface)] border border-[var(--lux-inline-border)] rounded-2xl p-6 lg:p-8 hover:bg-[var(--lux-card-surface-hover)] transition-colors duration-500 ease-[cubic-bezier(0.32,0.72,0,1)]">
                <div className="flex items-center gap-3 mb-3">
                  <span className="w-[4px] h-[4px] rounded-full bg-[#00E5C3] shrink-0" />
                  <h3 className="text-[15px] font-medium text-[var(--lux-text-primary)]">
                    {feature.title}
                  </h3>
                </div>
                <p className="text-[13px] font-normal text-[var(--lux-text-body)] leading-[1.7]">
                  {feature.desc}
                </p>
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  )
}
