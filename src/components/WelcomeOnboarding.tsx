'use client'

import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { X, ChevronRight, CheckCircle, Rocket, BarChart3, BookOpen, Brain, Target, Crown } from 'lucide-react'
import { Button } from '@/components/ui/button'

interface WelcomeOnboardingProps {
  isOpen: boolean
  onClose: () => void
  onUpgrade?: () => void
  language?: 'id' | 'en'
}

const steps = {
  id: [
    {
      icon: <Rocket className="w-8 h-8" />,
      title: 'Selamat Datang di LuxTrade! 🎉',
      description: 'Platform trading journal premium untuk melacak, menganalisis, dan meningkatkan performa trading Anda.',
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
      icon: <Crown className="w-8 h-8" />,
      title: 'Upgrade ke PRO',
      description: 'Buka kunci fitur lengkap: AI Insights, Analytics, Trading Score, dan masih banyak lagi!',
      color: 'from-amber-500 to-orange-600',
      cta: true,
    },
  ],
  en: [
    {
      icon: <Rocket className="w-8 h-8" />,
      title: 'Welcome to LuxTrade! 🎉',
      description: 'Premium trading journal platform to track, analyze, and improve your trading performance.',
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
      icon: <Crown className="w-8 h-8" />,
      title: 'Upgrade to PRO',
      description: 'Unlock all features: AI Insights, Analytics, Trading Score, and much more!',
      color: 'from-amber-500 to-orange-600',
      cta: true,
    },
  ],
}

export default function WelcomeOnboarding({ isOpen, onClose, onUpgrade, language = 'id' }: WelcomeOnboardingProps) {
  const [currentStep, setCurrentStep] = useState(0)
  const localizedSteps = steps[language]
  const step = localizedSteps[currentStep]
  const isLastStep = currentStep === localizedSteps.length - 1

  const handleNext = () => {
    if (isLastStep) {
      onClose()
      localStorage.setItem('luxtrade_onboarding_done', 'true')
    } else {
      setCurrentStep(prev => prev + 1)
    }
  }

  const handleSkip = () => {
    onClose()
    localStorage.setItem('luxtrade_onboarding_done', 'true')
  }

  const handleUpgrade = () => {
    localStorage.setItem('luxtrade_onboarding_done', 'true')
    onClose()
    onUpgrade?.()
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
              key={currentStep}
              initial={{ scale: 0, rotate: -10 }}
              animate={{ scale: 1, rotate: 0 }}
              transition={{ type: 'spring', damping: 15, stiffness: 200 }}
              className={`w-20 h-20 rounded-2xl bg-gradient-to-br ${step.color} flex items-center justify-center mx-auto mb-6 shadow-lg`}
            >
              <span className="text-white">{step.icon}</span>
            </motion.div>

            {/* Step indicator */}
            <div className="flex items-center justify-center gap-2 mb-6">
              {localizedSteps.map((_, i) => (
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
              <h2 className="text-2xl font-bold text-white mb-3">
                {step.title}
              </h2>
              <p className="text-gray-400 leading-relaxed">
                {step.description}
              </p>
            </motion.div>

            {/* Action Buttons */}
            <div className="mt-8 flex flex-col gap-3">
              {step.cta && onUpgrade ? (
                <Button
                  onClick={handleUpgrade}
                  className="w-full bg-gradient-to-r from-amber-500 to-orange-600 hover:from-amber-600 hover:to-orange-700 h-12 text-base font-semibold"
                >
                  <Crown className="w-5 h-5 mr-2" />
                  {language === 'id' ? 'Upgrade ke PRO' : 'Upgrade to PRO'}
                </Button>
              ) : (
                <Button
                  onClick={handleNext}
                  className={`w-full bg-gradient-to-r ${step.color} h-12 text-base font-semibold`}
                >
                  {isLastStep
                    ? (language === 'id' ? 'Mulai Trading!' : 'Start Trading!')
                    : (language === 'id' ? 'Selanjutnya' : 'Next')
                  }
                  <ChevronRight className="w-5 h-5 ml-1" />
                </Button>
              )}

              {!isLastStep && (
                <button
                  onClick={handleSkip}
                  className="text-sm text-gray-500 hover:text-gray-300 transition-colors py-2"
                >
                  {language === 'id' ? 'Lewati' : 'Skip'}
                </button>
              )}
            </div>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  )
}
