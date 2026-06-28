'use client'

import { useState, useEffect } from 'react'
import { Sparkles, Target, Trophy, X, ChevronRight, ChevronLeft } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { motion, AnimatePresence } from 'framer-motion'
import confetti from 'canvas-confetti'

interface SimpleInteractiveTourProps {
  isOpen: boolean
  onClose: () => void
  onComplete: () => void
  language?: 'id' | 'en'
  username?: string
}

const tourSteps = [
  {
    id: 1,
    target: 'trading-chart-section',
    icon: <Sparkles className="w-6 h-6" />,
    title: {
      id: 'Trading Chart',
      en: 'Trading Chart',
    },
    description: {
      id: 'Pantau pasar secara real-time dengan akurasi tinggi. Analisis pergerakan harga dan buat keputusan trading yang lebih baik.',
      en: 'Monitor the market in real-time with high accuracy. Analyze price movements and make better trading decisions.',
    },
    color: 'from-purple-500 to-violet-600',
    action: {
      id: 'Buka Chart',
      en: 'Open Chart',
    },
  },
  {
    id: 2,
    target: 'risk-calculator-section',
    icon: <Target className="w-6 h-6" />,
    title: {
      id: 'Alat PRO',
      en: 'PRO Tools',
    },
    description: {
      id: 'Gunakan kalkulator risiko dan alat PRO lainnya untuk menjaga saldo-mu dan mengelola risiko dengan lebih efektif.',
      en: 'Use the risk calculator and other PRO tools to protect your balance and manage risk more effectively.',
    },
    color: 'from-amber-500 to-orange-600',
    action: {
      id: 'Buka Alat PRO',
      en: 'Open PRO Tools',
    },
  },
  {
    id: 3,
    target: 'achievements-section',
    icon: <Trophy className="w-6 h-6" />,
    title: {
      id: 'Achievement',
      en: 'Achievements',
    },
    description: {
      id: 'Selesaikan misi dan dapatkan hadiah eksklusif. Kumpulkan XP dan naikkan level trading-mu!',
      en: 'Complete missions and get exclusive rewards. Collect XP and level up your trading!',
    },
    color: 'from-emerald-500 to-teal-600',
    action: {
      id: 'Buka Achievement',
      en: 'Open Achievements',
    },
  },
]

export default function SimpleInteractiveTour({
  isOpen,
  onClose,
  onComplete,
  language = 'id',
  username,
}: SimpleInteractiveTourProps) {
  const [currentStep, setCurrentStep] = useState(0)
  const [showCompletion, setShowCompletion] = useState(false)

  useEffect(() => {
    if (isOpen) {
      requestAnimationFrame(() => {
        setCurrentStep(0)
        setShowCompletion(false)
      })
    }
  }, [isOpen])

  const handleNext = () => {
    const step = tourSteps[currentStep]

    // Navigate to the appropriate tab
    if (step.target === 'trading-chart-section') {
      (window as any).setActiveTab?.('chart')
    } else if (step.target === 'risk-calculator-section') {
      (window as any).setActiveTab?.('risk')
    } else if (step.target === 'achievements-section') {
      (window as any).setActiveTab?.('achievements')
    }

    if (currentStep < tourSteps.length - 1) {
      setCurrentStep(prev => prev + 1)
    } else {
      // Tour complete
      handleComplete()
    }
  }

  const handleComplete = () => {
    setShowCompletion(true)
    setCurrentStep(tourSteps.length)

    // Trigger confetti animation
    confetti({
      particleCount: 150,
      spread: 70,
      origin: { y: 0.6 },
      colors: ['#9333ea', '#3b82f6', '#10b981', '#f59e0b'],
      disableForReducedMotion: true,
      zIndex: 10001,
    })

    // Mark onboarding as complete
    localStorage.setItem('luxtrade_onboarding_done', 'true')
    onComplete()
  }

  const handleSkip = () => {
    localStorage.setItem('luxtrade_onboarding_done', 'true')
    onClose()
  }

  const step = tourSteps[currentStep]
  const isLastStep = currentStep === tourSteps.length - 1

  if (!isOpen && !showCompletion) return null

  return (
    <>
      {/* Tour Tooltip */}
      <AnimatePresence>
        {isOpen && !showCompletion && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="fixed bottom-8 left-1/2 -translate-x-1/2 z-[10000] w-full max-w-lg px-4"
          >
            <div className="bg-[#0f0b18]/95 backdrop-blur-xl border border-white/10 rounded-2xl p-6 shadow-2xl">
              {/* Progress Bar */}
              <div className="flex items-center gap-2 mb-4">
                {tourSteps.map((_, i) => (
                  <div
                    key={i}
                    className={`h-1 rounded-full transition-all duration-300 ${
                      i === currentStep
                        ? 'flex-1 bg-gradient-to-r from-purple-500 to-pink-500'
                        : i < currentStep
                        ? 'flex-1 bg-green-500'
                        : 'flex-1 bg-white/10'
                    }`}
                  />
                ))}
              </div>

              {/* Content */}
              <div className="flex items-start gap-4">
                <motion.div
                  key={currentStep}
                  initial={{ scale: 0, rotate: -10 }}
                  animate={{ scale: 1, rotate: 0 }}
                  transition={{ type: 'spring', damping: 15, stiffness: 200 }}
                  className={`w-14 h-14 rounded-xl bg-gradient-to-br ${step.color} flex items-center justify-center flex-shrink-0 shadow-lg`}
                >
                  <span className="text-white">{step.icon}</span>
                </motion.div>

                <div className="flex-1">
                  <h3 className="text-lg font-bold text-white mb-2">
                    {step.title[language]}
                  </h3>
                  <p className="text-sm text-gray-300 leading-relaxed mb-4">
                    {step.description[language]}
                  </p>

                  <div className="flex items-center gap-3">
                    {currentStep > 0 && (
                      <Button
                        onClick={() => setCurrentStep(prev => prev - 1)}
                        variant="outline"
                        size="sm"
                        className="border-white/20 text-white hover:bg-white/10"
                      >
                        <ChevronLeft className="w-4 h-4 mr-1" />
                        {language === 'id' ? 'Kembali' : 'Back'}
                      </Button>
                    )}

                    <Button
                      onClick={handleNext}
                      className={`flex-1 bg-gradient-to-r ${step.color} text-white`}
                    >
                      {isLastStep
                        ? (language === 'id' ? 'Selesai' : 'Finish')
                        : step.action[language]}
                      <ChevronRight className="w-4 h-4 ml-1" />
                    </Button>
                  </div>
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Skip Button */}
      <AnimatePresence>
        {isOpen && !showCompletion && (
          <motion.button
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            onClick={handleSkip}
            className="fixed top-24 right-8 z-[10001] px-4 py-2 bg-white/10 backdrop-blur-xl border border-white/20 rounded-lg text-white text-sm font-medium hover:bg-white/20 transition-all flex items-center gap-2"
          >
            <X className="w-4 h-4" />
            {language === 'id' ? 'Lewati Guide' : 'Skip Guide'}
          </motion.button>
        )}
      </AnimatePresence>

      {/* Completion Modal */}
      <AnimatePresence>
        {showCompletion && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[10002] flex items-center justify-center p-4"
          >
            {/* Backdrop */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 bg-black/80 backdrop-blur-xl"
            />

            {/* Modal */}
            <motion.div
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              transition={{ type: 'spring', damping: 25, stiffness: 300 }}
              className="relative w-full max-w-md bg-[#0f0b18] border border-purple-500/30 rounded-3xl overflow-hidden shadow-2xl shadow-purple-500/30"
            >
              {/* Gradient Background */}
              <div className="absolute inset-0 bg-gradient-to-br from-purple-500/10 via-transparent to-blue-500/10" />

              {/* Content */}
              <div className="relative p-8 text-center">
                {/* Trophy Icon */}
                <motion.div
                  initial={{ scale: 0, rotate: -10 }}
                  animate={{ scale: 1, rotate: 0 }}
                  transition={{ type: 'spring', damping: 15, stiffness: 200 }}
                  className="w-24 h-24 rounded-full bg-gradient-to-br from-purple-500 to-blue-600 flex items-center justify-center mx-auto mb-6 shadow-2xl shadow-purple-500/50"
                >
                  <Trophy className="w-12 h-12 text-white" />
                </motion.div>

                {/* Title */}
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.2 }}
                >
                  <h2 className="text-3xl font-extrabold mb-2 bg-gradient-to-r from-purple-400 via-pink-400 to-purple-400 bg-clip-text text-transparent">
                    {language === 'id' ? 'Achievement Unlocked!' : 'Achievement Unlocked!'}
                  </h2>
                  <p className="text-emerald-400 font-bold text-lg mb-2">
                    {language === 'id' ? 'Newcomer!' : 'Newcomer!'}
                  </p>
                  <p className="text-gray-400 text-sm">
                    {language === 'id'
                      ? `${username || 'User'}, selamat menyelesaikan Guide Selamat Datang!`
                      : `${username || 'User'}, congratulations on completing the Welcome Guide!`}
                  </p>
                  <p className="text-amber-400 font-bold text-2xl mt-4">
                    +10 XP
                  </p>
                </motion.div>

                {/* CTA Button */}
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.4 }}
                  className="mt-8"
                >
                  <Button
                    onClick={() => {
                      setShowCompletion(false)
                      onClose()
                      // Navigate to achievements
                      window.location.href = '/dashboard?tab=achievements'
                    }}
                    className="w-full h-14 bg-gradient-to-r from-purple-500 to-blue-600 hover:from-purple-600 hover:to-blue-700 text-lg font-extrabold shadow-lg shadow-purple-500/30 hover:shadow-[0_0_30px_rgba(139,92,246,0.5)] transition-all duration-300"
                  >
                    {language === 'id' ? 'Lihat Misi Saya Selanjutnya' : 'View My Next Missions'}
                    <ChevronRight className="w-5 h-5 ml-2" />
                  </Button>
                  <button
                    onClick={() => {
                      setShowCompletion(false)
                      onClose()
                    }}
                    className="mt-3 text-sm text-gray-500 hover:text-gray-300 transition-colors"
                  >
                    {language === 'id' ? 'Tutup' : 'Close'}
                  </button>
                </motion.div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  )
}
