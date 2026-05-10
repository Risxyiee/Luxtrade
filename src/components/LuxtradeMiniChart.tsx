'use client'

import { useEffect, useRef, useState, useCallback } from 'react'
import { createChart, ColorType, CrosshairMode, LineStyle, IChartApi, ISeriesApi } from 'lightweight-charts'
import { Activity, Loader2, Lock } from 'lucide-react'

interface KlineData {
  time: number
  open: number
  high: number
  low: number
  close: number
}

interface Signal {
  time: number
  type: 'BUY' | 'SELL'
  price: number
}

interface LuxtradeMiniChartProps {
  isPro: boolean
  demoMode?: boolean
  interval?: string
  symbol?: string  // Added symbol prop
}

export default function LuxtradeMiniChart({ isPro, demoMode = false, interval = '15m', symbol = 'XAUUSD' }: LuxtradeMiniChartProps) {
  // Refs for chart and data - NO re-renders from these
  const chartContainerRef = useRef<HTMLDivElement>(null)
  const chartRef = useRef<IChartApi<'UTCTimestamp'> | null>(null)
  const seriesRef = useRef<ISeriesApi<'UTCTimestamp', KlineData> | null>(null)
  const resizeObserverRef = useRef<ResizeObserver | null>(null)
  const intervalRef = useRef<NodeJS.Timeout | null>(null)
  const dataRef = useRef<KlineData[]>([])  // Store data in ref, not state
  const signalsRef = useRef<Signal[]>([])  // Store signals in ref, not state
  const lastDataHashRef = useRef<string | null>(null)  // Track data hash for comparison
  const isCreatedRef = useRef(false)  // Prevent chart recreation
  const currentPriceRef = useRef<number | null>(null)
  const priceChangeRef = useRef(0)

  // Minimal state for UI only - these are the only things that should trigger re-renders
  const [mounted, setMounted] = useState(false)
  const [loading, setLoading] = useState(true)
  const [chartError, setChartError] = useState(false)
  const [uiPrice, setUiPrice] = useState<number | null>(null)  // UI-specific price state
  const [uiPriceChange, setUiPriceChange] = useState(0)  // UI-specific price change state
  const [uiSignals, setUiSignals] = useState<Signal[]>([])  // UI-specific signals state

  // Component mount guard - runs ONCE
  useEffect(() => {
    console.log('🔵 [LUXCHART] Component mounting')
    setMounted(true)
    return () => {
      console.log('🟡 [LUXCHART] Component unmounting')
      setMounted(false)
    }
  }, [])

  // ONE-TIME chart creation - empty dependency array
  useEffect(() => {
    if (!mounted || isCreatedRef.current) return

    const container = chartContainerRef.current
    if (!container) {
      console.warn('[LUXCHART] Container ref is null')
      return
    }

    try {
      console.log('[LUXCHART] Creating chart (ONE-TIME)')

      // Create chart with explicit height/width
      const chart = createChart(container, {
        width: container.clientWidth,
        height: 300,
        layout: {
          background: { type: ColorType.Solid, color: 'transparent' },
          textColor: '#9ca3af',
        },
        timeScale: {
          borderColor: '#374151',
          timeVisible: false,
          secondsVisible: false,
        },
        priceScale: {
          borderColor: '#374151',
          scaleMargins: {
            top: 0.1,
            bottom: 0.2,
          },
        },
        crosshair: {
          mode: CrosshairMode.Normal,
          vertLine: {
            color: '#6b7280',
            width: 1,
            style: LineStyle.Dashed,
            labelBackgroundColor: '#1f2937',
          },
          horzLine: {
            color: '#6b7280',
            width: 1,
            style: LineStyle.Dashed,
            labelBackgroundColor: '#1f2937',
          },
        },
        rightPriceScale: {
          visible: false,
        },
        grid: {
          vertLines: {
            color: 'rgba(55, 65, 81, 0.3)',
            style: LineStyle.Dotted,
          },
          horzLines: {
            color: 'rgba(55, 65, 81, 0.3)',
            style: LineStyle.Dotted,
          },
        },
        handleScale: false,
        handleScroll: false,
      })

      const series = chart.addCandlestickSeries({
        upColor: '#22c55e',
        downColor: '#ef4444',
        borderVisible: false,
        wickUpColor: '#22c55e',
        wickDownColor: '#ef4444',
      })

      chartRef.current = chart
      seriesRef.current = series
      isCreatedRef.current = true

      console.log('[LUXCHART] ✅ Chart created successfully')

      // Resize observer - only updates dimensions, not recreation
      resizeObserverRef.current = new ResizeObserver((entries) => {
        if (!chartRef.current || entries.length === 0) return
        const rect = entries[0].contentRect
        chartRef.current.applyOptions({
          width: rect.width,
          height: 300,
        })
      })

      resizeObserverRef.current.observe(container)
    } catch (error) {
      console.error('[LUXCHART] ❌ Error creating chart:', error)
      setChartError(true)
    }

    return () => {
      if (resizeObserverRef.current) {
        resizeObserverRef.current.disconnect()
        resizeObserverRef.current = null
      }
      if (chartRef.current) {
        try {
          chartRef.current.remove()
        } catch (e) {
          console.error('Error removing chart:', e)
        }
        chartRef.current = null
      }
      if (seriesRef.current) {
        seriesRef.current = null
      }
      isCreatedRef.current = false
    }
  }, []) // EMPTY dependency array - runs ONLY once

  // Fetch klines - deep memoization with empty dependency array
  const fetchKlines = useCallback(async () => {
    console.log('[LUXCHART] 🔄 Fetching data...')

    try {
      setLoading(true)
      setChartError(false)

      // Use forex API for all forex symbols
      const res = await fetch(`/api/forex?symbol=${symbol}&interval=${interval}&limit=50`)

      if (!res.ok) {
        throw new Error(`HTTP ${res.status}`)
      }

      const response = await res.json()
      const klines = response?.data || response || []

      if (!Array.isArray(klines) || klines.length === 0) {
        console.warn('[LUXCHART] No data available')
        setLoading(false)
        return
      }

      // Process data
      const klineData: KlineData[] = klines
        .map((k: any) => ({
          time: k?.time ?? 0,
          open: k?.open ?? 0,
          high: k?.high ?? 0,
          low: k?.low ?? 0,
          close: k?.close ?? 0,
        }))
        .filter((kline) => {
          return (
            typeof kline.time === 'number' && kline.time > 0 &&
            typeof kline.open === 'number' && kline.open > 0 &&
            typeof kline.high === 'number' && kline.high > 0 &&
            typeof kline.low === 'number' && kline.low > 0 &&
            typeof kline.close === 'number' && kline.close > 0 &&
            kline.high >= kline.low
          )
        })
        .sort((a, b) => a.time - b.time)

      if (klineData.length === 0) {
        setLoading(false)
        return
      }

      // Calculate hash for comparison
      const dataHash = JSON.stringify(klineData.slice(-5)) // Compare last 5 candles only

      // Only update if data changed
      if (dataHash !== lastDataHashRef.current) {
        console.log('[LUXCHART] 🆕 Data changed, updating chart')

        lastDataHashRef.current = dataHash
        dataRef.current = klineData

        // Update chart directly via ref - no state update
        if (seriesRef.current) {
          seriesRef.current.setData(klineData)
        }

        // Calculate signals
        const calculatedSignals: Signal[] = []
        for (let i = 2; i < klineData.length; i++) {
          const current = klineData[i]
          const prev1 = klineData[i - 1]
          const prev2 = klineData[i - 2]

          if (!current || !prev1 || !prev2) continue

          const lookbackHigh = Math.max(prev1.high, prev2.high)
          const lookbackLow = Math.min(prev1.low, prev2.low)
          const range = current.high - current.low

          if (range > 0) {
            const bodyPercent = Math.abs(current.close - current.open) / range * 100

            if (
              current.close > lookbackHigh &&
              bodyPercent >= 80 &&
              current.close > current.open
            ) {
              calculatedSignals.push({
                time: current.time,
                type: 'BUY',
                price: current.close,
              })
            }

            if (
              current.close < lookbackLow &&
              bodyPercent >= 80 &&
              current.close < current.open
            ) {
              calculatedSignals.push({
                time: current.time,
                type: 'SELL',
                price: current.close,
              })
            }
          }
        }

        signalsRef.current = calculatedSignals

        // Update UI state only
        const lastKline = klineData[klineData.length - 1]
        if (lastKline) {
          currentPriceRef.current = lastKline.close
          setUiPrice(lastKline.close)

          if (klineData.length > 1) {
            const prevKline = klineData[klineData.length - 2]
            if (prevKline && prevKline.close !== 0) {
              const change = ((lastKline.close - prevKline.close) / prevKline.close) * 100
              priceChangeRef.current = change
              setUiPriceChange(change)
            }
          }
        }

        // Update signals UI state
        setUiSignals(calculatedSignals.slice(-5)) // Only keep last 5 for UI
      } else {
        console.log('[LUXCHART] ♻️ Data same, skipping update')
      }
    } catch (error) {
      console.error('[LUXCHART] ❌ Fetch error:', error)
      setChartError(true)
    } finally {
      setLoading(false)
    }
  }, []) // EMPTY dependency array - stable reference

  // Fetch data on mount and refresh interval
  useEffect(() => {
    if (!mounted || !isCreatedRef.current) return

    console.log('[LUXCHART] 🚀 Starting data fetch')
    fetchKlines()

    // Clear previous interval
    if (intervalRef.current) {
      clearInterval(intervalRef.current)
    }

    // Refresh every 30 seconds
    intervalRef.current = setInterval(() => {
      console.log('[LUXCHART] 🔄 Scheduled refresh')
      fetchKlines()
    }, 30000)

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current)
        intervalRef.current = null
      }
    }
  }, [mounted, fetchKlines]) // Only depend on mounted and fetchKlines

  // Handle interval change - only refetch, don't recreate chart
  useEffect(() => {
    if (!mounted || !isCreatedRef.current) return

    console.log('[LUXCHART] 📊 Interval changed to:', interval)
    lastDataHashRef.current = null // Force data refresh
    fetchKlines()
  }, [interval]) // Watch interval changes only

  // STATIC RENDER - always render the same DOM structure
  return (
    <div className="w-full bg-gradient-to-br from-[#0f0b18] to-[#1a0f2e] border border-purple-500/20 rounded-xl overflow-hidden">
      {/* Header - ALWAYS rendered */}
      <div className="flex items-center justify-between px-4 py-3 bg-black/20 border-b border-purple-500/10">
        <div className="flex items-center gap-2">
          <Activity className="w-4 h-4 text-purple-400" />
          <span className="text-sm font-semibold text-white">{symbol} ({interval})</span>
        </div>
        {loading ? (
          <Loader2 className="w-4 h-4 text-purple-400 animate-spin" />
        ) : uiPrice !== null ? (
          <div className="flex items-center gap-2">
            <span className="text-lg font-bold text-white">
              {uiPrice.toFixed(2)}
            </span>
            <span className={`text-xs font-medium ${uiPriceChange >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
              {uiPriceChange >= 0 ? '+' : ''}{uiPriceChange.toFixed(2)}%
            </span>
          </div>
        ) : null}
      </div>

      {/* Chart Container - ALWAYS rendered with fixed height */}
      <div
        ref={chartContainerRef}
        className="w-full relative"
        style={{ height: '300px', width: '100%' }}
      >
        {/* Loading overlay - only shown during loading */}
        {loading && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/30 z-20">
            <Loader2 className="w-6 h-6 text-purple-400 animate-spin" />
          </div>
        )}

        {/* Error overlay - only shown on error */}
        {chartError && (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/60 backdrop-blur-sm z-30">
            <Lock className="w-8 h-8 text-red-400 mb-2" />
            <p className="text-sm font-semibold text-white mb-1">Chart Error</p>
            <button
              onClick={() => {
                setChartError(false)
                fetchKlines()
              }}
              className="mt-3 px-3 py-1 bg-purple-500 hover:bg-purple-600 text-white rounded text-xs font-medium transition-colors"
            >
              Retry
            </button>
          </div>
        )}

        {/* Paywall overlay for FREE users - ALWAYS rendered */}
        {!demoMode && !isPro && (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/60 backdrop-blur-sm z-10">
            <Lock className="w-8 h-8 text-purple-400 mb-2" />
            <p className="text-sm font-semibold text-white mb-1">PRO Feature</p>
            <p className="text-xs text-gray-300 text-center px-4">
              Upgrade to see 80% Momentum Signals
            </p>
          </div>
        )}

        {/* Signal markers for PRO users - rendered based on signalsRef */}
        {isPro && !loading && uiSignals.length > 0 && dataRef.current.length > 0 && (
          <div className="absolute inset-0 pointer-events-none z-5">
            {uiSignals.map((signal, idx) => {
              if (!signal?.time) return null

              const dataIndex = dataRef.current.findIndex(d => d?.time === signal.time)
              if (dataIndex === -1 || dataIndex >= dataRef.current.length) return null

              const kline = dataRef.current[dataIndex]
              if (!kline) return null

              const prices = dataRef.current.map(d => d.low).concat(dataRef.current.map(d => d.high))
              const minPrice = Math.min(...prices)
              const maxPrice = Math.max(...prices)
              const priceRange = maxPrice - minPrice || 1
              const pricePercent = (signal.price - minPrice) / priceRange * 100

              const timeIndex = dataRef.current.length > 0 ? dataIndex / dataRef.current.length : 0
              const leftPercent = timeIndex * 100

              return (
                <div
                  key={signal.time}
                  className="absolute flex flex-col items-center"
                  style={{
                    left: `${leftPercent}%`,
                    bottom: `${pricePercent}%`,
                    transform: 'translate(-50%, 50%)',
                  }}
                >
                  <div className={`w-0 h-0 border-l-4 border-r-4 ${
                    signal.type === 'BUY'
                      ? 'border-b-8 border-l-transparent border-r-transparent border-b-emerald-400'
                      : 'border-t-8 border-l-transparent border-r-transparent border-t-red-400'
                  }`} />
                  <div className={`mt-1 px-2 py-0.5 rounded text-[10px] font-bold ${
                    signal.type === 'BUY'
                      ? 'bg-emerald-500 text-white'
                      : 'bg-red-500 text-white'
                  }`}>
                    {signal.type}
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* Latest signal indicator - ALWAYS rendered */}
      {isPro && uiSignals.length > 0 && !loading && (
        <div className="px-4 py-2 bg-black/20 border-t border-purple-500/10">
          <div className="flex items-center justify-center gap-2">
            <span className="text-xs text-gray-400">Latest Signal:</span>
            <div className={`px-2 py-0.5 rounded text-xs font-bold flex items-center gap-1 ${
              uiSignals[uiSignals.length - 1]?.type === 'BUY'
                ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                : 'bg-red-500/20 text-red-400 border border-red-500/30'
            }`}>
              {uiSignals[uiSignals.length - 1]?.type}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
