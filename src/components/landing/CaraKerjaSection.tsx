'use client'

import React from 'react'
import { motion } from 'framer-motion'
import Image from 'next/image'
import { CheckCircle2, AlertTriangle, ShieldCheck } from 'lucide-react'

const steps = [
  {
    num: 'STEP 01',
    title: 'Auto Jurnal (AI Vision Upload)',
    desc: 'Upload screenshot MetaTrader (MT5) atau TradingView. Sistem langsung membaca pair, harga entry, exit, dan hasil P/L dalam hitungan detik.',
    rightSide: true,
    visual: 'upload',
    img: '/images/guide/auto-journal-example.jpeg',
  },
  {
    num: 'STEP 02',
    title: 'Analitik (Performa Trading Tervisualisasi)',
    desc: 'Pantau win-rate, profit factor, dan kurva equity kamu secara real-time tanpa perlu pusing bikin rumus Excel sendiri.',
    rightSide: false,
    visual: 'analytics',
    img: '/screenshot-calendar.jpeg',
    floatingCards: [
      { label: 'Win Rate', value: '50.0%', color: 'text-emerald-400', position: 'top-8 left-8' },
      { label: 'Profit Factor', value: '2.34', color: 'text-cyan-400', position: 'bottom-8 right-8' },
    ],
  },
  {
    num: 'STEP 03',
    title: 'Jurnal (Catat Emosi & Alasan Trade)',
    desc: 'Catat kondisi psikologis, sesi market (London/New York), dan alasan setup sebelum tombol eksekusi ditekan.',
    rightSide: true,
    visual: 'journal',
    img: '/screenshot-trades.jpeg',
    floatingCards: [
      { label: 'Tag: gold', value: '', color: 'text-emerald-400', position: 'top-8 right-8', tag: true },
    ],
  },
  {
    num: 'STEP 04',
    title: 'AI (Deteksi Pola Kerugian Otomatis)',
    desc: 'AI memindai seluruh histori trade kamu untuk menemukan kebiasaan buruk tersembunyi — seperti sering over-leveraging di sesi Asia.',
    rightSide: false,
    visual: 'ai',
  },
  {
    num: 'STEP 05',
    title: 'Watchlist & Propfirm Guard',
    desc: 'Jaga batas maximum & daily drawdown akun prop firm kamu agar tidak pernah terkena breach mendadak.',
    rightSide: true,
    visual: 'guard',
  },
]

export default function CaraKerjaSection() {
  return (
    <section id="cara-kerja" className="py-32 relative z-10">
      <div className="max-w-7xl mx-auto px-6">
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, amount: 0.3 }}
          transition={{ duration: 0.5 }}
          className="text-center mb-24"
        >
          <h2 className="text-4xl md:text-5xl font-bold tracking-tight mb-4 text-white">Cara Kerja LuxTradee</h2>
          <p className="text-gray-400 max-w-2xl mx-auto">Dari upload history MT5 hingga prediksi kerugian, semua otomatis.</p>
        </motion.div>

        <div className="flex flex-col gap-32">
          {steps.map((step, i) => (
            <motion.div
              key={step.num}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, amount: 0.2 }}
              transition={{ duration: 0.5, delay: 0.1 }}
              className={`grid md:grid-cols-2 gap-12 items-center ${!step.rightSide ? '' : ''}`}
            >
              {/* Text — always first in DOM order, reorder with md:order on the opposite column */}
              <div className={!step.rightSide ? 'md:order-2' : ''}>
                <span className="font-mono text-cyan-400 text-sm">{step.num}</span>
                <h3 className="text-3xl font-bold mt-2 mb-4 text-white">{step.title}</h3>
                <p className="text-gray-400">{step.desc}</p>
              </div>

              {/* Visual */}
              <div className={!step.rightSide ? 'md:order-1' : ''}>
                {step.visual === 'upload' && step.img && (
                  <div className="glass-lux p-8 min-h-[300px] flex items-center justify-center relative">
                    <div className="phone-mockup w-48 hover:scale-105 transition-transform duration-300">
                      <Image src={step.img} alt="Auto Jurnal Screenshot MT5" width={192} height={380} />
                    </div>
                    <div className="absolute bottom-4 right-4 bg-white/5 p-3 rounded-xl border border-white/10 backdrop-blur-md animate-float-lux">
                      <div className="flex items-center gap-2">
                        <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                        <span className="font-mono text-xs text-emerald-400">Data Extracted: +$340.20</span>
                      </div>
                    </div>
                  </div>
                )}

                {step.visual === 'analytics' && step.img && (
                  <div className="glass-lux p-8 min-h-[300px] flex items-center justify-center relative">
                    <div className="phone-mockup w-48 hover:scale-105 transition-transform duration-300">
                      <Image src={step.img} alt="Kalender Trading" width={192} height={380} />
                    </div>
                    {step.floatingCards?.map((card, ci) => (
                      <div key={ci} className={`absolute ${card.position} bg-white/5 p-3 rounded-xl border border-white/10 backdrop-blur-md animate-float-lux`} style={{ animationDelay: `${ci * 0.5}s` }}>
                        <p className="text-xs text-gray-400 font-mono">{card.label}</p>
                        <p className={`text-xl ${card.color} font-bold`}>{card.value}</p>
                      </div>
                    ))}
                  </div>
                )}

                {step.visual === 'journal' && step.img && (
                  <div className="glass-lux p-8 min-h-[300px] flex items-center justify-center relative">
                    <div className="phone-mockup w-48 hover:scale-105 transition-transform duration-300">
                      <Image src={step.img} alt="Histori Trade" width={192} height={380} />
                    </div>
                    {step.floatingCards?.map((card, ci) => (
                      <div key={ci} className={`absolute ${card.position} bg-white/5 p-3 rounded-xl border border-white/10 backdrop-blur-md animate-float-lux`} style={{ animationDelay: '0.5s' }}>
                        {card.tag ? (
                          <span className="bg-emerald-500/20 text-emerald-400 rounded-full px-2 py-0.5 text-[10px] font-mono">Tag: gold</span>
                        ) : (
                          <p className={`text-xl ${card.color} font-bold`}>{card.value}</p>
                        )}
                      </div>
                    ))}
                  </div>
                )}

                {step.visual === 'ai' && (
                  <div className="glass-lux p-8 h-64 flex items-center justify-center relative">
                    <div className="radar-pulse" />
                    <div className="radar-pulse" style={{ animationDelay: '1s' }} />
                    <div className="z-10 bg-[#050507] border border-red-500/40 p-4 flex items-center gap-3 shadow-[0_0_30px_rgba(239,68,68,0.2)] rounded-xl">
                      <AlertTriangle className="w-5 h-5 text-red-500" />
                      <div>
                        <p className="text-xs font-bold text-red-400">Warning</p>
                        <p className="text-xs text-gray-400 font-mono">70% losses on Friday</p>
                      </div>
                    </div>
                  </div>
                )}

                {step.visual === 'guard' && (
                  <div className="glass-lux p-8 h-64 flex flex-col justify-center gap-6">
                    <div>
                      <div className="flex justify-between mb-2 font-mono text-xs">
                        <span className="text-gray-400">Daily Drawdown</span>
                        <span className="text-emerald-400 font-bold">1.2% / 5.0%</span>
                      </div>
                      <div className="w-full bg-gray-800 rounded-full h-2.5 overflow-hidden">
                        <div className="progress-fill bg-gradient-to-r from-emerald-500 to-cyan-500 h-full rounded-full" />
                      </div>
                    </div>
                    <div className="mt-4 bg-emerald-500/10 border border-emerald-500/30 p-4 flex items-center gap-3 w-fit rounded-xl">
                      <ShieldCheck className="w-5 h-5 text-emerald-400" />
                      <span className="font-mono text-sm text-emerald-400">Status: Secure</span>
                    </div>
                  </div>
                )}
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  )
}
