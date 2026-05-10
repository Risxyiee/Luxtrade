'use client'

import { useEffect, useRef, useState } from 'react'
import { createChart, ColorType, CrosshairMode, LineStyle, IChartApi, ISeriesApi, CandlestickData } from 'lightweight-charts'

interface CandlestickChartProps {
  data: CandlestickData[]
  containerClassName?: string
  chartOptions?: any
  seriesOptions?: any
}

function CandlestickChartInner({
  data,
  containerClassName = '',
  chartOptions = {},
  seriesOptions = {},
}: CandlestickChartProps) {
  const chartContainerRef = useRef<HTMLDivElement>(null)
  const chartRef = useRef<IChartApi | null>(null)
  const seriesRef = useRef<ISeriesApi<'Candlestick'> | null>(null)
  const handleResizeRef = useRef<(() => void) | null>(null)
  const [mounted, setMounted] = useState(false)
  const [chartReady, setChartReady] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Mount tracking
  useEffect(() => {
    console.log('[CandlestickChart] Component mounting...')
    setMounted(true)
    return () => {
      console.log('[CandlestickChart] Component unmounting')
      setMounted(false)
    }
  }, [])

  // Create chart and series
  useEffect(() => {
    if (!mounted || !chartContainerRef.current) {
      console.log('[CandlestickChart] Skipping chart creation', { mounted, hasContainer: !!chartContainerRef.current })
      return
    }

    const container = chartContainerRef.current

    // Small delay to ensure container has dimensions
    const timeoutId = setTimeout(() => {
      if (!container.clientWidth || container.clientWidth < 100) {
        console.warn('[CandlestickChart] Container width not ready')
        setError('Container not ready. Please reload the page.')
        return
      }

      try {
        console.log('[CandlestickChart] Creating chart...')

        // Create chart instance
        const chart = createChart(container, {
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
        const series = chart.addCandlestickSeries({
          upColor: '#10b981',
          downColor: '#ef4444',
          borderDownColor: '#ef4444',
          borderUpColor: '#10b981',
          wickDownColor: '#ef4444',
          wickUpColor: '#10b981',
          ...seriesOptions
        })

        seriesRef.current = series
        console.log('[CandlestickChart] ✅ Chart created successfully')
        setChartReady(true)

        // Handle resize
        const handleResize = () => {
          if (chartRef.current && chartContainerRef.current) {
            const newWidth = chartContainerRef.current.clientWidth || 800
            chartRef.current.applyOptions({ width: newWidth, height: 400 })
          }
        }

        handleResizeRef.current = handleResize
        window.addEventListener('resize', handleResize)

      } catch (err) {
        console.error('[CandlestickChart] ❌ Error creating chart:', err)
        setError(err instanceof Error ? err.message : String(err))
      }
    }, 100)

    // Cleanup
    return () => {
      clearTimeout(timeoutId)
      console.log('[CandlestickChart] Cleanup...')
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
      setChartReady(false)
    }
  }, [mounted, chartOptions, seriesOptions])

  // Update data when it changes
  useEffect(() => {
    if (!mounted || !seriesRef.current) {
      console.log('[CandlestickChart] Skipping data update', { mounted, hasSeries: !!seriesRef.current })
      return
    }

    console.log('[CandlestickChart] Updating chart data...')

    if (!data || data.length === 0) {
      console.warn('[CandlestickChart] No data to update')
      return
    }

    try {
      const validData = data.filter((kline: CandlestickData) => {
        return (
          typeof kline.time === 'number' && kline.time > 0 &&
          typeof kline.open === 'number' && kline.open > 0 &&
          typeof kline.high === 'number' && kline.high > 0 &&
          typeof kline.low === 'number' && kline.low > 0 &&
          typeof kline.close === 'number' && kline.close > 0 &&
          kline.high >= kline.low
        )
      }).sort((a, b) => a.time - b.time)

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
  }, [mounted, data])

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
      {!chartReady && !error && (
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
          <p className="mb-2 font-semibold">Chart Error</p>
          <p className="text-sm text-white/60">{error}</p>
          <button
            onClick={() => window.location.reload()}
            className="mt-3 px-4 py-2 bg-purple-500 hover:bg-purple-600 text-white rounded text-sm"
          >
            Reload Page
          </button>
        </div>
      )}
    </div>
  )
}

export default function CandlestickChart(props: CandlestickChartProps) {
  return <CandlestickChartInner {...props} />
}
