'use client'

import { useEffect, useRef } from 'react'
import confetti from 'canvas-confetti'

export function useConfetti() {
  const hasCelebratedRef = useRef<Set<string>>(new Set())

  const triggerConfetti = (triggerKey: string, options?: confetti.Options) => {
    // Prevent duplicate celebrations for the same trigger
    if (hasCelebratedRef.current.has(triggerKey)) {
      return
    }

    hasCelebratedRef.current.add(triggerKey)

    const defaultOptions: confetti.Options = {
      particleCount: 150,
      spread: 70,
      origin: { y: 0.6 },
      colors: ['#8b5cf6', '#f59e0b', '#22c55e', '#ec4899'],
      zIndex: 9999,
      ...options,
    }

    confetti(defaultOptions)

    // Clear the celebration flag after 5 minutes
    setTimeout(() => {
      hasCelebratedRef.current.delete(triggerKey)
    }, 5 * 60 * 1000)
  }

  const triggerMilestoneConfetti = (type: 'win-streak' | 'weekly-target' | 'first-trade') => {
    const optionsMap: Record<string, confetti.Options> = {
      'win-streak': {
        particleCount: 200,
        spread: 100,
        origin: { y: 0.7 },
        colors: ['#f59e0b', '#fb923c', '#fbbf24'],
      },
      'weekly-target': {
        particleCount: 250,
        spread: 120,
        origin: { y: 0.6 },
        colors: ['#22c55e', '#10b981', '#34d399'],
      },
      'first-trade': {
        particleCount: 180,
        spread: 90,
        origin: { y: 0.6 },
        colors: ['#8b5cf6', '#a78bfa', '#c4b5fd'],
      },
    }

    triggerConfetti(type, optionsMap[type])
  }

  return { triggerConfetti, triggerMilestoneConfetti }
}
