'use client'

import { motion } from 'framer-motion'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { formatCurrency } from '@/lib/supabase'

interface Trade {
  id: string
  symbol: string
  type: 'BUY' | 'SELL'
  profit_loss: number
  session: string | null
}

interface RecentTradesProps {
  trades: Trade[]
  onView: (trade: Trade) => void
  maxTrades?: number
}

export const RecentTrades: React.FC<RecentTradesProps> = ({
  trades,
  onView,
  maxTrades = 5
}) => {
  const displayTrades = trades.slice(0, maxTrades)

  if (displayTrades.length === 0) return null

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, delay: 0.3 }}
    >
      <Card className="bg-gradient-to-br from-[#0f0b18] to-[#12091a] border-purple-900/30">
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-lg">Recent Trades</CardTitle>
          <span className="text-xs text-gray-400">{trades.length} total</span>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            {displayTrades.map((trade, index) => (
              <motion.div
                key={trade.id}
                className="flex items-center justify-between p-3 rounded-lg bg-white/5 hover:bg-white/10 transition-all cursor-pointer group"
                onClick={() => onView(trade)}
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.3, delay: index * 0.05 }}
                whileHover={{ x: 4 }}
              >
                <div className="flex items-center gap-3">
                  <motion.div
                    className={`w-2 h-2 rounded-full ${trade.profit_loss >= 0 ? 'bg-emerald-400' : 'bg-red-400'}`}
                    animate={{ scale: [1, 1.2, 1] }}
                    transition={{ duration: 2, repeat: Infinity, delay: index * 0.2 }}
                  />
                  <span className="font-bold">{trade.symbol}</span>
                  <Badge variant={trade.type === 'BUY' ? 'default' : 'destructive'} className="text-xs">
                    {trade.type}
                  </Badge>
                  <span className="text-xs text-gray-500 hidden sm:inline">{trade.session || '-'}</span>
                </div>
                <span className={`font-bold ${trade.profit_loss >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                  {trade.profit_loss >= 0 ? '+' : ''}{formatCurrency(trade.profit_loss)}
                </span>
              </motion.div>
            ))}
          </div>
        </CardContent>
      </Card>
    </motion.div>
  )
}
