'use client'

import { motion } from 'framer-motion'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import { Button } from '@/components/ui/button'
import { Lock, Zap } from 'lucide-react'

// Interfaces
interface Analytics {
  totalTrades: number
  winningTrades: number
  losingTrades: number
  winRate: number
  totalPL: number
  avgProfit: number
  avgLoss: number
  profitFactor: number
  maxDrawdown: number
  sharpeRatio: number
  equityCurve: { date: string; equity: number }[]
  sessionPerformance: { session: string; trades: number; pl: number; winRate: number }[]
  monthlyPerformance: { month: string; pl: number; trades: number }[]
}

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

interface TargetsTabProps {
  isPro: boolean
  onUpgrade: () => void
  language: string
  analytics: Analytics | null
  trades: Trade[]
}

// Component
function TargetsTab({ isPro, onUpgrade, language, analytics, trades }: TargetsTabProps) {
  // Calculate real progress from trades
  const now = new Date()
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  const weekStart = new Date(todayStart)
  weekStart.setDate(weekStart.getDate() - weekStart.getDay())
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1)

  const todayPL = trades
    .filter(t => new Date(t.close_time) >= todayStart)
    .reduce((sum, t) => sum + t.profit_loss, 0)

  const weekPL = trades
    .filter(t => new Date(t.close_time) >= weekStart)
    .reduce((sum, t) => sum + t.profit_loss, 0)

  const monthPL = trades
    .filter(t => new Date(t.close_time) >= monthStart)
    .reduce((sum, t) => sum + t.profit_loss, 0)

  const currentWinRate = analytics?.winRate || 0

  const targets = [
    { id: 1, name: language === "id" ? "Target Harian" : "Daily Target", target: 100, current: todayPL, unit: "$" },
    { id: 2, name: language === "id" ? "Target Mingguan" : "Weekly Target", target: 500, current: weekPL, unit: "$" },
    { id: 3, name: language === "id" ? "Target Bulanan" : "Monthly Target", target: 2000, current: monthPL, unit: "$" },
    { id: 4, name: language === "id" ? "Target Win Rate" : "Win Rate Target", target: 70, current: currentWinRate, unit: "%" },
  ]

  if (!isPro) {
    return (
      <Card className="bg-gradient-to-br from-purple-500/10 to-violet-500/10 border-purple-500/30">
        <CardContent className="py-8 text-center">
          <motion.div animate={{ scale: [1, 1.1, 1] }} transition={{ duration: 2, repeat: Infinity }}>
            <Lock className="w-12 h-12 mx-auto mb-4 text-purple-400" />
          </motion.div>
          <h3 className="text-lg font-bold text-purple-400 mb-2">{language === "id" ? "Target - Fitur PRO" : "Targets - PRO Feature"}</h3>
          <p className="text-gray-400 mb-4">{language === "id" ? "Tetapkan dan lacak target trading Anda" : "Set and track your trading goals"}</p>
          <Button onClick={onUpgrade} className="bg-gradient-to-r from-purple-500 to-violet-600">
            <Zap className="w-4 h-4 mr-2" /> {language === "id" ? "Upgrade ke PRO" : "Upgrade to PRO"}
          </Button>
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="space-y-4">
      {targets.map((target) => {
        const percentage = Math.min((target.current / target.target) * 100, 100)
        const isCompleted = target.current >= target.target

        return (
          <motion.div key={target.id} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
            <Card className={"bg-gradient-to-br from-[#0f0b18] to-[#12091a] border-purple-900/30 " + (isCompleted ? "border-emerald-500/50" : "")}>
              <CardContent className="py-4">
                <div className="flex items-center justify-between mb-2">
                  <span className="font-medium">{target.name}</span>
                  <span className={"text-sm font-bold " + (isCompleted ? "text-emerald-400" : "text-purple-400")}>
                    {target.unit === "$" ? "$" : ""}{target.current}{target.unit !== "$" ? target.unit : ""} / {target.unit === "$" ? "$" : ""}{target.target}{target.unit !== "$" ? target.unit : ""}
                  </span>
                </div>
                <Progress value={percentage} className="h-2" />
                <div className="flex items-center justify-between mt-1">
                  <span className="text-xs text-gray-500">{percentage.toFixed(0)}%</span>
                  {isCompleted && (
                    <Badge className="bg-emerald-500/20 text-emerald-400 border-emerald-500/30">
                      ✓ {language === "id" ? "Tercapai" : "Completed"}
                    </Badge>
                  )}
                </div>
              </CardContent>
            </Card>
          </motion.div>
        )
      })}
    </div>
  )
}

export default TargetsTab
