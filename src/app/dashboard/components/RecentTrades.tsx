'use client'

import { motion } from 'framer-motion'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { formatCurrency } from '@/lib/supabase'
import { Pencil } from 'lucide-react'

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
  onEdit?: (trade: Trade) => void
  maxTrades?: number
}

export const RecentTrades: React.FC<RecentTradesProps> = ({
  trades,
  onView,
  onEdit,
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
      <Card className="bg-lux-bg-card dark:bg-gradient-to-br dark:from-[#0f0b18] dark:to-[#12091a] border-lux-border dark:border-purple-900/30">
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-lg">Recent Trades</CardTitle>
          <span className="text-xs text-lux-text-secondary dark:text-gray-400">{trades.length} total</span>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            {displayTrades.map((trade, index) => (
              <motion.div
                key={trade.id}
                className="flex items-center justify-between p-3 rounded-lg bg-lux-surface-hover dark:bg-white/5 hover:bg-lux-surface-hover dark:hover:bg-white/10 transition-all cursor-pointer group"
                onClick={() => onView(trade)}
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.3, delay: index * 0.05 }}
                whileHover={{ x: 4 }}
              >
                <div className="flex items-center gap-3 min-w-0 flex-1">
                  <motion.div
                    className={`w-2 h-2 rounded-full shrink-0 ${trade.profit_loss >= 0 ? 'bg-emerald-400' : 'bg-red-400'}`}
                    animate={{ scale: [1, 1.2, 1] }}
                    transition={{ duration: 2, repeat: Infinity, delay: index * 0.2 }}
                  />
                  <span className="font-bold truncate">{trade.symbol}</span>
                  <Badge variant={trade.type === 'BUY' ? 'default' : 'destructive'} className="text-xs shrink-0">
                    {trade.type}
                  </Badge>
                  <span className="text-xs text-lux-text-muted dark:text-gray-500 hidden sm:inline">{trade.session || '-'}</span>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <span className={`font-bold ${trade.profit_loss >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                    {trade.profit_loss >= 0 ? '+' : ''}{formatCurrency(trade.profit_loss)}
                  </span>
                  {onEdit && (
                    <button
                      onClick={(e) => { e.stopPropagation(); onEdit(trade) }}
                      className="opacity-0 group-hover:opacity-100 transition-opacity p-1.5 rounded-lg hover:bg-white/10"
                      title="Edit trade"
                    >
                      <Pencil className="w-3.5 h-3.5 text-gray-400 hover:text-purple-400" />
                    </button>
                  )}
                </div>
              </motion.div>
            ))}
          </div>
        </CardContent>
      </Card>
    </motion.div>
  )
}