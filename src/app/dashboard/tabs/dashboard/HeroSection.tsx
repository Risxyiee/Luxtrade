'use client'

import { motion } from 'framer-motion'
import { Sparkles, TrendingUp, Target, Activity, Trophy } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import type { Analytics, Trade } from '@/types'

interface HeroSectionProps {
  analytics: Analytics | null
  trades: Trade[]
  language: 'id' | 'en'
  profile?: any
}

export default function HeroSection({ analytics, trades, language, profile }: HeroSectionProps) {
  const hasData = trades.length > 0

  return (
    <motion.div
      initial={{ opacity: 0, y: -20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.6, ease: "easeOut" }}
      className="relative"
    >
      <Card className="relative overflow-hidden bg-gradient-to-br from-purple-600/15 via-violet-600/10 to-amber-500/10 backdrop-blur-md border border-purple-500/20 transition-all duration-500 hover:border-purple-500/40 hover:shadow-lg hover:shadow-purple-500/10">
        {/* Animated Background Patterns - Premium Glowing Orbs */}
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          <motion.div
            className="absolute -top-24 -right-24 w-64 h-64 bg-purple-500/15 rounded-full blur-3xl"
            animate={{
              scale: [1, 1.3, 1],
              opacity: [0.3, 0.5, 0.3],
              x: [0, 20, 0],
              y: [0, -20, 0],
            }}
            transition={{
              duration: 6,
              repeat: Infinity,
              ease: "easeInOut"
            }}
          />
          <motion.div
            className="absolute -bottom-24 -left-24 w-64 h-64 bg-amber-500/15 rounded-full blur-3xl"
            animate={{
              scale: [1, 1.4, 1],
              opacity: [0.2, 0.4, 0.2],
              x: [0, -20, 0],
              y: [0, 20, 0],
            }}
            transition={{
              duration: 7,
              repeat: Infinity,
              ease: "easeInOut",
              delay: 0.5
            }}
          />
          <motion.div
            className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-48 h-48 bg-violet-500/10 rounded-full blur-3xl"
            animate={{
              scale: [1, 1.2, 1],
              opacity: [0.15, 0.3, 0.15],
            }}
            transition={{
              duration: 5,
              repeat: Infinity,
              ease: "easeInOut",
              delay: 1
            }}
          />
        </div>

        <CardContent className="relative p-6 lg:p-8">
          <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-6">
            {/* Left: Welcome Message */}
            <div className="flex-1">
              <motion.div
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.5, delay: 0.2 }}
              >
                <div className="flex items-center gap-2 mb-2">
                  <motion.div
                    animate={{ rotate: [0, 360] }}
                    transition={{ duration: 20, repeat: Infinity, ease: "linear" }}
                  >
                    <Sparkles className="w-5 h-5 text-amber-400" />
                  </motion.div>
                  <span className="text-xs font-semibold text-purple-300 uppercase tracking-wider">
                    {language === 'id' ? 'Selamat Datang Kembali' : 'Welcome Back'}
                  </span>
                </div>
                <h1 className="text-2xl lg:text-3xl font-display font-bold mb-2 bg-gradient-to-r from-white via-purple-200 to-amber-200 bg-clip-text text-transparent">
                  {language === 'id' 
                    ? `Halo, ${profile?.full_name?.split(' ')[0] || 'Trader'}! 👋`
                    : `Hello, ${profile?.full_name?.split(' ')[0] || 'Trader'}! 👋`
                  }
                </h1>
                <p className="text-sm lg:text-base text-gray-300 max-w-lg">
                  {hasData 
                    ? (language === 'id'
                        ? 'Luar biasa! Anda sudah mencatat ' + trades.length + ' trade. Terus konsisten untuk mencapai target Anda!'
                        : 'Amazing! You\'ve logged ' + trades.length + ' trades. Keep consistent to reach your targets!')
                    : (language === 'id'
                        ? 'Mulai perjalanan trading Anda dengan mencatat trade pertama hari ini!'
                        : 'Start your trading journey by logging your first trade today!')
                  }
                </p>
              </motion.div>
            </div>

            {/* Right: Quick Stats Summary */}
            {hasData && (
              <motion.div
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.5, delay: 0.3 }}
                className="flex flex-col sm:flex-row gap-3"
              >
                <div className="bg-white/10 backdrop-blur-md border border-white/20 rounded-xl p-4 min-w-[140px] transition-all duration-300 hover:bg-white/15 hover:border-white/30 hover:-translate-y-1 hover:shadow-lg hover:shadow-purple-500/10">
                  <div className="flex items-center gap-2 mb-1">
                    <TrendingUp className="w-4 h-4 text-emerald-400" />
                    <span className="text-xs text-gray-400">{language === 'id' ? 'Total P/L' : 'Total P/L'}</span>
                  </div>
                  <div className={`text-xl font-bold ${(analytics?.totalPL || 0) >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                    {(analytics?.totalPL || 0) >= 0 ? '+' : ''}${(analytics?.totalPL || 0).toFixed(2)}
                  </div>
                </div>
                <div className="bg-white/10 backdrop-blur-md border border-white/20 rounded-xl p-4 min-w-[140px] transition-all duration-300 hover:bg-white/15 hover:border-white/30 hover:-translate-y-1 hover:shadow-lg hover:shadow-amber-500/10">
                  <div className="flex items-center gap-2 mb-1">
                    <Target className="w-4 h-4 text-amber-400" />
                    <span className="text-xs text-gray-400">{language === 'id' ? 'Win Rate' : 'Win Rate'}</span>
                  </div>
                  <div className="text-xl font-bold text-amber-400">
                    {(analytics?.winRate || 0).toFixed(1)}%
                  </div>
                </div>
                <div className="bg-white/10 backdrop-blur-md border border-white/20 rounded-xl p-4 min-w-[140px] transition-all duration-300 hover:bg-white/15 hover:border-white/30 hover:-translate-y-1 hover:shadow-lg hover:shadow-purple-500/10">
                  <div className="flex items-center gap-2 mb-1">
                    <Activity className="w-4 h-4 text-purple-400" />
                    <span className="text-xs text-gray-400">{language === 'id' ? 'Total Trade' : 'Total Trades'}</span>
                  </div>
                  <div className="text-xl font-bold text-purple-400">
                    {analytics?.totalTrades || 0}
                  </div>
                </div>
              </motion.div>
            )}
          </div>

          {/* Bottom: Progress Indicator for Goals */}
          {hasData && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.4 }}
              className="mt-6 pt-6 border-t border-white/10"
            >
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <Trophy className="w-4 h-4 text-amber-400" />
                  <span className="text-xs font-semibold text-gray-300">
                    {language === 'id' ? 'Target Minggu Ini' : 'Weekly Target'}
                  </span>
                </div>
                <span className="text-xs text-gray-400">
                  {trades.length} / 10 {language === 'id' ? 'trades' : 'trades'}
                </span>
              </div>
              <div className="h-2 bg-white/10 rounded-full overflow-hidden">
                <motion.div
                  className="h-full bg-gradient-to-r from-purple-500 via-violet-500 to-amber-500 rounded-full"
                  initial={{ width: 0 }}
                  animate={{ width: `${Math.min((trades.length / 10) * 100, 100)}%` }}
                  transition={{ duration: 1.5, ease: "easeOut" }}
                />
              </div>
            </motion.div>
          )}
        </CardContent>
      </Card>
    </motion.div>
  )
}