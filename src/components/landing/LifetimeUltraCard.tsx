'use client'

import React from 'react'
import { motion } from 'framer-motion'
import { Sparkles, Crown, Zap } from 'lucide-react'
import { Button } from '@/components/ui/button'

interface LifetimeUltraCardProps {
  onButtonClick: () => void
  language: 'id' | 'en'
  t: (key: string) => string
}

export default function LifetimeUltraCard({ onButtonClick, language, t }: LifetimeUltraCardProps) {
  return (
    <motion.div initial={{ opacity: 0, y: 30 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true, amount: 0.1 }} transition={{ delay: 0.3 }}>
      <div className="h-full relative bg-[var(--lux-card-surface)] backdrop-blur-sm border border-amber-500/30 rounded-3xl p-8 pt-10 hover:bg-[var(--lux-card-surface-hover)] transition-colors">
        <motion.div className="absolute -top-3 left-1/2 -translate-x-1/2 px-4 py-1.5 rounded-full bg-gradient-to-r from-amber-500 to-orange-500 text-xs font-bold text-white flex items-center gap-1.5 backdrop-blur-sm border border-amber-400/30" animate={{ boxShadow: ['0 0 0 0 rgba(251, 191, 36, 0.4)', '0 0 20px 5px rgba(251, 191, 36, 0.2)', '0 0 0 0 rgba(251, 191, 36, 0)'] }} transition={{ duration: 2, repeat: Infinity }}>
          <Sparkles className="w-3.5 h-3.5" />
          {language === 'id' ? '30 Slot Promo' : '30 Promo Slots'}
        </motion.div>
        <div className="flex items-center justify-center mb-6">
          <Crown className="w-5 h-5 text-amber-400" />
          <div className="w-3" />
          <h3 className="text-2xl font-bold text-[var(--lux-text-primary)]">{t('pricing.lifetime.title')}</h3>
        </div>
        <p className="text-[12px] text-[var(--lux-text-body)] text-center mb-6 leading-relaxed">{t('pricing.lifetime.desc')}</p>
        <div className="text-3xl font-extrabold text-[var(--lux-text-primary)] text-center mb-2">
          {t('pricing.lifetime.price').split(' /')[0]}
        </div>
        <div className="flex flex-col gap-3.5 mb-8">
          {[
            { text: language === 'id' ? 'Akses seumur hidup semua fitur' : 'Lifetime access to all features' },
            { text: language === 'id' ? 'VIP Discord & grup privat' : 'VIP Discord & private group' },
            { text: language === 'id' ? 'Tanpa biaya bulanan' : 'No monthly fees ever' },
            { text: language === 'id' ? 'Semua fitur Elite PRO' : 'All Elite PRO features' },
          ].map((item, index) => (
            <div key={index} className="flex items-start gap-3 text-sm text-[var(--lux-text-body-2)]">
              <Zap className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
              <span>{item.text}</span>
            </div>
          ))}
        </div>
        <Button onClick={onButtonClick} className="w-full h-[52px] rounded-2xl font-medium bg-gradient-to-r from-amber-500 to-orange-600 hover:from-amber-600 hover:to-orange-700 text-white shadow-lg active:scale-95 transition-transform">
          {language === 'id' ? 'Ambil Promo Lifetime' : 'Get Lifetime Promo'}
        </Button>
      </div>
    </motion.div>
  )
}
