'use client'

import React from 'react'
import { motion } from 'framer-motion'
import { Mail } from 'lucide-react'

interface NewsletterSectionProps {
  language: 'id' | 'en'
  newsletterEmail: string
  setNewsletterEmail: (email: string) => void
  newsletterLoading: boolean
  newsletterSuccess: boolean
  handleNewsletterSubmit: (e: React.FormEvent) => void
}

export default function NewsletterSection({ language, newsletterEmail, setNewsletterEmail, newsletterLoading, newsletterSuccess, handleNewsletterSubmit }: NewsletterSectionProps) {
  return (
    <section className="py-20 px-4 sm:px-6 lg:px-8">
      <div className="max-w-2xl mx-auto text-center">
        <motion.div initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }}>
          <div className="flex items-center h-9 w-max mx-auto bg-[#2a1b3d]/90 backdrop-blur-sm border border-white/10 rounded-xl mb-6">
            <div className="w-4 h-full" />
            <div className="flex items-center gap-2 text-sm font-medium text-white/90">
              <Mail className="w-4 h-4 text-purple-400" />
              {language === 'id' ? 'Wawasan Mingguan' : 'Weekly Insights'}
            </div>
            <div className="w-4 h-full" />
          </div>
          <h2 className="text-3xl sm:text-4xl font-extrabold mb-4 text-white">
            {language === 'id' ? 'Dapatkan Tips Trading Setiap Minggu' : 'Get Trading Tips Every Week'}
          </h2>
          <p className="text-white/50 mb-8 max-w-md mx-auto text-base">
            {language === 'id' ? 'Bergabung dengan trader yang menerima tips trading mingguan, wawasan psikologi, dan update fitur terbaru.' : 'Join traders receiving weekly trading tips, psychology insights, and latest feature updates.'}
          </p>
          <form className="flex flex-col sm:flex-row gap-4 max-w-md mx-auto" onSubmit={handleNewsletterSubmit}>
            <input 
              type="email" 
              value={newsletterEmail}
              onChange={(e) => setNewsletterEmail(e.target.value)}
              placeholder={language === 'id' ? 'Masukkan email Anda' : 'Enter your email'} 
              className="flex-1 px-5 py-4 rounded-2xl bg-white/5 border border-white/[0.08] text-white placeholder:text-white/30 focus:outline-none focus:border-purple-500/50 transition-all font-medium" 
              required 
            />
            <button 
              type="submit" 
              disabled={newsletterLoading}
              className="h-14 px-8 bg-gradient-to-r from-purple-500 to-blue-600 hover:from-purple-600 hover:to-blue-700 text-white font-extrabold rounded-2xl shadow-lg shadow-purple-500/30 transition-all active:scale-95 disabled:opacity-50"
            >
              {newsletterLoading ? '...' : (language === 'id' ? 'Langganan' : 'Subscribe')}
            </button>
          </form>
          {newsletterSuccess && (
            <p className="text-green-400 text-sm mt-3">✓ {language === 'id' ? 'Berhasil berlangganan!' : 'Subscribed!'}</p>
          )}
          <p className="text-white/30 text-xs mt-4">{language === 'id' ? 'Tidak ada spam. Berhenti langganan kapan saja.' : 'No spam. Unsubscribe anytime.'}</p>
        </motion.div>
      </div>
    </section>
  )
}