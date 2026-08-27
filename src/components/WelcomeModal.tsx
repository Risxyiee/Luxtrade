'use client'

import { motion, AnimatePresence } from 'framer-motion'
import { Sparkles, X, ArrowRight } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useAuth } from '@/lib/auth-context'

interface WelcomeModalProps {
  isOpen: boolean
  onClose: () => void
  onStartTour: () => void
  language?: 'id' | 'en'
}

export default function WelcomeModal({ isOpen, onClose, onStartTour, language = 'id' }: WelcomeModalProps) {
  const { user, profile } = useAuth()
  const username = profile?.username || (user?.email ? user.email.split('@')[0].charAt(0).toUpperCase() + user.email.split('@')[0].slice(1) : '')

  if (!isOpen) return null

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-[10003] flex items-center justify-center p-4"
      >
        {/* Backdrop with heavy blur */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="absolute inset-0 bg-black/80 backdrop-blur-2xl"
          onClick={onClose}
        />

        {/* Premium Glassmorphism Modal */}
        <motion.div
          initial={{ opacity: 0, scale: 0.9, y: 30 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.9, y: 30 }}
          transition={{ type: 'spring', damping: 25, stiffness: 300 }}
          className="relative w-full max-w-2xl bg-white/[0.03] backdrop-blur-3xl border border-white/[0.1] rounded-3xl overflow-hidden shadow-2xl shadow-blue-500/20"
        >
          {/* Animated Gradient Background */}
          <div className="absolute inset-0 overflow-hidden">
            <motion.div
              animate={{
                scale: [1, 1.1, 1],
                rotate: [0, 90, 0],
              }}
              transition={{
                duration: 20,
                repeat: Infinity,
                ease: 'linear',
              }}
              className="absolute -top-1/2 -right-1/2 w-full h-full bg-gradient-to-br from-blue-600/20 via-blue-500/20 to-cyan-400/20 rounded-full blur-3xl"
            />
            <motion.div
              animate={{
                scale: [1, 1.2, 1],
                rotate: [0, -90, 0],
              }}
              transition={{
                duration: 15,
                repeat: Infinity,
                ease: 'linear',
                delay: 0.5,
              }}
              className="absolute -bottom-1/2 -left-1/2 w-full h-full bg-gradient-to-br from-blue-600/20 via-blue-500/20 to-cyan-500/20 rounded-full blur-3xl"
            />
          </div>

          {/* Content */}
          <div className="relative p-10 md:p-14">
            {/* Close Button */}
            <button
              onClick={onClose}
              className="absolute top-6 right-6 p-2 text-white/50 hover:text-white/80 transition-all rounded-full hover:bg-white/10"
            >
              <X className="w-6 h-6" />
            </button>

            {/* Icon */}
            <motion.div
              initial={{ scale: 0, rotate: -10 }}
              animate={{ scale: 1, rotate: 0 }}
              transition={{
                type: 'spring',
                damping: 15,
                stiffness: 200,
                delay: 0.1,
              }}
              className="w-24 h-24 rounded-3xl bg-gradient-to-br from-blue-500 to-blue-600 flex items-center justify-center mx-auto mb-8 shadow-2xl shadow-blue-500/50"
            >
              <Sparkles className="w-12 h-12 text-white" />
            </motion.div>

            {/* Text Content */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 }}
              className="text-center space-y-4"
            >
              <h2 className="text-4xl md:text-5xl font-extrabold">
                <span className="bg-gradient-to-r from-white via-cyan-200 to-cyan-400 bg-clip-text text-transparent">
                  {language === 'id' ? 'Selamat Datang di' : 'Welcome to'}
                </span>
                <br />
                <span className="bg-gradient-to-r from-cyan-400 via-cyan-300 to-blue-400 bg-clip-text text-transparent">
                  Luxtrade, {username}!
                </span>
              </h2>

              <p className="text-xl text-white/70 leading-relaxed font-light max-w-lg mx-auto">
                {language === 'id'
                  ? 'Mari mulai perjalanan trading-mu. Kami akan memandu Anda melalui fitur-fitur hebat kami.'
                  : "Let's start your trading journey. We'll guide you through our amazing features."}
              </p>
            </motion.div>

            {/* CTA Buttons */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.4 }}
              className="mt-10 flex flex-col sm:flex-row gap-4 justify-center"
            >
              <Button
                onClick={onStartTour}
                className="h-14 px-8 bg-gradient-to-r from-blue-600 to-blue-600 hover:from-blue-700 hover:to-blue-700 text-lg font-extrabold shadow-lg shadow-blue-500/30 hover:shadow-[0_0_40px_rgba(139,92,246,0.6)] transition-all duration-300"
              >
                {language === 'id' ? 'Mulai Tour' : 'Start Tour'}
                <ArrowRight className="w-5 h-5 ml-2" />
              </Button>

              <Button
                onClick={onClose}
                variant="outline"
                className="h-14 px-8 border-2 border-white/20 hover:border-white/40 text-white hover:bg-white/10 text-lg font-semibold backdrop-blur-xl"
              >
                {language === 'id' ? 'Lewati' : 'Skip'}
              </Button>
            </motion.div>

            {/* Bottom Info */}
            <motion.p
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.6 }}
              className="mt-8 text-center text-sm text-white/40"
            >
              {language === 'id'
                ? 'Tour ini hanya butuh 30 detik • Dapatkan 10 XP gratis!'
                : 'This tour takes only 30 seconds • Get 10 free XP!'}
            </motion.p>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  )
}
