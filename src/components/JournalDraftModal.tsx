'use client'

import { useState, useEffect } from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Badge } from '@/components/ui/badge'
import { CheckCircle2, AlertCircle, Edit3, Save, X, Calendar, Clock, TrendingUp, Info } from 'lucide-react'
import { toast } from 'sonner'
import { formatWIBDate, convertToWIB, getTimezoneInfo } from '@/lib/timezone'

interface JournalDraftData {
  title: string
  content: string
  mood: string
  market_condition: string
  tags: string
  image_url?: string

  // Trade data from AI
  tradeData?: {
    symbol: string
    type: 'BUY' | 'SELL'
    open_price: number
    close_price: number
    lot_size: number
    profit_loss: number
    open_time: string
    close_time: string
    session?: string
    notes?: string
    image_url?: string
    screenshot_url?: string
  }
}

interface JournalDraftModalProps {
  isOpen: boolean
  onClose: () => void
  onSave: (data: JournalDraftData, saveTrade?: boolean) => Promise<void>
  initialData?: Partial<JournalDraftData>
  showTradeData?: boolean
}

export default function JournalDraftModal({
  isOpen,
  onClose,
  onSave,
  initialData,
  showTradeData = false
}: JournalDraftModalProps) {
  const [saving, setSaving] = useState(false)
  const [saveTrade, setSaveTrade] = useState(true)

  // Form state
  const [formData, setFormData] = useState<JournalDraftData>({
    title: '',
    content: '',
    mood: '',
    market_condition: '',
    tags: '',
    image_url: initialData?.image_url || '',
    tradeData: initialData?.tradeData
  })

  // Trade editing state
  const [editingTrade, setEditingTrade] = useState(false)
  const [tradeFormData, setTradeFormData] = useState(initialData?.tradeData)

  // Initialize form when modal opens
  useEffect(() => {
    if (isOpen && initialData) {
      setFormData({
        title: initialData.title || '',
        content: initialData.content || '',
        mood: initialData.mood || '',
        market_condition: initialData.market_condition || '',
        tags: initialData.tags || '',
        image_url: initialData.image_url || '',
        tradeData: initialData.tradeData
      })

      if (initialData.tradeData) {
        setTradeFormData(initialData.tradeData)
        // Auto-generate title from trade data if no title provided
        if (!initialData.title && initialData.tradeData.symbol) {
          const trade = initialData.tradeData
          setFormData(prev => ({
            ...prev,
            title: `${trade.type} ${trade.symbol} - ${trade.profit_loss >= 0 ? '+' : ''}${trade.profit_loss}`
          }))
        }
      }
    }
  }, [isOpen, initialData])

  const handleFieldChange = (field: keyof JournalDraftData, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }))
  }

  const handleTradeFieldChange = (field: string, value: string | number) => {
    setTradeFormData(prev => prev ? { ...prev, [field]: value } : null)
  }

  const handleSave = async () => {
    // Validate required fields
    if (!formData.title.trim()) {
      toast.error('Judul jurnal wajib diisi')
      return
    }

    if (!formData.content.trim()) {
      toast.error('Konten jurnal wajib diisi')
      return
    }

    setSaving(true)
    try {
      // Apply timezone conversion to trade data if saving trade
      let finalData = { ...formData }

      if (saveTrade && tradeFormData) {
        finalData.tradeData = {
          ...tradeFormData,
          open_time: convertToWIB(tradeFormData.open_time),
          close_time: convertToWIB(tradeFormData.close_time)
        }

        // Log timezone info for debugging
        const openTimeInfo = getTimezoneInfo(tradeFormData.open_time)
        const closeTimeInfo = getTimezoneInfo(tradeFormData.close_time)
        console.log('🕐 Timezone conversion:', { openTimeInfo, closeTimeInfo })
      }

      await onSave(finalData, saveTrade)

      toast.success('Jurnal berhasil disimpan!', {
        description: saveTrade && tradeFormData ? 'Trade juga ditambahkan ke database.' : ''
      })
      onClose()
    } catch (error: any) {
      console.error('Error saving journal:', error)
      toast.error(error.message || 'Gagal menyimpan jurnal')
    } finally {
      setSaving(false)
    }
  }

  const handleCancel = () => {
    onClose()
  }

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="bg-[#080b12] border-blue-900/30 text-white max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-xl font-bold bg-gradient-to-r from-cyan-300 via-cyan-400 to-cyan-300 bg-clip-text text-transparent">
            {showTradeData ? 'Review & Finalisasi Jurnal' : 'Buat Jurnal Baru'}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-6 py-4">
          {/* Trade Data Section - Read Only */}
          {showTradeData && tradeFormData && (
            <div className="bg-gradient-to-r from-blue-500/10 to-cyan-600/10 rounded-xl border border-blue-900/30 p-4">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <TrendingUp className="w-5 h-5 text-cyan-400" />
                  <h3 className="font-semibold text-cyan-300">Data Trade (AI Extracted)</h3>
                  <Badge variant={tradeFormData.profit_loss >= 0 ? 'default' : 'destructive'} className="ml-2">
                    {tradeFormData.profit_loss >= 0 ? 'PROFIT' : 'LOSS'}
                  </Badge>
                </div>
                {!editingTrade ? (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setEditingTrade(true)}
                    className="border-blue-900/30 hover:bg-blue-500/10"
                  >
                    <Edit3 className="w-4 h-4 mr-2" />
                    Edit
                  </Button>
                ) : (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setEditingTrade(false)}
                    className="border-red-500/30 hover:bg-red-500/10 text-red-400"
                  >
                    <X className="w-4 h-4 mr-2" />
                    Batal Edit
                  </Button>
                )}
              </div>

              {/* Trade Data Display */}
              {!editingTrade ? (
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  <div className="bg-[#070a10] rounded-lg p-3 border border-blue-900/20">
                    <p className="text-xs text-gray-400 mb-1">Symbol</p>
                    <p className="text-lg font-bold text-white">{tradeFormData.symbol}</p>
                  </div>
                  <div className="bg-[#070a10] rounded-lg p-3 border border-blue-900/20">
                    <p className="text-xs text-gray-400 mb-1">Type</p>
                    <p className={`text-lg font-bold ${tradeFormData.type === 'BUY' ? 'text-emerald-400' : 'text-red-400'}`}>
                      {tradeFormData.type}
                    </p>
                  </div>
                  <div className="bg-[#070a10] rounded-lg p-3 border border-blue-900/20">
                    <p className="text-xs text-gray-400 mb-1">Lot Size</p>
                    <p className="text-lg font-bold text-white">{tradeFormData.lot_size}</p>
                  </div>
                  <div className="bg-[#070a10] rounded-lg p-3 border border-blue-900/20">
                    <p className="text-xs text-gray-400 mb-1">P/L</p>
                    <p className={`text-lg font-bold ${tradeFormData.profit_loss >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                      ${tradeFormData.profit_loss.toFixed(2)}
                    </p>
                  </div>

                  <div className="bg-[#070a10] rounded-lg p-3 border border-blue-900/20">
                    <p className="text-xs text-gray-400 mb-1">Open Price</p>
                    <p className="text-sm font-semibold text-white">{tradeFormData.open_price.toFixed(5)}</p>
                  </div>
                  <div className="bg-[#070a10] rounded-lg p-3 border border-blue-900/20">
                    <p className="text-xs text-gray-400 mb-1">Close Price</p>
                    <p className="text-sm font-semibold text-white">{tradeFormData.close_price.toFixed(5)}</p>
                  </div>
                  <div className="bg-[#070a10] rounded-lg p-3 border border-blue-900/20">
                    <div className="flex items-center gap-1 mb-1">
                      <Clock className="w-3 h-3 text-gray-400" />
                      <p className="text-xs text-gray-400">Open Time</p>
                    </div>
                    <p className="text-xs font-semibold text-cyan-300">{formatWIBDate(tradeFormData.open_time)}</p>
                  </div>
                  <div className="bg-[#070a10] rounded-lg p-3 border border-blue-900/20">
                    <div className="flex items-center gap-1 mb-1">
                      <Clock className="w-3 h-3 text-gray-400" />
                      <p className="text-xs text-gray-400">Close Time</p>
                    </div>
                    <p className="text-xs font-semibold text-cyan-300">{formatWIBDate(tradeFormData.close_time)}</p>
                  </div>
                </div>
              ) : (
                <div className="space-y-3">
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <Label className="text-xs text-gray-400">Symbol</Label>
                      <Input
                        value={tradeFormData.symbol}
                        onChange={(e) => handleTradeFieldChange('symbol', e.target.value)}
                        className="bg-[#070a10] border-blue-900/30 mt-1"
                      />
                    </div>
                    <div>
                      <Label className="text-xs text-gray-400">Type</Label>
                      <Select
                        value={tradeFormData.type}
                        onValueChange={(value) => handleTradeFieldChange('type', value)}
                      >
                        <SelectTrigger className="bg-[#070a10] border-blue-900/30 mt-1">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent className="bg-[#080b12] border-blue-900/30">
                          <SelectItem value="BUY">BUY</SelectItem>
                          <SelectItem value="SELL">SELL</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <Label className="text-xs text-gray-400">Open Price</Label>
                      <Input
                        type="number"
                        step="0.00001"
                        value={tradeFormData.open_price}
                        onChange={(e) => handleTradeFieldChange('open_price', parseFloat(e.target.value))}
                        className="bg-[#070a10] border-blue-900/30 mt-1"
                      />
                    </div>
                    <div>
                      <Label className="text-xs text-gray-400">Close Price</Label>
                      <Input
                        type="number"
                        step="0.00001"
                        value={tradeFormData.close_price}
                        onChange={(e) => handleTradeFieldChange('close_price', parseFloat(e.target.value))}
                        className="bg-[#070a10] border-blue-900/30 mt-1"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <Label className="text-xs text-gray-400">Lot Size</Label>
                      <Input
                        type="number"
                        step="0.01"
                        min="0.01"
                        value={tradeFormData.lot_size}
                        onChange={(e) => handleTradeFieldChange('lot_size', parseFloat(e.target.value))}
                        className="bg-[#070a10] border-blue-900/30 mt-1"
                      />
                    </div>
                    <div>
                      <Label className="text-xs text-gray-400">Profit/Loss</Label>
                      <Input
                        type="number"
                        step="0.01"
                        value={tradeFormData.profit_loss}
                        onChange={(e) => handleTradeFieldChange('profit_loss', parseFloat(e.target.value))}
                        className="bg-[#070a10] border-blue-900/30 mt-1"
                      />
                    </div>
                  </div>

                  <div>
                    <Label className="text-xs text-gray-400">Session</Label>
                    <Select
                      value={tradeFormData.session || ''}
                      onValueChange={(value) => handleTradeFieldChange('session', value)}
                    >
                      <SelectTrigger className="bg-[#070a10] border-blue-900/30 mt-1">
                        <SelectValue placeholder="Pilih session" />
                      </SelectTrigger>
                      <SelectContent className="bg-[#080b12] border-blue-900/30">
                        <SelectItem value="London">London</SelectItem>
                        <SelectItem value="New York">New York</SelectItem>
                        <SelectItem value="Asia">Asia</SelectItem>
                        <SelectItem value="Off-Market">Off-Market</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              )}

              {/* Checkbox to save trade */}
              <div className="flex items-center gap-3 mt-4 p-3 bg-[#070a10] rounded-lg border border-blue-900/20">
                <input
                  type="checkbox"
                  id="saveTrade"
                  checked={saveTrade}
                  onChange={(e) => setSaveTrade(e.target.checked)}
                  className="w-4 h-4 rounded border-blue-900/30 text-blue-500 focus:ring-blue-500 focus:ring-offset-[#070a10]"
                />
                <label htmlFor="saveTrade" className="text-sm text-gray-300 cursor-pointer flex items-center gap-2">
                  <Save className="w-4 h-4" />
                  Simpan data trade ke database
                </label>
                <Info className="w-4 h-4 text-gray-500" title="Data trade akan tersimpan di tab Trades dan bisa diedit nanti" />
              </div>
            </div>
          )}

          {/* Journal Form */}
          <div className="space-y-4">
            <div>
              <Label htmlFor="title" className="flex items-center gap-2">
                Judul Jurnal *
                <CheckCircle2 className="w-4 h-4 text-emerald-400 opacity-0 transition-opacity" />
              </Label>
              <Input
                id="title"
                placeholder="Contoh: GBPUSD Buy Setup - Breakout Resistance"
                className="bg-[#070a10] border-blue-900/30 mt-1"
                value={formData.title}
                onChange={(e) => handleFieldChange('title', e.target.value)}
              />
            </div>

            <div>
              <Label htmlFor="content" className="flex items-center gap-2">
                Konten Jurnal *
              </Label>
              <Textarea
                id="content"
                placeholder="Deskripsikan analisis Anda, setup yang diambil, dan hasilnya..."
                className="bg-[#070a10] border-blue-900/30 mt-1 resize-none"
                rows={6}
                value={formData.content}
                onChange={(e) => handleFieldChange('content', e.target.value)}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="mood">Mood</Label>
                <Select value={formData.mood} onValueChange={(value) => handleFieldChange('mood', value)}>
                  <SelectTrigger id="mood" className="bg-[#070a10] border-blue-900/30 mt-1">
                    <SelectValue placeholder="Pilih mood" />
                  </SelectTrigger>
                  <SelectContent className="bg-[#080b12] border-blue-900/30">
                    <SelectItem value="confident">😎 Confident</SelectItem>
                    <SelectItem value="neutral">😐 Neutral</SelectItem>
                    <SelectItem value="anxious">😰 Anxious</SelectItem>
                    <SelectItem value="fearful">😨 Fearful</SelectItem>
                    <SelectItem value="excited">🤩 Excited</SelectItem>
                    <SelectItem value="disappointed">😞 Disappointed</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label htmlFor="market_condition">Market Condition</Label>
                <Select
                  value={formData.market_condition}
                  onValueChange={(value) => handleFieldChange('market_condition', value)}
                >
                  <SelectTrigger id="market_condition" className="bg-[#070a10] border-blue-900/30 mt-1">
                    <SelectValue placeholder="Pilih kondisi market" />
                  </SelectTrigger>
                  <SelectContent className="bg-[#080b12] border-blue-900/30">
                    <SelectItem value="trending">📈 Trending</SelectItem>
                    <SelectItem value="ranging">↔️ Ranging</SelectItem>
                    <SelectItem value="volatile">🌊 Volatile</SelectItem>
                    <SelectItem value="quiet">🔇 Quiet</SelectItem>
                    <SelectItem value="breaking">💥 Breaking News</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div>
              <Label htmlFor="tags">Tags (comma separated)</Label>
              <Input
                id="tags"
                placeholder="breakout, support, resistance, gold"
                className="bg-[#070a10] border-blue-900/30 mt-1"
                value={formData.tags}
                onChange={(e) => handleFieldChange('tags', e.target.value)}
              />
            </div>
          </div>
        </div>

        <DialogFooter className="gap-3">
          <Button
            variant="outline"
            onClick={handleCancel}
            className="border-blue-900/30 hover:bg-white/5"
          >
            <X className="w-4 h-4 mr-2" />
            Batal
          </Button>
          <Button
            onClick={handleSave}
            disabled={saving}
            className="bg-gradient-to-r from-blue-500 to-cyan-600 hover:from-blue-600 hover:to-cyan-600"
          >
            {saving ? (
              <>
                <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin mr-2" />
                Menyimpan...
              </>
            ) : (
              <>
                <Save className="w-4 h-4 mr-2" />
                Simpan Jurnal
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}