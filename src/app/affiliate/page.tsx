'use client'

import { useState, useEffect, useCallback } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import { useRouter } from 'next/navigation'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Gift, Copy, Check, ArrowLeft, Users, Wallet, Clock,
  TrendingUp, Banknote, ChevronDown, ChevronUp,
  Loader2, AlertCircle, CheckCircle, XCircle, RefreshCw,
  Send, ExternalLink, Shield, Zap, ArrowRight, Star, Crown, BarChart3
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { toast } from 'sonner'
import { useAuth } from '@/lib/auth-context'

// ==================== INTERFACES ====================

interface AffiliateProfile {
  id: string
  userId: string
  email: string
  fullName: string | null
  myReferralCode: string
  referredByCode: string | null
  affiliateBalance: number
  totalReferrals: number
  totalCommission: number
  referralLink: string
  commissionRate: string
  commissionPerPro: number
  withdrawalMin: number
  totalReferralsCount: number
  createdAt: string
}

interface Referral {
  id: string
  userId: string
  email: string
  fullName: string | null
  myReferralCode: string
  referredByCode: string
  createdAt: string
}

interface Withdrawal {
  id: string
  userId: string
  email: string
  fullName: string | null
  amount: number
  bankName: string
  bankAccount: string
  bankHolder: string
  status: string
  adminNote: string | null
  createdAt: string
  updatedAt: string
}

// ==================== HELPERS ====================

function formatRupiah(amount: number): string {
  return new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount)
}

function formatDate(dateString: string): string {
  return new Intl.DateTimeFormat('id-ID', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(dateString))
}

function getStatusBadge(status: string) {
  switch (status) {
    case 'pending':
      return (
        <Badge className="bg-yellow-500/20 text-yellow-400 border-yellow-500/30">
          <Clock className="w-3 h-3 mr-1" /> Menunggu
        </Badge>
      )
    case 'approved':
      return (
        <Badge className="bg-emerald-500/20 text-emerald-400 border-emerald-500/30">
          <CheckCircle className="w-3 h-3 mr-1" /> Disetujui
        </Badge>
      )
    case 'rejected':
      return (
        <Badge className="bg-red-500/20 text-red-400 border-red-500/30">
          <XCircle className="w-3 h-3 mr-1" /> Ditolak
        </Badge>
      )
    default:
      return <Badge variant="outline">{status}</Badge>
  }
}

// ==================== MAIN COMPONENT ====================

export default function AffiliatePage() {
  const { user, profile, session, loading, signOut } = useAuth()
  const router = useRouter()

  const [affiliate, setAffiliate] = useState<AffiliateProfile | null>(null)
  const [referrals, setReferrals] = useState<Referral[]>([])
  const [withdrawals, setWithdrawals] = useState<Withdrawal[]>([])
  const [pageLoading, setPageLoading] = useState(true)
  const [copied, setCopied] = useState(false)

  // Withdraw form
  const [withdrawOpen, setWithdrawOpen] = useState(false)
  const [withdrawForm, setWithdrawForm] = useState({
    amount: '',
    bankName: 'Bank Jago',
    bankAccount: '',
    bankHolder: '',
  })
  const [withdrawing, setWithdrawing] = useState(false)

  // Tabs
  const [activeSection, setActiveSection] = useState<'overview' | 'referrals' | 'withdrawals'>('overview')

  // Auth check
  useEffect(() => {
    if (!loading && !user) {
      window.location.href = '/auth/login'
    }
  }, [user, loading])

  // Fetch affiliate data
  const fetchAffiliateData = useCallback(async () => {
    if (!user) return
    setPageLoading(true)
    try {
      const res = await fetch('/api/affiliate', {
        headers: { 'x-user-id': user.id },
      })
      const data = await res.json()
      if (data.success) {
        setAffiliate(data.affiliate)
        setReferrals(data.referrals || [])
        setWithdrawals(data.withdrawals || [])
      }
    } catch (error) {
      console.error('Failed to fetch affiliate data:', error)
    } finally {
      setPageLoading(false)
    }
  }, [user])

  useEffect(() => {
    if (user) fetchAffiliateData()
  }, [user, fetchAffiliateData])

  // Auto-create affiliate profile on first visit
  useEffect(() => {
    if (user && !affiliate && !pageLoading) {
      fetch('/api/affiliate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: user.id,
          email: user.email,
          fullName: profile?.full_name || null,
          referralCode: profile?.referred_by_code || null,
        }),
      }).then(res => res.json()).then(data => {
        if (data.success) fetchAffiliateData()
      }).catch(() => {})
    }
  }, [user, affiliate, profile, pageLoading, fetchAffiliateData])

  // Copy referral link
  const copyLink = async () => {
    if (!affiliate) return
    try {
      await navigator.clipboard.writeText(affiliate.referralLink)
      setCopied(true)
      toast.success('Link referral berhasil disalin!')
      setTimeout(() => setCopied(false), 2000)
    } catch {
      toast.error('Gagal menyalin link')
    }
  }

  // Submit withdrawal
  const handleWithdraw = async () => {
    const amount = parseInt(withdrawForm.amount)
    if (!amount || amount < 50000) {
      toast.error('Minimal penarikan Rp50.000')
      return
    }
    if (!withdrawForm.bankAccount || !withdrawForm.bankHolder) {
      toast.error('Lengkapi data bank')
      return
    }

    setWithdrawing(true)
    try {
      const res = await fetch('/api/affiliate/withdraw', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: user?.id,
          email: user?.email,
          fullName: profile?.full_name || null,
          amount,
          bankName: withdrawForm.bankName,
          bankAccount: withdrawForm.bankAccount,
          bankHolder: withdrawForm.bankHolder,
        }),
      })
      const data = await res.json()

      if (data.success) {
        toast.success('Request tarik saldo berhasil dikirim!')
        setWithdrawOpen(false)
        setWithdrawForm({ amount: '', bankName: 'Bank Jago', bankAccount: '', bankHolder: '' })
        fetchAffiliateData()
      } else {
        toast.error(data.error || 'Gagal mengirim request')
      }
    } catch {
      toast.error('Terjadi kesalahan')
    } finally {
      setWithdrawing(false)
    }
  }

  // Loading state
  if (loading || !user) {
    return (
      <div className="min-h-screen bg-[#0a0612] flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="w-10 h-10 text-purple-500 animate-spin mx-auto mb-4" />
          <p className="text-white/60">Memuat...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-[#0a0612] text-white">
      {/* Background */}
      <div className="fixed inset-0 -z-10">
        <div className="absolute inset-0 bg-gradient-to-b from-[#0a0612] via-[#110a1f] to-[#0a0612]" />
        <div className="absolute top-0 left-1/4 w-[600px] h-[600px] bg-purple-500/5 rounded-full blur-[150px]" />
        <div className="absolute bottom-1/4 right-1/4 w-[400px] h-[400px] bg-amber-500/5 rounded-full blur-[100px]" />
        <div className="absolute top-1/3 right-1/3 w-[300px] h-[300px] bg-emerald-500/5 rounded-full blur-[100px]" />
      </div>

      {/* Header */}
      <header className="border-b border-white/5 bg-[#0a0612]/80 backdrop-blur-xl sticky top-0 z-50">
        <div className="max-w-5xl mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link href="/dashboard" className="inline-flex items-center gap-3">
              <Image src="/logo.png" alt="LuxTrade" width={36} height={36} className="rounded-lg" />
              <span className="text-lg font-bold bg-gradient-to-r from-purple-200 via-purple-400 to-violet-400 bg-clip-text text-transparent">
                LuxTrade
              </span>
            </Link>
          </div>
          <div className="flex items-center gap-3">
            <Badge variant="outline" className="border-emerald-500/30 text-emerald-400">
              <Gift className="w-3 h-3 mr-1" /> Affiliate
            </Badge>
            <Link href="/dashboard">
              <Button variant="ghost" size="sm" className="text-white/60 hover:text-white">
                <ArrowLeft className="w-4 h-4 mr-1" /> Dashboard
              </Button>
            </Link>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-5xl mx-auto px-4 py-8">
        {pageLoading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="w-8 h-8 text-purple-500 animate-spin" />
          </div>
        ) : (
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }} className="space-y-6">

            {/* Page Title */}
            <div className="text-center mb-8">
              <motion.div initial={{ scale: 0.9 }} animate={{ scale: 1 }} className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-emerald-500/10 border border-emerald-500/20 mb-4">
                <Gift className="w-4 h-4 text-emerald-400" />
                <span className="text-sm text-emerald-300">Program Afiliasi</span>
              </motion.div>
              <h1 className="text-3xl sm:text-4xl font-bold mb-2">
                <span className="text-white">Pusat </span>
                <span className="bg-gradient-to-r from-emerald-400 to-amber-400 bg-clip-text text-transparent">Afiliasi</span>
              </h1>
              <p className="text-white/40 max-w-lg mx-auto">
                Ajak teman bergabung dan dapatkan komisi <span className="text-amber-400 font-semibold">30%</span> (Rp14.700) untuk setiap upgrade PRO!
              </p>
            </div>

            {/* Stats Cards */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
              <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}>
                <Card className="bg-white/[0.02] border-white/5 hover:border-emerald-500/20 transition-all">
                  <CardContent className="p-4 text-center">
                    <Wallet className="w-8 h-8 text-emerald-400 mx-auto mb-2" />
                    <p className="text-xs text-white/40 mb-1">Saldo Komisi</p>
                    <p className="text-xl sm:text-2xl font-bold text-emerald-400">
                      {affiliate ? formatRupiah(affiliate.affiliateBalance) : 'Rp0'}
                    </p>
                  </CardContent>
                </Card>
              </motion.div>

              <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }}>
                <Card className="bg-white/[0.02] border-white/5 hover:border-purple-500/20 transition-all">
                  <CardContent className="p-4 text-center">
                    <Users className="w-8 h-8 text-purple-400 mx-auto mb-2" />
                    <p className="text-xs text-white/40 mb-1">Total Referral</p>
                    <p className="text-xl sm:text-2xl font-bold text-purple-400">
                      {affiliate?.totalReferralsCount ?? referrals.length}
                    </p>
                  </CardContent>
                </Card>
              </motion.div>

              <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}>
                <Card className="bg-white/[0.02] border-white/5 hover:border-amber-500/20 transition-all">
                  <CardContent className="p-4 text-center">
                    <TrendingUp className="w-8 h-8 text-amber-400 mx-auto mb-2" />
                    <p className="text-xs text-white/40 mb-1">Total Komisi</p>
                    <p className="text-xl sm:text-2xl font-bold text-amber-400">
                      {affiliate ? formatRupiah(affiliate.totalCommission) : 'Rp0'}
                    </p>
                  </CardContent>
                </Card>
              </motion.div>

              <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.25 }}>
                <Card className="bg-white/[0.02] border-white/5 hover:border-cyan-500/20 transition-all">
                  <CardContent className="p-4 text-center">
                    <Star className="w-8 h-8 text-cyan-400 mx-auto mb-2" />
                    <p className="text-xs text-white/40 mb-1">Komisi/PRO</p>
                    <p className="text-xl sm:text-2xl font-bold text-cyan-400">Rp14.700</p>
                  </CardContent>
                </Card>
              </motion.div>
            </div>

            {/* How It Works */}
            <Card className="bg-white/[0.02] border-white/5 mb-8">
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-2 text-lg">
                  <Zap className="w-5 h-5 text-amber-400" />
                  Cara Kerja
                </CardTitle>
              </CardHeader>
              <CardContent className="pb-6">
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div className="flex items-start gap-3 p-4 rounded-xl bg-purple-500/5 border border-purple-500/10">
                    <div className="w-10 h-10 rounded-full bg-purple-500/20 flex items-center justify-center flex-shrink-0">
                      <span className="text-sm font-bold text-purple-400">1</span>
                    </div>
                    <div>
                      <p className="font-semibold text-white text-sm mb-1">Bagikan Link</p>
                      <p className="text-xs text-white/50">Copy link referral Anda dan bagikan ke teman</p>
                    </div>
                  </div>
                  <div className="flex items-start gap-3 p-4 rounded-xl bg-emerald-500/5 border border-emerald-500/10">
                    <div className="w-10 h-10 rounded-full bg-emerald-500/20 flex items-center justify-center flex-shrink-0">
                      <span className="text-sm font-bold text-emerald-400">2</span>
                    </div>
                    <div>
                      <p className="font-semibold text-white text-sm mb-1">Teman Daftar & Upgrade</p>
                      <p className="text-xs text-white/50">Teman mendaftar via link lalu upgrade ke PRO</p>
                    </div>
                  </div>
                  <div className="flex items-start gap-3 p-4 rounded-xl bg-amber-500/5 border border-amber-500/10">
                    <div className="w-10 h-10 rounded-full bg-amber-500/20 flex items-center justify-center flex-shrink-0">
                      <span className="text-sm font-bold text-amber-400">3</span>
                    </div>
                    <div>
                      <p className="font-semibold text-white text-sm mb-1">Terima Komisi</p>
                      <p className="text-xs text-white/50">Anda dapat <span className="text-amber-400 font-bold">Rp14.700</span> per referral PRO</p>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Referral Link Section */}
            <Card className="bg-gradient-to-br from-emerald-500/5 to-purple-500/5 border-emerald-500/20 mb-8">
              <CardContent className="p-6">
                <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4">
                  <div className="flex items-center gap-3 flex-shrink-0">
                    <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-emerald-500 to-amber-500 flex items-center justify-center shadow-lg shadow-emerald-500/30">
                      <ExternalLink className="w-6 h-6 text-white" />
                    </div>
                    <div>
                      <p className="font-bold text-white">Link Referral Anda</p>
                      <p className="text-xs text-white/40">{affiliate?.myReferralCode || '...'}</p>
                    </div>
                  </div>
                  <div className="flex-1 w-full">
                    <div className="flex items-center gap-2">
                      <Input
                        readOnly
                        value={affiliate?.referralLink || ''}
                        className="bg-black/30 border-white/10 text-emerald-400 font-mono text-sm h-11"
                      />
                      <Button
                        onClick={copyLink}
                        className={`h-11 px-5 flex-shrink-0 transition-all ${
                          copied
                            ? 'bg-emerald-500 hover:bg-emerald-600'
                            : 'bg-gradient-to-r from-emerald-500 to-amber-500 hover:from-emerald-600 hover:to-amber-600'
                        } text-white font-semibold shadow-lg`}
                      >
                        {copied ? (
                          <>
                            <Check className="w-4 h-4 mr-1" /> Tersalin
                          </>
                        ) : (
                          <>
                            <Copy className="w-4 h-4 mr-1" /> Salin
                          </>
                        )}
                      </Button>
                    </div>
                  </div>
                </div>

                {/* Share buttons */}
                <div className="flex items-center gap-2 mt-4 pt-4 border-t border-white/5">
                  <span className="text-xs text-white/30 mr-1">Bagikan via:</span>
                  <a
                    href={`https://wa.me/?text=${encodeURIComponent(`Trading journal terbaik! Daftar gratis di LuxTrade pakai link saya: ${affiliate?.referralLink || ''}`)}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-green-500/10 border border-green-500/20 text-green-400 text-xs font-medium hover:bg-green-500/20 transition-colors"
                  >
                    <Send className="w-3 h-3" /> WhatsApp
                  </a>
                  <a
                    href={`https://t.me/share/url?url=${encodeURIComponent(affiliate?.referralLink || '')}&text=${encodeURIComponent('Join LuxTrade - Premium Trading Journal!')}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-blue-500/10 border border-blue-500/20 text-blue-400 text-xs font-medium hover:bg-blue-500/20 transition-colors"
                  >
                    <Send className="w-3 h-3" /> Telegram
                  </a>
                </div>
              </CardContent>
            </Card>

            {/* Withdraw Button */}
            <motion.div whileHover={{ scale: 1.01 }} whileTap={{ scale: 0.99 }}>
              <Button
                onClick={() => setWithdrawOpen(true)}
                disabled={!affiliate || affiliate.affiliateBalance < 50000}
                className="w-full h-14 bg-gradient-to-r from-amber-500 to-orange-600 hover:from-amber-600 hover:to-orange-700 text-white font-bold text-lg shadow-xl shadow-amber-500/25 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <Wallet className="w-5 h-5 mr-2" />
                {affiliate && affiliate.affiliateBalance >= 50000
                  ? `Tarik Saldo ${formatRupiah(affiliate.affiliateBalance)}`
                  : 'Tarik Saldo (Min. Rp50.000)'
                }
              </Button>
            </motion.div>

            {affiliate && affiliate.affiliateBalance < 50000 && (
              <p className="text-center text-xs text-white/30 mt-2">
                * Saldo komisi minimal Rp50.000 untuk bisa menarik. Kurang {formatRupiah(50000 - affiliate.affiliateBalance)} lagi.
              </p>
            )}

            {/* Tabs */}
            <div className="mt-8">
              <div className="flex items-center gap-1 p-1 bg-white/5 rounded-xl w-fit mx-auto mb-6">
                {[
                  { key: 'overview', label: 'Ringkasan', icon: BarChart3 },
                  { key: 'referrals', label: `Referral (${referrals.length})`, icon: Users },
                  { key: 'withdrawals', label: `Penarikan (${withdrawals.length})`, icon: Wallet },
                ].map(tab => (
                  <button
                    key={tab.key}
                    onClick={() => setActiveSection(tab.key as any)}
                    className={`flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium transition-all ${
                      activeSection === tab.key
                        ? 'bg-purple-500/20 text-purple-400'
                        : 'text-white/40 hover:text-white/70 hover:bg-white/5'
                    }`}
                  >
                    <tab.icon className="w-4 h-4" />
                    {tab.label}
                  </button>
                ))}
              </div>

              {/* Tab Content */}
              <AnimatePresence mode="wait">
                {activeSection === 'overview' && (
                  <motion.div key="overview" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }}>
                    <Card className="bg-white/[0.02] border-white/5">
                      <CardContent className="p-6">
                        <h3 className="font-bold text-lg mb-4 flex items-center gap-2">
                          <Shield className="w-5 h-5 text-purple-400" />
                          Info Program Afiliasi
                        </h3>
                        <div className="space-y-4">
                          <div className="flex items-start gap-3 p-3 rounded-lg bg-white/[0.02]">
                            <Crown className="w-5 h-5 text-amber-400 mt-0.5 flex-shrink-0" />
                            <div>
                              <p className="font-medium text-white text-sm">Komisi 30%</p>
                              <p className="text-xs text-white/50">Setiap downline yang upgrade ke Elite Pro, Anda mendapat Rp14.700</p>
                            </div>
                          </div>
                          <div className="flex items-start gap-3 p-3 rounded-lg bg-white/[0.02]">
                            <Banknote className="w-5 h-5 text-emerald-400 mt-0.5 flex-shrink-0" />
                            <div>
                              <p className="font-medium text-white text-sm">Minimal Tarik Rp50.000</p>
                              <p className="text-xs text-white/50">Penarikan saldo minimum Rp50.000, proses 1x24 jam</p>
                            </div>
                          </div>
                          <div className="flex items-start gap-3 p-3 rounded-lg bg-white/[0.02]">
                            <CheckCircle className="w-5 h-5 text-cyan-400 mt-0.5 flex-shrink-0" />
                            <div>
                              <p className="font-medium text-white text-sm">Unlimited Referral</p>
                              <p className="text-xs text-white/50">Tidak ada batasan jumlah referral yang bisa Anda undang</p>
                            </div>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  </motion.div>
                )}

                {activeSection === 'referrals' && (
                  <motion.div key="referrals" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }}>
                    <Card className="bg-white/[0.02] border-white/5">
                      <CardContent className="p-0">
                        {referrals.length === 0 ? (
                          <div className="p-12 text-center">
                            <Users className="w-12 h-12 text-white/20 mx-auto mb-3" />
                            <p className="text-white/40 text-sm">Belum ada referral</p>
                            <p className="text-white/20 text-xs mt-1">Bagikan link Anda untuk mulai mengundang teman!</p>
                          </div>
                        ) : (
                          <div className="divide-y divide-white/5">
                            {referrals.map((ref, idx) => (
                              <div key={ref.id} className="flex items-center justify-between p-4 hover:bg-white/[0.02] transition-colors">
                                <div className="flex items-center gap-3">
                                  <div className="w-9 h-9 rounded-full bg-gradient-to-br from-purple-500/30 to-violet-500/30 flex items-center justify-center text-sm font-bold text-purple-300">
                                    {idx + 1}
                                  </div>
                                  <div>
                                    <p className="font-medium text-white text-sm">{ref.fullName || ref.email}</p>
                                    <p className="text-xs text-white/30">{ref.email}</p>
                                  </div>
                                </div>
                                <div className="text-right">
                                  <p className="text-xs text-white/30">{formatDate(ref.createdAt)}</p>
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                      </CardContent>
                    </Card>
                  </motion.div>
                )}

                {activeSection === 'withdrawals' && (
                  <motion.div key="withdrawals" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }}>
                    <Card className="bg-white/[0.02] border-white/5">
                      <CardContent className="p-0">
                        {withdrawals.length === 0 ? (
                          <div className="p-12 text-center">
                            <Wallet className="w-12 h-12 text-white/20 mx-auto mb-3" />
                            <p className="text-white/40 text-sm">Belum ada riwayat penarikan</p>
                            <p className="text-white/20 text-xs mt-1">Kumpulkan saldo komisi lalu tarik ke rekening Anda</p>
                          </div>
                        ) : (
                          <div className="divide-y divide-white/5">
                            {withdrawals.map(w => (
                              <div key={w.id} className="p-4">
                                <div className="flex items-center justify-between mb-2">
                                  <div>
                                    <p className="font-bold text-white">{formatRupiah(w.amount)}</p>
                                    <p className="text-xs text-white/30">{formatDate(w.createdAt)}</p>
                                  </div>
                                  {getStatusBadge(w.status)}
                                </div>
                                <div className="flex items-center gap-4 text-xs text-white/40">
                                  <span>{w.bankName}</span>
                                  <span className="font-mono">{w.bankAccount}</span>
                                  <span>{w.bankHolder}</span>
                                </div>
                                {w.adminNote && (
                                  <div className="mt-2 p-2 rounded bg-white/[0.02] text-xs text-white/50">
                                    Catatan admin: {w.adminNote}
                                  </div>
                                )}
                              </div>
                            ))}
                          </div>
                        )}
                      </CardContent>
                    </Card>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

          </motion.div>
        )}
      </main>

      {/* Withdrawal Modal */}
      <Dialog open={withdrawOpen} onOpenChange={setWithdrawOpen}>
        <DialogContent className="bg-[#0f0b18] border-purple-900/30 max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-white">
              <Wallet className="w-5 h-5 text-emerald-400" />
              Tarik Saldo Komisi
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4 py-4">
            {/* Balance Display */}
            <div className="text-center p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/20">
              <p className="text-xs text-emerald-300/60 mb-1">Saldo Tersedia</p>
              <p className="text-3xl font-bold text-emerald-400">
                {affiliate ? formatRupiah(affiliate.affiliateBalance) : 'Rp0'}
              </p>
            </div>

            {/* Amount */}
            <div className="space-y-2">
              <Label className="text-white/70 text-sm">Jumlah Penarikan (Rp)</Label>
              <Input
                type="number"
                placeholder="50000"
                min={50000}
                max={affiliate?.affiliateBalance || 0}
                value={withdrawForm.amount}
                onChange={e => setWithdrawForm(prev => ({ ...prev, amount: e.target.value }))}
                className="bg-white/[0.03] border-white/10 text-white h-12 text-lg font-mono"
              />
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  className="border-white/10 text-white/50 text-xs"
                  onClick={() => setWithdrawForm(prev => ({ ...prev, amount: '50000' }))}
                >
                  Min Rp50rb
                </Button>
                {affiliate && affiliate.affiliateBalance >= 50000 && (
                  <Button
                    variant="outline"
                    size="sm"
                    className="border-white/10 text-white/50 text-xs"
                    onClick={() => setWithdrawForm(prev => ({ ...prev, amount: String(affiliate.affiliateBalance) }))}
                  >
                    Tarik Semua
                  </Button>
                )}
              </div>
            </div>

            {/* Bank Name */}
            <div className="space-y-2">
              <Label className="text-white/70 text-sm">Nama Bank</Label>
              <Select value={withdrawForm.bankName} onValueChange={v => setWithdrawForm(prev => ({ ...prev, bankName: v }))}>
                <SelectTrigger className="bg-white/[0.03] border-white/10 text-white h-12">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-[#1a1225] border-purple-900/30">
                  <SelectItem value="Bank Jago">Bank Jago</SelectItem>
                  <SelectItem value="BCA">BCA</SelectItem>
                  <SelectItem value="BNI">BNI</SelectItem>
                  <SelectItem value="BRI">BRI</SelectItem>
                  <SelectItem value="Mandiri">Mandiri</SelectItem>
                  <SelectItem value="BSI">BSI</SelectItem>
                  <SelectItem value="CIMB">CIMB Niaga</SelectItem>
                  <SelectItem value="Danamon">Danamon</SelectItem>
                  <SelectItem value="Permata">Permata</SelectItem>
                  <SelectItem value="BTPN">Jenius BTPN</SelectItem>
                  <SelectItem value="Maybank">Maybank</SelectItem>
                  <SelectItem value="OCBC">OCBC NISP</SelectItem>
                  <SelectItem value="Shopeepay">ShopeePay</SelectItem>
                  <SelectItem value="GoPay">GoPay</SelectItem>
                  <SelectItem value="DANA">DANA</SelectItem>
                  <SelectItem value="OVO">OVO</SelectItem>
                  <SelectItem value="Bank Lainnya">Bank Lainnya</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Account Number */}
            <div className="space-y-2">
              <Label className="text-white/70 text-sm">Nomor Rekening</Label>
              <Input
                placeholder="Masukkan nomor rekening"
                value={withdrawForm.bankAccount}
                onChange={e => setWithdrawForm(prev => ({ ...prev, bankAccount: e.target.value }))}
                className="bg-white/[0.03] border-white/10 text-white h-12 font-mono"
              />
            </div>

            {/* Holder Name */}
            <div className="space-y-2">
              <Label className="text-white/70 text-sm">Atas Nama</Label>
              <Input
                placeholder="Nama sesuai rekening"
                value={withdrawForm.bankHolder}
                onChange={e => setWithdrawForm(prev => ({ ...prev, bankHolder: e.target.value }))}
                className="bg-white/[0.03] border-white/10 text-white h-12"
              />
            </div>

            {/* Info */}
            <div className="flex items-start gap-2 p-3 rounded-lg bg-blue-500/10 border border-blue-500/20">
              <Clock className="w-4 h-4 text-blue-400 mt-0.5 flex-shrink-0" />
              <p className="text-xs text-blue-300/80">
                Proses penarikan 1x24 jam. Admin akan memverifikasi dan mengirim dana ke rekening Anda.
              </p>
            </div>
          </div>

          <DialogFooter className="gap-2">
            <Button
              variant="outline"
              onClick={() => setWithdrawOpen(false)}
              className="border-white/10 text-white"
            >
              Batal
            </Button>
            <Button
              onClick={handleWithdraw}
              disabled={withdrawing || !withdrawForm.amount || parseInt(withdrawForm.amount) < 50000 || !withdrawForm.bankAccount || !withdrawForm.bankHolder}
              className="bg-gradient-to-r from-emerald-500 to-amber-600 hover:from-emerald-600 hover:to-amber-700 text-white font-semibold"
            >
              {withdrawing ? (
                <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Mengirim...</>
              ) : (
                <><Banknote className="w-4 h-4 mr-2" /> Ajukan Penarikan</>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

