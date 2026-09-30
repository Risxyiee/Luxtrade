'use client'

import { useEffect, useRef, useState, useMemo } from 'react'
import { createChart, ColorType, CrosshairMode, LineStyle, IChartApi, ISeriesApi, CandlestickSeries, type CandlestickData } from 'lightweight-charts'

interface CandlestickChartProps {
  data: CandlestickData[]
  containerClassName?: string
}

function CandlestickChartInner({
  data,
  containerClassName = '',
}: CandlestickChartProps) {
  const chartContainerRef = useRef<HTMLDivElement>(null)
  const chartRef = useRef<IChartApi | null>(null)
  const seriesRef = useRef<ISeriesApi<'Candlestick'> | null>(null)
  const handleResizeRef = useRef<(() => void) | null>(null)
  const [mounted, setMounted] = useState(false)
  const [chartReady, setChartReady] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Stable chart options — never recreated
  const chartOptions = useMemo(() => ({
    layout: {
      background: { type: ColorType.Solid, color: 'transparent' },
      textColor: '#ffffff',
    },
    grid: {
      vertLines: { color: 'rgba(255,255,255, 0.05)', style: LineStyle.Dotted },
      horLines: { color: 'rgba(255,255,255, 0.05)', style: LineStyle.Dotted },
    },
    crosshair: {
      mode: CrosshairMode.Normal,
      vertLine: { color: 'rgba(224, 227, 235, 0.1)', width: 1, style: LineStyle.Dashed, labelBackgroundColor: '#1f2937' },
      horLine: { color: 'rgba(224, 227, 235, 0.1)', width: 1, style: LineStyle.Dashed, labelBackgroundColor: '#1f2937' },
    },
    rightPriceScale: { borderColor: 'rgba(255, 255, 255, 0.1)' },
    timeScale: { borderColor: 'rgba(255, 255, 255, 0.1)', timeVisible: true, secondsVisible: false },
    handleScroll: true,
    handleScale: true,
  }), [])

  const seriesOptions = useMemo(() => ({
    upColor: '#10b981',
    downColor: '#ef4444',
    borderDownColor: '#ef4444',
    borderUpColor: '#10b981',
    wickDownColor: '#ef4444',
    wickUpColor: '#10b981',
  }), [])

  // Mount tracking
  useEffect(() => {
    const timer = setTimeout(() => setMounted(true), 0)
    return () => clearTimeout(timer)
  }, [])

  // Create chart once
  useEffect(() => {
    if (!mounted || !chartContainerRef.current) return

    const container = chartContainerRef.current

    const timeoutId = setTimeout(() => {
      if (!container.clientWidth || container.clientWidth < 100) {
        setError('Container not ready')
        return
      }

      try {
        const chart = createChart(container, {
          width: container.clientWidth,
          height: 400,
          ...chartOptions
        })
        chartRef.current = chart

        const series = chart.addSeries(CandlestickSeries, seriesOptions)
        seriesRef.current = series
        setChartReady(true)

        const handleResize = () => {
          if (chartRef.current && chartContainerRef.current) {
            chartRef.current.applyOptions({ width: chartContainerRef.current.clientWidth || 800, height: 400 })
          }
        }
        handleResizeRef.current = handleResize
        window.addEventListener('resize', handleResize)
      } catch (err) {
        setError(err instanceof Error ? err.message : String(err))
      }
    }, 100)

    return () => {
      clearTimeout(timeoutId)
      if (handleResizeRef.current) {
        window.removeEventListener('resize', handleResizeRef.current)
        handleResizeRef.current = null
      }
      if (chartRef.current) {
        try { chartRef.current.remove() } catch {}
        chartRef.current = null
      }
      seriesRef.current = null
      setChartReady(false)
    }
  }, [mounted, chartOptions, seriesOptions])

  // Update data only — stable ref to avoid re-renders
  const dataRef = useRef(data)
  dataRef.current = data

  useEffect(() => {
    if (!chartReady || !seriesRef.current) return
    if (!data || data.length === 0) return

    try {
      const validData = data
        .filter((kline: CandlestickData) =>
          typeof kline.time === 'number' && kline.time > 0 &&
          typeof kline.open === 'number' && kline.open > 0 &&
          typeof kline.high === 'number' && kline.high > 0 &&
          typeof kline.low === 'number' && kline.low > 0 &&
          typeof kline.close === 'number' && kline.close > 0 &&
          kline.high >= kline.low
        )
        .sort((a, b) => (a.time as number) - (b.time as number))

      if (validData.length === 0) return
      seriesRef.current.setData(validData)
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    }
  }, [chartReady, data])

  if (!mounted) {
    return (
      <div className={containerClassName} style={{ height: '400px', minHeight: '400px' }} suppressHydrationWarning>
        <div className="flex items-center justify-center h-full">
          <div className="w-6 h-6 border-2 border-cyan-400 border-t-transparent rounded-full animate-spin" />
        </div>
      </div>
    )
  }

  return (
    <div
      ref={chartContainerRef}
      className={containerClassName}
      style={{ height: '400px', minHeight: '400px', backgroundColor: '#070a10', position: 'relative' }}
      suppressHydrationWarning
    >
      {!chartReady && !error && (
        <div className="absolute inset-0 flex items-center justify-center text-gray-400">
          <div className="text-center">
            <div className="w-8 h-8 border-2 border-cyan-400 border-t-transparent rounded-full animate-spin mx-auto mb-2" />
            <p className="text-sm">Loading chart...</p>
          </div>
        </div>
      )}
      {error && (
        <div className="absolute inset-0 flex items-center justify-center text-red-400">
          <div className="text-center p-5">
            <p className="mb-2 font-semibold">Chart Error</p>
            <p className="text-sm text-white/60">{error}</p>
          </div>
        </div>
      )}
    </div>
  )
}

export default function CandlestickChart(props: CandlestickChartProps) {
  return <CandlestickChartInner {...props} />
}
