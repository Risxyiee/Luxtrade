'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { Card, CardContent } from '@/components/ui/card'
import { Progress } from '@/components/ui/progress'
import { ArrowRight, ArrowLeft, Upload, CheckCircle, Sparkles, Loader2, X } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import { z } from 'zod'
import { toast } from 'sonner'

// ==================== ZOD VALIDATION SCHEMA ====================
const tradeFormSchema = z.object({
  symbol: z.string().min(3, 'Symbol must be at least 3 characters'),
  type: z.enum(['BUY', 'SELL'], { required_error: 'Type is required' }),
  lot_size: z.string().min(1, 'Lot size is required').regex(/^\d+(\.\d+)?$/, 'Invalid lot size'),
  open_price: z.string().min(1, 'Entry price is required').regex(/^\d+(\.\d+)?$/, 'Invalid price'),
  close_price: z.string().optional(), // Optional - can be empty for open positions
  profit_loss: z.string().optional(), // Optional - can be empty for open positions
  open_time: z.string().optional(),
  close_time: z.string().optional(),
  session: z.string().optional(),
  notes: z.string().optional(),
  emotion: z.string().optional(),
  screenshot_url: z.string().optional(),
})

// Emotion options with emoji
const emotionOptions = [
  { value: 'confident', emoji: '😎', label: 'Confident', color: 'text-yellow-400' },
  { value: 'happy', emoji: '😊', label: 'Happy', color: 'text-green-400' },
  { value: 'neutral', emoji: '😐', label: 'Neutral', color: 'text-gray-400' },
  { value: 'anxious', emoji: '😰', label: 'Anxious', color: 'text-blue-400' },
  { value: 'frustrated', emoji: '😤', label: 'Frustrated', color: 'text-orange-400' },
  { value: 'regretful', emoji: '😔', label: 'Regretful', color: 'text-purple-400' },
]

interface TradeWizardFormProps {
  formData: any
  onFormChange: (field: string, value: string) => void
  onTypeChange: (value: string) => void
  onSessionChange: (value: string) => void
  onNumberInput: (field: string, e: React.ChangeEvent<HTMLInputElement>) => void
  onSave: () => void
  onCancel: () => void
  isEdit?: boolean
  saving?: boolean
}

export default function TradeWizardForm({
  formData,
  onFormChange,
  onTypeChange,
  onSessionChange,
  onNumberInput,
  onSave,
  onCancel,
  isEdit = false,
  saving = false
}: TradeWizardFormProps) {
  const [currentStep, setCurrentStep] = useState(1)
  const [selectedEmotion, setSelectedEmotion] = useState<string>(formData.emotion || '')
  const [uploadedImage, setUploadedImage] = useState<string | null>(formData.screenshot_url || null)
  const [uploading, setUploading] = useState(false)
  const [errors, setErrors] = useState<Record<string, string>>({})
  const totalSteps = 3

  const handleNext = () => {
    // Validate current step before proceeding
    const stepErrors = validateStep(currentStep)

    if (Object.keys(stepErrors).length > 0) {
      setErrors(stepErrors)
      toast.error('Please fix the errors before proceeding')
      return
    }

    setErrors({})
    if (currentStep < totalSteps) {
      setCurrentStep(currentStep + 1)
    }
  }

  const handlePrevious = () => {
    if (currentStep > 1) {
      setCurrentStep(currentStep - 1)
    }
  }

  const handleEmotionSelect = (emotion: string) => {
    setSelectedEmotion(emotion)
    onFormChange('emotion', emotion)
  }

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    // Validate file type
    if (!file.type.startsWith('image/')) {
      toast.error('Please upload an image file')
      return
    }

    // Validate file size (max 5MB)
    if (file.size > 5 * 1024 * 1024) {
      toast.error('File size must be less than 5MB')
      return
    }

    setUploading(true)

    try {
      // Get the auth token
      const token = localStorage.getItem('sb-access-token')

      if (!token) {
        throw new Error('Please login to upload screenshots')
      }

      // Create FormData
      const formData = new FormData()
      formData.append('file', file)

      // Upload to Supabase Storage via API
      const response = await fetch('/api/upload/screenshot', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
        },
        body: formData,
      })

      const result = await response.json()

      if (!response.ok) {
        throw new Error(result.error || result.message || 'Upload failed')
      }

      // Update state with the public URL
      setUploadedImage(result.url)
      onFormChange('screenshot_url', result.url)

      toast.success('Screenshot uploaded successfully!')
    } catch (error) {
      console.error('Upload error:', error)
      toast.error(error instanceof Error ? error.message : 'Failed to upload screenshot')
    } finally {
      setUploading(false)
    }
  }

  const handleRemoveImage = () => {
    setUploadedImage(null)
    onFormChange('screenshot_url', '')
    toast.success('Image removed')
  }

  const validateStep = (step: number): Record<string, string> => {
    const stepErrors: Record<string, string> = {}

    try {
      if (step === 1) {
        // Validate symbol, type, lot_size
        if (!formData.symbol || formData.symbol.length < 3) {
          stepErrors.symbol = 'Symbol must be at least 3 characters'
        }
        if (!formData.type || !['BUY', 'SELL'].includes(formData.type)) {
          stepErrors.type = 'Please select a trade type'
        }
        if (!formData.lot_size || !/^\d+(\.\d+)?$/.test(formData.lot_size)) {
          stepErrors.lot_size = 'Invalid lot size'
        }
      } else if (step === 2) {
        // Validate open_price (required), close_price and profit_loss (optional for open positions)
        if (!formData.open_price || !/^\d+(\.\d+)?$/.test(formData.open_price)) {
          stepErrors.open_price = 'Invalid entry price'
        }
        // close_price and profit_loss are now optional
        // They will be validated in the final save if both are provided (must be valid)
        if (formData.close_price && !/^\d+(\.\d+)?$/.test(formData.close_price)) {
          stepErrors.close_price = 'Invalid exit price'
        }
        if (formData.profit_loss && !/^-?\d+(\.\d+)?$/.test(formData.profit_loss)) {
          stepErrors.profit_loss = 'Invalid profit/loss amount'
        }
      }
    } catch (error) {
      console.error('Validation error:', error)
    }

    return stepErrors
  }

  const handleSave = () => {
    // Final validation before saving
    const allErrors: Record<string, string> = {}

    // Validate all steps
    for (let i = 1; i <= totalSteps; i++) {
      const stepErrors = validateStep(i)
      Object.assign(allErrors, stepErrors)
    }

    if (Object.keys(allErrors).length > 0) {
      setErrors(allErrors)
      toast.error('Please fix all errors before saving')
      return
    }

    setErrors({})

    // Save emotion to formData before calling onSave
    if (selectedEmotion && !formData.emotion) {
      onFormChange('emotion', selectedEmotion)
    }

    // Append emotion to notes if needed
    if (selectedEmotion) {
      const emotionNote = `Mood: ${selectedEmotion}`
      const currentNotes = formData.notes || ''
      if (currentNotes && !currentNotes.includes('Mood:')) {
        onFormChange('notes', `${emotionNote}\n${currentNotes}`)
      } else if (!currentNotes) {
        onFormChange('notes', emotionNote)
      }
    }

    // Call onSave after updating formData
    setTimeout(() => {
      onSave()
    }, 0)
  }

  const progress = (currentStep / totalSteps) * 100

  return (
    <div className="space-y-6">
      {/* Progress Bar */}
      <div className="space-y-2">
        <div className="flex items-center justify-between text-sm">
          <span className="text-purple-300 font-medium">Step {currentStep} of {totalSteps}</span>
          <span className="text-gray-400">{Math.round(progress)}% Complete</span>
        </div>
        <Progress value={progress} className="h-2 bg-purple-900/30" />
      </div>

      {/* Step 1: Pair, Type, and Lot Size */}
      <AnimatePresence mode="wait">
        {currentStep === 1 && (
          <motion.div
            key="step1"
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            transition={{ duration: 0.3 }}
            className="space-y-4"
          >
            <div className="space-y-4">
              <div>
                <Label className="text-white font-semibold">Trading Pair *</Label>
                <Input
                  placeholder="EURUSD"
                  className={`bg-[#0a0712] border-purple-900/30 mt-2 text-white ${errors.symbol ? 'border-red-500' : ''}`}
                  value={formData.symbol}
                  onChange={(e) => {
                    onFormChange('symbol', e.target.value)
                    if (errors.symbol) setErrors({ ...errors, symbol: '' })
                  }}
                />
                {errors.symbol && <p className="text-red-400 text-xs mt-1">{errors.symbol}</p>}
              </div>

              <div>
                <Label className="text-white font-semibold">Trade Type *</Label>
                <Select value={formData.type} onValueChange={(value) => {
                  onTypeChange(value)
                  if (errors.type) setErrors({ ...errors, type: '' })
                }}>
                  <SelectTrigger className={`bg-[#0a0712] border-purple-900/30 mt-2 text-white ${errors.type ? 'border-red-500' : ''}`}>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="bg-[#0f0b18] border-purple-900/30">
                    <SelectItem value="BUY" className="text-green-400">📈 BUY (Long)</SelectItem>
                    <SelectItem value="SELL" className="text-red-400">📉 SELL (Short)</SelectItem>
                  </SelectContent>
                </Select>
                {errors.type && <p className="text-red-400 text-xs mt-1">{errors.type}</p>}
              </div>

              <div>
                <Label className="text-white font-semibold">Lot Size *</Label>
                <Input
                  type="text"
                  inputMode="decimal"
                  placeholder="0.1"
                  className={`bg-[#0a0712] border-purple-900/30 mt-2 text-white ${errors.lot_size ? 'border-red-500' : ''}`}
                  value={formData.lot_size}
                  onChange={(e) => {
                    onNumberInput('lot_size', e)
                    if (errors.lot_size) setErrors({ ...errors, lot_size: '' })
                  }}
                />
                {errors.lot_size && <p className="text-red-400 text-xs mt-1">{errors.lot_size}</p>}
              </div>
            </div>
          </motion.div>
        )}

        {/* Step 2: Entry and Exit Prices */}
        {currentStep === 2 && (
          <motion.div
            key="step2"
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            transition={{ duration: 0.3 }}
            className="space-y-4"
          >
            <div className="grid grid-cols-1 gap-4">
              <Card className={`bg-gradient-to-br from-green-500/10 to-transparent border-green-500/30 ${errors.open_price ? 'border-red-500' : ''}`}>
                <CardContent className="p-4">
                  <Label className="text-green-400 font-semibold flex items-center gap-2">
                    <span className="text-lg">📥</span> Entry Price *
                  </Label>
                  <Input
                    type="text"
                    inputMode="decimal"
                    placeholder="1.0850"
                    className="bg-[#0a0712] border-green-900/30 mt-2 text-green-300"
                    value={formData.open_price}
                    onChange={(e) => {
                      onNumberInput('open_price', e)
                      if (errors.open_price) setErrors({ ...errors, open_price: '' })
                    }}
                  />
                  <p className="text-xs text-gray-500 mt-1">Price when you opened the position</p>
                  {errors.open_price && <p className="text-red-400 text-xs mt-1">{errors.open_price}</p>}
                </CardContent>
              </Card>

              <Card className={`bg-gradient-to-br from-red-500/10 to-transparent border-red-500/30 ${errors.close_price ? 'border-red-500' : ''}`}>
                <CardContent className="p-4">
                  <Label className="text-red-400 font-semibold flex items-center gap-2">
                    <span className="text-lg">📤</span> Exit Price (Optional)
                  </Label>
                  <Input
                    type="text"
                    inputMode="decimal"
                    placeholder="1.0890"
                    className="bg-[#0a0712] border-red-900/30 mt-2 text-red-300"
                    value={formData.close_price}
                    onChange={(e) => {
                      onNumberInput('close_price', e)
                      if (errors.close_price) setErrors({ ...errors, close_price: '' })
                    }}
                  />
                  <p className="text-xs text-gray-500 mt-1">Leave empty if position is still open</p>
                  {errors.close_price && <p className="text-red-400 text-xs mt-1">{errors.close_price}</p>}
                </CardContent>
              </Card>

              <Card className={`bg-gradient-to-br from-purple-500/10 to-transparent border-purple-500/30 ${errors.profit_loss ? 'border-red-500' : ''}`}>
                <CardContent className="p-4">
                  <Label className="text-purple-400 font-semibold flex items-center gap-2">
                    <span className="text-lg">💰</span> Profit/Loss ($) (Optional)
                  </Label>
                  <Input
                    type="text"
                    inputMode="decimal"
                    placeholder="400"
                    className="bg-[#0a0712] border-purple-900/30 mt-2 text-purple-300"
                    value={formData.profit_loss}
                    onChange={(e) => {
                      onNumberInput('profit_loss', e)
                      if (errors.profit_loss) setErrors({ ...errors, profit_loss: '' })
                    }}
                  />
                  <p className="text-xs text-gray-500 mt-1">Leave empty if position is still open</p>
                  {errors.profit_loss && <p className="text-red-400 text-xs mt-1">{errors.profit_loss}</p>}
                </CardContent>
              </Card>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label className="text-gray-300 text-sm">Open Time</Label>
                <Input
                  type="datetime-local"
                  className="bg-[#0a0712] border-purple-900/30 mt-1 text-sm"
                  value={formData.open_time ? formData.open_time.slice(0, 16) : ''}
                  onChange={(e) => onFormChange('open_time', e.target.value ? new Date(e.target.value).toISOString() : '')}
                />
              </div>
              <div>
                <Label className="text-gray-300 text-sm">Close Time</Label>
                <Input
                  type="datetime-local"
                  className="bg-[#0a0712] border-purple-900/30 mt-1 text-sm"
                  value={formData.close_time ? formData.close_time.slice(0, 16) : ''}
                  onChange={(e) => onFormChange('close_time', e.target.value ? new Date(e.target.value).toISOString() : '')}
                />
              </div>
            </div>
          </motion.div>
        )}

        {/* Step 3: Emotion & Screenshot */}
        {currentStep === 3 && (
          <motion.div
            key="step3"
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            transition={{ duration: 0.3 }}
            className="space-y-4"
          >
            {/* Emotion Selection */}
            <div className="space-y-3">
              <Label className="text-white font-semibold flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-purple-400" />
                How did you feel during this trade?
              </Label>
              <div className="grid grid-cols-3 gap-2">
                {emotionOptions.map((emotion) => (
                  <button
                    key={emotion.value}
                    onClick={() => handleEmotionSelect(emotion.value)}
                    className={`p-3 rounded-xl border-2 transition-all ${
                      selectedEmotion === emotion.value
                        ? 'border-purple-500 bg-purple-500/20 shadow-lg shadow-purple-500/20'
                        : 'border-purple-900/30 bg-white/5 hover:border-purple-500/50'
                    }`}
                  >
                    <div className={`text-3xl mb-1 ${emotion.color}`}>{emotion.emoji}</div>
                    <div className={`text-xs font-medium ${selectedEmotion === emotion.value ? 'text-white' : 'text-gray-400'}`}>
                      {emotion.label}
                    </div>
                  </button>
                ))}
              </div>
            </div>

            {/* Screenshot Upload */}
            <div className="space-y-3">
              <Label className="text-white font-semibold flex items-center gap-2">
                <Upload className="w-4 h-4 text-blue-400" />
                Trade Screenshot (Optional)
              </Label>
              <div className="border-2 border-dashed border-purple-900/30 rounded-xl p-6 text-center hover:border-purple-500/50 transition-colors">
                {uploading ? (
                  <div className="flex flex-col items-center gap-3">
                    <Loader2 className="w-8 h-8 animate-spin text-purple-400" />
                    <p className="text-gray-400">Uploading to Supabase Storage...</p>
                  </div>
                ) : uploadedImage ? (
                  <div className="space-y-3">
                    <img
                      src={uploadedImage}
                      alt="Preview"
                      className="max-h-48 mx-auto rounded-lg border border-purple-500/30"
                    />
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={handleRemoveImage}
                      className="border-red-500/30 text-red-400 hover:bg-red-500/10"
                    >
                      <X className="w-4 h-4 mr-2" /> Remove Image
                    </Button>
                  </div>
                ) : (
                  <div>
                    <Input
                      type="file"
                      accept="image/*"
                      onChange={handleImageUpload}
                      className="max-w-sm mx-auto"
                      disabled={uploading}
                    />
                    <p className="text-xs text-gray-500 mt-2">Upload MT5/MT4 screenshot as proof (max 5MB)</p>
                  </div>
                )}
              </div>
            </div>

            {/* Notes */}
            <div className="space-y-2">
              <Label className="text-gray-300 text-sm">Additional Notes</Label>
              <Textarea
                placeholder="Trade setup, lessons learned, any other thoughts..."
                className="bg-[#0a0712] border-purple-900/30 resize-none text-white"
                rows={3}
                value={formData.notes}
                onChange={(e) => onFormChange('notes', e.target.value)}
              />
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Navigation Buttons */}
      <div className="flex gap-3 pt-4 border-t border-purple-900/30">
        {currentStep > 1 ? (
          <Button
            variant="outline"
            onClick={handlePrevious}
            disabled={saving || uploading}
            className="border-purple-900/30 flex-1"
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            Previous
          </Button>
        ) : (
          <Button
            variant="outline"
            onClick={onCancel}
            disabled={saving || uploading}
            className="border-purple-900/30 flex-1"
          >
            Cancel
          </Button>
        )}

        {currentStep < totalSteps ? (
          <Button
            onClick={handleNext}
            disabled={saving || uploading}
            className="flex-1 bg-gradient-to-r from-purple-500 to-violet-600"
          >
            Next
            <ArrowRight className="w-4 h-4 ml-2" />
          </Button>
        ) : (
          <Button
            onClick={handleSave}
            disabled={saving || uploading}
            className="flex-1 bg-gradient-to-r from-emerald-500 to-teal-600"
          >
            {saving ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Saving...
              </>
            ) : (
              <>
                <CheckCircle className="w-4 h-4 mr-2" />
                {isEdit ? 'Update Trade' : 'Save Trade'}
              </>
            )}
          </Button>
        )}
      </div>
    </div>
  )
}
