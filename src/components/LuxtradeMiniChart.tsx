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
  interval?: string
}

export default function LuxtradeMiniChart({ isPro, demoMode = false, interval = '15m' }: LuxtradeMiniChartProps) {
  const chartContainerRef = useRef<HTMLDivElement>(null)
  const chartRef = useRef<IChartApi<'UTCTimestamp'> | null>(null)
  const seriesRef = useRef<ISeriesApi<'UTCTimestamp', KlineData> | null>(null)
  const resizeObserverRef = useRef<ResizeObserver | null>(null)
  const [mounted, setMounted] = useState(false)

  const [data, setData] = useState<KlineData[]>([])
  const [signals, setSignals] = useState<Signal[]>([])
  const [loading, setLoading] = useState(true)
  const [currentPrice, setCurrentPrice] = useState<number | null>(null)
  const [priceChange, setPriceChange] = useState(0)
  const [chartError, setChartError] = useState(false)

  const symbol = 'BTCUSDT' // Changed from XAUUSD (not supported by Binance)

  // Component mount guard
  useEffect(() => {
    setMounted(true)
    return () => {
      setMounted(false)
    }
  }, [])

  // Fetch klines and calculate indicators
  const fetchKlines = useCallback(async () => {
    if (!mounted) return

    setLoading(true)
    setChartError(false)

    try {
      const res = await fetch(`/api/chart/klines?symbol=${symbol}&interval=${interval}&limit=100`)
      if (!res.ok) throw new Error('Failed to fetch klines')

      const klines = await res.json()

      // Null/undefined check before processing
      if (!klines || !Array.isArray(klines) || klines.length === 0) {
        console.error('Invalid or empty klines data')
        return
      }

      const klineData: KlineData[] = klines
        .map((k: any) => ({
          time: k?.time ?? 0,
          open: k?.open ?? 0,
          high: k?.high ?? 0,
          low: k?.low ?? 0,
          close: k?.close ?? 0,
        }))
        .filter((kline) => {
          // Filter invalid data: time must be positive, high >= low, all values must be numbers
          return (
            typeof kline.time === 'number' && kline.time > 0 &&
            typeof kline.open === 'number' && kline.open > 0 &&
            typeof kline.high === 'number' && kline.high > 0 &&
            typeof kline.low === 'number' && kline.low > 0 &&
            typeof kline.close === 'number' && kline.close > 0 &&
            kline.high >= kline.low
          )
        })
        .sort((a, b) => a.time - b.time) // Ensure ascending order

      // Check if data is valid after filtering
      if (!klineData || klineData.length === 0) {
        console.error('No valid kline data after filtering')
        setChartError(true)
        return
      }

      // Calculate 80% momentum indicators - wrapped in separate try-catch
      let calculatedSignals: Signal[] = []
      try {
        for (let i = 2; i < klineData.length; i++) {
          const current = klineData[i]
          const prev1 = klineData[i - 1]
          const prev2 = klineData[i - 2]

          // Null check for kline data
          if (!current || !prev1 || !prev2) continue

          const lookbackHigh = Math.max(prev1.high ?? 0, prev2.high ?? 0)
          const lookbackLow = Math.min(prev1.low ?? Infinity, prev2.low ?? Infinity)
          const range = (current.high ?? 0) - (current.low ?? 0)

          if (range > 0) {
            const bodyPercent = Math.abs((current.close ?? 0) - (current.open ?? 0)) / range * 100

            // BUY Signal: Close > lookbackHigh, body >= 80%, and bullish
            if (
              (current.close ?? 0) > lookbackHigh &&
              bodyPercent >= 80 &&
              (current.close ?? 0) > (current.open ?? 0)
            ) {
              calculatedSignals.push({
                time: current.time ?? 0,
                type: 'BUY',
                price: current.close ?? 0,
              })
            }

            // SELL Signal: Close < lookbackLow, body >= 80%, and bearish
            if (
              (current.close ?? 0) < lookbackLow &&
              bodyPercent >= 80 &&
              (current.close ?? 0) < (current.open ?? 0)
            ) {
              calculatedSignals.push({
                time: current.time ?? 0,
                type: 'SELL',
                price: current.close ?? 0,
              })
            }
          }
        }
      } catch (indicatorError) {
        console.error('Error calculating indicators:', indicatorError)
        // Set empty signals on indicator calculation error
        calculatedSignals = []
      }

      setData(klineData)
      setSignals(calculatedSignals)

      // Set current price with null check - wrapped in separate try-catch
      try {
        const lastKline = klineData[klineData.length - 1]
        if (lastKline?.close !== undefined && lastKline?.close !== null) {
          setCurrentPrice(lastKline.close)
          if (klineData.length > 1) {
            const prevKline = klineData[klineData.length - 2]
            if (prevKline?.close !== undefined && prevKline?.close !== null && prevKline.close !== 0) {
              setPriceChange(((lastKline.close - prevKline.close) / prevKline.close) * 100)
            }
          }
        }
      } catch (priceError) {
        console.error('Error setting price:', priceError)
      }
    } catch (error) {
      console.error('Failed to fetch klines:', error)
      setChartError(true)
    } finally {
      setLoading(false)
    }
  }, [symbol, interval, mounted])

  // Initialize chart - only after mounted
  useEffect(() => {
    if (!mounted) return

    let chart: IChartApi<'UTCTimestamp'> | null = null
    let series: ISeriesApi<'UTCTimestamp', KlineData> | null = null

    try {
      // Additional check before creating chart
      const container = chartContainerRef.current
      if (!container) {
        console.warn('[LuxtradeMiniChart] Chart container ref is null')
        return
      }

      if (!container.clientWidth || !container.clientHeight) {
        console.warn('[LuxtradeMiniChart] Chart container has no dimensions', {
          width: container.clientWidth,
          height: container.clientHeight
        })
        return
      }

      // Create chart with auto-scaling
      console.log('[LuxtradeMiniChart] Creating chart with dimensions:', {
        width: container.clientWidth,
        height: 200
      })

      chart = createChart(container, {
        width: container.clientWidth,
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
      console.log('[LuxtradeMiniChart] Adding candlestick series...')
      if (!chart || typeof chart.addCandlestickSeries !== 'function') {
        throw new Error('lightweight-charts library not properly loaded or addCandlestickSeries is not available')
      }

      series = chart.addCandlestickSeries({
        upColor: '#22c55e',
        downColor: '#ef4444',
        borderVisible: false,
        wickUpColor: '#22c55e',
        wickDownColor: '#ef4444',
      })

      chartRef.current = chart
      seriesRef.current = series

      // Setup resize observer with additional checks
      resizeObserverRef.current = new ResizeObserver((entries) => {
        try {
          if (entries.length === 0 || entries[0].target !== chartContainerRef.current) {
            return
          }
          if (!chartRef.current) {
            console.warn('Chart ref not available in resize observer')
            return
          }
          const newRect = entries[0].contentRect
          chartRef.current.applyOptions({
            width: newRect.width,
            height: 200,
          })
        } catch (resizeError) {
          console.error('Error in resize observer:', resizeError)
        }
      })

      if (container) {
        resizeObserverRef.current.observe(container)
      }
    } catch (chartInitError) {
      console.error('Error initializing chart:', chartInitError)
      setChartError(true)
    }

    return () => {
      // Cleanup: disconnect resize observer
      if (resizeObserverRef.current) {
        try {
          resizeObserverRef.current.disconnect()
          resizeObserverRef.current = null
        } catch (e) {
          console.error('Error disconnecting resize observer:', e)
        }
      }

      // Cleanup: remove chart
      if (chart) {
        try {
          chart.remove()
        } catch (e) {
          console.error('Error removing chart:', e)
        }
        chart = null
      }

      if (chartRef.current) {
        chartRef.current = null
      }
      if (seriesRef.current) {
        seriesRef.current = null
      }
    }
  }, [mounted])

  // Update data when fetched - only after mounted
  useEffect(() => {
    if (!mounted || !seriesRef.current || data?.length === 0) return

    try {
      console.log('[LuxtradeMiniChart] Setting data:', data.length, 'candles')

      // Validate data before setting
      const validData = data.filter(kline => {
        return (
          typeof kline.time === 'number' && kline.time > 0 &&
          typeof kline.open === 'number' && kline.open > 0 &&
          typeof kline.high === 'number' && kline.high > 0 &&
          typeof kline.low === 'number' && kline.low > 0 &&
          typeof kline.close === 'number' && kline.close > 0 &&
          kline.high >= kline.low
        )
      })

      if (validData.length === 0) {
        console.error('[LuxtradeMiniChart] No valid data after filtering')
        return
      }

      seriesRef.current.setData(validData)
      console.log('[LuxtradeMiniChart] Data set successfully')
    } catch (error) {
      console.error('[LuxtradeMiniChart] Failed to update chart data:', error)
      setChartError(true)
    }
  }, [data, mounted])

  // Fetch data on mount and refresh - only after mounted
  useEffect(() => {
    if (!mounted) return

    fetchKlines()

    // Refresh every 30 seconds
    const intervalId = setInterval(fetchKlines, 30000)

    return () => clearInterval(intervalId)
  }, [fetchKlines, mounted])

  // Return early if not mounted
  if (!mounted) {
    return (
      <div className="w-full bg-gradient-to-br from-[#0f0b18] to-[#1a0f2e] border border-purple-500/20 rounded-xl overflow-hidden h-[272px]">
        <div className="flex items-center justify-center h-full">
          <Loader2 className="w-6 h-6 text-purple-400 animate-spin" />
        </div>
      </div>
    )
  }

  // Error state fallback
  if (chartError) {
    return (
      <div className="w-full bg-gradient-to-br from-[#0f0b18] to-[#1a0f2e] border border-red-500/20 rounded-xl overflow-hidden h-[272px]">
        <div className="flex flex-col items-center justify-center h-full p-6 text-center">
          <Lock className="w-8 h-8 text-red-400 mb-2" />
          <p className="text-sm font-semibold text-white mb-1">Chart Error</p>
          <p className="text-xs text-gray-300">
            Unable to load trading chart
          </p>
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
      </div>
    )
  }

  return (
    <div className="w-full bg-gradient-to-br from-[#0f0b18] to-[#1a0f2e] border border-purple-500/20 rounded-xl overflow-hidden" suppressHydrationWarning={true}>
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 bg-black/20 border-b border-purple-500/10">
        <div className="flex items-center gap-2">
          <Activity className="w-4 h-4 text-purple-400" />
          <span className="text-sm font-semibold text-white">BTC/USD ({interval})</span>
        </div>
        {loading ? (
          <Loader2 className="w-4 h-4 text-purple-400 animate-spin" />
        ) : currentPrice !== null && (
          <div className="flex items-center gap-2">
            <span className="text-lg font-bold text-white">
              {currentPrice ? currentPrice.toFixed(2) : '---'}
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
        {isPro && signals?.length > 0 && !loading && data?.length > 0 && (
          <div className="absolute inset-0 pointer-events-none">
            {signals.slice(-5).map((signal, idx) => {
              if (!signal?.time) return null

              const dataIndex = data.findIndex(d => d?.time === signal.time)
              if (dataIndex === -1 || dataIndex >= data.length) return null

              const kline = data[dataIndex]
              if (!kline) return null

              const prices = data.map(d => d?.low ?? 0).concat(data.map(d => d?.high ?? 0))
              const minPrice = Math.min(...prices)
              const maxPrice = Math.max(...prices)
              const priceRange = maxPrice - minPrice || 1
              const pricePercent = ((signal.price ?? 0) - minPrice) / priceRange * 100

              const timeIndex = data.length > 0 ? dataIndex / data.length : 0
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
      {isPro && signals?.length > 0 && !loading && (
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
