'use client'

import { useState, useMemo } from 'react'
import { Activity, Search, Download, View as ViewIcon, Edit, Trash2, RefreshCw, Clock, Target, Tag, Link2, Image as ImageIcon, Copy, FileDown, ChevronDown, Plus, Upload } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { motion } from 'framer-motion'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'
import { toast } from 'sonner'
import { formatCurrency } from '@/lib/supabase'
import { safeParseTags } from '@/lib/parseUtils'
import type { Trade } from '@/types'

// ==================== TRADES TAB COMPONENT ====================

interface TradesTabProps {
  trades: Trade[]
  loading: boolean
  setAddTradeOpen?: (open: boolean) => void
  onView: (trade: Trade) => void
  onEdit: (trade: Trade) => void
  onDelete: (trade: Trade) => void
  onDuplicate?: (trade: Trade) => void
  language?: 'id' | 'en'
}

function TradesTab({
  trades,
  loading,
  setAddTradeOpen,
  onView,
  onEdit,
  onDelete,
  onDuplicate,
  language = 'id'
}: TradesTabProps) {
  const [searchTerm, setSearchTerm] = useState('')
  const [filterType, setFilterType] = useState<'all' | 'BUY' | 'SELL'>('all')
  const [filterSession, setFilterSession] = useState<'all' | 'London' | 'New York' | 'Asia'>('all')
  const [exporting, setExporting] = useState(false)

  // Filter trades
  const filteredTrades = useMemo(() => {
    return trades.filter(trade => {
      const matchesSearch = trade.symbol.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (trade.notes && trade.notes.toLowerCase().includes(searchTerm.toLowerCase()))
      const matchesType = filterType === 'all' || trade.type === filterType
      const matchesSession = filterSession === 'all' || trade.session === filterSession
      return matchesSearch && matchesType && matchesSession
    })
  }, [trades, searchTerm, filterType, filterSession])

  // Build CSV content from a trade list
  const buildCSVContent = (tradeList: Trade[]) => {
    const headers = ['Symbol','Type','Setup Type','Entry','Exit','Lot Size','P/L','Duration','R:R Ratio','Tags','Session','Open Time','Close Time','Notes','Journal Link']
    const rows = tradeList.map(t => {
      const tags = safeParseTags(t.tags)
      return [
        t.symbol,
        t.type,
        t.setup_type || '',
        t.open_price,
        t.close_price,
        t.lot_size,
        t.profit_loss,
        t.trade_duration || '',
        t.risk_reward_ratio || '',
        tags.join(';'),
        t.session || '',
        t.open_time,
        t.close_time,
        (t.notes || '').replace(/,/g, ';'),
        t.linked_journal_id || ''
      ]
    })
    return [headers, ...rows].map(row => row.map(cell => `"${cell}"`).join(',')).join('\n')
  }

  // Export filtered CSV
  const handleExportFilteredCSV = () => {
    if (typeof document === 'undefined') return
    if (filteredTrades.length === 0) {
      toast.error('No trades to export')
      return
    }
    const csvContent = buildCSVContent(filteredTrades)
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    const date = new Date().toISOString().slice(0, 10)
    link.href = url
    link.download = `luxtrade-trades-filtered-${date}.csv`
    link.click()
    URL.revokeObjectURL(url)
    toast.success(`${filteredTrades.length} filtered trades exported!`)
  }

  // Export all CSV
  const handleExportAllCSV = () => {
    if (typeof document === 'undefined') return
    if (trades.length === 0) {
      toast.error('No trades to export')
      return
    }
    const csvContent = buildCSVContent(trades)
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    const date = new Date().toISOString().slice(0, 10)
    link.href = url
    link.download = `luxtrade-trades-all-${date}.csv`
    link.click()
    URL.revokeObjectURL(url)
    toast.success(`${trades.length} trades exported!`)
  }

  // Export PDF
  const handleExportPDF = async () => {
    if (typeof window === 'undefined') return
    if (filteredTrades.length === 0) {
      toast.error('No trades to export')
      return
    }

    setExporting(true)
    try {
      const { default: jsPDF } = await import('jspdf')
      await import('jspdf-autotable')

      const doc = new jsPDF() as any
      const pageWidth = doc.internal.pageSize.getWidth()

      // Header
      doc.setFontSize(20)
      doc.setTextColor(59, 130, 246) // blue
      doc.text('LuxTrade Trade Export', pageWidth / 2, 20, { align: 'center' })

      // Date range
      doc.setFontSize(10)
      doc.setTextColor(150, 150, 150)
      const dateStr = new Date().toLocaleDateString('en-US', {
        year: 'numeric', month: 'long', day: 'numeric'
      })
      const tradeCount = filteredTrades.length
      const totalCount = trades.length
      doc.text(
        `Generated: ${dateStr} | Showing: ${tradeCount} of ${totalCount} trades`,
        pageWidth / 2, 28, { align: 'center' }
      )

      // Table data
      const tableData = filteredTrades.map(t => [
        t.symbol,
        t.type,
        t.open_price.toFixed(5),
        t.close_price.toFixed(5),
        t.lot_size.toFixed(2),
        t.profit_loss.toFixed(2),
        t.trade_duration ? `${Math.floor(t.trade_duration / 60)}h ${t.trade_duration % 60}m` : '-',
        t.risk_reward_ratio ? `1:${t.risk_reward_ratio}` : '-',
        t.session || '-',
        t.open_time ? new Date(t.open_time).toLocaleString() : '-',
        t.close_time ? new Date(t.close_time).toLocaleString() : '-',
        (t.notes || '').substring(0, 40) + ((t.notes || '').length > 40 ? '...' : ''),
      ])

      // Summary calculations
      const totalPL = filteredTrades.reduce((sum, t) => sum + t.profit_loss, 0)
      const wins = filteredTrades.filter(t => t.profit_loss > 0).length
      const winRate = filteredTrades.length > 0 ? (wins / filteredTrades.length) * 100 : 0
      const grossProfit = filteredTrades.filter(t => t.profit_loss > 0).reduce((sum, t) => sum + t.profit_loss, 0)
      const grossLoss = Math.abs(filteredTrades.filter(t => t.profit_loss < 0).reduce((sum, t) => sum + t.profit_loss, 0))
      const profitFactor = grossLoss > 0 ? grossProfit / grossLoss : grossProfit > 0 ? Infinity : 0

      // Add table
      doc.autoTable({
        startY: 35,
        head: [['Symbol', 'Type', 'Entry', 'Exit', 'Lot Size', 'P/L', 'Duration', 'R:R', 'Session', 'Open Time', 'Close Time', 'Notes']],
        body: tableData,
        styles: {
          fontSize: 7,
          cellPadding: 2,
          textColor: [200, 200, 200],
          lineColor: [60, 40, 80],
          lineWidth: 0.3,
        },
        headStyles: {
          fillColor: [20, 11, 24],
          textColor: [168, 85, 247],
          fontStyle: 'bold',
          fontSize: 7,
        },
        alternateRowStyles: {
          fillColor: [25, 18, 35],
        },
        columnStyles: {
          0: { fontStyle: 'bold' },
          5: {
            textColor: (row: any) => {
              // Check the P/L column in the data
              const rowData = doc.previousAutoTable?.body[row.index]
              // We'll use a different approach - color after render
              return [200, 200, 200]
            },
          },
        },
        didParseCell: (data: any) => {
          // Color-code the P/L column (index 5)
          if (data.section === 'body' && data.column.index === 5) {
            const raw = data.cell.raw
            const value = parseFloat(raw)
            if (!isNaN(value)) {
              if (value >= 0) {
                data.cell.styles.textColor = [52, 211, 153] // emerald
              } else {
                data.cell.styles.textColor = [239, 68, 68] // red
              }
            }
          }
          // Color the Type column
          if (data.section === 'body' && data.column.index === 1) {
            if (data.cell.raw === 'BUY') {
              data.cell.styles.textColor = [52, 211, 153] // emerald
            } else {
              data.cell.styles.textColor = [239, 68, 68] // red
            }
          }
        },
      })

      // Summary section at bottom
      const finalY = (doc as any).lastAutoTable?.finalY || 200
      const summaryY = Math.min(finalY + 10, doc.internal.pageSize.getHeight() - 40)

      // Summary box
      doc.setFillColor(20, 11, 24)
      doc.setDrawColor(59, 130, 246)
      doc.roundedRect(14, summaryY, pageWidth - 28, 28, 3, 3, 'FD')

      doc.setFontSize(9)
      doc.setTextColor(168, 85, 247)
      doc.text('Summary', 20, summaryY + 8)

      doc.setFontSize(8)
      doc.setTextColor(200, 200, 200)
      doc.text(`Total Trades: ${tradeCount}`, 20, summaryY + 16)
      doc.text(`Win Rate: ${winRate.toFixed(1)}%`, 65, summaryY + 16)

      // Color-code total P/L
      if (totalPL >= 0) {
        doc.setTextColor(52, 211, 153)
      } else {
        doc.setTextColor(239, 68, 68)
      }
      doc.text(`Total P/L: $${totalPL.toFixed(2)}`, 110, summaryY + 16)

      // Color-code profit factor
      const pfDisplay = profitFactor === Infinity ? '∞' : profitFactor.toFixed(2)
      if (profitFactor >= 2) {
        doc.setTextColor(52, 211, 153)
      } else if (profitFactor >= 1) {
        doc.setTextColor(251, 191, 36)
      } else {
        doc.setTextColor(239, 68, 68)
      }
      doc.text(`Profit Factor: ${pfDisplay}`, 165, summaryY + 22)

      // Footer
      doc.setFontSize(7)
      doc.setTextColor(120, 120, 120)
      doc.text('Generated by LuxTrade', pageWidth / 2, doc.internal.pageSize.getHeight() - 8, { align: 'center' })

      const pdfDate = new Date().toISOString().slice(0, 10)
      doc.save(`luxtrade-trades-${pdfDate}.pdf`)
      toast.success('PDF exported successfully!')
    } catch (error) {
      console.error('PDF export error:', error)
      toast.error('Failed to export PDF. Please try again.')
    } finally {
      setExporting(false)
    }
  }

  // Handle duplicate trade
  const handleDuplicate = (trade: Trade) => {
    if (onDuplicate) {
      onDuplicate(trade)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <RefreshCw className="w-8 h-8 animate-spin text-blue-400" />
      </div>
    )
  }

  if (trades.length === 0) {
    return (
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, ease: 'easeOut' }}
      >
        <Card className="bg-lux-bg-card dark:bg-gradient-to-br dark:from-[#0a0c12]/80 dark:to-[#080a14]/80 backdrop-blur-md border-lux-border dark:border-blue-500/20 transition-all duration-300 hover:border-blue-500/40 overflow-hidden relative">
          {/* Decorative background glow */}
          <div className="absolute inset-0 overflow-hidden pointer-events-none">
            <div className="absolute top-1/3 left-1/2 -translate-x-1/2 -translate-y-1/2 w-56 h-56 bg-blue-500/10 rounded-full blur-[100px]" />
            <div className="absolute bottom-0 right-1/4 w-36 h-36 bg-amber-500/5 rounded-full blur-[80px]" />
          </div>

          <CardContent className="relative py-14 lg:py-20 px-6 text-center">
            {/* Decorative icon composition */}
            <motion.div
              className="flex items-center justify-center gap-3 lg:gap-5 mb-8"
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.6, delay: 0.1 }}
            >
              {/* Upload icon */}
              <motion.div
                className="w-14 h-14 lg:w-16 lg:h-16 rounded-2xl bg-gradient-to-br from-blue-500/20 to-blue-400/10 border border-blue-500/20 flex items-center justify-center"
                animate={{ y: [0, -5, 0] }}
                transition={{ duration: 3, repeat: Infinity, ease: 'easeInOut', delay: 0.2 }}
              >
                <Upload className="w-7 h-7 lg:w-8 lg:h-8 text-blue-400" />
              </motion.div>

              {/* Plus icon (prominent) */}
              <motion.div
                className="w-20 h-20 lg:w-24 lg:h-24 rounded-3xl bg-gradient-to-br from-amber-500/20 to-orange-500/10 border border-amber-500/20 flex items-center justify-center shadow-lg shadow-amber-500/10"
                animate={{ y: [0, -7, 0] }}
                transition={{ duration: 3, repeat: Infinity, ease: 'easeInOut', delay: 0.4 }}
              >
                <Plus className="w-10 h-10 lg:w-12 lg:h-12 text-amber-400" />
              </motion.div>

              {/* Activity icon */}
              <motion.div
                className="w-14 h-14 lg:w-16 lg:h-16 rounded-2xl bg-gradient-to-br from-blue-400/20 to-blue-500/10 border border-blue-400/20 flex items-center justify-center"
                animate={{ y: [0, -5, 0] }}
                transition={{ duration: 3, repeat: Infinity, ease: 'easeInOut', delay: 0.6 }}
              >
                <Activity className="w-7 h-7 lg:w-8 lg:h-8 text-blue-400" />
              </motion.div>
            </motion.div>

            {/* Heading */}
            <motion.h3
              className="text-2xl lg:text-3xl font-bold mb-3 bg-gradient-to-r from-white via-blue-200 to-amber-200 bg-clip-text text-transparent"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.2 }}
            >
              {language === 'id' ? 'Belum Ada Trade' : 'No Trades Yet'}
            </motion.h3>

            {/* Subtitle */}
            <motion.p
              className="text-lux-text-secondary dark:text-gray-400 mb-8 max-w-lg mx-auto text-sm lg:text-base leading-relaxed"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.3 }}
            >
              {language === 'id'
                ? 'Tambahkan trade pertamamu atau import dari MetaTrader!'
                : 'Add your first trade or import from MetaTrader!'}
            </motion.p>

            {/* CTA Buttons */}
            <motion.div
              className="flex flex-col items-center gap-4"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.4 }}
            >
              <Button
                onClick={() => setAddTradeOpen?.(true)}
                size="lg"
                className="bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-400 hover:to-orange-400 text-white font-semibold shadow-lg shadow-amber-500/25 hover:shadow-amber-500/40 transition-all duration-300 px-8 py-6 text-base"
              >
                <Plus className="w-5 h-5 mr-2" />
                {language === 'id' ? 'Tambah Trade' : 'Add Trade'}
              </Button>

              <button
                onClick={() => setAddTradeOpen?.(true)}
                className="text-sm text-blue-400 hover:text-blue-300 transition-colors duration-200 cursor-pointer group"
              >
                {language === 'id'
                  ? 'atau import dari CSV/MT5'
                  : 'or import from CSV/MT5'}
              </button>
            </motion.div>
          </CardContent>
        </Card>
      </motion.div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h3 className="text-xl font-bold">Trade History</h3>
          <p className="text-sm text-lux-text-secondary dark:text-gray-400">{filteredTrades.length} of {trades.length} trades</p>
        </div>
        <div className="flex gap-2">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" className="border-emerald-500/30 text-emerald-400" disabled={exporting}>
                {exporting ? (
                  <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                ) : (
                  <Download className="w-4 h-4 mr-2" />
                )}
                Export
                <ChevronDown className="w-3 h-3 ml-1" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent className="bg-lux-bg-card dark:bg-[#0a0c12] border-lux-border dark:border-lux-border dark:border-blue-900/30" align="end">
              <DropdownMenuItem
                onClick={handleExportAllCSV}
                className="text-lux-text-primary dark:text-gray-300 focus:bg-lux-surface-hover dark:focus:bg-white/10 focus:text-white cursor-pointer"
              >
                <FileDown className="w-4 h-4 mr-2 text-emerald-400" />
                Export All Trades (CSV)
                <span className="ml-auto text-xs text-gray-500">{trades.length}</span>
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={handleExportFilteredCSV}
                className="text-lux-text-primary dark:text-gray-300 focus:bg-lux-surface-hover dark:focus:bg-white/10 focus:text-white cursor-pointer"
              >
                <Download className="w-4 h-4 mr-2 text-blue-400" />
                Export Filtered (CSV)
                <span className="ml-auto text-xs text-gray-500">{filteredTrades.length}</span>
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={handleExportPDF}
                className="text-lux-text-primary dark:text-gray-300 focus:bg-lux-surface-hover dark:focus:bg-white/10 focus:text-white cursor-pointer"
              >
                <FileDown className="w-4 h-4 mr-2 text-blue-400" />
                Export to PDF
                <span className="ml-auto text-xs text-gray-500">{filteredTrades.length}</span>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      {/* Filter & Search Bar */}
      <Card className="bg-lux-bg-card dark:bg-gradient-to-br dark:from-[#0a0c12] dark:to-[#080a14] border-lux-border dark:border-blue-900/30">
        <CardContent className="p-4">
          <div className="flex flex-col sm:flex-row gap-3">
            {/* Search */}
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-lux-text-secondary dark:text-gray-400" />
              <Input
                placeholder="Search symbol or notes..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10 bg-lux-surface-hover dark:bg-white/5 border-lux-input-border dark:border-lux-border dark:border-blue-900/30"
              />
            </div>

            {/* Type Filter */}
            <Select value={filterType} onValueChange={(v: any) => setFilterType(v)}>
              <SelectTrigger className="w-[120px] bg-lux-surface-hover dark:bg-white/5 border-lux-input-border dark:border-lux-border dark:border-blue-900/30">
                <SelectValue placeholder="Type" />
              </SelectTrigger>
              <SelectContent className="bg-lux-bg-card dark:bg-[#0a0c12] border-lux-border dark:border-lux-border dark:border-blue-900/30">
                <SelectItem value="all">All Types</SelectItem>
                <SelectItem value="BUY">BUY</SelectItem>
                <SelectItem value="SELL">SELL</SelectItem>
              </SelectContent>
            </Select>

            {/* Session Filter */}
            <Select value={filterSession} onValueChange={(v: any) => setFilterSession(v)}>
              <SelectTrigger className="w-[140px] bg-lux-surface-hover dark:bg-white/5 border-lux-input-border dark:border-lux-border dark:border-blue-900/30">
                <SelectValue placeholder="Session" />
              </SelectTrigger>
              <SelectContent className="bg-lux-bg-card dark:bg-[#0a0c12] border-lux-border dark:border-lux-border dark:border-blue-900/30">
                <SelectItem value="all">All Sessions</SelectItem>
                <SelectItem value="London">London</SelectItem>
                <SelectItem value="New York">New York</SelectItem>
                <SelectItem value="Asia">Asia</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      <Card className="bg-lux-bg-card dark:bg-gradient-to-br dark:from-[#0a0c12] dark:to-[#080a14] border-lux-border dark:border-blue-900/30">
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-lux-border dark:border-blue-900/30 text-lux-text-secondary dark:text-gray-400">
                  <th className="text-left p-4 font-medium">Symbol</th>
                  <th className="text-left p-4 font-medium">Type</th>
                  <th className="text-left p-4 font-medium hidden lg:table-cell">Setup</th>
                  <th className="text-left p-4 font-medium hidden md:table-cell">Duration</th>
                  <th className="text-left p-4 font-medium hidden md:table-cell">R:R</th>
                  <th className="text-left p-4 font-medium hidden sm:table-cell">Tags</th>
                  <th className="text-left p-4 font-medium hidden sm:table-cell">Entry</th>
                  <th className="text-left p-4 font-medium hidden sm:table-cell">Exit</th>
                  <th className="text-left p-4 font-medium hidden md:table-cell">Session</th>
                  <th className="text-right p-4 font-medium">P/L</th>
                  <th className="text-right p-4 font-medium">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredTrades.length === 0 ? (
                  <tr>
                    <td colSpan={11} className="p-8 text-center text-lux-text-secondary dark:text-gray-400">
                      No trades match your filters
                    </td>
                  </tr>
                ) : (
                  filteredTrades.map((trade) => {
                    // Parse tags from JSON string
                    const tags = safeParseTags(trade.tags)
                    
                    // Calculate duration in readable format
                    const getDurationDisplay = (minutes: number | null | undefined) => {
                      if (!minutes) return '-'
                      if (minutes < 60) return `${minutes}m`
                      const hours = Math.floor(minutes / 60)
                      const mins = minutes % 60
                      return mins > 0 ? `${hours}h ${mins}m` : `${hours}h`
                    }

                    return (
                    <tr key={trade.id} className="border-b border-lux-border dark:border-blue-900/20 hover:bg-lux-surface-hover dark:hover:bg-white/5 transition-colors">
                      <td className="p-4 font-bold">{trade.symbol}</td>
                      <td className="p-4">
                        <Badge variant={trade.type === 'BUY' ? 'default' : 'destructive'} className="text-xs">
                          {trade.type}
                        </Badge>
                      </td>
                      {/* Setup Type */}
                      <td className="p-4 hidden lg:table-cell">
                        {trade.setup_type ? (
                          <Badge variant="outline" className="text-xs border-amber-500/30 text-amber-400">
                            {trade.setup_type}
                          </Badge>
                        ) : (
                          <span className="text-gray-500">-</span>
                        )}
                      </td>
                      {/* Duration */}
                      <td className="p-4 hidden md:table-cell">
                        <div className="flex items-center gap-1 text-lux-text-secondary dark:text-gray-400">
                          <Clock className="w-3 h-3" />
                          <span className="text-xs">{getDurationDisplay(trade.trade_duration)}</span>
                        </div>
                      </td>
                      {/* R:R Ratio */}
                      <td className="p-4 hidden md:table-cell">
                        {trade.risk_reward_ratio ? (
                          <div className="flex items-center gap-1">
                            <Target className="w-3 h-3 text-blue-400" />
                            <span className="text-xs font-medium text-blue-400">1:{trade.risk_reward_ratio}</span>
                          </div>
                        ) : (
                          <span className="text-gray-500">-</span>
                        )}
                      </td>
                      {/* Tags */}
                      <td className="p-4 hidden sm:table-cell">
                        {tags.length > 0 ? (
                          <div className="flex items-center gap-1 flex-wrap">
                            {tags.slice(0, 2).map((tag: string, idx: number) => (
                              <Badge key={idx} variant="outline" className="text-xs border-blue-500/30 text-blue-300">
                                <Tag className="w-2.5 h-2.5 mr-1" />
                                {tag}
                              </Badge>
                            ))}
                            {tags.length > 2 && (
                              <span className="text-xs text-gray-500">+{tags.length - 2}</span>
                            )}
                          </div>
                        ) : (
                          <span className="text-gray-500">-</span>
                        )}
                      </td>
                      {/* Entry */}
                      <td className="p-4 text-lux-text-secondary dark:text-gray-400 hidden sm:table-cell">{trade.open_price}</td>
                      {/* Exit */}
                      <td className="p-4 text-lux-text-secondary dark:text-gray-400 hidden sm:table-cell">{trade.close_price}</td>
                      {/* Session */}
                      <td className="p-4 text-gray-500 hidden md:table-cell">{trade.session || '-'}</td>
                      {/* P/L */}
                      <td className={`p-4 text-right font-bold ${trade.profit_loss >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                        {trade.profit_loss >= 0 ? '+' : ''}{formatCurrency(trade.profit_loss)}
                      </td>
                      {/* Actions */}
                      <td className="p-4">
                        <div className="flex items-center justify-end gap-1">
                          {/* Journal Link */}
                          {trade.linked_journal_id && (
                            <Link2 className="w-4 h-4 text-amber-400" />
                          )}
                          {/* Image Attachment Indicator */}
                          {trade.image_url && (
                            <ImageIcon className="w-4 h-4 text-blue-400" />
                          )}
                          <button
                            onClick={() => onView(trade)}
                            className="p-1.5 rounded-lg hover:bg-lux-surface-hover dark:hover:bg-white/10 text-lux-text-secondary dark:text-gray-400 hover:text-lux-text-primary dark:hover:text-white transition-colors"
                            title="View trade"
                          >
                            <ViewIcon className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => onEdit(trade)}
                            className="p-1.5 rounded-lg hover:bg-lux-surface-hover dark:hover:bg-white/10 text-lux-text-secondary dark:text-gray-400 hover:text-blue-400 transition-colors"
                            title="Edit trade"
                          >
                            <Edit className="w-4 h-4" />
                          </button>
                          {onDuplicate && (
                            <button
                              onClick={() => handleDuplicate(trade)}
                              className="p-1.5 rounded-lg hover:bg-lux-surface-hover dark:hover:bg-white/10 text-lux-text-secondary dark:text-gray-400 hover:text-amber-400 transition-colors"
                              title="Duplicate trade"
                            >
                              <Copy className="w-4 h-4" />
                            </button>
                          )}
                          <button
                            onClick={() => onDelete(trade)}
                            className="p-1.5 rounded-lg hover:bg-lux-surface-hover dark:hover:bg-white/10 text-lux-text-secondary dark:text-gray-400 hover:text-red-400 transition-colors"
                            title="Delete trade"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  )})
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

export default TradesTab