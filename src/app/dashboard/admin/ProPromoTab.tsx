'use client'

import { useState, useEffect, useCallback } from 'react'
import { motion } from 'framer-motion'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
  DialogDescription,
} from '@/components/ui/dialog'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {
  Crown, Tag, Users, Clock, RefreshCw,
  CheckCircle, XCircle, AlertTriangle, Loader2,
  TrendingUp, Zap, Copy, Eye, EyeOff, Plus,
  MoreVertical, Pencil, Power, RotateCcw, Trash2, Settings2
} from 'lucide-react'
import { toast } from 'sonner'
import { authFetch } from '@/lib/api-fetch'

interface PromoCode {
  id: string
  code: string
  discountPercent: number
  maxQuota: number
  usedQuota: number
  remainingQuota: number
  durationMonths: number
  isActive: boolean
  createdAt: string
}

interface PromoUsage {
  id: string
  userId: string
  email: string | null
  fullName: string | null
  promoCode: string
  plan: string
  status: string
  discountPercent: number
  startDate: string
  endDate: string
  isCurrentlyActive: boolean
  isExpired: boolean
  createdAt: string
}

interface ProPromoData {
  promoCodes: PromoCode[]
  promoUsage: PromoUsage[]
  proUsersFromProfiles?: {
    id: string
    email: string | null
    fullName: string | null
    isPro: boolean
    plan: string
    subscriptionUntil: string | null
    proExpiry: string | null
    createdAt: string
  }[]
  totalProUsers: number
  promoActiveUsers: number
  promoExpiredUsers: number
  totalPromoUsage: number
  summary: {
    totalPromoCodes: number
    activePromoCodes: number
    totalQuotaUsed: number
    totalQuotaRemaining: number
  }
  missingTables?: string[]
  error?: string
}

export default function ProPromoTab() {
  const [data, setData] = useState<ProPromoData | null>(null)
  const [loading, setLoading] = useState(true)
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null)
  const [showExpired, setShowExpired] = useState(false)
  const [expandedCode, setExpandedCode] = useState<string | null>(null)
  const [showCreateDialog, setShowCreateDialog] = useState(false)
  const [newCode, setNewCode] = useState('')
  const [newMaxQuota, setNewMaxQuota] = useState('30')
  const [newDuration, setNewDuration] = useState('3')
  const [creating, setCreating] = useState(false)

  // Edit quota dialog state
  const [editQuotaPromo, setEditQuotaPromo] = useState<PromoCode | null>(null)
  const [editQuotaValue, setEditQuotaValue] = useState('')
  const [savingQuota, setSavingQuota] = useState(false)

  // Delete confirmation dialog state
  const [deleteTarget, setDeleteTarget] = useState<PromoCode | null>(null)
  const [deleting, setDeleting] = useState(false)

  const fetchData = useCallback(async () => {
    try {
      const res = await authFetch('/api/admin/pro-promo-log')
      const json = await res.json()
      if (res.ok) {
        setData(json)
        setLastUpdated(new Date())
      } else {
        console.error('[ProPromoTab] Fetch error:', json.error)
        if (json.missingTables) {
          toast.error(`Tabel ${json.missingTables.join(', ')} belum ada. Klik tombol DB Sync.`, { duration: 10000 })
        }
      }
    } catch (err) {
      console.error('[ProPromoTab] Network error:', err)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { fetchData() }, [fetchData])

  // Auto-refresh every 10 seconds
  useEffect(() => {
    const interval = setInterval(() => {
      if (document.visibilityState === 'visible') {
        fetchData()
      }
    }, 10_000)
    return () => clearInterval(interval)
  }, [fetchData])

  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return '-'
    return new Date(dateStr).toLocaleDateString('id-ID', {
      day: 'numeric', month: 'short', year: 'numeric',
      hour: '2-digit', minute: '2-digit'
    })
  }

  const formatRelative = (dateStr: string | null) => {
    if (!dateStr) return ''
    const diff = Date.now() - new Date(dateStr).getTime()
    const mins = Math.floor(diff / 60000)
    if (mins < 1) return 'Baru saja'
    if (mins < 60) return `${mins} menit lalu`
    const hours = Math.floor(mins / 60)
    if (hours < 24) return `${hours} jam lalu`
    const days = Math.floor(hours / 24)
    return `${days} hari lalu`
  }

  const getDaysRemaining = (dateStr: string) => {
    const diff = new Date(dateStr).getTime() - Date.now()
    return Math.max(0, Math.ceil(diff / (1000 * 60 * 60 * 24)))
  }

  const copyCode = (code: string) => {
    navigator.clipboard.writeText(code)
    toast.success(`Kode ${code} disalin!`)
  }

  const handleCreatePromo = async () => {
    try {
      setCreating(true)
      const res = await authFetch('/api/admin/pro-promo-log', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          code: newCode,
          maxQuota: parseInt(newMaxQuota) || 30,
          durationMonths: parseInt(newDuration) || 3,
          discountPercent: 100,
        })
      })
      const json = await res.json()
      if (res.ok) {
        toast.success(`Promo code "${newCode}" berhasil dibuat!`)
        setShowCreateDialog(false)
        setNewCode('')
        await fetchData()
      } else {
        toast.error(json.error || 'Gagal membuat promo code')
      }
    } catch {
      toast.error('Network error')
    } finally {
      setCreating(false)
    }
  }

  const handleTogglePromo = async (promo: PromoCode) => {
    try {
      const res = await authFetch('/api/admin/pro-promo-log', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: promo.id, action: 'toggle' })
      })
      const json = await res.json()
      if (res.ok) {
        toast.success(json.message)
        await fetchData()
      } else {
        toast.error(json.error || 'Gagal mengubah status')
      }
    } catch {
      toast.error('Network error')
    }
  }

  const handleResetQuota = async (promo: PromoCode) => {
    try {
      const res = await authFetch('/api/admin/pro-promo-log', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: promo.id, action: 'resetQuota' })
      })
      const json = await res.json()
      if (res.ok) {
        toast.success(json.message)
        await fetchData()
      } else {
        toast.error(json.error || 'Gagal reset kuota')
      }
    } catch {
      toast.error('Network error')
    }
  }

  const handleSaveQuota = async () => {
    if (!editQuotaPromo) return
    try {
      setSavingQuota(true)
      const res = await authFetch('/api/admin/pro-promo-log', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: editQuotaPromo.id,
          action: 'updateQuota',
          maxQuota: parseInt(editQuotaValue)
        })
      })
      const json = await res.json()
      if (res.ok) {
        toast.success(json.message)
        setEditQuotaPromo(null)
        await fetchData()
      } else {
        toast.error(json.error || 'Gagal mengubah kuota')
      }
    } catch {
      toast.error('Network error')
    } finally {
      setSavingQuota(false)
    }
  }

  const handleDeletePromo = async () => {
    if (!deleteTarget) return
    try {
      setDeleting(true)
      const res = await authFetch(`/api/admin/pro-promo-log?id=${deleteTarget.id}`, {
        method: 'DELETE'
      })
      const json = await res.json()
      if (res.ok) {
        toast.success(json.message, { duration: 6000 })
        setDeleteTarget(null)
        await fetchData()
      } else {
        toast.error(json.error || 'Gagal menghapus promo code')
      }
    } catch {
      toast.error('Network error')
    } finally {
      setDeleting(false)
    }
  }

  const handleDbSync = async () => {
    try {
      setLoading(true)
      const res = await authFetch('/api/admin/db-sync', { method: 'POST' })
      const json = await res.json()
      if (res.ok) {
        toast.success('DB Sync berhasil! Refreshing data...')
        await fetchData()
      } else {
        toast.error(`DB Sync gagal: ${json.error || 'Unknown error'}`)
      }
    } catch (err) {
      toast.error('DB Sync network error')
    } finally {
      setLoading(false)
    }
  }

  if (loading && !data) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="w-8 h-8 text-amber-500 animate-spin" />
      </div>
    )
  }

  if (!data) {
    return (
      <div className="text-center py-16">
        <AlertTriangle className="w-12 h-12 text-white/20 mx-auto mb-4" />
        <p className="text-white/60">Gagal memuat data Pro & Promo</p>
        <div className="flex gap-3 justify-center mt-4">
          <Button onClick={fetchData} variant="outline" className="border-amber-500/30 text-amber-400">
            <RefreshCw className="w-4 h-4 mr-2" /> Coba Lagi
          </Button>
          <Button onClick={handleDbSync} variant="outline" className="border-emerald-500/30 text-emerald-400">
            <Zap className="w-4 h-4 mr-2" /> DB Sync
          </Button>
        </div>
      </div>
    )
  }

  const filteredUsage = showExpired
    ? data.promoUsage
    : data.promoUsage.filter(u => u.isCurrentlyActive)

  const usageByCode = new Map<string, PromoUsage[]>()
  filteredUsage.forEach(u => {
    const list = usageByCode.get(u.promoCode) || []
    list.push(u)
    usageByCode.set(u.promoCode, list)
  })

  return (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">

      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-xl bg-amber-500/20">
            <Crown className="w-5 h-5 text-amber-400" />
          </div>
          <div>
            <h2 className="text-lg font-bold text-white">PRO & Promo Monitor</h2>
            <p className="text-xs text-white/40">Realtime tracking — auto refresh 10 detik</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          {lastUpdated && (
            <span className="text-[10px] text-white/30 flex items-center gap-1">
              <div className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
              Update: {lastUpdated.toLocaleTimeString('id-ID')}
            </span>
          )}
          <Button
            onClick={fetchData}
            variant="outline"
            size="sm"
            className="border-amber-500/30 text-amber-400 hover:bg-amber-500/10 h-8"
          >
            <RefreshCw className={`w-3.5 h-3.5 mr-1.5 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
        </div>
      </div>

      {/* Summary Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Card className="bg-[#1a0f2e]/50 border-emerald-500/20">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-emerald-500/20">
                <Crown className="w-5 h-5 text-emerald-400" />
              </div>
              <div>
                <p className="text-white/50 text-[10px] uppercase tracking-wider">Total Active PRO</p>
                <p className="text-2xl font-bold text-emerald-400">{data.totalProUsers}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-[#1a0f2e]/50 border-amber-500/20">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-amber-500/20">
                <Zap className="w-5 h-5 text-amber-400" />
              </div>
              <div>
                <p className="text-white/50 text-[10px] uppercase tracking-wider">Promo Aktif</p>
                <p className="text-2xl font-bold text-amber-400">{data.promoActiveUsers}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-[#1a0f2e]/50 border-red-500/20">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-red-500/20">
                <XCircle className="w-5 h-5 text-red-400" />
              </div>
              <div>
                <p className="text-white/50 text-[10px] uppercase tracking-wider">Promo Expired</p>
                <p className="text-2xl font-bold text-red-400">{data.promoExpiredUsers}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-[#1a0f2e]/50 border-purple-500/20">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-purple-500/20">
                <Tag className="w-5 h-5 text-purple-400" />
              </div>
              <div>
                <p className="text-white/50 text-[10px] uppercase tracking-wider">Kuota Tersisa</p>
                <p className="text-2xl font-bold text-purple-400">{data.summary.totalQuotaRemaining}</p>
                <p className="text-[10px] text-white/30">dari {data.summary.totalQuotaUsed + data.summary.totalQuotaRemaining} total</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Promo Code Cards */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold text-white/70 flex items-center gap-2">
            <Tag className="w-4 h-4 text-amber-400" />
            Kelola Promo Codes
            <Badge variant="outline" className="border-white/10 text-white/40 text-[10px]">
              {data.promoCodes.length} kode
            </Badge>
          </h3>
          <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
            <DialogTrigger asChild>
              <Button size="sm" className="h-8 text-xs bg-amber-500/20 text-amber-400 hover:bg-amber-500/30 border-0 gap-1.5">
                <Plus className="w-3.5 h-3.5" /> Buat Promo Baru
              </Button>
            </DialogTrigger>
            <DialogContent className="bg-[#1a0f2e] border-purple-500/30 text-white max-w-sm">
              <DialogHeader>
                <DialogTitle className="text-amber-300">Buat Promo Code Baru</DialogTitle>
              </DialogHeader>
              <div className="space-y-4 mt-4">
                <div>
                  <label className="text-xs text-white/50 mb-1 block">Kode Promo</label>
                  <Input
                    value={newCode}
                    onChange={(e) => setNewCode(e.target.value.toUpperCase())}
                    placeholder="CONTOHKODE"
                    className="bg-black/30 border-white/10 text-white placeholder:text-white/20"
                  />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs text-white/50 mb-1 block">Max Kuota</label>
                    <Input
                      type="number"
                      value={newMaxQuota}
                      onChange={(e) => setNewMaxQuota(e.target.value)}
                      className="bg-black/30 border-white/10 text-white"
                    />
                  </div>
                  <div>
                    <label className="text-xs text-white/50 mb-1 block">Durasi (bulan)</label>
                    <Input
                      type="number"
                      value={newDuration}
                      onChange={(e) => setNewDuration(e.target.value)}
                      className="bg-black/30 border-white/10 text-white"
                    />
                  </div>
                </div>
                <Button
                  onClick={handleCreatePromo}
                  disabled={!newCode || newCode.length < 3 || creating}
                  className="w-full bg-amber-500 hover:bg-amber-600 text-black font-bold"
                >
                  {creating ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Plus className="w-4 h-4 mr-2" />}
                  Buat Promo Code
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>

        {data.promoCodes.length === 0 ? (
          <Card className="bg-[#1a0f2e]/50 border-white/10">
            <CardContent className="py-12 text-center">
              <Tag className="w-12 h-12 text-white/10 mx-auto mb-3" />
              <p className="text-white/40 text-sm">Belum ada promo code</p>
              <p className="text-white/20 text-xs mt-1">Klik &quot;Buat Promo Baru&quot; untuk menambahkan</p>
            </CardContent>
          </Card>
        ) : (
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
            {data.promoCodes.map((promo) => {
              const usageCount = usageByCode.get(promo.code)?.length || 0
              const isExpanded = expandedCode === promo.code

              return (
                <motion.div key={promo.id} layout>
                  <Card className={`backdrop-blur-sm transition-all ${
                    promo.isActive
                      ? 'bg-gradient-to-br from-amber-500/10 to-[#1a0f2e]/50 border-amber-500/30'
                      : 'bg-[#1a0f2e]/30 border-white/5 opacity-60'
                  }`}>
                    <CardHeader className="pb-3">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2 min-w-0">
                          <code className="text-amber-300 font-bold text-sm tracking-wider truncate">{promo.code}</code>
                          <button onClick={() => copyCode(promo.code)} className="text-white/30 hover:text-white transition-colors flex-shrink-0">
                            <Copy className="w-3 h-3" />
                          </button>
                        </div>
                        <div className="flex items-center gap-1.5 flex-shrink-0">
                          <Badge className={
                            promo.isActive
                              ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30 text-[10px]'
                              : 'bg-red-500/20 text-red-300 border-red-500/30 text-[10px]'
                          }>
                            {promo.isActive ? '● Aktif' : '● Nonaktif'}
                          </Badge>
                          {/* Actions Dropdown */}
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="sm" className="h-7 w-7 p-0 text-white/40 hover:text-white hover:bg-white/10">
                                <MoreVertical className="w-3.5 h-3.5" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end" className="bg-[#1a0f2e] border-purple-500/20 min-w-[180px]">
                              {/* Toggle Active */}
                              <DropdownMenuItem
                                onClick={() => handleTogglePromo(promo)}
                                className={`cursor-pointer py-2 ${promo.isActive ? 'text-red-400 focus:text-red-300 focus:bg-red-500/10' : 'text-emerald-400 focus:text-emerald-300 focus:bg-emerald-500/10'}`}
                              >
                                <Power className="w-4 h-4 mr-2" />
                                {promo.isActive ? 'Nonaktifkan' : 'Aktifkan'}
                              </DropdownMenuItem>
                              {/* Edit Quota */}
                              <DropdownMenuItem
                                onClick={() => { setEditQuotaPromo(promo); setEditQuotaValue(String(promo.maxQuota)) }}
                                className="text-white/70 focus:text-white focus:bg-white/5 cursor-pointer py-2"
                              >
                                <Pencil className="w-4 h-4 mr-2" />
                                Ubah Kuota
                              </DropdownMenuItem>
                              {/* Reset Quota */}
                              <DropdownMenuItem
                                onClick={() => handleResetQuota(promo)}
                                className="text-amber-400 focus:text-amber-300 focus:bg-amber-500/10 cursor-pointer py-2"
                              >
                                <RotateCcw className="w-4 h-4 mr-2" />
                                Reset Kuota (pakai=0)
                              </DropdownMenuItem>
                              <DropdownMenuSeparator className="bg-purple-500/20" />
                              {/* Delete */}
                              <DropdownMenuItem
                                onClick={() => setDeleteTarget(promo)}
                                className="text-red-400 focus:text-red-300 focus:bg-red-500/10 cursor-pointer py-2"
                              >
                                <Trash2 className="w-4 h-4 mr-2" />
                                Hapus Promo
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </div>
                      </div>
                    </CardHeader>
                    <CardContent className="space-y-3">
                      {/* Quota Progress Bar */}
                      <div>
                        <div className="flex justify-between text-[10px] mb-1">
                          <span className="text-white/40">Kuota</span>
                          <span className={promo.remainingQuota <= 5 ? 'text-red-400 font-bold' : 'text-white/60'}>
                            {promo.usedQuota}/{promo.maxQuota} terpakai
                          </span>
                        </div>
                        <div className="h-2 bg-black/30 rounded-full overflow-hidden">
                          <motion.div
                            initial={{ width: 0 }}
                            animate={{ width: `${promo.maxQuota > 0 ? (promo.usedQuota / promo.maxQuota) * 100 : 0}%` }}
                            transition={{ duration: 0.8 }}
                            className={`h-full rounded-full ${
                              promo.remainingQuota <= 5
                                ? 'bg-gradient-to-r from-red-500 to-red-400'
                                : promo.remainingQuota <= 10
                                ? 'bg-gradient-to-r from-amber-500 to-orange-400'
                                : 'bg-gradient-to-r from-emerald-500 to-emerald-400'
                            }`}
                          />
                        </div>
                        {promo.remainingQuota <= 5 && promo.isActive && (
                          <p className="text-[10px] text-red-400 mt-1 flex items-center gap-1">
                            <AlertTriangle className="w-2.5 h-2.5" /> Kuota hampir habis!
                          </p>
                        )}
                      </div>

                      {/* Stats Row */}
                      <div className="grid grid-cols-3 gap-2 text-center">
                        <div className="p-1.5 rounded-lg bg-black/20">
                          <p className="text-sm font-bold text-amber-300">{promo.usedQuota}</p>
                          <p className="text-[9px] text-white/30 uppercase">Pakai</p>
                        </div>
                        <div className="p-1.5 rounded-lg bg-black/20">
                          <p className={`text-sm font-bold ${promo.remainingQuota <= 5 ? 'text-red-400' : 'text-emerald-300'}`}>
                            {promo.remainingQuota}
                          </p>
                          <p className="text-[9px] text-white/30 uppercase">Sisa</p>
                        </div>
                        <div className="p-1.5 rounded-lg bg-black/20">
                          <p className="text-sm font-bold text-white/70">{promo.durationMonths}bl</p>
                          <p className="text-[9px] text-white/30 uppercase">Durasi</p>
                        </div>
                      </div>

                      {/* Quick Actions Row */}
                      <div className="flex gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleTogglePromo(promo)}
                          className={`flex-1 h-7 text-[10px] gap-1 ${
                            promo.isActive
                              ? 'border-red-500/30 text-red-400 hover:bg-red-500/10'
                              : 'border-emerald-500/30 text-emerald-400 hover:bg-emerald-500/10'
                          }`}
                        >
                          <Power className="w-3 h-3" />
                          {promo.isActive ? 'Nonaktif' : 'Aktif'}
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => { setEditQuotaPromo(promo); setEditQuotaValue(String(promo.maxQuota)) }}
                          className="flex-1 h-7 text-[10px] gap-1 border-white/20 text-white/50 hover:text-white hover:bg-white/10"
                        >
                          <Settings2 className="w-3 h-3" />
                          Kuota
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleResetQuota(promo)}
                          className="flex-1 h-7 text-[10px] gap-1 border-amber-500/30 text-amber-400 hover:bg-amber-500/10"
                        >
                          <RotateCcw className="w-3 h-3" />
                          Reset
                        </Button>
                      </div>

                      {/* Expand/Collapse to see users */}
                      <Button
                        variant="ghost"
                        size="sm"
                        className="w-full text-white/40 hover:text-white hover:bg-white/5 h-7 text-xs"
                        onClick={() => setExpandedCode(isExpanded ? null : promo.code)}
                      >
                        {isExpanded ? <EyeOff className="w-3 h-3 mr-1" /> : <Eye className="w-3 h-3 mr-1" />}
                        {isExpanded ? 'Tutup Detail' : `Lihat ${usageCount} User`}

                      </Button>

                      {/* Expanded: User list for this promo code */}
                      {isExpanded && (
                        <motion.div
                          initial={{ opacity: 0, height: 0 }}
                          animate={{ opacity: 1, height: 'auto' }}
                          className="border-t border-white/5 pt-3 space-y-2 max-h-64 overflow-y-auto"
                        >
                          {(usageByCode.get(promo.code) || []).map((u) => (
                            <div key={u.id} className="flex items-center justify-between text-xs py-1 px-2 rounded-lg bg-black/20">
                              <div className="min-w-0 flex-1">
                                <p className="text-white/70 truncate">{u.email || 'Unknown'}</p>
                                <p className="text-white/30 text-[10px]">{formatRelative(u.createdAt)}</p>
                              </div>
                              <div className="flex items-center gap-2 flex-shrink-0 ml-2">
                                <Badge className={`text-[9px] px-1 py-0 ${
                                  u.isCurrentlyActive
                                    ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30'
                                    : 'bg-red-500/20 text-red-300 border-red-500/30'
                                }`}>
                                  {u.isCurrentlyActive ? 'Aktif' : 'Expired'}
                                </Badge>
                                <span className="text-white/30 text-[10px]">
                                  {u.isCurrentlyActive ? `${getDaysRemaining(u.endDate)}h left` : formatDate(u.endDate)}
                                </span>
                              </div>
                            </div>
                          ))}
                        </motion.div>
                      )}
                    </CardContent>
                  </Card>
                </motion.div>
              )
            })}
          </div>
        )}
      </div>

      {/* Promo Usage Table */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold text-white/70 flex items-center gap-2">
            <Users className="w-4 h-4 text-purple-400" />
            User yang Pakai Promo Code
            <Badge variant="outline" className="border-white/10 text-white/40 text-[10px]">
              {filteredUsage.length} dari {data.promoUsage.length}
            </Badge>
          </h3>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setShowExpired(!showExpired)}
            className="text-white/40 hover:text-white text-xs h-7"
          >
            {showExpired ? <EyeOff className="w-3 h-3 mr-1" /> : <Eye className="w-3 h-3 mr-1" />}
            {showExpired ? 'Sembunyikan Expired' : 'Tampilkan Semua'}
          </Button>
        </div>

        <Card className="bg-[#1a0f2e]/50 border-purple-500/20">
          <CardContent className="p-0">
            {filteredUsage.length === 0 ? (
              <div className="text-center py-12">
                <Tag className="w-10 h-10 text-white/10 mx-auto mb-3" />
                <p className="text-white/40 text-sm">Belum ada user yang menggunakan promo code</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                {/* Mobile: Card list */}
                <div className="md:hidden space-y-2 p-3">
                  {filteredUsage.map((u) => (
                    <div key={u.id} className="bg-white/[0.03] border border-purple-500/10 rounded-xl p-3 space-y-2">
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <p className="text-sm text-white font-medium truncate">{u.email || '-'}</p>
                          <p className="text-[10px] text-white/30 truncate">{u.fullName || 'No name'}</p>
                        </div>
                        <Badge className={`text-[10px] flex-shrink-0 ${
                          u.isCurrentlyActive
                            ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30'
                            : 'bg-red-500/20 text-red-300 border-red-500/30'
                        }`}>
                          {u.isCurrentlyActive ? <CheckCircle className="w-2.5 h-2.5 mr-0.5" /> : <XCircle className="w-2.5 h-2.5 mr-0.5" />}
                          {u.isCurrentlyActive ? 'Aktif' : 'Expired'}
                        </Badge>
                      </div>
                      <div className="grid grid-cols-2 gap-2 text-xs">
                        <div>
                          <span className="text-white/30">Kode: </span>
                          <code className="text-amber-300 font-mono text-[11px]">{u.promoCode}</code>
                        </div>
                        <div>
                          <span className="text-white/30">Diskon: </span>
                          <span className="text-white/60">{u.discountPercent}%</span>
                        </div>
                        <div>
                          <span className="text-white/30">Mulai: </span>
                          <span className="text-white/50">{formatDate(u.startDate)}</span>
                        </div>
                        <div>
                          <span className="text-white/30">Selesai: </span>
                          <span className={u.isCurrentlyActive ? 'text-emerald-400' : 'text-red-400'}>
                            {u.isCurrentlyActive ? `${getDaysRemaining(u.endDate)} hari lagi` : formatDate(u.endDate)}
                          </span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>

                {/* Desktop: Table */}
                <table className="w-full text-sm hidden md:table">
                  <thead>
                    <tr className="border-b border-purple-500/20">
                      <th className="text-left py-3 px-3 text-white/50 font-medium text-xs">User</th>
                      <th className="text-left py-3 px-3 text-white/50 font-medium text-xs">Promo Code</th>
                      <th className="text-left py-3 px-3 text-white/50 font-medium text-xs">Status</th>
                      <th className="text-left py-3 px-3 text-white/50 font-medium text-xs">Diskon</th>
                      <th className="text-left py-3 px-3 text-white/50 font-medium text-xs">Mulai</th>
                      <th className="text-left py-3 px-3 text-white/50 font-medium text-xs">Selesai</th>
                      <th className="text-left py-3 px-3 text-white/50 font-medium text-xs">Sisa</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredUsage.map((u, i) => (
                      <motion.tr
                        key={u.id}
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        transition={{ delay: i * 0.02 }}
                        className="border-b border-purple-500/5 hover:bg-purple-500/5 transition-colors"
                      >
                        <td className="py-3 px-3">
                          <div>
                            <p className="text-white text-xs truncate max-w-[160px]">{u.email || '-'}</p>
                            <p className="text-white/30 text-[10px] truncate">{u.fullName || 'No name'}</p>
                          </div>
                        </td>
                        <td className="py-3 px-3">
                          <code className="text-amber-300 font-mono text-xs">{u.promoCode}</code>
                        </td>
                        <td className="py-3 px-3">
                          <Badge className={`text-[10px] ${
                            u.isCurrentlyActive
                              ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30'
                              : 'bg-red-500/20 text-red-300 border-red-500/30'
                          }`}>
                            {u.isCurrentlyActive ? 'Aktif' : 'Expired'}
                          </Badge>
                        </td>
                        <td className="py-3 px-3 text-white/60 text-xs">{u.discountPercent}%</td>
                        <td className="py-3 px-3 text-white/40 text-xs">{formatDate(u.startDate)}</td>
                        <td className="py-3 px-3 text-white/40 text-xs">{formatDate(u.endDate)}</td>
                        <td className="py-3 px-3">
                          {u.isCurrentlyActive ? (
                            <span className="text-emerald-400 text-xs font-medium">
                              {getDaysRemaining(u.endDate)} hari
                            </span>
                          ) : (
                            <span className="text-red-400/50 text-xs">-</span>
                          )}
                        </td>
                      </motion.tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* All PRO Users (from profiles table) */}
      {data.proUsersFromProfiles && data.proUsersFromProfiles.length > 0 && (
        <div className="space-y-4">
          <h3 className="text-sm font-semibold text-white/70 flex items-center gap-2">
            <Crown className="w-4 h-4 text-emerald-400" />
            Semua User PRO (Profiles)
            <Badge variant="outline" className="border-white/10 text-white/40 text-[10px]">
              {data.proUsersFromProfiles.length} user
            </Badge>
          </h3>
          <Card className="bg-[#1a0f2e]/50 border-emerald-500/20">
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <table className="w-full text-sm hidden md:table">
                  <thead>
                    <tr className="border-b border-emerald-500/20">
                      <th className="text-left py-3 px-3 text-white/50 font-medium text-xs">User</th>
                      <th className="text-left py-3 px-3 text-white/50 font-medium text-xs">Plan</th>
                      <th className="text-left py-3 px-3 text-white/50 font-medium text-xs">Berlangganan Sampai</th>
                      <th className="text-left py-3 px-3 text-white/50 font-medium text-xs">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.proUsersFromProfiles.map((p, i) => {
                      const isActive = p.subscriptionUntil && new Date(p.subscriptionUntil) > new Date()
                      const daysLeft = p.subscriptionUntil ? getDaysRemaining(p.subscriptionUntil) : 0
                      return (
                        <tr key={p.id} className="border-b border-emerald-500/5 hover:bg-emerald-500/5 transition-colors">
                          <td className="py-3 px-3">
                            <div>
                              <p className="text-white text-xs truncate max-w-[200px]">{p.email || '-'}</p>
                              <p className="text-white/30 text-[10px] truncate">{p.fullName || 'No name'}</p>
                            </div>
                          </td>
                          <td className="py-3 px-3">
                            <Badge className="text-[10px] bg-amber-500/20 text-amber-300 border-amber-500/30">{p.plan}</Badge>
                          </td>
                          <td className="py-3 px-3 text-white/40 text-xs">{formatDate(p.subscriptionUntil)}</td>
                          <td className="py-3 px-3">
                            {isActive ? (
                              <span className="text-emerald-400 text-xs">{daysLeft} hari tersisa</span>
                            ) : (
                              <span className="text-red-400 text-xs">Expired</span>
                            )}
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
                {/* Mobile cards */}
                <div className="md:hidden space-y-2 p-3">
                  {data.proUsersFromProfiles.map((p) => {
                    const isActive = p.subscriptionUntil && new Date(p.subscriptionUntil) > new Date()
                    const daysLeft = p.subscriptionUntil ? getDaysRemaining(p.subscriptionUntil) : 0
                    return (
                      <div key={p.id} className="bg-white/[0.03] border border-emerald-500/10 rounded-xl p-3">
                        <div className="flex items-start justify-between">
                          <div className="min-w-0">
                            <p className="text-sm text-white font-medium truncate">{p.email || '-'}</p>
                            <p className="text-[10px] text-white/30">{p.fullName || 'No name'}</p>
                          </div>
                          <Badge className={`text-[10px] flex-shrink-0 ${isActive ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30' : 'bg-red-500/20 text-red-300 border-red-500/30'}`}>
                            {isActive ? `${daysLeft}h` : 'Expired'}
                          </Badge>
                        </div>
                        <div className="flex gap-4 mt-2 text-[11px] text-white/40">
                          <span>Plan: <span className="text-amber-300">{p.plan}</span></span>
                          <span>Sampai: <span className="text-white/60">{formatDate(p.subscriptionUntil)}</span></span>
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* ── Edit Quota Dialog ── */}
      <Dialog open={!!editQuotaPromo} onOpenChange={(open) => { if (!open) setEditQuotaPromo(null) }}>
        <DialogContent className="bg-[#1a0f2e] border-purple-500/30 text-white max-w-sm">
          <DialogHeader>
            <DialogTitle className="text-amber-300">Ubah Kuota Promo</DialogTitle>
            <DialogDescription className="text-white/40 text-xs">
              Promo: <code className="text-amber-300">{editQuotaPromo?.code}</code> — saat ini {editQuotaPromo?.usedQuota}/{editQuotaPromo?.maxQuota} terpakai
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 mt-4">
            <div>
              <label className="text-xs text-white/50 mb-1 block">Max Kuota Baru</label>
              <Input
                type="number"
                value={editQuotaValue}
                onChange={(e) => setEditQuotaValue(e.target.value)}
                min={1}
                className="bg-black/30 border-white/10 text-white"
              />
              <p className="text-[10px] text-white/30 mt-1">
                Kuota tersisa akan otomatis dihitung: {editQuotaPromo ? Math.max(0, parseInt(editQuotaValue || '0') - editQuotaPromo.usedQuota) : 0}
              </p>
            </div>
            <div className="flex gap-3">
              <Button
                variant="outline"
                onClick={() => setEditQuotaPromo(null)}
                className="flex-1 border-white/20 text-white/60"
              >
                Batal
              </Button>
              <Button
                onClick={handleSaveQuota}
                disabled={!editQuotaValue || parseInt(editQuotaValue) < 1 || savingQuota}
                className="flex-1 bg-amber-500 hover:bg-amber-600 text-black font-bold"
              >
                {savingQuota ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <CheckCircle className="w-4 h-4 mr-2" />}
                Simpan
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* ── Delete Confirmation Dialog ── */}
      <Dialog open={!!deleteTarget} onOpenChange={(open) => { if (!open) setDeleteTarget(null) }}>
        <DialogContent className="bg-[#1a0f2e] border-red-500/30 text-white max-w-sm">
          <DialogHeader>
            <DialogTitle className="text-red-400">Hapus Promo Code?</DialogTitle>
            <DialogDescription className="text-white/50 text-xs">
              Anda akan menghapus promo code <code className="text-amber-300">{deleteTarget?.code}</code>.
              <br />
              <span className="text-amber-300/80 mt-2 inline-block">
                ⚠ {deleteTarget?.usedQuota} user sudah menggunakan kode ini. Mereka tetap PRO sampai masa berlangganan habis.
              </span>
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 mt-4">
            <div className="flex gap-3">
              <Button
                variant="outline"
                onClick={() => setDeleteTarget(null)}
                className="flex-1 border-white/20 text-white/60"
              >
                Batal
              </Button>
              <Button
                onClick={handleDeletePromo}
                disabled={deleting}
                className="flex-1 bg-red-500 hover:bg-red-600 text-white font-bold"
              >
                {deleting ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Trash2 className="w-4 h-4 mr-2" />}
                Hapus
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

    </motion.div>
  )
}
