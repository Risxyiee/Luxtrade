'use client'

import { useState, useEffect, useCallback, useRef, useMemo } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Progress } from '@/components/ui/progress'
import { Switch } from '@/components/ui/switch'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from '@/components/ui/dialog'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { authFetch } from '@/lib/api-fetch'
import { toast } from 'sonner'
import {
  Shield,
  AlertTriangle,
  TrendingUp,
  TrendingDown,
  Target,
  Calendar,
  Edit2,
  Trash2,
  Plus,
  RefreshCw,
  Crown,
  ChevronDown,
  Lock,
  Loader2,
  X,
  Zap,
  DollarSign,
  Percent,
  CheckCircle2,
  Bell,
  BellOff,
  Radio,
  Camera,
  Link2,
  Calculator,
  Info,
  Clock,
} from 'lucide-react'

// ==================== TYPES ====================

interface PropFirmTabProps {
  isPro: boolean
  onUpgrade: () => void
  language: 'id' | 'en'
  trades?: any[]
  hasMetaApi?: boolean
  hasWebhook?: boolean
}

interface PropFirmRule {
  id: string
  user_id: string
  firm_name: string
  challenge_size: number
  phase: number
  max_drawdown: number
  max_daily_drawdown: number
  daily_drawdown_type: 'relative' | 'absolute'
  profit_target: number | null
  profit_target_percent: number
  min_trading_days: number
  profit_split: number
  start_date: string
  account_id: string | null
  is_active: boolean
  is_violated: boolean
  current_drawdown: number
  current_daily_drawdown: number
  current_balance: number
  peak_balance: number
  progress_percent: number
  days_traded: number
  alert_threshold_warning: number
  alert_threshold_danger: number
  alert_push_enabled: boolean
  alert_webhook_enabled: boolean
  created_at: string
  updated_at: string
}

interface PropFirmTemplate {
  firm_name: string
  challenge_sizes: number[]
  max_drawdown: number
  max_daily_drawdown: number
  daily_drawdown_type: 'relative' | 'absolute'
  profit_target_phase1: number
  profit_target_phase2: number
  min_trading_days: number
  profit_split: number
  description: string
}

interface CalculationResult {
  challenge_size: number
  current_balance: number
  peak_balance: number
  current_pnl: number
  current_drawdown: number
  current_drawdown_percent: number
  max_drawdown: number
  max_drawdown_amount: number
  daily_pnl: number
  daily_starting_balance: number
  current_daily_drawdown: number
  current_daily_drawdown_percent: number
  max_daily_drawdown: number
  max_daily_drawdown_amount: number
  daily_drawdown_type: string
  profit_target: number
  progress_percent: number
  days_traded: number
  min_trading_days: number
  is_violated: boolean
  violation_reason: string | null
  phase: number
  firm_name: string
  profit_split: number
}

interface ChallengeFormData {
  firm_name: string
  challenge_size: number
  phase: number
  max_drawdown: number
  max_daily_drawdown: number
  daily_drawdown_type: 'relative' | 'absolute'
  profit_target: number | null
  profit_target_percent: number
  min_trading_days: number
  profit_split: number
  start_date: string
  account_id: string
}

// ==================== BILINGUAL TEXT ====================

const t = (key: string, language: 'id' | 'en'): string => {
  const texts: Record<string, Record<'id' | 'en', string>> = {
    title: { id: 'Early Warning System', en: 'Early Warning System' },
    subtitle: { id: 'LuxTrade memperingatkan SEBELUM Anda breach — prop firm ga kasih ini', en: 'LuxTrade warns you BEFORE you breach — prop firms don\'t give you this' },
    proFeature: { id: 'Prop Firm Tracker - Fitur PRO', en: 'Prop Firm Tracker - PRO Feature' },
    proDesc: { id: 'Pantau challenge, drawdown, dan profit target prop firm Anda', en: 'Track prop firm challenges, drawdown, and profit targets' },
    upgrade: { id: 'Upgrade ke PRO', en: 'Upgrade to PRO' },
    activeChallenges: { id: 'Challenge Aktif', en: 'Active Challenges' },
    noChallenges: { id: 'Belum ada challenge. Tambahkan challenge pertama Anda!', en: 'No challenges yet. Add your first challenge!' },
    addChallenge: { id: 'Tambah Challenge', en: 'Add Challenge' },
    editChallenge: { id: 'Edit Challenge', en: 'Edit Challenge' },
    deleteChallenge: { id: 'Hapus Challenge', en: 'Delete Challenge' },
    deleteConfirm: { id: 'Yakin ingin menghapus challenge ini?', en: 'Are you sure you want to delete this challenge?' },
    refresh: { id: 'Segarkan', en: 'Refresh' },
    firmName: { id: 'Nama Firm', en: 'Firm Name' },
    challengeSize: { id: 'Ukuran Challenge ($)', en: 'Challenge Size ($)' },
    phase: { id: 'Fase', en: 'Phase' },
    maxDrawdown: { id: 'Max Drawdown (%)', en: 'Max Drawdown (%)' },
    maxDailyDrawdown: { id: 'Max Daily Drawdown (%)', en: 'Max Daily Drawdown (%)' },
    dailyDdType: { id: 'Tipe Daily DD', en: 'Daily DD Type' },
    relative: { id: 'Relatif', en: 'Relative' },
    absolute: { id: 'Absolut', en: 'Absolute' },
    profitTarget: { id: 'Target Profit ($)', en: 'Profit Target ($)' },
    profitTargetPercent: { id: 'Target Profit (%)', en: 'Profit Target (%)' },
    minTradingDays: { id: 'Min. Hari Trading', en: 'Min. Trading Days' },
    profitSplit: { id: 'Profit Split (%)', en: 'Profit Split (%)' },
    startDate: { id: 'Tanggal Mulai', en: 'Start Date' },
    account: { id: 'Akun (opsional)', en: 'Account (optional)' },
    template: { id: 'Template Firm', en: 'Firm Template' },
    selectTemplate: { id: 'Pilih template...', en: 'Select template...' },
    custom: { id: 'Kustom', en: 'Custom' },
    cancel: { id: 'Batal', en: 'Cancel' },
    save: { id: 'Simpan', en: 'Save' },
    create: { id: 'Buat', en: 'Create' },
    drawdown: { id: 'Drawdown', en: 'Drawdown' },
    dailyDrawdown: { id: 'Daily Drawdown', en: 'Daily Drawdown' },
    profitProgress: { id: 'Progress Profit', en: 'Profit Progress' },
    currentPnl: { id: 'PnL Saat Ini', en: 'Current PnL' },
    daysTraded: { id: 'Hari Trading', en: 'Days Traded' },
    violation: { id: 'PELANGGARAN!', en: 'VIOLATION!' },
    violationWarning: { id: 'Mendekati batas!', en: 'Approaching limit!' },
    phase1: { id: 'Fase 1', en: 'Phase 1' },
    phase2: { id: 'Fase 2', en: 'Phase 2' },
    funded: { id: 'Funded', en: 'Funded' },
    maxDdAmount: { id: 'Maks DD ($)', en: 'Max DD ($)' },
    maxDailyDdAmount: { id: 'Maks Daily DD ($)', en: 'Max Daily DD ($)' },
    calculating: { id: 'Menghitung...', en: 'Calculating...' },
    loading: { id: 'Memuat...', en: 'Loading...' },
    fetchError: { id: 'Gagal memuat data prop firm', en: 'Failed to load prop firm data' },
    createSuccess: { id: 'Challenge berhasil dibuat!', en: 'Challenge created successfully!' },
    createError: { id: 'Gagal membuat challenge', en: 'Failed to create challenge' },
    updateSuccess: { id: 'Challenge berhasil diperbarui!', en: 'Challenge updated successfully!' },
    updateError: { id: 'Gagal memperbarui challenge', en: 'Failed to update challenge' },
    deleteSuccess: { id: 'Challenge berhasil dihapus', en: 'Challenge deleted' },
    deleteError: { id: 'Gagal menghapus challenge', en: 'Failed to delete challenge' },
    calcSuccess: { id: 'Data diperbarui', en: 'Data refreshed' },
    calcError: { id: 'Gagal menghitung', en: 'Failed to calculate' },
    ofTarget: { id: 'dari target', en: 'of target' },
    targetReached: { id: 'Target tercapai!', en: 'Target reached!' },
    daysMin: { id: 'hari (min.', en: 'days (min.' },
    ddMax: { id: 'dari maks', en: 'of max' },
    // ===== NEW: Early Warning System =====
    statusSafe: { id: '✅ Semua aman — DD di bawah 50% batas', en: '✅ All clear — DD below 50% of limit' },
    statusCaution: { id: '⚠️ Perhatian — DD mendekati batas (50-80%)', en: '⚠️ Caution — DD approaching limit (50-80%)' },
    statusDanger: { id: '🚨 BAHAYA — DD melebihi 80% batas! HENTI TRADING!', en: '🚨 DANGER — DD exceeds 80% of limit! STOP TRADING!' },
    statusBreached: { id: '❌ CHALLENGE GAGAL — DD melebihi batas prop firm', en: '❌ CHALLENGE FAILED — DD exceeded prop firm limit' },
    predictionTitle: { id: 'Kalkulator Prediksi DD', en: 'DD Prediction Calculator' },
    predictionDesc: { id: '"Kalau saya loss $X di trade berikutnya..."', en: '"If I lose $X on the next trade..."' },
    predictionInput: { id: 'Loss amount ($)', en: 'Loss amount ($)' },
    predictionResult: { id: 'DD Anda bakal jadi', en: 'Your DD would become' },
    predictionOfLimit: { id: 'dari batas', en: 'of limit' },
    predictionSafe: { id: 'AMAN', en: 'SAFE' },
    predictionWarning: { id: 'WARNING', en: 'WARNING' },
    predictionDanger: { id: 'BAHAYA', en: 'DANGER' },
    predictionBreach: { id: 'BREACH!', en: 'BREACH!' },
    dailyDdReset: { id: 'Daily DD direset setiap hari pada 00:00 server time', en: 'Daily DD resets daily at 00:00 server time' },
    remainingDailyDd: { id: 'Sisa daily DD sebelum breach', en: 'Remaining daily DD before breach' },
    alertSettings: { id: 'Pengaturan Alert', en: 'Alert Settings' },
    alertPush80: { id: 'Kirim push notification kalau DD > 80%', en: 'Send push notification when DD > 80%' },
    alertPush95: { id: 'Kirim push notification kalau DD > 95%', en: 'Send push notification when DD > 95%' },
    alertWebhook: { id: 'Auto-warning saat trade masuk via webhook', en: 'Auto-warning when trade arrives via webhook' },
    tradeSourceMetaApi: { id: '🔄 Auto-sync via MetaApi', en: '🔄 Auto-sync via MetaApi' },
    tradeSourceWebhook: { id: '🔔 Real-time via Webhook', en: '🔔 Real-time via Webhook' },
    tradeSourceManual: { id: '📸 Manual via Screenshot', en: '📸 Manual via Screenshot' },
    setupPrompt: { id: '⚠️ Biar PropFirm tracker otomatis, hubungkan broker Anda:', en: '⚠️ To make PropFirm tracker automatic, connect your broker:' },
    connectMetaApi: { id: 'Hubungkan MetaApi', en: 'Connect MetaApi' },
    setupWebhook: { id: 'Setup Webhook', en: 'Setup Webhook' },
    setupManualNote: { id: 'Kalau ga di-connect, Anda harus manual input trade untuk drawdown tracking.', en: 'If not connected, you must manually input trades for drawdown tracking.' },
    autoSynced: { id: 'Auto-synced', en: 'Auto-synced' },
    webhookUrl: { id: 'Webhook URL', en: 'Webhook URL' },
    lastUpdated: { id: 'Terakhir diperbarui', en: 'Last updated' },
    overallStatus: { id: 'Status Keseluruhan', en: 'Overall Status' },
    selectRuleForPrediction: { id: 'Pilih challenge untuk prediksi', en: 'Select challenge for prediction' },
  }
  return texts[key]?.[language] ?? key
}

// ==================== HELPERS ====================

const formatCurrency = (value: number): string => {
  if (Math.abs(value) >= 1000000) return `$${(value / 1000000).toFixed(1)}M`
  if (Math.abs(value) >= 1000) return `$${(value / 1000).toFixed(value >= 10000 ? 0 : 1)}K`
  return `$${value.toFixed(2)}`
}

const formatCurrencyFull = (value: number): string => {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value)
}

const formatPercent = (value: number): string => `${value.toFixed(1)}%`

const getDrawdownColor = (percent: number): string => {
  if (percent > 80) return 'text-red-400'
  if (percent > 50) return 'text-amber-400'
  return 'text-emerald-400'
}

const getDrawdownStrokeColor = (percent: number): string => {
  if (percent > 80) return '#ef4444'
  if (percent > 50) return '#f59e0b'
  return '#22c55e'
}

const getDrawdownBgColor = (percent4Bg: number): string => {
  if (percent4Bg > 80) return 'from-red-500/15 to-red-600/5'
  if (percent4Bg > 50) return 'from-amber-500/15 to-amber-600/5'
  return 'from-emerald-500/15 to-emerald-600/5'
}

const getDrawdownBorderColor = (percent: number): string => {
  if (percent > 80) return 'border-red-500/30'
  if (percent > 50) return 'border-amber-500/30'
  return 'border-emerald-500/30'
}

const getProfitColor = (percent: number): string => {
  if (percent > 70) return 'text-emerald-400'
  return 'text-cyan-400'
}

const getProfitBarColor = (percent: number): string => {
  if (percent > 70) return 'bg-emerald-500'
  return 'bg-cyan-500'
}

const getPhaseColor = (phase: number): { bg: string; text: string; border: string } => {
  switch (phase) {
    case 1:
      return { bg: 'bg-blue-500/15', text: 'text-blue-400', border: 'border-blue-500/30' }
    case 2:
      return { bg: 'bg-amber-500/15', text: 'text-amber-400', border: 'border-amber-500/30' }
    case 3:
      return { bg: 'bg-emerald-500/15', text: 'text-emerald-400', border: 'border-emerald-500/30' }
    default:
      return { bg: 'bg-blue-500/15', text: 'text-blue-400', border: 'border-blue-500/30' }
  }
}

const getPhaseLabel = (phase: number, language: 'id' | 'en'): string => {
  switch (phase) {
    case 1: return t('phase1', language)
    case 2: return t('phase2', language)
    case 3: return t('funded', language)
    default: return `Phase ${phase}`
  }
}

const defaultFormData = (): ChallengeFormData => ({
  firm_name: '',
  challenge_size: 100000,
  phase: 1,
  max_drawdown: 10,
  max_daily_drawdown: 5,
  daily_drawdown_type: 'relative',
  profit_target: null,
  profit_target_percent: 10,
  min_trading_days: 4,
  profit_split: 80,
  start_date: new Date().toISOString().split('T')[0],
  account_id: '',
})

// ==================== SVG CIRCULAR GAUGE ====================

function CircularGauge({
  value,
  max,
  size = 80,
  strokeWidth = 6,
  label,
  language,
}: {
  value: number
  max: number
  size?: number
  strokeWidth?: number
  label: string
  language: 'id' | 'en'
}) {
  const radius = (size - strokeWidth) / 2
  const circumference = 2 * Math.PI * radius
  const percent = max > 0 ? Math.min((value / max) * 100, 100) : 0
  const strokeDashoffset = circumference - (percent / 100) * circumference
  const strokeColor = getDrawdownStrokeColor(percent)
  const isWarning = percent > 80

  return (
    <div className="flex flex-col items-center gap-1">
      <div className="relative" style={{ width: size, height: size }}>
        <svg width={size} height={size} className="transform -rotate-90">
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            fill="none"
            stroke="rgba(255,255,255,0.08)"
            strokeWidth={strokeWidth}
          />
          <motion.circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            fill="none"
            stroke={strokeColor}
            strokeWidth={strokeWidth}
            strokeLinecap="round"
            strokeDasharray={circumference}
            initial={{ strokeDashoffset: circumference }}
            animate={{ strokeDashoffset }}
            transition={{ duration: 1, ease: 'easeOut' }}
          />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className={`text-xs font-bold ${getDrawdownColor(percent)}`}>
            {formatPercent(percent)}
          </span>
        </div>
      </div>
      <span className="text-[10px] text-gray-500 text-center leading-tight">{label}</span>
      {isWarning && (
        <span className="text-[9px] text-red-400 font-medium animate-pulse">
          {t('violationWarning', language)}
        </span>
      )}
    </div>
  )
}

// ==================== STATUS BANNER ====================

function StatusBanner({ rules, language }: { rules: PropFirmRule[]; language: 'id' | 'en' }) {
  if (rules.length === 0) return null

  // Determine overall worst status
  let worstStatus: 'safe' | 'caution' | 'danger' | 'breached' = 'safe'

  for (const rule of rules) {
    if (rule.is_violated) {
      worstStatus = 'breached'
      break
    }
    const maxDdAmt = (rule.max_drawdown / 100) * rule.challenge_size
    const ddPct = maxDdAmt > 0 ? (rule.current_drawdown / maxDdAmt) * 100 : 0
    const maxDailyDdAmt = (rule.max_daily_drawdown / 100) * rule.challenge_size
    const dailyDdPct = maxDailyDdAmt > 0 ? (rule.current_daily_drawdown / maxDailyDdAmt) * 100 : 0
    const worstDd = Math.max(ddPct, dailyDdPct)

    if (worstDd >= 80) {
      worstStatus = 'danger'
    } else if (worstDd >= 50 && worstStatus !== 'danger') {
      worstStatus = 'caution'
    }
  }

  const statusConfig = {
    safe: { bg: 'bg-emerald-500/10 border-emerald-500/30', text: 'text-emerald-400', label: t('statusSafe', language) },
    caution: { bg: 'bg-amber-500/10 border-amber-500/30', text: 'text-amber-400', label: t('statusCaution', language) },
    danger: { bg: 'bg-red-500/10 border-red-500/30', text: 'text-red-400', label: t('statusDanger', language) },
    breached: { bg: 'bg-red-600/15 border-red-500/50', text: 'text-red-400', label: t('statusBreached', language) },
  }

  const config = statusConfig[worstStatus]

  return (
    <motion.div
      initial={{ opacity: 0, y: -10 }}
      animate={{ opacity: 1, y: 0 }}
      className={`border rounded-lg px-4 py-3 ${config.bg}`}
    >
      <p className={`text-sm font-semibold ${config.text} ${worstStatus === 'danger' || worstStatus === 'breached' ? 'animate-pulse' : ''}`}>
        {config.label}
      </p>
    </motion.div>
  )
}

// ==================== MAIN COMPONENT ====================

export default function PropFirmTab({ isPro, onUpgrade, language, trades, hasMetaApi, hasWebhook }: PropFirmTabProps) {
  // State
  const [rules, setRules] = useState<PropFirmRule[]>([])
  const [templates, setTemplates] = useState<Record<string, PropFirmTemplate>>({})
  const [templateFirms, setTemplateFirms] = useState<string[]>([])
  const [loading, setLoading] = useState(true)
  const [calculatingIds, setCalculatingIds] = useState<Set<string>>(new Set())
  const [showAddModal, setShowAddModal] = useState(false)
  const [editRule, setEditRule] = useState<PropFirmRule | null>(null)
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null)
  const [formData, setFormData] = useState<ChallengeFormData>(defaultFormData())
  const [selectedTemplate, setSelectedTemplate] = useState<string>('')
  const [submitting, setSubmitting] = useState(false)
  const initialCalcDone = useRef(false)

  // New: Early Warning System state
  const [predictionLoss, setPredictionLoss] = useState<number>(0)
  const [selectedPredictionRule, setSelectedPredictionRule] = useState<string>('')
  const [lastSyncTime, setLastSyncTime] = useState<string>('')
  const [alertSettingsMap, setAlertSettingsMap] = useState<Record<string, { warning: number; danger: number; pushEnabled: boolean; webhookEnabled: boolean }>>({})

  // Track trades for auto-recalculate
  const tradesLengthRef = useRef(0)

  // ==================== FETCH RULES ====================
  const fetchRules = useCallback(async () => {
    try {
      setLoading(true)
      const res = await authFetch('/api/prop-firm')
      if (!res.ok) throw new Error('Failed to fetch')
      const data = await res.json()
      setRules(data.rules ?? [])
      setLastSyncTime(new Date().toISOString())
    } catch {
      toast.error(t('fetchError', language))
    } finally {
      setLoading(false)
    }
  }, [language])

  // ==================== FETCH TEMPLATES ====================
  const fetchTemplates = useCallback(async () => {
    try {
      const res = await fetch('/api/prop-firm/templates')
      if (!res.ok) return
      const data = await res.json()
      setTemplates(data.templates ?? {})
      setTemplateFirms(data.firms ?? [])
    } catch {
      // Non-fatal
    }
  }, [])

  // ==================== FETCH ALERT SETTINGS ====================
  const fetchAlertSettings = useCallback(async (ruleId: string) => {
    try {
      const res = await authFetch(`/api/prop-firm/alert-settings?ruleId=${ruleId}`)
      if (!res.ok) return
      const data = await res.json()
      if (data.settings) {
        setAlertSettingsMap(prev => ({
          ...prev,
          [ruleId]: {
            warning: data.settings.alertThresholdWarning,
            danger: data.settings.alertThresholdDanger,
            pushEnabled: data.settings.alertPushEnabled,
            webhookEnabled: data.settings.alertWebhookEnabled,
          },
        }))
      }
    } catch {
      // Non-fatal
    }
  }, [])

  // ==================== SAVE ALERT SETTINGS ====================
  const saveAlertSetting = useCallback(async (ruleId: string, field: string, value: boolean | number) => {
    try {
      const body: Record<string, unknown> = { ruleId }
      body[field] = value
      await authFetch('/api/prop-firm/alert-settings', {
        method: 'POST',
        body: JSON.stringify(body),
      })
    } catch {
      // Non-fatal
    }
  }, [])

  // ==================== CALCULATE ====================
  const calculateRule = useCallback(async (ruleId: string) => {
    setCalculatingIds(prev => new Set(prev).add(ruleId))
    try {
      const res = await authFetch('/api/prop-firm/calculate', {
        method: 'POST',
        body: JSON.stringify({ ruleId }),
      })
      if (!res.ok) throw new Error('Failed to calculate')
      const data = await res.json()
      const calc: CalculationResult = data.calculation

      setRules(prev =>
        prev.map(r =>
          r.id === ruleId
            ? {
                ...r,
                current_balance: calc.current_balance,
                peak_balance: calc.peak_balance,
                current_drawdown: calc.current_drawdown,
                current_daily_drawdown: calc.current_daily_drawdown,
                progress_percent: calc.progress_percent,
                days_traded: calc.days_traded,
                is_violated: calc.is_violated,
              }
            : r
        )
      )
      toast.success(t('calcSuccess', language))
    } catch {
      toast.error(t('calcError', language))
    } finally {
      setCalculatingIds(prev => {
        const next = new Set(prev)
        next.delete(ruleId)
        return next
      })
    }
  }, [language])

  // ==================== AUTO-CALCULATE ON MOUNT & TRADES CHANGE ====================
  useEffect(() => {
    fetchRules()
    fetchTemplates()
  }, [fetchRules, fetchTemplates])

  useEffect(() => {
    if (initialCalcDone.current || loading || rules.length === 0) return
    initialCalcDone.current = true
    rules.forEach(rule => {
      calculateRule(rule.id)
      fetchAlertSettings(rule.id)
    })
    // Set first rule as default for prediction
    if (rules.length > 0 && !selectedPredictionRule) {
      setSelectedPredictionRule(rules[0].id)
    }
  }, [rules, loading, calculateRule, fetchAlertSettings, selectedPredictionRule])

  // Auto-recalculate when trades change
  useEffect(() => {
    const currentLength = trades?.length ?? 0
    if (currentLength !== tradesLengthRef.current && initialCalcDone.current && rules.length > 0) {
      tradesLengthRef.current = currentLength
      rules.forEach(rule => {
        calculateRule(rule.id)
      })
      setLastSyncTime(new Date().toISOString())
    }
  }, [trades, rules, calculateRule])

  // ==================== TEMPLATE HANDLER ====================
  const handleTemplateSelect = useCallback(
    (templateKey: string) => {
      setSelectedTemplate(templateKey)
      if (templateKey && templates[templateKey]) {
        const tmpl = templates[templateKey]
        const phase = formData.phase || 1
        const profitTargetPercent = phase === 1 ? tmpl.profit_target_phase1 : tmpl.profit_target_phase2
        setFormData(prev => ({
          ...prev,
          firm_name: tmpl.firm_name,
          challenge_size: tmpl.challenge_sizes[0],
          max_drawdown: tmpl.max_drawdown,
          max_daily_drawdown: tmpl.max_daily_drawdown,
          daily_drawdown_type: tmpl.daily_drawdown_type,
          profit_target_percent: profitTargetPercent,
          profit_target: null,
          min_trading_days: tmpl.min_trading_days,
          profit_split: tmpl.profit_split,
        }))
      }
    },
    [templates, formData.phase]
  )

  // ==================== FORM CHANGE HANDLERS ====================
  const updateForm = (field: keyof ChallengeFormData, value: any) => {
    setFormData(prev => ({ ...prev, [field]: value }))
  }

  const maxDdAmount = (formData.max_drawdown / 100) * formData.challenge_size
  const maxDailyDdAmount = (formData.max_daily_drawdown / 100) * formData.challenge_size
  const profitTargetValue =
    formData.profit_target ?? (formData.profit_target_percent / 100) * formData.challenge_size

  const handlePhaseChange = (phase: number) => {
    updateForm('phase', phase)
    if (selectedTemplate && templates[selectedTemplate]) {
      const tmpl = templates[selectedTemplate]
      const ptp = phase === 1 ? tmpl.profit_target_phase1 : tmpl.profit_target_phase2
      updateForm('profit_target_percent', ptp)
    }
  }

  // ==================== SUBMIT ====================
  const handleSubmit = async () => {
    if (!formData.firm_name.trim()) {
      toast.error(t('firmName', language) + ' required')
      return
    }
    if (formData.challenge_size <= 0) {
      toast.error(t('challengeSize', language) + ' > 0')
      return
    }

    setSubmitting(true)
    try {
      const payload = {
        firm_name: formData.firm_name,
        challenge_size: formData.challenge_size,
        phase: formData.phase,
        max_drawdown: formData.max_drawdown,
        max_daily_drawdown: formData.max_daily_drawdown,
        daily_drawdown_type: formData.daily_drawdown_type,
        profit_target: formData.profit_target,
        profit_target_percent: formData.profit_target_percent,
        min_trading_days: formData.min_trading_days,
        profit_split: formData.profit_split,
        start_date: formData.start_date,
        account_id: formData.account_id || null,
      }

      if (editRule) {
        const res = await authFetch(`/api/prop-firm/${editRule.id}`, {
          method: 'PATCH',
          body: JSON.stringify(payload),
        })
        if (!res.ok) throw new Error('Failed to update')
        toast.success(t('updateSuccess', language))
      } else {
        const res = await authFetch('/api/prop-firm', {
          method: 'POST',
          body: JSON.stringify(payload),
        })
        if (!res.ok) throw new Error('Failed to create')
        toast.success(t('createSuccess', language))
      }

      setShowAddModal(false)
      setEditRule(null)
      setFormData(defaultFormData())
      setSelectedTemplate('')
      fetchRules()
    } catch {
      toast.error(editRule ? t('updateError', language) : t('createError', language))
    } finally {
      setSubmitting(false)
    }
  }

  // ==================== DELETE ====================
  const handleDelete = async (ruleId: string) => {
    try {
      const res = await authFetch(`/api/prop-firm/${ruleId}`, {
        method: 'DELETE',
      })
      if (!res.ok) throw new Error('Failed to delete')
      toast.success(t('deleteSuccess', language))
      setRules(prev => prev.filter(r => r.id !== ruleId))
      setDeleteConfirmId(null)
    } catch {
      toast.error(t('deleteError', language))
    }
  }

  // ==================== OPEN EDIT ====================
  const openEdit = (rule: PropFirmRule) => {
    setEditRule(rule)
    setFormData({
      firm_name: rule.firm_name,
      challenge_size: rule.challenge_size,
      phase: rule.phase,
      max_drawdown: rule.max_drawdown,
      max_daily_drawdown: rule.max_daily_drawdown,
      daily_drawdown_type: rule.daily_drawdown_type,
      profit_target: rule.profit_target,
      profit_target_percent: rule.profit_target_percent,
      min_trading_days: rule.min_trading_days,
      profit_split: rule.profit_split,
      start_date: rule.start_date?.split('T')[0] ?? new Date().toISOString().split('T')[0],
      account_id: rule.account_id ?? '',
    })
    setSelectedTemplate('')
  }

  const closeModals = () => {
    setShowAddModal(false)
    setEditRule(null)
    setFormData(defaultFormData())
    setSelectedTemplate('')
  }

  // ==================== COMPUTED VALUES ====================
  const getRuleDdPercent = (rule: PropFirmRule): number => {
    const maxDdAmt = (rule.max_drawdown / 100) * rule.challenge_size
    return maxDdAmt > 0 ? Math.min((rule.current_drawdown / maxDdAmt) * 100, 100) : 0
  }

  const getRuleDailyDdPercent = (rule: PropFirmRule): number => {
    const maxDailyDdAmt = (rule.max_daily_drawdown / 100) * rule.challenge_size
    return maxDailyDdAmt > 0
      ? Math.min((rule.current_daily_drawdown / maxDailyDdAmt) * 100, 100)
      : 0
  }

  const getRuleProfitPercent = (rule: PropFirmRule): number => {
    return Math.min(rule.progress_percent, 100)
  }

  const getRuleCurrentPnl = (rule: PropFirmRule): number => {
    return rule.current_balance - rule.challenge_size
  }

  // ===== PREDICTION CALCULATOR =====
  const predictionResult = useMemo(() => {
    if (!selectedPredictionRule || predictionLoss <= 0) return null
    const rule = rules.find(r => r.id === selectedPredictionRule)
    if (!rule) return null

    const maxDdAmt = (rule.max_drawdown / 100) * rule.challenge_size
    const newDrawdown = rule.current_drawdown + predictionLoss
    const newDdPercent = maxDdAmt > 0 ? (newDrawdown / maxDdAmt) * 100 : 0

    let status: 'safe' | 'warning' | 'danger' | 'breach' = 'safe'
    if (newDdPercent >= 100) status = 'breach'
    else if (newDdPercent >= 80) status = 'danger'
    else if (newDdPercent >= 50) status = 'warning'

    return { newDrawdown, newDdPercent, status }
  }, [selectedPredictionRule, predictionLoss, rules])

  // ===== TRADE SOURCE INDICATOR =====
  const getTradeSourceLabel = (language: 'id' | 'en'): string => {
    if (hasMetaApi) return t('tradeSourceMetaApi', language)
    if (hasWebhook) return t('tradeSourceWebhook', language)
    return t('tradeSourceManual', language)
  }

  // ==================== PAYWALL ====================
  if (!isPro) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Card className="bg-gradient-to-br from-blue-500/10 to-blue-400/10 border-blue-500/30 max-w-md w-full">
          <CardContent className="py-10 text-center">
            <motion.div
              animate={{ scale: [1, 1.1, 1] }}
              transition={{ duration: 2, repeat: Infinity }}
            >
              <Lock className="w-14 h-14 mx-auto mb-5 text-blue-400" />
            </motion.div>
            <h3 className="text-lg font-bold text-blue-400 mb-2">
              {t('proFeature', language)}
            </h3>
            <p className="text-gray-400 mb-5 text-sm">
              {t('proDesc', language)}
            </p>
            <Button
              onClick={onUpgrade}
              className="bg-gradient-to-r from-blue-500 to-blue-600 hover:from-blue-600 hover:to-blue-700 text-white shadow-lg shadow-blue-500/25"
            >
              <Zap className="w-4 h-4 mr-2" />
              {t('upgrade', language)}
            </Button>
          </CardContent>
        </Card>
      </div>
    )
  }

  // ==================== LOADING ====================
  if (loading) {
    return (
      <div className="space-y-4">
        <div className="h-8 w-48 bg-white/5 rounded animate-pulse" />
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {[1, 2].map(i => (
            <Card key={i} className="bg-[#0d1117] border border-white/[0.08]">
              <CardContent className="p-6">
                <div className="h-4 w-32 bg-white/10 rounded animate-pulse mb-4" />
                <div className="h-8 w-24 bg-white/10 rounded animate-pulse mb-3" />
                <div className="h-20 w-20 bg-white/10 rounded-full animate-pulse mx-auto" />
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    )
  }

  // ==================== FORM MODAL CONTENT ====================
  const formModalContent = (
    <div className="space-y-4 max-h-[65vh] overflow-y-auto pr-1 custom-scrollbar">
      {!editRule && templateFirms.length > 0 && (
        <div>
          <Label className="text-gray-300 text-xs mb-1.5 block">
            {t('template', language)}
          </Label>
          <Select value={selectedTemplate} onValueChange={handleTemplateSelect}>
            <SelectTrigger className="w-full bg-white/5 border-white/[0.08] text-gray-200">
              <SelectValue placeholder={t('selectTemplate', language)} />
            </SelectTrigger>
            <SelectContent className="bg-[#161b22] border-white/[0.08]">
              {templateFirms.map(firm => (
                <SelectItem key={firm} value={firm} className="text-gray-200 focus:bg-white/10 focus:text-white">
                  {templates[firm]?.firm_name ?? firm}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {selectedTemplate && templates[selectedTemplate] && (
            <p className="text-[11px] text-gray-500 mt-1.5 italic">
              {templates[selectedTemplate].description}
            </p>
          )}
        </div>
      )}

      <div>
        <Label className="text-gray-300 text-xs mb-1.5 block">{t('firmName', language)} *</Label>
        <Input
          value={formData.firm_name}
          onChange={e => updateForm('firm_name', e.target.value)}
          placeholder="FTMO, MFF, FundedNext..."
          className="bg-white/5 border-white/[0.08] text-gray-200 placeholder:text-gray-600"
        />
      </div>

      <div>
        <Label className="text-gray-300 text-xs mb-1.5 block">{t('challengeSize', language)}</Label>
        <div className="flex gap-2 items-center">
          <Input
            type="number"
            value={formData.challenge_size}
            onChange={e => updateForm('challenge_size', Number(e.target.value))}
            className="bg-white/5 border-white/[0.08] text-gray-200 flex-1"
          />
          {!editRule && selectedTemplate && templates[selectedTemplate] && (
            <div className="flex gap-1 flex-wrap">
              {templates[selectedTemplate].challenge_sizes.map(size => (
                <Button
                  key={size}
                  type="button"
                  variant="outline"
                  size="sm"
                  className={`text-[10px] h-7 px-2 border-white/[0.08] ${
                    formData.challenge_size === size
                      ? 'bg-cyan-500/20 text-cyan-400 border-cyan-500/30'
                      : 'text-gray-400 hover:text-gray-200'
                  }`}
                  onClick={() => updateForm('challenge_size', size)}
                >
                  {formatCurrencyFull(size)}
                </Button>
              ))}
            </div>
          )}
        </div>
      </div>

      <div>
        <Label className="text-gray-300 text-xs mb-1.5 block">{t('phase', language)}</Label>
        <Select value={String(formData.phase)} onValueChange={v => handlePhaseChange(Number(v))}>
          <SelectTrigger className="w-full bg-white/5 border-white/[0.08] text-gray-200">
            <SelectValue />
          </SelectTrigger>
          <SelectContent className="bg-[#161b22] border-white/[0.08]">
            <SelectItem value="1" className="text-gray-200 focus:bg-white/10 focus:text-white">{t('phase1', language)}</SelectItem>
            <SelectItem value="2" className="text-gray-200 focus:bg-white/10 focus:text-white">{t('phase2', language)}</SelectItem>
            <SelectItem value="3" className="text-gray-200 focus:bg-white/10 focus:text-white">{t('funded', language)}</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <Label className="text-gray-300 text-xs mb-1.5 block">{t('maxDrawdown', language)}</Label>
          <Input type="number" step="0.1" value={formData.max_drawdown} onChange={e => updateForm('max_drawdown', Number(e.target.value))} className="bg-white/5 border-white/[0.08] text-gray-200" />
          <p className="text-[10px] text-gray-500 mt-1">= {formatCurrency(maxDdAmount)}</p>
        </div>
        <div>
          <Label className="text-gray-300 text-xs mb-1.5 block">{t('maxDailyDrawdown', language)}</Label>
          <Input type="number" step="0.1" value={formData.max_daily_drawdown} onChange={e => updateForm('max_daily_drawdown', Number(e.target.value))} className="bg-white/5 border-white/[0.08] text-gray-200" />
          <p className="text-[10px] text-gray-500 mt-1">= {formatCurrency(maxDailyDdAmount)}</p>
        </div>
      </div>

      <div>
        <Label className="text-gray-300 text-xs mb-1.5 block">{t('dailyDdType', language)}</Label>
        <Select value={formData.daily_drawdown_type} onValueChange={v => updateForm('daily_drawdown_type', v)}>
          <SelectTrigger className="w-full bg-white/5 border-white/[0.08] text-gray-200"><SelectValue /></SelectTrigger>
          <SelectContent className="bg-[#161b22] border-white/[0.08]">
            <SelectItem value="relative" className="text-gray-200 focus:bg-white/10 focus:text-white">{t('relative', language)}</SelectItem>
            <SelectItem value="absolute" className="text-gray-200 focus:bg-white/10 focus:text-white">{t('absolute', language)}</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <Label className="text-gray-300 text-xs mb-1.5 block">{t('profitTargetPercent', language)}</Label>
          <Input type="number" step="0.1" value={formData.profit_target_percent} onChange={e => updateForm('profit_target_percent', Number(e.target.value))} className="bg-white/5 border-white/[0.08] text-gray-200" />
        </div>
        <div>
          <Label className="text-gray-300 text-xs mb-1.5 block">{t('profitTarget', language)}</Label>
          <Input type="number" value={formData.profit_target ?? ''} placeholder={formatCurrency(profitTargetValue)} onChange={e => updateForm('profit_target', e.target.value ? Number(e.target.value) : null)} className="bg-white/5 border-white/[0.08] text-gray-200 placeholder:text-gray-600" />
          <p className="text-[10px] text-gray-500 mt-1">{language === 'id' ? 'Kosongkan = auto dari %' : 'Empty = auto from %'}</p>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <Label className="text-gray-300 text-xs mb-1.5 block">{t('minTradingDays', language)}</Label>
          <Input type="number" value={formData.min_trading_days} onChange={e => updateForm('min_trading_days', Number(e.target.value))} className="bg-white/5 border-white/[0.08] text-gray-200" />
        </div>
        <div>
          <Label className="text-gray-300 text-xs mb-1.5 block">{t('profitSplit', language)}</Label>
          <Input type="number" step="1" value={formData.profit_split} onChange={e => updateForm('profit_split', Number(e.target.value))} className="bg-white/5 border-white/[0.08] text-gray-200" />
        </div>
      </div>

      <div>
        <Label className="text-gray-300 text-xs mb-1.5 block">{t('startDate', language)}</Label>
        <Input type="date" value={formData.start_date} onChange={e => updateForm('start_date', e.target.value)} className="bg-white/5 border-white/[0.08] text-gray-200" />
      </div>

      <div>
        <Label className="text-gray-300 text-xs mb-1.5 block">{t('account', language)}</Label>
        <Input value={formData.account_id} onChange={e => updateForm('account_id', e.target.value)} placeholder={language === 'id' ? 'ID akun trading (opsional)' : 'Trading account ID (optional)'} className="bg-white/5 border-white/[0.08] text-gray-200 placeholder:text-gray-600" />
      </div>
    </div>
  )

  // ==================== MAIN RENDER ====================
  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h2 className="text-xl font-bold text-white flex items-center gap-2">
            <Shield className="w-5 h-5 text-cyan-400" />
            {t('title', language)}
          </h2>
          <p className="text-sm text-gray-500 mt-1">{t('subtitle', language)}</p>
          {lastSyncTime && (
            <p className="text-[11px] text-gray-600 mt-0.5 flex items-center gap-1">
              <Clock className="w-3 h-3" />
              {t('autoSynced', language)}: {new Date(lastSyncTime).toLocaleTimeString()}
            </p>
          )}
        </div>
        <Button
          onClick={() => { setFormData(defaultFormData()); setSelectedTemplate(''); setShowAddModal(true) }}
          className="bg-gradient-to-r from-cyan-500 to-blue-500 hover:from-cyan-600 hover:to-blue-600 text-white shadow-lg shadow-cyan-500/20"
        >
          <Plus className="w-4 h-4 mr-2" />
          {t('addChallenge', language)}
        </Button>
      </div>

      {/* ===== REAL-TIME STATUS BANNER ===== */}
      <StatusBanner rules={rules} language={language} />

      {/* ===== SETUP PROMPT (if no auto-import) ===== */}
      {!hasMetaApi && !hasWebhook && rules.length > 0 && (
        <Card className="bg-amber-500/5 border border-amber-500/20">
          <CardContent className="p-4">
            <p className="text-sm text-amber-400 font-medium mb-3">{t('setupPrompt', language)}</p>
            <div className="flex flex-wrap gap-2 mb-2">
              <Button
                variant="outline"
                size="sm"
                className="border-amber-500/30 text-amber-400 hover:bg-amber-500/10 text-xs"
                onClick={() => window.location.href = '/dashboard/connections'}
              >
                <Link2 className="w-3.5 h-3.5 mr-1.5" />
                {t('connectMetaApi', language)}
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="border-amber-500/30 text-amber-400 hover:bg-amber-500/10 text-xs"
                onClick={() => {
                  const url = `${window.location.origin}/api/webhook/trading`
                  navigator.clipboard.writeText(url).then(() => {
                    toast.success(language === 'id' ? 'URL webhook disalin!' : 'Webhook URL copied!')
                  })
                }}
              >
                <Radio className="w-3.5 h-3.5 mr-1.5" />
                {t('setupWebhook', language)}
              </Button>
            </div>
            <p className="text-[11px] text-gray-500">{t('setupManualNote', language)}</p>
          </CardContent>
        </Card>
      )}

      {/* ===== DD PREDICTION CALCULATOR ===== */}
      {rules.length > 0 && (
        <Card className="bg-[#0d1117] border border-white/[0.08]">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold text-white flex items-center gap-2">
              <Calculator className="w-4 h-4 text-amber-400" />
              {t('predictionTitle', language)}
            </CardTitle>
            <p className="text-[11px] text-gray-500">{t('predictionDesc', language)}</p>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex gap-3 items-end flex-wrap">
              <div className="flex-1 min-w-[140px]">
                <Label className="text-gray-400 text-[11px] mb-1 block">{t('selectRuleForPrediction', language)}</Label>
                <Select value={selectedPredictionRule} onValueChange={setSelectedPredictionRule}>
                  <SelectTrigger className="w-full bg-white/5 border-white/[0.08] text-gray-200 text-xs h-8">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="bg-[#161b22] border-white/[0.08]">
                    {rules.filter(r => !r.is_violated).map(rule => (
                      <SelectItem key={rule.id} value={rule.id} className="text-gray-200 focus:bg-white/10 focus:text-white text-xs">
                        {rule.firm_name} — {formatCurrencyFull(rule.challenge_size)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="w-32">
                <Label className="text-gray-400 text-[11px] mb-1 block">{t('predictionInput', language)}</Label>
                <Input
                  type="number"
                  min={0}
                  step={1}
                  value={predictionLoss || ''}
                  onChange={e => setPredictionLoss(Math.max(0, Number(e.target.value)))}
                  placeholder="$0"
                  className="bg-white/5 border-white/[0.08] text-gray-200 h-8 text-xs"
                />
              </div>
            </div>
            {predictionResult && (
              <motion.div
                initial={{ opacity: 0, y: 5 }}
                animate={{ opacity: 1, y: 0 }}
                className={`rounded-lg px-3 py-2 border ${
                  predictionResult.status === 'breach' ? 'bg-red-500/10 border-red-500/30' :
                  predictionResult.status === 'danger' ? 'bg-red-500/5 border-red-500/20' :
                  predictionResult.status === 'warning' ? 'bg-amber-500/5 border-amber-500/20' :
                  'bg-emerald-500/5 border-emerald-500/20'
                }`}
              >
                <p className="text-xs text-gray-300">
                  {t('predictionResult', language)}{' '}
                  <span className={`font-bold ${
                    predictionResult.status === 'breach' ? 'text-red-400' :
                    predictionResult.status === 'danger' ? 'text-red-400' :
                    predictionResult.status === 'warning' ? 'text-amber-400' :
                    'text-emerald-400'
                  }`}>
                    {formatCurrency(predictionResult.newDrawdown)} ({predictionResult.newDdPercent.toFixed(1)}% {t('predictionOfLimit', language)})
                  </span>
                  {' — '}
                  <span className={`font-bold ${
                    predictionResult.status === 'breach' ? 'text-red-400' :
                    predictionResult.status === 'danger' ? 'text-red-400' :
                    predictionResult.status === 'warning' ? 'text-amber-400' :
                    'text-emerald-400'
                  }`}>
                    {(() => {
                      const statusKey = predictionResult.status === 'safe' ? 'predictionSafe'
                        : predictionResult.status === 'warning' ? 'predictionWarning'
                        : predictionResult.status === 'danger' ? 'predictionDanger'
                        : 'predictionBreach'
                      return t(statusKey, language)
                    })()}
                  </span>
                </p>
              </motion.div>
            )}
          </CardContent>
        </Card>
      )}

      {/* ===== DAILY DD RESET INFO ===== */}
      {rules.length > 0 && (
        <Card className="bg-[#0d1117] border border-white/[0.08]">
          <CardContent className="p-4">
            <div className="flex items-start gap-2">
              <Info className="w-4 h-4 text-gray-500 mt-0.5 shrink-0" />
              <div className="space-y-1">
                <p className="text-xs text-gray-400">{t('dailyDdReset', language)}</p>
                {rules.filter(r => !r.is_violated).map(rule => {
                  const maxDailyDdAmt = (rule.max_daily_drawdown / 100) * rule.challenge_size
                  const remaining = Math.max(0, maxDailyDdAmt - rule.current_daily_drawdown)
                  return (
                    <p key={rule.id} className="text-[11px] text-gray-500">
                      {rule.firm_name}: {t('remainingDailyDd', language)} = <span className={remaining < maxDailyDdAmt * 0.2 ? 'text-red-400 font-medium' : 'text-emerald-400'}>{formatCurrency(remaining)}</span>
                    </p>
                  )
                })}
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Active Challenges */}
      <div>
        <h3 className="text-sm font-semibold text-gray-400 mb-3 flex items-center gap-2">
          <Target className="w-4 h-4 text-cyan-400" />
          {t('activeChallenges', language)}
          <Badge variant="secondary" className="bg-white/5 text-gray-400 border-white/[0.08] text-[10px]">
            {rules.length}
          </Badge>
        </h3>

        {rules.length === 0 ? (
          <Card className="bg-[#0d1117] border border-white/[0.08]">
            <CardContent className="py-16 text-center">
              <Shield className="w-12 h-12 mx-auto mb-4 text-gray-600" />
              <p className="text-gray-500 text-sm">{t('noChallenges', language)}</p>
              <Button
                onClick={() => { setFormData(defaultFormData()); setSelectedTemplate(''); setShowAddModal(true) }}
                variant="outline"
                className="mt-4 border-white/[0.08] text-cyan-400 hover:bg-cyan-500/10"
              >
                <Plus className="w-4 h-4 mr-2" />
                {t('addChallenge', language)}
              </Button>
            </CardContent>
          </Card>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <AnimatePresence mode="popLayout">
              {rules.map((rule, index) => {
                const ddPercent = getRuleDdPercent(rule)
                const dailyDdPercent = getRuleDailyDdPercent(rule)
                const profitPercent = getRuleProfitPercent(rule)
                const currentPnl = getRuleCurrentPnl(rule)
                const maxDdAmt = (rule.max_drawdown / 100) * rule.challenge_size
                const maxDailyDdAmt = (rule.max_daily_drawdown / 100) * rule.challenge_size
                const profitTarget = rule.profit_target ?? (rule.profit_target_percent / 100) * rule.challenge_size
                const phaseColors = getPhaseColor(rule.phase)
                const isCalculating = calculatingIds.has(rule.id)
                const alertSettings = alertSettingsMap[rule.id]

                return (
                  <motion.div
                    key={rule.id}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -20, scale: 0.95 }}
                    transition={{ duration: 0.3, delay: index * 0.05 }}
                  >
                    <Card
                      className={`bg-[#0d1117] border backdrop-blur-sm overflow-hidden ${
                        rule.is_violated ? 'border-red-500/50 animate-pulse' : 'border-white/[0.08]'
                      }`}
                    >
                      {/* Violation Banner */}
                      {rule.is_violated && (
                        <div className="bg-red-500/20 border-b border-red-500/30 px-4 py-2 flex items-center gap-2">
                          <AlertTriangle className="w-4 h-4 text-red-400" />
                          <span className="text-xs font-bold text-red-400">{t('violation', language)}</span>
                        </div>
                      )}

                      <CardHeader className="pb-3">
                        <div className="flex items-start justify-between">
                          <div className="flex items-center gap-2 flex-wrap">
                            <CardTitle className="text-base font-bold text-white">{rule.firm_name}</CardTitle>
                            <Badge className={`${phaseColors.bg} ${phaseColors.text} ${phaseColors.border} border text-[10px]`}>
                              {getPhaseLabel(rule.phase, language)}
                            </Badge>
                            {rule.is_violated && (
                              <Badge className="bg-red-500/20 text-red-400 border-red-500/30 border text-[10px] animate-pulse">
                                <AlertTriangle className="w-3 h-3 mr-0.5" /> VIOLATION
                              </Badge>
                            )}
                          </div>
                          <span className="text-lg font-bold text-white">{formatCurrencyFull(rule.challenge_size)}</span>
                        </div>
                        {/* Trade Source Indicator */}
                        <p className="text-[10px] text-gray-600 mt-1">{getTradeSourceLabel(language)}</p>
                      </CardHeader>

                      <CardContent className="space-y-4">
                        {/* Gauges Row */}
                        <div className="flex items-center justify-around gap-2">
                          <CircularGauge value={rule.current_drawdown} max={maxDdAmt} size={80} strokeWidth={6} label={t('drawdown', language)} language={language} />
                          <CircularGauge value={rule.current_daily_drawdown} max={maxDailyDdAmt} size={80} strokeWidth={6} label={t('dailyDrawdown', language)} language={language} />
                          {/* Profit Target Progress */}
                          <div className="flex flex-col items-center gap-1">
                            <div className="relative w-20 h-20">
                              <svg width={80} height={80} className="transform -rotate-90">
                                <circle cx={40} cy={40} r={34} fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth={6} />
                                <motion.circle
                                  cx={40} cy={40} r={34} fill="none"
                                  stroke={profitPercent > 70 ? '#22c55e' : '#06b6d4'}
                                  strokeWidth={6} strokeLinecap="round"
                                  strokeDasharray={2 * Math.PI * 34}
                                  initial={{ strokeDashoffset: 2 * Math.PI * 34 }}
                                  animate={{ strokeDashoffset: 2 * Math.PI * 34 - (profitPercent / 100) * 2 * Math.PI * 34 }}
                                  transition={{ duration: 1, ease: 'easeOut' }}
                                />
                              </svg>
                              <div className="absolute inset-0 flex flex-col items-center justify-center">
                                <span className={`text-xs font-bold ${getProfitColor(profitPercent)}`}>{formatPercent(profitPercent)}</span>
                              </div>
                            </div>
                            <span className="text-[10px] text-gray-500 text-center leading-tight">{t('profitProgress', language)}</span>
                            {profitPercent >= 100 && (
                              <span className="text-[9px] text-emerald-400 font-medium flex items-center gap-0.5">
                                <CheckCircle2 className="w-3 h-3" />{t('targetReached', language)}
                              </span>
                            )}
                          </div>
                        </div>

                        {/* Profit Progress Bar */}
                        <div>
                          <div className="flex items-center justify-between text-[11px] mb-1">
                            <span className="text-gray-500">{t('profitProgress', language)}</span>
                            <span className={getProfitColor(profitPercent)}>
                              {formatCurrency(Math.max(currentPnl, 0))} / {formatCurrency(profitTarget)}{' '}
                              <span className="text-gray-500">({t('ofTarget', language)})</span>
                            </span>
                          </div>
                          <div className="h-2 bg-white/[0.06] rounded-full overflow-hidden">
                            <motion.div
                              className={`h-full rounded-full ${getProfitBarColor(profitPercent)}`}
                              initial={{ width: 0 }}
                              animate={{ width: `${Math.min(profitPercent, 100)}%` }}
                              transition={{ duration: 1, ease: 'easeOut' }}
                            />
                          </div>
                        </div>

                        {/* Drawdown Bars */}
                        <div className="grid grid-cols-2 gap-3">
                          <div>
                            <div className="flex items-center justify-between text-[11px] mb-1">
                              <span className="text-gray-500">{t('drawdown', language)}</span>
                              <span className={getDrawdownColor(ddPercent)}>{formatCurrency(rule.current_drawdown)} / {formatCurrency(maxDdAmt)}</span>
                            </div>
                            <div className="h-1.5 bg-white/[0.06] rounded-full overflow-hidden">
                              <motion.div
                                className={`h-full rounded-full ${ddPercent > 80 ? 'bg-red-500' : ddPercent > 50 ? 'bg-amber-500' : 'bg-emerald-500'}`}
                                initial={{ width: 0 }}
                                animate={{ width: `${Math.min(ddPercent, 100)}%` }}
                                transition={{ duration: 0.8, ease: 'easeOut' }}
                              />
                            </div>
                          </div>
                          <div>
                            <div className="flex items-center justify-between text-[11px] mb-1">
                              <span className="text-gray-500">{t('dailyDrawdown', language)}</span>
                              <span className={getDrawdownColor(dailyDdPercent)}>{formatCurrency(rule.current_daily_drawdown)} / {formatCurrency(maxDailyDdAmt)}</span>
                            </div>
                            <div className="h-1.5 bg-white/[0.06] rounded-full overflow-hidden">
                              <motion.div
                                className={`h-full rounded-full ${dailyDdPercent > 80 ? 'bg-red-500' : dailyDdPercent > 50 ? 'bg-amber-500' : 'bg-emerald-500'}`}
                                initial={{ width: 0 }}
                                animate={{ width: `${Math.min(dailyDdPercent, 100)}%` }}
                                transition={{ duration: 0.8, ease: 'easeOut' }}
                              />
                            </div>
                          </div>
                        </div>

                        {/* Stats Row */}
                        <div className="grid grid-cols-3 gap-2 pt-1">
                          <div className="text-center">
                            <p className="text-[10px] text-gray-500 mb-0.5">{t('currentPnl', language)}</p>
                            <p className={`text-sm font-bold ${currentPnl >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                              {currentPnl >= 0 ? '+' : ''}{formatCurrency(currentPnl)}
                            </p>
                          </div>
                          <div className="text-center">
                            <p className="text-[10px] text-gray-500 mb-0.5">{t('daysTraded', language)}</p>
                            <p className="text-sm font-bold text-white">
                              {rule.days_traded} <span className="text-[10px] text-gray-500">({t('daysMin', language)} {rule.min_trading_days})</span>
                            </p>
                          </div>
                          <div className="text-center">
                            <p className="text-[10px] text-gray-500 mb-0.5">{t('profitSplit', language)}</p>
                            <p className="text-sm font-bold text-cyan-400">{rule.profit_split}%</p>
                          </div>
                        </div>

                        {/* ===== ALERT SETTINGS (per rule) ===== */}
                        <div className="border-t border-white/[0.06] pt-3 space-y-2">
                          <p className="text-[10px] text-gray-500 font-semibold flex items-center gap-1">
                            <Bell className="w-3 h-3" /> {t('alertSettings', language)}
                          </p>
                          <div className="flex items-center justify-between">
                            <span className="text-[10px] text-gray-400">{t('alertPush80', language)}</span>
                            <Switch
                              checked={alertSettings?.pushEnabled ?? true}
                              onCheckedChange={(v) => {
                                saveAlertSetting(rule.id, 'alert_push_enabled', v)
                                setAlertSettingsMap(prev => ({
                                  ...prev,
                                  [rule.id]: { ...prev[rule.id], pushEnabled: v }
                                }))
                              }}
                              className="scale-75 origin-right"
                            />
                          </div>
                          <div className="flex items-center justify-between">
                            <span className="text-[10px] text-gray-400">{t('alertWebhook', language)}</span>
                            <Switch
                              checked={alertSettings?.webhookEnabled ?? true}
                              onCheckedChange={(v) => {
                                saveAlertSetting(rule.id, 'alert_webhook_enabled', v)
                                setAlertSettingsMap(prev => ({
                                  ...prev,
                                  [rule.id]: { ...prev[rule.id], webhookEnabled: v }
                                }))
                              }}
                              className="scale-75 origin-right"
                            />
                          </div>
                        </div>

                        {/* Action Buttons */}
                        <div className="flex items-center gap-2 pt-1 border-t border-white/[0.06]">
                          <Button variant="ghost" size="sm" className="flex-1 text-gray-400 hover:text-cyan-400 hover:bg-cyan-500/10 text-xs h-8" onClick={() => calculateRule(rule.id)} disabled={isCalculating}>
                            {isCalculating ? <Loader2 className="w-3.5 h-3.5 mr-1 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5 mr-1" />}
                            {t('refresh', language)}
                          </Button>
                          <Button variant="ghost" size="sm" className="flex-1 text-gray-400 hover:text-amber-400 hover:bg-amber-500/10 text-xs h-8" onClick={() => openEdit(rule)}>
                            <Edit2 className="w-3.5 h-3.5 mr-1" />{t('editChallenge', language)}
                          </Button>
                          <Button variant="ghost" size="sm" className="text-gray-400 hover:text-red-400 hover:bg-red-500/10 text-xs h-8 px-2" onClick={() => setDeleteConfirmId(rule.id)}>
                            <Trash2 className="w-3.5 h-3.5" />
                          </Button>
                        </div>
                      </CardContent>
                    </Card>
                  </motion.div>
                )
              })}
            </AnimatePresence>
          </div>
        )}
      </div>

      {/* ==================== ADD MODAL ==================== */}
      <Dialog open={showAddModal} onOpenChange={v => !v && closeModals()}>
        <DialogContent className="bg-[#0d1117] border-white/[0.08] text-white max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-white">
              <Plus className="w-5 h-5 text-cyan-400" />
              {t('addChallenge', language)}
            </DialogTitle>
            <DialogDescription className="text-gray-500 sr-only">
              {t('addChallenge', language)}
            </DialogDescription>
          </DialogHeader>
          {formModalContent}
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={closeModals} className="border-white/[0.08] text-gray-400 hover:text-white hover:bg-white/5">
              {t('cancel', language)}
            </Button>
            <Button onClick={handleSubmit} disabled={submitting} className="bg-gradient-to-r from-cyan-500 to-blue-500 hover:from-cyan-600 hover:to-blue-600 text-white">
              {submitting ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Plus className="w-4 h-4 mr-2" />}
              {t('create', language)}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ==================== EDIT MODAL ==================== */}
      <Dialog open={!!editRule} onOpenChange={v => !v && closeModals()}>
        <DialogContent className="bg-[#0d1117] border-white/[0.08] text-white max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-white">
              <Edit2 className="w-5 h-5 text-amber-400" />
              {t('editChallenge', language)}
            </DialogTitle>
            <DialogDescription className="text-gray-500 sr-only">
              {t('editChallenge', language)}
            </DialogDescription>
          </DialogHeader>
          {formModalContent}
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={closeModals} className="border-white/[0.08] text-gray-400 hover:text-white hover:bg-white/5">
              {t('cancel', language)}
            </Button>
            <Button onClick={handleSubmit} disabled={submitting} className="bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-white">
              {submitting ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Edit2 className="w-4 h-4 mr-2" />}
              {t('save', language)}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ==================== DELETE CONFIRM ==================== */}
      <Dialog open={!!deleteConfirmId} onOpenChange={v => !v && setDeleteConfirmId(null)}>
        <DialogContent className="bg-[#0d1117] border-white/[0.08] text-white max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-red-400">
              <AlertTriangle className="w-5 h-5" />
              {t('deleteChallenge', language)}
            </DialogTitle>
            <DialogDescription className="text-gray-400">
              {t('deleteConfirm', language)}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setDeleteConfirmId(null)} className="border-white/[0.08] text-gray-400 hover:text-white hover:bg-white/5">
              {t('cancel', language)}
            </Button>
            <Button variant="destructive" onClick={() => deleteConfirmId && handleDelete(deleteConfirmId)} className="bg-red-500 hover:bg-red-600 text-white">
              <Trash2 className="w-4 h-4 mr-2" />
              {t('deleteChallenge', language)}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
