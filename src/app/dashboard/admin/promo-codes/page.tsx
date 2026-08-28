'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import {
  ArrowLeft, Plus, Loader2, RefreshCw, Tag, Users,
  Copy, Check, AlertTriangle, DatabaseBackup, Clock,
  Crown, Zap, BarChart3, Mail, Calendar, Shield,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { toast } from 'sonner'
import { motion, AnimatePresence } from 'framer-motion'
import { supabase } from '@/lib/supabase'
import { authFetch } from '@/lib/api-fetch'

const ADMIN_EMAILS = ['luxtradee@gmail.com', 'riskiakbarp123@gmail.com']

// --- Types ---
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
  email: string
  fullName: string | null
  promoCode: string
  plan: string | null
  status: string | null
  discountPercent: number
  startDate: string | null
  endDate: string | null
  isCurrentlyActive: boolean
  isExpired: boolean
  createdAt: string
}

interface Summary {
  totalPromoCodes: number
  activePromoCodes: number
  totalQuotaUsed: number
  totalQuotaRemaining: number
}

interface PromoData {
  promoCodes: PromoCode[]
  promoUsage: PromoUsage[]
  totalProUsers: number
  summary: Summary
  missingTables?: string[]
  error?: string
}

// --- Components ---

function QuotaBar({ used, max }: { used: number; max: number }) {
  const pct = max > 0 ? Math.min((used / max) * 100, 100) : 0
  const barColor = pct >= 100 ? 'bg-red-500' : pct >= 75 ? 'bg-amber-500' : 'bg-emerald-500'
  return (
    <div className="space-y-1">
      <div className="flex justify-between text-xs text-gray-400">
        <span>{used} digunakan</span>
        <span>{max - used > 0 ? max - used : 0} sisa</span>
      </div>
      <div className="h-2 w-full bg-white/10 rounded-full overflow-hidden">
        <motion.div
          initial={{ width: 0 }}
          animate={{ width: `${pct}%` }}
          transition={{ duration: 0.6, ease: 'easeOut' }}
          className={`h-full rounded-full ${barColor}`}
        />
      </div>
      <div className="text-xs text-gray-500 text-right">{used}/{max} ({pct.toFixed(0)}%)</div>
    </div>
  )
}

function PromoCodeCard({ promo, usageList }: { promo: PromoCode; usageList: PromoUsage[] }) {
  const [copied, setCopied] = useState(false)
  const usersForCode = usageList.filter(u => u.promoCode === promo.code)

  const handleCopy = () => {
    navigator.clipboard.writeText(promo.code)
    setCopied(true)
    toast.success(`Kode ${promo.code} disalin!`)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
    >
      <Card className="bg-[#0e1117]/80 backdrop-blur-xl border-white/[0.06] hover:border-white/[0.12] transition-colors">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Tag className="h-4 w-4 text-cyan-400" />
              <CardTitle className="text-base font-mono text-white tracking-wide">
                {promo.code}
              </CardTitle>
              <Badge
                className={promo.isActive
                  ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30 text-[10px]'
                  : 'bg-red-500/20 text-red-300 border-red-500/30 text-[10px]'
                }
              >
                {promo.isActive ? 'Aktif' : 'Nonaktif'}
              </Badge>
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={handleCopy}
              className="h-7 w-7 p-0 text-gray-400 hover:text-white hover:bg-white/10"
            >
              {copied ? <Check className="h-3.5 w-3.5 text-emerald-400" /> : <Copy className="h-3.5 w-3.5" />}
            </Button>
          </div>
          <CardDescription className="text-xs text-gray-500 mt-1">
            Dibuat {new Date(promo.createdAt).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' })}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <QuotaBar used={promo.usedQuota} max={promo.maxQuota} />
          <div className="flex items-center gap-4 text-xs text-gray-400">
            <span className="flex items-center gap-1">
              <Zap className="h-3 w-3 text-amber-400" />
              Diskon {promo.discountPercent}%
            </span>
            <span className="flex items-center gap-1">
              <Clock className="h-3 w-3 text-cyan-400" />
              {promo.durationMonths} bulan
            </span>
            <span className="flex items-center gap-1">
              <Users className="h-3 w-3 text-blue-400" />
              {usersForCode.length} user
            </span>
          </div>
          {usersForCode.length > 0 && (
            <div className="space-y-1 pt-1 border-t border-white/5">
              <p className="text-[10px] text-gray-500 uppercase tracking-wider">Pengguna</p>
              <div className="flex flex-wrap gap-1">
                {usersForCode.slice(0, 5).map(u => (
                  <Badge key={u.id} variant="outline" className="text-[10px] bg-white/5 border-white/10 text-gray-300">
                    {u.email}
                  </Badge>
                ))}
                {usersForCode.length > 5 && (
                  <Badge variant="outline" className="text-[10px] bg-white/5 border-white/10 text-gray-400">
                    +{usersForCode.length - 5} lainnya
                  </Badge>
                )}
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </motion.div>
  )
}

function UsageTable({ usage }: { usage: PromoUsage[] }) {
  const formatDate = (d: string | null) => {
    if (!d) return '-'
    return new Date(d).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' })
  }

  return (
    <>
      {/* Desktop Table */}
      <div className="hidden md:block overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-white/10 text-left text-xs text-gray-500 uppercase tracking-wider">
              <th className="pb-3 pr-4">Email</th>
              <th className="pb-3 pr-4">Nama</th>
              <th className="pb-3 pr-4">Kode Promo</th>
              <th className="pb-3 pr-4">Diskon</th>
              <th className="pb-3 pr-4">Mulai</th>
              <th className="pb-3 pr-4">Berakhir</th>
              <th className="pb-3 text-right">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-white/5">
            {usage.map((u, i) => (
              <motion.tr
                key={u.id}
                initial={{ opacity: 0, x: -8 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: i * 0.03, duration: 0.25 }}
                className="hover:bg-white/[0.03] transition-colors"
              >
                <td className="py-3 pr-4 text-gray-300 font-mono text-xs">{u.email}</td>
                <td className="py-3 pr-4 text-white">{u.fullName || '-'}</td>
                <td className="py-3 pr-4">
                  <Badge variant="outline" className="font-mono text-xs bg-blue-500/10 border-white/[0.06] text-cyan-300">
                    {u.promoCode}
                  </Badge>
                </td>
                <td className="py-3 pr-4 text-amber-400">{u.discountPercent}%</td>
                <td className="py-3 pr-4 text-gray-400 text-xs">{formatDate(u.startDate)}</td>
                <td className="py-3 pr-4 text-gray-400 text-xs">{formatDate(u.endDate)}</td>
                <td className="py-3 text-right">
                  {u.isCurrentlyActive ? (
                    <Badge className="bg-emerald-500/20 text-emerald-300 border-emerald-500/30 text-[10px]">
                      <Zap className="h-2.5 w-2.5 mr-1" />Aktif
                    </Badge>
                  ) : u.isExpired ? (
                    <Badge className="bg-red-500/20 text-red-300 border-red-500/30 text-[10px]">
                      <Clock className="h-2.5 w-2.5 mr-1" />Expired
                    </Badge>
                  ) : (
                    <Badge className="bg-gray-500/20 text-gray-300 border-gray-500/30 text-[10px]">
                      {u.status || 'Unknown'}
                    </Badge>
                  )}
                </td>
              </motion.tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Mobile Cards */}
      <div className="md:hidden space-y-3">
        {usage.map((u, i) => (
          <motion.div
            key={u.id}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.04, duration: 0.3 }}
          >
            <Card className="bg-[#0e1117]/80 backdrop-blur-xl border-white/[0.06] p-4">
              <div className="flex items-start justify-between mb-2">
                <div className="space-y-0.5">
                  <p className="text-white text-sm font-medium">{u.fullName || u.email}</p>
                  <p className="text-gray-500 text-xs font-mono">{u.email}</p>
                </div>
                {u.isCurrentlyActive ? (
                  <Badge className="bg-emerald-500/20 text-emerald-300 border-emerald-500/30 text-[10px]">
                    <Zap className="h-2.5 w-2.5 mr-1" />Aktif
                  </Badge>
                ) : u.isExpired ? (
                  <Badge className="bg-red-500/20 text-red-300 border-red-500/30 text-[10px]">
                    <Clock className="h-2.5 w-2.5 mr-1" />Expired
                  </Badge>
                ) : (
                  <Badge className="bg-gray-500/20 text-gray-300 border-gray-500/30 text-[10px]">
                    {u.status || 'Unknown'}
                  </Badge>
                )}
              </div>
              <div className="flex items-center gap-2 text-xs text-gray-400">
                <Badge variant="outline" className="font-mono text-[10px] bg-blue-500/10 border-white/[0.06] text-cyan-300">
                  {u.promoCode}
                </Badge>
                <span className="text-amber-400">{u.discountPercent}% off</span>
              </div>
              <div className="flex items-center gap-3 text-[11px] text-gray-500 mt-2">
                <span className="flex items-center gap-1"><Calendar className="h-3 w-3" />{formatDate(u.startDate)}</span>
                <span>→</span>
                <span>{formatDate(u.endDate)}</span>
              </div>
            </Card>
          </motion.div>
        ))}
      </div>
    </>
  )
}

// --- Main Page ---
export default function PromoCodesPage() {
  const router = useRouter()
  const [isAdminUser, setIsAdminUser] = useState(false)
  const [checkingAuth, setCheckingAuth] = useState(true)
  const [data, setData] = useState<PromoData | null>(null)
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [syncing, setSyncing] = useState(false)
  const intervalRef = useRef<NodeJS.Timeout | null>(null)

  // Create promo form
  const [newCode, setNewCode] = useState('')
  const [newMaxQuota, setNewMaxQuota] = useState('30')
  const [newDuration, setNewDuration] = useState('3')
  const [newDiscount, setNewDiscount] = useState('100')
  const [creating, setCreating] = useState(false)

  // Auth check
  useEffect(() => {
    const checkAuth = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        toast.error('Silakan login terlebih dahulu')
        router.push('/auth/login')
        return
      }
      if (!user.email || !ADMIN_EMAILS.includes(user.email.toLowerCase())) {
        toast.error('Akses ditolak. Hanya admin.')
        router.push('/dashboard')
        return
      }
      setIsAdminUser(true)
      setCheckingAuth(false)
    }
    checkAuth()
  }, [router])

  // Fetch data
  const fetchData = useCallback(async (showToast = false) => {
    if (!isAdminUser) return
    setRefreshing(true)
    try {
      const res = await authFetch('/api/admin/pro-promo-log')
      const json = await res.json()
      if (res.ok) {
        setData(json)
      } else {
        if (showToast) toast.error(json.error || 'Gagal memuat data promo')
        setData(null)
      }
    } catch {
      if (showToast) toast.error('Gagal terhubung ke server')
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [isAdminUser])

  useEffect(() => {
    if (isAdminUser) fetchData()
  }, [isAdminUser, fetchData])

  // Auto-refresh every 10s when visible
  useEffect(() => {
    const handleVisibility = () => {
      if (document.visibilityState === 'visible') {
        fetchData()
      }
    }
    document.addEventListener('visibilitychange', handleVisibility)

    intervalRef.current = setInterval(() => {
      if (document.visibilityState === 'visible') {
        fetchData()
      }
    }, 10000)

    return () => {
      document.removeEventListener('visibilitychange', handleVisibility)
      if (intervalRef.current) clearInterval(intervalRef.current)
    }
  }, [fetchData])

  // Create promo
  const handleCreate = async () => {
    const code = newCode.trim().toUpperCase()
    if (!code) { toast.error('Kode promo tidak boleh kosong'); return }
    const maxQuota = parseInt(newMaxQuota, 10)
    const durationMonths = parseInt(newDuration, 10)
    const discountPercent = parseInt(newDiscount, 10)
    if (isNaN(maxQuota) || maxQuota < 1) { toast.error('Quota harus minimal 1'); return }
    if (isNaN(durationMonths) || durationMonths < 1) { toast.error('Durasi harus minimal 1 bulan'); return }
    if (isNaN(discountPercent) || discountPercent < 1 || discountPercent > 100) { toast.error('Diskon harus 1-100%'); return }

    setCreating(true)
    try {
      const res = await authFetch('/api/admin/pro-promo-log', {
        method: 'POST',
        body: JSON.stringify({ code, maxQuota, durationMonths, discountPercent }),
      })
      const json = await res.json()
      if (res.ok) {
        toast.success(json.message || `Promo ${code} berhasil dibuat!`)
        setNewCode('')
        fetchData()
      } else {
        toast.error(json.error || 'Gagal membuat promo')
      }
    } catch {
      toast.error('Gagal terhubung ke server')
    } finally {
      setCreating(false)
    }
  }

  // DB Sync
  const handleSync = async () => {
    setSyncing(true)
    try {
      const res = await authFetch('/api/admin/db-sync', { method: 'POST' })
      const json = await res.json()
      if (res.ok) {
        toast.success(`DB Sync berhasil! ${json.summary?.tablesCreated || 0} tabel dibuat.`)
        fetchData()
      } else {
        toast.error(json.error || 'Gagal sync database')
      }
    } catch {
      toast.error('Gagal terhubung ke server')
    } finally {
      setSyncing(false)
    }
  }

  // Loading / Auth screen
  if (checkingAuth) {
    return (
      <div className="min-h-screen bg-[#050507] flex items-center justify-center">
        <Loader2 className="h-8 w-8 text-cyan-400 animate-spin" />
      </div>
    )
  }

  if (!isAdminUser) return null

  const hasMissingTables = data?.missingTables && data.missingTables.length > 0

  return (
    <div className="min-h-screen bg-[#050507]">
      {/* Ambient Glow */}
      <div className="fixed top-0 left-1/2 -translate-x-1/2 w-[60%] h-[40%] pointer-events-none" aria-hidden="true" style={{ background: 'radial-gradient(circle, rgba(59,130,246,0.12) 0%, rgba(6,182,212,0.08) 30%, rgba(16,185,129,0.04) 50%, transparent 70%)' }} />
      {/* Header */}
      <header className="sticky top-0 z-50 bg-[#050507]/90 backdrop-blur-xl border-b border-white/[0.06] relative">
        <div className="max-w-6xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link href="/dashboard/admin">
              <Button variant="ghost" size="sm" className="text-gray-400 hover:text-white hover:bg-white/10 -ml-2">
                <ArrowLeft className="h-4 w-4 mr-1" />Kembali
              </Button>
            </Link>
            <div className="h-5 w-px bg-white/10" />
            <div className="flex items-center gap-2">
              <Tag className="h-4 w-4 text-cyan-400" />
              <h1 className="text-white font-semibold text-base">Promo Codes</h1>
              <Shield className="h-3 w-3 text-cyan-400/60" />
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="ghost" size="sm"
              onClick={() => fetchData(true)}
              disabled={refreshing}
              className="text-gray-400 hover:text-white hover:bg-white/10"
            >
              <RefreshCw className={`h-3.5 w-3.5 ${refreshing ? 'animate-spin' : ''}`} />
            </Button>
          </div>
        </div>
        <div className="absolute bottom-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-blue-500/40 to-transparent pointer-events-none" />
      </header>

      <main className="max-w-6xl mx-auto px-4 py-6 space-y-6">
        {/* DB Sync Warning */}
        <AnimatePresence>
          {hasMissingTables && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
            >
              <Card className="bg-red-950/40 border-red-500/40">
                <CardContent className="p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                  <div className="flex items-start gap-3">
                    <AlertTriangle className="h-5 w-5 text-red-400 mt-0.5 shrink-0" />
                    <div>
                      <p className="text-red-200 font-medium text-sm">Tabel database belum ada</p>
                      <p className="text-red-300/70 text-xs mt-0.5">
                        Tabel yang hilang: {data.missingTables!.join(', ')}
                      </p>
                    </div>
                  </div>
                  <Button
                    onClick={handleSync}
                    disabled={syncing}
                    className="bg-red-600 hover:bg-red-500 text-white shrink-0"
                  >
                    {syncing ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <DatabaseBackup className="h-4 w-4 mr-2" />}
                    Sync Database
                  </Button>
                </CardContent>
              </Card>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Create New Promo */}
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}>
          <Card className="bg-[#0e1117]/80 backdrop-blur-xl border-white/[0.06]">
            <CardHeader className="pb-4">
              <CardTitle className="text-white flex items-center gap-2 text-base">
                <Plus className="h-4 w-4 text-amber-400" />
                Buat Promo Baru
              </CardTitle>
              <CardDescription className="text-gray-500 text-xs">
                Buat kode promo baru untuk memberikan akses Pro kepada pengguna.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
                <div className="sm:col-span-2 lg:col-span-1">
                  <label className="text-[11px] text-gray-500 uppercase tracking-wider mb-1 block">Kode Promo</label>
                  <Input
                    value={newCode}
                    onChange={e => setNewCode(e.target.value)}
                    placeholder="CONTOHKODE"
                    className="bg-white/5 border-white/10 text-white placeholder:text-gray-600 h-10 font-mono uppercase"
                  />
                </div>
                <div>
                  <label className="text-[11px] text-gray-500 uppercase tracking-wider mb-1 block">Max Quota</label>
                  <Input
                    type="number" min="1"
                    value={newMaxQuota}
                    onChange={e => setNewMaxQuota(e.target.value)}
                    className="bg-white/5 border-white/10 text-white h-10"
                  />
                </div>
                <div>
                  <label className="text-[11px] text-gray-500 uppercase tracking-wider mb-1 block">Durasi (Bulan)</label>
                  <Input
                    type="number" min="1"
                    value={newDuration}
                    onChange={e => setNewDuration(e.target.value)}
                    className="bg-white/5 border-white/10 text-white h-10"
                  />
                </div>
                <div>
                  <label className="text-[11px] text-gray-500 uppercase tracking-wider mb-1 block">Diskon (%)</label>
                  <Input
                    type="number" min="1" max="100"
                    value={newDiscount}
                    onChange={e => setNewDiscount(e.target.value)}
                    className="bg-white/5 border-white/10 text-white h-10"
                  />
                </div>
                <div className="flex items-end">
                  <Button
                    onClick={handleCreate}
                    disabled={creating || !newCode.trim()}
                    className="w-full bg-blue-600 hover:bg-blue-500 text-white h-10"
                  >
                    {creating ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Plus className="h-4 w-4 mr-2" />}
                    Buat Promo
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        </motion.div>

        {/* Summary Cards */}
        {data && !hasMissingTables && data.summary && (
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="grid grid-cols-2 lg:grid-cols-4 gap-3"
          >
            {[
              { label: 'Total Kode', value: data.summary.totalPromoCodes, icon: Tag, color: 'text-cyan-400', bg: 'bg-blue-500/10' },
              { label: 'Kode Aktif', value: data.summary.activePromoCodes, icon: Zap, color: 'text-emerald-400', bg: 'bg-emerald-500/10' },
              { label: 'Total Terpakai', value: data.summary.totalQuotaUsed, icon: Users, color: 'text-amber-400', bg: 'bg-amber-500/10' },
              { label: 'Sisa Quota', value: data.summary.totalQuotaRemaining, icon: BarChart3, color: 'text-blue-400', bg: 'bg-blue-500/10' },
            ].map(s => (
              <Card key={s.label} className="bg-[#0e1117]/80 backdrop-blur-xl border-white/5">
                <CardContent className="p-4">
                  <div className="flex items-center gap-2 mb-1">
                    <div className={`p-1.5 rounded-md ${s.bg}`}>
                      <s.icon className={`h-3.5 w-3.5 ${s.color}`} />
                    </div>
                    <span className="text-[11px] text-gray-500 uppercase tracking-wider">{s.label}</span>
                  </div>
                  <p className="text-2xl font-bold text-white">{s.value}</p>
                </CardContent>
              </Card>
            ))}
          </motion.div>
        )}

        {/* Loading state */}
        {loading && !data && (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="h-6 w-6 text-cyan-400 animate-spin" />
          </div>
        )}

        {/* Promo Codes List */}
        {data && !hasMissingTables && (
          <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}>
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-white font-semibold flex items-center gap-2">
                <Crown className="h-4 w-4 text-amber-400" />
                Semua Kode Promo
                <Badge variant="outline" className="text-[10px] bg-white/5 border-white/10 text-gray-400">
                  {data.promoCodes?.length || 0}
                </Badge>
              </h2>
            </div>

            {data.promoCodes && data.promoCodes.length > 0 ? (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {data.promoCodes.map(promo => (
                  <PromoCodeCard key={promo.id} promo={promo} usageList={data.promoUsage || []} />
                ))}
              </div>
            ) : (
              <Card className="bg-white/[0.03] border-dashed border-white/10">
                <CardContent className="py-12 text-center">
                  <Tag className="h-8 w-8 text-gray-600 mx-auto mb-3" />
                  <p className="text-gray-500 text-sm">Belum ada kode promo</p>
                  <p className="text-gray-600 text-xs mt-1">Buat kode promo baru di atas untuk memulai.</p>
                </CardContent>
              </Card>
            )}
          </motion.div>
        )}

        {/* Usage Table */}
        {data && !hasMissingTables && data.promoUsage && data.promoUsage.length > 0 && (
          <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.4 }}>
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-white font-semibold flex items-center gap-2">
                <Mail className="h-4 w-4 text-cyan-400" />
                Penggunaan Promo
                <Badge variant="outline" className="text-[10px] bg-white/5 border-white/10 text-gray-400">
                  {data.promoUsage.length}
                </Badge>
              </h2>
            </div>
            <Card className="bg-[#0e1117]/80 backdrop-blur-xl border-white/[0.06]">
              <CardContent className="p-4 max-h-[500px] overflow-y-auto">
                <UsageTable usage={data.promoUsage} />
              </CardContent>
            </Card>
          </motion.div>
        )}

        {/* Empty usage state */}
        {data && !hasMissingTables && data.promoUsage && data.promoUsage.length === 0 && data.promoCodes && data.promoCodes.length > 0 && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.4 }}>
            <Card className="bg-white/[0.03] border-dashed border-white/10">
              <CardContent className="py-12 text-center">
                <Users className="h-8 w-8 text-gray-600 mx-auto mb-3" />
                <p className="text-gray-500 text-sm">Belum ada penggunaan promo</p>
                <p className="text-gray-600 text-xs mt-1">Pengguna yang menggunakan kode promo akan muncul di sini.</p>
              </CardContent>
            </Card>
          </motion.div>
        )}

        {/* Auto-refresh indicator */}
        {!loading && data && (
          <p className="text-center text-[10px] text-gray-600 pb-4">
            <RefreshCw className="h-3 w-3 inline mr-1" />
            Auto-refresh setiap 10 detik
          </p>
        )}
      </main>
    </div>
  )
}
