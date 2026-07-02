'use client'

import React from 'react'
import { motion } from 'framer-motion'
import { Zap, Activity, Check } from 'lucide-react'

interface RoadmapSectionProps {
  language: 'id' | 'en'
}

export default function RoadmapSection({ language }: RoadmapSectionProps) {
  return (
    <section id="roadmap" className="py-20 px-4 sm:px-6 lg:px-8">
      <div className="max-w-5xl mx-auto">
        <div className="flex flex-col items-center mb-12">
          <div className="flex items-center h-9 w-max bg-[#2a1b3d]/90 backdrop-blur-sm border border-white/10 rounded-xl mb-6">
            <div className="w-4 h-full" />
            <div className="flex items-center gap-2 text-sm font-medium text-white/90">
              <Zap className="w-4 h-4 text-purple-400" />
              {language === 'id' ? 'Yang Sedang Dibangun' : 'Currently in the Works'}
            </div>
            <div className="w-4 h-full" />
          </div>
          <p className="text-white/40 max-w-md text-center text-base">{language === 'id' ? 'LuxTrade masih baru dan terus berkembang. Ini beberapa fitur yang sudah di garap.' : 'LuxTrade is still young and growing. Here\'s what\'s already being worked on.'}</p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <motion.div initial={{ opacity: 0, x: -20 }} whileInView={{ opacity: 1, x: 0 }} viewport={{ once: true }} transition={{ delay: 0.1 }}>
            <div className="h-full p-6 bg-[#2a1b3d]/40 backdrop-blur-sm border border-cyan-500/20 rounded-2xl">
              <div className="flex items-center gap-4 mb-6">
                <div className="w-10 h-10 rounded-xl bg-cyan-500/20 border border-cyan-500/30 flex items-center justify-center"><Activity className="w-5 h-5 text-cyan-400" /></div>
                <div>
                  <h3 className="font-bold text-white">{language === 'id' ? 'Sedang Dikerjakan' : 'In Progress'}</h3>
                  <p className="text-xs text-cyan-400 font-bold tracking-wide">{language === 'id' ? 'AKTIF DIKEMBANGKAN' : 'ACTIVE DEVELOPMENT'}</p>
                </div>
              </div>
              <ul className="space-y-4">
                {[
                  { icon: '💱', title: language === 'id' ? 'Harga Forex Real-time' : 'Real-time Forex Prices', desc: language === 'id' ? 'Harga pasar langsung di dashboard kamu' : 'Live market prices in your dashboard' },
                  { icon: '🔔', title: language === 'id' ? 'Notifikasi Harga' : 'Price Alerts', desc: language === 'id' ? 'Dapet notif pas harga nyentuh target kamu' : 'Get notified when price hits your target' },
                ].map((item, index) => (
                  <li key={index} className="flex items-start gap-4 p-4 rounded-xl bg-white/[0.02] border border-white/[0.05] hover:border-cyan-500/20 hover:bg-white/[0.04] transition-all">
                    <span className="text-2xl">{item.icon}</span>
                    <div><p className="font-bold text-white text-sm">{item.title}</p><p className="text-xs text-white/40 mt-1">{item.desc}</p></div>
                  </li>
                ))}
              </ul>
            </div>
          </motion.div>

          <motion.div initial={{ opacity: 0, x: 20 }} whileInView={{ opacity: 1, x: 0 }} viewport={{ once: true }} transition={{ delay: 0.2 }}>
            <div className="h-full p-6 bg-[#2a1b3d]/40 backdrop-blur-sm border border-violet-500/20 rounded-2xl">
              <div className="flex items-center gap-4 mb-6">
                <div className="w-10 h-10 rounded-xl bg-violet-500/20 border border-violet-500/30 flex items-center justify-center"><Zap className="w-5 h-5 text-violet-400" /></div>
                <div>
                  <h3 className="font-bold text-white">{language === 'id' ? 'Dalam Perencanaan' : 'Planned'}</h3>
                  <p className="text-xs text-violet-400 font-bold tracking-wide">{language === 'id' ? 'MASIH DIRANCANG' : 'IN DESIGN'}</p>
                </div>
              </div>
              <ul className="space-y-4">
                {[
                  { icon: '📊', title: language === 'id' ? 'Integrasi Chart TradingView' : 'TradingView Charts', desc: language === 'id' ? 'Chart lengkap langsung di dalam LuxTrade' : 'Full charts embedded inside LuxTrade' },
                  { icon: '📥', title: language === 'id' ? 'Import MT4/MT5 Lebih Baik' : 'Better MT4/MT5 Import', desc: language === 'id' ? 'Parsing lebih akurat, support lebih banyak format' : 'More accurate parsing, more format support' },
                  { icon: '🤝', title: language === 'id' ? 'Komunitas & Sharing' : 'Community & Sharing', desc: language === 'id' ? 'Bagikan jurnal ke komunitas, belajar dari trader lain' : 'Share journals with the community, learn from other traders' },
                ].map((item, index) => (
                  <li key={index} className="flex items-start gap-4 p-4 rounded-xl bg-white/[0.02] border border-white/[0.05] hover:border-violet-500/20 hover:bg-white/[0.04] transition-all">
                    <span className="text-2xl">{item.icon}</span>
                    <div><p className="font-bold text-white text-sm">{item.title}</p><p className="text-xs text-white/40 mt-1">{item.desc}</p></div>
                  </li>
                ))}
              </ul>
            </div>
          </motion.div>
        </div>

        {/* Already Available */}
        <motion.div className="mt-10" initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }}>
          <div className="p-6 rounded-2xl bg-emerald-500/10 border border-emerald-500/20">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-xl bg-emerald-500/20 border border-emerald-500/30 flex items-center justify-center"><Check className="w-5 h-5 text-emerald-400" /></div>
              <h3 className="font-bold text-white">{language === 'id' ? 'Sudah Tersedia Sekarang' : 'Already Available'}</h3>
            </div>
            <div className="flex flex-wrap gap-2">
              {(language === 'id' ? ['Jurnal Trading', 'Analitik Performa', 'Analisis AI', 'Tracking P/L', 'Equity Curve', 'Sistem Achievement', 'Streak Tracking', 'Export CSV', 'Export PDF', 'Multi-Platform', 'Responsive Mobile', 'Payment Gateway (Midtrans)'] : ['Trade Journal', 'Performance Analytics', 'AI Analysis', 'P/L Tracking', 'Equity Curve', 'Achievement System', 'Streak Tracking', 'CSV Export', 'PDF Export', 'Multi-Platform', 'Mobile Responsive', 'Payment Gateway (Midtrans)']).map((f, i) => (
                <span key={i} className="px-3 py-1.5 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-emerald-300 text-xs font-bold">✓ {f}</span>
              ))}
            </div>
          </div>
        </motion.div>
      </div>
    </section>
  )
}