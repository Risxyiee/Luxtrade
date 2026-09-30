'use client'

import { useEffect, useState, useCallback, useRef } from 'react'
import dynamic from 'next/dynamic'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { RefreshCw, TrendingUp, Loader2, AlertTriangle } from 'lucide-react'

// Import type for data
interface CandlestickData {
  time: number | string
  open: number
  high: number
  low: number
  close: number
}

// Dynamically import CandlestickChart with SSR disabled
const CandlestickChart = dynamic(() => import('@/components/CandlestickChart'), {
  ssr: false,
  loading: () => (
    <div className="flex items-center justify-center" style={{ height: '400px' }}>
      <Loader2 className="w-8 h-8 text-cyan-400 animate-spin" />
    </div>
  )
})

interface ChartTabProps {
  isPro?: boolean
}

export default function ChartTab({ isPro = false }: ChartTabProps) {
  const [isLoadingData, setIsLoadingData] = useState(false)
  const [selectedSymbol, setSelectedSymbol] = useState('XAUUSD')
  const [selectedInterval, setSelectedInterval] = useState('15m')
  const [hasMounted, setHasMounted] = useState(false)
  const [chartError, setChartError] = useState<string | null>(null)
  const [chartData, setChartData] = useState<CandlestickData[]>([])

  // Ref to prevent double-fetch in StrictMode
  const hasFetchedRef = useRef(false)
  const fetchingRef = useRef(false)

  // Forex symbols only
  const symbols = [
    // Gold & Metals
    { symbol: 'XAUUSD', name: 'Gold', icon: '🥇' },
    { symbol: 'XAGUSD', name: 'Silver', icon: '🥈' },

    // Major Forex Pairs
    { symbol: 'EURUSD', name: 'EUR/USD', icon: '🇪🇺🇸' },
    { symbol: 'GBPUSD', name: 'GBP/USD', icon: '🇬🇧' },
    { symbol: 'USDJPY', name: 'USD/JPY', icon: '🇺🇸🇯🇵' },
    { symbol: 'EURGBP', name: 'EUR/GBP', icon: '🇪🇬🇧' },
    { symbol: 'EURJPY', name: 'EUR/JPY', icon: '🇪🇯🇵' },
    { symbol: 'GBPJPY', name: 'GBP/JPY', icon: '🇬🇧🇯🇵' },
    { symbol: 'AUDUSD', name: 'AUD/USD', icon: '🇦🇺🇸' },
    { symbol: 'NZDUSD', name: 'NZD/USD', icon: '🇳🇿🇺🇸' },
    { symbol: 'USDCAD', name: 'USD/CAD', icon: '🇺🇸🇨🇦' },
    { symbol: 'USDCHF', name: 'USD/CHF', icon: '🇺🇸🇨🇭' },
  ]

  const intervals = ['1m', '5m', '15m', '30m', '1h', '4h', '1d']

  // Component mount guard - prevent SSR issues
  useEffect(() => {
    setHasMounted(true)
  }, [])

  // Single fetch function — uses refs to read latest state, no deps needed
  const fetchData = useCallback(async () => {
    if (!hasMounted || fetchingRef.current) return
    fetchingRef.current = true
    setIsLoadingData(true)
    setChartError(null)

    try {
      const apiUrl = `/api/forex?symbol=${selectedSymbol}&interval=${selectedInterval}&limit=50`
      const response = await fetch(apiUrl)

      if (!response.ok) {
        throw new Error(`Failed to fetch data (HTTP ${response.status})`)
      }

      const result = await response.json()
      const apiData = result?.data || []
      const apiSuccess = result?.success !== undefined ? result.success : true

      if (apiSuccess && apiData.length > 0) {
        setChartData(apiData)
      } else if (result.error) {
        throw new Error(result.error)
      } else {
        throw new Error('No data returned from API')
      }
    } catch (error) {
      setChartError(error instanceof Error ? error.message : 'Failed to load chart data')
    } finally {
      setIsLoadingData(false)
      fetchingRef.current = false
    }
  }, [selectedSymbol, selectedInterval, hasMounted])

  // Single effect: fetch on mount and when symbol/interval changes
  useEffect(() => {
    if (!hasMounted) return

    // Debounce to avoid rapid re-fetches
    const timeout = setTimeout(() => {
      hasFetchedRef.current = true
      fetchData()
    }, 300)

    return () => clearTimeout(timeout)
  }, [hasMounted, selectedSymbol, selectedInterval, fetchData])

  // Show loading state if not mounted yet
  if (!hasMounted) {
    return (
      <div className="flex items-center justify-center" style={{ height: '500px' }} suppressHydrationWarning={true}>
        <Loader2 className="w-8 h-8 text-cyan-400 animate-spin" />
      </div>
    )
  }

  return (
    <div className="space-y-4" suppressHydrationWarning={true}>
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold flex items-center gap-2">
            <TrendingUp className="w-6 h-6 text-cyan-400" />
            Trading Chart
          </h2>
          <p className="text-white/60">
            {selectedSymbol} ({selectedInterval})
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
        {/* Gold & Metals */}
        <div className="mb-3">
          <h3 className="text-sm font-semibold text-white/60 mb-2">GOLD & METALS</h3>
          <div className="flex flex-wrap gap-2">
            {symbols.filter(s => ['XAUUSD', 'XAGUSD'].includes(s.symbol)).map((s) => (
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

        {/* Major Forex Pairs */}
        <div className="mb-3">
          <h3 className="text-sm font-semibold text-white/60 mb-2">MAJOR FOREX PAIRS</h3>
          <div className="flex flex-wrap gap-2">
            {symbols.filter(s => !['XAUUSD', 'XAGUSD'].includes(s.symbol)).slice(0, 6).map((s) => (
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
      <div className="flex gap-2 items-center flex-wrap">
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
      <div className="bg-white/[0.02] border border-white/[0.05] rounded-lg p-4 relative overflow-hidden min-h-[400px]">
        {chartError && (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-[#070a10]/90 rounded-lg z-10">
            <AlertTriangle className="w-12 h-12 text-red-400 mb-3" />
            <p className="text-white font-semibold mb-2">Chart Error</p>
            <p className="text-white/60 text-sm mb-4">{chartError}</p>
            <Button
              size="sm"
              onClick={() => {
                setChartError(null)
                fetchData()
              }}
            >
              <RefreshCw className="w-4 h-4 mr-2" />
              Retry
            </Button>
          </div>
        )}

        {!chartError && isLoadingData && chartData.length === 0 && (
          <div className="absolute inset-0 flex items-center justify-center bg-[#070a10]/90 rounded-lg z-10">
            <Loader2 className="w-8 h-8 text-cyan-400 animate-spin" />
          </div>
        )}

        {chartData.length > 0 ? (
          <CandlestickChart
            data={chartData as any}
            containerClassName="w-full"
          />
        ) : (
          !isLoadingData && !chartError && (
            <div className="flex items-center justify-center h-[400px] text-white/40">
              Select a symbol to load chart
            </div>
          )
        )}
      </div>

      {/* Info */}
      <div className="flex gap-4 flex-wrap">
        <Badge className="bg-blue-500/20 text-cyan-400">
          {selectedSymbol}
        </Badge>
        <Badge className="bg-emerald-500/20 text-emerald-400">
          {selectedInterval} timeframe
        </Badge>
        {chartData.length > 0 && (
          <Badge className="bg-cyan-500/20 text-cyan-400">
            {chartData.length} candles
          </Badge>
        )}
      </div>
    </div>
  )
}
