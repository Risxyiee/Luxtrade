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
  const isCreatedRef = useRef(false)  // Prevent recreation

  // Mount only once
  useEffect(() => {
    setMounted(true)
  }, [])

  // Create chart ONCE - empty dependency array
  useEffect(() => {
    if (!mounted || isCreatedRef.current) return

    const container = chartContainerRef.current
    if (!container) {
      console.warn('[CandlestickChart] Container ref is null')
      return
    }

    if (!container.clientWidth) {
      console.warn('[CandlestickChart] Container has no width, waiting...')
      const timeout = setTimeout(() => {
        console.log('[CandlestickChart] Retrying chart creation...')
      }, 100)
      return () => clearTimeout(timeout)
    }

    let chart: IChartApi<'UTCTimestamp'> | null = null
    let series: ISeriesApi<'UTCTimestamp', CandlestickData> | null = null

    try {
      console.log('[CandlestickChart] Creating chart with dimensions:', {
        width: container.clientWidth,
        height: 400
      })

      // Check if lightweight-charts is loaded
      if (typeof createChart !== 'function') {
        throw new Error('lightweight-charts library not properly loaded')
      }

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
            color: 'rgba(255, 255, 255, 0.05)',
            style: LineStyle.Dotted,
          },
          horzLines: {
            color: 'rgba(255, 255, 255, 0.05)',
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

      console.log('[CandlestickChart] ✅ Chart created successfully')

      // Handle resize
      const handleResize = () => {
        if (chartRef.current && container) {
          const newWidth = container.clientWidth || 800
          chartRef.current.applyOptions({ width: newWidth, height: 400 })
        }
      }

      handleResizeRef.current = handleResize
      window.addEventListener('resize', handleResize)
    } catch (error) {
      console.error('[CandlestickChart] ❌ Error creating chart:', error)
    }

    return () => {
      if (handleResizeRef.current) {
        window.removeEventListener('resize', handleResizeRef.current)
        handleResizeRef.current = null
      }
      if (chart) {
        try {
          chart.remove()
        } catch (e) {
          console.error('[CandlestickChart] Error removing chart:', e)
        }
        chart = null
      }
      if (chartRef.current) {
        chartRef.current = null
      }
      if (seriesRef.current) {
        seriesRef.current = null
      }
      isCreatedRef.current = false
    }
  }, [mounted, chartOptions, seriesOptions]) // Only recreate on mount or options change, NOT on data change

  // Update data when it changes - separate effect
  useEffect(() => {
    if (!mounted || !isCreatedRef.current || !seriesRef.current) {
      console.log('[CandlestickChart] Skipping data update - chart not ready')
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
        return
      }

      seriesRef.current.setData(validData)
      console.log(`✅ [CandlestickChart] Chart updated with ${validData.length} candles`)
    } catch (error) {
      console.error('[CandlestickChart] ❌ Error updating chart data:', error)
    }
  }, [mounted, data]) // Only update when data changes

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
      {/* Debug info */}
      {!seriesRef.current && mounted && (
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
    </div>
  )
}
