'use client'

import { useEffect, useRef } from 'react'
import { createChart, IChartApi, ISeriesApi, CandlestickData, Time, ColorType } from 'lightweight-charts'

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
  const chartRef = useRef<IChartApi | null>(null)
  const seriesRef = useRef<ISeriesApi<'Candlestick'> | null>(null)

  useEffect(() => {
    if (!chartContainerRef.current) return

    const container = chartContainerRef.current

    // Default chart options
    const defaultChartOptions = {
      width: container.clientWidth || 800,
      height: 400,
      layout: {
        background: { type: ColorType.Solid, color: '#0a0712' },
        textColor: '#ffffff',
      },
      grid: {
        vertLines: { color: 'rgba(255, 255, 255, 0.05)' },
        horzLines: { color: 'rgba(255, 255, 255, 0.05)' },
      },
      crosshair: {
        mode: 1,
        vertLine: {
          color: 'rgba(224, 227, 235, 0.1)',
          width: 1,
          style: 2,
        },
        horzLine: {
          color: 'rgba(224, 227, 235, 0.1)',
          width: 1,
          style: 2,
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
    }

    // Default series options
    const defaultSeriesOptions = {
      upColor: '#10b981',
      downColor: '#ef4444',
      borderDownColor: '#ef4444',
      borderUpColor: '#10b981',
      wickDownColor: '#ef4444',
      wickUpColor: '#10b981',
    }

    try {
      // Create chart
      const chart = createChart(container, { ...defaultChartOptions, ...chartOptions })
      chartRef.current = chart

      // Add candlestick series
      const series = chart.addCandlestickSeries({ ...defaultSeriesOptions, ...seriesOptions })
      seriesRef.current = series

      // Set data
      if (data && data.length > 0) {
        series.setData(data)
      }

      // Handle resize
      const handleResize = () => {
        if (chartRef.current && container) {
          const newWidth = container.clientWidth || 800
          chartRef.current.applyOptions({ width: newWidth })
        }
      }

      window.addEventListener('resize', handleResize)
    } catch (error) {
      console.error('Error creating chart:', error)
    }

    return () => {
      window.removeEventListener('resize', () => {})
      if (chartRef.current) {
        chartRef.current.remove()
        chartRef.current = null
      }
      if (seriesRef.current) {
        seriesRef.current = null
      }
    }
  }, [data, chartOptions, seriesOptions])

  return <div ref={chartContainerRef} className={containerClassName} style={{ height: '400px' }} />
}
