'use client'

import { useState } from 'react'
import { Eye, Plus, Trash2, TrendingUp as TrendingUpIcon, Bell, BellRing, Crown, Lock } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'

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
}

export default function WatchlistTab({
  items,
  loading,
  onAdd,
  onDelete,
  isPro,
  onUpgrade
}: WatchlistTabProps) {
  // Local alert toggle state (visual only — persists in session)
  const [alertItems, setAlertItems] = useState<Set<string>>(() => {
    if (typeof window === 'undefined') return new Set()
    try {
      const stored = sessionStorage.getItem('watchlist-alerts')
      return stored ? new Set(JSON.parse(stored)) : new Set()
    } catch {
      return new Set()
    }
  })

  const toggleAlert = (id: string) => {
    setAlertItems(prev => {
      const next = new Set(prev)
      if (next.has(id)) {
        next.delete(id)
      } else {
        next.add(id)
      }
      sessionStorage.setItem('watchlist-alerts', JSON.stringify([...next]))
      return next
    })
  }

  if (!loading && !isPro) {
    return (
      <div className="flex flex-col items-center justify-center py-20">
        <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center mb-4">
          <Crown className="w-8 h-8 text-white" />
        </div>
        <h3 className="text-xl font-bold text-white mb-2">Premium Feature</h3>
        <p className="text-lux-text-secondary dark:text-gray-400 text-center max-w-sm mb-6">Watchlist is only available for PRO users</p>
        <button onClick={onUpgrade} className="px-6 py-2.5 bg-gradient-to-r from-emerald-500 to-teal-600 text-white rounded-lg font-medium hover:opacity-90 transition-opacity">
          Upgrade to PRO
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
          <h3 className="text-xl font-bold">Watchlist</h3>
          <p className="text-sm text-lux-text-secondary dark:text-gray-400">Track potential opportunities</p>
        </div>
        <Button onClick={onAdd} className="bg-gradient-to-r from-emerald-500 to-teal-600">
          <Plus className="w-4 h-4 mr-2" />Add Symbol
        </Button>
      </div>

      {items.length === 0 ? (
        <Card className="bg-lux-bg-card dark:bg-gradient-to-br dark:from-[#0a0c12] dark:to-[#080a14] border-lux-border dark:border-blue-900/30">
          <CardContent className="py-16 text-center">
            <Eye className="w-12 h-12 mx-auto mb-4 text-lux-text-muted dark:text-gray-500" />
            <h3 className="text-lg font-semibold mb-2">No Watchlist Items</h3>
            <p className="text-lux-text-secondary dark:text-gray-400 mb-4">Add symbols to track potential setups!</p>
            <Button onClick={onAdd} variant="outline" className="border-emerald-500/30 text-emerald-400">
              <Plus className="w-4 h-4 mr-2" /> Add First Symbol
            </Button>
          </CardContent>
        </Card>
      ) : (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {items.map((item) => {
              const isAlertOn = alertItems.has(item.id)
              return (
                <Card key={item.id} className={`bg-lux-bg-card dark:bg-gradient-to-br dark:from-[#0a0c12] dark:to-[#080a14] border-lux-border dark:border-blue-900/30 hover:border-emerald-500/30 transition-colors group ${isAlertOn ? 'ring-1 ring-amber-500/30' : ''}`}>
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center gap-2">
                        <div className="w-10 h-10 rounded-lg bg-emerald-500/20 flex items-center justify-center">
                          <TrendingUpIcon className="w-5 h-5 text-emerald-400" />
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
                          className={`p-1.5 rounded-lg transition-all ${isAlertOn ? 'text-amber-400 bg-amber-500/15 hover:bg-amber-500/25' : 'text-lux-text-muted dark:text-gray-500 hover:text-lux-text-primary dark:text-gray-300 hover:bg-lux-surface-hover dark:hover:bg-lux-surface-hover dark:bg-white/5 opacity-0 group-hover:opacity-100'}`}
                          title={isAlertOn ? 'Alert ON' : 'Alert OFF'}
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
                          className="p-1.5 rounded-lg opacity-0 group-hover:opacity-100 hover:bg-red-500/20 text-lux-text-secondary dark:text-gray-400 hover:text-red-400 transition-all"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                    {item.target_price && (
                      <div className="mb-2">
                        <span className="text-xs text-lux-text-muted dark:text-gray-500">Target: </span>
                        <span className="text-sm font-bold text-emerald-400">{item.target_price}</span>
                      </div>
                    )}
                    {item.notes && (
                      <p className="text-xs text-lux-text-secondary dark:text-gray-400 line-clamp-2">{item.notes}</p>
                    )}
                    <div className="flex items-center justify-between mt-2">
                      <p className="text-xs text-gray-600">Added {new Date(item.created_at).toLocaleDateString()}</p>
                      {isAlertOn && (
                        <span className="text-[10px] text-amber-400/80 font-medium flex items-center gap-1">
                          <BellRing className="w-3 h-3" />
                          Alert ON
                        </span>
                      )}
                    </div>
                  </CardContent>
                </Card>
              )
            })}
          </div>

          {/* Alert notice */}
          <p className="text-xs text-lux-text-muted dark:text-gray-500 text-center mt-2">
            🔔 Alerts require real-time price data (coming soon) / Alert membutuhkan data harga real-time (segera hadir)
          </p>
        </>
      )}
    </div>
  )
}