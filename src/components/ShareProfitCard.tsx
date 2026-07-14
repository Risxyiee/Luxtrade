'use client'

import { useState, useRef } from 'react'
import { Download, Share2, TrendingUp, TrendingDown, Target, Zap } from 'lucide-react'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { toPng } from 'html-to-image'
import { toast } from 'sonner'

interface Trade {
  id: string
  symbol: string
  type: 'BUY' | 'SELL'
  open_price: number
  close_price: number
  lot_size: number
  profit_loss: number
  open_time: string
  close_time: string
  session?: string | null
  stop_loss?: number
  take_profit?: number
}

interface ShareProfitCardProps {
  trade: Trade | null
  open: boolean
  onOpenChange: (open: boolean) => void
}

// Normalize session names to full names
function normalizeSession(session: string | null | undefined): string {
  if (!session) return 'N/A'
  
  const sessionMap: Record<string, string> = {
    'lon': 'London',
    'lon.': 'London',
    'london': 'London',
    'ny': 'New York',
    'ny.': 'New York',
    'new york': 'New York',
    'newyork': 'New York',
    'asia': 'Asia',
    'asian': 'Asia',
    'tokyo': 'Asia',
    'sydney': 'Asia',
    'off-market': 'Off-Market',
    'off': 'Off-Market',
  }
  
  const lowerSession = session.toLowerCase().trim()
  return sessionMap[lowerSession] || session
}

// Calculate pips based on symbol type
function calculatePips(symbol: string, openPrice: number, closePrice: number, type: 'BUY' | 'SELL'): number {
  const isGold = symbol.toUpperCase().includes('XAU') || symbol.toUpperCase().includes('GOLD')
  const isJPY = symbol.toUpperCase().includes('JPY')
  
  let pips: number
  if (isGold) {
    pips = (closePrice - openPrice) / 0.1
  } else if (isJPY) {
    pips = (closePrice - openPrice) * 100
  } else {
    pips = (closePrice - openPrice) * 10000
  }
  
  return type === 'BUY' ? pips : -pips
}

// Calculate R:R ratio
function calculateRR(openPrice: number, closePrice: number, stopLoss?: number, takeProfit?: number, type?: 'BUY' | 'SELL'): string {
  // If we have stop loss, calculate actual R
  if (stopLoss && stopLoss > 0) {
    const risk = Math.abs(openPrice - stopLoss)
    const reward = type === 'BUY' 
      ? Math.abs(closePrice - openPrice) 
      : Math.abs(openPrice - closePrice)
    
    if (risk > 0) {
      const rr = reward / risk
      return rr.toFixed(2)
    }
  }
  
  // Estimate R based on profit (assuming 1R = $100 risk per 0.1 lot)
  return '1.0+'
}

// Format time ago
function formatTimeAgo(dateString: string): string {
  const date = new Date(dateString)
  const now = new Date()
  const diffMs = now.getTime() - date.getTime()
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24))
  
  if (diffDays === 0) return 'Today'
  if (diffDays === 1) return 'Yesterday'
  if (diffDays < 7) return `${diffDays}d ago`
  if (diffDays < 30) return `${Math.floor(diffDays / 7)}w ago`
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

export function ShareProfitCard({ trade, open, onOpenChange }: ShareProfitCardProps) {
  const cardRef = useRef<HTMLDivElement>(null)
  const [downloading, setDownloading] = useState(false)

  if (!trade) return null

  const isProfit = trade.profit_loss >= 0
  const pips = calculatePips(trade.symbol, trade.open_price, trade.close_price, trade.type)
  const rr = calculateRR(trade.open_price, trade.close_price, trade.stop_loss, trade.take_profit, trade.type)
  const timeAgo = formatTimeAgo(trade.close_time || trade.open_time)

  // Dynamic colors based on profit/loss
  const colors = {
    primary: isProfit ? '#10b981' : '#ef4444', // emerald-500 : red-500
    glow: isProfit ? 'rgba(16, 185, 129, 0.4)' : 'rgba(239, 68, 68, 0.4)',
    glowStrong: isProfit ? 'rgba(16, 185, 129, 0.6)' : 'rgba(239, 68, 68, 0.6)',
    bgGradient: isProfit 
      ? 'linear-gradient(135deg, rgba(16, 185, 129, 0.1) 0%, rgba(6, 78, 59, 0.2) 100%)'
      : 'linear-gradient(135deg, rgba(239, 68, 68, 0.1) 0%, rgba(127, 29, 29, 0.2) 100%)',
    borderGlow: isProfit 
      ? 'rgba(16, 185, 129, 0.5)'
      : 'rgba(239, 68, 68, 0.5)',
  }

  const formatProfit = (value: number) => {
    const prefix = value >= 0 ? '+' : ''
    return `${prefix}$${Math.abs(value).toFixed(2)}`
  }

  const handleDownload = async () => {
    if (!cardRef.current) return

    setDownloading(true)
    try {
      const dataUrl = await toPng(cardRef.current, {
        quality: 1.0,
        pixelRatio: 3, // Higher resolution for better quality
        backgroundColor: '#0a0a0f',
      })

      const link = document.createElement('a')
      link.download = `luxtrade-${trade.symbol}-${trade.type}-${Date.now()}.png`
      link.href = dataUrl
      link.click()

      toast.success('Premium card downloaded!')
    } catch (error) {
      console.error('Failed to download image:', error)
      toast.error('Failed to download image. Please try again.')
    } finally {
      setDownloading(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-gradient-to-br from-[#0f0b18] to-[#12091a] border-purple-900/30 max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-white">
            <Share2 className="w-5 h-5 text-purple-400" />
            Share Profit Card
          </DialogTitle>
        </DialogHeader>

        <div className="flex flex-col items-center gap-4 py-4">
          {/* Premium Card - This will be downloaded */}
          <div
            ref={cardRef}
            className="w-full max-w-[340px] relative"
            style={{ 
              fontFamily: "'Inter', 'SF Pro Display', -apple-system, BlinkMacSystemFont, sans-serif"
            }}
          >
            {/* Outer Glow Effect */}
            <div 
              className="absolute -inset-2 rounded-3xl blur-xl opacity-60"
              style={{ background: `radial-gradient(ellipse at center, ${colors.glowStrong}, transparent 70%)` }}
            />
            
            {/* Card Container */}
            <div 
              className="relative rounded-2xl overflow-hidden"
              style={{ 
                background: colors.bgGradient,
                boxShadow: `0 0 40px ${colors.glow}, 0 25px 50px -12px rgba(0, 0, 0, 0.5), inset 0 1px 0 rgba(255,255,255,0.1)`
              }}
            >
              {/* Glassmorphism Overlay */}
              <div 
                className="absolute inset-0 rounded-2xl"
                style={{
                  background: 'linear-gradient(135deg, rgba(255,255,255,0.05) 0%, rgba(255,255,255,0.02) 50%, rgba(0,0,0,0.1) 100%)',
                  backdropFilter: 'blur(20px)'
                }}
              />

              {/* Equity Curve Pattern Background */}
              <div className="absolute inset-0 opacity-[0.08] overflow-hidden">
                <svg width="100%" height="100%" className="absolute" preserveAspectRatio="none">
                  <defs>
                    <linearGradient id="lineGradient" x1="0%" y1="0%" x2="100%" y2="0%">
                      <stop offset="0%" stopColor={colors.primary} stopOpacity="0.3" />
                      <stop offset="50%" stopColor={colors.primary} stopOpacity="0.8" />
                      <stop offset="100%" stopColor={colors.primary} stopOpacity="0.3" />
                    </linearGradient>
                  </defs>
                  {/* Equity curve line - smooth trading performance */}
                  <path 
                    d="M0,80 C20,75 40,85 60,70 C80,55 100,60 120,45 C140,30 160,35 180,20 C200,15 220,25 240,10 C260,15 280,8 300,5 C320,10 340,5 360,15 C380,10 400,8 420,12 C440,8 460,15 480,10 C500,5 520,12 540,8" 
                    fill="none" 
                    stroke="url(#lineGradient)" 
                    strokeWidth="2"
                    strokeLinecap="round"
                  />
                  {/* Second curve line */}
                  <path 
                    d="M0,60 C30,65 60,55 90,50 C120,45 150,50 180,40 C210,35 240,40 270,30 C300,25 330,30 360,20 C390,18 420,25 450,15 C480,12 510,18 540,12" 
                    fill="none" 
                    stroke={colors.primary}
                    strokeWidth="1"
                    strokeOpacity="0.4"
                    strokeLinecap="round"
                  />
                </svg>
              </div>

              {/* Border Glow */}
              <div 
                className="absolute inset-0 rounded-2xl pointer-events-none"
                style={{
                  border: `1px solid ${colors.borderGlow}`,
                  boxShadow: `inset 0 1px 0 rgba(255,255,255,0.1)`
                }}
              />

              {/* Content */}
              <div className="relative p-5">
                {/* Header */}
                <div className="flex items-center justify-between mb-5">
                  <div className="flex items-center gap-2.5">
                    {/* LuxTrade Logo */}
                    <div 
                      className="w-9 h-9 rounded-xl flex items-center justify-center relative"
                      style={{ 
                        background: 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)',
                        boxShadow: '0 4px 12px rgba(245, 158, 11, 0.3)'
                      }}
                    >
                      <span className="text-white font-black text-sm">LX</span>
                    </div>
                    <div>
                      <span className="text-white font-bold text-base tracking-tight">LuxTrade</span>
                      <span className="text-gray-500 text-[10px] block -mt-0.5">Trading Journal</span>
                    </div>
                  </div>
                  
                  {/* Type Badge */}
                  <div 
                    className="px-3 py-1.5 rounded-lg text-[10px] font-bold uppercase tracking-wider flex items-center gap-1"
                    style={{ 
                      background: trade.type === 'BUY' 
                        ? 'linear-gradient(135deg, rgba(34, 197, 94, 0.2) 0%, rgba(16, 185, 129, 0.1) 100%)'
                        : 'linear-gradient(135deg, rgba(239, 68, 68, 0.2) 0%, rgba(220, 38, 38, 0.1) 100%)',
                      color: trade.type === 'BUY' ? '#22c55e' : '#ef4444',
                      border: `1px solid ${trade.type === 'BUY' ? 'rgba(34, 197, 94, 0.3)' : 'rgba(239, 68, 68, 0.3)'}`
                    }}
                  >
                    {trade.type === 'BUY' ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
                    {trade.type}
                  </div>
                </div>

                {/* Symbol & Time */}
                <div className="flex items-end justify-between mb-4">
                  <div>
                    <span className="text-gray-500 text-[10px] uppercase tracking-wider">Symbol</span>
                    <div className="text-white text-2xl font-bold tracking-wide">{trade.symbol}</div>
                  </div>
                  <div className="text-right">
                    <span className="text-gray-500 text-[10px]">{timeAgo}</span>
                  </div>
                </div>

                {/* Main Profit/Loss Display */}
                <div 
                  className="relative rounded-xl p-5 mb-4 overflow-hidden"
                  style={{ 
                    background: `linear-gradient(135deg, rgba(0,0,0,0.4) 0%, rgba(0,0,0,0.2) 100%)`,
                    border: `1px solid rgba(255,255,255,0.05)`
                  }}
                >
                  {/* Inner Glow */}
                  <div 
                    className="absolute inset-0 opacity-30"
                    style={{
                      background: `radial-gradient(ellipse at 50% 0%, ${colors.glow}, transparent 60%)`
                    }}
                  />
                  
                  <div className="relative text-center">
                    <span className="text-gray-400 text-xs uppercase tracking-wider">Profit / Loss</span>
                    <div 
                      className="text-5xl font-black mt-1 tracking-tight"
                      style={{ 
                        color: colors.primary,
                        textShadow: `0 0 30px ${colors.glowStrong}`
                      }}
                    >
                      {formatProfit(trade.profit_loss)}
                    </div>
                    <div className="flex items-center justify-center gap-2 mt-2">
                      {isProfit ? (
                        <span className="text-emerald-400 text-xs font-medium flex items-center gap-1">
                          <TrendingUp className="w-3 h-3" /> Winner
                        </span>
                      ) : (
                        <span className="text-red-400 text-xs font-medium flex items-center gap-1">
                          <TrendingDown className="w-3 h-3" /> Loser
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                {/* SMC Style Stats Grid */}
                <div className="grid grid-cols-4 gap-2 mb-4">
                  <div 
                    className="text-center p-2.5 rounded-lg"
                    style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.05)' }}
                  >
                    <span className="text-gray-500 text-[9px] uppercase block mb-0.5">Pips</span>
                    <span 
                      className="text-sm font-bold"
                      style={{ color: pips >= 0 ? '#10b981' : '#ef4444' }}
                    >
                      {pips >= 0 ? '+' : ''}{pips.toFixed(1)}
                    </span>
                  </div>
                  <div 
                    className="text-center p-2.5 rounded-lg"
                    style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.05)' }}
                  >
                    <span className="text-gray-500 text-[9px] uppercase block mb-0.5">R:R</span>
                    <span className="text-white text-sm font-bold">{rr}R</span>
                  </div>
                  <div 
                    className="text-center p-2.5 rounded-lg"
                    style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.05)' }}
                  >
                    <span className="text-gray-500 text-[9px] uppercase block mb-0.5">Lot</span>
                    <span className="text-white text-sm font-bold">{trade.lot_size}</span>
                  </div>
                  <div 
                    className="text-center p-2.5 rounded-lg"
                    style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.05)' }}
                  >
                    <span className="text-gray-500 text-[9px] uppercase block mb-0.5">Session</span>
                    <span className="text-white text-sm font-bold">{normalizeSession(trade.session)}</span>
                  </div>
                </div>

                {/* Price Details */}
                <div className="grid grid-cols-2 gap-2 mb-4">
                  <div 
                    className="flex items-center justify-between p-3 rounded-lg"
                    style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.05)' }}
                  >
                    <span className="text-gray-500 text-[10px] uppercase">Entry</span>
                    <span className="text-white font-mono font-semibold text-sm">{trade.open_price}</span>
                  </div>
                  <div 
                    className="flex items-center justify-between p-3 rounded-lg"
                    style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.05)' }}
                  >
                    <span className="text-gray-500 text-[10px] uppercase">Exit</span>
                    <span className="text-white font-mono font-semibold text-sm">{trade.close_price}</span>
                  </div>
                </div>

                {/* Watermark */}
                <div 
                  className="flex items-center justify-center gap-1.5 pt-3"
                  style={{ borderTop: '1px solid rgba(255,255,255,0.05)' }}
                >
                  <div className="w-4 h-4 rounded bg-gradient-to-br from-amber-500 to-orange-600 flex items-center justify-center">
                    <span className="text-white font-black text-[8px]">LX</span>
                  </div>
                  <span 
                    className="text-gray-600 text-[10px] tracking-wider"
                    style={{ fontFamily: "'Inter', sans-serif" }}
                  >
                    LuxTrade • luxtrade.space
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Download Button */}
          <Button
            onClick={handleDownload}
            disabled={downloading}
            className="w-full bg-gradient-to-r from-purple-500 to-violet-600 hover:from-purple-600 hover:to-violet-700 text-white font-semibold"
          >
            {downloading ? (
              <>
                <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin mr-2" />
                Generating HD Image...
              </>
            ) : (
              <>
                <Download className="w-4 h-4 mr-2" />
                Download HD Image
              </>
            )}
          </Button>

          <p className="text-xs text-gray-500 text-center">
            Share your trading results on social media
          </p>
        </div>
      </DialogContent>
    </Dialog>
  )
}

// Share Button Component
export function ShareButton({ onClick }: { onClick: () => void }) {
  return (
    <button 
      onClick={onClick}
      className="p-1.5 rounded-lg hover:bg-white/10 text-gray-400 hover:text-purple-400 transition-colors"
      title="Share Profit Card"
    >
      <Share2 className="w-4 h-4" />
    </button>
  )
}
