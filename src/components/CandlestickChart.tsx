'use client'

import { useEffect, useRef, useState } from 'react'
import { createChart, ColorType, CrosshairMode, LineStyle, IChartApi, ISeriesApi } from 'lightweight-charts'

interface CandlestickData {
  time: number | string
  open: number
  high: number
  low: number
  close: number
}

interface CandlestickChartProps {
  data: CandlestickData[]
  containerClassName?: string
  chartOptions?: any
  seriesOptions?: any
}

export default function CandlestickChart({
  data,
  containerClassName = '',
  chartOptions = {},
  seriesOptions = {},
}: CandlestickChartProps) {
  const chartContainerRef = useRef<HTMLDivElement>(null)
  const chartRef = useRef<IChartApi<'UTCTimestamp'> | null>(null)
  const seriesRef = useRef<ISeriesApi<'UTCTimestamp', CandlestickData> | null>(null)
  const handleResizeRef = useRef<(() => void) | null>(null)
  const [mounted, setMounted] = useState(false)
  const [chartCreated, setChartCreated] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const isCreatedRef = useRef(false)  // Prevent recreation

  // Mount only once
  useEffect(() => {
    console.log('[CandlestickChart] Component mounting...')
    setMounted(true)
  }, [])

  // Create chart ONCE - with retry logic
  useEffect(() => {
    if (!mounted || isCreatedRef.current) return

    let retryCount = 0
    const maxRetries = 3

    const createChartWithRetry = () => {
      const container = chartContainerRef.current
      if (!container) {
        console.warn('[CandlestickChart] Container ref is null')
        return
      }

      console.log('[CandlestickChart] Attempting to create chart...', {
        retryCount,
        clientWidth: container.clientWidth,
        clientHeight: container.clientHeight,
        offsetWidth: container.offsetWidth,
        offsetHeight: container.offsetHeight,
      })

      if (!container.clientWidth || container.clientWidth < 100) {
        console.warn('[CandlestickChart] Container width too small, retrying...')
        if (retryCount < maxRetries) {
          retryCount++
          setTimeout(createChartWithRetry, 500)
        } else {
          setError('Container width not available after multiple retries')
        }
        return
      }

      let chart: IChartApi<'UTCTimestamp'> | null = null
      let series: ISeriesApi<'UTCTimestamp', CandlestickData> | null = null

      try {
        // Check if lightweight-charts is loaded
        if (typeof createChart !== 'function') {
          throw new Error('lightweight-charts library not properly loaded')
        }

        console.log('[CandlestickChart] Creating chart with dimensions:', {
          width: container.clientWidth,
          height: 400
        })

        // Create chart
        chart = createChart(container, {
          width: container.clientWidth,
          height: 400,
          layout: {
            background: { type: ColorType.Solid, color: 'transparent' },
            textColor: '#ffffff',
          },
          grid: {
            vertLines: {
              color: 'rgba(255,255,255, 0.05)',
              style: LineStyle.Dotted,
            },
            horzLines: {
              color: 'rgba(255,255,255, 0.05)',
              style: LineStyle.Dotted,
            },
          },
          crosshair: {
            mode: CrosshairMode.Normal,
            vertLine: {
              color: 'rgba(224, 227, 235, 0.1)',
              width: 1,
              style: LineStyle.Dashed,
              labelBackgroundColor: '#1f2937',
            },
            horzLine: {
              color: 'rgba(224, 227, 235, 0.1)',
              width: 1,
              style: LineStyle.Dashed,
              labelBackgroundColor: '#1f2937',
            },
          },
          rightPriceScale: {
            borderColor: 'rgba(255, 255, 255, 0.1)',
          },
          timeScale: {
            borderColor: 'rgba(255, 255, 255, 0.1)',
            timeVisible: true,
            secondsVisible: false,
          },
          handleScroll: true,
          handleScale: true,
          ...chartOptions
        })

        chartRef.current = chart
        console.log('[CandlestickChart] Chart instance created')

        // Add candlestick series
        console.log('[CandlestickChart] Adding candlestick series...')
        if (!chart || typeof chart.addCandlestickSeries !== 'function') {
          throw new Error('lightweight-charts library not properly loaded or addCandlestickSeries is not available')
        }

        series = chart.addCandlestickSeries({
          upColor: '#10b981',
          downColor: '#ef4444',
          borderDownColor: '#ef4444',
          borderUpColor: '#10b981',
          wickDownColor: '#ef4444',
          wickUpColor: '#10b981',
          ...seriesOptions
        })

        seriesRef.current = series
        isCreatedRef.current = true
        setChartCreated(true)
        console.log('[CandlestickChart] ✅ Chart created successfully')

        // Handle resize
        const handleResize = () => {
          if (chartRef.current && container) {
            const newWidth = container.clientWidth || 800
            console.log('[CandlestickChart] Resizing chart to:', newWidth)
            chartRef.current.applyOptions({ width: newWidth, height: 400 })
          }
        }

        handleResizeRef.current = handleResize
        window.addEventListener('resize', handleResize)

      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : String(err)
        console.error('[CandlestickChart] ❌ Error creating chart:', err)
        setError(errorMessage)
      }
    }

    // Start creation with a small delay
    const timeoutId = setTimeout(createChartWithRetry, 100)

    return () => {
      clearTimeout(timeoutId)
      if (handleResizeRef.current) {
        window.removeEventListener('resize', handleResizeRef.current)
        handleResizeRef.current = null
      }
      if (chartRef.current) {
        try {
          chartRef.current.remove()
          console.log('[CandlestickChart] Chart removed')
        } catch (e) {
          console.error('[CandlestickChart] Error removing chart:', e)
        }
        chartRef.current = null
      }
      if (seriesRef.current) {
        seriesRef.current = null
      }
      isCreatedRef.current = false
      setChartCreated(false)
    }
  }, [mounted, chartOptions, seriesOptions]) // Only recreate on mount or options change, NOT on data change

  // Update data when it changes - separate effect
  useEffect(() => {
    if (!mounted || !chartCreated || !seriesRef.current) {
      console.log('[CandlestickChart] Skipping data update - chart not ready', {
        mounted,
        chartCreated,
        hasSeries: !!seriesRef.current
      })
      return
    }

    console.log('[CandlestickChart] Updating chart data...')

    if (!data || data.length === 0) {
      console.warn('[CandlestickChart] No data to update')
      return
    }

    try {
      // Validate and set data
      console.log('[CandlestickChart] Validating and setting data:', data.length, 'candles')

      const validData = data.filter((kline: any) => {
        return (
          typeof kline.time === 'number' && kline.time > 0 &&
          typeof kline.open === 'number' && kline.open > 0 &&
          typeof kline.high === 'number' && kline.high > 0 &&
          typeof kline.low === 'number' && kline.low > 0 &&
          typeof kline.close === 'number' && kline.close > 0 &&
          kline.high >= kline.low
        )
      }).sort((a, b) => a.time - b.time) // Ensure ascending order

      if (validData.length === 0) {
        console.error('[CandlestickChart] No valid data after filtering')
        setError('No valid data available')
        return
      }

      seriesRef.current.setData(validData)
      console.log(`✅ [CandlestickChart] Chart updated with ${validData.length} candles`)
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : String(err)
      console.error('[CandlestickChart] ❌ Error updating chart data:', err)
      setError(errorMessage)
    }
  }, [mounted, chartCreated, data]) // Only update when data changes

  if (!mounted) {
    return (
      <div className={containerClassName} style={{ height: '400px', minHeight: '400px' }} suppressHydrationWarning={true}>
        <div className="flex items-center justify-center h-full">
          <div className="w-6 h-6 border-2 border-purple-400 border-t-transparent rounded-full animate-spin" />
        </div>
      </div>
    )
  }

  return (
    <div
      ref={chartContainerRef}
      className={containerClassName}
      style={{
        height: '400px',
        minHeight: '400px',
        backgroundColor: '#0a0712',
        position: 'relative'
      }}
      suppressHydrationWarning={true}
    >
      {/* Loading state */}
      {!chartCreated && !error && (
        <div style={{
          position: 'absolute',
          top: '50%',
          left: '50%',
          transform: 'translate(-50%, -50%)',
          textAlign: 'center',
          color: '#9ca3af',
          padding: '20px'
        }}>
          <div className="w-8 h-8 border-2 border-purple-400 border-t-transparent rounded-full animate-spin mx-auto mb-2" />
          <p>Initializing chart...</p>
        </div>
      )}

      {/* Error state */}
      {error && (
        <div style={{
          position: 'absolute',
          top: '50%',
          left: '50%',
          transform: 'translate(-50%, -50%)',
          textAlign: 'center',
          color: '#ef4444',
          padding: '20px',
          maxWidth: '80%'
        }}>
          <p className="mb-2">Error initializing chart</p>
          <p className="text-sm text-white/60">{error}</p>
        </div>
      )}
    </div>
  )
}
