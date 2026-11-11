'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { Eye, Plus, Trash2, TrendingUp as TrendingUpIcon, Bell, BellRing, Crown, Lock, CheckCircle2, RefreshCw, AlertTriangle, Target, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { toast } from 'sonner'

// PERF (F2): normalisasi simbol PINDAH ke server (/api/forex-batch pakai
// normalizeSymbol dari lib/market/symbols) — client kirim simbol apa adanya,
// kunci respons tetap simbol client sehingga merge priceMap tetap pas.

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
  onUpdateTarget?: (id: string, target: number | null) => Promise<boolean>
  isPro?: boolean
  onUpgrade?: () => void
  language?: 'id' | 'en'
}

export default function WatchlistTab({
  items,
  loading,
  onAdd,
  onDelete,
  onUpdateTarget,
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

  // ===== Set Target Harga (push otomatis via cron 15-menit-an) =====
  const [targetItem, setTargetItem] = useState<WatchlistItem | null>(null)
  const [targetInput, setTargetInput] = useState('')
  const [targetSaving, setTargetSaving] = useState(false)

  const openTargetDialog = (item: WatchlistItem) => {
    setTargetItem(item)
    setTargetInput(item.target_price != null ? String(item.target_price) : '')
  }

  // Bell client-side (alert instan 15 dtk) ikut menyala saat target disimpan
  // — target = janji alert, jadi alarm lokal + push cron sama-sama aktif.
  const setBellEnabled = (id: string, on: boolean) => {
    setAlertItems(prev => {
      if (on === prev.has(id)) return prev
      const next = new Set(prev)
      if (on) next.add(id)
      else next.delete(id)
      try { localStorage.setItem('luxtradee-watchlist-alerts', JSON.stringify([...next])) } catch { /* ignore */ }
      return next
    })
  }

  // Re-arm alert lokal — target baru/berubah = kesempatan alert baru
  const clearTriggered = (id: string) => {
    setTriggeredAlerts(prev => {
      if (!prev.has(id)) return prev
      const next = new Set(prev)
      next.delete(id)
      try { localStorage.setItem('luxtradee-watchlist-triggered', JSON.stringify([...next])) } catch { /* ignore */ }
      return next
    })
  }

  const saveTarget = async () => {
    if (!targetItem || !onUpdateTarget) return
    const raw = targetInput.trim()
    const n = Number(raw)
    if (raw === '' || !Number.isFinite(n) || n <= 0) {
      toast.error(language === 'id' ? 'Masukkan target harga yang valid (> 0)' : 'Enter a valid target price (> 0)')
      return
    }
    setTargetSaving(true)
    const ok = await onUpdateTarget(targetItem.id, n)
    setTargetSaving(false)
    if (ok) {
      setBellEnabled(targetItem.id, true)
      clearTriggered(targetItem.id)
      toast.success(
        language === 'id'
          ? `🎯 Target ${n} tersimpan — push otomatis saat ${targetItem.symbol} menyentuhnya`
          : `🎯 Target ${n} saved — automatic push when ${targetItem.symbol} reaches it`,
        { duration: 5000 }
      )
      setTargetItem(null)
    }
  }

  const removeTarget = async () => {
    if (!targetItem || !onUpdateTarget) return
    setTargetSaving(true)
    const ok = await onUpdateTarget(targetItem.id, null)
    setTargetSaving(false)
    if (ok) {
      // Target hilang → alarm lokal ikut dimatikan + re-arm
      setBellEnabled(targetItem.id, false)
      clearTriggered(targetItem.id)
      toast.success(language === 'id' ? 'Target dihapus' : 'Target removed')
      setTargetItem(null)
    }
  }

  // Format price for display
  const formatPrice = (symbol: string, price: number) => {
    return price >= 100 ? price.toFixed(2) : price.toFixed(symbol.includes('JPY') ? 3 : 5)
  }

  // Presisi input target mengikuti format harga simbol (2/3/5 desimal)
  const roundForSymbol = (symbol: string, v: number) => {
    const d = v >= 100 ? 2 : symbol.includes('JPY') ? 3 : 5
    return Number(v.toFixed(d))
  }

  // Manual refresh handler
  // PERF (F2): SATU request batch (dulu: 1 fetch per simbol, nocache=true)
  const refreshPrices = useCallback(async () => {
    const symbolsToFetch = [...new Set(items.map(i => i.symbol))]
    if (symbolsToFetch.length === 0) return

    setPriceLoading(true)
    const priceMap: Record<string, number> = {}

    try {
      // nocache=true — user KLIK refresh, wajar minta yang terbaru
      const res = await fetch(`/api/forex-batch?symbols=${encodeURIComponent(symbolsToFetch.join(','))}&nocache=true`)
      if (res.ok) {
        const data = await res.json()
        if (data?.prices) Object.assign(priceMap, data.prices)
      }
    } catch {
      // Silently ignore fetch errors
    }

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
      // PERF (F2): SATU request batch tanpa nocache — server menyajikan
      // dari cache mem/KV bila <= 15 dtk (freshness alert tetap terjaga),
      // hanya cache-miss yang memukul upstream. Dulu: N fetch nocache per tick.
      try {
        const res = await fetch(`/api/forex-batch?symbols=${encodeURIComponent(uniqueSymbols.join(','))}`)
        if (res.ok) {
          const data = await res.json()
          if (data?.prices) Object.assign(priceMap, data.prices)
        }
      } catch {
        // Silently ignore fetch errors
      }

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

    // PERF (F2): pause polling saat tab TIDAK terlihat (background/ minimized) —
    // dulu request jalan terus walau user sedang di tab lain. Saat kembali
    // visible → poll langsung sekali biar harga tidak basi.
    const onVisibilityChange = () => {
      if (typeof document !== 'undefined' && !document.hidden) {
        pollPrices()
      }
    }

    // Poll prices immediately — no artificial delay
    pollPrices()
    intervalRef.current = setInterval(() => {
      if (typeof document !== 'undefined' && document.hidden) return // skip saat hidden
      pollPrices()
    }, 15000) // Every 15s for more responsive alerts
    document.addEventListener('visibilitychange', onVisibilityChange)

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current)
      document.removeEventListener('visibilitychange', onVisibilityChange)
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
                        {/* Set target harga — push otomatis saat harga menyentuh target */}
                        <button
                          onClick={() => openTargetDialog(item)}
                          className={`p-1.5 rounded-lg transition-all ${item.target_price != null ? 'text-emerald-400 bg-emerald-500/15 hover:bg-emerald-500/25' : 'text-lux-text-muted dark:text-gray-500 hover:text-emerald-400 hover:bg-emerald-500/10 dark:bg-white/5'}`}
                          title={language === 'id' ? 'Set target harga (push otomatis ke HP)' : 'Set target price (auto push to phone)'}
                        >
                          <Target className="w-4 h-4" />
                        </button>
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
                    {item.target_price != null && (
                      <div className="mb-2">
                        <button
                          onClick={() => openTargetDialog(item)}
                          className="text-left w-full group/target"
                          title={language === 'id' ? 'Klik untuk ubah target' : 'Click to edit target'}
                        >
                          <span className="text-xs text-lux-text-muted dark:text-gray-500">{language === 'id' ? 'Target: ' : 'Target: '}</span>
                          {triggeredAlerts.has(item.id) ? (
                            <span className="text-sm font-bold text-emerald-400 inline-flex items-center gap-1">
                              {item.target_price}
                              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                              <span className="text-[10px] font-medium">{language === 'id' ? 'Tercapai!' : 'Reached!'}</span>
                            </span>
                          ) : (
                            <span className="text-sm font-bold text-emerald-400 inline-flex items-center gap-1">
                              {item.target_price}
                              <span className="text-[10px] font-medium text-emerald-400/60 opacity-0 group-hover/target:opacity-100 transition-opacity">
                                ✏️
                              </span>
                            </span>
                          )}
                        </button>
                        {/* Jarak ke target — makin penuh bar, makin dekat harga ke target */}
                        {(() => {
                          const cur = currentPrices[item.symbol]
                          if (cur == null || !cur) return null
                          const dist = ((item.target_price - cur) / cur) * 100
                          const abs = Math.abs(dist)
                          const near = abs < 0.5
                          const fill = Math.max(6, 100 - Math.min(94, abs * 20))
                          return (
                            <div className="mt-1.5">
                              <span className={`text-[10px] font-medium ${near ? 'text-emerald-400' : 'text-lux-text-muted dark:text-gray-500'}`}>
                                {near ? '🎯 ' : dist > 0 ? '▲ ' : '▼ '}
                                {abs.toFixed(2)}% {language === 'id' ? 'ke target' : 'to target'}
                              </span>
                              <div className="h-1 mt-1 rounded-full bg-white/10 dark:bg-white/5 overflow-hidden">
                                <div
                                  className={`h-full rounded-full transition-all duration-500 ${near ? 'bg-gradient-to-r from-emerald-500 to-teal-400' : 'bg-gradient-to-r from-blue-500 to-cyan-400'}`}
                                  style={{ width: `${fill}%` }}
                                />
                              </div>
                            </div>
                          )
                        })()}
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

      {/* ===== Dialog Set Target Harga ===== */}
      <Dialog open={!!targetItem} onOpenChange={(open) => { if (!open) setTargetItem(null) }}>
        <DialogContent className="sm:max-w-md bg-lux-bg-card dark:bg-[#0b0e17] border-lux-border dark:border-blue-900/30 text-lux-text-primary">
          {targetItem && (() => {
            const cur = currentPrices[targetItem.symbol]
            const parsed = Number(targetInput)
            const hasTarget = targetInput.trim() !== '' && Number.isFinite(parsed) && parsed > 0
            const above = hasTarget && cur != null && parsed > cur
            const below = hasTarget && cur != null && parsed < cur
            return (
              <>
                <DialogHeader>
                  <DialogTitle className="flex items-center gap-2">
                    <Target className="w-5 h-5 text-emerald-400" />
                    {language === 'id' ? 'Set Target Harga' : 'Set Target Price'}
                    <span className="font-mono text-emerald-400">{targetItem.symbol}</span>
                  </DialogTitle>
                  <DialogDescription className="text-lux-text-secondary dark:text-gray-400">
                    {language === 'id'
                      ? 'Saat harga menyentuh target, notifikasi otomatis dikirim ke layar HP-mu (dicek setiap 15 menit).'
                      : 'When price reaches the target, an automatic notification is pushed to your phone (checked every 15 minutes).'}
                  </DialogDescription>
                </DialogHeader>

                <div className="space-y-4 py-1">
                  {cur != null && (
                    <div className="flex items-center justify-between rounded-lg bg-blue-500/10 border border-blue-500/20 px-3 py-2">
                      <span className="text-xs text-lux-text-secondary dark:text-gray-400">
                        {language === 'id' ? 'Harga sekarang' : 'Current price'}
                      </span>
                      <span className="text-sm font-mono font-bold text-blue-400">{formatPrice(targetItem.symbol, cur)}</span>
                    </div>
                  )}

                  <div className="space-y-2">
                    <Label htmlFor="target-price-input" className="text-lux-text-primary">
                      {language === 'id' ? 'Target harga' : 'Target price'}
                    </Label>
                    <Input
                      id="target-price-input"
                      type="number"
                      inputMode="decimal"
                      step="any"
                      min="0"
                      placeholder={language === 'id' ? 'cth: 1.0850' : 'e.g. 1.0850'}
                      value={targetInput}
                      onChange={(e) => setTargetInput(e.target.value)}
                      onKeyDown={(e) => { if (e.key === 'Enter') saveTarget() }}
                      autoFocus
                      className="font-mono"
                    />
                    {hasTarget && cur != null && (above || below) && (
                      <p className={`text-xs ${above ? 'text-emerald-400' : 'text-amber-400'}`}>
                        {above
                          ? (language === 'id'
                            ? '▲ Target di atas harga — alert saat NAIK ke target'
                            : '▲ Target above price — alert when price RISES to it')
                          : (language === 'id'
                            ? '▼ Target di bawah harga — alert saat TURUN ke target'
                            : '▼ Target below price — alert when price FALLS to it')}
                      </p>
                    )}
                    {cur != null && !!cur && (
                      <div className="flex flex-wrap gap-1.5 pt-0.5">
                        <span className="text-[10px] text-lux-text-muted dark:text-gray-500 self-center mr-0.5">
                          {language === 'id' ? 'Cepat:' : 'Quick:'}
                        </span>
                        {[-1, -0.5, 0.5, 1].map((p) => (
                          <button
                            key={p}
                            type="button"
                            onClick={() => setTargetInput(String(roundForSymbol(targetItem.symbol, cur * (1 + p / 100))))}
                            className="px-2 py-1 rounded-md text-[10px] font-medium border border-lux-border dark:border-blue-900/30 text-lux-text-secondary dark:text-gray-400 hover:border-emerald-500/40 hover:text-emerald-400 transition-colors"
                          >
                            {p > 0 ? `+${p}%` : `${p}%`}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                </div>

                <DialogFooter className="flex gap-2">
                  {targetItem.target_price != null && (
                    <Button
                      onClick={removeTarget}
                      disabled={targetSaving}
                      variant="outline"
                      className="border-red-500/30 text-red-400 hover:bg-red-500/10 hover:text-red-300 mr-auto"
                    >
                      {targetSaving ? <Loader2 className="w-4 h-4 mr-1 animate-spin" /> : <Trash2 className="w-4 h-4 mr-1" />}
                      {language === 'id' ? 'Hapus Target' : 'Remove Target'}
                    </Button>
                  )}
                  <Button
                    onClick={saveTarget}
                    disabled={targetSaving}
                    className="bg-gradient-to-r from-emerald-500 to-teal-600 hover:opacity-90 text-white"
                  >
                    {targetSaving ? <Loader2 className="w-4 h-4 mr-1 animate-spin" /> : <CheckCircle2 className="w-4 h-4 mr-1" />}
                    {language === 'id' ? 'Simpan Target' : 'Save Target'}
                  </Button>
                </DialogFooter>
              </>
            )
          })()}
        </DialogContent>
      </Dialog>
    </div>
  )
}