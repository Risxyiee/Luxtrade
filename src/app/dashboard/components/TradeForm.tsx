'use client'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { TradeFormData } from '../utils/types'

interface TradeFormProps {
  formData: TradeFormData
  onFormChange: (field: keyof TradeFormData, value: string) => void
  onTypeChange: (value: string) => void
  onSessionChange: (value: string) => void
  onNumberInput: (field: keyof TradeFormData, e: React.ChangeEvent<HTMLInputElement>) => void
  onSave: () => void
  onCancel: () => void
  isEdit?: boolean
  saving?: boolean
}

function TradeForm({
  formData,
  onFormChange,
  onTypeChange,
  onSessionChange,
  onNumberInput,
  onSave,
  onCancel,
  isEdit = false,
  saving = false
}: TradeFormProps) {
  const { datetimeLocalToFormat } = require('../utils/helpers')

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-4">
        <div>
          <Label>Symbol *</Label>
          <Input
            placeholder="EURUSD"
            className="bg-[#0a0712] border-purple-900/30 mt-1"
            value={formData.symbol}
            onChange={(e) => onFormChange('symbol', e.target.value)}
          />
        </div>
        <div>
          <Label>Type</Label>
          <Select value={formData.type} onValueChange={onTypeChange}>
            <SelectTrigger className="bg-[#0a0712] border-purple-900/30 mt-1">
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
          <Label>Open Price *</Label>
          <Input
            type="text"
            inputMode="decimal"
            placeholder="1.0850"
            className="bg-[#0a0712] border-purple-900/30 mt-1"
            value={formData.open_price}
            onChange={(e) => onNumberInput('open_price', e)}
          />
        </div>
        <div>
          <Label>Close Price *</Label>
          <Input
            type="text"
            inputMode="decimal"
            placeholder="1.0890"
            className="bg-[#0a0712] border-purple-900/30 mt-1"
            value={formData.close_price}
            onChange={(e) => onNumberInput('close_price', e)}
          />
        </div>
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div>
          <Label>Lot Size</Label>
          <Input
            type="text"
            inputMode="decimal"
            placeholder="0.1"
            className="bg-[#0a0712] border-purple-900/30 mt-1"
            value={formData.lot_size}
            onChange={(e) => onNumberInput('lot_size', e)}
          />
        </div>
        <div>
          <Label>P/L ($) *</Label>
          <Input
            type="text"
            inputMode="decimal"
            placeholder="400"
            className="bg-[#0a0712] border-purple-900/30 mt-1"
            value={formData.profit_loss}
            onChange={(e) => onNumberInput('profit_loss', e)}
          />
        </div>
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div>
          <Label>Open Time</Label>
          <Input
            type="datetime-local"
            className="bg-[#0a0712] border-purple-900/30 mt-1"
            value={formData.open_time ? formData.open_time.slice(0, 16) : ''}
            onChange={(e) => onFormChange('open_time', e.target.value ? datetimeLocalToFormat(e.target.value) : '')}
          />
        </div>
        <div>
          <Label>Close Time</Label>
          <Input
            type="datetime-local"
            className="bg-[#0a0712] border-purple-900/30 mt-1"
            value={formData.close_time ? formData.close_time.slice(0, 16) : ''}
            onChange={(e) => onFormChange('close_time', e.target.value ? datetimeLocalToFormat(e.target.value) : '')}
          />
        </div>
      </div>
      <div>
        <Label>Session</Label>
        <Select value={formData.session} onValueChange={onSessionChange}>
          <SelectTrigger className="bg-[#0a0712] border-purple-900/30 mt-1">
            <SelectValue placeholder="Select session" />
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
        <Label>Notes</Label>
        <Textarea
          placeholder="Trade notes, setup, emotions..."
          className="bg-[#0a0712] border-purple-900/30 mt-1 resize-none"
          rows={3}
          value={formData.notes}
          onChange={(e) => onFormChange('notes', e.target.value)}
        />
      </div>
      {/* Image Upload */}
      <div>
        <Label>Trade Screenshot (Optional)</Label>
        <Input
          type="file"
          accept="image/*"
          className="bg-[#0a0712] border-purple-900/30 mt-1"
          onChange={(e) => {
            const file = e.target.files?.[0]
            if (file) {
              // For now, store as base64 data URL
              const reader = new FileReader()
              reader.onload = (ev) => {
                onFormChange('image_url', ev.target?.result as string || '')
              }
              reader.readAsDataURL(file)
            }
          }}
        />
        {formData.image_url && (
          <div className="mt-2">
            <img
              src={formData.image_url}
              alt="Trade preview"
              className="w-full h-32 object-cover rounded-lg border border-purple-900/30"
            />
          </div>
        )}
      </div>
      <div className="flex gap-3 pt-2">
        <Button
          onClick={onSave}
          disabled={saving}
          className="flex-1 bg-gradient-to-r from-purple-500 to-violet-600"
        >
          {saving ? 'Saving...' : isEdit ? 'Update Trade' : 'Add Trade'}
        </Button>
        <Button
          variant="outline"
          onClick={onCancel}
          className="border-purple-900/30"
        >
          Cancel
        </Button>
      </div>
    </div>
  )
}

export default TradeForm
