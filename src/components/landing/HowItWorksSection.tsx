'use client'

import React from 'react'
import { motion } from 'framer-motion'
import Link from 'next/link'
import { Zap, Sparkles, Camera, Brain, ArrowRight } from 'lucide-react'
import { Button } from '@/components/ui/button'

interface HowItWorksSectionProps {
  language: 'id' | 'en'
  t: (key: string) => string
}

export default function HowItWorksSection({ language, t }: HowItWorksSectionProps) {
  return (
    <section id="how-it-works" className="py-20 px-4 sm:px-6 lg:px-8">
      <div className="max-w-5xl mx-auto">
        <div className="flex flex-col items-center mb-14">
          {/* Unique badge: gradient pill with dashed border effect */}
          <div className="inline-flex items-center gap-2.5 px-5 py-2 rounded-full bg-gradient-to-r from-purple-500/15 to-cyan-500/10 border border-purple-500/25 mb-6">
            <Zap className="w-4 h-4 text-cyan-400" />
            <span className="text-sm font-bold text-[var(--lux-text-on-surface)]">
              {language === 'id' ? 'Cara Kerja' : 'How It Works'}
            </span>
          </div>
          <p className="text-[var(--lux-text-subtitle)] max-w-md text-center text-base">
            {language === 'id'
              ? 'Tiga langkah simpel untuk mulai meningkatkan performa trading kamu.'
              : 'Three simple steps to start improving your trading performance.'}
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 relative">
          {/* Connecting line (desktop only) */}
          <div className="hidden md:block absolute top-16 left-[20%] right-[20%] h-px bg-gradient-to-r from-purple-500/50 via-cyan-400/30 to-emerald-500/50" />

          {[
            {
              step: '01',
              icon: Sparkles,
              title: language === 'id' ? 'Daftar Gratis' : 'Sign Up Free',
              desc: language === 'id'
                ? 'Buat akun dalam 30 detik. Coba semua fitur dasar tanpa bayar — 10 trade per bulan, gratis selamanya.'
                : 'Create an account in 30 seconds. Try all basic features for free — 10 trades per month, forever free.',
              color: 'from-purple-500 to-violet-600',
              border: 'border-purple-500/30',
              iconBg: 'bg-purple-500/20',
              iconColor: 'text-purple-400',
            },
            {
              step: '02',
              icon: Camera,
              title: language === 'id' ? 'Catat Trade Kamu' : 'Log Your Trades',
              desc: language === 'id'
                ? 'Screenshot trade dari MT4/MT5, upload dan AI otomatis extract data + buat jurnal. Atau input manual.'
                : 'Screenshot your MT4/MT5 trade, upload and AI auto-extracts data + creates a journal. Or input manually.',
              color: 'from-cyan-500 to-blue-600',
              border: 'border-cyan-500/30',
              iconBg: 'bg-cyan-500/20',
              iconColor: 'text-cyan-400',
            },
            {
              step: '03',
              icon: Brain,
              title: language === 'id' ? 'AI Analisis & Improve' : 'AI Analysis & Improve',
              desc: language === 'id'
                ? 'AI mendeteksi pola kerugian berulang, analisis psikologi, dan kasih insight personal berbasis data kamu.'
                : 'AI detects repeating loss patterns, analyzes psychology, and gives personal insights based on your data.',
              color: 'from-emerald-500 to-teal-600',
              border: 'border-emerald-500/30',
              iconBg: 'bg-emerald-500/20',
              iconColor: 'text-emerald-400',
            },
          ].map((item, index) => (
            <motion.div
              key={index}
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: index * 0.15 }}
              className="relative"
            >
              <div className={`bg-[var(--lux-card-surface)] backdrop-blur-sm border ${item.border} rounded-2xl p-6 pt-8 h-full hover:bg-[var(--lux-card-surface-hover)] transition-colors`}>
                {/* Step number */}
                <span className={`absolute -top-3 left-6 text-xs font-black px-3 py-1 rounded-lg bg-gradient-to-r ${item.color} text-white shadow-lg`}>
                  {item.step}
                </span>
                {/* Icon */}
                <div className={`w-12 h-12 rounded-xl ${item.iconBg} border border-[var(--lux-inline-border)] flex items-center justify-center mb-5`}>
                  <item.icon className={`w-6 h-6 ${item.iconColor}`} />
                </div>
                <h3 className="text-lg font-bold text-[var(--lux-text-primary)] mb-2">{item.title}</h3>
                <p className="text-[var(--lux-text-subtitle)] text-sm leading-relaxed">{item.desc}</p>
              </div>
            </motion.div>
          ))}
        </div>

        <div className="flex justify-center mt-10">
          <Link href="/auth/signup">
            <Button className={`bg-gradient-to-r from-purple-600 via-violet-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 text-white font-semibold px-8 py-3 rounded-xl shadow-lg shadow-purple-500/20 transition-all hover:shadow-purple-500/40`}>
              {language === 'id' ? 'Mulai Sekarang — Gratis' : 'Get Started — Free'}
              <ArrowRight className="w-4 h-4 ml-2" />
            </Button>
          </Link>
        </div>
      </div>
    </section>
  )
}