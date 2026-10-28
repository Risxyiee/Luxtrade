'use client'

import React from 'react'
import { Bell, BellOff, Loader2, Check, AlertCircle } from 'lucide-react'
import { usePushSubscription } from '@/hooks/usePushSubscription'
import { motion, AnimatePresence } from 'framer-motion'

interface PushNotificationPermissionProps {
  userId: string
  /** If true, render as a compact toggle (for settings page) */
  compact?: boolean
}

export default function PushNotificationPermission({ userId, compact = false }: PushNotificationPermissionProps) {
  const { isSupported, permission, isSubscribed, isLoading, error, subscribe, unsubscribe } = usePushSubscription()

  if (!isSupported) return null

  // Compact toggle for settings pages
  if (compact) {
    return (
      <div className="flex items-center justify-between gap-3 p-3 rounded-xl bg-white/5 border border-white/10">
        <div className="flex items-center gap-2.5">
          {isSubscribed ? (
            <Bell className="w-4 h-4 text-emerald-400" />
          ) : (
            <BellOff className="w-4 h-4 text-white/40" />
          )}
          <div>
            <p className="text-sm font-medium text-white">Push Notifications</p>
            <p className="text-xs text-white/40">
              {isSubscribed ? 'Aktif — notif masuk ke HP' : 'Nonaktif'}
            </p>
          </div>
        </div>
        <button
          onClick={() => isSubscribed ? unsubscribe() : subscribe(userId)}
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
      </div>
    )
  }

  // Full card for initial setup
  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: 20 }}
        className="bg-white/5 border border-white/10 rounded-2xl p-5"
      >
        <div className="flex items-start gap-4">
          <div className={`flex-shrink-0 w-10 h-10 rounded-xl flex items-center justify-center ${
            isSubscribed ? 'bg-emerald-500/20' : 'bg-white/10'
          }`}>
            {isSubscribed ? (
              <Check className="w-5 h-5 text-emerald-400" />
            ) : (
              <Bell className="w-5 h-5 text-white/60" />
            )}
          </div>

          <div className="flex-1 min-w-0">
            <h3 className="text-sm font-bold text-white mb-1">
              Notifikasi Push ke HP
            </h3>
            <p className="text-xs text-white/40 leading-relaxed mb-3">
              {isSubscribed
                ? 'Notifikasi bakal muncul di HP kamu walau app ditutup — kayak notif WhatsApp.'
                : permission === 'denied'
                  ? 'Izin notifikasi ditolak. Buka pengaturan browser → izinkan notifikasi untuk LuxTradee.'
                  : 'Aktifkan biar notif trade, price alert, & news langsung masuk ke HP kamu.'
              }
            </p>

            {error && (
              <div className="flex items-center gap-1.5 mb-2 text-xs text-red-400">
                <AlertCircle className="w-3 h-3" />
                {error}
              </div>
            )}

            {!isSubscribed && permission !== 'denied' && (
              <button
                onClick={() => subscribe(userId)}
                disabled={isLoading}
                className="flex items-center gap-2 px-4 py-2 rounded-xl bg-emerald-500 text-sm font-bold text-white hover:bg-emerald-400 active:scale-[0.97] transition-all disabled:opacity-50 disabled:pointer-events-none"
              >
                {isLoading ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Bell className="w-4 h-4" />
                )}
                Aktifkan Notifikasi
              </button>
            )}

            {isSubscribed && (
              <button
                onClick={() => unsubscribe()}
                disabled={isLoading}
                className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-white/5 text-xs text-white/50 hover:text-white/80 hover:bg-white/10 transition-all disabled:opacity-50"
              >
                {isLoading ? (
                  <Loader2 className="w-3 h-3 animate-spin" />
                ) : (
                  <BellOff className="w-3 h-3" />
                )}
                Matikan Notifikasi
              </button>
            )}
          </div>
        </div>
      </motion.div>
    </AnimatePresence>
  )
}
