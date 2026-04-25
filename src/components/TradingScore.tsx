'use client'

import React, { useEffect, useRef, useState } from 'react'
import { motion } from 'framer-motion'
import { Trophy, TrendingUp, Target, Shield, Zap } from 'lucide-react'

// ─── Types ───────────────────────────────────────────────────────────────────

interface TradingAnalytics {
  totalTrades: number
  winRate: number
  profitFactor: number
  totalPL: number
  avgProfit: number
  avgLoss: number
  maxDrawdown: number
  sharpeRatio: number
}

interface Trade {
  profit_loss: number
  close_time: string
}

interface TradingScoreProps {
  analytics: TradingAnalytics | null
  trades: Trade[]
  isPro: boolean
  onUpgrade: () => void
}

interface ScoreBreakdown {
  winRate: { score: number; max: number; label: string; icon: React.ReactNode }
  profitFactor: { score: number; max: number; label: string; icon: React.ReactNode }
  riskReward: { score: number; max: number; label: string; icon: React.ReactNode }
  consistency: { score: number; max: number; label: string; icon: React.ReactNode }
  tradeVolume: { score: number; max: number; label: string; icon: React.ReactNode }
}

interface ScoreResult {
  score: number
  grade: string
  gradeColor: string
  breakdown: ScoreBreakdown
}

// ─── Scoring Algorithm (exported for reuse) ──────────────────────────────────

export function calculateTradingScore(
  analytics: TradingAnalytics | null,
  trades: Trade[]
): ScoreResult | null {
  if (!analytics || analytics.totalTrades < 5) return null

  // 1. Win Rate Score (25pts)
  let winRateScore = 0
  const wr = analytics.winRate
  if (wr >= 80) winRateScore = 25
  else if (wr >= 70) winRateScore = 20
  else if (wr >= 60) winRateScore = 15
  else if (wr >= 50) winRateScore = 10
  else if (wr >= 40) winRateScore = 5

  // 2. Profit Factor Score (25pts)
  let profitFactorScore = 0
  const pf = analytics.profitFactor
  if (pf >= 3.0) profitFactorScore = 25
  else if (pf >= 2.5) profitFactorScore = 22
  else if (pf >= 2.0) profitFactorScore = 18
  else if (pf >= 1.5) profitFactorScore = 12
  else if (pf >= 1.0) profitFactorScore = 5

  // 3. Risk/Reward Score (20pts)
  let riskRewardScore = 0
  const avgLoss = Math.abs(analytics.avgLoss)
  const rr = avgLoss > 0 ? analytics.avgProfit / avgLoss : 0
  if (rr >= 3.0) riskRewardScore = 20
  else if (rr >= 2.5) riskRewardScore = 17
  else if (rr >= 2.0) riskRewardScore = 14
  else if (rr >= 1.5) riskRewardScore = 10
  else if (rr >= 1.0) riskRewardScore = 5

  // 4. Consistency Score (15pts)
  let consistencyScore = 0
  const totalPL = analytics.totalPL
  const maxDD = analytics.maxDrawdown
  if (totalPL > 0 && maxDD < totalPL * 0.2) consistencyScore = 15
  else if (totalPL > 0 && maxDD < totalPL * 0.4) consistencyScore = 12
  else if (totalPL > 0 && maxDD < totalPL * 0.6) consistencyScore = 8
  else if (totalPL > 0) consistencyScore = 5

  // 5. Trade Volume Score (15pts)
  let tradeVolumeScore = 0
  const tt = analytics.totalTrades
  if (tt >= 100) tradeVolumeScore = 15
  else if (tt >= 50) tradeVolumeScore = 12
  else if (tt >= 30) tradeVolumeScore = 10
  else if (tt >= 20) tradeVolumeScore = 8
  else if (tt >= 10) tradeVolumeScore = 5
  else if (tt >= 5) tradeVolumeScore = 3

  const score = Math.min(100, winRateScore + profitFactorScore + riskRewardScore + consistencyScore + tradeVolumeScore)

  // Grade
  let grade: string
  let gradeColor: string
  if (score >= 90) { grade = 'Elite Trader'; gradeColor = '#fbbf24' }        // gold
  else if (score >= 75) { grade = 'Advanced'; gradeColor = '#34d399' }       // emerald
  else if (score >= 60) { grade = 'Intermediate'; gradeColor = '#60a5fa' }   // blue
  else if (score >= 40) { grade = 'Developing'; gradeColor = '#f59e0b' }     // amber
  else { grade = 'Beginner'; gradeColor = '#f87171' }                        // red

  const breakdown: ScoreBreakdown = {
    winRate: { score: winRateScore, max: 25, label: 'Win Rate', icon: <Target className="w-3.5 h-3.5" /> },
    profitFactor: { score: profitFactorScore, max: 25, label: 'Profit Factor', icon: <TrendingUp className="w-3.5 h-3.5" /> },
    riskReward: { score: riskRewardScore, max: 20, label: 'Risk / Reward', icon: <Shield className="w-3.5 h-3.5" /> },
    consistency: { score: consistencyScore, max: 15, label: 'Consistency', icon: <Trophy className="w-3.5 h-3.5" /> },
    tradeVolume: { score: tradeVolumeScore, max: 15, label: 'Trade Volume', icon: <Zap className="w-3.5 h-3.5" /> },
  }

  return { score, grade, gradeColor, breakdown }
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function getGaugeGradientId(score: number): string {
  return score >= 75 ? 'gauge-high' : score >= 50 ? 'gauge-mid' : 'gauge-low'
}

// ─── Component ───────────────────────────────────────────────────────────────

export default function TradingScore({
  analytics,
  trades,
  isPro,
  onUpgrade,
}: TradingScoreProps) {
  const result = calculateTradingScore(analytics, trades)
  const hasEnoughData = result !== null

  // Animated display score (count-up)
  const [displayScore, setDisplayScore] = useState(0)
  const displayScoreRef = useRef(0)

  useEffect(() => {
    const target = result ? result.score : 0

    let cancelled = false
    const duration = 1800 // ms
    const startTime = performance.now()
    const startVal = displayScoreRef.current

    function step(now: number) {
      if (cancelled) return
      const elapsed = now - startTime
      const progress = Math.min(elapsed / duration, 1)
      // ease-out cubic
      const eased = 1 - Math.pow(1 - progress, 3)
      const next = Math.round(startVal + (target - startVal) * eased)
      displayScoreRef.current = next
      setDisplayScore(next)
      if (progress < 1) requestAnimationFrame(step)
    }

    requestAnimationFrame(step)
    return () => { cancelled = true }
  }, [result])

  // SVG gauge config
  const radius = 90
  const strokeWidth = 10
  const center = 110
  const circumference = 2 * Math.PI * radius
  const gaugeOffset = hasEnoughData && result
    ? circumference - (displayScore / 100) * circumference
    : circumference

  // ─── Insufficient data state ─────────────────────────────────────────────

  if (!analytics || analytics.totalTrades < 5) {
    return (
      <div className="rounded-2xl bg-[#0a0712] border border-white/[0.06] p-6 flex flex-col items-center justify-center min-h-[380px] gap-4">
        <div className="relative w-32 h-32">
          <svg viewBox="0 0 220 220" className="w-full h-full -rotate-90">
            <circle
              cx={center}
              cy={center}
              r={radius}
              fill="none"
              stroke="rgba(255,255,255,0.06)"
              strokeWidth={strokeWidth}
            />
            <circle
              cx={center}
              cy={center}
              r={radius}
              fill="none"
              stroke="rgba(255,255,255,0.12)"
              strokeWidth={strokeWidth}
              strokeDasharray={circumference}
              strokeDashoffset={circumference}
              strokeLinecap="round"
            />
          </svg>
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <span className="text-4xl font-bold text-white/20">--</span>
            <span className="text-xs text-white/30 mt-1">No Score</span>
          </div>
        </div>
        <div className="text-center space-y-2 px-4">
          <h3 className="text-sm font-semibold text-white/60">
            Not Enough Data
          </h3>
          <p className="text-xs text-white/35 max-w-[240px]">
            Add at least 5 trades to calculate your performance score.
          </p>
        </div>
      </div>
    )
  }

  // ─── Main Score Display ─────────────────────────────────────────────────

  const scoreColor = result.gradeColor
  const gradId = getGaugeGradientId(result.score)

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, ease: 'easeOut' }}
      className="rounded-2xl bg-[#0a0712] border border-white/[0.06] p-6 flex flex-col items-center relative overflow-hidden"
    >
      {/* ── SVG Definitions ── */}
      <svg width="0" height="0" className="absolute">
        <defs>
          <linearGradient id="gauge-high" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="#a855f7" />
            <stop offset="100%" stopColor="#34d399" />
          </linearGradient>
          <linearGradient id="gauge-mid" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="#a855f7" />
            <stop offset="50%" stopColor="#6366f1" />
            <stop offset="100%" stopColor="#60a5fa" />
          </linearGradient>
          <linearGradient id="gauge-low" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="#f87171" />
            <stop offset="100%" stopColor="#f59e0b" />
          </linearGradient>
        </defs>
      </svg>

      {/* ── Background glow ── */}
      <div
        className="absolute top-[-60px] left-1/2 -translate-x-1/2 w-[260px] h-[260px] rounded-full blur-[100px] opacity-20 pointer-events-none"
        style={{ backgroundColor: scoreColor }}
      />

      {/* ── Title ── */}
      <div className="flex items-center gap-2 mb-4 z-10">
        <Trophy className="w-4 h-4 text-purple-400" />
        <h3 className="text-sm font-semibold text-white/80 tracking-wide uppercase">
          Performance Score
        </h3>
      </div>

      {/* ── Gauge ── */}
      <div className="relative z-10">
        <svg
          viewBox="0 0 220 220"
          width="200"
          height="200"
          className="-rotate-90"
        >
          {/* Track */}
          <circle
            cx={center}
            cy={center}
            r={radius}
            fill="none"
            stroke="rgba(255,255,255,0.06)"
            strokeWidth={strokeWidth}
          />
          {/* Tick marks */}
          {Array.from({ length: 40 }).map((_, i) => {
            const angle = (i / 40) * 360
            const isMajor = i % 10 === 0
            const outerR = radius + strokeWidth / 2 + (isMajor ? 6 : 3)
            const innerR = radius + strokeWidth / 2 + 1
            const rad = (angle * Math.PI) / 180
            const x1 = center + outerR * Math.cos(rad)
            const y1 = center + outerR * Math.sin(rad)
            const x2 = center + innerR * Math.cos(rad)
            const y2 = center + innerR * Math.sin(rad)
            return (
              <line
                key={i}
                x1={x1}
                y1={y1}
                x2={x2}
                y2={y2}
                stroke={`rgba(255,255,255,${isMajor ? 0.12 : 0.04})`}
                strokeWidth={isMajor ? 1.5 : 0.75}
              />
            )
          })}
          {/* Progress arc */}
          <circle
            cx={center}
            cy={center}
            r={radius}
            fill="none"
            stroke={`url(#${gradId})`}
            strokeWidth={strokeWidth}
            strokeDasharray={circumference}
            strokeDashoffset={gaugeOffset}
            strokeLinecap="round"
            style={{
              transition: 'stroke-dashoffset 1.8s cubic-bezier(0.22, 1, 0.36, 1)',
            }}
          />
        </svg>

        {/* Center content */}
        <div className="absolute inset-0 flex flex-col items-center justify-center rotate-0">
          <motion.span
            key={result.score}
            initial={{ scale: 0.8, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ delay: 0.4, duration: 0.4 }}
            className="text-5xl font-extrabold tracking-tight tabular-nums"
            style={{ color: scoreColor }}
          >
            {displayScore}
          </motion.span>
          <motion.span
            initial={{ opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.7, duration: 0.4 }}
            className="text-xs font-semibold mt-1 tracking-widest uppercase"
            style={{ color: scoreColor, opacity: 0.85 }}
          >
            {result.grade}
          </motion.span>
          <span className="text-[10px] text-white/25 mt-0.5">/ 100</span>
        </div>
      </div>

      {/* ── Breakdown bars ── */}
      <div className="w-full mt-6 space-y-2.5 z-10">
        {Object.entries(result.breakdown).map(([key, cat], i) => (
          <motion.div
            key={key}
            initial={{ opacity: 0, x: -12 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.8 + i * 0.1, duration: 0.4 }}
            className="flex items-center gap-2.5"
          >
            <div className="flex items-center gap-1.5 w-[110px] shrink-0">
              <span style={{ color: scoreColor, opacity: 0.7 }}>
                {cat.icon}
              </span>
              <span className="text-[11px] text-white/50 truncate">
                {cat.label}
              </span>
            </div>
            <div className="flex-1 h-[5px] rounded-full bg-white/[0.06] overflow-hidden">
              <motion.div
                className="h-full rounded-full"
                style={{ backgroundColor: scoreColor }}
                initial={{ width: 0 }}
                animate={{
                  width: `${(cat.score / cat.max) * 100}%`,
                }}
                transition={{
                  delay: 1 + i * 0.1,
                  duration: 0.8,
                  ease: [0.22, 1, 0.36, 1],
                }}
              />
            </div>
            <span className="text-[11px] font-medium text-white/40 w-8 text-right tabular-nums">
              {cat.score}/{cat.max}
            </span>
          </motion.div>
        ))}
      </div>

      {/* ── PRO Blur Overlay ── */}
      {!isPro && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.6, duration: 0.5 }}
          className="absolute inset-0 z-20 flex flex-col items-center justify-center bg-[#0a0712]/60 backdrop-blur-xl rounded-2xl gap-3 px-6"
        >
          <div className="w-10 h-10 rounded-full bg-purple-500/20 flex items-center justify-center">
            <Trophy className="w-5 h-5 text-purple-400" />
          </div>
          <div className="text-center space-y-1.5">
            <h4 className="text-sm font-semibold text-white/90">
              Unlock Your Score
            </h4>
            <p className="text-xs text-white/45 max-w-[220px] leading-relaxed">
              Upgrade to PRO to reveal your full trading performance score and
              detailed breakdown.
            </p>
          </div>
          <button
            onClick={onUpgrade}
            className="mt-1 px-5 py-2 rounded-full text-xs font-semibold text-white bg-gradient-to-r from-purple-600 to-violet-600 hover:from-purple-500 hover:to-violet-500 transition-all duration-200 shadow-lg shadow-purple-500/20 hover:shadow-purple-500/35 cursor-pointer"
          >
            Upgrade to PRO
          </button>
        </motion.div>
      )}
    </motion.div>
  )
}
