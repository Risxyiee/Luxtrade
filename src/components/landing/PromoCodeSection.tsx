'use client'

import React from 'react'
import { motion } from 'framer-motion'
import { Sparkles, Check, X } from 'lucide-react'

interface PromoCodeSectionProps {
  language: 'id' | 'en'
  promoRemaining: number | null
  promoMax: number
  promoActive: boolean | null
}

export default function PromoCodeSection({ language, promoRemaining, promoMax, promoActive }: PromoCodeSectionProps) {
  const isAvailable = promoActive !== false && (promoRemaining === null || promoRemaining > 0)

  return (
    <section className="py-16 px-4 sm:px-6 lg:px-8">
      <div className="max-w-4xl mx-auto">
        <motion.div initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }}>
          <div className={`relative overflow-hidden bg-[#2a1b3d]/40 backdrop-blur-sm border rounded-3xl p-8 sm:p-10 transition-colors ${isAvailable ? 'border-amber-500/20' : 'border-red-500/20'}`}>
            {isAvailable && (
              <div className="absolute -top-20 -right-20 w-40 h-40 bg-amber-500/10 rounded-full blur-3xl" />
            )}

            <div className="text-center relative z-10">
              <div className="inline-flex items-center gap-2 px-3 py-1 bg-amber-500/10 rounded-full mb-5">
                <Sparkles className="w-3.5 h-3.5 text-amber-400" />
                <p className="text-amber-300/90 text-xs font-semibold uppercase tracking-wider">
                  {!isAvailable
                    ? (language === 'id' ? 'Kuota Habis' : 'Sold Out')
                    : (language === 'id' ? 'Promo Spesial' : 'Special Promo')}
                </p>
              </div>

              <h3 className="text-xl sm:text-2xl font-bold text-white mb-2">
                {!isAvailable
                  ? (language === 'id' ? 'Promo Sudah Berakhir' : 'Promo Has Ended')
                  : (language === 'id' ? '3 Bulan PRO Gratis!' : '3 Months PRO Free!')}
              </h3>
              <p className="text-white/50 text-sm mb-6">
                {!isAvailable
                  ? (language === 'id' ? 'Semua 30 slot promo sudah terpakai' : 'All 30 promo slots have been taken')
                  : (language === 'id' ? 'Masukkan kode di dashboard untuk klaim langsung' : 'Enter code in dashboard to claim instantly')}
              </p>

              <motion.div
                className={`inline-flex items-center gap-3 sm:gap-4 px-6 sm:px-8 py-4 sm:py-5 bg-black/40 rounded-2xl border-2 transition-all ${isAvailable ? 'border-amber-500/50 hover:border-amber-500 cursor-pointer' : 'border-red-500/20 opacity-50 cursor-not-allowed'}`}
                whileHover={isAvailable ? { scale: 1.02 } : {}}
                whileTap={isAvailable ? { scale: 0.98 } : {}}
                onClick={() => {
                  if (!isAvailable) return
                  navigator.clipboard.writeText('TRADERCEPAT')
                  alert(language === 'id' ? 'Kode berhasil disalin!' : 'Code copied!')
                }}
              >
                <span className={`text-2xl sm:text-3xl font-extrabold bg-gradient-to-r ${isAvailable ? 'from-amber-400 to-orange-400' : 'from-red-400/60 to-red-600/60'} bg-clip-text text-transparent tracking-wider font-mono ${!isAvailable ? 'line-through' : ''}`}>
                  TRADERCEPAT
                </span>
                <div className={`w-7 h-7 sm:w-8 sm:h-8 rounded-lg flex items-center justify-center shrink-0 ${isAvailable ? 'bg-amber-500/20' : 'bg-red-500/20'}`}>
                  {isAvailable
                    ? <Check className="w-4 h-4 sm:w-5 sm:h-5 text-amber-400" />
                    : <X className="w-4 h-4 sm:w-5 sm:h-5 text-red-400" />}
                </div>
              </motion.div>

              {isAvailable && (
                <p className="text-white/30 text-xs mt-3">
                  {language === 'id' ? 'Klik untuk menyalin' : 'Click to copy'}
                </p>
              )}

              {/* Quota Progress Bar */}
              <div className="mt-6 max-w-sm mx-auto">
                <div className="flex justify-between items-center mb-2">
                  <span className="text-white/40 text-xs font-medium">
                    {language === 'id' ? 'Sisa slot' : 'Slots remaining'}
                  </span>
                  <span className={`text-xs font-bold ${isAvailable ? 'text-amber-400' : 'text-red-400'}`}>
                    {promoRemaining !== null ? `${promoRemaining} / ${promoMax}` : '...'}
                  </span>
                </div>
                <div className="h-2.5 bg-white/5 rounded-full overflow-hidden">
                  <motion.div
                    className={`h-full rounded-full transition-colors ${isAvailable ? 'bg-gradient-to-r from-amber-500 to-orange-500' : 'bg-red-500/60'}`}
                    initial={{ width: 0 }}
                    animate={{ width: promoRemaining !== null ? `${((promoMax - promoRemaining) / promoMax) * 100}%` : '0%' }}
                    transition={{ duration: 1, ease: 'easeOut' }}
                  />
                </div>
                <p className="text-white/25 text-[11px] mt-2">
                  {promoRemaining !== null
                    ? (language === 'id'
                      ? `${promoMax - promoRemaining} orang sudah klaim`
                      : `${promoMax - promoRemaining} traders claimed`)
                    : (language === 'id' ? 'Memuat kuota...' : 'Loading quota...')}
                </p>
              </div>
            </div>
          </div>
        </motion.div>
      </div>
    </section>
  )
}