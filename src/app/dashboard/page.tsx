'use client'

import { useState, useEffect, useCallback, useMemo, useRef, memo } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import { useRouter } from 'next/navigation'
import { 
  TrendingUp, TrendingDown, Plus, BarChart3, BookOpen, 
  Eye, Brain, Menu, X, DollarSign, Target,
  Activity, PieChart, Sparkles, AlertTriangle,
  Zap, RefreshCw, Database, LogOut, Upload, Edit, Trash2, Eye as ViewIcon, Calendar, Clock,
  Smile, Meh, Frown, Sun, Moon, Cloud, AlertCircle, Search, Send, MessageSquare,
  TrendingUp as TrendingUpIcon, Loader2, Settings, Bell, HelpCircle, Lock, Heart, Grid3X3, CircleDot, FileText, Play, Share2, Download, Shield, Crown, AlertCircle as AlertCircleIcon, Camera
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { toast } from 'sonner'
import {
  AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, BarChart, Bar, Cell
} from 'recharts'
import { motion, AnimatePresence } from 'framer-motion'
import { useAuth } from '@/lib/auth-context'
import PaymentModal from '@/components/PaymentModal'
import PNLShareCard from '@/components/PNLShareCard'
import { formatCurrency } from '@/lib/supabase'

// ==================== DEMO DATA ====================
const demoTrades: Trade[] = [
  { id: '1', symbol: 'EURUSD', type: 'BUY', open_price: 1.0850, close_price: 1.0890, lot_size: 0.5, profit_loss: 400, open_time: '2024-01-15T08:30:00Z', close_time: '2024-01-15T12:45:00Z', session: 'London', notes: 'Breakout trade on H1' },
  { id: '2', symbol: 'GBPUSD', type: 'SELL', open_price: 1.2650, close_price: 1.2620, lot_size: 0.3, profit_loss: 150, open_time: '2024-01-15T14:00:00Z', close_time: '2024-01-15T16:30:00Z', session: 'New York', notes: 'Reversal at resistance' },
  { id: '3', symbol: 'XAUUSD', type: 'BUY', open_price: 2025.50, close_price: 2030.00, lot_size: 0.1, profit_loss: 450, open_time: '2024-01-16T03:00:00Z', close_time: '2024-01-16T08:00:00Z', session: 'Asia', notes: 'Gold long from support' },
  { id: '4', symbol: 'USDJPY', type: 'SELL', open_price: 148.50, close_price: 148.80, lot_size: 0.2, profit_loss: -60, open_time: '2024-01-16T10:00:00Z', close_time: '2024-01-16T11:30:00Z', session: 'London', notes: 'Stopped out early' },
  { id: '5', symbol: 'EURJPY', type: 'BUY', open_price: 161.20, close_price: 161.80, lot_size: 0.4, profit_loss: 240, open_time: '2024-01-17T07:00:00Z', close_time: '2024-01-17T15:00:00Z', session: 'London', notes: 'Trend continuation' },
  { id: '6', symbol: 'GBPJPY', type: 'BUY', open_price: 188.50, close_price: 189.20, lot_size: 0.3, profit_loss: 210, open_time: '2024-01-17T09:00:00Z', close_time: '2024-01-17T14:00:00Z', session: 'London', notes: 'Strong momentum' },
  { id: '7', symbol: 'AUDUSD', type: 'SELL', open_price: 0.6550, close_price: 0.6520, lot_size: 0.5, profit_loss: 300, open_time: '2024-01-18T22:00:00Z', close_time: '2024-01-19T04:00:00Z', session: 'Asia', notes: 'Risk-off sentiment' },
  { id: '8', symbol: 'NZDUSD', type: 'SELL', open_price: 0.6120, close_price: 0.6150, lot_size: 0.3, profit_loss: -90, open_time: '2024-01-18T10:00:00Z', close_time: '2024-01-18T16:00:00Z', session: 'New York', notes: 'False breakout' },
]

const demoAnalytics: Analytics = {
  totalTrades: 8,
  winningTrades: 6,
  losingTrades: 2,
  winRate: 75,
  totalPL: 1600,
  avgProfit: 291.67,
  avgLoss: 75,
  profitFactor: 3.89,
  maxDrawdown: 150,
  sharpeRatio: 2.1,
  equityCurve: [
    { date: 'Jan 1', equity: 10000 },
    { date: 'Jan 5', equity: 10200 },
    { date: 'Jan 10', equity: 10150 },
    { date: 'Jan 15', equity: 10500 },
    { date: 'Jan 20', equity: 10800 },
    { date: 'Jan 25', equity: 11200 },
    { date: 'Jan 30', equity: 11600 },
  ],
  sessionPerformance: [
    { session: 'London', trades: 4, pl: 790, winRate: 75 },
    { session: 'New York', trades: 2, pl: 60, winRate: 50 },
    { session: 'Asia', trades: 2, pl: 750, winRate: 100 },
  ],
  monthlyPerformance: [
    { month: 'Jan', pl: 1600, trades: 8 },
  ]
}

// ==================== CUSTOM HOOKS ====================

// Number counter animation hook with smooth easing
function useCountUp(end: number, duration: number = 1500, start: number = 0, decimals: number = 2) {
  const [count, setCount] = useState(start)
  const countRef = useRef(start)
  const startTimeRef = useRef<number | null>(null)
  const rafRef = useRef<number | null>(null)
  const prevEndRef = useRef(end)

  useEffect(() => {
    // Reset animation when end value changes
    if (prevEndRef.current !== end) {
      startTimeRef.current = null
      prevEndRef.current = end
    }
    
    const animate = (timestamp: number) => {
      if (!startTimeRef.current) startTimeRef.current = timestamp
      const progress = Math.min((timestamp - startTimeRef.current) / duration, 1)
      
      // Smooth easing function
      const easeOutQuart = 1 - Math.pow(1 - progress, 4)
      const current = start + (end - start) * easeOutQuart
      
      countRef.current = current
      setCount(current)
      
      if (progress < 1) {
        rafRef.current = requestAnimationFrame(animate)
      }
    }
    
    rafRef.current = requestAnimationFrame(animate)
    
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current)
    }
  }, [end, duration, start])
  
  return count
}

// Animated number display component
function AnimatedNumber({ value, prefix = '', suffix = '', decimals = 2, className = '' }: {
  value: number
  prefix?: string
  suffix?: string
  decimals?: number
  className?: string
}) {
  const animatedValue = useCountUp(value, 1500, 0, decimals)
  
  return (
    <span className={className}>
      {prefix}{animatedValue.toFixed(decimals)}{suffix}
    </span>
  )
}

// ==================== MENU CONFIG ====================

// Kategori Menu
const menuCategories = {
  utama: { label: 'UTAMA' },
  alat: { label: 'ALAT', proType: 'gold' },
  lanjutan: { label: 'LANJUTAN', proType: 'purple' },
}

const menuItems = [
  // UTAMA - Tanpa PRO
  { id: 'dashboard', label: 'Dashboard', labelId: 'Dasbor', icon: BarChart3, category: 'utama', proOnly: false },
  { id: 'trades', label: 'Trades', labelId: 'Transaksi', icon: Activity, category: 'utama', proOnly: false },
  { id: 'calendar', label: 'Calendar', labelId: 'Kalender', icon: Calendar, category: 'utama', proOnly: false },
  { id: 'journal', label: 'Journal', labelId: 'Jurnal', icon: BookOpen, category: 'utama', proOnly: false },
  
  // ALAT - PRO Emas
  { id: 'risk', label: 'Risk Calculator', labelId: 'Kalkulator Risiko', icon: Target, category: 'alat', proOnly: true, proType: 'gold' },
  { id: 'heatmap', label: 'Market Heatmap', labelId: 'Pasar Heatmap', icon: Grid3X3, category: 'alat', proOnly: true, proType: 'gold' },
  
  // LANJUTAN - PRO Ungu
  { id: 'analytics', label: 'Analytics', labelId: 'Analitik', icon: PieChart, category: 'lanjutan', proOnly: true, proType: 'purple' },
  { id: 'targets', label: 'Targets', labelId: 'Target', icon: Target, category: 'lanjutan', proOnly: true, proType: 'purple' },
  { id: 'ai', label: 'AI Insights', labelId: 'Insight AI', icon: Brain, category: 'lanjutan', proOnly: true, proType: 'purple' },
  { id: 'psychology', label: 'Psychology Tracking', labelId: 'Psikologi', icon: Heart, category: 'lanjutan', proOnly: true, proType: 'purple' },
]

// ==================== INTERFACES ====================

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
  session: string | null
  notes?: string
  image_url?: string | null
}

interface JournalEntry {
  id: string
  title: string
  content: string
  mood: string | null
  market_condition: string | null
  created_at: string
}

interface WatchlistItem {
  id: string
  symbol: string
  name: string
  target_price: number | null
  notes: string | null
  created_at: string
}

interface Analytics {
  totalTrades: number
  winningTrades: number
  losingTrades: number
  winRate: number
  totalPL: number
  avgProfit: number
  avgLoss: number
  profitFactor: number
  maxDrawdown: number
  sharpeRatio: number
  equityCurve: { date: string; equity: number }[]
  sessionPerformance: { session: string; trades: number; pl: number; winRate: number }[]
  monthlyPerformance: { month: string; pl: number; trades: number }[]
}

interface TradeFormData {
  symbol: string
  type: 'BUY' | 'SELL'
  open_price: string
  close_price: string
  lot_size: string
  profit_loss: string
  open_time: string
  close_time: string
  session: string
  notes: string
  image_url: string
}

interface MTReportPreview {
  gain: number
  profit: number
  totalTrades: number
  winRate: number
  bestTrade: number
  worstTrade: number
  avgTrade: number
  trades: Trade[]
}

const emptyFormData: TradeFormData = {
  symbol: '',
  type: 'BUY',
  open_price: '',
  close_price: '',
  lot_size: '0.1',
  profit_loss: '',
  open_time: '',
  close_time: '',
  session: '',
  notes: '',
  image_url: '',
}

// Helper: Format date to local timezone (YYYY-MM-DD HH:mm:ss)
function formatLocalDateTime(date: Date): string {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  const hours = String(date.getHours()).padStart(2, '0')
  const minutes = String(date.getMinutes()).padStart(2, '0')
  const seconds = String(date.getSeconds()).padStart(2, '0')
  return `${year}-${month}-${day} ${hours}:${minutes}:${seconds}`
}

// Helper: Convert datetime-local value to local format
function datetimeLocalToFormat(value: string): string {
  if (!value) return ''
  const date = new Date(value)
  return formatLocalDateTime(date)
}

const moodOptions = [
  { value: 'confident', label: 'Confident', icon: Smile, color: 'text-emerald-400' },
  { value: 'neutral', label: 'Neutral', icon: Meh, color: 'text-purple-400' },
  { value: 'anxious', label: 'Anxious', icon: Frown, color: 'text-red-400' },
]

const marketConditions = [
  { value: 'trending_up', label: 'Trending Up', icon: TrendingUp },
  { value: 'trending_down', label: 'Trending Down', icon: TrendingDown },
  { value: 'ranging', label: 'Ranging', icon: Activity },
  { value: 'volatile', label: 'Volatile', icon: AlertTriangle },
]

// ==================== STABLE TRADE FORM COMPONENT (Outside main to prevent re-renders) ====================

interface TradeFormProps {
  formData: TradeFormData
  onFormChange: (field: keyof TradeFormData, value: string) => void
  onTypeChange: (value: string) => void
  onSessionChange: (value: string) => void
  onNumberInput: (field: keyof TradeFormData, e: React.ChangeEvent<HTMLInputElement>) => void
  onSave: () => void
  onCancel: () => void
  isEdit?: boolean
  saving?: boolean
}

const TradeForm = memo(function TradeForm({ 
  formData, 
  onFormChange, 
  onTypeChange, 
  onSessionChange, 
  onNumberInput,
  onSave,
  onCancel,
  isEdit = false,
  saving = false
}: TradeFormProps) {
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-4">
        <div>
          <Label>Symbol *</Label>
          <Input 
            placeholder="EURUSD" 
            className="bg-[#0a0712] border-purple-900/30 mt-1"
            value={formData.symbol}
            onChange={(e) => onFormChange('symbol', e.target.value)}
          />
        </div>
        <div>
          <Label>Type</Label>
          <Select value={formData.type} onValueChange={onTypeChange}>
            <SelectTrigger className="bg-[#0a0712] border-purple-900/30 mt-1">
              <SelectValue />
            </SelectTrigger>
            <SelectContent className="bg-[#0f0b18] border-purple-900/30">
              <SelectItem value="BUY">BUY</SelectItem>
              <SelectItem value="SELL">SELL</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div>
          <Label>Open Price *</Label>
          <Input 
            type="text"
            inputMode="decimal"
            placeholder="1.0850" 
            className="bg-[#0a0712] border-purple-900/30 mt-1"
            value={formData.open_price}
            onChange={(e) => onNumberInput('open_price', e)}
          />
        </div>
        <div>
          <Label>Close Price *</Label>
          <Input 
            type="text"
            inputMode="decimal"
            placeholder="1.0890" 
            className="bg-[#0a0712] border-purple-900/30 mt-1"
            value={formData.close_price}
            onChange={(e) => onNumberInput('close_price', e)}
          />
        </div>
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div>
          <Label>Lot Size</Label>
          <Input 
            type="text"
            inputMode="decimal"
            placeholder="0.1" 
            className="bg-[#0a0712] border-purple-900/30 mt-1"
            value={formData.lot_size}
            onChange={(e) => onNumberInput('lot_size', e)}
          />
        </div>
        <div>
          <Label>P/L ($) *</Label>
          <Input 
            type="text"
            inputMode="decimal"
            placeholder="400" 
            className="bg-[#0a0712] border-purple-900/30 mt-1"
            value={formData.profit_loss}
            onChange={(e) => onNumberInput('profit_loss', e)}
          />
        </div>
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div>
          <Label>Open Time</Label>
          <Input 
            type="datetime-local" 
            className="bg-[#0a0712] border-purple-900/30 mt-1"
            value={formData.open_time ? formData.open_time.slice(0, 16) : ''}
            onChange={(e) => onFormChange('open_time', e.target.value ? datetimeLocalToFormat(e.target.value) : '')}
          />
        </div>
        <div>
          <Label>Close Time</Label>
          <Input 
            type="datetime-local" 
            className="bg-[#0a0712] border-purple-900/30 mt-1"
            value={formData.close_time ? formData.close_time.slice(0, 16) : ''}
            onChange={(e) => onFormChange('close_time', e.target.value ? datetimeLocalToFormat(e.target.value) : '')}
          />
        </div>
      </div>
      <div>
        <Label>Session</Label>
        <Select value={formData.session} onValueChange={onSessionChange}>
          <SelectTrigger className="bg-[#0a0712] border-purple-900/30 mt-1">
            <SelectValue placeholder="Select session" />
          </SelectTrigger>
          <SelectContent className="bg-[#0f0b18] border-purple-900/30">
            <SelectItem value="London">London</SelectItem>
            <SelectItem value="New York">New York</SelectItem>
            <SelectItem value="Asia">Asia</SelectItem>
            <SelectItem value="Off-Market">Off-Market</SelectItem>
          </SelectContent>
        </Select>
      </div>
      <div>
        <Label>Notes</Label>
        <Textarea 
          placeholder="Trade notes, setup, emotions..."
          className="bg-[#0a0712] border-purple-900/30 mt-1 resize-none"
          rows={3}
          value={formData.notes}
          onChange={(e) => onFormChange('notes', e.target.value)}
        />
      </div>
      {/* Image Upload */}
      <div>
        <Label>Trade Screenshot (Optional)</Label>
        <Input 
          type="file"
          accept="image/*"
          className="bg-[#0a0712] border-purple-900/30 mt-1"
          onChange={(e) => {
            const file = e.target.files?.[0]
            if (file) {
              // For now, store as base64 data URL
              const reader = new FileReader()
              reader.onload = (ev) => {
                onFormChange('image_url', ev.target?.result as string || '')
              }
              reader.readAsDataURL(file)
            }
          }}
        />
        {formData.image_url && (
          <div className="mt-2">
            <img 
              src={formData.image_url} 
              alt="Trade preview" 
              className="w-full h-32 object-cover rounded-lg border border-purple-900/30"
            />
          </div>
        )}
      </div>
      <div className="flex gap-3 pt-2">
        <Button 
          onClick={onSave} 
          disabled={saving}
          className="flex-1 bg-gradient-to-r from-purple-500 to-violet-600"
        >
          {saving ? 'Saving...' : isEdit ? 'Update Trade' : 'Add Trade'}
        </Button>
        <Button 
          variant="outline" 
          onClick={onCancel}
          className="border-purple-900/30"
        >
          Cancel
        </Button>
      </div>
    </div>
  )
})

// ==================== SMART PDF/HTML PARSER ====================

function parseMT4HTML(html: string): MTReportPreview | null {
  try {
    // Extract trades from MetaTrader HTML report
    const trades: Trade[] = []
    
    // Parse table rows - MT4/MT5 format
    const rowRegex = /<tr[^>]*>[\s\S]*?<\/tr>/gi
    const rows = html.match(rowRegex) || []
    
    let totalPL = 0
    let wins = 0
    let losses = 0
    let bestTrade = 0
    let worstTrade = 0
    
    rows.forEach((row, index) => {
      // Extract cells
      const cellRegex = /<td[^>]*>([\s\S]*?)<\/td>/gi
      const cells: string[] = []
      let match
      while ((match = cellRegex.exec(row)) !== null) {
        cells.push(match[1].replace(/<[^>]*>/g, '').trim())
      }
      
      // Look for trade data (symbol, type, lots, open price, close price, profit)
      if (cells.length >= 6) {
        const symbolMatch = cells[0]?.match(/[A-Z]{3}[A-Z]{3}|[A-Z]{3}\/[A-Z]{3}|XAU|XAG/i)
        if (symbolMatch) {
          const profit = parseFloat(cells[cells.length - 1]?.replace(/[$,\s]/g, '') || '0')
          if (!isNaN(profit) && profit !== 0) {
            const trade: Trade = {
              id: `mt-${index}`,
              symbol: symbolMatch[0].toUpperCase(),
              type: cells[1]?.toLowerCase().includes('sell') ? 'SELL' : 'BUY',
              open_price: parseFloat(cells[3]?.replace(/[^0-9.]/g, '') || '0'),
              close_price: parseFloat(cells[4]?.replace(/[^0-9.]/g, '') || '0'),
              lot_size: parseFloat(cells[2]?.replace(/[^0-9.]/g, '') || '0.1'),
              profit_loss: profit,
              open_time: new Date().toISOString(),
              close_time: new Date().toISOString(),
              session: null,
              notes: 'Imported from MT4/MT5'
            }
            trades.push(trade)
            totalPL += profit
            if (profit > 0) wins++
            else losses++
            if (profit > bestTrade) bestTrade = profit
            if (profit < worstTrade) worstTrade = profit
          }
        }
      }
    })

    // Alternative: Look for summary data
    const profitMatch = html.match(/Total[:\s]+\$?(-?[0-9,]+\.?[0-9]*)/i) || 
                        html.match(/Profit[:\s]+\$?(-?[0-9,]+\.?[0-9]*)/i)
    const gainMatch = html.match(/Gain[:\s]+(-?[0-9.]+)%?/i)
    const tradesMatch = html.match(/Total Trades[:\s]+([0-9]+)/i)
    const winRateMatch = html.match(/Win\s*Rate[:\s]+([0-9.]+)%?/i)

    if (trades.length === 0 && (profitMatch || gainMatch)) {
      // Create summary from extracted data
      return {
        gain: gainMatch ? parseFloat(gainMatch[1]) : 0,
        profit: profitMatch ? parseFloat(profitMatch[1].replace(/,/g, '')) : 0,
        totalTrades: tradesMatch ? parseInt(tradesMatch[1]) : 0,
        winRate: winRateMatch ? parseFloat(winRateMatch[1]) : 0,
        bestTrade: 0,
        worstTrade: 0,
        avgTrade: 0,
        trades: []
      }
    }

    if (trades.length > 0) {
      return {
        gain: 0,
        profit: totalPL,
        totalTrades: trades.length,
        winRate: trades.length > 0 ? (wins / trades.length) * 100 : 0,
        bestTrade,
        worstTrade,
        avgTrade: trades.length > 0 ? totalPL / trades.length : 0,
        trades
      }
    }

    return null
  } catch (error) {
    console.error('Error parsing MT report:', error)
    return null
  }
}

// ==================== MAIN COMPONENT ====================

export default function LuxTradeDashboard() {
  const [activeTab, setActiveTab] = useState('dashboard')
  const [sidebarOpen, setSidebarOpen] = useState(true)
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false)
  const [language, setLanguage] = useState<'id' | 'en'>('id') // Default Bahasa Indonesia
  
  // Demo mode state
  const [demoMode, setDemoMode] = useState(true) // Default TRUE untuk demo
  
  // Trade modals
  const [addTradeOpen, setAddTradeOpen] = useState(false)
  const [editTradeOpen, setEditTradeOpen] = useState(false)
  const [deleteTradeOpen, setDeleteTradeOpen] = useState(false)
  const [viewTradeOpen, setViewTradeOpen] = useState(false)
  const [paymentModalOpen, setPaymentModalOpen] = useState(false)
  const [shareCardOpen, setShareCardOpen] = useState(false)
  
  // Journal modals
  const [addJournalOpen, setAddJournalOpen] = useState(false)
  const [viewJournalOpen, setViewJournalOpen] = useState(false)
  const [editJournalOpen, setEditJournalOpen] = useState(false)
  
  // Watchlist modals
  const [addWatchlistOpen, setAddWatchlistOpen] = useState(false)
  
  // CSV Import
  const [csvImportOpen, setCsvImportOpen] = useState(false)
  const [csvFile, setCsvFile] = useState<File | null>(null)
  const [csvPreview, setCsvPreview] = useState<Trade[]>([])
  const [csvImporting, setCsvImporting] = useState(false)
  
  // Smart Import (PDF/CSV/HTML)
  const [smartImportOpen, setSmartImportOpen] = useState(false)
  const [smartImportPreview, setSmartImportPreview] = useState<MTReportPreview | null>(null)
  const [smartImportFile, setSmartImportFile] = useState<File | null>(null)
  const [smartImportParsing, setSmartImportParsing] = useState(false)
  
  // Universal Trade Importer - 2 Tabs
  const [importTab, setImportTab] = useState<'screenshot' | 'file'>('screenshot')
  const [screenshotPreview, setScreenshotPreview] = useState<string | null>(null)
  const [importedTrades, setImportedTrades] = useState<Trade[]>([])
  const [importParsing, setImportParsing] = useState(false)
  
  // Data states
  const [trades, setTrades] = useState<Trade[]>([])
  const [analytics, setAnalytics] = useState<Analytics | null>(null)
  const [journalEntries, setJournalEntries] = useState<JournalEntry[]>([])
  const [watchlistItems, setWatchlistItems] = useState<WatchlistItem[]>([])
  const [loading, setLoading] = useState(true)
  const [seeding, setSeeding] = useState(false)
  const [saving, setSaving] = useState(false)
  
  // Form states - separate state to prevent re-renders
  const [formData, setFormData] = useState<TradeFormData>(emptyFormData)
  const [selectedTrade, setSelectedTrade] = useState<Trade | null>(null)
  const [selectedJournal, setSelectedJournal] = useState<JournalEntry | null>(null)
  
  // Journal form
  const [journalForm, setJournalForm] = useState({
    title: '',
    content: '',
    mood: '',
    market_condition: ''
  })
  
  // Watchlist form
  const [watchlistForm, setWatchlistForm] = useState({
    symbol: '',
    name: '',
    target_price: '',
    notes: ''
  })
  
  // AI state
  const [aiInsight, setAiInsight] = useState('')
  const [aiLoading, setAiLoading] = useState(false)
  const [aiChatMessages, setAiChatMessages] = useState<{ role: 'user' | 'assistant'; content: string }[]>([])
  const [aiChatInput, setAiChatInput] = useState('')
  
  // Animation states
  const [chartAnimated, setChartAnimated] = useState(false)
  
  const { user, profile, session, signOut, loading: authLoading, isPro: authIsPro, isAdmin } = useAuth()
  const router = useRouter()
  
  // Helper: Get auth header for API calls
  const getAuthHeaders = useCallback(() => {
    const headers: Record<string, string> = { 'Content-Type': 'application/json' }
    if (session?.access_token) {
      headers['Authorization'] = `Bearer ${session.access_token}`
    }
    return headers
  }, [session?.access_token])
  
  // PRO status from auth context (includes subscription_until check)
  const isPro = authIsPro || demoMode
  
  // Free user trade limit
  const FREE_TRADE_LIMIT = 5
  const isFreeUser = !isPro && !demoMode
  const tradeCount = trades.length
  const canAddTrade = isPro || demoMode || tradeCount < FREE_TRADE_LIMIT

  // ==================== STABLE FORM HANDLERS ====================
  
  const handleFormChange = useCallback((field: keyof TradeFormData, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }))
  }, [])
  
  const handleFormTypeChange = useCallback((value: string) => {
    setFormData(prev => ({ ...prev, type: value as 'BUY' | 'SELL' }))
  }, [])
  
  const handleFormSessionChange = useCallback((value: string) => {
    setFormData(prev => ({ ...prev, session: value }))
  }, [])

  const handleNumberInput = useCallback((field: keyof TradeFormData, e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value
    if (value === '' || /^-?\d*\.?\d*$/.test(value)) {
      setFormData(prev => ({ ...prev, [field]: value }))
    }
  }, [])

  // ==================== IMPORT TRADE EDITING ====================
  
  // Update a specific field of an imported trade
  const updateImportedTrade = useCallback((index: number, field: keyof Trade, value: string | number) => {
    setImportedTrades(prev => {
      const updated = [...prev]
      if (updated[index]) {
        updated[index] = { ...updated[index], [field]: value }
      }
      return updated
    })
  }, [])
  
  // Remove an imported trade from the list
  const removeImportedTrade = useCallback((index: number) => {
    setImportedTrades(prev => prev.filter((_, i) => i !== index))
  }, [])

  // Fetch all data
  const fetchData = useCallback(async () => {
    if (demoMode) {
      // Use demo data
      setTrades(demoTrades)
      setAnalytics(demoAnalytics)
      setLoading(false)
      setChartAnimated(true)
      return
    }
    
    setLoading(true)
    try {
      const [tradesRes, analyticsRes, journalRes, watchlistRes] = await Promise.all([
        fetch('/api/trades'),
        fetch('/api/analytics'),
        fetch('/api/journal'),
        fetch('/api/watchlist'),
      ])

      if (tradesRes.ok) {
        const data = await tradesRes.json()
        setTrades(data.trades || [])
      }

      if (analyticsRes.ok) {
        const data = await analyticsRes.json()
        setAnalytics(data.analytics)
      }
      
      if (journalRes.ok) {
        const data = await journalRes.json()
        setJournalEntries(data.entries || [])
      }
      
      if (watchlistRes.ok) {
        const data = await watchlistRes.json()
        setWatchlistItems(data.items || [])
      }
    } catch (error) {
      console.error('Failed to fetch data:', error)
    } finally {
      setLoading(false)
      setChartAnimated(true)
    }
  }, [demoMode])

  // Auth state management with timeout
  const [authChecked, setAuthChecked] = useState(false)
  
  useEffect(() => {
    if (demoMode) {
      fetchData()
      setAuthChecked(true)
      return
    }
    
    // Give auth some time to load
    const timeoutId = setTimeout(() => {
      if (!user && !authLoading) {
        // No user after loading complete, redirect to login
        window.location.href = '/auth/login'
      }
    }, 1000)
    
    if (!authLoading) {
      setAuthChecked(true)
      if (user) {
        fetchData()
      }
    }
    
    return () => clearTimeout(timeoutId)
  }, [authLoading, user, fetchData, demoMode])

  // Show loading screen while checking auth
  if (!demoMode && (authLoading || !authChecked)) {
    return (
      <div className="min-h-screen bg-[#0a0712] flex items-center justify-center">
        <div className="text-center">
          <motion.div
            animate={{ rotate: 360 }}
            transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
          >
            <Loader2 className="w-10 h-10 text-purple-500 mx-auto mb-4" />
          </motion.div>
          <p className="text-white/60">Loading your dashboard...</p>
        </div>
      </div>
    )
  }

  // Don't render if no user (will redirect) - skip in demo mode
  if (!demoMode && !user) {
    return (
      <div className="min-h-screen bg-[#0a0712] flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="w-8 h-8 text-purple-500 animate-spin mx-auto mb-4" />
          <p className="text-white/60">Redirecting to login...</p>
        </div>
      </div>
    )
  }

  // Seed demo data
  const handleSeedData = async () => {
    setSeeding(true)
    try {
      const res = await fetch('/api/seed', { method: 'POST' })
      const data = await res.json()
      if (data.success) {
        toast.success(data.message || 'Demo data loaded!')
        fetchData()
      } else if (data.needsSetup) {
        toast.error('Database not set up. Check console for SQL.')
        console.log('SQL Schema:', data.sql)
      }
    } catch (error) {
      toast.error('Failed to load demo data')
    } finally {
      setSeeding(false)
    }
  }

  // ==================== TRADE CRUD ====================
  
  const handleAddTrade = async () => {
    if (!formData.symbol || !formData.open_price || !formData.close_price || !formData.profit_loss) {
      toast.error('Please fill all required fields')
      return
    }

    // Check trade limit for free users
    if (isFreeUser && tradeCount >= FREE_TRADE_LIMIT) {
      toast.error(`Free users are limited to ${FREE_TRADE_LIMIT} trades. Upgrade to PRO for unlimited trades!`)
      setPaymentModalOpen(true)
      return
    }

    if (demoMode) {
      const newTrade: Trade = {
        id: `demo-${Date.now()}`,
        symbol: formData.symbol.toUpperCase(),
        type: formData.type,
        open_price: parseFloat(formData.open_price),
        close_price: parseFloat(formData.close_price),
        lot_size: parseFloat(formData.lot_size) || 0.1,
        profit_loss: parseFloat(formData.profit_loss),
        open_time: formData.open_time || formatLocalDateTime(new Date()),
        close_time: formData.close_time || formatLocalDateTime(new Date()),
        session: formData.session || null,
        notes: formData.notes || null,
        image_url: formData.image_url || null,
      }
      setTrades(prev => [newTrade, ...prev])
      toast.success('Trade added! (Demo mode)')
      setAddTradeOpen(false)
      setFormData(emptyFormData)
      return
    }

    setSaving(true)
    try {
      const res = await fetch('/api/trades', {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify({
          symbol: formData.symbol.toUpperCase(),
          type: formData.type,
          open_price: parseFloat(formData.open_price),
          close_price: parseFloat(formData.close_price),
          lot_size: parseFloat(formData.lot_size) || 0.1,
          profit_loss: parseFloat(formData.profit_loss),
          open_time: formData.open_time || formatLocalDateTime(new Date()),
          close_time: formData.close_time || formatLocalDateTime(new Date()),
          session: formData.session || null,
          notes: formData.notes || null,
          image_url: formData.image_url || null,
        }),
      })

      const data = await res.json()
      if (res.ok) {
        toast.success('Trade added successfully!')
        setAddTradeOpen(false)
        setFormData(emptyFormData)
        fetchData()
      } else {
        toast.error(data.error || 'Failed to add trade')
      }
    } catch (error) {
      toast.error('Failed to add trade')
    } finally {
      setSaving(false)
    }
  }

  const handleEditTrade = async () => {
    if (!selectedTrade || !formData.symbol || !formData.open_price || !formData.close_price || !formData.profit_loss) {
      toast.error('Please fill all required fields')
      return
    }

    if (demoMode) {
      setTrades(prev => prev.map(t => t.id === selectedTrade.id ? {
        ...t,
        symbol: formData.symbol.toUpperCase(),
        type: formData.type,
        open_price: parseFloat(formData.open_price),
        close_price: parseFloat(formData.close_price),
        lot_size: parseFloat(formData.lot_size) || 0.1,
        profit_loss: parseFloat(formData.profit_loss),
        session: formData.session || null,
        notes: formData.notes || null,
        image_url: formData.image_url || null,
      } : t))
      toast.success('Trade updated! (Demo mode)')
      setEditTradeOpen(false)
      setSelectedTrade(null)
      setFormData(emptyFormData)
      return
    }

    setSaving(true)
    try {
      const res = await fetch('/api/trades', {
        method: 'PUT',
        headers: getAuthHeaders(),
        body: JSON.stringify({
          id: selectedTrade.id,
          symbol: formData.symbol.toUpperCase(),
          type: formData.type,
          open_price: parseFloat(formData.open_price),
          close_price: parseFloat(formData.close_price),
          lot_size: parseFloat(formData.lot_size) || 0.1,
          profit_loss: parseFloat(formData.profit_loss),
          session: formData.session || null,
          notes: formData.notes || null,
          image_url: formData.image_url || null,
        }),
      })

      const data = await res.json()
      if (res.ok) {
        toast.success('Trade updated successfully!')
        setEditTradeOpen(false)
        setSelectedTrade(null)
        setFormData(emptyFormData)
        fetchData()
      } else {
        toast.error(data.error || 'Failed to update trade')
      }
    } catch (error) {
      toast.error('Failed to update trade')
    } finally {
      setSaving(false)
    }
  }

  const handleDeleteTrade = async () => {
    if (!selectedTrade) return

    if (demoMode) {
      setTrades(prev => prev.filter(t => t.id !== selectedTrade.id))
      toast.success('Trade deleted! (Demo mode)')
      setDeleteTradeOpen(false)
      setSelectedTrade(null)
      return
    }

    setSaving(true)
    try {
      const res = await fetch(`/api/trades?id=${selectedTrade.id}`, {
        method: 'DELETE',
        headers: getAuthHeaders(),
      })

      if (res.ok) {
        toast.success('Trade deleted successfully!')
        setDeleteTradeOpen(false)
        setSelectedTrade(null)
        fetchData()
      } else {
        const data = await res.json()
        toast.error(data.error || 'Failed to delete trade')
      }
    } catch (error) {
      toast.error('Failed to delete trade')
    } finally {
      setSaving(false)
    }
  }

  const openEditModal = (trade: Trade) => {
    setSelectedTrade(trade)
    setFormData({
      symbol: trade.symbol,
      type: trade.type,
      open_price: trade.open_price.toString(),
      close_price: trade.close_price.toString(),
      lot_size: trade.lot_size.toString(),
      profit_loss: trade.profit_loss.toString(),
      open_time: trade.open_time,
      close_time: trade.close_time,
      session: trade.session || '',
      notes: trade.notes || '',
    })
    setEditTradeOpen(true)
  }

  const openViewModal = (trade: Trade) => {
    setSelectedTrade(trade)
    setViewTradeOpen(true)
  }

  const openDeleteModal = (trade: Trade) => {
    setSelectedTrade(trade)
    setDeleteTradeOpen(true)
  }

  // ==================== JOURNAL CRUD ====================
  
  const handleAddJournal = async () => {
    if (!journalForm.title || !journalForm.content) {
      toast.error('Please fill title and content')
      return
    }
    
    if (demoMode) {
      const newEntry: JournalEntry = {
        id: `demo-${Date.now()}`,
        title: journalForm.title,
        content: journalForm.content,
        mood: journalForm.mood || null,
        market_condition: journalForm.market_condition || null,
        created_at: new Date().toISOString()
      }
      setJournalEntries(prev => [newEntry, ...prev])
      toast.success('Journal entry added! (Demo mode)')
      setAddJournalOpen(false)
      setJournalForm({ title: '', content: '', mood: '', market_condition: '' })
      return
    }
    
    setSaving(true)
    try {
      const res = await fetch('/api/journal', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(journalForm)
      })
      
      const data = await res.json()
      if (res.ok) {
        toast.success('Journal entry added!')
        setAddJournalOpen(false)
        setJournalForm({ title: '', content: '', mood: '', market_condition: '' })
        fetchData()
      } else {
        toast.error(data.error || 'Failed to add entry')
      }
    } catch {
      toast.error('Failed to add journal entry')
    } finally {
      setSaving(false)
    }
  }
  
  const handleDeleteJournal = async (id: string) => {
    if (!confirm('Delete this journal entry?')) return
    
    if (demoMode) {
      setJournalEntries(prev => prev.filter(e => e.id !== id))
      toast.success('Entry deleted! (Demo mode)')
      return
    }
    
    try {
      const res = await fetch(`/api/journal?id=${id}`, { method: 'DELETE' })
      if (res.ok) {
        toast.success('Entry deleted!')
        fetchData()
      }
    } catch {
      toast.error('Failed to delete entry')
    }
  }

  // ==================== WATCHLIST CRUD ====================
  
  const handleAddWatchlist = async () => {
    if (!watchlistForm.symbol) {
      toast.error('Please enter a symbol')
      return
    }
    
    if (demoMode) {
      const newItem: WatchlistItem = {
        id: `demo-${Date.now()}`,
        symbol: watchlistForm.symbol.toUpperCase(),
        name: watchlistForm.name || '',
        target_price: watchlistForm.target_price ? parseFloat(watchlistForm.target_price) : null,
        notes: watchlistForm.notes || null,
        created_at: new Date().toISOString()
      }
      setWatchlistItems(prev => [newItem, ...prev])
      toast.success('Added to watchlist! (Demo mode)')
      setAddWatchlistOpen(false)
      setWatchlistForm({ symbol: '', name: '', target_price: '', notes: '' })
      return
    }
    
    setSaving(true)
    try {
      const res = await fetch('/api/watchlist', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(watchlistForm)
      })
      
      const data = await res.json()
      if (res.ok) {
        toast.success('Added to watchlist!')
        setAddWatchlistOpen(false)
        setWatchlistForm({ symbol: '', name: '', target_price: '', notes: '' })
        fetchData()
      } else {
        toast.error(data.error || 'Failed to add')
      }
    } catch {
      toast.error('Failed to add to watchlist')
    } finally {
      setSaving(false)
    }
  }
  
  const handleDeleteWatchlist = async (id: string) => {
    if (demoMode) {
      setWatchlistItems(prev => prev.filter(i => i.id !== id))
      toast.success('Removed from watchlist! (Demo mode)')
      return
    }
    
    try {
      const res = await fetch(`/api/watchlist?id=${id}`, { method: 'DELETE' })
      if (res.ok) {
        toast.success('Removed from watchlist!')
        fetchData()
      }
    } catch {
      toast.error('Failed to remove')
    }
  }

  // ==================== AI INSIGHTS ====================
  
  const getPerformanceTips = async () => {
    if (!analytics || analytics.totalTrades < 5) {
      toast.error('Add at least 5 trades to get AI insights')
      return
    }
    
    setAiLoading(true)
    try {
      const res = await fetch('/api/ai', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'performance_tips',
          data: analytics
        })
      })
      
      const data = await res.json()
      if (res.ok) {
        setAiInsight(data.insight)
      } else {
        toast.error('Failed to get insights')
      }
    } catch {
      toast.error('Failed to get AI insights')
    } finally {
      setAiLoading(false)
    }
  }
  
  const getMarketInsight = async () => {
    setAiLoading(true)
    try {
      const res = await fetch('/api/ai', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'market_insight',
          data: {}
        })
      })
      
      const data = await res.json()
      if (res.ok) {
        setAiInsight(data.insight)
      }
    } catch {
      toast.error('Failed to get market insight')
    } finally {
      setAiLoading(false)
    }
  }
  
  const sendAiChat = async () => {
    if (!aiChatInput.trim()) return
    
    const userMessage = aiChatInput
    setAiChatInput('')
    setAiChatMessages(prev => [...prev, { role: 'user', content: userMessage }])
    setAiLoading(true)
    
    try {
      const res = await fetch('/api/ai', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'chat',
          data: { 
            message: userMessage,
            context: { trades: trades.slice(0, 10), analytics }
          }
        })
      })
      
      const data = await res.json()
      if (res.ok) {
        setAiChatMessages(prev => [...prev, { role: 'assistant', content: data.insight }])
      }
    } catch {
      toast.error('AI chat failed')
    } finally {
      setAiLoading(false)
    }
  }

  // ==================== CSV IMPORT ====================
  
  const parseCSV = (text: string): Trade[] => {
    const lines = text.trim().split('\n')
    if (lines.length < 2) return []
    
    const headers = lines[0].toLowerCase().split(',').map(h => h.trim())
    const trades: Trade[] = []
    
    for (let i = 1; i < lines.length; i++) {
      const values = lines[i].split(',').map(v => v.trim())
      if (values.length < 4) continue
      
      const symbolIdx = headers.findIndex(h => h.includes('symbol') || h.includes('pair'))
      const typeIdx = headers.findIndex(h => h.includes('type') || h.includes('side') || h.includes('direction'))
      const openPriceIdx = headers.findIndex(h => h.includes('open') || h.includes('entry') || h.includes('entry_price'))
      const closePriceIdx = headers.findIndex(h => h.includes('close') || h.includes('exit') || h.includes('exit_price'))
      const plIdx = headers.findIndex(h => h.includes('pl') || h.includes('profit') || h.includes('pnl'))
      const lotIdx = headers.findIndex(h => h.includes('lot') || h.includes('size') || h.includes('volume'))
      const sessionIdx = headers.findIndex(h => h.includes('session'))
      const openTimeIdx = headers.findIndex(h => h.includes('open_time') || h.includes('entry_time'))
      const closeTimeIdx = headers.findIndex(h => h.includes('close_time') || h.includes('exit_time'))
      
      const trade: Trade = {
        id: `csv-${i}`,
        symbol: symbolIdx >= 0 ? values[symbolIdx].toUpperCase() : 'UNKNOWN',
        type: typeIdx >= 0 ? (values[typeIdx].toUpperCase().includes('SELL') ? 'SELL' : 'BUY') : 'BUY',
        open_price: openPriceIdx >= 0 ? parseFloat(values[openPriceIdx]) || 0 : 0,
        close_price: closePriceIdx >= 0 ? parseFloat(values[closePriceIdx]) || 0 : 0,
        lot_size: lotIdx >= 0 ? parseFloat(values[lotIdx]) || 0.1 : 0.1,
        profit_loss: plIdx >= 0 ? parseFloat(values[plIdx]) || 0 : 0,
        open_time: openTimeIdx >= 0 ? values[openTimeIdx] || new Date().toISOString() : new Date().toISOString(),
        close_time: closeTimeIdx >= 0 ? values[closeTimeIdx] || new Date().toISOString() : new Date().toISOString(),
        session: sessionIdx >= 0 ? values[sessionIdx] || null : null,
      }
      trades.push(trade)
    }
    
    return trades
  }
  
  const handleCsvFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    
    setCsvFile(file)
    const reader = new FileReader()
    reader.onload = (event) => {
      const text = event.target?.result as string
      const parsed = parseCSV(text)
      setCsvPreview(parsed)
    }
    reader.readAsText(file)
  }
  
  const handleCsvImport = async () => {
    if (csvPreview.length === 0) {
      toast.error('No trades to import')
      return
    }
    
    if (demoMode) {
      setTrades(prev => [...csvPreview, ...prev])
      toast.success(`Imported ${csvPreview.length} trades! (Demo mode)`)
      setCsvImportOpen(false)
      setCsvFile(null)
      setCsvPreview([])
      return
    }
    
    setCsvImporting(true)
    try {
      const res = await fetch('/api/import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ trades: csvPreview })
      })
      
      const data = await res.json()
      if (res.ok) {
        toast.success(`Imported ${data.inserted} trades!`)
        setCsvImportOpen(false)
        setCsvFile(null)
        setCsvPreview([])
        fetchData()
      } else {
        toast.error(data.error || 'Import failed')
      }
    } catch {
      toast.error('Import failed')
    } finally {
      setCsvImporting(false)
    }
  }

  // ==================== SMART IMPORT (PDF/CSV/HTML) ====================
  
  const handleSmartImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    
    setSmartImportFile(file)
    setSmartImportParsing(true)
    
    try {
      const text = await file.text()
      const preview = parseMT4HTML(text)
      setSmartImportPreview(preview)
    } catch (error) {
      toast.error('Failed to parse file')
    } finally {
      setSmartImportParsing(false)
    }
  }
  
  const handleSmartImportSave = async () => {
    if (!smartImportPreview || smartImportPreview.trades.length === 0) {
      toast.error('No trades to import')
      return
    }
    
    if (demoMode) {
      setTrades(prev => [...smartImportPreview.trades, ...prev])
      toast.success(`Imported ${smartImportPreview.trades.length} trades from report! (Demo mode)`)
      setSmartImportOpen(false)
      setSmartImportPreview(null)
      setSmartImportFile(null)
      return
    }
    
    if (!isPro) {
      setPaymentModalOpen(true)
      return
    }
    
    setCsvImporting(true)
    try {
      const res = await fetch('/api/import', {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify({ trades: smartImportPreview.trades })
      })
      
      const data = await res.json()
      if (res.ok) {
        toast.success(`Imported ${data.inserted} trades!`)
        setSmartImportOpen(false)
        setSmartImportPreview(null)
        setSmartImportFile(null)
        fetchData()
      } else {
        toast.error(data.error || 'Import failed')
      }
    } catch {
      toast.error('Import failed')
    } finally {
      setCsvImporting(false)
    }
  }

  // ==================== UNIVERSAL TRADE IMPORTER ====================
  
  // Handle screenshot upload for OCR
  const handleScreenshotUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    
    // Validate file type
    if (!file.type.startsWith('image/')) {
      toast.error('❌ Invalid file type', {
        description: 'Please upload an image file (PNG, JPG, etc.)'
      })
      return
    }
    
    // Show preview
    const reader = new FileReader()
    reader.onload = (ev) => {
      setScreenshotPreview(ev.target?.result as string)
    }
    reader.readAsDataURL(file)
    
    // Send to OCR API
    setImportParsing(true)
    setImportedTrades([])
    
    try {
      const base64 = await fileToBase64(file)
      
      const res = await fetch('/api/import/screenshot', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ imageBase64: base64 })
      })
      
      const data = await res.json()
      
      if (res.ok && data.success && data.trades?.length > 0) {
        setImportedTrades(data.trades)
        toast.success(`✅ Detected ${data.trades.length} trades from screenshot!`, {
          description: `Method: ${data.method || 'VLM'}. Review and edit before saving.`
        })
      } else {
        // Clear preview and show error
        setScreenshotPreview(null)
        const errorMsg = data.message || data.error || 'Data tidak terbaca - Could not detect trades in screenshot'
        toast.error('❌ Data Tidak Terbaca', {
          description: errorMsg + '. Pastikan screenshot menampilkan history MT5 dengan jelas (Symbol, Type, Lots, Price, Profit).'
        })
      }
    } catch (err) {
      console.error('Screenshot OCR error:', err)
      setScreenshotPreview(null)
      toast.error('❌ Failed to process screenshot', {
        description: 'Please check your internet connection and try again.'
      })
    } finally {
      setImportParsing(false)
    }
  }
  
  // Handle file upload (PDF/HTML)
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    
    // Validate file type
    const validTypes = ['application/pdf', 'text/html', 'text/csv', 'text/plain']
    const validExtensions = ['.pdf', '.html', '.htm', '.csv', '.txt']
    const fileExtension = file.name.toLowerCase().slice(file.name.lastIndexOf('.'))
    
    if (!validTypes.includes(file.type) && !validExtensions.includes(fileExtension)) {
      toast.error('❌ Invalid file type', {
        description: 'Please upload PDF, HTML, CSV, or TXT files only.'
      })
      return
    }
    
    setImportParsing(true)
    setImportedTrades([])
    
    try {
      const base64 = await fileToBase64(file)
      
      const res = await fetch('/api/import/file', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          fileBase64: base64, 
          fileType: file.type,
          fileName: file.name 
        })
      })
      
      const data = await res.json()
      
      if (res.ok && data.success && data.trades?.length > 0) {
        setImportedTrades(data.trades)
        toast.success(`✅ Found ${data.trades.length} trades in file!`, {
          description: 'Review and edit before saving.'
        })
      } else {
        const errorMsg = data.message || data.error || 'Data tidak terbaca - No trades found in file'
        toast.error('❌ Data Tidak Terbaca', {
          description: errorMsg + '. Pastikan file adalah report MT4/MT5 yang valid dengan kolom Symbol, Type, Profit, dll.'
        })
      }
    } catch (err) {
      console.error('File parse error:', err)
      toast.error('❌ Failed to parse file', {
        description: 'Make sure the file is a valid MT4/MT5 report.'
      })
    } finally {
      setImportParsing(false)
    }
  }
  
  // Save imported trades
  const handleSaveImportedTrades = async () => {
    if (importedTrades.length === 0) {
      toast.error('No trades to import')
      return
    }
    
    if (demoMode) {
      setTrades(prev => [...importedTrades, ...prev])
      toast.success(`Imported ${importedTrades.length} trades! (Demo mode)`)
      setSmartImportOpen(false)
      setImportedTrades([])
      setScreenshotPreview(null)
      setImportTab('screenshot')
      return
    }
    
    if (!isPro) {
      setPaymentModalOpen(true)
      return
    }
    
    setImportParsing(true)
    try {
      const res = await fetch('/api/import', {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify({ trades: importedTrades })
      })
      
      const data = await res.json()
      if (res.ok) {
        toast.success(`Imported ${data.inserted} trades!`)
        setSmartImportOpen(false)
        setImportedTrades([])
        setScreenshotPreview(null)
        setImportTab('screenshot')
        fetchData()
      } else {
        toast.error(data.error || 'Import failed')
      }
    } catch {
      toast.error('Import failed')
    } finally {
      setImportParsing(false)
    }
  }
  
  // Helper: Convert file to base64
  const fileToBase64 = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader()
      reader.onload = () => {
        const result = reader.result as string
        // Remove data URL prefix for cleaner transmission
        const base64 = result.split(',')[1] || result
        resolve(base64)
      }
      reader.onerror = reject
      reader.readAsDataURL(file)
    })
  }

  const handleSignOut = async () => {
    await signOut()
    router.push('/')
  }

  const userInitials = profile?.full_name 
    ? profile.full_name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2)
    : user?.email?.[0].toUpperCase() || 'D'

  return (
    <div className="min-h-screen bg-[#0a0712] text-white flex">
      {/* Mobile Sidebar Overlay */}
      {mobileSidebarOpen && (
        <div 
          className="fixed inset-0 bg-black/60 z-30 lg:hidden backdrop-blur-sm"
          onClick={() => setMobileSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside className={`bg-[#0f0b18]/95 backdrop-blur-xl border-r border-purple-900/30 flex flex-col fixed h-full z-40 transition-all duration-300 
        ${sidebarOpen ? 'w-64' : 'w-20'} 
        ${mobileSidebarOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}`}>
        <div className="p-4 border-b border-purple-900/30">
          <Link href="/" className="flex items-center gap-3">
            <Image 
              src="/logo.png" 
              alt="LuxTrade Logo" 
              width={40} 
              height={40}
              className="rounded-xl shadow-lg shadow-purple-500/20"
            />
            {sidebarOpen && (
              <div>
                <h1 className="text-xl font-bold bg-gradient-to-r from-purple-200 via-purple-300 to-purple-400 bg-clip-text text-transparent">LuxTrade</h1>
                <p className="text-xs text-purple-300/60">Trading Journal</p>
              </div>
            )}
          </Link>
        </div>

        <nav className="flex-1 p-3 space-y-2 overflow-y-auto">
          {/* Render menu by category */}
          {(['utama', 'alat', 'lanjutan'] as const).map((category) => {
            const categoryItems = menuItems.filter(item => item.category === category)
            const catInfo = menuCategories[category]

            return (
              <div key={category} className="space-y-1">
                {/* Category Header */}
                {sidebarOpen && (
                  <div className="flex items-center gap-2 px-3 py-1.5">
                    <span className={`text-[10px] font-bold tracking-wider ${
                      category === 'utama' 
                        ? 'text-gray-500' 
                        : category === 'alat'
                          ? 'text-purple-500'
                          : 'text-purple-400'
                    }`}>
                      {catInfo.label}
                    </span>
                    {category !== 'utama' && (
                      <span className={`text-[7px] font-black px-1.5 py-0.5 rounded ${
                        category === 'alat'
                          ? 'bg-gradient-to-r from-purple-500 to-violet-500 text-white'
                          : 'bg-gradient-to-r from-purple-500 to-violet-500 text-white'
                      }`}>
                        PRO
                      </span>
                    )}
                    <div className="flex-1 h-px bg-purple-900/30" />
                  </div>
                )}

                {/* Category Items */}
                {categoryItems.map((item: any) => {
                  const isLocked = item.proOnly && !isPro
                  const proType = item.proType || 'purple'

                  return (
                    <motion.button
                      key={item.id}
                      onClick={() => {
                        if (item.proOnly && !isPro) {
                          setPaymentModalOpen(true)
                        } else {
                          setActiveTab(item.id)
                          setMobileSidebarOpen(false)
                        }
                      }}
                      className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all duration-200 relative ${
                        activeTab === item.id
                          ? 'bg-gradient-to-r from-purple-500/20 to-violet-500/10 text-purple-400 border border-purple-500/30'
                          : 'text-gray-400 hover:bg-purple-500/10 hover:text-white'
                      } ${isLocked ? 'opacity-60' : ''}`}
                      whileHover={isLocked ? {} : { x: 4 }}
                      whileTap={isLocked ? {} : { scale: 0.98 }}
                    >
                      <item.icon className="w-5 h-5 flex-shrink-0" />
                      {sidebarOpen && (
                        <span className="text-sm font-medium flex-1 text-left truncate">
                          {language === 'id' ? item.labelId : item.label}
                        </span>
                      )}
                      {/* PRO Badge */}
                      {sidebarOpen && item.proOnly && (
                        <span className="flex items-center gap-1">
                          <Lock className={`w-3 h-3 ${proType === 'gold' ? 'text-purple-400' : 'text-purple-400'}`} />
                          <span className={`text-[7px] font-black px-1 py-0.5 rounded ${
                            proType === 'gold'
                              ? 'bg-gradient-to-r from-purple-500 to-violet-500 text-white'
                              : 'bg-gradient-to-r from-purple-500 to-violet-500 text-white'
                          }`}>
                            PRO
                          </span>
                        </span>
                      )}
                    </motion.button>
                  )
                })}
              </div>
            )
          })}
        </nav>

        <div className="p-3 border-t border-purple-900/30 space-y-2">
          {/* Demo Mode Toggle */}
          {sidebarOpen && (
            <motion.button
              onClick={() => {
                setDemoMode(!demoMode)
                if (!demoMode) {
                  toast.success('Demo mode enabled! Try the dashboard with fake data.')
                }
              }}
              className={`w-full py-2 px-3 rounded-lg text-sm font-bold transition-all flex items-center justify-center gap-2 ${
                demoMode 
                  ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30' 
                  : 'bg-purple-500/20 text-purple-400 border border-purple-500/30 hover:bg-purple-500/30'
              }`}
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
            >
              <Play className="w-4 h-4" />
              {demoMode ? 'Demo Mode ON' : 'Try Demo Mode'}
            </motion.button>
          )}
          
          {!isPro && sidebarOpen && !demoMode && (
            <motion.button
              onClick={() => setPaymentModalOpen(true)}
              className="w-full py-2 px-3 rounded-lg bg-gradient-to-r from-purple-500 to-violet-600 text-sm font-bold text-white hover:scale-[1.02] transition-all shadow-lg shadow-purple-500/20"
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
            >
              Upgrade to Pro
            </motion.button>
          )}
          {(isPro || demoMode) && sidebarOpen && (
            <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-purple-500/20 border border-purple-500/30">
              <Zap className="w-4 h-4 text-purple-400" />
              <span className="text-sm font-bold text-purple-400">{demoMode ? 'DEMO' : 'ELITE PRO'}</span>
            </div>
          )}
          
          {/* Admin Panel Link - Only for admins */}
          {isAdmin && sidebarOpen && (
            <Link href="/dashboard/admin" className="block">
              <motion.button
                className="w-full py-2 px-3 rounded-lg bg-gradient-to-r from-purple-600/30 to-violet-600/30 text-violet-300 border border-violet-500/30 hover:from-purple-600/40 hover:to-violet-600/40 transition-all flex items-center justify-center gap-2 text-sm font-bold"
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
              >
                <Shield className="w-4 h-4" />
                <span className="flex items-center gap-1">
                  Admin Panel
                  <Crown className="w-3 h-3 text-purple-400" />
                </span>
              </motion.button>
            </Link>
          )}
          
          {/* Free User Trade Limit Warning */}
          {isFreeUser && sidebarOpen && (
            <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-purple-500/10 border border-purple-500/20">
              <AlertCircle className="w-4 h-4 text-purple-400" />
              <span className="text-xs text-purple-300">
                {tradeCount}/{FREE_TRADE_LIMIT} trades used
              </span>
            </div>
          )}
          
          <button
            onClick={() => {
              if (window.innerWidth < 1024) {
                setMobileSidebarOpen(false)
              }
              setSidebarOpen(!sidebarOpen)
            }}
            className="w-full flex items-center justify-center p-2 text-gray-400 hover:text-purple-400 transition-colors"
          >
            {sidebarOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <main className={`flex-1 overflow-auto transition-all duration-300 ${sidebarOpen ? 'lg:ml-64' : 'lg:ml-20'}`}>
        <header className="h-16 border-b border-purple-900/30 flex items-center justify-between px-4 lg:px-6 bg-[#0f0b18]/90 backdrop-blur-md sticky top-0 z-30">
          <div className="flex items-center gap-3">
            <button 
              onClick={() => setMobileSidebarOpen(true)}
              className="lg:hidden p-2 text-gray-400 hover:text-white transition-colors"
            >
              <Menu className="w-5 h-5" />
            </button>
            <h2 className="text-lg font-semibold">
              {menuItems.find(m => m.id === activeTab)?.label || 'Dashboard'}
            </h2>
            <button 
              onClick={fetchData}
              className="p-2 text-gray-400 hover:text-purple-400 transition-colors"
              title="Refresh data"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            </button>
          </div>
          
          <div className="flex items-center gap-2 lg:gap-3">
            {/* Server Status Indicator */}
            <div className="hidden sm:flex items-center gap-2 px-3 py-1.5 rounded-full bg-emerald-500/10 border border-emerald-500/20">
              <motion.div
                className="w-2 h-2 rounded-full bg-emerald-400"
                animate={{ scale: [1, 1.2, 1], opacity: [1, 0.7, 1] }}
                transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
              />
              <span className="text-xs text-emerald-400">{demoMode ? 'Demo' : 'Connected'}</span>
            </div>
            
            {/* Smart Import Button */}
            <button
              onClick={() => setSmartImportOpen(true)}
              className="hidden sm:flex px-3 lg:px-4 py-2 rounded-lg bg-gradient-to-r from-purple-500/20 to-violet-500/20 text-purple-400 border border-purple-500/30 hover:from-purple-500/30 hover:to-violet-500/30 transition-all text-sm font-medium items-center gap-2"
            >
              <Upload className="w-4 h-4" />
              <span className="hidden lg:inline">Smart Import</span>
            </button>
            
            {!demoMode && (
              <button
                onClick={handleSeedData}
                disabled={seeding}
                className="hidden sm:flex px-3 lg:px-4 py-2 rounded-lg bg-purple-500/20 text-purple-400 border border-purple-500/30 hover:bg-purple-500/30 transition-all text-sm font-medium items-center gap-2"
              >
                <Database className="w-4 h-4" />
                {seeding ? 'Loading...' : 'Demo Data'}
              </button>
            )}
            
            <Dialog open={addTradeOpen} onOpenChange={(open) => {
              setAddTradeOpen(open)
              if (!open) setFormData(emptyFormData)
            }}>
              <DialogTrigger asChild>
                <Button className="bg-gradient-to-r from-purple-500 to-violet-600 hover:from-purple-600 hover:to-violet-700 shadow-lg shadow-purple-500/20">
                  <Plus className="w-4 h-4 mr-0 lg:mr-2" />
                  <span className="hidden lg:inline">New Trade</span>
                </Button>
              </DialogTrigger>
              <DialogContent className="bg-[#0f0b18] border-purple-900/30 text-white max-w-md">
                <DialogHeader><DialogTitle className="text-xl">Add New Trade</DialogTitle></DialogHeader>
                <TradeForm 
                  formData={formData}
                  onFormChange={handleFormChange}
                  onTypeChange={handleFormTypeChange}
                  onSessionChange={handleFormSessionChange}
                  onNumberInput={handleNumberInput}
                  onSave={handleAddTrade}
                  onCancel={() => { setAddTradeOpen(false); setFormData(emptyFormData) }}
                  saving={saving}
                />
              </DialogContent>
            </Dialog>
            
            {!demoMode && user && (
              <button
                onClick={handleSignOut}
                className="p-2 text-gray-400 hover:text-white transition-colors"
                title="Sign out"
              >
                <LogOut className="w-5 h-5" />
              </button>
            )}
            
            <div className="w-9 h-9 rounded-full bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center text-sm font-bold" title={demoMode ? 'Demo User' : user?.email || 'Demo User'}>
              {demoMode ? 'DU' : userInitials}
            </div>
          </div>
        </header>

        <div className="p-4 lg:p-6 pb-24">
          <AnimatePresence mode="wait">
            {activeTab === 'dashboard' && (
              <motion.div
                key="dashboard"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                transition={{ duration: 0.3 }}
              >
                <DashboardTab 
                  analytics={analytics} 
                  trades={trades} 
                  loading={loading}
                  setAddTradeOpen={setAddTradeOpen}
                  onSeedData={handleSeedData}
                  seeding={seeding}
                  onView={openViewModal}
                  onEdit={openEditModal}
                  onDelete={openDeleteModal}
                  chartAnimated={chartAnimated}
                  demoMode={demoMode}
                />
              </motion.div>
            )}
            {activeTab === 'trades' && (
              <motion.div
                key="trades"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                transition={{ duration: 0.3 }}
              >
                <TradesTab 
                  trades={trades} 
                  loading={loading}
                  onView={openViewModal}
                  onEdit={openEditModal}
                  onDelete={openDeleteModal}
                  onImport={() => setCsvImportOpen(true)}
                  onSmartImport={() => setSmartImportOpen(true)}
                />
              </motion.div>
            )}
            {activeTab === 'journal' && (
              <motion.div
                key="journal"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                transition={{ duration: 0.3 }}
              >
                <JournalTab 
                  entries={journalEntries}
                  loading={loading}
                  onAdd={() => setAddJournalOpen(true)}
                  onView={(entry) => { setSelectedJournal(entry); setViewJournalOpen(true) }}
                  onEdit={(entry) => { setSelectedJournal(entry); setEditJournalOpen(true) }}
                  onDelete={handleDeleteJournal}
                />
              </motion.div>
            )}
            {activeTab === 'watchlist' && (
              <motion.div
                key="watchlist"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                transition={{ duration: 0.3 }}
              >
                <WatchlistTab 
                  items={watchlistItems}
                  loading={loading}
                  onAdd={() => setAddWatchlistOpen(true)}
                  onDelete={handleDeleteWatchlist}
                />
              </motion.div>
            )}
            {activeTab === 'analytics' && (
              <motion.div
                key="analytics"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                transition={{ duration: 0.3 }}
              >
                <AnalyticsTab analytics={analytics} loading={loading} trades={trades} />
              </motion.div>
            )}
            {activeTab === 'ai' && (
              <motion.div
                key="ai"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                transition={{ duration: 0.3 }}
              >
                <AITab 
                  analytics={analytics}
                  trades={trades}
                  insight={aiInsight}
                  loading={aiLoading}
                  onGetTips={getPerformanceTips}
                  onGetMarket={getMarketInsight}
                  chatMessages={aiChatMessages}
                  chatInput={aiChatInput}
                  onChatChange={setAiChatInput}
                  onSendChat={sendAiChat}
                  isPro={isPro}
                  onUpgrade={() => setPaymentModalOpen(true)}
                />
              </motion.div>
            )}
            {activeTab === 'psychology' && (
              <motion.div
                key="psychology"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                transition={{ duration: 0.3 }}
              >
                <PsychologyTab isPro={isPro} onUpgrade={() => setPaymentModalOpen(true)} trades={trades} />
              </motion.div>
            )}
            {activeTab === 'heatmap' && (
              <motion.div
                key="heatmap"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                transition={{ duration: 0.3 }}
              >
                <HeatmapTab isPro={isPro} onUpgrade={() => setPaymentModalOpen(true)} trades={trades} />
              </motion.div>
            )}
            {activeTab === 'calendar' && (
              <motion.div
                key="calendar"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                transition={{ duration: 0.3 }}
              >
                <CalendarTab trades={trades} language={language} />
              </motion.div>
            )}
            {activeTab === 'risk' && (
              <motion.div
                key="risk"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                transition={{ duration: 0.3 }}
              >
                <RiskCalculatorTab isPro={isPro} onUpgrade={() => setPaymentModalOpen(true)} language={language} />
              </motion.div>
            )}
            {activeTab === 'targets' && (
              <motion.div
                key="targets"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                transition={{ duration: 0.3 }}
              >
                <TargetsTab isPro={isPro} onUpgrade={() => setPaymentModalOpen(true)} language={language} />
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </main>

      {/* Edit Trade Modal */}
      <Dialog open={editTradeOpen} onOpenChange={(open) => {
        setEditTradeOpen(open)
        if (!open) {
          setSelectedTrade(null)
          setFormData(emptyFormData)
        }
      }}>
        <DialogContent className="bg-[#0f0b18] border-purple-900/30 text-white max-w-md">
          <DialogHeader><DialogTitle className="text-xl">Edit Trade</DialogTitle></DialogHeader>
          <TradeForm 
            formData={formData}
            onFormChange={handleFormChange}
            onTypeChange={handleFormTypeChange}
            onSessionChange={handleFormSessionChange}
            onNumberInput={handleNumberInput}
            onSave={handleEditTrade}
            onCancel={() => { setEditTradeOpen(false); setSelectedTrade(null); setFormData(emptyFormData) }}
            isEdit
            saving={saving}
          />
        </DialogContent>
      </Dialog>

      {/* View Trade Modal */}
      <Dialog open={viewTradeOpen} onOpenChange={(open) => {
        setViewTradeOpen(open)
        if (!open) setSelectedTrade(null)
      }}>
        <DialogContent className="bg-[#0f0b18] border-purple-900/30 text-white max-w-md">
          <DialogHeader><DialogTitle className="text-xl">Trade Details</DialogTitle></DialogHeader>
          {selectedTrade && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <span className="text-2xl font-bold">{selectedTrade.symbol}</span>
                  <Badge variant={selectedTrade.type === 'BUY' ? 'default' : 'destructive'}>
                    {selectedTrade.type}
                  </Badge>
                </div>
                <span className={`text-xl font-bold ${selectedTrade.profit_loss >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                  {selectedTrade.profit_loss >= 0 ? '+' : ''}{formatCurrency(selectedTrade.profit_loss)}
                </span>
              </div>
              
              <div className="grid grid-cols-2 gap-4">
                <div className="p-3 rounded-lg bg-white/5">
                  <div className="text-xs text-gray-400">Open Price</div>
                  <div className="font-bold">{selectedTrade.open_price}</div>
                </div>
                <div className="p-3 rounded-lg bg-white/5">
                  <div className="text-xs text-gray-400">Close Price</div>
                  <div className="font-bold">{selectedTrade.close_price}</div>
                </div>
                <div className="p-3 rounded-lg bg-white/5">
                  <div className="text-xs text-gray-400">Lot Size</div>
                  <div className="font-bold">{selectedTrade.lot_size}</div>
                </div>
                <div className="p-3 rounded-lg bg-white/5">
                  <div className="text-xs text-gray-400">Session</div>
                  <div className="font-bold">{selectedTrade.session || '-'}</div>
                </div>
              </div>
              
              {selectedTrade.notes && (
                <div className="p-3 rounded-lg bg-white/5">
                  <div className="text-xs text-gray-400 mb-1">Notes</div>
                  <div className="text-sm">{selectedTrade.notes}</div>
                </div>
              )}

              <div className="grid grid-cols-2 gap-4">
                <div className="p-3 rounded-lg bg-white/5 flex items-center gap-2">
                  <Calendar className="w-4 h-4 text-gray-400" />
                  <div>
                    <div className="text-xs text-gray-400">Open Time</div>
                    <div className="text-sm">{new Date(selectedTrade.open_time).toLocaleString()}</div>
                  </div>
                </div>
                <div className="p-3 rounded-lg bg-white/5 flex items-center gap-2">
                  <Clock className="w-4 h-4 text-gray-400" />
                  <div>
                    <div className="text-xs text-gray-400">Close Time</div>
                    <div className="text-sm">{new Date(selectedTrade.close_time).toLocaleString()}</div>
                  </div>
                </div>
              </div>

              <div className="flex gap-3 pt-2">
                <Button 
                  onClick={() => {
                    setViewTradeOpen(false)
                    setShareCardOpen(true)
                  }}
                  variant="outline"
                  className="border-purple-500/30 text-purple-400"
                >
                  <Share2 className="w-4 h-4 mr-2" /> Share
                </Button>
                <Button 
                  onClick={() => {
                    setViewTradeOpen(false)
                    openEditModal(selectedTrade)
                  }}
                  className="flex-1 bg-gradient-to-r from-purple-500 to-violet-600"
                >
                  <Edit className="w-4 h-4 mr-2" /> Edit
                </Button>
                <Button 
                  variant="destructive"
                  onClick={() => {
                    setViewTradeOpen(false)
                    openDeleteModal(selectedTrade)
                  }}
                >
                  <Trash2 className="w-4 h-4" />
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Share Card Modal */}
      <Dialog open={shareCardOpen} onOpenChange={(open) => {
        setShareCardOpen(open)
        if (!open) setSelectedTrade(null)
      }}>
        <DialogContent className="bg-[#0f0b18] border-purple-900/30 text-white max-w-lg">
          <DialogHeader>
            <DialogTitle className="text-xl flex items-center gap-2">
              <Share2 className="w-5 h-5 text-purple-400" />
              Share Trade Card
            </DialogTitle>
          </DialogHeader>
          {selectedTrade && (
            <div className="flex flex-col items-center gap-4">
              <PNLShareCard
                symbol={selectedTrade.symbol}
                type={selectedTrade.type}
                entryPrice={selectedTrade.open_price}
                exitPrice={selectedTrade.close_price}
                lotSize={selectedTrade.lot_size}
                profitLoss={selectedTrade.profit_loss}
                session={selectedTrade.session || 'Unknown'}
                date={new Date(selectedTrade.close_time).toLocaleDateString('en-US', {
                  weekday: 'short',
                  day: 'numeric',
                  month: 'short',
                  year: 'numeric'
                })}
              />
              <p className="text-xs text-gray-500 text-center">
                Take a screenshot to share your trade on social media
              </p>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Modal */}
      <Dialog open={deleteTradeOpen} onOpenChange={(open) => {
        setDeleteTradeOpen(open)
        if (!open) setSelectedTrade(null)
      }}>
        <DialogContent className="bg-[#0f0b18] border-purple-900/30 text-white max-w-sm">
          <DialogHeader><DialogTitle className="text-xl text-red-400">Delete Trade?</DialogTitle></DialogHeader>
          {selectedTrade && (
            <div className="space-y-4">
              <p className="text-gray-400">
                Are you sure you want to delete this trade?
              </p>
              <div className="p-3 rounded-lg bg-white/5 flex items-center justify-between">
                <div>
                  <span className="font-bold">{selectedTrade.symbol}</span>
                  <Badge variant={selectedTrade.type === 'BUY' ? 'default' : 'destructive'} className="ml-2">
                    {selectedTrade.type}
                  </Badge>
                </div>
                <span className={`font-bold ${selectedTrade.profit_loss >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                  {selectedTrade.profit_loss >= 0 ? '+' : ''}{formatCurrency(selectedTrade.profit_loss)}
                </span>
              </div>
              <div className="flex gap-3">
                <Button 
                  variant="destructive"
                  onClick={handleDeleteTrade}
                  disabled={saving}
                  className="flex-1"
                >
                  {saving ? 'Deleting...' : 'Delete'}
                </Button>
                <Button 
                  variant="outline"
                  onClick={() => {
                    setDeleteTradeOpen(false)
                    setSelectedTrade(null)
                  }}
                  className="flex-1 border-purple-900/30"
                >
                  Cancel
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Add Journal Modal */}
      <Dialog open={addJournalOpen} onOpenChange={(open) => {
        setAddJournalOpen(open)
        if (!open) setJournalForm({ title: '', content: '', mood: '', market_condition: '' })
      }}>
        <DialogContent className="bg-[#0f0b18] border-purple-900/30 text-white max-w-lg">
          <DialogHeader><DialogTitle className="text-xl">New Journal Entry</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Title *</Label>
              <Input 
                placeholder="Market Recap - Monday" 
                className="bg-[#0a0712] border-purple-900/30 mt-1"
                value={journalForm.title}
                onChange={(e) => setJournalForm({ ...journalForm, title: e.target.value })}
              />
            </div>
            <div>
              <Label>Content *</Label>
              <Textarea 
                placeholder="Write your thoughts about today's trading session..."
                className="bg-[#0a0712] border-purple-900/30 mt-1 resize-none"
                rows={5}
                value={journalForm.content}
                onChange={(e) => setJournalForm({ ...journalForm, content: e.target.value })}
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Mood</Label>
                <Select value={journalForm.mood} onValueChange={(v) => setJournalForm({ ...journalForm, mood: v })}>
                  <SelectTrigger className="bg-[#0a0712] border-purple-900/30 mt-1">
                    <SelectValue placeholder="How do you feel?" />
                  </SelectTrigger>
                  <SelectContent className="bg-[#0f0b18] border-purple-900/30">
                    {moodOptions.map(opt => (
                      <SelectItem key={opt.value} value={opt.value}>
                        <span className={opt.color}>{opt.label}</span>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Market Condition</Label>
                <Select value={journalForm.market_condition} onValueChange={(v) => setJournalForm({ ...journalForm, market_condition: v })}>
                  <SelectTrigger className="bg-[#0a0712] border-purple-900/30 mt-1">
                    <SelectValue placeholder="Market state" />
                  </SelectTrigger>
                  <SelectContent className="bg-[#0f0b18] border-purple-900/30">
                    {marketConditions.map(opt => (
                      <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="flex gap-3 pt-2">
              <Button 
                onClick={handleAddJournal} 
                disabled={saving}
                className="flex-1 bg-gradient-to-r from-purple-500 to-violet-600"
              >
                {saving ? 'Saving...' : 'Save Entry'}
              </Button>
              <Button 
                variant="outline" 
                onClick={() => setAddJournalOpen(false)}
                className="border-purple-900/30"
              >
                Cancel
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Add Watchlist Modal */}
      <Dialog open={addWatchlistOpen} onOpenChange={(open) => {
        setAddWatchlistOpen(open)
        if (!open) setWatchlistForm({ symbol: '', name: '', target_price: '', notes: '' })
      }}>
        <DialogContent className="bg-[#0f0b18] border-purple-900/30 text-white max-w-md">
          <DialogHeader><DialogTitle className="text-xl">Add to Watchlist</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Symbol *</Label>
                <Input 
                  placeholder="EURUSD" 
                  className="bg-[#0a0712] border-purple-900/30 mt-1"
                  value={watchlistForm.symbol}
                  onChange={(e) => setWatchlistForm({ ...watchlistForm, symbol: e.target.value.toUpperCase() })}
                />
              </div>
              <div>
                <Label>Name</Label>
                <Input 
                  placeholder="Euro/USD" 
                  className="bg-[#0a0712] border-purple-900/30 mt-1"
                  value={watchlistForm.name}
                  onChange={(e) => setWatchlistForm({ ...watchlistForm, name: e.target.value })}
                />
              </div>
            </div>
            <div>
              <Label>Target Price</Label>
              <Input 
                type="text"
                inputMode="decimal"
                placeholder="1.0950" 
                className="bg-[#0a0712] border-purple-900/30 mt-1"
                value={watchlistForm.target_price}
                onChange={(e) => setWatchlistForm({ ...watchlistForm, target_price: e.target.value })}
              />
            </div>
            <div>
              <Label>Notes</Label>
              <Textarea 
                placeholder="Why watching this pair..."
                className="bg-[#0a0712] border-purple-900/30 mt-1 resize-none"
                rows={3}
                value={watchlistForm.notes}
                onChange={(e) => setWatchlistForm({ ...watchlistForm, notes: e.target.value })}
              />
            </div>
            <div className="flex gap-3 pt-2">
              <Button 
                onClick={handleAddWatchlist} 
                disabled={saving}
                className="flex-1 bg-gradient-to-r from-emerald-500 to-teal-600"
              >
                {saving ? 'Adding...' : 'Add to Watchlist'}
              </Button>
              <Button 
                variant="outline" 
                onClick={() => setAddWatchlistOpen(false)}
                className="border-purple-900/30"
              >
                Cancel
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* CSV Import Modal */}
      <Dialog open={csvImportOpen} onOpenChange={(open) => {
        setCsvImportOpen(open)
        if (!open) {
          setCsvFile(null)
          setCsvPreview([])
        }
      }}>
        <DialogContent className="bg-[#0f0b18] border-purple-900/30 text-white max-w-2xl">
          <DialogHeader><DialogTitle className="text-xl">Import Trades from CSV</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div className="border-2 border-dashed border-purple-900/30 rounded-xl p-8 text-center">
              <Upload className="w-12 h-12 mx-auto mb-4 text-gray-500" />
              <p className="text-gray-400 mb-4">Upload a CSV file with your trades</p>
              <Input
                type="file"
                accept=".csv"
                onChange={handleCsvFileChange}
                className="max-w-sm mx-auto"
              />
              <p className="text-xs text-gray-500 mt-4">
                Supported columns: symbol, type, open_price, close_price, profit_loss, lot_size, session
              </p>
            </div>
            
            {csvPreview.length > 0 && (
              <div>
                <div className="flex items-center justify-between mb-2">
                  <p className="text-sm text-gray-400">Preview ({csvPreview.length} trades)</p>
                  <Badge variant="outline" className="border-purple-500/30 text-purple-400">
                    {csvPreview.filter(t => t.profit_loss > 0).length} wins / {csvPreview.filter(t => t.profit_loss < 0).length} losses
                  </Badge>
                </div>
                <div className="max-h-60 overflow-y-auto rounded-lg bg-white/5 p-2">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="text-gray-400 border-b border-purple-900/30">
                        <th className="text-left p-2">Symbol</th>
                        <th className="text-left p-2">Type</th>
                        <th className="text-right p-2">P/L</th>
                      </tr>
                    </thead>
                    <tbody>
                      {csvPreview.slice(0, 10).map((trade, i) => (
                        <tr key={i} className="border-b border-purple-900/20">
                          <td className="p-2 font-bold">{trade.symbol}</td>
                          <td className="p-2">
                            <Badge variant={trade.type === 'BUY' ? 'default' : 'destructive'} className="text-xs">
                              {trade.type}
                            </Badge>
                          </td>
                          <td className={`p-2 text-right font-bold ${trade.profit_loss >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                            {trade.profit_loss >= 0 ? '+' : ''}{formatCurrency(trade.profit_loss)}
                          </td>
                        </tr>
                      ))}
                      {csvPreview.length > 10 && (
                        <tr><td colSpan={3} className="p-2 text-center text-gray-500">...and {csvPreview.length - 10} more</td></tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
            
            <div className="flex gap-3 pt-2">
              <Button 
                onClick={handleCsvImport} 
                disabled={csvImporting || csvPreview.length === 0}
                className="flex-1 bg-gradient-to-r from-purple-500 to-violet-600"
              >
                {csvImporting ? 'Importing...' : `Import ${csvPreview.length} Trades`}
              </Button>
              <Button 
                variant="outline" 
                onClick={() => setCsvImportOpen(false)}
                className="border-purple-900/30"
              >
                Cancel
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Smart Import Modal - Universal Trade Importer */}
      <Dialog open={smartImportOpen} onOpenChange={(open) => {
        setSmartImportOpen(open)
        if (!open) {
          setSmartImportPreview(null)
          setSmartImportFile(null)
          setImportedTrades([])
          setScreenshotPreview(null)
          setImportTab('screenshot')
        }
      }}>
        <DialogContent className="bg-[#0f0b18] border-purple-900/30 text-white max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-xl flex items-center gap-2">
              <Upload className="w-5 h-5 text-purple-400" />
              Universal Trade Importer
            </DialogTitle>
            <p className="text-sm text-gray-400">Import trades from MT5 screenshots or report files</p>
          </DialogHeader>
          
          {/* Tab Switcher */}
          <div className="flex bg-white/5 rounded-lg p-1 mb-4">
            <button
              onClick={() => setImportTab('screenshot')}
              className={`flex-1 flex items-center justify-center gap-2 py-2.5 px-4 rounded-md text-sm font-medium transition-all ${
                importTab === 'screenshot' 
                  ? 'bg-gradient-to-r from-purple-500 to-violet-600 text-white shadow-lg' 
                  : 'text-gray-400 hover:text-white'
              }`}
            >
              <Camera className="w-4 h-4" />
              Screenshot OCR
            </button>
            <button
              onClick={() => setImportTab('file')}
              className={`flex-1 flex items-center justify-center gap-2 py-2.5 px-4 rounded-md text-sm font-medium transition-all ${
                importTab === 'file' 
                  ? 'bg-gradient-to-r from-purple-500 to-violet-600 text-white shadow-lg' 
                  : 'text-gray-400 hover:text-white'
              }`}
            >
              <FileText className="w-4 h-4" />
              Upload File
            </button>
          </div>
          
          <div className="space-y-4">
            {/* TAB 1: Screenshot OCR */}
            {importTab === 'screenshot' && (
              <div className="space-y-4">
                <div className="border-2 border-dashed border-purple-900/30 rounded-xl p-6 text-center hover:border-purple-500/50 transition-colors">
                  <Camera className="w-12 h-12 mx-auto mb-4 text-purple-400" />
                  <p className="text-gray-300 mb-2 font-medium">Upload MT5 Screenshot</p>
                  <p className="text-sm text-gray-500 mb-4">AI will detect trades from your screenshot</p>
                  <Input
                    type="file"
                    accept="image/*"
                    onChange={handleScreenshotUpload}
                    className="max-w-sm mx-auto"
                    disabled={importParsing}
                  />
                </div>
                
                {/* Loading Indicator - Always visible when parsing */}
                {importParsing && (
                  <div className="bg-purple-500/10 rounded-xl p-6 border border-purple-500/30">
                    <div className="flex flex-col items-center gap-4">
                      <div className="relative">
                        <Loader2 className="w-12 h-12 animate-spin text-purple-400" />
                        <div className="absolute inset-0 flex items-center justify-center">
                          <div className="w-6 h-6 bg-purple-500/20 rounded-full animate-ping" />
                        </div>
                      </div>
                      <div className="text-center">
                        <p className="text-white font-medium">🔍 Analyzing Screenshot...</p>
                        <p className="text-sm text-gray-400 mt-1">AI is reading your trade data</p>
                        <p className="text-xs text-gray-500 mt-2">This may take 10-30 seconds</p>
                      </div>
                    </div>
                  </div>
                )}
                
                {/* Screenshot Preview */}
                {screenshotPreview && !importParsing && (
                  <div className="relative rounded-lg overflow-hidden border border-purple-900/30">
                    <img 
                      src={screenshotPreview} 
                      alt="Screenshot preview" 
                      className="w-full max-h-48 object-contain bg-black/50"
                    />
                  </div>
                )}
                
                <div className="bg-purple-500/10 rounded-lg p-4 border border-purple-500/20">
                  <p className="text-xs text-purple-300">
                    <strong>Tip:</strong> For best results, use clear MT5 history screenshots showing Symbol, Type, Lots, Price, and Profit columns.
                  </p>
                </div>
              </div>
            )}
            
            {/* TAB 2: File Upload */}
            {importTab === 'file' && (
              <div className="space-y-4">
                <div className="border-2 border-dashed border-purple-900/30 rounded-xl p-6 text-center hover:border-purple-500/50 transition-colors">
                  <FileText className="w-12 h-12 mx-auto mb-4 text-purple-400" />
                  <p className="text-gray-300 mb-2 font-medium">Upload Report File</p>
                  <p className="text-sm text-gray-500 mb-4">PDF, HTML, or CSV from MT4/MT5</p>
                  <Input
                    type="file"
                    accept=".pdf,.html,.htm,.csv"
                    onChange={handleFileUpload}
                    className="max-w-sm mx-auto"
                    disabled={importParsing}
                  />
                </div>
                
                {importParsing && (
                  <div className="flex items-center justify-center py-4">
                    <Loader2 className="w-6 h-6 animate-spin text-purple-400" />
                    <span className="ml-2 text-gray-400">Parsing file...</span>
                  </div>
                )}
                
                <div className="bg-purple-500/10 rounded-lg p-4 border border-purple-500/20">
                  <p className="text-xs text-purple-300">
                    <strong>Supported:</strong> MT5 Detailed Report (HTML), MT4 Statement (HTML), PDF reports with trade tables, CSV exports.
                  </p>
                </div>
              </div>
            )}
            
            {/* Trades Preview (Both Tabs) - EDITABLE */}
            {importedTrades.length > 0 && (
              <motion.div 
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="space-y-4"
              >
                {/* Summary Stats */}
                <div className="bg-gradient-to-r from-purple-500/10 to-violet-500/10 rounded-xl p-4 border border-purple-500/20">
                  <h4 className="font-bold text-sm text-white mb-3 flex items-center gap-2">
                    <Sparkles className="w-4 h-4 text-purple-400" />
                    📊 Detected {importedTrades.length} Trades - Edit Before Saving
                  </h4>
                  <div className="grid grid-cols-4 gap-3">
                    <div className="p-3 rounded-lg bg-white/5">
                      <div className="text-xs text-gray-400">Total Trades</div>
                      <div className="text-lg font-bold text-white">{importedTrades.length}</div>
                    </div>
                    <div className="p-3 rounded-lg bg-white/5">
                      <div className="text-xs text-gray-400">Winners</div>
                      <div className="text-lg font-bold text-emerald-400">
                        {importedTrades.filter(t => t.profit_loss >= 0).length}
                      </div>
                    </div>
                    <div className="p-3 rounded-lg bg-white/5">
                      <div className="text-xs text-gray-400">Total P/L</div>
                      <div className={`text-lg font-bold ${
                        importedTrades.reduce((sum, t) => sum + t.profit_loss, 0) >= 0 ? 'text-emerald-400' : 'text-red-400'
                      }`}>
                        {formatCurrency(importedTrades.reduce((sum, t) => sum + t.profit_loss, 0))}
                      </div>
                    </div>
                    <div className="p-3 rounded-lg bg-white/5">
                      <div className="text-xs text-gray-400">Best Trade</div>
                      <div className="text-lg font-bold text-emerald-400">
                        {Math.max(...importedTrades.map(t => t.profit_loss)) >= 0 
                          ? '+' + formatCurrency(Math.max(...importedTrades.map(t => t.profit_loss)))
                          : formatCurrency(Math.max(...importedTrades.map(t => t.profit_loss)))
                        }
                      </div>
                    </div>
                  </div>
                </div>
                
                {/* Editable Trades Table */}
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <p className="text-sm text-gray-400">📝 Click on fields to edit</p>
                    <Button 
                      variant="ghost" 
                      size="sm"
                      onClick={() => setImportedTrades([])}
                      className="text-xs text-red-400 hover:text-red-300"
                    >
                      Clear All
                    </Button>
                  </div>
                  <div className="max-h-72 overflow-y-auto rounded-lg bg-[#0a0712] border border-purple-900/30 custom-scrollbar">
                    <table className="w-full text-sm">
                      <thead className="sticky top-0 bg-[#0f0b18] z-10">
                        <tr className="text-gray-400 border-b border-purple-900/30">
                          <th className="text-left p-2 text-xs">#</th>
                          <th className="text-left p-2 text-xs">Symbol</th>
                          <th className="text-left p-2 text-xs">Type</th>
                          <th className="text-right p-2 text-xs">Lots</th>
                          <th className="text-right p-2 text-xs">Open</th>
                          <th className="text-right p-2 text-xs">Close</th>
                          <th className="text-right p-2 text-xs">P/L</th>
                          <th className="text-center p-2 text-xs">✕</th>
                        </tr>
                      </thead>
                      <tbody>
                        {importedTrades.map((trade, i) => (
                          <tr key={i} className="border-b border-purple-900/10 hover:bg-purple-900/10 transition-colors">
                            <td className="p-2 text-gray-500 text-xs">{i + 1}</td>
                            <td className="p-1">
                              <Input
                                value={trade.symbol}
                                onChange={(e) => updateImportedTrade(i, 'symbol', e.target.value.toUpperCase())}
                                className="w-20 h-7 text-xs bg-transparent border-0 p-1 font-bold focus:bg-white/5"
                              />
                            </td>
                            <td className="p-1">
                              <Select
                                value={trade.type}
                                onValueChange={(v) => updateImportedTrade(i, 'type', v)}
                              >
                                <SelectTrigger className="w-16 h-7 text-xs bg-transparent border-0 p-1">
                                  <Badge variant={trade.type === 'BUY' ? 'default' : 'destructive'} className="text-[10px]">
                                    {trade.type}
                                  </Badge>
                                </SelectTrigger>
                                <SelectContent className="bg-[#1a0f2e]">
                                  <SelectItem value="BUY">BUY</SelectItem>
                                  <SelectItem value="SELL">SELL</SelectItem>
                                </SelectContent>
                              </Select>
                            </td>
                            <td className="p-1">
                              <Input
                                type="number"
                                step="0.01"
                                value={trade.lot_size}
                                onChange={(e) => updateImportedTrade(i, 'lot_size', parseFloat(e.target.value) || 0)}
                                className="w-14 h-7 text-xs bg-transparent border-0 p-1 text-right focus:bg-white/5"
                              />
                            </td>
                            <td className="p-1">
                              <Input
                                type="number"
                                step="0.00001"
                                value={trade.open_price}
                                onChange={(e) => updateImportedTrade(i, 'open_price', parseFloat(e.target.value) || 0)}
                                className="w-20 h-7 text-xs bg-transparent border-0 p-1 text-right focus:bg-white/5"
                              />
                            </td>
                            <td className="p-1">
                              <Input
                                type="number"
                                step="0.00001"
                                value={trade.close_price}
                                onChange={(e) => updateImportedTrade(i, 'close_price', parseFloat(e.target.value) || 0)}
                                className="w-20 h-7 text-xs bg-transparent border-0 p-1 text-right focus:bg-white/5"
                              />
                            </td>
                            <td className="p-1">
                              <Input
                                type="number"
                                step="0.01"
                                value={trade.profit_loss}
                                onChange={(e) => updateImportedTrade(i, 'profit_loss', parseFloat(e.target.value) || 0)}
                                className={`w-20 h-7 text-xs bg-transparent border-0 p-1 text-right font-bold focus:bg-white/5 ${
                                  trade.profit_loss >= 0 ? 'text-emerald-400' : 'text-red-400'
                                }`}
                              />
                            </td>
                            <td className="p-1 text-center">
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => removeImportedTrade(i)}
                                className="w-6 h-6 p-0 text-gray-500 hover:text-red-400 hover:bg-red-500/10"
                              >
                                ✕
                              </Button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </motion.div>
            )}
            
            {/* Action Buttons */}
            <div className="flex gap-3 pt-2">
              <Button 
                onClick={handleSaveImportedTrades}
                disabled={importedTrades.length === 0 || importParsing}
                className="flex-1 bg-gradient-to-r from-purple-500 to-violet-600"
              >
                <Sparkles className="w-4 h-4 mr-2" />
                Import {importedTrades.length} Trades
              </Button>
              <Button 
                variant="outline" 
                onClick={() => setSmartImportOpen(false)}
                className="border-purple-900/30"
              >
                Cancel
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <PaymentModal
        isOpen={paymentModalOpen}
        onClose={() => setPaymentModalOpen(false)}
        userId={user?.id}
        email={user?.email}
      />
    </div>
  )
}

// ==================== ANIMATED STAT CARD ====================

function AnimatedStatCard({ 
  title, 
  value, 
  subtitle, 
  icon: Icon, 
  iconColor, 
  valueColor = 'text-white',
  prefix = '', 
  suffix = '',
  decimals = 2
}: {
  title: string
  value: number
  subtitle?: string
  icon: React.ElementType
  iconColor: string
  valueColor?: string
  prefix?: string
  suffix?: string
  decimals?: number
}) {
  const [isHovered, setIsHovered] = useState(false)
  
  return (
    <motion.div
      onHoverStart={() => setIsHovered(true)}
      onHoverEnd={() => setIsHovered(false)}
      whileHover={{ scale: 1.02, y: -4 }}
      transition={{ type: "spring", stiffness: 300, damping: 20 }}
    >
      <Card className={`bg-gradient-to-br from-[#0f0b18] to-[#12091a] border-purple-900/30 relative overflow-hidden transition-all duration-300 ${isHovered ? 'shadow-lg shadow-purple-500/10 border-purple-500/30' : ''}`}>
        {isHovered && (
          <motion.div 
            className="absolute inset-0 bg-gradient-to-br from-purple-500/5 to-purple-500/5"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          />
        )}
        <CardHeader className="flex flex-row items-center justify-between pb-2 relative">
          <CardTitle className="text-xs lg:text-sm font-medium text-gray-400">{title}</CardTitle>
          <motion.div 
            className={`w-8 h-8 rounded-lg ${iconColor} flex items-center justify-center`}
            animate={isHovered ? { scale: 1.1, rotate: 5 } : { scale: 1, rotate: 0 }}
            transition={{ type: "spring", stiffness: 300 }}
          >
            <Icon className="w-4 h-4" />
          </motion.div>
        </CardHeader>
        <CardContent className="relative">
          <div className={`text-xl lg:text-2xl font-bold ${valueColor}`}>
            <AnimatedNumber value={value} prefix={prefix} suffix={suffix} decimals={decimals} />
          </div>
          {subtitle && <p className="text-xs text-gray-500 mt-1">{subtitle}</p>}
        </CardContent>
      </Card>
    </motion.div>
  )
}

// ==================== NEWS TICKER COMPONENT ====================
const tradingNews = [
  { text: "🔴 HIGH IMPACT: US NFP Report - Friday 14:30 GMT", type: "high" },
  { text: "🟡 MEDIUM: ECB Interest Rate Decision - Thursday 13:45 GMT", type: "medium" },
  { text: "🟡 MEDIUM: UK GDP m/m - Wednesday 07:00 GMT", type: "medium" },
  { text: "🔴 HIGH IMPACT: FOMC Statement - Next Week Wednesday", type: "high" },
  { text: "🟢 LOW: Crude Oil Inventories - Wednesday 15:30 GMT", type: "low" },
  { text: "🔴 HIGH IMPACT: CPI Data Release - Tuesday 13:30 GMT", type: "high" },
  { text: "🟡 MEDIUM: ADP Non-Farm Employment - Wednesday 13:15 GMT", type: "medium" },
  { text: "💡 TIP: Avoid trading during HIGH IMPACT news sessions", type: "tip" },
]

function NewsTicker() {
  return (
    <div className="relative overflow-hidden bg-gradient-to-r from-[#0f0b18] via-[#1a0f2e] to-[#0f0b18] border border-purple-900/30 rounded-xl py-3 mb-6">
      {/* Left gradient fade */}
      <div className="absolute left-0 top-0 bottom-0 w-16 bg-gradient-to-r from-[#0f0b18] to-transparent z-10" />
      {/* Right gradient fade */}
      <div className="absolute right-0 top-0 bottom-0 w-16 bg-gradient-to-l from-[#0f0b18] to-transparent z-10" />
      
      {/* Scrolling container */}
      <div className="animate-ticker-scroll">
        <div className="flex gap-12 whitespace-nowrap">
          {[...tradingNews, ...tradingNews].map((news, index) => (
            <span 
              key={index} 
              className={`inline-flex items-center gap-2 px-4 ${
                news.type === 'high' ? 'text-red-400' : 
                news.type === 'medium' ? 'text-purple-400' : 
                news.type === 'tip' ? 'text-purple-400' : 'text-white/60'
              }`}
            >
              {news.text}
            </span>
          ))}
        </div>
      </div>
    </div>
  )
}

// ==================== DASHBOARD TAB ====================
function DashboardTab({ 
  analytics, 
  trades, 
  loading, 
  setAddTradeOpen,
  onSeedData,
  seeding,
  onView,
  onEdit,
  onDelete,
  chartAnimated,
  demoMode
}: { 
  analytics: Analytics | null
  trades: Trade[]
  loading: boolean
  setAddTradeOpen: (open: boolean) => void
  onSeedData: () => void
  seeding: boolean
  onView: (trade: Trade) => void
  onEdit: (trade: Trade) => void
  onDelete: (trade: Trade) => void
  chartAnimated: boolean
  demoMode: boolean
}) {
  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <RefreshCw className="w-8 h-8 animate-spin text-purple-400" />
      </div>
    )
  }

  const hasData = trades.length > 0

  return (
    <div className="space-y-6">
      {/* Demo Mode Banner */}
      {demoMode && (
        <motion.div 
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-gradient-to-r from-emerald-500/10 to-teal-500/10 border border-emerald-500/30 rounded-xl p-4 flex items-center justify-between"
        >
          <div className="flex items-center gap-3">
            <Play className="w-5 h-5 text-emerald-400" />
            <div>
              <p className="font-bold text-emerald-400">Demo Mode Active</p>
              <p className="text-sm text-gray-400">Explore the dashboard with sample data - changes won&apos;t be saved</p>
            </div>
          </div>
        </motion.div>
      )}
      
      {/* News Ticker */}
      <NewsTicker />
      
      {/* Stats Cards with Animation */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 lg:gap-4">
        <AnimatedStatCard
          title="Total P/L"
          value={analytics?.totalPL || 0}
          prefix="$"
          subtitle={`${analytics?.totalTrades || 0} trades`}
          icon={DollarSign}
          iconColor="bg-purple-500/20"
          valueColor={(analytics?.totalPL || 0) >= 0 ? 'text-emerald-400' : 'text-red-400'}
        />
        <AnimatedStatCard
          title="Win Rate"
          value={analytics?.winRate || 0}
          suffix="%"
          subtitle="Success rate"
          icon={Target}
          iconColor="bg-emerald-500/20"
          valueColor="text-emerald-400"
          decimals={1}
        />
        <AnimatedStatCard
          title="Win / Loss"
          value={analytics?.winningTrades || 0}
          subtitle={`${analytics?.losingTrades || 0} losses`}
          icon={Activity}
          iconColor="bg-blue-500/20"
          valueColor="text-white"
          decimals={0}
        />
        <AnimatedStatCard
          title="Profit Factor"
          value={analytics?.profitFactor || 0}
          subtitle={analytics && analytics.profitFactor >= 1.5 ? 'Good' : 'Needs work'}
          icon={TrendingUp}
          iconColor="bg-purple-500/20"
          valueColor="text-purple-400"
          decimals={2}
        />
      </div>

      {/* Additional Stats Row - Streak & Best/Worst */}
      {hasData && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 lg:gap-4">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3, delay: 0.1 }}
          >
            <Card className="bg-gradient-to-br from-emerald-500/10 to-transparent border-emerald-500/20">
              <CardContent className="p-4">
                <div className="flex items-center gap-2 mb-1">
                  <TrendingUp className="w-4 h-4 text-emerald-400" />
                  <span className="text-xs text-gray-400">Win Streak</span>
                </div>
                <div className="text-2xl font-bold text-emerald-400">
                  {trades.length > 0 ? Math.max(...trades.map(t => t.profit_loss >= 0 ? 1 : 0)) : 0}
                </div>
              </CardContent>
            </Card>
          </motion.div>
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3, delay: 0.15 }}
          >
            <Card className="bg-gradient-to-br from-red-500/10 to-transparent border-red-500/20">
              <CardContent className="p-4">
                <div className="flex items-center gap-2 mb-1">
                  <TrendingDown className="w-4 h-4 text-red-400" />
                  <span className="text-xs text-gray-400">Lose Streak</span>
                </div>
                <div className="text-2xl font-bold text-red-400">
                  {trades.length > 0 ? Math.max(...trades.map(t => t.profit_loss < 0 ? 1 : 0)) : 0}
                </div>
              </CardContent>
            </Card>
          </motion.div>
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3, delay: 0.2 }}
          >
            <Card className="bg-gradient-to-br from-purple-500/10 to-transparent border-purple-500/20">
              <CardContent className="p-4">
                <div className="flex items-center gap-2 mb-1">
                  <Sparkles className="w-4 h-4 text-purple-400" />
                  <span className="text-xs text-gray-400">Best Trade</span>
                </div>
                <div className="text-2xl font-bold text-purple-400">
                  +{trades.length > 0 ? Math.max(...trades.map(t => t.profit_loss)) : 0}
                </div>
              </CardContent>
            </Card>
          </motion.div>
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3, delay: 0.25 }}
          >
            <Card className="bg-gradient-to-br from-purple-500/10 to-transparent border-purple-500/20">
              <CardContent className="p-4">
                <div className="flex items-center gap-2 mb-1">
                  <AlertTriangle className="w-4 h-4 text-purple-400" />
                  <span className="text-xs text-gray-400">Worst Trade</span>
                </div>
                <div className="text-2xl font-bold text-purple-400">
                  {trades.length > 0 ? Math.min(...trades.map(t => t.profit_loss)) : 0}
                </div>
              </CardContent>
            </Card>
          </motion.div>
        </div>
      )}

      {/* Session Performance Chart */}
      {hasData && analytics?.sessionPerformance && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.15 }}
        >
          <Card className="bg-gradient-to-br from-[#0f0b18] to-[#12091a] border-purple-900/30">
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <Clock className="w-5 h-5 text-purple-400" />
                Session Performance
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="h-[200px]">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={analytics.sessionPerformance}>
                    <XAxis dataKey="session" tick={{ fill: 'rgba(255,255,255,0.5)', fontSize: 11 }} axisLine={false} tickLine={false} />
                    <YAxis tick={{ fill: 'rgba(255,255,255,0.3)', fontSize: 10 }} axisLine={false} tickLine={false} />
                    <Tooltip
                      contentStyle={{ background: '#0f0b18', border: '1px solid rgba(139,92,246,0.3)', borderRadius: 8 }}
                      formatter={(value: number) => formatCurrency(value)}
                    />
                    <Bar dataKey="pl" radius={[4, 4, 0, 0]}>
                      {analytics.sessionPerformance.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.pl >= 0 ? '#22c55e' : '#ef4444'} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>
        </motion.div>
      )}

      {/* Equity Curve with Animation */}
      {hasData && analytics?.equityCurve && analytics.equityCurve.length > 1 && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.2 }}
        >
          <Card className="bg-gradient-to-br from-[#0f0b18] to-[#12091a] border-purple-900/30">
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="text-lg">Equity Curve</CardTitle>
              <div className="flex items-center gap-2">
                <span className="text-sm text-gray-400">Current:</span>
                <span className={`text-lg font-bold ${(analytics?.totalPL || 0) >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                  <AnimatedNumber value={10000 + (analytics?.totalPL || 0)} prefix="$" decimals={0} />
                </span>
              </div>
            </CardHeader>
            <CardContent>
              <div className="h-[200px] lg:h-[250px]">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={analytics.equityCurve}>
                    <defs>
                      <linearGradient id="equityGradient" x1="0" y1="0" x2="1" y2="0">
                        <stop offset="0%" stopColor="#f59e0b" stopOpacity={0.8} />
                        <stop offset="100%" stopColor="#8b5cf6" stopOpacity={0.8} />
                      </linearGradient>
                      <linearGradient id="equityFill" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#8b5cf6" stopOpacity={0.3} />
                        <stop offset="100%" stopColor="#8b5cf6" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <XAxis dataKey="date" tick={{ fill: 'rgba(255,255,255,0.3)', fontSize: 10 }} axisLine={false} tickLine={false} />
                    <YAxis tick={{ fill: 'rgba(255,255,255,0.3)', fontSize: 10 }} axisLine={false} tickLine={false} />
                    <Tooltip
                      contentStyle={{ background: '#0f0b18', border: '1px solid rgba(139,92,246,0.3)', borderRadius: 8 }}
                      labelStyle={{ color: 'rgba(255,255,255,0.6)' }}
                      formatter={(value: number) => formatCurrency(value)}
                    />
                    <Area
                      type="monotone"
                      dataKey="equity"
                      stroke="url(#equityGradient)"
                      strokeWidth={2.5}
                      fill="url(#equityFill)"
                      animationDuration={1500}
                      animationEasing="ease-out"
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>
        </motion.div>
      )}

      {/* Empty State */}
      {!hasData && (
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.5 }}
        >
          <Card className="bg-gradient-to-br from-[#0f0b18] to-[#12091a] border-purple-900/30">
            <CardContent className="py-16 lg:py-20 text-center">
              <motion.div 
                className="w-16 h-16 lg:w-20 lg:h-20 rounded-full bg-gradient-to-br from-purple-500/20 to-violet-500/20 flex items-center justify-center mx-auto mb-6"
                animate={{ scale: [1, 1.05, 1] }}
                transition={{ duration: 2, repeat: Infinity }}
              >
                <BarChart3 className="w-8 h-8 lg:w-10 lg:h-10 text-purple-400" />
              </motion.div>
              <h3 className="text-xl lg:text-2xl font-bold mb-3 bg-gradient-to-r from-purple-200 to-purple-400 bg-clip-text text-transparent">Welcome to LuxTrade!</h3>
              <p className="text-gray-400 mb-8 max-w-md mx-auto">Start tracking your trades to see powerful analytics and insights.</p>
              <div className="flex flex-col sm:flex-row gap-4 justify-center">
                <Button onClick={() => setAddTradeOpen(true)} className="bg-gradient-to-r from-purple-500 to-violet-600 shadow-lg shadow-purple-500/20">
                  <Plus className="w-4 h-4 mr-2" />Add Your First Trade
                </Button>
                {!demoMode && (
                  <Button 
                    onClick={onSeedData} 
                    disabled={seeding}
                    className="bg-purple-500/20 text-purple-400 border border-purple-500/30 hover:bg-purple-500/30"
                  >
                    <Database className="w-4 h-4 mr-2" />
                    {seeding ? 'Loading...' : 'Load Demo Data'}
                  </Button>
                )}
              </div>
            </CardContent>
          </Card>
        </motion.div>
      )}

      {/* Recent Trades Preview */}
      {hasData && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.3 }}
        >
          <Card className="bg-gradient-to-br from-[#0f0b18] to-[#12091a] border-purple-900/30">
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="text-lg">Recent Trades</CardTitle>
              <span className="text-xs text-gray-400">{trades.length} total</span>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {trades.slice(0, 5).map((trade, index) => (
                  <motion.div 
                    key={trade.id} 
                    className="flex items-center justify-between p-3 rounded-lg bg-white/5 hover:bg-white/10 transition-all cursor-pointer group"
                    onClick={() => onView(trade)}
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ duration: 0.3, delay: index * 0.05 }}
                    whileHover={{ x: 4 }}
                  >
                    <div className="flex items-center gap-3">
                      <motion.div 
                        className={`w-2 h-2 rounded-full ${trade.profit_loss >= 0 ? 'bg-emerald-400' : 'bg-red-400'}`}
                        animate={{ scale: [1, 1.2, 1] }}
                        transition={{ duration: 2, repeat: Infinity, delay: index * 0.2 }}
                      />
                      <span className="font-bold">{trade.symbol}</span>
                      <Badge variant={trade.type === 'BUY' ? 'default' : 'destructive'} className="text-xs">
                        {trade.type}
                      </Badge>
                      <span className="text-xs text-gray-500 hidden sm:inline">{trade.session || '-'}</span>
                    </div>
                    <span className={`font-bold ${trade.profit_loss >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                      {trade.profit_loss >= 0 ? '+' : ''}{formatCurrency(trade.profit_loss)}
                    </span>
                  </motion.div>
                ))}
              </div>
            </CardContent>
          </Card>
        </motion.div>
      )}
    </div>
  )
}

// ==================== TRADES TAB ====================
function TradesTab({ 
  trades, 
  loading,
  onView,
  onEdit,
  onDelete,
  onImport,
  onSmartImport
}: { 
  trades: Trade[]
  loading: boolean
  onView: (trade: Trade) => void
  onEdit: (trade: Trade) => void
  onDelete: (trade: Trade) => void
  onImport: () => void
  onSmartImport: () => void
}) {
  const [searchTerm, setSearchTerm] = useState('')
  const [filterType, setFilterType] = useState<'all' | 'BUY' | 'SELL'>('all')
  const [filterSession, setFilterSession] = useState<'all' | 'London' | 'New York' | 'Asia'>('all')

  // Filter trades
  const filteredTrades = useMemo(() => {
    return trades.filter(trade => {
      const matchesSearch = trade.symbol.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (trade.notes && trade.notes.toLowerCase().includes(searchTerm.toLowerCase()))
      const matchesType = filterType === 'all' || trade.type === filterType
      const matchesSession = filterSession === 'all' || trade.session === filterSession
      return matchesSearch && matchesType && matchesSession
    })
  }, [trades, searchTerm, filterType, filterSession])

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <RefreshCw className="w-8 h-8 animate-spin text-purple-400" />
      </div>
    )
  }

  if (trades.length === 0) {
    return (
      <Card className="bg-gradient-to-br from-[#0f0b18] to-[#12091a] border-purple-900/30">
        <CardContent className="py-16 text-center">
          <Activity className="w-12 h-12 mx-auto mb-4 text-gray-500" />
          <h3 className="text-lg font-semibold mb-2">No Trades Yet</h3>
          <p className="text-gray-400">Add your first trade or import from MetaTrader!</p>
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h3 className="text-xl font-bold">Trade History</h3>
          <p className="text-sm text-gray-400">{filteredTrades.length} of {trades.length} trades</p>
        </div>
        <div className="flex gap-2">
          <Button onClick={onSmartImport} variant="outline" className="border-purple-500/30 text-purple-400">
            <Upload className="w-4 h-4 mr-2" /> Smart Import
          </Button>
          <Button onClick={onImport} className="bg-gradient-to-r from-purple-500 to-violet-600">
            <FileText className="w-4 h-4 mr-2" /> Import CSV
          </Button>
        </div>
      </div>

      {/* Filter & Search Bar */}
      <Card className="bg-gradient-to-br from-[#0f0b18] to-[#12091a] border-purple-900/30">
        <CardContent className="p-4">
          <div className="flex flex-col sm:flex-row gap-3">
            {/* Search */}
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <Input
                placeholder="Search symbol or notes..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10 bg-white/5 border-purple-900/30"
              />
            </div>
            
            {/* Type Filter */}
            <Select value={filterType} onValueChange={(v: any) => setFilterType(v)}>
              <SelectTrigger className="w-[120px] bg-white/5 border-purple-900/30">
                <SelectValue placeholder="Type" />
              </SelectTrigger>
              <SelectContent className="bg-[#0f0b18] border-purple-900/30">
                <SelectItem value="all">All Types</SelectItem>
                <SelectItem value="BUY">BUY</SelectItem>
                <SelectItem value="SELL">SELL</SelectItem>
              </SelectContent>
            </Select>

            {/* Session Filter */}
            <Select value={filterSession} onValueChange={(v: any) => setFilterSession(v)}>
              <SelectTrigger className="w-[140px] bg-white/5 border-purple-900/30">
                <SelectValue placeholder="Session" />
              </SelectTrigger>
              <SelectContent className="bg-[#0f0b18] border-purple-900/30">
                <SelectItem value="all">All Sessions</SelectItem>
                <SelectItem value="London">London</SelectItem>
                <SelectItem value="New York">New York</SelectItem>
                <SelectItem value="Asia">Asia</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      <Card className="bg-gradient-to-br from-[#0f0b18] to-[#12091a] border-purple-900/30">
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-purple-900/30 text-gray-400">
                  <th className="text-left p-4 font-medium">Symbol</th>
                  <th className="text-left p-4 font-medium">Type</th>
                  <th className="text-left p-4 font-medium hidden sm:table-cell">Entry</th>
                  <th className="text-left p-4 font-medium hidden sm:table-cell">Exit</th>
                  <th className="text-left p-4 font-medium hidden md:table-cell">Session</th>
                  <th className="text-right p-4 font-medium">P/L</th>
                  <th className="text-right p-4 font-medium">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredTrades.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="p-8 text-center text-gray-400">
                      No trades match your filters
                    </td>
                  </tr>
                ) : (
                  filteredTrades.map((trade) => (
                    <tr key={trade.id} className="border-b border-purple-900/20 hover:bg-white/5 transition-colors">
                      <td className="p-4 font-bold">{trade.symbol}</td>
                      <td className="p-4">
                        <Badge variant={trade.type === 'BUY' ? 'default' : 'destructive'} className="text-xs">
                          {trade.type}
                        </Badge>
                      </td>
                      <td className="p-4 text-gray-400 hidden sm:table-cell">{trade.open_price}</td>
                      <td className="p-4 text-gray-400 hidden sm:table-cell">{trade.close_price}</td>
                      <td className="p-4 text-gray-500 hidden md:table-cell">{trade.session || '-'}</td>
                      <td className={`p-4 text-right font-bold ${trade.profit_loss >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                        {trade.profit_loss >= 0 ? '+' : ''}{formatCurrency(trade.profit_loss)}
                      </td>
                      <td className="p-4">
                        <div className="flex items-center justify-end gap-1">
                          <button 
                            onClick={() => onView(trade)}
                            className="p-1.5 rounded-lg hover:bg-white/10 text-gray-400 hover:text-white transition-colors"
                          >
                            <ViewIcon className="w-4 h-4" />
                          </button>
                          <button 
                            onClick={() => onEdit(trade)}
                            className="p-1.5 rounded-lg hover:bg-white/10 text-gray-400 hover:text-purple-400 transition-colors"
                          >
                            <Edit className="w-4 h-4" />
                          </button>
                          <button 
                            onClick={() => onDelete(trade)}
                            className="p-1.5 rounded-lg hover:bg-white/10 text-gray-400 hover:text-red-400 transition-colors"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

// ==================== JOURNAL TAB ====================
function JournalTab({ 
  entries, 
  loading, 
  onAdd, 
  onView, 
  onEdit, 
  onDelete 
}: { 
  entries: JournalEntry[]
  loading: boolean
  onAdd: () => void
  onView: (entry: JournalEntry) => void
  onEdit: (entry: JournalEntry) => void
  onDelete: (id: string) => void
}) {
  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <RefreshCw className="w-8 h-8 animate-spin text-purple-400" />
      </div>
    )
  }

  const getMoodIcon = (mood: string | null) => {
    switch (mood) {
      case 'confident': return <Smile className="w-4 h-4 text-emerald-400" />
      case 'neutral': return <Meh className="w-4 h-4 text-purple-400" />
      case 'anxious': return <Frown className="w-4 h-4 text-red-400" />
      default: return null
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-xl font-bold">Trading Journal</h3>
          <p className="text-sm text-gray-400">Document your trading journey</p>
        </div>
        <Button onClick={onAdd} className="bg-gradient-to-r from-purple-500 to-violet-600">
          <Plus className="w-4 h-4 mr-2" />New Entry
        </Button>
      </div>

      {entries.length === 0 ? (
        <Card className="bg-gradient-to-br from-[#0f0b18] to-[#12091a] border-purple-900/30">
          <CardContent className="py-16 text-center">
            <BookOpen className="w-12 h-12 mx-auto mb-4 text-gray-500" />
            <h3 className="text-lg font-semibold mb-2">No Journal Entries</h3>
            <p className="text-gray-400 mb-4">Start documenting your trades!</p>
            <Button onClick={onAdd} variant="outline" className="border-purple-500/30 text-purple-400">
              <Plus className="w-4 h-4 mr-2" /> Write First Entry
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4">
          {entries.map((entry) => (
            <Card 
              key={entry.id} 
              className="bg-gradient-to-br from-[#0f0b18] to-[#12091a] border-purple-900/30 hover:border-purple-500/30 transition-colors cursor-pointer"
              onClick={() => onView(entry)}
            >
              <CardContent className="p-4 lg:p-6">
                <div className="flex items-start justify-between mb-3">
                  <div className="flex items-center gap-3">
                    {getMoodIcon(entry.mood)}
                    <h4 className="font-bold text-lg">{entry.title}</h4>
                  </div>
                  <span className="text-xs text-gray-500">{new Date(entry.created_at).toLocaleDateString()}</span>
                </div>
                <p className="text-gray-400 text-sm line-clamp-2">{entry.content}</p>
                <div className="flex gap-2 mt-3">
                  {entry.market_condition && (
                    <Badge variant="outline" className="text-xs border-purple-500/30 text-purple-400">
                      {entry.market_condition}
                    </Badge>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}

// ==================== WATCHLIST TAB ====================
function WatchlistTab({ 
  items, 
  loading, 
  onAdd, 
  onDelete 
}: { 
  items: WatchlistItem[]
  loading: boolean
  onAdd: () => void
  onDelete: (id: string) => void
}) {
  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <RefreshCw className="w-8 h-8 animate-spin text-purple-400" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-xl font-bold">Watchlist</h3>
          <p className="text-sm text-gray-400">Track potential opportunities</p>
        </div>
        <Button onClick={onAdd} className="bg-gradient-to-r from-emerald-500 to-teal-600">
          <Plus className="w-4 h-4 mr-2" />Add Symbol
        </Button>
      </div>

      {items.length === 0 ? (
        <Card className="bg-gradient-to-br from-[#0f0b18] to-[#12091a] border-purple-900/30">
          <CardContent className="py-16 text-center">
            <Eye className="w-12 h-12 mx-auto mb-4 text-gray-500" />
            <h3 className="text-lg font-semibold mb-2">No Watchlist Items</h3>
            <p className="text-gray-400 mb-4">Add symbols to track potential setups!</p>
            <Button onClick={onAdd} variant="outline" className="border-emerald-500/30 text-emerald-400">
              <Plus className="w-4 h-4 mr-2" /> Add First Symbol
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {items.map((item) => (
            <Card key={item.id} className="bg-gradient-to-br from-[#0f0b18] to-[#12091a] border-purple-900/30 hover:border-emerald-500/30 transition-colors group">
              <CardContent className="p-4">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <div className="w-10 h-10 rounded-lg bg-emerald-500/20 flex items-center justify-center">
                      <TrendingUpIcon className="w-5 h-5 text-emerald-400" />
                    </div>
                    <div>
                      <h4 className="font-bold">{item.symbol}</h4>
                      {item.name && <p className="text-xs text-gray-500">{item.name}</p>}
                    </div>
                  </div>
                  <button 
                    onClick={() => onDelete(item.id)}
                    className="p-1 rounded opacity-0 group-hover:opacity-100 hover:bg-red-500/20 text-gray-400 hover:text-red-400 transition-all"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
                {item.target_price && (
                  <div className="mb-2">
                    <span className="text-xs text-gray-500">Target: </span>
                    <span className="text-sm font-bold text-emerald-400">{item.target_price}</span>
                  </div>
                )}
                {item.notes && (
                  <p className="text-xs text-gray-400 line-clamp-2">{item.notes}</p>
                )}
                <p className="text-xs text-gray-600 mt-2">Added {new Date(item.created_at).toLocaleDateString()}</p>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}

// ==================== ANALYTICS TAB ====================
function AnalyticsTab({ analytics, loading, trades }: { analytics: Analytics | null; loading: boolean; trades: Trade[] }) {
  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <RefreshCw className="w-8 h-8 animate-spin text-purple-400" />
      </div>
    )
  }

  if (!analytics || analytics.totalTrades === 0) {
    return (
      <Card className="bg-gradient-to-br from-[#0f0b18] to-[#12091a] border-purple-900/30">
        <CardContent className="py-16 text-center">
          <PieChart className="w-12 h-12 mx-auto mb-4 text-gray-500" />
          <h3 className="text-lg font-semibold mb-2">No Analytics Yet</h3>
          <p className="text-gray-400">Add some trades to see analytics!</p>
        </CardContent>
      </Card>
    )
  }

  const sessionColors: Record<string, string> = {
    'London': '#f59e0b',
    'New York': '#8b5cf6',
    'Asia': '#10b981',
    'Off-Market': '#6b7280'
  }

  return (
    <div className="space-y-6">
      {/* Session Performance Chart */}
      <Card className="bg-gradient-to-br from-[#0f0b18] to-[#12091a] border-purple-900/30">
        <CardHeader>
          <CardTitle className="text-lg">Session Performance</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-[200px] lg:h-[250px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={analytics.sessionPerformance}>
                <XAxis dataKey="session" tick={{ fill: 'rgba(255,255,255,0.3)', fontSize: 11 }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fill: 'rgba(255,255,255,0.3)', fontSize: 11 }} axisLine={false} tickLine={false} />
                <Tooltip
                  contentStyle={{ background: '#0f0b18', border: '1px solid rgba(139,92,246,0.3)', borderRadius: 8 }}
                  formatter={(value: number) => formatCurrency(value)}
                />
                <Bar dataKey="pl" radius={[4, 4, 0, 0]} animationDuration={1000}>
                  {analytics.sessionPerformance.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={sessionColors[entry.session] || '#8b5cf6'} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>

      {/* Session Performance Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 lg:gap-4">
        {analytics.sessionPerformance.map((session) => (
          <motion.div 
            key={session.session} 
            className="p-4 rounded-xl bg-white/5 border border-purple-900/30"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3 }}
          >
            <div className="text-sm text-gray-400 mb-1">{session.session}</div>
            <div className={`text-xl font-bold ${session.pl >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
              <AnimatedNumber value={session.pl} prefix={session.pl >= 0 ? '+' : ''} decimals={0} />
            </div>
            <div className="text-xs text-gray-500 mt-1">
              {session.trades} trades - {session.winRate.toFixed(0)}% WR
            </div>
          </motion.div>
        ))}
      </div>

      {/* Risk Metrics */}
      <Card className="bg-gradient-to-br from-[#0f0b18] to-[#12091a] border-purple-900/30">
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <AlertCircle className="w-5 h-5 text-purple-400" />
            Risk Metrics
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="p-4 rounded-xl bg-white/5 border border-purple-900/30">
              <div className="text-sm text-gray-400 mb-1">Max Drawdown</div>
              <div className="text-2xl font-bold text-red-400">
                -<AnimatedNumber value={analytics.maxDrawdown || 0} decimals={0} />
              </div>
              <p className="text-xs text-gray-500 mt-1">Peak to trough decline</p>
            </div>
            <div className="p-4 rounded-xl bg-white/5 border border-purple-900/30">
              <div className="text-sm text-gray-400 mb-1">Sharpe Ratio</div>
              <div className="text-2xl font-bold text-purple-400">
                <AnimatedNumber value={analytics.sharpeRatio || 0} decimals={2} />
              </div>
              <p className="text-xs text-gray-500 mt-1">Risk-adjusted return</p>
            </div>
            <div className="p-4 rounded-xl bg-white/5 border border-purple-900/30">
              <div className="text-sm text-gray-400 mb-1">Average Win</div>
              <div className="text-2xl font-bold text-emerald-400">
                +<AnimatedNumber value={analytics.avgProfit} decimals={0} />
              </div>
              <p className="text-xs text-gray-500 mt-1">Per winning trade</p>
            </div>
            <div className="p-4 rounded-xl bg-white/5 border border-purple-900/30">
              <div className="text-sm text-gray-400 mb-1">Average Loss</div>
              <div className="text-2xl font-bold text-red-400">
                -<AnimatedNumber value={analytics.avgLoss} decimals={0} />
              </div>
              <p className="text-xs text-gray-500 mt-1">Per losing trade</p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

// ==================== AI TAB ====================
function AITab({ 
  analytics, 
  trades, 
  insight, 
  loading, 
  onGetTips, 
  onGetMarket,
  isPro,
  onUpgrade
}: { 
  analytics: Analytics | null
  trades: Trade[]
  insight: string
  loading: boolean
  onGetTips: () => void
  onGetMarket: () => void
  chatMessages: { role: 'user' | 'assistant'; content: string }[]
  chatInput: string
  onChatChange: (v: string) => void
  onSendChat: () => void
  isPro: boolean
  onUpgrade: () => void
}) {
  const hasEnoughTrades = analytics && analytics.totalTrades >= 5

  return (
    <div className="space-y-6">
      {/* PRO Paywall */}
      {!isPro && (
        <Card className="bg-gradient-to-br from-purple-500/10 to-violet-500/10 border-purple-500/30">
          <CardContent className="py-8 text-center">
            <motion.div
              animate={{ scale: [1, 1.1, 1] }}
              transition={{ duration: 2, repeat: Infinity }}
            >
              <Lock className="w-12 h-12 mx-auto mb-4 text-purple-400" />
            </motion.div>
            <h3 className="text-lg font-bold text-purple-400 mb-2">AI Insights - PRO Feature</h3>
            <p className="text-gray-400 mb-4">Unlock AI-powered trading insights and recommendations</p>
            <Button onClick={onUpgrade} className="bg-gradient-to-r from-purple-500 to-violet-600">
              <Zap className="w-4 h-4 mr-2" /> Upgrade to PRO
            </Button>
          </CardContent>
        </Card>
      )}

      {/* AI Header */}
      <Card className={`bg-gradient-to-br from-[#0f0b18] to-[#12091a] border-purple-900/30 ${!isPro ? 'blur-sm pointer-events-none' : ''}`}>
        <CardHeader>
          <CardTitle className="flex items-center gap-3 text-xl">
            <motion.div 
              className="w-10 h-10 rounded-xl bg-gradient-to-br from-purple-500/20 to-violet-500/20 flex items-center justify-center"
              animate={{ rotate: [0, 5, -5, 0] }}
              transition={{ duration: 4, repeat: Infinity }}
            >
              <Brain className="w-5 h-5 text-purple-400" />
            </motion.div>
            AI Trading Assistant
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-gray-400 mb-4">
            Get personalized insights powered by AI to improve your trading performance.
          </p>
          
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Button 
              onClick={onGetTips}
              disabled={loading || !hasEnoughTrades}
              className="bg-gradient-to-r from-purple-500/20 to-violet-500/20 border border-purple-500/30 text-purple-400 hover:bg-purple-500/30 justify-start"
            >
              {loading ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Sparkles className="w-4 h-4 mr-2" />}
              Get Performance Tips
            </Button>
            <Button 
              onClick={onGetMarket}
              disabled={loading}
              className="bg-gradient-to-r from-purple-500/20 to-violet-500/20 border border-purple-500/30 text-purple-400 hover:bg-purple-500/30 justify-start"
            >
              {loading ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <TrendingUp className="w-4 h-4 mr-2" />}
              Market Insights
            </Button>
          </div>
          
          {!hasEnoughTrades && (
            <div className="p-3 rounded-lg bg-purple-500/10 border border-purple-500/20 mt-4">
              <p className="text-sm text-purple-400 flex items-center gap-2">
                <AlertCircle className="w-4 h-4" />
                Add at least 5 closed trades to unlock AI-powered performance tips.
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* AI Response */}
      {insight && (
        <Card className="bg-gradient-to-br from-[#0f0b18] to-[#12091a] border-purple-900/30">
          <CardContent className="p-6">
            <div className="flex items-start gap-3">
              <div className="w-8 h-8 rounded-lg bg-purple-500/20 flex items-center justify-center flex-shrink-0">
                <Sparkles className="w-4 h-4 text-purple-400" />
              </div>
              <div>
                <p className="text-sm text-gray-400 mb-1">AI Insight</p>
                <p className="text-gray-200 whitespace-pre-wrap">{insight}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}

// ==================== PSYCHOLOGY TAB ====================
function PsychologyTab({ isPro, onUpgrade, trades }: { isPro: boolean; onUpgrade: () => void; trades: Trade[] }) {
  // Calculate psychology metrics from trades
  const winningTrades = trades.filter(t => t.profit_loss >= 0)
  const losingTrades = trades.filter(t => t.profit_loss < 0)
  
  // Session performance analysis
  const sessionStats = trades.reduce((acc, trade) => {
    const session = trade.session || 'Unknown'
    if (!acc[session]) {
      acc[session] = { wins: 0, losses: 0, totalPL: 0 }
    }
    if (trade.profit_loss >= 0) {
      acc[session].wins++
    } else {
      acc[session].losses++
    }
    acc[session].totalPL += trade.profit_loss
    return acc
  }, {} as Record<string, { wins: number; losses: number; totalPL: number }>)

  // Best performing session
  const bestSession = Object.entries(sessionStats).sort((a, b) => b[1].totalPL - a[1].totalPL)[0]
  
  // Streak analysis
  let currentStreak = 0
  let longestWinStreak = 0
  let longestLoseStreak = 0
  trades.forEach(trade => {
    if (trade.profit_loss >= 0) {
      currentStreak = currentStreak >= 0 ? currentStreak + 1 : 1
      longestWinStreak = Math.max(longestWinStreak, currentStreak)
    } else {
      currentStreak = currentStreak <= 0 ? currentStreak - 1 : -1
      longestLoseStreak = Math.max(longestLoseStreak, Math.abs(currentStreak))
    }
  })

  // Revenge trading detection (trades after a loss)
  const revengeTrades = trades.filter((trade, index) => {
    if (index === 0) return false
    const prevTrade = trades[index - 1]
    const timeDiff = new Date(trade.open_time).getTime() - new Date(prevTrade.close_time).getTime()
    return prevTrade.profit_loss < 0 && timeDiff < 3600000 && trade.profit_loss < 0 // Within 1 hour after loss
  })

  return (
    <div className="space-y-6">
      {!isPro ? (
        <Card className="bg-gradient-to-br from-purple-500/10 to-violet-500/10 border-purple-500/30">
          <CardContent className="py-8 text-center">
            <motion.div
              animate={{ scale: [1, 1.1, 1] }}
              transition={{ duration: 2, repeat: Infinity }}
            >
              <Lock className="w-12 h-12 mx-auto mb-4 text-purple-400" />
            </motion.div>
            <h3 className="text-lg font-bold text-purple-400 mb-2">Psychology Tracking - PRO Feature</h3>
            <p className="text-gray-400 mb-4">Track your emotional patterns and improve trading discipline</p>
            <Button onClick={onUpgrade} className="bg-gradient-to-r from-purple-500 to-violet-600">
              <Zap className="w-4 h-4 mr-2" /> Upgrade to PRO
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-6">
          {/* Psychology Score */}
          <Card className="bg-gradient-to-br from-[#0f0b18] to-[#12091a] border-purple-900/30">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg">
                <Heart className="w-5 h-5 text-pink-400" />
                Trading Psychology Analysis
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
                <div className="p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/20">
                  <div className="text-sm text-gray-400 mb-1">Win Streak</div>
                  <div className="text-2xl font-bold text-emerald-400">{longestWinStreak}</div>
                  <p className="text-xs text-gray-500 mt-1">Best consecutive wins</p>
                </div>
                <div className="p-4 rounded-xl bg-red-500/10 border border-red-500/20">
                  <div className="text-sm text-gray-400 mb-1">Lose Streak</div>
                  <div className="text-2xl font-bold text-red-400">{longestLoseStreak}</div>
                  <p className="text-xs text-gray-500 mt-1">Worst consecutive losses</p>
                </div>
                <div className="p-4 rounded-xl bg-purple-500/10 border border-purple-500/20">
                  <div className="text-sm text-gray-400 mb-1">Best Session</div>
                  <div className="text-xl font-bold text-purple-400">{bestSession?.[0] || '-'}</div>
                  <p className="text-xs text-gray-500 mt-1">{bestSession ? `+${bestSession[1].totalPL.toFixed(0)} P/L` : ''}</p>
                </div>
                <div className="p-4 rounded-xl bg-purple-500/10 border border-purple-500/20">
                  <div className="text-sm text-gray-400 mb-1">Revenge Trades</div>
                  <div className="text-2xl font-bold text-purple-400">{revengeTrades.length}</div>
                  <p className="text-xs text-gray-500 mt-1">Trades within 1hr after loss</p>
                </div>
              </div>

              {/* Session Psychology */}
              <h4 className="font-semibold mb-3 flex items-center gap-2">
                <Clock className="w-4 h-4 text-purple-400" />
                Session Performance Psychology
              </h4>
              <div className="space-y-2">
                {Object.entries(sessionStats).map(([session, stats]) => {
                  const winRate = ((stats.wins / (stats.wins + stats.losses)) * 100) || 0
                  const isProfitable = stats.totalPL >= 0
                  return (
                    <div key={session} className="flex items-center justify-between p-3 rounded-lg bg-white/5 border border-purple-900/30">
                      <div className="flex items-center gap-3">
                        <div className={`w-3 h-3 rounded-full ${isProfitable ? 'bg-emerald-400' : 'bg-red-400'}`} />
                        <span className="font-medium">{session}</span>
                      </div>
                      <div className="flex items-center gap-4 text-sm">
                        <span className="text-gray-400">{stats.wins + stats.losses} trades</span>
                        <span className={`font-bold ${isProfitable ? 'text-emerald-400' : 'text-red-400'}`}>
                          {isProfitable ? '+' : ''}{stats.totalPL.toFixed(0)}
                        </span>
                        <div className="w-16">
                          <Progress value={winRate} className="h-2" />
                          <span className="text-xs text-gray-500">{winRate.toFixed(0)}% WR</span>
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>

              {/* Trading Tips */}
              {trades.length > 0 && (
                <div className="mt-6 p-4 rounded-xl bg-gradient-to-r from-cyan-500/10 to-blue-500/10 border border-cyan-500/20">
                  <h4 className="font-semibold text-cyan-400 mb-2 flex items-center gap-2">
                    <Brain className="w-4 h-4" />
                    Psychology Tips
                  </h4>
                  <ul className="text-sm text-gray-300 space-y-2">
                    {revengeTrades.length > 2 && (
                      <li className="flex items-start gap-2">
                        <AlertTriangle className="w-4 h-4 text-purple-400 mt-0.5" />
                        <span>Consider taking a break after a loss. You have {revengeTrades.length} potential revenge trades.</span>
                      </li>
                    )}
                    {bestSession && (
                      <li className="flex items-start gap-2">
                        <Target className="w-4 h-4 text-emerald-400 mt-0.5" />
                        <span>Your best session is <strong>{bestSession[0]}</strong>. Consider focusing more trades during this time.</span>
                      </li>
                    )}
                    {longestLoseStreak > 3 && (
                      <li className="flex items-start gap-2">
                        <AlertCircle className="w-4 h-4 text-red-400 mt-0.5" />
                        <span>Your longest losing streak is {longestLoseStreak}. Consider reducing position size during drawdowns.</span>
                      </li>
                    )}
                    {trades.length >= 5 && (
                      <li className="flex items-start gap-2">
                        <Sparkles className="w-4 h-4 text-purple-400 mt-0.5" />
                        <span>Keep tracking your trades to unlock more personalized psychology insights.</span>
                      </li>
                    )}
                  </ul>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  )
}

// ==================== HEATMAP TAB ====================
function HeatmapTab({ isPro, onUpgrade, trades }: { isPro: boolean; onUpgrade: () => void; trades: Trade[] }) {
  // Calculate heatmap data by day and session
  const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
  const sessions = ['Asia', 'London', 'New York', 'Off-Market']
  
  const heatmapData = trades.reduce((acc, trade) => {
    const day = new Date(trade.open_time).getDay()
    const session = trade.session || 'Off-Market'
    const key = `${day}-${session}`
    if (!acc[key]) {
      acc[key] = { totalPL: 0, count: 0 }
    }
    acc[key].totalPL += trade.profit_loss
    acc[key].count++
    return acc
  }, {} as Record<string, { totalPL: number; count: number }>)

  // Find max/min for color scaling
  const values = Object.values(heatmapData).map(d => d.totalPL)
  const maxPL = Math.max(...values, 1)
  const minPL = Math.min(...values, -1)
  const range = maxPL - minPL || 1

  const getCellColor = (totalPL: number) => {
    if (totalPL === 0) return 'bg-white/5'
    const intensity = (totalPL - minPL) / range
    if (totalPL > 0) {
      const opacity = Math.min(intensity * 2, 1)
      return `bg-emerald-500/[${Math.round(opacity * 40 + 10)}]`
    } else {
      const opacity = Math.min((1 - intensity) * 2, 1)
      return `bg-red-500/[${Math.round(opacity * 40 + 10)}]`
    }
  }

  // Symbol performance
  const symbolStats = trades.reduce((acc, trade) => {
    if (!acc[trade.symbol]) {
      acc[trade.symbol] = { wins: 0, losses: 0, totalPL: 0, count: 0 }
    }
    acc[trade.symbol].count++
    acc[trade.symbol].totalPL += trade.profit_loss
    if (trade.profit_loss >= 0) acc[trade.symbol].wins++
    else acc[trade.symbol].losses++
    return acc
  }, {} as Record<string, { wins: number; losses: number; totalPL: number; count: number }>)

  const topSymbols = Object.entries(symbolStats)
    .sort((a, b) => b[1].totalPL - a[1].totalPL)
    .slice(0, 6)

  return (
    <div className="space-y-6">
      {!isPro ? (
        <Card className="bg-gradient-to-br from-purple-500/10 to-violet-500/10 border-purple-500/30">
          <CardContent className="py-8 text-center">
            <motion.div
              animate={{ scale: [1, 1.1, 1] }}
              transition={{ duration: 2, repeat: Infinity }}
            >
              <Lock className="w-12 h-12 mx-auto mb-4 text-purple-400" />
            </motion.div>
            <h3 className="text-lg font-bold text-purple-400 mb-2">Market Heatmap - PRO Feature</h3>
            <p className="text-gray-400 mb-4">Visualize market strength across all pairs</p>
            <Button onClick={onUpgrade} className="bg-gradient-to-r from-purple-500 to-violet-600">
              <Zap className="w-4 h-4 mr-2" /> Upgrade to PRO
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-6">
          {/* Day/Session Heatmap */}
          <Card className="bg-gradient-to-br from-[#0f0b18] to-[#12091a] border-purple-900/30">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg">
                <Grid3X3 className="w-5 h-5 text-purple-400" />
                Performance Heatmap
              </CardTitle>
            </CardHeader>
            <CardContent>
              {/* Heatmap Grid */}
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr>
                      <th className="p-2 text-left text-gray-400">Day / Session</th>
                      {sessions.map(s => (
                        <th key={s} className="p-2 text-center text-gray-400">{s}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {dayNames.map((day, dayIndex) => (
                      <tr key={day}>
                        <td className="p-2 text-gray-300 font-medium">{day}</td>
                        {sessions.map(session => {
                          const key = `${dayIndex}-${session}`
                          const data = heatmapData[key]
                          const pl = data?.totalPL || 0
                          const intensity = range > 0 ? Math.abs(pl - minPL) / range : 0
                          
                          return (
                            <td key={key} className="p-1">
                              <div 
                                className={`w-full h-12 rounded-lg flex flex-col items-center justify-center cursor-pointer transition-all hover:scale-105 ${
                                  pl > 0 
                                    ? `bg-emerald-500/30` 
                                    : pl < 0 
                                      ? `bg-red-500/30` 
                                      : 'bg-white/5'
                                }`}
                                style={{
                                  backgroundColor: pl > 0 
                                    ? `rgba(16, 185, 129, ${0.1 + intensity * 0.5})` 
                                    : pl < 0 
                                      ? `rgba(239, 68, 68, ${0.1 + intensity * 0.5})`
                                      : 'rgba(255,255,255,0.05)'
                                }}
                              >
                                {data && (
                                  <>
                                    <span className={`font-bold ${pl >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                                      {pl >= 0 ? '+' : ''}{pl.toFixed(0)}
                                    </span>
                                    <span className="text-gray-400 text-[10px]">{data.count} trades</span>
                                  </>
                                )}
                              </div>
                            </td>
                          )
                        })}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Legend */}
              <div className="flex items-center justify-center gap-4 mt-4 text-xs text-gray-400">
                <div className="flex items-center gap-2">
                  <div className="w-4 h-4 rounded bg-red-500/30" />
                  <span>Loss</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-4 h-4 rounded bg-white/5" />
                  <span>No Data</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-4 h-4 rounded bg-emerald-500/30" />
                  <span>Profit</span>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Symbol Performance */}
          <Card className="bg-gradient-to-br from-[#0f0b18] to-[#12091a] border-purple-900/30">
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <BarChart3 className="w-5 h-5 text-purple-400" />
                Symbol Performance
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                {topSymbols.map(([symbol, stats]) => {
                  const winRate = ((stats.wins / stats.count) * 100).toFixed(0)
                  const isProfitable = stats.totalPL >= 0
                  return (
                    <div 
                      key={symbol}
                      className={`p-3 rounded-xl border ${isProfitable ? 'bg-emerald-500/10 border-emerald-500/20' : 'bg-red-500/10 border-red-500/20'}`}
                    >
                      <div className="flex items-center justify-between mb-2">
                        <span className="font-bold">{symbol}</span>
                        <span className={`text-sm font-bold ${isProfitable ? 'text-emerald-400' : 'text-red-400'}`}>
                          {isProfitable ? '+' : ''}{stats.totalPL.toFixed(0)}
                        </span>
                      </div>
                      <div className="flex items-center justify-between text-xs text-gray-400">
                        <span>{stats.count} trades</span>
                        <span>{winRate}% WR</span>
                      </div>
                    </div>
                  )
                })}
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  )
}

// ==================== CALENDAR TAB ====================
function CalendarTab({ trades, language }: { trades: Trade[]; language: string }) {
  const today = new Date()
  const daysInMonth = new Date(today.getFullYear(), today.getMonth() + 1, 0).getDate()
  const firstDayOfMonth = new Date(today.getFullYear(), today.getMonth(), 1).getDay()
  
  const days = Array.from({ length: daysInMonth }, (_, i) => i + 1)
  const emptyDays = Array.from({ length: firstDayOfMonth }, (_, i) => i)
  
  const tradesByDate = trades.reduce((acc, trade) => {
    const date = new Date(trade.open_time).getDate()
    acc[date] = (acc[date] || 0) + 1
    return acc
  }, {} as Record<number, number>)

  const monthNames = language === "id" 
    ? ["Januari", "Februari", "Maret", "April", "Mei", "Juni", "Juli", "Agustus", "September", "Oktober", "November", "Desember"]
    : ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"]
  
  const dayNames = language === "id" 
    ? ["Min", "Sen", "Sel", "Rab", "Kam", "Jum", "Sab"]
    : ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"]

  return (
    <div className="space-y-6">
      <Card className="bg-gradient-to-br from-[#0f0b18] to-[#12091a] border-purple-900/30">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Calendar className="w-5 h-5 text-purple-400" />
            {monthNames[today.getMonth()]} {today.getFullYear()}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-7 gap-1 text-center text-xs text-gray-500 mb-2">
            {dayNames.map(day => (
              <div key={day} className="py-2 font-medium">{day}</div>
            ))}
          </div>
          <div className="grid grid-cols-7 gap-1">
            {emptyDays.map((_, i) => (
              <div key={"empty-"+i} className="aspect-square" />
            ))}
            {days.map(day => {
              const tradeCount = tradesByDate[day] || 0
              const isToday = day === today.getDate()
              return (
                <motion.div
                  key={day}
                  whileHover={{ scale: 1.1 }}
                  className={"aspect-square flex items-center justify-center rounded-lg text-sm relative cursor-pointer " + (
                    isToday 
                      ? "bg-purple-500 text-white font-bold" 
                      : tradeCount > 0 
                        ? "bg-purple-500/20 text-purple-300" 
                        : "hover:bg-white/5"
                  )}
                >
                  {day}
                  {tradeCount > 0 && !isToday && (
                    <span className="absolute bottom-1 left-1/2 -translate-x-1/2 w-1.5 h-1.5 rounded-full bg-purple-400" />
                  )}
                </motion.div>
              )
            })}
          </div>
        </CardContent>
      </Card>
      
      <Card className="bg-gradient-to-br from-[#0f0b18] to-[#12091a] border-purple-900/30">
        <CardHeader>
          <CardTitle>{language === "id" ? "Aktivitas Bulan Ini" : "This Month Activity"}</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-3 gap-4 text-center">
            <div>
              <div className="text-3xl font-bold text-purple-400">{trades.length}</div>
              <div className="text-xs text-gray-500">{language === "id" ? "Total Transaksi" : "Total Trades"}</div>
            </div>
            <div>
              <div className="text-3xl font-bold text-emerald-400">{trades.filter(t => t.profit_loss >= 0).length}</div>
              <div className="text-xs text-gray-500">{language === "id" ? "Profit" : "Profit"}</div>
            </div>
            <div>
              <div className="text-3xl font-bold text-red-400">{trades.filter(t => t.profit_loss < 0).length}</div>
              <div className="text-xs text-gray-500">{language === "id" ? "Loss" : "Loss"}</div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

// ==================== RISK CALCULATOR TAB ====================
function RiskCalculatorTab({ isPro, onUpgrade, language }: { isPro: boolean; onUpgrade: () => void; language: string }) {
  const [accountBalance, setAccountBalance] = useState(10000)
  const [riskPercent, setRiskPercent] = useState(2)
  const [stopLossPips, setStopLossPips] = useState(50)
  const [pipValue, setPipValue] = useState(10)

  const riskAmount = (accountBalance * riskPercent) / 100
  const lotSize = stopLossPips > 0 ? riskAmount / (stopLossPips * pipValue) : 0

  if (!isPro) {
    return (
      <Card className="bg-gradient-to-br from-purple-500/10 to-violet-500/10 border-purple-500/30">
        <CardContent className="py-8 text-center">
          <motion.div animate={{ scale: [1, 1.1, 1] }} transition={{ duration: 2, repeat: Infinity }}>
            <Lock className="w-12 h-12 mx-auto mb-4 text-purple-400" />
          </motion.div>
          <h3 className="text-lg font-bold text-purple-400 mb-2">{language === "id" ? "Kalkulator Risiko - Fitur PRO" : "Risk Calculator - PRO Feature"}</h3>
          <p className="text-gray-400 mb-4">{language === "id" ? "Hitung ukuran lot optimal dengan presisi" : "Calculate optimal lot size with precision"}</p>
          <Button onClick={onUpgrade} className="bg-gradient-to-r from-purple-500 to-violet-600">
            <Zap className="w-4 h-4 mr-2" /> {language === "id" ? "Upgrade ke PRO" : "Upgrade to PRO"}
          </Button>
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="space-y-6">
      <Card className="bg-gradient-to-br from-[#0f0b18] to-[#12091a] border-purple-900/30">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Target className="w-5 h-5 text-purple-400" />
            {language === "id" ? "Kalkulator Risiko" : "Risk Calculator"}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Label>{language === "id" ? "Saldo Akun ($)" : "Account Balance ($)"}</Label>
            <Input type="number" value={accountBalance} onChange={(e) => setAccountBalance(Number(e.target.value))} className="bg-white/5 border-purple-900/30" />
          </div>
          <div>
            <Label>{language === "id" ? "Risiko per Trade (%)" : "Risk per Trade (%)"}</Label>
            <Input type="number" value={riskPercent} onChange={(e) => setRiskPercent(Number(e.target.value))} className="bg-white/5 border-purple-900/30" />
          </div>
          <div>
            <Label>{language === "id" ? "Stop Loss (Pips)" : "Stop Loss (Pips)"}</Label>
            <Input type="number" value={stopLossPips} onChange={(e) => setStopLossPips(Number(e.target.value))} className="bg-white/5 border-purple-900/30" />
          </div>
          <div>
            <Label>{language === "id" ? "Nilai per Pip ($)" : "Pip Value ($)"}</Label>
            <Input type="number" value={pipValue} onChange={(e) => setPipValue(Number(e.target.value))} className="bg-white/5 border-purple-900/30" />
          </div>
        </CardContent>
      </Card>

      <Card className="bg-gradient-to-br from-purple-500/10 to-violet-500/10 border-purple-500/30">
        <CardContent className="py-6">
          <div className="grid grid-cols-2 gap-4 text-center">
            <div>
              <div className="text-xs text-gray-500 mb-1">{language === "id" ? "Risiko Maksimal" : "Max Risk"}</div>
              <div className="text-2xl font-bold text-red-400">${riskAmount.toFixed(2)}</div>
            </div>
            <div>
              <div className="text-xs text-gray-500 mb-1">{language === "id" ? "Ukuran Lot" : "Lot Size"}</div>
              <div className="text-2xl font-bold text-emerald-400">{lotSize.toFixed(2)}</div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

// ==================== TARGETS TAB ====================
function TargetsTab({ isPro, onUpgrade, language }: { isPro: boolean; onUpgrade: () => void; language: string }) {
  const targets = [
    { id: 1, name: language === "id" ? "Target Harian" : "Daily Target", target: 100, current: 75, unit: "$" },
    { id: 2, name: language === "id" ? "Target Mingguan" : "Weekly Target", target: 500, current: 320, unit: "$" },
    { id: 3, name: language === "id" ? "Target Bulanan" : "Monthly Target", target: 2000, current: 1450, unit: "$" },
    { id: 4, name: language === "id" ? "Target Win Rate" : "Win Rate Target", target: 70, current: 75, unit: "%" },
  ]

  if (!isPro) {
    return (
      <Card className="bg-gradient-to-br from-purple-500/10 to-violet-500/10 border-purple-500/30">
        <CardContent className="py-8 text-center">
          <motion.div animate={{ scale: [1, 1.1, 1] }} transition={{ duration: 2, repeat: Infinity }}>
            <Lock className="w-12 h-12 mx-auto mb-4 text-purple-400" />
          </motion.div>
          <h3 className="text-lg font-bold text-purple-400 mb-2">{language === "id" ? "Target - Fitur PRO" : "Targets - PRO Feature"}</h3>
          <p className="text-gray-400 mb-4">{language === "id" ? "Tetapkan dan lacak target trading Anda" : "Set and track your trading goals"}</p>
          <Button onClick={onUpgrade} className="bg-gradient-to-r from-purple-500 to-violet-600">
            <Zap className="w-4 h-4 mr-2" /> {language === "id" ? "Upgrade ke PRO" : "Upgrade to PRO"}
          </Button>
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="space-y-4">
      {targets.map((target) => {
        const percentage = Math.min((target.current / target.target) * 100, 100)
        const isCompleted = target.current >= target.target

        return (
          <motion.div key={target.id} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
            <Card className={"bg-gradient-to-br from-[#0f0b18] to-[#12091a] border-purple-900/30 " + (isCompleted ? "border-emerald-500/50" : "")}>
              <CardContent className="py-4">
                <div className="flex items-center justify-between mb-2">
                  <span className="font-medium">{target.name}</span>
                  <span className={"text-sm font-bold " + (isCompleted ? "text-emerald-400" : "text-purple-400")}>
                    {target.unit === "$" ? "$" : ""}{target.current}{target.unit !== "$" ? target.unit : ""} / {target.unit === "$" ? "$" : ""}{target.target}{target.unit !== "$" ? target.unit : ""}
                  </span>
                </div>
                <Progress value={percentage} className="h-2" />
                <div className="flex items-center justify-between mt-1">
                  <span className="text-xs text-gray-500">{percentage.toFixed(0)}%</span>
                  {isCompleted && (
                    <Badge className="bg-emerald-500/20 text-emerald-400 border-emerald-500/30">
                      ✓ {language === "id" ? "Tercapai" : "Completed"}
                    </Badge>
                  )}
                </div>
              </CardContent>
            </Card>
          </motion.div>
        )
      })}
    </div>
  )
}

