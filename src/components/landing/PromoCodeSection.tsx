'use client'

import React from 'react'
import { motion } from 'framer-motion'
import { Check, X } from 'lucide-react'

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
    <section id="promo" className="py-16 px-4 sm:px-6 lg:px-8">
      <div className="max-w-2xl mx-auto">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, amount: 0.1 }}
          transition={{ duration: 0.6, ease }}
          className="bg-[var(--lux-card-surface)] border border-[var(--lux-inline-border)] rounded-2xl p-8 sm:p-10 text-center"
        >
          <span className="text-[11px] font-medium uppercase tracking-[0.15em] text-[var(--lux-text-secondary)] block mb-6">
            {!isAvailable
              ? (language === 'id' ? 'Kuota Habis' : 'Sold Out')
              : (language === 'id' ? 'Promo Spesial' : 'Special Promo')}
          </span>

          <h3 className="text-xl font-normal text-[var(--lux-text-primary)] mb-2">
            {!isAvailable
              ? (language === 'id' ? 'Promo Sudah Berakhir' : 'Promo Has Ended')
              : (language === 'id' ? '3 Bulan PRO Gratis!' : '3 Months PRO Free!')}
          </h3>
          <p className="text-[var(--lux-text-body)] text-[13px] font-normal leading-[1.7] mb-8">
            {!isAvailable
              ? (language === 'id' ? 'Semua slot promo sudah terpakai' : 'All promo slots have been taken')
              : (language === 'id' ? 'Masukkan kode di dashboard untuk klaim langsung' : 'Enter code in dashboard to claim instantly')}
          </p>

          {/* Code Block */}
          <motion.div
            className={`inline-flex items-center gap-3 px-6 py-4 rounded-xl border transition-all duration-500 ease-[cubic-bezier(0.32,0.72,0,1)] ${isAvailable ? 'bg-transparent border-[var(--lux-inline-border)] hover:border-[#00E5C3]/30 cursor-pointer' : 'bg-transparent border-[var(--lux-inline-border)] opacity-50 cursor-not-allowed'}`}
            whileHover={isAvailable ? { scale: 1.02 } : {}}
            whileTap={isAvailable ? { scale: 0.98 } : {}}
            onClick={() => {
              if (!isAvailable) return
              navigator.clipboard.writeText(promoCode)
              alert(language === 'id' ? 'Kode berhasil disalin!' : 'Code copied!')
            }}
          >
            <span className={`text-2xl font-normal tracking-wider font-mono ${isAvailable ? 'text-[#00E5C3]' : 'text-[var(--lux-text-label)] line-through'}`}>
              {promoCode}
            </span>
            <div className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 ${isAvailable ? 'bg-[#00E5C3]/10' : 'bg-[var(--lux-inline-hover-bg)]'}`}>
              {isAvailable
                ? <Check className="w-4 h-4 text-[#00E5C3]" />
                : <X className="w-4 h-4 text-[var(--lux-text-label)]" />}
            </div>
          </motion.div>

          {isAvailable && (
            <p className="text-[var(--lux-text-label)] text-[11px] mt-3">
              {language === 'id' ? 'Klik untuk menyalin' : 'Click to copy'}
            </p>
          )}

          {/* Quota Bar */}
          <div className="mt-8 max-w-sm mx-auto">
            <div className="flex justify-between items-center mb-2.5">
              <span className="text-[var(--lux-text-label-2)] text-xs font-normal">
                {language === 'id' ? 'Sisa slot' : 'Slots remaining'}
              </span>
              <span className={`text-xs font-normal tabular-nums ${isAvailable ? 'text-[#00E5C3]/80' : 'text-[var(--lux-text-label)]'}`}>
                {promoRemaining !== null ? `${promoRemaining} / ${promoMax}` : '...'}
              </span>
            </div>
            <div className="h-1 bg-white/[0.06] rounded-full overflow-hidden">
              <motion.div
                className={`h-full rounded-full ${isAvailable ? 'bg-[#00E5C3]/60' : 'bg-[var(--lux-text-label)]/30'}`}
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
        </motion.div>
      </div>
    </section>
  )
}