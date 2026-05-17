'use client'

import { useState, useEffect, useCallback, useMemo, useRef } from 'react'
import { motion } from 'framer-motion'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Lock, Grid3X3, BarChart3, Zap } from 'lucide-react'

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

interface HeatmapTabProps {
  isPro: boolean
  onUpgrade: () => void
  trades: Trade[]
}

// Component
function HeatmapTab({ isPro, onUpgrade, trades }: HeatmapTabProps) {
  // Calculate heatmap data by day and session
  const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
  const sessions = ['Asia', 'London', 'New York', 'Off-Market']

  const heatmapData = trades.reduce((acc, trade) => {
    const day = new Date(trade.open_time).getDay()
    const session = trade.session || 'Off-Market'
    const key = `${day}-${session}`
    if (!acc[key]) {
      acc[key] = { totalPL: 0, count: 0 }
    }
    acc[key].totalPL += trade.profit_loss
    acc[key].count++
    return acc
  }, {} as Record<string, { totalPL: number; count: number }>)

  // Find max/min for color scaling
  const values = Object.values(heatmapData).map(d => d.totalPL)
  const maxPL = Math.max(...values, 1)
  const minPL = Math.min(...values, -1)
  const range = maxPL - minPL || 1

  // Symbol performance
  const symbolStats = trades.reduce((acc, trade) => {
    if (!acc[trade.symbol]) {
      acc[trade.symbol] = { wins: 0, losses: 0, totalPL: 0, count: 0 }
    }
    acc[trade.symbol].count++
    acc[trade.symbol].totalPL += trade.profit_loss
    if (trade.profit_loss >= 0) acc[trade.symbol].wins++
    else acc[trade.symbol].losses++
    return acc
  }, {} as Record<string, { wins: number; losses: number; totalPL: number; count: number }>)

  const topSymbols = Object.entries(symbolStats)
    .sort((a, b) => b[1].totalPL - a[1].totalPL)
    .slice(0, 6)

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
            <h3 className="text-lg font-bold text-purple-400 mb-2">Market Heatmap - PRO Feature</h3>
            <p className="text-gray-400 mb-4">Visualize market strength across all pairs</p>
            <Button onClick={onUpgrade} className="bg-gradient-to-r from-purple-500 to-violet-600">
              <Zap className="w-4 h-4 mr-2" /> Upgrade to PRO
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-6">
          {/* Day/Session Heatmap */}
          <Card className="bg-gradient-to-br from-[#0f0b18] to-[#12091a] border-purple-900/30">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg">
                <Grid3X3 className="w-5 h-5 text-purple-400" />
                Performance Heatmap
              </CardTitle>
            </CardHeader>
            <CardContent>
              {/* Heatmap Grid */}
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr>
                      <th className="p-2 text-left text-gray-400">Day / Session</th>
                      {sessions.map(s => (
                        <th key={s} className="p-2 text-center text-gray-400">{s}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {dayNames.map((day, dayIndex) => (
                      <tr key={day}>
                        <td className="p-2 text-gray-300 font-medium">{day}</td>
                        {sessions.map(session => {
                          const key = `${dayIndex}-${session}`
                          const data = heatmapData[key]
                          const pl = data?.totalPL || 0
                          const intensity = range > 0 ? Math.abs(pl - minPL) / range : 0

                          return (
                            <td key={key} className="p-1">
                              <div
                                className={`w-full h-12 rounded-lg flex flex-col items-center justify-center cursor-pointer transition-all hover:scale-105 ${
                                  pl > 0
                                    ? `bg-emerald-500/30`
                                    : pl < 0
                                      ? `bg-red-500/30`
                                      : 'bg-white/5'
                                }`}
                                style={{
                                  backgroundColor: pl > 0
                                    ? `rgba(16, 185, 129, ${0.1 + intensity * 0.5})`
                                    : pl < 0
                                      ? `rgba(239, 68, 68, ${0.1 + intensity * 0.5})`
                                      : 'rgba(255,255,255,0.05)'
                                }}
                              >
                                {data && (
                                  <>
                                    <span className={`font-bold ${pl >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                                      {pl >= 0 ? '+' : ''}{pl.toFixed(0)}
                                    </span>
                                    <span className="text-gray-400 text-[10px]">{data.count} trades</span>
                                  </>
                                )}
                              </div>
                            </td>
                          )
                        })}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Legend */}
              <div className="flex items-center justify-center gap-4 mt-4 text-xs text-gray-400">
                <div className="flex items-center gap-2">
                  <div className="w-4 h-4 rounded bg-red-500/30" />
                  <span>Loss</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-4 h-4 rounded bg-white/5" />
                  <span>No Data</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-4 h-4 rounded bg-emerald-500/30" />
                  <span>Profit</span>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Symbol Performance */}
          <Card className="bg-gradient-to-br from-[#0f0b18] to-[#12091a] border-purple-900/30">
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <BarChart3 className="w-5 h-5 text-purple-400" />
                Symbol Performance
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                {topSymbols.map(([symbol, stats]) => {
                  const winRate = ((stats.wins / stats.count) * 100).toFixed(0)
                  const isProfitable = stats.totalPL >= 0
                  return (
                    <div
                      key={symbol}
                      className={`p-3 rounded-xl border ${isProfitable ? 'bg-emerald-500/10 border-emerald-500/20' : 'bg-red-500/10 border-red-500/20'}`}
                    >
                      <div className="flex items-center justify-between mb-2">
                        <span className="font-bold">{symbol}</span>
                        <span className={`text-sm font-bold ${isProfitable ? 'text-emerald-400' : 'text-red-400'}`}>
                          {isProfitable ? '+' : ''}{stats.totalPL.toFixed(0)}
                        </span>
                      </div>
                      <div className="flex items-center justify-between text-xs text-gray-400">
                        <span>{stats.count} trades</span>
                        <span>{winRate}% WR</span>
                      </div>
                    </div>
                  )
                })}
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  )
}

export default HeatmapTab
