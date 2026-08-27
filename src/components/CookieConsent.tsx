'use client'

import { useSyncExternalStore, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Cookie } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useLanguage } from '@/contexts/LanguageContext'

const CONSENT_KEY = 'luxtrade_cookie_consent'

function subscribe(callback: () => void) {
  window.addEventListener('storage', callback)
  return () => window.removeEventListener('storage', callback)
}

function getSnapshot(): boolean {
  try {
    return !localStorage.getItem(CONSENT_KEY)
  } catch {
    return true
  }
}

function getServerSnapshot(): boolean {
  return false
}

export default function CookieConsent() {
  const { language } = useLanguage()
  const visible = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot)

  const dismiss = useCallback((value: string) => {
    try {
      localStorage.setItem(CONSENT_KEY, value)
      if (value === 'accepted') {
        document.cookie = 'luxtrade_consent=accepted; path=/; max-age=31536000'
      }
      window.dispatchEvent(new Event('storage'))
    } catch {}
  }, [])

  const text =
    language === 'id'
      ? 'Kami menggunakan cookie untuk menganalisis trafik dan meningkatkan pengalaman Anda. Dengan melanjutkan, Anda menyetujui penggunaan cookie kami.'
      : 'We use cookies to analyze traffic and improve your experience. By continuing, you agree to our cookie policy.'

  const acceptLabel = language === 'id' ? 'Terima Semua' : 'Accept All'
  const rejectLabel =
    language === 'id' ? 'Tolak Non-Esensial' : 'Reject Non-Essential'

  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          initial={{ opacity: 0, y: 40 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 40 }}
          transition={{ duration: 0.4, ease: 'easeOut' }}
          className="fixed bottom-6 left-1/2 z-50 w-full max-w-lg -translate-x-1/2 px-4"
        >
          <div className="rounded-2xl border border-blue-900/30 bg-[#080b12]/90 p-5 shadow-2xl backdrop-blur-md">
            <div className="mb-4 flex items-start gap-3">
              <Cookie className="mt-0.5 size-5 shrink-0 text-cyan-400" />
              <p className="text-sm leading-relaxed text-gray-300">{text}</p>
            </div>
            <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
              <Button
                variant="outline"
                size="sm"
                onClick={() => dismiss('rejected')}
                className="border-blue-800/50 text-gray-300 hover:bg-blue-900/30 hover:text-white"
              >
                {rejectLabel}
              </Button>
              <Button
                size="sm"
                onClick={() => dismiss('accepted')}
                className="bg-gradient-to-r from-blue-600 to-blue-500 text-white shadow-lg shadow-blue-500/20 hover:from-blue-500 hover:to-cyan-400"
              >
                {acceptLabel}
              </Button>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}