'use client'

import { motion, AnimatePresence } from 'framer-motion'
import { X, Crown, Lock, Sparkles, ExternalLink } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'

interface PaywallModalProps {
  isOpen: boolean
  onClose: () => void
  onUpgrade?: () => void
  featureName?: string
  remainingTrials?: number
}

export default function PaywallModal({
  isOpen,
  onClose,
  onUpgrade,
  featureName = 'Fitur Premium',
  remainingTrials = 0
}: PaywallModalProps) {
  const isTrialExhausted = remainingTrials === 0
  const hasTrialsLeft = remainingTrials > 0

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
        >
          {/* Backdrop with blur */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 bg-black/80 backdrop-blur-xl"
            onClick={onClose}
          />

          {/* Modal */}
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            transition={{ type: 'spring', damping: 25, stiffness: 300 }}
            className="relative w-full max-w-lg"
          >
            <Card className="bg-gradient-to-br from-[#1a0f2e] via-[#150a25] to-[#0d0820] border-purple-500/30 shadow-2xl shadow-purple-500/20 overflow-hidden">
              {/* Decorative gradient header */}
              <div className="relative h-32 bg-gradient-to-br from-purple-600/20 via-violet-600/20 to-blue-600/20 overflow-hidden">
                <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNjAiIGhlaWdodD0iNjAiIHZpZXdCb3g9IjAgMCA2MCA2MCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48ZyBmaWxsPSJub25lIiBmaWxsLXJ1bGU9ImV2ZW5vZGQiPjxnIGZpbGw9IiNmZmYiIGZpbGwtb3BhY2l0eT0iMC4wMyI+PHBhdGggZD0iTTM2IDM0djRoLTJ2LTRoLTJ2NGgtMnYtNGgtMnY0aC0ydi00aC0ydjRoLTJ2NGgtMnYtNGgtMnY0aC0ydi00aC0ydi00aDJ2NGgydi00aDJ2NGgydi00aDJ2NGgydjRoLTJ2NGgtMnY0aDJ2LTJoLTJ2LTJoLTJ2LTJoLTJ2LTJoLTJ2LTJoLTJ6Ii8+PC9nPjwvZz48L3N2Zz4=')] opacity-30" />
                <motion.div
                  animate={{
                    rotate: [0, 360]
                  }}
                  transition={{
                    duration: 20,
                    repeat: Infinity,
                    ease: "linear"
                  }}
                  className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2"
                >
                  <div className="w-40 h-40 border border-purple-500/20 rounded-full" />
                  <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-32 h-32 border border-purple-500/10 rounded-full" />
                </motion.div>

                {/* Close button */}
                <button
                  onClick={onClose}
                  className="absolute top-4 right-4 p-2 rounded-lg bg-white/10 hover:bg-white/20 transition-colors text-white/70 hover:text-white backdrop-blur-sm"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <CardContent className="relative p-6 -mt-16">
                {/* Icon */}
                <motion.div
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  transition={{ type: 'spring', delay: 0.1 }}
                  className="w-20 h-20 mx-auto mb-4 rounded-2xl bg-gradient-to-br from-purple-500 to-violet-600 flex items-center justify-center shadow-2xl shadow-purple-500/30"
                >
                  <Lock className="w-10 h-10 text-white" />
                </motion.div>

                {/* Title */}
                <div className="text-center mb-6">
                  {isTrialExhausted ? (
                    <>
                      <h2 className="text-2xl font-extrabold text-white mb-2 flex items-center justify-center gap-2">
                        <Crown className="w-6 h-6 text-amber-400" />
                        Masa Uji Coba Fitur PRO Habis!
                      </h2>
                      <p className="text-white/60 text-sm leading-relaxed">
                        Anda telah merasakan kekuatan Analisis AI kami. Upgrade ke Elite PRO sekarang untuk membuka akses <span className="text-purple-400 font-semibold">UNLIMITED</span> tanpa batas.
                      </p>
                    </>
                  ) : (
                    <>
                      <h2 className="text-2xl font-extrabold text-white mb-2 flex items-center justify-center gap-2">
                        <Sparkles className="w-6 h-6 text-purple-400" />
                        {featureName}
                      </h2>
                      <p className="text-white/60 text-sm leading-relaxed">
                        Sisa uji coba fitur premium: <span className="text-amber-400 font-bold">{remainingTrials} / 3</span> kali
                      </p>
                    </>
                  )}
                </div>

                {/* Pricing Cards */}
                {isTrialExhausted && (
                  <div className="space-y-3 mb-6">
                    {/* Elite Pro */}
                    <Card className="bg-gradient-to-br from-purple-500/10 to-transparent border-purple-500/30 hover:border-purple-500/50 transition-all cursor-pointer group" onClick={onUpgrade}>
                      <CardContent className="p-4">
                        <div className="flex items-center justify-between">
                          <div>
                            <div className="flex items-center gap-2 mb-1">
                              <Badge className="bg-amber-500/20 text-amber-400 border-amber-500/30 text-xs">
                                Paling Populer
                              </Badge>
                              <span className="text-white font-bold">ELITE PRO</span>
                            </div>
                            <div className="text-2xl font-extrabold text-white">
                              Rp 49.000
                              <span className="text-sm font-normal text-white/40"> / Bulan</span>
                            </div>
                            <p className="text-xs text-white/50 mt-1">🔥 UNLIMITED Jurnal + AI Penuh</p>
                          </div>
                          <Crown className="w-8 h-8 text-purple-400 group-hover:scale-110 transition-transform" />
                        </div>
                      </CardContent>
                    </Card>

                    {/* Lifetime Ultra */}
                    <Card className="bg-gradient-to-br from-amber-500/10 to-transparent border-amber-500/30 hover:border-amber-500/50 transition-all cursor-pointer group" onClick={onUpgrade}>
                      <CardContent className="p-4">
                        <div className="flex items-center justify-between">
                          <div>
                            <div className="flex items-center gap-2 mb-1">
                              <Badge className="bg-red-500/20 text-red-400 border-red-500/30 text-xs">
                                PROMO
                              </Badge>
                              <span className="text-white font-bold">LIFETIME ULTRA</span>
                            </div>
                            <div className="text-2xl font-extrabold text-white">
                              Rp 52.000
                              <span className="text-sm font-normal text-white/40"> / Sekali Bayar</span>
                            </div>
                            <p className="text-xs text-amber-300/60 mt-1">👑 Akses Selamanya - Slot Terbatas!</p>
                          </div>
                          <Sparkles className="w-8 h-8 text-amber-400 group-hover:scale-110 transition-transform" />
                        </div>
                      </CardContent>
                    </Card>
                  </div>
                )}

                {/* Action Buttons */}
                <div className="space-y-3">
                  {isTrialExhausted ? (
                    <>
                      <Button
                        onClick={onUpgrade}
                        className="w-full h-12 bg-gradient-to-r from-purple-500 to-violet-600 hover:from-purple-600 hover:to-violet-700 text-white font-extrabold shadow-lg shadow-purple-500/30 hover:shadow-[0_0_20px_rgba(168,85,247,0.5)] transition-all"
                      >
                        <Crown className="w-5 h-5 mr-2" />
                        Upgrade ke Elite PRO Sekarang
                      </Button>
                      <Button
                        onClick={() => window.open('https://wa.me/6281234567890?text=Halo%20saya%20ingin%20upgrade%20ke%20Elite%20PRO', '_blank')}
                        variant="outline"
                        className="w-full h-12 border-emerald-500/30 text-emerald-400 hover:bg-emerald-500/10 hover:border-emerald-500/50 font-semibold transition-all"
                      >
                        <ExternalLink className="w-5 h-5 mr-2" />
                        Hubungi WhatsApp Admin
                      </Button>
                    </>
                  ) : (
                    <>
                      <Button
                        onClick={() => {
                          onUpgrade?.()
                          onClose()
                        }}
                        className="w-full h-12 bg-gradient-to-r from-purple-500 to-violet-600 hover:from-purple-600 hover:to-violet-700 text-white font-extrabold shadow-lg shadow-purple-500/30 hover:shadow-[0_0_20px_rgba(168,85,247,0.5)] transition-all"
                      >
                        <Sparkles className="w-5 h-5 mr-2" />
                        Gunakan Trial ({remainingTrials} tersisa)
                      </Button>
                      <Button
                        onClick={onUpgrade}
                        variant="outline"
                        className="w-full h-12 border-amber-500/30 text-amber-400 hover:bg-amber-500/10 hover:border-amber-500/50 font-semibold transition-all"
                      >
                        <Crown className="w-5 h-5 mr-2" />
                        Langsung Upgrade ke PRO
                      </Button>
                    </>
                  )}
                </div>

                {/* Footer */}
                {isTrialExhausted && (
                  <div className="mt-6 pt-4 border-t border-white/10 text-center">
                    <p className="text-xs text-white/40">
                      Pertanyaan? Hubungi kami di WhatsApp untuk bantuan
                    </p>
                  </div>
                )}
              </CardContent>
            </Card>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
