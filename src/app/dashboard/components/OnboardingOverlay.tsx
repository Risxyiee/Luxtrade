'use client'

import { useState, useEffect, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  X, ChevronRight, ChevronLeft, BarChart3, Plus, Wallet,
  TrendingUp, BookOpen, Brain, Users, Trophy, Target,
  Eye, Flame, Zap, Sparkles, Menu, Bell, Keyboard, Globe,
  CheckCircle2
} from 'lucide-react'

interface OnboardingOverlayProps {
  language: 'id' | 'en'
  onComplete: () => void
}

const t = (id: string, en: string) => id // We'll use language below

interface Step {
  icon: React.ElementType
  titleId: string
  titleEn: string
  descId: string
  descEn: string
  highlight?: string // CSS selector hint for potential future highlighting
  gradient: string
  iconBg: string
}

const steps: Step[] = [
  {
    icon: BarChart3,
    titleId: 'Selamat Datang di LuxTrade!',
    titleEn: 'Welcome to LuxTrade!',
    descId: 'Platform trading journal terlengkap untuk melacak, menganalisis, dan meningkatkan performa trading Anda. Mari kita kenali fitur-fitur utamanya.',
    descEn: 'The most complete trading journal platform to track, analyze, and improve your trading performance. Let\'s explore the key features.',
    gradient: 'from-blue-500/20 via-blue-600/10 to-cyan-500/10',
    iconBg: 'from-blue-500 to-cyan-500',
  },
  {
    icon: Plus,
    titleId: 'Catat Trade Anda',
    titleEn: 'Log Your Trades',
    descId: 'Gunakan tombol "Catat Trade" dan "Tambah Akun" di bawah section selamat datang untuk menambah trade baru dan mengelola akun trading.',
    descEn: 'Use the "Log Trade" and "Add Account" buttons below the welcome section to add new trades and manage trading accounts.',
    gradient: 'from-emerald-500/20 via-emerald-600/10 to-teal-500/10',
    iconBg: 'from-emerald-500 to-teal-500',

  },
  {
    icon: Wallet,
    titleId: 'Kelola Akun Trading',
    titleEn: 'Manage Trading Accounts',
    descId: 'Tambahkan beberapa akun trading dari broker berbeda. Pantau saldo dan performa masing-masing akun secara terpisah.',
    descEn: 'Add multiple trading accounts from different brokers. Monitor the balance and performance of each account separately.',
    gradient: 'from-violet-500/20 via-purple-600/10 to-fuchsia-500/10',
    iconBg: 'from-violet-500 to-purple-500',
  },
  {
    icon: TrendingUp,
    titleId: 'Dashboard & Statistik',
    titleEn: 'Dashboard & Statistics',
    descId: 'Dashboard menampilkan overview performa trading: Total P/L, Win Rate, Profit Factor, Win/Loss Streak, dan kurva ekuitas. Semua diperbarui secara real-time.',
    descEn: 'The dashboard shows your trading performance overview: Total P/L, Win Rate, Profit Factor, Win/Loss Streak, and equity curve. All updated in real-time.',
    gradient: 'from-amber-500/20 via-orange-600/10 to-red-500/10',
    iconBg: 'from-amber-500 to-orange-500',
  },
  {
    icon: BookOpen,
    titleId: 'Trading Journal',
    titleEn: 'Trading Journal',
    descId: 'Catat emosi, kondisi market, dan strategi di jurnal trading. Analisis psikologis membantu mengidentifikasi pola perilaku yang mempengaruhi keputusan trading Anda.',
    descEn: 'Record emotions, market conditions, and strategies in your trading journal. Psychological analysis helps identify behavior patterns affecting your trading decisions.',
    gradient: 'from-rose-500/20 via-pink-600/10 to-fuchsia-500/10',
    iconBg: 'from-rose-500 to-pink-500',
  },
  {
    icon: Brain,
    titleId: 'AI Assistant',
    titleEn: 'AI Assistant',
    descId: 'Dapatkan insight AI, rekomendasi setup trading, analisis chart otomatis, dan chatbot yang menjawab pertanyaan seputar trading Anda.',
    descEn: 'Get AI insights, trade setup recommendations, automatic chart analysis, and a chatbot that answers your trading questions.',
    gradient: 'from-cyan-500/20 via-blue-600/10 to-indigo-500/10',
    iconBg: 'from-cyan-500 to-blue-500',
  },
  {
    icon: Users,
    titleId: 'Komunitas Trading',
    titleEn: 'Trading Community',
    descId: 'Aktifkan profil publik di tab Komunitas untuk tampil di leaderboard. Bandingkan performa, bagikan trade terbaik Anda, dan bersaing dengan trader lain!',
    descEn: 'Enable your public profile in the Community tab to appear on the leaderboard. Compare performance, share your best trades, and compete with other traders!',
    gradient: 'from-orange-500/20 via-amber-600/10 to-yellow-500/10',
    iconBg: 'from-orange-500 to-amber-500',
  },
  {
    icon: Menu,
    titleId: 'Navigasi Sidebar',
    titleEn: 'Sidebar Navigation',
    descId: 'Gunakan sidebar di kiri untuk berpindah antar fitur: Trades, Journal, Watchlist, Analytics, AI, Calendar, Risk Calculator, dan lainnya. Di mobile, klik ikon menu di header.',
    descEn: 'Use the sidebar on the left to navigate between features: Trades, Journal, Watchlist, Analytics, AI, Calendar, Risk Calculator, and more. On mobile, tap the menu icon in the header.',
    gradient: 'from-teal-500/20 via-emerald-600/10 to-green-500/10',
    iconBg: 'from-teal-500 to-emerald-500',
  },
  {
    icon: Sparkles,
    titleId: 'Mulai Trading!',
    titleEn: 'Start Trading!',
    descId: 'Anda sudah siap! Catat trade pertama Anda dan mulai perjalanan menuju trader yang konsisten dan profitable. Semoga sukses! 🚀',
    descEn: 'You\'re all set! Log your first trade and begin your journey to becoming a consistent and profitable trader. Good luck! 🚀',
    gradient: 'from-blue-500/20 via-purple-600/10 to-pink-500/10',
    iconBg: 'from-blue-500 via-purple-500 to-pink-500',
  },
]

export default function OnboardingOverlay({ language, onComplete }: OnboardingOverlayProps) {
  const [currentStep, setCurrentStep] = useState(0)
  const [visible, setVisible] = useState(false)
  const [direction, setDirection] = useState(1)

  useEffect(() => {
    // Small delay for mount animation
    const timer = setTimeout(() => setVisible(true), 100)
    return () => clearTimeout(timer)
  }, [])

  const handleComplete = useCallback(() => {
    setVisible(false)
    setTimeout(() => onComplete(), 300)
  }, [onComplete])

  const goNext = useCallback(() => {
    if (currentStep < steps.length - 1) {
      setDirection(1)
      setCurrentStep(prev => prev + 1)
    } else {
      handleComplete()
    }
  }, [currentStep, handleComplete])

  const goPrev = useCallback(() => {
    if (currentStep > 0) {
      setDirection(-1)
      setCurrentStep(prev => prev - 1)
    }
  }, [currentStep])

  const step = steps[currentStep]
  const progress = ((currentStep + 1) / steps.length) * 100
  const isFirst = currentStep === 0
  const isLast = currentStep === steps.length - 1

  const title = language === 'id' ? step.titleId : step.titleEn
  const desc = language === 'id' ? step.descId : step.descEn

  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.3 }}
          className="fixed inset-0 z-[100] flex items-center justify-center p-4"
        >
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 bg-black/70 backdrop-blur-sm"
            onClick={handleComplete}
          />

          {/* Card */}
          <motion.div
            initial={{ opacity: 0, scale: 0.9, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.9, y: 20 }}
            transition={{ type: 'spring', damping: 25, stiffness: 300 }}
            className="relative w-full max-w-md bg-[#0a0c14]/98 border border-blue-500/20 rounded-3xl shadow-2xl shadow-blue-500/10 overflow-hidden"
          >
            {/* Top gradient bar */}
            <div className={`h-1.5 bg-gradient-to-r ${step.gradient}`} />

            {/* Close / Skip button */}
            <button
              onClick={handleComplete}
              className="absolute top-4 right-4 p-2 rounded-full bg-white/5 hover:bg-white/10 transition-colors text-gray-400 hover:text-white z-10"
              aria-label={language === 'id' ? 'Lewati onboarding' : 'Skip onboarding'}
            >
              <X className="w-4 h-4" />
            </button>

            {/* Content */}
            <div className="px-8 pt-10 pb-6 text-center">
              {/* Step indicator */}
              <div className="flex items-center justify-center gap-1.5 mb-8">
                {steps.map((_, i) => (
                  <div
                    key={i}
                    className={`h-1 rounded-full transition-all duration-300 ${
                      i === currentStep
                        ? 'w-8 bg-blue-500'
                        : i < currentStep
                          ? 'w-3 bg-blue-500/50'
                          : 'w-3 bg-white/10'
                    }`}
                  />
                ))}
              </div>

              {/* Animated icon */}
              <AnimatePresence mode="wait">
                <motion.div
                  key={currentStep}
                  initial={{ opacity: 0, y: 10, rotate: direction * -10 }}
                  animate={{ opacity: 1, y: 0, rotate: 0 }}
                  exit={{ opacity: 0, y: -10, rotate: direction * 10 }}
                  transition={{ duration: 0.25 }}
                  className="w-20 h-20 mx-auto mb-6 rounded-2xl bg-gradient-to-br flex items-center justify-center shadow-lg"
                  style={{
                    backgroundImage: `linear-gradient(135deg, var(--tw-gradient-stops))`,
                    background: `linear-gradient(135deg, ${step.iconBg.includes('to') ? step.iconBg : step.iconBg + ', ' + step.iconBg})`
                  }}
                >
                  {(() => {
                    const Icon = step.icon
                    return <Icon className="w-10 h-10 text-white" />
                  })()}
                </motion.div>
              </AnimatePresence>

              {/* Title */}
              <AnimatePresence mode="wait">
                <motion.h2
                  key={`title-${currentStep}`}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -8 }}
                  transition={{ duration: 0.2, delay: 0.05 }}
                  className="text-xl font-bold text-white mb-3"
                >
                  {title}
                </motion.h2>
              </AnimatePresence>

              {/* Description */}
              <AnimatePresence mode="wait">
                <motion.p
                  key={`desc-${currentStep}`}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -8 }}
                  transition={{ duration: 0.2, delay: 0.1 }}
                  className="text-sm text-gray-400 leading-relaxed mb-8 min-h-[60px]"
                >
                  {desc}
                </motion.p>
              </AnimatePresence>

              {/* Progress bar */}
              <div className="w-full h-1.5 rounded-full bg-white/5 mb-6 overflow-hidden">
                <motion.div
                  className="h-full rounded-full bg-gradient-to-r from-blue-500 to-cyan-500"
                  initial={{ width: 0 }}
                  animate={{ width: `${progress}%` }}
                  transition={{ duration: 0.4, ease: 'easeOut' }}
                />
              </div>

              {/* Navigation buttons */}
              <div className="flex items-center justify-between gap-3">
                <button
                  onClick={goPrev}
                  disabled={isFirst}
                  className={`flex items-center gap-1.5 px-4 py-2.5 rounded-xl text-sm font-medium transition-all ${
                    isFirst
                      ? 'opacity-0 pointer-events-none'
                      : 'text-gray-300 hover:text-white hover:bg-white/5'
                  }`}
                >
                  <ChevronLeft className="w-4 h-4" />
                  {language === 'id' ? 'Kembali' : 'Back'}
                </button>

                <button
                  onClick={goNext}
                  className="flex items-center gap-2 px-6 py-2.5 rounded-xl text-sm font-semibold bg-gradient-to-r from-blue-500 to-cyan-500 hover:from-blue-600 hover:to-cyan-600 text-white shadow-lg shadow-blue-500/25 transition-all active:scale-[0.97]"
                >
                  {isLast
                    ? (language === 'id' ? 'Mulai!' : 'Start!')
                    : (language === 'id' ? 'Lanjut' : 'Next')
                  }
                  {isLast ? (
                    <CheckCircle2 className="w-4 h-4" />
                  ) : (
                    <ChevronRight className="w-4 h-4" />
                  )}
                </button>
              </div>

              {/* Step counter */}
              <p className="text-xs text-gray-600 mt-4">
                {currentStep + 1} / {steps.length}
              </p>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}