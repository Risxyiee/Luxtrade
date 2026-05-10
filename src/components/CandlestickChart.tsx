'use client'

import { useEffect, useRef, useState } from 'react'
import dynamic from 'next/dynamic'

// Dynamically import the entire chart module with SSR disabled
const LightweightCharts = dynamic(() => import('lightweight-charts'), {
  ssr: false,
  loading: () => (
    <div className="flex items-center justify-center" style={{ height: '400px' }}>
      <div className="w-8 h-8 border-2 border-purple-400 border-t-transparent rounded-full animate-spin" />
    </div>
  )
})

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

function CandlestickChartInner({
  data,
  containerClassName = '',
  chartOptions = {},
  seriesOptions = {},
}: CandlestickChartProps) {
  const chartContainerRef = useRef<HTMLDivElement>(null)
  const chartRef = useRef<any>(null)
  const seriesRef = useRef<any>(null)
  const handleResizeRef = useRef<(() => void) | null>(null)
  const [mounted, setMounted] = useState(false)
  const [chartCreated, setChartCreated] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [libLoaded, setLibLoaded] = useState(false)
  const isCreatedRef = useRef(false)

  // Mount tracking
  useEffect(() => {
    console.log('[CandlestickChartInner] Component mounting...')
    setMounted(true)
    return () => {
      console.log('[CandlestickChartInner] Component unmounting')
      setMounted(false)
    }
  }, [])

  // Mark library as loaded
  useEffect(() => {
    if (mounted) {
      console.log('[CandlestickChartInner] Library loaded')
      setLibLoaded(true)
    }
  }, [mounted])

  // Create chart
  useEffect(() => {
    if (!mounted || !libLoaded || isCreatedRef.current) {
      console.log('[CandlestickChartInner] Skipping chart creation', {
        mounted,
        libLoaded,
        isCreated: isCreatedRef.current
      })
      return
    }

    const container = chartContainerRef.current
    if (!container) {
      console.warn('[CandlestickChartInner] Container ref is null')
      return
    }

    // Wait for container to have dimensions
    const checkContainer = () => {
      if (!chartContainerRef.current) return

      const width = chartContainerRef.current.clientWidth
      const height = chartContainerRef.current.clientHeight

      console.log('[CandlestickChartInner] Container dimensions:', { width, height })

      if (!width || width < 100) {
        console.warn('[CandlestickChartInner] Container width not ready, retrying...')
        setTimeout(checkContainer, 100)
        return
      }

      createChartInstance()
    }

    // Small delay to ensure layout is complete
    setTimeout(checkContainer, 100)

    function createChartInstance() {
      const container = chartContainerRef.current
      if (!container || isCreatedRef.current) return

      let chart: any = null
      let series: any = null

      try {
        // Import lightweight-charts dynamically
        import('lightweight-charts').then((lw) => {
          console.log('[CandlestickChartInner] lightweight-charts module loaded:', Object.keys(lw))

          const { createChart, ColorType, CrosshairMode, LineStyle } = lw

          console.log('[CandlestickChartInner] Creating chart instance...')

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
          console.log('[CandlestickChartInner] Chart instance created:', !!chart)
          console.log('[CandlestickChartInner] Chart methods:', Object.getOwnPropertyNames(Object.getPrototypeOf(chart)))

          // Check for addCandlestickSeries
          if (typeof chart.addCandlestickSeries !== 'function') {
            console.error('[CandlestickChartInner] addCandlestickSeries not found!')
            console.log('[CandlestickChartInner] Available methods:', Object.keys(chart))
            throw new Error('addCandlestickSeries is not available on chart instance')
          }

          console.log('[CandlestickChartInner] Adding candlestick series...')

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
          console.log('[CandlestickChartInner] ✅ Chart created successfully')

          // Handle resize
          const handleResize = () => {
            if (chartRef.current && chartContainerRef.current) {
              const newWidth = chartContainerRef.current.clientWidth || 800
              chartRef.current.applyOptions({ width: newWidth, height: 400 })
            }
          }

          handleResizeRef.current = handleResize
          window.addEventListener('resize', handleResize)
        }).catch((err) => {
          console.error('[CandlestickChartInner] ❌ Error loading lightweight-charts:', err)
          setError(err instanceof Error ? err.message : String(err))
        })
      } catch (err) {
        console.error('[CandlestickChartInner] ❌ Error in chart creation:', err)
        setError(err instanceof Error ? err.message : String(err))
      }
    }

    return () => {
      console.log('[CandlestickChartInner] Cleanup...')
      if (handleResizeRef.current) {
        window.removeEventListener('resize', handleResizeRef.current)
        handleResizeRef.current = null
      }
      if (chartRef.current) {
        try {
          chartRef.current.remove()
          console.log('[CandlestickChartInner] Chart removed')
        } catch (e) {
          console.error('[CandlestickChartInner] Error removing chart:', e)
        }
        chartRef.current = null
      }
      if (seriesRef.current) {
        seriesRef.current = null
      }
      isCreatedRef.current = false
      setChartCreated(false)
    }
  }, [mounted, libLoaded, chartOptions, seriesOptions])

  // Update data when it changes
  useEffect(() => {
    if (!mounted || !chartCreated || !seriesRef.current) {
      console.log('[CandlestickChartInner] Skipping data update', {
        mounted,
        chartCreated,
        hasSeries: !!seriesRef.current
      })
      return
    }

    console.log('[CandlestickChartInner] Updating chart data...')

    if (!data || data.length === 0) {
      console.warn('[CandlestickChartInner] No data to update')
      return
    }

    try {
      const validData = data.filter((kline: any) => {
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
        console.error('[CandlestickChartInner] No valid data after filtering')
        setError('No valid data available')
        return
      }

      seriesRef.current.setData(validData)
      console.log(`✅ [CandlestickChartInner] Chart updated with ${validData.length} candles`)
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : String(err)
      console.error('[CandlestickChartInner] ❌ Error updating chart data:', err)
      setError(errorMessage)
    }
  }, [mounted, chartCreated, data])

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
          <p className="mb-2 font-semibold">Chart Error</p>
          <p className="text-sm text-white/60">{error}</p>
        </div>
      )}
    </div>
  )
}

export default function CandlestickChart(props: CandlestickChartProps) {
  return (
    <LightweightCharts>
      <CandlestickChartInner {...props} />
    </LightweightCharts>
  )
}
