'use client'

import { useMemo } from 'react'
import { motion } from 'framer-motion'
import { TrendingUp, TrendingDown, Target, Award, Zap, Activity, Clock, DollarSign, Percent, BarChart3 } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'

interface Trade {
  id: string
  symbol: string
  type: 'BUY' | 'SELL'
  profit_loss: number
  open_time: string
  session?: string | null
}

interface QuickStatsProps {
  trades: Trade[]
  analytics?: {
    totalPL?: number
    winRate?: number
    profitFactor?: number
    maxDrawdown?: number
    avgProfit?: number
    avgLoss?: number
  } | null
  language?: 'id' | 'en'
}

export default function QuickStats({ trades, analytics, language = 'id' }: QuickStatsProps) {
  const stats = useMemo(() => {
    if (trades.length === 0) return []

    const totalPL = trades.reduce((sum, t) => sum + t.profit_loss, 0)
    const wins = trades.filter(t => t.profit_loss >= 0).length
    const losses = trades.filter(t => t.profit_loss < 0).length
    const winRate = Math.round((wins / trades.length) * 100)
    const avgWin = wins > 0 ? trades.filter(t => t.profit_loss >= 0).reduce((s, t) => s + t.profit_loss, 0) / wins : 0
    const avgLoss = losses > 0 ? Math.abs(trades.filter(t => t.profit_loss < 0).reduce((s, t) => s + t.profit_loss, 0) / losses) : 0
    const profitFactor = avgLoss > 0 ? avgWin / avgLoss : 0
    const bestTrade = trades.length > 0 ? Math.max(...trades.map(t => t.profit_loss)) : 0

    // Session breakdown
    const sessions: Record<string, { count: number; pl: number; wins: number }> = {}
    trades.forEach(t => {
      const session = t.session || 'N/A'
      if (!sessions[session]) sessions[session] = { count: 0, pl: 0, wins: 0 }
      sessions[session].count++
      sessions[session].pl += t.profit_loss
      if (t.profit_loss >= 0) sessions[session].wins++
    })

    // Best session
    const bestSession = Object.entries(sessions).sort((a, b) => b[1].pl - a[1].pl)[0]

    return [
      {
        label: language === 'id' ? 'Total P/L' : 'Total P/L',
        value: `$${totalPL.toLocaleString()}`,
        subtext: `${wins}W / ${losses}L`,
        icon: <DollarSign className="w-5 h-5" />,
        color: totalPL >= 0 ? 'text-emerald-400' : 'text-red-400',
        bgColor: totalPL >= 0 ? 'bg-emerald-500/10 border-emerald-500/20' : 'bg-red-500/10 border-red-500/20',
      },
      {
        label: language === 'id' ? 'Win Rate' : 'Win Rate',
        value: `${winRate}%`,
        subtext: `${wins}/${trades.length} ${language === 'id' ? 'trade menang' : 'wins'}`,
        icon: <Percent className="w-5 h-5" />,
        color: winRate >= 50 ? 'text-emerald-400' : 'text-amber-400',
        bgColor: winRate >= 50 ? 'bg-emerald-500/10 border-emerald-500/20' : 'bg-amber-500/10 border-amber-500/20',
      },
      {
        label: language === 'id' ? 'Rata-rata Win' : 'Avg Win',
        value: `$${avgWin.toFixed(0)}`,
        subtext: language === 'id' ? `vs Loss $${avgLoss.toFixed(0)}` : `vs Loss $${avgLoss.toFixed(0)}`,
        icon: <TrendingUp className="w-5 h-5" />,
        color: 'text-blue-400',
        bgColor: 'bg-blue-500/10 border-blue-500/20',
      },
      {
        label: language === 'id' ? 'Profit Factor' : 'Profit Factor',
        value: profitFactor.toFixed(2),
        subtext: profitFactor >= 1.5
          ? (language === 'id' ? 'Sangat bagus!' : 'Excellent!')
          : profitFactor >= 1
          ? (language === 'id' ? 'Cukup baik' : 'Good')
          : (language === 'id' ? 'Perlu perbaikan' : 'Needs work'),
        icon: <BarChart3 className="w-5 h-5" />,
        color: profitFactor >= 1.5 ? 'text-emerald-400' : profitFactor >= 1 ? 'text-amber-400' : 'text-red-400',
        bgColor: profitFactor >= 1.5 ? 'bg-emerald-500/10 border-emerald-500/20' : profitFactor >= 1 ? 'bg-amber-500/10 border-amber-500/20' : 'bg-red-500/10 border-red-500/20',
      },
      {
        label: language === 'id' ? 'Trade Terbaik' : 'Best Trade',
        value: `+$${bestTrade}`,
        subtext: trades.find(t => t.profit_loss === bestTrade)?.symbol || '',
        icon: <Award className="w-5 h-5" />,
        color: 'text-amber-400',
        bgColor: 'bg-amber-500/10 border-amber-500/20',
      },
      {
        label: language === 'id' ? 'Sesi Terbaik' : 'Best Session',
        value: bestSession ? bestSession[0] : '-',
        subtext: bestSession ? `$${bestSession[1].pl} (${bestSession[1].count} trades)` : '',
        icon: <Clock className="w-5 h-5" />,
        color: 'text-purple-400',
        bgColor: 'bg-purple-500/10 border-purple-500/20',
      },
    ]
  }, [trades, analytics, language])

  if (stats.length === 0) {
    return null
  }

  return (
    <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
      {stats.map((stat, index) => (
        <motion.div
          key={stat.label}
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3, delay: index * 0.05 }}
          className={`p-4 rounded-xl border ${stat.bgColor} transition-all hover:scale-[1.02]`}
        >
          <div className="flex items-center justify-between mb-2">
            <span className={stat.color}>{stat.icon}</span>
          </div>
          <p className={`text-xl font-bold ${stat.color}`}>{stat.value}</p>
          <p className="text-xs text-gray-400 mt-0.5">{stat.label}</p>
          <p className="text-[10px] text-gray-600 mt-1">{stat.subtext}</p>
        </motion.div>
      ))}
    </div>
  )
}
