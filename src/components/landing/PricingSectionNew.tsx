'use client'

import React, { useState } from 'react'
import { motion } from 'framer-motion'
import { Check, X, XCircle, Ticket, Lock, ArrowRight } from 'lucide-react'
import Link from 'next/link'

interface PricingSectionNewProps {
  promoCode: string
  promoActive: boolean | null
  promoRemaining: number | null
  promoMax: number
  handleProUpgrade: () => void
  payLoading: string | null
}

export default function PricingSectionNew({
  promoCode,
  promoActive,
  promoRemaining,
  promoMax,
  handleProUpgrade,
  payLoading,
}: PricingSectionNewProps) {
  const [localPromo, setLocalPromo] = useState('')
  const [promoApplied, setPromoApplied] = useState(false)
  const [promoError, setPromoError] = useState(false)

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
          <h2 className="text-4xl md:text-5xl font-bold tracking-tight mb-4 text-white">Pricing yang Transparan</h2>
          <p className="text-gray-400">Mulai gratis, upgrade kapan pun butuh lebih banyak power. Punya kode promo? Masukkan di bawah ini.</p>
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
            <h3 className="text-xl font-bold mb-2 text-white">Free</h3>
            <p className="text-gray-400 text-sm mb-6">Untuk trader yang baru mulai journaling.</p>
            <div className="mb-6">
              <span className="text-4xl font-bold text-white">Rp0</span>
              <span className="text-gray-500">/bulan</span>
            </div>
            <ul className="space-y-3 mb-8 text-gray-400 text-sm flex-grow">
              <li className="flex items-center gap-2"><Check className="w-4 h-4 text-emerald-400" /> 10 Trade Entries / bulan</li>
              <li className="flex items-center gap-2"><Check className="w-4 h-4 text-emerald-400" /> Basic Analytics</li>
              <li className="flex items-center gap-2"><Check className="w-4 h-4 text-emerald-400" /> Manual Journal Input</li>
              <li className="flex items-center gap-2"><X className="w-4 h-4 text-gray-600" /> AI Pattern Detection</li>
            </ul>
            <Link href="/auth/signup">
              <span className="block w-full py-3 border border-white/10 rounded-xl hover:bg-white/5 transition-all text-sm font-medium text-white text-center cursor-pointer">
                Mulai Gratis
              </span>
            </Link>
          </motion.div>

          {/* PRO CARD */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5, delay: 0.2 }}
            className="glass-lux p-8 relative flex flex-col"
            style={{ background: 'rgba(59, 130, 246, 0.05)' }}
          >
            <div className="absolute top-0 right-8 -translate-y-1/2 bg-gradient-to-r from-blue-500 to-cyan-400 text-white text-xs px-3 py-1 rounded-full font-mono">
              POPULAR
            </div>
            <h3 className="text-xl font-bold mb-2 text-cyan-400">PRO</h3>
            <p className="text-gray-400 text-sm mb-6">Untuk serius membangun edge dan lewati prop firm.</p>

            <div className="mb-6">
              {promoApplied ? (
                <div className="flex items-end gap-2 transition-all">
                  <span className="text-gray-500 line-through text-xl mr-2">Rp39K</span>
                  <span className="text-4xl font-bold text-cyan-400">Rp25K</span>
                  <span className="text-gray-500 pb-1">/bulan</span>
                </div>
              ) : (
                <div className="flex items-end gap-2">
                  <span className="text-4xl font-bold text-white">Rp39K</span>
                  <span className="text-gray-500 pb-1">/bulan</span>
                </div>
              )}
              {promoApplied && (
                <div className="mt-2 flex items-center gap-2 text-xs font-mono bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 px-3 py-1.5 rounded-full w-fit animate-float-lux">
                  <Check className="w-3 h-3" />
                  <span>Promo Terpakai: Diskon Spesial Aktif!</span>
                </div>
              )}
            </div>

            <ul className="space-y-3 mb-6 text-gray-300 text-sm flex-grow">
              <li className="flex items-center gap-2"><Check className="w-4 h-4 text-emerald-400" /> Unlimited Trade Entries</li>
              <li className="flex items-center gap-2"><Check className="w-4 h-4 text-emerald-400" /> Advanced Analytics & Equity Curve</li>
              <li className="flex items-center gap-2"><Check className="w-4 h-4 text-emerald-400" /> Auto Extract MT5/TV (AI Vision)</li>
              <li className="flex items-center gap-2"><Check className="w-4 h-4 text-emerald-400" /> AI Pattern Detection & Guard</li>
            </ul>

            {/* Promo Input */}
            <div className="mb-6 pt-4 border-t border-white/10">
              <div className="flex items-center gap-2 mb-2">
                <Ticket className="w-4 h-4 text-cyan-400" />
                <span className="text-sm text-gray-300 font-medium">Punya Kode Promo?</span>
              </div>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={localPromo}
                  onChange={(e) => { setLocalPromo(e.target.value); setPromoError(false); setPromoApplied(false) }}
                  placeholder="Masukkan kode (cth: TRADERCEPAT)"
                  className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-cyan-400 transition-colors font-mono text-white"
                  onKeyDown={(e) => e.key === 'Enter' && applyPromo()}
                />
                <button
                  onClick={applyPromo}
                  className="px-4 py-2 bg-white/10 rounded-lg text-sm hover:bg-white/20 transition-colors font-medium text-white cursor-pointer"
                >
                  Terapkan
                </button>
              </div>
              {promoError && (
                <p className="mt-2 text-xs text-red-400 font-mono flex items-center gap-1">
                  <XCircle className="w-3 h-3" /> Kode promo tidak valid atau kedaluwarsa.
                </p>
              )}
            </div>

            <button
              onClick={handleProUpgrade}
              disabled={!!payLoading}
              className="w-full py-3 bg-gradient-to-r from-blue-500 to-cyan-400 rounded-xl hover:opacity-90 transition-all text-sm font-medium text-white glow-bg-luxury flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
            >
              {payLoading ? 'Memproses...' : 'Upgrade ke PRO'}
              <ArrowRight className="w-4 h-4" />
            </button>
            <p className="mt-4 text-center text-xs text-gray-500 flex items-center justify-center gap-2">
              <Lock className="w-3 h-3" /> Dijamin aman via Midtrans
            </p>
          </motion.div>
        </div>
      </div>
    </section>
  )
}
