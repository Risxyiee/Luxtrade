'use client'

import { motion } from 'framer-motion'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts'
import { formatCurrency } from '@/lib/supabase'

interface PerformanceChartProps {
  analytics?: {
    equityCurve?: { date: string; equity: number }[]
    totalPL?: number
  } | null
  chartAnimated: boolean
}

export const PerformanceChart: React.FC<PerformanceChartProps> = ({
  analytics,
  chartAnimated
}) => {
  const hasData = analytics?.equityCurve && analytics.equityCurve.length > 1

  if (!hasData) return null

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, delay: 0.2 }}
    >
      <Card className="bg-lux-bg-card dark:bg-gradient-to-br dark:from-[#0a0c12]/80 dark:to-[#080a14]/80 backdrop-blur-md border-lux-border dark:border-blue-500/20 transition-all duration-300 hover:border-blue-500/40 hover:shadow-lg hover:shadow-blue-500/10">
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-lg">Equity Curve</CardTitle>
          <div className="flex items-center gap-2">
            <span className="text-sm text-lux-text-secondary dark:text-gray-400">Current:</span>
            <span className={`text-lg font-bold ${(analytics?.totalPL || 0) >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
              ${10000 + (analytics?.totalPL || 0).toFixed(0)}
            </span>
          </div>
        </CardHeader>
        <CardContent>
          <div className="h-[200px] lg:h-[250px]">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={analytics.equityCurve}>
                <defs>
                  <linearGradient id="equityGradient" x1="0" y1="0" x2="1" y2="0">
                    <stop offset="0%" stopColor="#f59e0b" stopOpacity={0.8} />
                    <stop offset="100%" stopColor="#3b82f6" stopOpacity={0.8} />
                  </linearGradient>
                  <linearGradient id="equityFill" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#3b82f6" stopOpacity={0.3} />
                    <stop offset="100%" stopColor="#3b82f6" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <XAxis
                  dataKey="date"
                  tick={{ fill: 'rgba(255,255,255,0.3)', fontSize: 10 }}
                  axisLine={false}
                  tickLine={false}
                />
                <YAxis
                  tick={{ fill: 'rgba(255,255,255,0.3)', fontSize: 10 }}
                  axisLine={false}
                  tickLine={false}
                />
                <Tooltip
                  contentStyle={{ background: '#0a0c12', border: '1px solid rgba(59,130,246,0.3)', borderRadius: 8 }}
                  labelStyle={{ color: 'rgba(255,255,255,0.6)' }}
                  formatter={(value: number) => formatCurrency(value)}
                />
                <Area
                  type="monotone"
                  dataKey="equity"
                  stroke="url(#equityGradient)"
                  strokeWidth={2.5}
                  fill="url(#equityFill)"
                  animationDuration={1500}
                  animationEasing="ease-out"
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>
    </motion.div>
  )
}
