'use client'

import { useEffect, useRef, useState } from 'react'

// Dynamic import for lightweight-charts to avoid SSR issues
let lightweightChartsModule: any = null
let isModuleLoading = false

async function loadLightweightCharts() {
  if (lightweightChartsModule) {
    return lightweightChartsModule
  }

  if (isModuleLoading) {
    return null
  }

  isModuleLoading = true

  try {
    const module = await import('lightweight-charts')
    lightweightChartsModule = module
    isModuleLoading = false
    console.log('[CandlestickChart] ✅ lightweight-charts loaded')
    return module
  } catch (error) {
    console.error('[CandlestickChart] ❌ Failed to load lightweight-charts:', error)
    isModuleLoading = false
    return null
  }
}

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
  const chartRef = useRef<any>(null)
  const seriesRef = useRef<any>(null)
  const handleResizeRef = useRef<(() => void) | null>(null)
  const [mounted, setMounted] = useState(false)
  const [libraryLoaded, setLibraryLoaded] = useState(false)
  const [chartCreated, setChartCreated] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Mount only once
  useEffect(() => {
    console.log('[CandlestickChart] Component mounting...')
    setMounted(true)

    return () => {
      console.log('[CandlestickChart] Component unmounting')
    }
  }, [])

  // Load library on mount
  useEffect(() => {
    if (!mounted) return

    console.log('[CandlestickChart] Loading lightweight-charts...')
    loadLightweightCharts().then((module) => {
      if (module) {
        setLibraryLoaded(true)
      } else {
        setError('Failed to load lightweight-charts library')
      }
    })
  }, [mounted])

  // Create chart after library is loaded
  useEffect(() => {
    if (!mounted || !libraryLoaded) {
      console.log('[CandlestickChart] Skipping chart creation - waiting for library')
      return
    }

    const container = chartContainerRef.current
    if (!container) {
      console.warn('[CandlestickChart] Container ref is null')
      return
    }

    if (!container.clientWidth || container.clientWidth < 100) {
      console.warn('[CandlestickChart] Container width not available:', {
        clientWidth: container.clientWidth,
        offsetWidth: container.offsetWidth,
      })
      setError('Container width not available')
      return
    }

    let chart: any = null
    let series: any = null

    try {
      const { createChart, ColorType, CrosshairMode, LineStyle } = lightweightChartsModule

      console.log('[CandlestickChart] Creating chart with dimensions:', {
        width: container.clientWidth,
        height: 400
      })

      // Check if createChart is available
      if (typeof createChart !== 'function') {
        throw new Error('createChart is not a function')
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

      if (typeof chart.addCandlestickSeries !== 'function') {
        throw new Error('addCandlestickSeries is not available')
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
      setChartCreated(true)
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

    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : String(err)
      console.error('[CandlestickChart] ❌ Error creating chart:', err)
      setError(errorMessage)
    }

    return () => {
      console.log('[CandlestickChart] Cleanup...')
      if (handleResizeRef.current) {
        window.removeEventListener('resize', handleResizeRef.current)
        handleResizeRef.current = null
      }
      if (chart) {
        try {
          chart.remove()
          console.log('[CandlestickChart] Chart removed')
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
      setChartCreated(false)
    }
  }, [mounted, libraryLoaded, chartOptions, seriesOptions])

  // Update data when it changes
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
  }, [mounted, chartCreated, data])

  // Loading state
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
      {/* Loading library state */}
      {!libraryLoaded && !error && (
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
          <p>Loading chart library...</p>
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
