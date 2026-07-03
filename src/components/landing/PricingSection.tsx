'use client'

import React from 'react'
import { motion } from 'framer-motion'
import Link from 'next/link'
import { Crown, BookOpen, Zap, AlertTriangle, Lock } from 'lucide-react'
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
    <section id="pricing" className="w-full pb-20">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex flex-col items-center mb-16">
          {/* Unique badge: gold/amber accent for pricing */}
          <div className="inline-flex items-center gap-2.5 px-5 py-2 rounded-full bg-amber-500/10 border border-amber-500/25 mb-6">
            <Crown className="w-4 h-4 text-amber-400" />
            <span className="text-sm font-bold text-amber-300">
              {language === 'id' ? 'Pilih Paket' : 'Choose Plan'}
            </span>
          </div>
          <p className="text-[var(--lux-text-subtitle)] max-w-[320px] md:max-w-2xl text-center text-base md:text-lg leading-relaxed">
            {t('pricing.subtitle')}
          </p>
        </div>

        <div className="flex flex-col lg:flex-row gap-8 w-full justify-center max-w-[1200px] mx-auto">
          {/* Free Plan */}
          <motion.div initial={{ opacity: 0, y: 30 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ delay: 0.1 }} className="flex-1 flex flex-col bg-[var(--lux-card-surface)] backdrop-blur-sm border border-[var(--lux-inline-border)] rounded-3xl overflow-hidden min-w-[280px]">
            <div className="flex flex-col items-center flex-grow p-8 pt-10">
              <div className="flex items-center justify-center mb-6">
                <BookOpen className="w-5 h-5 text-purple-400" />
                <div className="w-3" />
                <h3 className="text-2xl font-bold text-[var(--lux-text-primary)]">{t('pricing.free.title')}</h3>
              </div>
              <p className="text-[12px] text-[var(--lux-text-body)] text-center mb-6 leading-relaxed">{t('pricing.free.desc')}</p>
              <div className="text-3xl font-extrabold text-[var(--lux-text-primary)] text-center mb-8">{t('pricing.free.price').split(' /')[0]}</div>
              <div className="flex flex-col gap-3.5 w-full mb-8">
                {[
                  language === 'id' ? '10 jurnal per bulan' : '10 journals per month',
                  language === 'id' ? 'Grafik performa standar' : 'Standard performance charts',
                  language === 'id' ? 'Kalkulator risiko pemula' : 'Basic risk calculator',
                  language === 'id' ? '3x trial AI analysis' : '3x AI analysis trials',
                ].map((item, index) => (
                  <div key={index} className="flex items-start gap-3 text-sm text-[var(--lux-text-body-2)]">
                    <Zap className="w-4 h-4 text-purple-400 shrink-0 mt-0.5" />
                    <span>{item}</span>
                  </div>
                ))}
              </div>
            </div>
            <div className="p-6 pt-0">
              <Link href="/auth/signup" className="block">
                <button className="w-full flex items-center justify-center h-[52px] rounded-2xl bg-[var(--lux-inline-hover-bg)] border border-[var(--lux-inline-border)] hover:bg-[var(--lux-inline-hover-bg-3)] transition active:scale-95 text-[var(--lux-text-primary)] font-medium">
                  {t('pricing.cta.free')} →
                </button>
              </Link>
            </div>
          </motion.div>

          {/* Elite Pro - Highlighted */}
          <motion.div initial={{ opacity: 0, y: 30 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ delay: 0.2 }} className="flex-1 flex flex-col bg-gradient-to-b from-purple-500/20 via-white/5 to-purple-500/10 border border-purple-500/40 rounded-3xl overflow-hidden min-w-[280px] relative">
            <motion.div className="absolute -top-3 left-1/2 -translate-x-1/2 px-4 py-1.5 rounded-full bg-gradient-to-r from-purple-500 to-blue-500 text-xs font-bold text-white" animate={{ boxShadow: ['0 0 0 0 rgba(139, 92, 246, 0.7)', '0 0 0 10px rgba(139, 92, 246, 0)', '0 0 0 0 rgba(139, 92, 246, 0.7)'] }} transition={{ duration: 2, repeat: Infinity }}>
              {language === 'id' ? 'Paling Populer' : 'Most Popular'}
            </motion.div>
            <div className="flex flex-col items-center flex-grow p-8 pt-10">
              <div className="flex items-center justify-center mb-6">
                <Crown className="w-5 h-5 text-purple-400" />
                <div className="w-3" />
                <h3 className="text-2xl font-bold text-[var(--lux-text-primary)]">{t('pricing.pro.title')}</h3>
              </div>
              <p className="text-[12px] text-[var(--lux-text-body)] text-center mb-6 leading-relaxed">{t('pricing.pro.desc')}</p>
              <div className="text-3xl font-extrabold text-[var(--lux-text-primary)] text-center mb-8">
                {t('pricing.pro.price').split(' /')[0]}
                <span className="text-base font-normal text-[var(--lux-text-label-2)]"> / {language === 'id' ? 'bulan' : 'mo'}</span>
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
                  <div key={index} className="flex items-start gap-3 text-sm text-[var(--lux-text-body-2)]">
                    <Zap className="w-4 h-4 text-purple-400 shrink-0 mt-0.5" />
                    <span>{item}</span>
                  </div>
                ))}
              </div>
            </div>
            <div className="p-6 pt-0">
              <button onClick={handleProUpgrade} disabled={payLoading === 'PRO_30_DAYS'} className="w-full flex items-center justify-center h-[52px] rounded-2xl bg-gradient-to-r from-purple-500 to-blue-600 hover:from-purple-600 hover:to-blue-700 transition shadow-lg shadow-purple-500/20 active:scale-95 text-white font-medium disabled:opacity-60">
                {payLoading === 'PRO_30_DAYS' ? 'Membuka pembayaran...' : `${t('pricing.cta.upgrade')} →`}
              </button>
            </div>
          </motion.div>

          {/* Lifetime Ultra */}
          <div className="flex-1 min-w-[280px]">
            <LifetimeUltraCard onButtonClick={handleLifetimeUpgrade} language={language} t={t} promoRemaining={promoRemaining} />
          </div>
        </div>

        {/* Non-refundable notice */}
        <div className="flex justify-center mt-10">
          <div className="inline-flex items-center gap-3 px-5 py-2.5 bg-[var(--lux-inline-hover-bg)] border border-[var(--lux-inline-border)] rounded-xl">
            <AlertTriangle className="w-4 h-4 text-[var(--lux-text-label-2)]" />
            <span className="text-[var(--lux-text-subtitle)] text-xs font-bold">{language === 'id' ? 'Produk Digital — Non-Refundable' : 'Digital Product — Non-Refundable'}</span>
          </div>
        </div>

        {/* Payment Gateway Trust Badge */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="flex justify-center mt-6"
        >
          <div className="inline-flex items-center gap-3 px-5 py-3 bg-[var(--lux-inline-hover-bg)] border border-[var(--lux-inline-border)] rounded-2xl">
            <div className="flex items-center gap-2">
              {/* Midtrans Logo */}
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" className="shrink-0">
                <rect width="24" height="24" rx="6" fill="var(--lux-icon-circle-bg)"/>
                <path d="M6 8h12v2H6zM6 12h8v2H6zM6 16h10v2H6z" fill="#42B549"/>
                <circle cx="19" cy="16" r="3" fill="#42B549"/>
              </svg>
              <span className="text-[var(--lux-text-body)] text-xs font-bold tracking-wide">MIDTRANS</span>
            </div>
            <div className="w-px h-4 bg-[var(--lux-inline-border)]" />
            <div className="flex items-center gap-1.5">
              <Lock className="w-3 h-3 text-emerald-400/70" />
              <span className="text-[var(--lux-text-label-2)] text-[11px]">{language === 'id' ? 'Pembayaran Aman & Terenkripsi' : 'Secure & Encrypted Payments'}</span>
            </div>
            <div className="w-px h-4 bg-[var(--lux-inline-border)]" />
            <div className="flex items-center gap-1.5">
              <Zap className="w-3 h-3 text-emerald-400/70" />
              <span className="text-[var(--lux-text-label-2)] text-[11px]">{language === 'id' ? 'Aktivasi Instan' : 'Instant Activation'}</span>
            </div>
          </div>
        </motion.div>
      </div>
    </section>
  )
}