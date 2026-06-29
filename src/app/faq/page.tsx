'use client'

import React, { useState } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import { motion, AnimatePresence } from 'framer-motion'
import { Button } from '@/components/ui/button'
import { ArrowLeft, ChevronDown } from 'lucide-react'

interface FAQItem {
  question: string
  answer: React.ReactNode
}

const faqSections: { title: string; items: FAQItem[] }[] = [
  {
    title: 'Tentang LuxTrade',
    items: [
      {
        question: 'Apa itu LuxTrade?',
        answer: 'LuxTrade adalah platform SaaS (Software-as-a-Service) berupa trading journal dan dashboard analisis untuk membantu trader mencatat, memantau, dan mengevaluasi performa trading mereka. Kami BUKAN broker, pialang, atau pengelola dana.',
      },
      {
        question: 'Apakah LuxTrade adalah broker atau platform trading?',
        answer: 'TIDAK. LuxTrade hanya menyediakan perangkat lunak untuk mencatat dan menganalisis data trading. Kami tidak mengeksekusi transaksi atau menyimpan dana pengguna.',
      },
    ],
  },
  {
    title: 'Akun & Langganan',
    items: [
      {
        question: 'Apakah ada versi gratis?',
        answer: 'Ya, LuxTrade menyediakan paket gratis dengan fitur dasar termasuk 10 jurnal transaksi per bulan, grafik performa standar, dan kalkulator risiko pemula.',
      },
      {
        question: 'Apa saja keuntungan paket Elite Pro?',
        answer: 'Paket Pro memberikan akses unlimited ke semua fitur: unlimited jurnal, analisis AI, grafik win-rate, kalkulator risiko advance, ekspor data ke Excel/PDF, dan dukungan prioritas.',
      },
      {
        question: 'Apakah ada free trial?',
        answer: 'Ya! Setiap pengguna baru mendapatkan free trial 7 hari Pro setelah verifikasi email. Gunakan masa trial ini untuk mengevaluasi semua fitur premium sebelum membeli.',
      },
    ],
  },
  {
    title: 'Pembayaran',
    items: [
      {
        question: 'Metode pembayaran apa yang diterima?',
        answer: 'Kami menerima pembayaran melalui QRIS yang dapat diakses dari semua e-wallet (GoPay, DANA, OVO, ShopeePay, dll) dan mobile banking.',
      },
      {
        question: 'Bagaimana cara berlangganan?',
        answer: 'Pilih paket yang diinginkan, scan QRIS untuk pembayaran, lalu konfirmasi ke Telegram admin @Risxyiee dengan bukti transfer. Akun Pro akan diaktivasi manual setelah verifikasi.',
      },
      {
        question: 'Apakah bisa refund?',
        answer: (
          <>
            Karena LuxTrade adalah produk digital (SaaS), pembelian bersifat non-refundable. Namun kami menyediakan free trial 7 hari untuk evaluasi. Pengecualian hanya untuk pembayaran ganda atau error teknis. Lihat halaman{' '}
            <Link href="/refund" className="text-purple-400 underline hover:text-purple-300 transition-colors">Refund Policy</Link> untuk detail lengkap.
          </>
        ),
      },
    ],
  },
  {
    title: 'Keamanan & Privasi',
    items: [
      {
        question: 'Apakah data trading saya aman?',
        answer: 'Ya, kami menggunakan enkripsi dan keamanan standar industri. Data trading Anda tetap menjadi milik Anda dan tidak dijual ke pihak ketiga.',
      },
      {
        question: 'Apakah LuxTrade terdaftar di OJK?',
        answer: 'Tidak. LuxTrade adalah platform perangkat lunak (SaaS) dan tidak memerlukan registrasi OJK karena kami tidak menyediakan layanan keuangan, broker, atau pengelolaan dana.',
      },
    ],
  },
  {
    title: 'Teknis',
    items: [
      {
        question: 'Di platform apa LuxTrade bisa diakses?',
        answer: 'LuxTrade adalah web-based platform yang dapat diakses dari browser manapun (desktop dan mobile) tanpa perlu instalasi aplikasi.',
      },
      {
        question: 'Bagaimana cara menghapus akun?',
        answer: 'Anda bisa menghapus akun melalui menu Settings di dashboard. Penghapusan akun akan menghapus semua data Anda secara permanen.',
      },
    ],
  },
]

function FAQAccordion({ item, index }: { item: FAQItem; index: number }) {
  const [isOpen, setIsOpen] = useState(false)

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, delay: index * 0.05 }}
      className="border border-white/5 rounded-xl overflow-hidden bg-white/[0.02] hover:bg-white/[0.03] transition-colors"
    >
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="w-full flex items-center justify-between gap-4 p-5 text-left cursor-pointer"
      >
        <span className="text-white/90 font-medium text-sm md:text-base leading-relaxed">
          {item.question}
        </span>
        <motion.div
          animate={{ rotate: isOpen ? 180 : 0 }}
          transition={{ duration: 0.25 }}
          className="shrink-0"
        >
          <ChevronDown className="w-5 h-5 text-purple-400" />
        </motion.div>
      </button>

      <AnimatePresence initial={false}>
        {isOpen && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.3, ease: [0.4, 0, 0.2, 1] }}
            className="overflow-hidden"
          >
            <div className="px-5 pb-5 text-white/60 text-sm leading-relaxed border-t border-white/5 pt-4">
              {item.answer}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  )
}

export default function FAQPage() {
  return (
    <div className="min-h-screen bg-[#0a0612] text-white">
      <div className="fixed inset-0 -z-10">
        <div className="absolute inset-0 bg-gradient-to-b from-[#0a0612] via-[#110a1f] to-[#0a0612]" />
        <div className="absolute top-0 left-1/4 w-[600px] h-[600px] bg-purple-500/5 rounded-full blur-[150px]" />
      </div>

      {/* Header */}
      <header className="border-b border-white/5 bg-[#0a0612]/80 backdrop-blur-xl sticky top-0 z-50">
        <div className="max-w-4xl mx-auto px-4 py-4 flex items-center justify-between">
          <Link href="/" className="inline-flex items-center gap-3">
            <Image
              src="/logo-premium.png"
              alt="LuxTrade Logo"
              width={36}
              height={36}
              className="rounded-lg"
            />
            <span className="text-lg font-bold bg-gradient-to-r from-purple-200 to-purple-400 bg-clip-text text-transparent">
              LuxTrade
            </span>
          </Link>
          <Link href="/">
            <Button variant="ghost" className="text-white/60 hover:text-white">
              <ArrowLeft className="w-4 h-4 mr-2" />
              Kembali
            </Button>
          </Link>
        </div>
      </header>

      {/* Content */}
      <main className="max-w-4xl mx-auto px-4 py-12">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
        >
          <h1 className="text-4xl font-bold mb-2">FAQ</h1>
          <p className="text-white/40 mb-10">
            Pertanyaan yang sering diajukan tentang LuxTrade
          </p>

          <div className="space-y-10">
            {faqSections.map((section) => (
              <section key={section.title}>
                <h2 className="text-xl font-semibold text-purple-400 mb-4">
                  {section.title}
                </h2>
                <div className="space-y-3">
                  {section.items.map((item, index) => (
                    <FAQAccordion key={item.question} item={item} index={index} />
                  ))}
                </div>
              </section>
            ))}
          </div>
        </motion.div>
      </main>

      {/* Footer */}
      <footer className="border-t border-white/5 py-8 mt-12">
        <div className="max-w-4xl mx-auto px-4 text-center text-white/40 text-sm">
          <p>© {new Date().getFullYear()} LuxTrade. All rights reserved.</p>
          <div className="flex flex-wrap justify-center gap-4 md:gap-6 mt-4">
            <Link href="/disclaimer" className="hover:text-white transition-colors">Disclaimer</Link>
            <Link href="/privacy" className="hover:text-white transition-colors">Privacy Policy</Link>
            <Link href="/terms" className="hover:text-white transition-colors">Terms of Service</Link>
            <Link href="/refund" className="hover:text-white transition-colors">Refund Policy</Link>
            <Link href="/faq" className="hover:text-white transition-colors">FAQ</Link>
            <Link href="/kontak" className="hover:text-white transition-colors">Kontak</Link>
          </div>
        </div>
      </footer>
    </div>
  )
}