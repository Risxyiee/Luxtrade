'use client'

import { useState, useEffect, useCallback } from 'react'
import { motion } from 'framer-motion'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Crown, Tag, Users, Clock, RefreshCw,
  CheckCircle, XCircle, AlertTriangle, Loader2,
  TrendingUp, Zap, Copy, Eye, EyeOff
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
}

export default function ProPromoTab() {
  const [data, setData] = useState<ProPromoData | null>(null)
  const [loading, setLoading] = useState(true)
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null)
  const [showExpired, setShowExpired] = useState(false)
  const [expandedCode, setExpandedCode] = useState<string | null>(null)

  const fetchData = useCallback(async () => {
    try {
      const res = await authFetch('/api/admin/pro-promo-log')
      const json = await res.json()
      if (res.ok) {
        setData(json)
        setLastUpdated(new Date())
      } else {
        console.error('[ProPromoTab] Fetch error:', json.error)
      }
    } catch (err) {
      console.error('[ProPromoTab] Network error:', err)
    } finally {
      setLoading(false)
    }
  }, [])

  // Fetch on mount
  useEffect(() => { fetchData() }, [fetchData])

  // Auto-refresh every 10 seconds for realtime updates
  useEffect(() => {
    const interval = setInterval(() => {
      if (document.visibilityState === 'visible') {
        fetchData()
      }
    }, 10_000) // 10 seconds
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
        <Button onClick={fetchData} variant="outline" className="mt-4 border-amber-500/30 text-amber-400">
          <RefreshCw className="w-4 h-4 mr-2" /> Coba Lagi
        </Button>
      </div>
    )
  }

  // Filter promo usage
  const filteredUsage = showExpired
    ? data.promoUsage
    : data.promoUsage.filter(u => u.isCurrentlyActive)

  // Group usage by promo code
  const usageByCode = new Map<string, PromoUsage[]>()
  filteredUsage.forEach(u => {
    const list = usageByCode.get(u.promoCode) || []
    list.push(u)
    usageByCode.set(u.promoCode, list)
  })

  return (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">

      {/* ── Realtime Header ── */}
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

      {/* ── Summary Stats ── */}
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

      {/* ── Promo Code Cards ── */}
      <div className="space-y-4">
        <h3 className="text-sm font-semibold text-white/70 flex items-center gap-2">
          <Tag className="w-4 h-4 text-amber-400" />
          Promo Codes
          <Badge variant="outline" className="border-white/10 text-white/40 text-[10px]">
            {data.promoCodes.length} kode
          </Badge>
        </h3>

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
                      <div className="flex items-center gap-2">
                        <code className="text-amber-300 font-bold text-sm tracking-wider">{promo.code}</code>
                        <button onClick={() => copyCode(promo.code)} className="text-white/30 hover:text-white transition-colors">
                          <Copy className="w-3 h-3" />
                        </button>
                      </div>
                      <Badge className={
                        promo.isActive
                          ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30 text-[10px]'
                          : 'bg-red-500/20 text-red-300 border-red-500/30 text-[10px]'
                      }>
                        {promo.isActive ? '● Aktif' : '● Nonaktif'}
                      </Badge>
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
                        <p className="text-sm font-bold text-white/70">{promo.discountPercent}%</p>
                        <p className="text-[9px] text-white/30 uppercase">Diskon</p>
                      </div>
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
      </div>

      {/* ── Promo Usage Table ── */}
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

    </motion.div>
  )
}
