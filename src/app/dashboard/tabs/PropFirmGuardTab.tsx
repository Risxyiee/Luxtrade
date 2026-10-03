'use client'

import React, { useState, useEffect, useCallback } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import { Slider } from '@/components/ui/slider'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Switch } from '@/components/ui/switch'
import {
  Shield, Plus, Trash2, RefreshCw, AlertTriangle, CheckCircle2,
  XCircle, Loader2, ChevronRight, Edit2, RotateCcw, TrendingUp, Star
} from 'lucide-react'
import { toast } from 'sonner'

// ─── Firm Presets ─────────────────────────────────────────────────────
const FIRM_PRESETS: Record<string, { maxDailyLoss: number; maxTotalDD: number; profitTarget: number; consistencyRule?: number }> = {
  FTMO: { maxDailyLoss: 5, maxTotalDD: 10, profitTarget: 10, consistencyRule: 30 },
  MFF: { maxDailyLoss: 5, maxTotalDD: 12, profitTarget: 10, consistencyRule: 0 },
  TFT: { maxDailyLoss: 4.5, maxTotalDD: 9, profitTarget: 8, consistencyRule: 0 },
  FundedNext: { maxDailyLoss: 5, maxTotalDD: 10, profitTarget: 10, consistencyRule: 30 },
  SurgeTrader: { maxDailyLoss: 3, maxTotalDD: 6, profitTarget: 10, consistencyRule: 0 },
  Custom: { maxDailyLoss: 5, maxTotalDD: 10, profitTarget: 10, consistencyRule: 0 },
}

const ACCOUNT_SIZES = [10000, 25000, 50000, 100000, 200000, 500000]

interface Challenge {
  id: string
  firmName: string
  challengePhase: string
  accountSize: number
  maxDailyLoss: number
  maxTotalDD: number
  profitTarget: number
  currentBalance: number
  dailyPL: number
  totalPL: number
  currentDailyDD: number
  currentTotalDD: number
  currentProgress: number
  alertAtPercent: number
  isBreached: boolean
  breachReason: string | null
  breachedAt: string | null
  isActive: boolean
  tradingAccountId: string | null
  consistencyRule: number
  bestDayPL: number
  createdAt: string
  updatedAt: string
}

// ─── Circular Gauge ───────────────────────────────────────────────────
function CircularGauge({ percent, label, color, size = 80 }: {
  percent: number
  label: string
  color: string
  size?: number
}) {
  const radius = (size - 12) / 2
  const circumference = 2 * Math.PI * radius
  const clampedPercent = Math.min(Math.max(percent, 0), 100)
  const strokeDashoffset = circumference - (clampedPercent / 100) * circumference

  return (
    <div className="flex flex-col items-center gap-1">
      <svg width={size} height={size} className="-rotate-90">
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke="rgba(255,255,255,0.06)"
          strokeWidth="6"
          fill="none"
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke={color}
          strokeWidth="6"
          fill="none"
          strokeDasharray={circumference}
          strokeDashoffset={strokeDashoffset}
          strokeLinecap="round"
          className="transition-all duration-500"
        />
      </svg>
      <span className="text-xs font-bold" style={{ color }}>{clampedPercent.toFixed(1)}%</span>
      <span className="text-[10px] text-lux-text-muted dark:text-gray-500">{label}</span>
    </div>
  )
}

// ─── Phase Indicator ──────────────────────────────────────────────────
function PhaseIndicator({ phase, isBreached }: { phase: string; isBreached: boolean }) {
  const phases = ['phase1', 'phase2', 'funded']
  const phaseLabels: Record<string, string> = { phase1: 'Phase 1', phase2: 'Phase 2', funded: 'Funded' }
  const currentIdx = phases.indexOf(phase)

  if (isBreached) {
    return (
      <div className="flex items-center gap-1 text-red-500">
        <XCircle className="w-4 h-4" />
        <span className="text-xs font-bold">BREACHED</span>
      </div>
    )
  }

  return (
    <div className="flex items-center gap-1">
      {phases.map((p, i) => (
        <React.Fragment key={p}>
          {i > 0 && <ChevronRight className="w-3 h-3 text-gray-600" />}
          <div className={`flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[10px] font-semibold ${
            i < currentIdx
              ? 'bg-green-500/20 text-green-400'
              : i === currentIdx
                ? 'bg-amber-500/20 text-amber-400'
                : 'bg-gray-500/10 text-gray-500'
          }`}>
            {i < currentIdx && <CheckCircle2 className="w-3 h-3" />}
            {phaseLabels[p]}
          </div>
        </React.Fragment>
      ))}
    </div>
  )
}

// ─── DD Color Helper ──────────────────────────────────────────────────
function getDDColor(percentOfLimit: number): string {
  if (percentOfLimit >= 100) return '#ef4444'
  if (percentOfLimit >= 80) return '#f97316'
  if (percentOfLimit >= 40) return '#f59e0b'
  return '#22c55e'
}

function getDDColorClass(percentOfLimit: number): string {
  if (percentOfLimit >= 100) return 'text-red-500'
  if (percentOfLimit >= 80) return 'text-orange-500'
  if (percentOfLimit >= 40) return 'text-amber-500'
  return 'text-green-500'
}

// ─── Editable Field with N/A Switch ──────────────────────────────────
function EditableFieldWithNA({
  label,
  value,
  onChange,
  enabled,
  onEnabledChange,
  prefix = '$',
  suffix,
  placeholder,
  helperText,
}: {
  label: string
  value: number
  onChange: (val: number) => void
  enabled: boolean
  onEnabledChange: (val: boolean) => void
  prefix?: string
  suffix?: string
  placeholder?: string
  helperText?: string
}) {
  // Use string state for the input so user can freely type/edit
  // Sync from parent value prop only when not focused
  const [inputValue, setInputValue] = useState<string>(String(value ?? ''))
  const [isFocused, setIsFocused] = useState(false)

  // Sync from parent when not focused (e.g., dialog opens with challenge data)
  useEffect(() => {
    if (!isFocused) {
      setInputValue(value === 0 && !prefix ? '' : String(value ?? ''))
    }
  }, [value, isFocused, prefix])

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <Label className="text-xs text-lux-text-secondary dark:text-gray-400">{label}</Label>
        <div className="flex items-center gap-1.5">
          <span className="text-[10px] text-lux-text-muted dark:text-gray-500">Active</span>
          <Switch
            checked={enabled}
            onCheckedChange={onEnabledChange}
            className="scale-75 data-[state=checked]:bg-blue-500"
          />
        </div>
      </div>
      {enabled ? (
        <>
          <div className="relative">
            {prefix && (
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs text-lux-text-muted dark:text-gray-500">{prefix}</span>
            )}
            <Input
              type="number"
              value={inputValue}
              onChange={(e) => {
                setInputValue(e.target.value)
                onChange(e.target.value === '' ? 0 : Number(e.target.value))
              }}
              onFocus={() => setIsFocused(true)}
              onBlur={() => {
                setIsFocused(false)
                // Normalize on blur: if empty, set to 0
                const num = inputValue === '' ? 0 : Number(inputValue)
                setInputValue(String(num))
                onChange(num)
              }}
              className={`bg-lux-surface-hover dark:bg-white/5 border-lux-border dark:border-blue-900/30 text-white text-sm ${prefix ? 'pl-7' : ''} ${suffix ? 'pr-8' : ''}`}
              placeholder={placeholder || '0'}
            />
            {suffix && (
              <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-lux-text-muted dark:text-gray-500">{suffix}</span>
            )}
          </div>
          {helperText && <p className="text-[10px] text-lux-text-muted dark:text-gray-500">{helperText}</p>}
        </>
      ) : (
        <div className="px-3 py-2 rounded-md bg-lux-surface-hover dark:bg-white/5 border border-lux-border dark:border-blue-900/30 text-xs text-lux-text-muted dark:text-gray-500 italic">
          {prefix === '$' ? 'Not active' : 'Tidak aktif'}
        </div>
      )}
    </div>
  )
}

// ─── Main Component ───────────────────────────────────────────────────
export default function PropFirmGuardTab({ language = 'id' }: { language?: 'id' | 'en' }) {
  const [challenges, setChallenges] = useState<Challenge[]>([])
  const [loading, setLoading] = useState(true)
  const [checking, setChecking] = useState(false)
  const [addDialogOpen, setAddDialogOpen] = useState(false)
  const [editDialogOpen, setEditDialogOpen] = useState(false)
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [selectedChallenge, setSelectedChallenge] = useState<Challenge | null>(null)

  // Add form state
  const [formFirm, setFormFirm] = useState('FTMO')
  const [formCustomFirmName, setFormCustomFirmName] = useState('')
  const [formAccountSize, setFormAccountSize] = useState(100000)
  const [formPhase, setFormPhase] = useState('phase1')
  const [formAlertPercent, setFormAlertPercent] = useState(40)

  // Edit form state
  const [editFirmName, setEditFirmName] = useState('')
  const [editAccountSize, setEditAccountSize] = useState(0)
  const [editCurrentBalance, setEditCurrentBalance] = useState(0)
  const [editMaxDailyLoss, setEditMaxDailyLoss] = useState(0)
  const [editMaxTotalDD, setEditMaxTotalDD] = useState(0)
  const [editProfitTarget, setEditProfitTarget] = useState(0)
  const [editAlertPercent, setEditAlertPercent] = useState(40)
  const [editConsistencyRule, setEditConsistencyRule] = useState(0)
  const [editBestDayPL, setEditBestDayPL] = useState(0)
  const [editDailyPL, setEditDailyPL] = useState(0)
  const [editTotalPL, setEditTotalPL] = useState(0)
  const [editChallengePhase, setEditChallengePhase] = useState('phase1')

  // N/A toggle states for edit fields
  const [editMaxDailyLossEnabled, setEditMaxDailyLossEnabled] = useState(true)
  const [editMaxTotalDDEnabled, setEditMaxTotalDDEnabled] = useState(true)
  const [editProfitTargetEnabled, setEditProfitTargetEnabled] = useState(true)
  const [editConsistencyRuleEnabled, setEditConsistencyRuleEnabled] = useState(true)
  const [editBestDayPLEnabled, setEditBestDayPLEnabled] = useState(true)
  const [editDailyPLEnabled, setEditDailyPLEnabled] = useState(true)
  const [editTotalPLEnabled, setEditTotalPLEnabled] = useState(true)
  const [editCurrentBalanceEnabled, setEditCurrentBalanceEnabled] = useState(true)

  // Bilingual labels
  const t = (id: string, en: string) => language === 'id' ? id : en

  // Fetch challenges — uses cache: 'no-store' to bypass service worker cache
  // so that after a PATCH save, the fresh data from the server is returned
  const fetchChallenges = useCallback(async () => {
    try {
      setLoading(true)
      const res = await fetch('/api/prop-firm-guard', {
        credentials: 'include',
        cache: 'no-store',
      })
      if (!res.ok) throw new Error('Failed to fetch')
      const data = await res.json()
      setChallenges(data.challenges || [])
    } catch {
      toast.error(language === 'id' ? 'Gagal memuat data challenge' : 'Failed to load challenges')
    } finally {
      setLoading(false)
    }
  }, [language])

  useEffect(() => { fetchChallenges() }, [fetchChallenges])

  // Trigger guard check
  const handleCheckNow = async () => {
    try {
      setChecking(true)
      const res = await fetch('/api/prop-firm-guard/check', {
        method: 'POST',
        credentials: 'include',
      })
      if (res.ok) {
        toast.success(t('Pemeriksaan selesai', 'Check complete'))
        fetchChallenges()
      }
    } catch {
      toast.error(t('Gagal menjalankan pemeriksaan', 'Failed to run check'))
    } finally {
      setChecking(false)
    }
  }

  // Create challenge
  const handleCreate = async () => {
    try {
      const effectiveFirmName = formFirm === 'Custom' ? (formCustomFirmName.trim() || 'Custom') : formFirm
      const preset = FIRM_PRESETS[formFirm] || FIRM_PRESETS['Custom']
      const maxDailyLoss = (preset.maxDailyLoss / 100) * formAccountSize
      const maxTotalDD = (preset.maxTotalDD / 100) * formAccountSize
      const profitTarget = (preset.profitTarget / 100) * formAccountSize
      const consistencyRule = preset.consistencyRule || 0

      const res = await fetch('/api/prop-firm-guard', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          firmName: effectiveFirmName,
          accountSize: formAccountSize,
          challengePhase: formPhase,
          maxDailyLoss,
          maxTotalDD,
          profitTarget,
          alertAtPercent: formAlertPercent,
          consistencyRule,
          bestDayPL: 0,
        }),
      })

      if (!res.ok) {
        const err = await res.json()
        throw new Error(err.error || 'Failed to create')
      }

      toast.success(t('Challenge berhasil dibuat!', 'Challenge created!'))
      setAddDialogOpen(false)
      fetchChallenges()
    } catch (err: any) {
      toast.error(err.message || t('Gagal membuat challenge', 'Failed to create challenge'))
    }
  }

  // Update alert percent
  const handleUpdateAlert = async (id: string, alertPercent: number) => {
    try {
      const res = await fetch('/api/prop-firm-guard', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ id, alertAtPercent: alertPercent }),
      })
      if (!res.ok) throw new Error('Failed to update')
      fetchChallenges()
    } catch {
      toast.error(t('Gagal mengupdate', 'Failed to update'))
    }
  }

  // Reset breach
  const handleResetBreach = async (id: string) => {
    try {
      const res = await fetch('/api/prop-firm-guard', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ id, resetBreach: true }),
      })
      if (!res.ok) throw new Error('Failed to reset')
      toast.success(t('Breach berhasil direset', 'Breach reset successfully'))
      fetchChallenges()
    } catch {
      toast.error(t('Gagal mereset breach', 'Failed to reset breach'))
    }
  }

  // Delete challenge
  const handleDelete = async (id: string) => {
    try {
      const res = await fetch(`/api/prop-firm-guard?id=${id}`, {
        method: 'DELETE',
        credentials: 'include',
      })
      if (!res.ok) throw new Error('Failed to delete')
      toast.success(t('Challenge dihapus', 'Challenge deleted'))
      setDeleteDialogOpen(false)
      setSelectedChallenge(null)
      fetchChallenges()
    } catch {
      toast.error(t('Gagal menghapus', 'Failed to delete'))
    }
  }

  // Update phase
  const handlePhaseChange = async (id: string, phase: string) => {
    try {
      const res = await fetch('/api/prop-firm-guard', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ id, challengePhase: phase }),
      })
      if (!res.ok) throw new Error('Failed to update')
      toast.success(t('Phase berhasil diupdate', 'Phase updated'))
      fetchChallenges()
    } catch {
      toast.error(t('Gagal mengupdate phase', 'Failed to update phase'))
    }
  }

  // Open edit dialog with challenge data
  const openEditDialog = (ch: Challenge) => {
    setSelectedChallenge(ch)
    setEditFirmName(ch.firmName)
    setEditAccountSize(ch.accountSize)
    setEditCurrentBalance(ch.currentBalance)
    setEditMaxDailyLoss(ch.maxDailyLoss)
    setEditMaxTotalDD(ch.maxTotalDD)
    setEditProfitTarget(ch.profitTarget)
    setEditAlertPercent(ch.alertAtPercent)
    setEditConsistencyRule(ch.consistencyRule || 0)
    setEditBestDayPL(ch.bestDayPL || 0)
    setEditDailyPL(ch.dailyPL || 0)
    setEditTotalPL(ch.totalPL || 0)
    setEditChallengePhase(ch.challengePhase || 'phase1')
    // Set Active toggles — always enable fields by default so user can edit them
    // The Active toggle is opt-in to DISABLE a field, not opt-out to enable it
    setEditMaxDailyLossEnabled(true)
    setEditMaxTotalDDEnabled(true)
    setEditProfitTargetEnabled(true)
    setEditConsistencyRuleEnabled(true)
    setEditBestDayPLEnabled(true)
    setEditDailyPLEnabled(true)
    setEditTotalPLEnabled(true)
    setEditCurrentBalanceEnabled(true)
    setEditDialogOpen(true)
  }

  // Save edit
  const handleSaveEdit = async () => {
    if (!selectedChallenge) return
    try {
      const patchBody = {
        id: selectedChallenge.id,
        firmName: editFirmName,
        accountSize: editAccountSize,
        maxDailyLoss: editMaxDailyLossEnabled ? editMaxDailyLoss : 0,
        maxTotalDD: editMaxTotalDDEnabled ? editMaxTotalDD : 0,
        profitTarget: editProfitTargetEnabled ? editProfitTarget : 0,
        alertAtPercent: editAlertPercent,
        currentBalance: editCurrentBalanceEnabled ? editCurrentBalance : 0,
        consistencyRule: editConsistencyRuleEnabled ? editConsistencyRule : 0,
        bestDayPL: editBestDayPLEnabled ? editBestDayPL : 0,
        dailyPL: editDailyPLEnabled ? editDailyPL : 0,
        totalPL: editTotalPLEnabled ? editTotalPL : 0,
        challengePhase: editChallengePhase,
      }
      console.log('[PropFirmGuard] PATCH save:', patchBody)
      const res = await fetch('/api/prop-firm-guard', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        cache: 'no-store',
        body: JSON.stringify(patchBody),
      })
      if (!res.ok) {
        const err = await res.json()
        console.error('[PropFirmGuard] PATCH error:', err)
        throw new Error(err.error || 'Failed to update')
      }
      const result = await res.json()
      console.log('[PropFirmGuard] PATCH result:', result)
      toast.success(t('Challenge berhasil diupdate!', 'Challenge updated!'))
      setEditDialogOpen(false)
      setSelectedChallenge(null)
      fetchChallenges()
    } catch (err: any) {
      console.error('[PropFirmGuard] Save edit failed:', err)
      toast.error(err.message || t('Gagal mengupdate', 'Failed to update'))
    }
  }

  // ─── Render ─────────────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="w-8 h-8 animate-spin text-lux-text-muted dark:text-gray-400" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-xl bg-gradient-to-br from-blue-500/20 to-blue-600/10">
            <Shield className="w-6 h-6 text-blue-500" />
          </div>
          <div>
            <h2 className="text-lg font-bold text-white">
              {t('Prop Firm Guard', 'Prop Firm Guard')}
            </h2>
            <p className="text-xs text-lux-text-muted dark:text-gray-500">
              {t('Monitor drawdown & protect challenge', 'Monitor drawdown & protect challenge')}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={handleCheckNow}
            disabled={checking}
            className="gap-1.5 text-xs border-lux-border dark:border-blue-900/30 text-lux-text-secondary dark:text-gray-300 hover:text-white"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${checking ? 'animate-spin' : ''}`} />
            {t('Cek Sekarang', 'Check Now')}
          </Button>
          <Button
            size="sm"
            onClick={() => {
              setFormFirm('FTMO')
              setFormCustomFirmName('')
              setFormAccountSize(100000)
              setFormPhase('phase1')
              setFormAlertPercent(40)
              setAddDialogOpen(true)
            }}
            className="gap-1.5 text-xs bg-gradient-to-r from-blue-500 to-blue-600 hover:from-blue-600 hover:to-blue-700 text-white"
          >
            <Plus className="w-3.5 h-3.5" />
            {t('Tambah', 'Add')}
          </Button>
        </div>
      </div>

      {/* Empty state */}
      {challenges.length === 0 && (
        <Card className="bg-lux-bg-card dark:bg-gradient-to-br dark:from-[#0a0c12] dark:to-[#080a14] border-lux-border dark:border-blue-900/30">
          <CardContent className="py-16 text-center">
            <Shield className="w-12 h-12 text-gray-600 mx-auto mb-4" />
            <h3 className="text-white font-semibold mb-2">
              {t('Belum ada challenge', 'No challenges yet')}
            </h3>
            <p className="text-lux-text-muted dark:text-gray-500 text-sm mb-6">
              {t(
                'Tambahkan prop firm challenge untuk mulai monitoring drawdown.',
                'Add a prop firm challenge to start monitoring drawdown.'
              )}
            </p>
            <Button
              onClick={() => setAddDialogOpen(true)}
              className="bg-gradient-to-r from-blue-500 to-blue-600 hover:from-blue-600 hover:to-blue-700 text-white"
            >
              <Plus className="w-4 h-4 mr-2" />
              {t('Tambah Challenge', 'Add Challenge')}
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Challenge Cards */}
      <div className="grid gap-4">
        {challenges.map((ch) => {
          const dailyDDLimitPct = (ch.maxDailyLoss / ch.accountSize) * 100
          const totalDDLimitPct = (ch.maxTotalDD / ch.accountSize) * 100
          const dailyDDPctOfLimit = dailyDDLimitPct > 0 ? (ch.currentDailyDD / dailyDDLimitPct) * 100 : 0
          const totalDDPctOfLimit = totalDDLimitPct > 0 ? (ch.currentTotalDD / totalDDLimitPct) * 100 : 0
          const dailyDDColor = getDDColor(dailyDDPctOfLimit)
          const totalDDColor = getDDColor(totalDDPctOfLimit)

          return (
            <Card
              key={ch.id}
              className={`bg-lux-bg-card dark:bg-gradient-to-br dark:from-[#0a0c12] dark:to-[#080a14] border-lux-border dark:border-blue-900/30 ${
                ch.isBreached ? 'border-red-500/30' : dailyDDPctOfLimit >= 80 || totalDDPctOfLimit >= 80 ? 'border-orange-500/20' : ''
              }`}
            >
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3">
                    <div className={`p-2 rounded-lg ${
                      ch.isBreached
                        ? 'bg-red-500/10'
                        : dailyDDPctOfLimit >= 80 || totalDDPctOfLimit >= 80
                          ? 'bg-orange-500/10'
                          : 'bg-amber-500/10'
                    }`}>
                      <Shield className={`w-5 h-5 ${
                        ch.isBreached
                          ? 'text-red-500'
                          : dailyDDPctOfLimit >= 80 || totalDDPctOfLimit >= 80
                            ? 'text-orange-500'
                            : 'text-amber-500'
                      }`} />
                    </div>
                    <div>
                      <CardTitle className="text-base text-white flex items-center gap-2">
                        {ch.firmName}
                        <span className="text-lux-text-muted dark:text-gray-500 font-normal text-sm">
                          ${ch.accountSize.toLocaleString()}
                        </span>
                        {ch.isBreached && (
                          <Badge variant="destructive" className="text-[10px] px-1.5">
                            BREACHED
                          </Badge>
                        )}
                        {ch.consistencyRule > 0 && (
                          <Badge className="text-[10px] px-1.5 bg-blue-500/20 text-blue-400 border-blue-500/30">
                            {t(`Konsistensi ${ch.consistencyRule}%`, `Consistency ${ch.consistencyRule}%`)}
                          </Badge>
                        )}
                      </CardTitle>
                      <PhaseIndicator phase={ch.challengePhase} isBreached={ch.isBreached} />
                    </div>
                  </div>
                  <div className="flex items-center gap-1">
                    {!ch.isBreached && (
                      <Select
                        value={ch.challengePhase}
                        onValueChange={(val) => handlePhaseChange(ch.id, val)}
                      >
                        <SelectTrigger className="w-[100px] h-7 text-[10px] border-lux-border dark:border-blue-900/30 bg-lux-surface-hover dark:bg-white/5">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="phase1">Phase 1</SelectItem>
                          <SelectItem value="phase2">Phase 2</SelectItem>
                          <SelectItem value="funded">Funded</SelectItem>
                        </SelectContent>
                      </Select>
                    )}
                    {ch.isBreached && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleResetBreach(ch.id)}
                        className="text-[10px] h-7 text-lux-text-muted dark:text-gray-400 hover:text-white"
                      >
                        <RotateCcw className="w-3 h-3 mr-1" />
                        {t('Reset', 'Reset')}
                      </Button>
                    )}
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => openEditDialog(ch)}
                      className="text-amber-400 hover:text-amber-300 h-7"
                    >
                      <Edit2 className="w-3.5 h-3.5" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        setSelectedChallenge(ch)
                        setDeleteDialogOpen(true)
                      }}
                      className="text-red-400 hover:text-red-300 h-7"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* Gauges Row */}
                <div className="flex items-center justify-around py-2">
                  <CircularGauge
                    percent={dailyDDPctOfLimit}
                    label={t('DD Harian', 'Daily DD')}
                    color={dailyDDColor}
                  />
                  <CircularGauge
                    percent={totalDDPctOfLimit}
                    label={t('DD Total', 'Total DD')}
                    color={totalDDColor}
                  />
                  <CircularGauge
                    percent={ch.currentProgress}
                    label={t('Profit', 'Profit')}
                    color="#22c55e"
                  />
                </div>

                {/* Daily DD Bar */}
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-lux-text-secondary dark:text-gray-400">
                      {t('Drawdown Harian', 'Daily Drawdown')}
                    </span>
                    <span className={getDDColorClass(dailyDDPctOfLimit)}>
                      {ch.currentDailyDD.toFixed(1)}% / {dailyDDLimitPct.toFixed(1)}%
                    </span>
                  </div>
                  <div className="relative h-2.5 bg-lux-surface-hover dark:bg-white/5 rounded-full overflow-hidden">
                    <div
                      className="absolute inset-y-0 left-0 rounded-full transition-all duration-500"
                      style={{
                        width: `${Math.min(dailyDDPctOfLimit, 100)}%`,
                        backgroundColor: dailyDDColor,
                      }}
                    />
                    {/* Alert threshold marker */}
                    <div
                      className="absolute inset-y-0 w-0.5 bg-gray-400/50"
                      style={{ left: `${ch.alertAtPercent}%` }}
                    />
                  </div>
                  <div className="flex justify-between text-[10px] text-gray-600">
                    <span>$0</span>
                    <span>${ch.maxDailyLoss.toLocaleString()}</span>
                  </div>
                </div>

                {/* Total DD Bar */}
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-lux-text-secondary dark:text-gray-400">
                      {t('Total Drawdown', 'Total Drawdown')}
                    </span>
                    <span className={getDDColorClass(totalDDPctOfLimit)}>
                      {ch.currentTotalDD.toFixed(1)}% / {totalDDLimitPct.toFixed(1)}%
                    </span>
                  </div>
                  <div className="relative h-2.5 bg-lux-surface-hover dark:bg-white/5 rounded-full overflow-hidden">
                    <div
                      className="absolute inset-y-0 left-0 rounded-full transition-all duration-500"
                      style={{
                        width: `${Math.min(totalDDPctOfLimit, 100)}%`,
                        backgroundColor: totalDDColor,
                      }}
                    />
                    <div
                      className="absolute inset-y-0 w-0.5 bg-gray-400/50"
                      style={{ left: `${ch.alertAtPercent}%` }}
                    />
                  </div>
                  <div className="flex justify-between text-[10px] text-gray-600">
                    <span>$0</span>
                    <span>${ch.maxTotalDD.toLocaleString()}</span>
                  </div>
                </div>

                {/* Profit Target Bar */}
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-lux-text-secondary dark:text-gray-400">
                      {t('Target Profit', 'Profit Target')}
                    </span>
                    <span className="text-green-400">
                      {ch.currentProgress.toFixed(1)}% / 100%
                    </span>
                  </div>
                  <Progress value={Math.min(ch.currentProgress, 100)} className="h-2.5 [&>div]:bg-green-500" />
                  <div className="flex justify-between text-[10px] text-gray-600">
                    <span>$0</span>
                    <span>${ch.profitTarget.toLocaleString()}</span>
                  </div>
                </div>

                {/* Stats Row */}
                <div className={`grid gap-3 pt-1 ${ch.bestDayPL > 0 ? 'grid-cols-5' : 'grid-cols-4'}`}>
                  <div className="text-center p-2 rounded-lg bg-lux-surface-hover dark:bg-white/5">
                    <div className={`text-sm font-bold ${ch.dailyPL >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                      {ch.dailyPL >= 0 ? '+' : ''}${ch.dailyPL.toFixed(0)}
                    </div>
                    <div className="text-[10px] text-lux-text-muted dark:text-gray-500">
                      {t('P/L Hari Ini', 'Today P/L')}
                    </div>
                  </div>
                  <div className="text-center p-2 rounded-lg bg-lux-surface-hover dark:bg-white/5">
                    <div className={`text-sm font-bold ${ch.totalPL >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                      {ch.totalPL >= 0 ? '+' : ''}${ch.totalPL.toFixed(0)}
                    </div>
                    <div className="text-[10px] text-lux-text-muted dark:text-gray-500">
                      {t('Total P/L', 'Total P/L')}
                    </div>
                  </div>
                  <div className="text-center p-2 rounded-lg bg-lux-surface-hover dark:bg-white/5">
                    <div className="text-sm font-bold text-white">
                      ${ch.currentBalance.toFixed(0)}
                    </div>
                    <div className="text-[10px] text-lux-text-muted dark:text-gray-500">
                      {t('Saldo', 'Balance')}
                    </div>
                  </div>
                  {ch.bestDayPL > 0 && (
                    <div className="text-center p-2 rounded-lg bg-lux-surface-hover dark:bg-white/5">
                      <div className="text-sm font-bold text-green-400 flex items-center justify-center gap-1">
                        <Star className="w-3 h-3 text-amber-400" />
                        +${ch.bestDayPL.toFixed(0)}
                      </div>
                      <div className="text-[10px] text-lux-text-muted dark:text-gray-500">
                        {t('Best Day', 'Best Day')}
                      </div>
                    </div>
                  )}
                  {ch.consistencyRule > 0 && (
                    <div className="text-center p-2 rounded-lg bg-blue-500/10 border border-blue-500/20">
                      <div className="text-sm font-bold text-blue-400">
                        {ch.consistencyRule}%
                      </div>
                      <div className="text-[10px] text-lux-text-muted dark:text-gray-500">
                        {t('Konsistensi', 'Consistency')}
                      </div>
                    </div>
                  )}
                </div>

                {/* Breach Reason */}
                {ch.isBreached && ch.breachReason && (
                  <div className="flex items-start gap-2 p-2.5 rounded-lg bg-red-500/10 border border-red-500/20">
                    <AlertTriangle className="w-4 h-4 text-red-400 mt-0.5 flex-shrink-0" />
                    <div className="text-xs text-red-300">{ch.breachReason}</div>
                  </div>
                )}

                {/* Alert Threshold Slider */}
                <div className="space-y-2 pt-1">
                  <div className="flex items-center justify-between">
                    <Label className="text-[11px] text-lux-text-secondary dark:text-gray-400">
                      {t('Threshold Alert', 'Alert Threshold')}
                    </Label>
                    <span className="text-[11px] text-amber-400 font-medium">{ch.alertAtPercent}%</span>
                  </div>
                  <Slider
                    value={[ch.alertAtPercent]}
                    min={10}
                    max={90}
                    step={5}
                    onValueChange={([val]) => handleUpdateAlert(ch.id, val)}
                    className="[&_[role=slider]]:bg-amber-500"
                  />
                </div>
              </CardContent>
            </Card>
          )
        })}
      </div>

      {/* ─── Add Challenge Dialog ──────────────────────────────────── */}
      <Dialog open={addDialogOpen} onOpenChange={setAddDialogOpen}>
        <DialogContent className="bg-lux-bg-card dark:bg-gradient-to-br dark:from-[#0a0c12] dark:to-[#080a14] border-lux-border dark:border-blue-900/30 max-w-md">
          <DialogHeader>
            <DialogTitle className="text-white">
              {t('Tambah Challenge', 'Add Challenge')}
            </DialogTitle>
            <DialogDescription className="text-lux-text-secondary dark:text-gray-400">
              {t('Pilih prop firm dan ukuran akun', 'Select prop firm and account size')}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            {/* Firm Selection */}
            <div className="space-y-2">
              <Label className="text-xs text-lux-text-secondary dark:text-gray-400">{t('Prop Firm', 'Prop Firm')}</Label>
              <div className="grid grid-cols-3 gap-2">
                {Object.keys(FIRM_PRESETS).map((firm) => (
                  <button
                    key={firm}
                    onClick={() => setFormFirm(firm)}
                    className={`px-3 py-2 rounded-lg text-xs font-semibold transition-all ${
                      formFirm === firm
                        ? 'bg-gradient-to-r from-blue-500 to-blue-600 text-white'
                        : 'bg-lux-surface-hover dark:bg-white/5 text-lux-text-secondary dark:text-gray-400 hover:bg-lux-surface-hover/80 dark:hover:bg-white/10'
                    }`}
                  >
                    {firm}
                  </button>
                ))}
              </div>
              {/* Custom firm name input */}
              {formFirm === 'Custom' && (
                <Input
                  value={formCustomFirmName}
                  onChange={(e) => setFormCustomFirmName(e.target.value)}
                  placeholder={t('Nama prop firm custom...', 'Custom prop firm name...')}
                  className="bg-lux-surface-hover dark:bg-white/5 border-lux-border dark:border-blue-900/30 text-white text-sm mt-2"
                />
              )}
            </div>

            {/* Account Size */}
            <div className="space-y-2">
              <Label className="text-xs text-lux-text-secondary dark:text-gray-400">{t('Ukuran Akun', 'Account Size')}</Label>
              <div className="grid grid-cols-3 gap-2">
                {ACCOUNT_SIZES.map((size) => (
                  <button
                    key={size}
                    onClick={() => setFormAccountSize(size)}
                    className={`px-3 py-2 rounded-lg text-xs font-semibold transition-all ${
                      formAccountSize === size
                        ? 'bg-gradient-to-r from-blue-500 to-blue-600 text-white'
                        : 'bg-lux-surface-hover dark:bg-white/5 text-lux-text-secondary dark:text-gray-400 hover:bg-lux-surface-hover/80 dark:hover:bg-white/10'
                    }`}
                  >
                    ${size.toLocaleString()}
                  </button>
                ))}
              </div>
            </div>

            {/* Phase */}
            <div className="space-y-2">
              <Label className="text-xs text-lux-text-secondary dark:text-gray-400">{t('Phase', 'Phase')}</Label>
              <div className="grid grid-cols-3 gap-2">
                {[
                  { value: 'phase1', label: 'Phase 1' },
                  { value: 'phase2', label: 'Phase 2' },
                  { value: 'funded', label: 'Funded' },
                ].map((p) => (
                  <button
                    key={p.value}
                    onClick={() => setFormPhase(p.value)}
                    className={`px-3 py-2 rounded-lg text-xs font-semibold transition-all ${
                      formPhase === p.value
                        ? 'bg-gradient-to-r from-blue-500 to-blue-600 text-white'
                        : 'bg-lux-surface-hover dark:bg-white/5 text-lux-text-secondary dark:text-gray-400 hover:bg-lux-surface-hover/80 dark:hover:bg-white/10'
                    }`}
                  >
                    {p.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Alert Threshold */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label className="text-xs text-lux-text-secondary dark:text-gray-400">{t('Threshold Alert', 'Alert Threshold')}</Label>
                <span className="text-xs text-amber-400 font-medium">{formAlertPercent}%</span>
              </div>
              <Slider
                value={[formAlertPercent]}
                min={10}
                max={90}
                step={5}
                onValueChange={([val]) => setFormAlertPercent(val)}
                className="[&_[role=slider]]:bg-amber-500"
              />
              <p className="text-[10px] text-lux-text-muted dark:text-gray-500">
                {t(
                  `Alert saat DD mencapai ${formAlertPercent}% dari batas`,
                  `Alert when DD reaches ${formAlertPercent}% of limit`
                )}
              </p>
            </div>

            {/* Preset Info Preview */}
            <div className="p-3 rounded-lg bg-lux-surface-hover dark:bg-white/5 space-y-1">
              <div className="text-[10px] text-lux-text-muted dark:text-gray-500 font-semibold uppercase tracking-wider mb-2">
                {t('Aturan Challenge', 'Challenge Rules')}
              </div>
              {(() => {
                const preset = FIRM_PRESETS[formFirm] || FIRM_PRESETS['Custom']
                const effectiveName = formFirm === 'Custom' ? (formCustomFirmName.trim() || 'Custom') : formFirm
                return (
                  <>
                    <div className="flex justify-between text-xs">
                      <span className="text-lux-text-secondary dark:text-gray-400">{t('Nama', 'Name')}</span>
                      <span className="text-amber-400">{effectiveName}</span>
                    </div>
                    <div className="flex justify-between text-xs">
                      <span className="text-lux-text-secondary dark:text-gray-400">{t('Max DD Harian', 'Max Daily DD')}</span>
                      <span className="text-white">{preset.maxDailyLoss}% (${((preset.maxDailyLoss / 100) * formAccountSize).toLocaleString()})</span>
                    </div>
                    <div className="flex justify-between text-xs">
                      <span className="text-lux-text-secondary dark:text-gray-400">{t('Max DD Total', 'Max Total DD')}</span>
                      <span className="text-white">{preset.maxTotalDD}% (${((preset.maxTotalDD / 100) * formAccountSize).toLocaleString()})</span>
                    </div>
                    <div className="flex justify-between text-xs">
                      <span className="text-lux-text-secondary dark:text-gray-400">{t('Target Profit', 'Profit Target')}</span>
                      <span className="text-green-400">{preset.profitTarget}% (${((preset.profitTarget / 100) * formAccountSize).toLocaleString()})</span>
                    </div>
                    {(preset.consistencyRule || 0) > 0 && (
                      <div className="flex justify-between text-xs">
                        <span className="text-lux-text-secondary dark:text-gray-400">{t('Aturan Konsistensi', 'Consistency Rule')}</span>
                        <span className="text-blue-400">{preset.consistencyRule}%</span>
                      </div>
                    )}
                  </>
                )
              })()}
            </div>

            <Button
              onClick={handleCreate}
              className="w-full bg-gradient-to-r from-blue-500 to-blue-600 hover:from-blue-600 hover:to-blue-700 text-white font-semibold"
            >
              <Shield className="w-4 h-4 mr-2" />
              {t('Buat Challenge', 'Create Challenge')}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* ─── Edit Challenge Dialog ──────────────────────────────────── */}
      <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
        <DialogContent className="bg-lux-bg-card dark:bg-gradient-to-br dark:from-[#0a0c12] dark:to-[#080a14] border-lux-border dark:border-blue-900/30 max-w-md max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-white flex items-center gap-2">
              <Edit2 className="w-4 h-4 text-blue-400" />
              {t('Edit Challenge', 'Edit Challenge')}
            </DialogTitle>
            <DialogDescription className="text-lux-text-secondary dark:text-gray-400">
              {t('Sesuaikan semua aturan, saldo, dan nama prop firm', 'Customize all rules, balance, and prop firm name')}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            {/* Firm Name */}
            <div className="space-y-2">
              <Label className="text-xs text-lux-text-secondary dark:text-gray-400">{t('Nama Prop Firm', 'Prop Firm Name')}</Label>
              <Input
                value={editFirmName}
                onChange={(e) => setEditFirmName(e.target.value)}
                className="bg-lux-surface-hover dark:bg-white/5 border-lux-border dark:border-blue-900/30 text-white text-sm"
                placeholder="FTMO, MFF, atau nama custom..."
              />
              <p className="text-[10px] text-lux-text-muted dark:text-gray-500">{t('Bisa diisi nama apapun, termasuk nama custom', 'Can be any name, including custom names')}</p>
            </div>

            {/* Challenge Phase */}
            <div className="space-y-2">
              <Label className="text-xs text-lux-text-secondary dark:text-gray-400">{t('Phase Challenge', 'Challenge Phase')}</Label>
              <Select value={editChallengePhase} onValueChange={setEditChallengePhase}>
                <SelectTrigger className="bg-lux-surface-hover dark:bg-white/5 border-lux-border dark:border-blue-900/30 text-white text-sm">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="phase1">Phase 1</SelectItem>
                  <SelectItem value="phase2">Phase 2</SelectItem>
                  <SelectItem value="funded">Funded</SelectItem>
                </SelectContent>
              </Select>
              <p className="text-[10px] text-lux-text-muted dark:text-gray-500">
                {t('Pilih phase challenge saat ini', 'Select current challenge phase')}
              </p>
            </div>

            {/* Account Size */}
            <div className="space-y-2">
              <Label className="text-xs text-lux-text-secondary dark:text-gray-400">{t('Ukuran Akun ($)', 'Account Size ($)')}</Label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs text-lux-text-muted dark:text-gray-500">$</span>
                <Input
                  type="number"
                  value={editAccountSize || ''}
                  onChange={(e) => setEditAccountSize(e.target.value === '' ? 0 : Number(e.target.value))}
                  className="bg-lux-surface-hover dark:bg-white/5 border-lux-border dark:border-blue-900/30 text-white text-sm pl-7"
                  min={0}
                />
              </div>
            </div>

            {/* Current Balance */}
            <EditableFieldWithNA
              label={t('Saldo Saat Ini ($)', 'Current Balance ($)')}
              value={editCurrentBalance}
              onChange={setEditCurrentBalance}
              enabled={editCurrentBalanceEnabled}
              onEnabledChange={(v) => { setEditCurrentBalanceEnabled(v); if (!v) setEditCurrentBalance(0) }}
              prefix="$"
              helperText={t('Saldo terakhir akun challenge kamu', 'Your challenge account current balance')}
            />

            {/* Max Daily Loss */}
            <EditableFieldWithNA
              label={t('Max Daily Loss ($)', 'Max Daily Loss ($)')}
              value={editMaxDailyLoss}
              onChange={setEditMaxDailyLoss}
              enabled={editMaxDailyLossEnabled}
              onEnabledChange={(v) => { setEditMaxDailyLossEnabled(v); if (!v) setEditMaxDailyLoss(0) }}
              prefix="$"
              helperText={editAccountSize > 0 && editMaxDailyLossEnabled
                ? `${t('Batas harian', 'Daily limit')}: ${(editMaxDailyLoss / editAccountSize * 100).toFixed(1)}% ${t('dari saldo', 'of balance')}`
                : undefined}
            />

            {/* Max Total DD */}
            <EditableFieldWithNA
              label={t('Max Total Drawdown ($)', 'Max Total Drawdown ($)')}
              value={editMaxTotalDD}
              onChange={setEditMaxTotalDD}
              enabled={editMaxTotalDDEnabled}
              onEnabledChange={(v) => { setEditMaxTotalDDEnabled(v); if (!v) setEditMaxTotalDD(0) }}
              prefix="$"
              helperText={editAccountSize > 0 && editMaxTotalDDEnabled
                ? `${t('Batas total', 'Total limit')}: ${(editMaxTotalDD / editAccountSize * 100).toFixed(1)}% ${t('dari saldo', 'of balance')}`
                : undefined}
            />

            {/* Profit Target */}
            <EditableFieldWithNA
              label={t('Target Profit ($)', 'Profit Target ($)')}
              value={editProfitTarget}
              onChange={setEditProfitTarget}
              enabled={editProfitTargetEnabled}
              onEnabledChange={(v) => { setEditProfitTargetEnabled(v); if (!v) setEditProfitTarget(0) }}
              prefix="$"
              helperText={editAccountSize > 0 && editProfitTargetEnabled
                ? `${t('Target', 'Target')}: ${(editProfitTarget / editAccountSize * 100).toFixed(1)}% ${t('dari saldo', 'of balance')}`
                : undefined}
            />

            {/* Consistency Rule */}
            <EditableFieldWithNA
              label={t('Aturan Konsistensi (%)', 'Consistency Rule (%)')}
              value={editConsistencyRule}
              onChange={setEditConsistencyRule}
              enabled={editConsistencyRuleEnabled}
              onEnabledChange={(v) => { setEditConsistencyRuleEnabled(v); if (!v) setEditConsistencyRule(0) }}
              prefix=""
              suffix="%"
              placeholder={t('Misal: 30', 'e.g. 30')}
              helperText={editConsistencyRuleEnabled
                ? t('Best day P/L tidak boleh melebihi X% dari total profit (15-50%)', 'Best day P/L must not exceed X% of total profit (15-50%)')
                : undefined}
            />

            {/* Best Day P/L */}
            <EditableFieldWithNA
              label={t('Best Day P/L ($)', 'Best Day P/L ($)')}
              value={editBestDayPL}
              onChange={setEditBestDayPL}
              enabled={editBestDayPLEnabled}
              onEnabledChange={(v) => { setEditBestDayPLEnabled(v); if (!v) setEditBestDayPL(0) }}
              prefix="$"
              helperText={t('Profit terbaik dalam satu hari', 'Best profit in a single day')}
            />

            {/* Today P/L */}
            <EditableFieldWithNA
              label={t('P/L Hari Ini ($)', 'Today P/L ($)')}
              value={editDailyPL}
              onChange={setEditDailyPL}
              enabled={editDailyPLEnabled}
              onEnabledChange={(v) => { setEditDailyPLEnabled(v); if (!v) setEditDailyPL(0) }}
              prefix="$"
              helperText={t('Profit/loss hari ini', 'Today\'s profit/loss')}
            />

            {/* Total P/L */}
            <EditableFieldWithNA
              label={t('Total P/L ($)', 'Total P/L ($)')}
              value={editTotalPL}
              onChange={setEditTotalPL}
              enabled={editTotalPLEnabled}
              onEnabledChange={(v) => { setEditTotalPLEnabled(v); if (!v) setEditTotalPL(0) }}
              prefix="$"
              helperText={t('Total profit/loss keseluruhan', 'Overall total profit/loss')}
            />

            {/* Alert Threshold */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label className="text-xs text-lux-text-secondary dark:text-gray-400">{t('Threshold Alert', 'Alert Threshold')}</Label>
                <span className="text-xs text-amber-400 font-medium">{editAlertPercent}%</span>
              </div>
              <Slider
                value={[editAlertPercent]}
                min={10}
                max={90}
                step={5}
                onValueChange={([val]) => setEditAlertPercent(val)}
                className="[&_[role=slider]]:bg-amber-500"
              />
            </div>

            <Button
              onClick={handleSaveEdit}
              className="w-full bg-gradient-to-r from-blue-500 to-blue-600 hover:from-blue-600 hover:to-blue-700 text-white font-semibold"
            >
              <Edit2 className="w-4 h-4 mr-2" />
              {t('Simpan Perubahan', 'Save Changes')}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* ─── Delete Confirmation Dialog ───────────────────────────── */}
      <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <DialogContent className="bg-lux-bg-card dark:bg-gradient-to-br dark:from-[#0a0c12] dark:to-[#080a14] border-lux-border dark:border-blue-900/30 max-w-sm">
          <DialogHeader>
            <DialogTitle className="text-white">
              {t('Hapus Challenge?', 'Delete Challenge?')}
            </DialogTitle>
            <DialogDescription className="text-lux-text-secondary dark:text-gray-400">
              {selectedChallenge && (
                <>
                  {selectedChallenge.firmName} ${selectedChallenge.accountSize.toLocaleString()}{' '}
                  {t('akan dinonaktifkan.', 'will be deactivated.')}
                </>
              )}
            </DialogDescription>
          </DialogHeader>
          <div className="flex gap-2 pt-2">
            <Button
              variant="outline"
              onClick={() => { setDeleteDialogOpen(false); setSelectedChallenge(null) }}
              className="flex-1 border-lux-border dark:border-blue-900/30 text-lux-text-secondary dark:text-gray-300"
            >
              {t('Batal', 'Cancel')}
            </Button>
            <Button
              variant="destructive"
              onClick={() => selectedChallenge && handleDelete(selectedChallenge.id)}
              className="flex-1"
            >
              {t('Hapus', 'Delete')}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
