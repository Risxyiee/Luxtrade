'use client'

import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, LineChart, Line, AreaChart, Area } from 'recharts'
import { TrendingUp, TrendingDown, Target, Clock, DollarSign, Activity, ArrowDownCircle, Zap, BarChart3, Globe } from 'lucide-react'

interface AnalyticsTabProps {
  language: 'id' | 'en'
  initialAnalytics?: any | null // Pre-fetched from parent (period='all')
}

const COLORS = ['#3b82f6', '#f59e0b', '#22c55e', '#3b82f6', '#06b6d4']

// Color coding helper for ratio-based metrics
const getRatioColor = (value: number, goodThreshold = 2, midThreshold = 1) => {
  if (value >= goodThreshold) return 'text-emerald-400'
  if (value >= midThreshold) return 'text-amber-400'
  return 'text-red-400'
}

const getRatioBg = (value: number, goodThreshold = 2, midThreshold = 1) => {
  if (value >= goodThreshold) return 'from-emerald-500/15 to-emerald-600/5 border-emerald-500/30'
  if (value >= midThreshold) return 'from-amber-500/15 to-amber-600/5 border-amber-500/30'
  return 'from-red-500/15 to-red-600/5 border-red-500/30'
}

export default function AnalyticsTab({ language, initialAnalytics }: AnalyticsTabProps) {
  const [analytics, setAnalytics] = useState<any>(initialAnalytics || null)
  const [loading, setLoading] = useState(!initialAnalytics)
  const [period, setPeriod] = useState('all')

  // Only fetch from API when period changes (not on mount if initialAnalytics exists)
  useEffect(() => {
    // If we have initial data and period is 'all', skip the fetch
    if (period === 'all' && initialAnalytics) return
    fetchAnalytics()
  }, [period])

  const fetchAnalytics = async () => {
    try {
      setLoading(true)
      const res = await fetch(`/api/analytics?period=${period}`, {
        credentials: 'include'
      })
      const data = await res.json()
      setAnalytics(data)
    } catch (error) {
      console.error('Failed to fetch analytics:', error)
    } finally {
      setLoading(false)
    }
  }

  if (loading) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {[1, 2, 3, 4].map((i) => (
          <Card key={i} className="bg-lux-bg-card dark:bg-gradient-to-br dark:from-[#0a0c12]/80 dark:to-[#080a14]/80 backdrop-blur-sm border border-white/10">
            <CardContent className="p-6">
              <div className="h-4 w-24 bg-white/10 rounded animate-pulse mb-3" />
              <div className="h-8 w-32 bg-white/10 rounded animate-pulse" />
            </CardContent>
          </Card>
        ))}
      </div>
    )
  }

  if (!analytics) {
    return (
      <Card className="bg-lux-bg-card dark:bg-gradient-to-br dark:from-[#0a0c12] dark:to-[#080a14] border-lux-border dark:border-blue-900/30">
        <CardContent className="py-20 text-center">
          <Activity className="w-12 h-12 text-blue-400 mx-auto mb-4" />
          <h3 className="text-lg font-semibold mb-2">No Data Available</h3>
          <p className="text-lux-text-secondary dark:text-gray-400">Start logging trades to see analytics</p>
        </CardContent>
      </Card>
    )
  }

  // Determine if we have the new metrics available
  const hasAdvancedMetrics = analytics.profitFactor !== undefined || analytics.sharpeRatio !== undefined

  return (
    <div className="space-y-6">
      {/* Period Selector */}
      <div className="flex gap-2 mb-6">
        {(['all', 'week', 'month', 'year'] as const).map((p) => (
          <button
            key={p}
            onClick={() => setPeriod(p)}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
              period === p
                ? 'bg-gradient-to-r from-blue-500 to-blue-600 text-white shadow-lg shadow-blue-500/30'
                : 'bg-lux-surface-hover dark:bg-white/5 text-lux-text-secondary dark:text-gray-400 hover:bg-lux-surface-hover dark:hover:bg-white/10 hover:text-white'
            }`}
          >
            {language === 'id' ?
              p === 'all' ? 'Semua' :
              p === 'week' ? 'Minggu' :
              p === 'month' ? 'Bulan' : 'Tahun'
            :
              p.charAt(0).toUpperCase() + p.slice(1)
            }
          </button>
        ))}
      </div>

      {/* Today's Performance */}
      {analytics.today && (
        <Card className="bg-gradient-to-br from-blue-500/15 via-blue-400/10 to-cyan-500/10 backdrop-blur-sm border border-blue-500/30">
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <TrendingUp className="w-5 h-5 text-blue-400" />
              {language === 'id' ? 'Performa Hari Ini' : "Today's Performance"}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-3 gap-4">
              <div>
                <p className="text-xs text-lux-text-secondary dark:text-gray-400 mb-1">{language === 'id' ? 'Jumlah Trade' : 'Trades'}</p>
                <p className="text-2xl font-bold text-lux-text-primary dark:text-white">{analytics.today.trades}</p>
              </div>
              <div>
                <p className="text-xs text-lux-text-secondary dark:text-gray-400 mb-1">{language === 'id' ? 'Profit/Loss' : 'P/L'}</p>
                <p className={`text-2xl font-bold ${analytics.today.pl >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                  ${analytics.today.pl.toFixed(2)}
                </p>
              </div>
              <div>
                <p className="text-xs text-lux-text-secondary dark:text-gray-400 mb-1">{language === 'id' ? 'Win Rate' : 'Win Rate'}</p>
                <p className="text-2xl font-bold text-amber-400">{analytics.today.winRate.toFixed(1)}%</p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Active Streak */}
      {analytics.activeStreak && analytics.activeStreak.count > 0 && (
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className={`p-4 rounded-xl border ${
            analytics.activeStreak.type === 'win'
              ? 'bg-gradient-to-r from-emerald-500/20 to-emerald-600/10 border-emerald-500/30'
              : 'bg-gradient-to-r from-red-500/20 to-red-600/10 border-red-500/30'
          }`}
        >
          <div className="flex items-center gap-3">
            {analytics.activeStreak.type === 'win' ? (
              <TrendingUp className="w-6 h-6 text-emerald-400" />
            ) : (
              <TrendingDown className="w-6 h-6 text-red-400" />
            )}
            <div>
              <p className="text-sm text-lux-text-secondary dark:text-gray-400">
                {language === 'id' ? 'Streak Aktif' : 'Active Streak'}
              </p>
              <p className={`text-xl font-bold ${
                analytics.activeStreak.type === 'win' ? 'text-emerald-400' : 'text-red-400'
              }`}>
                {analytics.activeStreak.count} {analytics.activeStreak.type === 'win' ? 'Wins' : 'Losses'}
              </p>
            </div>
          </div>
        </motion.div>
      )}

      {/* ==================== NEW: Key Metrics Row ==================== */}
      {hasAdvancedMetrics && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {/* Profit Factor */}
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.05 }}
          >
            <Card className={`bg-gradient-to-br ${getRatioBg(analytics.profitFactor || 0)}`}>
              <CardContent className="p-4">
                <div className="flex items-center gap-2 mb-2">
                  <BarChart3 className="w-4 h-4 text-blue-400" />
                  <p className="text-xs text-lux-text-secondary dark:text-gray-400">{language === 'id' ? 'Faktor Profit' : 'Profit Factor'}</p>
                </div>
                <p className={`text-2xl font-bold ${getRatioColor(analytics.profitFactor || 0)}`}>
                  {analytics.profitFactor === Infinity
                    ? '∞'
                    : (analytics.profitFactor || 0).toFixed(2)
                  }
                </p>
                <p className="text-[10px] text-lux-text-muted dark:text-gray-500 mt-1">
                  {analytics.profitFactor >= 2
                    ? language === 'id' ? 'Sangat Baik' : 'Excellent'
                    : analytics.profitFactor >= 1
                    ? language === 'id' ? 'Cukup Baik' : 'Good'
                    : language === 'id' ? 'Perlu Perbaikan' : 'Needs Improvement'
                  }
                </p>
              </CardContent>
            </Card>
          </motion.div>

          {/* Sharpe Ratio */}
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
          >
            <Card className={`bg-gradient-to-br ${getRatioBg(analytics.sharpeRatio || 0)}`}>
              <CardContent className="p-4">
                <div className="flex items-center gap-2 mb-2">
                  <Zap className="w-4 h-4 text-blue-400" />
                  <p className="text-xs text-lux-text-secondary dark:text-gray-400">Sharpe Ratio</p>
                </div>
                <p className={`text-2xl font-bold ${getRatioColor(analytics.sharpeRatio || 0)}`}>
                  {(analytics.sharpeRatio || 0).toFixed(2)}
                </p>
                <p className="text-[10px] text-lux-text-muted dark:text-gray-500 mt-1">
                  {analytics.sharpeRatio >= 2
                    ? language === 'id' ? 'Sangat Baik' : 'Excellent'
                    : analytics.sharpeRatio >= 1
                    ? language === 'id' ? 'Cukup Baik' : 'Good'
                    : language === 'id' ? 'Perlu Perbaikan' : 'Needs Improvement'
                  }
                </p>
              </CardContent>
            </Card>
          </motion.div>

          {/* Max Drawdown */}
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.15 }}
          >
            <Card className="bg-gradient-to-br from-red-500/15 to-red-600/5 border-red-500/30">
              <CardContent className="p-4">
                <div className="flex items-center gap-2 mb-2">
                  <ArrowDownCircle className="w-4 h-4 text-red-400" />
                  <p className="text-xs text-lux-text-secondary dark:text-gray-400">{language === 'id' ? 'Max Drawdown' : 'Max Drawdown'}</p>
                </div>
                <p className="text-2xl font-bold text-red-400">
                  -${(analytics.maxDrawdown || 0).toFixed(2)}
                </p>
                <p className="text-[10px] text-lux-text-muted dark:text-gray-500 mt-1">
                  {language === 'id' ? 'Kerugian Maksimal' : 'Maximum Loss'}
                </p>
              </CardContent>
            </Card>
          </motion.div>

          {/* Avg Win / Avg Loss */}
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
          >
            <Card className="bg-lux-bg-card dark:bg-gradient-to-br dark:from-[#0a0c12] dark:to-[#080a14] border-lux-border dark:border-blue-900/30">
              <CardContent className="p-4">
                <div className="flex items-center gap-2 mb-2">
                  <DollarSign className="w-4 h-4 text-blue-400" />
                  <p className="text-xs text-lux-text-secondary dark:text-gray-400">{language === 'id' ? 'Rata-rata Win/Loss' : 'Avg Win / Loss'}</p>
                </div>
                <div className="flex items-center gap-2">
                  <div>
                    <p className="text-xs text-lux-text-muted dark:text-gray-500">{language === 'id' ? 'Menang' : 'Win'}</p>
                    <p className="text-lg font-bold text-emerald-400">
                      +${(analytics.avgProfit || 0).toFixed(2)}
                    </p>
                  </div>
                  <div className="w-px h-8 bg-white/10" />
                  <div>
                    <p className="text-xs text-lux-text-muted dark:text-gray-500">{language === 'id' ? 'Kalah' : 'Loss'}</p>
                    <p className="text-lg font-bold text-red-400">
                      ${(analytics.avgLoss || 0).toFixed(2)}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        </div>
      )}

      {/* ==================== NEW: Equity Curve ==================== */}
      {analytics.equityCurve && analytics.equityCurve.length > 1 && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.25 }}
        >
          <Card className="bg-lux-bg-card dark:bg-gradient-to-br dark:from-[#0a0c12] dark:to-[#080a14] border-lux-border dark:border-blue-900/30">
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <Activity className="w-5 h-5 text-blue-400" />
                {language === 'id' ? 'Kurva Ekuitas' : 'Equity Curve'}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="h-[300px]">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={analytics.equityCurve}>
                    <defs>
                      <linearGradient id="equityGradient" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3} />
                        <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <XAxis
                      dataKey="date"
                      tick={{ fill: 'rgba(255,255,255,0.4)', fontSize: 10 }}
                      axisLine={false}
                      tickLine={false}
                      tickFormatter={(value: string) => {
                        const d = new Date(value)
                        return `${d.getMonth() + 1}/${d.getDate()}`
                      }}
                    />
                    <YAxis
                      tick={{ fill: 'rgba(255,255,255,0.3)', fontSize: 10 }}
                      axisLine={false}
                      tickLine={false}
                      tickFormatter={(value: number) => `$${value.toFixed(0)}`}
                    />
                    <Tooltip
                      contentStyle={{
                        background: '#0a0c12',
                        border: '1px solid rgba(59,130,246,0.3)',
                        borderRadius: 8
                      }}
                      formatter={(value: number) => [`$${value.toFixed(2)}`, 'Equity']}
                      labelFormatter={(label: string) => {
                        const d = new Date(label)
                        return d.toLocaleDateString()
                      }}
                    />
                    <Area
                      type="monotone"
                      dataKey="equity"
                      stroke="#3b82f6"
                      strokeWidth={2}
                      fill="url(#equityGradient)"
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>
        </motion.div>
      )}

      {/* ==================== NEW: Session Performance ==================== */}
      {analytics.sessionPerformance && analytics.sessionPerformance.length > 0 && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
        >
          <Card className="bg-lux-bg-card dark:bg-gradient-to-br dark:from-[#0a0c12] dark:to-[#080a14] border-lux-border dark:border-blue-900/30">
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <Globe className="w-5 h-5 text-blue-400" />
                {language === 'id' ? 'Performa Sesi' : 'Session Performance'}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {analytics.sessionPerformance.map((session: any, index: number) => {
                  const maxPL = Math.max(...analytics.sessionPerformance.map((s: any) => Math.abs(s.pl)))
                  const barWidth = maxPL > 0 ? (Math.abs(session.pl) / maxPL) * 100 : 0
                  const sessionColors: Record<string, string> = {
                    'London': '#3b82f6',
                    'New York': '#22c55e',
                    'Asia': '#f59e0b',
                    'Off-Market': '#6b7280',
                  }
                  const barColor = sessionColors[session.session] || '#3b82f6'

                  return (
                    <div key={session.session} className="space-y-1.5">
                      <div className="flex items-center justify-between text-sm">
                        <div className="flex items-center gap-2">
                          <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: barColor }} />
                          <span className="text-lux-text-primary dark:text-gray-300 font-medium">{session.session}</span>
                          <span className="text-lux-text-muted dark:text-gray-500 text-xs">
                            ({session.trades} {language === 'id' ? 'trade' : 'trades'})
                          </span>
                        </div>
                        <div className="flex items-center gap-3">
                          <span className="text-xs text-lux-text-secondary dark:text-gray-400">
                            {session.winRate.toFixed(1)}% WR
                          </span>
                          <span className={`font-bold ${session.pl >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                            {session.pl >= 0 ? '+' : ''}${session.pl.toFixed(2)}
                          </span>
                        </div>
                      </div>
                      <div className="h-3 bg-lux-surface-hover dark:bg-white/5 rounded-full overflow-hidden">
                        <div
                          className="h-full rounded-full transition-all duration-500"
                          style={{
                            width: `${barWidth}%`,
                            backgroundColor: session.pl >= 0 ? barColor : '#ef4444',
                            opacity: 0.8,
                          }}
                        />
                      </div>
                    </div>
                  )
                })}
              </div>
            </CardContent>
          </Card>
        </motion.div>
      )}

      {/* Symbol Performance */}
      {analytics.symbolPerformance && analytics.symbolPerformance.length > 0 && (
        <Card className="bg-lux-bg-card dark:bg-gradient-to-br dark:from-[#0a0c12] dark:to-[#080a14] border-lux-border dark:border-blue-900/30">
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <Target className="w-5 h-5 text-blue-400" />
              {language === 'id' ? 'Performa Symbol' : 'Symbol Performance'}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-[300px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={analytics.symbolPerformance.slice(0, 10)}>
                  <XAxis
                    dataKey="symbol"
                    tick={{ fill: 'rgba(255,255,255,0.5)', fontSize: 11 }}
                    axisLine={false}
                    tickLine={false}
                  />
                  <YAxis
                    tick={{ fill: 'rgba(255,255,255,0.3)', fontSize: 10 }}
                    axisLine={false}
                    tickLine={false}
                  />
                  <Tooltip
                    contentStyle={{
                      background: '#0a0c12',
                      border: '1px solid rgba(59,130,246,0.3)',
                      borderRadius: 8
                    }}
                    formatter={(value: number) => `$${value.toFixed(2)}`}
                  />
                  <Bar dataKey="pl" radius={[4, 4, 0, 0]}>
                    {analytics.symbolPerformance.slice(0, 10).map((entry: any, index: number) => (
                      <Cell key={`cell-${index}`} fill={entry.pl >= 0 ? '#22c55e' : '#ef4444'} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Monthly Performance */}
      {analytics.monthlyPerformance && analytics.monthlyPerformance.length > 0 && (
        <Card className="bg-lux-bg-card dark:bg-gradient-to-br dark:from-[#0a0c12] dark:to-[#080a14] border-lux-border dark:border-blue-900/30">
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <DollarSign className="w-5 h-5 text-blue-400" />
              {language === 'id' ? 'Performa Bulanan' : 'Monthly Performance'}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-[300px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={analytics.monthlyPerformance}>
                  <XAxis
                    dataKey="month"
                    tick={{ fill: 'rgba(255,255,255,0.5)', fontSize: 11 }}
                    axisLine={false}
                    tickLine={false}
                  />
                  <YAxis
                    tick={{ fill: 'rgba(255,255,255,0.3)', fontSize: 10 }}
                    axisLine={false}
                    tickLine={false}
                  />
                  <Tooltip
                    contentStyle={{
                      background: '#0a0c12',
                      border: '1px solid rgba(59,130,246,0.3)',
                      borderRadius: 8
                    }}
                    formatter={(value: number) => `$${value.toFixed(2)}`}
                  />
                  <Bar dataKey="pl" radius={[4, 4, 0, 0]}>
                    {analytics.monthlyPerformance.map((entry: any, index: number) => (
                      <Cell key={`cell-${index}`} fill={entry.pl >= 0 ? '#22c55e' : '#ef4444'} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Day of Week Performance */}
      {analytics.dayOfWeekPerformance && analytics.dayOfWeekPerformance.length > 0 && (
        <Card className="bg-lux-bg-card dark:bg-gradient-to-br dark:from-[#0a0c12] dark:to-[#080a14] border-lux-border dark:border-blue-900/30">
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <Activity className="w-5 h-5 text-blue-400" />
              {language === 'id' ? 'Performa Hari' : 'Day of Week Performance'}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-[300px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={analytics.dayOfWeekPerformance}>
                  <XAxis
                    dataKey="day"
                    tick={{ fill: 'rgba(255,255,255,0.5)', fontSize: 10 }}
                    axisLine={false}
                    tickLine={false}
                  />
                  <YAxis
                    tick={{ fill: 'rgba(255,255,255,0.3)', fontSize: 10 }}
                    axisLine={false}
                    tickLine={false}
                  />
                  <Tooltip
                    contentStyle={{
                      background: '#0a0c12',
                      border: '1px solid rgba(59,130,246,0.3)',
                      borderRadius: 8
                    }}
                    formatter={(value: number) => `$${value.toFixed(2)}`}
                  />
                  <Bar dataKey="pl" radius={[4, 4, 0, 0]}>
                    {analytics.dayOfWeekPerformance.map((entry: any, index: number) => (
                      <Cell key={`cell-${index}`} fill={entry.pl >= 0 ? '#22c55e' : '#ef4444'} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Trade Duration & R:R Ratio */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card className="bg-lux-bg-card dark:bg-gradient-to-br dark:from-[#0a0c12] dark:to-[#080a14] border-lux-border dark:border-blue-900/30">
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <Clock className="w-5 h-5 text-blue-400" />
              {language === 'id' ? 'Durasi Rata-rata' : 'Avg Trade Duration'}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold text-lux-text-primary dark:text-white">
              {analytics.avgTradeDuration > 0
                ? `${Math.round(analytics.avgTradeDuration)} min`
                : language === 'id' ? 'N/A' : 'N/A'
              }
            </p>
          </CardContent>
        </Card>

        <Card className="bg-lux-bg-card dark:bg-gradient-to-br dark:from-[#0a0c12] dark:to-[#080a14] border-lux-border dark:border-blue-900/30">
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <Target className="w-5 h-5 text-blue-400" />
              {language === 'id' ? 'R:R Ratio Rata-rata' : 'Avg R:R Ratio'}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold text-lux-text-primary dark:text-white">
              {analytics.avgRRRatio > 0
                ? analytics.avgRRRatio.toFixed(2)
                : language === 'id' ? 'N/A' : 'N/A'
              }
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Setup Type Performance */}
      {analytics.setupTypePerformance && analytics.setupTypePerformance.length > 0 && (
        <Card className="bg-lux-bg-card dark:bg-gradient-to-br dark:from-[#0a0c12] dark:to-[#080a14] border-lux-border dark:border-blue-900/30">
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <Target className="w-5 h-5 text-blue-400" />
              {language === 'id' ? 'Performa Setup Type' : 'Setup Type Performance'}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-[300px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={analytics.setupTypePerformance} layout="vertical">
                  <XAxis
                    type="number"
                    tick={{ fill: 'rgba(255,255,255,0.3)', fontSize: 10 }}
                    axisLine={false}
                    tickLine={false}
                  />
                  <YAxis
                    dataKey="setup_type"
                    type="category"
                    width={100}
                    tick={{ fill: 'rgba(255,255,255,0.5)', fontSize: 11 }}
                    axisLine={false}
                    tickLine={false}
                  />
                  <Tooltip
                    contentStyle={{
                      background: '#0a0c12',
                      border: '1px solid rgba(59,130,246,0.3)',
                      borderRadius: 8
                    }}
                    formatter={(value: number) => `$${value.toFixed(2)}`}
                  />
                  <Bar dataKey="pl" radius={[0, 4, 4, 0]}>
                    {analytics.setupTypePerformance.map((entry: any, index: number) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}