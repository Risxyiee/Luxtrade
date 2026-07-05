'use client'

import React from 'react'
import { motion } from 'framer-motion'
import { Mail, Bell } from 'lucide-react'

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
        <motion.div initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true, amount: 0.1 }}>
          {/* Unique badge: compact with bell icon */}
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-gradient-to-r from-purple-500/10 to-pink-500/10 border border-pink-500/20 mb-6">
            <Bell className="w-3.5 h-3.5 text-pink-400" />
            <span className="text-xs font-bold text-pink-300">
              {language === 'id' ? 'Wawasan Mingguan' : 'Weekly Insights'}
            </span>
          </div>
          <h2 className="text-3xl sm:text-4xl font-extrabold mb-4 text-[var(--lux-text-primary)]">
            {language === 'id' ? 'Dapatkan Tips Trading Setiap Minggu' : 'Get Trading Tips Every Week'}
          </h2>
          <p className="text-[var(--lux-text-subtitle)] mb-8 max-w-md mx-auto text-base">
            {language === 'id' ? 'Bergabung dengan trader yang menerima tips trading mingguan, wawasan psikologi, dan update fitur terbaru.' : 'Join traders receiving weekly trading tips, psychology insights, and latest feature updates.'}
          </p>
          <form className="flex flex-col sm:flex-row gap-4 max-w-md mx-auto" onSubmit={handleNewsletterSubmit}>
            <input 
              type="email" 
              value={newsletterEmail}
              onChange={(e) => setNewsletterEmail(e.target.value)}
              placeholder={language === 'id' ? 'Masukkan email Anda' : 'Enter your email'} 
              className="flex-1 px-5 py-4 rounded-2xl bg-[var(--lux-inline-hover-bg)] border border-[var(--lux-inline-border)] text-[var(--lux-text-primary)] placeholder:text-[var(--lux-text-label)] focus:outline-none focus:border-purple-500/50 transition-all font-medium" 
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
          <p className="text-[var(--lux-text-label)] text-xs mt-4">{language === 'id' ? 'Tidak ada spam. Berhenti langganan kapan saja.' : 'No spam. Unsubscribe anytime.'}</p>
        </motion.div>
      </div>
    </section>
  )
}