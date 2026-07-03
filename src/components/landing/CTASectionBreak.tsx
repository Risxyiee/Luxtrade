'use client'

import React from 'react'
import { motion } from 'framer-motion'
import Link from 'next/link'
import { ArrowRight, Sparkles } from 'lucide-react'

interface CTASectionBreakProps {
  language: 'id' | 'en'
}

export default function CTASectionBreak({ language }: CTASectionBreakProps) {
  return (
    <section className="py-20 px-4 sm:px-6 lg:px-8">
      <div className="max-w-3xl mx-auto text-center">
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
        >
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-purple-500/10 border border-purple-500/20 mb-8">
            <Sparkles className="w-4 h-4 text-purple-400" />
            <span className="text-sm font-semibold text-purple-300">
              {language === 'id' ? 'Gratis untuk memulai' : 'Free to get started'}
            </span>
          </div>

          <h2 className="text-3xl sm:text-4xl font-extrabold text-[var(--lux-text-primary)] mb-5 leading-tight">
            {language === 'id'
              ? 'Siap Tingkatkan Performa Trading Kamu?'
              : 'Ready to Improve Your Trading Performance?'}
          </h2>
          <p className="text-[var(--lux-text-subtitle)] text-base md:text-lg mb-10 max-w-xl mx-auto leading-relaxed">
            {language === 'id'
              ? 'Bergabung dengan trader Indonesia yang sudah memperbaiki strategi mereka dengan LuxTrade. 10 trade per bulan, gratis selamanya.'
              : 'Join Indonesian traders who have already improved their strategies with LuxTrade. 10 trades per month, free forever.'}
          </p>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <Link href="/auth/signup" className="w-full sm:w-auto">
              <button className="flex items-center justify-center w-full sm:w-auto h-14 px-10 rounded-2xl bg-gradient-to-r from-purple-500 to-blue-600 hover:from-purple-600 hover:to-blue-700 transition-all shadow-lg shadow-purple-500/25 active:scale-95 group">
                <span className="text-[15px] font-bold text-white">
                  {language === 'id' ? 'Mulai Gratis Sekarang' : 'Start Free Now'}
                </span>
                <ArrowRight className="w-5 h-5 text-white ml-2 transition-transform group-hover:translate-x-1" />
              </button>
            </Link>
          </div>

          <p className="text-[var(--lux-text-label)] text-xs mt-6">
            {language === 'id'
              ? 'Tidak perlu kartu kredit · Setup 30 detik · Batalkan kapan saja'
              : 'No credit card required · 30 second setup · Cancel anytime'}
          </p>
        </motion.div>
      </div>
    </section>
  )
}