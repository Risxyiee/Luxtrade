'use client'

import React from 'react'
import { motion } from 'framer-motion'
import Link from 'next/link'
import { Crown, BookOpen, Zap, AlertTriangle, Lock, Shield, CreditCard } from 'lucide-react'
import { PricingSvg } from './SectionSvgArt'
import LifetimeUltraCard from './LifetimeUltraCard'

interface PricingSectionProps {
  language: 'id' | 'en'
  t: (key: string) => string
  payLoading: string | null
  handleProUpgrade: () => void
  handleLifetimeUpgrade: () => void
  promoRemaining: number | null
}

export default function PricingSection({ language, t, payLoading, handleProUpgrade, handleLifetimeUpgrade, promoRemaining }: PricingSectionProps) {
  return (
    <section id="pricing" className="relative w-full py-24 lg:py-32 overflow-hidden">
      <PricingSvg />
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5 }}
          className="mb-14"
        >
          <p className="text-[12px] font-medium tracking-[0.18em] uppercase text-[#8892b0] mb-3">
            {language === 'id' ? 'HARGA' : 'PRICING'}
          </p>
          <h2 className="text-3xl md:text-[40px] font-medium tracking-tight text-[#f0f2ff] leading-tight">
            {language === 'id' ? 'Harga sederhana. Serius power.' : 'Simple pricing. Serious power.'}
          </h2>
          <p className="text-[15px] text-[#8892b0] max-w-md mt-4 leading-relaxed">
            {t('pricing.subtitle')}
          </p>
        </motion.div>

        <div className="flex flex-col lg:flex-row gap-8 w-full justify-center max-w-[1200px] mx-auto">
          {/* Free Plan */}
          <motion.div initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true, amount: 0.1 }} transition={{ delay: 0.1 }} className="flex-1 flex flex-col bg-[#0a0a1a] border border-white/[0.08] rounded-2xl overflow-hidden min-w-[280px]">
            <div className="flex flex-col items-center flex-grow p-8 pt-10">
              <div className="flex items-center justify-center mb-6">
                <BookOpen className="w-5 h-5 text-blue-400" />
                <div className="w-3" />
                <h3 className="text-2xl font-medium text-[#f0f2ff]">{t('pricing.free.title')}</h3>
              </div>
              <p className="text-[13px] text-[#8892b0] text-center mb-6 leading-relaxed">{t('pricing.free.desc')}</p>
              <div className="text-3xl font-medium text-[#f0f2ff] text-center mb-8">{t('pricing.free.price').split(' /')[0]}</div>
              <div className="flex flex-col gap-3.5 w-full mb-8">
                {[
                  language === 'id' ? '10 jurnal per bulan' : '10 journals per month',
                  language === 'id' ? 'Grafik performa standar' : 'Standard performance charts',
                  language === 'id' ? 'Kalkulator risiko pemula' : 'Basic risk calculator',
                  language === 'id' ? '3x trial AI analysis' : '3x AI analysis trials',
                ].map((item, index) => (
                  <div key={index} className="flex items-start gap-3 text-[13px] text-[#8892b0]">
                    <Zap className="w-4 h-4 text-blue-400 shrink-0 mt-0.5" />
                    <span>{item}</span>
                  </div>
                ))}
              </div>
            </div>
            <div className="p-6 pt-0">
              <Link href="/auth/signup" className="w-full flex items-center justify-center h-12 rounded-xl border border-white/[0.1] text-[#f0f2ff] text-[14px] font-medium hover:bg-white/[0.03] active:scale-[0.98] transition-all duration-200">
                {t('pricing.cta.free')}
              </Link>
            </div>
          </motion.div>

          {/* Pro - Highlighted */}
          <motion.div initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true, amount: 0.1 }} transition={{ delay: 0.2 }} className="flex-1 flex flex-col bg-[#0a0a1a] border border-blue-500/30 rounded-2xl overflow-hidden min-w-[280px] relative">
            <div className="absolute -top-3 left-1/2 -translate-x-1/2 px-3 py-1 rounded-full bg-blue-500 text-white text-[11px] font-medium">
              {language === 'id' ? 'Paling Populer' : 'Most Popular'}
            </div>
            <div className="flex flex-col items-center flex-grow p-8 pt-10">
              <div className="flex items-center justify-center mb-6">
                <Crown className="w-5 h-5 text-blue-400" />
                <div className="w-3" />
                <h3 className="text-2xl font-medium text-[#f0f2ff]">{t('pricing.pro.title')}</h3>
              </div>
              <p className="text-[13px] text-[#8892b0] text-center mb-6 leading-relaxed">{t('pricing.pro.desc')}</p>
              <div className="text-3xl font-medium text-[#f0f2ff] text-center mb-8">
                {t('pricing.pro.price').split(' /')[0]}
                <span className="text-base font-normal text-[#8892b0]"> / {language === 'id' ? 'bulan' : 'mo'}</span>
              </div>
              <div className="flex flex-col gap-3.5 w-full mb-8">
                {[
                  language === 'id' ? 'Unlimited jurnal tanpa batas' : 'Unlimited journals, no limits',
                  language === 'id' ? 'AI analisis deteksi kesalahan' : 'AI mistake detection analysis',
                  language === 'id' ? 'Grafik win-rate & mistake tracker' : 'Win-rate charts & mistake tracker',
                  language === 'id' ? 'Kalkulator risiko advance' : 'Advanced risk calculator',
                  language === 'id' ? 'Export Excel / PDF' : 'Excel / PDF export',
                  language === 'id' ? 'VIP support & grup' : 'VIP support & group access',
                ].map((item, index) => (
                  <div key={index} className="flex items-start gap-3 text-[13px] text-[#8892b0]">
                    <Zap className="w-4 h-4 text-blue-400 shrink-0 mt-0.5" />
                    <span>{item}</span>
                  </div>
                ))}
              </div>
            </div>
            <div className="p-6 pt-0">
              <button onClick={handleProUpgrade} disabled={payLoading === 'PRO_30_DAYS'} className="w-full flex items-center justify-center h-12 rounded-xl bg-blue-500 text-white text-[14px] font-medium hover:bg-blue-600 active:scale-[0.98] transition-all duration-200 disabled:opacity-60">
                {payLoading === 'PRO_30_DAYS' ? 'Membuka pembayaran...' : t('pricing.cta.upgrade')}
              </button>
            </div>
          </motion.div>

          {/* Lifetime Ultra */}
          <div className="flex-1 min-w-[280px]">
            <LifetimeUltraCard onButtonClick={handleLifetimeUpgrade} language={language} t={t} />
          </div>
        </div>

        {/* Comparison Table */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ delay: 0.2 }}
          className="mt-16 max-w-[900px] mx-auto"
        >
          <div className="overflow-x-auto -mx-4 px-4">
          <div className="min-w-[640px]">
          <div className="border border-white/[0.08] rounded-2xl overflow-hidden">
            <div className="grid grid-cols-4 gap-0 border-b border-white/[0.08]">
              <div className="p-4 text-[12px] font-medium text-[#8892b0] uppercase tracking-wider">
                {language === 'id' ? 'Fitur' : 'Feature'}
              </div>
              <div className="p-4 text-[13px] font-medium text-[#f0f2ff] text-center">Free</div>
              <div className="p-4 text-[13px] font-medium text-blue-400 text-center relative">
                PRO
                <span className="absolute top-1/2 right-2 -translate-y-1/2 text-[9px] bg-blue-500/15 text-blue-400 px-1.5 py-0.5 rounded-full font-medium">
                  POPULER
                </span>
              </div>
              <div className="p-4 text-[13px] font-medium text-amber-400 text-center">Lifetime</div>
            </div>

            {[
              { id: language === 'id' ? 'Jurnal per bulan' : 'Journals/month', free: '10', pro: 'Unlimited', lifetime: 'Unlimited', highlight: false },
              { id: language === 'id' ? 'Analisis AI' : 'AI Analysis', free: '3x trial', pro: 'Unlimited', lifetime: 'Unlimited', highlight: false },
              { id: language === 'id' ? 'Deteksi kesalahan berulang' : 'Mistake pattern detection', free: '✕', pro: '✓', lifetime: '✓', highlight: false },
              { id: language === 'id' ? 'Grafik performa' : 'Performance charts', free: language === 'id' ? 'Standar' : 'Standard', pro: 'Advanced', lifetime: 'Advanced', highlight: false },
              { id: language === 'id' ? 'Kalkulator risiko' : 'Risk calculator', free: language === 'id' ? 'Pemula' : 'Basic', pro: 'Advanced', lifetime: 'Advanced', highlight: false },
              { id: language === 'id' ? 'Export Excel / PDF' : 'Export Excel / PDF', free: '✕', pro: '✓', lifetime: '✓', highlight: false },
              { id: language === 'id' ? 'Screenshot AI extract' : 'Screenshot AI extract', free: '✕', pro: '✓', lifetime: '✓', highlight: false },
              { id: language === 'id' ? 'Analisis psikologi trading' : 'Trading psychology analysis', free: '✕', pro: '✓', lifetime: '✓', highlight: false },
              { id: language === 'id' ? 'VIP support & grup' : 'VIP support & group', free: '✕', pro: '✓', lifetime: '✓', highlight: false },
              { id: language === 'id' ? 'Discord privat' : 'Private Discord', free: '✕', pro: '✕', lifetime: '✓', highlight: true },
            ].map((row, i) => (
              <div key={i} className={`grid grid-cols-4 gap-0 border-b border-white/[0.04] last:border-0 ${row.highlight ? 'bg-blue-500/[0.02]' : ''}`}>
                <div className="p-3.5 text-[13px] text-[#8892b0]">{row.id}</div>
                <div className="p-3.5 text-[13px] text-[#8892b0] text-center">
                  {row.free === '✕' ? <span className="text-[#f0f2ff]/20">—</span> : row.free}
                </div>
                <div className={`p-3.5 text-[13px] text-center font-medium ${row.pro === '✕' ? 'text-[#f0f2ff]/20' : 'text-blue-400'}`}>
                  {row.pro === '✓'
                    ? <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-blue-500/15 text-blue-400 text-xs">✓</span>
                    : row.pro === '✕' ? <span className="text-[#f0f2ff]/20">—</span> : row.pro
                  }
                </div>
                <div className={`p-3.5 text-[13px] text-center font-medium ${row.lifetime === '✓' || row.highlight ? 'text-amber-400' : 'text-[#8892b0]'}`}>
                  {row.lifetime === '✓'
                    ? <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-amber-500/15 text-amber-400 text-xs">✓</span>
                    : row.lifetime === '✕' ? <span className="text-[#f0f2ff]/20">—</span> : row.lifetime
                  }
                </div>
              </div>
            ))}
          </div>
          </div>
          </div>
        </motion.div>

        {/* Notice */}
        <div className="flex justify-center mt-10">
          <div className="inline-flex items-center gap-2.5 px-4 py-2 bg-white/[0.03] border border-white/[0.06] rounded-xl">
            <AlertTriangle className="w-3.5 h-3.5 text-[#8892b0]" />
            <span className="text-[#8892b0] text-[11px] font-medium">{language === 'id' ? 'Produk Digital — Non-Refundable' : 'Digital Product — Non-Refundable'}</span>
          </div>
        </div>

        {/* Trust Badges */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="flex flex-col items-center gap-3 mt-10"
        >
          <div className="inline-flex items-center gap-3 px-5 py-3 bg-[#0a0a1a] border border-white/[0.08] rounded-xl">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-lg bg-[#42B549]/15 border border-[#42B549]/30 flex items-center justify-center">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
                  <path d="M3 7.5C3 5.01 5.01 3 7.5 3h9C18.99 3 21 5.01 21 7.5v9c0 2.49-2.01 4.5-4.5 4.5h-9C5.01 21 3 18.99 3 16.5v-9z" fill="#42B549"/>
                  <path d="M8 8h8v2H8zM8 12h6v2H8zM8 16h7v2H8z" fill="white" opacity="0.9"/>
                </svg>
              </div>
              <div>
                <span className="text-[13px] font-medium text-[#f0f2ff]">Midtrans</span>
                <span className="text-[10px] text-[#8892b0] block">{language === 'id' ? 'Payment Gateway Resmi' : 'Official Payment Gateway'}</span>
              </div>
            </div>
            <div className="w-px h-8 bg-white/[0.08]" />
            <div className="flex items-center gap-1.5">
              <Lock className="w-3.5 h-3.5 text-emerald-400" />
              <span className="text-[11px] text-[#8892b0]">{language === 'id' ? 'Pembayaran Aman & Terenkripsi' : 'Secure & Encrypted'}</span>
            </div>
          </div>

          <div className="inline-flex items-center gap-3">
            <div className="flex items-center gap-1.5 px-3 py-1.5 bg-white/[0.03] border border-white/[0.06] rounded-lg">
              <Zap className="w-3 h-3 text-blue-400" />
              <span className="text-[11px] text-[#8892b0] font-medium">{language === 'id' ? 'Aktivasi Instan' : 'Instant Activation'}</span>
            </div>
            <div className="flex items-center gap-1.5 px-3 py-1.5 bg-white/[0.03] border border-white/[0.06] rounded-lg">
              <Shield className="w-3 h-3 text-emerald-400" />
              <span className="text-[11px] text-[#8892b0] font-medium">{language === 'id' ? 'Data Terproteksi' : 'Data Protected'}</span>
            </div>
            <div className="flex items-center gap-1.5 px-3 py-1.5 bg-white/[0.03] border border-white/[0.06] rounded-lg">
              <CreditCard className="w-3 h-3 text-amber-400" />
              <span className="text-[11px] text-[#8892b0] font-medium">{language === 'id' ? 'Semua Metode Bayar' : 'All Payment Methods'}</span>
            </div>
          </div>
        </motion.div>
      </div>
    </section>
  )
}
