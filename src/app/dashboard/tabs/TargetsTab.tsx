'use client'

import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Lock, Zap, Pencil, Check, X, RotateCcw } from 'lucide-react'

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
  notes?: string | null
  image_url?: string | null
}

interface TargetsTabProps {
  isPro: boolean
  onUpgrade: () => void
  language: string
  analytics: Analytics | null
  trades: Trade[]
}

// Defaults & storage key
const DEFAULT_TARGETS = { daily: 100, weekly: 500, monthly: 2000, winRate: 70 }
const TARGETS_KEY = 'luxtradee-targets'

// Component
function TargetsTab({ isPro, onUpgrade, language, analytics, trades }: TargetsTabProps) {
  // Editable target state
  const [customTargets, setCustomTargets] = useState(DEFAULT_TARGETS)
  const [editingId, setEditingId] = useState<number | null>(null)
  const [editValue, setEditValue] = useState('')

  // Load from localStorage on mount
  useEffect(() => {
    try {
      const stored = localStorage.getItem(TARGETS_KEY)
      if (stored) setCustomTargets(JSON.parse(stored))
    } catch {}
  }, [])

  // Save a single target
  const saveTarget = (id: number, value: number) => {
    const key = ['', 'daily', 'weekly', 'monthly', 'winRate'][id] as keyof typeof DEFAULT_TARGETS
    const newTargets = { ...customTargets, [key]: value }
    setCustomTargets(newTargets)
    localStorage.setItem(TARGETS_KEY, JSON.stringify(newTargets))
    setEditingId(null)
  }

  // Reset all targets to defaults
  const resetTargets = () => {
    setCustomTargets(DEFAULT_TARGETS)
    localStorage.setItem(TARGETS_KEY, JSON.stringify(DEFAULT_TARGETS))
    setEditingId(null)
  }

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
    { id: 1, name: language === "id" ? "Target Harian" : "Daily Target", target: customTargets.daily, current: todayPL, unit: "$" },
    { id: 2, name: language === "id" ? "Target Mingguan" : "Weekly Target", target: customTargets.weekly, current: weekPL, unit: "$" },
    { id: 3, name: language === "id" ? "Target Bulanan" : "Monthly Target", target: customTargets.monthly, current: monthPL, unit: "$" },
    { id: 4, name: language === "id" ? "Target Win Rate" : "Win Rate Target", target: customTargets.winRate, current: currentWinRate, unit: "%" },
  ]

  if (!isPro) {
    return (
      <Card className="bg-gradient-to-br from-blue-500/10 to-blue-400/10 border-blue-500/30">
        <CardContent className="py-8 text-center">
          <motion.div animate={{ scale: [1, 1.1, 1] }} transition={{ duration: 2, repeat: Infinity }}>
            <Lock className="w-12 h-12 mx-auto mb-4 text-blue-400" />
          </motion.div>
          <h3 className="text-lg font-bold text-blue-400 mb-2">{language === "id" ? "Target - Fitur PRO" : "Targets - PRO Feature"}</h3>
          <p className="text-lux-text-secondary dark:text-gray-400 mb-4">{language === "id" ? "Tetapkan dan lacak target trading Anda" : "Set and track your trading goals"}</p>
          <Button onClick={onUpgrade} className="bg-gradient-to-r from-blue-500 to-blue-600">
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
        const isEditing = editingId === target.id

        const startEdit = () => {
          setEditingId(target.id)
          setEditValue(String(target.target))
        }

        const confirmEdit = () => {
          const num = parseFloat(editValue)
          if (!isNaN(num) && num > 0) {
            saveTarget(target.id, target.unit === '%' ? Math.min(num, 100) : num)
          } else {
            setEditingId(null)
          }
        }

        const cancelEdit = () => setEditingId(null)

        return (
          <motion.div key={target.id} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
            <Card className={"bg-lux-bg-card dark:bg-gradient-to-br dark:from-[#0a0c12] dark:to-[#080a14] border-lux-border dark:border-blue-900/30 " + (isCompleted ? "border-emerald-500/50" : "")}>
              <CardContent className="py-4">
                <div className="flex items-center justify-between mb-2">
                  <span className="font-medium">{target.name}</span>
                  <div className="flex items-center gap-1.5">
                    <span className={"text-sm font-bold " + (isCompleted ? "text-emerald-400" : "text-blue-400")}>
                      {target.unit === "$" ? "$" : ""}{target.current.toFixed(0)}{target.unit !== "$" ? target.unit : ""} /{" "}
                    </span>
                    {isEditing ? (
                      <div className="flex items-center gap-1">
                        <Input
                          value={editValue}
                          onChange={e => setEditValue(e.target.value)}
                          onKeyDown={e => {
                            if (e.key === 'Enter') confirmEdit()
                            if (e.key === 'Escape') cancelEdit()
                          }}
                          onBlur={confirmEdit}
                          autoFocus
                          className="h-6 w-16 text-xs px-1.5 py-0"
                        />
                        <button onMouseDown={e => e.preventDefault()} onClick={confirmEdit} className="text-emerald-400 hover:text-emerald-300"><Check className="w-3.5 h-3.5" /></button>
                        <button onMouseDown={e => e.preventDefault()} onClick={cancelEdit} className="text-red-400 hover:text-red-300"><X className="w-3.5 h-3.5" /></button>
                      </div>
                    ) : (
                      <div className="flex items-center gap-1">
                        <span className={"text-sm font-bold " + (isCompleted ? "text-emerald-400" : "text-blue-400")}>
                          {target.unit === "$" ? "$" : ""}{target.target}{target.unit !== "$" ? target.unit : ""}
                        </span>
                        <button onClick={startEdit} className="text-lux-text-muted dark:text-gray-500 hover:text-blue-400 transition-colors">
                          <Pencil className="w-3 h-3" />
                        </button>
                      </div>
                    )}
                  </div>
                </div>
                <Progress value={percentage} className="h-2" />
                <div className="flex items-center justify-between mt-1">
                  <span className="text-xs text-lux-text-muted dark:text-gray-500">{percentage.toFixed(0)}%</span>
                  <div className="flex items-center gap-2">
                    {isCompleted && (
                      <Badge className="bg-emerald-500/20 text-emerald-400 border-emerald-500/30">
                        ✓ {language === "id" ? "Tercapai" : "Completed"}
                      </Badge>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        )
      })}
      {/* Reset button */}
      <div className="flex justify-end">
        <button
          onClick={resetTargets}
          className="text-xs text-lux-text-muted dark:text-gray-500 hover:text-blue-400 transition-colors flex items-center gap-1"
        >
          <RotateCcw className="w-3 h-3" />
          {language === "id" ? "Reset Target" : "Reset Targets"}
        </button>
      </div>
    </div>
  )
}

export default TargetsTab
