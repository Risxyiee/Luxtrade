'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import {
  Users, Wallet, Clock, CheckCircle2, ChevronDown, ChevronUp,
  Loader2, ShieldX, RefreshCw, Banknote, ArrowLeft,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Card, CardContent, CardHeader, CardTitle, CardDescription,
} from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table'
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel,
  AlertDialogContent, AlertDialogDescription, AlertDialogFooter,
  AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { toast } from 'sonner'
import { supabase } from '@/lib/supabase'
import Link from 'next/link'

// ─── Types ──────────────────────────────────────────────────────────────────

interface Affiliate {
  id: string
  email: string
  referralCode: string
  totalReferrals: number
  totalEarned: number
  balance: number
  withdrawals: Withdrawal[]
}

interface Withdrawal {
  id: string
  amount: number
  status: 'REQUESTED' | 'PAID' | 'REJECTED'
  bankInfo: string
  createdAt: string
}

// ─── Helpers ────────────────────────────────────────────────────────────────

const formatRupiah = (value: number): string => {
  return new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value)
}

const formatDate = (date: string): string => {
  return new Intl.DateTimeFormat('id-ID', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(date))
}

const statusBadge = (status: string) => {
  switch (status) {
    case 'REQUESTED':
      return (
        <Badge className="bg-amber-500/15 text-amber-400 border-amber-500/25 hover:bg-amber-500/20">
          <Clock className="w-3 h-3 mr-1" />
          Pending
        </Badge>
      )
    case 'PAID':
      return (
        <Badge className="bg-emerald-500/15 text-emerald-400 border-emerald-500/25 hover:bg-emerald-500/20">
          <CheckCircle2 className="w-3 h-3 mr-1" />
          Dibayar
        </Badge>
      )
    case 'REJECTED':
      return (
        <Badge className="bg-red-500/15 text-red-400 border-red-500/25 hover:bg-red-500/20">
          Ditolak
        </Badge>
      )
    default:
      return <Badge variant="outline">{status}</Badge>
  }
}

// ─── Stat Card ──────────────────────────────────────────────────────────────

function StatCard({
  icon: Icon,
  label,
  value,
  sub,
  accent,
}: {
  icon: React.ElementType
  label: string
  value: string
  sub?: string
  accent: string
}) {
  return (
    <Card className="bg-[#0e1117]/80 backdrop-blur-xl border-white/[0.06] relative overflow-hidden group hover:border-white/[0.06] transition-colors">
      <div
        className={`absolute top-0 left-0 w-full h-[2px] bg-gradient-to-r ${accent}`}
      />
      <CardContent className="p-5">
        <div className="flex items-start justify-between">
          <div className="space-y-1">
            <p className="text-xs font-medium text-[#8892b0] uppercase tracking-wider">
              {label}
            </p>
            <p className="text-2xl font-bold text-white">{value}</p>
            {sub && <p className="text-xs text-white/30">{sub}</p>}
          </div>
          <div
            className={`p-2.5 rounded-xl bg-gradient-to-br ${accent} opacity-20 group-hover:opacity-30 transition-opacity`}
          >
            <Icon className="w-5 h-5 text-white" />
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

// ─── Loading Skeleton ──────────────────────────────────────────────────────

function TableSkeleton({ rows = 5 }: { rows?: number }) {
  return (
    <div className="space-y-3 p-4">
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="flex items-center gap-4">
          <Skeleton className="h-4 w-48 bg-white/[0.06]" />
          <Skeleton className="h-4 w-24 bg-white/[0.06]" />
          <Skeleton className="h-4 w-32 bg-white/[0.06]" />
          <Skeleton className="h-4 w-28 bg-white/[0.06]" />
          <Skeleton className="h-8 w-32 bg-white/[0.06] rounded-md" />
        </div>
      ))}
    </div>
  )
}

// ─── Main Page ──────────────────────────────────────────────────────────────

export default function AffiliateManagementPage() {
  const router = useRouter()

  // Auth
  const [checkingAuth, setCheckingAuth] = useState(true)
  const [isAuthorized, setIsAuthorized] = useState(false)

  // Data
  const [affiliates, setAffiliates] = useState<Affiliate[]>([])
  const [pendingWithdrawals, setPendingWithdrawals] = useState<Withdrawal[]>([])
  const [loadingData, setLoadingData] = useState(true)

  // Dialog
  const [confirmWithdrawal, setConfirmWithdrawal] = useState<Withdrawal | null>(null)
  const [markingPaid, setMarkingPaid] = useState(false)

  // Expanded rows
  const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set())

  // ─── Auth check ────────────────────────────────────────────────────────
  const ADMIN_EMAILS = ['luxtradee@gmail.com', 'riskiakbarp123@gmail.com']

  useEffect(() => {
    const checkAuth = async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser()

        if (!user) {
          setIsAuthorized(false)
          setCheckingAuth(false)
          return
        }

        // Check admin by email (matches middleware + admin-auth.ts)
        const email = user.email?.toLowerCase() || ''
        if (ADMIN_EMAILS.includes(email)) {
          setIsAuthorized(true)
        } else {
          // Fallback: check role in profile
          const { data: profile } = await supabase
            .from('profiles')
            .select('role')
            .eq('id', user.id)
            .single()

          if (profile?.role === 'ADMIN' || profile?.role === 'SUPER_ADMIN') {
            setIsAuthorized(true)
          } else {
            setIsAuthorized(false)
          }
        }
      } catch {
        setIsAuthorized(false)
      } finally {
        setCheckingAuth(false)
      }
    }
    checkAuth()
  }, [])

  // ─── Fetch data ────────────────────────────────────────────────────────
  const fetchData = useCallback(async () => {
    if (!isAuthorized) return
    setLoadingData(true)

    try {
      const [affRes, wdRes] = await Promise.all([
        fetch('/api/admin/affiliates', { credentials: 'include' }),
        fetch('/api/admin/affiliate-withdrawals?status=REQUESTED', { credentials: 'include' }),
      ])

      if (affRes.ok) {
        const affData = await affRes.json()
        setAffiliates(affData.affiliates ?? [])
      } else {
        toast.error('Gagal memuat data affiliate')
      }

      if (wdRes.ok) {
        const wdData = await wdRes.json()
        setPendingWithdrawals(wdData.withdrawals ?? [])
      }
    } catch {
      toast.error('Gagal terhubung ke server')
    } finally {
      setLoadingData(false)
    }
  }, [isAuthorized])

  useEffect(() => {
    if (isAuthorized) fetchData()
  }, [isAuthorized, fetchData])

  // ─── Derived stats ─────────────────────────────────────────────────────
  const totalAffiliates = affiliates.length
  const totalPaid = affiliates.reduce(
    (sum, a) => sum + (a.withdrawals?.filter((w) => w.status === 'PAID').reduce((s, w) => s + w.amount, 0) ?? 0),
    0,
  )
  const pendingCount = pendingWithdrawals.length

  // ─── Mark as paid ──────────────────────────────────────────────────────
  const handleMarkPaid = async () => {
    if (!confirmWithdrawal) return
    setMarkingPaid(true)
    try {
      const res = await fetch('/api/admin/affiliate-withdrawals', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ withdrawalId: confirmWithdrawal.id }),
      })

      if (res.ok) {
        toast.success('Withdrawal berhasil ditandai sebagai dibayar')
        setPendingWithdrawals((prev) => prev.filter((w) => w.id !== confirmWithdrawal.id))
        // Refresh affiliates to update balance
        fetchData()
      } else {
        const data = await res.json()
        toast.error(data.error || 'Gagal memproses withdrawal')
      }
    } catch {
      toast.error('Gagal terhubung ke server')
    } finally {
      setMarkingPaid(false)
      setConfirmWithdrawal(null)
    }
  }

  // ─── Toggle expanded row ───────────────────────────────────────────────
  const toggleRow = (id: string) => {
    setExpandedRows((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  // ─── Render: Auth checking ─────────────────────────────────────────────
  if (checkingAuth) {
    return (
      <div className="min-h-screen bg-[#050507] flex items-center justify-center">
        <Loader2 className="w-8 h-8 text-blue-500 animate-spin" />
      </div>
    )
  }

  // ─── Render: Access denied ─────────────────────────────────────────────
  if (!isAuthorized) {
    return (
      <div className="min-h-screen bg-[#050507] flex flex-col items-center justify-center gap-6 px-4">
        <div className="p-4 rounded-2xl bg-red-500/10 border border-red-500/20">
          <ShieldX className="w-12 h-12 text-red-400" />
        </div>
        <div className="text-center space-y-2">
          <h1 className="text-2xl font-bold text-white">Access Denied</h1>
          <p className="text-[#8892b0] max-w-md">
            Anda tidak memiliki akses ke halaman ini. Halaman ini hanya untuk admin.
          </p>
        </div>
        <Link href="/dashboard">
          <Button variant="outline" className="border-white/[0.06] text-[#8892b0] hover:text-[#f0f2ff] hover:bg-white/[0.03]">
            <ArrowLeft className="w-4 h-4 mr-2" />
            Kembali ke Dashboard
          </Button>
        </Link>
      </div>
    )
  }

  // ─── Render: Main content ──────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-[#050507] relative">
      {/* Ambient glow */}
      <div className="fixed top-0 left-1/2 -translate-x-1/2 w-[60%] h-[40%] pointer-events-none" aria-hidden="true" style={{ background: 'radial-gradient(circle, rgba(59,130,246,0.12) 0%, rgba(6,182,212,0.08) 30%, rgba(16,185,129,0.04) 50%, transparent 70%)' }} />
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
        {/* ── Header ──────────────────────────────────────────────── */}
        <div className="bg-[#050507]/90 backdrop-blur-xl border border-white/[0.06] rounded-xl p-4 sm:p-6 relative flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div className="absolute bottom-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-blue-500/40 to-transparent pointer-events-none" />
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-gradient-to-br from-blue-600 to-blue-800 shadow-lg shadow-blue-900/30">
              <Users className="w-5 h-5 text-white" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-white tracking-tight">
                Affiliate Management
              </h1>
              <p className="text-sm text-[#8892b0] mt-0.5">
                Kelola affiliate dan permintaan withdrawal
              </p>
            </div>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={fetchData}
            disabled={loadingData}
            className="border-white/[0.06] text-[#8892b0] hover:text-[#f0f2ff] hover:bg-white/[0.03] w-fit"
          >
            <RefreshCw className={`w-4 h-4 mr-1.5 ${loadingData ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
        </div>

        {/* ── Summary Stats ────────────────────────────────────────── */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <StatCard
            icon={Users}
            label="Total Affiliate"
            value={loadingData ? '—' : totalAffiliates.toString()}
            sub="Registered affiliates"
            accent="from-blue-600 to-blue-800"
          />
          <StatCard
            icon={Banknote}
            label="Total Komisi Dibayarkan"
            value={loadingData ? 'Rp —' : formatRupiah(totalPaid)}
            sub="All-time paid"
            accent="from-amber-500 to-yellow-600"
          />
          <StatCard
            icon={Clock}
            label="Pending Withdrawals"
            value={loadingData ? '—' : pendingCount.toString()}
            sub="Menunggu proses"
            accent="from-orange-500 to-red-500"
          />
        </div>

        {/* ── Pending Withdrawals ──────────────────────────────────── */}
        <Card className="bg-[#0e1117]/80 backdrop-blur-xl border-white/[0.06]">
          <CardHeader className="pb-4">
            <div className="flex items-center gap-2">
              <Wallet className="w-5 h-5 text-amber-400" />
              <CardTitle className="text-white text-lg">Permintaan Withdrawal Pending</CardTitle>
              {!loadingData && pendingCount > 0 && (
                <Badge className="bg-amber-500/15 text-amber-400 border-amber-500/25 ml-2">
                  {pendingCount}
                </Badge>
              )}
            </div>
            <CardDescription className="text-white/30">
              Daftar withdrawal yang menunggu persetujuan admin
            </CardDescription>
          </CardHeader>
          <CardContent className="p-0">
            {loadingData ? (
              <TableSkeleton rows={3} />
            ) : pendingWithdrawals.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 text-white/30 gap-2">
                <CheckCircle2 className="w-10 h-10 text-emerald-500/30" />
                <p className="text-sm font-medium">Tidak ada permintaan pending</p>
                <p className="text-xs text-white/20">Semua withdrawal sudah diproses</p>
              </div>
            ) : (
              <div className="overflow-x-auto max-h-96 overflow-y-auto">
                <Table>
                  <TableHeader>
                    <TableRow className="border-white/[0.06] hover:bg-transparent">
                      <TableHead className="text-[#8892b0] font-semibold text-xs uppercase tracking-wider">
                        Affiliate Email
                      </TableHead>
                      <TableHead className="text-[#8892b0] font-semibold text-xs uppercase tracking-wider">
                        Jumlah
                      </TableHead>
                      <TableHead className="text-[#8892b0] font-semibold text-xs uppercase tracking-wider hidden md:table-cell">
                        Info Bank
                      </TableHead>
                      <TableHead className="text-[#8892b0] font-semibold text-xs uppercase tracking-wider hidden sm:table-cell">
                        Tanggal Request
                      </TableHead>
                      <TableHead className="text-[#8892b0] font-semibold text-xs uppercase tracking-wider text-right">
                        Aksi
                      </TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {pendingWithdrawals.map((wd) => (
                      <TableRow
                        key={wd.id}
                        className="border-white/[0.06] hover:bg-white/[0.02] transition-colors"
                      >
                        <TableCell className="text-white/70 text-sm font-mono">
                          {wd.bankInfo ? (
                            <span className="block text-white/90">{wd.bankInfo.split('|')[0]?.trim() || 'N/A'}</span>
                          ) : '—'}
                        </TableCell>
                        <TableCell>
                          <span className="text-amber-400 font-semibold text-sm">
                            {formatRupiah(wd.amount)}
                          </span>
                        </TableCell>
                        <TableCell className="hidden md:table-cell">
                          <span className="text-[#8892b0] text-xs max-w-[200px] truncate block">
                            {wd.bankInfo || '—'}
                          </span>
                        </TableCell>
                        <TableCell className="hidden sm:table-cell">
                          <span className="text-[#8892b0] text-xs">{formatDate(wd.createdAt)}</span>
                        </TableCell>
                        <TableCell className="text-right">
                          <Button
                            size="sm"
                            onClick={() => setConfirmWithdrawal(wd)}
                            className="bg-emerald-600/90 hover:bg-emerald-600 text-white text-xs shadow-lg shadow-emerald-900/30"
                          >
                            <CheckCircle2 className="w-3.5 h-3.5 mr-1.5" />
                            Tandai Sudah Dibayar
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>

        {/* ── All Affiliates Table ─────────────────────────────────── */}
        <Card className="bg-[#0e1117]/80 backdrop-blur-xl border-white/[0.06]">
          <CardHeader className="pb-4">
            <div className="flex items-center gap-2">
              <Users className="w-5 h-5 text-cyan-400" />
              <CardTitle className="text-white text-lg">Daftar Affiliate</CardTitle>
              {!loadingData && (
                <Badge className="bg-blue-500/15 text-cyan-400 border-white/[0.06] ml-2">
                  {totalAffiliates}
                </Badge>
              )}
            </div>
            <CardDescription className="text-white/30">
              Semua affiliate yang terdaftar beserta statistik mereka
            </CardDescription>
          </CardHeader>
          <CardContent className="p-0">
            {loadingData ? (
              <TableSkeleton rows={6} />
            ) : affiliates.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 text-white/30 gap-2">
                <Users className="w-10 h-10 text-white/10" />
                <p className="text-sm font-medium">Belum ada affiliate</p>
                <p className="text-xs text-white/20">Data akan muncul saat ada user yang mendaftar sebagai affiliate</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow className="border-white/[0.06] hover:bg-transparent">
                      <TableHead className="text-[#8892b0] font-semibold text-xs uppercase tracking-wider w-8" />
                      <TableHead className="text-[#8892b0] font-semibold text-xs uppercase tracking-wider">
                        Email
                      </TableHead>
                      <TableHead className="text-[#8892b0] font-semibold text-xs uppercase tracking-wider hidden sm:table-cell">
                        Kode Referral
                      </TableHead>
                      <TableHead className="text-[#8892b0] font-semibold text-xs uppercase tracking-wider text-center">
                        Total Referral
                      </TableHead>
                      <TableHead className="text-[#8892b0] font-semibold text-xs uppercase tracking-wider text-right hidden md:table-cell">
                        Total Earned
                      </TableHead>
                      <TableHead className="text-[#8892b0] font-semibold text-xs uppercase tracking-wider text-right">
                        Saldo
                      </TableHead>
                      <TableHead className="text-[#8892b0] font-semibold text-xs uppercase tracking-wider text-right hidden lg:table-cell">
                        Withdrawal History
                      </TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {affiliates.map((aff) => {
                      const isExpanded = expandedRows.has(aff.id)
                      const paidCount = aff.withdrawals?.filter((w) => w.status === 'PAID').length ?? 0
                      const pendingWd = aff.withdrawals?.filter((w) => w.status === 'REQUESTED') ?? []

                      return (
                        <>
                          <TableRow
                            key={aff.id}
                            onClick={() => toggleRow(aff.id)}
                            className="border-white/[0.06] hover:bg-white/[0.02] transition-colors cursor-pointer"
                          >
                            <TableCell className="w-8">
                              <ChevronDown
                                className={`w-4 h-4 text-white/30 transition-transform duration-200 ${
                                  isExpanded ? 'rotate-180' : ''
                                }`}
                              />
                            </TableCell>
                            <TableCell>
                              <span className="text-white/80 text-sm font-mono">{aff.email}</span>
                            </TableCell>
                            <TableCell className="hidden sm:table-cell">
                              <code className="px-2 py-1 rounded bg-white/[0.06] text-cyan-300 text-xs font-mono border border-white/[0.06]">
                                {aff.referralCode}
                              </code>
                            </TableCell>
                            <TableCell className="text-center">
                              <span className="text-white/70 font-semibold text-sm">{aff.totalReferrals}</span>
                            </TableCell>
                            <TableCell className="text-right hidden md:table-cell">
                              <span className="text-amber-400 text-sm font-medium">
                                {formatRupiah(aff.totalEarned)}
                              </span>
                            </TableCell>
                            <TableCell className="text-right">
                              <span
                                className={`text-sm font-bold ${
                                  aff.balance > 0 ? 'text-emerald-400' : 'text-[#8892b0]'
                                }`}
                              >
                                {formatRupiah(aff.balance)}
                              </span>
                            </TableCell>
                            <TableCell className="text-right hidden lg:table-cell">
                              <div className="flex items-center justify-end gap-2">
                                <Badge className="bg-emerald-500/10 text-emerald-400 border-emerald-500/20 text-[10px]">
                                  {paidCount} dibayar
                                </Badge>
                                {pendingWd.length > 0 && (
                                  <Badge className="bg-amber-500/10 text-amber-400 border-amber-500/20 text-[10px]">
                                    {pendingWd.length} pending
                                  </Badge>
                                )}
                              </div>
                            </TableCell>
                          </TableRow>

                          {/* Expanded detail */}
                          {isExpanded && (
                            <TableRow className="border-white/[0.06] hover:bg-transparent">
                              <TableCell colSpan={7} className="p-0">
                                <div className="bg-white/[0.01] border-t border-white/[0.06] px-6 py-4">
                                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-4">
                                    <div className="space-y-1">
                                      <p className="text-[10px] uppercase tracking-widest text-white/25 font-semibold">
                                        Total Referral
                                      </p>
                                      <p className="text-lg font-bold text-white">{aff.totalReferrals}</p>
                                    </div>
                                    <div className="space-y-1">
                                      <p className="text-[10px] uppercase tracking-widest text-white/25 font-semibold">
                                        Total Earned
                                      </p>
                                      <p className="text-lg font-bold text-amber-400">
                                        {formatRupiah(aff.totalEarned)}
                                      </p>
                                    </div>
                                    <div className="space-y-1">
                                      <p className="text-[10px] uppercase tracking-widest text-white/25 font-semibold">
                                        Saldo Tersedia
                                      </p>
                                      <p className="text-lg font-bold text-emerald-400">
                                        {formatRupiah(aff.balance)}
                                      </p>
                                    </div>
                                    <div className="space-y-1">
                                      <p className="text-[10px] uppercase tracking-widest text-white/25 font-semibold">
                                        Kode Referral
                                      </p>
                                      <p className="text-sm font-mono text-cyan-300">
                                        {aff.referralCode}
                                      </p>
                                    </div>
                                  </div>

                                  {/* Withdrawal history */}
                                  {aff.withdrawals && aff.withdrawals.length > 0 ? (
                                    <div className="space-y-2">
                                      <p className="text-[10px] uppercase tracking-widest text-white/25 font-semibold">
                                        Riwayat Withdrawal
                                      </p>
                                      <div className="max-h-48 overflow-y-auto rounded-lg border border-white/[0.06]">
                                        <Table>
                                          <TableHeader>
                                            <TableRow className="border-white/[0.06] hover:bg-transparent">
                                              <TableHead className="text-white/30 text-[10px] uppercase tracking-wider">
                                                Tanggal
                                              </TableHead>
                                              <TableHead className="text-white/30 text-[10px] uppercase tracking-wider">
                                                Jumlah
                                              </TableHead>
                                              <TableHead className="text-white/30 text-[10px] uppercase tracking-wider">
                                                Status
                                              </TableHead>
                                            </TableRow>
                                          </TableHeader>
                                          <TableBody>
                                            {aff.withdrawals.map((w) => (
                                              <TableRow
                                                key={w.id}
                                                className="border-white/[0.06] hover:bg-transparent"
                                              >
                                                <TableCell className="text-[#8892b0] text-xs">
                                                  {formatDate(w.createdAt)}
                                                </TableCell>
                                                <TableCell className="text-[#8892b0] text-xs font-medium">
                                                  {formatRupiah(w.amount)}
                                                </TableCell>
                                                <TableCell>{statusBadge(w.status)}</TableCell>
                                              </TableRow>
                                            ))}
                                          </TableBody>
                                        </Table>
                                      </div>
                                    </div>
                                  ) : (
                                    <p className="text-white/20 text-xs">
                                      Belum ada riwayat withdrawal.
                                    </p>
                                  )}
                                </div>
                              </TableCell>
                            </TableRow>
                          )}
                        </>
                      )
                    })}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* ── Confirmation Dialog ────────────────────────────────────── */}
      <AlertDialog open={!!confirmWithdrawal} onOpenChange={(open) => !open && setConfirmWithdrawal(null)}>
        <AlertDialogContent className="bg-[#0e1117] backdrop-blur-xl border-white/[0.06] sm:max-w-md">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-white">Konfirmasi Pembayaran</AlertDialogTitle>
            <AlertDialogDescription className="text-[#8892b0] space-y-3">
              <p>
                Apakah Anda yakin ingin menandai withdrawal ini sebagai <span className="text-emerald-400 font-semibold">sudah dibayar</span>?
              </p>
              {confirmWithdrawal && (
                <div className="bg-white/[0.06] rounded-lg p-3 space-y-1.5 border border-white/[0.06]">
                  <div className="flex justify-between text-xs">
                    <span className="text-[#8892b0]">Jumlah</span>
                    <span className="text-amber-400 font-bold">{formatRupiah(confirmWithdrawal.amount)}</span>
                  </div>
                  {confirmWithdrawal.bankInfo && (
                    <div className="flex justify-between text-xs">
                      <span className="text-[#8892b0]">Info Bank</span>
                      <span className="text-white/70 text-right max-w-[200px] truncate">{confirmWithdrawal.bankInfo}</span>
                    </div>
                  )}
                  <div className="flex justify-between text-xs">
                    <span className="text-[#8892b0]">Tanggal Request</span>
                    <span className="text-[#8892b0]">{formatDate(confirmWithdrawal.createdAt)}</span>
                  </div>
                </div>
              )}
              <p className="text-red-400/70 text-xs">
                ⚠️ Tindakan ini tidak dapat dibatalkan.
              </p>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel
              disabled={markingPaid}
              className="border-white/[0.06] text-[#8892b0] hover:text-[#f0f2ff] hover:bg-white/[0.03] bg-transparent"
            >
              Batal
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handleMarkPaid}
              disabled={markingPaid}
              className="bg-emerald-600 hover:bg-emerald-700 text-white shadow-lg shadow-emerald-900/30"
            >
              {markingPaid ? (
                <>
                  <Loader2 className="w-4 h-4 mr-1.5 animate-spin" />
                  Memproses...
                </>
              ) : (
                <>
                  <CheckCircle2 className="w-4 h-4 mr-1.5" />
                  Ya, Tandai Dibayar
                </>
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}