'use client'

import React, { useState, useEffect, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { X, Smartphone, Share2, Plus, Bell, ChevronRight } from 'lucide-react'
import { useLanguage } from '@/contexts/LanguageContext'

// ─── i18n strings ──────────────────────────────────────────────────────────────
const strings = {
  id: {
    title: 'Aktifkan Notifikasi di iPhone',
    subtitle: 'Push notification cuma bisa jalan kalau LuxTradee di-install sebagai app di Home Screen.',
    whyTitle: 'Kenapa perlu install?',
    whyText: 'Safari di iPhone tidak mendukung push notification di browser. Setelah di-install sebagai app (iOS 16.4+), notifikasi trade & price alert bakal muncul di HP kamu walau app ditutup.',
    step1: 'Tap tombol Share di bawah',
    step2: 'Pilih "Add to Home Screen"',
    step3: 'Tap "Add" di pojok kanan atas',
    step4: 'Buka LuxTradee dari Home Screen',
    alreadyHave: 'Sudah di-install?',
    alreadyHaveHint: 'Buka dari Home Screen, bukan dari Safari',
    dismiss: 'Nanti saja',
    emailFallback: 'Sementara itu, notifikasi email bakal dikirim sebagai fallback.',
  },
  en: {
    title: 'Enable Notifications on iPhone',
    subtitle: 'Push notifications only work when LuxTradee is installed as an app on your Home Screen.',
    whyTitle: 'Why do I need to install?',
    whyText: 'Safari on iPhone does not support push notifications in the browser. Once installed as an app (iOS 16.4+), trade & price alert notifications will appear on your phone even when the app is closed.',
    step1: 'Tap the Share button below',
    step2: 'Select "Add to Home Screen"',
    step3: 'Tap "Add" in the top right corner',
    step4: 'Open LuxTradee from your Home Screen',
    alreadyHave: 'Already installed?',
    alreadyHaveHint: 'Open from Home Screen, not from Safari',
    dismiss: 'Maybe later',
    emailFallback: 'In the meantime, email notifications will be sent as a fallback.',
  },
} as const

type LangKey = keyof typeof strings

// ─── iOS detection helpers ─────────────────────────────────────────────────────

export function isIOSSafari(): boolean {
  if (typeof navigator === 'undefined') return false
  const ua = navigator.userAgent
  // iOS device + Safari browser (not Chrome, not Firefox, not in-app browser)
  const isIOS = /iPad|iPhone|iPod/.test(ua) && !('MSStream' in window)
  const isSafari = /Safari/.test(ua) && !/CriOS|FxiOS|OPiOS/.test(ua)
  return isIOS && isSafari
}

export function isStandaloneMode(): boolean {
  if (typeof window === 'undefined') return false
  return (
    window.matchMedia('(display-mode: standalone)').matches ||
    (window.navigator as unknown as { standalone?: boolean }).standalone === true
  )
}

const DISMISSED_KEY = 'luxtrade_pwa_prompt_dismissed'

// ─── Component ─────────────────────────────────────────────────────────────────

interface PWAInstallPromptProps {
  /** Force show even if dismissed (e.g. user clicked "Enable Notifications") */
  forceShow?: boolean
  /** Called when user dismisses the prompt */
  onDismiss?: () => void
  /** Render as a top banner instead of floating card */
  variant?: 'banner' | 'card'
}

export default function PWAInstallPrompt({
  forceShow = false,
  onDismiss,
  variant = 'banner',
}: PWAInstallPromptProps) {
  const { language } = useLanguage()
  const lang = (language === 'id' ? 'id' : 'en') as LangKey
  const t = strings[lang]

  const [showPrompt, setShowPrompt] = useState(false)
  const [dismissed, setDismissed] = useState(true) // start true to avoid flash
  const [_isIOS, setIsIOS] = useState(false)
  const [_isStandalone, setIsStandalone] = useState(false)
  const [showSteps, setShowSteps] = useState(false)

  useEffect(() => {
    const ios = isIOSSafari()
    const standalone = isStandaloneMode()
    setIsIOS(ios)
    setIsStandalone(standalone)

    if (standalone) return // Already installed as PWA

    // Check localStorage dismissal
    const wasDismissed = localStorage.getItem(DISMISSED_KEY)
    setDismissed(wasDismissed === 'true')

    if (ios) {
      // Show after a small delay so the page loads first
      const timer = setTimeout(() => setShowPrompt(true), 2000)
      return () => clearTimeout(timer)
    }
  }, [])

  // When forceShow changes (e.g. user clicked Enable Notifications on iOS Safari)
  useEffect(() => {
    if (forceShow && _isIOS && !_isStandalone) {
      setShowPrompt(true)
      setDismissed(false)
    }
  }, [forceShow, _isIOS, _isStandalone])

  const handleDismiss = useCallback(() => {
    setShowPrompt(false)
    setDismissed(true)
    localStorage.setItem(DISMISSED_KEY, 'true')
    onDismiss?.()
  }, [onDismiss])

  // Don't render if not iOS Safari or already in standalone mode
  if (!_isIOS || _isStandalone) return null
  if (!showPrompt && !forceShow) return null
  if (dismissed && !forceShow) return null

  // ─── Banner variant (top of dashboard) ──────────────────────────────────────
  if (variant === 'banner') {
    return (
      <AnimatePresence>
        <motion.div
          initial={{ opacity: 0, y: -20, height: 0 }}
          animate={{ opacity: 1, y: 0, height: 'auto' }}
          exit={{ opacity: 0, y: -20, height: 0 }}
          transition={{ duration: 0.3, ease: 'easeOut' }}
          className="overflow-hidden"
        >
          <div className="relative mx-2 sm:mx-4 lg:mx-6 mt-3 mb-2 rounded-xl border border-amber-500/20 bg-gradient-to-r from-amber-500/8 via-amber-500/5 to-transparent backdrop-blur-sm">
            {/* Close button */}
            <button
              onClick={handleDismiss}
              className="absolute top-2.5 right-2.5 p-1 rounded-lg hover:bg-white/10 transition-colors z-10"
              aria-label="Dismiss"
            >
              <X className="w-3.5 h-3.5 text-white/30 hover:text-white/60" />
            </button>

            <div className="flex items-start gap-3 p-3.5 pr-8">
              {/* Icon */}
              <div className="flex-shrink-0 w-9 h-9 rounded-lg bg-amber-500/15 flex items-center justify-center mt-0.5">
                <Smartphone className="w-4.5 h-4.5 text-amber-400" />
              </div>

              {/* Content */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <Bell className="w-3.5 h-3.5 text-amber-400" />
                  <p className="text-sm font-semibold text-white">{t.title}</p>
                </div>
                <p className="text-xs text-white/50 leading-relaxed mb-2">
                  {t.subtitle}
                </p>

                {/* Step-by-step toggle */}
                {!showSteps ? (
                  <button
                    onClick={() => setShowSteps(true)}
                    className="flex items-center gap-1 text-xs font-medium text-amber-400 hover:text-amber-300 transition-colors"
                  >
                    {lang === 'id' ? 'Lihat langkah-langkah' : 'Show steps'}
                    <ChevronRight className="w-3 h-3" />
                  </button>
                ) : (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    transition={{ duration: 0.2 }}
                    className="space-y-2"
                  >
                    {/* Steps */}
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                      {[
                        { icon: <Share2 className="w-3.5 h-3.5" />, text: t.step1, num: 1 },
                        { icon: <Plus className="w-3.5 h-3.5" />, text: t.step2, num: 2 },
                        { icon: <Plus className="w-3.5 h-3.5" />, text: t.step3, num: 3 },
                        { icon: <Smartphone className="w-3.5 h-3.5" />, text: t.step4, num: 4 },
                      ].map((step) => (
                        <div
                          key={step.num}
                          className="flex items-start gap-1.5 p-2 rounded-lg bg-white/5 border border-white/5"
                        >
                          <span className="flex-shrink-0 w-4 h-4 rounded-full bg-amber-500/20 text-amber-400 text-[10px] font-bold flex items-center justify-center">
                            {step.num}
                          </span>
                          <p className="text-[11px] text-white/60 leading-tight">{step.text}</p>
                        </div>
                      ))}
                    </div>

                    {/* Already installed hint */}
                    <p className="text-[11px] text-white/30">
                      💡 {t.alreadyHave} <span className="text-amber-400/60">{t.alreadyHaveHint}</span>
                    </p>

                    {/* Email fallback note */}
                    <p className="text-[11px] text-emerald-400/60">
                      📧 {t.emailFallback}
                    </p>
                  </motion.div>
                )}
              </div>
            </div>
          </div>
        </motion.div>
      </AnimatePresence>
    )
  }

  // ─── Card variant (floating/modal-like) ─────────────────────────────────────
  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0, y: 40, scale: 0.95 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: 40, scale: 0.95 }}
        transition={{ duration: 0.3, ease: 'easeOut' }}
        className="fixed bottom-20 md:bottom-6 left-4 right-4 md:left-auto md:right-6 md:max-w-sm z-50"
      >
        <div className="relative bg-[#0a0a0f] border border-amber-500/20 rounded-2xl p-4 shadow-2xl shadow-black/50">
          {/* Close */}
          <button
            onClick={handleDismiss}
            className="absolute top-3 right-3 p-1 rounded-lg hover:bg-white/10 transition-colors"
          >
            <X className="w-4 h-4 text-white/40" />
          </button>

          <div className="flex items-start gap-3 mb-3">
            <div className="flex-shrink-0 w-10 h-10 rounded-xl bg-gradient-to-br from-amber-500 to-orange-400 flex items-center justify-center">
              <Smartphone className="w-5 h-5 text-white" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-bold text-white mb-0.5">{t.title}</p>
              <p className="text-xs text-white/50 leading-relaxed">{t.subtitle}</p>
            </div>
          </div>

          {/* Steps */}
          <div className="space-y-1.5 mb-3">
            {[t.step1, t.step2, t.step3, t.step4].map((step, i) => (
              <div key={i} className="flex items-start gap-2">
                <span className="flex-shrink-0 w-5 h-5 rounded-full bg-amber-500/15 text-amber-400 text-[10px] font-bold flex items-center justify-center mt-0.5">
                  {i + 1}
                </span>
                <p className="text-xs text-white/60 leading-relaxed">{step}</p>
              </div>
            ))}
          </div>

          {/* Email fallback */}
          <p className="text-[11px] text-emerald-400/60 mb-3">📧 {t.emailFallback}</p>

          {/* Dismiss button */}
          <button
            onClick={handleDismiss}
            className="w-full px-4 py-2 rounded-xl bg-white/5 text-xs text-white/50 hover:text-white/80 hover:bg-white/10 transition-all"
          >
            {t.dismiss}
          </button>
        </div>
      </motion.div>
    </AnimatePresence>
  )
}
