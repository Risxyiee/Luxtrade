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
    <section className="py-24 lg:py-32 px-4 sm:px-6 lg:px-8">
      <div className="max-w-2xl mx-auto text-center">
        <motion.div initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true, amount: 0.1 }}>
          <p className="text-[12px] font-medium tracking-[0.18em] uppercase text-[#8892b0] mb-3">
            {language === 'id' ? 'Wawasan Mingguan' : 'Weekly Insights'}
          </p>
          <h2 className="text-3xl md:text-[40px] font-medium tracking-tight text-[#f0f2ff] mb-4">
            {language === 'id' ? 'Dapatkan Tips Trading Setiap Minggu' : 'Get Trading Tips Every Week'}
          </h2>
          <p className="text-[#8892b0] mb-8 max-w-md mx-auto text-base">
            {language === 'id' ? 'Bergabung dengan trader yang menerima tips trading mingguan, wawasan psikologi, dan update fitur terbaru.' : 'Join traders receiving weekly trading tips, psychology insights, and latest feature updates.'}
          </p>
          <form className="flex flex-col sm:flex-row gap-4 max-w-md mx-auto" onSubmit={handleNewsletterSubmit}>
            <input 
              type="email" 
              value={newsletterEmail}
              onChange={(e) => setNewsletterEmail(e.target.value)}
              placeholder={language === 'id' ? 'Masukkan email Anda' : 'Enter your email'} 
              className="flex-1 px-5 py-4 rounded-xl bg-white/[0.03] border border-white/[0.08] text-[#f0f2ff] placeholder:text-[#8892b0] focus:outline-none focus:border-blue-500/50 transition-colors duration-200 font-medium" 
              required 
            />
            <button 
              type="submit" 
              disabled={newsletterLoading}
              className="h-14 px-8 bg-blue-500 text-white font-medium rounded-xl hover:bg-blue-600 transition-all active:scale-95 disabled:opacity-50"
            >
              {newsletterLoading ? '...' : (language === 'id' ? 'Langganan' : 'Subscribe')}
            </button>
          </form>
          {newsletterSuccess && (
            <p className="text-emerald-400 text-sm mt-3">✓ {language === 'id' ? 'Berhasil berlangganan!' : 'Subscribed!'}</p>
          )}
          <p className="text-[#8892b0] text-xs mt-4">{language === 'id' ? 'Tidak ada spam. Berhenti langganan kapan saja.' : 'No spam. Unsubscribe anytime.'}</p>
        </motion.div>
      </div>
    </section>
  )
}