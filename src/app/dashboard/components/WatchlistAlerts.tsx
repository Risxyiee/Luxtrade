'use client'

import React, { useState, useEffect } from 'react'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Bell } from 'lucide-react'
import { toast } from 'sonner'

interface WatchlistAlert {
  symbol: string
  priceTarget: number
  alertType: 'above' | 'below'
  isActive: boolean
}

interface WatchlistAlertsProps {
  watchlistItems: Array<{
    id: string
    symbol: string
    price: number
  }>
}

export function WatchlistAlerts({ watchlistItems }: WatchlistAlertsProps) {
  const [alerts, setAlerts] = useState<Record<string, WatchlistAlert>>(() => {
    if (typeof window === 'undefined') return {}
    const stored = localStorage.getItem('watchlist-alerts')
    if (stored) {
      try {
        return JSON.parse(stored)
      } catch (e) {
        console.error('Failed to load alerts:', e)
      }
    }
    return {}
  })
  const [showDialog, setShowDialog] = useState(false)
  const [selectedSymbol, setSelectedSymbol] = useState('')
  const [priceTarget, setPriceTarget] = useState('')
  const [alertType, setAlertType] = useState<'above' | 'below'>('above')

  // Monitor prices
  useEffect(() => {
    const interval = setInterval(() => {
      watchlistItems.forEach(item => {
        const alert = alerts[item.symbol]
        if (!alert || !alert.isActive) return

        const shouldAlert =
          (alert.alertType === 'above' && item.price >= alert.priceTarget) ||
          (alert.alertType === 'below' && item.price <= alert.priceTarget)

        if (shouldAlert) {
          toast.success(
            `🔔 Alert: ${item.symbol} is now ${alert.alertType === 'above' ? 'above' : 'below'} $${alert.priceTarget}`
          )
          // Auto-disable alert after triggering
          const updated = { ...alerts }
          updated[item.symbol] = { ...alert, isActive: false }
          setAlerts(updated)
          localStorage.setItem('watchlist-alerts', JSON.stringify(updated))
        }
      })
    }, 5000) // Check every 5 seconds

    return () => clearInterval(interval)
  }, [alerts, watchlistItems])

  const handleAddAlert = () => {
    if (!selectedSymbol || !priceTarget) {
      toast.error('Please fill in all fields')
      return
    }

    const updated = {
      ...alerts,
      [selectedSymbol]: {
        symbol: selectedSymbol,
        priceTarget: parseFloat(priceTarget),
        alertType,
        isActive: true,
      },
    }

    setAlerts(updated)
    localStorage.setItem('watchlist-alerts', JSON.stringify(updated))
    
    toast.success(`Alert set for ${selectedSymbol}`)
    setShowDialog(false)
    setSelectedSymbol('')
    setPriceTarget('')
    setAlertType('above')
  }

  const handleRemoveAlert = (symbol: string) => {
    const updated = { ...alerts }
    delete updated[symbol]
    setAlerts(updated)
    localStorage.setItem('watchlist-alerts', JSON.stringify(updated))
    toast.success(`Alert removed for ${symbol}`)
  }

  const activeAlerts = Object.values(alerts).filter(a => a.isActive)

  return (
    <>
      <div className="flex items-center gap-2">
        <Button
          onClick={() => setShowDialog(true)}
          variant="outline"
          size="sm"
          className="border-purple-500/30 text-purple-400"
        >
          <Bell className="w-4 h-4 mr-2" />
          Alerts {activeAlerts.length > 0 && <span className="ml-1 bg-red-500 px-2 py-0.5 rounded-full text-xs">{activeAlerts.length}</span>}
        </Button>
      </div>

      <AlertDialog open={showDialog} onOpenChange={setShowDialog}>
        <AlertDialogContent className="bg-[#12091a] border-purple-500/30">
          <AlertDialogHeader>
            <AlertDialogTitle>Set Price Alert</AlertDialogTitle>
            <AlertDialogDescription className="text-lux-text-secondary dark:text-gray-400">
              Get notified when a symbol reaches your target price
            </AlertDialogDescription>
          </AlertDialogHeader>

          <div className="space-y-4">
            {/* Symbol Select */}
            <div>
              <label className="text-sm text-lux-text-secondary dark:text-gray-400 block mb-2">Symbol</label>
              <select
                value={selectedSymbol}
                onChange={(e) => setSelectedSymbol(e.target.value)}
                className="w-full px-3 py-2 rounded-lg bg-lux-surface-hover dark:bg-white/5 border border-lux-border dark:border-purple-500/20 text-white text-sm"
              >
                <option value="">Select a symbol...</option>
                {watchlistItems.map(item => (
                  <option key={item.id} value={item.symbol}>
                    {item.symbol}
                  </option>
                ))}
              </select>
            </div>

            {/* Price Target */}
            <div>
              <label className="text-sm text-lux-text-secondary dark:text-gray-400 block mb-2">Price Target</label>
              <Input
                type="number"
                placeholder="Enter target price"
                value={priceTarget}
                onChange={(e) => setPriceTarget(e.target.value)}
                step="0.01"
                className="bg-lux-surface-hover dark:bg-white/5 border-lux-border dark:border-purple-500/20 text-white"
              />
            </div>

            {/* Alert Type */}
            <div>
              <label className="text-sm text-lux-text-secondary dark:text-gray-400 block mb-2">Alert When Price</label>
              <div className="flex gap-2">
                <Button
                  onClick={() => setAlertType('above')}
                  variant={alertType === 'above' ? 'default' : 'outline'}
                  className={alertType === 'above' ? 'bg-purple-500' : 'border-purple-500/30 text-purple-400'}
                >
                  Goes Above
                </Button>
                <Button
                  onClick={() => setAlertType('below')}
                  variant={alertType === 'below' ? 'default' : 'outline'}
                  className={alertType === 'below' ? 'bg-purple-500' : 'border-purple-500/30 text-purple-400'}
                >
                  Goes Below
                </Button>
              </div>
            </div>

            {/* Active Alerts List */}
            {activeAlerts.length > 0 && (
              <div className="pt-2 border-t border-purple-500/10">
                <p className="text-xs text-lux-text-secondary dark:text-gray-400 mb-2">Active Alerts:</p>
                {activeAlerts.map(alert => (
                  <div key={alert.symbol} className="flex items-center justify-between text-xs bg-lux-surface-hover dark:bg-white/5 p-2 rounded mb-1">
                    <span className="text-lux-text-primary dark:text-gray-300">
                      {alert.symbol} {alert.alertType === 'above' ? '↑' : '↓'} ${alert.priceTarget.toFixed(2)}
                    </span>
                    <button
                      onClick={() => handleRemoveAlert(alert.symbol)}
                      className="text-red-400 hover:text-red-300"
                    >
                      ✕
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="flex justify-end gap-2 pt-4">
            <AlertDialogCancel className="border-purple-500/30 text-purple-400">Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleAddAlert}
              className="bg-purple-500 hover:bg-purple-600"
            >
              Set Alert
            </AlertDialogAction>
          </div>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}
