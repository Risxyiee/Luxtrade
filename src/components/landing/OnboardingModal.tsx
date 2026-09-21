'use client'

import React, { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { X, ArrowRight, CheckCircle2, ShieldCheck, TrendingUp, Sparkles } from 'lucide-react'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'

interface OnboardingModalProps {
  isOpen: boolean
  onClose: () => void
  onComplete: () => void
  language?: 'id' | 'en'
  onStepAction?: (step: number) => void
}

const steps = [
  {
    id: 1,
    icon: Sparkles,
    title: { id: 'Selamat Datang di LuxTradee!', en: 'Welcome to LuxTradee!' },
    description: {
      id: 'Trading journal khusus untuk prop firm trader. Catat trade, deteksi pola loss, dan lewati challenge prop firm dengan konsistensi.',
      en: 'A trading journal designed for prop firm traders. Log trades, detect loss patterns, and pass prop firm challenges with consistency.'
    },
    feature: 'ai-vision'
  },
  {
    id: 2,
    icon: TrendingUp,
    title: { id: 'Catat Trade Pertamamu', en: 'Log Your First Trade' },
    description: {
      id: 'Upload screenshot MT5/TradingView atau input manual. AI otomatis extract data untuk jurnal trading yang akurat.',
      en: 'Upload MT5/TradingView screenshot or input manually. AI auto-extracts data for accurate trade journaling.'
    },
    feature: 'first-trade'
  },
  {
    id: 3,
    icon: ShieldCheck,
    title: { id: 'Prop Firm Guard', en: 'Prop Firm Protection' },
    description: {
      id: 'Monitor maximum & daily drawdown akun prop firm kamu. Kami akan alert kamu sebelum breach terjadi.',
      en: 'Monitor maximum & daily drawdown limits of your prop firm account. Get alerts before breach happens.'
    },
    feature: 'prop-guard'
  },
  {
    id: 4,
    icon: CheckCircle2,
    title: { id: 'Mulai Sekarang!', en: 'Get Started Now!' },
    description: {
      id: 'Kamu punya 10 free trades dan 10 AI queries bulan ini. Coba semua fitur dan rasakan manfaatnya.',
      en: 'You have 10 free trades and 10 AI queries this month. Try all features and experience the benefits.'
    },
    feature: 'get-started'
  }
]

export default function OnboardingModal({
  isOpen,
  onClose,
  onComplete,
  language = 'id',
  onStepAction
}: OnboardingModalProps) {
  const [currentStep, setCurrentStep] = useState(0)
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    if (isOpen) {
      setMounted(true)
      setCurrentStep(0)
    }
  }, [isOpen])

  const handleNext = () => {
    const currentStepData = steps[currentStep]

    // Trigger action based on step
    if (onStepAction && currentStepData.feature) {
      onStepAction(currentStepData.id)
    }

    if (currentStep < steps.length - 1) {
      setCurrentStep(prev => prev + 1)
    } else {
      handleComplete()
    }
  }

  const handleComplete = () => {
    if (onStepAction) {
      onStepAction(4) // Complete step
    }
    onComplete()
    onClose()
  }

  const handleSkip = () => {
    handleComplete()
  }

  if (!isOpen) return null

  const step = steps[currentStep]
  const progress = ((currentStep + 1) / steps.length) * 100

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl p-0 overflow-hidden bg-gradient-to-br from-[#050507] via-[#0a0c12] to-[#050507] border border-white/10">
        {/* Progress Bar */}
        <div className="absolute top-0 left-0 right-0 h-1 bg-white/5">
          <motion.div
            className="h-full bg-gradient-to-r from-blue-500 to-cyan-400"
            initial={{ width: 0 }}
            animate={{ width: `${progress}%` }}
            transition={{ duration: 0.5 }}
          />
        </div>

        {/* Close Button */}
        <button
          onClick={handleSkip}
          className="absolute top-4 right-4 text-gray-500 hover:text-white transition-colors z-10"
          aria-label="Skip onboarding"
        >
          <X className="w-5 h-5" />
        </button>

        <div className="p-8 md:p-12">
          <DialogHeader className="mb-8">
            {/* Step indicator */}
            <div className="flex items-center gap-2 mb-6">
              {steps.map((s, i) => (
                <div
                  key={s.id}
                  className={`flex-1 h-1 rounded-full transition-all ${
                    i <= currentStep ? 'bg-blue-500' : 'bg-white/10'
                  }`}
                />
              ))}
            </div>

            <DialogTitle className="text-2xl md:text-3xl font-bold text-white text-center">
              {step.title[language]}
            </DialogTitle>
          </DialogHeader>

          {/* Step Content */}
          <div className="flex flex-col items-center gap-8">
            {/* Icon Animation */}
            <motion.div
              key={step.id}
              initial={{ scale: 0.8, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ duration: 0.3 }}
              className="w-24 h-24 rounded-2xl bg-gradient-to-br from-blue-500/20 to-cyan-400/20 border border-white/10 flex items-center justify-center"
            >
              <step.icon className="w-12 h-12 text-cyan-400" />
            </motion.div>

            {/* Description */}
            <motion.p
              key={`desc-${step.id}`}
              initial={{ y: 10, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{ duration: 0.3, delay: 0.1 }}
              className="text-center text-gray-400 text-lg max-w-lg"
            >
              {step.description[language]}
            </motion.p>

            {/* Step indicator dots */}
            <div className="flex gap-2">
              {steps.map((s, i) => (
                <div
                  key={s.id}
                  className={`w-2 h-2 rounded-full transition-all ${
                    i === currentStep
                      ? 'bg-cyan-400 w-6'
                      : 'bg-white/10'
                  }`}
                />
              ))}
            </div>
          </div>

          {/* Actions */}
          <div className="mt-8 flex gap-3">
            {currentStep > 0 && (
              <Button
                variant="outline"
                onClick={() => setCurrentStep(prev => prev - 1)}
                className="flex-1 border-white/10 text-white hover:bg-white/5"
              >
                {language === 'id' ? 'Kembali' : 'Back'}
              </Button>
            )}

            <Button
              onClick={handleNext}
              className="flex-1 bg-gradient-to-r from-blue-500 to-cyan-400 text-white hover:opacity-90 transition-all"
            >
              {currentStep === steps.length - 1
                ? (language === 'id' ? 'Mulai Sekarang' : 'Get Started')
                : (language === 'id' ? 'Lanjut' : 'Next')
              }
              <ArrowRight className="w-4 h-4 ml-2" />
            </Button>
          </div>

          {/* Skip link */}
          <button
            onClick={handleSkip}
            className="mt-4 text-sm text-gray-500 hover:text-gray-300 transition-colors w-full text-center"
          >
            {language === 'id' ? 'Lewati onboarding' : 'Skip onboarding'}
          </button>
        </div>
      </DialogContent>
    </Dialog>
  )
}