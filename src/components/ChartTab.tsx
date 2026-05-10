'use client'

import { useEffect, useRef, useState } from 'react'
import { createChart, IChartApi, ISeriesApi, CandlestickData, Time } from 'lightweight-charts'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { RefreshCw, TrendingUp } from 'lucide-react'

interface ChartTabProps {
  isPro?: boolean
}

export default function ChartTab({ isPro = false }: ChartTabProps) {
  const chartContainerRef = useRef<HTMLDivElement>(null)
  const chartRef = useRef<IChartApi | null>(null)
  const seriesRef = useRef<ISeriesApi<'Candlestick'> | null>(null)
  const [isLoadingData, setIsLoadingData] = useState(false)
  const [selectedSymbol, setSelectedSymbol] = useState('XAUUSD')
  const [selectedInterval, setSelectedInterval] = useState('15m')

  // Extended forex symbols
  const symbols = [
    // Gold & Silver
    { symbol: 'XAUUSD', name: 'Gold', icon: '🥇' },
    { symbol: 'XAGUSD', name: 'Silver', icon: '🥈' },

    // Major Forex Pairs
    { symbol: 'EURUSD', name: 'EUR/USD', icon: '🇪🇺🇸' },
    { symbol: 'GBPUSD', name: 'GBP/USD', icon: '🇬🇧' },
    { symbol: 'USDJPY', name: 'USD/JPY', icon: '🇺🇸🇯🇵' },
    { symbol: 'EURGBP', name: 'EUR/GBP', icon: '🇪🇬🇧' },
    { symbol: 'EURJPY', name: 'EUR/JPY', icon: '🇪🇯🇵' },
    { symbol: 'GBPJPY', name: 'GBP/JPY', icon: '🇬🇧🇯🇵' },
    { symbol: 'AUDUSD', name: 'AUD/USD', icon: '🇦🇺🇺🇸' },
    { symbol: 'NZDUSD', name: 'NZD/USD', icon: '🇳🇿🇺🇸' },
    { symbol: 'USDCAD', name: 'USD/CAD', icon: '🇺🇸🇨🇦' },
    { symbol: 'USDCHF', name: 'USD/CHF', icon: '🇺🇸🇨🇭' },

    // Crypto Pairs
    { symbol: 'BTCUSDT', name: 'Bitcoin', icon: '₿' },
    { symbol: 'ETHUSDT', name: 'Ethereum', icon: 'Ξ' },
    { symbol: 'BNBUSDT', name: 'BNB', icon: '◆' },
    { symbol: 'SOLUSDT', name: 'Solana', icon: '◎' },
  ]

  const intervals = ['1m', '5m', '15m', '30m', '1h', '4h', '1d']

  // Initialize chart
  useEffect(() => {
    if (!chartContainerRef.current) return

    const container = chartContainerRef.current

    const chart = createChart(container, {
      width: container.clientWidth,
      height: container.clientHeight,
      layout: {
        background: { color: '#0a0712' },
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
    })

    const candlestickSeries = chart.addCandlestickSeries({
      upColor: '#10b981',
      downColor: '#ef4444',
      borderDownColor: '#ef4444',
      borderUpColor: '#10b981',
      wickDownColor: '#ef4444',
      wickUpColor: '#10b981',
    })

    chartRef.current = chart
    seriesRef.current = candlestickSeries

    const handleResize = () => {
      if (container && chart) {
        chart.applyOptions({ width: container.clientWidth, height: container.clientHeight })
      }
    }

    window.addEventListener('resize', handleResize)

    // Fetch initial data
    fetchData()

    return () => {
      window.removeEventListener('resize', handleResize)
      chart.remove()
    }
  }, [])

  // Fetch chart data
  const fetchData = async () => {
    setIsLoadingData(true)
    try {
      const response = await fetch(
        `/api/chart/klines?symbol=${selectedSymbol}&interval=${selectedInterval}&limit=150`
      )

      if (!response.ok) {
        throw new Error('Failed to fetch data')
      }

      const data = await response.json()

      if (data.success && seriesRef.current) {
        seriesRef.current.setData(data.data)
        console.log(`Loaded ${data.data.length} candles for ${selectedSymbol}`)
      }
    } catch (error) {
      console.error('Error fetching chart data:', error)
    } finally {
      setIsLoadingData(false)
    }
  }

  // Update chart when symbol or interval changes
  useEffect(() => {
    if (chartRef.current) {
      fetchData()
    }
  }, [selectedSymbol, selectedInterval])

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold flex items-center gap-2">
            <TrendingUp className="w-6 h-6 text-purple-400" />
            Trading Chart
          </h2>
          <p className="text-white/60">
            Real-time chart - {selectedSymbol} ({selectedInterval})
          </p>
        </div>
        <Button
          size="sm"
          variant="outline"
          onClick={fetchData}
          disabled={isLoadingData}
        >
          {isLoadingData ? (
            <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
          ) : (
            <RefreshCw className="w-4 h-4 mr-2" />
          )}
          Refresh
        </Button>
      </div>

      {/* Symbol Selector */}
      <div className="bg-white/[0.02] border border-white/[0.05] rounded-lg p-4">
        <div className="mb-3">
          <h3 className="text-sm font-semibold text-white/60 mb-2">GOLD & SILVER</h3>
          <div className="flex flex-wrap gap-2">
            {symbols.slice(0, 2).map((s) => (
              <Button
                key={s.symbol}
                size="sm"
                variant={selectedSymbol === s.symbol ? 'default' : 'outline'}
                onClick={() => setSelectedSymbol(s.symbol)}
                disabled={isLoadingData}
                className="text-xs"
              >
                <span className="mr-1">{s.icon}</span>
                {s.name}
              </Button>
            ))}
          </div>
        </div>

        <div className="mb-3">
          <h3 className="text-sm font-semibold text-white/60 mb-2">MAJOR FOREX PAIRS</h3>
          <div className="flex flex-wrap gap-2">
            {symbols.slice(2, 12).map((s) => (
              <Button
                key={s.symbol}
                size="sm"
                variant={selectedSymbol === s.symbol ? 'default' : 'outline'}
                onClick={() => setSelectedSymbol(s.symbol)}
                disabled={isLoadingData}
                className="text-xs"
              >
                <span className="mr-1">{s.icon}</span>
                {s.name}
              </Button>
            ))}
          </div>
        </div>

        <div>
          <h3 className="text-sm font-semibold text-white/60 mb-2">CRYPTO PAIRS</h3>
          <div className="flex flex-wrap gap-2">
            {symbols.slice(12).map((s) => (
              <Button
                key={s.symbol}
                size="sm"
                variant={selectedSymbol === s.symbol ? 'default' : 'outline'}
                onClick={() => setSelectedSymbol(s.symbol)}
                disabled={isLoadingData}
                className="text-xs"
              >
                <span className="mr-1">{s.icon}</span>
                {s.name}
              </Button>
            ))}
          </div>
        </div>
      </div>

      {/* Interval Selector */}
      <div className="flex gap-2 items-center">
        <span className="text-white/60 text-sm">Timeframe:</span>
        {intervals.map((interval) => (
          <Button
            key={interval}
            size="sm"
            variant={selectedInterval === interval ? 'default' : 'outline'}
            onClick={() => setSelectedInterval(interval)}
            disabled={isLoadingData}
          >
            {interval}
          </Button>
        ))}
      </div>

      {/* Chart */}
      <div className="bg-white/[0.02] border border-white/[0.05] rounded-lg p-4">
        <div
          ref={chartContainerRef}
          className="w-full"
          style={{ height: '400px' }}
        />
      </div>

      {/* Info */}
      <div className="flex gap-4">
        <Badge className="bg-purple-500/20 text-purple-400">
          {selectedSymbol}
        </Badge>
        <Badge className="bg-emerald-500/20 text-emerald-400">
          {selectedInterval} timeframe
        </Badge>
        <Badge className="bg-cyan-500/20 text-cyan-400">
          150 candles
        </Badge>
      </div>
    </div>
  )
}
