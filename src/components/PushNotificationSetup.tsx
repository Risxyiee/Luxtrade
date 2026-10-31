'use client'

import { useState, useEffect } from 'react'
import { Bell, Crown, X, Loader2, Smartphone } from 'lucide-react'
import { useAuth } from '@/lib/auth-context'
import { usePushSubscription } from '@/hooks/usePushSubscription'
import { useLanguage } from '@/contexts/LanguageContext'
import { isIOSSafari, isStandaloneMode } from '@/components/PWAInstallPrompt'
import { motion, AnimatePresence } from 'framer-motion'

const DISMISSED_KEY = 'luxtrade_push_prompt_dismissed'

// ─── i18n strings ──────────────────────────────────────────────────────────────
const strings = {
  id: {
    proTitle: 'Aktifkan notifikasi push?',
    proDesc: 'Notif trade, price alert, & berita bakal langsung masuk ke HP kamu.',
    proEnable: 'Aktifkan',
    freeTitle: 'Notifikasi push cuma buat Pro',
    freeDesc: 'Upgrade ke Pro biar notif trade & price alert masuk langsung ke HP.',
    freeUpgrade: 'Upgrade',
    later: 'Nanti',
    iosWarning: '⚠️ Di iPhone, install app ke Home Screen dulu biar push notification jalan.',
    iosAction: 'Lihat cara install',
  },
  en: {
    proTitle: 'Enable push notifications?',
    proDesc: 'Trade alerts, price alerts, & news will go straight to your phone.',
    proEnable: 'Enable',
    freeTitle: 'Push notifications are Pro-only',
    freeDesc: 'Upgrade to Pro so trade & price alerts go straight to your phone.',
    freeUpgrade: 'Upgrade',
    later: 'Later',
    iosWarning: '⚠️ On iPhone, install the app to Home Screen first for push notifications to work.',
    iosAction: 'See how to install',
  },
} as const

type LangKey = keyof typeof strings

interface PushNotificationSetupProps {
  /** Called when user on iOS wants to see install instructions */
  onShowIOSInstall?: () => void
}

/**
 * Smart component that auto-checks user status and shows appropriate prompt:
 * - Pro + not enabled → one-time prompt to enable push notifications
 * - Pro + on iOS Safari (not standalone) → show iOS install guidance
 * - Pro + enabled → silent (nothing shown)
 * - Free user → upgrade prompt suggesting Pro for notifications
 * Saves dismissed state to localStorage so it doesn't show again until next login.
 */
export default function PushNotificationSetup({ onShowIOSInstall }: PushNotificationSetupProps) {
  const { isPro, user } = useAuth()
  const userId = user?.id || ''
  const { isSubscribed, isSupported, subscribe, isLoading } = usePushSubscription(userId)
  const { language } = useLanguage()
  const lang = (language === 'id' ? 'id' : 'en') as LangKey
  const t = strings[lang]

  const [dismissed, setDismissed] = useState(true) // Start dismissed to avoid flash
  const [visible, setVisible] = useState(false)
  const [isIOS, setIsIOS] = useState(false)
  const [isStandalone, setIsStandalone] = useState(false)

  // Detect iOS and standalone mode
  useEffect(() => {
    setIsIOS(isIOSSafari())
    setIsStandalone(isStandaloneMode())
  }, [])

  // Check dismissal state on mount
  useEffect(() => {
    const wasDismissed = localStorage.getItem(DISMISSED_KEY)
    setDismissed(wasDismissed === 'true')
  }, [])

  // Show banner logic
  useEffect(() => {
    // If already subscribed, never show
    if (isSubscribed) {
      setVisible(false)
      return
    }

    // If dismissed, don't show
    if (dismissed) {
      setVisible(false)
      return
    }

    // Must have user
    if (!userId) {
      setVisible(false)
      return
    }

    // On iOS Safari (not standalone), we still show the prompt but with different messaging
    // On other platforms, only show if push is supported
    if (!isIOS && !isSupported) {
      setVisible(false)
      return
    }

    // Show for pro (enable prompt) or free (upgrade prompt)
    setVisible(true)
  }, [isSupported, isSubscribed, dismissed, userId, isPro, isIOS])

  const handleDismiss = () => {
    setDismissed(true)
    setVisible(false)
    localStorage.setItem(DISMISSED_KEY, 'true')
  }

  const handleEnable = async () => {
    if (!userId) return

    // If on iOS Safari (not standalone), don't try to subscribe — guide them to install instead
    if (isIOS && !isStandalone) {
      onShowIOSInstall?.()
      return
    }

    const success = await subscribe(userId)
    if (success) {
      setVisible(false)
    }
  }

  // Clear dismissed on login so prompt shows again next session
  useEffect(() => {
    if (userId) {
      const sessionKey = `luxtrade_push_session_${userId}`
      const seenSession = sessionStorage.getItem(sessionKey)
      if (!seenSession) {
        localStorage.removeItem(DISMISSED_KEY)
        setDismissed(false)
        sessionStorage.setItem(sessionKey, 'true')
      }
    }
  }, [userId])

  const isIOSBrowser = isIOS && !isStandalone

  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          initial={{ opacity: 0, y: -20, height: 0 }}
          animate={{ opacity: 1, y: 0, height: 'auto' }}
          exit={{ opacity: 0, y: -20, height: 0 }}
          transition={{ duration: 0.3 }}
          className="overflow-hidden"
        >
          <div className={`mx-2 sm:mx-4 lg:mx-6 mb-4 mt-2 relative flex items-center gap-3 px-4 py-3 rounded-xl border backdrop-blur-sm ${
            isIOSBrowser
              ? 'border-amber-500/20 bg-amber-500/5'
              : isPro
                ? 'border-emerald-500/15 bg-emerald-500/5'
                : 'border-amber-500/15 bg-amber-500/5'
          }`}>
            {isPro ? (
              // Pro user prompt — enable notifications (or iOS guidance)
              <>
                <div className={`flex-shrink-0 w-8 h-8 rounded-lg flex items-center justify-center ${
                  isIOSBrowser ? 'bg-amber-500/20' : 'bg-emerald-500/20'
                }`}>
                  {isIOSBrowser ? (
                    <Smartphone className="w-4 h-4 text-amber-400" />
                  ) : (
                    <Bell className="w-4 h-4 text-emerald-400" />
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-white">
                    {isIOSBrowser ? (lang === 'id' ? 'Aktifkan Push di iPhone' : 'Enable Push on iPhone') : t.proTitle}
                  </p>
                  <p className="text-xs text-white/50">
                    {isIOSBrowser ? t.iosWarning : t.proDesc}
                  </p>
                </div>
                <div className="flex items-center gap-2 flex-shrink-0">
                  <button
                    onClick={handleEnable}
                    disabled={isLoading}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold text-white active:scale-[0.97] transition-all disabled:opacity-50 disabled:pointer-events-none ${
                      isIOSBrowser
                        ? 'bg-amber-500 hover:bg-amber-400'
                        : 'bg-emerald-500 hover:bg-emerald-400'
                    }`}
                  >
                    {isLoading ? (
                      <Loader2 className="w-3 h-3 animate-spin" />
                    ) : isIOSBrowser ? (
                      <Smartphone className="w-3 h-3" />
                    ) : (
                      <Bell className="w-3 h-3" />
                    )}
                    {isIOSBrowser ? t.iosAction : t.proEnable}
                  </button>
                  <button
                    onClick={handleDismiss}
                    className="px-3 py-1.5 rounded-lg bg-white/5 text-xs text-white/50 hover:text-white/80 hover:bg-white/10 transition-all"
                  >
                    {t.later}
                  </button>
                </div>
              </>
            ) : (
              // Free user prompt — upgrade to Pro
              <>
                <div className="flex-shrink-0 w-8 h-8 rounded-lg bg-amber-500/20 flex items-center justify-center">
                  <Crown className="w-4 h-4 text-amber-400" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-white">{t.freeTitle}</p>
                  <p className="text-xs text-white/50">{t.freeDesc}</p>
                </div>
                <div className="flex items-center gap-2 flex-shrink-0">
                  <a
                    href="/upgrade"
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-amber-500 text-xs font-bold text-white hover:bg-amber-400 active:scale-[0.97] transition-all"
                  >
                    <Crown className="w-3 h-3" />
                    {t.freeUpgrade}
                  </a>
                  <button
                    onClick={handleDismiss}
                    className="px-3 py-1.5 rounded-lg bg-white/5 text-xs text-white/50 hover:text-white/80 hover:bg-white/10 transition-all"
                  >
                    {t.later}
                  </button>
                </div>
              </>
            )}

            {/* Close button */}
            <button
              onClick={handleDismiss}
              className="absolute top-2 right-2 p-0.5 rounded-md text-white/20 hover:text-white/60 transition-colors"
              aria-label="Close"
            >
              <X className="w-3 h-3" />
            </button>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
