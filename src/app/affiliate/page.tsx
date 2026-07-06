'use client'

import { useEffect, useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { motion } from 'framer-motion'
import { toast } from 'sonner'
import {
  Gift,
  Users,
  Copy,
  Check,
  Wallet,
  TrendingUp,
  Banknote,
  ArrowDownToLine,
  Loader2,
} from 'lucide-react'

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'

// ── Types ────────────────────────────────────────────────────────────

interface AffiliateMe {
  referralCode: string
  totalEarned: number
  totalPaid: number
  currentBalance: number
  referralLink: string
}

interface Referral {
  id: string
  referredEmail: string | null
  referredName: string | null
  subscriptionType: string | null
  commissionAmount: number
  status: string
  createdAt: string
}

interface Withdrawal {
  id: string
  amount: number
  status: string
  bankAccountInfo: string
  requestedAt: string
  paidAt: string | null
}

// ── Helpers ──────────────────────────────────────────────────────────

const SITE_URL =
  process.env.NEXT_PUBLIC_SITE_URL || 'https://luxtradee.web.id'

const fmt = (n: number) =>
  new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(n)

const fmtDate = (iso: string) => {
  try {
    return new Intl.DateTimeFormat('id-ID', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    }).format(new Date(iso))
  } catch {
    return iso
  }
}

// ── Animation variants ───────────────────────────────────────────────

const fadeUp = {
  hidden: { opacity: 0, y: 20 },
  visible: (i: number) => ({
    opacity: 1,
    y: 0,
    transition: { delay: i * 0.1, duration: 0.45, ease: 'easeOut' },
  }),
}

const stagger = {
  hidden: {},
  visible: { transition: { staggerChildren: 0.1 } },
}

// ── Component ────────────────────────────────────────────────────────

export default function AffiliatePage() {
  const router = useRouter()

  // Auth + data states
  const [affiliateData, setAffiliateData] = useState<AffiliateMe | null>(null)
  const [referrals, setReferrals] = useState<Referral[]>([])
  const [withdrawals, setWithdrawals] = useState<Withdrawal[]>([])

  // Loading states
  const [authLoading, setAuthLoading] = useState(true)
  const [referralsLoading, setReferralsLoading] = useState(true)
  const [withdrawalsLoading, setWithdrawalsLoading] = useState(true)

  // Withdrawal dialog
  const [withdrawDialogOpen, setWithdrawDialogOpen] = useState(false)
  const [withdrawAmount, setWithdrawAmount] = useState('')
  const [bankInfo, setBankInfo] = useState('')
  const [withdrawSubmitting, setWithdrawSubmitting] = useState(false)

  // ── Build referral link from code ──
  const referralLink = affiliateData
    ? `${SITE_URL}?ref=${affiliateData.referralCode}`
    : ''

  // ── Auth check ────────────────────────────────────────────────────
  useEffect(() => {
    const checkAuth = async () => {
      try {
        const res = await fetch('/api/affiliate/me')
        if (res.status === 401) {
          router.replace('/auth/login')
          return
        }
        if (!res.ok) throw new Error('Failed to fetch affiliate data')
        const data: AffiliateMe = await res.json()
        setAffiliateData(data)
      } catch {
        router.replace('/auth/login')
      } finally {
        setAuthLoading(false)
      }
    }
    checkAuth()
  }, [router])

  // ── Fetch referrals ───────────────────────────────────────────────
  const fetchReferrals = useCallback(async () => {
    setReferralsLoading(true)
    try {
      const res = await fetch('/api/affiliate/referrals')
      if (!res.ok) throw new Error()
      const data = await res.json()
      setReferrals(data.referrals ?? [])
    } catch {
      toast.error('Gagal memuat data referral')
    } finally {
      setReferralsLoading(false)
    }
  }, [])

  // ── Fetch withdrawals ─────────────────────────────────────────────
  const fetchWithdrawals = useCallback(async () => {
    setWithdrawalsLoading(true)
    try {
      const res = await fetch('/api/affiliate/withdraw')
      if (!res.ok) throw new Error()
      const data = await res.json()
      setWithdrawals(data.withdrawals ?? [])
    } catch {
      toast.error('Gagal memuat riwayat penarikan')
    } finally {
      setWithdrawalsLoading(false)
    }
  }, [])

  useEffect(() => {
    if (!authLoading) {
      fetchReferrals()
      fetchWithdrawals()
    }
    }, [authLoading, fetchReferrals, fetchWithdrawals])

  // ── Refresh all data (after withdrawal) ───────────────────────────
  const refreshAll = useCallback(async () => {
    try {
      const res = await fetch('/api/affiliate/me')
      if (res.ok) {
        const data: AffiliateMe = await res.json()
        setAffiliateData(data)
      }
    } catch {
      /* ignore */
    }
    fetchReferrals()
    fetchWithdrawals()
  }, [fetchReferrals, fetchWithdrawals])

  // ── Copy helpers ──────────────────────────────────────────────────
  const copyToClipboard = async (text: string, label: string) => {
    try {
      await navigator.clipboard.writeText(text)
      toast.success(`${label} berhasil disalin!`)
    } catch {
      toast.error('Gagal menyalin ke clipboard')
    }
  }

  // ── Withdrawal submit ─────────────────────────────────────────────
  const handleWithdraw = async () => {
    const amount = Number(withdrawAmount)
    if (!amount || amount < 100000) {
      toast.error('Minimum penarikan Rp100.000')
      return
    }
    if (!bankInfo.trim()) {
      toast.error('Info rekening bank wajib diisi')
      return
    }
    if (affiliateData && amount > affiliateData.currentBalance) {
      toast.error('Saldo tidak mencukupi')
      return
    }

    setWithdrawSubmitting(true)
    try {
      const res = await fetch('/api/affiliate/withdraw', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ amount, bankAccountInfo: bankInfo.trim() }),
      })
      const data = await res.json()
      if (!res.ok) {
        toast.error(data.error || 'Gagal mengajukan penarikan')
        return
      }
      toast.success('Permintaan penarikan berhasil diajukan!')
      setWithdrawDialogOpen(false)
      setWithdrawAmount('')
      setBankInfo('')
      refreshAll()
    } catch {
      toast.error('Terjadi kesalahan saat mengajukan penarikan')
    } finally {
      setWithdrawSubmitting(false)
    }
  }

  // ── Loading / auth gate ───────────────────────────────────────────
  if (authLoading) {
    return (
      <div className="min-h-screen bg-[#0a0612] flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-purple-400" />
      </div>
    )
  }

  if (!affiliateData) return null

  const totalReferrals = referrals.length
  const canWithdraw = affiliateData.currentBalance >= 100000

  return (
    <main className="min-h-screen bg-[#0a0612] text-white">
      {/* Decorative gradient blobs */}
      <div className="pointer-events-none fixed inset-0 overflow-hidden">
        <div className="absolute -top-40 -left-40 h-[500px] w-[500px] rounded-full bg-purple-600/10 blur-[120px]" />
        <div className="absolute top-1/3 -right-40 h-[400px] w-[400px] rounded-full bg-amber-500/8 blur-[100px]" />
      </div>

      <div className="relative mx-auto max-w-5xl px-4 py-10 sm:px-6 lg:px-8">
        {/* ── 1. Header ──────────────────────────────────────────── */}
        <motion.section
          initial="hidden"
          animate="visible"
          variants={fadeUp}
          custom={0}
          className="mb-10 text-center"
        >
          <div className="mb-4 inline-flex items-center justify-center rounded-full bg-gradient-to-r from-purple-500/20 to-amber-500/20 p-3 ring-1 ring-purple-500/30">
            <Gift className="h-8 w-8 text-purple-400" />
          </div>
          <h1 className="font-lexend text-3xl font-bold tracking-tight sm:text-4xl">
            <span className="bg-gradient-to-r from-purple-400 via-purple-300 to-amber-400 bg-clip-text text-transparent">
              Program Affiliate
            </span>
          </h1>
          <p className="mt-3 max-w-xl mx-auto text-sm text-white/60 sm:text-base">
            Ajak teman bergabung ke LuxTrade dan dapatkan komisi dari setiap
            langganan yang terdaftar melalui kode referral kamu.
          </p>
        </motion.section>

        {/* ── 2. Referral Code Card ──────────────────────────────── */}
        <motion.section
          initial="hidden"
          animate="visible"
          variants={fadeUp}
          custom={1}
          className="mb-8"
        >
          <Card className="relative overflow-hidden border-purple-500/20 bg-white/5 backdrop-blur-sm">
            {/* Gradient border top */}
            <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-purple-500 via-purple-400 to-amber-400" />
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-lg font-semibold">
                <Users className="h-5 w-5 text-purple-400" />
                Kode Referral Kamu
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Referral Code */}
              <div>
                <p className="mb-1.5 text-xs font-medium uppercase tracking-wider text-white/50">
                  Kode
                </p>
                <div className="flex items-center gap-3">
                  <div className="flex-1 rounded-lg border border-purple-500/30 bg-purple-500/10 px-4 py-3">
                    <span className="font-mono text-xl font-bold tracking-widest text-purple-300 sm:text-2xl">
                      {affiliateData.referralCode}
                    </span>
                  </div>
                  <CopyButton
                    onCopy={() =>
                      copyToClipboard(
                        affiliateData.referralCode,
                        'Kode referral'
                      )
                    }
                  />
                </div>
              </div>

              {/* Referral Link */}
              <div>
                <p className="mb-1.5 text-xs font-medium uppercase tracking-wider text-white/50">
                  Link Referral
                </p>
                <div className="flex items-center gap-3">
                  <div className="flex-1 truncate rounded-lg border border-white/10 bg-white/5 px-4 py-3">
                    <span className="font-mono text-sm text-white/80">
                      {referralLink}
                    </span>
                  </div>
                  <CopyButton
                    onCopy={() =>
                      copyToClipboard(referralLink, 'Link referral')
                    }
                  />
                </div>
              </div>
            </CardContent>
          </Card>
        </motion.section>

        {/* ── 3. Stats Cards ─────────────────────────────────────── */}
        <motion.section
          initial="hidden"
          animate="visible"
          variants={stagger}
          className="mb-8 grid grid-cols-1 gap-4 sm:grid-cols-3"
        >
          <motion.div variants={fadeUp} custom={2}>
            <StatsCard
              icon={<Users className="h-5 w-5 text-purple-400" />}
              label="Total Referral"
              value={String(totalReferrals)}
              gradient="from-purple-500/20 to-purple-600/5"
            />
          </motion.div>
          <motion.div variants={fadeUp} custom={3}>
            <StatsCard
              icon={<TrendingUp className="h-5 w-5 text-amber-400" />}
              label="Total Earned"
              value={fmt(affiliateData.totalEarned)}
              gradient="from-amber-500/20 to-amber-600/5"
            />
          </motion.div>
          <motion.div variants={fadeUp} custom={4}>
            <StatsCard
              icon={<Wallet className="h-5 w-5 text-emerald-400" />}
              label="Saldo Saat Ini"
              value={fmt(affiliateData.currentBalance)}
              gradient="from-emerald-500/20 to-emerald-600/5"
            />
          </motion.div>
        </motion.section>

        {/* ── 4. Referral History Table ──────────────────────────── */}
        <motion.section
          initial="hidden"
          animate="visible"
          variants={fadeUp}
          custom={5}
          className="mb-8"
        >
          <Card className="border-white/10 bg-white/5 backdrop-blur-sm">
            <CardHeader className="pb-3">
              <CardTitle className="text-lg font-semibold">
                Riwayat Referral
              </CardTitle>
            </CardHeader>
            <CardContent>
              {referralsLoading ? (
                <ReferralTableSkeleton />
              ) : referrals.length === 0 ? (
                <EmptyState message="Belum ada referral yang terdaftar." />
              ) : (
                <div className="max-h-96 overflow-y-auto custom-scrollbar">
                  <Table>
                    <TableHeader>
                      <TableRow className="border-white/10 hover:bg-transparent">
                        <TableHead className="text-white/60">Email</TableHead>
                        <TableHead className="text-white/60">Tanggal</TableHead>
                        <TableHead className="text-white/60 hidden sm:table-cell">
                          Tipe Subsripsi
                        </TableHead>
                        <TableHead className="text-right text-white/60">
                          Komisi
                        </TableHead>
                        <TableHead className="text-right text-white/60">
                          Status
                        </TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {referrals.map((r) => (
                        <TableRow
                          key={r.id}
                          className="border-white/5 hover:bg-white/5"
                        >
                          <TableCell className="font-mono text-sm">
                            {r.referredEmail || '-'}
                          </TableCell>
                          <TableCell className="text-sm text-white/70">
                            {fmtDate(r.createdAt)}
                          </TableCell>
                          <TableCell className="hidden sm:table-cell text-sm text-white/70">
                            {r.subscriptionType || '-'}
                          </TableCell>
                          <TableCell className="text-right text-sm font-medium text-amber-300">
                            {fmt(r.commissionAmount)}
                          </TableCell>
                          <TableCell className="text-right">
                            <StatusBadge status={r.status} />
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>
        </motion.section>

        {/* ── 5. Withdrawal Section ──────────────────────────────── */}
        <motion.section
          initial="hidden"
          animate="visible"
          variants={fadeUp}
          custom={6}
          className="mb-8"
        >
          <Card className="border-white/10 bg-white/5 backdrop-blur-sm">
            <CardContent className="pt-6">
              <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <p className="text-sm text-white/50">Saldo Tersedia</p>
                  <p className="mt-1 font-lexend text-2xl font-bold text-emerald-400 sm:text-3xl">
                    {fmt(affiliateData.currentBalance)}
                  </p>
                  {!canWithdraw && (
                    <p className="mt-1 text-xs text-white/40">
                      Minimum penarikan Rp100.000
                    </p>
                  )}
                </div>
                <Dialog
                  open={withdrawDialogOpen}
                  onOpenChange={(open) => {
                    setWithdrawDialogOpen(open)
                    if (open) {
                      setWithdrawAmount(String(affiliateData.currentBalance))
                    }
                  }}
                >
                  <DialogTrigger asChild>
                    <Button
                      disabled={!canWithdraw}
                      className="bg-gradient-to-r from-purple-600 to-amber-500 text-white hover:from-purple-500 hover:to-amber-400 disabled:opacity-40 disabled:cursor-not-allowed"
                      size="lg"
                    >
                      <ArrowDownToLine className="mr-2 h-4 w-4" />
                      Request Withdrawal
                    </Button>
                  </DialogTrigger>
                  <DialogContent className="border-white/10 bg-[#130d1f] text-white sm:max-w-md">
                    <DialogHeader>
                      <DialogTitle className="bg-gradient-to-r from-purple-400 to-amber-400 bg-clip-text text-transparent">
                        Request Withdrawal
                      </DialogTitle>
                      <DialogDescription className="text-white/60">
                        Masukkan jumlah yang ingin ditarik dan informasi
                        rekening bank kamu.
                      </DialogDescription>
                    </DialogHeader>

                    <div className="space-y-4 py-2">
                      <div className="space-y-2">
                        <Label htmlFor="withdraw-amount">Jumlah (Rp)</Label>
                        <Input
                          id="withdraw-amount"
                          type="number"
                          min={100000}
                          max={affiliateData.currentBalance}
                          value={withdrawAmount}
                          onChange={(e) => setWithdrawAmount(e.target.value)}
                          className="border-white/10 bg-white/5 text-white focus-visible:ring-purple-500"
                        />
                        <p className="text-xs text-white/40">
                          Minimum Rp100.000 &middot; Saldo:{' '}
                          {fmt(affiliateData.currentBalance)}
                        </p>
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="bank-info">Info Rekening Bank</Label>
                        <textarea
                          id="bank-info"
                          rows={3}
                          placeholder="Nama Bank, Nomor Rekening, Nama Pemilik"
                          value={bankInfo}
                          onChange={(e) => setBankInfo(e.target.value)}
                          className="flex w-full rounded-md border border-white/10 bg-white/5 px-3 py-2 text-sm text-white placeholder:text-white/30 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-purple-500 resize-none"
                        />
                      </div>
                    </div>

                    <DialogFooter>
                      <Button
                        variant="ghost"
                        onClick={() => setWithdrawDialogOpen(false)}
                        className="text-white/60 hover:text-white hover:bg-white/10"
                      >
                        Batal
                      </Button>
                      <Button
                        onClick={handleWithdraw}
                        disabled={withdrawSubmitting}
                        className="bg-gradient-to-r from-purple-600 to-amber-500 text-white hover:from-purple-500 hover:to-amber-400"
                      >
                        {withdrawSubmitting ? (
                          <>
                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                            Mengajukan...
                          </>
                        ) : (
                          <>
                            <Banknote className="mr-2 h-4 w-4" />
                            Ajukan Penarikan
                          </>
                        )}
                      </Button>
                    </DialogFooter>
                  </DialogContent>
                </Dialog>
              </div>
            </CardContent>
          </Card>
        </motion.section>

        {/* ── 6. Withdrawal History ──────────────────────────────── */}
        <motion.section
          initial="hidden"
          animate="visible"
          variants={fadeUp}
          custom={7}
          className="mb-16"
        >
          <Card className="border-white/10 bg-white/5 backdrop-blur-sm">
            <CardHeader className="pb-3">
              <CardTitle className="text-lg font-semibold">
                Riwayat Penarikan
              </CardTitle>
            </CardHeader>
            <CardContent>
              {withdrawalsLoading ? (
                <WithdrawalTableSkeleton />
              ) : withdrawals.length === 0 ? (
                <EmptyState message="Belum ada riwayat penarikan." />
              ) : (
                <div className="max-h-96 overflow-y-auto custom-scrollbar">
                  <Table>
                    <TableHeader>
                      <TableRow className="border-white/10 hover:bg-transparent">
                        <TableHead className="text-white/60">Tanggal</TableHead>
                        <TableHead className="text-right text-white/60">
                          Jumlah
                        </TableHead>
                        <TableHead className="text-right text-white/60">
                          Status
                        </TableHead>
                        <TableHead className="hidden sm:table-cell text-white/60">
                          Info Bank
                        </TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {withdrawals.map((w) => (
                        <TableRow
                          key={w.id}
                          className="border-white/5 hover:bg-white/5"
                        >
                          <TableCell className="text-sm text-white/70">
                            {fmtDate(w.requestedAt)}
                          </TableCell>
                          <TableCell className="text-right text-sm font-medium text-amber-300">
                            {fmt(w.amount)}
                          </TableCell>
                          <TableCell className="text-right">
                            <WithdrawalStatusBadge status={w.status} />
                          </TableCell>
                          <TableCell className="hidden sm:table-cell max-w-[200px] truncate text-sm text-white/50">
                            {w.bankAccountInfo}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>
        </motion.section>
      </div>

      {/* Custom scrollbar styles */}
      <style jsx global>{`
        .custom-scrollbar::-webkit-scrollbar {
          width: 6px;
        }
        .custom-scrollbar::-webkit-scrollbar-track {
          background: rgba(255, 255, 255, 0.03);
          border-radius: 3px;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb {
          background: rgba(168, 85, 247, 0.3);
          border-radius: 3px;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover {
          background: rgba(168, 85, 247, 0.5);
        }
      `}</style>
    </main>
  )
}

// ── Sub-components ───────────────────────────────────────────────────

function CopyButton({ onCopy }: { onCopy: () => void }) {
  const [copied, setCopied] = useState(false)

  const handleClick = () => {
    onCopy()
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <Button
      variant="ghost"
      size="icon"
      onClick={handleClick}
      className="h-10 w-10 shrink-0 rounded-lg border border-white/10 text-white/60 hover:bg-white/10 hover:text-white"
      aria-label="Salin"
    >
      {copied ? (
        <Check className="h-4 w-4 text-emerald-400" />
      ) : (
        <Copy className="h-4 w-4" />
      )}
    </Button>
  )
}

function StatsCard({
  icon,
  label,
  value,
  gradient,
}: {
  icon: React.ReactNode
  label: string
  value: string
  gradient: string
}) {
  return (
    <Card className={`border-white/10 bg-gradient-to-br ${gradient} backdrop-blur-sm`}>
      <CardContent className="flex items-center gap-4 p-5">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-white/10">
          {icon}
        </div>
        <div className="min-w-0">
          <p className="text-xs font-medium uppercase tracking-wider text-white/50">
            {label}
          </p>
          <p className="mt-0.5 truncate font-lexend text-lg font-bold text-white sm:text-xl">
            {value}
          </p>
        </div>
      </CardContent>
    </Card>
  )
}

function StatusBadge({ status }: { status: string }) {
  const normalized = status?.toUpperCase()
  if (normalized === 'PAID') {
    return (
      <Badge className="bg-emerald-500/20 text-emerald-400 hover:bg-emerald-500/30 border-emerald-500/30">
        PAID
      </Badge>
    )
  }
  if (normalized === 'PENDING') {
    return (
      <Badge className="bg-yellow-500/20 text-yellow-400 hover:bg-yellow-500/30 border-yellow-500/30">
        PENDING
      </Badge>
    )
  }
  return (
    <Badge variant="secondary" className="text-white/60">
      {status}
    </Badge>
  )
}

function WithdrawalStatusBadge({ status }: { status: string }) {
  const normalized = status?.toUpperCase()
  if (normalized === 'PAID') {
    return (
      <Badge className="bg-emerald-500/20 text-emerald-400 hover:bg-emerald-500/30 border-emerald-500/30">
        PAID
      </Badge>
    )
  }
  if (normalized === 'REQUESTED') {
    return (
      <Badge className="bg-yellow-500/20 text-yellow-400 hover:bg-yellow-500/30 border-yellow-500/30">
        REQUESTED
      </Badge>
    )
  }
  return (
    <Badge variant="secondary" className="text-white/60">
      {status}
    </Badge>
  )
}

function EmptyState({ message }: { message: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-12 text-center">
      <Users className="mb-3 h-10 w-10 text-white/15" />
      <p className="text-sm text-white/40">{message}</p>
    </div>
  )
}

// ── Skeletons ────────────────────────────────────────────────────────

function ReferralTableSkeleton() {
  return (
    <div className="space-y-3">
      {Array.from({ length: 4 }).map((_, i) => (
        <div key={i} className="flex items-center gap-4">
          <Skeleton className="h-4 w-32 bg-white/10" />
          <Skeleton className="h-4 w-20 bg-white/10 hidden sm:block" />
          <Skeleton className="h-4 w-24 bg-white/10" />
          <div className="flex-1" />
          <Skeleton className="h-5 w-16 rounded-full bg-white/10" />
        </div>
      ))}
    </div>
  )
}

function WithdrawalTableSkeleton() {
  return (
    <div className="space-y-3">
      {Array.from({ length: 3 }).map((_, i) => (
        <div key={i} className="flex items-center gap-4">
          <Skeleton className="h-4 w-24 bg-white/10" />
          <div className="flex-1" />
          <Skeleton className="h-4 w-28 bg-white/10" />
          <Skeleton className="h-5 w-20 rounded-full bg-white/10" />
        </div>
      ))}
    </div>
  )
}