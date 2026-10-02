'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { Eye, Plus, Trash2, TrendingUp as TrendingUpIcon, Bell, BellRing, Crown, Lock, CheckCircle2, RefreshCw, AlertTriangle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { toast } from 'sonner'

// ── Symbol normalization (mirrors server-side aliases) ────────────────
// Ensures watchlist symbols like "XAU" or "GOLD" are mapped to the
// canonical API symbol ("XAUUSD") before fetching from /api/forex.
const FOREX_SYMBOL_ALIASES: Record<string, string> = {
  'XAU': 'XAUUSD', 'GOLD': 'XAUUSD', 'XAU/USD': 'XAUUSD',
  'XAG': 'XAGUSD', 'SILVER': 'XAGUSD', 'XAG/USD': 'XAGUSD',
  'EU': 'EURUSD', 'GU': 'GBPUSD', 'GJ': 'GBPJPY', 'EJ': 'EURJPY',
  'UJ': 'USDJPY', 'AU': 'AUDUSD', 'NU': 'NZDUSD', 'UC': 'USDCAD', 'UF': 'USDCHF',
  'EUR/USD': 'EURUSD', 'GBP/USD': 'GBPUSD', 'USD/JPY': 'USDJPY',
  'EUR/GBP': 'EURGBP', 'EUR/JPY': 'EURJPY', 'GBP/JPY': 'GBPJPY',
  'AUD/USD': 'AUDUSD', 'NZD/USD': 'NZDUSD', 'USD/CAD': 'USDCAD', 'USD/CHF': 'USDCHF',
}

function normalizeForexSymbol(raw: string): string {
  const key = raw.trim().toUpperCase()
  return FOREX_SYMBOL_ALIASES[key] || key
}

export interface WatchlistItem {
  id: string
  symbol: string
  name: string
  target_price: number | null
  notes: string | null
  created_at: string
}

interface WatchlistTabProps {
  items: WatchlistItem[]
  loading: boolean
  onAdd: () => void
  onDelete: (id: string) => void
  isPro?: boolean
  onUpgrade?: () => void
  language?: 'id' | 'en'
}

export default function WatchlistTab({
  items,
  loading,
  onAdd,
  onDelete,
  isPro,
  onUpgrade,
  language = 'id'
}: WatchlistTabProps) {
  // Local alert toggle state — persists in localStorage across sessions
  const [alertItems, setAlertItems] = useState<Set<string>>(() => {
    if (typeof window === 'undefined') return new Set()
    try {
      const stored = localStorage.getItem('luxtradee-watchlist-alerts')
      return stored ? new Set(JSON.parse(stored)) : new Set()
    } catch {
      return new Set()
    }
  })

  // Current prices per symbol (from /api/forex polling)
  const [currentPrices, setCurrentPrices] = useState<Record<string, number>>({})

  // Previous prices per symbol (for cross-detection of target price)
  const [previousPrices, setPreviousPrices] = useState<Record<string, number>>({})

  // Last time prices were successfully fetched
  const [lastPriceUpdate, setLastPriceUpdate] = useState<number>(0)

  // Whether a price fetch is in progress
  const [priceLoading, setPriceLoading] = useState(false)

  // Triggered alert IDs — items whose target price was reached
  const [triggeredAlerts, setTriggeredAlerts] = useState<Set<string>>(() => {
    if (typeof window === 'undefined') return new Set()
    try {
      const stored = localStorage.getItem('luxtradee-watchlist-triggered')
      return stored ? new Set(JSON.parse(stored)) : new Set()
    } catch {
      return new Set()
    }
  })

  // Refs to access latest state inside polling interval without re-creating effect
  const alertItemsRef = useRef(alertItems)
  const triggeredAlertsRef = useRef(triggeredAlerts)
  const itemsRef = useRef(items)
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const currentPricesRef = useRef(currentPrices)
  alertItemsRef.current = alertItems
  triggeredAlertsRef.current = triggeredAlerts
  itemsRef.current = items
  currentPricesRef.current = currentPrices

  const toggleAlert = (id: string) => {
    setAlertItems(prev => {
      const next = new Set(prev)
      if (next.has(id)) {
        next.delete(id)
      } else {
        next.add(id)
      }
      localStorage.setItem('luxtradee-watchlist-alerts', JSON.stringify([...next]))
      return next
    })
  }

  // Format price for display
  const formatPrice = (symbol: string, price: number) => {
    return price >= 100 ? price.toFixed(2) : price.toFixed(symbol.includes('JPY') ? 3 : 5)
  }

  // Manual refresh handler
  const refreshPrices = useCallback(async () => {
    const symbolsToFetch = [...new Set(items.map(i => i.symbol))]
    if (symbolsToFetch.length === 0) return

    setPriceLoading(true)
    const priceMap: Record<string, number> = {}

    await Promise.all(symbolsToFetch.map(async (symbol) => {
      try {
        const apiSymbol = normalizeForexSymbol(symbol)
        const res = await fetch(`/api/forex?symbol=${apiSymbol}&limit=1&interval=1h&nocache=true`)
        if (!res.ok) return
        const data = await res.json()
        if (data.success && data.data?.length > 0) {
          priceMap[symbol] = data.data[data.data.length - 1].close
        }
      } catch {
        // Silently ignore fetch errors
      }
    }))

    if (Object.keys(priceMap).length > 0) {
      setCurrentPrices(prev => {
        setPreviousPrices(prev) // Save previous prices for cross-detection
        return { ...prev, ...priceMap }
      })
      setLastPriceUpdate(Date.now())
    }
    setPriceLoading(false)
  }, [items])

  // Price polling for items with alerts enabled
  useEffect(() => {
    if (items.length === 0) return

    const alertItemsList = items.filter(item => alertItems.has(item.id))
    if (alertItemsList.length === 0) return

    const pollPrices = async () => {
      const currentAlertItems = itemsRef.current.filter(item => alertItemsRef.current.has(item.id))
      if (currentAlertItems.length === 0) return

      // Also fetch prices for ALL items (not just alert items) so the UI shows current prices
      const uniqueSymbols = [...new Set(itemsRef.current.map(i => i.symbol))]
      const priceMap: Record<string, number> = {}

      setPriceLoading(true)
      await Promise.all(uniqueSymbols.map(async (symbol) => {
        try {
          const apiSymbol = normalizeForexSymbol(symbol)
          const res = await fetch(`/api/forex?symbol=${apiSymbol}&limit=1&interval=1h&nocache=true`)
          if (!res.ok) return
          const data = await res.json()
          if (data.success && data.data?.length > 0) {
            priceMap[symbol] = data.data[data.data.length - 1].close
          }
        } catch {
          // Silently ignore fetch errors
        }
      }))

      const prevPrices = currentPricesRef.current
      setCurrentPrices(prev => {
        setPreviousPrices(prev) // Save previous prices for cross-detection
        return { ...prev, ...priceMap }
      })
      if (Object.keys(priceMap).length > 0) {
        setLastPriceUpdate(Date.now())
      }
      setPriceLoading(false)

      // Check alerts against fetched prices
      currentAlertItems.forEach(item => {
        const price = priceMap[item.symbol]
        const prevPrice = prevPrices[item.symbol]
        if (price && item.target_price) {
          const target = item.target_price

          // Method 1: Within 0.5% of target (more tolerant for volatile instruments)
          const withinThreshold = Math.abs(price - target) / target < 0.005

          // Method 2: Cross-detection — price crossed the target between polls
          // If previous price was on one side and current price on the other, the target was crossed
          const crossedUp = prevPrice != null && prevPrice < target && price >= target
          const crossedDown = prevPrice != null && prevPrice > target && price <= target
          const crossedTarget = crossedUp || crossedDown

          const reached = withinThreshold || crossedTarget

          if (reached && !triggeredAlertsRef.current.has(item.id)) {
            setTriggeredAlerts(prev => {
              const next = new Set([...prev, item.id])
              localStorage.setItem('luxtradee-watchlist-triggered', JSON.stringify([...next]))
              return next
            })
            // Toast notification
            const detectionMethod = crossedTarget && !withinThreshold
              ? (language === 'id' ? ' (melewati target)' : ' (crossed target)')
              : ''
            const msg = language === 'id'
              ? `🎯 ${item.symbol} — Target ${target} tercapai! Harga: ${formatPrice(item.symbol, price)}${detectionMethod}`
              : `🎯 ${item.symbol} — Target ${target} reached! Price: ${formatPrice(item.symbol, price)}${detectionMethod}`
            toast.success(msg, { duration: 8000 })
            // Auto-disable alert after trigger
            toggleAlert(item.id)
          }
        }
      })
    }

    // Poll prices immediately — no artificial delay
    pollPrices()
    intervalRef.current = setInterval(pollPrices, 15000) // Every 15s for more responsive alerts

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current)
    }
  }, [items, alertItems, language])

  if (!loading && !isPro) {
    return (
      <div className="flex flex-col items-center justify-center py-20">
        <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-blue-500 to-cyan-600 flex items-center justify-center mb-4">
          <Crown className="w-8 h-8 text-white" />
        </div>
        <h3 className="text-xl font-bold text-white mb-2">{language === 'id' ? 'Fitur Premium' : 'Premium Feature'}</h3>
        <p className="text-lux-text-secondary dark:text-gray-400 text-center max-w-sm mb-6">{language === 'id' ? 'Watchlist hanya tersedia untuk pengguna PRO' : 'Watchlist is only available for PRO users'}</p>
        <button onClick={onUpgrade} className="px-6 py-2.5 bg-gradient-to-r from-blue-500 to-cyan-600 text-white rounded-lg font-medium hover:opacity-90 transition-opacity">
          {language === 'id' ? 'Upgrade ke PRO' : 'Upgrade to PRO'}
        </button>
      </div>
    )
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-xl font-bold">{language === 'id' ? 'Daftar Pantauan' : 'Watchlist'}</h3>
          <p className="text-sm text-lux-text-secondary dark:text-gray-400">{language === 'id' ? 'Lacak peluang potensial' : 'Track potential opportunities'}</p>
        </div>
        <div className="flex items-center gap-2">
          {items.length > 0 && (
            <Button
              onClick={refreshPrices}
              disabled={priceLoading}
              variant="outline"
              size="sm"
              className="border-lux-border dark:border-blue-900/30 text-lux-text-secondary dark:text-gray-400 hover:text-blue-400"
            >
              <RefreshCw className={`w-4 h-4 mr-1 ${priceLoading ? 'animate-spin' : ''}`} />
              {language === 'id' ? 'Segarkan' : 'Refresh'}
            </Button>
          )}
          <Button onClick={onAdd} className="bg-gradient-to-r from-blue-500 to-cyan-600">
            <Plus className="w-4 h-4 mr-2" />{language === 'id' ? 'Tambah Simbol' : 'Add Symbol'}
          </Button>
        </div>
      </div>

      {items.length === 0 ? (
        <Card className="bg-lux-bg-card dark:bg-gradient-to-br dark:from-[#0a0c12] dark:to-[#080a14] border-lux-border dark:border-blue-900/30">
          <CardContent className="py-16 text-center">
            <Eye className="w-12 h-12 mx-auto mb-4 text-lux-text-muted dark:text-gray-500" />
            <h3 className="text-lg font-semibold mb-2">{language === 'id' ? 'Belum Ada Item Watchlist' : 'No Watchlist Items'}</h3>
            <p className="text-lux-text-secondary dark:text-gray-400 mb-4">{language === 'id' ? 'Tambah simbol untuk lacak setup potensial!' : 'Add symbols to track potential setups!'}</p>
            <Button onClick={onAdd} variant="outline" className="border-blue-500/30 text-blue-400">
              <Plus className="w-4 h-4 mr-2" /> {language === 'id' ? 'Tambah Simbol Pertama' : 'Add First Symbol'}
            </Button>
          </CardContent>
        </Card>
      ) : (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {items.map((item) => {
              const isAlertOn = alertItems.has(item.id)
              return (
                <Card key={item.id} className={`bg-lux-bg-card dark:bg-gradient-to-br dark:from-[#0a0c12] dark:to-[#080a14] border-lux-border dark:border-blue-900/30 hover:border-blue-500/30 transition-colors group ${isAlertOn ? 'ring-1 ring-amber-500/30' : ''}`}>
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center gap-2">
                        <div className="w-10 h-10 rounded-lg bg-blue-500/20 flex items-center justify-center">
                          <TrendingUpIcon className="w-5 h-5 text-blue-400" />
                        </div>
                        <div>
                          <h4 className="font-bold">{item.symbol}</h4>
                          {item.name && <p className="text-xs text-lux-text-muted dark:text-gray-500">{item.name}</p>}
                        </div>
                      </div>
                      <div className="flex items-center gap-1">
                        {/* Alert toggle button */}
                        <button
                          onClick={() => toggleAlert(item.id)}
                          className={`p-1.5 rounded-lg transition-all ${isAlertOn ? 'text-amber-400 bg-amber-500/15 hover:bg-amber-500/25' : 'text-lux-text-muted dark:text-gray-500 hover:text-lux-text-primary dark:text-gray-300 hover:bg-lux-surface-hover dark:hover:bg-lux-surface-hover dark:bg-white/5'}`}
                          title={isAlertOn ? (language === 'id' ? 'Alert ON' : 'Alert ON') : (language === 'id' ? 'Alert OFF' : 'Alert OFF')}
                        >
                          {isAlertOn ? (
                            <BellRing className="w-4 h-4 animate-[swing_1s_ease-in-out_infinite]" />
                          ) : (
                            <Bell className="w-4 h-4" />
                          )}
                        </button>
                        {/* Delete button */}
                        <button
                          onClick={() => onDelete(item.id)}
                          className="p-1.5 rounded-lg hover:bg-red-500/20 text-lux-text-secondary dark:text-gray-400 hover:text-red-400 transition-all"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                    {/* Current price from polling */}
                    {currentPrices[item.symbol] != null ? (
                      <div className="mb-1 flex items-center gap-1.5">
                        <span className="text-xs text-lux-text-muted dark:text-gray-500">{language === 'id' ? 'Harga: ' : 'Price: '}</span>
                        <span className="text-sm font-mono text-blue-400">{formatPrice(item.symbol, currentPrices[item.symbol])}</span>
                        {/* Stale indicator: price data > 60s old */}
                        {lastPriceUpdate > 0 && (Date.now() - lastPriceUpdate > 60000) && (
                          <span title={language === 'id' ? 'Data harga mungkin basi' : 'Price data may be stale'}>
                            <AlertTriangle className="w-3 h-3 text-amber-400" />
                          </span>
                        )}
                      </div>
                    ) : (
                      /* Show loading indicator when price is not yet available */
                      <div className="mb-1">
                        <span className="text-xs text-lux-text-muted dark:text-gray-500">
                          {priceLoading
                            ? (language === 'id' ? 'Memuat harga...' : 'Loading price...')
                            : (language === 'id' ? 'Harga tidak tersedia' : 'Price unavailable')
                          }
                        </span>
                      </div>
                    )}
                    {item.target_price && (
                      <div className="mb-2">
                        <span className="text-xs text-lux-text-muted dark:text-gray-500">{language === 'id' ? 'Target: ' : 'Target: '}</span>
                        {triggeredAlerts.has(item.id) ? (
                          <span className="text-sm font-bold text-emerald-400 flex items-center gap-1">
                            {item.target_price}
                            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                            <span className="text-[10px] font-medium">{language === 'id' ? 'Tercapai!' : 'Reached!'}</span>
                          </span>
                        ) : (
                          <span className="text-sm font-bold text-emerald-400">{item.target_price}</span>
                        )}
                      </div>
                    )}
                    {item.notes && (
                      <p className="text-xs text-lux-text-secondary dark:text-gray-400 line-clamp-2">{item.notes}</p>
                    )}
                    <div className="flex items-center justify-between mt-2">
                      <p className="text-xs text-gray-600">{language === 'id' ? 'Ditambahkan' : 'Added'} {new Date(item.created_at).toLocaleDateString()}</p>
                      <div className="flex items-center gap-2">
                        {isAlertOn && (
                          <span className="text-[10px] text-amber-400/80 font-medium flex items-center gap-1">
                            <BellRing className="w-3 h-3" />
                            {language === 'id' ? 'Alert ON' : 'Alert ON'}
                          </span>
                        )}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              )
            })}
          </div>

          {/* Alert notice + last update */}
          <div className="flex flex-col items-center gap-1 mt-2">
            {alertItems.size > 0 && (
              <p className="text-xs text-lux-text-muted dark:text-gray-500 text-center">
                🔔 {language === 'id' ? 'Alert aktif — harga dicek setiap 15 detik' : 'Alerts active — prices checked every 15s'}
              </p>
            )}
            {lastPriceUpdate > 0 && (
              <p className="text-xs text-lux-text-muted/60 dark:text-gray-600 text-center">
                {language === 'id' ? 'Harga diperbarui' : 'Prices updated'}: {new Date(lastPriceUpdate).toLocaleTimeString()}
              </p>
            )}
          </div>
        </>
      )}
    </div>
  )
}