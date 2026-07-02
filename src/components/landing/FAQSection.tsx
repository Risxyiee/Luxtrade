'use client'

import React, { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { HelpCircle, ChevronDown } from 'lucide-react'

interface FAQSectionProps {
  language: 'id' | 'en'
}

export default function FAQSection({ language }: FAQSectionProps) {
  const [openFaq, setOpenFaq] = useState<number | null>(null)

  const faqs = [
    { q: language === 'id' ? 'LuxTrade gratis nggak?' : 'Is LuxTrade free?', a: language === 'id' ? 'Ada paket gratis — cukup buat catat 10 trade per bulan sama analitik dasar. Kalau kamu serius trading dan butuh fitur lengkap tanpa batas, upgrade ke Elite Pro.' : 'There\'s a free plan — enough to log 10 trades per month with basic analytics. If you\'re serious about trading, upgrade to Elite Pro.' },
    { q: language === 'id' ? 'AI-nya ngapain sih?' : 'What does the AI actually do?', a: language === 'id' ? 'AI menganalisis histori trade kamu — dia bisa detect pola kesalahan yang berulang (misalnya selalu loss di session London, atau FOMO entry tanpa setup). Bukan ramalan harga, tapi refleksi berbasis data kamu sendiri.' : 'AI analyzes your trade history — it can detect repeating mistake patterns. Not price predictions — data-driven reflection of your own trades.' },
    { q: language === 'id' ? 'Bisa import dari MT4/MT5?' : 'Can I import from MT4/MT5?', a: language === 'id' ? 'Bisa. Screenshot trade kamu, upload dan AI otomatis extract data + buat jurnal. Atau input manual langsung dari dashboard.' : 'Yes. Screenshot your trade, upload and AI auto-extracts data + creates a journal. Or input manually from the dashboard.' },
    { q: language === 'id' ? 'Data trading saya aman?' : 'Is my trading data secure?', a: language === 'id' ? 'Data dienkripsi dan disimpan aman. Kami nggak jual data ke pihak ketiga, nggak ada iklan, dan cuma kamu yang bisa akses.' : 'Data is encrypted and securely stored. We don\'t sell data, no ads, only you can access your data.' },
    { q: language === 'id' ? 'Kalau mau refund gimana?' : 'What about refunds?', a: language === 'id' ? 'LuxTrade itu produk digital (SaaS) — sekali bayar, akses langsung aktif. Karena sifatnya digital, semua pembelian bersifat final dan non-refundable. Kecuali kalau ada double charge atau eror dari payment gateway.' : 'LuxTrade is a digital product (SaaS). All purchases are final and non-refundable. Except in cases of double charges or payment gateway errors.' },
    { q: language === 'id' ? 'Butuh bantuan, hubungi siapa?' : 'Need help, who do I contact?', a: language === 'id' ? 'Langsung aja DM Telegram @Risxyiee atau email luxtradee@gmail.com. Biasanya balasnya cepat — karena ini project kecil, bukan perusahaan besar pakai CS robot.' : 'Just DM Telegram @Risxyiee or email luxtradee@gmail.com. Response is usually fast — this is a small project, not a big company with robot customer service.' },
  ]

  return (
    <section id="faq" className="py-20 px-4 sm:px-6 lg:px-8">
      <div className="max-w-3xl mx-auto">
        <div className="flex flex-col items-center mb-12">
          <div className="flex items-center h-9 w-max bg-[var(--lux-badge-bg)] backdrop-blur-sm border border-[var(--lux-inline-border)] rounded-xl mb-6">
            <div className="w-4 h-full" />
            <div className="flex items-center gap-2 text-sm font-medium text-[var(--lux-text-on-surface)]">
              <HelpCircle className="w-4 h-4 text-purple-400" />
              {language === 'id' ? 'Tanya Jawab' : 'FAQ'}
            </div>
            <div className="w-4 h-full" />
          </div>
        </div>
        <div className="space-y-3">
          {faqs.map((faq, index) => {
            const isOpen = openFaq === index
            return (
              <motion.div key={index} initial={{ opacity: 0, y: 15 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ delay: index * 0.06 }}>
                <button
                  onClick={() => setOpenFaq(isOpen ? null : index)}
                  aria-expanded={isOpen}
                  aria-controls={`faq-answer-${index}`}
                  className={`w-full text-left p-5 bg-[var(--lux-card-surface)] backdrop-blur-sm border rounded-2xl transition-all duration-200 ${isOpen ? 'border-purple-500/30 bg-[var(--lux-card-surface-hover)]' : 'border-[var(--lux-inline-border)] hover:border-[var(--lux-inline-hover-bg-2)] hover:bg-[var(--lux-card-surface-hover)]'}`}
                >
                  <div className="flex items-center justify-between gap-4">
                    <h3 className="text-base font-bold text-[var(--lux-text-primary)]">{faq.q}</h3>
                    <motion.div animate={{ rotate: isOpen ? 180 : 0 }} transition={{ duration: 0.2 }}>
                      <ChevronDown className="w-5 h-5 text-purple-400 shrink-0" />
                    </motion.div>
                  </div>
                  <AnimatePresence>
                    {isOpen && (
                      <motion.p
                        id={`faq-answer-${index}`}
                        role="region"
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: 'auto', opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        transition={{ duration: 0.25 }}
                        className="overflow-hidden"
                      >
                        <span className="block pt-3 text-[var(--lux-text-subtitle)] text-sm leading-relaxed">{faq.a}</span>
                      </motion.p>
                    )}
                  </AnimatePresence>
                </button>
              </motion.div>
            )
          })}
        </div>
      </div>
    </section>
  )
}