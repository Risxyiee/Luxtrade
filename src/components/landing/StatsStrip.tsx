'use client'

import React from 'react'
import { motion } from 'framer-motion'
import { BarChart3, Activity, Brain, Lock } from 'lucide-react'

interface StatsStripProps {
  language: 'id' | 'en'
  t: (key: string) => string
}

export default function StatsStrip({ language, t }: StatsStripProps) {
  const stats = [
    { value: '10+', label: language === 'id' ? 'Tipe Analitik' : 'Analytics Types', icon: BarChart3 },
    { value: '24/7', label: language === 'id' ? 'Akses Dashboard' : 'Dashboard Access', icon: Activity },
    { value: 'AI', label: language === 'id' ? 'Analisis Cerdas' : 'Smart Analysis', icon: Brain },
    { value: 'E2E', label: language === 'id' ? 'Enkripsi Data' : 'Data Encryption', icon: Lock },
  ]

  return (
    <section className="w-full pb-16 px-4 sm:px-6 lg:px-8">
      <div className="max-w-7xl mx-auto">
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {stats.map((stat, index) => (
            <motion.div key={index} initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ delay: index * 0.1 }}
              className="flex flex-col bg-[#2a1b3d]/40 backdrop-blur-sm border border-white/10 rounded-2xl p-5 hover:bg-[#2a1b3d]/60 transition-colors"
            >
              <div className="flex items-center gap-3 mb-3">
                <div className="w-10 h-10 md:w-12 md:h-12 rounded-full bg-[#171221] border border-white/5 flex items-center justify-center shrink-0 shadow-inner">
                  <stat.icon className="w-4 h-4 md:w-5 md:h-5 text-purple-400" />
                </div>
                <h3 className="text-purple-300 font-medium text-sm md:text-[15px] leading-tight">{stat.value}</h3>
              </div>
              <p className="text-white/60 text-xs md:text-sm font-medium leading-relaxed">{stat.label}</p>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  )
}