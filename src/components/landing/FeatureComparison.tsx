'use client'

import React from 'react'
import { motion } from 'framer-motion'
import { Check, X, Infinity, ArrowRight } from 'lucide-react'
import Link from 'next/link'

interface FeatureComparisonProps {
  language: 'id' | 'en'
}

type CellValue =
  | { type: 'check' }
  | { type: 'cross' }
  | { type: 'text'; value: string }
  | { type: 'unlimited'; label: string }

interface FeatureRow {
  name: { id: string; en: string }
  free: CellValue
  pro: CellValue
}

const features: FeatureRow[] = [
  {
    name: { id: 'Trade Entries / bulan', en: 'Trade Entries / month' },
    free: { type: 'text', value: '10' },
    pro: { type: 'unlimited', label: 'Unlimited' },
  },
  {
    name: { id: 'AI Queries / bulan', en: 'AI Queries / month' },
    free: { type: 'text', value: '10' },
    pro: { type: 'unlimited', label: 'Unlimited' },
  },
  {
    name: { id: 'AI Pattern Detection', en: 'AI Pattern Detection' },
    free: { type: 'cross' },
    pro: { type: 'check' },
  },
  {
    name: { id: 'AI Risk Guard', en: 'AI Risk Guard' },
    free: { type: 'cross' },
    pro: { type: 'check' },
  },
  {
    name: { id: 'Auto Extract MT5/TV Screenshot', en: 'Auto Extract MT5/TV Screenshot' },
    free: { type: 'cross' },
    pro: { type: 'check' },
  },
  {
    name: { id: 'Equity Curve & Analytics', en: 'Equity Curve & Analytics' },
    free: { type: 'text', value: 'Basic' },
    pro: { type: 'text', value: 'Advanced' },
  },
  {
    name: { id: 'Trading Calendar', en: 'Trading Calendar' },
    free: { type: 'check' },
    pro: { type: 'check' },
  },
  {
    name: { id: 'Watchlist & Alerts', en: 'Watchlist & Alerts' },
    free: { type: 'text', value: 'Basic' },
    pro: { type: 'text', value: 'Advanced' },
  },
  {
    name: { id: 'Journal Entries', en: 'Journal Entries' },
    free: { type: 'text', value: '10/bulan' },
    pro: { type: 'unlimited', label: 'Unlimited' },
  },
  {
    name: { id: 'Screenshot Journal', en: 'Screenshot Journal' },
    free: { type: 'cross' },
    pro: { type: 'check' },
  },
  {
    name: { id: 'Export Data (CSV/PDF)', en: 'Export Data (CSV/PDF)' },
    free: { type: 'cross' },
    pro: { type: 'check' },
  },
  {
    name: { id: 'Psychology Tracking', en: 'Psychology Tracking' },
    free: { type: 'cross' },
    pro: { type: 'check' },
  },
  {
    name: { id: 'Trading Score', en: 'Trading Score' },
    free: { type: 'cross' },
    pro: { type: 'check' },
  },
  {
    name: { id: 'Achievement System', en: 'Achievement System' },
    free: { type: 'text', value: 'Basic' },
    pro: { type: 'text', value: 'Full' },
  },
  {
    name: { id: 'Priority Support', en: 'Priority Support' },
    free: { type: 'cross' },
    pro: { type: 'check' },
  },
  {
    name: { id: 'Promo Code Discounts', en: 'Promo Code Discounts' },
    free: { type: 'cross' },
    pro: { type: 'check' },
  },
  {
    name: { id: 'Broker Connection (MetaAPI)', en: 'Broker Connection (MetaAPI)' },
    free: { type: 'cross' },
    pro: { type: 'check' },
  },
  {
    name: { id: 'Weekly AI Report', en: 'Weekly AI Report' },
    free: { type: 'cross' },
    pro: { type: 'check' },
  },
]

function CellRenderer({ cell }: { cell: CellValue }) {
  switch (cell.type) {
    case 'check':
      return <Check className="w-5 h-5 text-emerald-400 mx-auto" />
    case 'cross':
      return <X className="w-5 h-5 text-gray-600 mx-auto" />
    case 'unlimited':
      return (
        <span className="flex items-center justify-center gap-1.5">
          <Infinity className="w-4 h-4 text-cyan-400" />
          <span className="text-cyan-400 font-semibold text-sm">{cell.label}</span>
        </span>
      )
    case 'text':
      return <span className="text-white/70 text-sm font-medium">{cell.value}</span>
  }
}

export default function FeatureComparison({ language }: FeatureComparisonProps) {
  const isEn = language === 'en'

  return (
    <section id="features" className="relative py-24 lg:py-32 overflow-hidden">
      {/* Subtle background glow */}
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[400px] bg-blue-500/[0.03] rounded-full blur-[120px]" />
      </div>

      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
        {/* Section Header */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, amount: 0.3 }}
          transition={{ duration: 0.5 }}
          className="text-center mb-14"
        >
          <p className="text-[12px] font-medium tracking-[0.18em] uppercase text-[#8892b0] mb-3">
            {isEn ? 'COMPARE PLANS' : 'BANDINGKAN PAKET'}
          </p>
          <h2 className="text-3xl md:text-[40px] font-medium tracking-tight text-[#f0f2ff] mb-4">
            {isEn ? 'Complete Features' : 'Fitur Lengkap'}
          </h2>
          <p className="text-gray-400 max-w-lg mx-auto text-sm leading-relaxed">
            {isEn
              ? 'See exactly what you get with each plan. Every feature designed to help you trade smarter.'
              : 'Lihat persis apa yang kamu dapat di setiap paket. Setiap fitur dirancang untuk bantu kamu trading lebih cerdas.'}
          </p>
        </motion.div>

        {/* Comparison Table */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, amount: 0.1 }}
          transition={{ duration: 0.5, delay: 0.1 }}
          className="rounded-2xl border border-white/[0.08] bg-white/[0.02] backdrop-blur-xl overflow-hidden"
        >
          {/* Table Header */}
          <div className="grid grid-cols-3 border-b border-white/[0.08]">
            {/* Feature column header */}
            <div className="px-4 sm:px-6 py-4 flex items-center">
              <span className="text-sm font-semibold text-white/60 uppercase tracking-wider">
                {isEn ? 'Feature' : 'Fitur'}
              </span>
            </div>
            {/* Free column header */}
            <div className="px-4 sm:px-6 py-4 flex items-center justify-center border-l border-white/[0.06]">
              <span className="text-sm font-semibold text-white/60 uppercase tracking-wider">
                {isEn ? 'Free' : 'Gratis'}
              </span>
            </div>
            {/* Pro column header */}
            <div className="px-4 sm:px-6 py-4 flex items-center justify-center border-l border-white/[0.06] bg-blue-500/[0.05]">
              <div className="flex items-center gap-2">
                <span className="text-sm font-semibold text-white/60 uppercase tracking-wider">PRO</span>
                <span className="bg-gradient-to-r from-blue-500 to-cyan-400 text-white text-[10px] px-2 py-0.5 rounded-full font-bold tracking-wide shadow-[0_0_12px_rgba(59,130,246,0.4)]">
                  PRO
                </span>
              </div>
            </div>
          </div>

          {/* Table Rows */}
          {features.map((feature, index) => (
            <motion.div
              key={index}
              initial={{ opacity: 0, x: -8 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true, amount: 0.1 }}
              transition={{ duration: 0.35, delay: index * 0.04 }}
              className={`grid grid-cols-3 border-b border-white/[0.04] last:border-b-0 ${
                index % 2 === 1 ? 'bg-white/[0.01]' : ''
              }`}
            >
              {/* Feature Name */}
              <div className="px-4 sm:px-6 py-3.5 flex items-center">
                <span className="text-white/80 text-sm leading-snug">
                  {isEn ? feature.name.en : feature.name.id}
                </span>
              </div>
              {/* Free Value */}
              <div className="px-4 sm:px-6 py-3.5 flex items-center justify-center border-l border-white/[0.06]">
                <CellRenderer cell={feature.free} />
              </div>
              {/* Pro Value */}
              <div className="px-4 sm:px-6 py-3.5 flex items-center justify-center border-l border-white/[0.06] bg-blue-500/[0.05]">
                <CellRenderer cell={feature.pro} />
              </div>
            </motion.div>
          ))}
        </motion.div>

        {/* Mobile scroll hint */}
        <p className="mt-3 text-center text-xs text-white/30 sm:hidden">
          {isEn ? '↔ Scroll horizontally if needed' : '↔ Geser horizontal jika perlu'}
        </p>

        {/* Bottom CTA */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5, delay: 0.3 }}
          className="mt-12 text-center"
        >
          <Link
            href="#pricing"
            className="inline-flex items-center gap-2 text-sm font-medium text-cyan-400 hover:text-cyan-300 transition-colors group"
          >
            {isEn ? 'Start with Free, upgrade anytime' : 'Mulai dengan Gratis, upgrade kapan saja'}
            <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
          </Link>
        </motion.div>
      </div>
    </section>
  )
}
