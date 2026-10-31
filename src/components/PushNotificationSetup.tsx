'use client'

import { useState, useEffect } from 'react'
import { Bell, Crown, X, Loader2, Smartphone } from 'lucide-react'
import { useAuth } from '@/lib/auth-context'
import { usePushSubscription } from '@/hooks/usePushSubscription'
import { useLanguage } from '@/contexts/LanguageContext'
import { isIOSSafari, isStandaloneMode } from '@/components/PWAInstallPrompt'
import { motion, AnimatePresence } from 'framer-motion'

// "Nanti" BUKAN dismiss permanen — cukup snooze 24 jam. Dulu pakai flag
// boolean yang menempel selama localStorage hidup, dan session PWA di HP
// bisa bertahan berhari-hari (app cuma di-suspend, bukan dibunuh) →
// sekali tekan "Nanti"/X, prompt "ilang" dan gak pernah muncul lagi.
const SNOOZE_KEY = 'luxtrade_push_snoozed_until'
const SNOOZE_MS = 24 * 60 * 60 * 1000
/** Dipancarkan LuxTradeDashboard saat onboarding selesai/skip — momen tepat
  * menawarkan push notif, sekaligus memunculkan lagi banner yang ke-tutup
  * overlay onboarding (keluhan: "setelah skip onboarding notifnya ilang"). */
export const PUSH_PROMPT_RESET_EVENT = 'luxtrade:push-prompt-reset'

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
 * "Nanti" snoozes the prompt for 24h (max 1 session) so it always comes back —
 * and finishing/skipping onboarding re-shows it immediately.
 */
export default function PushNotificationSetup({ onShowIOSInstall }: PushNotificationSetupProps) {
  const { isPro, user } = useAuth()
  const userId = user?.id || ''
  const { isSubscribed, isSupported, subscribe, isLoading } = usePushSubscription(userId)
  const { language } = useLanguage()
  const lang = (language === 'id' ? 'id' : 'en') as LangKey
  const t = strings[lang]

  // Start Infinity (hidden) to avoid flash — nilai asal dibaca dari localStorage
  const [snoozedUntil, setSnoozedUntil] = useState<number>(Number.MAX_SAFE_INTEGER)
  const [visible, setVisible] = useState(false)
  const [isIOS, setIsIOS] = useState(false)
  const [isStandalone, setIsStandalone] = useState(false)

  // Detect iOS and standalone mode
  useEffect(() => {
    setIsIOS(isIOSSafari())
    setIsStandalone(isStandaloneMode())
  }, [])

  // Check snooze state on mount
  useEffect(() => {
    try {
      setSnoozedUntil(Number(localStorage.getItem(SNOOZE_KEY) || 0))
    } catch {
      setSnoozedUntil(0)
    }
  }, [])

  // Onboarding selesai/skip → hapus snooze → banner langsung evaluasi ulang
  useEffect(() => {
    const reset = () => {
      try { localStorage.removeItem(SNOOZE_KEY) } catch {}
      setSnoozedUntil(0)
    }
    window.addEventListener(PUSH_PROMPT_RESET_EVENT, reset)
    return () => window.removeEventListener(PUSH_PROMPT_RESET_EVENT, reset)
  }, [])

  // Show banner logic
  useEffect(() => {
    // If already subscribed, never show — notif udah aktif, tugas selesai
    if (isSubscribed) {
      setVisible(false)
      return
    }

    // Masih dalam masa snooze ("Nanti") → jangan ganggu
    if (Date.now() < snoozedUntil) {
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
  }, [isSupported, isSubscribed, snoozedUntil, userId, isIOS])

  const handleDismiss = () => {
    const until = Date.now() + SNOOZE_MS
    try { localStorage.setItem(SNOOZE_KEY, String(until)) } catch {}
    setSnoozedUntil(until)
    setVisible(false)
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

  // Session baru (app dibuka ulang) → hapus snooze aktif, kasih kesempatan lagi
  // (perilaku lama dipertahankan: "Nanti" maksimal hidup selama 1 session)
  useEffect(() => {
    if (!userId) return
    const sessionKey = `luxtrade_push_session_${userId}`
    if (!sessionStorage.getItem(sessionKey)) {
      sessionStorage.setItem(sessionKey, 'true')
      try {
        if (Number(localStorage.getItem(SNOOZE_KEY) || 0) > Date.now()) {
          localStorage.removeItem(SNOOZE_KEY)
          setSnoozedUntil(0)
        }
      } catch {}
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
