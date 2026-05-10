'use client'

import { useEffect, useState, useCallback } from 'react'
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
      <Loader2 className="w-8 h-8 text-purple-400 animate-spin" />
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

  // Forex & Crypto symbols
  const symbols = [
    // Gold & Metals
    { symbol: 'XAUUSD', name: 'Gold', icon: '🥇', type: 'forex' },
    { symbol: 'XAGUSD', name: 'Silver', icon: '🥈', type: 'forex' },

    // Major Forex Pairs
    { symbol: 'EURUSD', name: 'EUR/USD', icon: '🇪🇺🇸', type: 'forex' },
    { symbol: 'GBPUSD', name: 'GBP/USD', icon: '🇬🇧', type: 'forex' },
    { symbol: 'USDJPY', name: 'USD/JPY', icon: '🇺🇸🇯🇵', type: 'forex' },
    { symbol: 'EURGBP', name: 'EUR/GBP', icon: '🇪🇬🇧', type: 'forex' },
    { symbol: 'EURJPY', name: 'EUR/JPY', icon: '🇪🇯🇵', type: 'forex' },
    { symbol: 'GBPJPY', name: 'GBP/JPY', icon: '🇬🇧🇯🇵', type: 'forex' },
    { symbol: 'AUDUSD', name: 'AUD/USD', icon: '🇦🇺🇸', type: 'forex' },
    { symbol: 'NZDUSD', name: 'NZD/USD', icon: '🇳🇿🇺🇸', type: 'forex' },
    { symbol: 'USDCAD', name: 'USD/CAD', icon: '🇺🇸🇨🇦', type: 'forex' },
    { symbol: 'USDCHF', name: 'USD/CHF', icon: '🇺🇸🇨🇭', type: 'forex' },

    // Crypto Pairs
    { symbol: 'BTCUSDT', name: 'Bitcoin', icon: '₿', type: 'crypto' },
    { symbol: 'ETHUSDT', name: 'Ethereum', icon: 'Ξ', type: 'crypto' },
    { symbol: 'BNBUSDT', name: 'BNB', icon: '◆', type: 'crypto' },
    { symbol: 'SOLUSDT', name: 'Solana', icon: '◎', type: 'crypto' },
  ]

  const intervals = ['1m', '5m', '15m', '30m', '1h', '4h', '1d']

  // Component mount guard - prevent SSR issues
  useEffect(() => {
    setHasMounted(true)
  }, [])

  // Fetch chart data
  const fetchData = useCallback(async () => {
    if (!hasMounted) return

    setIsLoadingData(true)
    setChartError(null)

    try {
      // Determine API endpoint based on symbol type
      const selectedSymbolData = symbols.find(s => s.symbol === selectedSymbol)
      const symbolType = selectedSymbolData?.type || 'forex'

      let apiUrl = ''
      if (symbolType === 'crypto') {
        // Use Binance API for crypto
        apiUrl = `/api/chart/klines?symbol=${selectedSymbol}&interval=${selectedInterval}&limit=150`
      } else {
        // Use Forex API for forex & metals
        apiUrl = `/api/forex?symbol=${selectedSymbol}&interval=${selectedInterval}&limit=150`
      }

      console.log(`🔄 Fetching from ${symbolType} API: ${apiUrl}`)

      const response = await fetch(apiUrl)

      if (!response.ok) {
        throw new Error(`Failed to fetch data from ${symbolType} API`)
      }

      const result = await response.json()

      if (result.success && result.data) {
        setChartData(result.data)
        console.log(`✅ Loaded ${result.data.length} candles for ${selectedSymbol} (${symbolType})`)
      } else if (!result.success) {
        throw new Error(result.error || 'No data returned')
      }

      // Show note if using mock data
      if (result.note) {
        console.log('ℹ️  Note:', result.note)
      }
    } catch (error) {
      console.error('❌ Error fetching chart data:', error)
      setChartError(error instanceof Error ? error.message : 'Failed to load chart data')
    } finally {
      setIsLoadingData(false)
    }
  }, [selectedSymbol, selectedInterval, hasMounted, symbols])

  // Initialize chart only once - after mounting
  useEffect(() => {
    if (!hasMounted) return

    // Fetch initial data immediately
    fetchData()
  }, [hasMounted, fetchData])

  // Update chart when symbol or interval changes
  useEffect(() => {
    if (hasMounted) {
      console.log(`🔄 Updating chart for ${selectedSymbol} ${selectedInterval}`)
      setChartError(null)
      setChartData([]) // Clear previous data
      fetchData()
    }
  }, [selectedSymbol, selectedInterval, fetchData, hasMounted])

  // Debug: Show chart status
  useEffect(() => {
    console.log('📊 Chart status:', {
      hasMounted,
      isLoadingData,
      chartError,
      selectedSymbol,
      selectedInterval,
      dataLength: chartData.length,
    })
  }, [hasMounted, isLoadingData, chartError, selectedSymbol, selectedInterval, chartData])

  // Show loading state if not mounted yet
  if (!hasMounted) {
    return (
      <div className="flex items-center justify-center" style={{ height: '500px' }}>
        <Loader2 className="w-8 h-8 text-purple-400 animate-spin" />
      </div>
    )
  }

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
        {/* Gold & Metals */}
        <div className="mb-3">
          <h3 className="text-sm font-semibold text-white/60 mb-2">GOLD & METALS</h3>
          <div className="flex flex-wrap gap-2">
            {symbols.filter(s => s.type === 'forex' && ['XAUUSD', 'XAGUSD'].includes(s.symbol)).map((s) => (
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
            {symbols.filter(s => s.type === 'forex' && !['XAUUSD', 'XAGUSD'].includes(s.symbol)).slice(0, 6).map((s) => (
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

        {/* Crypto Pairs */}
        <div>
          <h3 className="text-sm font-semibold text-white/60 mb-2">CRYPTO PAIRS</h3>
          <div className="flex flex-wrap gap-2">
            {symbols.filter(s => s.type === 'crypto').map((s) => (
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
      <div className="bg-white/[0.02] border border-white/[0.05] rounded-lg p-4 relative overflow-hidden">
        {chartError && (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-[#0a0712]/90 rounded-lg z-10">
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
          <div className="absolute inset-0 flex items-center justify-center bg-[#0a0712]/90 rounded-lg z-10">
            <Loader2 className="w-8 h-8 text-purple-400 animate-spin" />
          </div>
        )}

        <CandlestickChart
          data={chartData}
          containerClassName="w-full"
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
