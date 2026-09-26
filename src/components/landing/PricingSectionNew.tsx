'use client'

import React, { useState } from 'react'
import { motion } from 'framer-motion'
import { Check, X, XCircle, Ticket, Lock, ArrowRight, Zap, ShieldCheck } from 'lucide-react'
import Link from 'next/link'

interface PricingSectionNewProps {
  promoCode: string
  promoActive: boolean | null
  promoRemaining: number | null
  promoMax: number
  handleProUpgrade: () => void
  language?: 'id' | 'en'
}

export default function PricingSectionNew({
  promoCode,
  promoActive,
  promoRemaining,
  promoMax,
  handleProUpgrade,
  language = 'id',
}: PricingSectionNewProps) {
  const [localPromo, setLocalPromo] = useState('')
  const [promoApplied, setPromoApplied] = useState(false)
  const [promoError, setPromoError] = useState(false)
  const [isAnnual, setIsAnnual] = useState(false)

  const applyPromo = () => {
    if (localPromo.trim().toUpperCase() === promoCode && promoActive) {
      setPromoApplied(true)
      setPromoError(false)
    } else if (localPromo.trim().toUpperCase() === 'TRADERCEPAT') {
      setPromoApplied(true)
      setPromoError(false)
    } else {
      setPromoApplied(false)
      setPromoError(true)
    }
  }

  // Pricing constants
  const monthlyPrice = 'Rp39K'
  const annualPrice = 'Rp390K'
  const annualSavings = 'Rp78K'
  const monthlyPromoPrice = 'Rp25K'

  return (
    <section id="pricing" className="py-32 relative z-10">
      <div className="max-w-5xl mx-auto px-6">
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, amount: 0.3 }}
          transition={{ duration: 0.5 }}
          className="text-center mb-16"
        >
          <h2 className="text-4xl md:text-5xl font-bold tracking-tight mb-4 text-white">{language === 'en' ? 'Transparent Pricing' : 'Pricing yang Transparan'}</h2>
          <p className="text-gray-400">{language === 'en' ? 'Start free, upgrade whenever you need more power. Have a promo code? Enter it below.' : 'Mulai gratis, upgrade kapan pun butuh lebih banyak power. Punya kode promo? Masukkan di bawah ini.'}</p>

          {/* Annual / Monthly Toggle */}
          <div className="mt-8 inline-flex items-center gap-3 bg-white/[0.04] border border-white/[0.08] rounded-full px-2 py-1.5">
            <button
              onClick={() => setIsAnnual(false)}
              className={`px-4 py-1.5 rounded-full text-sm font-medium transition-colors cursor-pointer ${
                !isAnnual
                  ? 'bg-white/10 text-white shadow-sm'
                  : 'text-gray-400 hover:text-gray-300'
              }`}
            >
              {language === 'en' ? 'Monthly' : 'Bulanan'}
            </button>
            <button
              onClick={() => setIsAnnual(true)}
              className={`px-4 py-1.5 rounded-full text-sm font-medium transition-colors cursor-pointer ${
                isAnnual
                  ? 'bg-white/10 text-white shadow-sm'
                  : 'text-gray-400 hover:text-gray-300'
              }`}
            >
              {language === 'en' ? 'Annual' : 'Tahunan'}
            </button>
            {isAnnual && (
              <motion.span
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1 }}
                className="inline-flex items-center gap-1 bg-emerald-500/15 text-emerald-400 text-[11px] font-semibold px-2.5 py-0.5 rounded-full border border-emerald-500/25"
              >
                <Zap className="w-3 h-3" />
                {language === 'en' ? `Save ${annualSavings}` : `Hemat ${annualSavings}`}
              </motion.span>
            )}
          </div>
        </motion.div>

        <div className="grid md:grid-cols-2 gap-8">
          {/* FREE CARD */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5, delay: 0.1 }}
            className="glass-lux p-8 flex flex-col"
          >
            <h3 className="text-xl font-bold mb-2 text-white">{language === 'en' ? 'Free' : 'Gratis'}</h3>
            <p className="text-gray-400 text-sm mb-6">{language === 'en' ? 'For traders just starting their journaling journey.' : 'Untuk trader yang baru mulai journaling.'}</p>
            <div className="mb-6">
              <span className="text-4xl font-bold text-white">{language === 'en' ? '$0' : 'Rp0'}</span>
              <span className="text-gray-500">{language === 'en' ? '/month' : '/bulan'}</span>
            </div>
            <ul className="space-y-3 mb-8 text-gray-400 text-sm flex-grow">
              <li className="flex items-center gap-2"><Check className="w-4 h-4 text-emerald-400" /> {language === 'en' ? '10 Trade Entries / month' : '10 Trade Entries / bulan'}</li>
              <li className="flex items-center gap-2"><Check className="w-4 h-4 text-emerald-400" /> {language === 'en' ? '10 AI Queries / month' : '10 AI Queries / bulan'}</li>
              <li className="flex items-center gap-2"><Check className="w-4 h-4 text-emerald-400" /> {language === 'en' ? 'Basic Analytics' : 'Analitik Dasar'}</li>
              <li className="flex items-center gap-2"><Check className="w-4 h-4 text-emerald-400" /> {language === 'en' ? 'Manual Journal Input' : 'Input Jurnal Manual'}</li>
              <li className="flex items-center gap-2"><X className="w-4 h-4 text-gray-600" /> {language === 'en' ? 'AI Pattern Detection' : 'Deteksi Pola AI'}</li>
            </ul>
            <Link href="/auth/signup">
              <span className="block w-full py-3 border border-white/10 rounded-xl hover:bg-white/5 transition-colors text-sm font-medium text-white text-center cursor-pointer">
                {language === 'en' ? 'Start Free' : 'Mulai Gratis'}
              </span>
            </Link>
          </motion.div>

          {/* PRO CARD with glow effect */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5, delay: 0.2 }}
            className="relative flex flex-col"
          >
            {/* Animated glow border wrapper */}
            <div className="absolute -inset-[1px] rounded-2xl overflow-hidden pointer-events-none">
              <div className="absolute inset-0 rounded-2xl border-glow-animated" />
            </div>
            <div className="glass-lux p-8 relative flex flex-col rounded-2xl" style={{ background: 'rgba(59, 130, 246, 0.05)' }}>
              <div className="absolute top-0 right-8 -translate-y-1/2 bg-gradient-to-r from-blue-500 to-cyan-400 text-white text-xs px-3 py-1 rounded-full font-mono">
                {language === 'en' ? 'MOST POPULAR' : 'PALING POPULER'}
              </div>
              <h3 className="text-xl font-bold mb-2 text-cyan-400">{language === 'en' ? 'PRO' : 'PRO'}</h3>
              <p className="text-gray-400 text-sm mb-6">{language === 'en' ? 'For serious traders building an edge and passing prop firms.' : 'Untuk serius membangun edge dan lewati prop firm.'}</p>

              <div className="mb-6">
                {promoApplied ? (
                  <div className="flex items-end gap-2 transition-colors">
                    <span className="text-gray-500 line-through text-xl mr-2">
                      {isAnnual ? annualPrice : monthlyPrice}
                    </span>
                    <span className="text-4xl font-bold text-cyan-400">
                      {isAnnual ? 'Rp250K' : monthlyPromoPrice}
                    </span>
                    <span className="text-gray-500 pb-1">
                      {isAnnual
                        ? (language === 'en' ? '/year' : '/tahun')
                        : (language === 'en' ? '/month' : '/bulan')}
                    </span>
                  </div>
                ) : (
                  <div className="flex items-end gap-2">
                    {isAnnual && (
                      <span className="text-gray-500 line-through text-base mr-1 pb-0.5">
                        {language === 'en' ? 'Rp468K' : 'Rp468K'}
                      </span>
                    )}
                    <span className="text-4xl font-bold text-white">
                      {isAnnual ? annualPrice : monthlyPrice}
                    </span>
                    <span className="text-gray-500 pb-1">
                      {isAnnual
                        ? (language === 'en' ? '/year' : '/tahun')
                        : (language === 'en' ? '/month' : '/bulan')}
                    </span>
                  </div>
                )}
                {isAnnual && !promoApplied && (
                  <motion.p
                    initial={{ opacity: 0, y: 4 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="mt-1 text-xs text-emerald-400 font-medium"
                  >
                    {language === 'en'
                      ? '~17% off compared to monthly'
                      : '~17% lebih murah dari bulanan'}
                  </motion.p>
                )}
                {promoApplied && (
                  <div className="mt-2 flex items-center gap-2 text-xs font-mono bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 px-3 py-1.5 rounded-full w-fit animate-float-lux">
                    <Check className="w-3 h-3" />
                    <span>{language === 'en' ? 'Promo Applied: Special Discount Active!' : 'Promo Terpakai: Diskon Spesial Aktif!'}</span>
                  </div>
                )}
              </div>

              <ul className="space-y-3 mb-6 text-gray-300 text-sm flex-grow">
                <li className="flex items-center gap-2"><Check className="w-4 h-4 text-emerald-400" /> {language === 'en' ? 'Unlimited Trade Entries' : 'Trade Entries Tak Terbatas'}</li>
                <li className="flex items-center gap-2"><Check className="w-4 h-4 text-emerald-400" /> {language === 'en' ? 'Advanced Analytics & Equity Curve' : 'Analitik Lanjutan & Equity Curve'}</li>
                <li className="flex items-center gap-2"><Check className="w-4 h-4 text-emerald-400" /> {language === 'en' ? 'Auto Extract MT5/TV (AI Vision)' : 'Auto Extract MT5/TV (AI Vision)'}</li>
                <li className="flex items-center gap-2"><Check className="w-4 h-4 text-emerald-400" /> {language === 'en' ? 'AI Pattern Detection & Guard' : 'Deteksi Pola AI & Guard'}</li>
                {/* New Pro features */}
                <li className="flex items-center gap-2"><Check className="w-4 h-4 text-emerald-400" /> {language === 'en' ? 'Priority Support' : 'Prioritas Support'}</li>
                <li className="flex items-center gap-2"><Check className="w-4 h-4 text-emerald-400" /> {language === 'en' ? 'Export CSV & PDF' : 'Ekspor CSV & PDF'}</li>
                <li className="flex items-center gap-2"><Check className="w-4 h-4 text-emerald-400" /> {language === 'en' ? 'Unlimited Journal Entries' : 'Jurnal Tak Terbatas'}</li>
                <li className="flex items-center gap-2"><Check className="w-4 h-4 text-emerald-400" /> {language === 'en' ? 'Trading Score & Psychology' : 'Skor Trading & Psikologi'}</li>
              </ul>

              {/* Promo Input */}
              <div className="mb-6 pt-4 border-t border-white/10">
                <div className="flex items-center gap-2 mb-2">
                  <Ticket className="w-4 h-4 text-cyan-400" />
                  <span className="text-sm text-gray-300 font-medium">{language === 'en' ? 'Have a Promo Code?' : 'Punya Kode Promo?'}</span>
                </div>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={localPromo}
                    onChange={(e) => { setLocalPromo(e.target.value); setPromoError(false); setPromoApplied(false) }}
                    placeholder={language === 'en' ? 'Enter code (e.g. TRADERCEPAT)' : 'Masukkan kode (cth: TRADERCEPAT)'}
                    className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-cyan-400 transition-colors font-mono text-white"
                    onKeyDown={(e) => e.key === 'Enter' && applyPromo()}
                  />
                  <button
                    onClick={applyPromo}
                    className="px-4 py-2 bg-white/10 rounded-lg text-sm hover:bg-white/20 transition-colors font-medium text-white cursor-pointer"
                  >
                    {language === 'en' ? 'Apply' : 'Terapkan'}
                  </button>
                </div>
                {promoError && (
                  <p className="mt-2 text-xs text-red-400 font-mono flex items-center gap-1">
                    <XCircle className="w-3 h-3" /> {language === 'en' ? 'Invalid or expired promo code.' : 'Kode promo tidak valid atau kedaluwarsa.'}
                  </p>
                )}
              </div>

              <button
                onClick={handleProUpgrade}
                className="w-full py-3 bg-gradient-to-r from-blue-500 to-cyan-400 rounded-xl hover:opacity-90 transition-all text-sm font-medium text-white glow-bg-luxury flex items-center justify-center gap-2 cursor-pointer"
              >
                {language === 'en' ? 'Upgrade to PRO' : 'Upgrade ke PRO'}
                <ArrowRight className="w-4 h-4" />
              </button>
              {/* Payment security badges */}
              <p className="mt-4 text-center text-xs text-gray-500 flex items-center justify-center gap-2">
                <Lock className="w-3 h-3" /> {language === 'en' ? 'Secure payment via Midtrans 🔒' : 'Pembayaran aman via Midtrans 🔒'}
              </p>
              <p className="mt-1.5 text-center text-xs text-gray-500 flex items-center justify-center gap-1.5">
                <ShieldCheck className="w-3 h-3" /> {language === 'en' ? 'No auto-renew. Cancel anytime.' : 'Tanpa auto-renew. Bisa cancel kapan pun.'}
              </p>
            </div>
          </motion.div>
        </div>
      </div>
    </section>
  )
}
