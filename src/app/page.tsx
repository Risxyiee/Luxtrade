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

// Animated Equity Widget Component
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
      
      // Draw gradient background
      const gradient = ctx.createLinearGradient(0, 0, 0, height)
      const isPositive = chartData[chartData.length - 1].value >= chartData[0].value
      if (isPositive) {
        gradient.addColorStop(0, 'rgba(34, 197, 94, 0.3)')
        gradient.addColorStop(1, 'rgba(34, 197, 94, 0)')
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
      
      // Draw line
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
      
      ctx.strokeStyle = isPositive ? '#22c55e' : '#ef4444'
      ctx.lineWidth = 2
      ctx.stroke()
      
      // Draw glow
      ctx.shadowColor = isPositive ? '#22c55e' : '#ef4444'
      ctx.shadowBlur = 10
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
    <div className="rounded-2xl bg-gradient-to-br from-[#1a0f2e] to-[#0d0715] border border-purple-500/20 p-6 backdrop-blur-sm">
      <div className="flex items-center justify-between mb-4">
        <div>
          <p className="text-sm text-purple-300/70 font-medium">Portfolio Equity</p>
          <div className="flex items-baseline gap-3">
            <span className="text-3xl font-bold text-white tracking-tight">
              ${currentValue.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </span>
            <AnimatePresence mode="wait">
              <motion.span
                key={isUp ? 'up' : 'down'}
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 10 }}
                className={`flex items-center gap-1 text-sm font-semibold ${isUp ? 'text-emerald-400' : 'text-red-400'}`}
              >
                {isUp ? <TrendingUp className="w-4 h-4" /> : <TrendingDown className="w-4 h-4" />}
                {isUp ? '+' : ''}{changePercent}%
              </motion.span>
            </AnimatePresence>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <div className={`px-3 py-1.5 rounded-full text-xs font-medium ${isUp ? 'bg-emerald-500/20 text-emerald-400' : 'bg-red-500/20 text-red-400'}`}>
            LIVE
          </div>
          <div className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
        </div>
      </div>
      
      <canvas
        ref={canvasRef}
        width={500}
        height={120}
        className="w-full h-32"
      />
      
      <div className="flex items-center justify-between mt-4 text-xs text-purple-300/50">
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

// Animated Forex Trades Component
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
            className="flex items-center justify-between p-2.5 rounded-xl bg-white/[0.03] border border-white/5 hover:bg-white/[0.05] transition-all"
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
                className={`w-9 h-9 rounded-lg flex items-center justify-center ${isProfit ? 'bg-emerald-500/20' : 'bg-red-500/20'}`}
                animate={{ 
                  scale: [1, 1.1, 1],
                  boxShadow: isProfit 
                    ? ['0 0 0 0 rgba(16, 185, 129, 0.4)', '0 0 20px 5px rgba(16, 185, 129, 0.1)', '0 0 0 0 rgba(16, 185, 129, 0)']
                    : ['0 0 0 0 rgba(239, 68, 68, 0.4)', '0 0 20px 5px rgba(239, 68, 68, 0.1)', '0 0 0 0 rgba(239, 68, 68, 0)']
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
                    className="text-sm font-bold text-white tracking-wide"
                    animate={{ opacity: [1, 0.8, 1] }}
                    transition={{ duration: 0.5, repeat: Infinity, repeatDelay: 2 }}
                  >
                    {trade.pair}
                  </motion.span>
                  <motion.span 
                    className="text-[9px] px-2 py-0.5 rounded-full bg-white/10 text-white/60 font-medium"
                    animate={{ opacity: [0.6, 1, 0.6] }}
                    transition={{ duration: 2, repeat: Infinity }}
                  >
                    {trade.session}
                  </motion.span>
                </div>
                <div className="text-[10px] text-white/50 flex items-center gap-2">
                  <motion.span 
                    className={`font-semibold ${trade.type === 'BUY' ? 'text-emerald-400' : 'text-red-400'}`}
                    animate={{ opacity: [1, 0.7, 1] }}
                    transition={{ duration: 1, repeat: Infinity }}
                  >
                    {trade.type}
                  </motion.span>
                  <span>@ {trade.price.toFixed(trade.price > 100 ? 2 : 4)}</span>
                </div>
              </div>
            </div>
            
            <div className="text-right">
              <motion.div 
                className={`text-sm font-bold font-mono ${isLiveProfit ? 'text-emerald-400' : 'text-red-400'}`}
                animate={{ 
                  opacity: [1, 0.8, 1],
                  scale: livePnl !== trade.pnl ? [1, 1.05, 1] : 1,
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
                    scale: [1, 1.2, 1],
                  }}
                  transition={{ duration: 0.8, repeat: Infinity }}
                />
                <motion.span 
                  className="text-[10px] text-white/50"
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
        className="flex justify-center pt-2"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 1 }}
      >
        <motion.div 
          className="flex gap-1"
          animate={{ y: [0, 3, 0] }}
          transition={{ duration: 1.5, repeat: Infinity }}
        >
          {[0, 1, 2].map((i) => (
            <motion.div 
              key={i}
              className="w-1.5 h-1.5 rounded-full bg-purple-400/40"
              animate={{ opacity: [0.3, 1, 0.3] }}
              transition={{ duration: 1, delay: i * 0.2, repeat: Infinity }}
            />
          ))}
        </motion.div>
      </motion.div>
    </div>
  )
}

export default function LuxTradeLanding() {
  const [showPayment, setShowPayment] = useState(false)

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
      gradient: 'from-amber-500 to-orange-600'
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
    <div className="min-h-screen bg-[#0a0612] text-white overflow-hidden">
      {/* Luxury Background Effects */}
      <div className="fixed inset-0 -z-10">
        {/* Deep purple gradient base */}
        <div className="absolute inset-0 bg-gradient-to-b from-[#0a0612] via-[#110a1f] to-[#0a0612]" />
        
        {/* Gold/amber accent glows */}
        <div className="absolute top-0 left-1/4 w-[600px] h-[600px] bg-amber-500/5 rounded-full blur-[150px]" />
        <div className="absolute bottom-1/4 right-1/4 w-[400px] h-[400px] bg-purple-500/10 rounded-full blur-[100px]" />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[400px] bg-amber-500/3 rounded-full blur-[120px]" />
        
        {/* Subtle grid pattern */}
        <div className="absolute inset-0 opacity-[0.02]" style={{
          backgroundImage: `linear-gradient(rgba(255,255,255,0.1) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.1) 1px, transparent 1px)`,
          backgroundSize: '60px 60px'
        }} />
      </div>

      {/* Navigation */}
      <nav className="fixed top-0 left-0 right-0 z-50">
        <div className="bg-gradient-to-b from-[#0a0612] to-transparent backdrop-blur-xl bg-opacity-80 border-b border-white/5">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="flex items-center justify-between h-16">
              <div className="flex items-center gap-3">
                <div className="relative">
                  <Image 
                    src="/logo-premium.png" 
                    alt="LuxTrade Logo" 
                    width={40} 
                    height={40}
                    className="rounded-xl shadow-lg"
                  />
                  <div className="absolute -bottom-1 -right-1 w-3 h-3 bg-emerald-400 rounded-full border-2 border-[#0a0612]" />
                </div>
                <div>
                  <span className="text-xl font-bold bg-gradient-to-r from-amber-200 via-amber-400 to-amber-200 bg-clip-text text-transparent">
                    LuxTrade
                  </span>
                  <span className="hidden sm:inline text-[10px] text-amber-500/60 ml-2 tracking-widest">PREMIUM</span>
                </div>
              </div>
              
              <div className="hidden md:flex items-center gap-8">
                <a href="#features" className="text-sm text-white/60 hover:text-white transition-colors">Features</a>
                <a href="#demo" className="text-sm text-white/60 hover:text-white transition-colors">Live Demo</a>
                <a href="#pricing" className="text-sm text-white/60 hover:text-white transition-colors">Pricing</a>
                <a href="#faq" className="text-sm text-white/60 hover:text-white transition-colors">FAQ</a>
              </div>
              
              <div className="flex items-center gap-3">
                <Link href="/auth/login">
                  <Button variant="ghost" className="text-white/70 hover:text-white hover:bg-white/10 hidden sm:inline-flex">
                    Login
                  </Button>
                </Link>
                <Link href="/auth/signup">
                  <Button className="bg-gradient-to-r from-amber-500 to-orange-600 hover:from-amber-600 hover:to-orange-700 text-white font-semibold shadow-lg shadow-amber-500/25">
                    Sign Up
                    <ArrowRight className="w-4 h-4 ml-2" />
                  </Button>
                </Link>
              </div>
            </div>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="pt-28 pb-16 px-4 sm:px-6 lg:px-8">
        <div className="max-w-7xl mx-auto">
          <motion.div 
            className="text-center"
            initial="hidden"
            animate="visible"
            variants={staggerContainer}
          >
            {/* Badge */}
            <motion.div variants={fadeInUp} className="flex justify-center mb-6">
              <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-gradient-to-r from-amber-500/10 to-orange-500/10 border border-amber-500/20">
                <Sparkles className="w-4 h-4 text-amber-400" />
                <span className="text-sm text-amber-300">AI-Powered Trading Intelligence</span>
              </div>
            </motion.div>
            
            {/* Main Headline */}
            <motion.h1 
              variants={fadeInUp}
              className="text-4xl sm:text-5xl lg:text-6xl font-bold mb-6 leading-tight tracking-tight"
            >
              <span className="text-white">Elevate Your Trading with</span>
              <br />
              <span className="bg-gradient-to-r from-amber-200 via-amber-400 to-orange-400 bg-clip-text text-transparent">
                Intelligent Journaling
              </span>
            </motion.h1>
            
            <motion.p 
              variants={fadeInUp}
              className="text-lg sm:text-xl text-white/50 max-w-2xl mx-auto mb-10 leading-relaxed"
            >
              The premium trading journal for serious traders. Track every trade, 
              analyze performance, and unlock AI-powered insights to gain your edge.
            </motion.p>
            
            {/* CTA Buttons */}
            <motion.div 
              variants={fadeInUp}
              className="flex flex-col sm:flex-row items-center justify-center gap-4 mb-16"
            >
              <Link href="/auth/signup">
                <Button size="lg" className="h-14 px-8 text-lg bg-gradient-to-r from-amber-500 to-orange-600 hover:from-amber-600 hover:to-orange-700 text-white font-semibold shadow-xl shadow-amber-500/25">
                  Start Free Trial
                  <ArrowRight className="w-5 h-5 ml-2" />
                </Button>
              </Link>
              <a href="#demo">
                <Button variant="outline" size="lg" className="h-14 px-8 text-lg border-white/10 text-white hover:bg-white/5">
                  <Play className="w-5 h-5 mr-2" />
                  Watch Demo
                </Button>
              </a>
            </motion.div>

            {/* Stats */}
            <motion.div 
              variants={fadeInUp}
              className="grid grid-cols-2 md:grid-cols-4 gap-3 max-w-3xl mx-auto mb-20"
            >
              {stats.map((stat, index) => (
                <div
                  key={index}
                  className="p-4 rounded-xl bg-white/[0.03] border border-white/[0.05] backdrop-blur-sm hover:bg-white/[0.05] transition-all"
                >
                  <stat.icon className="w-4 h-4 text-amber-400/60 mb-2 mx-auto" />
                  <div className="text-2xl font-bold text-white">{stat.value}</div>
                  <div className="text-xs text-white/40">{stat.label}</div>
                </div>
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

      {/* Features Section */}
      <section id="features" className="py-20 px-4 sm:px-6 lg:px-8">
        <div className="max-w-7xl mx-auto">
          <motion.div 
            className="text-center mb-16"
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
          >
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-purple-500/10 border border-purple-500/20 mb-4">
              <Zap className="w-4 h-4 text-purple-400" />
              <span className="text-sm text-purple-300">Powerful Features</span>
            </div>
            <h2 className="text-3xl sm:text-4xl font-bold mb-4">
              <span className="text-white">Everything You Need to</span>
              <span className="bg-gradient-to-r from-purple-400 to-violet-400 bg-clip-text text-transparent"> Trade Smarter</span>
            </h2>
            <p className="text-lg text-white/40 max-w-xl mx-auto">
              Professional tools designed by traders, for traders. Every feature built to give you an edge.
            </p>
          </motion.div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {features.map((feature, index) => (
              <motion.div
                key={index}
                initial={{ opacity: 0, y: 30 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: index * 0.1 }}
                className="group"
              >
                <Card className="h-full bg-white/[0.02] border-white/[0.05] hover:bg-white/[0.04] hover:border-white/10 transition-all duration-300">
                  <CardContent className="p-6">
                    <div className={`w-12 h-12 rounded-xl bg-gradient-to-br ${feature.gradient} flex items-center justify-center mb-4 group-hover:scale-110 transition-transform shadow-lg`}>
                      <feature.icon className="w-6 h-6 text-white" />
                    </div>
                    <h3 className="text-lg font-semibold text-white mb-2">{feature.title}</h3>
                    <p className="text-white/40 text-sm leading-relaxed">{feature.description}</p>
                  </CardContent>
                </Card>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Live Demo Section */}
      <section id="demo" className="py-20 px-4 sm:px-6 lg:px-8 bg-gradient-to-b from-transparent via-purple-900/5 to-transparent">
        <div className="max-w-7xl mx-auto">
          <motion.div 
            className="text-center mb-12"
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
          >
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-emerald-500/10 border border-emerald-500/20 mb-4">
              <Activity className="w-4 h-4 text-emerald-400" />
              <span className="text-sm text-emerald-300">Live Preview</span>
            </div>
            <h2 className="text-3xl sm:text-4xl font-bold mb-4">
              <span className="text-white">See It</span>
              <span className="bg-gradient-to-r from-emerald-400 to-cyan-400 bg-clip-text text-transparent"> In Action</span>
            </h2>
          </motion.div>

          {/* Dashboard Preview */}
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            whileInView={{ opacity: 1, scale: 1 }}
            viewport={{ once: true }}
            className="rounded-2xl border border-white/10 bg-gradient-to-br from-[#1a0f2e] to-[#0d0715] p-1 shadow-2xl shadow-purple-500/10"
          >
            <div className="rounded-xl overflow-hidden">
              {/* Mock Dashboard Header */}
              <div className="flex items-center gap-2 px-4 py-3 bg-white/[0.02] border-b border-white/5">
                <div className="flex gap-1.5">
                  <div className="w-3 h-3 rounded-full bg-red-500/60" />
                  <div className="w-3 h-3 rounded-full bg-yellow-500/60" />
                  <div className="w-3 h-3 rounded-full bg-green-500/60" />
                </div>
                <div className="flex-1 text-center">
                  <span className="text-xs text-white/30">LuxTrade Dashboard</span>
                </div>
              </div>
              
              {/* Mock Content */}
              <div className="p-4 space-y-4">
                {/* Stats Row */}
                <div className="grid grid-cols-4 gap-3">
                  <motion.div 
                    className="p-3 rounded-lg bg-gradient-to-br from-emerald-500/20 to-transparent border border-white/5"
                    animate={{ scale: [1, 1.02, 1] }}
                    transition={{ duration: 2, repeat: Infinity }}
                  >
                    <div className="text-[10px] text-white/40 mb-1">Total P/L</div>
                    <div className="text-lg font-bold text-emerald-400">+$1,247</div>
                  </motion.div>
                  <motion.div 
                    className="p-3 rounded-lg bg-gradient-to-br from-amber-500/20 to-transparent border border-white/5"
                    animate={{ scale: [1, 1.02, 1] }}
                    transition={{ duration: 2, repeat: Infinity, delay: 0.5 }}
                  >
                    <div className="text-[10px] text-white/40 mb-1">Win Rate</div>
                    <div className="text-lg font-bold text-amber-400">68%</div>
                  </motion.div>
                  <motion.div 
                    className="p-3 rounded-lg bg-gradient-to-br from-cyan-500/20 to-transparent border border-white/5"
                    animate={{ scale: [1, 1.02, 1] }}
                    transition={{ duration: 2, repeat: Infinity, delay: 1 }}
                  >
                    <div className="text-[10px] text-white/40 mb-1">Open</div>
                    <div className="text-lg font-bold text-cyan-400">3</div>
                  </motion.div>
                  <motion.div 
                    className="p-3 rounded-lg bg-gradient-to-br from-purple-500/20 to-transparent border border-white/5"
                    animate={{ scale: [1, 1.02, 1] }}
                    transition={{ duration: 2, repeat: Infinity, delay: 1.5 }}
                  >
                    <div className="text-[10px] text-white/40 mb-1">Profit Factor</div>
                    <div className="text-lg font-bold text-purple-400">2.14</div>
                  </motion.div>
                </div>
                
                {/* Mini Chart */}
                <div className="h-28 rounded-lg bg-gradient-to-br from-purple-500/10 to-transparent border border-white/5 p-3">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs text-white/40">Equity Curve</span>
                    <motion.div 
                      className="flex items-center gap-1"
                      animate={{ opacity: [0.5, 1, 0.5] }}
                      transition={{ duration: 2, repeat: Infinity }}
                    >
                      <div className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                      <span className="text-[10px] text-emerald-400">+12.4%</span>
                    </motion.div>
                  </div>
                  <div className="flex items-end gap-0.5 h-16">
                    {[40, 55, 45, 60, 50, 70, 65, 80, 75, 90, 85, 95, 88, 92, 100, 95, 98, 105, 100, 110].map((h, i) => (
                      <motion.div 
                        key={i}
                        className="flex-1 bg-gradient-to-t from-purple-500 to-amber-500 rounded-t"
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
          
          <div className="text-center mt-8">
            <Link href="/dashboard">
              <Button className="bg-gradient-to-r from-emerald-500 to-cyan-600 hover:from-emerald-600 hover:to-cyan-700 text-white font-semibold">
                Try Dashboard Now
                <ArrowRight className="w-4 h-4 ml-2" />
              </Button>
            </Link>
          </div>
        </div>
      </section>

      {/* Testimonials */}
      <section id="testimonials" className="py-20 px-4 sm:px-6 lg:px-8">
        <div className="max-w-7xl mx-auto">
          <motion.div 
            className="text-center mb-16"
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
          >
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-pink-500/10 border border-pink-500/20 mb-4">
              <Trophy className="w-4 h-4 text-pink-400" />
              <span className="text-sm text-pink-300">Trusted by Traders</span>
            </div>
            <h2 className="text-3xl sm:text-4xl font-bold mb-4">
              <span className="text-white">What Traders</span>
              <span className="bg-gradient-to-r from-pink-400 to-rose-400 bg-clip-text text-transparent"> Are Saying</span>
            </h2>
          </motion.div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {testimonials.map((testimonial, index) => (
              <motion.div
                key={index}
                initial={{ opacity: 0, y: 30 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: index * 0.15 }}
              >
                <Card className="h-full bg-white/[0.02] border-white/[0.05] hover:bg-white/[0.04] transition-all">
                  <CardContent className="p-6">
                    <div className="flex gap-1 mb-3">
                      {[...Array(testimonial.rating)].map((_, i) => (
                        <Star key={i} className="w-4 h-4 fill-amber-400 text-amber-400" />
                      ))}
                    </div>
                    <p className="text-white/60 mb-4 text-sm leading-relaxed">&ldquo;{testimonial.content}&rdquo;</p>
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-gradient-to-br from-amber-400 to-orange-500 flex items-center justify-center text-white font-semibold text-sm">
                        {testimonial.avatar}
                      </div>
                      <div>
                        <div className="font-medium text-white text-sm">{testimonial.name}</div>
                        <div className="text-xs text-white/40">{testimonial.role}</div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Pricing - Hanya 2 Paket: Free dan Elite Pro Rp 49.000 */}
      <section id="pricing" className="py-20 px-4 sm:px-6 lg:px-8 bg-gradient-to-b from-transparent via-amber-900/5 to-transparent">
        <div className="max-w-4xl mx-auto">
          <motion.div 
            className="text-center mb-16"
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
          >
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-amber-500/10 border border-amber-500/20 mb-4">
              <Crown className="w-4 h-4 text-amber-400" />
              <span className="text-sm text-amber-300">Simple Pricing</span>
            </div>
            <h2 className="text-3xl sm:text-4xl font-bold mb-4">
              <span className="text-white">Start Free,</span>
              <span className="bg-gradient-to-r from-amber-400 to-orange-400 bg-clip-text text-transparent"> Upgrade When Ready</span>
            </h2>
            
            {/* Money-Back Guarantee Badge */}
            <motion.div 
              className="flex justify-center mt-6"
              initial={{ opacity: 0, scale: 0.9 }}
              whileInView={{ opacity: 1, scale: 1 }}
              viewport={{ once: true }}
            >
              <div className="inline-flex items-center gap-3 px-5 py-3 bg-emerald-500/10 border border-emerald-500/30 rounded-full">
                <ShieldCheck className="w-5 h-5 text-emerald-400" />
                <span className="text-emerald-300 font-semibold">7-Day Money-Back Guarantee</span>
                <span className="text-emerald-400/60 text-sm">• No Questions Asked</span>
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
              <div className="flex items-center gap-2 px-3 py-1.5 bg-white/5 rounded-lg border border-white/10">
                <Lock className="w-4 h-4 text-cyan-400" />
                <span className="text-xs text-white/60">SSL Secured</span>
              </div>
              <div className="flex items-center gap-2 px-3 py-1.5 bg-white/5 rounded-lg border border-white/10">
                <Shield className="w-4 h-4 text-purple-400" />
                <span className="text-xs text-white/60">End-to-End Encrypted</span>
              </div>
              <div className="flex items-center gap-2 px-3 py-1.5 bg-white/5 rounded-lg border border-white/10">
                <ShieldCheck className="w-4 h-4 text-emerald-400" />
                <span className="text-xs text-white/60">SOC 2 Compliant</span>
              </div>
            </motion.div>
          </motion.div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Free Plan */}
            <motion.div
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: 0.1 }}
            >
              <Card className="h-full bg-white/[0.02] border-white/[0.05] hover:bg-white/[0.04] transition-all">
                <CardContent className="p-6 pt-8">
                  <div className="text-sm text-white/50 mb-1">Free</div>
                  <div className="text-4xl font-bold text-white mb-1">
                    Rp 0
                    <span className="text-base font-normal text-white/40"> forever</span>
                  </div>
                  <ul className="space-y-3 my-6">
                    <li className="flex items-center gap-2 text-sm text-white/60">
                      <Check className="w-4 h-4 text-emerald-400" />
                      Up to 5 trades/month
                    </li>
                    <li className="flex items-center gap-2 text-sm text-white/60">
                      <Check className="w-4 h-4 text-emerald-400" />
                      Basic analytics
                    </li>
                    <li className="flex items-center gap-2 text-sm text-white/60">
                      <Check className="w-4 h-4 text-emerald-400" />
                      Journal entries
                    </li>
                    <li className="flex items-center gap-2 text-sm text-white/40">
                      <span className="w-4 h-4 flex items-center justify-center">🔒</span>
                      Pro features locked
                    </li>
                  </ul>
                  <Link href="/auth/signup" className="block">
                    <Button 
                      className="w-full bg-white/10 hover:bg-white/20 text-white font-semibold"
                    >
                      Start Free
                    </Button>
                  </Link>
                </CardContent>
              </Card>
            </motion.div>

            {/* Elite Pro - Rp 49.000 */}
            <motion.div
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: 0.2 }}
            >
              <Card className="h-full relative bg-gradient-to-b from-amber-500/10 to-transparent border-amber-500/30">
                <div className="absolute -top-3 left-1/2 -translate-x-1/2 px-3 py-1 rounded-full bg-gradient-to-r from-amber-500 to-orange-500 text-xs font-semibold text-white">
                  Best Value
                </div>
                <CardContent className="p-6 pt-8">
                  <div className="text-sm text-amber-400 mb-1">Elite Pro</div>
                  <div className="text-4xl font-bold text-white mb-1">
                    Rp 49.000
                    <span className="text-base font-normal text-white/40"> /bulan</span>
                  </div>
                  <ul className="space-y-3 my-6">
                    <li className="flex items-center gap-2 text-sm text-white/60">
                      <Check className="w-4 h-4 text-emerald-400" />
                      Unlimited trades
                    </li>
                    <li className="flex items-center gap-2 text-sm text-white/60">
                      <Check className="w-4 h-4 text-emerald-400" />
                      Advanced analytics & AI insights
                    </li>
                    <li className="flex items-center gap-2 text-sm text-white/60">
                      <Check className="w-4 h-4 text-emerald-400" />
                      Psychology tracking & heatmap
                    </li>
                    <li className="flex items-center gap-2 text-sm text-white/60">
                      <Check className="w-4 h-4 text-emerald-400" />
                      Priority WhatsApp support
                    </li>
                  </ul>
                  <Button 
                    onClick={() => setShowPayment(true)}
                    className="w-full bg-gradient-to-r from-amber-500 to-orange-600 hover:from-amber-600 hover:to-orange-700 text-white font-semibold"
                  >
                    Go Elite Pro
                  </Button>
                </CardContent>
              </Card>
            </motion.div>
          </div>
          
          {/* Comparison Table */}
          <motion.div 
            className="mt-12 overflow-x-auto"
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
          >
            <div className="min-w-[500px] bg-white/[0.02] border border-white/5 rounded-2xl overflow-hidden">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-white/5">
                    <th className="p-4 text-left text-white/40 font-medium">Features</th>
                    <th className="p-4 text-center text-white/40 font-medium">Free</th>
                    <th className="p-4 text-center text-amber-400 font-semibold">Elite Pro</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5">
                  {[
                    { feature: 'Trades per month', free: '5', pro: 'Unlimited' },
                    { feature: 'CSV Import', free: '✓', pro: '✓' },
                    { feature: 'Basic Analytics', free: '✓', pro: '✓' },
                    { feature: 'AI Insights', free: '—', pro: '✓' },
                    { feature: 'Psychology Tracking', free: '—', pro: '✓' },
                    { feature: 'Heatmap Analytics', free: '—', pro: '✓' },
                    { feature: 'Data Export', free: '—', pro: '✓' },
                    { feature: 'Data Retention', free: '30 days', pro: 'Forever' },
                    { feature: 'Support', free: 'Email', pro: 'Priority WA' },
                  ].map((row, index) => (
                    <tr key={index} className="hover:bg-white/[0.02] transition-colors">
                      <td className="p-4 text-white/70">{row.feature}</td>
                      <td className="p-4 text-center text-white/40">{row.free}</td>
                      <td className="p-4 text-center text-emerald-400 font-medium">{row.pro}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </motion.div>
          
          {/* Onboarding Flow */}
          <motion.div 
            className="mt-16 text-center"
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
          >
            <p className="text-white/40 mb-8">Get started in less than 2 minutes</p>
            <div className="flex flex-col sm:flex-row items-center justify-center gap-4 sm:gap-8">
              {[
                { step: '1', title: 'Sign up', time: '30 sec', icon: Users },
                { step: '2', title: 'Import trades', time: '1 min', icon: BarChart3 },
                { step: '3', title: 'See analytics', time: 'Instant', icon: LineChart },
              ].map((item, index) => (
                <React.Fragment key={index}>
                  <motion.div 
                    className="flex flex-col items-center p-4"
                    whileHover={{ scale: 1.05 }}
                  >
                    <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-amber-500/20 to-orange-500/20 border border-amber-500/30 flex items-center justify-center mb-3">
                      <item.icon className="w-5 h-5 text-amber-400" />
                    </div>
                    <span className="text-white font-semibold">{item.title}</span>
                    <span className="text-white/40 text-sm">{item.time}</span>
                  </motion.div>
                  {index < 2 && <ArrowRight className="w-5 h-5 text-white/20 hidden sm:block" />}
                </React.Fragment>
              ))}
            </div>
          </motion.div>
        </div>
      </section>

      {/* Newsletter Section */}
      <section className="py-16 px-4 sm:px-6 lg:px-8 bg-gradient-to-b from-transparent via-cyan-900/5 to-transparent">
        <div className="max-w-2xl mx-auto text-center">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
          >
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-cyan-500/10 border border-cyan-500/20 mb-4">
              <Mail className="w-4 h-4 text-cyan-400" />
              <span className="text-sm text-cyan-300">Weekly Insights</span>
            </div>
            <h2 className="text-2xl sm:text-3xl font-bold mb-4 text-white">
              Get Trading Tips Every Week
            </h2>
            <p className="text-white/40 mb-6 max-w-md mx-auto">
              Join 500+ traders receiving weekly trading tips, psychology insights, and market analysis.
            </p>
            <form className="flex flex-col sm:flex-row gap-3 max-w-md mx-auto" onSubmit={(e) => e.preventDefault()}>
              <input 
                type="email" 
                placeholder="Enter your email"
                className="flex-1 px-4 py-3 rounded-xl bg-white/5 border border-white/10 text-white placeholder:text-white/30 focus:outline-none focus:border-cyan-500/50 transition-colors"
              />
              <Button 
                type="submit"
                className="px-6 py-3 bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-600 hover:to-blue-700 text-white font-semibold rounded-xl"
              >
                Subscribe
              </Button>
            </form>
            <p className="text-white/30 text-xs mt-3">No spam. Unsubscribe anytime.</p>
          </motion.div>
        </div>
      </section>

      {/* Roadmap Section - Coming Soon Features */}
      <section id="roadmap" className="py-20 px-4 sm:px-6 lg:px-8 bg-gradient-to-b from-transparent via-purple-900/10 to-transparent">
        <div className="max-w-5xl mx-auto">
          <motion.div 
            className="text-center mb-12"
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
          >
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-purple-500/10 border border-purple-500/20 mb-4">
              <Clock className="w-4 h-4 text-purple-400" />
              <span className="text-sm text-purple-300">Product Roadmap</span>
            </div>
            <h2 className="text-3xl sm:text-4xl font-bold mb-4">
              <span className="text-white">What&apos;s</span>
              <span className="bg-gradient-to-r from-purple-400 to-violet-400 bg-clip-text text-transparent"> Coming Next</span>
            </h2>
            <p className="text-white/40 max-w-xl mx-auto">
              We&apos;re constantly improving LuxTrade. Here&apos;s what we&apos;re working on.
            </p>
          </motion.div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Minggu Depan */}
            <motion.div
              initial={{ opacity: 0, x: -20 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
              transition={{ delay: 0.1 }}
            >
              <Card className="h-full bg-gradient-to-br from-[#1a0f2e] to-[#0d0715] border-purple-500/20">
                <CardContent className="p-6">
                  <div className="flex items-center gap-3 mb-4">
                    <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-cyan-500/20 to-blue-500/20 border border-cyan-500/30 flex items-center justify-center">
                      <Clock className="w-5 h-5 text-cyan-400" />
                    </div>
                    <div>
                      <h3 className="font-bold text-white">Minggu Depan</h3>
                      <p className="text-xs text-cyan-400">Coming Soon</p>
                    </div>
                  </div>
                  <ul className="space-y-3">
                    {[
                      { icon: '💱', title: 'Real-time Forex Prices API', desc: 'Live market prices directly in your dashboard' },
                      { icon: '📄', title: 'Export to PDF', desc: 'Download your trading reports instantly' },
                      { icon: '🔔', title: 'Price Alerts System', desc: 'Get notified when price hits your target' },
                    ].map((item, index) => (
                      <motion.li 
                        key={index}
                        className="flex items-start gap-3 p-3 rounded-lg bg-white/[0.02] border border-white/5 hover:border-cyan-500/20 transition-colors"
                        initial={{ opacity: 0, y: 10 }}
                        whileInView={{ opacity: 1, y: 0 }}
                        viewport={{ once: true }}
                        transition={{ delay: 0.1 + index * 0.05 }}
                      >
                        <span className="text-xl">{item.icon}</span>
                        <div>
                          <p className="font-medium text-white text-sm">{item.title}</p>
                          <p className="text-xs text-white/40">{item.desc}</p>
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
              <Card className="h-full bg-gradient-to-br from-[#1a0f2e] to-[#0d0715] border-amber-500/20">
                <CardContent className="p-6">
                  <div className="flex items-center gap-3 mb-4">
                    <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-amber-500/20 to-orange-500/20 border border-amber-500/30 flex items-center justify-center">
                      <Lightning className="w-5 h-5 text-amber-400" />
                    </div>
                    <div>
                      <h3 className="font-bold text-white">Bulan Ini</h3>
                      <p className="text-xs text-amber-400">In Development</p>
                    </div>
                  </div>
                  <ul className="space-y-3">
                    {[
                      { icon: '📊', title: 'TradingView Chart Integration', desc: 'Advanced charting with TradingView widgets' },
                      { icon: '📥', title: 'MT4/MT5 Import Improvement', desc: 'Better parsing and more formats supported' },
                      { icon: '💳', title: 'Payment Gateway (Midtrans)', desc: 'Instant activation with automatic payment' },
                    ].map((item, index) => (
                      <motion.li 
                        key={index}
                        className="flex items-start gap-3 p-3 rounded-lg bg-white/[0.02] border border-white/5 hover:border-amber-500/20 transition-colors"
                        initial={{ opacity: 0, y: 10 }}
                        whileInView={{ opacity: 1, y: 0 }}
                        viewport={{ once: true }}
                        transition={{ delay: 0.2 + index * 0.05 }}
                      >
                        <span className="text-xl">{item.icon}</span>
                        <div>
                          <p className="font-medium text-white text-sm">{item.title}</p>
                          <p className="text-xs text-white/40">{item.desc}</p>
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
            className="mt-8"
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ delay: 0.3 }}
          >
            <Card className="bg-gradient-to-br from-emerald-500/5 to-teal-500/5 border-emerald-500/20">
              <CardContent className="p-6">
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-emerald-500/20 to-teal-500/20 border border-emerald-500/30 flex items-center justify-center">
                    <Check className="w-5 h-5 text-emerald-400" />
                  </div>
                  <div>
                    <h3 className="font-bold text-white">Sudah Tersedia Sekarang</h3>
                    <p className="text-xs text-emerald-400">Live Features</p>
                  </div>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
                  {[
                    'Equity Curve Chart',
                    'Session Analytics',
                    'Filter & Search',
                    'CSV Import',
                    'Smart MT Import',
                    'AI Insights',
                    'Risk Calculator',
                    'Trading Journal',
                  ].map((feature, index) => (
                    <div 
                      key={index}
                      className="flex items-center gap-2 p-2 rounded-lg bg-white/[0.02] border border-emerald-500/10"
                    >
                      <Check className="w-3 h-3 text-emerald-400 flex-shrink-0" />
                      <span className="text-xs text-white/70">{feature}</span>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </motion.div>
        </div>
      </section>

      {/* Final CTA */}
      <section className="py-20 px-4 sm:px-6 lg:px-8">
        <div className="max-w-3xl mx-auto">
          <motion.div 
            className="text-center p-10 rounded-3xl bg-gradient-to-br from-amber-500/10 via-purple-500/5 to-amber-500/10 border border-amber-500/20"
            initial={{ opacity: 0, scale: 0.95 }}
            whileInView={{ opacity: 1, scale: 1 }}
            viewport={{ once: true }}
          >
            <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-amber-400 to-orange-500 flex items-center justify-center mx-auto mb-6 shadow-xl shadow-amber-500/25">
              <Crown className="w-8 h-8 text-white" />
            </div>
            <h2 className="text-2xl sm:text-3xl font-bold mb-4 text-white">
              Ready to Trade Smarter?
            </h2>
            <p className="text-white/50 mb-8 max-w-md mx-auto">
              Join traders who are using LuxTrade to track, analyze, and improve their trading performance.
            </p>
            <Link href="/auth/signup">
              <Button size="lg" className="h-14 px-8 text-lg bg-gradient-to-r from-amber-500 to-orange-600 hover:from-amber-600 hover:to-orange-700 text-white font-semibold shadow-xl shadow-amber-500/25">
                Start Your Free Trial
                <ArrowRight className="w-5 h-5 ml-2" />
              </Button>
            </Link>
          </motion.div>
        </div>
      </section>

      {/* FAQ Section */}
      <section id="faq" className="py-20 px-4 sm:px-6 lg:px-8 bg-gradient-to-b from-transparent via-purple-900/5 to-transparent">
        <div className="max-w-3xl mx-auto">
          <motion.div 
            className="text-center mb-12"
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
          >
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-cyan-500/10 border border-cyan-500/20 mb-4">
              <HelpCircle className="w-4 h-4 text-cyan-400" />
              <span className="text-sm text-cyan-300">FAQ</span>
            </div>
            <h2 className="text-3xl sm:text-4xl font-bold mb-4">
              <span className="text-white">Frequently Asked</span>
              <span className="bg-gradient-to-r from-cyan-400 to-blue-400 bg-clip-text text-transparent"> Questions</span>
            </h2>
            <p className="text-white/40 max-w-xl mx-auto">
              Everything you need to know about LuxTrade
            </p>
          </motion.div>

          <div className="space-y-4">
            {[
              {
                q: "Bagaimana cara import trades ke LuxTrade?",
                a: "Cukup upload file CSV dari MetaTrader 4/5 atau cTrader. Sistem kami akan otomatis mem-parsing data dan menampilkannya dalam dashboard. Proses import hanya membutuhkan beberapa detik."
              },
              {
                q: "Apakah data trading saya aman?",
                a: "Ya, kami menggunakan enkripsi end-to-end untuk semua data. Server kami tersimpan di data center dengan sertifikasi SOC 2. Data Anda tidak akan pernah dibagikan ke pihak ketiga."
              },
              {
                q: "Bagaimana cara pembayaran Elite Pro?",
                a: "Pembayaran dilakukan via transfer bank ke Bank Jago. Setelah transfer, konfirmasi via WhatsApp dan akun Anda akan di-upgrade dalam 24 jam."
              },
              {
                q: "Bisa cancel subscription kapan saja?",
                a: "Ya, Anda bisa cancel kapan saja tanpa penalty. Setelah cancel, akses Elite Pro tetap aktif hingga akhir periode billing."
              },
              {
                q: "Format CSV apa saja yang didukung?",
                a: "Kami mendukung format CSV dari MetaTrader 4, MetaTrader 5, cTrader, dan format custom. Jika format Anda berbeda, tim support kami siap membantu."
              },
              {
                q: "Berapa lama data disimpan?",
                a: "Untuk akun Free, data disimpan selama 30 hari. Untuk Elite Pro, data disimpan tanpa batas waktu dan bisa di-export kapan saja."
              }
            ].map((faq, index) => (
              <motion.div
                key={index}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: index * 0.1 }}
              >
                <details className="group bg-white/[0.02] border border-white/5 rounded-xl hover:border-white/10 transition-all">
                  <summary className="flex items-center justify-between cursor-pointer p-5 text-white font-medium list-none">
                    {faq.q}
                    <ChevronDown className="w-5 h-5 text-white/40 group-open:rotate-180 transition-transform" />
                  </summary>
                  <div className="px-5 pb-5 text-white/60 text-sm leading-relaxed border-t border-white/5 pt-4">
                    {faq.a}
                  </div>
                </details>
              </motion.div>
            ))}
          </div>

          <motion.div 
            className="text-center mt-10"
            initial={{ opacity: 0 }}
            whileInView={{ opacity: 1 }}
            viewport={{ once: true }}
          >
            <p className="text-white/40 mb-4">Masih ada pertanyaan? Tanyakan ke AI Assistant kami</p>
            <button 
              onClick={() => {
                const chatButton = document.getElementById('chatbase-bubble-button');
                if (chatButton) {
                  (chatButton as HTMLElement).click();
                }
              }}
              className="inline-flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-cyan-500 to-blue-600 rounded-full text-white font-semibold hover:from-cyan-600 hover:to-blue-700 transition-all shadow-lg shadow-cyan-500/25"
            >
              <Bot className="w-5 h-5" />
              Chat dengan AI Assistant
            </button>
            <p className="text-white/30 text-xs mt-3">Powered by AI • Online 24/7</p>
          </motion.div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-white/5 py-12 px-4 sm:px-6 lg:px-8">
        <div className="max-w-7xl mx-auto">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-8 mb-8">
            <div className="col-span-2 md:col-span-1">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-amber-400 to-orange-600 flex items-center justify-center">
                  <Crown className="w-5 h-5 text-white" />
                </div>
                <span className="text-lg font-bold bg-gradient-to-r from-amber-200 to-amber-400 bg-clip-text text-transparent">
                  LuxTrade
                </span>
              </div>
              <p className="text-white/40 text-sm">
                Premium trading journal for serious traders.
              </p>
            </div>
            <div>
              <h4 className="font-semibold text-white mb-4">Product</h4>
              <ul className="space-y-2 text-sm text-white/40">
                <li><a href="#features" className="hover:text-white transition-colors">Features</a></li>
                <li><a href="#pricing" className="hover:text-white transition-colors">Pricing</a></li>
                <li><a href="#demo" className="hover:text-white transition-colors">Live Demo</a></li>
              </ul>
            </div>
            <div>
              <h4 className="font-semibold text-white mb-4">Company</h4>
              <ul className="space-y-2 text-sm text-white/40">
                <li><a href="#faq" className="hover:text-white transition-colors">About</a></li>
                <li><a href="#testimonials" className="hover:text-white transition-colors">Reviews</a></li>
                <li>
                  <a 
                    href="https://wa.me/6285712054394" 
                    target="_blank"
                    rel="noopener noreferrer"
                    className="hover:text-white transition-colors"
                  >
                    Contact
                  </a>
                </li>
              </ul>
            </div>
            <div>
              <h4 className="font-semibold text-white mb-4">Legal</h4>
              <ul className="space-y-2 text-sm text-white/40">
                <li><a href="#faq" className="hover:text-white transition-colors">Privacy Policy</a></li>
                <li><a href="#faq" className="hover:text-white transition-colors">Terms of Service</a></li>
                <li><a href="#faq" className="hover:text-white transition-colors">Refund Policy</a></li>
              </ul>
            </div>
          </div>
          <div className="border-t border-white/5 pt-8 text-center text-white/40 text-sm">
            <p>&copy; {new Date().getFullYear()} LuxTrade. All rights reserved.</p>
          </div>
        </div>
      </footer>

      {/* Payment Modal - Bank Jago */}
      <AnimatePresence>
        {showPayment && (
          <motion.div 
            initial={{ opacity: 0 }} 
            animate={{ opacity: 1 }} 
            exit={{ opacity: 0 }} 
            className="fixed inset-0 z-[100] bg-black/90 backdrop-blur-xl flex items-center justify-center p-6"
          >
            <motion.div 
              initial={{ scale: 0.9 }} 
              animate={{ scale: 1 }} 
              className="bg-[#0A0A0A] border-2 border-amber-500/50 p-8 rounded-3xl max-w-md w-full shadow-[0_0_80px_rgba(245,158,11,0.3)] text-center relative"
            >
              <button 
                onClick={() => setShowPayment(false)} 
                className="absolute top-4 right-4 text-white/40 hover:text-white transition-colors"
              >
                ✕
              </button>
              
              <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-amber-400 to-orange-600 flex items-center justify-center mx-auto mb-4">
                <Crown className="w-6 h-6 text-white" />
              </div>
              
              <h2 className="text-2xl font-bold text-white mb-6">Upgrade to Elite Pro</h2>
              
              <div className="bg-white/5 p-6 rounded-2xl border border-white/10 mb-6 text-left space-y-4">
                <div>
                  <p className="text-amber-400 text-xs font-bold uppercase mb-1">Bank Tujuan</p>
                  <p className="text-white font-bold text-xl">Bank Jago</p>
                </div>
                <div>
                  <p className="text-amber-400 text-xs font-bold uppercase mb-1">Nomor Rekening</p>
                  <p className="text-white font-bold text-2xl font-mono">104051474194</p>
                </div>
                <div>
                  <p className="text-amber-400 text-xs font-bold uppercase mb-1">Atas Nama</p>
                  <p className="text-white/70 font-semibold">RIZQI AKBAR PRATAMA</p>
                </div>
                <div className="pt-4 border-t border-white/10 text-center">
                  <p className="text-white/40 text-xs mb-1">Total Pembayaran</p>
                  <p className="text-amber-400 font-bold text-3xl">Rp 49.000</p>
                  <p className="text-white/40 text-xs">per bulan</p>
                </div>
              </div>
              
              <button 
                onClick={() => window.open('https://wa.me/6285712054394?text=Halo%20Admin%20LuxTrade,%20saya%20sudah%20transfer%20Rp49.000%20untuk%20Elite%20Pro.%20Mohon%20dikonfirmasi.', '_blank')}
                className="w-full bg-[#128C7E] py-4 rounded-xl font-bold text-white flex items-center justify-center gap-2 hover:bg-[#075e54] transition-all"
              >
                <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/></svg>
                Konfirmasi via WhatsApp
              </button>
              
              <p className="text-white/30 text-xs mt-4">
                Setelah transfer, klik tombol di atas untuk konfirmasi
              </p>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
