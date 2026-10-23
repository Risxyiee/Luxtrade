'use client'

import { useState, useEffect, useCallback } from 'react'
import { Bell, Check, X } from 'lucide-react'
import { Button } from '@/components/ui/button'

interface NotificationCenterProps {
  trades: any[]
  isPro: boolean
  notificationPreferences?: Partial<{
    tradeCloseAlert: boolean
    dailySummary: boolean
    priceAlerts: boolean
    profitTarget: number
    lossLimit: number
  }>
}

interface Notification {
  id: string
  type: 'trade' | 'alert' | 'info'
  title: string
  message: string
  time: Date
  read: boolean
}

export default function NotificationCenter({
  trades,
  isPro,
  notificationPreferences,
}: NotificationCenterProps) {
  const [notifications, setNotifications] = useState<Notification[]>([])
  const [isOpen, setIsOpen] = useState(false)
  const [unreadCount, setUnreadCount] = useState(0)

  // Generate trade-based notifications
  useEffect(() => {
    if (!trades || trades.length === 0) return

    const recentTrades = trades
      .filter((t: any) => t.close_time)
      .slice(0, 5)
      .map((t: any) => ({
        id: `trade-${t.id}`,
        type: 'trade' as const,
        title: `${t.symbol} Closed`,
        message: `${t.type} ${t.symbol} — P&L: ${t.profit_loss >= 0 ? '+' : ''}${Number(t.profit_loss).toFixed(2)}`,
        time: new Date(t.close_time),
        read: false,
      }))

    setNotifications(recentTrades)
    setUnreadCount(recentTrades.length)
  }, [trades])

  const markAllRead = useCallback(() => {
    setNotifications(prev => prev.map(n => ({ ...n, read: true })))
    setUnreadCount(0)
  }, [])

  const dismiss = useCallback((id: string) => {
    setNotifications(prev => prev.filter(n => n.id !== id))
    setUnreadCount(prev => Math.max(0, prev - 1))
  }, [])

  return (
    <div className="relative">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="relative p-2 text-lux-text-muted dark:text-gray-500 hover:text-lux-text-primary dark:hover:text-white transition-colors rounded-lg hover:bg-white/5"
        aria-label="Notifications"
      >
        <Bell className="w-4 h-4" />
        {unreadCount > 0 && (
          <span className="absolute -top-0.5 -right-0.5 w-4 h-4 rounded-full bg-red-500 text-[9px] text-white font-bold flex items-center justify-center">
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>

      {isOpen && (
        <div className="absolute right-0 top-full mt-2 w-80 rounded-xl border border-lux-border dark:border-blue-500/20 bg-lux-bg-card dark:bg-[#0a0c12] shadow-xl shadow-black/30 z-50 overflow-hidden">
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-lux-border dark:border-blue-500/10">
            <h3 className="text-sm font-semibold text-lux-text-primary dark:text-white">Notifications</h3>
            {unreadCount > 0 && (
              <button onClick={markAllRead} className="text-xs text-blue-400 hover:text-blue-300">
                Mark all read
              </button>
            )}
          </div>

          {/* List */}
          <div className="max-h-64 overflow-y-auto">
            {notifications.length === 0 ? (
              <div className="px-4 py-8 text-center text-sm text-lux-text-muted dark:text-gray-500">
                No notifications
              </div>
            ) : (
              notifications.map(n => (
                <div
                  key={n.id}
                  className={`flex items-start gap-3 px-4 py-3 border-b border-lux-border dark:border-blue-500/5 last:border-0 ${
                    !n.read ? 'bg-blue-500/5' : ''
                  }`}
                >
                  <div className={`w-2 h-2 mt-1.5 rounded-full flex-shrink-0 ${
                    n.type === 'trade' ? (n.message.includes('+') ? 'bg-emerald-400' : 'bg-red-400') : 'bg-blue-400'
                  }`} />
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-medium text-lux-text-primary dark:text-white truncate">{n.title}</p>
                    <p className="text-[11px] text-lux-text-muted dark:text-gray-400 truncate">{n.message}</p>
                  </div>
                  <button
                    onClick={() => dismiss(n.id)}
                    className="p-0.5 text-gray-600 hover:text-gray-400 transition-colors"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  )
}
