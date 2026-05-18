'use client'

import { motion, AnimatePresence } from 'framer-motion'
import { X, Crown, Lock, Sparkles, ExternalLink, Check, HelpCircle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { useLanguage } from '@/contexts/LanguageContext'
import { useState } from 'react'

interface PaywallModalProps {
  isOpen: boolean
  onClose: () => void
  onUpgrade?: () => void
  featureName?: string
  remainingTrials?: number
}

// Skrill payment links
const SKRILL_LINKS = {
  pro: 'https://skrill.me/rq/RIZQI%20AKBAR/3/USD?key=vXcr_5kNitZJFVBnkmK0sakLnjB',
  lifetime: 'https://skrill.me/rq/RIZQI%20AKBAR/5/USD?key=EI71vCJNy64rGTOWNzhHPcWiTXS'
}

export default function PaywallModal({
  isOpen,
  onClose,
  onUpgrade,
  featureName = 'Fitur Premium',
  remainingTrials = 0
}: PaywallModalProps) {
  const { language, t } = useLanguage()
  const isTrialExhausted = remainingTrials === 0
  const hasTrialsLeft = remainingTrials > 0
  const isEnglish = language === 'en'
  const [showFeatures, setShowFeatures] = useState(false)

  // Pricing data based on language
  const pricing = {
    pro: {
      title: 'ELITE PRO',
      price: isEnglish ? '$3' : 'Rp 49.000',
      period: isEnglish ? '/ Month' : '/ Bulan',
      description: isEnglish ? '🔥 UNLIMITED Journals + Full AI' : '🔥 UNLIMITED Jurnal + AI Penuh',
      popular: isEnglish ? 'Most Popular' : 'Paling Populer'
    },
    lifetime: {
      title: 'LIFETIME ULTRA',
      price: isEnglish ? '$5' : 'Rp 52.000',
      period: isEnglish ? '/ One-Time' : '/ Sekali Bayar',
      description: isEnglish ? '👑 Lifetime Access - Limited Slots!' : '👑 Akses Selamanya - Slot Terbatas!',
      promo: isEnglish ? 'PROMO: ONLY 30 SLOTS LEFT!' : 'PROMO MERDEKA TRADER - SISA 30 SLOT!'
    }
  }

  // Features list based on language
  const proFeatures = isEnglish ? [
    '🔥 UNLIMITED Trade Journals (No Monthly Limits)',
    '🧠 Full Smart AI Analysis (Mistake Detection & Solutions)',
    '📊 In-Depth Win-Rate Charts & Mistake Tracker',
    '🧮 Advanced Risk & Position Calculator',
    '📥 Free Data Export to Excel / PDF',
    '👑 VIP Group Access & Priority Support',
  ] : [
    '🔥 UNLIMITED Jurnal Transaksi (Tanpa Batas Bulanan)',
    '🧠 Akses Penuh Analisis AI Pintar (Deteksi Kesalahan & Solusi)',
    '📊 Grafik Win-Rate Mendalam & Mistake Tracker',
    '🧮 Kalkulator Risiko & Posisi Advance',
    '📥 Bebas Ekspor Data ke Excel / PDF',
    '👑 Akses VIP Grup & Dukungan Prioritas',
  ]

  const lifetimeFeatures = isEnglish ? [
    '👑 LIFETIME ACCESS',
    'All Elite PRO Features Forever',
    'VIP Telegram Support & Private Group Access',
    'No More Monthly Fees',
  ] : [
    '👑 AKSES SEUMUR HIDUP',
    'Semua Fitur Elite PRO Terbuka Selamanya',
    'VIP Telegram Support & Akses Grup Privat',
    'Tanpa Biaya Bulanan Lagi',
  ]

  const handleProUpgrade = () => {
    if (isEnglish) {
      window.open(SKRILL_LINKS.pro, '_blank')
    } else {
      onUpgrade?.()
    }
  }

  const handleLifetimeUpgrade = () => {
    if (isEnglish) {
      window.open(SKRILL_LINKS.lifetime, '_blank')
    } else {
      onUpgrade?.()
    }
  }

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
            className="relative w-full max-w-lg max-h-[90vh] overflow-y-auto"
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
                        {t('paywall.title')}
                      </h2>
                      <p className="text-white/60 text-sm leading-relaxed">
                        {isEnglish
                          ? 'You have experienced the power of our AI Analysis. Upgrade to Elite PRO now to unlock UNLIMITED access without limits.'
                          : 'Anda telah merasakan kekuatan Analisis AI kami. Upgrade ke Elite PRO sekarang untuk membuka akses UNLIMITED tanpa batas.'
                        }
                      </p>
                    </>
                  ) : (
                    <>
                      <h2 className="text-2xl font-extrabold text-white mb-2 flex items-center justify-center gap-2">
                        <Sparkles className="w-6 h-6 text-purple-400" />
                        {featureName}
                      </h2>
                      <p className="text-white/60 text-sm leading-relaxed">
                        {t('paywall.trials')}: <span className="text-amber-400 font-bold">{remainingTrials} / 3</span>
                      </p>
                    </>
                  )}
                </div>

                {/* Pricing Cards */}
                {isTrialExhausted && (
                  <div className="space-y-3 mb-6">
                    {/* Elite Pro */}
                    <Card
                      className={`bg-gradient-to-br from-purple-500/10 to-transparent border-purple-500/30 hover:border-purple-500/50 transition-all cursor-pointer group ${isEnglish ? '' : 'hover:scale-[1.02]'}`}
                      onClick={handleProUpgrade}
                    >
                      <CardContent className="p-4">
                        <div className="flex items-center justify-between mb-3">
                          <div>
                            <div className="flex items-center gap-2 mb-1">
                              <Badge className="bg-amber-500/20 text-amber-400 border-amber-500/30 text-xs">
                                {pricing.pro.popular}
                              </Badge>
                              <span className="text-white font-bold">{pricing.pro.title}</span>
                            </div>
                            <div className="text-2xl font-extrabold text-white">
                              {pricing.pro.price}
                              <span className="text-sm font-normal text-white/40"> {pricing.pro.period}</span>
                            </div>
                          </div>
                          <Crown className="w-8 h-8 text-purple-400 group-hover:scale-110 transition-transform" />
                        </div>

                        {/* Features list - collapsible */}
                        <div>
                          <button
                            onClick={(e) => {
                              e.stopPropagation()
                              setShowFeatures(!showFeatures)
                            }}
                            className="flex items-center gap-2 text-xs text-purple-300 hover:text-purple-200 transition-colors mb-2"
                          >
                            <HelpCircle className="w-3.5 h-3.5" />
                            {isEnglish ? 'View Features' : 'Lihat Fitur'}
                            <motion.div
                              animate={{ rotate: showFeatures ? 180 : 0 }}
                              className="text-xs"
                            >
                              ▼
                            </motion.div>
                          </button>

                          <AnimatePresence>
                            {showFeatures && (
                              <motion.div
                                initial={{ height: 0, opacity: 0 }}
                                animate={{ height: 'auto', opacity: 1 }}
                                exit={{ height: 0, opacity: 0 }}
                                className="space-y-2 overflow-hidden"
                              >
                                {proFeatures.map((feature, index) => (
                                  <div key={index} className="flex items-start gap-2 text-xs text-white/60">
                                    <Check className="w-3.5 h-3.5 text-emerald-400 flex-shrink-0 mt-0.5" />
                                    <span className="leading-relaxed">{feature}</span>
                                  </div>
                                ))}
                              </motion.div>
                            )}
                          </AnimatePresence>
                        </div>
                      </CardContent>
                    </Card>

                    {/* Lifetime Ultra */}
                    <Card
                      className={`bg-gradient-to-br from-amber-500/10 to-transparent border-amber-500/30 hover:border-amber-500/50 transition-all cursor-pointer group ${isEnglish ? '' : 'hover:scale-[1.02]'}`}
                      onClick={handleLifetimeUpgrade}
                    >
                      <CardContent className="p-4">
                        <div className="flex items-center justify-between mb-3">
                          <div>
                            <div className="flex items-center gap-2 mb-1">
                              <Badge className="bg-red-500/20 text-red-400 border-red-500/30 text-xs">
                                PROMO
                              </Badge>
                              <span className="text-white font-bold">{pricing.lifetime.title}</span>
                            </div>
                            <div className="text-2xl font-extrabold text-white">
                              {pricing.lifetime.price}
                              <span className="text-sm font-normal text-white/40"> {pricing.lifetime.period}</span>
                            </div>
                          </div>
                          <Sparkles className="w-8 h-8 text-amber-400 group-hover:scale-110 transition-transform" />
                        </div>

                        {/* Features list - always shown for lifetime */}
                        <div className="space-y-2">
                          {lifetimeFeatures.map((feature, index) => (
                            <div key={index} className="flex items-start gap-2 text-xs text-white/60">
                              <Check className="w-3.5 h-3.5 text-amber-400 flex-shrink-0 mt-0.5" />
                              <span className="leading-relaxed">{feature}</span>
                            </div>
                          ))}
                        </div>

                        {pricing.lifetime.promo && (
                          <p className="text-xs text-red-400/80 mt-2 font-semibold">{pricing.lifetime.promo}</p>
                        )}
                      </CardContent>
                    </Card>
                  </div>
                )}

                {/* Action Buttons */}
                <div className="space-y-3">
                  {isTrialExhausted ? (
                    <>
                      <Button
                        onClick={handleProUpgrade}
                        className={`w-full h-12 bg-gradient-to-r from-purple-500 to-violet-600 hover:from-purple-600 hover:to-violet-700 text-white font-extrabold shadow-lg shadow-purple-500/30 hover:shadow-[0_0_20px_rgba(168,85,247,0.5)] transition-all ${isEnglish ? 'hover:scale-[1.02]' : ''}`}
                      >
                        <Crown className="w-5 h-5 mr-2" />
                        {isEnglish ? 'Upgrade to Elite PRO Now' : 'Upgrade ke Elite PRO Sekarang'}
                      </Button>
                      {isEnglish ? (
                        <Button
                          onClick={handleLifetimeUpgrade}
                          variant="outline"
                          className="w-full h-12 border-amber-500/30 text-amber-400 hover:bg-amber-500/10 hover:border-amber-500/50 font-semibold transition-all hover:scale-[1.02]"
                        >
                          <Sparkles className="w-5 h-5 mr-2" />
                          Get Lifetime Ultra
                        </Button>
                      ) : (
                        <Button
                          onClick={() => window.open('https://t.me/luxtrade_admin?text=Halo%20saya%20ingin%20upgrade%20ke%20Elite%20PRO', '_blank')}
                          variant="outline"
                          className="w-full h-12 border-emerald-500/30 text-emerald-400 hover:bg-emerald-500/10 hover:border-emerald-500/50 font-semibold transition-all"
                        >
                          <ExternalLink className="w-5 h-5 mr-2" />
                          Hubungi Telegram Admin
                        </Button>
                      )}
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
                        {isEnglish ? `Use Trial (${remainingTrials} left)` : `Gunakan Trial (${remainingTrials} tersisa)`}
                      </Button>
                      <Button
                        onClick={onUpgrade}
                        variant="outline"
                        className="w-full h-12 border-amber-500/30 text-amber-400 hover:bg-amber-500/10 hover:border-amber-500/50 font-semibold transition-all"
                      >
                        <Crown className="w-5 h-5 mr-2" />
                        {isEnglish ? 'Upgrade to PRO Now' : 'Langsung Upgrade ke PRO'}
                      </Button>
                    </>
                  )}
                </div>

                {/* Footer - Payment Guide */}
                {isTrialExhausted && (
                  <div className="mt-6 pt-4 border-t border-white/10">
                    <div className="text-center space-y-2">
                      <p className="text-xs text-white/40 font-semibold mb-3">
                        {isEnglish ? '💳 Payment Guide' : '💳 Panduan Pembayaran'}
                      </p>

                      {isEnglish ? (
                        <div className="text-left space-y-2 bg-white/5 rounded-lg p-3">
                          <div className="flex items-start gap-2">
                            <span className="text-purple-400 text-xs font-bold mt-0.5">1.</span>
                            <p className="text-xs text-white/60 leading-relaxed">
                              Click <span className="text-amber-400 font-semibold">"Upgrade to Elite PRO"</span> or <span className="text-amber-400 font-semibold">"Get Lifetime Ultra"</span> button
                            </p>
                          </div>
                          <div className="flex items-start gap-2">
                            <span className="text-purple-400 text-xs font-bold mt-0.5">2.</span>
                            <p className="text-xs text-white/60 leading-relaxed">
                              Complete payment via <span className="text-amber-400 font-semibold">Skrill</span> (secure & instant)
                            </p>
                          </div>
                          <div className="flex items-start gap-2">
                            <span className="text-purple-400 text-xs font-bold mt-0.5">3.</span>
                            <p className="text-xs text-white/60 leading-relaxed">
                              After payment, send screenshot to <span className="text-amber-400 font-semibold">@luxtrade_admin</span> on Telegram for activation
                            </p>
                          </div>
                          <div className="flex items-start gap-2">
                            <span className="text-purple-400 text-xs font-bold mt-0.5">4.</span>
                            <p className="text-xs text-white/60 leading-relaxed">
                              Your PRO access will be activated within <span className="text-amber-400 font-semibold">5-10 minutes</span>
                            </p>
                          </div>
                        </div>
                      ) : (
                        <div className="text-left space-y-2 bg-white/5 rounded-lg p-3">
                          <div className="flex items-start gap-2">
                            <span className="text-purple-400 text-xs font-bold mt-0.5">1.</span>
                            <p className="text-xs text-white/60 leading-relaxed">
                              Klik tombol <span className="text-emerald-400 font-semibold">"Upgrade ke Elite PRO"</span> atau pilih paket Lifetime
                            </p>
                          </div>
                          <div className="flex items-start gap-2">
                            <span className="text-purple-400 text-xs font-bold mt-0.5">2.</span>
                            <p className="text-xs text-white/60 leading-relaxed">
                              Anda akan diarahkan ke <span className="text-emerald-400 font-semibold">Telegram Admin</span>
                            </p>
                          </div>
                          <div className="flex items-start gap-2">
                            <span className="text-purple-400 text-xs font-bold mt-0.5">3.</span>
                            <p className="text-xs text-white/60 leading-relaxed">
                              Kirim pesan: <span className="text-emerald-400 font-semibold">"Halo saya ingin upgrade ke Elite PRO"</span>
                            </p>
                          </div>
                          <div className="flex items-start gap-2">
                            <span className="text-purple-400 text-xs font-bold mt-0.5">4.</span>
                            <p className="text-xs text-white/60 leading-relaxed">
                              Ikuti instruksi pembayaran dari admin (Transfer Bank / E-Wallet)
                            </p>
                          </div>
                          <div className="flex items-start gap-2">
                            <span className="text-purple-400 text-xs font-bold mt-0.5">5.</span>
                            <p className="text-xs text-white/60 leading-relaxed">
                              Kirim bukti transfer dan akun Anda akan diaktifkan dalam <span className="text-emerald-400 font-semibold">5-10 menit</span>
                            </p>
                          </div>
                        </div>
                      )}

                      <div className="pt-3">
                        <Button
                          onClick={() => window.open(
                            isEnglish
                              ? 'https://t.me/luxtrade_admin?text=Hi%2C%20I%20need%20help%20with%20payment'
                              : 'https://t.me/luxtrade_admin?text=Halo%20saya%20butuh%20bantuan%20pembayaran',
                            '_blank'
                          )}
                          variant="ghost"
                          size="sm"
                          className="text-xs text-white/40 hover:text-white/60 hover:bg-white/5"
                        >
                          <ExternalLink className="w-3 h-3 mr-1" />
                          {isEnglish ? 'Need Help? Contact Support' : 'Butuh Bantuan? Hubungi Support'}
                        </Button>
                      </div>
                    </div>
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
