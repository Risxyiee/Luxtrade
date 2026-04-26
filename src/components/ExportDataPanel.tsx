'use client'

import { useState, useCallback } from 'react'
import { Download, FileSpreadsheet, FileJson, CheckCircle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { toast } from 'sonner'

interface Trade {
  id: string
  symbol: string
  type: 'BUY' | 'SELL'
  open_price: number
  close_price: number
  lot_size: number
  profit_loss: number
  open_time: string
  close_time: string
  session: string | null
  notes?: string
}

interface ExportDataProps {
  trades: Trade[]
  journalEntries?: any[]
  watchlistItems?: any[]
  language?: 'id' | 'en'
}

export default function ExportDataPanel({ trades, journalEntries = [], watchlistItems = [], language = 'id' }: ExportDataProps) {
  const [exporting, setExporting] = useState<string | null>(null)

  const exportCSV = useCallback(() => {
    if (trades.length === 0) {
      toast.error(language === 'id' ? 'Tidak ada trade untuk diexport' : 'No trades to export')
      return
    }

    setExporting('csv')
    try {
      const headers = ['No', 'Symbol', 'Type', 'Open Price', 'Close Price', 'Lot Size', 'P/L ($)', 'Session', 'Open Time', 'Close Time', 'Notes']
      const rows = trades.map((trade, i) => [
        i + 1,
        trade.symbol,
        trade.type,
        trade.open_price,
        trade.close_price,
        trade.lot_size,
        trade.profit_loss,
        trade.session || '',
        trade.open_time,
        trade.close_time,
        (trade.notes || '').replace(/,/g, ';'),
      ])

      const csvContent = [
        headers.join(','),
        ...rows.map(row => row.map(cell => {
          const str = String(cell)
          return str.includes(',') || str.includes('"') || str.includes('\n')
            ? `"${str.replace(/"/g, '""')}"`
            : str
        }).join(','))
      ].join('\n')

      const blob = new Blob(['\uFEFF' + csvContent], { type: 'text/csv;charset=utf-8;' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `luxtrade-trades-${new Date().toISOString().split('T')[0]}.csv`
      a.click()
      URL.revokeObjectURL(url)

      toast.success(language === 'id' ? `✅ ${trades.length} trade berhasil diexport ke CSV!` : `✅ ${trades.length} trades exported to CSV!`)
    } catch {
      toast.error(language === 'id' ? 'Gagal export CSV' : 'Failed to export CSV')
    } finally {
      setExporting(null)
    }
  }, [trades, language])

  const exportJSON = useCallback(() => {
    setExporting('json')
    try {
      const data = {
        exportedAt: new Date().toISOString(),
        platform: 'LuxTrade',
        summary: {
          totalTrades: trades.length,
          winningTrades: trades.filter(t => t.profit_loss >= 0).length,
          losingTrades: trades.filter(t => t.profit_loss < 0).length,
          totalPL: trades.reduce((sum, t) => sum + t.profit_loss, 0),
        },
        trades: trades.map(t => ({
          symbol: t.symbol,
          type: t.type,
          open_price: t.open_price,
          close_price: t.close_price,
          lot_size: t.lot_size,
          profit_loss: t.profit_loss,
          session: t.session,
          open_time: t.open_time,
          close_time: t.close_time,
          notes: t.notes,
        })),
        journal: journalEntries,
        watchlist: watchlistItems,
      }

      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `luxtrade-data-${new Date().toISOString().split('T')[0]}.json`
      a.click()
      URL.revokeObjectURL(url)

      toast.success(language === 'id' ? '✅ Data berhasil diexport ke JSON!' : '✅ Data exported to JSON!')
    } catch {
      toast.error(language === 'id' ? 'Gagal export JSON' : 'Failed to export JSON')
    } finally {
      setExporting(null)
    }
  }, [trades, journalEntries, watchlistItems, language])

  return (
    <div className="grid grid-cols-2 gap-3">
      <button
        onClick={exportCSV}
        disabled={exporting === 'csv' || trades.length === 0}
        className="flex flex-col items-center gap-2 p-4 rounded-xl bg-emerald-500/5 border border-emerald-500/20 hover:bg-emerald-500/10 transition-all group disabled:opacity-50 disabled:cursor-not-allowed"
      >
        <div className="w-10 h-10 rounded-xl bg-emerald-500/10 flex items-center justify-center group-hover:scale-110 transition-transform">
          <FileSpreadsheet className="w-5 h-5 text-emerald-400" />
        </div>
        <div className="text-center">
          <p className="text-sm font-medium text-gray-200">CSV</p>
          <p className="text-[10px] text-gray-500">{language === 'id' ? 'Spreadsheet' : 'Spreadsheet'}</p>
        </div>
      </button>

      <button
        onClick={exportJSON}
        disabled={exporting === 'json'}
        className="flex flex-col items-center gap-2 p-4 rounded-xl bg-blue-500/5 border border-blue-500/20 hover:bg-blue-500/10 transition-all group disabled:opacity-50 disabled:cursor-not-allowed"
      >
        <div className="w-10 h-10 rounded-xl bg-blue-500/10 flex items-center justify-center group-hover:scale-110 transition-transform">
          <FileJson className="w-5 h-5 text-blue-400" />
        </div>
        <div className="text-center">
          <p className="text-sm font-medium text-gray-200">JSON</p>
          <p className="text-[10px] text-gray-500">{language === 'id' ? 'Semua Data' : 'All Data'}</p>
        </div>
      </button>
    </div>
  )
}
