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
  XCircle, Loader2, ChevronRight, Edit2, RotateCcw
} from 'lucide-react'
import { toast } from 'sonner'

// ─── Firm Presets ─────────────────────────────────────────────────────
const FIRM_PRESETS: Record<string, { maxDailyLoss: number; maxTotalDD: number; profitTarget: number }> = {
  FTMO: { maxDailyLoss: 5, maxTotalDD: 10, profitTarget: 10 },
  MFF: { maxDailyLoss: 5, maxTotalDD: 12, profitTarget: 10 },
  TFT: { maxDailyLoss: 4.5, maxTotalDD: 9, profitTarget: 8 },
  FundedNext: { maxDailyLoss: 5, maxTotalDD: 10, profitTarget: 10 },
  SurgeTrader: { maxDailyLoss: 3, maxTotalDD: 6, profitTarget: 10 },
  Custom: { maxDailyLoss: 5, maxTotalDD: 10, profitTarget: 10 },
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
      <span className="text-[10px] text-gray-500">{label}</span>
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

  // Bilingual labels
  const t = (id: string, en: string) => language === 'id' ? id : en

  // Fetch challenges
  const fetchChallenges = useCallback(async () => {
    try {
      setLoading(true)
      const res = await fetch('/api/prop-firm-guard', { credentials: 'include' })
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
    setEditDialogOpen(true)
  }

  // Save edit
  const handleSaveEdit = async () => {
    if (!selectedChallenge) return
    try {
      const res = await fetch('/api/prop-firm-guard', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          id: selectedChallenge.id,
          firmName: editFirmName,
          accountSize: editAccountSize,
          maxDailyLoss: editMaxDailyLoss,
          maxTotalDD: editMaxTotalDD,
          profitTarget: editProfitTarget,
          alertAtPercent: editAlertPercent,
          currentBalance: editCurrentBalance,
        }),
      })
      if (!res.ok) {
        const err = await res.json()
        throw new Error(err.error || 'Failed to update')
      }
      toast.success(t('Challenge berhasil diupdate!', 'Challenge updated!'))
      setEditDialogOpen(false)
      setSelectedChallenge(null)
      fetchChallenges()
    } catch (err: any) {
      toast.error(err.message || t('Gagal mengupdate', 'Failed to update'))
    }
  }

  // ─── Render ─────────────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="w-8 h-8 animate-spin text-gray-400" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-xl bg-amber-500/10">
            <Shield className="w-6 h-6 text-amber-500" />
          </div>
          <div>
            <h2 className="text-lg font-bold text-white">
              {t('Prop Firm Guard', 'Prop Firm Guard')}
            </h2>
            <p className="text-xs text-gray-500">
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
            className="gap-1.5 text-xs border-gray-700 text-gray-300 hover:text-white"
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
            className="gap-1.5 text-xs bg-amber-500 hover:bg-amber-600 text-black"
          >
            <Plus className="w-3.5 h-3.5" />
            {t('Tambah', 'Add')}
          </Button>
        </div>
      </div>

      {/* Empty state */}
      {challenges.length === 0 && (
        <Card className="bg-gray-900/50 border-gray-800">
          <CardContent className="py-16 text-center">
            <Shield className="w-12 h-12 text-gray-600 mx-auto mb-4" />
            <h3 className="text-white font-semibold mb-2">
              {t('Belum ada challenge', 'No challenges yet')}
            </h3>
            <p className="text-gray-500 text-sm mb-6">
              {t(
                'Tambahkan prop firm challenge untuk mulai monitoring drawdown.',
                'Add a prop firm challenge to start monitoring drawdown.'
              )}
            </p>
            <Button
              onClick={() => setAddDialogOpen(true)}
              className="bg-amber-500 hover:bg-amber-600 text-black"
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
              className={`bg-gray-900/50 border-gray-800 ${
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
                        <span className="text-gray-500 font-normal text-sm">
                          ${ch.accountSize.toLocaleString()}
                        </span>
                        {ch.isBreached && (
                          <Badge variant="destructive" className="text-[10px] px-1.5">
                            BREACHED
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
                        <SelectTrigger className="w-[100px] h-7 text-[10px] border-gray-700 bg-gray-800">
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
                        className="text-[10px] h-7 text-gray-400 hover:text-white"
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
                    <span className="text-gray-400">
                      {t('Drawdown Harian', 'Daily Drawdown')}
                    </span>
                    <span className={getDDColorClass(dailyDDPctOfLimit)}>
                      {ch.currentDailyDD.toFixed(1)}% / {dailyDDLimitPct.toFixed(1)}%
                    </span>
                  </div>
                  <div className="relative h-2.5 bg-gray-800 rounded-full overflow-hidden">
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
                    <span className="text-gray-400">
                      {t('Total Drawdown', 'Total Drawdown')}
                    </span>
                    <span className={getDDColorClass(totalDDPctOfLimit)}>
                      {ch.currentTotalDD.toFixed(1)}% / {totalDDLimitPct.toFixed(1)}%
                    </span>
                  </div>
                  <div className="relative h-2.5 bg-gray-800 rounded-full overflow-hidden">
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
                    <span className="text-gray-400">
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
                <div className="grid grid-cols-3 gap-3 pt-1">
                  <div className="text-center p-2 rounded-lg bg-gray-800/50">
                    <div className={`text-sm font-bold ${ch.dailyPL >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                      {ch.dailyPL >= 0 ? '+' : ''}${ch.dailyPL.toFixed(0)}
                    </div>
                    <div className="text-[10px] text-gray-500">
                      {t('P/L Hari Ini', 'Today P/L')}
                    </div>
                  </div>
                  <div className="text-center p-2 rounded-lg bg-gray-800/50">
                    <div className={`text-sm font-bold ${ch.totalPL >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                      {ch.totalPL >= 0 ? '+' : ''}${ch.totalPL.toFixed(0)}
                    </div>
                    <div className="text-[10px] text-gray-500">
                      {t('Total P/L', 'Total P/L')}
                    </div>
                  </div>
                  <div className="text-center p-2 rounded-lg bg-gray-800/50">
                    <div className="text-sm font-bold text-white">
                      ${ch.currentBalance.toFixed(0)}
                    </div>
                    <div className="text-[10px] text-gray-500">
                      {t('Saldo', 'Balance')}
                    </div>
                  </div>
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
                    <Label className="text-[11px] text-gray-400">
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
        <DialogContent className="bg-gray-900 border-gray-800 max-w-md">
          <DialogHeader>
            <DialogTitle className="text-white">
              {t('Tambah Challenge', 'Add Challenge')}
            </DialogTitle>
            <DialogDescription className="text-gray-400">
              {t('Pilih prop firm dan ukuran akun', 'Select prop firm and account size')}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            {/* Firm Selection */}
            <div className="space-y-2">
              <Label className="text-xs text-gray-400">{t('Prop Firm', 'Prop Firm')}</Label>
              <div className="grid grid-cols-3 gap-2">
                {Object.keys(FIRM_PRESETS).map((firm) => (
                  <button
                    key={firm}
                    onClick={() => setFormFirm(firm)}
                    className={`px-3 py-2 rounded-lg text-xs font-semibold transition-all ${
                      formFirm === firm
                        ? 'bg-amber-500 text-black'
                        : 'bg-gray-800 text-gray-400 hover:bg-gray-700'
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
                  className="bg-gray-800 border-gray-700 text-white text-sm mt-2"
                />
              )}
            </div>

            {/* Account Size */}
            <div className="space-y-2">
              <Label className="text-xs text-gray-400">{t('Ukuran Akun', 'Account Size')}</Label>
              <div className="grid grid-cols-3 gap-2">
                {ACCOUNT_SIZES.map((size) => (
                  <button
                    key={size}
                    onClick={() => setFormAccountSize(size)}
                    className={`px-3 py-2 rounded-lg text-xs font-semibold transition-all ${
                      formAccountSize === size
                        ? 'bg-amber-500 text-black'
                        : 'bg-gray-800 text-gray-400 hover:bg-gray-700'
                    }`}
                  >
                    ${size.toLocaleString()}
                  </button>
                ))}
              </div>
            </div>

            {/* Phase */}
            <div className="space-y-2">
              <Label className="text-xs text-gray-400">{t('Phase', 'Phase')}</Label>
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
                        ? 'bg-amber-500 text-black'
                        : 'bg-gray-800 text-gray-400 hover:bg-gray-700'
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
                <Label className="text-xs text-gray-400">{t('Threshold Alert', 'Alert Threshold')}</Label>
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
              <p className="text-[10px] text-gray-500">
                {t(
                  `Alert saat DD mencapai ${formAlertPercent}% dari batas`,
                  `Alert when DD reaches ${formAlertPercent}% of limit`
                )}
              </p>
            </div>

            {/* Preset Info Preview */}
            <div className="p-3 rounded-lg bg-gray-800/50 space-y-1">
              <div className="text-[10px] text-gray-500 font-semibold uppercase tracking-wider mb-2">
                {t('Aturan Challenge', 'Challenge Rules')}
              </div>
              {(() => {
                const preset = FIRM_PRESETS[formFirm] || FIRM_PRESETS['Custom']
                const effectiveName = formFirm === 'Custom' ? (formCustomFirmName.trim() || 'Custom') : formFirm
                return (
                  <>
                    <div className="flex justify-between text-xs">
                      <span className="text-gray-400">{t('Nama', 'Name')}</span>
                      <span className="text-amber-400">{effectiveName}</span>
                    </div>
                    <div className="flex justify-between text-xs">
                      <span className="text-gray-400">{t('Max DD Harian', 'Max Daily DD')}</span>
                      <span className="text-white">{preset.maxDailyLoss}% (${((preset.maxDailyLoss / 100) * formAccountSize).toLocaleString()})</span>
                    </div>
                    <div className="flex justify-between text-xs">
                      <span className="text-gray-400">{t('Max DD Total', 'Max Total DD')}</span>
                      <span className="text-white">{preset.maxTotalDD}% (${((preset.maxTotalDD / 100) * formAccountSize).toLocaleString()})</span>
                    </div>
                    <div className="flex justify-between text-xs">
                      <span className="text-gray-400">{t('Target Profit', 'Profit Target')}</span>
                      <span className="text-green-400">{preset.profitTarget}% (${((preset.profitTarget / 100) * formAccountSize).toLocaleString()})</span>
                    </div>
                  </>
                )
              })()}
            </div>

            <Button
              onClick={handleCreate}
              className="w-full bg-amber-500 hover:bg-amber-600 text-black font-semibold"
            >
              <Shield className="w-4 h-4 mr-2" />
              {t('Buat Challenge', 'Create Challenge')}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* ─── Edit Challenge Dialog ──────────────────────────────────── */}
      <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
        <DialogContent className="bg-gray-900 border-gray-800 max-w-md max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-white flex items-center gap-2">
              <Edit2 className="w-4 h-4 text-amber-400" />
              {t('Edit Challenge', 'Edit Challenge')}
            </DialogTitle>
            <DialogDescription className="text-gray-400">
              {t('Sesuaikan aturan, saldo, dan nama prop firm', 'Customize rules, balance, and prop firm name')}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            {/* Firm Name */}
            <div className="space-y-2">
              <Label className="text-xs text-gray-400">{t('Nama Prop Firm', 'Prop Firm Name')}</Label>
              <Input
                value={editFirmName}
                onChange={(e) => setEditFirmName(e.target.value)}
                className="bg-gray-800 border-gray-700 text-white text-sm"
                placeholder="FTMO, MFF, atau nama custom..."
              />
              <p className="text-[10px] text-gray-500">{t('Bisa diisi nama apapun, termasuk nama custom', 'Can be any name, including custom names')}</p>
            </div>

            {/* Account Size */}
            <div className="space-y-2">
              <Label className="text-xs text-gray-400">{t('Ukuran Akun ($)', 'Account Size ($)')}</Label>
              <Input
                type="number"
                value={editAccountSize}
                onChange={(e) => setEditAccountSize(Number(e.target.value))}
                className="bg-gray-800 border-gray-700 text-white text-sm"
                min={0}
              />
            </div>

            {/* Current Balance */}
            <div className="space-y-2">
              <Label className="text-xs text-gray-400">{t('Saldo Saat Ini ($)', 'Current Balance ($)')}</Label>
              <Input
                type="number"
                value={editCurrentBalance}
                onChange={(e) => setEditCurrentBalance(Number(e.target.value))}
                className="bg-gray-800 border-gray-700 text-white text-sm"
              />
              <p className="text-[10px] text-gray-500">{t('Saldo terakhir akun challenge kamu', 'Your challenge account current balance')}</p>
            </div>

            {/* Max Daily Loss */}
            <div className="space-y-2">
              <Label className="text-xs text-gray-400">{t('Max Daily Loss ($)', 'Max Daily Loss ($)')}</Label>
              <Input
                type="number"
                value={editMaxDailyLoss}
                onChange={(e) => setEditMaxDailyLoss(Number(e.target.value))}
                className="bg-gray-800 border-gray-700 text-white text-sm"
                min={0}
              />
              <p className="text-[10px] text-gray-500">
                {editAccountSize > 0
                  ? `${t('Batas harian', 'Daily limit')}: ${(editMaxDailyLoss / editAccountSize * 100).toFixed(1)}% ${t('dari saldo', 'of balance')}`
                  : ''}
              </p>
            </div>

            {/* Max Total DD */}
            <div className="space-y-2">
              <Label className="text-xs text-gray-400">{t('Max Total Drawdown ($)', 'Max Total Drawdown ($)')}</Label>
              <Input
                type="number"
                value={editMaxTotalDD}
                onChange={(e) => setEditMaxTotalDD(Number(e.target.value))}
                className="bg-gray-800 border-gray-700 text-white text-sm"
                min={0}
              />
              <p className="text-[10px] text-gray-500">
                {editAccountSize > 0
                  ? `${t('Batas total', 'Total limit')}: ${(editMaxTotalDD / editAccountSize * 100).toFixed(1)}% ${t('dari saldo', 'of balance')}`
                  : ''}
              </p>
            </div>

            {/* Profit Target */}
            <div className="space-y-2">
              <Label className="text-xs text-gray-400">{t('Target Profit ($)', 'Profit Target ($)')}</Label>
              <Input
                type="number"
                value={editProfitTarget}
                onChange={(e) => setEditProfitTarget(Number(e.target.value))}
                className="bg-gray-800 border-gray-700 text-white text-sm"
                min={0}
              />
              <p className="text-[10px] text-gray-500">
                {editAccountSize > 0
                  ? `${t('Target', 'Target')}: ${(editProfitTarget / editAccountSize * 100).toFixed(1)}% ${t('dari saldo', 'of balance')}`
                  : ''}
              </p>
            </div>

            {/* Alert Threshold */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label className="text-xs text-gray-400">{t('Threshold Alert', 'Alert Threshold')}</Label>
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
              className="w-full bg-amber-500 hover:bg-amber-600 text-black font-semibold"
            >
              <Edit2 className="w-4 h-4 mr-2" />
              {t('Simpan Perubahan', 'Save Changes')}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* ─── Delete Confirmation Dialog ───────────────────────────── */}
      <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <DialogContent className="bg-gray-900 border-gray-800 max-w-sm">
          <DialogHeader>
            <DialogTitle className="text-white">
              {t('Hapus Challenge?', 'Delete Challenge?')}
            </DialogTitle>
            <DialogDescription className="text-gray-400">
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
              className="flex-1 border-gray-700 text-gray-300"
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
