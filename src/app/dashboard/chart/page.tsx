'use client'

import { useEffect, useRef, useState } from 'react'
import { createChart, ColorType, CrosshairMode, LineStyle, IChartApi, ISeriesApi } from 'lightweight-charts'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Lock, RefreshCw, TrendingUp, Crown } from 'lucide-react'
import { supabase } from '@/lib/supabase'

interface IndicatorSignal {
  time: number | string
  type: 'BUY' | 'SELL'
  price: number
  bodyPercent: string
  lookbackHigh: string
  lookbackLow: string
}

interface CandlestickData {
  time: number | string
  open: number
  high: number
  low: number
  close: number
}

interface IndicatorResponse {
  success: boolean
  symbol: string
  interval: string
  klines: CandlestickData[]
  signals: IndicatorSignal[]
}

export default function LuxtradeChart() {
  const chartContainerRef = useRef<HTMLDivElement>(null)
  const chartRef = useRef<IChartApi<'UTCTimestamp'> | null>(null)
  const seriesRef = useRef<ISeriesApi<'UTCTimestamp', CandlestickData> | null>(null)
  const [mounted, setMounted] = useState(false)
  const [isLoading, setIsLoading] = useState(true)
  const [isLoadingData, setIsLoadingData] = useState(false)
  const [subscription, setSubscription] = useState<string>('FREE')
  const [signals, setSignals] = useState<IndicatorSignal[]>([])
  const [selectedSymbol, setSelectedSymbol] = useState('BTCUSDT')
  const [selectedInterval, setSelectedInterval] = useState('15m')

  // Mount guard
  useEffect(() => {
    setMounted(true)
  }, [])

  // Fetch user subscription status
  useEffect(() => {
    if (!mounted) return

    const fetchSubscription = async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser()

        if (user) {
          const { data: profile } = await supabase
            .from('profiles')
            .select('subscription_status')
            .eq('id', user.id)
            .single()

          if (profile) {
            setSubscription(profile.subscription_status || 'FREE')
          }
        }
      } catch (error) {
        console.error('Error fetching subscription:', error)
      }
    }

    fetchSubscription()
    setIsLoading(false)
  }, [mounted])

  // Initialize chart only for PRO/LIFETIME users
  useEffect(() => {
    if (subscription === 'FREE' || !mounted || !chartContainerRef.current) {
      return
    }

    let chart: IChartApi<'UTCTimestamp'> | null = null
    let series: ISeriesApi<'UTCTimestamp', CandlestickData> | null = null

    try {
      const container = chartContainerRef.current
      if (!container || !container.clientWidth) {
        console.warn('Chart container not ready')
        return
      }

      // Create chart with mobile optimization
      chart = createChart(container, {
        width: container.clientWidth,
        height: 500,
        layout: {
          background: { type: ColorType.Solid, color: '#0a0612' },
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
        handleScroll: true,  // Enable scroll on mobile
        handleScale: true,  // Enable pinch-zoom on mobile
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

      // Handle resize
      const handleResize = () => {
        if (chartRef.current && container) {
          chartRef.current.applyOptions({ width: container.clientWidth, height: 500 })
        }
      }

      window.addEventListener('resize', handleResize)

      // Fetch initial data
      fetchData()
    } catch (error) {
      console.error('Error initializing chart:', error)
    }

    return () => {
      window.removeEventListener('resize', () => {})
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
  }, [subscription, mounted])

  // Fetch chart data with indicators
  const fetchData = async () => {
    if (subscription === 'FREE' || !mounted) return

    setIsLoadingData(true)
    try {
      const response = await fetch(
        `/api/chart/indicators?symbol=${selectedSymbol}&interval=${selectedInterval}&limit=150`
      )

      if (!response.ok) {
        throw new Error('Failed to fetch data')
      }

      const data: IndicatorResponse = await response.json()

      if (data.success && seriesRef.current) {
        // Set candlestick data
        seriesRef.current.setData(data.klines)

        // Set signals for markers
        setSignals(data.signals)

        console.log(`Loaded ${data.klines.length} candles and ${data.signals.length} signals`)
      }
    } catch (error) {
      console.error('Error fetching chart data:', error)
      alert('Failed to fetch chart data. Please try again.')
    } finally {
      setIsLoadingData(false)
    }
  }

  // Handle symbol change
  const handleSymbolChange = (symbol: string) => {
    setSelectedSymbol(symbol)
  }

  // Handle interval change
  const handleIntervalChange = (interval: string) => {
    setSelectedInterval(interval)
  }

  // Update chart when symbol or interval changes
  useEffect(() => {
    if (subscription !== 'FREE' && mounted && chartRef.current) {
      fetchData()
    }
  }, [selectedSymbol, selectedInterval, subscription, mounted])

  // Loading state
  if (!mounted || isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#0a0612]">
        <RefreshCw className="w-8 h-8 animate-spin text-purple-400" />
      </div>
    )
  }

  // Paywall for FREE users
  if (subscription === 'FREE') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#0a0612] p-4">
        <Card className="bg-white/[0.02] border-white/[0.05] max-w-md w-full">
          <CardContent className="p-8 text-center">
            <div className="flex justify-center mb-6">
              <div className="p-4 rounded-full bg-amber-500/20">
                <Lock className="w-12 h-12 text-amber-400" />
              </div>
            </div>
            <h2 className="text-2xl font-bold mb-4">Indikator Terkunci</h2>
            <p className="text-white/60 mb-6">
              Indikator Luxtrade 80% Momentum hanya untuk Member <span className="text-amber-400 font-semibold">PRO</span> atau <span className="text-purple-400 font-semibold">LIFETIME</span>!
            </p>
            <div className="space-y-3">
              <Button className="w-full bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600">
                <Crown className="w-4 h-4 mr-2" />
                Upgrade ke PRO
              </Button>
              <Button
                variant="outline"
                className="w-full"
                onClick={() => window.location.href = '/'}
              >
                Kembali ke Beranda
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-[#0a0612] text-white p-4">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-6">
          <h1 className="text-2xl font-bold mb-2 flex items-center gap-2">
            <TrendingUp className="w-6 h-6 text-purple-400" />
            Luxtrade Indicator
          </h1>
          <p className="text-white/60">
            Real-time Trading Chart - {selectedSymbol} ({selectedInterval})
          </p>
        </div>

        {/* Controls */}
        <div className="flex flex-wrap gap-3 mb-6">
          <div className="flex gap-2">
            {['BTCUSDT', 'ETHUSDT', 'BNBUSDT', 'SOLUSDT'].map((symbol) => (
              <Button
                key={symbol}
                size="sm"
                variant={selectedSymbol === symbol ? 'default' : 'outline'}
                onClick={() => handleSymbolChange(symbol)}
                disabled={isLoadingData}
              >
                {symbol}
              </Button>
            ))}
          </div>
          <div className="flex gap-2">
            {['5m', '15m', '1h', '4h'].map((interval) => (
              <Button
                key={interval}
                size="sm"
                variant={selectedInterval === interval ? 'default' : 'outline'}
                onClick={() => handleIntervalChange(interval)}
                disabled={isLoadingData}
              >
                {interval}
              </Button>
            ))}
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

        {/* Chart */}
        <Card className="bg-white/[0.02] border-white/[0.05]">
          <CardContent className="p-0">
            <div
              ref={chartContainerRef}
              className="w-full"
              style={{ height: '500px' }}
            />
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
