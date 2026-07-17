'use client'

import { motion } from 'framer-motion'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { BarChart, TrendingUp, TrendingDown, DollarSign } from 'lucide-react'

interface MarketItem {
  symbol: string
  name: string
  price: number
  change: number
  changePercent: number
}

interface MarketOverviewProps {
  markets?: MarketItem[]
  language: 'id' | 'en'
}

export const MarketOverview: React.FC<MarketOverviewProps> = ({
  markets,
  language
}) => {
  // Default market data if none provided
  const defaultMarkets: MarketItem[] = [
    { symbol: 'EUR/USD', name: 'Euro', price: 1.0845, change: 0.0023, changePercent: 0.21 },
    { symbol: 'GBP/USD', name: 'Pound', price: 1.2634, change: -0.0012, changePercent: -0.09 },
    { symbol: 'USD/JPY', name: 'Yen', price: 149.87, change: 0.0156, changePercent: 0.01 },
    { symbol: 'XAU/USD', name: 'Gold', price: 2034.50, change: 12.30, changePercent: 0.61 },
  ]

  const displayMarkets = markets && markets.length > 0 ? markets : defaultMarkets

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, delay: 0.2 }}
    >
      <Card className="bg-lux-bg-card dark:bg-gradient-to-br dark:from-[#0f0b18]/80 dark:to-[#12091a]/80 backdrop-blur-md border-lux-border dark:border-purple-500/20 transition-all duration-300 hover:border-purple-500/40 hover:shadow-lg hover:shadow-purple-500/10">
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <BarChart className="w-5 h-5 text-purple-400" />
            {language === 'id' ? 'Ikhtisar Pasar' : 'Market Overview'}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {displayMarkets.map((market, index) => (
              <motion.div
                key={market.symbol}
                className="flex items-center justify-between p-4 rounded-lg bg-lux-surface-hover dark:bg-white/5 hover:bg-lux-surface-hover dark:hover:bg-white/10 transition-all"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.3, delay: index * 0.05 }}
              >
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg bg-purple-500/20 flex items-center justify-center">
                    <DollarSign className="w-5 h-5 text-purple-400" />
                  </div>
                  <div>
                    <p className="font-bold text-lux-text-primary dark:text-white">{market.symbol}</p>
                    <p className="text-xs text-lux-text-secondary dark:text-gray-400">{market.name}</p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="font-bold text-lux-text-primary dark:text-white">{market.price.toLocaleString()}</p>
                  <div className={`flex items-center gap-1 text-xs ${
                    market.change >= 0 ? 'text-emerald-400' : 'text-red-400'
                  }`}>
                    {market.change >= 0 ? (
                      <TrendingUp className="w-3 h-3" />
                    ) : (
                      <TrendingDown className="w-3 h-3" />
                    )}
                    <span>{market.change >= 0 ? '+' : ''}{market.changePercent.toFixed(2)}%</span>
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
        </CardContent>
      </Card>
    </motion.div>
  )
}
