'use client'

import { useState, useEffect } from 'react'
import { Bell, Crown, X, Loader2 } from 'lucide-react'
import { useAuth } from '@/lib/auth-context'
import { usePushSubscription } from '@/hooks/usePushSubscription'
import { motion, AnimatePresence } from 'framer-motion'

const DISMISSED_KEY = 'luxtrade_push_prompt_dismissed'

/**
 * Smart component that auto-checks user status and shows appropriate prompt:
 * - Pro + not enabled → one-time prompt to enable push notifications
 * - Pro + enabled → silent (nothing shown)
 * - Free user → upgrade prompt suggesting Pro for notifications
 * Saves dismissed state to localStorage so it doesn't show again until next login.
 */
export default function PushNotificationSetup() {
  const { isPro, user } = useAuth()
  const { isSubscribed, isSupported, subscribe, isLoading } = usePushSubscription()
  const [dismissed, setDismissed] = useState(true) // Start dismissed to avoid flash
  const [visible, setVisible] = useState(false)

  const userId = user?.id || ''

  // Check dismissal state on mount
  useEffect(() => {
    const wasDismissed = localStorage.getItem(DISMISSED_KEY)
    setDismissed(wasDismissed === 'true')
  }, [])

  // Show banner logic
  useEffect(() => {
    if (!isSupported) {
      setVisible(false)
      return
    }

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

    // Show for pro (enable prompt) or free (upgrade prompt)
    setVisible(true)
  }, [isSupported, isSubscribed, dismissed, userId, isPro])

  const handleDismiss = () => {
    setDismissed(true)
    setVisible(false)
    localStorage.setItem(DISMISSED_KEY, 'true')
  }

  const handleEnable = async () => {
    if (!userId) return
    const success = await subscribe(userId)
    if (success) {
      setVisible(false)
    }
  }

  // Clear dismissed on login so prompt shows again next session
  useEffect(() => {
    if (userId) {
      // On mount with user, clear dismissed if it's a new session
      const sessionKey = `luxtrade_push_session_${userId}`
      const seenSession = sessionStorage.getItem(sessionKey)
      if (!seenSession) {
        // New session - clear dismissed so prompt can show again
        localStorage.removeItem(DISMISSED_KEY)
        setDismissed(false)
        sessionStorage.setItem(sessionKey, 'true')
      }
    }
  }, [userId])

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
          <div className="mx-2 sm:mx-4 lg:mx-6 mb-4 mt-2 relative flex items-center gap-3 px-4 py-3 rounded-xl border backdrop-blur-sm">
            {isPro ? (
              // Pro user prompt — enable notifications
              <>
                <div className="flex-shrink-0 w-8 h-8 rounded-lg bg-emerald-500/20 flex items-center justify-center">
                  <Bell className="w-4 h-4 text-emerald-400" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-white">
                    Aktifkan notifikasi push?
                  </p>
                  <p className="text-xs text-white/50">
                    Notif trade, price alert, & berita bakal langsung masuk ke HP kamu.
                  </p>
                </div>
                <div className="flex items-center gap-2 flex-shrink-0">
                  <button
                    onClick={handleEnable}
                    disabled={isLoading}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-500 text-xs font-bold text-white hover:bg-emerald-400 active:scale-[0.97] transition-all disabled:opacity-50 disabled:pointer-events-none"
                  >
                    {isLoading ? (
                      <Loader2 className="w-3 h-3 animate-spin" />
                    ) : (
                      <Bell className="w-3 h-3" />
                    )}
                    Aktifkan
                  </button>
                  <button
                    onClick={handleDismiss}
                    className="px-3 py-1.5 rounded-lg bg-white/5 text-xs text-white/50 hover:text-white/80 hover:bg-white/10 transition-all"
                  >
                    Nanti
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
                  <p className="text-sm font-medium text-white">
                    Notifikasi push cuma buat Pro
                  </p>
                  <p className="text-xs text-white/50">
                    Upgrade ke Pro biar notif trade & price alert masuk langsung ke HP.
                  </p>
                </div>
                <div className="flex items-center gap-2 flex-shrink-0">
                  <a
                    href="/upgrade"
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-amber-500 text-xs font-bold text-white hover:bg-amber-400 active:scale-[0.97] transition-all"
                  >
                    <Crown className="w-3 h-3" />
                    Upgrade
                  </a>
                  <button
                    onClick={handleDismiss}
                    className="px-3 py-1.5 rounded-lg bg-white/5 text-xs text-white/50 hover:text-white/80 hover:bg-white/10 transition-all"
                  >
                    Nanti
                  </button>
                </div>
              </>
            )}

            {/* Close button */}
            <button
              onClick={handleDismiss}
              className="absolute top-2 right-2 p-0.5 rounded-md text-white/20 hover:text-white/60 transition-colors"
              aria-label="Tutup"
            >
              <X className="w-3 h-3" />
            </button>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
