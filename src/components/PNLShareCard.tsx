'use client'

import React, { useRef, useState, forwardRef } from 'react'
import { motion } from 'framer-motion'
import { toPng } from 'html-to-image'
import { Download, Share2, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'

interface PNLShareCardProps {
  symbol: string
  type: 'BUY' | 'SELL'
  entryPrice: number
  exitPrice: number
  lotSize: number
  profitLoss: number
  session?: string
  date?: string
  pips?: number
  id?: string
  showExport?: boolean
}

// Colors
const DEEP_BLACK = '#010409'
const ROSE_GOLD = '#B76E79'
const EMERALD_GREEN = '#10B981'
const RED_LOSS = '#EF4444'
const FADED_WHITE = '#94A3B8'

const PNLShareCard = forwardRef<HTMLDivElement, PNLShareCardProps>(function PNLShareCard({
  symbol,
  type,
  entryPrice,
  exitPrice,
  lotSize,
  profitLoss,
  session = 'London',
  date,
  pips,
  id = 'pnl-share-card',
  showExport = true,
}, ref) {
  const cardRef = useRef<HTMLDivElement>(null)
  const [exporting, setExporting] = useState(false)
  
  // Use forwarded ref or local ref
  const actualRef = (ref as React.RefObject<HTMLDivElement>) || cardRef

  const isProfit = profitLoss >= 0
  const profitColor = isProfit ? EMERALD_GREEN : RED_LOSS
  
  // Calculate pips if not provided
  const calculatedPips = pips ?? (() => {
    if (symbol.includes('JPY')) {
      return type === 'BUY' 
        ? (exitPrice - entryPrice) * 100 
        : (entryPrice - exitPrice) * 100
    }
    if (symbol.includes('XAU') || symbol.includes('XAG')) {
      return type === 'BUY'
        ? (exitPrice - entryPrice) * 10
        : (entryPrice - exitPrice) * 10
    }
    return type === 'BUY' 
      ? (exitPrice - entryPrice) * 10000 
      : (entryPrice - exitPrice) * 10000
  })()

  // Format price based on pair
  const formatPrice = (price: number) => {
    if (symbol.includes('JPY')) {
      return price.toFixed(3)
    }
    if (symbol.includes('XAU') || symbol.includes('XAG')) {
      return price.toFixed(2)
    }
    return price.toFixed(5)
  }

  // Format currency
  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 2,
    }).format(value)
  }

  // Export to PNG (1080x1350)
  const handleExport = async () => {
    if (!actualRef.current) return
    
    setExporting(true)
    try {
      const dataUrl = await toPng(actualRef.current, {
        width: 1080,
        height: 1350,
        pixelRatio: 2,
        backgroundColor: DEEP_BLACK,
        cacheBust: true,
        fontEmbedCSS: '',
      })

      // Create download link
      const link = document.createElement('a')
      link.download = `pnl-${symbol}-${Date.now()}.png`
      link.href = dataUrl
      link.click()
    } catch (error) {
      console.error('Export failed:', error)
    } finally {
      setExporting(false)
    }
  }

  // Share functionality
  const handleShare = async () => {
    if (!actualRef.current) return
    
    setExporting(true)
    try {
      const dataUrl = await toPng(actualRef.current, {
        width: 1080,
        height: 1350,
        pixelRatio: 2,
        backgroundColor: DEEP_BLACK,
      })

      // Convert to blob
      const response = await fetch(dataUrl)
      const blob = await response.blob()
      
      // Check if Web Share API is available
      if (navigator.share && navigator.canShare) {
        const file = new File([blob], `pnl-${symbol}.png`, { type: 'image/png' })
        await navigator.share({
          title: 'My Trade Result',
          text: `Just closed a ${symbol} trade with ${isProfit ? '+' : ''}${formatCurrency(profitLoss)}!`,
          files: [file],
        })
      } else {
        // Fallback to download
        handleExport()
      }
    } catch (error) {
      console.error('Share failed:', error)
    } finally {
      setExporting(false)
    }
  }

  // Generate equity curve path for SVG watermark
  const generateEquityPath = () => {
    const points: string[] = []
    const width = 1080
    const height = 400
    
    let y = height * 0.6
    for (let i = 0; i <= 60; i++) {
      const x = (i / 60) * width
      // Random walk with upward trend
      const change = (Math.sin(i * 0.3) + Math.cos(i * 0.7) + Math.random() - 0.3) * 25
      y = Math.max(height * 0.15, Math.min(height * 0.85, y - change * 0.5))
      
      if (i === 0) {
        points.push(`M ${x} ${y + 300}`)
      } else {
        const prevX = ((i - 1) / 60) * width
        const cpX = (prevX + x) / 2
        points.push(`Q ${cpX} ${y + 300 + (Math.random() - 0.5) * 30} ${x} ${y + 300}`)
      }
    }
    
    return points.join(' ')
  }

  return (
    <div className="space-y-4 flex flex-col items-center">
      {/* Card - 1080x1350 aspect ratio with proper centering */}
      <div 
        ref={actualRef}
        id={id}
        className="relative overflow-hidden"
        style={{ 
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'center',
          alignItems: 'center',
          width: '1080px',
          height: '1350px',
          backgroundColor: DEEP_BLACK,
          fontFamily: 'ui-monospace, SFMono-Regular, "SF Mono", Menlo, Consolas, monospace',
          maxWidth: '540px',
          margin: '0 auto'
        }}
      >
        {/* Watermark Equity Curve SVG */}
        <svg 
          className="absolute inset-0 w-full h-full pointer-events-none"
          viewBox="0 0 1080 1080"
          preserveAspectRatio="xMidYMid slice"
        >
          {/* Main equity curve */}
          <path
            d={generateEquityPath()}
            fill="none"
            stroke={ROSE_GOLD}
            strokeWidth="2.5"
            opacity="0.05"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          {/* Secondary curve for depth */}
          <path
            d={generateEquityPath()}
            fill="none"
            stroke={ROSE_GOLD}
            strokeWidth="1.5"
            opacity="0.03"
            strokeLinecap="round"
            strokeLinejoin="round"
            transform="translate(0, 80)"
          />
          {/* Area fill */}
          <path
            d={`${generateEquityPath()} L 1080 1080 L 0 1080 Z`}
            fill={ROSE_GOLD}
            opacity="0.02"
          />
        </svg>
        
        {/* Subtle Grid Pattern */}
        <div 
          className="absolute inset-0 opacity-[0.015]"
          style={{
            backgroundImage: `
              linear-gradient(rgba(255,255,255,0.1) 1px, transparent 1px),
              linear-gradient(90deg, rgba(255,255,255,0.1) 1px, transparent 1px)
            `,
            backgroundSize: '32px 32px'
          }}
        />

        {/* Content Container - Perfectly Centered */}
        <div className="relative z-10 h-full flex flex-col items-center justify-between p-8">
          
          {/* Header - Logo & Brand (Centered) */}
          <div className="flex items-center justify-center gap-3 w-full mb-6">
            {/* Phoenix Logo */}
            <img 
              src="/logo.png" 
              alt="LuxTrade Logo" 
              className="w-14 h-14 rounded-xl flex-shrink-0"
            />
            <div className="flex flex-col items-center justify-center">
              <span className="text-2xl font-bold text-white tracking-tight">
                LuxTrade
              </span>
              <span className="text-[10px] tracking-widest uppercase" style={{ color: FADED_WHITE }}>
                Trading Journal
              </span>
            </div>
          </div>

          {/* Main Content - Centered */}
          <div className="flex-1 flex flex-col items-center justify-center w-full">
            {/* Symbol & Type Badge (Centered) */}
            <div className="flex items-center justify-center gap-3 mb-6 w-full">
              <span className="text-3xl font-bold text-white tracking-tight">
                {symbol}
              </span>
              <span 
                className="px-4 py-1.5 rounded-lg text-sm font-bold tracking-wider"
                style={{ 
                  backgroundColor: type === 'BUY' ? 'rgba(16, 185, 129, 0.15)' : 'rgba(239, 68, 68, 0.15)',
                  color: type === 'BUY' ? EMERALD_GREEN : RED_LOSS,
                  border: `1px solid ${type === 'BUY' ? EMERALD_GREEN : RED_LOSS}30`
                }}
              >
                {type}
              </span>
            </div>

            {/* Profit/Loss - Main Display (Centered) */}
            <div className="text-center mb-6 w-full">
              <p 
                className="text-sm uppercase tracking-widest mb-2 text-center"
                style={{ color: FADED_WHITE }}
              >
                Profit / Loss
              </p>
              <motion.p 
                className="text-6xl font-bold tracking-tight leading-none text-center"
                style={{ color: profitColor }}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.3 }}
              >
                {isProfit ? '+' : ''}{formatCurrency(profitLoss)}
              </motion.p>
              <p 
                className="text-base mt-3 text-center"
                style={{ color: FADED_WHITE }}
              >
                {isProfit ? '+' : ''}{calculatedPips.toFixed(1)} pips
              </p>
            </div>

            {/* Glassmorphism Data Boxes (Centered Grid) */}
            <div className="grid grid-cols-2 gap-4 w-full max-w-[400px]">
              {/* Entry Price */}
              <div 
                className="rounded-xl p-4 border text-center"
                style={{
                  background: 'rgba(139, 92, 246, 0.03)',
                  backdropFilter: 'blur(12px)',
                  borderColor: 'rgba(139, 92, 246, 0.08)'
                }}
              >
                <p 
                  className="text-xs uppercase tracking-widest mb-1"
                  style={{ color: FADED_WHITE }}
                >
                  Entry Price
                </p>
                <p className="text-xl font-semibold text-white font-mono">
                  {formatPrice(entryPrice)}
                </p>
              </div>

              {/* Exit Price */}
              <div 
                className="rounded-xl p-4 border text-center"
                style={{
                  background: 'rgba(139, 92, 246, 0.03)',
                  backdropFilter: 'blur(12px)',
                  borderColor: 'rgba(139, 92, 246, 0.08)'
                }}
              >
                <p 
                  className="text-xs uppercase tracking-widest mb-1"
                  style={{ color: FADED_WHITE }}
                >
                  Exit Price
                </p>
                <p className="text-xl font-semibold text-white font-mono">
                  {formatPrice(exitPrice)}
                </p>
              </div>

              {/* Lot Size */}
              <div 
                className="rounded-xl p-4 border text-center"
                style={{
                  background: 'rgba(139, 92, 246, 0.03)',
                  backdropFilter: 'blur(12px)',
                  borderColor: 'rgba(139, 92, 246, 0.08)'
                }}
              >
                <p 
                  className="text-xs uppercase tracking-widest mb-1"
                  style={{ color: FADED_WHITE }}
                >
                  Lot Size
                </p>
                <p className="text-xl font-semibold text-white">
                  {lotSize.toFixed(2)}
                </p>
              </div>

              {/* Session */}
              <div 
                className="rounded-xl p-4 border text-center"
                style={{
                  background: 'rgba(139, 92, 246, 0.03)',
                  backdropFilter: 'blur(12px)',
                  borderColor: 'rgba(139, 92, 246, 0.08)'
                }}
              >
                <p 
                  className="text-xs uppercase tracking-widest mb-1"
                  style={{ color: FADED_WHITE }}
                >
                  Session
                </p>
                <p className="text-xl font-semibold text-white">
                  {session}
                </p>
              </div>
            </div>
          </div>

          {/* Bottom Section (Centered) */}
          <div className="w-full mt-6">
            {/* Date (Centered) */}
            <p 
              className="text-sm text-center mb-4"
              style={{ color: '#64748B' }}
            >
              {date || new Date().toLocaleDateString('en-US', {
                weekday: 'short',
                day: 'numeric',
                month: 'short',
                year: 'numeric'
              })}
            </p>

            {/* Footer (Centered) */}
            <div className="pt-4 border-t border-white/5">
              <p className="text-xs text-center tracking-widest" style={{ color: 'rgba(255,255,255,0.25)' }}>
                measured by <span className="font-semibold" style={{ color: 'rgba(255,255,255,0.4)' }}>LuxTrade</span>
              </p>
            </div>
          </div>
        </div>

        {/* Subtle corner accent */}
        <div 
          className="absolute top-0 right-0 w-48 h-48 pointer-events-none"
          style={{
            background: `radial-gradient(circle at top right, ${ROSE_GOLD}08, transparent 60%)`
          }}
        />
      </div>

      {/* Export Buttons */}
      {showExport && (
        <div className="flex gap-3 justify-center">
          <Button
            onClick={handleExport}
            disabled={exporting}
            className="bg-gradient-to-r from-purple-500 to-violet-600 hover:from-purple-600 hover:to-violet-700 text-white font-semibold"
          >
            {exporting ? (
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
            ) : (
              <Download className="w-4 h-4 mr-2" />
            )}
            Download PNG
          </Button>
          <Button
            onClick={handleShare}
            disabled={exporting}
            variant="outline"
            className="border-white/20 text-white hover:bg-white/5"
          >
            <Share2 className="w-4 h-4 mr-2" />
            Share
          </Button>
        </div>
      )}
    </div>
  )
})

export default PNLShareCard

// Export helper function
export async function exportPnlCardAsPng(
  element: HTMLElement, 
  symbol: string
): Promise<string> {
  const dataUrl = await toPng(element, {
    width: 1080,
    height: 1350,
    pixelRatio: 2,
    backgroundColor: DEEP_BLACK,
    cacheBust: true,
  })
  
  const link = document.createElement('a')
  link.download = `pnl-${symbol}-${Date.now()}.png`
  link.href = dataUrl
  link.click()
  
  return dataUrl
}
