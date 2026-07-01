'use client'

import React, { useMemo } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { TrendingUp, TrendingDown, Target, Zap, Calendar, AlertCircle } from 'lucide-react'

interface Trade {
  symbol: string
  type: 'buy' | 'sell'
  open_price: number
  close_price: number
  profit_loss: number
  open_time: string
  close_time: string
  volume?: number
}

interface TradingStatsProps {
  trades: Trade[]
  period?: 'all' | 'month' | 'week'
}

export function TradingStatsDashboard({ trades, period = 'all' }: TradingStatsProps) {
  const stats = useMemo(() => {
    if (trades.length === 0) {
      return {
        totalTrades: 0,
        winningTrades: 0,
        losingTrades: 0,
        winRate: 0,
        totalProfit: 0,
        totalLoss: 0,
        netProfit: 0,
        avgWin: 0,
        avgLoss: 0,
        profitFactor: 0,
        largestWin: 0,
        largestLoss: 0,
        buyTrades: 0,
        sellTrades: 0,
        consecutiveWins: 0,
        consecutiveLosses: 0,
        bestDay: { date: '', profit: 0 },
        worstDay: { date: '', profit: 0 }
      }
    }

    let winning = 0
    let losing = 0
    let totalProfit = 0
    let totalLoss = 0
    let largestWin = 0
    let largestLoss = 0
    let buyCount = 0
    let sellCount = 0
    const dailyProfits: Record<string, number> = {}

    trades.forEach(trade => {
      const date = new Date(trade.close_time).toLocaleDateString()
      dailyProfits[date] = (dailyProfits[date] || 0) + trade.profit_loss

      if (trade.profit_loss > 0) {
        winning++
        totalProfit += trade.profit_loss
        largestWin = Math.max(largestWin, trade.profit_loss)
      } else if (trade.profit_loss < 0) {
        losing++
        totalLoss += Math.abs(trade.profit_loss)
        largestLoss = Math.min(largestLoss, trade.profit_loss)
      }

      if (trade.type === 'buy') buyCount++
      else if (trade.type === 'sell') sellCount++
    })

    // Calculate consecutive wins/losses
    let consecutiveWins = 0
    let maxConsecutiveWins = 0
    let consecutiveLosses = 0
    let maxConsecutiveLosses = 0

    trades.forEach(trade => {
      if (trade.profit_loss > 0) {
        consecutiveWins++
        consecutiveLosses = 0
        maxConsecutiveWins = Math.max(maxConsecutiveWins, consecutiveWins)
      } else if (trade.profit_loss < 0) {
        consecutiveLosses++
        consecutiveWins = 0
        maxConsecutiveLosses = Math.max(maxConsecutiveLosses, consecutiveLosses)
      } else {
        consecutiveWins = 0
        consecutiveLosses = 0
      }
    })

    // Find best and worst day
    let bestDay = { date: '', profit: 0 }
    let worstDay = { date: '', profit: 0 }
    Object.entries(dailyProfits).forEach(([date, profit]) => {
      if (profit > bestDay.profit) bestDay = { date, profit }
      if (profit < worstDay.profit) worstDay = { date, profit }
    })

    const netProfit = totalProfit - totalLoss
    const winRate = trades.length > 0 ? (winning / trades.length) * 100 : 0
    const avgWin = winning > 0 ? totalProfit / winning : 0
    const avgLoss = losing > 0 ? totalLoss / losing : 0
    const profitFactor = totalLoss > 0 ? totalProfit / totalLoss : winning > 0 ? totalProfit : 0

    return {
      totalTrades: trades.length,
      winningTrades: winning,
      losingTrades: losing,
      winRate,
      totalProfit,
      totalLoss,
      netProfit,
      avgWin,
      avgLoss,
      profitFactor,
      largestWin,
      largestLoss,
      buyTrades: buyCount,
      sellTrades: sellCount,
      consecutiveWins: maxConsecutiveWins,
      consecutiveLosses: maxConsecutiveLosses,
      bestDay,
      worstDay
    }
  }, [trades])

  const StatCard = ({ title, value, icon: Icon, color, subtext }: any) => (
    <Card className="bg-gradient-to-br from-[#0f0b18] to-[#12091a] border-purple-900/30">
      <CardContent className="p-4">
        <div className="flex items-start justify-between">
          <div>
            <p className="text-xs text-gray-400 mb-1">{title}</p>
            <p className={`text-2xl font-bold ${color}`}>{value}</p>
            {subtext && <p className="text-xs text-gray-500 mt-1">{subtext}</p>}
          </div>
          <div className={`p-2 rounded-lg ${color.replace('text', 'bg').replace('400', '400/10')}`}>
            <Icon className={`w-5 h-5 ${color}`} />
          </div>
        </div>
      </CardContent>
    </Card>
  )

  return (
    <div className="space-y-6">
      {/* Key Metrics */}
      <div>
        <h3 className="text-lg font-bold mb-3">📊 Trading Statistics</h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <StatCard
            title="Total Trades"
            value={stats.totalTrades}
            icon={Target}
            color="text-blue-400"
          />
          <StatCard
            title="Win Rate"
            value={`${stats.winRate.toFixed(1)}%`}
            icon={TrendingUp}
            color="text-emerald-400"
            subtext={`${stats.winningTrades}W - ${stats.losingTrades}L`}
          />
          <StatCard
            title="Net Profit"
            value={`$${stats.netProfit.toFixed(2)}`}
            icon={Zap}
            color={stats.netProfit >= 0 ? 'text-green-400' : 'text-red-400'}
          />
          <StatCard
            title="Profit Factor"
            value={stats.profitFactor.toFixed(2)}
            icon={Target}
            color={stats.profitFactor > 1.5 ? 'text-purple-400' : stats.profitFactor > 1 ? 'text-yellow-400' : 'text-red-400'}
            subtext={stats.profitFactor > 1.5 ? 'Excellent' : stats.profitFactor > 1 ? 'Good' : 'Below 1.0'}
          />
        </div>
      </div>

      {/* Detailed Stats Grid */}
      <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
        <Card className="bg-gradient-to-br from-[#0f0b18] to-[#12091a] border-purple-900/30">
          <CardContent className="p-4">
            <p className="text-xs text-gray-400 mb-2">Average Win</p>
            <p className="text-xl font-bold text-emerald-400">${stats.avgWin.toFixed(2)}</p>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-[#0f0b18] to-[#12091a] border-purple-900/30">
          <CardContent className="p-4">
            <p className="text-xs text-gray-400 mb-2">Average Loss</p>
            <p className="text-xl font-bold text-red-400">-${stats.avgLoss.toFixed(2)}</p>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-[#0f0b18] to-[#12091a] border-purple-900/30">
          <CardContent className="p-4">
            <p className="text-xs text-gray-400 mb-2">Risk/Reward Ratio</p>
            <p className="text-xl font-bold text-purple-400">
              {stats.avgLoss > 0 ? (stats.avgWin / stats.avgLoss).toFixed(2) : '0.00'}
            </p>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-[#0f0b18] to-[#12091a] border-purple-900/30">
          <CardContent className="p-4">
            <p className="text-xs text-gray-400 mb-2">Largest Win</p>
            <p className="text-xl font-bold text-green-400">${stats.largestWin.toFixed(2)}</p>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-[#0f0b18] to-[#12091a] border-purple-900/30">
          <CardContent className="p-4">
            <p className="text-xs text-gray-400 mb-2">Largest Loss</p>
            <p className="text-xl font-bold text-red-400">-${Math.abs(stats.largestLoss).toFixed(2)}</p>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-[#0f0b18] to-[#12091a] border-purple-900/30">
          <CardContent className="p-4">
            <p className="text-xs text-gray-400 mb-2">Win Streak</p>
            <p className="text-xl font-bold text-amber-400">{stats.consecutiveWins} trades</p>
          </CardContent>
        </Card>
      </div>

      {/* Buy vs Sell Analysis */}
      <Card className="bg-gradient-to-br from-[#0f0b18] to-[#12091a] border-purple-900/30">
        <CardHeader>
          <CardTitle className="text-sm">Trade Direction Analysis</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            <div>
              <div className="flex justify-between items-center mb-2">
                <span className="text-sm text-gray-400">Buy Trades</span>
                <span className="font-bold text-blue-400">{stats.buyTrades} ({stats.totalTrades > 0 ? ((stats.buyTrades / stats.totalTrades) * 100).toFixed(1) : 0}%)</span>
              </div>
              <div className="w-full h-2 bg-white/5 rounded-full overflow-hidden">
                <div
                  className="h-full bg-blue-500 rounded-full"
                  style={{ width: `${stats.totalTrades > 0 ? (stats.buyTrades / stats.totalTrades) * 100 : 0}%` }}
                />
              </div>
            </div>

            <div>
              <div className="flex justify-between items-center mb-2">
                <span className="text-sm text-gray-400">Sell Trades</span>
                <span className="font-bold text-purple-400">{stats.sellTrades} ({stats.totalTrades > 0 ? ((stats.sellTrades / stats.totalTrades) * 100).toFixed(1) : 0}%)</span>
              </div>
              <div className="w-full h-2 bg-white/5 rounded-full overflow-hidden">
                <div
                  className="h-full bg-purple-500 rounded-full"
                  style={{ width: `${stats.totalTrades > 0 ? (stats.sellTrades / stats.totalTrades) * 100 : 0}%` }}
                />
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Best and Worst Days */}
      <div className="grid grid-cols-2 gap-3">
        <Card className={`bg-gradient-to-br ${stats.bestDay.profit >= 0 ? 'from-green-500/10 to-emerald-500/5' : 'from-red-500/10 to-red-500/5'} border-${stats.bestDay.profit >= 0 ? 'green' : 'red'}-500/20`}>
          <CardContent className="p-4">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-xs text-gray-400 mb-1">Best Day</p>
                <p className="text-lg font-bold text-green-400">${stats.bestDay.profit.toFixed(2)}</p>
                <p className="text-xs text-gray-500 mt-1">{stats.bestDay.date}</p>
              </div>
              <TrendingUp className="w-5 h-5 text-green-400" />
            </div>
          </CardContent>
        </Card>

        <Card className={`bg-gradient-to-br ${stats.worstDay.profit <= 0 ? 'from-red-500/10 to-red-500/5' : 'from-green-500/10 to-emerald-500/5'} border-${stats.worstDay.profit <= 0 ? 'red' : 'green'}-500/20`}>
          <CardContent className="p-4">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-xs text-gray-400 mb-1">Worst Day</p>
                <p className="text-lg font-bold text-red-400">${stats.worstDay.profit.toFixed(2)}</p>
                <p className="text-xs text-gray-500 mt-1">{stats.worstDay.date}</p>
              </div>
              <TrendingDown className="w-5 h-5 text-red-400" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Summary Info */}
      {trades.length === 0 && (
        <Card className="bg-gradient-to-br from-amber-500/10 to-orange-500/5 border-amber-500/20">
          <CardContent className="p-4">
            <div className="flex items-start gap-3">
              <AlertCircle className="w-5 h-5 text-amber-400 mt-0.5" />
              <div>
                <p className="text-sm font-medium text-amber-300">No trades recorded yet</p>
                <p className="text-xs text-amber-200/70 mt-1">Start recording your trades to see statistics</p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
