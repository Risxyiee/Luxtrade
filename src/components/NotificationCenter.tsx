'use client'

/**
 * NotificationCenter — PUSAT NOTIFIKASI in-app (Bell di dashboard).
 *
 * Sumber data = /api/notifications/feed → tabel notification_log
 * (diisi otomatis oleh push-notify.ts untuk SEMUA alert otomatis:
 * 🚨 guard prop firm, 📈 sinyal Pine, 🎯 price alert,
 * 💥 big win/loss/streak/daily-limit, 🌅 reminder harian, 📊 rekap
 * mingguan). Desktop & user tanpa push tetap kebagian riwayat.
 *
 * Dulu: stub client-side yang mengarang notifikasi dari 5 trade
 * terakhir (unread palsu). Sekarang feed server sungguhan + unread
 * badge + tandai dibaca + navigasi ke tujuan alert.
 */

import { useState, useEffect, useCallback, useRef } from 'react'
import { Bell, CheckCheck, Loader2 } from 'lucide-react'
import { useRouter } from 'next/navigation'

interface NotificationItem {
  id: string
  title: string
  body: string | null
  type: string | null // 'trade' | 'price-alert' | 'news' | 'general'
  url: string | null
  read: boolean
  created_at: string
}

interface NotificationCenterProps {
  /* Kompatibel dengan pemanggilan lama di Header — tidak dipakai lagi */
  trades?: unknown[]
  isPro?: boolean
  notificationPreferences?: unknown
  language?: 'id' | 'en'
}

const TYPE_ICON: Record<string, string> = {
  trade: '💼',
  'price-alert': '🎯',
  news: '📰',
  general: '🔔',
}

function timeAgo(iso: string, lang: 'id' | 'en'): string {
  const diff = Date.now() - new Date(iso).getTime()
  if (Number.isNaN(diff)) return ''
  const m = Math.floor(diff / 60_000)
  const suffix = lang === 'id' ? 'lalu' : 'ago'
  if (m < 1) return lang === 'id' ? 'baru saja' : 'just now'
  if (m < 60) return `${m}m ${suffix}`
  const h = Math.floor(m / 60)
  if (h < 24) return `${h}h ${suffix}`
  return `${Math.floor(h / 24)}h ${suffix}`
}

export default function NotificationCenter({
  language = 'id',
}: NotificationCenterProps) {
  const router = useRouter()
  const [items, setItems] = useState<NotificationItem[]>([])
  const [unread, setUnread] = useState(0)
  const [isOpen, setIsOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)

  const fetchFeed = useCallback(async () => {
    try {
      const res = await fetch('/api/notifications/feed', { cache: 'no-store' })
      if (!res.ok) return
      const json = await res.json()
      setItems(Array.isArray(json.items) ? json.items : [])
      setUnread(typeof json.unread === 'number' ? json.unread : 0)
    } catch {
      // offline / gagal — diam, jangan ganggu UI
    }
  }, [])

  // Ambil feed saat mount + polling 60 detik (hanya saat tab TERLIHAT) +
  // refresh saat tab fokus kembali. PERF: hemat request saat app di background.
  useEffect(() => {
    fetchFeed()
    const interval = setInterval(() => {
      if (typeof document !== 'undefined' && document.visibilityState !== 'visible') return
      fetchFeed()
    }, 60_000)
    const onFocus = () => fetchFeed()
    const onVisibility = () => {
      if (typeof document !== 'undefined' && document.visibilityState === 'visible') fetchFeed()
    }
    window.addEventListener('focus', onFocus)
    document.addEventListener('visibilitychange', onVisibility)
    return () => {
      clearInterval(interval)
      window.removeEventListener('focus', onFocus)
      document.removeEventListener('visibilitychange', onVisibility)
    }
  }, [fetchFeed])

  // Klik di luar → tutup dropdown
  useEffect(() => {
    if (!isOpen) return
    const onDown = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false)
      }
    }
    document.addEventListener('mousedown', onDown)
    return () => document.removeEventListener('mousedown', onDown)
  }, [isOpen])

  const openPanel = useCallback(() => {
    setIsOpen((v) => {
      const next = !v
      if (next) fetchFeed()
      return next
    })
  }, [fetchFeed])

  const markAllRead = useCallback(async () => {
    setItems((prev) => prev.map((n) => ({ ...n, read: true })))
    setUnread(0)
    try {
      await fetch('/api/notifications/feed', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'read-all' }),
      })
    } catch {
      // best-effort — badge lokal sudah dibersihkan
    }
  }, [])

  const onItemClick = useCallback(
    async (item: NotificationItem) => {
      if (!item.read) {
        setItems((prev) => prev.map((n) => (n.id === item.id ? { ...n, read: true } : n)))
        setUnread((u) => Math.max(0, u - 1))
        try {
          await fetch('/api/notifications/feed', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ id: item.id }),
          })
        } catch {
          // best-effort
        }
      }
      if (item.url) {
        setIsOpen(false)
        router.push(item.url)
      }
    },
    [router]
  )

  const T = {
    id: {
      title: 'Notifikasi',
      markAll: 'Tandai semua dibaca',
      empty: 'Belum ada notifikasi',
      emptyHint: 'Alert otomatis (prop firm, sinyal, price alert, big win/loss) akan muncul di sini + di HP-mu.',
    },
    en: {
      title: 'Notifications',
      markAll: 'Mark all read',
      empty: 'No notifications yet',
      emptyHint: 'Automatic alerts (prop firm, signals, price alerts, big win/loss) will appear here + on your phone.',
    },
  }[language]

  return (
    <div className="relative" ref={containerRef}>
      <button
        onClick={openPanel}
        className="relative p-2 text-lux-text-muted dark:text-gray-500 hover:text-lux-text-primary dark:hover:text-white transition-colors rounded-lg hover:bg-white/5"
        aria-label={T.title}
      >
        <Bell className="w-4 h-4" />
        {unread > 0 && (
          <span className="absolute -top-0.5 -right-0.5 min-w-4 h-4 px-0.5 rounded-full bg-red-500 text-[9px] text-white font-bold flex items-center justify-center">
            {unread > 9 ? '9+' : unread}
          </span>
        )}
      </button>

      {isOpen && (
        <div
          className="absolute right-0 mt-2 w-80 sm:w-96 max-w-[calc(100vw-2rem)] rounded-xl border border-white/10 bg-[#0a0c14] shadow-2xl shadow-black/50 z-50 overflow-hidden"
          role="dialog"
          aria-label={T.title}
        >
          {/* Header panel */}
          <div className="flex items-center justify-between px-3 py-2.5 border-b border-white/10">
            <span className="text-xs font-semibold text-white/80">{T.title}</span>
            {unread > 0 && (
              <button
                onClick={markAllRead}
                className="flex items-center gap-1 text-[10px] font-semibold text-emerald-400 hover:text-emerald-300 transition-colors"
              >
                <CheckCheck className="w-3 h-3" />
                {T.markAll}
              </button>
            )}
          </div>

          {/* Feed list */}
          <div
            className="max-h-96 overflow-y-auto notif-scroll"
            style={{ scrollbarWidth: 'thin' }}
          >
            {loading && items.length === 0 ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="w-4 h-4 animate-spin text-white/30" />
              </div>
            ) : items.length === 0 ? (
              <div className="px-4 py-8 text-center">
                <Bell className="w-6 h-6 text-white/15 mx-auto mb-2" />
                <p className="text-xs font-semibold text-white/60">{T.empty}</p>
                <p className="text-[10px] text-white/35 mt-1 leading-relaxed">{T.emptyHint}</p>
              </div>
            ) : (
              <ul className="divide-y divide-white/5">
                {items.map((n) => (
                  <li key={n.id}>
                    <button
                      onClick={() => onItemClick(n)}
                      className={`w-full text-left px-3 py-2.5 flex gap-2.5 hover:bg-white/5 transition-colors ${
                        n.read ? '' : 'bg-emerald-500/[0.06]'
                      }`}
                    >
                      <span className="text-base leading-none mt-0.5 shrink-0">
                        {TYPE_ICON[n.type ?? ''] ?? '🔔'}
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="flex items-center gap-1.5">
                          {!n.read && (
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 shrink-0" />
                          )}
                          <span
                            className={`text-[11px] font-semibold truncate ${
                              n.read ? 'text-white/55' : 'text-white/90'
                            }`}
                          >
                            {n.title}
                          </span>
                        </span>
                        {n.body && (
                          <span className="block text-[10px] text-white/45 mt-0.5 line-clamp-2 leading-relaxed">
                            {n.body}
                          </span>
                        )}
                        <span className="block text-[9px] text-white/30 mt-1">
                          {timeAgo(n.created_at, language)}
                        </span>
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
