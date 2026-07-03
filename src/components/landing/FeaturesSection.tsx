'use client'

import React from 'react'
import { motion } from 'framer-motion'
import { BarChart3, BookOpen, Brain, Eye } from 'lucide-react'

interface FeaturesSectionProps {
  language: 'id' | 'en'
  t: (key: string) => string
}

export default function FeaturesSection({ language, t }: FeaturesSectionProps) {
  const features = [
    { icon: BarChart3, title: 'Analitik Performa', description: language === 'id' ? 'Win rate, profit factor, performa bulanan — semua divisualisasi biar kamu tahu seberapa konsisten kamu sebenarnya.' : 'Win rate, profit factor, monthly performance — all visualized so you know how consistent you really are.', gradient: 'from-purple-500 to-violet-600' },
    { icon: BookOpen, title: 'Jurnal Trading', description: language === 'id' ? 'Catat entry, exit, emosi, dan alasan di balik setiap trade. Review-nya nanti biar kamu nggak ngulangin kesalahan yang sama.' : 'Log entry, exit, emotions, and reasoning behind every trade. Review later so you don\'t repeat the same mistakes.', gradient: 'from-purple-500 to-violet-600' },
    { icon: Brain, title: 'AI Deteksi Pola', description: language === 'id' ? 'AI menganalisis histori trade kamu dan nunjukin pola kerugian yang kamu sendiri nggak sadar sudah berulang puluhan kali.' : 'AI analyzes your trade history and shows losing patterns you didn\'t even realize you\'ve repeated dozens of times.', gradient: 'from-cyan-500 to-blue-600' },
    { icon: Eye, title: 'Watchlist Cerdas', description: language === 'id' ? 'Pantau pair yang kamu incar, catat setup yang muncul, dan jangan sampai kehilangan momen karena lupa.' : 'Watch the pairs you\'re targeting, log setups that appear, and don\'t miss moments because you forgot.', gradient: 'from-emerald-500 to-teal-600' },
  ]

  return (
    <section id="features" className="py-16 px-4 sm:px-6 lg:px-8">
      <div className="max-w-7xl mx-auto">
        <div className="flex flex-col items-center mb-12">
          <h2 className="text-3xl sm:text-4xl font-extrabold text-[var(--lux-text-primary)] mb-4">{t('features.title')}</h2>
          <p className="text-[var(--lux-text-subtitle)] max-w-[400px] md:max-w-2xl text-center text-base leading-relaxed">{t('features.subtitle')}</p>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {features.map((feature, index) => (
            <motion.div key={index} initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ delay: index * 0.1 }}
              className="flex flex-col bg-[var(--lux-card-surface)] backdrop-blur-sm border border-[var(--lux-inline-border)] rounded-2xl p-5 hover:bg-[var(--lux-card-surface-hover)] transition-colors h-full"
            >
              <div className="flex items-center gap-3 mb-3">
                <div className={`w-10 h-10 md:w-12 md:h-12 rounded-full bg-[var(--lux-icon-circle-bg)] border border-[var(--lux-inline-border)] flex items-center justify-center shrink-0 shadow-inner`}>
                  <feature.icon className={`w-4 h-4 md:w-5 md:h-5 ${index === 0 ? 'text-purple-400' : index === 1 ? 'text-violet-400' : index === 2 ? 'text-cyan-400' : 'text-emerald-400'}`} />
                </div>
                <h3 className="text-[var(--lux-text-primary)] font-semibold text-sm md:text-[15px] leading-tight">{feature.title}</h3>
              </div>
              <p className="text-[var(--lux-text-body)] text-xs md:text-sm font-medium leading-relaxed">{feature.description}</p>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  )
}