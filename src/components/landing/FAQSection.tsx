'use client'

import React, { useState } from 'react'
import { motion } from 'framer-motion'
import { FaqSvg } from './SectionSvgArt'
import {
  Accordion,
  AccordionItem,
  AccordionTrigger,
  AccordionContent,
} from '@/components/ui/accordion'

interface FAQSectionProps {
  language: 'id' | 'en'
}

type FAQCategory = 'general' | 'technical' | 'payment'

interface FAQItem {
  q_id: string
  q_en: string
  a_id: string
  a_en: string
  category: FAQCategory
}

const faqData: FAQItem[] = [
  {
    q_id: 'LuxTradee gratis nggak?',
    q_en: 'Is LuxTradee free?',
    a_id: 'Jurnal trade unlimited dan gratis selamanya — catat sebanyak apa pun. Paket gratis juga dapat semua analitik (heatmap, psikologi, trading score, target), chart live 70+ indikator, impor CSV/MT4/screenshot, ekspor data, dan 10x tanya AI per bulan. Kalau kamu butuh lapisan cerdas penuh — tanya AI tanpa batas, AI insights & laporan mingguan, alert dari skrip Pine milikmu — upgrade ke PRO.',
    a_en: "Trade journaling is unlimited and free forever — log as many trades as you want. The free plan also includes full analytics (heatmap, psychology, trading score, targets), a live chart with 70+ indicators, CSV/MT4/screenshot import, data export, and 10x AI chat per month. For the full smart layer — unlimited AI chat, AI insights & weekly report, alerts from your own Pine script — upgrade to PRO.",
    category: 'general',
  },
  {
    q_id: 'AI-nya ngapain sih?',
    q_en: 'What does the AI actually do?',
    a_id: 'AI menganalisis histori trade kamu — dia bisa detect pola kesalahan yang berulang (misalnya selalu loss di session London, atau FOMO entry tanpa setup). Bukan ramalan harga, tapi refleksi berbasis data kamu sendiri.',
    a_en: 'AI analyzes your trade history — it can detect repeating mistake patterns. Not price predictions — data-driven reflection of your own trades.',
    category: 'technical',
  },
  {
    q_id: 'Bisa import dari MT4/MT5?',
    q_en: 'Can I import from MT4/MT5?',
    a_id: 'Bisa! Semua jalur input gratis: isi manual, impor CSV/MT4, atau upload screenshot — AI otomatis extract pair, entry/exit, SL/TP, profit/loss, langsung jadi jurnal. Kamu juga bisa ekspor semua data ke CSV/PDF kapan saja.',
    a_en: 'Yes! Every input path is free: manual entry, CSV/MT4 import, or screenshot upload — AI auto-extracts pair, entry/exit, SL/TP, profit/loss into your journal. You can also export all your data to CSV/PDF anytime.',
    category: 'technical',
  },
  {
    q_id: 'Data trading saya aman?',
    q_en: 'Is my trading data secure?',
    a_id: 'Data dienkripsi dan disimpan aman di server. Kami nggak jual data ke pihak ketiga, nggak ada iklan, dan cuma kamu yang bisa akses — plus kamu bisa ekspor data milikmu kapan saja.',
    a_en: "Data is encrypted and securely stored on Supabase. We don't sell data, no ads, only you can access your data.",
    category: 'general',
  },
  {
    q_id: 'Kalau mau refund gimana?',
    q_en: 'What about refunds?',
    a_id: 'LuxTradee itu produk digital (SaaS) — sekali bayar, akses langsung aktif. Karena sifatnya digital, semua pembelian bersifat final dan non-refundable. Kecuali kalau ada double charge atau eror dari payment gateway.',
    a_en: 'LuxTradee is a digital product (SaaS). All purchases are final and non-refundable. Except in cases of double charges or payment gateway errors.',
    category: 'payment',
  },
  {
    q_id: 'Butuh bantuan, hubungi siapa?',
    q_en: 'Need help, who do I contact?',
    a_id: 'Klik aja ikon chat 🤖 di pojok kanan bawah — bot CS kami siap bantu 24/7! Kalau butuh bicara langsung sama admin, bot akan arahkan ke Telegram @Risxyiee.',
    a_en: 'Click the chat icon 🤖 at the bottom right — our CS bot is ready 24/7! If you need to talk to an admin directly, the bot will direct you to Telegram @Risxyiee.',
    category: 'general',
  },
]

export default function FAQSection({ language }: FAQSectionProps) {
  const [openItem, setOpenItem] = useState<string | null>(null)

  const getCategoryBadge = (category: FAQCategory) => {
    const badges: Record<FAQCategory, { label_id: string; label_en: string; className: string }> = {
      general: {
        label_id: 'Umum',
        label_en: 'General',
        className: 'bg-blue-500/10 text-blue-400 border-blue-500/20',
      },
      technical: {
        label_id: 'Teknis',
        label_en: 'Technical',
        className: 'bg-cyan-500/10 text-cyan-400 border-cyan-500/20',
      },
      payment: {
        label_id: 'Pembayaran',
        label_en: 'Payment',
        className: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
      },
    }
    const b = badges[category]
    return (
      <span className={`inline-flex items-center px-2 py-0.5 text-[10px] font-semibold rounded-full border ${b.className}`}>
        {language === 'id' ? b.label_id : b.label_en}
      </span>
    )
  }

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

        <motion.div
          initial={{ opacity: 0, y: 12 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5, delay: 0.1 }}
        >
          <Accordion
            type="single"
            collapsible
            value={openItem ?? ''}
            onValueChange={(val) => setOpenItem(val || null)}
            className="border-t border-white/[0.06]"
          >
            {faqData.map((faq, index) => (
              <AccordionItem
                key={index}
                value={`faq-${index}`}
                className="border-b border-white/[0.06] last:border-b-0"
              >
                <AccordionTrigger className="py-6 px-0 hover:no-underline group">
                  <div className="flex items-center gap-3 flex-1">
                    {getCategoryBadge(faq.category)}
                    <h3 className="text-[15px] font-medium text-[#f0f2ff] group-hover:text-blue-400 transition-colors duration-200 text-left">
                      {language === 'id' ? faq.q_id : faq.q_en}
                    </h3>
                  </div>
                </AccordionTrigger>
                <AccordionContent className="text-[14px] text-[#8892b0] leading-relaxed max-w-xl pb-6">
                  {language === 'id' ? faq.a_id : faq.a_en}
                </AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
        </motion.div>
      </div>
    </section>
  )
}
