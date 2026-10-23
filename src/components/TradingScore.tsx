'use client'

import { useMemo } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Progress } from '@/components/ui/progress'
import { Trophy, TrendingUp, Target, BarChart3, Lock } from 'lucide-react'
import { Button } from '@/components/ui/button'

interface TradingScoreProps {
  analytics: any
  trades: any[]
  isPro: boolean
  onUpgrade: () => void
}

export default function TradingScore({ analytics, trades, isPro, onUpgrade }: TradingScoreProps) {
  const scores = useMemo(() => {
    if (!trades || trades.length === 0) {
      return { overall: 0, winRate: 0, consistency: 0, riskMgmt: 0, discipline: 0 }
    }

    const closedTrades = trades.filter((t: any) => t.close_time)
    if (closedTrades.length === 0) {
      return { overall: 0, winRate: 0, consistency: 0, riskMgmt: 0, discipline: 0 }
    }

    // Win Rate Score
    const wins = closedTrades.filter((t: any) => Number(t.profit_loss) > 0).length
    const winRate = (wins / closedTrades.length) * 100
    const winRateScore = Math.min(100, winRate * 1.2)

    // Consistency Score (based on P&L standard deviation)
    const pnls = closedTrades.map((t: any) => Number(t.profit_loss))
    const avgPnl = pnls.reduce((a: number, b: number) => a + b, 0) / pnls.length
    const variance = pnls.reduce((a: number, b: number) => a + Math.pow(b - avgPnl, 2), 0) / pnls.length
    const stdDev = Math.sqrt(variance)
    const consistencyScore = Math.max(0, Math.min(100, 80 - (stdDev / (Math.abs(avgPnl) || 1)) * 10))

    // Risk Management Score
    const avgLoss = pnls.filter(p => p < 0).length > 0
      ? Math.abs(pnls.filter(p => p < 0).reduce((a, b) => a + b, 0) / pnls.filter(p => p < 0).length)
      : 0
    const avgGain = pnls.filter(p => p > 0).length > 0
      ? pnls.filter(p => p > 0).reduce((a, b) => a + b, 0) / pnls.filter(p => p > 0).length
      : 1
    const rrRatio = avgLoss > 0 ? avgGain / avgLoss : 2
    const riskMgmtScore = Math.min(100, rrRatio * 30)

    // Discipline Score (based on session consistency)
    const sessions = new Set(closedTrades.map((t: any) => t.session).filter(Boolean))
    const disciplineScore = Math.min(100, 50 + sessions.size * 10 + (closedTrades.length > 10 ? 20 : closedTrades.length * 2))

    // Overall Score
    const overall = Math.round((winRateScore + consistencyScore + riskMgmtScore + disciplineScore) / 4)

    return {
      overall: Math.round(overall),
      winRate: Math.round(winRateScore),
      consistency: Math.round(consistencyScore),
      riskMgmt: Math.round(riskMgmtScore),
      discipline: Math.round(disciplineScore),
    }
  }, [analytics, trades])

  const scoreItems = [
    { label: 'Win Rate', score: scores.winRate, icon: TrendingUp, color: 'text-emerald-400' },
    { label: 'Consistency', score: scores.consistency, icon: BarChart3, color: 'text-blue-400' },
    { label: 'Risk Management', score: scores.riskMgmt, icon: Target, color: 'text-amber-400' },
    { label: 'Discipline', score: scores.discipline, icon: Trophy, color: 'text-purple-400' },
  ]

  if (!isPro) {
    return (
      <Card className="border-lux-border dark:border-blue-500/20 bg-lux-bg-card dark:bg-[#0a0c12]">
        <CardHeader>
          <CardTitle className="text-lux-text-primary dark:text-white flex items-center gap-2">
            <Trophy className="w-5 h-5 text-amber-400" />
            Trading Score
          </CardTitle>
        </CardHeader>
        <CardContent className="text-center py-8">
          <Lock className="w-10 h-10 text-gray-500 mx-auto mb-3" />
          <p className="text-sm text-lux-text-muted dark:text-gray-400 mb-4">
            Upgrade to PRO to unlock your personalized trading score
          </p>
          <Button onClick={onUpgrade} size="sm" className="bg-gradient-to-r from-blue-500 to-cyan-500 text-white">
            Upgrade to PRO
          </Button>
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="space-y-6">
      {/* Overall Score */}
      <Card className="border-lux-border dark:border-blue-500/20 bg-lux-bg-card dark:bg-[#0a0c12]">
        <CardContent className="pt-6 text-center">
          <div className="relative w-32 h-32 mx-auto mb-4">
            <svg className="w-full h-full -rotate-90" viewBox="0 0 120 120">
              <circle cx="60" cy="60" r="50" fill="none" stroke="currentColor" strokeWidth="8" className="text-gray-200 dark:text-gray-800" />
              <circle
                cx="60" cy="60" r="50" fill="none" stroke="currentColor" strokeWidth="8"
                strokeDasharray={`${(scores.overall / 100) * 314} 314`}
                className="text-blue-500"
                strokeLinecap="round"
              />
            </svg>
            <div className="absolute inset-0 flex items-center justify-center">
              <span className="text-3xl font-bold text-lux-text-primary dark:text-white">{scores.overall}</span>
            </div>
          </div>
          <p className="text-sm text-lux-text-muted dark:text-gray-400">Overall Trading Score</p>
        </CardContent>
      </Card>

      {/* Detailed Scores */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {scoreItems.map(item => (
          <Card key={item.label} className="border-lux-border dark:border-blue-500/20 bg-lux-bg-card dark:bg-[#0a0c12]">
            <CardContent className="pt-4 pb-4">
              <div className="flex items-center gap-2 mb-2">
                <item.icon className={`w-4 h-4 ${item.color}`} />
                <span className="text-sm font-medium text-lux-text-primary dark:text-white">{item.label}</span>
                <span className="ml-auto text-sm font-bold text-lux-text-primary dark:text-white">{item.score}</span>
              </div>
              <Progress value={item.score} className="h-2" />
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  )
}
