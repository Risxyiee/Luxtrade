'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { CheckCircle2, AlertCircle, Upload, X, Info } from 'lucide-react'
import { TradeFormData } from '../utils/types'
import { datetimeLocalToFormat } from '../utils/helpers'

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
  // Form validation state
  const [touched, setTouched] = useState<Record<string, boolean>>({})
  const [errors, setErrors] = useState<Record<string, string>>({})

  // Validate field
  const validateField = (field: keyof TradeFormData, value: string): string => {
    switch (field) {
      case 'symbol':
        if (!value.trim()) return 'Symbol is required'
        if (value.length < 2) return 'Symbol must be at least 2 characters'
        return ''
      case 'open_price':
        if (!value) return 'Open price is required'
        if (parseFloat(value) <= 0) return 'Open price must be greater than 0'
        return ''
      case 'close_price':
        if (!value) return 'Close price is required'
        if (parseFloat(value) <= 0) return 'Close price must be greater than 0'
        return ''
      case 'profit_loss':
        if (!value) return 'P/L is required'
        return ''
      case 'lot_size':
        if (value && parseFloat(value) <= 0) return 'Lot size must be greater than 0'
        return ''
      default:
        return ''
    }
  }

  // Handle field change with validation
  const handleFieldChange = (field: keyof TradeFormData, value: string) => {
    onFormChange(field, value)
    if (touched[field]) {
      setErrors(prev => ({ ...prev, [field]: validateField(field, value) }))
    }
  }

  // Handle field blur
  const handleFieldBlur = (field: keyof TradeFormData) => {
    setTouched(prev => ({ ...prev, [field]: true }))
    setErrors(prev => ({ ...prev, [field]: validateField(field, formData[field]) }))
  }

  // Get field status
  const getFieldStatus = (field: keyof TradeFormData): 'valid' | 'invalid' | 'none' => {
    if (!touched[field]) return 'none'
    return errors[field] ? 'invalid' : 'valid'
  }

  const isFormValid = () => {
    const requiredFields: (keyof TradeFormData)[] = ['symbol', 'open_price', 'close_price', 'profit_loss']
    return requiredFields.every(field => {
      const value = formData[field]
      return value && value.toString().trim() !== ''
    })
  }

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-4">
        <div>
          <Label htmlFor="symbol" className="flex items-center gap-2">
            Symbol *
            {getFieldStatus('symbol') === 'valid' && <CheckCircle2 className="w-4 h-4 text-emerald-400" />}
            {getFieldStatus('symbol') === 'invalid' && <AlertCircle className="w-4 h-4 text-red-400" />}
          </Label>
          <Input
            id="symbol"
            placeholder="EURUSD"
            className={`bg-[#0a0712] border-purple-900/30 mt-1 transition-colors ${
              getFieldStatus('symbol') === 'invalid' ? 'border-red-500/50 focus:border-red-500' :
              getFieldStatus('symbol') === 'valid' ? 'border-emerald-500/50 focus:border-emerald-500' : ''
            }`}
            value={formData.symbol}
            onChange={(e) => handleFieldChange('symbol', e.target.value)}
            onBlur={() => handleFieldBlur('symbol')}
          />
          {errors.symbol && touched.symbol && (
            <p className="text-xs text-red-400 mt-1 flex items-center gap-1">
              <AlertCircle className="w-3 h-3" /> {errors.symbol}
            </p>
          )}
        </div>
        <div>
          <Label htmlFor="type">Type</Label>
          <Select value={formData.type} onValueChange={onTypeChange}>
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
            {getFieldStatus('open_price') === 'valid' && <CheckCircle2 className="w-4 h-4 text-emerald-400" />}
            {getFieldStatus('open_price') === 'invalid' && <AlertCircle className="w-4 h-4 text-red-400" />}
          </Label>
          <Input
            id="open_price"
            type="number"
            step="0.0001"
            placeholder="1.0850"
            className={`bg-[#0a0712] border-purple-900/30 mt-1 transition-colors ${
              getFieldStatus('open_price') === 'invalid' ? 'border-red-500/50 focus:border-red-500' :
              getFieldStatus('open_price') === 'valid' ? 'border-emerald-500/50 focus:border-emerald-500' : ''
            }`}
            value={formData.open_price}
            onChange={(e) => handleFieldChange('open_price', e.target.value)}
            onBlur={() => handleFieldBlur('open_price')}
          />
          {errors.open_price && touched.open_price && (
            <p className="text-xs text-red-400 mt-1 flex items-center gap-1">
              <AlertCircle className="w-3 h-3" /> {errors.open_price}
            </p>
          )}
        </div>
        <div>
          <Label htmlFor="close_price" className="flex items-center gap-2">
            Close Price *
            {getFieldStatus('close_price') === 'valid' && <CheckCircle2 className="w-4 h-4 text-emerald-400" />}
            {getFieldStatus('close_price') === 'invalid' && <AlertCircle className="w-4 h-4 text-red-400" />}
          </Label>
          <Input
            id="close_price"
            type="number"
            step="0.0001"
            placeholder="1.0890"
            className={`bg-[#0a0712] border-purple-900/30 mt-1 transition-colors ${
              getFieldStatus('close_price') === 'invalid' ? 'border-red-500/50 focus:border-red-500' :
              getFieldStatus('close_price') === 'valid' ? 'border-emerald-500/50 focus:border-emerald-500' : ''
            }`}
            value={formData.close_price}
            onChange={(e) => handleFieldChange('close_price', e.target.value)}
            onBlur={() => handleFieldBlur('close_price')}
          />
          {errors.close_price && touched.close_price && (
            <p className="text-xs text-red-400 mt-1 flex items-center gap-1">
              <AlertCircle className="w-3 h-3" /> {errors.close_price}
            </p>
          )}
        </div>
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div>
          <Label htmlFor="lot_size" className="flex items-center gap-2">
            Lot Size
            {getFieldStatus('lot_size') === 'valid' && <CheckCircle2 className="w-4 h-4 text-emerald-400" />}
            {getFieldStatus('lot_size') === 'invalid' && <AlertCircle className="w-4 h-4 text-red-400" />}
          </Label>
          <Input
            id="lot_size"
            type="number"
            step="0.01"
            min="0.01"
            placeholder="0.1"
            className={`bg-[#0a0712] border-purple-900/30 mt-1 transition-colors ${
              getFieldStatus('lot_size') === 'invalid' ? 'border-red-500/50 focus:border-red-500' :
              getFieldStatus('lot_size') === 'valid' ? 'border-emerald-500/50 focus:border-emerald-500' : ''
            }`}
            value={formData.lot_size}
            onChange={(e) => handleFieldChange('lot_size', e.target.value)}
            onBlur={() => handleFieldBlur('lot_size')}
          />
          {errors.lot_size && touched.lot_size && (
            <p className="text-xs text-red-400 mt-1 flex items-center gap-1">
              <AlertCircle className="w-3 h-3" /> {errors.lot_size}
            </p>
          )}
        </div>
        <div>
          <Label htmlFor="profit_loss" className="flex items-center gap-2">
            P/L ($) *
            {getFieldStatus('profit_loss') === 'valid' && <CheckCircle2 className="w-4 h-4 text-emerald-400" />}
            {getFieldStatus('profit_loss') === 'invalid' && <AlertCircle className="w-4 h-4 text-red-400" />}
          </Label>
          <Input
            id="profit_loss"
            type="number"
            step="0.01"
            placeholder="400"
            className={`bg-[#0a0712] border-purple-900/30 mt-1 transition-colors ${
              getFieldStatus('profit_loss') === 'invalid' ? 'border-red-500/50 focus:border-red-500' :
              getFieldStatus('profit_loss') === 'valid' ? 'border-emerald-500/50 focus:border-emerald-500' : ''
            }`}
            value={formData.profit_loss}
            onChange={(e) => handleFieldChange('profit_loss', e.target.value)}
            onBlur={() => handleFieldBlur('profit_loss')}
          />
          {errors.profit_loss && touched.profit_loss && (
            <p className="text-xs text-red-400 mt-1 flex items-center gap-1">
              <AlertCircle className="w-3 h-3" /> {errors.profit_loss}
            </p>
          )}
        </div>
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div>
          <Label htmlFor="open_time">Open Time</Label>
          <Input
            id="open_time"
            type="datetime-local"
            className="bg-[#0a0712] border-purple-900/30 mt-1"
            value={formData.open_time ? formData.open_time.slice(0, 16) : ''}
            onChange={(e) => onFormChange('open_time', e.target.value ? datetimeLocalToFormat(e.target.value) : '')}
          />
        </div>
        <div>
          <Label htmlFor="close_time">Close Time</Label>
          <Input
            id="close_time"
            type="datetime-local"
            className="bg-[#0a0712] border-purple-900/30 mt-1"
            value={formData.close_time ? formData.close_time.slice(0, 16) : ''}
            onChange={(e) => onFormChange('close_time', e.target.value ? datetimeLocalToFormat(e.target.value) : '')}
          />
        </div>
      </div>
      <div>
        <Label htmlFor="session">Session</Label>
        <Select value={formData.session} onValueChange={onSessionChange}>
          <SelectTrigger id="session" className="bg-[#0a0712] border-purple-900/30 mt-1">
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
        <Label htmlFor="notes">Notes</Label>
        <Textarea
          id="notes"
          placeholder="Trade notes, setup, emotions..."
          className="bg-[#0a0712] border-purple-900/30 mt-1 resize-none"
          rows={3}
          value={formData.notes}
          onChange={(e) => onFormChange('notes', e.target.value)}
        />
      </div>
      {/* Image Upload */}
      <div>
        <Label htmlFor="image">Trade Screenshot (Optional)</Label>
        <div className="mt-1">
          {!formData.image_url ? (
            <div className="relative">
              <Input
                id="image"
                type="file"
                accept="image/*"
                className="bg-[#0a0712] border-purple-900/30"
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
              <div className="mt-2 flex items-center gap-2 text-xs text-gray-500">
                <Upload className="w-3 h-3" />
                <span>Upload trade screenshot for visual reference</span>
              </div>
            </div>
          ) : (
            <div className="relative group">
              <img
                src={formData.image_url}
                alt="Trade preview"
                className="w-full h-32 object-cover rounded-lg border border-purple-900/30"
              />
              <button
                onClick={() => onFormChange('image_url', '')}
                className="absolute top-2 right-2 p-1.5 bg-red-500/80 hover:bg-red-500 rounded-full text-white opacity-0 group-hover:opacity-100 transition-all"
              >
                <X className="w-4 h-4" />
              </button>
              <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-all flex items-center justify-center">
                <p className="text-white text-sm font-medium">Click to remove</p>
              </div>
            </div>
          )}
        </div>
      </div>
      <div className="flex gap-3 pt-2">
        <Button
          onClick={onSave}
          disabled={saving || !isFormValid()}
          className={`flex-1 bg-gradient-to-r from-purple-500 to-violet-600 disabled:opacity-50 disabled:cursor-not-allowed relative overflow-hidden transition-all ${
            isFormValid() && !saving ? 'hover:shadow-lg hover:shadow-purple-500/30 hover:scale-[1.02]' : ''
          }`}
        >
          {saving ? (
            <>
              <span className="inline-block animate-spin mr-2">⟳</span>
              Saving...
            </>
          ) : isEdit ? 'Update Trade' : 'Add Trade'}
        </Button>
        <Button
          variant="outline"
          onClick={onCancel}
          className="border-purple-900/30 hover:bg-white/5 active:bg-white/10 transition-all"
        >
          Cancel
        </Button>
      </div>

      {/* Form Validation Status */}
      <div className={`p-3 rounded-lg border transition-all ${
        isFormValid()
          ? 'bg-emerald-500/10 border-emerald-500/30'
          : touched.symbol || touched.open_price || touched.close_price || touched.profit_loss
          ? 'bg-amber-500/10 border-amber-500/30'
          : 'bg-white/5 border-white/10'
      }`}>
        <div className="flex items-center gap-2 text-sm">
          {isFormValid() ? (
            <>
              <CheckCircle2 className="w-4 h-4 text-emerald-400" />
              <span className="text-emerald-400">All fields are valid. Ready to save!</span>
            </>
          ) : (
            <>
              <Info className="w-4 h-4 text-amber-400" />
              <span className="text-amber-300">
                {!touched.symbol && !touched.open_price && !touched.close_price && !touched.profit_loss
                  ? 'Fill in required fields (marked with *) to continue'
                  : 'Please fix validation errors before saving'}
              </span>
            </>
          )}
        </div>
      </div>

      {/* Required Fields Notice */}
      <div className="text-center">
        <p className="text-xs text-gray-500">
          <span className="text-purple-400">*</span> Required fields
        </p>
      </div>
    </div>
  )
}

export default TradeForm
