'use client'

import { useState, useEffect } from 'react'
// @ts-ignore
import { Joyride, STATUS, CallBackProps, Step } from 'react-joyride'
import { Sparkles, Target, Trophy, X, ChevronRight, ChevronLeft } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { motion, AnimatePresence } from 'framer-motion'
import confetti from 'canvas-confetti'

interface InteractiveTourProps {
  isOpen: boolean
  onClose: () => void
  onComplete: () => void
  language?: 'id' | 'en'
  username?: string
}

export default function InteractiveTour({ isOpen, onClose, onComplete, language = 'id', username }: InteractiveTourProps) {
  const [run, setRun] = useState(false)
  const [stepIndex, setStepIndex] = useState(0)
  const [showCompletion, setShowCompletion] = useState(false)

  const steps: Step[] = [
    {
      target: '#trading-chart-section',
      content: (
        <div className="space-y-3">
          <div className="flex items-center gap-3 mb-2">
            <div className="p-2 bg-purple-500/20 rounded-lg">
              <Sparkles className="w-6 h-6 text-purple-400" />
            </div>
            <h3 className="text-lg font-bold text-white">
              {language === 'id' ? 'Trading Chart' : 'Trading Chart'}
            </h3>
          </div>
          <p className="text-gray-300 text-sm leading-relaxed">
            {language === 'id'
              ? 'Pantau pasar secara real-time dengan akurasi tinggi. Analisis pergerakan harga dan buat keputusan trading yang lebih baik.'
              : 'Monitor the market in real-time with high accuracy. Analyze price movements and make better trading decisions.'}
          </p>
        </div>
      ),
      disableBeacon: true,
      spotlightPadding: 20,
      styles: {
        tooltip: {
          background: 'rgba(15, 11, 24, 0.95)',
          backdropFilter: 'blur(20px)',
          borderRadius: '1.5rem',
          border: '1px solid rgba(139, 92, 246, 0.3)',
          boxShadow: '0 0 40px rgba(139, 92, 246, 0.2)',
        },
        tooltipContent: {
          padding: '1.5rem',
        },
        options: {
          primaryColor: '#9333ea',
          textColor: '#fff',
          zIndex: 10000,
        },
      },
    },
    {
      target: '#risk-calculator-section',
      content: (
        <div className="space-y-3">
          <div className="flex items-center gap-3 mb-2">
            <div className="p-2 bg-amber-500/20 rounded-lg">
              <Target className="w-6 h-6 text-amber-400" />
            </div>
            <h3 className="text-lg font-bold text-white">
              {language === 'id' ? 'Alat PRO' : 'PRO Tools'}
            </h3>
          </div>
          <p className="text-gray-300 text-sm leading-relaxed">
            {language === 'id'
              ? 'Gunakan kalkulator risiko dan alat PRO lainnya untuk menjaga saldo-mu dan mengelola risiko dengan lebih efektif.'
              : 'Use the risk calculator and other PRO tools to protect your balance and manage risk more effectively.'}
          </p>
        </div>
      ),
      disableBeacon: true,
      spotlightPadding: 20,
      styles: {
        tooltip: {
          background: 'rgba(15, 11, 24, 0.95)',
          backdropFilter: 'blur(20px)',
          borderRadius: '1.5rem',
          border: '1px solid rgba(245, 158, 11, 0.3)',
          boxShadow: '0 0 40px rgba(245, 158, 11, 0.2)',
        },
        tooltipContent: {
          padding: '1.5rem',
        },
        options: {
          primaryColor: '#f59e0b',
          textColor: '#fff',
          zIndex: 10000,
        },
      },
    },
    {
      target: '#achievements-section',
      content: (
        <div className="space-y-3">
          <div className="flex items-center gap-3 mb-2">
            <div className="p-2 bg-emerald-500/20 rounded-lg">
              <Trophy className="w-6 h-6 text-emerald-400" />
            </div>
            <h3 className="text-lg font-bold text-white">
              {language === 'id' ? 'Achievement' : 'Achievements'}
            </h3>
          </div>
          <p className="text-gray-300 text-sm leading-relaxed">
            {language === 'id'
              ? 'Selesaikan misi dan dapatkan hadiah eksklusif. Kumpulkan XP dan naikkan level trading-mu!'
              : 'Complete missions and get exclusive rewards. Collect XP and level up your trading!'}
          </p>
        </div>
      ),
      disableBeacon: true,
      spotlightPadding: 20,
      styles: {
        tooltip: {
          background: 'rgba(15, 11, 24, 0.95)',
          backdropFilter: 'blur(20px)',
          borderRadius: '1.5rem',
          border: '1px solid rgba(16, 185, 129, 0.3)',
          boxShadow: '0 0 40px rgba(16, 185, 129, 0.2)',
        },
        tooltipContent: {
          padding: '1.5rem',
        },
        options: {
          primaryColor: '#10b981',
          textColor: '#fff',
          zIndex: 10000,
        },
      },
    },
  ]

  useEffect(() => {
    if (isOpen) {
      requestAnimationFrame(() => {
        setRun(true)
        setShowCompletion(false)
      })
    } else {
      requestAnimationFrame(() => setRun(false))
    }
  }, [isOpen])

  const handleJoyrideCallback = (data: CallBackProps) => {
    const { status, index } = data

    if ([STATUS.FINISHED, STATUS.SKIPPED].includes(status)) {
      setRun(false)
      setShowCompletion(true)

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
    } else if (status === STATUS.STEP_AFTER) {
      setStepIndex(index + 1)
    }
  }

  const handleClose = () => {
    setRun(false)
    onClose()
  }

  return (
    <>
      <Joyride
        steps={steps}
        run={run}
        continuous
        showSkipButton
        showProgress
        stepIndex={stepIndex}
        callback={handleJoyrideCallback}
        locale={{
          back: language === 'id' ? 'Kembali' : 'Back',
          close: language === 'id' ? 'Tutup' : 'Close',
          last: language === 'id' ? 'Selesai' : 'Finish',
          next: language === 'id' ? 'Selanjutnya' : 'Next',
          open: language === 'id' ? 'Buka Tour' : 'Open Tour',
          skip: language === 'id' ? 'Lewati Guide' : 'Skip Guide',
        }}
        styles={{
          options: {
            zIndex: 10000,
          },
          beacon: {
            display: 'none',
          },
          overlay: {
            fill: 'rgba(0, 0, 0, 0.6)',
          },
          spotlight: {
            borderRadius: '12px',
          },
        }}
      />

      {/* Skip Button */}
      <AnimatePresence>
        {run && (
          <motion.button
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            onClick={handleClose}
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
