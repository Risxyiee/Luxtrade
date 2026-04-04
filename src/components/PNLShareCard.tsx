'use client'

import React, { useRef, useState, forwardRef, useCallback } from 'react'
import { motion } from 'framer-motion'
import { domToPng } from 'modern-screenshot'
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

// Card dimensions for export (1080x1350 - Instagram Portrait)
const CARD_WIDTH = 1080
const CARD_HEIGHT = 1350

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

  // Export to PNG with modern-screenshot
  const handleExport = useCallback(async () => {
    const card = actualRef.current
    if (!card) {
      console.error('Card element not found')
      return
    }
    
    setExporting(true)
    
    try {
      // Wait for fonts
      await document.fonts.ready
      await new Promise(resolve => setTimeout(resolve, 200))
      
      console.log('📸 Taking screenshot with modern-screenshot...')
      
      // Use modern-screenshot for reliable capture
      const dataUrl = await domToPng(card, {
        scale: 3,
        width: CARD_WIDTH,
        height: CARD_HEIGHT,
        backgroundColor: DEEP_BLACK,
        style: {
          // Force all styles inline
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'space-between',
        }
      })
      
      console.log('✅ Screenshot complete!')
      
      // Download
      const link = document.createElement('a')
      link.download = `pnl-${symbol}-${Date.now()}.png`
      link.href = dataUrl
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
      
    } catch (error) {
      console.error('Export failed:', error)
      alert('Gagal download gambar. Silakan coba lagi.')
    } finally {
      setExporting(false)
    }
  }, [actualRef, symbol])

  // Share functionality
  const handleShare = useCallback(async () => {
    const card = actualRef.current
    if (!card) return
    
    setExporting(true)
    
    try {
      await document.fonts.ready
      await new Promise(resolve => setTimeout(resolve, 200))
      
      const dataUrl = await domToPng(card, {
        scale: 3,
        width: CARD_WIDTH,
        height: CARD_HEIGHT,
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
        const url = URL.createObjectURL(blob)
        const link = document.createElement('a')
        link.download = `pnl-${symbol}-${Date.now()}.png`
        link.href = url
        document.body.appendChild(link)
        link.click()
        document.body.removeChild(link)
        URL.revokeObjectURL(url)
      }
      
    } catch (error) {
      console.error('Share failed:', error)
    } finally {
      setExporting(false)
    }
  }, [actualRef, symbol, isProfit, profitLoss])

  // Generate equity curve path for SVG watermark
  const generateEquityPath = () => {
    const points: string[] = []
    const width = 1080
    const height = 400
    
    let y = height * 0.6
    for (let i = 0; i <= 60; i++) {
      const x = (i / 60) * width
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
    <div className="flex flex-col items-center gap-4 w-full">
      {/* Responsive Card Container */}
      <div 
        className="w-full max-w-[350px] mx-auto overflow-hidden"
      >
        {/* Card - Fixed 1080x1350 aspect ratio */}
        <div 
          ref={actualRef}
          id={id}
          className="relative overflow-hidden"
          style={{ 
            width: '100%',
            aspectRatio: '1080 / 1350',
            backgroundColor: DEEP_BLACK,
            // INLINE CENTERED STYLES - HARDCODED FOR EXPORT
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '24px',
            fontFamily: 'ui-monospace, SFMono-Regular, "SF Mono", Menlo, Consolas, monospace',
          }}
        >
          {/* Watermark Equity Curve SVG */}
          <svg 
            className="absolute inset-0 w-full h-full pointer-events-none"
            viewBox="0 0 1080 1080"
            preserveAspectRatio="xMidYMid slice"
          >
            <path
              d={generateEquityPath()}
              fill="none"
              stroke={ROSE_GOLD}
              strokeWidth="2.5"
              opacity="0.05"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
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
          </svg>
          
          {/* Grid Pattern */}
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

          {/* ========== HEADER - CENTERED ========== */}
          <div 
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '8px',
              width: '100%',
              marginBottom: '16px',
            }}
          >
            <img 
              src="/logo.png" 
              alt="LuxTrade Logo" 
              style={{ width: '40px', height: '40px', borderRadius: '8px' }}
            />
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
              <span style={{ fontSize: '20px', fontWeight: 'bold', color: 'white' }}>
                LuxTrade
              </span>
              <span style={{ fontSize: '10px', letterSpacing: '2px', color: FADED_WHITE, textTransform: 'uppercase' }}>
                Trading Journal
              </span>
            </div>
          </div>

          {/* ========== MAIN CONTENT - CENTERED ========== */}
          <div 
            style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              flex: 1,
              width: '100%',
            }}
          >
            {/* Symbol & Type */}
            <div 
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '8px',
                marginBottom: '16px',
              }}
            >
              <span style={{ fontSize: '24px', fontWeight: 'bold', color: 'white' }}>
                {symbol}
              </span>
              <span 
                style={{
                  padding: '4px 12px',
                  borderRadius: '8px',
                  fontSize: '12px',
                  fontWeight: 'bold',
                  backgroundColor: type === 'BUY' ? 'rgba(16, 185, 129, 0.15)' : 'rgba(239, 68, 68, 0.15)',
                  color: type === 'BUY' ? EMERALD_GREEN : RED_LOSS,
                  border: `1px solid ${type === 'BUY' ? EMERALD_GREEN : RED_LOSS}30`
                }}
              >
                {type}
              </span>
            </div>

            {/* Profit/Loss */}
            <div style={{ textAlign: 'center', marginBottom: '16px' }}>
              <p style={{ fontSize: '10px', letterSpacing: '2px', color: FADED_WHITE, textTransform: 'uppercase', marginBottom: '4px' }}>
                Profit / Loss
              </p>
              <motion.p 
                style={{ fontSize: '48px', fontWeight: 'bold', color: profitColor, lineHeight: 1 }}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.3 }}
              >
                {isProfit ? '+' : ''}{formatCurrency(profitLoss)}
              </motion.p>
              <p style={{ fontSize: '14px', color: FADED_WHITE, marginTop: '8px' }}>
                {isProfit ? '+' : ''}{calculatedPips.toFixed(1)} pips
              </p>
            </div>

            {/* Data Boxes */}
            <div 
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(2, 1fr)',
                gap: '12px',
                maxWidth: '280px',
                width: '100%',
              }}
            >
              {/* Entry Price */}
              <div 
                style={{
                  padding: '12px',
                  borderRadius: '8px',
                  background: 'rgba(139, 92, 246, 0.03)',
                  border: '1px solid rgba(139, 92, 246, 0.08)',
                  textAlign: 'center',
                }}
              >
                <p style={{ fontSize: '10px', letterSpacing: '1px', color: FADED_WHITE, textTransform: 'uppercase' }}>
                  Entry Price
                </p>
                <p style={{ fontSize: '16px', fontWeight: '600', color: 'white', marginTop: '4px' }}>
                  {formatPrice(entryPrice)}
                </p>
              </div>

              {/* Exit Price */}
              <div 
                style={{
                  padding: '12px',
                  borderRadius: '8px',
                  background: 'rgba(139, 92, 246, 0.03)',
                  border: '1px solid rgba(139, 92, 246, 0.08)',
                  textAlign: 'center',
                }}
              >
                <p style={{ fontSize: '10px', letterSpacing: '1px', color: FADED_WHITE, textTransform: 'uppercase' }}>
                  Exit Price
                </p>
                <p style={{ fontSize: '16px', fontWeight: '600', color: 'white', marginTop: '4px' }}>
                  {formatPrice(exitPrice)}
                </p>
              </div>

              {/* Lot Size */}
              <div 
                style={{
                  padding: '12px',
                  borderRadius: '8px',
                  background: 'rgba(139, 92, 246, 0.03)',
                  border: '1px solid rgba(139, 92, 246, 0.08)',
                  textAlign: 'center',
                }}
              >
                <p style={{ fontSize: '10px', letterSpacing: '1px', color: FADED_WHITE, textTransform: 'uppercase' }}>
                  Lot Size
                </p>
                <p style={{ fontSize: '16px', fontWeight: '600', color: 'white', marginTop: '4px' }}>
                  {lotSize.toFixed(2)}
                </p>
              </div>

              {/* Session */}
              <div 
                style={{
                  padding: '12px',
                  borderRadius: '8px',
                  background: 'rgba(139, 92, 246, 0.03)',
                  border: '1px solid rgba(139, 92, 246, 0.08)',
                  textAlign: 'center',
                }}
              >
                <p style={{ fontSize: '10px', letterSpacing: '1px', color: FADED_WHITE, textTransform: 'uppercase' }}>
                  Session
                </p>
                <p style={{ fontSize: '16px', fontWeight: '600', color: 'white', marginTop: '4px' }}>
                  {session}
                </p>
              </div>
            </div>
          </div>

          {/* ========== BOTTOM - CENTERED ========== */}
          <div 
            style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              width: '100%',
              marginTop: '16px',
            }}
          >
            <p style={{ fontSize: '12px', color: '#64748B', marginBottom: '12px' }}>
              {date || new Date().toLocaleDateString('en-US', {
                weekday: 'short',
                day: 'numeric',
                month: 'short',
                year: 'numeric'
              })}
            </p>

            <div 
              style={{
                width: '100%',
                borderTop: '1px solid rgba(255,255,255,0.05)',
                paddingTop: '12px',
                display: 'flex',
                justifyContent: 'center',
                alignItems: 'center',
              }}
            >
              <p style={{ fontSize: '12px', color: 'rgba(255,255,255,0.25)', letterSpacing: '2px' }}>
                measured by <span style={{ color: 'rgba(255,255,255,0.4)', fontWeight: '600' }}>LuxTrade</span>
              </p>
            </div>
          </div>

          {/* Corner accent */}
          <div 
            style={{
              position: 'absolute',
              top: 0,
              right: 0,
              width: '192px',
              height: '192px',
              background: `radial-gradient(circle at top right, ${ROSE_GOLD}08, transparent 60%)`,
              pointerEvents: 'none',
            }}
          />
        </div>
      </div>

      {/* Export Buttons */}
      {showExport && (
        <div className="flex gap-3 justify-center w-full px-4">
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
  await document.fonts.ready
  await new Promise(resolve => setTimeout(resolve, 200))
  
  const dataUrl = await domToPng(element, {
    scale: 3,
    width: CARD_WIDTH,
    height: CARD_HEIGHT,
    backgroundColor: DEEP_BLACK,
  })
  
  const link = document.createElement('a')
  link.download = `pnl-${symbol}-${Date.now()}.png`
  link.href = dataUrl
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  
  return dataUrl
}
