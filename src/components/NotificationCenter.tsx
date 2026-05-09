'use client'

import { useState, useRef, useEffect, useMemo } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Bell, Check, CheckCheck, Trash2, Settings, TrendingUp, AlertTriangle, Gift, Crown, Wallet } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'

interface Notification {
  id: string
  type: 'success' | 'warning' | 'info' | 'achievement' | 'pro' | 'payout'
  title: string
  message: string
  timestamp: Date
  read: boolean
}

interface NotificationCenterProps {
  trades?: { id: string; symbol: string; profit_loss: number; created_at?: string }[]
  isPro?: boolean
  demoMode?: boolean
}

export default function NotificationCenter({ trades = [], isPro = false, demoMode = false }: NotificationCenterProps) {
  const [isOpen, setIsOpen] = useState(false)
  const panelRef = useRef<HTMLDivElement>(null)

  // Generate smart notifications from trade data
  const initialNotifications = useMemo(() => {
    const generated: Notification[] = []

    if (trades.length > 0) {
      const latestTrades = trades.slice(0, 5)
      latestTrades.forEach((trade, i) => {
        const time = trade.created_at ? new Date(trade.created_at) : new Date(Date.now() - i * 3600000)
        
        if (trade.profit_loss >= 500) {
          generated.push({
            id: `big-win-${trade.id}`,
            type: 'achievement',
            title: 'Big Win! 🎉',
            message: `${trade.symbol} closed with +$${trade.profit_loss} profit`,
            timestamp: time,
            read: i > 0,
          })
        } else if (trade.profit_loss >= 0) {
          generated.push({
            id: `win-${trade.id}`,
            type: 'success',
            title: 'Trade Profit',
            message: `${trade.symbol} +$${trade.profit_loss}`,
            timestamp: time,
            read: i > 0,
          })
        } else {
          generated.push({
            id: `loss-${trade.id}`,
            type: 'warning',
            title: 'Trade Loss',
            message: `${trade.symbol} ${trade.profit_loss}`,
            timestamp: time,
            read: i > 0,
          })
        }
      })

      // Win rate notification
      const wins = trades.filter(t => t.profit_loss >= 0).length
      const winRate = Math.round((wins / trades.length) * 100)
      if (winRate >= 70 && trades.length >= 5) {
        generated.push({
          id: 'winrate',
          type: 'achievement',
          title: 'Win Rate Excellent! 🔥',
          message: `Your win rate is ${winRate}% across ${trades.length} trades`,
          timestamp: new Date(Date.now() - 7200000),
          read: true,
        })
      }

      // Consecutive wins
      let streak = 0
      for (const trade of trades) {
        if (trade.profit_loss >= 0) streak++
        else break
      }
      if (streak >= 3) {
        generated.push({
          id: 'streak',
          type: 'achievement',
          title: `${streak}-Win Streak! 🔥`,
          message: 'You are on a hot streak. Keep it up!',
          timestamp: new Date(Date.now() - 1800000),
          read: false,
        })
      }
    }

    // System notifications
    if (!isPro && !demoMode) {
      generated.push({
        id: 'upgrade',
        type: 'pro',
        title: 'Upgrade to PRO',
        message: 'Unlock unlimited trades, analytics, AI insights & more',
        timestamp: new Date(Date.now() - 86400000),
        read: true,
      })
    }

    if (demoMode) {
      generated.unshift({
        id: 'welcome-demo',
        type: 'info',
        title: 'Welcome to LuxTrade Demo',
        message: 'Explore all features. Upgrade to start real trading journaling.',
        timestamp: new Date(Date.now() - 600000),
        read: false,
      })
    }

    generated.push({
      id: 'tips',
      type: 'info',
      title: 'Trading Tip 💡',
      message: 'Always set a stop-loss before entering any trade to protect your capital.',
      timestamp: new Date(Date.now() - 172800000),
      read: true,
    })

    return generated
  }, [trades, isPro, demoMode])

  const [notifications, setNotifications] = useState<Notification[]>(initialNotifications)
  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
        setIsOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [])

  const unreadCount = notifications.filter(n => !n.read).length

  const markAsRead = (id: string) => {
    setNotifications(prev => prev.map(n => n.id === id ? { ...n, read: true } : n))
  }

  const markAllRead = () => {
    setNotifications(prev => prev.map(n => ({ ...n, read: true })))
  }

  const deleteNotification = (id: string) => {
    setNotifications(prev => prev.filter(n => n.id !== id))
  }

  const getIcon = (type: Notification['type']) => {
    switch (type) {
      case 'success': return <TrendingUp className="w-4 h-4 text-emerald-400" />
      case 'warning': return <AlertTriangle className="w-4 h-4 text-amber-400" />
      case 'achievement': return <Gift className="w-4 h-4 text-purple-400" />
      case 'pro': return <Crown className="w-4 h-4 text-amber-400" />
      case 'payout': return <Wallet className="w-4 h-4 text-emerald-400" />
      default: return <Bell className="w-4 h-4 text-blue-400" />
    }
  }

  const getBgColor = (type: Notification['type'], read: boolean) => {
    if (read) return 'bg-transparent hover:bg-white/[0.02]'
    switch (type) {
      case 'success': return 'bg-emerald-500/5 hover:bg-emerald-500/10'
      case 'warning': return 'bg-amber-500/5 hover:bg-amber-500/10'
      case 'achievement': return 'bg-purple-500/5 hover:bg-purple-500/10'
      case 'pro': return 'bg-amber-500/5 hover:bg-amber-500/10'
      default: return 'bg-blue-500/5 hover:bg-blue-500/10'
    }
  }

  const formatTime = (date: Date) => {
    const now = new Date()
    const diff = now.getTime() - date.getTime()
    const minutes = Math.floor(diff / 60000)
    const hours = Math.floor(diff / 3600000)
    const days = Math.floor(diff / 86400000)

    if (minutes < 1) return 'Just now'
    if (minutes < 60) return `${minutes}m ago`
    if (hours < 24) return `${hours}h ago`
    return `${days}d ago`
  }

  return (
    <div className="relative" ref={panelRef}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="relative p-2 text-gray-400 hover:text-white transition-colors rounded-lg hover:bg-white/5"
        title="Notifications"
      >
        <Bell className="w-5 h-5" />
        {unreadCount > 0 && (
          <motion.span
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            className="absolute -top-0.5 -right-0.5 w-5 h-5 bg-gradient-to-r from-purple-500 to-pink-500 rounded-full text-[10px] font-bold flex items-center justify-center text-white border-2 border-[#0f0b18]"
          >
            {unreadCount > 9 ? '9+' : unreadCount}
          </motion.span>
        )}
      </button>

      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: -10, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -10, scale: 0.95 }}
            transition={{ duration: 0.2 }}
            className="absolute right-0 top-12 w-80 sm:w-96 bg-[#0f0b18]/95 backdrop-blur-xl border border-purple-900/30 rounded-2xl shadow-2xl shadow-purple-500/10 z-50 overflow-hidden"
          >
            {/* Header */}
            <div className="flex items-center justify-between px-4 py-3 border-b border-white/5">
              <div className="flex items-center gap-2">
                <h3 className="font-semibold text-white">Notifications</h3>
                {unreadCount > 0 && (
                  <Badge className="bg-purple-500/20 text-purple-300 border-purple-500/30 text-[10px]">
                    {unreadCount} new
                  </Badge>
                )}
              </div>
              <div className="flex items-center gap-1">
                {unreadCount > 0 && (
                  <button
                    onClick={markAllRead}
                    className="p-1.5 text-gray-400 hover:text-white transition-colors rounded-md hover:bg-white/5"
                    title="Mark all as read"
                  >
                    <CheckCheck className="w-4 h-4" />
                  </button>
                )}
              </div>
            </div>

            {/* Notifications List */}
            <div className="max-h-80 overflow-y-auto scrollbar-thin">
              {notifications.length === 0 ? (
                <div className="px-4 py-8 text-center">
                  <Bell className="w-8 h-8 text-gray-500 mx-auto mb-2" />
                  <p className="text-sm text-gray-400">No notifications yet</p>
                </div>
              ) : (
                notifications.map((notif) => (
                  <div
                    key={notif.id}
                    className={`flex items-start gap-3 px-4 py-3 transition-colors cursor-pointer ${getBgColor(notif.type, notif.read)}`}
                    onClick={() => markAsRead(notif.id)}
                  >
                    <div className="mt-0.5 flex-shrink-0">
                      {getIcon(notif.type)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <p className={`text-sm font-medium ${notif.read ? 'text-gray-300' : 'text-white'}`}>
                            {notif.title}
                          </p>
                          <p className="text-xs text-gray-500 mt-0.5 line-clamp-2">
                            {notif.message}
                          </p>
                        </div>
                        <div className="flex items-center gap-1 flex-shrink-0">
                          {!notif.read && (
                            <div className="w-2 h-2 rounded-full bg-purple-400 flex-shrink-0" />
                          )}
                          <button
                            onClick={(e) => {
                              e.stopPropagation()
                              deleteNotification(notif.id)
                            }}
                            className="p-1 text-gray-600 hover:text-red-400 transition-colors rounded opacity-0 group-hover:opacity-100"
                          >
                            <Trash2 className="w-3 h-3" />
                          </button>
                        </div>
                      </div>
                      <p className="text-[10px] text-gray-600 mt-1">
                        {formatTime(notif.timestamp)}
                      </p>
                    </div>
                  </div>
                ))
              )}
            </div>

            {/* Footer */}
            <div className="px-4 py-2 border-t border-white/5 text-center">
              <button
                onClick={() => {
                  setNotifications(prev => prev.filter(n => n.read))
                }}
                className="text-xs text-gray-500 hover:text-purple-400 transition-colors"
              >
                Clear all read notifications
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
