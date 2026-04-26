'use client'

import { useMemo } from 'react'
import { motion } from 'framer-motion'
import { TrendingUp, TrendingDown, Plus, Edit, Trash2, Brain, BookOpen, Target, Trophy, Clock, Zap, FileText } from 'lucide-react'

interface Trade {
  id: string
  symbol: string
  type: 'BUY' | 'SELL'
  profit_loss: number
  open_time: string
  close_time: string
  session?: string | null
}

interface JournalEntry {
  id: string
  title: string
  created_at: string
  mood?: string | null
}

interface ActivityFeedProps {
  trades: Trade[]
  journalEntries?: JournalEntry[]
  language?: 'id' | 'en'
}

interface ActivityItem {
  id: string
  type: 'trade_win' | 'trade_loss' | 'journal' | 'milestone'
  icon: React.ReactNode
  title: string
  description: string
  timestamp: Date
  color: string
  bgColor: string
}

export default function ActivityFeed({ trades, journalEntries = [], language = 'id' }: ActivityFeedProps) {
  const activities = useMemo(() => {
    const items: ActivityItem[] = []

    // Trade activities
    trades.forEach((trade, i) => {
      const time = new Date(trade.open_time)
      const isWin = trade.profit_loss >= 0
      const pnlStr = isWin ? `+$${trade.profit_loss}` : `-$${Math.abs(trade.profit_loss)}`

      items.push({
        id: `trade-${trade.id}`,
        type: isWin ? 'trade_win' : 'trade_loss',
        icon: isWin ? <TrendingUp className="w-4 h-4" /> : <TrendingDown className="w-4 h-4" />,
        title: language === 'id'
          ? `${trade.type === 'BUY' ? 'Beli' : 'Jual'} ${trade.symbol}`
          : `${trade.type === 'BUY' ? 'Bought' : 'Sold'} ${trade.symbol}`,
        description: `${pnlStr} • ${trade.session || 'N/A'} • ${trade.lot_size || 0.1} lots`,
        timestamp: time,
        color: isWin ? 'text-emerald-400' : 'text-red-400',
        bgColor: isWin ? 'bg-emerald-500/10 border-emerald-500/20' : 'bg-red-500/10 border-red-500/20',
      })
    })

    // Journal activities
    journalEntries.forEach((entry, i) => {
      items.push({
        id: `journal-${entry.id}`,
        type: 'journal',
        icon: <BookOpen className="w-4 h-4" />,
        title: language === 'id' ? 'Catatan Jurnal Baru' : 'New Journal Entry',
        description: entry.title,
        timestamp: new Date(entry.created_at),
        color: 'text-blue-400',
        bgColor: 'bg-blue-500/10 border-blue-500/20',
      })
    })

    // Milestones
    if (trades.length >= 10) {
      items.push({
        id: 'milestone-10',
        type: 'milestone',
        icon: <Trophy className="w-4 h-4" />,
        title: language === 'id' ? '🏆 10 Trade Tercapai!' : '🏆 10 Trades Milestone!',
        description: language === 'id' ? 'Anda sudah menyelesaikan 10 trade' : 'You have completed 10 trades',
        timestamp: new Date(Date.now() - 86400000 * 2),
        color: 'text-amber-400',
        bgColor: 'bg-amber-500/10 border-amber-500/20',
      })
    }

    if (trades.length >= 50) {
      items.push({
        id: 'milestone-50',
        type: 'milestone',
        icon: <Trophy className="w-4 h-4" />,
        title: language === 'id' ? '🎯 50 Trade Tercapai!' : '🎯 50 Trades Milestone!',
        description: language === 'id' ? 'Level trader menengah!' : 'Intermediate trader level!',
        timestamp: new Date(Date.now() - 86400000 * 5),
        color: 'text-purple-400',
        bgColor: 'bg-purple-500/10 border-purple-500/20',
      })
    }

    // Sort by timestamp
    items.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime())

    return items.slice(0, 15)
  }, [trades, journalEntries, language])

  const formatTime = (date: Date) => {
    const now = new Date()
    const diff = now.getTime() - date.getTime()
    const minutes = Math.floor(diff / 60000)
    const hours = Math.floor(diff / 3600000)
    const days = Math.floor(diff / 86400000)

    if (minutes < 1) return language === 'id' ? 'Baru saja' : 'Just now'
    if (minutes < 60) return `${minutes}m`
    if (hours < 24) return `${hours}h`
    if (days < 7) return `${days}d`
    return date.toLocaleDateString()
  }

  if (activities.length === 0) {
    return (
      <div className="text-center py-12">
        <Clock className="w-10 h-10 text-gray-600 mx-auto mb-3" />
        <p className="text-gray-500 text-sm">
          {language === 'id' ? 'Belum ada aktivitas' : 'No activity yet'}
        </p>
        <p className="text-gray-600 text-xs mt-1">
          {language === 'id' ? 'Mulai trading untuk melihat aktivitas' : 'Start trading to see activity'}
        </p>
      </div>
    )
  }

  return (
    <div className="space-y-1">
      {activities.map((activity, index) => (
        <motion.div
          key={activity.id}
          initial={{ opacity: 0, x: -10 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.3, delay: index * 0.05 }}
          className="flex items-start gap-3 p-2.5 rounded-xl hover:bg-white/[0.02] transition-colors group"
        >
          {/* Icon */}
          <div className={`flex-shrink-0 w-9 h-9 rounded-xl flex items-center justify-center border ${activity.bgColor}`}>
            <span className={activity.color}>{activity.icon}</span>
          </div>

          {/* Content */}
          <div className="flex-1 min-w-0">
            <div className="flex items-start justify-between gap-2">
              <div>
                <p className="text-sm font-medium text-gray-200 group-hover:text-white transition-colors">
                  {activity.title}
                </p>
                <p className="text-xs text-gray-500 mt-0.5 truncate">
                  {activity.description}
                </p>
              </div>
              <span className="text-[10px] text-gray-600 flex-shrink-0 mt-0.5">
                {formatTime(activity.timestamp)}
              </span>
            </div>
          </div>
        </motion.div>
      ))}
    </div>
  )
}
