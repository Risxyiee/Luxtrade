'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Loader2, CheckCircle, Wallet, AlertCircle } from 'lucide-react'
import { toast } from 'sonner'

interface AddAccountFormProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onSuccess?: () => void
}

export default function AddAccountForm({ open, onOpenChange, onSuccess }: AddAccountFormProps) {
  const [formData, setFormData] = useState({
    name: '',
    broker: '',
    account_type: '',
    initial_balance: '',
    currency: '',
    broker_gmt_offset: ''
  })
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [isSubmitting, setIsSubmitting] = useState(false)

  const handleInputChange = (field: string, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }))
    // Clear error for this field
    if (errors[field]) {
      setErrors(prev => ({ ...prev, [field]: '' }))
    }
  }

  const validateForm = (): boolean => {
    const newErrors: Record<string, string> = {}

    // Account Name validation
    if (!formData.name.trim()) {
      newErrors.name = 'Account name is required'
    } else if (formData.name.trim().length < 2) {
      newErrors.name = 'Account name must be at least 2 characters'
    }

    // Broker Name validation
    if (!formData.broker.trim()) {
      newErrors.broker = 'Broker name is required'
    } else if (formData.broker.trim().length < 2) {
      newErrors.broker = 'Broker name must be at least 2 characters'
    }

    // Account Type validation
    if (!formData.account_type) {
      newErrors.account_type = 'Please select an account type'
    }

    // Balance validation
    if (!formData.initial_balance) {
      newErrors.initial_balance = 'Balance is required'
    } else {
      const balance = parseFloat(formData.initial_balance)
      if (isNaN(balance) || balance < 0) {
        newErrors.initial_balance = 'Please enter a valid balance'
      }
    }

    // Currency validation
    if (!formData.currency) {
      newErrors.currency = 'Please select a currency'
    }

    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    // Validate form
    if (!validateForm()) {
      toast.error('Please fix the errors before submitting')
      return
    }

    setIsSubmitting(true)

    try {
      const balance = parseFloat(formData.initial_balance)

      // Prepare data according to API specification
      const accountData = {
        name: formData.name.trim(),
        broker: formData.broker.trim(),
        account_type: formData.account_type, // "DEMO", "REAL", "CENT"
        initial_balance: balance,
        current_balance: balance, // Same as initial_balance when creating
        currency: formData.currency, // "USD" or "IDR"
        broker_gmt_offset: formData.broker_gmt_offset ? parseInt(formData.broker_gmt_offset) : 0,
        is_default: false,
        is_active: true
      }

      // Send to API endpoint (auth is handled via cookies by @supabase/ssr)
      const response = await fetch('/api/trading-accounts', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(accountData),
        credentials: 'include' // Important for cookie-based auth
      })

      const result = await response.json()

      if (!response.ok) {
        throw new Error(result.error || result.message || 'Failed to add trading account')
      }

      // Success!
      toast.success('Trading account added successfully!', {
        icon: <CheckCircle className="w-5 h-5 text-green-500" />
      })

      // Reset form
      setFormData({
        name: '',
        broker: '',
        account_type: '',
        initial_balance: '',
        currency: '',
        broker_gmt_offset: ''
      })
      setErrors({})

      // Close dialog
      onOpenChange(false)

      // Call onSuccess callback if provided
      if (onSuccess) {
        onSuccess()
      }

    } catch (error) {
      console.error('Error adding trading account:', error)
      toast.error(error instanceof Error ? error.message : 'Failed to add trading account')
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleClose = () => {
    if (!isSubmitting) {
      onOpenChange(false)
      // Reset form when closing
      setTimeout(() => {
        setFormData({
          name: '',
          broker: '',
          account_type: '',
          initial_balance: '',
          currency: '',
          broker_gmt_offset: ''
        })
        setErrors({})
      }, 300)
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="bg-gradient-to-br from-lux-bg-card dark:from-[#080b12] to-[#0a0e18] border-lux-input-border dark:border-blue-900/30 text-white max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-xl">
            <Wallet className="w-6 h-6 text-cyan-400" />
            Add Trading Account
          </DialogTitle>
          <p className="text-sm text-gray-400 mt-1">
            Add a new trading account to track your performance
          </p>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-5 mt-4">
          {/* Account Name */}
          <div className="space-y-2">
            <Label htmlFor="name" className="text-lux-text-primary dark:text-white font-medium">
              Account Name *
            </Label>
            <Input
              id="name"
              type="text"
              placeholder="My Main Account"
              value={formData.name}
              onChange={(e) => handleInputChange('name', e.target.value)}
              className={`bg-lux-input-bg dark:bg-[#070a10] border-lux-input-border dark:border-blue-900/30 text-white placeholder:text-lux-text-muted dark:placeholder:text-gray-600 
                ${errors.name ? 'border-red-500 focus:border-red-500' : 'focus:border-blue-500'}
              `}
            />
            {errors.name && (
              <p className="text-red-400 text-xs flex items-center gap-1">
                <AlertCircle className="w-3 h-3" />
                {errors.name}
              </p>
            )}
          </div>

          {/* Broker Name */}
          <div className="space-y-2">
            <Label htmlFor="broker" className="text-lux-text-primary dark:text-white font-medium">
              Broker Name *
            </Label>
            <Input
              id="broker"
              type="text"
              placeholder="e.g., Exness, ICMarkets, XM"
              value={formData.broker}
              onChange={(e) => handleInputChange('broker', e.target.value)}
              className={`bg-lux-input-bg dark:bg-[#070a10] border-lux-input-border dark:border-blue-900/30 text-white placeholder:text-lux-text-muted dark:placeholder:text-gray-600 
                ${errors.broker ? 'border-red-500 focus:border-red-500' : 'focus:border-blue-500'}
              `}
            />
            {errors.broker && (
              <p className="text-red-400 text-xs flex items-center gap-1">
                <AlertCircle className="w-3 h-3" />
                {errors.broker}
              </p>
            )}
          </div>

          {/* Account Type */}
          <div className="space-y-2">
            <Label htmlFor="account_type" className="text-lux-text-primary dark:text-white font-medium">
              Account Type *
            </Label>
            <Select 
              value={formData.account_type} 
              onValueChange={(value) => handleInputChange('account_type', value)}
            >
              <SelectTrigger 
                id="account_type"
                className={`bg-lux-input-bg dark:bg-[#070a10] border-lux-input-border dark:border-blue-900/30 text-white 
                  ${errors.account_type ? 'border-red-500 focus:border-red-500' : 'focus:border-blue-500'}
                `}
              >
                <SelectValue placeholder="Select account type" />
              </SelectTrigger>
              <SelectContent className="bg-lux-bg-card dark:bg-[#080b12] border-lux-input-border dark:border-blue-900/30">
                <SelectItem value="DEMO" className="text-blue-400">
                  📊 Demo Account
                </SelectItem>
                <SelectItem value="REAL" className="text-green-400">
                  💰 Real Account
                </SelectItem>
                <SelectItem value="CENT" className="text-yellow-400">
                  🪙 Cent Account
                </SelectItem>
              </SelectContent>
            </Select>
            {errors.account_type && (
              <p className="text-red-400 text-xs flex items-center gap-1">
                <AlertCircle className="w-3 h-3" />
                {errors.account_type}
              </p>
            )}
          </div>

          {/* Balance and Currency - Grid Layout */}
          <div className="grid grid-cols-2 gap-4">
            {/* Balance */}
            <div className="space-y-2">
              <Label htmlFor="balance" className="text-lux-text-primary dark:text-white font-medium">
                Balance *
              </Label>
              <Input
                id="balance"
                type="number"
                step="0.01"
                min="0"
                placeholder="1000"
                value={formData.initial_balance}
                onChange={(e) => handleInputChange('initial_balance', e.target.value)}
                className={`bg-lux-input-bg dark:bg-[#070a10] border-lux-input-border dark:border-blue-900/30 text-white placeholder:text-lux-text-muted dark:placeholder:text-gray-600 
                  ${errors.initial_balance ? 'border-red-500 focus:border-red-500' : 'focus:border-blue-500'}
                `}
              />
              {errors.initial_balance && (
                <p className="text-red-400 text-xs flex items-center gap-1">
                  <AlertCircle className="w-3 h-3" />
                  {errors.initial_balance}
                </p>
              )}
            </div>

            {/* Currency */}
            <div className="space-y-2">
              <Label htmlFor="currency" className="text-lux-text-primary dark:text-white font-medium">
                Currency *
              </Label>
              <Select 
                value={formData.currency} 
                onValueChange={(value) => handleInputChange('currency', value)}
              >
                <SelectTrigger 
                  id="currency"
                  className={`bg-lux-input-bg dark:bg-[#070a10] border-lux-input-border dark:border-blue-900/30 text-white 
                    ${errors.currency ? 'border-red-500 focus:border-red-500' : 'focus:border-blue-500'}
                  `}
                >
                  <SelectValue placeholder="Select" />
                </SelectTrigger>
                <SelectContent className="bg-lux-bg-card dark:bg-[#080b12] border-lux-input-border dark:border-blue-900/30">
                  <SelectItem value="USD">
                    🇺🇸 USD
                  </SelectItem>
                  <SelectItem value="IDR">
                    🇮🇩 IDR
                  </SelectItem>
                </SelectContent>
              </Select>
              {errors.currency && (
                <p className="text-red-400 text-xs flex items-center gap-1">
                  <AlertCircle className="w-3 h-3" />
                  {errors.currency}
                </p>
              )}
            </div>
          </div>

          {/* GMT Offset (Opsional) */}
          <div className="space-y-2">
            <Label htmlFor="gmt_offset" className="text-lux-text-primary dark:text-white font-medium">
              Selisih Jam Server Broker (opsional)
            </Label>
            <Input
              id="gmt_offset"
              type="number"
              placeholder="0"
              value={formData.broker_gmt_offset}
              onChange={(e) => handleInputChange('broker_gmt_offset', e.target.value)}
              className="bg-lux-input-bg dark:bg-[#070a10] border-lux-input-border dark:border-blue-900/30 text-white placeholder:text-lux-text-muted dark:placeholder:text-gray-600 focus:border-blue-500"
            />
            <p className="text-[10px] text-gray-500">
              Cek jam yang tertera di pojok kanan bawah chart MT5/MT4 kamu, lalu bandingkan dengan jam HP kamu sekarang untuk tahu selisihnya. Kosongkan kalau tidak yakin.
            </p>
          </div>

          {/* Action Buttons */}
          <div className="flex gap-3 pt-4">
            <Button
              type="button"
              variant="outline"
              onClick={handleClose}
              disabled={isSubmitting}
              className="flex-1 border-lux-input-border dark:border-lux-border dark:border-blue-900/30 text-lux-text-secondary dark:text-gray-300 hover:bg-lux-surface-hover dark:hover:bg-blue-900/10"
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={isSubmitting}
              className="flex-1 bg-gradient-to-r from-blue-500 to-cyan-600 hover:from-blue-600 hover:to-cyan-600 text-white font-medium"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Adding...
                </>
              ) : (
                <>
                  <CheckCircle className="w-4 h-4 mr-2" />
                  Add Account
                </>
              )}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}
