'use client'

import React from 'react'
import { motion } from 'framer-motion'
import Image from 'next/image'
import { CheckCircle2, AlertTriangle, ShieldCheck } from 'lucide-react'

interface CaraKerjaSectionProps {
  language?: 'id' | 'en'
}

const steps = {
  id: [
    {
      num: 'STEP 01',
      title: 'Auto Jurnal (AI Vision Upload)',
      desc: 'Upload screenshot MetaTrader (MT5) atau TradingView. Sistem langsung membaca pair, harga entry, exit, dan hasil P/L dalam hitungan detik.',
      rightSide: true,
      visual: 'upload',
      /* varian TIGHT (ruang kosong atas/bawah dipotong) khusus landing —
         file asli tetap dipakai guide dialog dashboard */
      img: '/images/landing/auto-journal-tight.webp',
    },
    {
      num: 'STEP 02',
      title: 'Analitik (Performa Trading Tervisualisasi)',
      desc: 'Pantau win-rate, profit factor, dan kurva equity kamu secara real-time tanpa perlu pusing bikin rumus Excel sendiri.',
      rightSide: false,
      visual: 'analytics',
      img: '/screenshot-calendar-v2.webp',
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
      /* varian TIGHT (ruang kosong atas/bawah dipotong) — hero tetap
         pakai file asli */
      img: '/images/landing/trade-list-tight.webp',
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
  ],
  en: [
    {
      num: 'STEP 01',
      title: 'Auto Journal (AI Vision Upload)',
      desc: 'Upload MetaTrader (MT5) or TradingView screenshots. The system instantly reads the pair, entry price, exit, and P/L result in seconds.',
      rightSide: true,
      visual: 'upload',
      /* varian TIGHT (ruang kosong atas/bawah dipotong) khusus landing —
         file asli tetap dipakai guide dialog dashboard */
      img: '/images/landing/auto-journal-tight.webp',
    },
    {
      num: 'STEP 02',
      title: 'Analytics (Visualized Trading Performance)',
      desc: 'Monitor your win rate, profit factor, and equity curve in real-time without needing to build Excel formulas yourself.',
      rightSide: false,
      visual: 'analytics',
      img: '/screenshot-calendar-v2.webp',
      floatingCards: [
        { label: 'Win Rate', value: '50.0%', color: 'text-emerald-400', position: 'top-8 left-8' },
        { label: 'Profit Factor', value: '2.34', color: 'text-cyan-400', position: 'bottom-8 right-8' },
      ],
    },
    {
      num: 'STEP 03',
      title: 'Journal (Log Emotions & Trade Reasons)',
      desc: 'Record your psychological state, market session (London/New York), and setup reasoning before hitting the execute button.',
      rightSide: true,
      visual: 'journal',
      /* varian TIGHT (ruang kosong atas/bawah dipotong) — hero tetap
         pakai file asli */
      img: '/images/landing/trade-list-tight.webp',
    },
    {
      num: 'STEP 04',
      title: 'AI (Automatic Loss Pattern Detection)',
      desc: 'AI scans your entire trade history to find hidden bad habits — like frequently over-leveraging during the Asian session.',
      rightSide: false,
      visual: 'ai',
    },
    {
      num: 'STEP 05',
      title: 'Watchlist & Propfirm Guard',
      desc: 'Protect your prop firm account from sudden breaches by monitoring maximum & daily drawdown limits.',
      rightSide: true,
      visual: 'guard',
    },
  ],
}

export default function CaraKerjaSection({ language = 'id' }: CaraKerjaSectionProps) {
  const stepsData = steps[language]

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
          <h2 className="text-4xl md:text-5xl font-bold tracking-tight mb-4 text-white">{language === 'en' ? 'How LuxTradee Works' : 'Cara Kerja LuxTradee'}</h2>
          <p className="text-gray-400 max-w-2xl mx-auto">{language === 'en' ? 'From MT5 history upload to loss prediction — everything is automated.' : 'Dari upload history MT5 hingga prediksi kerugian, semua otomatis.'}</p>
        </motion.div>

        <div className="flex flex-col gap-32">
          {stepsData.map((step, i) => (
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
                  /* FIX Bos: screenshot panduan dulu punya ruang kosong besar
                     atas/bawah + badge menimpa tabel → jelek. V2: varian
                     tight + komposisi BARU — phone lebih besar di kiri,
                     kolom chip hasil ekstraksi di kanan mengisi ruang kartu
                     yang dulu kosong ±70% (dulu cuma phone kecil + 1 badge
                     di bawah → kartu tampak hampa). */
                  <div className="glass-lux p-6 md:p-8 min-h-[300px] flex flex-col md:flex-row items-center justify-center gap-5 md:gap-7 relative overflow-hidden">
                    {/* glow ambient — mengisi ruang gelap kartu */}
                    <div className="absolute inset-0 pointer-events-none" aria-hidden="true" style={{ background: 'radial-gradient(circle at 26% 40%, rgba(34,211,238,0.10), transparent 62%)' }} />
                    <div className="phone-mockup w-40 sm:w-44 md:w-52 hover:scale-105 transition-transform duration-300 relative shrink-0">
                      <Image src={step.img} alt="Auto Jurnal Screenshot MT5" width={1080} height={1214} quality={100} loading="lazy" className="w-full h-auto" />
                    </div>
                    <div className="relative flex flex-col items-stretch gap-3 w-full max-w-[260px] md:w-auto md:flex-1">
                      <div className="bg-white/5 px-3.5 py-2.5 rounded-xl border border-white/10 backdrop-blur-md animate-float-lux">
                        <div className="flex items-center gap-2">
                          <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                          <span className="font-mono text-xs text-emerald-400">Data Extracted: +$340.20</span>
                        </div>
                      </div>
                      <div className="bg-white/5 px-3.5 py-2.5 rounded-xl border border-white/10 backdrop-blur-md animate-float-lux" style={{ animationDelay: '0.4s' }}>
                        <p className="text-[10px] uppercase tracking-wider text-gray-400 font-mono">Pair terdeteksi</p>
                        <p className="text-sm text-white font-bold font-mono mt-0.5">XAUUSD · SELL</p>
                      </div>
                      <div className="bg-white/5 px-3.5 py-2.5 rounded-xl border border-white/10 backdrop-blur-md animate-float-lux" style={{ animationDelay: '0.8s' }}>
                        <p className="text-[10px] uppercase tracking-wider text-gray-400 font-mono">Entry → Exit</p>
                        <p className="text-sm text-cyan-300 font-bold font-mono mt-0.5">2,384.5 → 2,350.3</p>
                      </div>
                    </div>
                  </div>
                )}

                {step.visual === 'analytics' && step.img && (
                  <div className="glass-lux p-8 min-h-[300px] flex items-center justify-center relative">
                    <div className="phone-mockup w-48 hover:scale-105 transition-transform duration-300">
                      <Image src={step.img} alt="Kalender Trading" width={1080} height={1920} quality={100} loading="lazy" />
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
                  /* FIX Bos: sama seperti STEP 01 — komposisi BARU: phone
                     lebih besar + kolom chip jurnal di kanan (dulu tag kecil
                     di bawah phone → kartu tampak hampa). */
                  <div className="glass-lux p-6 md:p-8 min-h-[300px] flex flex-col md:flex-row items-center justify-center gap-5 md:gap-7 relative overflow-hidden">
                    <div className="absolute inset-0 pointer-events-none" aria-hidden="true" style={{ background: 'radial-gradient(circle at 26% 40%, rgba(52,211,153,0.09), transparent 62%)' }} />
                    <div className="phone-mockup w-40 sm:w-44 md:w-52 hover:scale-105 transition-transform duration-300 relative shrink-0">
                      <Image src={step.img} alt="Histori Trade" width={600} height={687} quality={100} loading="lazy" />
                    </div>
                    <div className="relative flex flex-col items-stretch gap-3 w-full max-w-[260px] md:w-auto md:flex-1">
                      <div className="bg-white/5 px-3.5 py-2.5 rounded-xl border border-white/10 backdrop-blur-md animate-float-lux flex items-center justify-between gap-2">
                        <span className="text-[10px] uppercase tracking-wider text-gray-400 font-mono">Tag setup</span>
                        <span className="bg-emerald-500/20 text-emerald-400 rounded-full px-2.5 py-0.5 text-[10px] font-mono">gold</span>
                      </div>
                      <div className="bg-white/5 px-3.5 py-2.5 rounded-xl border border-white/10 backdrop-blur-md animate-float-lux" style={{ animationDelay: '0.4s' }}>
                        <p className="text-[10px] uppercase tracking-wider text-gray-400 font-mono">Emosi dicatat</p>
                        <p className="text-sm text-white font-bold font-mono mt-0.5">FOMO ⚠️ terdeteksi</p>
                      </div>
                      <div className="bg-white/5 px-3.5 py-2.5 rounded-xl border border-white/10 backdrop-blur-md animate-float-lux" style={{ animationDelay: '0.8s' }}>
                        <p className="text-[10px] uppercase tracking-wider text-gray-400 font-mono">Sesi & alasan entry</p>
                        <p className="text-sm text-cyan-300 font-bold font-mono mt-0.5">New York · breakout</p>
                      </div>
                    </div>
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
