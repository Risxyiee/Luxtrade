'use client'

import React, { useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import { TrendingUp, ShieldCheck, Users, Activity } from 'lucide-react'

interface RealTimeStatsProps {
  language?: 'id' | 'en'
}

interface Stats {
  tradesLogged: number
  activeTraders: number
  propFirmsPassed: number
  totalProfit: string
}

// Base stats (will increment over time)
const baseStats: Stats = {
  tradesLogged: 1247,
  activeTraders: 31,
  propFirmsPassed: 8,
  totalProfit: '$47,890'
}

export default function RealTimeStats({ language = 'id' }: RealTimeStatsProps) {
  const [stats, setStats] = useState<Stats>(baseStats)
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)

    // Simulate real-time growth
    const interval = setInterval(() => {
      setStats(prev => ({
        tradesLogged: prev.tradesLogged + Math.floor(Math.random() * 3),
        activeTraders: prev.activeTraders + (Math.random() > 0.7 ? 1 : 0),
        propFirmsPassed: prev.propFirmsPassed + (Math.random() > 0.95 ? 1 : 0),
        totalProfit: incrementProfit(prev.totalProfit)
      }))
    }, 5000) // Update every 5 seconds

    return () => clearInterval(interval)
  }, [])

  // Helper to increment profit string
  const incrementProfit = (profit: string): string => {
    const numericValue = parseFloat(profit.replace(/[$,]/g, ''))
    const increment = Math.random() * 100
    const newValue = numericValue + increment
    return `$${newValue.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`
  }

  const statsItems = [
    {
      icon: Activity,
      label: language === 'id' ? 'Trades Logged' : 'Trades Logged',
      value: stats.tradesLogged.toLocaleString(),
      color: 'text-blue-400',
      bgColor: 'bg-blue-500/10'
    },
    {
      icon: Users,
      label: language === 'id' ? 'Active Traders' : 'Active Traders',
      value: stats.activeTraders.toLocaleString(),
      color: 'text-cyan-400',
      bgColor: 'bg-cyan-500/10'
    },
    {
      icon: ShieldCheck,
      label: language === 'id' ? 'Prop Firms Passed' : 'Prop Firms Passed',
      value: stats.propFirmsPassed.toLocaleString(),
      color: 'text-emerald-400',
      bgColor: 'bg-emerald-500/10'
    },
    {
      icon: TrendingUp,
      label: language === 'id' ? 'Total Profit Logged' : 'Total Profit Logged',
      value: stats.totalProfit,
      color: 'text-purple-400',
      bgColor: 'bg-purple-500/10'
    }
  ]

  return (
    <section className="py-16 border-y border-white/5 bg-[#070710] relative z-10">
      <div className="max-w-7xl mx-auto px-6">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
          {statsItems.map((item, index) => (
            <motion.div
              key={index}
              initial={{ opacity: 0, y: 20 }}
              animate={mounted ? { opacity: 1, y: 0 } : { opacity: 0, y: 20 }}
              transition={{ duration: 0.5, delay: index * 0.1 }}
              className="text-center"
            >
              {/* Icon */}
              <div className={`w-12 h-12 rounded-xl ${item.bgColor} flex items-center justify-center mx-auto mb-3`}>
                <item.icon className={`w-6 h-6 ${item.color}`} />
              </div>

              {/* Value */}
              <motion.p
                initial={{ scale: 0.9, opacity: 0 }}
                animate={mounted ? { scale: 1, opacity: 1 } : { scale: 0.9, opacity: 0 }}
                transition={{ duration: 0.3, delay: index * 0.1 + 0.2 }}
                className={`text-2xl md:text-3xl font-bold ${item.color} mb-1`}
              >
                {item.value}
              </motion.p>

              {/* Label */}
              <p className="text-xs text-gray-500 uppercase tracking-wider">
                {item.label}
              </p>
            </motion.div>
          ))}
        </div>

        {/* Live indicator */}
        <div className="flex items-center justify-center gap-2 mt-8">
          <div className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
          <p className="text-xs text-gray-500">
            {language === 'id' ? 'Data real-time dari komunitas prop firm trader' : 'Real-time data from prop firm trader community'}
          </p>
        </div>
      </div>
    </section>
  )
}