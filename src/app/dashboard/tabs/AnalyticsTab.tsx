'use client'

import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, LineChart, Line } from 'recharts'
import { TrendingUp, TrendingDown, Target, Clock, DollarSign, Activity } from 'lucide-react'

interface AnalyticsTabProps {
  language: 'id' | 'en'
}

const COLORS = ['#a855f7', '#f59e0b', '#22c55e', '#3b82f6', '#ec4899']

export default function AnalyticsTab({ language }: AnalyticsTabProps) {
  const [analytics, setAnalytics] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [period, setPeriod] = useState('all')

  useEffect(() => {
    fetchAnalytics()
  }, [period])

  const fetchAnalytics = async () => {
    try {
      setLoading(true)
      const token = localStorage.getItem('sb-access-token')
      const res = await fetch(`/api/analytics?period=${period}`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
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
          <Card key={i} className="bg-gradient-to-br from-[#0f0b18]/80 to-[#12091a]/80 backdrop-blur-sm border border-white/10">
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
      <Card className="bg-gradient-to-br from-[#0f0b18] to-[#12091a] border-purple-900/30">
        <CardContent className="py-20 text-center">
          <Activity className="w-12 h-12 text-purple-400 mx-auto mb-4" />
          <h3 className="text-lg font-semibold mb-2">No Data Available</h3>
          <p className="text-gray-400">Start logging trades to see analytics</p>
        </CardContent>
      </Card>
    )
  }

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
                ? 'bg-gradient-to-r from-purple-500 to-violet-600 text-white shadow-lg shadow-purple-500/30'
                : 'bg-white/5 text-gray-400 hover:bg-white/10 hover:text-white'
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
        <Card className="bg-gradient-to-br from-purple-500/15 via-violet-500/10 to-pink-500/10 backdrop-blur-sm border border-purple-500/30">
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <TrendingUp className="w-5 h-5 text-purple-400" />
              {language === 'id' ? 'Performa Hari Ini' : "Today's Performance"}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-3 gap-4">
              <div>
                <p className="text-xs text-gray-400 mb-1">{language === 'id' ? 'Jumlah Trade' : 'Trades'}</p>
                <p className="text-2xl font-bold text-white">{analytics.today.trades}</p>
              </div>
              <div>
                <p className="text-xs text-gray-400 mb-1">{language === 'id' ? 'Profit/Loss' : 'P/L'}</p>
                <p className={`text-2xl font-bold ${analytics.today.pl >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                  ${analytics.today.pl.toFixed(2)}
                </p>
              </div>
              <div>
                <p className="text-xs text-gray-400 mb-1">{language === 'id' ? 'Win Rate' : 'Win Rate'}</p>
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
              <p className="text-sm text-gray-400">
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

      {/* Symbol Performance */}
      {analytics.symbolPerformance && analytics.symbolPerformance.length > 0 && (
        <Card className="bg-gradient-to-br from-[#0f0b18] to-[#12091a] border-purple-900/30">
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <Target className="w-5 h-5 text-purple-400" />
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
                      background: '#0f0b18',
                      border: '1px solid rgba(139,92,246,0.3)',
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
        <Card className="bg-gradient-to-br from-[#0f0b18] to-[#12091a] border-purple-900/30">
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <DollarSign className="w-5 h-5 text-purple-400" />
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
                      background: '#0f0b18',
                      border: '1px solid rgba(139,92,246,0.3)',
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
        <Card className="bg-gradient-to-br from-[#0f0b18] to-[#12091a] border-purple-900/30">
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <Activity className="w-5 h-5 text-purple-400" />
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
                      background: '#0f0b18',
                      border: '1px solid rgba(139,92,246,0.3)',
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
        <Card className="bg-gradient-to-br from-[#0f0b18] to-[#12091a] border-purple-900/30">
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <Clock className="w-5 h-5 text-purple-400" />
              {language === 'id' ? 'Durasi Rata-rata' : 'Avg Trade Duration'}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold text-white">
              {analytics.avgTradeDuration > 0
                ? `${Math.round(analytics.avgTradeDuration)} min`
                : language === 'id' ? 'N/A' : 'N/A'
              }
            </p>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-[#0f0b18] to-[#12091a] border-purple-900/30">
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <Target className="w-5 h-5 text-purple-400" />
              {language === 'id' ? 'R:R Ratio Rata-rata' : 'Avg R:R Ratio'}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold text-white">
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
        <Card className="bg-gradient-to-br from-[#0f0b18] to-[#12091a] border-purple-900/30">
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <Target className="w-5 h-5 text-purple-400" />
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
                      background: '#0f0b18',
                      border: '1px solid rgba(139,92,246,0.3)',
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
