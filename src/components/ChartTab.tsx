'use client'

import { useEffect, useState, useRef } from 'react'
import dynamic from 'next/dynamic'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { RefreshCw, TrendingUp, Loader2, AlertTriangle } from 'lucide-react'

interface CandlestickData {
  time: number | string
  open: number
  high: number
  low: number
  close: number
}

const CandlestickChart = dynamic(() => import('@/components/CandlestickChart'), {
  ssr: false,
  loading: () => (
    <div className="flex items-center justify-center h-[400px]">
      <Loader2 className="w-6 h-6 text-cyan-400 animate-spin" />
    </div>
  )
})

const symbols = [
  { symbol: 'XAUUSD', name: 'Gold', icon: '🥇' },
  { symbol: 'XAGUSD', name: 'Silver', icon: '🥈' },
  { symbol: 'EURUSD', name: 'EUR/USD', icon: '🇪🇺🇸' },
  { symbol: 'GBPUSD', name: 'GBP/USD', icon: '🇬🇧' },
  { symbol: 'USDJPY', name: 'USD/JPY', icon: '🇺🇸🇯🇵' },
  { symbol: 'EURGBP', name: 'EUR/GBP', icon: '🇪🇧🇧' },
  { symbol: 'EURJPY', name: 'EUR/JPY', icon: '🇪🇯🇵' },
  { symbol: 'GBPJPY', name: 'GBP/JPY', icon: '🇬🇧🇯🇵' },
  { symbol: 'AUDUSD', name: 'AUD/USD', icon: '🇦🇺🇸' },
  { symbol: 'NZDUSD', name: 'NZD/USD', icon: '🇳🇿🇺🇸' },
  { symbol: 'USDCAD', name: 'USD/CAD', icon: '🇺🇸🇨🇦' },
  { symbol: 'USDCHF', name: 'USD/CHF', icon: '🇺🇸🇨🇭' },
]

const intervals = ['5m', '15m', '1h', '4h', '1d']

interface ChartTabProps {
  isPro?: boolean
}

export default function ChartTab({ isPro = false }: ChartTabProps) {
  const [isLoading, setIsLoading] = useState(false)
  const [selectedSymbol, setSelectedSymbol] = useState('XAUUSD')
  const [selectedInterval, setSelectedInterval] = useState('15m')
  const [chartError, setChartError] = useState<string | null>(null)
  const [chartData, setChartData] = useState<CandlestickData[]>([])

  // Track current request to avoid stale responses
  const requestIdRef = useRef(0)
  const isFetchingRef = useRef(false)

  // Single fetch function
  const loadChart = async (symbol: string, interval: string) => {
    if (isFetchingRef.current) return
    isFetchingRef.current = true

    const thisRequestId = ++requestIdRef.current
    setIsLoading(true)
    setChartError(null)

    try {
      const res = await fetch(`/api/forex?symbol=${symbol}&interval=${interval}&limit=20`)

      // Stale check
      if (thisRequestId !== requestIdRef.current) return

      if (!res.ok) throw new Error(`HTTP ${res.status}`)

      const result = await res.json()
      const apiData = result?.data || []

      if (thisRequestId !== requestIdRef.current) return

      if (apiData.length > 0) {
        setChartData(apiData)
      } else if (result.error) {
        throw new Error(result.error)
      } else {
        throw new Error('No data')
      }
    } catch (err) {
      if (thisRequestId !== requestIdRef.current) return
      setChartError(err instanceof Error ? err.message : 'Failed to load chart')
    } finally {
      if (thisRequestId === requestIdRef.current) {
        setIsLoading(false)
      }
      isFetchingRef.current = false
    }
  }

  // Fetch on mount + symbol/interval change
  useEffect(() => {
    const timer = setTimeout(() => {
      loadChart(selectedSymbol, selectedInterval)
    }, 200)
    return () => clearTimeout(timer)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedSymbol, selectedInterval])

  const handleRefresh = () => {
    isFetchingRef.current = false
    loadChart(selectedSymbol, selectedInterval)
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold flex items-center gap-2">
            <TrendingUp className="w-6 h-6 text-cyan-400" />
            Trading Chart
          </h2>
          <p className="text-white/60 text-sm">
            {selectedSymbol} &middot; {selectedInterval}
          </p>
        </div>
        <Button size="sm" variant="outline" onClick={handleRefresh} disabled={isLoading}>
          {isLoading ? <RefreshCw className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
        </Button>
      </div>

      {/* Symbol Selector */}
      <div className="bg-white/[0.02] border border-white/[0.05] rounded-lg p-4 space-y-3">
        <div>
          <h3 className="text-sm font-semibold text-white/60 mb-2">GOLD & METALS</h3>
          <div className="flex flex-wrap gap-2">
            {symbols.filter(s => ['XAUUSD', 'XAGUSD'].includes(s.symbol)).map((s) => (
              <Button
                key={s.symbol}
                size="sm"
                variant={selectedSymbol === s.symbol ? 'default' : 'outline'}
                onClick={() => setSelectedSymbol(s.symbol)}
                disabled={isLoading}
                className="text-xs"
              >
                <span className="mr-1">{s.icon}</span> {s.name}
              </Button>
            ))}
          </div>
        </div>
        <div>
          <h3 className="text-sm font-semibold text-white/60 mb-2">MAJOR FOREX PAIRS</h3>
          <div className="flex flex-wrap gap-2">
            {symbols.filter(s => !['XAUUSD', 'XAGUSD'].includes(s.symbol)).slice(0, 6).map((s) => (
              <Button
                key={s.symbol}
                size="sm"
                variant={selectedSymbol === s.symbol ? 'default' : 'outline'}
                onClick={() => setSelectedSymbol(s.symbol)}
                disabled={isLoading}
                className="text-xs"
              >
                <span className="mr-1">{s.icon}</span> {s.name}
              </Button>
            ))}
          </div>
        </div>
      </div>

      {/* Interval Selector */}
      <div className="flex gap-2 items-center flex-wrap">
        <span className="text-white/60 text-sm">TF:</span>
        {intervals.map((interval) => (
          <Button
            key={interval}
            size="sm"
            variant={selectedInterval === interval ? 'default' : 'outline'}
            onClick={() => setSelectedInterval(interval)}
            disabled={isLoading}
            className="text-xs"
          >
            {interval}
          </Button>
        ))}
      </div>

      {/* Chart */}
      <div className="bg-white/[0.02] border border-white/[0.05] rounded-lg p-4 relative overflow-hidden">
        {chartError && (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-[#070a10]/90 rounded-lg z-10">
            <AlertTriangle className="w-10 h-10 text-red-400 mb-3" />
            <p className="text-white font-semibold mb-1">Chart Error</p>
            <p className="text-white/60 text-sm mb-3">{chartError}</p>
            <Button size="sm" onClick={() => { setChartError(null); handleRefresh() }}>
              <RefreshCw className="w-4 h-4 mr-1" /> Retry
            </Button>
          </div>
        )}

        {!chartError && isLoading && chartData.length === 0 && (
          <div className="absolute inset-0 flex items-center justify-center bg-[#070a10]/90 rounded-lg z-10">
            <Loader2 className="w-6 h-6 text-cyan-400 animate-spin" />
          </div>
        )}

        {chartData.length > 0 ? (
          <CandlestickChart data={chartData as any} containerClassName="w-full" />
        ) : !isLoading && !chartError ? (
          <div className="flex items-center justify-center h-[400px] text-white/40 text-sm">
            Select a symbol to load chart
          </div>
        ) : null}
      </div>

      {/* Info Badges */}
      <div className="flex gap-3 flex-wrap">
        <Badge className="bg-blue-500/20 text-cyan-400">{selectedSymbol}</Badge>
        <Badge className="bg-emerald-500/20 text-emerald-400">{selectedInterval}</Badge>
        {chartData.length > 0 && (
          <Badge className="bg-cyan-500/20 text-cyan-400">{chartData.length} candles</Badge>
        )}
      </div>
    </div>
  )
}
