'use client'

import React, { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Star, Quote, ChevronLeft, ChevronRight } from 'lucide-react'

interface Testimonial {
  name: string
  role: string
  avatar: string
  rating: number
  text: string
  textEn: string
  gradient: string
  borderHover: string
}

const DEFAULT_TESTIMONIALS: Testimonial[] = [
  {
    name: 'Andi Pratama',
    role: 'Forex Trader · Jakarta',
    avatar: 'AP',
    rating: 5,
    text: 'Dulu saya cuma catat trade di notes HP, sekarang semua terstruktur. AI-nya beneran nunjukin pola loss yang saya nggak sadar — selalu FOMO di session London. Win rate naik dari 40% ke 58% dalam 2 bulan.',
    textEn: 'I used to log trades in phone notes, now everything is structured. The AI really shows loss patterns I didn\'t realize — always FOMOing in London session. Win rate went from 40% to 58% in 2 months.',
    gradient: 'from-purple-500 to-violet-600',
    borderHover: 'hover:border-purple-500/30',
  },
  {
    name: 'Rina Wulandari',
    role: 'Part-time Trader · Bandung',
    avatar: 'RW',
    rating: 5,
    text: 'Sebagai trader part-time, saya butuh tools yang simpel. LuxTrade pas banget — screenshot langsung jadi jurnal. Nggak perlu input manual lagi. Save banget waktu saya.',
    textEn: 'As a part-time trader, I need simple tools. LuxTrade is perfect — screenshot instantly becomes a journal. No more manual input. Saves me so much time.',
    gradient: 'from-cyan-500 to-blue-600',
    borderHover: 'hover:border-cyan-500/30',
  },
  {
    name: 'Dimas Kurniawan',
    role: 'Swing Trader · Surabaya',
    avatar: 'DK',
    rating: 5,
    text: 'Fitur equity curve dan AI analysis game changer. Saya baru sadar 60% loss saya terjadi di hari Jumat. Sekarang saya avoid trading di hari itu dan performa langsung membaik.',
    textEn: 'Equity curve and AI analysis are game changers. I just realized 60% of my losses happen on Fridays. Now I avoid trading that day and performance immediately improved.',
    gradient: 'from-emerald-500 to-teal-600',
    borderHover: 'hover:border-emerald-500/30',
  },
  {
    name: 'Sarah Amelia',
    role: 'Beginner Trader · Yogyakarta',
    avatar: 'SA',
    rating: 4,
    text: 'Baru 3 bulan trading dan LuxTrade bantu saya nggak repeat kesalahan sama. Fitur risk calculator juga membantu saya manage lot size yang benar. Recommended buat beginner!',
    textEn: 'Only 3 months trading and LuxTrade helps me not repeat mistakes. The risk calculator also helps me manage proper lot sizes. Recommended for beginners!',
    gradient: 'from-pink-500 to-rose-600',
    borderHover: 'hover:border-pink-500/30',
  },
  {
    name: 'Budi Santoso',
    role: 'Scalper · Semarang',
    avatar: 'BS',
    rating: 5,
    text: 'Pernah coba 5 trading journal lain, semuanya terlalu ribet. LuxTrade yang paling clean dan cepat. Screenshot → AI extract → done. Kurang dari 10 detik per trade.',
    textEn: 'Tried 5 other trading journals, all too complicated. LuxTrade is the cleanest and fastest. Screenshot → AI extract → done. Under 10 seconds per trade.',
    gradient: 'from-amber-500 to-orange-600',
    borderHover: 'hover:border-amber-500/30',
  },
  {
    name: 'Fitri Handayani',
    role: 'Day Trader · Medan',
    avatar: 'FH',
    rating: 5,
    text: 'Yang paling helpful itu AI pattern detection. Dia detect saya selalu overtrading setelah loss berturut-turut. Sekarang saya punya rule: max 3 trade setelah loss. Discipline naik banget.',
    textEn: 'The most helpful thing is AI pattern detection. It detected I always overtrade after consecutive losses. Now I have a rule: max 3 trades after a loss. Discipline improved a lot.',
    gradient: 'from-violet-500 to-purple-600',
    borderHover: 'hover:border-violet-500/30',
  },
]

export default function TestimonialSection({ language }: { language: 'id' | 'en' }) {
  const [currentPage, setCurrentPage] = useState(0)
  const [direction, setDirection] = useState(0)
  const containerRef = React.useRef<HTMLDivElement>(null)

  const testimonialsPerPage = 3
  const totalPages = Math.ceil(DEFAULT_TESTIMONIALS.length / testimonialsPerPage)
  const currentTestimonials = DEFAULT_TESTIMONIALS.slice(
    currentPage * testimonialsPerPage,
    currentPage * testimonialsPerPage + testimonialsPerPage
  )

  const paginate = (newDirection: number) => {
    setDirection(newDirection)
    setCurrentPage(prev => {
      if (newDirection === 1) return prev >= totalPages - 1 ? 0 : prev + 1
      return prev <= 0 ? totalPages - 1 : prev - 1
    })
  }

  return (
    <section id="testimonials" className="py-20 px-4 sm:px-6 lg:px-8">
      <div className="max-w-6xl mx-auto">
        {/* Section Header */}
        <div className="text-center mb-14">
          <h2 className="text-3xl sm:text-4xl font-extrabold text-[var(--lux-text-primary)] mb-4">
            {language === 'id' ? 'Apa Kata Mereka' : 'What They Say'}
          </h2>
          <p className="text-[var(--lux-text-subtitle)] max-w-lg mx-auto text-base">
            {language === 'id'
              ? 'Trader Indonesia sudah pakai LuxTrade untuk memperbaiki performa mereka.'
              : 'Indonesian traders are already using LuxTrade to improve their performance.'}
          </p>
        </div>

        {/* Testimonial Cards */}
        <div ref={containerRef} className="relative overflow-hidden">
          <AnimatePresence mode="wait" custom={direction}>
            <motion.div
              key={currentPage}
              custom={direction}
              initial={{ opacity: 0, x: direction >= 0 ? 80 : -80 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: direction >= 0 ? -80 : 80 }}
              transition={{ duration: 0.35, ease: 'easeInOut' }}
              className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5"
            >
              {currentTestimonials.map((t, i) => (
                <div
                  key={t.name}
                  className={`relative flex flex-col bg-[var(--lux-card-surface)] backdrop-blur-sm border border-[var(--lux-inline-border)] rounded-2xl p-6 hover:bg-[var(--lux-card-surface-hover)] ${t.borderHover} transition-all duration-300 h-full`}
                >
                  {/* Quote icon */}
                  <Quote className="absolute top-5 right-5 w-8 h-8 text-[var(--lux-text-label-3)] opacity-50" />

                  {/* Stars */}
                  <div className="flex items-center gap-1 mb-4">
                    {Array.from({ length: 5 }).map((_, si) => (
                      <Star
                        key={si}
                        className={`w-4 h-4 ${si < t.rating ? 'text-amber-400 fill-amber-400' : 'text-[var(--lux-text-label-3)]'}`}
                      />
                    ))}
                  </div>

                  {/* Quote Text */}
                  <div className="flex-1 mb-5">
                    <p className="text-[var(--lux-text-body-2)] text-sm leading-relaxed">
                      &ldquo;{language === 'id' ? t.text : t.textEn}&rdquo;
                    </p>
                  </div>

                  {/* Author */}
                  <div className="flex items-center gap-3 pt-4 border-t border-[var(--lux-inline-border)]">
                    <div className={`w-10 h-10 rounded-full bg-gradient-to-br ${t.gradient} flex items-center justify-center text-white text-xs font-bold shrink-0`}>
                      {t.avatar}
                    </div>
                    <div>
                      <p className="text-sm font-bold text-[var(--lux-text-primary)]">{t.name}</p>
                      <p className="text-xs text-[var(--lux-text-label-2)]">{t.role}</p>
                    </div>
                  </div>
                </div>
              ))}
            </motion.div>
          </AnimatePresence>
        </div>

        {/* Pagination */}
        <div className="flex items-center justify-center gap-4 mt-10">
          <button
            onClick={() => paginate(-1)}
            className="w-11 h-11 rounded-full bg-[var(--lux-card-surface)] border border-[var(--lux-inline-border)] flex items-center justify-center hover:bg-[var(--lux-card-surface-hover)] transition-colors"
            aria-label="Previous testimonials"
          >
            <ChevronLeft className="w-5 h-5 text-[var(--lux-text-body-2)]" />
          </button>
          <div className="flex items-center gap-2">
            {Array.from({ length: totalPages }).map((_, i) => (
              <button
                key={i}
                onClick={() => { setDirection(i > currentPage ? 1 : -1); setCurrentPage(i) }}
                className={`w-2.5 h-2.5 rounded-full transition-all ${i === currentPage ? 'bg-purple-500 w-6' : 'bg-[var(--lux-text-label-3)] hover:bg-[var(--lux-text-label-2)]'}`}
                aria-label={`Go to page ${i + 1}`}
              />
            ))}
          </div>
          <button
            onClick={() => paginate(1)}
            className="w-11 h-11 rounded-full bg-[var(--lux-card-surface)] border border-[var(--lux-inline-border)] flex items-center justify-center hover:bg-[var(--lux-card-surface-hover)] transition-colors"
            aria-label="Next testimonials"
          >
            <ChevronRight className="w-5 h-5 text-[var(--lux-text-body-2)]" />
          </button>
        </div>
      </div>
    </section>
  )
}