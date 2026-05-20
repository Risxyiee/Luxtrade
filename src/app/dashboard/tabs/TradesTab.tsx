'use client'

import { useState, useMemo } from 'react'
import { Activity, Search, Upload, Download, FileText, View as ViewIcon, Edit, Trash2, RefreshCw, Clock, Target, Tag, Link2, Image as ImageIcon } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { toast } from 'sonner'
import { formatCurrency } from '@/lib/supabase'

// ==================== INTERFACES ====================

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
  image_url?: string | null
  trade_duration?: number | null
  risk_reward_ratio?: number | null
  tags?: string | null
  setup_type?: string | null
  linked_journal_id?: string | null
}

// ==================== TRADES TAB COMPONENT ====================

interface TradesTabProps {
  trades: Trade[]
  loading: boolean
  onView: (trade: Trade) => void
  onEdit: (trade: Trade) => void
  onDelete: (trade: Trade) => void
  onImport: () => void
  onSmartImport: () => void
}

function TradesTab({
  trades,
  loading,
  onView,
  onEdit,
  onDelete,
  onImport,
  onSmartImport
}: TradesTabProps) {
  const [searchTerm, setSearchTerm] = useState('')
  const [filterType, setFilterType] = useState<'all' | 'BUY' | 'SELL'>('all')
  const [filterSession, setFilterSession] = useState<'all' | 'London' | 'New York' | 'Asia'>('all')

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

  // Export CSV
  const handleExportCSV = () => {
    // Safety check - document.createElement only available in browser
    if (typeof document === 'undefined') return

    const headers = ['Symbol','Type','Setup Type','Entry','Exit','Lot Size','P/L','Duration','R:R Ratio','Tags','Session','Open Time','Close Time','Notes','Journal Link']
    const rows = filteredTrades.map(t => {
      const tags = t.tags ? JSON.parse(t.tags) : []
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
    const csvContent = [headers, ...rows].map(row => row.map(cell => `"${cell}"`).join(',')).join('\n')
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    const date = new Date().toISOString().slice(0, 10)
    link.href = url
    link.download = `luxtrade-trades-${date}.csv`
    link.click()
    URL.revokeObjectURL(url)
    toast.success('Trades exported successfully!')
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <RefreshCw className="w-8 h-8 animate-spin text-purple-400" />
      </div>
    )
  }

  if (trades.length === 0) {
    return (
      <Card className="bg-gradient-to-br from-[#0f0b18] to-[#12091a] border-purple-900/30">
        <CardContent className="py-16 text-center">
          <Activity className="w-12 h-12 mx-auto mb-4 text-gray-500" />
          <h3 className="text-lg font-semibold mb-2">No Trades Yet</h3>
          <p className="text-gray-400">Add your first trade or import from MetaTrader!</p>
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h3 className="text-xl font-bold">Trade History</h3>
          <p className="text-sm text-gray-400">{filteredTrades.length} of {trades.length} trades</p>
        </div>
        <div className="flex gap-2">
          <Button onClick={onSmartImport} variant="outline" className="border-purple-500/30 text-purple-400">
            <Upload className="w-4 h-4 mr-2" /> Smart Import
          </Button>
          <Button onClick={onImport} className="bg-gradient-to-r from-purple-500 to-violet-600">
            <FileText className="w-4 h-4 mr-2" /> Import CSV
          </Button>
          <Button onClick={handleExportCSV} variant="outline" className="border-emerald-500/30 text-emerald-400">
            <Download className="w-4 h-4 mr-2" /> Export CSV
          </Button>
        </div>
      </div>

      {/* Filter & Search Bar */}
      <Card className="bg-gradient-to-br from-[#0f0b18] to-[#12091a] border-purple-900/30">
        <CardContent className="p-4">
          <div className="flex flex-col sm:flex-row gap-3">
            {/* Search */}
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <Input
                placeholder="Search symbol or notes..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10 bg-white/5 border-purple-900/30"
              />
            </div>

            {/* Type Filter */}
            <Select value={filterType} onValueChange={(v: any) => setFilterType(v)}>
              <SelectTrigger className="w-[120px] bg-white/5 border-purple-900/30">
                <SelectValue placeholder="Type" />
              </SelectTrigger>
              <SelectContent className="bg-[#0f0b18] border-purple-900/30">
                <SelectItem value="all">All Types</SelectItem>
                <SelectItem value="BUY">BUY</SelectItem>
                <SelectItem value="SELL">SELL</SelectItem>
              </SelectContent>
            </Select>

            {/* Session Filter */}
            <Select value={filterSession} onValueChange={(v: any) => setFilterSession(v)}>
              <SelectTrigger className="w-[140px] bg-white/5 border-purple-900/30">
                <SelectValue placeholder="Session" />
              </SelectTrigger>
              <SelectContent className="bg-[#0f0b18] border-purple-900/30">
                <SelectItem value="all">All Sessions</SelectItem>
                <SelectItem value="London">London</SelectItem>
                <SelectItem value="New York">New York</SelectItem>
                <SelectItem value="Asia">Asia</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      <Card className="bg-gradient-to-br from-[#0f0b18] to-[#12091a] border-purple-900/30">
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-purple-900/30 text-gray-400">
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
                    <td colSpan={11} className="p-8 text-center text-gray-400">
                      No trades match your filters
                    </td>
                  </tr>
                ) : (
                  filteredTrades.map((trade) => {
                    // Parse tags from JSON string
                    const tags = trade.tags ? JSON.parse(trade.tags) : []
                    
                    // Calculate duration in readable format
                    const getDurationDisplay = (minutes: number | null | undefined) => {
                      if (!minutes) return '-'
                      if (minutes < 60) return `${minutes}m`
                      const hours = Math.floor(minutes / 60)
                      const mins = minutes % 60
                      return mins > 0 ? `${hours}h ${mins}m` : `${hours}h`
                    }

                    return (
                    <tr key={trade.id} className="border-b border-purple-900/20 hover:bg-white/5 transition-colors">
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
                        <div className="flex items-center gap-1 text-gray-400">
                          <Clock className="w-3 h-3" />
                          <span className="text-xs">{getDurationDisplay(trade.trade_duration)}</span>
                        </div>
                      </td>
                      {/* R:R Ratio */}
                      <td className="p-4 hidden md:table-cell">
                        {trade.risk_reward_ratio ? (
                          <div className="flex items-center gap-1">
                            <Target className="w-3 h-3 text-purple-400" />
                            <span className="text-xs font-medium text-purple-400">1:{trade.risk_reward_ratio}</span>
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
                              <Badge key={idx} variant="outline" className="text-xs border-purple-500/30 text-purple-300">
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
                      <td className="p-4 text-gray-400 hidden sm:table-cell">{trade.open_price}</td>
                      {/* Exit */}
                      <td className="p-4 text-gray-400 hidden sm:table-cell">{trade.close_price}</td>
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
                            <Link2 className="w-4 h-4 text-amber-400" title="Linked to Journal" />
                          )}
                          {/* Image Attachment Indicator */}
                          {trade.image_url && (
                            <ImageIcon className="w-4 h-4 text-purple-400" title="Has Image" />
                          )}
                          <button
                            onClick={() => onView(trade)}
                            className="p-1.5 rounded-lg hover:bg-white/10 text-gray-400 hover:text-white transition-colors"
                          >
                            <ViewIcon className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => onEdit(trade)}
                            className="p-1.5 rounded-lg hover:bg-white/10 text-gray-400 hover:text-purple-400 transition-colors"
                          >
                            <Edit className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => onDelete(trade)}
                            className="p-1.5 rounded-lg hover:bg-white/10 text-gray-400 hover:text-red-400 transition-colors"
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
