'use client'

import { useEffect, useRef, useState, useCallback } from 'react'
import { createChart, ColorType, CrosshairMode, LineStyle, IChartApi, ISeriesApi, MouseEventParams, Time } from 'lightweight-charts'
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
}

export default function LuxtradeMiniChart({ isPro, demoMode = false }: LuxtradeMiniChartProps) {
  const chartContainerRef = useRef<HTMLDivElement>(null)
  const chartRef = useRef<IChartApi<'UTCTimestamp'> | null>(null)
  const seriesRef = useRef<ISeriesApi<'UTCTimestamp', KlineData> | null>(null)
  const resizeObserverRef = useRef<ResizeObserver | null>(null)

  const [data, setData] = useState<KlineData[]>([])
  const [signals, setSignals] = useState<Signal[]>([])
  const [loading, setLoading] = useState(true)
  const [currentPrice, setCurrentPrice] = useState<number | null>(null)
  const [priceChange, setPriceChange] = useState(0)

  const symbol = 'XAUUSD'
  const interval = '1h'

  // Fetch klines and calculate indicators
  const fetchKlines = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch(`/api/chart/klines?symbol=${symbol}&interval=${interval}&limit=100`)
      if (!res.ok) throw new Error('Failed to fetch klines')

      const klines = await res.json()

      if (klines && klines.length > 0) {
        const klineData: KlineData[] = klines.map((k: any) => ({
          time: k.time,
          open: k.open,
          high: k.high,
          low: k.low,
          close: k.close,
        }))

        // Calculate 80% momentum indicators
        const calculatedSignals: Signal[] = []
        for (let i = 2; i < klineData.length; i++) {
          const current = klineData[i]
          const prev1 = klineData[i - 1]
          const prev2 = klineData[i - 2]

          const lookbackHigh = Math.max(prev1.high, prev2.high)
          const lookbackLow = Math.min(prev1.low, prev2.low)
          const range = current.high - current.low

          if (range > 0) {
            const bodyPercent = Math.abs(current.close - current.open) / range * 100

            // BUY Signal: Close > lookbackHigh, body >= 80%, and bullish
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

            // SELL Signal: Close < lookbackLow, body >= 80%, and bearish
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

        setData(klineData)
        setSignals(calculatedSignals)

        // Set current price
        const lastKline = klineData[klineData.length - 1]
        setCurrentPrice(lastKline.close)
        if (klineData.length > 1) {
          const prevPrice = klineData[klineData.length - 2].close
          setPriceChange(((lastKline.close - prevPrice) / prevPrice) * 100)
        }
      }
    } catch (error) {
      console.error('Failed to fetch klines:', error)
    } finally {
      setLoading(false)
    }
  }, [symbol, interval])

  // Initialize chart
  useEffect(() => {
    if (!chartContainerRef.current) return

    // Create chart with auto-scaling
    const chart = createChart(chartContainerRef.current, {
      width: chartContainerRef.current.clientWidth,
      height: 200,
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

    // Add candlestick series
    const series = chart.addCandlestickSeries({
      upColor: '#22c55e',
      downColor: '#ef4444',
      borderVisible: false,
      wickUpColor: '#22c55e',
      wickDownColor: '#ef4444',
    })

    chartRef.current = chart
    seriesRef.current = series

    // Setup resize observer
    resizeObserverRef.current = new ResizeObserver((entries) => {
      if (entries.length === 0 || entries[0].target !== chartContainerRef.current) {
        return
      }
      const newRect = entries[0].contentRect
      chart.applyOptions({
        width: newRect.width,
        height: 200,
      })
    })

    resizeObserverRef.current.observe(chartContainerRef.current)

    return () => {
      if (resizeObserverRef.current) {
        resizeObserverRef.current.disconnect()
      }
      if (chartRef.current) {
        chartRef.current.remove()
      }
    }
  }, [])

  // Update data when fetched
  useEffect(() => {
    if (seriesRef.current && data.length > 0) {
      seriesRef.current.setData(data)
    }
  }, [data])

  // Fetch data on mount and refresh
  useEffect(() => {
    fetchKlines()

    // Refresh every 30 seconds
    const intervalId = setInterval(fetchKlines, 30000)

    return () => clearInterval(intervalId)
  }, [fetchKlines])

  return (
    <div className="w-full bg-gradient-to-br from-[#0f0b18] to-[#1a0f2e] border border-purple-500/20 rounded-xl overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 bg-black/20 border-b border-purple-500/10">
        <div className="flex items-center gap-2">
          <Activity className="w-4 h-4 text-purple-400" />
          <span className="text-sm font-semibold text-white">XAU/USD</span>
        </div>
        {loading ? (
          <Loader2 className="w-4 h-4 text-purple-400 animate-spin" />
        ) : currentPrice !== null && (
          <div className="flex items-center gap-2">
            <span className="text-lg font-bold text-white">
              {currentPrice.toFixed(2)}
            </span>
            <span className={`text-xs font-medium ${priceChange >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
              {priceChange >= 0 ? '+' : ''}{priceChange.toFixed(2)}%
            </span>
          </div>
        )}
      </div>

      {/* Chart Container */}
      <div ref={chartContainerRef} className="w-full h-[200px] relative">
        {loading && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/30">
            <Loader2 className="w-6 h-6 text-purple-400 animate-spin" />
          </div>
        )}

        {/* Paywall overlay for FREE users */}
        {!demoMode && !isPro && (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/60 backdrop-blur-sm z-10">
            <Lock className="w-8 h-8 text-purple-400 mb-2" />
            <p className="text-sm font-semibold text-white mb-1">PRO Feature</p>
            <p className="text-xs text-gray-300 text-center px-4">
              Upgrade to see 80% Momentum Signals
            </p>
          </div>
        )}

        {/* Signal markers for PRO users */}
        {isPro && signals.length > 0 && !loading && (
          <div className="absolute inset-0 pointer-events-none">
            {signals.slice(-5).map((signal, idx) => {
              const dataIndex = data.findIndex(d => d.time === signal.time)
              if (dataIndex === -1) return null

              const kline = data[dataIndex]
              const prices = data.map(d => d.low).concat(data.map(d => d.high))
              const minPrice = Math.min(...prices)
              const maxPrice = Math.max(...prices)
              const priceRange = maxPrice - minPrice || 1
              const pricePercent = ((signal.price - minPrice) / priceRange) * 100

              const timeIndex = dataIndex / data.length
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

      {/* Latest signal indicator */}
      {isPro && signals.length > 0 && !loading && (
        <div className="px-4 py-2 bg-black/20 border-t border-purple-500/10">
          <div className="flex items-center justify-center gap-2">
            <span className="text-xs text-gray-400">Latest Signal:</span>
            <div className={`px-2 py-0.5 rounded text-xs font-bold flex items-center gap-1 ${
              signals[signals.length - 1]?.type === 'BUY'
                ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                : 'bg-red-500/20 text-red-400 border border-red-500/30'
            }`}>
              {signals[signals.length - 1]?.type}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
