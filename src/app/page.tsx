'use client'

import React, { useState, useEffect, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import Link from 'next/link'
import Image from 'next/image'
import {
  TrendingUp, TrendingDown, BarChart3, BookOpen,
  Eye, Brain, Sparkles, ArrowRight, Play,
  ChevronRight, Star, Zap, Check, Crown,
  Activity,
  HelpCircle, Lock,
  Clock, Mail, Zap as Lightning, X, AlertTriangle
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import PaymentConfirmationModal from '@/components/PaymentConfirmationModal'
import LegalPagesModal, { type LegalPageTab } from '@/components/LegalPagesModal'
import { useLanguage } from '@/contexts/LanguageContext'
import LanguageSwitcher from '@/components/LanguageSwitcher'

interface EquityPoint {
  time: number;
  value: number;
  change: number;
}

function generateEquityData(points: number): EquityPoint[] {
  const data: EquityPoint[] = []
  let equity = 10500
  for (let i = 0; i < points; i++) {
    const change = (Math.random() - 0.45) * 150
    equity = Math.max(9500, Math.min(12000, equity + change))
    data.push({ time: i, value: equity, change })
  }
  return data
}

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
      const values = chartData.map(d => d.value)
      const minVal = Math.min(...values)
      const maxVal = Math.max(...values)
      const range = maxVal - minVal || 1

      const gradient = ctx.createLinearGradient(0, 0, 0, height)
      const isPositive = chartData[chartData.length - 1].value >= chartData[0].value
      if (isPositive) {
        gradient.addColorStop(0, 'rgba(147, 51, 234, 0.4)')
        gradient.addColorStop(0.5, 'rgba(59, 130, 246, 0.3)')
        gradient.addColorStop(1, 'rgba(59, 130, 246, 0)')
      } else {
        gradient.addColorStop(0, 'rgba(239, 68, 68, 0.3)')
        gradient.addColorStop(1, 'rgba(239, 68, 68, 0)')
      }

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

      ctx.beginPath()
      chartData.forEach((point, i) => {
        const x = (i / (chartData.length - 1)) * width
        const y = height - ((point.value - minVal) / range) * height * 0.8 - height * 0.1
        if (i === 0) ctx.moveTo(x, y)
        else ctx.lineTo(x, y)
      })

      const lineGradient = ctx.createLinearGradient(0, 0, width, 0)
      lineGradient.addColorStop(0, '#9333ea')
      lineGradient.addColorStop(0.5, '#3b82f6')
      lineGradient.addColorStop(1, '#06b6d4')
      ctx.strokeStyle = isPositive ? lineGradient : '#ef4444'
      ctx.lineWidth = 2.5
      ctx.stroke()
      ctx.shadowColor = isPositive ? '#8b5cf6' : '#ef4444'
      ctx.shadowBlur = 15
      ctx.stroke()
      ctx.shadowBlur = 0
    }

    drawChart(dataRef.current)

    const interval = setInterval(() => {
      const prevData = dataRef.current
      const newData = [...prevData.slice(1)]
      const lastPoint = prevData[prevData.length - 1]
      const change = (Math.random() - 0.45) * 80
      const newValue = Math.max(9500, Math.min(12000, lastPoint.value + change))
      setCurrentValue(newValue)
      setIsUp(newValue >= lastPoint.value)
      newData.push({ time: lastPoint.time + 1, value: newValue, change })
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
            animate={{ boxShadow: ['0 0 0 0 rgba(16, 185, 129, 0.7)', '0 0 0 10px rgba(16, 185, 129, 0)', '0 0 0 0 rgba(16, 185, 129, 0.7)'] }}
            transition={{ duration: 2, repeat: Infinity }}
          />
        </div>
      </div>
      <canvas ref={canvasRef} width={500} height={120} className="w-full h-32" />
      <div className="flex items-center justify-between mt-4 text-xs text-purple-300/60 font-medium">
        <span>Start: $10,500.00</span>
        <span>Updated just now</span>
      </div>
    </div>
  )
}

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
                  <motion.span className="text-sm font-extrabold text-white tracking-wide" animate={{ opacity: [1, 0.8, 1] }} transition={{ duration: 0.5, repeat: Infinity, repeatDelay: 2 }}>
                    {trade.pair}
                  </motion.span>
                  <motion.span className="text-[9px] px-2.5 py-0.5 rounded-full bg-purple-500/20 border border-purple-500/30 text-purple-300 font-bold backdrop-blur-sm" animate={{ opacity: [0.6, 1, 0.6] }} transition={{ duration: 2, repeat: Infinity }}>
                    {trade.session}
                  </motion.span>
                </div>
                <div className="text-[10px] text-white/50 flex items-center gap-2">
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
                <motion.span className="text-[10px] text-white/50 font-semibold" animate={{ opacity: [0.5, 1, 0.5] }} transition={{ duration: 1.5, repeat: Infinity }}>
                  Live
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

function LifetimeUltraCard({ onButtonClick, language, t, promoRemaining }: { onButtonClick: () => void, language: 'id' | 'en', t: (key: string) => string, promoRemaining: number | null }) {
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const timer = setTimeout(() => { setLoading(false) }, 0)
    return () => clearTimeout(timer)
  }, [])

  const isSoldOut = promoRemaining !== null && promoRemaining <= 0

  if (loading) {
    return (
      <motion.div initial={{ opacity: 0, y: 30 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ delay: 0.3 }}>
        <div className="h-full bg-[#2a1b3d]/40 backdrop-blur-sm border border-white/10 rounded-3xl p-8">
          <div className="animate-pulse"><div className="h-6 bg-white/10 rounded mb-4 w-1/2" /><div className="h-8 bg-white/10 rounded mb-2 w-3/4" /><div className="space-y-3">{[1,2,3,4].map(i => <div key={i} className="h-4 bg-white/10 rounded" />)}</div></div>
        </div>
      </motion.div>
    )
  }

  return (
    <motion.div initial={{ opacity: 0, y: 30 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ delay: 0.3 }}>
      <div className={`h-full relative bg-[#2a1b3d]/40 backdrop-blur-sm border ${isSoldOut ? 'border-red-500/30' : 'border-amber-500/30'} rounded-3xl p-8 pt-10 hover:bg-[#2a1b3d]/60 transition-colors`}>
        {isSoldOut && (
          <div className="absolute -top-3 left-1/2 -translate-x-1/2 px-4 py-1.5 rounded-full bg-red-500 text-xs font-bold text-white backdrop-blur-sm animate-pulse">SOLD OUT</div>
        )}
        {!isSoldOut && (
          <motion.div className="absolute -top-3 left-1/2 -translate-x-1/2 px-4 py-1.5 rounded-full bg-gradient-to-r from-amber-500 to-orange-500 text-xs font-bold text-white flex items-center gap-1.5 backdrop-blur-sm border border-amber-400/30" animate={{ boxShadow: ['0 0 0 0 rgba(251, 191, 36, 0.4)', '0 0 20px 5px rgba(251, 191, 36, 0.2)', '0 0 0 0 rgba(251, 191, 36, 0)'] }} transition={{ duration: 2, repeat: Infinity }}>
            <Sparkles className="w-3.5 h-3.5" />
            {t('pricing.lifetime.promo').replace('30', (promoRemaining ?? 30).toString())}
          </motion.div>
        )}
        <div className="flex items-center justify-center mb-6">
          <Crown className="w-5 h-5 text-amber-400" />
          <div className="w-3" />
          <h3 className="text-2xl font-bold text-white">{t('pricing.lifetime.title')}</h3>
        </div>
        <p className="text-[12px] text-white/60 text-center mb-6 leading-relaxed">{t('pricing.lifetime.desc')}</p>
        <div className="text-3xl font-extrabold text-white text-center mb-2">
          {t('pricing.lifetime.price').split(' /')[0]}
        </div>
        {!isSoldOut && (
          <div className="text-center mb-6">
            <span className="text-xs font-bold text-amber-300">{t('pricing.lifetime.promo').replace('30', (promoRemaining ?? 30).toString())}</span>
          </div>
        )}
        <div className="flex flex-col gap-3.5 mb-8">
          {[
            { text: language === 'id' ? 'Akses seumur hidup semua fitur' : 'Lifetime access to all features' },
            { text: language === 'id' ? 'VIP Telegram & grup privat' : 'VIP Telegram & private group' },
            { text: language === 'id' ? 'Tanpa biaya bulanan' : 'No monthly fees ever' },
            { text: language === 'id' ? 'Semua fitur Elite PRO' : 'All Elite PRO features' },
          ].map((item, index) => (
            <div key={index} className="flex items-start gap-3 text-sm text-white/70">
              <Zap className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
              <span>{item.text}</span>
            </div>
          ))}
        </div>
        <Button disabled={isSoldOut} onClick={onButtonClick} className={`w-full h-[52px] rounded-2xl font-medium ${isSoldOut ? 'bg-white/10 text-white/50 cursor-not-allowed' : 'bg-gradient-to-r from-amber-500 to-orange-600 hover:from-amber-600 hover:to-orange-700 text-white shadow-lg active:scale-95 transition-transform'}`}>
          {isSoldOut ? 'SOLD OUT' : (language === 'id' ? 'Ambil Promo Lifetime' : 'Get Lifetime Promo')}
        </Button>
      </div>
    </motion.div>
  )
}

export default function LuxTradeLanding() {
  const { language, t, formatPrice } = useLanguage()
  const [showPayment, setShowPayment] = useState(false)
  const [showLifetimePaymentModal, setShowLifetimePaymentModal] = useState(false)
  const [showLegalModal, setShowLegalModal] = useState(false)
  const [legalModalTab, setLegalModalTab] = useState<LegalPageTab>('terms')

  const openLegalPage = (tab: LegalPageTab) => {
    setLegalModalTab(tab)
    setShowLegalModal(true)
  }
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [promoRemaining, setPromoRemaining] = useState<number | null>(null)
  const [promoMax, setPromoMax] = useState<number>(30)
  const [promoActive, setPromoActive] = useState<boolean | null>(null)
  const [carouselIndex, setCarouselIndex] = useState(0)
  const [newsletterEmail, setNewsletterEmail] = useState('')
  const [newsletterLoading, setNewsletterLoading] = useState(false)
  const [newsletterSuccess, setNewsletterSuccess] = useState(false)
  const touchStartX = useRef(0)

  const screenshots = [
    '/screenshots/01.jpeg', '/screenshots/02.jpeg', '/screenshots/03.jpeg',
    '/screenshots/04.jpeg', '/screenshots/05.jpeg', '/screenshots/06.jpeg',
  ]

  useEffect(() => {
    fetch('/api/promo-quota?code=TRADERCEPAT')
      .then(res => res.ok ? res.json() : null)
      .then(data => {
        if (data && data.maxQuota > 0) {
          setPromoRemaining(data.remainingQuota)
          setPromoMax(data.maxQuota)
          setPromoActive(data.isActive)
        }
      })
      .catch(() => {})
  }, [])

  const skrillLinks = {
    pro: 'https://skrill.me/rq/RIZQI%20AKBAR/3/USD?key=vXcr_5kNitZJFVBnkmK0sakLnjB',
    lifetime: 'https://skrill.me/rq/RIZQI%20AKBAR/5/USD?key=EI71vCJNy64rGTOWNzhHPcWiTXS'
  }

  const handleNewsletterSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!newsletterEmail.trim()) return
    setNewsletterLoading(true)
    try {
      const res = await fetch('/api/newsletter', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: newsletterEmail })
      })
      const data = await res.json()
      if (res.ok) {
        setNewsletterSuccess(true)
        setNewsletterEmail('')
        setTimeout(() => setNewsletterSuccess(false), 4000)
      }
    } catch { /* ignore */ }
    setNewsletterLoading(false)
  }

  const handleProUpgrade = () => {
    if (language === 'en') window.open(skrillLinks.pro, '_blank')
    else setShowPayment(true)
  }
  const handleLifetimeUpgrade = () => {
    if (language === 'en') window.open(skrillLinks.lifetime, '_blank')
    else setShowLifetimePaymentModal(true)
  }

  const stats = [
    { value: '10+', label: language === 'id' ? 'Tipe Analitik' : 'Analytics Types', icon: BarChart3 },
    { value: '24/7', label: language === 'id' ? 'Akses Dashboard' : 'Dashboard Access', icon: Activity },
    { value: 'AI', label: language === 'id' ? 'Analisis Cerdas' : 'Smart Analysis', icon: Brain },
    { value: 'E2E', label: language === 'id' ? 'Enkripsi Data' : 'Data Encryption', icon: Lock },
  ]

  const features = [
    { icon: BarChart3, title: 'Analitik Performa', description: language === 'id' ? 'Win rate, profit factor, performa bulanan — semua divisualisasi biar kamu tahu seberapa konsisten kamu sebenarnya.' : 'Win rate, profit factor, monthly performance — all visualized so you know how consistent you really are.', gradient: 'from-purple-500 to-violet-600' },
    { icon: BookOpen, title: 'Jurnal Trading', description: language === 'id' ? 'Catat entry, exit, emosi, dan alasan di balik setiap trade. Review-nya nanti biar kamu nggak ngulangin kesalahan yang sama.' : 'Log entry, exit, emotions, and reasoning behind every trade. Review later so you don\'t repeat the same mistakes.', gradient: 'from-purple-500 to-violet-600' },
    { icon: Brain, title: 'AI Deteksi Pola', description: language === 'id' ? 'AI menganalisis histori trade kamu dan nunjukin pola kerugian yang kamu sendiri nggak sadar sudah berulang puluhan kali.' : 'AI analyzes your trade history and shows losing patterns you didn\'t even realize you\'ve repeated dozens of times.', gradient: 'from-cyan-500 to-blue-600' },
    { icon: Eye, title: 'Watchlist Cerdas', description: language === 'id' ? 'Pantau pair yang kamu incar, catat setup yang muncul, dan jangan sampai kehilangan momen karena lupa.' : 'Watch the pairs you\'re targeting, log setups that appear, and don\'t miss moments because you forgot.', gradient: 'from-emerald-500 to-teal-600' },
  ]



  return (
    <div className="min-h-screen bg-[#0f051d] text-white overflow-x-hidden flex flex-col">
      {/* Particle Background */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden z-10">
        <div className="absolute w-3 h-3 bg-purple-500/40 rounded-full animate-ping" style={{ top: '5%', left: '3%', animationDuration: '3s' }} />
        <div className="absolute w-2 h-2 bg-purple-400/50 rounded-full animate-pulse" style={{ top: '12%', left: '8%', animationDuration: '4s' }} />
        <div className="absolute w-4 h-4 bg-blue-500/30 rounded-full animate-ping" style={{ top: '8%', left: '15%', animationDuration: '3.5s' }} />
        <div className="absolute w-2 h-2 bg-purple-300/60 rounded-full animate-pulse" style={{ top: '18%', left: '20%', animationDuration: '2.5s' }} />
        <div className="absolute w-3 h-3 bg-purple-500/35 rounded-full animate-ping" style={{ top: '25%', left: '5%', animationDuration: '4.5s' }} />
        <div className="absolute w-2 h-2 bg-blue-400/40 rounded-full animate-pulse" style={{ top: '35%', left: '12%', animationDuration: '3s' }} />
        <div className="absolute w-4 h-4 bg-purple-500/35 rounded-full animate-ping" style={{ top: '30%', left: '22%', animationDuration: '4.5s' }} />
        <div className="absolute w-2 h-2 bg-purple-300/50 rounded-full animate-pulse" style={{ top: '50%', left: '8%', animationDuration: '4s' }} />
        <div className="absolute w-3 h-3 bg-purple-500/40 rounded-full animate-ping" style={{ top: '70%', left: '10%', animationDuration: '4.2s' }} />
        <div className="absolute w-2 h-2 bg-blue-400/45 rounded-full animate-pulse" style={{ top: '78%', left: '20%', animationDuration: '3.5s' }} />
        <div className="absolute w-2 h-2 bg-purple-500/50 rounded-full animate-pulse" style={{ top: '20%', left: '78%', animationDuration: '4.2s' }} />
        <div className="absolute w-4 h-4 bg-blue-500/35 rounded-full animate-ping" style={{ top: '7%', left: '88%', animationDuration: '3.2s' }} />
        <div className="absolute w-2 h-2 bg-purple-300/55 rounded-full animate-pulse" style={{ top: '14%', left: '92%', animationDuration: '2.8s' }} />
        <div className="absolute w-3 h-3 bg-purple-500/45 rounded-full animate-ping" style={{ top: '62%', left: '78%', animationDuration: '4.2s' }} />
        <div className="absolute w-2 h-2 bg-blue-400/35 rounded-full animate-pulse" style={{ top: '50%', left: '85%', animationDuration: '4.5s' }} />
        <div className="absolute w-4 h-4 bg-purple-400/40 rounded-full animate-ping" style={{ top: '58%', left: '90%', animationDuration: '3s' }} />
        <div className="absolute w-2 h-2 bg-purple-300/50 rounded-full animate-pulse" style={{ top: '85%', left: '80%', animationDuration: '3.8s' }} />
      </div>

      {/* Announcement Bar */}
      <div className="fixed top-0 left-0 right-0 z-[60] h-10 flex items-center justify-center bg-purple-500/10 border-b border-white/10 backdrop-blur-md overflow-hidden">
        <div className="flex items-center gap-2 text-sm font-medium tracking-wide">
          <motion.div animate={{ boxShadow: ['0 0 0 0 rgba(139, 92, 246, 0.7)', '0 0 0 8px rgba(139, 92, 246, 0)', '0 0 0 0 rgba(139, 92, 246, 0.7)'] }} transition={{ duration: 2, repeat: Infinity }}>
            <Sparkles className="w-4 h-4 text-purple-400" />
          </motion.div>
          <span className="text-white/90">{language === 'id' ? 'PROMO TRADERCEPAT' : 'TRADERCEPAT PROMO'}</span>
          <span className="hidden sm:inline text-white/60">—</span>
          <span className="hidden sm:inline text-purple-300 font-bold">{language === 'id' ? '3 Bulan PRO Gratis! Sisa slot terbatas' : '3 Months PRO Free! Limited slots'}</span>
          <Link href="/auth/signup" className="ml-2 text-xs font-bold text-purple-300 hover:text-white flex items-center gap-1 transition-colors">
            {language === 'id' ? 'Daftar' : 'Sign Up'} <ArrowRight className="w-3 h-3" />
          </Link>
        </div>
      </div>

      {/* Navigation */}
      <nav className="fixed top-10 left-0 right-0 z-50">
        <div className="backdrop-blur-xl bg-[#0f051d]/80 border-b border-white/[0.08]">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="flex items-center justify-between h-14">
              <div className="flex items-center gap-3">
                <div className="relative">
                  <Image src="/logo.png" alt="LuxTrade Logo" width={40} height={40} className="rounded-xl shadow-lg" />
                  <motion.div className="absolute -bottom-1 -right-1 w-3 h-3 bg-emerald-400 rounded-full border-2 border-[#0f051d]" animate={{ boxShadow: ['0 0 0 0 rgba(16, 185, 129, 0.7)', '0 0 0 8px rgba(16, 185, 129, 0)', '0 0 0 0 rgba(16, 185, 129, 0.7)'] }} transition={{ duration: 2, repeat: Infinity }} />
                </div>
                <div>
                  <span className="text-xl font-extrabold bg-gradient-to-r from-white via-purple-200 to-purple-400 bg-clip-text text-transparent">LuxTrade</span>
                  <span className="hidden sm:inline text-[10px] text-purple-400/70 ml-2 tracking-[0.2em] font-bold">PREMIUM</span>
                </div>
              </div>
              <div className="hidden md:flex items-center gap-8">
                {[
                  { key: 'features', label: t('nav.features') },
                  { key: 'pricing', label: t('nav.pricing') },
                  { key: 'demo', label: t('hero.cta.secondary') },
                  { key: 'faq', label: 'FAQ' },
                ].map((item) => (
                  <a key={item.key} href={`#${item.key}`} className="text-sm text-white/60 hover:text-white transition-colors font-medium relative group">
                    {item.label}
                    <span className="absolute -bottom-1 left-0 w-0 h-0.5 bg-gradient-to-r from-purple-500 to-blue-500 group-hover:w-full transition-all duration-300" />
                  </a>
                ))}
              </div>
              <div className="flex items-center gap-3">
                <button onClick={() => setSidebarOpen(true)} className="lg:hidden w-10 h-10 flex items-center justify-center rounded-xl bg-white/5 border border-white/[0.08] hover:bg-white/10 transition-colors" aria-label="Menu">
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" className="text-white/80"><line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="18" x2="21" y2="18"/></svg>
                </button>
                <LanguageSwitcher />
                <Link href="/auth/login"><Button variant="ghost" className="text-white/70 hover:text-white hover:bg-white/10 transition-all font-semibold hidden sm:inline-flex">{t('nav.login')}</Button></Link>
                <Link href="/auth/signup">
                  <Button className="h-10 px-5 bg-gradient-to-r from-purple-500 to-blue-600 hover:from-purple-600 hover:to-blue-700 text-white font-extrabold shadow-lg shadow-purple-500/30 transition-all">
                    {t('nav.signup')} <ArrowRight className="w-4 h-4 ml-1.5" />
                  </Button>
                </Link>
              </div>
            </div>
          </div>
        </div>
      </nav>

      {/* Sidebar Overlay */}
      <AnimatePresence>
        {sidebarOpen && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="fixed inset-0 z-[70] bg-black/60 backdrop-blur-sm"
              onClick={() => setSidebarOpen(false)}
            />
            <motion.div
              initial={{ x: '-100%' }}
              animate={{ x: 0 }}
              exit={{ x: '-100%' }}
              transition={{ type: 'spring', damping: 30, stiffness: 300 }}
              className="fixed top-0 left-0 bottom-0 z-[80] w-[280px] bg-[#0d0814]/95 backdrop-blur-xl border-r border-white/[0.08] flex flex-col"
            >
              {/* Sidebar Header */}
              <div className="flex items-center justify-between px-5 h-14 border-b border-white/[0.08]">
                <div className="flex items-center gap-2.5">
                  <Image src="/logo.png" alt="LuxTrade" width={28} height={28} className="rounded-lg" />
                  <span className="text-base font-extrabold bg-gradient-to-r from-white via-purple-200 to-purple-400 bg-clip-text text-transparent">LuxTrade</span>
                </div>
                <button onClick={() => setSidebarOpen(false)} className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-white/10 transition-colors" aria-label="Close">
                  <X className="w-4 h-4 text-white/60" />
                </button>
              </div>

              {/* Sidebar Nav Links */}
              <nav className="flex-1 overflow-y-auto py-6 px-3">
                <div className="mb-6">
                  <p className="px-3 mb-3 text-[10px] font-bold tracking-[0.2em] text-purple-400/70 uppercase">
                    {language === 'id' ? 'Produk' : 'Product'}
                  </p>
                  {[
                    { href: '#features', label: language === 'id' ? 'Fitur' : 'Features' },
                    { href: '#pricing', label: language === 'id' ? 'Harga' : 'Pricing' },
                    { href: '#demo', label: t('hero.cta.secondary') },
                    { href: '#faq', label: 'FAQ' },
                  ].map((link) => (
                    <a
                      key={link.href}
                      href={link.href}
                      onClick={() => setSidebarOpen(false)}
                      className="flex items-center justify-between px-3 py-2.5 rounded-xl text-sm text-white/70 hover:text-white hover:bg-white/[0.05] transition-all group"
                    >
                      <span>{link.label}</span>
                      <ChevronRight className="w-3.5 h-3.5 text-white/20 group-hover:text-white/50 transition-colors" />
                    </a>
                  ))}
                </div>

                <div className="mb-6">
                  <p className="px-3 mb-3 text-[10px] font-bold tracking-[0.2em] text-purple-400/70 uppercase">
                    {language === 'id' ? 'Perusahaan' : 'Company'}
                  </p>
                  <a
                    onClick={() => { openLegalPage('contact'); setSidebarOpen(false) }}
                    className="flex items-center justify-between px-3 py-2.5 rounded-xl text-sm text-white/70 hover:text-white hover:bg-white/[0.05] transition-all group cursor-pointer"
                  >
                    <span>{language === 'id' ? 'Kontak' : 'Contact'}</span>
                    <ChevronRight className="w-3.5 h-3.5 text-white/20 group-hover:text-white/50 transition-colors" />
                  </a>
                  <a
                    onClick={() => { openLegalPage('terms'); setSidebarOpen(false) }}
                    className="flex items-center justify-between px-3 py-2.5 rounded-xl text-sm text-white/70 hover:text-white hover:bg-white/[0.05] transition-all group cursor-pointer"
                  >
                    <span>{language === 'id' ? 'Ketentuan' : 'Terms'}</span>
                    <ChevronRight className="w-3.5 h-3.5 text-white/20 group-hover:text-white/50 transition-colors" />
                  </a>
                  <a
                    onClick={() => { openLegalPage('refund'); setSidebarOpen(false) }}
                    className="flex items-center justify-between px-3 py-2.5 rounded-xl text-sm text-white/70 hover:text-white hover:bg-white/[0.05] transition-all group cursor-pointer"
                  >
                    <span>Refund Policy</span>
                    <ChevronRight className="w-3.5 h-3.5 text-white/20 group-hover:text-white/50 transition-colors" />
                  </a>
                </div>

                {/* Sidebar Social */}
                <div className="px-3">
                  <p className="px-0 mb-3 text-[10px] font-bold tracking-[0.2em] text-purple-400/70 uppercase">
                    {language === 'id' ? 'Ikuti Kami' : 'Follow Us'}
                  </p>
                  <div className="flex gap-2">
                    <a href="https://www.instagram.com/luxtrade.web" target="_blank" rel="noopener noreferrer" className="w-10 h-10 rounded-xl bg-white/5 border border-white/[0.08] flex items-center justify-center hover:bg-white/10 hover:border-purple-500/30 transition-all">
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="text-white/60"><rect x="2" y="2" width="20" height="20" rx="5"/><circle cx="12" cy="12" r="5"/><circle cx="17.5" cy="6.5" r="1" fill="currentColor" stroke="none"/></svg>
                    </a>
                    <a href="https://www.tiktok.com/@luxtradeee" target="_blank" rel="noopener noreferrer" className="w-10 h-10 rounded-xl bg-white/5 border border-white/[0.08] flex items-center justify-center hover:bg-white/10 hover:border-purple-500/30 transition-all">
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" className="text-white/60"><path d="M19.59 6.69a4.83 4.83 0 01-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 01-2.88 2.5 2.89 2.89 0 01-2.89-2.89 2.89 2.89 0 012.89-2.89c.28 0 .54.04.79.1v-3.5a6.37 6.37 0 00-.79-.05A6.34 6.34 0 003.15 15.2a6.34 6.34 0 0010.86 4.46V13a8.28 8.28 0 005.58 2.14V11.7a4.79 4.79 0 01-3.59-1.52V6.69h3.59z"/></svg>
                    </a>
                    <a href="https://t.me/Risxyiee" target="_blank" rel="noopener noreferrer" className="w-10 h-10 rounded-xl bg-white/5 border border-white/[0.08] flex items-center justify-center hover:bg-white/10 hover:border-purple-500/30 transition-all">
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" className="text-white/60"><path d="M11.944 0A12 12 0 000 12a12 12 0 0012 12 12 12 0 0012-12A12 12 0 0012 0a12 12 0 00-.056 0zm4.962 7.224c.1-.002.321.023.465.14a.506.506 0 01.171.325c.016.093.036.306.02.472-.18 1.898-.962 6.502-1.36 8.627-.168.9-.499 1.201-.82 1.23-.696.065-1.225-.46-1.9-.902-1.056-.693-1.653-1.124-2.678-1.8-1.185-.78-.417-1.21.258-1.91.177-.184 3.247-2.977 3.307-3.23.007-.032.014-.15-.056-.212s-.174-.041-.249-.024c-.106.024-1.793 1.14-5.061 3.345-.48.33-.913.49-1.302.48-.428-.008-1.252-.241-1.865-.44-.752-.245-1.349-.374-1.297-.789.027-.216.325-.437.893-.663 3.498-1.524 5.83-2.529 6.998-3.014 3.332-1.386 4.025-1.627 4.476-1.635z"/></svg>
                    </a>
                    <a href="https://discord.gg/MSrh3qmkc" target="_blank" rel="noopener noreferrer" className="w-10 h-10 rounded-xl bg-white/5 border border-white/[0.08] flex items-center justify-center hover:bg-[#5865F2]/10 hover:border-[#5865F2]/30 transition-all">
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" className="text-white/60"><path d="M20.317 4.37a19.791 19.791 0 0 0-4.885-1.515.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0 12.64 12.64 0 0 0-.617-1.25.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057a.082.082 0 0 0 .031.057 19.9 19.9 0 0 0 5.993 3.03.078.078 0 0 0 .084-.028 14.09 14.09 0 0 0 1.226-1.994.076.076 0 0 0-.041-.106 13.107 13.107 0 0 1-1.872-.892.077.077 0 0 1-.008-.128 10.2 10.2 0 0 0 .372-.292.074.074 0 0 1 .077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 0 1 .078.01c.12.098.246.198.373.292a.077.077 0 0 1-.006.127 12.299 12.299 0 0 1-1.873.892.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028 19.839 19.839 0 0 0 6.002-3.03.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.03zM8.02 15.33c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.956-2.419 2.157-2.419 1.21 0 2.176 1.095 2.157 2.42 0 1.333-.956 2.418-2.157 2.418zm7.975 0c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.955-2.419 2.157-2.419 1.21 0 2.176 1.095 2.157 2.42 0 1.333-.946 2.418-2.157 2.418z"/></svg>
                    </a>
                  </div>
                </div>
              </nav>

              {/* Sidebar Footer */}
              <div className="px-5 py-4 border-t border-white/[0.08]">
                <p className="text-white/30 text-xs">© {new Date().getFullYear()} LuxTrade. All rights reserved.</p>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* HERO - Left Aligned */}
      <main className="flex-1">
        <section className="relative w-full pt-32 pb-12">
          <div className="max-w-7xl mx-auto flex flex-col lg:flex-row">
            <div className="w-full lg:w-1/2 flex flex-col justify-center px-4 sm:px-6 lg:px-8 lg:pr-12">
              <motion.div initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6 }}>
                {/* Badge */}
                <div className="flex items-center h-9 w-max bg-[#2a1b3d]/90 backdrop-blur-sm border border-white/10 rounded-xl mb-8">
                  <div className="w-4 h-full" />
                  <div className="flex items-center gap-2 text-sm font-medium text-white/90">
                    <span className="w-1.5 h-1.5 bg-purple-400 rounded-sm" />
                    {t('hero.subtitle').split('.')[0]}
                  </div>
                  <div className="w-4 h-full" />
                </div>

                <h1 className="text-[44px] md:text-6xl font-semibold leading-[1.05] tracking-tight mb-6">
                  {t('hero.title').split('.').slice(0, -1).join('.')}
                  <span className="text-purple-400">.</span>
                  <br />
                  <span className="bg-gradient-to-r from-purple-400 via-blue-400 to-cyan-400 bg-clip-text text-transparent">
                    {t('hero.title').split('.').pop()}
                  </span>
                </h1>

                <p className="text-white/40 max-w-md text-[15px] md:text-lg leading-relaxed mb-8">
                  {t('hero.subtitle')}
                </p>

                <div className="flex flex-col sm:flex-row items-start gap-4 w-full sm:w-max">
                  <Link href="/auth/signup" className="w-full sm:w-max">
                    <button className="flex items-center justify-center w-full h-14 rounded-2xl bg-gradient-to-r from-purple-500 to-blue-600 hover:from-purple-600 hover:to-blue-700 transition shadow-lg shadow-purple-500/20 active:scale-95 group">
                      <div className="w-6 h-full" />
                      <div className="flex items-center gap-2 text-[15px] font-bold text-white">
                        {t('hero.cta.primary')}
                        <ArrowRight className="w-5 h-5 transition-transform group-hover:translate-x-1" />
                      </div>
                      <div className="w-6 h-full" />
                    </button>
                  </Link>
                  <a href="#demo" className="w-full sm:w-max">
                    <button className="flex items-center justify-center w-full h-14 rounded-2xl bg-[#2a1b3d]/80 backdrop-blur-sm border border-white/10 hover:bg-white/10 transition active:scale-95 group">
                      <div className="w-6 h-full" />
                      <div className="flex items-center gap-2 text-[15px] font-bold text-white/90">
                        <Play className="w-4 h-4" />
                        {t('hero.cta.secondary')}
                        <ArrowRight className="w-5 h-5 opacity-50 transition-transform group-hover:translate-x-1" />
                      </div>
                      <div className="w-6 h-full" />
                    </button>
                  </a>
                </div>

                {/* Trust Signal */}
                <div className="flex items-start gap-3 mt-8">
                  <Star className="w-5 h-5 text-purple-400 fill-purple-400 mt-0.5" />
                  <div className="flex flex-col">
                    <p className="text-white/80 text-sm">
                      <strong className="text-white">{t('hero.trust')}</strong>
                    </p>
                    <p className="text-white/30 text-xs">{language === 'id' ? 'Dibangun di Indonesia, untuk trader Indonesia' : 'Built in Indonesia, for Indonesian traders'}</p>
                  </div>
                </div>
              </motion.div>
            </div>

            {/* Right Side - Widgets */}
            <div className="relative w-full lg:w-1/2 flex items-center justify-center mt-8 lg:mt-0 lg:-mt-4">
              <div className="w-full max-w-md space-y-4">
                <EquityWidget />
                <AnimatedForexTrades />
                <p className="text-center text-white/25 text-xs">{language === 'id' ? 'Data simulasi untuk demo' : 'Simulated data for demo'}</p>
              </div>
            </div>
          </div>
        </section>

        {/* Stats Strip */}
        <section className="w-full pb-16 px-4 sm:px-6 lg:px-8">
          <div className="max-w-7xl mx-auto">
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              {stats.map((stat, index) => (
                <motion.div key={index} initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ delay: index * 0.1 }}
                  className="flex flex-col bg-[#2a1b3d]/40 backdrop-blur-sm border border-white/10 rounded-2xl p-5 hover:bg-[#2a1b3d]/60 transition-colors"
                >
                  <div className="flex items-center gap-3 mb-3">
                    <div className="w-10 h-10 md:w-12 md:h-12 rounded-full bg-[#171221] border border-white/5 flex items-center justify-center shrink-0 shadow-inner">
                      <stat.icon className="w-4 h-4 md:w-5 md:h-5 text-purple-400" />
                    </div>
                    <h3 className="text-purple-300 font-medium text-sm md:text-[15px] leading-tight">{stat.value}</h3>
                  </div>
                  <p className="text-white/60 text-xs md:text-sm font-medium leading-relaxed">{stat.label}</p>
                </motion.div>
              ))}
            </div>
          </div>
        </section>

        {/* Pricing Section - 3 Column Cards */}
        <section id="pricing" className="w-full pb-20">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="flex flex-col items-center mb-16">
              <div className="flex items-center h-9 w-max bg-[#2a1b3d]/90 backdrop-blur-sm border border-white/10 rounded-xl mb-6">
                <div className="w-4 h-full" />
                <div className="flex items-center gap-2 text-sm font-medium text-white/90">
                  <Crown className="w-4 h-4 text-purple-400" />
                  {language === 'id' ? 'Pilih Paket' : 'Choose Plan'}
                </div>
                <div className="w-4 h-full" />
              </div>
              <p className="text-white/50 max-w-[320px] md:max-w-2xl text-center text-base md:text-lg leading-relaxed">
                {t('pricing.subtitle')}
              </p>
            </div>

            <div className="flex flex-col lg:flex-row gap-8 w-full justify-center max-w-[1200px] mx-auto">
              {/* Free Plan */}
              <motion.div initial={{ opacity: 0, y: 30 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ delay: 0.1 }} className="flex-1 flex flex-col bg-[#2a1b3d]/40 backdrop-blur-sm border border-white/10 rounded-3xl overflow-hidden min-w-[280px]">
                <div className="flex flex-col items-center flex-grow p-8 pt-10">
                  <div className="flex items-center justify-center mb-6">
                    <BookOpen className="w-5 h-5 text-purple-400" />
                    <div className="w-3" />
                    <h3 className="text-2xl font-bold text-white">{t('pricing.free.title')}</h3>
                  </div>
                  <p className="text-[12px] text-white/60 text-center mb-6 leading-relaxed">{t('pricing.free.desc')}</p>
                  <div className="text-3xl font-extrabold text-white text-center mb-8">{t('pricing.free.price').split(' /')[0]}</div>
                  <div className="flex flex-col gap-3.5 w-full mb-8">
                    {[
                      language === 'id' ? '10 jurnal per bulan' : '10 journals per month',
                      language === 'id' ? 'Grafik performa standar' : 'Standard performance charts',
                      language === 'id' ? 'Kalkulator risiko pemula' : 'Basic risk calculator',
                      language === 'id' ? '3x trial AI analysis' : '3x AI analysis trials',
                    ].map((item, index) => (
                      <div key={index} className="flex items-start gap-3 text-sm text-white/70">
                        <Zap className="w-4 h-4 text-purple-400 shrink-0 mt-0.5" />
                        <span>{item}</span>
                      </div>
                    ))}
                  </div>
                </div>
                <div className="p-6 pt-0">
                  <Link href="/auth/signup" className="block">
                    <button className="w-full flex items-center justify-center h-[52px] rounded-2xl bg-white/5 border border-white/10 hover:bg-white/10 transition active:scale-95 text-white font-medium">
                      {t('pricing.cta.free')} →
                    </button>
                  </Link>
                </div>
              </motion.div>

              {/* Elite Pro - Highlighted */}
              <motion.div initial={{ opacity: 0, y: 30 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ delay: 0.2 }} className="flex-1 flex flex-col bg-gradient-to-b from-purple-500/20 via-white/5 to-purple-500/10 border border-purple-500/40 rounded-3xl overflow-hidden min-w-[280px] relative">
                <motion.div className="absolute -top-3 left-1/2 -translate-x-1/2 px-4 py-1.5 rounded-full bg-gradient-to-r from-purple-500 to-blue-500 text-xs font-bold text-white" animate={{ boxShadow: ['0 0 0 0 rgba(139, 92, 246, 0.7)', '0 0 0 10px rgba(139, 92, 246, 0)', '0 0 0 0 rgba(139, 92, 246, 0.7)'] }} transition={{ duration: 2, repeat: Infinity }}>
                  {language === 'id' ? 'Paling Populer' : 'Most Popular'}
                </motion.div>
                <div className="flex flex-col items-center flex-grow p-8 pt-10">
                  <div className="flex items-center justify-center mb-6">
                    <Crown className="w-5 h-5 text-purple-400" />
                    <div className="w-3" />
                    <h3 className="text-2xl font-bold text-white">{t('pricing.pro.title')}</h3>
                  </div>
                  <p className="text-[12px] text-white/60 text-center mb-6 leading-relaxed">{t('pricing.pro.desc')}</p>
                  <div className="text-3xl font-extrabold text-white text-center mb-8">
                    {t('pricing.pro.price').split(' /')[0]}
                    <span className="text-base font-normal text-white/40"> / {language === 'id' ? 'bulan' : 'mo'}</span>
                  </div>
                  <div className="flex flex-col gap-3.5 w-full mb-8">
                    {[
                      language === 'id' ? 'Unlimited jurnal tanpa batas' : 'Unlimited journals, no limits',
                      language === 'id' ? 'AI analisis deteksi kesalahan' : 'AI mistake detection analysis',
                      language === 'id' ? 'Grafik win-rate & mistake tracker' : 'Win-rate charts & mistake tracker',
                      language === 'id' ? 'Kalkulator risiko advance' : 'Advanced risk calculator',
                      language === 'id' ? 'Export Excel / PDF' : 'Excel / PDF export',
                      language === 'id' ? 'VIP support & grup' : 'VIP support & group access',
                    ].map((item, index) => (
                      <div key={index} className="flex items-start gap-3 text-sm text-white/70">
                        <Zap className="w-4 h-4 text-purple-400 shrink-0 mt-0.5" />
                        <span>{item}</span>
                      </div>
                    ))}
                  </div>
                </div>
                <div className="p-6 pt-0">
                  <button onClick={handleProUpgrade} className="w-full flex items-center justify-center h-[52px] rounded-2xl bg-gradient-to-r from-purple-500 to-blue-600 hover:from-purple-600 hover:to-blue-700 transition shadow-lg shadow-purple-500/20 active:scale-95 text-white font-medium">
                    {t('pricing.cta.upgrade')} →
                  </button>
                </div>
              </motion.div>

              {/* Lifetime Ultra */}
              <div className="flex-1 min-w-[280px]">
                <LifetimeUltraCard onButtonClick={handleLifetimeUpgrade} language={language} t={t} promoRemaining={promoRemaining} />
              </div>
            </div>

            {/* Non-refundable notice */}
            <div className="flex justify-center mt-10">
              <div className="inline-flex items-center gap-3 px-5 py-2.5 bg-white/5 border border-white/10 rounded-xl">
                <AlertTriangle className="w-4 h-4 text-white/40" />
                <span className="text-white/50 text-xs font-bold">{language === 'id' ? 'Produk Digital — Non-Refundable' : 'Digital Product — Non-Refundable'}</span>
              </div>
            </div>
          </div>
        </section>

        {/* Promo Code Section */}
        <section className="py-16 px-4 sm:px-6 lg:px-8">
          <div className="max-w-4xl mx-auto">
            <motion.div initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }}>
              <div className={`relative overflow-hidden bg-[#2a1b3d]/40 backdrop-blur-sm border rounded-3xl p-8 sm:p-10 transition-colors ${promoActive !== false && (promoRemaining === null || promoRemaining > 0) ? 'border-amber-500/20' : 'border-red-500/20'}`}>
                {(promoActive !== false && (promoRemaining === null || promoRemaining > 0)) && (
                  <div className="absolute -top-20 -right-20 w-40 h-40 bg-amber-500/10 rounded-full blur-3xl" />
                )}

                <div className="text-center relative z-10">
                  <div className="inline-flex items-center gap-2 px-3 py-1 bg-amber-500/10 rounded-full mb-5">
                    <Sparkles className="w-3.5 h-3.5 text-amber-400" />
                    <p className="text-amber-300/90 text-xs font-semibold uppercase tracking-wider">
                      {promoActive === false || (promoRemaining !== null && promoRemaining <= 0)
                        ? (language === 'id' ? 'Kuota Habis' : 'Sold Out')
                        : (language === 'id' ? 'Promo Spesial' : 'Special Promo')}
                    </p>
                  </div>

                  <h3 className="text-xl sm:text-2xl font-bold text-white mb-2">
                    {promoActive === false || (promoRemaining !== null && promoRemaining <= 0)
                      ? (language === 'id' ? 'Promo Sudah Berakhir' : 'Promo Has Ended')
                      : (language === 'id' ? '3 Bulan PRO Gratis!' : '3 Months PRO Free!')}
                  </h3>
                  <p className="text-white/50 text-sm mb-6">
                    {promoActive === false || (promoRemaining !== null && promoRemaining <= 0)
                      ? (language === 'id' ? 'Semua 30 slot promo sudah terpakai' : 'All 30 promo slots have been taken')
                      : (language === 'id' ? 'Masukkan kode di dashboard untuk klaim langsung' : 'Enter code in dashboard to claim instantly')}
                  </p>

                  <motion.div
                    className={`inline-flex items-center gap-3 sm:gap-4 px-6 sm:px-8 py-4 sm:py-5 bg-black/40 rounded-2xl border-2 transition-all ${promoActive !== false && (promoRemaining === null || promoRemaining > 0) ? 'border-amber-500/50 hover:border-amber-500 cursor-pointer' : 'border-red-500/20 opacity-50 cursor-not-allowed'}`}
                    whileHover={promoActive !== false && (promoRemaining === null || promoRemaining > 0) ? { scale: 1.02 } : {}}
                    whileTap={promoActive !== false && (promoRemaining === null || promoRemaining > 0) ? { scale: 0.98 } : {}}
                    onClick={() => {
                      if (promoActive === false || (promoRemaining !== null && promoRemaining <= 0)) return
                      navigator.clipboard.writeText('TRADERCEPAT')
                      alert(language === 'id' ? 'Kode berhasil disalin!' : 'Code copied!')
                    }}
                  >
                    <span className={`text-2xl sm:text-3xl font-extrabold bg-gradient-to-r ${promoActive !== false && (promoRemaining === null || promoRemaining > 0) ? 'from-amber-400 to-orange-400' : 'from-red-400/60 to-red-600/60'} bg-clip-text text-transparent tracking-wider font-mono ${promoActive === false || (promoRemaining !== null && promoRemaining <= 0) ? 'line-through' : ''}`}>
                      TRADERCEPAT
                    </span>
                    <div className={`w-7 h-7 sm:w-8 sm:h-8 rounded-lg flex items-center justify-center shrink-0 ${promoActive !== false && (promoRemaining === null || promoRemaining > 0) ? 'bg-amber-500/20' : 'bg-red-500/20'}`}>
                      {promoActive !== false && (promoRemaining === null || promoRemaining > 0)
                        ? <Check className="w-4 h-4 sm:w-5 sm:h-5 text-amber-400" />
                        : <X className="w-4 h-4 sm:w-5 sm:h-5 text-red-400" />}
                    </div>
                  </motion.div>

                  {promoActive !== false && (promoRemaining === null || promoRemaining > 0) && (
                    <p className="text-white/30 text-xs mt-3">
                      {language === 'id' ? 'Klik untuk menyalin' : 'Click to copy'}
                    </p>
                  )}

                  {/* Quota Progress Bar */}
                  <div className="mt-6 max-w-sm mx-auto">
                    <div className="flex justify-between items-center mb-2">
                      <span className="text-white/40 text-xs font-medium">
                        {language === 'id' ? 'Sisa slot' : 'Slots remaining'}
                      </span>
                      <span className={`text-xs font-bold ${promoActive !== false && (promoRemaining === null || promoRemaining > 0) ? 'text-amber-400' : 'text-red-400'}`}>
                        {promoRemaining !== null ? `${promoRemaining} / ${promoMax}` : '...'}
                      </span>
                    </div>
                    <div className="h-2.5 bg-white/5 rounded-full overflow-hidden">
                      <motion.div
                        className={`h-full rounded-full transition-colors ${promoActive !== false && (promoRemaining === null || promoRemaining > 0) ? 'bg-gradient-to-r from-amber-500 to-orange-500' : 'bg-red-500/60'}`}
                        initial={{ width: 0 }}
                        animate={{ width: promoRemaining !== null ? `${((promoMax - promoRemaining) / promoMax) * 100}%` : '0%' }}
                        transition={{ duration: 1, ease: 'easeOut' }}
                      />
                    </div>
                    <p className="text-white/25 text-[11px] mt-2">
                      {promoRemaining !== null
                        ? (language === 'id'
                          ? `${promoMax - promoRemaining} orang sudah klaim`
                          : `${promoMax - promoRemaining} traders claimed`)
                        : (language === 'id' ? 'Memuat kuota...' : 'Loading quota...')}
                    </p>
                  </div>
                </div>
              </div>
            </motion.div>
          </div>
        </section>

        {/* Screenshot Carousel */}
        <section id="demo" className="py-16 px-4 sm:px-6 lg:px-8">
          <div className="max-w-5xl mx-auto">
            <div className="flex flex-col items-center mb-12">
              <div className="flex items-center h-9 w-max bg-[#2a1b3d]/90 backdrop-blur-sm border border-white/10 rounded-xl mb-6">
                <div className="w-4 h-full" />
                <div className="flex items-center gap-2 text-sm font-medium text-white/90">
                  <Activity className="w-4 h-4 text-emerald-400" />
                  {language === 'id' ? 'Tampilan Asli' : 'Real Screenshots'}
                </div>
                <div className="w-4 h-full" />
              </div>
            </div>
            <div className="relative"
              onTouchStart={(e) => { touchStartX.current = e.touches[0].clientX }}
              onTouchEnd={(e) => {
                const diff = touchStartX.current - e.changedTouches[0].clientX
                if (Math.abs(diff) > 50) {
                  if (diff > 0 && carouselIndex < screenshots.length - 1) setCarouselIndex(carouselIndex + 1)
                  else if (diff < 0 && carouselIndex > 0) setCarouselIndex(carouselIndex - 1)
                }
              }}
            >
              <div className="overflow-hidden rounded-2xl border border-white/[0.08]">
                <motion.div className="flex" animate={{ x: `-${carouselIndex * 100}%` }} transition={{ type: 'spring', stiffness: 300, damping: 30 }}>
                  {screenshots.map((src, i) => (
                    <div key={i} className="w-full flex-shrink-0">
                      <div className="relative bg-[#0d0715] flex items-center justify-center p-2 sm:p-4">
                        <Image src={src} alt={language === 'id' ? `Tampilan LuxTrade ${i + 1}` : `LuxTrade Screenshot ${i + 1}`} width={1200} height={800} className="w-full h-auto rounded-xl" priority={i === 0} />
                      </div>
                    </div>
                  ))}
                </motion.div>
              </div>
              <button onClick={() => setCarouselIndex(Math.max(0, carouselIndex - 1))} disabled={carouselIndex === 0} className={`absolute left-2 sm:left-4 top-1/2 -translate-y-1/2 w-10 h-10 sm:w-12 sm:h-12 rounded-full backdrop-blur-xl bg-black/40 border border-white/[0.1] flex items-center justify-center transition-all hover:bg-black/60 hover:border-purple-500/40 ${carouselIndex === 0 ? 'opacity-0 pointer-events-none' : 'opacity-100'}`}>
                <ChevronRight className="w-5 h-5 text-white rotate-180" />
              </button>
              <button onClick={() => setCarouselIndex(Math.min(screenshots.length - 1, carouselIndex + 1))} disabled={carouselIndex === screenshots.length - 1} className={`absolute right-2 sm:right-4 top-1/2 -translate-y-1/2 w-10 h-10 sm:w-12 sm:h-12 rounded-full backdrop-blur-xl bg-black/40 border border-white/[0.1] flex items-center justify-center transition-all hover:bg-black/60 hover:border-purple-500/40 ${carouselIndex === screenshots.length - 1 ? 'opacity-0 pointer-events-none' : 'opacity-100'}`}>
                <ChevronRight className="w-5 h-5 text-white" />
              </button>
              <div className="flex items-center justify-center gap-2 mt-6">
                {screenshots.map((_, i) => (
                  <button key={i} onClick={() => setCarouselIndex(i)} className={`transition-all duration-300 rounded-full ${i === carouselIndex ? 'w-8 h-2.5 bg-gradient-to-r from-purple-500 to-cyan-500' : 'w-2.5 h-2.5 bg-white/20 hover:bg-white/40'}`} />
                ))}
              </div>
            </div>
          </div>
        </section>

        {/* Features Grid - 2x2 / 4-col */}
        <section id="features" className="py-16 px-4 sm:px-6 lg:px-8">
          <div className="max-w-7xl mx-auto">
            <div className="flex flex-col items-center mb-12">
              <div className="flex items-center h-9 w-max bg-[#2a1b3d]/90 backdrop-blur-sm border border-white/10 rounded-xl mb-6">
                <div className="w-4 h-full" />
                <div className="flex items-center gap-2 text-sm font-medium text-white/90">
                  <span className="w-1.5 h-1.5 bg-purple-400 rounded-sm" />
                  {t('features.title')}
                </div>
                <div className="w-4 h-full" />
              </div>
              <p className="text-white/50 max-w-[400px] md:max-w-2xl text-center text-base leading-relaxed">{t('features.subtitle')}</p>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {features.map((feature, index) => (
                <motion.div key={index} initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ delay: index * 0.1 }}
                  className="flex flex-col bg-[#2a1b3d]/40 backdrop-blur-sm border border-white/10 rounded-2xl p-5 hover:bg-[#2a1b3d]/60 transition-colors h-full"
                >
                  <div className="flex items-center gap-3 mb-3">
                    <div className={`w-10 h-10 md:w-12 md:h-12 rounded-full bg-[#171221] border border-white/5 flex items-center justify-center shrink-0 shadow-inner`}>
                      <feature.icon className="w-4 h-4 md:w-5 md:h-5 text-purple-400" />
                    </div>
                    <h3 className="text-purple-300 font-medium text-sm md:text-[15px] leading-tight">{feature.title}</h3>
                  </div>
                  <p className="text-white/60 text-xs md:text-sm font-medium leading-relaxed">{feature.description}</p>
                </motion.div>
              ))}
            </div>
          </div>
        </section>



        {/* FAQ */}
        <section id="faq" className="py-20 px-4 sm:px-6 lg:px-8">
          <div className="max-w-3xl mx-auto">
            <div className="flex flex-col items-center mb-12">
              <div className="flex items-center h-9 w-max bg-[#2a1b3d]/90 backdrop-blur-sm border border-white/10 rounded-xl mb-6">
                <div className="w-4 h-full" />
                <div className="flex items-center gap-2 text-sm font-medium text-white/90">
                  <HelpCircle className="w-4 h-4 text-purple-400" />
                  {language === 'id' ? 'Tanya Jawab' : 'FAQ'}
                </div>
                <div className="w-4 h-full" />
              </div>
            </div>
            <div className="space-y-4">
              {[
                { q: language === 'id' ? 'LuxTrade gratis nggak?' : 'Is LuxTrade free?', a: language === 'id' ? 'Ada paket gratis — cukup buat catat 10 trade per bulan sama analitik dasar. Kalau kamu serius trading dan butuh fitur lengkap tanpa batas, upgrade ke Elite Pro.' : 'There\'s a free plan — enough to log 10 trades per month with basic analytics. If you\'re serious about trading, upgrade to Elite Pro.' },
                { q: language === 'id' ? 'AI-nya ngapain sih?' : 'What does the AI actually do?', a: language === 'id' ? 'AI menganalisis histori trade kamu — dia bisa detect pola kesalahan yang berulang (misalnya selalu loss di session London, atau FOMO entry tanpa setup). Bukan ramalan harga, tapi refleksi berbasis data kamu sendiri.' : 'AI analyzes your trade history — it can detect repeating mistake patterns. Not price predictions — data-driven reflection of your own trades.' },
                { q: language === 'id' ? 'Bisa import dari MT4/MT5?' : 'Can I import from MT4/MT5?', a: language === 'id' ? 'Bisa. Import via CSV dari MT4, MT5, cTrader, dan platform lain yang support export CSV.' : 'Yes. Import via CSV from MT4, MT5, cTrader, and any CSV-compatible platform.' },
                { q: language === 'id' ? 'Data trading saya aman?' : 'Is my trading data secure?', a: language === 'id' ? 'Data dienkripsi dan disimpan aman. Kami nggak jual data ke pihak ketiga, nggak ada iklan, dan cuma kamu yang bisa akses.' : 'Data is encrypted and securely stored. We don\'t sell data, no ads, only you can access your data.' },
                { q: language === 'id' ? 'Kalau mau refund gimana?' : 'What about refunds?', a: language === 'id' ? 'LuxTrade itu produk digital (SaaS) — sekali bayar, akses langsung aktif. Karena sifatnya digital, semua pembelian bersifat final dan non-refundable. Kecuali kalau ada double charge atau eror dari payment gateway.' : 'LuxTrade is a digital product (SaaS). All purchases are final and non-refundable. Except in cases of double charges or payment gateway errors.' },
                { q: language === 'id' ? 'Butuh bantuan, hubungi siapa?' : 'Need help, who do I contact?', a: language === 'id' ? 'Langsung aja DM Telegram @Risxyiee atau email luxtradee@gmail.com. Biasanya balasnya cepat — karena ini project kecil, bukan perusahaan besar pakai CS robot.' : 'Just DM Telegram @Risxyiee or email luxtradee@gmail.com. Response is usually fast — this is a small project, not a big company with robot customer service.' },
              ].map((faq, index) => (
                <motion.div key={index} initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ delay: index * 0.08 }}>
                  <div className="p-6 bg-[#2a1b3d]/40 backdrop-blur-sm border border-white/10 rounded-2xl hover:bg-[#2a1b3d]/60 hover:border-purple-500/30 transition-colors">
                    <h3 className="text-base font-bold text-white mb-2">{faq.q}</h3>
                    <p className="text-white/50 text-sm leading-relaxed">{faq.a}</p>
                  </div>
                </motion.div>
              ))}
            </div>
          </div>
        </section>

        {/* Roadmap */}
        <section id="roadmap" className="py-20 px-4 sm:px-6 lg:px-8">
          <div className="max-w-5xl mx-auto">
            <div className="flex flex-col items-center mb-12">
              <div className="flex items-center h-9 w-max bg-[#2a1b3d]/90 backdrop-blur-sm border border-white/10 rounded-xl mb-6">
                <div className="w-4 h-full" />
                <div className="flex items-center gap-2 text-sm font-medium text-white/90">
                  <Zap className="w-4 h-4 text-purple-400" />
                  {language === 'id' ? 'Yang Sedang Dibangun' : 'Currently in the Works'}
                </div>
                <div className="w-4 h-full" />
              </div>
              <p className="text-white/40 max-w-md text-center text-base">{language === 'id' ? 'LuxTrade masih baru dan terus berkembang. Ini beberapa fitur yang sudah di garap.' : 'LuxTrade is still young and growing. Here\'s what\'s already being worked on.'}</p>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <motion.div initial={{ opacity: 0, x: -20 }} whileInView={{ opacity: 1, x: 0 }} viewport={{ once: true }} transition={{ delay: 0.1 }}>
                <div className="h-full p-6 bg-[#2a1b3d]/40 backdrop-blur-sm border border-cyan-500/20 rounded-2xl">
                  <div className="flex items-center gap-4 mb-6">
                    <div className="w-10 h-10 rounded-xl bg-cyan-500/20 border border-cyan-500/30 flex items-center justify-center"><Activity className="w-5 h-5 text-cyan-400" /></div>
                    <div>
                      <h3 className="font-bold text-white">{language === 'id' ? 'Sedang Dikerjakan' : 'In Progress'}</h3>
                      <p className="text-xs text-cyan-400 font-bold tracking-wide">{language === 'id' ? 'AKTIF DIKEMBANGKAN' : 'ACTIVE DEVELOPMENT'}</p>
                    </div>
                  </div>
                  <ul className="space-y-4">
                    {[
                      { icon: '💱', title: language === 'id' ? 'Harga Forex Real-time' : 'Real-time Forex Prices', desc: language === 'id' ? 'Harga pasar langsung di dashboard kamu' : 'Live market prices in your dashboard' },
                      { icon: '📄', title: language === 'id' ? 'Export PDF' : 'Export to PDF', desc: language === 'id' ? 'Download laporan trading kamu langsung' : 'Download your trading reports instantly' },
                      { icon: '🔔', title: language === 'id' ? 'Notifikasi Harga' : 'Price Alerts', desc: language === 'id' ? 'Dapet notif pas harga nyentuh target kamu' : 'Get notified when price hits your target' },
                    ].map((item, index) => (
                      <li key={index} className="flex items-start gap-4 p-4 rounded-xl bg-white/[0.02] border border-white/[0.05] hover:border-cyan-500/20 hover:bg-white/[0.04] transition-all">
                        <span className="text-2xl">{item.icon}</span>
                        <div><p className="font-bold text-white text-sm">{item.title}</p><p className="text-xs text-white/40 mt-1">{item.desc}</p></div>
                      </li>
                    ))}
                  </ul>
                </div>
              </motion.div>

              <motion.div initial={{ opacity: 0, x: 20 }} whileInView={{ opacity: 1, x: 0 }} viewport={{ once: true }} transition={{ delay: 0.2 }}>
                <div className="h-full p-6 bg-[#2a1b3d]/40 backdrop-blur-sm border border-violet-500/20 rounded-2xl">
                  <div className="flex items-center gap-4 mb-6">
                    <div className="w-10 h-10 rounded-xl bg-violet-500/20 border border-violet-500/30 flex items-center justify-center"><Lightning className="w-5 h-5 text-violet-400" /></div>
                    <div>
                      <h3 className="font-bold text-white">{language === 'id' ? 'Dalam Perencanaan' : 'Planned'}</h3>
                      <p className="text-xs text-violet-400 font-bold tracking-wide">{language === 'id' ? 'MASIH DIRANCANG' : 'IN DESIGN'}</p>
                    </div>
                  </div>
                  <ul className="space-y-4">
                    {[
                      { icon: '📊', title: language === 'id' ? 'Integrasi Chart TradingView' : 'TradingView Charts', desc: language === 'id' ? 'Chart lengkap langsung di dalam LuxTrade' : 'Full charts embedded inside LuxTrade' },
                      { icon: '📥', title: language === 'id' ? 'Import MT4/MT5 Lebih Baik' : 'Better MT4/MT5 Import', desc: language === 'id' ? 'Parsing lebih akurat, support lebih banyak format' : 'More accurate parsing, more format support' },
                      { icon: '💳', title: language === 'id' ? 'Payment Gateway Baru' : 'New Payment Gateway', desc: language === 'id' ? 'Aktivasi instan setelah bayar' : 'Instant activation after payment' },
                    ].map((item, index) => (
                      <li key={index} className="flex items-start gap-4 p-4 rounded-xl bg-white/[0.02] border border-white/[0.05] hover:border-violet-500/20 hover:bg-white/[0.04] transition-all">
                        <span className="text-2xl">{item.icon}</span>
                        <div><p className="font-bold text-white text-sm">{item.title}</p><p className="text-xs text-white/40 mt-1">{item.desc}</p></div>
                      </li>
                    ))}
                  </ul>
                </div>
              </motion.div>
            </div>

            {/* Already Available */}
            <motion.div className="mt-10" initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }}>
              <div className="p-6 rounded-2xl bg-emerald-500/10 border border-emerald-500/20">
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-10 h-10 rounded-xl bg-emerald-500/20 border border-emerald-500/30 flex items-center justify-center"><Check className="w-5 h-5 text-emerald-400" /></div>
                  <h3 className="font-bold text-white">{language === 'id' ? 'Sudah Tersedia Sekarang' : 'Already Available'}</h3>
                </div>
                <div className="flex flex-wrap gap-2">
                  {(language === 'id' ? ['Jurnal Trading', 'Analitik Performa', 'Analisis AI', 'Tracking P/L', 'Equity Curve', 'Sistem Achievement', 'Streak Tracking', 'Export CSV', 'Multi-Platform', 'Responsive Mobile'] : ['Trade Journal', 'Performance Analytics', 'AI Analysis', 'P/L Tracking', 'Equity Curve', 'Achievement System', 'Streak Tracking', 'CSV Export', 'Multi-Platform', 'Mobile Responsive']).map((f, i) => (
                    <span key={i} className="px-3 py-1.5 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-emerald-300 text-xs font-bold">✓ {f}</span>
                  ))}
                </div>
              </div>
            </motion.div>
          </div>
        </section>

        {/* Newsletter */}
        <section className="py-20 px-4 sm:px-6 lg:px-8">
          <div className="max-w-2xl mx-auto text-center">
            <motion.div initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }}>
              <div className="flex items-center h-9 w-max mx-auto bg-[#2a1b3d]/90 backdrop-blur-sm border border-white/10 rounded-xl mb-6">
                <div className="w-4 h-full" />
                <div className="flex items-center gap-2 text-sm font-medium text-white/90">
                  <Mail className="w-4 h-4 text-purple-400" />
                  {language === 'id' ? 'Wawasan Mingguan' : 'Weekly Insights'}
                </div>
                <div className="w-4 h-full" />
              </div>
              <h2 className="text-3xl sm:text-4xl font-extrabold mb-4 text-white">
                {language === 'id' ? 'Dapatkan Tips Trading Setiap Minggu' : 'Get Trading Tips Every Week'}
              </h2>
              <p className="text-white/50 mb-8 max-w-md mx-auto text-base">
                {language === 'id' ? 'Bergabung dengan trader yang menerima tips trading mingguan, wawasan psikologi, dan update fitur terbaru.' : 'Join traders receiving weekly trading tips, psychology insights, and latest feature updates.'}
              </p>
              <form className="flex flex-col sm:flex-row gap-4 max-w-md mx-auto" onSubmit={handleNewsletterSubmit}>
                <input 
                  type="email" 
                  value={newsletterEmail}
                  onChange={(e) => setNewsletterEmail(e.target.value)}
                  placeholder={language === 'id' ? 'Masukkan email Anda' : 'Enter your email'} 
                  className="flex-1 px-5 py-4 rounded-2xl bg-white/5 border border-white/[0.08] text-white placeholder:text-white/30 focus:outline-none focus:border-purple-500/50 transition-all font-medium" 
                  required 
                />
                <button 
                  type="submit" 
                  disabled={newsletterLoading}
                  className="h-14 px-8 bg-gradient-to-r from-purple-500 to-blue-600 hover:from-purple-600 hover:to-blue-700 text-white font-extrabold rounded-2xl shadow-lg shadow-purple-500/30 transition-all active:scale-95 disabled:opacity-50"
                >
                  {newsletterLoading ? '...' : (language === 'id' ? 'Langganan' : 'Subscribe')}
                </button>
              </form>
              {newsletterSuccess && (
                <p className="text-green-400 text-sm mt-3">✓ {language === 'id' ? 'Berhasil berlangganan!' : 'Subscribed!'}</p>
              )}
              <p className="text-white/30 text-xs mt-4">{language === 'id' ? 'Tidak ada spam. Berhenti langganan kapan saja.' : 'No spam. Unsubscribe anytime.'}</p>
            </motion.div>
          </div>
        </section>
      </main>

      {/* Footer */}
      <footer className="border-t border-white/[0.08] py-12 px-4 sm:px-6 lg:px-8 mt-auto">
        <div className="max-w-7xl mx-auto">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-10 mb-10">
            <div className="md:col-span-2">
              <div className="flex items-center gap-3 mb-4">
                <Image src="/logo.png" alt="LuxTrade Logo" width={40} height={40} className="rounded-xl shadow-lg" />
                <div>
                  <span className="text-xl font-extrabold bg-gradient-to-r from-white via-purple-200 to-purple-400 bg-clip-text text-transparent">LuxTrade</span>
                  <span className="text-[10px] text-purple-400/70 ml-2 tracking-[0.2em] font-bold">PREMIUM</span>
                </div>
              </div>
              <p className="text-white/50 mb-6 max-w-sm text-base">
                {language === 'id' ? 'Trading journal untuk trader Indonesia. Catat trade kamu, lihat pola kesalahan, dan perbaiki strategi — bukan cuma lihat profit loss.' : 'A trading journal for traders. Log your trades, see your mistake patterns, and fix your strategy — not just stare at P/L.'}
              </p>
              <div className="flex gap-3">
                <motion.a href="https://www.instagram.com/luxtrade.web" target="_blank" rel="noopener noreferrer" className="w-10 h-10 rounded-xl bg-white/5 border border-white/[0.08] flex items-center justify-center hover:bg-white/10 hover:border-purple-500/30 transition-all" whileHover={{ scale: 1.1, y: -2 }}>
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="text-white/60"><rect x="2" y="2" width="20" height="20" rx="5"/><circle cx="12" cy="12" r="5"/><circle cx="17.5" cy="6.5" r="1" fill="currentColor" stroke="none"/></svg>
                </motion.a>
                <motion.a href="https://www.tiktok.com/@luxtradeee" target="_blank" rel="noopener noreferrer" className="w-10 h-10 rounded-xl bg-white/5 border border-white/[0.08] flex items-center justify-center hover:bg-white/10 hover:border-purple-500/30 transition-all" whileHover={{ scale: 1.1, y: -2 }}>
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" className="text-white/60"><path d="M19.59 6.69a4.83 4.83 0 01-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 01-2.88 2.5 2.89 2.89 0 01-2.89-2.89 2.89 2.89 0 012.89-2.89c.28 0 .54.04.79.1v-3.5a6.37 6.37 0 00-.79-.05A6.34 6.34 0 003.15 15.2a6.34 6.34 0 0010.86 4.46V13a8.28 8.28 0 005.58 2.14V11.7a4.79 4.79 0 01-3.59-1.52V6.69h3.59z"/></svg>
                </motion.a>
                <motion.a href="https://t.me/Risxyiee" target="_blank" rel="noopener noreferrer" className="w-10 h-10 rounded-xl bg-white/5 border border-white/[0.08] flex items-center justify-center hover:bg-white/10 hover:border-purple-500/30 transition-all" whileHover={{ scale: 1.1, y: -2 }}>
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" className="text-white/60"><path d="M11.944 0A12 12 0 000 12a12 12 0 0012 12 12 12 0 0012-12A12 12 0 0012 0a12 12 0 00-.056 0zm4.962 7.224c.1-.002.321.023.465.14a.506.506 0 01.171.325c.016.093.036.306.02.472-.18 1.898-.962 6.502-1.36 8.627-.168.9-.499 1.201-.82 1.23-.696.065-1.225-.46-1.9-.902-1.056-.693-1.653-1.124-2.678-1.8-1.185-.78-.417-1.21.258-1.91.177-.184 3.247-2.977 3.307-3.23.007-.032.014-.15-.056-.212s-.174-.041-.249-.024c-.106.024-1.793 1.14-5.061 3.345-.48.33-.913.49-1.302.48-.428-.008-1.252-.241-1.865-.44-.752-.245-1.349-.374-1.297-.789.027-.216.325-.437.893-.663 3.498-1.524 5.83-2.529 6.998-3.014 3.332-1.386 4.025-1.627 4.476-1.635z"/></svg>
                </motion.a>
                <motion.a href="https://discord.gg/MSrh3qmkc" target="_blank" rel="noopener noreferrer" className="w-10 h-10 rounded-xl bg-white/5 border border-white/[0.08] flex items-center justify-center hover:bg-[#5865F2]/10 hover:border-[#5865F2]/30 transition-all" whileHover={{ scale: 1.1, y: -2 }}>
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" className="text-white/60"><path d="M20.317 4.37a19.791 19.791 0 0 0-4.885-1.515.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0 12.64 12.64 0 0 0-.617-1.25.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057a.082.082 0 0 0 .031.057 19.9 19.9 0 0 0 5.993 3.03.078.078 0 0 0 .084-.028 14.09 14.09 0 0 0 1.226-1.994.076.076 0 0 0-.041-.106 13.107 13.107 0 0 1-1.872-.892.077.077 0 0 1-.008-.128 10.2 10.2 0 0 0 .372-.292.074.074 0 0 1 .077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 0 1 .078.01c.12.098.246.198.373.292a.077.077 0 0 1-.006.127 12.299 12.299 0 0 1-1.873.892.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028 19.839 19.839 0 0 0 6.002-3.03.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.03zM8.02 15.33c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.956-2.419 2.157-2.419 1.21 0 2.176 1.095 2.157 2.42 0 1.333-.956 2.418-2.157 2.418zm7.975 0c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.955-2.419 2.157-2.419 1.21 0 2.176 1.095 2.157 2.42 0 1.333-.946 2.418-2.157 2.418z"/></svg>
                </motion.a>
              </div>
            </div>
            <div>
              <h4 className="font-bold text-white mb-4">{language === 'id' ? 'Produk' : 'Product'}</h4>
              <ul className="space-y-3">
                <li><a href="#features" className="text-white/50 hover:text-purple-300 transition-colors text-sm">{language === 'id' ? 'Fitur' : 'Features'}</a></li>
                <li><a href="#pricing" className="text-white/50 hover:text-purple-300 transition-colors text-sm">{language === 'id' ? 'Harga' : 'Pricing'}</a></li>
              </ul>
            </div>
            <div>
              <h4 className="font-bold text-white mb-4">{language === 'id' ? 'Perusahaan' : 'Company'}</h4>
              <ul className="space-y-3">
                <li><button onClick={() => openLegalPage('contact')} className="text-white/50 hover:text-purple-300 transition-colors text-sm cursor-pointer">{language === 'id' ? 'Kontak' : 'Contact'}</button></li>
                <li><button onClick={() => openLegalPage('terms')} className="text-white/50 hover:text-purple-300 transition-colors text-sm cursor-pointer">{language === 'id' ? 'Ketentuan' : 'Terms'}</button></li>
                <li><button onClick={() => openLegalPage('faq')} className="text-white/50 hover:text-purple-300 transition-colors text-sm cursor-pointer">FAQ</button></li>
                <li><button onClick={() => openLegalPage('refund')} className="text-white/50 hover:text-purple-300 transition-colors text-sm cursor-pointer">Refund Policy</button></li>
              </ul>
            </div>
          </div>
          <div className="pt-8 border-t border-white/[0.08]">
            <p className="text-white/40 text-sm">© {new Date().getFullYear()} LuxTrade. All rights reserved.</p>
          </div>
        </div>
      </footer>

      <PaymentConfirmationModal isOpen={showPayment} onClose={() => setShowPayment(false)} planName="Elite Pro" planPrice={25000} />
      <PaymentConfirmationModal isOpen={showLifetimePaymentModal} onClose={() => setShowLifetimePaymentModal(false)} planName="Lifetime Ultra" planPrice={52000} />
      <LegalPagesModal isOpen={showLegalModal} onClose={() => setShowLegalModal(false)} initialTab={legalModalTab} />
    </div>
  )
}