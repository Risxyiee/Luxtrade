'use client'

import React, { createContext, useContext, useState, ReactNode } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { X, ChevronDown, ChevronUp } from 'lucide-react'

interface GuideTip {
  id: string
  title: {
    id: string
    en: string
  }
  description: {
    id: string
    en: string
  }
  tips?: {
    id: string
    en: string
  }
}

export const guideData: Record<string, GuideTip> = {
  addTrade: {
    id: 'addTrade',
    title: {
      id: 'Tambah Trade',
      en: 'Add Trade'
    },
    description: {
      id: 'Catat trade baru dengan detail lengkap: pair, entry/exit, lot size, dan screenshot.',
      en: 'Record a new trade with full details: pair, entry/exit, lot size, and screenshot.'
    },
    tips: {
      id: 'Selalu isi catatan psikologi untuk review.',
      en: 'Always fill psychology notes for review.'
    }
  },
  addAccount: {
    id: 'addAccount',
    title: {
      id: 'Tambah Akun Trading',
      en: 'Add Trading Account'
    },
    description: {
      id: 'Buat akun trading baru untuk memisahkan strategi atau broker yang berbeda.',
      en: 'Create a new trading account to separate different strategies or brokers.'
    },
    tips: {
      id: 'Anda bisa memiliki multiple akun trading.',
      en: 'You can have multiple trading accounts.'
    }
  },
  risk: {
    id: 'risk',
    title: {
      id: 'Kalkulator Risiko',
      en: 'Risk Calculator'
    },
    description: {
      id: 'Hitung position size yang tepat berdasarkan risk per trade (1-2% rule).',
      en: 'Calculate proper position size based on risk per trade (1-2% rule).'
    }
  },
  analytics: {
    id: 'analytics',
    title: {
      id: 'Analitik',
      en: 'Analytics'
    },
    description: {
      id: 'Analisis performa mendalam per pair, session, dan timeframe.',
      en: 'Deep performance analysis per pair, session, and timeframe.'
    }
  },
  ai: {
    id: 'ai',
    title: {
      id: 'Insight AI',
      en: 'AI Insights'
    },
    description: {
      id: 'Dapatkan rekomendasi AI berdasarkan data trading Anda dan tanya apapun tentang trading.',
      en: 'Get AI recommendations based on your trading data and ask anything about trading.'
    }
  },
  achievements: {
    id: 'achievements',
    title: {
      id: 'Pencapaian',
      en: 'Achievements'
    },
    description: {
      id: 'Capai milestone dan unlock badges yang menunjukkan progress trading Anda.',
      en: 'Reach milestones and unlock badges showing your trading progress.'
    }
  },
  targets: {
    id: 'targets',
    title: {
      id: 'Target Trading',
      en: 'Trading Targets'
    },
    description: {
      id: 'Set dan track target trading bulanan (profit, max loss, drawdown).',
      en: 'Set and track monthly trading targets (profit, max loss, drawdown).'
    }
  }
}

interface ContextGuideContextType {
  activeGuide: string | null
  openGuide: (guideId: string) => void
  closeGuide: () => void
}

const ContextGuideContext = createContext<ContextGuideContextType | undefined>(undefined)

export function useContextGuides() {
  const context = useContext(ContextGuideContext)
  if (!context) {
    throw new Error('useContextGuides must be used within ContextGuideProvider')
  }
  return context
}

interface ContextGuideProviderProps {
  children: ReactNode
}

export function ContextGuideProvider({ children }: ContextGuideProviderProps) {
  const [activeGuide, setActiveGuide] = useState<string | null>(null)

  const openGuide = (guideId: string) => {
    setActiveGuide(guideId)
  }

  const closeGuide = () => {
    setActiveGuide(null)
  }

  return (
    <ContextGuideContext.Provider value={{ activeGuide, openGuide, closeGuide }}>
      {children}
    </ContextGuideContext.Provider>
  )
}

interface ContextGuideProps {
  isOpen: boolean
  onClose: () => void
  title: string
  description: string
  tips?: string
  language: 'id' | 'en'
  position?: 'top' | 'bottom' | 'left' | 'right'
}

export function ContextGuide({
  isOpen,
  onClose,
  title,
  description,
  tips,
  language = 'id',
  position = 'bottom'
}: ContextGuideProps) {
  if (!isOpen) return null

  const positionStyles = {
    top: 'bottom-full left-1/2 -translate-x-1/2 mb-2',
    bottom: 'top-full left-1/2 -translate-x-1/2 mt-2',
    left: 'right-full top-1/2 -translate-y-1/2 mr-2',
    right: 'left-full top-1/2 -translate-y-1/2 ml-2'
  }

  const arrowStyles = {
    top: 'bottom-[-6px] left-1/2 -translate-x-1/2 border-l-blue-500 border-r-blue-500 border-b-blue-500',
    bottom: 'top-[-6px] left-1/2 -translate-x-1/2 border-l-blue-500 border-r-blue-500 border-t-blue-500',
    left: 'right-[-6px] top-1/2 -translate-y-1/2 border-t-blue-500 border-b-blue-500 border-r-blue-500',
    right: 'left-[-6px] top-1/2 -translate-y-1/2 border-t-blue-500 border-b-blue-500 border-l-blue-500'
  }

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop */}
          <div
            className="fixed inset-0 z-40"
            onClick={onClose}
          />

          {/* Tooltip */}
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: position === 'top' ? 10 : -10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: position === 'top' ? 10 : -10 }}
            transition={{ duration: 0.2 }}
            className={`fixed z-50 w-72 max-w-sm ${positionStyles[position]}`}
          >
            {/* Tooltip Content */}
            <div className="relative bg-[#1a1628] border border-blue-500/30 rounded-xl shadow-2xl shadow-blue-500/20 overflow-hidden">
              {/* Header */}
              <div className="bg-gradient-to-r from-blue-500/20 to-blue-500/20 px-4 py-3 border-b border-blue-500/20">
                <div className="flex items-center justify-between gap-3">
                  <h3 className="text-sm font-bold text-white flex-1">{title}</h3>
                  <button
                    onClick={onClose}
                    className="p-1 rounded-lg hover:bg-white/10 text-gray-400 hover:text-white transition-colors flex-shrink-0"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              </div>

              {/* Description */}
              <div className="px-4 py-3">
                <p className="text-xs text-gray-300 leading-relaxed">{description}</p>
              </div>

              {/* Tips */}
              {tips && (
                <div className="px-4 pb-3">
                  <div className="bg-blue-500/10 border border-blue-500/20 rounded-lg p-2">
                    <div className="flex items-start gap-2">
                      <span className="text-cyan-400 mt-0.5">💡</span>
                      <p className="text-[11px] text-cyan-300 leading-snug">{tips}</p>
                    </div>
                  </div>
                </div>
              )}

              {/* Arrow */}
              <div className={`absolute w-3 h-3 border-4 border-transparent ${arrowStyles[position]}`} />
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  )
}

// Re-export for backward compatibility
export { ContextGuideProvider as default, guideData }