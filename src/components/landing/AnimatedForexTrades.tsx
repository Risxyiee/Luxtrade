'use client'

import React, { useState, useEffect, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
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
  const intervalRefs = useRef<NodeJS.Timeout[]>([])

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
    }, 4000) // Slower cycle (4s instead of 3s)
    intervalRefs.current.push(cycleInterval)

    const priceInterval = setInterval(() => {
      const updates: {[key: number]: number} = {}
      visibleTrades.forEach((tradeIdx, i) => {
        const basePnl = FOREX_TRADES[tradeIdx].pnl
        const fluctuation = (Math.random() - 0.5) * 20
        updates[i] = basePnl + fluctuation
      })
      setLivePrices(updates)
    }, 1500) // Slower price update (1.5s instead of 800ms)
    intervalRefs.current.push(priceInterval)

    return () => {
      intervalRefs.current.forEach(id => clearInterval(id))
      intervalRefs.current = []
    }
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
            className="flex items-center justify-between p-3 rounded-xl backdrop-blur-md bg-white/[0.03] border border-white/[0.08] hover:bg-white/[0.03] hover:border-[#d5ff45]/30 transition-all duration-200"
            initial={false}
            animate={{ opacity: isExiting ? 0 : 1, x: isExiting ? -100 : isEntering ? 100 : 0, scale: isExiting ? 0.9 : 1 }}
            transition={{ duration: 0.3, ease: 'easeOut' }}
          >
            <div className="flex items-center gap-3">
              <div className={`w-10 h-10 rounded-lg flex items-center justify-center backdrop-blur-sm ${isProfit ? 'bg-gradient-to-br from-emerald-500/20 to-emerald-600/10 border border-emerald-500/30' : 'bg-gradient-to-br from-red-500/20 to-red-600/10 border border-red-500/30'}`}>
                {isProfit ? <TrendingUp className="w-5 h-5 text-emerald-400" /> : <TrendingDown className="w-5 h-5 text-red-400" />}
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium text-white tracking-wide">
                    {trade.pair}
                  </span>
                  <span className="text-[9px] px-2.5 py-0.5 rounded-full bg-[#d5ff45]/15 border border-[#d5ff45]/30 text-[#d5ff45] font-medium backdrop-blur-sm">
                    {trade.session}
                  </span>
                </div>
                <div className="text-[10px] text-[#939599] flex items-center gap-2">
                  <span className={`font-medium ${trade.type === 'BUY' ? 'text-emerald-400' : 'text-red-400'}`}>
                    {trade.type}
                  </span>
                  <span className="font-mono">@ {trade.price.toFixed(trade.price > 100 ? 2 : 4)}</span>
                </div>
              </div>
            </div>
            <div className="text-right">
              <div
                className={`text-sm font-medium font-mono ${isLiveProfit ? 'text-emerald-400' : 'text-red-400'}`}
                key={Math.round(livePnl)}
              >
                {isLiveProfit ? '+' : ''}{livePnl.toFixed(2)}
              </div>
              <div className="flex items-center justify-end gap-1.5 mt-0.5">
                <div className={`w-2 h-2 rounded-full ${isLiveProfit ? 'bg-emerald-400' : 'bg-red-400'}`} />
                <span className="text-[10px] text-[#939599] font-semibold">
                  Demo
                </span>
              </div>
            </div>
          </motion.div>
        )
      })}
    </div>
  )
}
