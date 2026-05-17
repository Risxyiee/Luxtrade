'use client'

import React, { useState, useEffect, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import Link from 'next/link'
import Image from 'next/image'
import {
  TrendingUp, TrendingDown, BarChart3, BookOpen,
  Eye, Brain, Sparkles, ArrowRight, Play,
  LineChart, PieChart, Target, Shield,
  ChevronRight, Star, Zap, Check, Crown,
  Activity, DollarSign, Users, Trophy, ChevronDown,
  MessageCircle, HelpCircle, Bot, Lock, ShieldCheck,
  Clock, Mail, Zap as Lightning
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import PaymentConfirmationModal from '@/components/PaymentConfirmationModal'

interface EquityPoint {
  time: number;
  value: number;
  change: number;
}

// Generate realistic equity curve data
function generateEquityData(points: number): EquityPoint[] {
  const data: EquityPoint[] = []
  let equity = 10500 // Starting equity
  
  for (let i = 0; i < points; i++) {
    // Random walk with slight upward bias
    const change = (Math.random() - 0.45) * 150
    equity = Math.max(9500, Math.min(12000, equity + change))
    data.push({
      time: i,
      value: equity,
      change: change
    })
  }
  return data
}

// Animated Equity Widget Component - Premium with Glassmorphism
function EquityWidget() {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const dataRef = useRef<EquityPoint[]>(generateEquityData(50))
  const [currentValue, setCurrentValue] = useState(10500)
  const [isUp, setIsUp] = useState(true)
  
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    
    const drawChart = (chartData: EquityPoint[]) => {
      const width = canvas.width
      const height = canvas.height
      
      ctx.clearRect(0, 0, width, height)
      
      // Find min/max
      const values = chartData.map(d => d.value)
      const minVal = Math.min(...values)
      const maxVal = Math.max(...values)
      const range = maxVal - minVal || 1
      
      // Draw gradient background with premium purple gradient
      const gradient = ctx.createLinearGradient(0, 0, 0, height)
      const isPositive = chartData[chartData.length - 1].value >= chartData[0].value
      if (isPositive) {
        gradient.addColorStop(0, 'rgba(147, 51, 234, 0.4)') // Purple
        gradient.addColorStop(0.5, 'rgba(59, 130, 246, 0.3)') // Blue
        gradient.addColorStop(1, 'rgba(59, 130, 246, 0)')
      } else {
        gradient.addColorStop(0, 'rgba(239, 68, 68, 0.3)')
        gradient.addColorStop(1, 'rgba(239, 68, 68, 0)')
      }
      
      // Draw filled area
      ctx.beginPath()
      ctx.moveTo(0, height)
      
      chartData.forEach((point, i) => {
        const x = (i / (chartData.length - 1)) * width
        const y = height - ((point.value - minVal) / range) * height * 0.8 - height * 0.1
        ctx.lineTo(x, y)
      })
      
      ctx.lineTo(width, height)
      ctx.closePath()
      ctx.fillStyle = gradient
      ctx.fill()
      
      // Draw line with electric blue glow
      ctx.beginPath()
      chartData.forEach((point, i) => {
        const x = (i / (chartData.length - 1)) * width
        const y = height - ((point.value - minVal) / range) * height * 0.8 - height * 0.1
        if (i === 0) {
          ctx.moveTo(x, y)
        } else {
          ctx.lineTo(x, y)
        }
      })
      
      // Electric Blue Gradient for line
      const lineGradient = ctx.createLinearGradient(0, 0, width, 0)
      lineGradient.addColorStop(0, '#9333ea') // Purple
      lineGradient.addColorStop(0.5, '#3b82f6') // Blue
      lineGradient.addColorStop(1, '#06b6d4') // Cyan
      
      ctx.strokeStyle = isPositive ? lineGradient : '#ef4444'
      ctx.lineWidth = 2.5
      ctx.stroke()
      
      // Draw glow effect
      ctx.shadowColor = isPositive ? '#8b5cf6' : '#ef4444'
      ctx.shadowBlur = 15
      ctx.stroke()
      ctx.shadowBlur = 0
    }
    
    drawChart(dataRef.current)
    
    // Animate data updates
    const interval = setInterval(() => {
      const prevData = dataRef.current
      const newData = [...prevData.slice(1)]
      const lastPoint = prevData[prevData.length - 1]
      const lastValue = lastPoint.value
      const change = (Math.random() - 0.45) * 80
      const newValue = Math.max(9500, Math.min(12000, lastValue + change))
      
      setCurrentValue(newValue)
      setIsUp(newValue >= lastValue)
      
      newData.push({
        time: lastPoint.time + 1,
        value: newValue,
        change: change
      })
      
      dataRef.current = newData
      drawChart(newData)
    }, 1500)
    
    return () => clearInterval(interval)
  }, [])
  
  const changeAmount = currentValue - 10500
  const changePercent = ((changeAmount / 10500) * 100).toFixed(2)
  
  return (
    <div className="rounded-2xl backdrop-blur-xl bg-white/[0.03] border border-white/[0.08] p-6 hover:shadow-[0_0_40px_rgba(139,92,246,0.3)] transition-shadow duration-500">
      <div className="flex items-center justify-between mb-4">
        <div>
          <p className="text-sm text-purple-300/80 font-semibold tracking-wide uppercase text-xs">Portfolio Equity</p>
          <div className="flex items-baseline gap-3">
            <span className="text-3xl font-extrabold text-white tracking-tight">
              ${currentValue.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </span>
            <AnimatePresence mode="wait">
              <motion.span
                key={isUp ? 'up' : 'down'}
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 10 }}
                className={`flex items-center gap-1 text-sm font-bold ${isUp ? 'text-emerald-400' : 'text-red-400'}`}
              >
                {isUp ? <TrendingUp className="w-4 h-4" /> : <TrendingDown className="w-4 h-4" />}
                {isUp ? '+' : ''}{changePercent}%
              </motion.span>
            </AnimatePresence>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <div className={`px-3 py-1.5 rounded-full text-xs font-bold ${isUp ? 'bg-emerald-500/20 text-emerald-400' : 'bg-red-500/20 text-red-400'} backdrop-blur-sm`}>
            LIVE
          </div>
          <motion.div 
            className="w-2 h-2 rounded-full bg-emerald-400"
            animate={{ 
              boxShadow: ['0 0 0 0 rgba(16, 185, 129, 0.7)', '0 0 0 10px rgba(16, 185, 129, 0)', '0 0 0 0 rgba(16, 185, 129, 0.7)']
            }}
            transition={{ duration: 2, repeat: Infinity }}
          />
        </div>
      </div>
      
      <canvas
        ref={canvasRef}
        width={500}
        height={120}
        className="w-full h-32"
      />
      
      <div className="flex items-center justify-between mt-4 text-xs text-purple-300/60 font-medium">
        <span>Start: $10,500.00</span>
        <span>Updated just now</span>
      </div>
    </div>
  )
}

// Forex trades data for animated demo
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

// Animated Forex Trades Component - Premium
function AnimatedForexTrades() {
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
            className="flex items-center justify-between p-3 rounded-xl backdrop-blur-md bg-white/[0.03] border border-white/[0.08] hover:bg-white/[0.06] hover:border-purple-500/30 hover:shadow-[0_0_20px_rgba(139,92,246,0.2)] transition-all duration-300"
            initial={false}
            animate={{
              opacity: isExiting ? 0 : 1,
              x: isExiting ? -100 : isEntering ? 100 : 0,
              scale: isExiting ? 0.9 : 1,
            }}
            transition={{ duration: 0.3, ease: 'easeOut' }}
            layout
          >
            <div className="flex items-center gap-3">
              <motion.div 
                className={`w-10 h-10 rounded-lg flex items-center justify-center backdrop-blur-sm ${isProfit ? 'bg-gradient-to-br from-emerald-500/20 to-emerald-600/10 border border-emerald-500/30' : 'bg-gradient-to-br from-red-500/20 to-red-600/10 border border-red-500/30'}`}
                animate={{ 
                  scale: [1, 1.1, 1],
                  boxShadow: isProfit 
                    ? ['0 0 0 0 rgba(16, 185, 129, 0.4)', '0 0 25px 8px rgba(16, 185, 129, 0.15)', '0 0 0 0 rgba(16, 185, 129, 0)']
                    : ['0 0 0 0 rgba(239, 68, 68, 0.4)', '0 0 25px 8px rgba(239, 68, 68, 0.15)', '0 0 0 0 rgba(239, 68, 68, 0)']
                }}
                transition={{ duration: 2, repeat: Infinity }}
              >
                {isProfit ? (
                  <TrendingUp className="w-5 h-5 text-emerald-400" />
                ) : (
                  <TrendingDown className="w-5 h-5 text-red-400" />
                )}
              </motion.div>
              
              <div>
                <div className="flex items-center gap-2">
                  <motion.span 
                    className="text-sm font-extrabold text-white tracking-wide"
                    animate={{ opacity: [1, 0.8, 1] }}
                    transition={{ duration: 0.5, repeat: Infinity, repeatDelay: 2 }}
                  >
                    {trade.pair}
                  </motion.span>
                  <motion.span 
                    className="text-[9px] px-2.5 py-0.5 rounded-full bg-purple-500/20 border border-purple-500/30 text-purple-300 font-bold backdrop-blur-sm"
                    animate={{ opacity: [0.6, 1, 0.6] }}
                    transition={{ duration: 2, repeat: Infinity }}
                  >
                    {trade.session}
                  </motion.span>
                </div>
                <div className="text-[10px] text-white/50 flex items-center gap-2">
                  <motion.span 
                    className={`font-bold ${trade.type === 'BUY' ? 'text-emerald-400' : 'text-red-400'}`}
                    animate={{ opacity: [1, 0.7, 1] }}
                    transition={{ duration: 1, repeat: Infinity }}
                  >
                    {trade.type}
                  </motion.span>
                  <span className="font-mono">@ {trade.price.toFixed(trade.price > 100 ? 2 : 4)}</span>
                </div>
              </div>
            </div>
            
            <div className="text-right">
              <motion.div 
                className={`text-sm font-extrabold font-mono ${isLiveProfit ? 'text-emerald-400' : 'text-red-400'}`}
                animate={{ 
                  opacity: [1, 0.8, 1],
                  scale: livePnl !== trade.pnl ? [1, 1.08, 1] : 1,
                }}
                transition={{ duration: 0.8, repeat: Infinity }}
                key={livePnl}
              >
                {isLiveProfit ? '+' : ''}{livePnl.toFixed(2)}
              </motion.div>
              
              <div className="flex items-center justify-end gap-1.5 mt-0.5">
                <motion.div 
                  className={`w-2 h-2 rounded-full ${isLiveProfit ? 'bg-emerald-400' : 'bg-red-400'}`}
                  animate={{ 
                    opacity: [1, 0.3, 1],
                    scale: [1, 1.3, 1],
                  }}
                  transition={{ duration: 0.8, repeat: Infinity }}
                />
                <motion.span 
                  className="text-[10px] text-white/50 font-semibold"
                  animate={{ opacity: [0.5, 1, 0.5] }}
                  transition={{ duration: 1.5, repeat: Infinity }}
                >
                  Live
                </motion.span>
              </div>
            </div>
          </motion.div>
        )
      })}
      
      <motion.div 
        className="flex justify-center pt-3"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 1 }}
      >
        <motion.div 
          className="flex gap-1.5"
          animate={{ y: [0, 4, 0] }}
          transition={{ duration: 1.5, repeat: Infinity }}
        >
          {[0, 1, 2].map((i) => (
            <motion.div 
              key={i}
              className="w-2 h-2 rounded-full bg-gradient-to-r from-purple-500 to-blue-500"
              animate={{ opacity: [0.3, 1, 0.3] }}
              transition={{ duration: 1, delay: i * 0.2, repeat: Infinity }}
            />
          ))}
        </motion.div>
      </motion.div>
    </div>
  )
}

// Lifetime Ultra Card Component - Premium
function LifetimeUltraCard({ onButtonClick }: { onButtonClick: () => void }) {
  const [slotsInfo, setSlotsInfo] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [isSoldOut, setIsSoldOut] = useState(false)

  useEffect(() => {
    setSlotsInfo({
      totalSlots: 30,
      usedSlots: 0,
      availableSlots: 30,
      isSoldOut: false
    })
    setLoading(false)
  }, [])

  if (loading) {
    return (
      <motion.div
        initial={{ opacity: 0, y: 30 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true }}
        transition={{ delay: 0.3 }}
      >
        <Card className="h-full backdrop-blur-xl bg-white/[0.03] border border-white/[0.08]">
          <CardContent className="p-6 pt-8">
            <div className="animate-pulse">
              <div className="h-6 bg-white/10 rounded mb-4 w-1/2" />
              <div className="h-8 bg-white/10 rounded mb-2 w-3/4" />
              <div className="h-4 bg-white/10 rounded mb-6 w-1/3" />
              <div className="space-y-3">
                {[1, 2, 3, 4, 5, 6].map((i) => (
                  <div key={i} className="h-4 bg-white/10 rounded" />
                ))}
              </div>
            </div>
          </CardContent>
        </Card>
      </motion.div>
    )
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 30 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      transition={{ delay: 0.3 }}
    >
      <Card className={`h-full relative backdrop-blur-xl ${
        isSoldOut
          ? 'bg-gradient-to-b from-red-500/10 to-transparent border-red-500/30'
          : 'bg-gradient-to-b from-amber-500/10 to-transparent border-amber-500/30'
      } border border-white/[0.08] hover:shadow-[0_0_40px_rgba(251,191,36,0.2)] transition-shadow duration-500`}>
        {slotsInfo?.isSoldOut && (
          <div className="absolute -top-3 left-1/2 -translate-x-1/2 px-4 py-1.5 rounded-full bg-red-500 text-xs font-bold text-white backdrop-blur-sm animate-pulse">
            SOLD OUT
          </div>
        )}
        {!slotsInfo?.isSoldOut && (
          <motion.div 
            className="absolute -top-3 left-1/2 -translate-x-1/2 px-4 py-1.5 rounded-full bg-gradient-to-r from-amber-500 to-orange-500 text-xs font-bold text-white flex items-center gap-1.5 backdrop-blur-sm border border-amber-400/30"
            animate={{ 
              boxShadow: ['0 0 0 0 rgba(251, 191, 36, 0.4)', '0 0 20px 5px rgba(251, 191, 36, 0.2)', '0 0 0 0 rgba(251, 191, 36, 0)']
            }}
            transition={{ duration: 2, repeat: Infinity }}
          >
            <Sparkles className="w-3.5 h-3.5" />
            SLOT TERBATAS
          </motion.div>
        )}
        <CardContent className="p-6 pt-8">
          <div className="text-sm text-amber-400 font-bold mb-1 tracking-wide uppercase text-xs">Lifetime Ultra (PROMO)</div>
          <div className="text-4xl font-extrabold text-white mb-1">
            Rp 52.000
            <span className="text-base font-normal text-white/40"> / Sekali Bayar</span>
          </div>
          {slotsInfo && !slotsInfo.isSoldOut && (
            <div className="mb-4">
              <div className="text-xs font-bold text-amber-300">
                PROMO MERDEKA TRADER - SISA {slotsInfo.availableSlots} SLOT!
              </div>
            </div>
          )}
          <ul className="space-y-3 my-6">
            {[
              { text: '👑 AKSES SEUMUR HIDUP' },
              { text: 'Semua Fitur Elite PRO Terbuka Selamanya' },
              { text: 'VIP WhatsApp Support & Akses Grup Privat' },
              { text: 'Tanpa Biaya Bulanan Lagi' },
            ].map((item, index) => (
              <li key={index} className="flex items-center gap-2.5 text-sm text-white/70">
                <Check className="w-4.5 h-4.5 text-amber-400 flex-shrink-0" />
                <span className="font-medium">{item.text}</span>
              </li>
            ))}
          </ul>
          <Button
            disabled={isSoldOut}
            onClick={onButtonClick}
            className={`w-full font-extrabold h-12 text-base ${
              isSoldOut
                ? 'bg-white/10 text-white/50 cursor-not-allowed'
                : 'bg-gradient-to-r from-amber-500 to-orange-600 hover:from-amber-600 hover:to-orange-700 text-white shadow-lg shadow-amber-500/30 hover:shadow-[0_0_30px_rgba(251,191,36,0.4)] transition-all duration-300'
            }`}
          >
            {isSoldOut ? 'SOLD OUT' : 'Ambil Promo Lifetime'}
          </Button>
        </CardContent>
      </Card>
    </motion.div>
  )
}

export default function LuxTradeLanding() {
  const [showPayment, setShowPayment] = useState(false)
  const [showLifetimePaymentModal, setShowLifetimePaymentModal] = useState(false)

  // Realistic stats for a new trading platform
  const stats = [
    { value: '52', label: 'Active Traders', icon: Users },
    { value: '$1,247', label: 'Total P/L Tracked', icon: DollarSign },
    { value: '187', label: 'Trades Logged', icon: Activity },
    { value: '4.9', label: 'User Rating', icon: Star },
  ]

  const features = [
    {
      icon: BarChart3,
      title: 'Performance Analytics',
      description: 'Track win rate, profit factor, and monthly performance with interactive charts.',
      gradient: 'from-purple-500 to-violet-600'
    },
    {
      icon: BookOpen,
      title: 'Trading Journal',
      description: 'Document trades, emotions, and market conditions to refine your edge.',
      gradient: 'from-purple-500 to-violet-600'
    },
    {
      icon: Brain,
      title: 'AI Market Insights',
      description: 'Get personalized trading tips powered by advanced AI analysis.',
      gradient: 'from-cyan-500 to-blue-600'
    },
    {
      icon: Eye,
      title: 'Smart Watchlist',
      description: 'Track opportunities with price alerts and detailed notes.',
      gradient: 'from-emerald-500 to-teal-600'
    },
    {
      icon: LineChart,
      title: 'P/L Tracking',
      description: 'Automatic profit/loss calculations for every position.',
      gradient: 'from-rose-500 to-pink-600'
    },
    {
      icon: Shield,
      title: 'Bank-Grade Security',
      description: 'Your trading data is encrypted and never shared.',
      gradient: 'from-indigo-500 to-purple-600'
    }
  ]

  const testimonials = [
    {
      name: 'David Chen',
      role: 'Forex Trader',
      content: 'Finally a trading journal that actually helps me improve. The AI insights are spot-on.',
      avatar: 'DC',
      rating: 5
    },
    {
      name: 'Sarah Williams',
      role: 'Swing Trader',
      content: 'Clean interface, powerful analytics. Helped me identify my overtrading habit.',
      avatar: 'SW',
      rating: 5
    },
    {
      name: 'Marcus Johnson',
      role: 'Day Trader',
      content: 'The equity curve visualization alone is worth it. Highly recommended!',
      avatar: 'MJ',
      rating: 5
    }
  ]

  const fadeInUp = {
    hidden: { opacity: 0, y: 30 },
    visible: { opacity: 1, y: 0 }
  }

  const staggerContainer = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: { staggerChildren: 0.1 }
    }
  }

  return (
    <div className="min-h-screen bg-[#0f051d] text-white overflow-x-hidden">
      {/* Partikel Background - Tailwind Murni */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden z-10">
        {/* Partikel KIRI (left: 2% - 25%) */}
        <div className="absolute w-3 h-3 bg-purple-500/40 rounded-full animate-ping" style={{ top: '5%', left: '3%', animationDuration: '3s' }} />
        <div className="absolute w-2 h-2 bg-purple-400/50 rounded-full animate-pulse" style={{ top: '12%', left: '8%', animationDuration: '4s' }} />
        <div className="absolute w-4 h-4 bg-blue-500/30 rounded-full animate-ping" style={{ top: '8%', left: '15%', animationDuration: '3.5s' }} />
        <div className="absolute w-2 h-2 bg-purple-300/60 rounded-full animate-pulse" style={{ top: '18%', left: '20%', animationDuration: '2.5s' }} />
        <div className="absolute w-3 h-3 bg-purple-500/35 rounded-full animate-ping" style={{ top: '25%', left: '5%', animationDuration: '4.5s' }} />
        <div className="absolute w-2 h-2 bg-blue-400/40 rounded-full animate-pulse" style={{ top: '35%', left: '12%', animationDuration: '3s' }} />
        <div className="absolute w-4 h-4 bg-purple-500/35 rounded-full animate-ping" style={{ top: '30%', left: '22%', animationDuration: '4.5s' }} />
        <div className="absolute w-2 h-2 bg-purple-300/50 rounded-full animate-pulse" style={{ top: '40%', left: '18%', animationDuration: '3s' }} />
        <div className="absolute w-3 h-3 bg-blue-400/40 rounded-full animate-ping" style={{ top: '50%', left: '8%', animationDuration: '3.5s' }} />
        <div className="absolute w-2 h-2 bg-purple-500/45 rounded-full animate-pulse" style={{ top: '58%', left: '15%', animationDuration: '4s' }} />
        <div className="absolute w-3 h-3 bg-purple-500/40 rounded-full animate-ping" style={{ top: '70%', left: '10%', animationDuration: '4.2s' }} />
        <div className="absolute w-2 h-2 bg-blue-400/45 rounded-full animate-pulse" style={{ top: '78%', left: '20%', animationDuration: '3.5s' }} />
        <div className="absolute w-4 h-4 bg-purple-400/35 rounded-full animate-ping" style={{ top: '72%', left: '6%', animationDuration: '4.5s' }} />
        <div className="absolute w-2 h-2 bg-purple-500/45 rounded-full animate-pulse" style={{ top: '88%', left: '3%', animationDuration: '4s' }} />
        <div className="absolute w-2 h-2 bg-blue-400/40 rounded-full animate-ping" style={{ top: '92%', left: '12%', animationDuration: '3.5s' }} />

        {/* Partikel KANAN (left: 75% - 95%) */}
        <div className="absolute w-2 h-2 bg-purple-500/50 rounded-full animate-pulse" style={{ top: '20%', left: '78%', animationDuration: '4.2s' }} />
        <div className="absolute w-4 h-4 bg-blue-500/35 rounded-full animate-ping" style={{ top: '7%', left: '88%', animationDuration: '3.2s' }} />
        <div className="absolute w-2 h-2 bg-purple-300/55 rounded-full animate-pulse" style={{ top: '14%', left: '92%', animationDuration: '2.8s' }} />
        <div className="absolute w-2 h-2 bg-blue-500/40 rounded-full animate-pulse" style={{ top: '42%', left: '82%', animationDuration: '3.2s' }} />
        <div className="absolute w-4 h-4 bg-purple-300/50 rounded-full animate-ping" style={{ top: '26%', left: '90%', animationDuration: '2.8s' }} />
        <div className="absolute w-2 h-2 bg-purple-400/45 rounded-full animate-pulse" style={{ top: '36%', left: '95%', animationDuration: '4s' }} />
        <div className="absolute w-3 h-3 bg-purple-500/45 rounded-full animate-ping" style={{ top: '62%', left: '78%', animationDuration: '4.2s' }} />
        <div className="absolute w-2 h-2 bg-blue-400/35 rounded-full animate-pulse" style={{ top: '50%', left: '85%', animationDuration: '4.5s' }} />
        <div className="absolute w-4 h-4 bg-purple-400/40 rounded-full animate-ping" style={{ top: '58%', left: '90%', animationDuration: '3s' }} />
        <div className="absolute w-2 h-2 bg-purple-300/50 rounded-full animate-pulse" style={{ top: '48%', left: '92%', animationDuration: '2.8s' }} />
        <div className="absolute w-3 h-3 bg-blue-500/45 rounded-full animate-pulse" style={{ top: '56%', left: '97%', animationDuration: '4s' }} />
        <div className="absolute w-2 h-2 bg-purple-300/45 rounded-full animate-pulse" style={{ top: '85%', left: '80%', animationDuration: '3.8s' }} />
        <div className="absolute w-4 h-4 bg-purple-400/40 rounded-full animate-ping" style={{ top: '72%', left: '88%', animationDuration: '4.5s' }} />
        <div className="absolute w-2 h-2 bg-blue-500/35 rounded-full animate-pulse" style={{ top: '82%', left: '93%', animationDuration: '3s' }} />
        <div className="absolute w-3 h-3 bg-purple-300/50 rounded-full animate-ping" style={{ top: '75%', left: '95%', animationDuration: '2.8s' }} />
        <div className="absolute w-3 h-3 bg-purple-500/45 rounded-full animate-pulse" style={{ top: '96%', left: '85%', animationDuration: '3.8s' }} />
        <div className="absolute w-2 h-2 bg-blue-400/35 rounded-full animate-pulse" style={{ top: '91%', left: '90%', animationDuration: '4.5s' }} />
        <div className="absolute w-4 h-4 bg-purple-400/40 rounded-full animate-pulse" style={{ top: '95%', left: '80%', animationDuration: '3s' }} />
      </div>

      {/* Navigation - Premium Glassmorphism */}
      <nav className="fixed top-0 left-0 right-0 z-50">
        <div className="backdrop-blur-xl bg-[#0f051d]/80 border-b border-white/[0.08]">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="flex items-center justify-between h-16">
              <div className="flex items-center gap-3">
                <div className="relative">
                  <Image 
                    src="/logo.png" 
                    alt="LuxTrade Logo" 
                    width={40} 
                    height={40}
                    className="rounded-xl shadow-lg"
                  />
                  <motion.div 
                    className="absolute -bottom-1 -right-1 w-3 h-3 bg-emerald-400 rounded-full border-2 border-[#0f051d]"
                    animate={{ 
                      boxShadow: ['0 0 0 0 rgba(16, 185, 129, 0.7)', '0 0 0 8px rgba(16, 185, 129, 0)', '0 0 0 0 rgba(16, 185, 129, 0.7)']
                    }}
                    transition={{ duration: 2, repeat: Infinity }}
                  />
                </div>
                <div>
                  <span className="text-xl font-extrabold bg-gradient-to-r from-white via-purple-200 to-purple-400 bg-clip-text text-transparent">
                    LuxTrade
                  </span>
                  <span className="hidden sm:inline text-[10px] text-purple-400/70 ml-2 tracking-[0.2em] font-bold">PREMIUM</span>
                </div>
              </div>
              
              <div className="hidden md:flex items-center gap-8">
                {['Fitur', 'Demo Langsung', 'Harga', 'FAQ'].map((item) => (
                  <a 
                    key={item}
                    href={`#${item.toLowerCase().replace(' ', '-')}`}
                    className="text-sm text-white/60 hover:text-white hover:text-purple-300 transition-all duration-300 font-medium relative group"
                  >
                    {item}
                    <span className="absolute -bottom-1 left-0 w-0 h-0.5 bg-gradient-to-r from-purple-500 to-blue-500 group-hover:w-full transition-all duration-300" />
                  </a>
                ))}
              </div>
              
              <div className="flex items-center gap-3">
                <Link href="/auth/login">
                  <Button variant="ghost" className="text-white/70 hover:text-white hover:bg-white/10 hover:shadow-[0_0_15px_rgba(168,85,247,0.3)] transition-all duration-300 font-semibold backdrop-blur-sm">
                    Masuk
                  </Button>
                </Link>
                <Link href="/auth/signup">
                  <motion.div
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.98 }}
                  >
                    <Button className="h-10 px-6 bg-gradient-to-r from-purple-500 to-blue-600 hover:from-purple-600 hover:to-blue-700 text-white font-extrabold shadow-lg shadow-purple-500/30 hover:shadow-[0_0_20px_rgba(168,85,247,0.5)] transition-all duration-300 backdrop-blur-sm">
                      Daftar Sekarang
                      <ArrowRight className="w-4 h-4 ml-2" />
                    </Button>
                  </motion.div>
                </Link>
              </div>
            </div>
          </div>
        </div>
      </nav>

      {/* Hero Section - Premium */}
      <section className="pt-32 pb-20 px-4 sm:px-6 lg:px-8">
        <div className="max-w-7xl mx-auto">
          <motion.div 
            className="text-center"
            initial="hidden"
            animate="visible"
            variants={staggerContainer}
          >
            {/* Badge */}
            <motion.div variants={fadeInUp} className="flex justify-center mb-8">
              <motion.div 
                className="inline-flex items-center gap-2.5 px-5 py-2.5 rounded-full backdrop-blur-xl bg-purple-500/10 border border-purple-500/30 hover:border-purple-500/50 transition-all duration-300 cursor-default"
                whileHover={{ scale: 1.02 }}
              >
                <motion.div
                  animate={{ 
                    boxShadow: ['0 0 0 0 rgba(139, 92, 246, 0.7)', '0 0 0 10px rgba(139, 92, 246, 0)', '0 0 0 0 rgba(139, 92, 246, 0.7)']
                  }}
                  transition={{ duration: 2, repeat: Infinity }}
                >
                  <Sparkles className="w-4.5 h-4.5 text-purple-400" />
                </motion.div>
                <span className="text-sm text-purple-300 font-semibold">Kecerdasan Trading Berbasis AI</span>
              </motion.div>
            </motion.div>
            
            {/* Main Headline - Lexend Extra Bold with gradient from white to purple-400 */}
            <motion.h1
              variants={fadeInUp}
              className="text-5xl sm:text-6xl lg:text-7xl font-extrabold mb-8 leading-tight tracking-tight font-lexend"
              style={{ letterSpacing: '-0.02em' }}
            >
              <span className="bg-gradient-to-r from-white to-purple-400 bg-clip-text text-transparent">
                Trading Lebih Cerdas, Bukan Lebih Keras
              </span>
              <br />
              <span className="bg-gradient-to-r from-white via-purple-200 to-purple-400 bg-clip-text text-transparent">
                dengan Presisi Berbasis AI
              </span>
            </motion.h1>
            
            <motion.p 
              variants={fadeInUp}
              className="text-xl sm:text-2xl text-white/60 max-w-3xl mx-auto mb-12 leading-relaxed font-light"
            >
              Jurnal trading premium untuk trader serius. Catat setiap trade,
              analisis performa, dan buka wawasan berbasis AI untuk keunggulan Anda.
            </motion.p>
            
            {/* CTA Buttons - Neon Glow Effect with hover:shadow-[0_0_20px_rgba(168,85,247,0.5)] */}
            <motion.div
              variants={fadeInUp}
              className="flex flex-col sm:flex-row items-center justify-center gap-5 mb-20"
            >
              <Link href="/auth/signup">
                <motion.div
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.98 }}
                >
                  <Button size="lg" className="h-16 px-10 text-xl bg-gradient-to-r from-purple-500 to-blue-600 hover:from-purple-600 hover:to-blue-700 text-white font-extrabold shadow-2xl shadow-purple-500/40 hover:shadow-[0_0_20px_rgba(168,85,247,0.5)] transition-all duration-300 backdrop-blur-xl border border-purple-400/20">
                    Mulai Sekarang
                    <ArrowRight className="w-6 h-6 ml-3" />
                  </Button>
                </motion.div>
              </Link>
              <a href="#demo">
                <motion.div
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.98 }}
                >
                  <Button variant="outline" size="lg" className="h-16 px-10 text-xl border-2 border-white/10 hover:border-white/20 text-white hover:bg-white/5 hover:shadow-[0_0_20px_rgba(168,85,247,0.3)] backdrop-blur-xl font-semibold transition-all duration-300">
                    <Play className="w-6 h-6 mr-3" />
                    Lihat Demo
                  </Button>
                </motion.div>
              </a>
            </motion.div>

            {/* Stats - Premium Glassmorphism Cards */}
            <motion.div 
              variants={fadeInUp}
              className="grid grid-cols-2 md:grid-cols-4 gap-4 max-w-4xl mx-auto mb-24"
            >
              {stats.map((stat, index) => (
                <motion.div
                  key={index}
                  className="p-5 rounded-2xl backdrop-blur-xl bg-white/[0.03] border border-white/[0.08] hover:bg-white/[0.06] hover:border-purple-500/30 hover:shadow-[0_0_30px_rgba(139,92,246,0.2)] transition-all duration-300 group"
                  whileHover={{ scale: 1.02, y: -2 }}
                >
                  <stat.icon className="w-5 h-5 text-purple-400/70 mb-3 mx-auto group-hover:text-purple-400 transition-colors" />
                  <div className="text-3xl font-extrabold text-white mb-1">{stat.value}</div>
                  <div className="text-xs text-white/50 font-medium uppercase tracking-wide">{stat.label}</div>
                </motion.div>
              ))}
            </motion.div>
          </motion.div>

          {/* Live Equity Widget */}
          <motion.div 
            className="max-w-2xl mx-auto"
            initial={{ opacity: 0, y: 40 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.4 }}
          >
            <EquityWidget />
          </motion.div>
        </div>
      </section>

      {/* Features Section - Premium Glassmorphism */}
      <section id="features" className="py-24 px-4 sm:px-6 lg:px-8">
        <div className="max-w-7xl mx-auto">
          <motion.div 
            className="text-center mb-20"
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
          >
            <div className="inline-flex items-center gap-2.5 px-5 py-2.5 rounded-full backdrop-blur-xl bg-purple-500/10 border border-purple-500/30 mb-6">
              <Zap className="w-4.5 h-4.5 text-purple-400" />
              <span className="text-sm text-purple-300 font-semibold">Fitur Unggulan</span>
            </div>
            <h2 className="text-4xl sm:text-5xl font-extrabold mb-6">
              <span className="text-white">Semua yang Anda Butuhkan untuk</span>
              <span className="bg-gradient-to-r from-purple-400 via-blue-400 to-cyan-400 bg-clip-text text-transparent"> Trading Lebih Cerdas</span>
            </h2>
            <p className="text-xl text-white/50 max-w-2xl mx-auto font-light">
              Alat profesional yang didesain oleh trader, untuk trader. Setiap fitur dibangun untuk memberikan keunggulan.
            </p>
          </motion.div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {features.map((feature, index) => (
              <motion.div
                key={index}
                initial={{ opacity: 0, y: 30 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: index * 0.1 }}
                className="group"
              >
                <motion.div
                  className="h-full p-6 rounded-2xl backdrop-blur-xl bg-white/[0.03] border border-white/[0.08] hover:bg-white/[0.06] hover:border-purple-500/30 hover:shadow-[0_0_40px_rgba(139,92,246,0.2)] transition-all duration-300"
                  whileHover={{ scale: 1.02, y: -4 }}
                >
                  <div className={`w-14 h-14 rounded-xl bg-gradient-to-br ${feature.gradient} flex items-center justify-center mb-5 group-hover:scale-110 transition-transform shadow-lg`}>
                    <feature.icon className="w-7 h-7 text-white" />
                  </div>
                  <h3 className="text-xl font-extrabold text-white mb-3">{feature.title}</h3>
                  <p className="text-white/50 text-base leading-relaxed">{feature.description}</p>
                </motion.div>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Live Demo Section - Premium */}
      <section id="demo" className="py-24 px-4 sm:px-6 lg:px-8 bg-gradient-to-b from-transparent via-purple-900/10 to-transparent">
        <div className="max-w-7xl mx-auto">
          <motion.div 
            className="text-center mb-16"
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
          >
            <div className="inline-flex items-center gap-2.5 px-5 py-2.5 rounded-full backdrop-blur-xl bg-emerald-500/10 border border-emerald-500/30 mb-6">
              <Activity className="w-4.5 h-4.5 text-emerald-400" />
              <span className="text-sm text-emerald-300 font-semibold">Live Preview</span>
            </div>
            <h2 className="text-4xl sm:text-5xl font-extrabold mb-6">
              <span className="text-white">See It</span>
              <span className="bg-gradient-to-r from-emerald-400 to-cyan-400 bg-clip-text text-transparent"> In Action</span>
            </h2>
          </motion.div>

          {/* Dashboard Preview - Premium */}
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            whileInView={{ opacity: 1, scale: 1 }}
            viewport={{ once: true }}
            className="rounded-3xl backdrop-blur-xl border border-white/[0.08] bg-gradient-to-br from-[#1a0f2e]/50 to-[#0d0715]/50 p-1.5 shadow-2xl shadow-purple-500/20 hover:shadow-[0_0_60px_rgba(139,92,246,0.3)] transition-shadow duration-500"
          >
            <div className="rounded-2xl overflow-hidden">
              {/* Mock Dashboard Header */}
              <div className="flex items-center gap-2.5 px-5 py-4 bg-white/[0.03] border-b border-white/[0.08]">
                <div className="flex gap-2">
                  <div className="w-3 h-3 rounded-full bg-red-500/60 hover:bg-red-500 transition-colors" />
                  <div className="w-3 h-3 rounded-full bg-yellow-500/60 hover:bg-yellow-500 transition-colors" />
                  <div className="w-3 h-3 rounded-full bg-green-500/60 hover:bg-green-500 transition-colors" />
                </div>
                <div className="flex-1 text-center">
                  <span className="text-xs text-white/30 font-medium tracking-wide">LuxTrade Dashboard</span>
                </div>
              </div>
              
              {/* Mock Content */}
              <div className="p-6 space-y-5">
                {/* Stats Row */}
                <div className="grid grid-cols-4 gap-4">
                  {[
                    { label: 'Total P/L', value: '+$1,247', color: 'emerald', delay: 0 },
                    { label: 'Win Rate', value: '68%', color: 'purple', delay: 0.5 },
                    { label: 'Open', value: '3', color: 'cyan', delay: 1 },
                    { label: 'Profit Factor', value: '2.14', color: 'purple', delay: 1.5 },
                  ].map((stat, i) => (
                    <motion.div 
                      key={i}
                      className={`p-4 rounded-xl backdrop-blur-sm bg-gradient-to-br from-${stat.color}-500/20 to-transparent border border-white/[0.08]`}
                      animate={{ scale: [1, 1.03, 1] }}
                      transition={{ duration: 2, repeat: Infinity, delay: stat.delay }}
                    >
                      <div className="text-[11px] text-white/40 mb-1.5 font-semibold uppercase tracking-wide">{stat.label}</div>
                      <div className={`text-xl font-extrabold text-${stat.color}-400`}>{stat.value}</div>
                    </motion.div>
                  ))}
                </div>
                
                {/* Mini Chart */}
                <div className="h-32 rounded-xl backdrop-blur-sm bg-gradient-to-br from-purple-500/10 to-transparent border border-white/[0.08] p-4">
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-sm text-white/40 font-semibold">Equity Curve</span>
                    <motion.div 
                      className="flex items-center gap-1.5"
                      animate={{ opacity: [0.5, 1, 0.5] }}
                      transition={{ duration: 2, repeat: Infinity }}
                    >
                      <div className="w-2 h-2 rounded-full bg-emerald-400" />
                      <span className="text-xs text-emerald-400 font-bold">+12.4%</span>
                    </motion.div>
                  </div>
                  <div className="flex items-end gap-1 h-20">
                    {[40, 55, 45, 60, 50, 70, 65, 80, 75, 90, 85, 95, 88, 92, 100, 95, 98, 105, 100, 110].map((h, i) => (
                      <motion.div 
                        key={i}
                        className="flex-1 bg-gradient-to-t from-purple-500 to-blue-500 rounded-t"
                        style={{ height: `${h}%` }}
                        animate={{ opacity: [0.5, 1, 0.5] }}
                        transition={{ duration: 1, delay: i * 0.05, repeat: Infinity }}
                      />
                    ))}
                  </div>
                </div>
                
                {/* Animated Forex Trades Ticker */}
                <AnimatedForexTrades />
              </div>
            </div>
          </motion.div>
          
          <div className="text-center mt-10">
            <Link href="/dashboard">
              <motion.div
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.98 }}
              >
                <Button className="h-14 px-8 text-lg bg-gradient-to-r from-emerald-500 to-cyan-600 hover:from-emerald-600 hover:to-cyan-700 text-white font-extrabold shadow-lg shadow-emerald-500/30 hover:shadow-[0_0_40px_rgba(16,185,129,0.5)] transition-all duration-300 backdrop-blur-xl">
                  Try Dashboard Now
                  <ArrowRight className="w-5 h-5 ml-2" />
                </Button>
              </motion.div>
            </Link>
          </div>
        </div>
      </section>

      {/* Testimonials - Premium Glassmorphism */}
      <section id="testimonials" className="py-24 px-4 sm:px-6 lg:px-8">
        <div className="max-w-7xl mx-auto">
          <motion.div 
            className="text-center mb-20"
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
          >
            <div className="inline-flex items-center gap-2.5 px-5 py-2.5 rounded-full backdrop-blur-xl bg-pink-500/10 border border-pink-500/30 mb-6">
              <Trophy className="w-4.5 h-4.5 text-pink-400" />
              <span className="text-sm text-pink-300 font-semibold">Trusted by Traders</span>
            </div>
            <h2 className="text-4xl sm:text-5xl font-extrabold mb-6">
              <span className="text-white">What Traders</span>
              <span className="bg-gradient-to-r from-pink-400 to-rose-400 bg-clip-text text-transparent"> Are Saying</span>
            </h2>
          </motion.div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {testimonials.map((testimonial, index) => (
              <motion.div
                key={index}
                initial={{ opacity: 0, y: 30 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: index * 0.15 }}
              >
                <motion.div
                  className="h-full p-6 rounded-2xl backdrop-blur-xl bg-white/[0.03] border border-white/[0.08] hover:bg-white/[0.06] hover:border-pink-500/30 hover:shadow-[0_0_40px_rgba(236,72,153,0.2)] transition-all duration-300"
                  whileHover={{ scale: 1.02, y: -4 }}
                >
                  <div className="flex gap-1.5 mb-4">
                    {[...Array(testimonial.rating)].map((_, i) => (
                      <Star key={i} className="w-4.5 h-4.5 fill-purple-400 text-purple-400" />
                    ))}
                  </div>
                  <p className="text-white/60 mb-5 text-base leading-relaxed font-light">&ldquo;{testimonial.content}&rdquo;</p>
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 rounded-full bg-gradient-to-br from-purple-400 to-violet-500 flex items-center justify-center text-white font-bold text-sm shadow-lg">
                      {testimonial.avatar}
                    </div>
                    <div>
                      <div className="font-bold text-white">{testimonial.name}</div>
                      <div className="text-xs text-white/40 font-medium">{testimonial.role}</div>
                    </div>
                  </div>
                </motion.div>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Pricing - 3 Paket: Free, Elite Pro Rp 49.000, dan Lifetime Ultra Rp 52.000 */}
      <section id="pricing" className="py-24 px-4 sm:px-6 lg:px-8 bg-gradient-to-b from-transparent via-purple-900/10 to-transparent">
        <div className="max-w-6xl mx-auto">
          <motion.div
            className="text-center mb-20"
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
          >
            <div className="inline-flex items-center gap-2.5 px-5 py-2.5 rounded-full backdrop-blur-xl bg-purple-500/10 border border-purple-500/30 mb-6">
              <Crown className="w-4.5 h-4.5 text-purple-400" />
              <span className="text-sm text-purple-300 font-semibold">Harga Sederhana</span>
            </div>
            <h2 className="text-4xl sm:text-5xl font-extrabold mb-6">
              <span className="text-white">Mulai Gratis,</span>
              <span className="bg-gradient-to-r from-purple-400 to-violet-400 bg-clip-text text-transparent"> Upgrade Saat Siap</span>
            </h2>

            {/* Money-Back Guarantee Badge */}
            <motion.div
              className="flex justify-center mt-8"
              initial={{ opacity: 0, scale: 0.9 }}
              whileInView={{ opacity: 1, scale: 1 }}
              viewport={{ once: true }}
            >
              <div className="inline-flex items-center gap-3 px-6 py-3.5 backdrop-blur-xl bg-emerald-500/10 border border-emerald-500/30 rounded-full">
                <ShieldCheck className="w-5 h-5 text-emerald-400" />
                <span className="text-emerald-300 font-extrabold">Garansi Uang Kembali 7 Hari</span>
                <span className="text-emerald-400/60 text-sm font-medium">• Tanpa Pertanyaan</span>
              </div>
            </motion.div>

            {/* Trust Badges */}
            <motion.div
              className="flex flex-wrap justify-center gap-4 mt-6"
              initial={{ opacity: 0, y: 10 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: 0.2 }}
            >
              {[
                { icon: Lock, text: 'Diamankan SSL', color: 'cyan' },
                { icon: Shield, text: 'Enkripsi Ujung ke Ujung', color: 'purple' },
                { icon: ShieldCheck, text: 'Mematuhi SOC 2', color: 'emerald' },
              ].map((badge, i) => (
                <div key={i} className="flex items-center gap-2 px-4 py-2 backdrop-blur-sm bg-white/5 rounded-xl border border-white/[0.08]">
                  <badge.icon className={`w-4 h-4 text-${badge.color}-400`} />
                  <span className="text-xs text-white/60 font-semibold">{badge.text}</span>
                </div>
              ))}
            </motion.div>
          </motion.div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {/* Free Plan */}
            <motion.div
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: 0.1 }}
            >
              <Card className="h-full backdrop-blur-xl bg-white/[0.03] border border-white/[0.08] hover:bg-white/[0.06] hover:border-white/15 hover:shadow-[0_0_30px_rgba(255,255,255,0.1)] transition-all duration-300">
                <CardContent className="p-6 pt-8">
                  <div className="text-sm text-white/50 mb-1 font-bold tracking-wide uppercase text-xs">Free</div>
                  <div className="text-4xl font-extrabold text-white mb-1">
                    Rp 0
                    <span className="text-base font-normal text-white/40"> / Selamanya</span>
                  </div>
                  <ul className="space-y-4 my-8">
                    {[
                      { text: '15 Jurnal Transaksi / Bulan' },
                      { text: 'Grafik Performa & Statistik Standar' },
                      { text: 'Kalkulator Risiko Trading Pemula' },
                      { text: '🎁 BONUS: 3x Uji Coba Fitur Analisis AI & Statistik PRO' },
                    ].map((item, index) => (
                      <li key={index} className="flex items-center gap-2.5 text-sm text-white/60">
                        <Check className="w-4.5 h-4.5 text-emerald-400" />
                        <span className="font-medium">{item.text}</span>
                      </li>
                    ))}
                  </ul>
                  <Link href="/auth/signup" className="block">
                    <Button 
                      className="w-full h-12 bg-white hover:bg-white/90 text-[#0f051d] font-extrabold backdrop-blur-sm transition-all"
                    >
                      Mulai Gratis
                    </Button>
                  </Link>
                </CardContent>
              </Card>
            </motion.div>

            {/* Elite Pro - Rp 49.000 - With enhanced border and glow effect */}
            <motion.div
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: 0.2 }}
            >
              <motion.div
                className="h-full relative backdrop-blur-xl bg-gradient-to-b from-purple-500/10 to-transparent border border-purple-500/50 rounded-2xl p-6 pt-8 hover:shadow-[0_0_50px_rgba(139,92,246,0.3)] transition-all duration-300"
                whileHover={{ scale: 1.02, y: -4 }}
              >
                <motion.div 
                  className="absolute -top-4 left-1/2 -translate-x-1/2 px-4 py-2 rounded-full bg-gradient-to-r from-purple-500 to-blue-500 text-xs font-extrabold text-white backdrop-blur-xl border border-purple-400/30"
                  animate={{ 
                    boxShadow: ['0 0 0 0 rgba(139, 92, 246, 0.7)', '0 0 0 10px rgba(139, 92, 246, 0)', '0 0 0 0 rgba(139, 92, 246, 0.7)']
                  }}
                  transition={{ duration: 2, repeat: Infinity }}
                >
                  Paling Populer
                </motion.div>
                <div className="text-sm text-purple-400 mb-1 font-bold tracking-wide uppercase text-xs">Elite Pro</div>
                <div className="text-4xl font-extrabold text-white mb-1">
                  Rp 49.000
                  <span className="text-base font-normal text-white/40"> /bulan</span>
                </div>
                <ul className="space-y-3.5 my-8">
                  {[
                    '🔥 UNLIMITED Jurnal Transaksi (Tanpa Batas Bulanan)',
                    '🧠 Akses Penuh Analisis AI Pintar (Deteksi Kesalahan & Solusi)',
                    '📊 Grafik Win-Rate Mendalam & Mistake Tracker',
                    '🧮 Kalkulator Risiko & Posisi Advance',
                    '📥 Bebas Ekspor Data ke Excel / PDF',
                    '👑 Akses VIP Grup & Dukungan Prioritas',
                  ].map((item, index) => (
                    <li key={index} className="flex items-center gap-2.5 text-sm text-white/60">
                      <Check className="w-4.5 h-4.5 text-emerald-400" />
                      <span className="font-medium">{item}</span>
                    </li>
                  ))}
                </ul>
                <motion.div
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                >
                  <Button
                    onClick={() => setShowPayment(true)}
                    className="w-full h-12 bg-gradient-to-r from-purple-500 to-blue-600 hover:from-purple-600 hover:to-blue-700 text-white font-extrabold shadow-lg shadow-purple-500/30 hover:shadow-[0_0_20px_rgba(168,85,247,0.5)] transition-all duration-300 backdrop-blur-xl"
                  >
                    Upgrade ke Elite Pro
                  </Button>
                </motion.div>
              </motion.div>
            </motion.div>

            {/* Lifetime Ultra - Rp 52.000 */}
            <LifetimeUltraCard onButtonClick={() => setShowLifetimePaymentModal(true)} />
          </div>
          
          {/* Comparison Table */}
          <motion.div 
            className="mt-16 overflow-x-auto"
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
          >
            <div className="min-w-[500px] backdrop-blur-xl bg-white/[0.03] border border-white/[0.08] rounded-2xl overflow-hidden">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-white/[0.08]">
                    <th className="p-5 text-left text-white/40 font-bold text-sm uppercase tracking-wide">Fitur</th>
                    <th className="p-5 text-center text-white/40 font-bold text-sm uppercase tracking-wide">Free</th>
                    <th className="p-5 text-center text-purple-400 font-extrabold text-sm uppercase tracking-wide">Elite Pro</th>
                    <th className="p-5 text-center text-amber-400 font-extrabold text-sm uppercase tracking-wide">Lifetime Ultra</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/[0.05]">
                  {[
                    { feature: 'Jurnal Transaksi / Bulan', free: '15', pro: 'UNLIMITED', ultra: 'UNLIMITED' },
                    { feature: 'Grafik Performa & Statistik', free: 'Standar', pro: 'Mendalam', ultra: 'Mendalam' },
                    { feature: 'Analisis AI Pintar', free: '3x Trial', pro: '✓ Penuh', ultra: '✓ Penuh' },
                    { feature: 'Kalkulator Risiko Trading', free: 'Pemula', pro: 'Advance', ultra: 'Advance' },
                    { feature: 'Ekspor Data (Excel/PDF)', free: '—', pro: '✓', ultra: '✓' },
                    { feature: 'VIP WhatsApp Support', free: '—', pro: '✓', ultra: '✓ Grup Privat' },
                  ].map((row, index) => (
                    <tr key={index} className="hover:bg-white/[0.03] transition-colors">
                      <td className="p-5 text-white/70 font-medium">{row.feature}</td>
                      <td className="p-5 text-center text-white/40">{row.free}</td>
                      <td className="p-5 text-center text-emerald-400 font-bold">{row.pro}</td>
                      <td className="p-5 text-center text-amber-400 font-bold">{row.ultra}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </motion.div>
          
          {/* Onboarding Flow */}
          <motion.div 
            className="mt-20 text-center"
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
          >
            <p className="text-white/40 mb-10 font-light text-lg">Mulai dalam kurang dari 2 menit</p>
            <div className="flex flex-col sm:flex-row items-center justify-center gap-6 sm:gap-12">
              {[
                { step: '1', title: 'Daftar', time: '30 detik', icon: Users },
                { step: '2', title: 'Import trade', time: '1 menit', icon: BarChart3 },
                { step: '3', title: 'Lihat analisis', time: 'Langsung', icon: LineChart },
              ].map((item, index) => (
                <React.Fragment key={index}>
                  <motion.div 
                    className="flex flex-col items-center p-6 backdrop-blur-xl bg-white/[0.03] border border-white/[0.08] rounded-2xl hover:bg-white/[0.06] hover:border-purple-500/30 hover:shadow-[0_0_30px_rgba(139,92,246,0.2)] transition-all duration-300"
                    whileHover={{ scale: 1.05, y: -4 }}
                  >
                    <div className="w-14 h-14 rounded-xl bg-gradient-to-br from-purple-500/20 to-blue-500/20 border border-purple-500/30 flex items-center justify-center mb-4">
                      <item.icon className="w-6 h-6 text-purple-400" />
                    </div>
                    <span className="text-white font-extrabold">{item.title}</span>
                    <span className="text-white/40 text-sm font-medium">{item.time}</span>
                  </motion.div>
                  {index < 2 && <ArrowRight className="w-6 h-6 text-white/20 hidden sm:block" />}
                </React.Fragment>
              ))}
            </div>
          </motion.div>
        </div>
      </section>

      {/* Newsletter Section - Premium */}
      <section className="py-20 px-4 sm:px-6 lg:px-8 bg-gradient-to-b from-transparent via-cyan-900/10 to-transparent">
        <div className="max-w-2xl mx-auto text-center">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
          >
            <div className="inline-flex items-center gap-2.5 px-5 py-2.5 rounded-full backdrop-blur-xl bg-cyan-500/10 border border-cyan-500/30 mb-6">
              <Mail className="w-4.5 h-4.5 text-cyan-400" />
              <span className="text-sm text-cyan-300 font-semibold">Weekly Insights</span>
            </div>
            <h2 className="text-3xl sm:text-4xl font-extrabold mb-6 text-white">
              Get Trading Tips Every Week
            </h2>
            <p className="text-white/50 mb-8 max-w-md mx-auto font-light text-lg">
              Join 500+ traders receiving weekly trading tips, psychology insights, and market analysis.
            </p>
            <form className="flex flex-col sm:flex-row gap-4 max-w-md mx-auto" onSubmit={(e) => e.preventDefault()}>
              <input 
                type="email" 
                placeholder="Enter your email"
                className="flex-1 px-5 py-4 rounded-xl backdrop-blur-xl bg-white/5 border border-white/[0.08] text-white placeholder:text-white/30 focus:outline-none focus:border-cyan-500/50 focus:shadow-[0_0_20px_rgba(6,182,212,0.2)] transition-all font-medium"
              />
              <motion.div
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
              >
                <Button 
                  type="submit"
                  className="h-14 px-8 bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-600 hover:to-blue-700 text-white font-extrabold rounded-xl shadow-lg shadow-cyan-500/30 hover:shadow-[0_0_40px_rgba(6,182,212,0.5)] transition-all duration-300 backdrop-blur-xl"
                >
                  Subscribe
                </Button>
              </motion.div>
            </form>
            <p className="text-white/30 text-xs mt-4 font-medium">No spam. Unsubscribe anytime.</p>
          </motion.div>
        </div>
      </section>

      {/* Roadmap Section - Premium */}
      <section id="roadmap" className="py-24 px-4 sm:px-6 lg:px-8 bg-gradient-to-b from-transparent via-purple-900/10 to-transparent">
        <div className="max-w-5xl mx-auto">
          <motion.div 
            className="text-center mb-16"
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
          >
            <div className="inline-flex items-center gap-2.5 px-5 py-2.5 rounded-full backdrop-blur-xl bg-purple-500/10 border border-purple-500/30 mb-6">
              <Clock className="w-4.5 h-4.5 text-purple-400" />
              <span className="text-sm text-purple-300 font-semibold">Peta Jalan Produk</span>
            </div>
            <h2 className="text-4xl sm:text-5xl font-extrabold mb-6">
              <span className="text-white">What&apos;s</span>
              <span className="bg-gradient-to-r from-purple-400 to-violet-400 bg-clip-text text-transparent"> Coming Next</span>
            </h2>
            <p className="text-white/40 max-w-xl mx-auto font-light text-lg">
              We&apos;re constantly improving LuxTrade. Here&apos;s what we&apos;re working on.
            </p>
          </motion.div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            {/* Minggu Depan */}
            <motion.div
              initial={{ opacity: 0, x: -20 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
              transition={{ delay: 0.1 }}
            >
              <Card className="h-full backdrop-blur-xl bg-gradient-to-br from-[#1a0f2e]/50 to-[#0d0715]/50 border-purple-500/20 border border-white/[0.08] hover:shadow-[0_0_40px_rgba(139,92,246,0.2)] transition-shadow duration-500">
                <CardContent className="p-6">
                  <div className="flex items-center gap-4 mb-6">
                    <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-cyan-500/20 to-blue-500/20 border border-cyan-500/30 flex items-center justify-center">
                      <Clock className="w-6 h-6 text-cyan-400" />
                    </div>
                    <div>
                      <h3 className="font-extrabold text-white text-lg">Minggu Depan</h3>
                      <p className="text-xs text-cyan-400 font-bold tracking-wide">COMING SOON</p>
                    </div>
                  </div>
                  <ul className="space-y-4">
                    {[
                      { icon: '💱', title: 'Real-time Forex Prices API', desc: 'Live market prices directly in your dashboard' },
                      { icon: '📄', title: 'Export to PDF', desc: 'Download your trading reports instantly' },
                      { icon: '🔔', title: 'Price Alerts System', desc: 'Get notified when price hits your target' },
                    ].map((item, index) => (
                      <motion.li 
                        key={index}
                        className="flex items-start gap-4 p-4 rounded-xl backdrop-blur-sm bg-white/[0.02] border border-white/[0.05] hover:border-cyan-500/20 hover:bg-white/[0.04] transition-all duration-300"
                        initial={{ opacity: 0, y: 10 }}
                        whileInView={{ opacity: 1, y: 0 }}
                        viewport={{ once: true }}
                        transition={{ delay: 0.1 + index * 0.05 }}
                      >
                        <span className="text-2xl">{item.icon}</span>
                        <div>
                          <p className="font-extrabold text-white text-sm">{item.title}</p>
                          <p className="text-xs text-white/40 mt-1 font-medium">{item.desc}</p>
                        </div>
                      </motion.li>
                    ))}
                  </ul>
                </CardContent>
              </Card>
            </motion.div>

            {/* Bulan Ini */}
            <motion.div
              initial={{ opacity: 0, x: 20 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
              transition={{ delay: 0.2 }}
            >
              <Card className="h-full backdrop-blur-xl bg-gradient-to-br from-[#1a0f2e]/50 to-[#0d0715]/50 border-violet-500/20 border border-white/[0.08] hover:shadow-[0_0_40px_rgba(139,92,246,0.2)] transition-shadow duration-500">
                <CardContent className="p-6">
                  <div className="flex items-center gap-4 mb-6">
                    <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-violet-500/20 to-purple-500/20 border border-violet-500/30 flex items-center justify-center">
                      <Lightning className="w-6 h-6 text-violet-400" />
                    </div>
                    <div>
                      <h3 className="font-extrabold text-white text-lg">Bulan Ini</h3>
                      <p className="text-xs text-violet-400 font-bold tracking-wide">IN DEVELOPMENT</p>
                    </div>
                  </div>
                  <ul className="space-y-4">
                    {[
                      { icon: '📊', title: 'TradingView Chart Integration', desc: 'Advanced charting with TradingView widgets' },
                      { icon: '📥', title: 'MT4/MT5 Import Improvement', desc: 'Better parsing and more formats supported' },
                      { icon: '💳', title: 'Payment Gateway (Midtrans)', desc: 'Instant activation with automatic payment' },
                    ].map((item, index) => (
                      <motion.li 
                        key={index}
                        className="flex items-start gap-4 p-4 rounded-xl backdrop-blur-sm bg-white/[0.02] border border-white/[0.05] hover:border-violet-500/20 hover:bg-white/[0.04] transition-all duration-300"
                        initial={{ opacity: 0, y: 10 }}
                        whileInView={{ opacity: 1, y: 0 }}
                        viewport={{ once: true }}
                        transition={{ delay: 0.2 + index * 0.05 }}
                      >
                        <span className="text-2xl">{item.icon}</span>
                        <div>
                          <p className="font-extrabold text-white text-sm">{item.title}</p>
                          <p className="text-xs text-white/40 mt-1 font-medium">{item.desc}</p>
                        </div>
                      </motion.li>
                    ))}
                  </ul>
                </CardContent>
              </Card>
            </motion.div>
          </div>

          {/* Already Available Features */}
          <motion.div
            className="mt-12"
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
          >
            <div className="p-6 rounded-2xl backdrop-blur-xl bg-emerald-500/10 border border-emerald-500/20">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 rounded-xl bg-emerald-500/20 border border-emerald-500/30 flex items-center justify-center">
                  <Check className="w-5 h-5 text-emerald-400" />
                </div>
                <h3 className="font-extrabold text-white text-lg">Already Available</h3>
              </div>
              <div className="flex flex-wrap gap-2">
                {[
                  '✓ Trading Journal', '✓ Performance Analytics', '✓ AI Insights', '✓ P/L Tracking',
                  '✓ Equity Charts', '✓ Achievement System', '✓ Streak Tracking', '✓ CSV Export',
                  '✓ Multi-Platform Support', '✓ Mobile Responsive'
                ].map((feature, i) => (
                  <span 
                    key={i} 
                    className="px-3 py-1.5 rounded-lg backdrop-blur-sm bg-emerald-500/10 border border-emerald-500/20 text-emerald-300 text-xs font-bold"
                  >
                    {feature}
                  </span>
                ))}
              </div>
            </div>
          </motion.div>
        </div>
      </section>

      {/* FAQ Section - Premium Glassmorphism */}
      <section id="faq" className="py-24 px-4 sm:px-6 lg:px-8">
        <div className="max-w-3xl mx-auto">
          <motion.div 
            className="text-center mb-16"
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
          >
            <div className="inline-flex items-center gap-2.5 px-5 py-2.5 rounded-full backdrop-blur-xl bg-cyan-500/10 border border-cyan-500/30 mb-6">
              <HelpCircle className="w-4.5 h-4.5 text-cyan-400" />
              <span className="text-sm text-cyan-300 font-semibold">FAQ</span>
            </div>
            <h2 className="text-4xl sm:text-5xl font-extrabold mb-6">
              <span className="text-white">Frequently Asked</span>
              <span className="bg-gradient-to-r from-cyan-400 to-blue-400 bg-clip-text text-transparent"> Questions</span>
            </h2>
          </motion.div>

          <div className="space-y-4">
            {[
              {
                q: 'Is LuxTrade free to use?',
                a: 'Yes! LuxTrade offers a generous free plan that allows up to 5 trades per month with basic analytics. You can upgrade to Elite Pro for unlimited trades and advanced features.'
              },
              {
                q: 'How does the AI analysis work?',
                a: 'Our AI analyzes your trading patterns, identifies strengths and weaknesses, and provides personalized insights to help improve your trading performance over time.'
              },
              {
                q: 'Can I import my existing trades?',
                a: 'Absolutely! You can import trades from CSV files exported from most trading platforms. We support MT4, MT5, cTrader, and many more.'
              },
              {
                q: 'Is my trading data secure?',
                a: 'Your data is encrypted end-to-end and stored securely. We never share your trading information with third parties. Read our privacy policy for more details.'
              },
              {
                q: 'Can I cancel my subscription anytime?',
                a: 'Yes, you can cancel your Elite Pro subscription at any time. Your access will continue until the end of your billing period.'
              },
            ].map((faq, index) => (
              <motion.div
                key={index}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: index * 0.1 }}
              >
                <Card className="backdrop-blur-xl bg-white/[0.03] border border-white/[0.08] hover:bg-white/[0.06] hover:border-purple-500/30 hover:shadow-[0_0_30px_rgba(139,92,246,0.2)] transition-all duration-300">
                  <CardContent className="p-6">
                    <h3 className="text-lg font-extrabold text-white mb-2">{faq.q}</h3>
                    <p className="text-white/50 font-light leading-relaxed">{faq.a}</p>
                  </CardContent>
                </Card>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Footer - Premium Glassmorphism with Sticky */}
      <footer className="border-t border-white/[0.08] py-16 px-4 sm:px-6 lg:px-8 mt-auto">
        <div className="max-w-7xl mx-auto">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-12 mb-12">
            <div className="md:col-span-2">
              <div className="flex items-center gap-3 mb-4">
                <Image 
                  src="/logo.png" 
                  alt="LuxTrade Logo" 
                  width={40} 
                  height={40}
                  className="rounded-xl shadow-lg"
                />
                <div>
                  <span className="text-xl font-extrabold bg-gradient-to-r from-white via-purple-200 to-purple-400 bg-clip-text text-transparent">
                    LuxTrade
                  </span>
                  <span className="text-[10px] text-purple-400/70 ml-2 tracking-[0.2em] font-bold">PREMIUM</span>
                </div>
              </div>
              <p className="text-white/50 mb-6 max-w-sm font-light text-lg">
                The premium trading journal for serious traders. Track, analyze, and improve with AI-powered insights.
              </p>
              <div className="flex gap-4">
                {['Twitter', 'Discord', 'Telegram'].map((social) => (
                  <motion.a
                    key={social}
                    href="#"
                    className="w-10 h-10 rounded-xl backdrop-blur-sm bg-white/5 border border-white/[0.08] flex items-center justify-center hover:bg-white/10 hover:border-purple-500/30 transition-all duration-300"
                    whileHover={{ scale: 1.1, y: -2 }}
                  >
                    <span className="text-xs font-bold text-white/60">{social[0]}</span>
                  </motion.a>
                ))}
              </div>
            </div>
            <div>
              <h4 className="font-extrabold text-white mb-4">Produk</h4>
              <ul className="space-y-3">
                {['Fitur', 'Harga', 'Peta Jalan', 'Catatan Perubahan'].map((item) => (
                  <li key={item}>
                    <a href="#" className="text-white/50 hover:text-white hover:text-purple-300 transition-colors font-medium">
                      {item}
                    </a>
                  </li>
                ))}
              </ul>
            </div>
            <div>
              <h4 className="font-extrabold text-white mb-4">Company</h4>
              <ul className="space-y-3">
                {['About', 'Blog', 'Careers', 'Contact'].map((item) => (
                  <li key={item}>
                    <a href="#" className="text-white/50 hover:text-white hover:text-purple-300 transition-colors font-medium">
                      {item}
                    </a>
                  </li>
                ))}
              </ul>
            </div>
          </div>
          <div className="pt-8 border-t border-white/[0.08] flex flex-col md:flex-row items-center justify-between gap-4">
            <p className="text-white/40 text-sm font-medium">
              © 2024 LuxTrade. All rights reserved.
            </p>
            <div className="flex gap-6">
              {['Privacy Policy', 'Terms of Service', 'Cookie Policy'].map((item) => (
                <a key={item} href="#" className="text-white/40 hover:text-white transition-colors text-sm font-medium">
                  {item}
                </a>
              ))}
            </div>
          </div>
        </div>
      </footer>

      {/* Payment Modals */}
      <PaymentConfirmationModal isOpen={showPayment} onClose={() => setShowPayment(false)} />
      <PaymentConfirmationModal isOpen={showLifetimePaymentModal} onClose={() => setShowLifetimePaymentModal(false)} />
    </div>
  )
}
