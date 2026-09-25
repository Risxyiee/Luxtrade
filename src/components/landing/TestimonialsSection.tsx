'use client'

import React, { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Star, ChevronLeft, ChevronRight, MessageSquarePlus, PenLine, Sparkles, FileCheck, BadgeCheck } from 'lucide-react'
import TestimonialForm from './TestimonialForm'

interface DatabaseTestimonial {
  id: string
  user_name: string
  role: string | null
  rating: number
  text: string
  profile_image_url: string | null
  trades_logged: number
  prop_firms_passed: number
  is_verified: boolean
  created_at: string
  gradient?: string
  borderHover?: string
}

interface DefaultTestimonial {
  name: string
  role: string
  avatar: string
  rating: number
  text: string
  textEn: string
  gradient: string
  borderHover: string
}

const DEFAULT_TESTIMONIALS: DefaultTestimonial[] = [
  {
    name: 'Andi Pratama',
    role: 'Forex Trader · Jakarta',
    avatar: 'AP',
    rating: 5,
    text: 'Dulu saya cuma catat trade di notes HP, sekarang semua terstruktur. AI-nya beneran nunjukin pola loss yang saya nggak sadar — selalu FOMO di session London. Win rate naik dari 40% ke 58% dalam 2 bulan.',
    textEn: 'I used to log trades in phone notes, now everything is structured. The AI really shows loss patterns I didn\'t realize — always FOMOing in London session. Win rate went from 40% to 58% in 2 months.',
    gradient: 'from-blue-500 to-cyan-600',
    borderHover: 'hover:border-blue-500/30',
  },
  {
    name: 'Rina Wulandari',
    role: 'Part-time Trader · Bandung',
    avatar: 'RW',
    rating: 5,
    text: 'Sebagai trader part-time, saya butuh tools yang simpel. LuxTradee pas banget — screenshot langsung jadi jurnal. Nggak perlu input manual lagi. Save banget waktu saya.',
    textEn: 'As a part-time trader, I need simple tools. LuxTradee is perfect — screenshot instantly becomes a journal. No more manual input. Saves me so much time.',
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
]

const gradients = [
  'from-blue-500 to-cyan-600',
  'from-cyan-500 to-blue-600',
  'from-emerald-500 to-teal-600',
  'from-cyan-400 to-rose-600',
  'from-amber-500 to-orange-600',
  'from-purple-500 to-pink-600',
  'from-indigo-500 to-blue-600',
]

export default function TestimonialsSection({ language }: { language: 'id' | 'en' }) {
  const [currentPage, setCurrentPage] = useState(0)
  const [direction, setDirection] = useState(0)
  const [testimonials, setTestimonials] = useState<(DatabaseTestimonial | DefaultTestimonial)[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [dbTestimonialCount, setDbTestimonialCount] = useState(0)
  const containerRef = React.useRef<HTMLDivElement>(null)

  const testimonialsPerPage = 3

  useEffect(() => {
    const fetchTestimonials = async () => {
      try {
        const response = await fetch('/api/testimonials?limit=20')
        const data = await response.json()

        if (data.success && data.testimonials && data.testimonials.length > 0) {
          setDbTestimonialCount(data.testimonials.length)
          const dbTestimonials = data.testimonials.map((t: DatabaseTestimonial, i: number) => ({
            ...t,
            gradient: gradients[i % gradients.length],
            borderHover: `hover:border-${gradients[i % gradients.length].split('-')[1]}-500/30`,
          }))
          setTestimonials([...dbTestimonials, ...DEFAULT_TESTIMONIALS])
        } else {
          setTestimonials(DEFAULT_TESTIMONIALS)
        }
      } catch (error) {
        console.error('Error fetching testimonials:', error)
        setTestimonials(DEFAULT_TESTIMONIALS)
      } finally {
        setIsLoading(false)
      }
    }

    fetchTestimonials()
  }, [])

  const refreshTestimonials = async () => {
    try {
      const response = await fetch('/api/testimonials?limit=20')
      const data = await response.json()
      if (data.success && data.testimonials) {
        setDbTestimonialCount(data.testimonials.length)
        const dbTestimonials = data.testimonials.map((t: DatabaseTestimonial, i: number) => ({
          ...t,
          gradient: gradients[i % gradients.length],
          borderHover: `hover:border-${gradients[i % gradients.length].split('-')[1]}-500/30`,
        }))
        setTestimonials([...dbTestimonials, ...DEFAULT_TESTIMONIALS])
        setCurrentPage(0)
      }
    } catch {}
  }

  const totalPages = Math.ceil(testimonials.length / testimonialsPerPage)
  const currentTestimonials = testimonials.slice(
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

  const isDatabaseTestimonial = (t: any): t is DatabaseTestimonial => {
    return t.id !== undefined
  }

  const getDisplayName = (t: DatabaseTestimonial | DefaultTestimonial): string => {
    if (isDatabaseTestimonial(t)) return t.user_name
    return t.name
  }

  const getRole = (t: DatabaseTestimonial | DefaultTestimonial): string => {
    if (isDatabaseTestimonial(t)) {
      if (t.role) return t.role
      if (t.trades_logged > 0) {
        const firmsText = t.prop_firms_passed > 0
          ? ` · ${t.prop_firms_passed} Prop Firm${t.prop_firms_passed > 1 ? 's' : ''}`
          : ''
        return `Trader${firmsText}`
      }
      return 'Trader'
    }
    return t.role
  }

  const getAvatar = (t: DatabaseTestimonial | DefaultTestimonial, index: number): string => {
    if (isDatabaseTestimonial(t)) {
      if (t.profile_image_url) return t.profile_image_url
      return t.user_name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2)
    }
    return t.avatar
  }

  const getGradient = (t: DatabaseTestimonial | DefaultTestimonial, index: number): string => {
    if (isDatabaseTestimonial(t)) return t.gradient || gradients[index % gradients.length]
    return t.gradient
  }

  const getText = (t: DatabaseTestimonial | DefaultTestimonial): string => {
    if (isDatabaseTestimonial(t)) return t.text
    return language === 'id' ? t.text : t.textEn
  }

  const renderStars = (rating: number) => {
    return Array.from({ length: 5 }).map((_, i) => (
      <Star key={i} className={`w-3.5 h-3.5 ${i < rating ? 'text-amber-400 fill-amber-400' : 'text-white/15'}`} />
    ))
  }

  if (isLoading) {
    return (
      <section id="testimonials" className="py-20 px-4 sm:px-6 lg:px-8">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-14">
            <h2 className="text-3xl sm:text-4xl font-extrabold text-[var(--lux-text-primary)] mb-4">
              {language === 'id' ? 'Apa Kata Mereka' : 'What They Say'}
            </h2>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {[1, 2, 3].map(i => (
              <div key={i} className="h-64 bg-[var(--lux-card-surface)] rounded-2xl animate-pulse" />
            ))}
          </div>
        </div>
      </section>
    )
  }

  return (
    <section id="testimonials" className="py-20 px-4 sm:px-6 lg:px-8">
      <div className="max-w-6xl mx-auto">
        {/* Section Header */}
        <div className="text-center mb-10">
          <h2 className="text-3xl sm:text-4xl font-extrabold text-[var(--lux-text-primary)] mb-4">
            {language === 'id' ? 'Apa Kata Mereka' : 'What They Say'}
          </h2>
          <p className="text-[var(--lux-text-subtitle)] max-w-lg mx-auto text-base">
            {language === 'id'
              ? 'Trader Indonesia sudah pakai LuxTradee untuk memperbaiki performa mereka.'
              : 'Indonesian traders are already using LuxTradee to improve their performance.'}
          </p>
        </div>

        {/* CTA Tulis Testimoni */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="mb-12"
        >
          <button
            onClick={() => setShowForm(true)}
            className="w-full group relative overflow-hidden rounded-2xl border border-blue-500/30 bg-gradient-to-r from-blue-500/10 via-cyan-500/10 to-blue-500/10 p-6 sm:p-8 hover:border-blue-500/50 transition-all duration-300"
          >
            <div className="absolute inset-0 bg-gradient-to-r from-blue-500/5 via-cyan-500/5 to-blue-500/5 opacity-0 group-hover:opacity-100 transition-opacity duration-500" />

            <div className="relative flex flex-col sm:flex-row items-center justify-center gap-4 sm:gap-6">
              <div className="flex items-center justify-center w-14 h-14 rounded-2xl bg-gradient-to-br from-blue-500 to-cyan-400 shadow-lg shadow-blue-500/25">
                <PenLine className="w-6 h-6 text-white" />
              </div>

              <div className="text-center sm:text-left">
                <h3 className="text-xl sm:text-2xl font-bold text-white mb-1">
                  {language === 'id'
                    ? 'Udah Lolos ProFirm? Tunjukkan Buktinya!'
                    : 'Passed a PropFirm? Show Your Proof!'}
                </h3>
                <p className="text-sm text-gray-400">
                  {language === 'id'
                    ? 'Bagikan pengalaman & bukti sertifikat Anda — bantu trader lain & tunjukkan bahwa Anda serius tentang trading.'
                    : 'Share your experience & prop firm certificate — help other traders & show you\'re serious about trading.'}
                </p>
              </div>

              <div className="flex-shrink-0 w-10 h-10 rounded-full bg-white/10 flex items-center justify-center group-hover:bg-white/20 transition-all group-hover:scale-110">
                <MessageSquarePlus className="w-5 h-5 text-blue-400" />
              </div>
            </div>

            {dbTestimonialCount > 0 && (
              <div className="absolute top-3 right-3 flex items-center gap-1.5 px-3 py-1 rounded-full bg-green-500/10 border border-green-500/20">
                <Sparkles className="w-3 h-3 text-green-400" />
                <span className="text-xs text-green-400 font-medium">
                  {dbTestimonialCount} {language === 'id' ? 'testimoni nyata' : 'real testimonials'}
                </span>
              </div>
            )}
          </button>
        </motion.div>

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
              {currentTestimonials.map((t, i) => {
                const actualIndex = currentPage * testimonialsPerPage + i
                const isDb = isDatabaseTestimonial(t)
                return (
                  <div
                    key={isDb ? t.id : t.name}
                    className={`relative flex flex-col bg-[var(--lux-card-surface)] backdrop-blur-sm border border-[var(--lux-inline-border)] rounded-2xl p-5 sm:p-6 hover:bg-[var(--lux-card-surface-hover)] ${isDb && t.borderHover ? t.borderHover : ''} transition-all duration-300 h-full`}
                  >
                    {/* Top row: Stars left, Verified right — NO absolute positioning */}
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center gap-0.5">
                        {renderStars(t.rating)}
                      </div>
                      {isDb && t.is_verified && (
                        <div className="flex items-center gap-1 px-2 py-0.5 bg-emerald-500/10 border border-emerald-500/20 rounded-full">
                          <BadgeCheck className="w-3 h-3 text-emerald-400" />
                          <span className="text-[10px] text-emerald-400 font-semibold">
                            {language === 'id' ? 'Verified' : 'Verified'}
                          </span>
                        </div>
                      )}
                    </div>

                    {/* Stats (for DB testimonials) */}
                    {isDb && (t.trades_logged > 0 || t.prop_firms_passed > 0) && (
                      <div className="flex items-center gap-3 mb-3 text-xs text-gray-500">
                        {t.trades_logged > 0 && (
                          <span>{t.trades_logged} trade{t.trades_logged > 1 ? 's' : ''}</span>
                        )}
                        {t.prop_firms_passed > 0 && (
                          <span>{t.prop_firms_passed} prop firm {language === 'id' ? 'lolos' : 'funded'}</span>
                        )}
                      </div>
                    )}

                    {/* Quote Text — clear space, no overlap */}
                    <div className="flex-1 mb-4">
                      <p className="text-[var(--lux-text-body-2)] text-sm leading-relaxed">
                        &ldquo;{getText(t)}&rdquo;
                      </p>
                    </div>

                    {/* Author footer */}
                    <div className="flex items-center gap-3 pt-3 mt-auto border-t border-[var(--lux-inline-border)]">
                      <div className={`w-9 h-9 rounded-full bg-gradient-to-br ${getGradient(t, actualIndex)} flex items-center justify-center text-white text-xs font-bold shrink-0`}>
                        {isDb ? t.user_name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2) : t.avatar}
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-bold text-[var(--lux-text-primary)] truncate">{getDisplayName(t)}</p>
                        <p className="text-xs text-[var(--lux-text-label-2)] truncate">{getRole(t)}</p>
                      </div>
                      {isDb && t.profile_image_url && (
                        <a href={t.profile_image_url} target="_blank" rel="noopener noreferrer" className="flex-shrink-0">
                          <div className="flex items-center gap-1 px-2 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20 hover:border-emerald-400/40 transition-colors">
                            <FileCheck className="w-3 h-3 text-emerald-400" />
                            <span className="text-[10px] text-emerald-400 font-medium">
                              {language === 'id' ? 'Sertifikat' : 'Cert'}
                            </span>
                          </div>
                        </a>
                      )}
                    </div>
                  </div>
                )
              })}
            </motion.div>
          </AnimatePresence>
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
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
                  className={`w-2.5 h-2.5 rounded-full transition-all ${i === currentPage ? 'bg-blue-500 w-6' : 'bg-[var(--lux-text-label-3)] hover:bg-[var(--lux-text-label-2)]'}`}
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
        )}

        {/* Testimonial Form Modal */}
        <TestimonialForm
          isOpen={showForm}
          onClose={() => setShowForm(false)}
          onSuccess={refreshTestimonials}
          language={language}
        />
      </div>
    </section>
  )
}
