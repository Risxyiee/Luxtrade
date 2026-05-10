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

  useEffect(() => {
    setMounted(true)
  }, [])

  useEffect(() => {
    if (!mounted || !chartContainerRef.current) return

    let chart: IChartApi<'UTCTimestamp'> | null = null
    let series: ISeriesApi<'UTCTimestamp', CandlestickData> | null = null

    try {
      const container = chartContainerRef.current
      if (!container || !container.clientWidth) {
        console.warn('Chart container not ready')
        return
      }

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
          background: { type: ColorType.Solid, color: '#0a0712' },
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
      })

      seriesRef.current = series

      // Validate and set data
      if (data && data.length > 0) {
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

        series.setData(validData)
        console.log(`✅ Chart loaded with ${validData.length} candles`)
      }

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
      console.error('❌ Error creating chart:', error)
    }

    return () => {
      if (handleResizeRef.current) {
        window.removeEventListener('resize', handleResizeRef.current)
        handleResizeRef.current = null
      }
      if (chart) {
        chart.remove()
        chart = null
      }
      if (chartRef.current) {
        chartRef.current = null
      }
      if (seriesRef.current) {
        seriesRef.current = null
      }
    }
  }, [mounted, data, chartOptions, seriesOptions])

  if (!mounted) {
    return (
      <div className={containerClassName} style={{ height: '400px' }} suppressHydrationWarning={true}>
        <div className="flex items-center justify-center h-full">
          <div className="w-6 h-6 border-2 border-purple-400 border-t-transparent rounded-full animate-spin" />
        </div>
      </div>
    )
  }

  return <div ref={chartContainerRef} className={containerClassName} style={{ height: '400px' }} suppressHydrationWarning={true} />
}
