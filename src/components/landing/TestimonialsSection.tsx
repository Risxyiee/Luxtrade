'use client'

import React from 'react'
import { motion } from 'framer-motion'
import { TrendingUp, Shield, Target, Zap } from 'lucide-react'

interface Testimonial {
  name: string
  role: string
  firm: string
  content: string
  stats: {
    winRate: string
    tradesLogged: string
    propFirm?: string
  }
  icon: any
}

const testimonials: Testimonial[] = [
  {
    name: 'Ahmad Rizky',
    role: 'Prop Firm Trader',
    firm: 'FTMO',
    content: 'Dari 4x breach di challenge pertama, sekarang sudah lewat funding 2 prop firm dalam 6 bulan. Drawdown guard + AI pattern detection yang bantu saya kontrol over-leveraging.',
    stats: {
      winRate: '67%',
      tradesLogged: '450+',
      propFirm: 'FTMO 100K'
    },
    icon: TrendingUp
  },
  {
    name: 'Sarah Wijaya',
    role: 'Forex Trader',
    firm: 'The Funded Trader',
    content: 'AI-nya bikin saya sadar pola terburuk saya: selalu over-trade di sesi London tanpa setup. Setelah 3 bulan pakai LuxTradee, win rate naik dari 42% ke 61%.',
    stats: {
      winRate: '61%',
      tradesLogged: '320+',
      propFirm: 'TFT 50K'
    },
    icon: Shield
  },
  {
    name: 'Budi Pratama',
    role: 'Gold Trader',
    firm: 'MyForexFunds',
    content: 'Drawdown guard yang bikin saya aman. Alert sebelum breaching daily drawdown 3x saved account saya. Best investment untuk prop firm trader.',
    stats: {
      winRate: '58%',
      tradesLogged: '280+',
      propFirm: 'MFF 200K'
    },
    icon: Target
  },
  {
    name: 'Dina Anggraini',
    role: 'Index Trader',
    firm: 'FundedElite',
    content: 'Upload screenshot MT5 dan AI auto-extract data ini lifesaver. Biasanya 5 menit per trade, sekarang 30 detik saja. Bisa fokus analisa setup.',
    stats: {
      winRate: '54%',
      tradesLogged: '190+',
      propFirm: 'FE 150K'
    },
    icon: Zap
  }
]

interface TestimonialsSectionProps {
  language?: 'id' | 'en'
}

export default function TestimonialsSection({ language = 'id' }: TestimonialsSectionProps) {
  return (
    <section className="py-32 relative z-10">
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[100%] h-[60%] bg-blue-600/5 blur-[150px] rounded-full pointer-events-none" />

      <div className="max-w-7xl mx-auto px-6">
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, amount: 0.3 }}
          transition={{ duration: 0.5 }}
          className="text-center mb-16"
        >
          <h2 className="text-4xl md:text-5xl font-bold tracking-tight mb-4 text-white">
            {language === 'id' ? 'Prop Firm Traders yang Lewati Challenge' : 'Prop Firm Traders Who Passed Challenges'}
          </h2>
          <p className="text-gray-400 max-w-2xl mx-auto">
            {language === 'id'
              ? 'Cerita nyata dari trader yang berhasil lewati challenge dengan konsistensi.'
              : 'Real stories from traders who passed challenges with consistency.'}
          </p>
        </motion.div>

        <div className="grid md:grid-cols-2 gap-6">
          {testimonials.map((testimonial, index) => (
            <motion.div
              key={index}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.5, delay: index * 0.1 }}
              className="glass-lux p-6 rounded-2xl hover:bg-white/5 transition-all"
            >
              {/* Header */}
              <div className="flex items-start gap-4 mb-4">
                <div className="w-12 h-12 rounded-full bg-gradient-to-br from-blue-500 to-cyan-400 flex items-center justify-center shrink-0">
                  <testimonial.icon className="w-6 h-6 text-white" />
                </div>
                <div className="flex-1">
                  <h3 className="font-semibold text-white">{testimonial.name}</h3>
                  <p className="text-sm text-gray-400">{testimonial.role} • {testimonial.firm}</p>
                </div>
              </div>

              {/* Content */}
              <p className="text-gray-300 text-sm mb-4 leading-relaxed">
                {testimonial.content}
              </p>

              {/* Stats */}
              <div className="flex items-center gap-4 pt-4 border-t border-white/10">
                <div className="flex-1">
                  <p className="text-xs text-gray-500 mb-1">Win Rate</p>
                  <p className="text-lg font-bold text-emerald-400">{testimonial.stats.winRate}</p>
                </div>
                <div className="flex-1">
                  <p className="text-xs text-gray-500 mb-1">Trades Logged</p>
                  <p className="text-lg font-bold text-cyan-400">{testimonial.stats.tradesLogged}</p>
                </div>
                {testimonial.stats.propFirm && (
                  <div className="flex-1">
                    <p className="text-xs text-gray-500 mb-1">Passed</p>
                    <p className="text-lg font-bold text-purple-400">{testimonial.stats.propFirm}</p>
                  </div>
                )}
              </div>
            </motion.div>
          ))}
        </div>

        {/* CTA */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5, delay: 0.4 }}
          className="mt-16 text-center"
        >
          <p className="text-gray-400 text-sm mb-4">
            {language === 'id'
              ? 'Ingin jadi cerita sukses berikutnya?'
              : 'Want to be the next success story?'}
          </p>
          <a
            href="#pricing"
            className="inline-flex items-center gap-2 px-8 py-4 bg-gradient-to-r from-blue-500 to-cyan-400 text-white font-medium rounded-xl hover:opacity-90 transition-all glow-bg-luxury"
          >
            {language === 'id' ? 'Mulai Sekarang' : 'Get Started'}
          </a>
        </motion.div>
      </div>
    </section>
  )
}