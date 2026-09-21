'use client'

import React, { useState } from 'react'
import { Play, Trash2, Loader2, Sparkles } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { toast } from 'sonner'

interface DemoDataModalProps {
  isOpen: boolean
  onClose: () => void
  onLoadComplete: () => void
  language?: 'id' | 'en'
}

export default function DemoDataModal({
  isOpen,
  onClose,
  onLoadComplete,
  language = 'id'
}: DemoDataModalProps) {
  const [loading, setLoading] = useState(false)
  const [action, setAction] = useState<'load' | 'clear'>('load')

  const handleLoadDemo = async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/demo-data/load', {
        method: 'POST',
        credentials: 'include'
      })

      const data = await res.json()

      if (res.ok) {
        toast.success(language === 'id'
          ? `${data.tradesLoaded} demo trade loaded! Check analytics now.`
          : `${data.tradesLoaded} demo trades loaded! Check analytics now.`)
        onLoadComplete()
        onClose()
      } else {
        toast.error(data.error || (language === 'id' ? 'Failed to load demo data' : 'Failed to load demo data'))
      }
    } catch (error) {
      toast.error(language === 'id' ? 'Network error' : 'Network error')
    } finally {
      setLoading(false)
    }
  }

  const handleClearDemo = async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/demo-data/clear', {
        method: 'DELETE',
        credentials: 'include'
      })

      const data = await res.json()

      if (res.ok) {
        toast.success(language === 'id'
          ? `${data.tradesCleared} demo trade cleared!`
          : `${data.tradesCleared} demo trades cleared!`)
        onLoadComplete()
        onClose()
      } else {
        toast.error(data.error || (language === 'id' ? 'Failed to clear demo data' : 'Failed to clear demo data'))
      }
    } catch (error) {
      toast.error(language === 'id' ? 'Network error' : 'Network error')
    } finally {
      setLoading(false)
    }
  }

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="bg-[#0a0c12] border border-white/10 text-white max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-2xl">
            <Sparkles className="w-6 h-6 text-cyan-400" />
            {language === 'id' ? 'Demo Data Tutorial' : 'Demo Data Tutorial'}
          </DialogTitle>
          <DialogDescription className="text-gray-400 mt-2">
            {language === 'id'
              ? 'Load 10 demo trades untuk melihat analytics dan AI insights tanpa input manual.'
              : 'Load 10 demo trades to see analytics and AI insights without manual input.'}
          </DialogDescription>
        </DialogHeader>

        <div className="py-4 space-y-4">
          {/* Demo trades preview */}
          <div className="bg-white/5 rounded-lg p-4 space-y-3">
            <div className="flex items-center justify-between text-sm">
              <span className="text-gray-400">{language === 'id' ? 'Total Trades' : 'Total Trades'}</span>
              <span className="font-bold text-cyan-400">10</span>
            </div>
            <div className="flex items-center justify-between text-sm">
              <span className="text-gray-400">{language === 'id' ? 'Win Rate' : 'Win Rate'}</span>
              <span className="font-bold text-emerald-400">70%</span>
            </div>
            <div className="flex items-center justify-between text-sm">
              <span className="text-gray-400">{language === 'id' ? 'Total P/L' : 'Total P/L'}</span>
              <span className="font-bold text-emerald-400">+$637.80</span>
            </div>
            <div className="flex items-center justify-between text-sm">
              <span className="text-gray-400">{language === 'id' ? 'Pairs' : 'Pairs'}</span>
              <span className="font-bold text-purple-400">XAUUSD, EURUSD, GBPJPY, EURJPY, USDJPY</span>
            </div>
          </div>

          <p className="text-xs text-gray-500">
            {language === 'id'
              ? '⚠️ Demo trade akan ditandai [DEMO DATA] dan bisa dihapus kapan saja.'
              : '⚠️ Demo trades will be marked [DEMO DATA] and can be deleted anytime.'}
          </p>
        </div>

        <DialogFooter className="flex-col gap-2 sm:flex-col">
          <Button
            onClick={handleLoadDemo}
            disabled={loading}
            className="w-full bg-gradient-to-r from-blue-500 to-cyan-400 hover:opacity-90 transition-all"
          >
            {loading ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                {language === 'id' ? 'Loading...' : 'Loading...'}
              </>
            ) : (
              <>
                <Play className="w-4 h-4 mr-2" />
                {language === 'id' ? 'Load Demo Data' : 'Load Demo Data'}
              </>
            )}
          </Button>

          <Button
            onClick={handleClearDemo}
            disabled={loading}
            variant="outline"
            className="w-full border-red-500/30 text-red-400 hover:bg-red-500/10 hover:text-red-300"
          >
            {loading ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                {language === 'id' ? 'Deleting...' : 'Deleting...'}
              </>
            ) : (
              <>
                <Trash2 className="w-4 h-4 mr-2" />
                {language === 'id' ? 'Clear Demo Data' : 'Clear Demo Data'}
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}