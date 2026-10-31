'use client'

import { useState, useEffect, useCallback } from 'react'
import { Bell, BellOff, Loader2, AlertCircle, Smartphone, Mail, Send, CheckCircle2, AlertTriangle } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import { useAuth } from '@/lib/auth-context'
import { usePushSubscription } from '@/hooks/usePushSubscription'
import { useLanguage } from '@/contexts/LanguageContext'
import { isIOSSafari, isStandaloneMode } from '@/components/PWAInstallPrompt'

// ─── i18n strings ──────────────────────────────────────────────────────────────
const strings = {
  id: {
    enableBtn: 'Aktifkan Notifikasi',
    enablingBtn: 'Mengaktifkan...',
    disableBtn: 'Matikan',
    disablingBtn: 'Mematikan...',
    subscribed: 'Aktif — notif masuk ke HP',
    notSubscribed: 'Nonaktif',
    denied: 'Izin ditolak. Buka Settings → Notifications → LuxTradee',
    iosSafariWarning: 'Di iPhone, notifikasi push cuma jalan kalau app di-install ke Home Screen.',
    iosInstallBtn: 'Cara Install',
    emailNote: 'Email alert aktif sebagai fallback di iPhone',
    pushLabel: 'Push Notifications',
    iosBannerTitle: 'Aktifkan Push di iPhone',
    iosBannerDesc: 'Install LuxTradee ke Home Screen biar push notification bisa jalan.',
    iosBannerAction: 'Lihat Cara Install',
    permissionError: 'Gagal meminta izin notifikasi',
    testBtn: 'Kirim Notifikasi Tes',
    testingBtn: 'Mengirim...',
    testOk: 'Terkirim! Cek HP kamu 📲',
    testEmpty: 'Belum ada perangkat terdaftar — nyalakan dulu',
    testFail: 'Gagal terkirim — coba lagi',
  },
  en: {
    enableBtn: 'Enable Notifications',
    enablingBtn: 'Enabling...',
    disableBtn: 'Disable',
    disablingBtn: 'Disabling...',
    subscribed: 'Active — notifications on your phone',
    notSubscribed: 'Inactive',
    denied: 'Permission denied. Go to Settings → Notifications → LuxTradee',
    iosSafariWarning: 'On iPhone, push notifications only work when the app is installed to Home Screen.',
    iosInstallBtn: 'How to Install',
    emailNote: 'Email alerts active as fallback on iPhone',
    pushLabel: 'Push Notifications',
    iosBannerTitle: 'Enable Push on iPhone',
    iosBannerDesc: 'Install LuxTradee to Home Screen so push notifications can work.',
    iosBannerAction: 'See How to Install',
    permissionError: 'Failed to request notification permission',
    testBtn: 'Send Test Notification',
    testingBtn: 'Sending...',
    testOk: 'Sent! Check your phone 📲',
    testEmpty: 'No device registered — enable first',
    testFail: 'Send failed — try again',
  },
} as const

type LangKey = keyof typeof strings

interface NotificationSetupProps {
  /** Render as compact toggle for settings/sidebar */
  compact?: boolean
  /** Called when user wants to see iOS install instructions */
  onShowIOSInstall?: () => void
}

/**
 * Smart notification setup component that:
 * - Detects iOS Safari and shows appropriate guidance
 * - Only requests push permission when in PWA/standalone mode (or non-iOS)
 * - Shows email fallback note on iOS
 * - Works as compact toggle or full setup card
 */
export default function NotificationSetup({ compact = false, onShowIOSInstall }: NotificationSetupProps) {
  const { language } = useLanguage()
  const lang = (language === 'id' ? 'id' : 'en') as LangKey
  const t = strings[lang]

  const { user, isPro } = useAuth()
  const userId = user?.id || ''
  const { isSupported, permission, isSubscribed, isLoading, error, subscribe, unsubscribe } = usePushSubscription()

  const [isIOS, setIsIOS] = useState(false)
  const [isStandalone, setIsStandalone] = useState(false)
  const [showIOSBanner, setShowIOSBanner] = useState(false)
  const [testState, setTestState] = useState<'idle' | 'sending' | 'ok' | 'empty' | 'fail'>('idle')

  useEffect(() => {
    setIsIOS(isIOSSafari())
    setIsStandalone(isStandaloneMode())
  }, [])

  /**
   * Core logic: When user clicks "Enable Notifications":
   * 1. If on iOS Safari (not standalone) → show iOS install banner
   * 2. If on iOS but in standalone mode → proceed normally (iOS 16.4+ supports push in PWA)
   * 3. If on Android/desktop → proceed normally
   */
  const handleEnable = useCallback(async () => {
    if (!userId) return

    // iOS Safari check — must be in standalone mode for push to work
    if (isIOS && !isStandalone) {
      setShowIOSBanner(true)
      onShowIOSInstall?.()
      return
    }

    // Normal flow: request permission & subscribe
    await subscribe(userId, isPro)
  }, [userId, isIOS, isStandalone, subscribe, isPro, onShowIOSInstall])

  const handleDisable = useCallback(async () => {
    await unsubscribe()
  }, [unsubscribe])

  /** FASE 5A: kirim push TES ke diri sendiri — bukti notif beneran sampai HP */
  const handleSendTest = useCallback(async () => {
    setTestState('sending')
    try {
      const res = await fetch('/api/push/test', { method: 'POST' })
      if (!res.ok) {
        setTestState('fail')
        return
      }
      const data = await res.json()
      setTestState(data.sent > 0 ? 'ok' : 'empty')
    } catch {
      setTestState('fail')
    }
  }, [])

  // Whether push can actually work on this device
  const pushCanWork = isSupported && (!isIOS || isStandalone)

  // ─── Compact toggle (for sidebar settings) ──────────────────────────────────
  if (compact) {
    return (
      <div className="space-y-2">
        <div className="flex items-center justify-between gap-3 p-3 rounded-xl bg-white/5 border border-white/10">
          <div className="flex items-center gap-2.5">
            {isSubscribed ? (
              <Bell className="w-4 h-4 text-emerald-400" />
            ) : (
              <BellOff className="w-4 h-4 text-white/40" />
            )}
            <div>
              <p className="text-sm font-medium text-white">{t.pushLabel}</p>
              <p className="text-xs text-white/40">
                {isSubscribed
                  ? t.subscribed
                  : permission === 'denied'
                    ? t.denied
                    : t.notSubscribed}
              </p>
            </div>
          </div>

          {pushCanWork ? (
            <button
              onClick={() => isSubscribed ? handleDisable() : handleEnable()}
              disabled={isLoading}
              className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                isSubscribed ? 'bg-emerald-500' : 'bg-white/20'
              } ${isLoading ? 'opacity-50' : ''}`}
            >
              {isLoading ? (
                <Loader2 className="w-3 h-3 text-white absolute left-1/2 -translate-x-1/2 animate-spin" />
              ) : (
                <span
                  className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                    isSubscribed ? 'translate-x-6' : 'translate-x-1'
                  }`}
                />
              )}
            </button>
          ) : (
            // iOS Safari — push not available in browser
            <button
              onClick={() => { setShowIOSBanner(true); onShowIOSInstall?.() }}
              className="px-2 py-1 rounded-lg bg-amber-500/15 text-[10px] text-amber-400 hover:bg-amber-500/25 transition-colors"
            >
              <Smartphone className="w-3 h-3 inline mr-1" />
              {t.iosInstallBtn}
            </button>
          )}
        </div>

        {/* iOS email fallback note */}
        {isIOS && !isStandalone && (
          <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-500/5 border border-emerald-500/10">
            <Mail className="w-3 h-3 text-emerald-400/60" />
            <p className="text-[10px] text-emerald-400/60">{t.emailNote}</p>
          </div>
        )}

        {/* FASE 5A: tes notifikasi (hanya saat sudah berlangganan) */}
        {isSubscribed && (
          <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-white/5 border border-white/10">
            <button
              onClick={handleSendTest}
              disabled={testState === 'sending'}
              className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-emerald-500/15 text-[11px] font-semibold text-emerald-400 hover:bg-emerald-500/25 active:scale-[0.97] transition-all disabled:opacity-50 disabled:pointer-events-none"
            >
              {testState === 'sending' ? (
                <Loader2 className="w-3 h-3 animate-spin" />
              ) : (
                <Send className="w-3 h-3" />
              )}
              {testState === 'sending' ? t.testingBtn : t.testBtn}
            </button>
            {testState === 'ok' && (
              <span className="flex items-center gap-1 text-[10px] text-emerald-400"><CheckCircle2 className="w-3 h-3" />{t.testOk}</span>
            )}
            {testState === 'empty' && (
              <span className="flex items-center gap-1 text-[10px] text-amber-400"><AlertTriangle className="w-3 h-3" />{t.testEmpty}</span>
            )}
            {testState === 'fail' && (
              <span className="flex items-center gap-1 text-[10px] text-red-400"><AlertCircle className="w-3 h-3" />{t.testFail}</span>
            )}
          </div>
        )}

        {/* Error display */}
        {error && (
          <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-red-500/5">
            <AlertCircle className="w-3 h-3 text-red-400" />
            <p className="text-[10px] text-red-400">{error}</p>
          </div>
        )}
      </div>
    )
  }

  // ─── Full card layout ───────────────────────────────────────────────────────
  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: 20 }}
        className="bg-white/5 border border-white/10 rounded-2xl p-5"
      >
        <div className="flex items-start gap-4">
          {/* Icon */}
          <div className={`flex-shrink-0 w-10 h-10 rounded-xl flex items-center justify-center ${
            isSubscribed ? 'bg-emerald-500/20' : 'bg-white/10'
          }`}>
            {isSubscribed ? (
              <Bell className="w-5 h-5 text-emerald-400" />
            ) : (
              <BellOff className="w-5 h-5 text-white/60" />
            )}
          </div>

          <div className="flex-1 min-w-0">
            <h3 className="text-sm font-bold text-white mb-1">{t.pushLabel}</h3>

            {/* iOS Safari warning */}
            {isIOS && !isStandalone && (
              <div className="mb-3 p-2.5 rounded-lg bg-amber-500/8 border border-amber-500/15">
                <div className="flex items-center gap-1.5 mb-1">
                  <Smartphone className="w-3.5 h-3.5 text-amber-400" />
                  <p className="text-xs font-medium text-amber-400">{t.iosBannerTitle}</p>
                </div>
                <p className="text-[11px] text-white/50 leading-relaxed mb-2">{t.iosBannerDesc}</p>
                <button
                  onClick={() => { setShowIOSBanner(true); onShowIOSInstall?.() }}
                  className="text-[11px] font-medium text-amber-400 hover:text-amber-300 transition-colors"
                >
                  {t.iosBannerAction} →
                </button>
              </div>
            )}

            {/* Status text */}
            <p className="text-xs text-white/40 leading-relaxed mb-3">
              {isSubscribed
                ? t.subscribed
                : permission === 'denied'
                  ? t.denied
                  : isIOS && !isStandalone
                    ? t.iosSafariWarning
                    : 'Aktifkan biar notif trade, price alert, & news langsung masuk ke HP kamu.'
              }
            </p>

            {/* Error display */}
            {error && (
              <div className="flex items-center gap-1.5 mb-2 text-xs text-red-400">
                <AlertCircle className="w-3 h-3" />
                {error}
              </div>
            )}

            {/* Email fallback note on iOS */}
            {isIOS && !isStandalone && (
              <div className="flex items-center gap-1.5 mb-3 text-xs text-emerald-400/60">
                <Mail className="w-3 h-3" />
                {t.emailNote}
              </div>
            )}

            {/* Action buttons */}
            {!isSubscribed && pushCanWork && permission !== 'denied' && (
              <button
                onClick={handleEnable}
                disabled={isLoading}
                className="flex items-center gap-2 px-4 py-2 rounded-xl bg-emerald-500 text-sm font-bold text-white hover:bg-emerald-400 active:scale-[0.97] transition-all disabled:opacity-50 disabled:pointer-events-none"
              >
                {isLoading ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Bell className="w-4 h-4" />
                )}
                {isLoading ? t.enablingBtn : t.enableBtn}
              </button>
            )}

            {isSubscribed && (
              <div className="flex flex-wrap items-center gap-2">
                <button
                  onClick={handleDisable}
                  disabled={isLoading}
                  className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-white/5 text-xs text-white/50 hover:text-white/80 hover:bg-white/10 transition-all disabled:opacity-50"
                >
                  {isLoading ? (
                    <Loader2 className="w-3 h-3 animate-spin" />
                  ) : (
                    <BellOff className="w-3 h-3" />
                  )}
                  {isLoading ? t.disablingBtn : t.disableBtn}
                </button>
                <button
                  onClick={handleSendTest}
                  disabled={testState === 'sending'}
                  className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-emerald-500/15 text-xs font-semibold text-emerald-400 hover:bg-emerald-500/25 active:scale-[0.97] transition-all disabled:opacity-50 disabled:pointer-events-none"
                >
                  {testState === 'sending' ? (
                    <Loader2 className="w-3 h-3 animate-spin" />
                  ) : (
                    <Send className="w-3 h-3" />
                  )}
                  {testState === 'sending' ? t.testingBtn : t.testBtn}
                </button>
              </div>
            )}

            {/* FASE 5A: feedback tes notifikasi */}
            {isSubscribed && testState === 'ok' && (
              <p className="mt-2 flex items-center gap-1.5 text-xs text-emerald-400"><CheckCircle2 className="w-3.5 h-3.5" />{t.testOk}</p>
            )}
            {isSubscribed && testState === 'empty' && (
              <p className="mt-2 flex items-center gap-1.5 text-xs text-amber-400"><AlertTriangle className="w-3.5 h-3.5" />{t.testEmpty}</p>
            )}
            {isSubscribed && testState === 'fail' && (
              <p className="mt-2 flex items-center gap-1.5 text-xs text-red-400"><AlertCircle className="w-3.5 h-3.5" />{t.testFail}</p>
            )}
          </div>
        </div>
      </motion.div>
    </AnimatePresence>
  )
}
