'use client'

import { AlertCircle, PieChart } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts'
import { motion } from 'framer-motion'
import { formatCurrency } from '@/lib/supabase'

export interface Analytics {
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

export interface Trade {
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

// Animated number display component
function AnimatedNumber({ value, prefix = '', suffix = '', decimals = 2, className = '' }: {
  value: number
  prefix?: string
  suffix?: string
  decimals?: number
  className?: string
}) {
  return (
    <span className={className}>
      {prefix}{value.toFixed(decimals)}{suffix}
    </span>
  )
}

interface AnalyticsTabProps {
  analytics: Analytics | null
  loading: boolean
  trades: Trade[]
}

export default function AnalyticsTab({ analytics, loading, trades }: AnalyticsTabProps) {
  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="w-8 h-8 border-2 border-purple-500 border-t-transparent rounded-full animate-spin"></div>
      </div>
    )
  }

  if (!analytics || analytics.totalTrades === 0) {
    return (
      <Card className="bg-gradient-to-br from-[#0f0b18] to-[#12091a] border-purple-900/30">
        <CardContent className="py-16 text-center">
          <PieChart className="w-12 h-12 mx-auto mb-4 text-gray-500" />
          <h3 className="text-lg font-semibold mb-2">No Analytics Yet</h3>
          <p className="text-gray-400">Add some trades to see analytics!</p>
        </CardContent>
      </Card>
    )
  }

  const sessionColors: Record<string, string> = {
    'London': '#f59e0b',
    'New York': '#8b5cf6',
    'Asia': '#10b981',
    'Off-Market': '#6b7280'
  }

  return (
    <div className="space-y-6">
      {/* Session Performance Chart */}
      <Card className="bg-gradient-to-br from-[#0f0b18] to-[#12091a] border-purple-900/30">
        <CardHeader>
          <CardTitle className="text-lg">Session Performance</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-[200px] lg:h-[250px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={analytics.sessionPerformance}>
                <XAxis dataKey="session" tick={{ fill: 'rgba(255,255,255,0.3)', fontSize: 11 }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fill: 'rgba(255,255,255,0.3)', fontSize: 11 }} axisLine={false} tickLine={false} />
                <Tooltip
                  contentStyle={{ background: '#0f0b18', border: '1px solid rgba(139,92,246,0.3)', borderRadius: 8 }}
                  formatter={(value: number) => formatCurrency(value)}
                />
                <Bar dataKey="pl" radius={[4, 4, 0, 0]} animationDuration={1000}>
                  {analytics.sessionPerformance.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={sessionColors[entry.session] || '#8b5cf6'} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>

      {/* Session Performance Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 lg:gap-4">
        {analytics.sessionPerformance.map((session) => (
          <motion.div
            key={session.session}
            className="p-4 rounded-xl bg-white/5 border border-purple-900/30"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3 }}
          >
            <div className="text-sm text-gray-400 mb-1">{session.session}</div>
            <div className={`text-xl font-bold ${session.pl >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
              <AnimatedNumber value={session.pl} prefix={session.pl >= 0 ? '+' : ''} decimals={0} />
            </div>
            <div className="text-xs text-gray-500 mt-1">
              {session.trades} trades - {session.winRate.toFixed(0)}% WR
            </div>
          </motion.div>
        ))}
      </div>

      {/* Risk Metrics */}
      <Card className="bg-gradient-to-br from-[#0f0b18] to-[#12091a] border-purple-900/30">
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <AlertCircle className="w-5 h-5 text-purple-400" />
            Risk Metrics
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="p-4 rounded-xl bg-white/5 border border-purple-900/30">
              <div className="text-sm text-gray-400 mb-1">Max Drawdown</div>
              <div className="text-2xl font-bold text-red-400">
                -<AnimatedNumber value={analytics.maxDrawdown || 0} decimals={0} />
              </div>
              <p className="text-xs text-gray-500 mt-1">Peak to trough decline</p>
            </div>
            <div className="p-4 rounded-xl bg-white/5 border border-purple-900/30">
              <div className="text-sm text-gray-400 mb-1">Sharpe Ratio</div>
              <div className="text-2xl font-bold text-purple-400">
                <AnimatedNumber value={analytics.sharpeRatio || 0} decimals={2} />
              </div>
              <p className="text-xs text-gray-500 mt-1">Risk-adjusted return</p>
            </div>
            <div className="p-4 rounded-xl bg-white/5 border border-purple-900/30">
              <div className="text-sm text-gray-400 mb-1">Average Win</div>
              <div className="text-2xl font-bold text-emerald-400">
                +<AnimatedNumber value={analytics.avgProfit} decimals={0} />
              </div>
              <p className="text-xs text-gray-500 mt-1">Per winning trade</p>
            </div>
            <div className="p-4 rounded-xl bg-white/5 border border-purple-900/30">
              <div className="text-sm text-gray-400 mb-1">Average Loss</div>
              <div className="text-2xl font-bold text-red-400">
                -<AnimatedNumber value={analytics.avgLoss} decimals={0} />
              </div>
              <p className="text-xs text-gray-500 mt-1">Per losing trade</p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
