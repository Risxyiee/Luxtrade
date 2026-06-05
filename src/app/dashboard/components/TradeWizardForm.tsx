'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { Card, CardContent } from '@/components/ui/card'
import { Progress } from '@/components/ui/progress'
import { ArrowRight, ArrowLeft, Upload, CheckCircle, Sparkles, Loader2, X, Info, Wallet, FileText } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import { toast } from 'sonner'
import { calculateForexProfitLoss, getPipInfo, formatTradingInput, AccountType } from '@/lib/trading-helpers'
import { isoToDatetimeLocal, datetimeLocalToISO } from '../utils/helpers'

// Emotion options with emoji
const emotionOptions = [
  { value: 'confident', emoji: '😎', label: 'Confident', color: 'text-yellow-400' },
  { value: 'happy', emoji: '😊', label: 'Happy', color: 'text-green-400' },
  { value: 'neutral', emoji: '😐', label: 'Neutral', color: 'text-gray-400' },
  { value: 'anxious', emoji: '😰', label: 'Anxious', color: 'text-blue-400' },
  { value: 'frustrated', emoji: '😤', label: 'Frustrated', color: 'text-orange-400' },
  { value: 'regretful', emoji: '😔', label: 'Regretful', color: 'text-purple-400' },
]

interface TradingAccountOption {
  id: string
  name: string
  account_type: AccountType
  is_default: boolean
}

interface TradeWizardFormProps {
  formData: any
  onFormChange: (field: string, value: string) => void
  onTypeChange: (value: string) => void
  onSessionChange: (value: string) => void
  onSave: () => void
  onCancel: () => void
  isEdit?: boolean
  saving?: boolean
  tradingAccounts?: TradingAccountOption[]
}

// Quick pairs for easy selection
const quickPairs = [
  { symbol: 'EURUSD', label: 'EUR/USD', type: 'major' },
  { symbol: 'GBPUSD', label: 'GBP/USD', type: 'major' },
  { symbol: 'USDJPY', label: 'USD/JPY', type: 'major' },
  { symbol: 'XAUUSD', label: 'GOLD', type: 'gold' },
  { symbol: 'XAGUSD', label: 'SILVER', type: 'gold' },
  { symbol: 'BTCUSD', label: 'BTC', type: 'crypto' },
  { symbol: 'ETHUSD', label: 'ETH', type: 'crypto' },
  { symbol: 'US30', label: 'US30', type: 'indices' },
  { symbol: 'NAS100', label: 'NAS100', type: 'indices' },
]

// Trading sessions
const tradingSessions = [
  { value: 'london', label: 'London', emoji: '🇬🇧', color: 'text-blue-400' },
  { value: 'new_york', label: 'New York', emoji: '🇺🇸', color: 'text-green-400' },
  { value: 'tokyo', label: 'Tokyo', emoji: '🇯🇵', color: 'text-red-400' },
  { value: 'sydney', label: 'Sydney', emoji: '🇦🇺', color: 'text-yellow-400' },
  { value: 'asian', label: 'Asian', emoji: '🌏', color: 'text-orange-400' },
  { value: 'overlap', label: 'Overlap', emoji: '⏰', color: 'text-purple-400' },
]

export default function TradeWizardForm({
  formData,
  onFormChange,
  onTypeChange,
  onSessionChange,
  onSave,
  onCancel,
  isEdit = false,
  saving = false,
  tradingAccounts = []
}: TradeWizardFormProps) {
  const [currentStep, setCurrentStep] = useState(1)
  const [selectedEmotion, setSelectedEmotion] = useState<string>(formData.emotion || '')
  const [uploadedImage, setUploadedImage] = useState<string | null>(formData.screenshot_url || null)
  const [uploading, setUploading] = useState(false)
  const [analyzingScreenshot, setAnalyzingScreenshot] = useState(false)
  const [uploadingMT5, setUploadingMT5] = useState(false)
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
      // Create FormData
      const uploadFormData = new FormData()
      uploadFormData.append('file', file)

      // Upload to Supabase Storage via API
      const response = await fetch('/api/upload/screenshot', {
        method: 'POST',
        credentials: 'include',
        body: uploadFormData,
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

  // Handle screenshot upload with AI analysis
  const handleScreenshotAnalysis = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    // Validate file size (10MB max)
    if (file.size > 10 * 1024 * 1024) {
      toast.error('File too large. Maximum size is 10MB.')
      return
    }

    // Validate file type
    if (!file.type.startsWith('image/')) {
      toast.error('Invalid file type. Please upload an image.')
      return
    }

    setAnalyzingScreenshot(true)
    try {
      const formData = new FormData()
      formData.append('image', file)

      const res = await fetch('/api/analyze-screenshot', {
        method: 'POST',
        body: formData,
      })

      const data = await res.json()

      if (res.ok && data.success) {
        // Auto-fill form with extracted data
        if (data.data.symbol) onFormChange('symbol', data.data.symbol)
        if (data.data.type) onTypeChange(data.data.type)
        if (data.data.lot_size) onFormChange('lot_size', data.data.lot_size.toString())
        if (data.data.open_price) onFormChange('open_price', data.data.open_price.toString())
        if (data.data.close_price) onFormChange('close_price', data.data.close_price.toString())
        if (data.data.profit_loss) onFormChange('profit_loss', data.data.profit_loss.toString())
        if (data.data.stop_loss) onFormChange('stop_loss', data.data.stop_loss.toString())
        if (data.data.take_profit) onFormChange('take_profit', data.data.take_profit.toString())
        if (data.image_url) onFormChange('screenshot_url', data.image_url)
        if (data.image_url) setUploadedImage(data.image_url)

        toast.success('✨ Screenshot analyzed! Form auto-filled with trading data.')
      } else {
        toast.error(data.error || 'Failed to analyze screenshot')
      }
    } catch (error) {
      console.error('❌ [TradeWizardForm] Screenshot analysis error:', error)
      toast.error('Failed to analyze screenshot. Please try again.')
    } finally {
      setAnalyzingScreenshot(false)
      e.target.value = ''
    }
  }

  // Handle MT5 file upload
  const handleMT5Upload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    // Validate file size (5MB max)
    if (file.size > 5 * 1024 * 1024) {
      toast.error('File too large. Maximum size is 5MB.')
      return
    }

    setUploadingMT5(true)
    try {
      const formData = new FormData()
      formData.append('file', file)

      const res = await fetch('/api/import/file', {
        method: 'POST',
        body: formData,
      })

      const data = await res.json()

      if (res.ok && data.success) {
        // Auto-fill form with imported data
        if (data.data.symbol) onFormChange('symbol', data.data.symbol)
        if (data.data.type) onTypeChange(data.data.type)
        if (data.data.lot_size) onFormChange('lot_size', data.data.lot_size.toString())
        if (data.data.open_price) onFormChange('open_price', data.data.open_price.toString())
        if (data.data.close_price) onFormChange('close_price', data.data.close_price.toString())
        if (data.data.profit_loss) onFormChange('profit_loss', data.data.profit_loss.toString())
        if (data.data.open_time) onFormChange('open_time', data.data.open_time)
        if (data.data.close_time) onFormChange('close_time', data.data.close_time)

        toast.success('✅ MT5 file imported successfully! Form auto-filled.')
      } else {
        toast.error(data.error || 'Failed to import MT5 file')
      }
    } catch (error) {
      console.error('❌ [TradeWizardForm] MT5 import error:', error)
      toast.error('Failed to import MT5 file. Please try again.')
    } finally {
      setUploadingMT5(false)
      e.target.value = ''
    }
  }

  const validateStep = (step: number): Record<string, string> => {
    const stepErrors: Record<string, string> = {}

    try {
      if (step === 1) {
        // Validate symbol, type, lot_size, account_id
        if (!formData.symbol || formData.symbol.length < 3) {
          stepErrors.symbol = 'Symbol must be at least 3 characters'
        }
        if (!formData.type || !['BUY', 'SELL'].includes(formData.type)) {
          stepErrors.type = 'Please select a trade type'
        }
        const lot = formatTradingInput(formData.lot_size || '')
        if (!formData.lot_size || lot <= 0) {
          stepErrors.lot_size = 'Invalid lot size'
        }
        if (!formData.account_id) {
          stepErrors.account_id = 'Please select a trading account'
        }
      } else if (step === 2) {
        // Validate open_price (required), close_price and profit_loss (optional for open positions)
        const openPrice = formatTradingInput(formData.open_price || '')
        if (!formData.open_price || openPrice <= 0) {
          stepErrors.open_price = 'Invalid entry price'
        }
        // close_price and profit_loss are optional
        if (formData.close_price) {
          const closePrice = formatTradingInput(formData.close_price || '')
          if (closePrice <= 0) {
            stepErrors.close_price = 'Invalid exit price'
          }
        }
      }
    } catch (error) {
      console.error('Validation error:', error)
    }

    return stepErrors
  }



  const handlePriceChange = (field: 'open_price' | 'close_price', value: string) => {
    // Allow any decimal input
    onFormChange(field, value)
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

    // Validate account_id is set (required for multi-account system)
    if (!formData.account_id) {
      toast.error('Please select a trading account')
      return
    }

    // Ensure numeric values are properly formatted
    const lot = formatTradingInput(formData.lot_size || '')
    const openPrice = formatTradingInput(formData.open_price || '')
    const closePrice = formatTradingInput(formData.close_price || '')
    const profitLoss = formatTradingInput(formData.profit_loss || '')

    if (lot <= 0) {
      toast.error('Lot size must be greater than 0')
      return
    }

    if (openPrice <= 0) {
      toast.error('Entry price must be greater than 0')
      return
    }

    // Update formData with properly formatted numbers
    onFormChange('lot_size', lot.toString())
    onFormChange('open_price', openPrice.toString())
    if (closePrice > 0) {
      onFormChange('close_price', closePrice.toString())
    }
    if (profitLoss !== 0) {
      onFormChange('profit_loss', profitLoss.toString())
    }

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
    <div className="space-y-6 pb-4"> {/* Added pb-4 for mobile spacing */}
      {/* Progress Bar */}
      <div className="space-y-2 shrink-0"> {/* Added shrink-0 */}
        <div className="flex items-center justify-between text-sm">
          <span className="text-purple-300 font-medium">Step {currentStep} of {totalSteps}</span>
          <span className="text-gray-400">{Math.round(progress)}% Complete</span>
        </div>
        <Progress value={progress} className="h-2 bg-purple-900/30" />
      </div>

      {/* Step Content - Scrollable on mobile */}
      <div className="overflow-y-auto max-h-[50vh] lg:max-h-none -mx-1 px-1">
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
            {/* Quick Import Section - Show First in Step 1 */}
            <div className="bg-gradient-to-r from-purple-500/10 to-violet-600/10 rounded-lg border border-purple-900/30 p-4">
              <Label className="text-sm font-semibold text-purple-300 mb-3 block flex items-center gap-2">
                <Sparkles className="w-4 h-4" />
                Quick Import - Choose One
              </Label>
              <div className="grid grid-cols-2 gap-3">
                {/* Screenshot AI Analysis */}
                <div>
                  <Input
                    id="screenshot"
                    type="file"
                    accept="image/jpeg,image/png,image/webp"
                    className="bg-[#0a0712] border-purple-900/30 text-xs"
                    onChange={handleScreenshotAnalysis}
                    disabled={analyzingScreenshot}
                  />
                  <div className="mt-1.5 flex items-center gap-1.5 text-xs text-gray-400">
                    {analyzingScreenshot ? (
                      <>
                        <Loader2 className="w-3 h-3 animate-spin text-purple-400" />
                        <span className="text-purple-400">Analyzing with AI...</span>
                      </>
                    ) : (
                      <>
                        <Upload className="w-3 h-3" />
                        <span>Screenshot (AI Auto-fill)</span>
                      </>
                    )}
                  </div>
                </div>

                {/* MT5 File Import */}
                <div>
                  <Input
                    id="mt5-file"
                    type="file"
                    accept=".csv,.txt,.xlsx,.xls"
                    className="bg-[#0a0712] border-purple-900/30 text-xs"
                    onChange={handleMT5Upload}
                    disabled={uploadingMT5}
                  />
                  <div className="mt-1.5 flex items-center gap-1.5 text-xs text-gray-400">
                    {uploadingMT5 ? (
                      <>
                        <Loader2 className="w-3 h-3 animate-spin text-purple-400" />
                        <span className="text-purple-400">Importing...</span>
                      </>
                    ) : (
                      <>
                        <FileText className="w-3 h-3" />
                        <span>MT5 Statement</span>
                      </>
                    )}
                  </div>
                </div>
              </div>
              <p className="text-[10px] text-gray-500 mt-2">
                Upload a screenshot for AI extraction OR MT5 file for direct import. You can also fill the form manually below.
              </p>
            </div>

            <div className="space-y-4">
              <div>
                <Label className="text-white font-semibold">Trading Pair *</Label>
                <Input
                  placeholder="EURUSD"
                  className={`bg-[#0a0712] border-purple-900/30 mt-2 text-white uppercase ${errors.symbol ? 'border-red-500' : ''}`}
                  value={formData.symbol}
                  onChange={(e) => {
                    onFormChange('symbol', e.target.value.toUpperCase())
                    if (errors.symbol) setErrors({ ...errors, symbol: '' })
                  }}
                />
                {errors.symbol && <p className="text-red-400 text-xs mt-1">{errors.symbol}</p>}
                {/* Quick Pair Selector */}
                <div className="space-y-2 mt-2">
                  <p className="text-xs text-gray-500">Quick select:</p>
                  <div className="flex flex-wrap gap-2">
                    {quickPairs.map((pair) => {
                      const isSelected = formData.symbol === pair.symbol
                      const typeColors = {
                        major: isSelected ? 'bg-green-500' : 'bg-green-500/20 text-green-400 border-green-500/30',
                        gold: isSelected ? 'bg-yellow-500' : 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30',
                        crypto: isSelected ? 'bg-orange-500' : 'bg-orange-500/20 text-orange-400 border-orange-500/30',
                        indices: isSelected ? 'bg-blue-500' : 'bg-blue-500/20 text-blue-400 border-blue-500/30',
                      }

                      return (
                        <button
                          key={pair.symbol}
                          onClick={() => {
                            onFormChange('symbol', pair.symbol)
                            if (errors.symbol) setErrors({ ...errors, symbol: '' })
                          }}
                          className={`px-3 py-1.5 text-xs font-medium rounded-lg border transition-all ${
                            isSelected
                              ? `text-white shadow-lg shadow-${pair.type === 'gold' ? 'yellow' : pair.type === 'crypto' ? 'orange' : pair.type === 'indices' ? 'blue' : 'green'}-500/20`
                              : typeColors[pair.type]
                          }`}
                          title={pair.label}
                        >
                          {pair.label}
                        </button>
                      )
                    })}
                  </div>
                </div>
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
                <Label className="text-white font-semibold flex items-center gap-2">
                  <Wallet className="w-4 h-4" />
                  Trading Account *
                </Label>
                <Select value={formData.account_id} onValueChange={(value) => {
                  onFormChange('account_id', value)
                  // Find and set account_type
                  const account = tradingAccounts.find(acc => acc.id === value)
                  if (account) {
                    onFormChange('account_type', account.account_type)
                  }
                  if (errors.account_id) setErrors({ ...errors, account_id: '' })
                }}>
                  <SelectTrigger className={`bg-[#0a0712] border-purple-900/30 mt-2 text-white ${errors.account_id ? 'border-red-500' : ''}`}>
                    <SelectValue placeholder="Select account" />
                  </SelectTrigger>
                  <SelectContent className="bg-[#0f0b18] border-purple-900/30">
                    {tradingAccounts.length === 0 ? (
                      <div className="p-2 text-center text-gray-400 text-xs">
                        No accounts found
                      </div>
                    ) : (
                      tradingAccounts.map((account) => (
                        <SelectItem key={account.id} value={account.id}>
                          {account.name} {account.is_default && '(Default)'} - {account.account_type}
                        </SelectItem>
                      ))
                    )}
                  </SelectContent>
                </Select>
                {errors.account_id && <p className="text-red-400 text-xs mt-1">{errors.account_id}</p>}
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label className="text-white font-semibold">Lot Size *</Label>
                  <Input
                    type="number"
                    step="0.01"
                    min="0.01"
                    placeholder="0.1"
                    className={`bg-[#0a0712] border-purple-900/30 mt-2 text-white ${errors.lot_size ? 'border-red-500' : ''}`}
                    value={formData.lot_size}
                    onChange={(e) => {
                      onFormChange('lot_size', e.target.value)
                      if (errors.lot_size) setErrors({ ...errors, lot_size: '' })
                    }}
                  />
                  {errors.lot_size && <p className="text-red-400 text-xs mt-1">{errors.lot_size}</p>}
                </div>
                <div>
                  <Label className="text-white font-semibold">Trading Session</Label>
                  <Select value={formData.session || ''} onValueChange={(value) => {
                    onSessionChange(value)
                  }}>
                    <SelectTrigger className="bg-[#0a0712] border-purple-900/30 mt-2 text-white">
                      <SelectValue placeholder="Select session" />
                    </SelectTrigger>
                    <SelectContent className="bg-[#0f0b18] border-purple-900/30">
                      {tradingSessions.map((session) => (
                        <SelectItem key={session.value} value={session.value} className="flex items-center gap-2">
                          <span>{session.emoji}</span>
                          <span className={session.color}>{session.label}</span>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
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
                    type="number"
                    step="0.0001"
                    min="0"
                    placeholder="1.0850"
                    className="bg-[#0a0712] border-green-900/30 mt-2 text-green-300"
                    value={formData.open_price}
                    onChange={(e) => {
                      onFormChange('open_price', e.target.value)
                      if (errors.open_price) setErrors({ ...errors, open_price: '' })
                    }}
                  />
                  <div className="flex items-center justify-between mt-1">
                    <p className="text-xs text-gray-500">Price when you opened the position</p>
                    {formData.open_price && (
                      <span className="text-xs text-green-400 font-medium">✓ Entry set</span>
                    )}
                  </div>
                  {errors.open_price && <p className="text-red-400 text-xs mt-1">{errors.open_price}</p>}
                </CardContent>
              </Card>

              <Card className={`bg-gradient-to-br from-red-500/10 to-transparent border-red-500/30 ${errors.close_price ? 'border-red-500' : ''}`}>
                <CardContent className="p-4">
                  <Label className="text-red-400 font-semibold flex items-center gap-2">
                    <span className="text-lg">📤</span> Exit Price (Optional)
                  </Label>
                  <Input
                    type="number"
                    step="0.0001"
                    min="0"
                    placeholder="1.0890"
                    className="bg-[#0a0712] border-red-900/30 mt-2 text-red-300"
                    value={formData.close_price}
                    onChange={(e) => {
                      onFormChange('close_price', e.target.value)
                      if (errors.close_price) setErrors({ ...errors, close_price: '' })
                    }}
                  />
                  <div className="flex items-center justify-between mt-1">
                    <p className="text-xs text-gray-500">Leave empty if position is still open</p>
                    {formData.close_price && (
                      <span className="text-xs text-red-400 font-medium">✓ Exit set</span>
                    )}
                  </div>
                  {errors.close_price && <p className="text-red-400 text-xs mt-1">{errors.close_price}</p>}
                </CardContent>
              </Card>

              <Card className={`bg-gradient-to-br from-purple-500/10 to-transparent border-purple-500/30 ${errors.profit_loss ? 'border-red-500' : ''}`}>
                <CardContent className="p-4">
                  <Label className="text-purple-400 font-semibold flex items-center gap-2">
                    <span className="text-lg">💰</span> Profit/Loss ($)
                  </Label>
                  <Input
                    type="number"
                    step="0.01"
                    placeholder="Enter profit/loss amount"
                    className="bg-[#0a0712] border-purple-900/30 mt-2 text-purple-300"
                    value={formData.profit_loss}
                    onChange={(e) => {
                      onFormChange('profit_loss', e.target.value)
                      if (errors.profit_loss) setErrors({ ...errors, profit_loss: '' })
                    }}
                  />
                  <div className="flex items-center justify-between mt-1">
                    <p className="text-xs text-gray-500">Enter the profit (positive) or loss (negative) amount</p>
                    {formData.profit_loss && (
                      <span className={`text-xs font-medium ${
                        parseFloat(formData.profit_loss) >= 0 ? 'text-green-400' : 'text-red-400'
                      }`}>
                        {parseFloat(formData.profit_loss) >= 0 ? '📈' : '📉'} P/L: ${formData.profit_loss}
                      </span>
                    )}
                  </div>
                  {errors.profit_loss && <p className="text-red-400 text-xs mt-1">{errors.profit_loss}</p>}
                </CardContent>
              </Card>
            </div>

            {/* Compact Time Section */}
            <div className="grid grid-cols-2 gap-3 pt-2">
              <div className="space-y-1">
                <Label className="text-gray-400 text-xs font-medium flex items-center gap-1">
                  <span className="text-green-400">▸</span> Open Time (WIB)
                </Label>
                <Input
                  type="datetime-local"
                  className="bg-[#0a0712] border-purple-900/30 text-xs h-9"
                  value={isoToDatetimeLocal(formData.open_time || '')}
                  onChange={(e) => onFormChange('open_time', datetimeLocalToISO(e.target.value))}
                />
              </div>
              <div className="space-y-1">
                <Label className="text-gray-400 text-xs font-medium flex items-center gap-1">
                  <span className="text-red-400">▸</span> Close Time (WIB)
                </Label>
                <Input
                  type="datetime-local"
                  className="bg-[#0a0712] border-purple-900/30 text-xs h-9"
                  value={isoToDatetimeLocal(formData.close_time || '')}
                  onChange={(e) => onFormChange('close_time', datetimeLocalToISO(e.target.value))}
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
      </div>

      {/* Navigation Buttons */}
      <div className="flex gap-3 pt-4 border-t border-purple-900/30 shrink-0">
        {currentStep > 1 ? (
          <Button
            variant="outline"
            onClick={handlePrevious}
            disabled={saving || uploading || analyzingScreenshot || uploadingMT5}
            className="border-purple-900/30 flex-1"
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            Previous
          </Button>
        ) : (
          <Button
            variant="outline"
            onClick={onCancel}
            disabled={saving || uploading || analyzingScreenshot || uploadingMT5}
            className="border-purple-900/30 flex-1"
          >
            Cancel
          </Button>
        )}

        {currentStep < totalSteps ? (
          <Button
            onClick={handleNext}
            disabled={saving || uploading || analyzingScreenshot || uploadingMT5}
            className="flex-1 bg-gradient-to-r from-purple-500 to-violet-600"
          >
            Next
            <ArrowRight className="w-4 h-4 ml-2" />
          </Button>
        ) : (
          <Button
            onClick={handleSave}
            disabled={saving || uploading || analyzingScreenshot || uploadingMT5}
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
