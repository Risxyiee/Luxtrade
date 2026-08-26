'use client'

import React from 'react'
import { motion } from 'framer-motion'
import { Sparkles, Check, X } from 'lucide-react'

interface PromoCodeSectionProps {
  language: 'id' | 'en'
  promoCode: string
  promoRemaining: number | null
  promoMax: number
  promoActive: boolean | null
}

const ease = [0.32, 0.72, 0, 1] as const

export default function PromoCodeSection({ language, promoCode, promoRemaining, promoMax, promoActive }: PromoCodeSectionProps) {
  const isAvailable = promoActive !== false && (promoRemaining === null || promoRemaining > 0)

  return (
    <section id="promo" className="py-12 lg:py-16 px-4 sm:px-6 lg:px-8">
      <div className="max-w-4xl mx-auto">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, amount: 0.1 }}
          transition={{ duration: 0.6, ease }}
        >
          {/* Outer Shell — Double-Bezel */}
          <div className={`p-[1.5px] rounded-[2rem] ring-1 transition-all duration-700 ${isAvailable ? 'bg-gradient-to-br from-amber-500/20 to-amber-500/5 ring-amber-500/10' : 'from-red-500/10 to-red-500/3 ring-red-500/10 bg-gradient-to-br'}`}>
            {/* Inner Core */}
            <div className={`rounded-[calc(2rem-2px)] bg-[var(--lux-card-surface)] p-8 sm:p-10 shadow-[inset_0_1px_1px_rgba(255,255,255,0.06)] relative overflow-hidden`}>
              {isAvailable && (
                <div className="absolute -top-20 -right-20 w-40 h-40 bg-amber-500/5 rounded-full blur-3xl pointer-events-none" />
              )}

              <div className="text-center relative z-10">
                <span className={`inline-flex items-center gap-2 px-4 py-1.5 rounded-full text-[10px] uppercase tracking-[0.15em] font-medium mb-6 ${isAvailable ? 'bg-amber-500/10 text-amber-300/90 border border-amber-500/15' : 'bg-red-500/10 text-red-300/70 border border-red-500/10'}`}>
                  <Sparkles className="w-3 h-3" />
                  {!isAvailable
                    ? (language === 'id' ? 'Kuota Habis' : 'Sold Out')
                    : (language === 'id' ? 'Promo Spesial' : 'Special Promo')}
                </span>

                <h3 className="text-xl sm:text-2xl font-bold text-[var(--lux-text-primary)] mb-2 tracking-[-0.01em]">
                  {!isAvailable
                    ? (language === 'id' ? 'Promo Sudah Berakhir' : 'Promo Has Ended')
                    : (language === 'id' ? '3 Bulan PRO Gratis!' : '3 Months PRO Free!')}
                </h3>
                <p className="text-[var(--lux-text-subtitle)] text-sm mb-8">
                  {!isAvailable
                    ? (language === 'id' ? 'Semua slot promo sudah terpakai' : 'All promo slots have been taken')
                    : (language === 'id' ? 'Masukkan kode di dashboard untuk klaim langsung' : 'Enter code in dashboard to claim instantly')}
                </p>

                {/* Code Block */}
                <motion.div
                  className={`inline-flex items-center gap-3 sm:gap-4 px-6 sm:px-8 py-4 sm:py-5 rounded-2xl border transition-all duration-500 ease-[cubic-bezier(0.32,0.72,0,1)] ${isAvailable ? 'bg-[var(--lux-promo-code-bg)] border-amber-500/20 hover:border-amber-500/40 cursor-pointer' : 'bg-[var(--lux-promo-code-bg)] border-red-500/10 opacity-50 cursor-not-allowed'}`}
                  whileHover={isAvailable ? { scale: 1.02 } : {}}
                  whileTap={isAvailable ? { scale: 0.98 } : {}}
                  onClick={() => {
                    if (!isAvailable) return
                    navigator.clipboard.writeText(promoCode)
                    alert(language === 'id' ? 'Kode berhasil disalin!' : 'Code copied!')
                  }}
                >
                  <span className={`text-2xl sm:text-3xl font-bold tracking-wider font-mono ${isAvailable ? 'text-amber-300' : 'text-red-400/50 line-through'}`}>
                    {promoCode}
                  </span>
                  <div className={`w-7 h-7 sm:w-8 sm:h-8 rounded-lg flex items-center justify-center shrink-0 ${isAvailable ? 'bg-amber-500/15' : 'bg-red-500/15'}`}>
                    {isAvailable
                      ? <Check className="w-4 h-4 sm:w-5 sm:h-5 text-amber-400" />
                      : <X className="w-4 h-4 sm:w-5 sm:h-5 text-red-400" />}
                  </div>
                </motion.div>

                {isAvailable && (
                  <p className="text-[var(--lux-text-label-3)] text-[11px] mt-3 tracking-wide">
                    {language === 'id' ? 'Klik untuk menyalin' : 'Click to copy'}
                  </p>
                )}

                {/* Quota Bar */}
                <div className="mt-8 max-w-sm mx-auto">
                  <div className="flex justify-between items-center mb-2.5">
                    <span className="text-[var(--lux-text-label-2)] text-xs font-medium">
                      {language === 'id' ? 'Sisa slot' : 'Slots remaining'}
                    </span>
                    <span className={`text-xs font-semibold tabular-nums ${isAvailable ? 'text-amber-400/80' : 'text-red-400/60'}`}>
                      {promoRemaining !== null ? `${promoRemaining} / ${promoMax}` : '...'}
                    </span>
                  </div>
                  <div className="h-1.5 bg-[var(--lux-inline-hover-bg)] rounded-full overflow-hidden">
                    <motion.div
                      className={`h-full rounded-full ${isAvailable ? 'bg-amber-500/70' : 'bg-red-500/40'}`}
                      initial={{ width: 0 }}
                      animate={{ width: promoRemaining !== null ? `${((promoMax - promoRemaining) / promoMax) * 100}%` : '0%' }}
                      transition={{ duration: 1.2, ease: 'easeOut' }}
                    />
                  </div>
                  <p className="text-[var(--lux-text-label-3)] text-[11px] mt-2">
                    {promoRemaining !== null
                      ? (language === 'id'
                        ? `${promoMax - promoRemaining} orang sudah klaim`
                        : `${promoMax - promoRemaining} traders claimed`)
                      : (language === 'id' ? 'Memuat kuota...' : 'Loading quota...')}
                  </p>
                </div>
              </div>
            </div>
          </div>
        </motion.div>
      </div>
    </section>
  )
}
