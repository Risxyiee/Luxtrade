'use client'

import React, { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Copy, Check } from 'lucide-react'
import { toast } from 'sonner'

interface DuplicateTradeButtonProps {
  tradeId: string
  tradeData: {
    symbol: string
    type: 'buy' | 'sell'
    open_price: number
    stop_loss?: number
    take_profit?: number
    volume?: number
  }
  onDuplicate?: (duplicateData: any) => void
}

export function DuplicateTradeButton({ tradeId, tradeData, onDuplicate }: DuplicateTradeButtonProps) {
  const [copied, setCopied] = useState(false)

  const handleDuplicate = () => {
    const duplicateData = {
      symbol: tradeData.symbol,
      type: tradeData.type,
      openPrice: tradeData.open_price,
      stopLoss: tradeData.stop_loss,
      takeProfit: tradeData.take_profit,
      volume: tradeData.volume,
    }

    if (onDuplicate) {
      onDuplicate(duplicateData)
    }

    setCopied(true)
    toast.success('Trade template copied! Fill in the rest of the details.')

    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <Button
      onClick={handleDuplicate}
      variant="ghost"
      size="sm"
      className="text-lux-text-secondary dark:text-gray-400 hover:text-cyan-400"
      title="Duplicate this trade template"
    >
      {copied ? (
        <Check className="w-4 h-4" />
      ) : (
        <Copy className="w-4 h-4" />
      )}
    </Button>
  )
}
