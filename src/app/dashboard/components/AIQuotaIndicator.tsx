'use client'

import { Brain, Sparkles, Zap } from 'lucide-react'
import { useEffect, useState } from 'react'

interface AIQuotaIndicatorProps {
  isPro: boolean
}

export function AIQuotaIndicator({ isPro }: AIQuotaIndicatorProps) {
  const [quota, setQuota] = useState<{ total: number; used: number; remaining: number } | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchAIQuota()
  }, [isPro])

  const fetchAIQuota = async () => {
    try {
      const res = await fetch('/api/user/ai-quota')
      if (res.ok) {
        const data = await res.json()
        setQuota(data)
      }
    } catch (err) {
      console.error('Failed to fetch AI quota:', err)
    } finally {
      setLoading(false)
    }
  }

  // PRO users don't need quota display
  if (isPro) {
    return (
      <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-gradient-to-r from-purple-500/20 to-blue-500/20 border border-purple-500/30">
        <Brain className="w-4 h-4 text-purple-400" />
        <span className="text-xs font-medium text-purple-300">AI Unlimited</span>
      </div>
    )
  }

  // Loading state
  if (loading) {
    return (
      <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-white/5 border border-white/10">
        <div className="w-4 h-4 rounded-full border-2 border-white/20 border-t-purple-400 animate-spin" />
      </div>
    )
  }

  // No quota data
  if (!quota) {
    return null
  }

  // Free users with quota
  const { remaining } = quota
  const isLow = remaining === 0
  const isWarning = remaining === 1

  return (
    <div className={`flex items-center gap-2 px-3 py-1.5 rounded-full border ${
      isLow
        ? 'bg-red-500/10 border-red-500/30'
        : isWarning
        ? 'bg-amber-500/10 border-amber-500/30'
        : 'bg-green-500/10 border-green-500/30'
    }`}>
      {isLow ? (
        <Sparkles className="w-4 h-4 text-red-400" />
      ) : isWarning ? (
        <Zap className="w-4 h-4 text-amber-400" />
      ) : (
        <Brain className="w-4 h-4 text-green-400" />
      )}
      <span className={`text-xs font-medium ${
        isLow ? 'text-red-300' : isWarning ? 'text-amber-300' : 'text-green-300'
      }`}>
        {remaining === 0
          ? 'AI Habis'
          : `${remaining}x AI Trial`
        }
      </span>
    </div>
  )
}