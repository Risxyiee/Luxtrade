'use client'

import React, { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { ChevronDown } from 'lucide-react'
import { FaqSvg } from './SectionSvgArt'

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
    { q: language === 'id' ? 'Butuh bantuan, hubungi siapa?' : 'Need help, who do I contact?', a: language === 'id' ? 'Langsung aja join Discord LuxTrade atau email luxtradee@gmail.com. Biasanya balasnya cepat — karena ini project kecil, bukan perusahaan besar pakai CS robot.' : 'Just join our Discord server or email luxtradee@gmail.com. Response is usually fast — this is a small project, not a big company with robot customer service.' },
  ]

  return (
    <section id="faq" className="relative py-24 lg:py-32 px-4 sm:px-6 lg:px-8 overflow-hidden">
      <FaqSvg />
      <div className="max-w-3xl mx-auto">
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5 }}
          className="mb-14"
        >
          <p className="text-[12px] font-medium tracking-[0.18em] uppercase text-[#8892b0] mb-3">
            {language === 'id' ? 'PERTANYAAN UMUM' : 'FAQ'}
          </p>
          <h2 className="text-3xl md:text-[40px] font-medium tracking-tight text-[#f0f2ff]">
            {language === 'id' ? 'Sebelum mulai. Semua yang perlu kamu tahu.' : 'Before you start. Everything you need to know.'}
          </h2>
        </motion.div>

        <div className="border-t border-white/[0.06]">
          {faqs.map((faq, index) => {
            const isOpen = openFaq === index
            return (
              <motion.div
                key={index}
                initial={{ opacity: 0, y: 12 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, amount: 0.1 }}
                transition={{ delay: index * 0.05 }}
              >
                <button
                  onClick={() => setOpenFaq(isOpen ? null : index)}
                  aria-expanded={isOpen}
                  className={`w-full text-left py-6 px-0 border-b border-white/[0.06] last:border-0 transition-colors duration-200 group`}
                >
                  <div className="flex items-center justify-between gap-4">
                    <h3 className="text-[15px] font-medium text-[#f0f2ff] group-hover:text-blue-400 transition-colors duration-200">{faq.q}</h3>
                    <motion.div animate={{ rotate: isOpen ? 180 : 0 }} transition={{ duration: 0.2 }}>
                      <ChevronDown className="w-4 h-4 text-[#8892b0] shrink-0" />
                    </motion.div>
                  </div>
                  <AnimatePresence>
                    {isOpen && (
                      <motion.p
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: 'auto', opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        transition={{ duration: 0.25 }}
                        className="overflow-hidden"
                      >
                        <span className="block pt-3 text-[14px] text-[#8892b0] leading-relaxed max-w-xl">{faq.a}</span>
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