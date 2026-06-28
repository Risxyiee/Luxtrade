'use client'

import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { X, ChevronRight, ChevronLeft, Rocket, BarChart3, BookOpen, Brain, Plus, Database, Loader2, Sparkles, Check } from 'lucide-react'
import { Button } from '@/components/ui/button'

interface WelcomeOnboardingProps {
  isOpen: boolean
  onClose: () => void
  onAddFirstTrade: () => void
  onLoadSampleData: () => void
  onUpgrade?: () => void
  language?: 'id' | 'en'
}

interface Step {
  icon: React.ReactNode
  title: string
  description: string
  color: string
}

const getSteps = (lang: 'id' | 'en'): Step[] => {
  if (lang === 'id') return [
    {
      icon: <Rocket className="w-8 h-8" />,
      title: 'Selamat Datang di LuxTrade!',
      description: 'Trading journal premium untuk melacak, menganalisis, dan meningkatkan performa trading kamu.',
      color: 'from-purple-500 to-violet-600',
    },
    {
      icon: <BarChart3 className="w-8 h-8" />,
      title: 'Catat Setiap Trade',
      description: 'Tambahkan trade manual, import dari CSV, atau gunakan Smart Import dengan screenshot & file MT4/MT5.',
      color: 'from-emerald-500 to-teal-600',
    },
    {
      icon: <Brain className="w-8 h-8" />,
      title: 'AI Insights & Analitik',
      description: 'Dapatkan rekomendasi AI, analisis performa mendalam, skor trading, dan laporan mingguan otomatis.',
      color: 'from-blue-500 to-cyan-600',
    },
    {
      icon: <Sparkles className="w-8 h-8" />,
      title: 'Ayo Mulai!',
      description: 'Dashboard kamu masih kosong. Tambahkan trade pertama kamu, atau muat data contoh untuk melihat bagaimana LuxTrade bekerja.',
      color: 'from-amber-500 to-orange-600',
    },
  ]

  return [
    {
      icon: <Rocket className="w-8 h-8" />,
      title: 'Welcome to LuxTrade!',
      description: 'Premium trading journal to track, analyze, and improve your trading performance.',
      color: 'from-purple-500 to-violet-600',
    },
    {
      icon: <BarChart3 className="w-8 h-8" />,
      title: 'Record Every Trade',
      description: 'Add trades manually, import from CSV, or use Smart Import with screenshots & MT4/MT5 files.',
      color: 'from-emerald-500 to-teal-600',
    },
    {
      icon: <Brain className="w-8 h-8" />,
      title: 'AI Insights & Analytics',
      description: 'Get AI recommendations, deep performance analysis, trading score, and automated weekly reports.',
      color: 'from-blue-500 to-cyan-600',
    },
    {
      icon: <Sparkles className="w-8 h-8" />,
      title: "Let's Get Started!",
      description: "Your dashboard is empty. Add your first trade, or load sample data to see how LuxTrade works.",
      color: 'from-amber-500 to-orange-600',
    },
  ]
}

export default function WelcomeOnboarding({
  isOpen,
  onClose,
  onAddFirstTrade,
  onLoadSampleData,
  onUpgrade,
  language = 'id',
}: WelcomeOnboardingProps) {
  const [currentStep, setCurrentStep] = useState(0)
  const [loadingSample, setLoadingSample] = useState(false)
  const [sampleDone, setSampleDone] = useState(false)

  const steps = getSteps(language)
  const step = steps[currentStep]
  const isLastStep = currentStep === steps.length - 1

  const finish = () => {
    localStorage.setItem('luxtrade_onboarding_done', 'true')
    onClose()
  }

  const handleNext = () => {
    if (isLastStep) {
      finish()
    } else {
      setCurrentStep(prev => prev + 1)
    }
  }

  const handlePrev = () => {
    if (currentStep > 0) setCurrentStep(prev => prev - 1)
  }

  const handleSkip = () => finish()

  const handleAddFirstTrade = () => {
    finish()
    setTimeout(() => onAddFirstTrade(), 300)
  }

  const handleLoadSample = async () => {
    setLoadingSample(true)
    try {
      await onLoadSampleData()
      setSampleDone(true)
      setTimeout(() => {
        finish()
      }, 1200)
    } catch {
      setLoadingSample(false)
    }
  }

  if (!isOpen) return null

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-50 flex items-center justify-center p-4"
      >
        {/* Backdrop */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="absolute inset-0 bg-black/70 backdrop-blur-sm"
          onClick={handleSkip}
        />

        {/* Modal */}
        <motion.div
          initial={{ opacity: 0, scale: 0.9, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.9, y: 20 }}
          transition={{ type: 'spring', damping: 25, stiffness: 300 }}
          className="relative w-full max-w-md bg-[#0f0b18] border border-purple-900/30 rounded-3xl overflow-hidden shadow-2xl shadow-purple-500/20"
        >
          {/* Decorative gradient */}
          <div className={`absolute top-0 left-0 right-0 h-32 bg-gradient-to-b ${step.color} opacity-10`} />

          {/* Close button */}
          <button
            onClick={handleSkip}
            className="absolute top-4 right-4 z-10 p-2 text-gray-400 hover:text-white transition-colors rounded-lg hover:bg-white/5"
          >
            <X className="w-5 h-5" />
          </button>

          {/* Content */}
          <div className="relative p-8 pt-12 text-center">
            {/* Icon */}
            <motion.div
              key={`icon-${currentStep}`}
              initial={{ scale: 0, rotate: -10 }}
              animate={{ scale: 1, rotate: 0 }}
              transition={{ type: 'spring', damping: 15, stiffness: 200 }}
              className={`w-20 h-20 rounded-2xl bg-gradient-to-br ${step.color} flex items-center justify-center mx-auto mb-6 shadow-lg`}
            >
              <span className="text-white">{step.icon}</span>
            </motion.div>

            {/* Step indicator */}
            <div className="flex items-center justify-center gap-2 mb-6">
              {steps.map((_, i) => (
                <div
                  key={i}
                  className={`h-1.5 rounded-full transition-all duration-300 ${
                    i === currentStep ? 'w-8 bg-gradient-to-r from-purple-500 to-pink-500' : 'w-2 bg-white/10'
                  }`}
                />
              ))}
            </div>

            {/* Text */}
            <motion.div
              key={`text-${currentStep}`}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3 }}
            >
              <h2 className="text-2xl font-bold text-white mb-3">{step.title}</h2>
              <p className="text-gray-400 leading-relaxed">{step.description}</p>
            </motion.div>

            {/* Action Buttons */}
            <div className="mt-8 flex flex-col gap-3">
              {isLastStep ? (
                /* ======== LAST STEP: Add First Trade / Load Sample ======== */
                sampleDone ? (
                  <div className="flex items-center justify-center gap-2 text-emerald-400 font-semibold py-3">
                    <Check className="w-5 h-5" />
                    {language === 'id' ? 'Data contoh berhasil dimuat!' : 'Sample data loaded!'}
                  </div>
                ) : (
                  <>
                    <Button
                      onClick={handleAddFirstTrade}
                      className="w-full bg-gradient-to-r from-purple-500 to-violet-600 hover:from-purple-600 hover:to-violet-700 h-12 text-base font-semibold"
                    >
                      <Plus className="w-5 h-5 mr-2" />
                      {language === 'id' ? 'Tambah Trade Pertama' : 'Add Your First Trade'}
                    </Button>

                    <Button
                      onClick={handleLoadSample}
                      disabled={loadingSample}
                      variant="outline"
                      className="w-full h-12 text-base font-semibold border-white/10 text-white/70 hover:bg-white/5 hover:text-white disabled:opacity-50"
                    >
                      {loadingSample ? (
                        <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                      ) : (
                        <Database className="w-5 h-5 mr-2" />
                      )}
                      {loadingSample
                        ? (language === 'id' ? 'Memuat data...' : 'Loading data...')
                        : (language === 'id' ? 'Muat Data Contoh' : 'Load Sample Data')
                      }
                    </Button>

                    {onUpgrade && (
                      <button
                        onClick={() => { finish(); onUpgrade() }}
                        className="text-sm text-amber-400 hover:text-amber-300 transition-colors py-1 font-medium"
                      >
                        {language === 'id' ? 'Atau upgrade ke PRO' : 'Or upgrade to PRO'} →
                      </button>
                    )}
                  </>
                )
              ) : (
                /* ======== TOUR STEPS ======== */
                <>
                  <Button
                    onClick={handleNext}
                    className={`w-full bg-gradient-to-r ${step.color} h-12 text-base font-semibold`}
                  >
                    {currentStep === 0
                      ? (language === 'id' ? 'Mulai Tour' : 'Start Tour')
                      : (language === 'id' ? 'Selanjutnya' : 'Next')
                    }
                    <ChevronRight className="w-5 h-5 ml-1" />
                  </Button>

                  {currentStep > 0 && (
                    <button
                      onClick={handlePrev}
                      className="text-sm text-gray-500 hover:text-gray-300 transition-colors py-2 flex items-center justify-center gap-1"
                    >
                      <ChevronLeft className="w-3.5 h-3.5" />
                      {language === 'id' ? 'Kembali' : 'Back'}
                    </button>
                  )}

                  <button
                    onClick={handleSkip}
                    className="text-sm text-gray-600 hover:text-gray-400 transition-colors py-1"
                  >
                    {language === 'id' ? 'Lewati tour' : 'Skip tour'}
                  </button>
                </>
              )}
            </div>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  )
}