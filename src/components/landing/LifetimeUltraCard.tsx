'use client'

import React, { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import { Sparkles, Crown, Zap } from 'lucide-react'
import { Button } from '@/components/ui/button'

interface LifetimeUltraCardProps {
  onButtonClick: () => void
  language: 'id' | 'en'
  t: (key: string) => string
  promoRemaining: number | null
}

export default function LifetimeUltraCard({ onButtonClick, language, t, promoRemaining }: LifetimeUltraCardProps) {
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const timer = setTimeout(() => { setLoading(false) }, 0)
    return () => clearTimeout(timer)
  }, [])

  const isSoldOut = promoRemaining !== null && promoRemaining <= 0

  if (loading) {
    return (
      <motion.div initial={{ opacity: 0, y: 30 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true, amount: 0.1 }} transition={{ delay: 0.3 }}>
        <div className="h-full bg-[var(--lux-card-surface)] backdrop-blur-sm border border-[var(--lux-inline-border)] rounded-3xl p-8">
          <div className="animate-pulse"><div className="h-6 bg-[var(--lux-inline-hover-bg-2)] rounded mb-4 w-1/2" /><div className="h-8 bg-[var(--lux-inline-hover-bg-2)] rounded mb-2 w-3/4" /><div className="space-y-3">{[1,2,3,4].map(i => <div key={i} className="h-4 bg-[var(--lux-inline-hover-bg-2)] rounded" />)}</div></div>
        </div>
      </motion.div>
    )
  }

  return (
    <motion.div initial={{ opacity: 0, y: 30 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true, amount: 0.1 }} transition={{ delay: 0.3 }}>
      <div className={`h-full relative bg-[var(--lux-card-surface)] backdrop-blur-sm border ${isSoldOut ? 'border-red-500/30' : 'border-amber-500/30'} rounded-3xl p-8 pt-10 hover:bg-[var(--lux-card-surface-hover)] transition-colors`}>
        {isSoldOut && (
          <div className="absolute -top-3 left-1/2 -translate-x-1/2 px-4 py-1.5 rounded-full bg-red-500 text-xs font-bold text-white backdrop-blur-sm animate-pulse">SOLD OUT</div>
        )}
        {!isSoldOut && (
          <motion.div className="absolute -top-3 left-1/2 -translate-x-1/2 px-4 py-1.5 rounded-full bg-gradient-to-r from-amber-500 to-orange-500 text-xs font-bold text-white flex items-center gap-1.5 backdrop-blur-sm border border-amber-400/30" animate={{ boxShadow: ['0 0 0 0 rgba(251, 191, 36, 0.4)', '0 0 20px 5px rgba(251, 191, 36, 0.2)', '0 0 0 0 rgba(251, 191, 36, 0)'] }} transition={{ duration: 2, repeat: Infinity }}>
            <Sparkles className="w-3.5 h-3.5" />
            {t('pricing.lifetime.promo').replace('30', (promoRemaining ?? 30).toString())}
          </motion.div>
        )}
        <div className="flex items-center justify-center mb-6">
          <Crown className="w-5 h-5 text-amber-400" />
          <div className="w-3" />
          <h3 className="text-2xl font-bold text-[var(--lux-text-primary)]">{t('pricing.lifetime.title')}</h3>
        </div>
        <p className="text-[12px] text-[var(--lux-text-body)] text-center mb-6 leading-relaxed">{t('pricing.lifetime.desc')}</p>
        <div className="text-3xl font-extrabold text-[var(--lux-text-primary)] text-center mb-2">
          {t('pricing.lifetime.price').split(' /')[0]}
        </div>
        {!isSoldOut && (
          <div className="text-center mb-6">
            <span className="text-xs font-bold text-amber-300">{t('pricing.lifetime.promo').replace('30', (promoRemaining ?? 30).toString())}</span>
          </div>
        )}
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
        <Button disabled={isSoldOut} onClick={onButtonClick} className={`w-full h-[52px] rounded-2xl font-medium ${isSoldOut ? 'bg-[var(--lux-inline-hover-bg-2)] text-[var(--lux-text-subtitle)] cursor-not-allowed' : 'bg-gradient-to-r from-amber-500 to-orange-600 hover:from-amber-600 hover:to-orange-700 text-white shadow-lg active:scale-95 transition-transform'}`}>
          {isSoldOut ? 'SOLD OUT' : (language === 'id' ? 'Ambil Promo Lifetime' : 'Get Lifetime Promo')}
        </Button>
      </div>
    </motion.div>
  )
}