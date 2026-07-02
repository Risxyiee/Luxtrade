'use client'

import React, { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import { TrendingUp, TrendingDown } from 'lucide-react'

const FOREX_TRADES = [
  { pair: 'EUR/USD', type: 'BUY' as const, price: 1.0850, pnl: 245.00, session: 'London' },
  { pair: 'GBP/JPY', type: 'SELL' as const, price: 188.450, pnl: -89.50, session: 'London' },
  { pair: 'XAU/USD', type: 'BUY' as const, price: 2340.50, pnl: 312.00, session: 'New York' },
  { pair: 'USD/JPY', type: 'SELL' as const, price: 154.320, pnl: 178.50, session: 'Tokyo' },
  { pair: 'GBP/USD', type: 'BUY' as const, price: 1.2720, pnl: -56.00, session: 'London' },
  { pair: 'AUD/USD', type: 'BUY' as const, price: 0.6540, pnl: 423.00, session: 'Sydney' },
  { pair: 'USD/CHF', type: 'SELL' as const, price: 0.8920, pnl: 167.00, session: 'London' },
  { pair: 'EUR/GBP', type: 'BUY' as const, price: 0.8530, pnl: 289.00, session: 'London' },
]

export default function AnimatedForexTrades() {
  const [visibleTrades, setVisibleTrades] = useState([0, 1, 2])
  const [animatingIn, setAnimatingIn] = useState<number | null>(null)
  const [animatingOut, setAnimatingOut] = useState<number | null>(null)
  const [livePrices, setLivePrices] = useState<{[key: number]: number}>({})

  useEffect(() => {
    const cycleInterval = setInterval(() => {
      setAnimatingOut(visibleTrades[0])
      setTimeout(() => {
        const nextIndex = (visibleTrades[2] + 1) % FOREX_TRADES.length
        setVisibleTrades(prev => [prev[1], prev[2], nextIndex])
        setAnimatingIn(nextIndex)
        setAnimatingOut(null)
        setTimeout(() => setAnimatingIn(null), 500)
      }, 300)
    }, 3000)
    return () => clearInterval(cycleInterval)
  }, [visibleTrades])

  useEffect(() => {
    const priceInterval = setInterval(() => {
      const updates: {[key: number]: number} = {}
      visibleTrades.forEach((tradeIdx, i) => {
        const basePnl = FOREX_TRADES[tradeIdx].pnl
        const fluctuation = (Math.random() - 0.5) * 20
        updates[i] = basePnl + fluctuation
      })
      setLivePrices(updates)
    }, 800)
    return () => clearInterval(priceInterval)
  }, [visibleTrades])

  return (
    <div className="space-y-2 overflow-hidden">
      {visibleTrades.map((tradeIdx, i) => {
        const trade = FOREX_TRADES[tradeIdx]
        const isProfit = trade.pnl >= 0
        const livePnl = livePrices[i] ?? trade.pnl
        const isLiveProfit = livePnl >= 0
        const isEntering = animatingIn === tradeIdx
        const isExiting = animatingOut === tradeIdx

        return (
          <motion.div
            key={`${tradeIdx}-${i}`}
            className="flex items-center justify-between p-3 rounded-xl backdrop-blur-md bg-[var(--lux-inline-hover-bg)] border border-[var(--lux-inline-border)] hover:bg-[var(--lux-inline-hover-bg)] hover:border-purple-500/30 hover:shadow-[0_0_20px_rgba(139,92,246,0.2)] transition-all duration-300"
            initial={false}
            animate={{ opacity: isExiting ? 0 : 1, x: isExiting ? -100 : isEntering ? 100 : 0, scale: isExiting ? 0.9 : 1 }}
            transition={{ duration: 0.3, ease: 'easeOut' }}
            layout
          >
            <div className="flex items-center gap-3">
              <motion.div
                className={`w-10 h-10 rounded-lg flex items-center justify-center backdrop-blur-sm ${isProfit ? 'bg-gradient-to-br from-emerald-500/20 to-emerald-600/10 border border-emerald-500/30' : 'bg-gradient-to-br from-red-500/20 to-red-600/10 border border-red-500/30'}`}
                animate={{ scale: [1, 1.1, 1], boxShadow: isProfit ? ['0 0 0 0 rgba(16, 185, 129, 0.4)', '0 0 25px 8px rgba(16, 185, 129, 0.15)', '0 0 0 0 rgba(16, 185, 129, 0)'] : ['0 0 0 0 rgba(239, 68, 68, 0.4)', '0 0 25px 8px rgba(239, 68, 68, 0.15)', '0 0 0 0 rgba(239, 68, 68, 0)'] }}
                transition={{ duration: 2, repeat: Infinity }}
              >
                {isProfit ? <TrendingUp className="w-5 h-5 text-emerald-400" /> : <TrendingDown className="w-5 h-5 text-red-400" />}
              </motion.div>
              <div>
                <div className="flex items-center gap-2">
                  <motion.span className="text-sm font-extrabold text-[var(--lux-text-primary)] tracking-wide" animate={{ opacity: [1, 0.8, 1] }} transition={{ duration: 0.5, repeat: Infinity, repeatDelay: 2 }}>
                    {trade.pair}
                  </motion.span>
                  <motion.span className="text-[9px] px-2.5 py-0.5 rounded-full bg-purple-500/20 border border-purple-500/30 text-purple-300 font-bold backdrop-blur-sm" animate={{ opacity: [0.6, 1, 0.6] }} transition={{ duration: 2, repeat: Infinity }}>
                    {trade.session}
                  </motion.span>
                </div>
                <div className="text-[10px] text-[var(--lux-text-subtitle)] flex items-center gap-2">
                  <motion.span className={`font-bold ${trade.type === 'BUY' ? 'text-emerald-400' : 'text-red-400'}`} animate={{ opacity: [1, 0.7, 1] }} transition={{ duration: 1, repeat: Infinity }}>
                    {trade.type}
                  </motion.span>
                  <span className="font-mono">@ {trade.price.toFixed(trade.price > 100 ? 2 : 4)}</span>
                </div>
              </div>
            </div>
            <div className="text-right">
              <motion.div
                className={`text-sm font-extrabold font-mono ${isLiveProfit ? 'text-emerald-400' : 'text-red-400'}`}
                animate={{ opacity: [1, 0.8, 1], scale: livePnl !== trade.pnl ? [1, 1.08, 1] : 1 }}
                transition={{ duration: 0.8, repeat: Infinity }}
                key={livePnl}
              >
                {isLiveProfit ? '+' : ''}{livePnl.toFixed(2)}
              </motion.div>
              <div className="flex items-center justify-end gap-1.5 mt-0.5">
                <motion.div className={`w-2 h-2 rounded-full ${isLiveProfit ? 'bg-emerald-400' : 'bg-red-400'}`} animate={{ opacity: [1, 0.3, 1], scale: [1, 1.3, 1] }} transition={{ duration: 0.8, repeat: Infinity }} />
                <motion.span className="text-[10px] text-[var(--lux-text-subtitle)] font-semibold" animate={{ opacity: [0.5, 1, 0.5] }} transition={{ duration: 1.5, repeat: Infinity }}>
                  Demo
                </motion.span>
              </div>
            </div>
          </motion.div>
        )
      })}
      <motion.div className="flex justify-center pt-3" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 1 }}>
        <motion.div className="flex gap-1.5" animate={{ y: [0, 4, 0] }} transition={{ duration: 1.5, repeat: Infinity }}>
          {[0, 1, 2].map((i) => (
            <motion.div key={i} className="w-2 h-2 rounded-full bg-gradient-to-r from-purple-500 to-blue-500" animate={{ opacity: [0.3, 1, 0.3] }} transition={{ duration: 1, delay: i * 0.2, repeat: Infinity }} />
          ))}
        </motion.div>
      </motion.div>
    </div>
  )
}