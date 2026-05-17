'use client'

import { useState, useEffect, useCallback, useMemo, useRef } from 'react'
import { motion } from 'framer-motion'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import { Button } from '@/components/ui/button'
import { Lock, Heart, Clock, Target, AlertTriangle, AlertCircle, Sparkles, Brain, Zap } from 'lucide-react'

// Interface
interface Trade {
  id: string
  symbol: string
  type: 'BUY' | 'SELL'
  open_price: number
  close_price: number
  lot_size: number
  profit_loss: number
  open_time: string
  close_time: string
  session: string | null
  notes?: string
  image_url?: string | null
}

interface PsychologyTabProps {
  isPro: boolean
  onUpgrade: () => void
  trades: Trade[]
}

// Helper: Consecutive Streaks
function calculateConsecutiveStreaks(trades: Trade[], type: 'win' | 'lose'): number {
  if (trades.length === 0) return 0
  const sorted = [...trades].sort((a, b) => new Date(a.close_time).getTime() - new Date(b.close_time).getTime())
  let maxStreak = 0
  let currentStreak = 0
  for (const trade of sorted) {
    const isMatch = type === 'win' ? trade.profit_loss > 0 : trade.profit_loss < 0
    if (isMatch) {
      currentStreak++
      maxStreak = Math.max(maxStreak, currentStreak)
    } else {
      currentStreak = 0
    }
  }
  return maxStreak
}

// Component
function PsychologyTab({ isPro, onUpgrade, trades }: PsychologyTabProps) {
  // Calculate psychology metrics from trades
  const winningTrades = trades.filter(t => t.profit_loss >= 0)
  const losingTrades = trades.filter(t => t.profit_loss < 0)

  // Session performance analysis
  const sessionStats = trades.reduce((acc, trade) => {
    const session = trade.session || 'Unknown'
    if (!acc[session]) {
      acc[session] = { wins: 0, losses: 0, totalPL: 0 }
    }
    if (trade.profit_loss >= 0) {
      acc[session].wins++
    } else {
      acc[session].losses++
    }
    acc[session].totalPL += trade.profit_loss
    return acc
  }, {} as Record<string, { wins: number; losses: number; totalPL: number }>)

  // Best performing session
  const bestSession = Object.entries(sessionStats).sort((a, b) => b[1].totalPL - a[1].totalPL)[0]

  // Streak analysis
  let currentStreak = 0
  let longestWinStreak = 0
  let longestLoseStreak = 0
  trades.forEach(trade => {
    if (trade.profit_loss >= 0) {
      currentStreak = currentStreak >= 0 ? currentStreak + 1 : 1
      longestWinStreak = Math.max(longestWinStreak, currentStreak)
    } else {
      currentStreak = currentStreak <= 0 ? currentStreak - 1 : -1
      longestLoseStreak = Math.max(longestLoseStreak, Math.abs(currentStreak))
    }
  })

  // Revenge trading detection (trades after a loss)
  const revengeTrades = trades.filter((trade, index) => {
    if (index === 0) return false
    const prevTrade = trades[index - 1]
    const timeDiff = new Date(trade.open_time).getTime() - new Date(prevTrade.close_time).getTime()
    return prevTrade.profit_loss < 0 && timeDiff < 3600000 && trade.profit_loss < 0 // Within 1 hour after loss
  })

  return (
    <div className="space-y-6">
      {!isPro ? (
        <Card className="bg-gradient-to-br from-purple-500/10 to-violet-500/10 border-purple-500/30">
          <CardContent className="py-8 text-center">
            <motion.div
              animate={{ scale: [1, 1.1, 1] }}
              transition={{ duration: 2, repeat: Infinity }}
            >
              <Lock className="w-12 h-12 mx-auto mb-4 text-purple-400" />
            </motion.div>
            <h3 className="text-lg font-bold text-purple-400 mb-2">Psychology Tracking - PRO Feature</h3>
            <p className="text-gray-400 mb-4">Track your emotional patterns and improve trading discipline</p>
            <Button onClick={onUpgrade} className="bg-gradient-to-r from-purple-500 to-violet-600">
              <Zap className="w-4 h-4 mr-2" /> Upgrade to PRO
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-6">
          {/* Psychology Score */}
          <Card className="bg-gradient-to-br from-[#0f0b18] to-[#12091a] border-purple-900/30">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg">
                <Heart className="w-5 h-5 text-pink-400" />
                Trading Psychology Analysis
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
                <div className="p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/20">
                  <div className="text-sm text-gray-400 mb-1">Win Streak</div>
                  <div className="text-2xl font-bold text-emerald-400">{longestWinStreak}</div>
                  <p className="text-xs text-gray-500 mt-1">Best consecutive wins</p>
                </div>
                <div className="p-4 rounded-xl bg-red-500/10 border border-red-500/20">
                  <div className="text-sm text-gray-400 mb-1">Lose Streak</div>
                  <div className="text-2xl font-bold text-red-400">{longestLoseStreak}</div>
                  <p className="text-xs text-gray-500 mt-1">Worst consecutive losses</p>
                </div>
                <div className="p-4 rounded-xl bg-purple-500/10 border border-purple-500/20">
                  <div className="text-sm text-gray-400 mb-1">Best Session</div>
                  <div className="text-xl font-bold text-purple-400">{bestSession?.[0] || '-'}</div>
                  <p className="text-xs text-gray-500 mt-1">{bestSession ? `+${bestSession[1].totalPL.toFixed(0)} P/L` : ''}</p>
                </div>
                <div className="p-4 rounded-xl bg-purple-500/10 border border-purple-500/20">
                  <div className="text-sm text-gray-400 mb-1">Revenge Trades</div>
                  <div className="text-2xl font-bold text-purple-400">{revengeTrades.length}</div>
                  <p className="text-xs text-gray-500 mt-1">Trades within 1hr after loss</p>
                </div>
              </div>

              {/* Session Psychology */}
              <h4 className="font-semibold mb-3 flex items-center gap-2">
                <Clock className="w-4 h-4 text-purple-400" />
                Session Performance Psychology
              </h4>
              <div className="space-y-2">
                {Object.entries(sessionStats).map(([session, stats]) => {
                  const winRate = ((stats.wins / (stats.wins + stats.losses)) * 100) || 0
                  const isProfitable = stats.totalPL >= 0
                  return (
                    <div key={session} className="flex items-center justify-between p-3 rounded-lg bg-white/5 border border-purple-900/30">
                      <div className="flex items-center gap-3">
                        <div className={`w-3 h-3 rounded-full ${isProfitable ? 'bg-emerald-400' : 'bg-red-400'}`} />
                        <span className="font-medium">{session}</span>
                      </div>
                      <div className="flex items-center gap-4 text-sm">
                        <span className="text-gray-400">{stats.wins + stats.losses} trades</span>
                        <span className={`font-bold ${isProfitable ? 'text-emerald-400' : 'text-red-400'}`}>
                          {isProfitable ? '+' : ''}{stats.totalPL.toFixed(0)}
                        </span>
                        <div className="w-16">
                          <Progress value={winRate} className="h-2" />
                          <span className="text-xs text-gray-500">{winRate.toFixed(0)}% WR</span>
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>

              {/* Trading Tips */}
              {trades.length > 0 && (
                <div className="mt-6 p-4 rounded-xl bg-gradient-to-r from-cyan-500/10 to-blue-500/10 border border-cyan-500/20">
                  <h4 className="font-semibold text-cyan-400 mb-2 flex items-center gap-2">
                    <Brain className="w-4 h-4" />
                    Psychology Tips
                  </h4>
                  <ul className="text-sm text-gray-300 space-y-2">
                    {revengeTrades.length > 2 && (
                      <li className="flex items-start gap-2">
                        <AlertTriangle className="w-4 h-4 text-purple-400 mt-0.5" />
                        <span>Consider taking a break after a loss. You have {revengeTrades.length} potential revenge trades.</span>
                      </li>
                    )}
                    {bestSession && (
                      <li className="flex items-start gap-2">
                        <Target className="w-4 h-4 text-emerald-400 mt-0.5" />
                        <span>Your best session is <strong>{bestSession[0]}</strong>. Consider focusing more trades during this time.</span>
                      </li>
                    )}
                    {longestLoseStreak > 3 && (
                      <li className="flex items-start gap-2">
                        <AlertCircle className="w-4 h-4 text-red-400 mt-0.5" />
                        <span>Your longest losing streak is {longestLoseStreak}. Consider reducing position size during drawdowns.</span>
                      </li>
                    )}
                    {trades.length >= 5 && (
                      <li className="flex items-start gap-2">
                        <Sparkles className="w-4 h-4 text-purple-400 mt-0.5" />
                        <span>Keep tracking your trades to unlock more personalized psychology insights.</span>
                      </li>
                    )}
                  </ul>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  )
}

export default PsychologyTab
