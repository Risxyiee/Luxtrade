'use client'

import React from 'react'
import { motion } from 'framer-motion'
import Link from 'next/link'
import { Crown, BookOpen, Zap, AlertTriangle, Lock, Shield, CreditCard } from 'lucide-react'
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
          <motion.div initial={{ opacity: 0, y: 30 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true, amount: 0.1 }} transition={{ delay: 0.1 }} className="flex-1 flex flex-col bg-[var(--lux-card-surface)] backdrop-blur-sm border border-[var(--lux-inline-border)] rounded-3xl overflow-hidden min-w-[280px]">
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
          <motion.div initial={{ opacity: 0, y: 30 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true, amount: 0.1 }} transition={{ delay: 0.2 }} className="flex-1 flex flex-col bg-gradient-to-b from-purple-500/20 via-white/5 to-purple-500/10 border border-purple-500/40 rounded-3xl overflow-hidden min-w-[280px] relative">
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
            <LifetimeUltraCard onButtonClick={handleLifetimeUpgrade} language={language} t={t} />
          </div>
        </div>

        {/* Comparison Table */}
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, amount: 0.1 }}
          transition={{ delay: 0.2 }}
          className="mt-16 max-w-[900px] mx-auto"
        >
          <div className="overflow-x-auto -mx-4 px-4">
          <div className="min-w-[640px]">
          <div className="bg-[var(--lux-card-surface)] backdrop-blur-sm border border-[var(--lux-inline-border)] rounded-3xl overflow-hidden">
            {/* Table Header */}
            <div className="grid grid-cols-4 gap-0 border-b border-[var(--lux-inline-border)]">
              <div className="p-4 sm:p-5 text-sm font-bold text-[var(--lux-text-subtitle)]">
                {language === 'id' ? 'Fitur' : 'Feature'}
              </div>
              <div className="p-4 sm:p-5 text-sm font-bold text-[var(--lux-text-primary)] text-center">
                Free
              </div>
              <div className="p-4 sm:p-5 text-sm font-bold text-purple-400 text-center relative">
                PRO
                <span className="absolute top-1/2 right-2 -translate-y-1/2 text-[9px] bg-purple-500/20 text-purple-300 px-1.5 py-0.5 rounded-full font-bold">
                  POPULER
                </span>
              </div>
              <div className="p-4 sm:p-5 text-sm font-bold text-amber-400 text-center">
                Lifetime
              </div>
            </div>

            {/* Rows */}
            {[
              {
                id: language === 'id' ? 'Jurnal per bulan' : 'Journals/month',
                free: '10',
                pro: language === 'id' ? 'Unlimited' : 'Unlimited',
                lifetime: language === 'id' ? 'Unlimited' : 'Unlimited',
                highlight: false,
              },
              {
                id: language === 'id' ? 'Analisis AI' : 'AI Analysis',
                free: language === 'id' ? '3x trial' : '3x trial',
                pro: language === 'id' ? 'Unlimited' : 'Unlimited',
                lifetime: language === 'id' ? 'Unlimited' : 'Unlimited',
                highlight: false,
              },
              {
                id: language === 'id' ? 'Deteksi kesalahan berulang' : 'Mistake pattern detection',
                free: '✕',
                pro: '✓',
                lifetime: '✓',
                highlight: false,
              },
              {
                id: language === 'id' ? 'Grafik performa' : 'Performance charts',
                free: language === 'id' ? 'Standar' : 'Standard',
                pro: language === 'id' ? 'Advanced' : 'Advanced',
                lifetime: language === 'id' ? 'Advanced' : 'Advanced',
                highlight: false,
              },
              {
                id: language === 'id' ? 'Kalkulator risiko' : 'Risk calculator',
                free: language === 'id' ? 'Pemula' : 'Basic',
                pro: language === 'id' ? 'Advanced' : 'Advanced',
                lifetime: language === 'id' ? 'Advanced' : 'Advanced',
                highlight: false,
              },
              {
                id: language === 'id' ? 'Export Excel / PDF' : 'Export Excel / PDF',
                free: '✕',
                pro: '✓',
                lifetime: '✓',
                highlight: false,
              },
              {
                id: language === 'id' ? 'Screenshot AI extract' : 'Screenshot AI extract',
                free: '✕',
                pro: '✓',
                lifetime: '✓',
                highlight: false,
              },
              {
                id: language === 'id' ? 'Analisis psikologi trading' : 'Trading psychology analysis',
                free: '✕',
                pro: '✓',
                lifetime: '✓',
                highlight: false,
              },
              {
                id: language === 'id' ? 'VIP support & grup' : 'VIP support & group',
                free: '✕',
                pro: '✓',
                lifetime: '✓',
                highlight: false,
              },
              {
                id: language === 'id' ? 'Discord privat' : 'Private Discord',
                free: '✕',
                pro: '✕',
                lifetime: '✓',
                highlight: true,
              },
            ].map((row, i) => (
              <div
                key={i}
                className={`grid grid-cols-4 gap-0 ${i % 2 === 0 ? 'bg-transparent' : 'bg-[var(--lux-inline-hover-bg)]'} ${row.highlight ? 'bg-purple-500/5' : ''}`}
              >
                <div className="p-3.5 sm:p-4 text-sm text-[var(--lux-text-body-2)]">
                  {row.id}
                </div>
                <div className="p-3.5 sm:p-4 text-sm text-[var(--lux-text-label-2)] text-center">
                  {row.free === '✕'
                    ? <span className="text-[var(--lux-text-label-3)]">—</span>
                    : row.free
                  }
                </div>
                <div className={`p-3.5 sm:p-4 text-sm text-center font-medium ${row.pro === '✕' ? 'text-[var(--lux-text-label-3)]' : 'text-purple-300'}`}>
                  {row.pro === '✓'
                    ? <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-purple-500/20 text-purple-400 text-xs">✓</span>
                    : row.pro === '✕'
                      ? <span className="text-[var(--lux-text-label-3)]">—</span>
                      : row.pro
                  }
                </div>
                <div className={`p-3.5 sm:p-4 text-sm text-center font-medium ${row.lifetime === '✓' || row.highlight ? 'text-amber-300' : 'text-[var(--lux-text-label-2)]'}`}>
                  {row.lifetime === '✓'
                    ? <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-amber-500/20 text-amber-400 text-xs">✓</span>
                    : row.lifetime === '✕'
                      ? <span className="text-[var(--lux-text-label-3)]">—</span>
                      : row.lifetime
                  }
                </div>
              </div>
            ))}
          </div>
          </div>
          </div>
        </motion.div>

        {/* Non-refundable notice */}
        <div className="flex justify-center mt-10">
          <div className="inline-flex items-center gap-3 px-5 py-2.5 bg-[var(--lux-inline-hover-bg)] border border-[var(--lux-inline-border)] rounded-xl">
            <AlertTriangle className="w-4 h-4 text-[var(--lux-text-label-2)]" />
            <span className="text-[var(--lux-text-subtitle)] text-xs font-bold">{language === 'id' ? 'Produk Digital — Non-Refundable' : 'Digital Product — Non-Refundable'}</span>
          </div>
        </div>

        {/* Payment Gateway Trust Badges */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, amount: 0.1 }}
          className="flex flex-col items-center gap-3 mt-10"
        >
          {/* Midtrans Badge */}
          <div className="inline-flex items-center gap-3 px-6 py-3.5 bg-[var(--lux-card-surface)] border border-[var(--lux-inline-border)] rounded-2xl">
            <div className="flex items-center gap-2.5">
              <div className="w-9 h-9 rounded-lg bg-[#42B549]/15 border border-[#42B549]/30 flex items-center justify-center">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
                  <path d="M3 7.5C3 5.01 5.01 3 7.5 3h9C18.99 3 21 5.01 21 7.5v9c0 2.49-2.01 4.5-4.5 4.5h-9C5.01 21 3 18.99 3 16.5v-9z" fill="#42B549"/>
                  <path d="M8 8h8v2H8zM8 12h6v2H8zM8 16h7v2H8z" fill="white" opacity="0.9"/>
                </svg>
              </div>
              <div className="flex flex-col">
                <span className="text-sm font-bold text-[var(--lux-text-primary)] tracking-wide leading-tight">Midtrans</span>
                <span className="text-[10px] text-[var(--lux-text-label-2)] leading-tight">{language === 'id' ? 'Payment Gateway Resmi' : 'Official Payment Gateway'}</span>
              </div>
            </div>
            <div className="w-px h-8 bg-[var(--lux-inline-border)]" />
            <div className="flex items-center gap-1.5">
              <Lock className="w-4 h-4 text-emerald-400" />
              <span className="text-xs text-[var(--lux-text-body)]">{language === 'id' ? 'Pembayaran Aman & Terenkripsi' : 'Secure & Encrypted'}</span>
            </div>
          </div>

          {/* Sub-badges row */}
          <div className="inline-flex items-center gap-4">
            <div className="flex items-center gap-1.5 px-3 py-1.5 bg-[var(--lux-inline-hover-bg)] border border-[var(--lux-inline-border)] rounded-xl">
              <Zap className="w-3.5 h-3.5 text-purple-400" />
              <span className="text-[11px] text-[var(--lux-text-body)] font-medium">{language === 'id' ? 'Aktivasi Instan' : 'Instant Activation'}</span>
            </div>
            <div className="flex items-center gap-1.5 px-3 py-1.5 bg-[var(--lux-inline-hover-bg)] border border-[var(--lux-inline-border)] rounded-xl">
              <Shield className="w-3.5 h-3.5 text-cyan-400" />
              <span className="text-[11px] text-[var(--lux-text-body)] font-medium">{language === 'id' ? 'Data Terproteksi' : 'Data Protected'}</span>
            </div>
            <div className="flex items-center gap-1.5 px-3 py-1.5 bg-[var(--lux-inline-hover-bg)] border border-[var(--lux-inline-border)] rounded-xl">
              <CreditCard className="w-3.5 h-3.5 text-amber-400" />
              <span className="text-[11px] text-[var(--lux-text-body)] font-medium">{language === 'id' ? 'Semua Metode Bayar' : 'All Payment Methods'}</span>
            </div>
          </div>
        </motion.div>
      </div>
    </section>
  )
}