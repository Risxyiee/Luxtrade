'use client'

import { useState, useEffect } from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Badge } from '@/components/ui/badge'
import { CheckCircle2, AlertCircle, Save, X, Edit3, Calendar, Clock, TrendingUp } from 'lucide-react'
import { toast } from 'sonner'
import { formatWIBDate, convertToWIB, getTimezoneInfo } from '@/lib/timezone'

interface EditTradeModalProps {
  isOpen: boolean
  onClose: () => void
  onUpdate: (tradeId: string, updatedData: any) => Promise<void>
  trade: {
    id: string
    symbol: string
    type: 'BUY' | 'SELL'
    open_price: number
    close_price: number
    lot_size: number
    profit_loss: number
    open_time: string
    close_time: string
    session?: string | null
    notes?: string | null
    image_url?: string | null
    screenshot_url?: string | null
  }
}

export default function EditTradeModal({
  isOpen,
  onClose,
  onUpdate,
  trade
}: EditTradeModalProps) {
  const [saving, setSaving] = useState(false)

  const [formData, setFormData] = useState({
    symbol: trade.symbol,
    type: trade.type,
    open_price: trade.open_price,
    close_price: trade.close_price,
    lot_size: trade.lot_size,
    profit_loss: trade.profit_loss,
    open_time: trade.open_time,
    close_time: trade.close_time,
    session: trade.session || '',
    notes: trade.notes || ''
  })

  // Reset form when trade changes
  useEffect(() => {
    setFormData({
      symbol: trade.symbol,
      type: trade.type,
      open_price: trade.open_price,
      close_price: trade.close_price,
      lot_size: trade.lot_size,
      profit_loss: trade.profit_loss,
      open_time: trade.open_time,
      close_time: trade.close_time,
      session: trade.session || '',
      notes: trade.notes || ''
    })
  }, [trade])

  const handleFieldChange = (field: string, value: string | number) => {
    setFormData(prev => ({ ...prev, [field]: value }))
  }

  const handleUpdate = async () => {
    // Validate required fields
    if (!formData.symbol.trim()) {
      toast.error('Symbol wajib diisi')
      return
    }

    if (formData.open_price <= 0) {
      toast.error('Open price harus lebih dari 0')
      return
    }

    if (formData.close_price <= 0) {
      toast.error('Close price harus lebih dari 0')
      return
    }

    if (formData.lot_size <= 0) {
      toast.error('Lot size harus lebih dari 0')
      return
    }

    setSaving(true)
    try {
      // Apply timezone conversion
      const updatedData = {
        ...formData,
        open_time: convertToWIB(formData.open_time),
        close_time: convertToWIB(formData.close_time)
      }

      // Log timezone info for debugging
      const openTimeInfo = getTimezoneInfo(formData.open_time)
      const closeTimeInfo = getTimezoneInfo(formData.close_time)
      console.log('🕐 Timezone conversion:', { openTimeInfo, closeTimeInfo })

      await onUpdate(trade.id, updatedData)

      toast.success('Trade berhasil diperbarui!')
      onClose()
    } catch (error: any) {
      console.error('Error updating trade:', error)
      toast.error(error.message || 'Gagal memperbarui trade')
    } finally {
      setSaving(false)
    }
  }

  const handleCancel = () => {
    onClose()
  }

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="bg-[#0f0b18] border-purple-900/30 text-white max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-xl font-bold bg-gradient-to-r from-purple-300 via-purple-400 to-pink-400 bg-clip-text text-transparent">
            Edit Trade
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Quick Stats */}
          <div className="grid grid-cols-3 gap-3 mb-6">
            <div className="bg-gradient-to-br from-purple-500/20 to-violet-600/20 rounded-lg p-3 border border-purple-900/30">
              <p className="text-xs text-purple-300 mb-1">Symbol</p>
              <p className="text-lg font-bold">{formData.symbol}</p>
            </div>
            <div className="bg-gradient-to-br from-purple-500/20 to-violet-600/20 rounded-lg p-3 border border-purple-900/30">
              <p className="text-xs text-purple-300 mb-1">Type</p>
              <Badge className={`${formData.type === 'BUY' ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30' : 'bg-red-500/20 text-red-400 border-red-500/30'}`}>
                {formData.type}
              </Badge>
            </div>
            <div className="bg-gradient-to-br from-purple-500/20 to-violet-600/20 rounded-lg p-3 border border-purple-900/30">
              <p className="text-xs text-purple-300 mb-1">P/L</p>
              <p className={`text-lg font-bold ${formData.profit_loss >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                ${formData.profit_loss.toFixed(2)}
              </p>
            </div>
          </div>

          {/* Edit Form */}
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="symbol" className="flex items-center gap-2">
                  Symbol *
                  <CheckCircle2 className="w-4 h-4 text-emerald-400 opacity-0 transition-opacity" />
                </Label>
                <Input
                  id="symbol"
                  placeholder="EURUSD"
                  className="bg-[#0a0712] border-purple-900/30 mt-1"
                  value={formData.symbol}
                  onChange={(e) => handleFieldChange('symbol', e.target.value)}
                />
              </div>

              <div>
                <Label htmlFor="type">Type</Label>
                <Select
                  value={formData.type}
                  onValueChange={(value) => handleFieldChange('type', value)}
                >
                  <SelectTrigger id="type" className="bg-[#0a0712] border-purple-900/30 mt-1">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="bg-[#0f0b18] border-purple-900/30">
                    <SelectItem value="BUY">BUY</SelectItem>
                    <SelectItem value="SELL">SELL</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="open_price" className="flex items-center gap-2">
                  Open Price *
                  <CheckCircle2 className="w-4 h-4 text-emerald-400 opacity-0 transition-opacity" />
                </Label>
                <Input
                  id="open_price"
                  type="number"
                  step="0.00001"
                  placeholder="1.0850"
                  className="bg-[#0a0712] border-purple-900/30 mt-1"
                  value={formData.open_price}
                  onChange={(e) => handleFieldChange('open_price', parseFloat(e.target.value))}
                />
              </div>

              <div>
                <Label htmlFor="close_price" className="flex items-center gap-2">
                  Close Price *
                  <CheckCircle2 className="w-4 h-4 text-emerald-400 opacity-0 transition-opacity" />
                </Label>
                <Input
                  id="close_price"
                  type="number"
                  step="0.00001"
                  placeholder="1.0890"
                  className="bg-[#0a0712] border-purple-900/30 mt-1"
                  value={formData.close_price}
                  onChange={(e) => handleFieldChange('close_price', parseFloat(e.target.value))}
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="lot_size" className="flex items-center gap-2">
                  Lot Size *
                  <CheckCircle2 className="w-4 h-4 text-emerald-400 opacity-0 transition-opacity" />
                </Label>
                <Input
                  id="lot_size"
                  type="number"
                  step="0.01"
                  min="0.01"
                  placeholder="0.1"
                  className="bg-[#0a0712] border-purple-900/30 mt-1"
                  value={formData.lot_size}
                  onChange={(e) => handleFieldChange('lot_size', parseFloat(e.target.value))}
                />
              </div>

              <div>
                <Label htmlFor="profit_loss" className="flex items-center gap-2">
                  Profit/Loss *
                  <CheckCircle2 className="w-4 h-4 text-emerald-400 opacity-0 transition-opacity" />
                </Label>
                <Input
                  id="profit_loss"
                  type="number"
                  step="0.01"
                  placeholder="100"
                  className="bg-[#0a0712] border-purple-900/30 mt-1"
                  value={formData.profit_loss}
                  onChange={(e) => handleFieldChange('profit_loss', parseFloat(e.target.value))}
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="open_time" className="flex items-center gap-2">
                  <Clock className="w-4 h-4" />
                  Open Time *
                </Label>
                <Input
                  id="open_time"
                  type="datetime-local"
                  className="bg-[#0a0712] border-purple-900/30 mt-1"
                  value={formData.open_time ? formData.open_time.slice(0, 16) : ''}
                  onChange={(e) => handleFieldChange('open_time', e.target.value ? e.target.value + ':00' : '')}
                />
                <p className="text-[10px] text-purple-300 mt-1">
                  {formatWIBDate(formData.open_time)}
                </p>
              </div>

              <div>
                <Label htmlFor="close_time" className="flex items-center gap-2">
                  <Clock className="w-4 h-4" />
                  Close Time *
                </Label>
                <Input
                  id="close_time"
                  type="datetime-local"
                  className="bg-[#0a0712] border-purple-900/30 mt-1"
                  value={formData.close_time ? formData.close_time.slice(0, 16) : ''}
                  onChange={(e) => handleFieldChange('close_time', e.target.value ? e.target.value + ':00' : '')}
                />
                <p className="text-[10px] text-purple-300 mt-1">
                  {formatWIBDate(formData.close_time)}
                </p>
              </div>
            </div>

            <div>
              <Label htmlFor="session">Session</Label>
              <Select
                value={formData.session}
                onValueChange={(value) => handleFieldChange('session', value)}
              >
                <SelectTrigger id="session" className="bg-[#0a0712] border-purple-900/30 mt-1">
                  <SelectValue placeholder="Pilih session" />
                </SelectTrigger>
                <SelectContent className="bg-[#0f0b18] border-purple-900/30">
                  <SelectItem value="London">London</SelectItem>
                  <SelectItem value="New York">New York</SelectItem>
                  <SelectItem value="Asia">Asia</SelectItem>
                  <SelectItem value="Off-Market">Off-Market</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label htmlFor="notes">Notes</Label>
              <Input
                id="notes"
                placeholder="Additional notes..."
                className="bg-[#0a0712] border-purple-900/30 mt-1"
                value={formData.notes}
                onChange={(e) => handleFieldChange('notes', e.target.value)}
              />
            </div>
          </div>
        </div>

        <DialogFooter className="gap-3">
          <Button
            variant="outline"
            onClick={handleCancel}
            className="border-purple-900/30 hover:bg-white/5"
          >
            <X className="w-4 h-4 mr-2" />
            Batal
          </Button>
          <Button
            onClick={handleUpdate}
            disabled={saving}
            className="bg-gradient-to-r from-purple-500 to-violet-600 hover:from-purple-600 hover:to-violet-700"
          >
            {saving ? (
              <>
                <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin mr-2" />
                Menyimpan...
              </>
            ) : (
              <>
                <Save className="w-4 h-4 mr-2" />
                Simpan Perubahan
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}