'use client'

import { memo } from 'react'
import { TrendingUp, TrendingDown } from 'lucide-react'

interface PNLShareCardProps {
  symbol: string
  type: string
  entryPrice: number
  exitPrice: number
  lotSize: number
  profitLoss: number
  session: string
  date: string
}

const PNLShareCard = memo(function PNLShareCard({
  symbol,
  type,
  entryPrice,
  exitPrice,
  lotSize,
  profitLoss,
  session,
  date,
}: PNLShareCardProps) {
  const isProfit = profitLoss >= 0

  return (
    <div className="w-80 rounded-2xl overflow-hidden bg-gradient-to-br from-[#0a0c12] to-[#0f1219] border border-blue-500/20 shadow-2xl">
      {/* Header */}
      <div className="px-5 pt-5 pb-3">
        <div className="flex items-center justify-between mb-2">
          <span className="text-xl font-bold text-white">{symbol}</span>
          <span className={`px-2 py-0.5 rounded text-xs font-semibold ${
            type === 'Buy' ? 'bg-emerald-500/20 text-emerald-400' : 'bg-red-500/20 text-red-400'
          }`}>
            {type}
          </span>
        </div>
        <div className="text-xs text-gray-500">{session} · {date}</div>
      </div>

      {/* P&L Display */}
      <div className="px-5 py-4 text-center">
        <div className="flex items-center justify-center gap-2 mb-1">
          {isProfit ? (
            <TrendingUp className="w-5 h-5 text-emerald-400" />
          ) : (
            <TrendingDown className="w-5 h-5 text-red-400" />
          )}
          <span className={`text-3xl font-bold ${isProfit ? 'text-emerald-400' : 'text-red-400'}`}>
            {isProfit ? '+' : ''}{profitLoss.toFixed(2)}
          </span>
        </div>
        <span className="text-xs text-gray-500 uppercase tracking-wider">Profit &amp; Loss</span>
      </div>

      {/* Trade Details */}
      <div className="px-5 pb-5 space-y-2">
        <div className="flex justify-between text-sm">
          <span className="text-gray-500">Entry</span>
          <span className="text-white font-mono">{entryPrice}</span>
        </div>
        <div className="flex justify-between text-sm">
          <span className="text-gray-500">Exit</span>
          <span className="text-white font-mono">{exitPrice}</span>
        </div>
        <div className="flex justify-between text-sm">
          <span className="text-gray-500">Lot Size</span>
          <span className="text-white font-mono">{lotSize}</span>
        </div>
      </div>

      {/* Footer */}
      <div className="px-5 py-3 bg-white/5 border-t border-white/5 text-center">
        <span className="text-[10px] text-gray-600 uppercase tracking-widest">LuxTradee</span>
      </div>
    </div>
  )
})

export default PNLShareCard
