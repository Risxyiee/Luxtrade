'use client'

export const dynamic = 'force-dynamic'

import { useState, useEffect, useCallback } from 'react'
import dynamicImport from 'next/dynamic'
import { useRouter } from 'next/navigation'
import '@/lib/error-handler' // Global error handler
import {
  TrendingUp, TrendingDown, Plus, BarChart3, BookOpen,
  Eye, Brain, Menu, X, DollarSign, Target,
  Activity, PieChart, Sparkles, AlertTriangle,
  Zap, RefreshCw, LogOut, CalendarDays, Upload, Edit, Trash2, Eye as ViewIcon, Calendar, Clock,
  Smile, Meh, Frown, Sun, Moon, Cloud, AlertCircle, Search, Send, MessageSquare, MessageCircle, Bot, User,
  TrendingUp as TrendingUpIcon, Loader2, Settings, Bell, HelpCircle, Lock, Heart, Grid3X3, CircleDot, FileText, Share2, Download, Shield, Crown, AlertCircle as AlertCircleIcon, Camera, Gift, Trophy, Flame, ExternalLink, Newspaper
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
import { useLanguage } from '@/contexts/LanguageContext'
import PaymentModal from '@/components/PaymentModal'
import PlanSelectionModal from '@/components/PlanSelectionModal'
import PNLShareCard from '@/components/PNLShareCard'
import TradingScore from '@/components/TradingScore'
import AIWeeklyReport from '@/components/AIWeeklyReport'
import TradingStreaks from '@/components/TradingStreaks'
import NotificationCenter from '@/components/NotificationCenter'
import ActivityFeed from '@/components/ActivityFeed'
import QuickStats from '@/components/QuickStats'
import WelcomeOnboarding from '@/components/WelcomeOnboarding'
import { formatCurrency } from '@/lib/supabase'
import { ChartErrorBoundary } from '@/components/ChartErrorBoundary'
import AchievementCenter from '@/components/AchievementCenter'
import PaywallModal from '@/components/PaywallModal'

// Extracted Tab Components
import DashboardTab from './tabs/DashboardTab'
import TradesTab from './tabs/TradesTab'
import JournalTab from './tabs/JournalTab'
import WatchlistTab from './tabs/WatchlistTab'
import AnalyticsTab from './tabs/AnalyticsTab'
import AITab from './tabs/AITab'
import PsychologyTab from './tabs/PsychologyTab'
import HeatmapTab from './tabs/HeatmapTab'
import CalendarTab from './tabs/CalendarTab'
import RiskCalculatorTab from './tabs/RiskCalculatorTab'
import TargetsTab from './tabs/TargetsTab'
import MarketNewsTab from './tabs/MarketNewsTab'
import EconomicCalendarTab from './tabs/EconomicCalendarTab'

// Extracted Components
import TradeForm from './components/TradeForm'
import AnimatedStatCard from './components/AnimatedStatCard'
import Sidebar from './components/Sidebar'
import Header from './components/Header'
import DashboardModals from './components/DashboardModals'
import TabContent from './components/TabContent'

// Extracted Utils & Hooks
import { Trade, JournalEntry, WatchlistItem, Analytics, TradeFormData, MTReportPreview, emptyFormData } from './utils/types'
import { formatLocalDateTime, datetimeLocalToFormat, moodOptions, marketConditions } from './utils/helpers'
import { useCountUp } from './hooks/useCountUp'
import { parseMT4HTML } from './utils/parseMT4HTML'
import { parseCSV, fileToBase64 } from './utils/importUtils'

// Extracted Handlers
import { createTradeHandlers } from './handlers/tradeHandlers'
import { createJournalHandlers } from './handlers/journalHandlers'
import { createWatchlistHandlers } from './handlers/watchlistHandlers'
import { createImportHandlers } from './handlers/importHandlers'


// ==================== EXTRACTED INTERFACES MOVED TO utils/types.ts ====================


// ==================== EXTRACTED HOOKS MOVED TO hooks/useCountUp.ts ====================

// ==================== MENU CONFIG (Used by Sidebar and Header) ====================

const menuItems = [
  { id: 'dashboard', label: 'Dashboard', labelId: 'Dasbor' },
  { id: 'trades', label: 'Trades', labelId: 'Transaksi' },
  { id: 'calendar', label: 'Calendar', labelId: 'Kalender' },
  { id: 'journal', label: 'Journal', labelId: 'Jurnal' },
  { id: 'watchlist', label: 'Watchlist', labelId: 'Daftar Pantauan' },
  { id: 'news', label: 'Market News', labelId: 'Berita Pasar' },
  { id: 'economic-calendar', label: 'Economic Calendar', labelId: 'Kalender Ekonomi' },
  { id: 'achievements', label: 'Achievements', labelId: 'Pencapaian' },
  { id: 'risk', label: 'Risk Calculator', labelId: 'Kalkulator Risiko' },
  { id: 'heatmap', label: 'Market Heatmap', labelId: 'Pasar Heatmap' },
  { id: 'analytics', label: 'Analytics', labelId: 'Analitik' },
  { id: 'targets', label: 'Targets', labelId: 'Target' },
  { id: 'ai', label: 'AI Insights', labelId: 'Insight AI' },
  { id: 'score', label: 'Trading Score', labelId: 'Skor Trading' },
  { id: 'report', label: 'Weekly Report', labelId: 'Laporan Mingguan' },
  { id: 'streaks', label: 'Streaks', labelId: 'Streak' },
  { id: 'psychology', label: 'Psychology Tracking', labelId: 'Psikologi' },
]


// ==================== EXTRACTED UTILS MOVED TO utils/helpers.ts ====================

// ==================== EXTRACTED TradeForm MOVED TO components/TradeForm.tsx ====================

// ==================== EXTRACTED parseMT4HTML MOVED TO utils/parseMT4HTML.ts ====================

// ==================== MAIN COMPONENT ====================

export default function LuxTradeDashboard() {
  // CSR Force - Prevent hydration issues by only rendering after mount
  const [hasMounted, setHasMounted] = useState(false)

  // Force CSR - Only render after component has mounted on client
  useEffect(() => {
    try {
      console.log('🔵 [DIAGNOSTIC] useEffect mounting - START')
      setHasMounted(true)
      console.log('🟢 [DIAGNOSTIC] CLIENT_MOUNTED - setHasMounted(true) called')
    } catch (error) {
      console.error('🔴 [DIAGNOSTIC] Error setting hasMounted:', error)
      // Force set to true even if there's an error to prevent black screen
      setTimeout(() => {
        setHasMounted(true)
        console.log('🟡 [DIAGNOSTIC] CLIENT_MOUNTED - fallback timeout triggered')
      }, 100)
    }
  }, [])

  // Show loading screen while mounting - prevents hydration issues
  if (!hasMounted) {
    console.log('🟠 [DIAGNOSTIC] hasMounted is FALSE, showing boot screen')
    return (
      <div className="min-h-screen bg-[#0a0712] flex items-center justify-center" suppressHydrationWarning={true}>
        <div className="text-center">
          <Loader2 className="w-10 h-10 text-purple-500 animate-spin mx-auto mb-4" />
          <p className="text-white/60 text-sm">Loading dashboard...</p>
        </div>
      </div>
    )
  }

  console.log('✅ [DIAGNOSTIC] hasMounted is TRUE, rendering LuxTradeDashboardContent')

  // Render content component only after mounting
  return <LuxTradeDashboardContent />
}

// ==================== INNER COMPONENT - SAFE TO USE HOOKS ====================
// This component is only rendered after hasMounted === true, so it's safe to use hooks

function LuxTradeDashboardContent() {
  // NOW we can safely use useLanguage hook!
  const { language } = useLanguage()
  
  // All other states and logic
  const [activeTab, setActiveTab] = useState('dashboard')
  const [sidebarOpen, setSidebarOpen] = useState(true)
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false)
  
  // Trade modals
  const [addTradeOpen, setAddTradeOpen] = useState(false)
  const [editTradeOpen, setEditTradeOpen] = useState(false)
  const [deleteTradeOpen, setDeleteTradeOpen] = useState(false)
  const [viewTradeOpen, setViewTradeOpen] = useState(false)
  const [paymentModalOpen, setPaymentModalOpen] = useState(false)
  const [planSelectionModalOpen, setPlanSelectionModalOpen] = useState(false)
  const [shareCardOpen, setShareCardOpen] = useState(false)
  const [paywallModalOpen, setPaywallModalOpen] = useState(false)

  // PRO trial counter - 3x for Free users
  const [proTrialCount, setProTrialCount] = useState(3)
  const MAX_PRO_TRIALS = 3

  const { user, profile, session, signOut, loading: authLoading, isPro: authIsPro, isAdmin } = useAuth()
  const router = useRouter()
  const [isMobile, setIsMobile] = useState(false)

  // PRO status from auth context (includes subscription_until check)
  const isPro = authIsPro || false
  
  // Auth state management with timeout
  const [authChecked, setAuthChecked] = useState(false)
  
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
  
  // Onboarding state
  const [showOnboarding, setShowOnboarding] = useState(false)
  
  // Animation states
  const [chartAnimated, setChartAnimated] = useState(false)
  
  // Helper: Check if user can access PRO features
  const checkProAccess = useCallback((featureName: string = 'Fitur Premium'): boolean => {
    // PRO users have unlimited access
    if (isPro || false) return true

    // Free users with remaining trials
    if (proTrialCount > 0) {
      return true // Allow access, will decrement counter
    }

    // No trials left - show paywall
    setPaywallModalOpen(true)
    return false
  }, [isPro, proTrialCount, setPaywallModalOpen])

  // Helper: Decrement trial counter after using PRO feature
  const useProTrial = useCallback(() => {
    if (!isPro && proTrialCount > 0) {
      const newCount = proTrialCount - 1
      setProTrialCount(newCount)

      // Save to localStorage for persistence
      localStorage.setItem('luxtrade_pro_trial_count', newCount.toString())

      // Show warning if running low
      if (newCount === 1) {
        toast.warning(`⚠️ Sisa 1 kali uji coba fitur PRO! Upgrade untuk akses unlimited.`)
      } else if (newCount === 0) {
        toast.error(`🔒 Kuota uji coba habis! Upgrade ke PRO untuk akses penuh.`)
        setTimeout(() => setPaywallModalOpen(true), 1000)
      }
    }
  }, [isPro, proTrialCount, setPaywallModalOpen])

  // Load trial count from localStorage on mount
  useEffect(() => {
    const savedTrialCount = localStorage.getItem('luxtrade_pro_trial_count')
    if (savedTrialCount) {
      const count = parseInt(savedTrialCount, 10)
      if (!isNaN(count) && count >= 0) {
        setProTrialCount(Math.min(count, MAX_PRO_TRIALS))
      }
    }

    // Show PaywallModal with guide for new users on first dashboard visit
    const hasSeenGuide = localStorage.getItem('luxtrade_seen_payment_guide')
    if (!isPro && !hasSeenGuide) {
      setTimeout(() => {
        setPaywallModalOpen(true)
        localStorage.setItem('luxtrade_seen_payment_guide', 'true')
      }, 2000) // Show after 2 seconds to let user settle in
    }
  }, [isPro, setPaywallModalOpen])

  
  const handleSelectPlan = (plan: any) => {
    setPlanSelectionModalOpen(false)
    // For free plan, just close modal
    if (plan.price === 0) {
      toast.success('You are using Free plan!')
      return
    }
    // For paid plans, open payment modal
    setPlanSelectionModalOpen(true)
  }

  useEffect(() => {
    const checkMobile = () => {
      const userAgent = navigator.userAgent || ''
      const screenWidth = window.innerWidth
      const isMobileCheck = /android|iphone|ipad|mobile/i.test(userAgent) || screenWidth < 768
      setIsMobile(isMobileCheck)
    }

    checkMobile()
    const handleResize = () => checkMobile()
    window.addEventListener('resize', handleResize)
    return () => window.removeEventListener('resize', handleResize)
  }, [])

  
  // Helper: Get auth header for API calls
  const getAuthHeaders = useCallback(() => {
    const headers: Record<string, string> = { 'Content-Type': 'application/json' }
    if (session?.access_token) {
      headers['Authorization'] = `Bearer ${session.access_token}`
    }
    return headers
  }, [session?.access_token])

  // Free user trade limit
  const FREE_TRADE_LIMIT = 5
  const isFreeUser = !isPro
  const tradeCount = trades.length
  const canAddTrade = isPro || false || tradeCount < FREE_TRADE_LIMIT

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
  }, [])

  useEffect(() => {
    console.log('🔵 [DIAGNOSTIC] Auth useEffect - START')
    console.log('🟠 [DIAGNOSTIC] AUTH_STATE:', { user, authLoading })

    // Give auth some time to load
    const timeoutId = setTimeout(() => {
      console.log('⚠️ [DIAGNOSTIC] Auth timeout - No user after loading')
      if (!user && !authLoading) {
        // No user after loading complete, redirect to login
        window.location.href = '/auth/login'
      }
    }, 1000)

    if (!authLoading) {
      setAuthChecked(true)
      console.log('✅ [DIAGNOSTIC] Auth loading complete')
      if (user) {
        console.log('✅ [DIAGNOSTIC] User found, fetching data')
        fetchData()
      }
    }

    return () => clearTimeout(timeoutId)
  }, [authLoading, user, fetchData])

  // Check onboarding for first-time users
  useEffect(() => {
    const onboardingDone = localStorage.getItem('luxtrade_onboarding_done')
    if (!onboardingDone && trades.length === 0) {
      const timer = setTimeout(() => setShowOnboarding(true), 1500)
      return () => clearTimeout(timer)
    }
  }, [trades.length])

  // ==================== CREATE ALL HANDLERS ====================
  
  // Trade Handlers
  const {
    handleAddTrade,
    handleEditTrade,
    handleDeleteTrade,
    openEditModal,
    openViewModal,
    openDeleteModal
  } = createTradeHandlers({
    formData,
    setFormData,
    selectedTrade,
    setSelectedTrade,
    trades,
    setTrades,
    setAddTradeOpen,
    setEditTradeOpen,
    setDeleteTradeOpen,
    setViewTradeOpen,
    saving,
    setSaving,
    setPlanSelectionModalOpen,
    isFreeUser,
    FREE_TRADE_LIMIT,
    getAuthHeaders,
    fetchData
  })

  // Journal Handlers
  const {
    handleAddJournal,
    handleDeleteJournal
  } = createJournalHandlers({
    journalForm,
    setJournalForm,
    addJournalOpen,
    setAddJournalOpen,
    saving,
    setSaving,
    fetchData
  })

  // Watchlist Handlers
  const {
    handleAddWatchlist,
    handleDeleteWatchlist
  } = createWatchlistHandlers({
    watchlistForm,
    setWatchlistForm,
    addWatchlistOpen,
    setAddWatchlistOpen,
    saving,
    setSaving,
    fetchData
  })

  // Import Handlers
  const {
    handleCsvFileChange,
    handleCsvImport,
    handleSmartImport,
    handleSmartImportSave,
    handleScreenshotUpload,
    handleFileUpload,
    handleSaveImportedTrades
  } = createImportHandlers({
    csvFile,
    setCsvFile,
    csvPreview,
    setCsvPreview,
    csvImporting,
    setCsvImporting,
    csvImportOpen,
    setCsvImportOpen,
    smartImportOpen,
    setSmartImportOpen,
    smartImportPreview,
    setSmartImportPreview,
    smartImportFile,
    setSmartImportFile,
    smartImportParsing,
    setSmartImportParsing,
    importTab,
    setImportTab,
    screenshotPreview,
    setScreenshotPreview,
    importedTrades,
    setImportedTrades,
    importParsing,
    setImportParsing,
    updateImportedTrade,
    removeImportedTrade,
    isPro,
    setPlanSelectionModalOpen,
    getAuthHeaders,
    fetchData
  })

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
      if (res.ok && data.insight) {
        setAiInsight(data.insight)
      } else {
        toast.error(data.error || 'Gagal mendapatkan insight. Coba lagi nanti.')
      }
    } catch {
      toast.error('Koneksi AI gagal. Coba lagi nanti.')
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
      toast.error('Gagal mendapatkan insight pasar. Coba lagi nanti.')
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

  const handleSignOut = async () => {
    await signOut()
    router.push('/')
  }

  // User initials with hydration safety check
  const userInitials = profile?.full_name
    ? profile.full_name.split(' ').map((n: string) => n[0]).join('').toUpperCase().slice(0, 2)
    : user?.email?.[0]?.toUpperCase() || 'D'

  // Show auth loading state
  if ((authLoading || !authChecked)) {
    console.log('🟠 [DIAGNOSTIC] Auth loading/waiting, showing loading screen', { authLoading, authChecked })
    return (
      <div className="min-h-screen bg-[#0a0712] flex items-center justify-center" suppressHydrationWarning={true}>
        <div className="text-center">
          <Loader2 className="w-8 h-8 text-purple-500 animate-spin mx-auto mb-4" />
          <p className="text-white/60 text-sm">Loading...</p>
        </div>
      </div>
    )
  }

  console.log('✅ [DIAGNOSTIC] Auth checks passed, rendering main content')

  return (
    <div className="min-h-screen bg-[#0a0712] text-white flex" suppressHydrationWarning={true}>
      {/* Mobile Sidebar Overlay */}
      {mobileSidebarOpen && (
        <div
          className="fixed inset-0 bg-black/60 z-30 lg:hidden backdrop-blur-sm"
          onClick={() => setMobileSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <Sidebar
        sidebarOpen={sidebarOpen}
        setSidebarOpen={setSidebarOpen}
        mobileSidebarOpen={mobileSidebarOpen}
        setMobileSidebarOpen={setMobileSidebarOpen}
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        isPro={isPro}
        user={user}
        profile={profile}
        isAdmin={isAdmin}
        language={language}
        isFreeUser={isFreeUser}
        tradeCount={trades.length}
        FREE_TRADE_LIMIT={FREE_TRADE_LIMIT}
        setPlanSelectionModalOpen={setPlanSelectionModalOpen}
        userInitials={userInitials}
        handleSignOut={handleSignOut}
      />

      {/* Main Content */}
      <main className={`flex-1 overflow-auto transition-all duration-300 ${sidebarOpen ? 'lg:ml-64' : 'lg:ml-20'}`}>
        <Header
          sidebarOpen={sidebarOpen}
          setMobileSidebarOpen={setMobileSidebarOpen}
          activeTab={activeTab}
          menuItems={menuItems}
          loading={loading}
          fetchData={fetchData}
          trades={trades}
          isPro={isPro}
          formData={formData}
          handleFormChange={handleFormChange}
          handleFormTypeChange={handleFormTypeChange}
          handleFormSessionChange={handleFormSessionChange}
          handleNumberInput={handleNumberInput}
          handleAddTrade={handleAddTrade}
          setAddTradeOpen={setAddTradeOpen}
          addTradeOpen={addTradeOpen}
          saving={saving}
          setFormData={setFormData}
          emptyFormData={emptyFormData}
          setSmartImportOpen={setSmartImportOpen}
          user={user}
          handleSignOut={handleSignOut}
          userInitials={userInitials}
        />

        {/* Tab Content */}
        <TabContent
          activeTab={activeTab}
          trades={trades}
          analytics={analytics}
          journalEntries={journalEntries}
          watchlistItems={watchlistItems}
          loading={loading}
          aiInsight={aiInsight}
          aiLoading={aiLoading}
          aiChatMessages={aiChatMessages}
          aiChatInput={aiChatInput}
          setAddTradeOpen={setAddTradeOpen}
          setAddJournalOpen={setAddJournalOpen}
          setAddWatchlistOpen={setAddWatchlistOpen}
          setCsvImportOpen={setCsvImportOpen}
          setSmartImportOpen={setSmartImportOpen}
          setPlanSelectionModalOpen={setPlanSelectionModalOpen}
          onView={openViewModal}
          onEdit={openEditModal}
          onDelete={openDeleteModal}
          onJournalView={(entry) => { setSelectedJournal(entry); setViewJournalOpen(true) }}
          onJournalEdit={(entry) => { setSelectedJournal(entry); setEditJournalOpen(true) }}
          onJournalDelete={handleDeleteJournal}
          onWatchlistDelete={handleDeleteWatchlist}
          onGetTips={getPerformanceTips}
          onGetMarket={getMarketInsight}
          onChatChange={setAiChatInput}
          onSendChat={sendAiChat}
          isPro={isPro}
          language={language}
          user={user}
          profile={profile}
          chartAnimated={chartAnimated}
          hasMounted={true}
        />
      </main>

      {/* All Modals */}
      <DashboardModals
        // Modal states
        editTradeOpen={editTradeOpen}
        setEditTradeOpen={setEditTradeOpen}
        viewTradeOpen={viewTradeOpen}
        setViewTradeOpen={setViewTradeOpen}
        deleteTradeOpen={deleteTradeOpen}
        setDeleteTradeOpen={setDeleteTradeOpen}
        shareCardOpen={shareCardOpen}
        setShareCardOpen={setShareCardOpen}
        addJournalOpen={addJournalOpen}
        setAddJournalOpen={setAddJournalOpen}
        addWatchlistOpen={addWatchlistOpen}
        setAddWatchlistOpen={setAddWatchlistOpen}
        csvImportOpen={csvImportOpen}
        setCsvImportOpen={setCsvImportOpen}
        smartImportOpen={smartImportOpen}
        setSmartImportOpen={setSmartImportOpen}
        planSelectionModalOpen={planSelectionModalOpen}
        setPlanSelectionModalOpen={setPlanSelectionModalOpen}
        paymentModalOpen={paymentModalOpen}
        setPaymentModalOpen={setPaymentModalOpen}
        paywallModalOpen={paywallModalOpen}
        setPaywallModalOpen={setPaywallModalOpen}
        showOnboarding={showOnboarding}
        setShowOnboarding={setShowOnboarding}

        // Trade-related
        formData={formData}
        selectedTrade={selectedTrade}
        saving={saving}
        setFormData={setFormData}
        setSelectedTrade={setSelectedTrade}
        emptyFormData={emptyFormData}
        handleFormChange={handleFormChange}
        handleFormTypeChange={handleFormTypeChange}
        handleFormSessionChange={handleFormSessionChange}
        handleNumberInput={handleNumberInput}
        handleEditTrade={handleEditTrade}
        handleDeleteTrade={handleDeleteTrade}
        openEditModal={openEditModal}
        openDeleteModal={openDeleteModal}

        // Journal-related
        journalForm={journalForm}
        setJournalForm={setJournalForm}
        handleAddJournal={handleAddJournal}

        // Watchlist-related
        watchlistForm={watchlistForm}
        setWatchlistForm={setWatchlistForm}
        handleAddWatchlist={handleAddWatchlist}

        // CSV Import-related
        csvFile={csvFile}
        csvPreview={csvPreview}
        csvImporting={csvImporting}
        setCsvFile={setCsvFile}
        setCsvPreview={setCsvPreview}
        handleCsvFileChange={handleCsvFileChange}
        handleCsvImport={handleCsvImport}

        // Smart Import-related
        importTab={importTab}
        setImportTab={setImportTab}
        screenshotPreview={screenshotPreview}
        importedTrades={importedTrades}
        importParsing={importParsing}
        setScreenshotPreview={setScreenshotPreview}
        setImportedTrades={setImportedTrades}
        handleScreenshotUpload={handleScreenshotUpload}
        handleFileUpload={handleFileUpload}
        handleSaveImportedTrades={handleSaveImportedTrades}
        updateImportedTrade={updateImportedTrade}
        removeImportedTrade={removeImportedTrade}

        // User & Plan
        user={user}
        handleSelectPlan={handleSelectPlan}
        proTrialCount={proTrialCount}
        language={language}
      />
    </div>
  )
}
