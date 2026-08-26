'use client'

import React from 'react'
import { motion } from 'framer-motion'
import { Crown, Zap } from 'lucide-react'

interface LifetimeUltraCardProps {
  onButtonClick: () => void
  language: 'id' | 'en'
  t: (key: string) => string
}

export default function LifetimeUltraCard({ onButtonClick, language, t }: LifetimeUltraCardProps) {
  return (
    <motion.div initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true, amount: 0.1 }} transition={{ delay: 0.3 }}>
      <div className="h-full bg-[#0a0a0a] border border-amber-500/30 rounded-2xl p-8 pt-10 hover:bg-[#0f0f0f] transition-colors">
        <div className="absolute -top-3 left-1/2 -translate-x-1/2 px-3 py-1 rounded-full bg-amber-500 text-black text-[11px] font-medium">
          {language === 'id' ? '30 Slot Promo' : '30 Promo Slots'}
        </div>
        <div className="flex items-center justify-center mb-6">
          <Crown className="w-5 h-5 text-amber-400" />
          <div className="w-3" />
          <h3 className="text-2xl font-medium text-white">{t('pricing.lifetime.title')}</h3>
        </div>
        <p className="text-[13px] text-[#939599] text-center mb-6 leading-relaxed">{t('pricing.lifetime.desc')}</p>
        <div className="text-3xl font-medium text-white text-center mb-2">
          {t('pricing.lifetime.price').split(' /')[0]}
        </div>
        <div className="flex flex-col gap-3.5 mb-8">
          {[
            { text: language === 'id' ? 'Akses seumur hidup semua fitur' : 'Lifetime access to all features' },
            { text: language === 'id' ? 'VIP Discord & grup privat' : 'VIP Discord & private group' },
            { text: language === 'id' ? 'Tanpa biaya bulanan' : 'No monthly fees ever' },
            { text: language === 'id' ? 'Semua fitur PRO' : 'All PRO features' },
          ].map((item, index) => (
            <div key={index} className="flex items-start gap-3 text-[13px] text-[#939599]">
              <Zap className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
              <span>{item.text}</span>
            </div>
          ))}
        </div>
        <button onClick={onButtonClick} className="w-full h-12 rounded-xl font-medium bg-amber-500 hover:bg-amber-600 text-white active:scale-[0.98] transition-all duration-200">
          {language === 'id' ? 'Ambil Promo Lifetime' : 'Get Lifetime Promo'}
        </button>
      </div>
    </motion.div>
  )
}
