'use client'

import React, { useEffect, useRef, useState, useMemo } from 'react'
import {
  ArrowUpRight, ArrowDownRight, TrendingUp, TrendingDown,
  Gem, Wallet, Loader2
} from 'lucide-react'
import { Card, CardContent, CardHeader } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'

// ==================== TYPES ====================

interface EquityData {
  equityCurve: { date: string; equity: number }[]
  initialBalance: number
  currentBalance: number
  totalPL: number
  peakEquity: number
  troughEquity: number
  maxDrawdown: number
  totalReturnPct: number
  tradeCount: number
}

interface EquityCurveCardProps {
  language?: 'id' | 'en'
  tradingAccounts?: any[]
  className?: string
}

// ==================== HELPERS ====================

function fmtCurrency(value: number): string {
  const sign = value >= 0 ? '+' : ''
  return `${sign}$${Math.abs(value).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

function fmtUSD(value: number): string {
  return `$${value.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

// ==================== SVG CHART ====================

interface ChartPoints {
  svgPath: string
  fillPath: string
  width: number
  height: number
  minX: number
  maxX: number
  minY: number
  maxY: number
  points: { x: number; y: number; data: { date: string; equity: number } }[]
}

function computeChartPoints(
  data: { date: string; equity: number }[],
  containerW: number,
  containerH: number,
  padding: { top: number; right: number; bottom: number; left: number }
): ChartPoints | null {
  if (data.length === 0) return null

  const { top, right, bottom, left } = padding
  const chartW = containerW - left - right
  const chartH = containerH - top - bottom

  if (chartW <= 0 || chartH <= 0) return null

  const values = data.map(d => d.equity)
  const minVal = Math.min(...values)
  const maxVal = Math.max(...values)

  // Add 5% padding to the range so the line doesn't touch edges
  const range = maxVal - minVal || 1
  const padRange = range * 0.08
  const yMin = minVal - padRange
  const yMax = maxVal + padRange

  const xScale = (i: number) => data.length === 1
    ? left + chartW / 2
    : left + (i / (data.length - 1)) * chartW

  const yScale = (v: number) => top + chartH - ((v - yMin) / (yMax - yMin)) * chartH

  const points = data.map((d, i) => ({
    x: xScale(i),
    y: yScale(d.equity),
    data: d
  }))

  // Build SVG path (smooth curve using bezier)
  let svgPath = `M ${points[0].x} ${points[0].y}`
  for (let i = 1; i < points.length; i++) {
    const prev = points[i - 1]
    const curr = points[i]
    const cpx = (prev.x + curr.x) / 2
    svgPath += ` C ${cpx} ${prev.y}, ${cpx} ${curr.y}, ${curr.x} ${curr.y}`
  }

  // Build fill path (closed area under the curve)
  const fillPath = svgPath +
    ` L ${points[points.length - 1].x} ${top + chartH}` +
    ` L ${points[0].x} ${top + chartH} Z`

  return {
    svgPath,
    fillPath,
    width: containerW,
    height: containerH,
    minX: 0,
    maxX: data.length - 1,
    minY: yMin,
    maxY: yMax,
    points
  }
}

// ==================== TOOLTIP ====================

function Tooltip({
  point,
  chartData,
  initialBalance,
  language,
  position
}: {
  point: { x: number; y: number; data: { date: string; equity: number } } | null
  chartData: EquityData | null
  initialBalance: number
  language: 'id' | 'en'
  position: { x: number; y: number }
}) {
  if (!point || !chartData) return null

  const idx = chartData.equityCurve.findIndex(d => d.date === point.data.date)
  const prevEquity = idx > 0 ? chartData.equityCurve[idx - 1].equity : initialBalance
  const change = point.data.equity - prevEquity
  const changePct = prevEquity > 0 ? ((change / prevEquity) * 100) : 0
  const isPositive = change >= 0

  // Position tooltip - flip if near right edge
  const isRight = position.x > 160

  return (
    <div
      className="absolute pointer-events-none z-50 transition-all duration-75"
      style={{
        left: isRight ? position.x - 190 : position.x + 12,
        top: Math.max(4, position.y - 70),
      }}
    >
      <div className="bg-[#0f0b18]/95 backdrop-blur-sm border border-purple-500/30 rounded-lg p-2.5 shadow-xl shadow-purple-500/10 min-w-[170px]">
        <p className="text-[10px] text-gray-400 mb-1">{point.data.date}</p>
        <p className="text-sm font-bold bg-gradient-to-r from-purple-300 to-amber-300 bg-clip-text text-transparent">
          {fmtUSD(point.data.equity)}
        </p>
        {idx > 0 && (
          <p className={`text-[10px] mt-0.5 flex items-center gap-0.5 ${isPositive ? 'text-emerald-400' : 'text-red-400'}`}>
            {isPositive ? <ArrowUpRight className="w-2.5 h-2.5" /> : <ArrowDownRight className="w-2.5 h-2.5" />}
            {isPositive ? '+' : ''}{change.toFixed(2)} ({changePct >= 0 ? '+' : ''}{changePct.toFixed(1)}%)
          </p>
        )}
      </div>
    </div>
  )
}

// ==================== MAIN COMPONENT ====================

function EquityCurveCardInner({ language = 'id', tradingAccounts, className }: EquityCurveCardProps) {
  const [data, setData] = useState<EquityData | null>(null)
  const [loading, setLoading] = useState(true)
  const [hoveredPoint, setHoveredPoint] = useState<{ x: number; y: number; data: { date: string; equity: number } } | null>(null)
  const [mousePos, setMousePos] = useState({ x: 0, y: 0 })
  const containerRef = useRef<HTMLDivElement>(null)
  const chartRef = useRef<SVGSVGElement>(null)
  const [dimensions, setDimensions] = useState({ w: 600, h: 300 })

  // Fetch data
  const fetchStartedRef = useRef(false)
  useEffect(() => {
    if (fetchStartedRef.current) return
    fetchStartedRef.current = true
    fetch('/api/equity-curve')
      .then(r => r.ok ? r.json() : null)
      .then(d => { setData(d); setLoading(false) })
      .catch(() => setLoading(false))
  }, [])

  // Observe container size
  useEffect(() => {
    const el = containerRef.current
    if (!el) return
    const ro = new ResizeObserver(entries => {
      for (const entry of entries) {
        const { width } = entry.contentRect
        if (width > 0) {
          setDimensions({ w: Math.round(width), h: Math.min(380, Math.max(220, Math.round(width * 0.45))) })
        }
      }
    })
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  const isPositive = data ? data.totalPL >= 0 : true
  const defaultAccount = tradingAccounts?.find((a: any) => a.is_default) || tradingAccounts?.[0]

  // Compute chart geometry (memoized — expensive SVG path computation)
  const chart = useMemo(() => {
    if (!data || data.equityCurve.length === 0) return null
    return computeChartPoints(data.equityCurve, dimensions.w, dimensions.h, { top: 12, right: 12, bottom: 28, left: 50 })
  }, [data, dimensions.w, dimensions.h])

  // Y-axis labels
  const yLabels = chart ? [
    { value: chart.maxY, y: chart.points[0].y },
    { value: (chart.maxY + chart.minY) / 2, y: (chart.points[0].y + dimensions.h - 28) / 2 },
    { value: chart.minY, y: dimensions.h - 28 },
  ] : []

  // X-axis labels (show 3-5 evenly spaced dates)
  const xLabels = chart && chart.points.length > 1
    ? [0, Math.floor(chart.points.length / 2), chart.points.length - 1]
      .filter(i => i < chart.points.length)
      .map(i => ({ date: chart.points[i].data.date, x: chart.points[i].x }))
    : []

  // Mouse move handler for tooltip (inline to avoid React Compiler memoization issues)
  function handleMouseMove(e: React.MouseEvent<SVGSVGElement>) {
    if (!chart || !chartRef.current) return
    const rect = chartRef.current.getBoundingClientRect()
    const mx = e.clientX - rect.left
    const my = e.clientY - rect.top

    // Find nearest point
    let closest: typeof chart.points[0] | null = null
    let minDist = Infinity
    for (const p of chart.points) {
      const d = Math.abs(p.x - mx)
      if (d < minDist) { minDist = d; closest = p }
    }

    if (closest && minDist < 30) {
      setHoveredPoint(closest)
      setMousePos({ x: mx, y: my })
    } else {
      setHoveredPoint(null)
    }
  }

  function handleMouseLeave() { setHoveredPoint(null) }

  // ==================== RENDER ====================

  return (
    <Card className={`relative overflow-hidden bg-lux-bg-card dark:bg-gradient-to-br dark:from-[#0f0b18] dark:via-[#110d1f] dark:to-[#0d0820] border border-lux-border dark:border-purple-500/20 transition-all duration-300 hover:border-purple-500/40 hover:shadow-2xl hover:shadow-purple-500/10 ${className || ''}`}>
      {/* Static subtle background - no animation, no framer-motion */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden">
        <div className="absolute -top-20 -left-20 w-60 h-60 bg-purple-500/[0.06] rounded-full blur-3xl" />
        <div className="absolute -bottom-16 -right-16 w-48 h-48 bg-amber-500/[0.04] rounded-full blur-3xl" />
        <div className="absolute inset-0 opacity-[0.025]" style={{
          backgroundImage: 'linear-gradient(rgba(139,92,246,0.3) 1px, transparent 1px), linear-gradient(90deg, rgba(139,92,246,0.3) 1px, transparent 1px)',
          backgroundSize: '40px 40px'
        }} />
      </div>

      {/* Header */}
      <CardHeader className="relative z-10 pb-2">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <div className="flex items-center gap-2.5">
            <div className="relative">
              <div className={`p-2 rounded-xl bg-gradient-to-br ${isPositive ? 'from-emerald-500/20 to-emerald-600/10' : 'from-red-500/20 to-red-600/10'} border ${isPositive ? 'border-emerald-500/20' : 'border-lux-border dark:border-red-500/20'}`}>
                <Gem className={`w-4 h-4 ${isPositive ? 'text-emerald-400' : 'text-red-400'}`} />
              </div>
              <div className={`absolute -top-0.5 -right-0.5 w-2 h-2 rounded-full ${isPositive ? 'bg-emerald-400' : 'bg-red-400'}`} />
            </div>
            <div>
              <p className="text-base font-bold bg-gradient-to-r from-white via-purple-200 to-amber-200 bg-clip-text text-transparent">
                {language === 'id' ? 'Kurva Ekuitas' : 'Equity Curve'}
              </p>
              {data && (
                <p className="text-[10px] text-lux-text-muted dark:text-gray-500 mt-0.5">
                  {data.tradeCount} {language === 'id' ? 'transaksi' : 'trades'} · {data.equityCurve.length} {language === 'id' ? 'titik data' : 'data points'}
                </p>
              )}
            </div>
          </div>

          {/* Summary badges */}
          {data && (
            <div className="flex items-center gap-1.5">
              <div className={`flex items-center gap-1 px-2.5 py-1 rounded-lg border text-xs font-bold ${isPositive
                ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400'
                : 'bg-red-500/10 border-red-500/20 text-red-400'
                }`}>
                {isPositive ? <ArrowUpRight className="w-3 h-3" /> : <ArrowDownRight className="w-3 h-3" />}
                {fmtCurrency(data.totalPL)}
              </div>
              <div className="px-2.5 py-1 rounded-lg border text-xs font-bold bg-purple-500/10 border-purple-500/20 text-purple-300">
                {data.totalReturnPct >= 0 ? '+' : ''}{data.totalReturnPct.toFixed(1)}%
              </div>
            </div>
          )}
        </div>
      </CardHeader>

      <CardContent className="relative z-10">
        {/* Account info bar */}
        {defaultAccount && data && (
          <div className="mb-3 p-2.5 rounded-xl bg-white/[0.02] border border-white/[0.06]">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-purple-500/20 to-violet-500/20 border border-purple-500/20 flex items-center justify-center">
                  <Wallet className="w-3.5 h-3.5 text-purple-400" />
                </div>
                <div>
                  <div className="flex items-center gap-1.5">
                    <span className="text-xs font-semibold text-lux-text-primary dark:text-white/90">{defaultAccount.name}</span>
                    <Badge className={`text-[9px] px-1 py-0 h-3.5 ${
                      defaultAccount.account_type === 'BACKTEST' ? 'bg-amber-500/15 text-amber-400 border-amber-500/30' :
                      defaultAccount.account_type === 'DEMO' ? 'bg-blue-500/15 text-blue-400 border-blue-500/30' :
                      'bg-emerald-500/15 text-emerald-400 border-emerald-500/30'
                    }`}>
                      {defaultAccount.account_type}
                    </Badge>
                  </div>
                  <div className="flex items-center gap-2 mt-0.5 text-[10px] text-lux-text-muted dark:text-gray-500">
                    {defaultAccount.broker && <span>{defaultAccount.broker}</span>}
                    {defaultAccount.account_number && <span>#{defaultAccount.account_number}</span>}
                    <span>1:{defaultAccount.leverage}</span>
                  </div>
                </div>
              </div>
              <div className="text-right">
                <p className="text-[9px] uppercase tracking-wider text-lux-text-muted dark:text-gray-500 mb-0.5">
                  {language === 'id' ? 'Saldo Saat Ini' : 'Current Balance'}
                </p>
                <p className="text-base font-bold bg-gradient-to-r from-emerald-300 via-white to-purple-200 bg-clip-text text-transparent">
                  {defaultAccount.currency || 'USD'} {fmtUSD(data.currentBalance)}
                </p>
                <div className="flex items-center gap-2 mt-0.5 text-[9px] text-lux-text-muted dark:text-gray-500 justify-end">
                  <span>{language === 'id' ? 'Awal' : 'Initial'}: {fmtUSD(data.initialBalance)}</span>
                  <span className="text-gray-700">|</span>
                  <span>DD: <span className="text-red-400/80">{data.maxDrawdown.toFixed(1)}%</span></span>
                </div>
              </div>
            </div>

            {/* Multi-account chips */}
            {tradingAccounts && tradingAccounts.length > 1 && (
              <div className="mt-2 pt-2 border-t border-white/[0.06]">
                <div className="flex items-center gap-2 overflow-x-auto pb-0.5 scrollbar-none">
                  {tradingAccounts.map((acc: any) => (
                    <div key={acc.id} className={`flex items-center gap-1.5 px-2 py-1 rounded-md border flex-shrink-0 text-[10px] ${acc.is_default
                      ? 'bg-purple-500/10 border-purple-500/30 text-purple-300'
                      : 'bg-white/[0.02] border-white/[0.06] text-gray-400'
                      }`}>
                      <div className={`w-1.5 h-1.5 rounded-full ${acc.is_default ? 'bg-purple-400' : 'bg-gray-600'}`} />
                      <span className="font-medium truncate max-w-[100px]">{acc.name}</span>
                      <span className="text-gray-500">{fmtUSD(acc.current_balance || acc.initial_balance || 0)}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Chart container */}
        <div ref={containerRef} className="relative w-full" style={{ height: `${dimensions.h}px` }}>
          {loading && (
            <div className="absolute inset-0 flex items-center justify-center">
              <Loader2 className="w-6 h-6 text-purple-400 animate-spin" />
            </div>
          )}

          {!loading && chart && (
            <svg
              ref={chartRef}
              width={dimensions.w}
              height={dimensions.h}
              viewBox={`0 0 ${dimensions.w} ${dimensions.h}`}
              className="w-full h-full"
              onMouseMove={handleMouseMove}
              onMouseLeave={handleMouseLeave}
            >
              <defs>
                {/* Gradient stroke */}
                <linearGradient id="eqStroke" x1="0" y1="0" x2="1" y2="0">
                  <stop offset="0%" stopColor="#a78bfa" />
                  <stop offset="40%" stopColor="#c084fc" />
                  <stop offset="70%" stopColor="#e8a838" />
                  <stop offset="100%" stopColor="#fbbf24" />
                </linearGradient>
                {/* Fill gradient */}
                <linearGradient id="eqFill" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={isPositive ? '#22c55e' : '#ef4444'} stopOpacity={0.2} />
                  <stop offset="50%" stopColor="#8b5cf6" stopOpacity={0.08} />
                  <stop offset="100%" stopColor="#8b5cf6" stopOpacity={0} />
                </linearGradient>
                {/* Glow filter - lightweight */}
                <filter id="eqGlow">
                  <feGaussianBlur stdDeviation="2" result="blur" />
                  <feMerge>
                    <feMergeNode in="blur" />
                    <feMergeNode in="SourceGraphic" />
                  </feMerge>
                </filter>
              </defs>

              {/* Horizontal grid lines */}
              {yLabels.map((label, i) => (
                <g key={i}>
                  <line
                    x1={50} y1={label.y} x2={dimensions.w - 12} y2={label.y}
                    stroke="rgba(255,255,255,0.04)"
                    strokeDasharray="3 6"
                  />
                  <text
                    x={46} y={label.y + 3}
                    fill="rgba(255,255,255,0.25)"
                    fontSize="9"
                    textAnchor="end"
                    fontFamily="monospace"
                  >
                    ${(label.value / 1000).toFixed(1)}k
                  </text>
                </g>
              ))}

              {/* X-axis labels */}
              {xLabels.map((label, i) => (
                <text
                  key={i}
                  x={label.x} y={dimensions.h - 6}
                  fill="rgba(255,255,255,0.2)"
                  fontSize="8"
                  textAnchor="middle"
                >
                  {label.date.slice(5)} {/* Show MM-DD */}
                </text>
              ))}

              {/* Reference line at initial balance */}
              {chart.points.length > 0 && (() => {
                const y = 12 + (dimensions.h - 40) - ((data!.initialBalance - chart.minY) / (chart.maxY - chart.minY)) * (dimensions.h - 40)
                if (y < 12 || y > dimensions.h - 28) return null
                return (
                  <line
                    x1={50} y1={y} x2={dimensions.w - 12} y2={y}
                    stroke="rgba(255,255,255,0.06)"
                    strokeDasharray="6 4"
                  />
                )
              })()}

              {/* Glow line (behind main) */}
              <path
                d={chart.svgPath}
                fill="none"
                stroke="url(#eqStroke)"
                strokeWidth={1}
                filter="url(#eqGlow)"
                opacity={0.6}
              />

              {/* Main area fill */}
              <path
                d={chart.fillPath}
                fill="url(#eqFill)"
              />

              {/* Main stroke */}
              <path
                d={chart.svgPath}
                fill="none"
                stroke="url(#eqStroke)"
                strokeWidth={2}
                strokeLinecap="round"
                strokeLinejoin="round"
              />

              {/* End dot with pulse ring */}
              {chart.points.length > 0 && (
                <g>
                  <circle
                    cx={chart.points[chart.points.length - 1].x}
                    cy={chart.points[chart.points.length - 1].y}
                    r={6}
                    fill="#c084fc"
                    opacity={0.15}
                  />
                  <circle
                    cx={chart.points[chart.points.length - 1].x}
                    cy={chart.points[chart.points.length - 1].y}
                    r={3}
                    fill="#c084fc"
                    stroke="#fff"
                    strokeWidth={1.5}
                  />
                </g>
              )}

              {/* Hover crosshair line */}
              {hoveredPoint && (
                <line
                  x1={hoveredPoint.x}
                  y1={12}
                  x2={hoveredPoint.x}
                  y2={dimensions.h - 28}
                  stroke="rgba(192,132,252,0.3)"
                  strokeDasharray="2 3"
                />
              )}

              {/* Hover dot */}
              {hoveredPoint && (
                <circle
                  cx={hoveredPoint.x}
                  cy={hoveredPoint.y}
                  r={4}
                  fill="#c084fc"
                  stroke="#fff"
                  strokeWidth={2}
                />
              )}
            </svg>
          )}

          {!loading && (!chart || data?.equityCurve.length === 0) && (
            <div className="absolute inset-0 flex items-center justify-center">
              <p className="text-sm text-gray-500">
                {language === 'id' ? 'Belum ada data transaksi' : 'No trade data yet'}
              </p>
            </div>
          )}
        </div>

        {/* Tooltip (positioned relative to chart container) */}
        <Tooltip
          point={hoveredPoint}
          chartData={data}
          initialBalance={data?.initialBalance ?? 10000}
          language={language}
          position={mousePos}
        />

        {/* Bottom stats bar */}
        {data && data.equityCurve.length > 0 && (
          <div className="mt-3 flex items-center justify-between flex-wrap gap-2 pt-2.5 border-t border-white/[0.06]">
            <div className="flex items-center gap-4">
              <div>
                <p className="text-[9px] uppercase tracking-wider text-lux-text-muted dark:text-gray-500">
                  {language === 'id' ? 'Ekuitas Tertinggi' : 'Peak Equity'}
                </p>
                <p className="text-xs font-bold text-emerald-400">{fmtUSD(data.peakEquity)}</p>
              </div>
              <div>
                <p className="text-[9px] uppercase tracking-wider text-lux-text-muted dark:text-gray-500">
                  {language === 'id' ? 'Ekuitas Terendah' : 'Trough Equity'}
                </p>
                <p className="text-xs font-bold text-red-400">{fmtUSD(data.troughEquity)}</p>
              </div>
              <div>
                <p className="text-[9px] uppercase tracking-wider text-lux-text-muted dark:text-gray-500">Max Drawdown</p>
                <p className="text-xs font-bold text-amber-400">-{data.maxDrawdown.toFixed(1)}%</p>
              </div>
            </div>
            <div className="text-right">
              <p className="text-[9px] uppercase tracking-wider text-lux-text-muted dark:text-gray-500">Total Return</p>
              <p className={`text-xs font-bold flex items-center gap-0.5 justify-end ${data.totalReturnPct >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                {data.totalReturnPct >= 0 ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
                {data.totalReturnPct >= 0 ? '+' : ''}{data.totalReturnPct.toFixed(2)}%
              </p>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  )
}

// Wrap with React.memo to prevent re-renders when parent state changes
const EquityCurveCard = React.memo(EquityCurveCardInner)
export default EquityCurveCard