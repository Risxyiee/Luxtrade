'use client'

import { useState, useEffect, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Progress } from '@/components/ui/progress'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog'
import {
  Accordion, AccordionContent, AccordionItem, AccordionTrigger,
} from '@/components/ui/accordion'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import { copyToClipboard } from '@/lib/clipboard'
import { authFetch } from '@/lib/api-fetch'
import { toast } from 'sonner'
import {
  Gift, Users, Copy, Share2, Banknote, TrendingUp, Trophy,
  CheckCircle, Loader2, ExternalLink, Pencil, ArrowUpRight,
  ChevronRight, Star, Medal, Crown, Gem, Clock, ShieldCheck,
  MessageCircle, Send, Megaphone, Wallet, CreditCard, Building2, Link2
} from 'lucide-react'

// ==================== TYPES ====================

interface AffiliateTabProps {
  isPro: boolean
  onUpgrade: () => void
  language: 'id' | 'en'
}

interface AffiliateData {
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
  referredJoinedAt: string | null
  subscriptionType: string
  commissionAmount: number
  status: string
  createdAt: string
  activityLevel: 'active' | 'recent' | 'inactive'
  totalTrades30d: number
  totalPnL30d: number
  recentTrades7d: number
}

interface Withdrawal {
  id: string
  amount: number
  status: string
  bankAccountInfo: string
  requestedAt: string
  paidAt: string | null
}

// ==================== I18N ====================

const t = {
  id: {
    title: 'Program Afiliasi',
    subtitle: 'Dapatkan komisi dari setiap teman yang Anda undang dan berlangganan Pro.',
    overviewTitle: 'Ringkasan',
    totalReferrals: 'Total Referral',
    activeReferrals: 'Referral Aktif',
    totalEarnings: 'Total Pendapatan',
    currentBalance: 'Saldo Tersedia',
    referralLinkTitle: 'Link Referral',
    referralCode: 'Kode Referral',
    referralLink: 'Link Referral',
    copyCode: 'Salin Kode',
    copyLink: 'Salin Link',
    copied: 'Tersalin!',
    share: 'Bagikan',
    changeCode: 'Ubah Kode',
    earningsTitle: 'Riwayat Pendapatan',
    noEarnings: 'Belum ada pendapatan.',
    date: 'Tanggal',
    referral: 'Referral',
    amount: 'Jumlah',
    status: 'Status',
    withdrawalTitle: 'Tarik Dana',
    requestWithdrawal: 'Ajukan Penarikan',
    bankName: 'Nama Bank',
    bankNamePlaceholder: 'Contoh: BCA, Mandiri, BNI',
    accountNumber: 'Nomor Rekening',
    accountNumberPlaceholder: 'Masukkan nomor rekening',
    withdrawAmount: 'Jumlah Penarikan (Rp)',
    withdrawAmountPlaceholder: 'Minimal Rp100.000',
    submit: 'Ajukan',
    minWithdrawal: 'Minimal penarikan: Rp100.000',
    insufficientBalance: 'Saldo tidak mencukupi',
    withdrawalHistory: 'Riwayat Penarikan',
    noWithdrawals: 'Belum ada riwayat penarikan.',
    progressTitle: 'Progres Referral',
    progressSubtitle: 'Capai milestone untuk mendapat badge eksklusif!',
    howItWorksTitle: 'Cara Kerja',
    promoTitle: 'Materi Promosi',
    promoSubtitle: 'Salin teks promosi untuk berbagai platform.',
    whatsapp: 'WhatsApp',
    telegram: 'Telegram',
    twitter: 'Twitter',
    copyPromo: 'Salin Teks',
    statusPending: 'Menunggu',
    statusApproved: 'Disetujui',
    statusRejected: 'Ditolak',
    statusPaid: 'Dibayar',
    statusActive: 'Aktif',
    statusRecent: 'Baru',
    statusInactive: 'Tidak Aktif',
    statusRequested: 'Diajukan',
    milestoneBronze: 'Bronze',
    milestoneSilver: 'Silver',
    milestoneGold: 'Gold',
    milestonePlatinum: 'Platinum',
    q1Title: 'Apa itu Program Afiliasi LuxTradee?',
    q1Content: 'Program Afiliasi LuxTradee memungkinkan Anda mendapatkan komisi nyata (Rupiah) dari setiap teman yang mendaftar menggunakan link referral Anda dan berlangganan paket Pro. Semakin banyak referral yang aktif, semakin besar pendapatan Anda.',
    q2Title: 'Berapa komisi yang saya dapatkan?',
    q2Content: 'Anda mendapatkan komisi untuk setiap referral yang berhasil berlangganan paket Pro. Komisi dikreditkan ke saldo afiliasi Anda dan dapat ditarik ke rekening bank Anda kapan saja setelah mencapai minimum Rp100.000.',
    q3Title: 'Kapan komisi dibayarkan?',
    q3Content: 'Komusi langsung masuk ke saldo afiliasi Anda saat referral berlangganan. Anda bisa menarik dana kapan saja melalui menu "Tarik Dana" dengan minimal Rp100.000. Proses pencairan biasanya 1-3 hari kerja.',
    q4Title: 'Apakah ada batasan referral?',
    q4Content: 'Tidak ada batasan jumlah referral! Anda bisa mengundang sebanyak mungkin teman. Raih milestone Bronze (5), Silver (15), Gold (30), dan Platinum (50) untuk mendapat pengakuan khusus.',
    q5Title: 'Bagaimana cara menarik dana?',
    q5Content: 'Klik tombol "Ajukan Penarikan" di bagian Tarik Dana. Masukkan nama bank, nomor rekening, dan jumlah yang ingin ditarik (minimal Rp100.000). Dana akan dikirim ke rekening Anda dalam 1-3 hari kerja.',
    how1Title: 'Bagikan Link',
    how1Desc: 'Dapatkan link referral unik Anda dan bagikan ke teman-teman.',
    how2Title: 'Teman Daftar',
    how2Desc: 'Teman mendaftar melalui link referral Anda di LuxTradee.',
    how3Title: 'Dapatkan Komisi',
    how3Desc: 'Anda mendapat komisi setiap kali referral berlangganan Pro.',
    updateCodeTitle: 'Ubah Kode Referral',
    updateCodeDesc: 'Kode referral hanya bisa diubah 1x per 30 hari.',
    newCode: 'Kode Baru',
    newCodePlaceholder: 'HURUF & ANGKA, 4-20 karakter',
    save: 'Simpan',
    cancel: 'Batal',
    loading: 'Memuat...',
    error: 'Gagal memuat data',
    retry: 'Coba Lagi',
    success: 'Berhasil',
    or: 'atau',
    active: 'Aktif',
    inactive: 'Tidak Aktif',
    all: 'Semua',
    earnedFrom: 'dari',
    commission: 'komisi',
    bankInfo: 'Info Bank',
    requestedOn: 'Diajukan pada',
    paidOn: 'Dibayar pada',
    noReferrals: 'Belum ada referral. Mulai bagikan link Anda!',
  },
  en: {
    title: 'Affiliate Program',
    subtitle: 'Earn commissions from every friend you invite who subscribes to Pro.',
    overviewTitle: 'Overview',
    totalReferrals: 'Total Referrals',
    activeReferrals: 'Active Referrals',
    totalEarnings: 'Total Earnings',
    currentBalance: 'Available Balance',
    referralLinkTitle: 'Referral Link',
    referralCode: 'Referral Code',
    referralLink: 'Referral Link',
    copyCode: 'Copy Code',
    copyLink: 'Copy Link',
    copied: 'Copied!',
    share: 'Share',
    changeCode: 'Change Code',
    earningsTitle: 'Earnings History',
    noEarnings: 'No earnings yet.',
    date: 'Date',
    referral: 'Referral',
    amount: 'Amount',
    status: 'Status',
    withdrawalTitle: 'Withdraw Funds',
    requestWithdrawal: 'Request Withdrawal',
    bankName: 'Bank Name',
    bankNamePlaceholder: 'e.g. BCA, Mandiri, BNI',
    accountNumber: 'Account Number',
    accountNumberPlaceholder: 'Enter account number',
    withdrawAmount: 'Withdrawal Amount (Rp)',
    withdrawAmountPlaceholder: 'Minimum Rp100,000',
    submit: 'Submit',
    minWithdrawal: 'Minimum withdrawal: Rp100,000',
    insufficientBalance: 'Insufficient balance',
    withdrawalHistory: 'Withdrawal History',
    noWithdrawals: 'No withdrawal history yet.',
    progressTitle: 'Referral Progress',
    progressSubtitle: 'Reach milestones to earn exclusive badges!',
    howItWorksTitle: 'How It Works',
    promoTitle: 'Promo Materials',
    promoSubtitle: 'Copy pre-made promo text for various platforms.',
    whatsapp: 'WhatsApp',
    telegram: 'Telegram',
    twitter: 'Twitter',
    copyPromo: 'Copy Text',
    statusPending: 'Pending',
    statusApproved: 'Approved',
    statusRejected: 'Rejected',
    statusPaid: 'Paid',
    statusActive: 'Active',
    statusRecent: 'Recent',
    statusInactive: 'Inactive',
    statusRequested: 'Requested',
    milestoneBronze: 'Bronze',
    milestoneSilver: 'Silver',
    milestoneGold: 'Gold',
    milestonePlatinum: 'Platinum',
    q1Title: 'What is the LuxTradee Affiliate Program?',
    q1Content: 'The LuxTradee Affiliate Program lets you earn real commissions (Rupiah) from every friend who signs up using your referral link and subscribes to a Pro plan. The more active referrals you have, the more you earn.',
    q2Title: 'How much commission do I earn?',
    q2Content: 'You earn a commission for every referral who successfully subscribes to a Pro plan. The commission is credited to your affiliate balance and can be withdrawn to your bank account anytime after reaching the minimum of Rp100,000.',
    q3Title: 'When are commissions paid?',
    q3Content: 'Commissions are credited to your affiliate balance as soon as your referral subscribes to Pro. You can withdraw funds anytime via the "Withdraw Funds" section with a minimum of Rp100,000. Processing usually takes 1-3 business days.',
    q4Title: 'Is there a referral limit?',
    q4Content: 'There is no limit on the number of referrals! Invite as many friends as you want. Reach the Bronze (5), Silver (15), Gold (30), and Platinum (50) milestones for special recognition.',
    q5Title: 'How do I withdraw funds?',
    q5Content: 'Click the "Request Withdrawal" button in the Withdraw Funds section. Enter your bank name, account number, and the amount you want to withdraw (minimum Rp100,000). Funds will be sent to your account within 1-3 business days.',
    how1Title: 'Share Your Link',
    how1Desc: 'Get your unique referral link and share it with friends.',
    how2Title: 'Friend Signs Up',
    how2Desc: 'Your friend registers through your referral link on LuxTradee.',
    how3Title: 'Earn Commissions',
    how3Desc: 'You earn a commission every time your referral subscribes to Pro.',
    updateCodeTitle: 'Update Referral Code',
    updateCodeDesc: 'Referral code can only be changed once every 30 days.',
    newCode: 'New Code',
    newCodePlaceholder: 'LETTERS & NUMBERS, 4-20 chars',
    save: 'Save',
    cancel: 'Cancel',
    loading: 'Loading...',
    error: 'Failed to load data',
    retry: 'Retry',
    success: 'Success',
    or: 'or',
    active: 'Active',
    inactive: 'Inactive',
    all: 'All',
    earnedFrom: 'from',
    commission: 'commission',
    bankInfo: 'Bank Info',
    requestedOn: 'Requested on',
    paidOn: 'Paid on',
    noReferrals: 'No referrals yet. Start sharing your link!',
  }
}

// ==================== HELPERS ====================

function formatRupiah(amount: number): string {
  return `Rp${amount.toLocaleString('id-ID')}`
}

function formatDate(dateStr: string, language: 'id' | 'en'): string {
  const date = new Date(dateStr)
  return date.toLocaleDateString(language === 'id' ? 'id-ID' : 'en-US', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  })
}

function maskEmail(email: string): string {
  const [user, domain] = email.split('@')
  if (!domain) return email
  if (user.length <= 2) return `${user[0]}***@${domain}`
  return `${user[0]}${user[1]}***@${domain}`
}

const MILESTONES = [
  { key: 'bronze', labelId: 'milestoneBronze', labelEn: 'Bronze', target: 5, icon: Medal, color: 'text-amber-600 dark:text-amber-400', bgColor: 'bg-amber-100 dark:bg-amber-900/30', borderColor: 'border-amber-300 dark:border-amber-700' },
  { key: 'silver', labelId: 'milestoneSilver', labelEn: 'Silver', target: 15, icon: Star, color: 'text-gray-500 dark:text-gray-300', bgColor: 'bg-gray-100 dark:bg-gray-800', borderColor: 'border-gray-300 dark:border-gray-600' },
  { key: 'gold', labelId: 'milestoneGold', labelEn: 'Gold', target: 30, icon: Trophy, color: 'text-yellow-500 dark:text-yellow-400', bgColor: 'bg-yellow-50 dark:bg-yellow-900/20', borderColor: 'border-yellow-300 dark:border-yellow-700' },
  { key: 'platinum', labelId: 'milestonePlatinum', labelEn: 'Platinum', target: 50, icon: Gem, color: 'text-cyan-500 dark:text-cyan-400', bgColor: 'bg-cyan-50 dark:bg-cyan-900/20', borderColor: 'border-cyan-300 dark:border-cyan-700' },
]

const containerVariants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: { staggerChildren: 0.06 } },
}
const itemVariants = {
  hidden: { opacity: 0, y: 16 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.35 } },
} as const

// ==================== COMPONENT ====================

export default function AffiliateTab({ isPro, onUpgrade, language }: AffiliateTabProps) {
  const lang = t[language]

  // Data states
  const [affiliate, setAffiliate] = useState<AffiliateData | null>(null)
  const [referrals, setReferrals] = useState<Referral[]>([])
  const [withdrawals, setWithdrawals] = useState<Withdrawal[]>([])

  // UI states
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [copiedField, setCopiedField] = useState<string | null>(null)
  const [editCodeOpen, setEditCodeOpen] = useState(false)
  const [newCode, setNewCode] = useState('')
  const [updatingCode, setUpdatingCode] = useState(false)
  const [withdrawOpen, setWithdrawOpen] = useState(false)
  const [withdrawForm, setWithdrawForm] = useState({ bankName: '', accountNumber: '', amount: '' })
  const [withdrawing, setWithdrawing] = useState(false)
  const [referralFilter, setReferralFilter] = useState<'all' | 'active' | 'inactive'>('all')

  // Fetch all affiliate data
  const fetchAllData = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const [meRes, refRes, witRes] = await Promise.all([
        authFetch('/api/affiliate/me'),
        authFetch('/api/affiliate/referrals'),
        authFetch('/api/affiliate/withdraw'),
      ])

      if (!meRes.ok) throw new Error('Failed to load affiliate data')
      const meData = await meRes.json()
      setAffiliate(meData)

      if (refRes.ok) {
        const refData = await refRes.json()
        setReferrals(refData.referrals || [])
      }

      if (witRes.ok) {
        const witData = await witRes.json()
        setWithdrawals(witData.withdrawals || [])
      }
    } catch (err: any) {
      setError(err.message || lang.error)
    } finally {
      setLoading(false)
    }
  }, [lang.error])

  useEffect(() => { fetchAllData() }, [fetchAllData])

  // Handlers
  const handleCopy = async (text: string, field: string) => {
    const ok = await copyToClipboard(text)
    if (ok) {
      setCopiedField(field)
      toast.success(lang.copied)
      setTimeout(() => setCopiedField(null), 2000)
    }
  }

  const handleShare = async () => {
    if (!affiliate) return
    const shareText = language === 'id'
      ? `Trading jadi lebih mudah dengan LuxTradee! Daftar pakai link saya dan mulai catat trading kamu. ${affiliate.referralLink}`
      : `Trading made easier with LuxTradee! Sign up using my link and start tracking your trades. ${affiliate.referralLink}`

    if (navigator.share) {
      try {
        await navigator.share({ title: 'LuxTradee', text: shareText, url: affiliate.referralLink })
      } catch {
        // User cancelled or not supported
      }
    } else {
      handleCopy(shareText, 'share')
    }
  }

  const handleUpdateCode = async () => {
    if (!newCode.trim()) return
    setUpdatingCode(true)
    try {
      const res = await authFetch('/api/affiliate/update-code', {
        method: 'PATCH',
        body: JSON.stringify({ newCode: newCode.trim() }),
      })
      const data = await res.json()
      if (!res.ok) {
        toast.error(data.error || 'Failed to update code')
        return
      }
      toast.success(data.message || lang.success)
      setAffiliate(prev => prev ? { ...prev, referralCode: data.referralCode, referralLink: data.referralLink } : prev)
      setEditCodeOpen(false)
      setNewCode('')
    } catch {
      toast.error('Failed to update code')
    } finally {
      setUpdatingCode(false)
    }
  }

  const handleWithdraw = async () => {
    const { bankName, accountNumber, amount } = withdrawForm
    if (!bankName.trim() || !accountNumber.trim() || !amount) return

    const numAmount = Number(amount)
    if (isNaN(numAmount) || numAmount < 100000) {
      toast.error(lang.minWithdrawal)
      return
    }
    if (affiliate && numAmount > affiliate.currentBalance) {
      toast.error(lang.insufficientBalance)
      return
    }

    setWithdrawing(true)
    try {
      const bankInfo = `${bankName.trim()} - ${accountNumber.trim()}`
      const res = await authFetch('/api/affiliate/withdraw', {
        method: 'POST',
        body: JSON.stringify({ amount: numAmount, bankAccountInfo: bankInfo }),
      })
      const data = await res.json()
      if (!res.ok) {
        toast.error(data.error || 'Failed to request withdrawal')
        return
      }
      toast.success(lang.success)
      setWithdrawOpen(false)
      setWithdrawForm({ bankName: '', accountNumber: '', amount: '' })
      // Refresh data
      fetchAllData()
    } catch {
      toast.error('Failed to request withdrawal')
    } finally {
      setWithdrawing(false)
    }
  }

  const handleCopyPromo = async (text: string) => {
    await handleCopy(text, 'promo')
  }

  // Computed
  const totalReferrals = referrals.length
  const activeReferrals = referrals.filter(r => r.activityLevel === 'active').length
  const currentMilestone = MILESTONES.filter(m => totalReferrals >= m.target).pop() || null
  const nextMilestone = MILESTONES.find(m => totalReferrals < m.target) || null
  const milestoneProgress = nextMilestone
    ? (totalReferrals / nextMilestone.target) * 100
    : 100

  const filteredReferrals = referrals.filter(r => {
    if (referralFilter === 'active') return r.activityLevel === 'active'
    if (referralFilter === 'inactive') return r.activityLevel !== 'active'
    return true
  })

  const promoTexts = affiliate ? {
    whatsapp: language === 'id'
      ? `Hai! 🔥 Trading kamu bisa jadi lebih terorganisir dengan LuxTradee. Catat setiap transaksi, analisa performa, dan tingkatkan konsistensi. Daftar gratis pakai link saya: ${affiliate.referralLink}\n\nKalo kamu upgrade ke Pro, aku dapat komisi loh! Makasih 🙏`
      : `Hey! 🔥 Your trading can be more organized with LuxTradee. Track every trade, analyze performance, and improve consistency. Sign up free with my link: ${affiliate.referralLink}\n\nIf you upgrade to Pro, I earn a commission! Thanks 🙏`,
    telegram: language === 'id'
      ? `📊 LuxTradee - Jurnal Trading Terbaik\n\nCatat trading, analisa performa, dan tingkatkan skill kamu. Daftar pakai link referral saya dan mulai perjalanan trading yang lebih baik!\n\n🔗 ${affiliate.referralLink}\n\n#trading #forex #luxtradee`
      : `📊 LuxTradee - The Best Trading Journal\n\nTrack trades, analyze performance, and level up your skills. Sign up with my referral link and start a better trading journey!\n\n🔗 ${affiliate.referralLink}\n\n#trading #forex #luxtradee`,
    twitter: language === 'id'
      ? `Trading journal yang bikin konsistensi naik 📈\n\nCatat transaksi, analisa performa, & raih target trading kamu dengan LuxTradee.\n\nDaftar: ${affiliate.referralLink}\n\n#TradingJournal #Forex #LuxTradee`
      : `The trading journal that boosts consistency 📈\n\nTrack trades, analyze performance, & hit your trading targets with LuxTradee.\n\nSign up: ${affiliate.referralLink}\n\n#TradingJournal #Forex #LuxTradee`,
  } : { whatsapp: '', telegram: '', twitter: '' }

  // Status badge helper
  const StatusBadge = ({ status }: { status: string }) => {
    const map: Record<string, { label: string; variant: 'default' | 'secondary' | 'destructive' | 'outline'; className: string }> = {
      PENDING: { label: lang.statusPending, variant: 'secondary', className: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400 border-amber-200 dark:border-amber-800' },
      APPROVED: { label: lang.statusApproved, variant: 'default', className: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400 border-green-200 dark:border-green-800' },
      REJECTED: { label: lang.statusRejected, variant: 'destructive', className: '' },
      PAID: { label: lang.statusPaid, variant: 'default', className: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400 border-emerald-200 dark:border-emerald-800' },
      REQUESTED: { label: lang.statusRequested, variant: 'secondary', className: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400 border-blue-200 dark:border-blue-800' },
    }
    const info = map[status] || { label: status, variant: 'outline' as const, className: '' }
    return <Badge variant={info.variant} className={info.className}>{info.label}</Badge>
  }

  // ==================== LOADING STATE ====================
  if (loading) {
    return (
      <div className="flex items-center justify-center py-32">
        <Loader2 className="w-8 h-8 animate-spin text-blue-500" />
      </div>
    )
  }

  // ==================== ERROR STATE ====================
  if (error && !affiliate) {
    return (
      <div className="flex flex-col items-center justify-center py-32 gap-4">
        <p className="text-sm text-red-500 dark:text-red-400">{error}</p>
        <Button variant="outline" size="sm" onClick={fetchAllData}>{lang.retry}</Button>
      </div>
    )
  }

  // ==================== MAIN CONTENT ====================
  return (
    <TooltipProvider>
    <motion.div
      className="space-y-6 max-w-5xl mx-auto"
      variants={containerVariants}
      initial="hidden"
      animate="visible"
    >
      {/* Header */}
      <motion.div variants={itemVariants}>
        <div className="flex items-center gap-3 mb-1">
          <Gift className="w-6 h-6 text-blue-500" />
          <h2 className="text-xl font-bold text-white dark:text-white">{lang.title}</h2>
        </div>
        <p className="text-sm text-lux-text-muted dark:text-gray-400 ml-9">{lang.subtitle}</p>
      </motion.div>

      {/* A. Overview Section - 3 Stat Cards */}
      <motion.div variants={itemVariants} className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card className="bg-white dark:bg-gray-900/80 border-gray-200 dark:border-gray-800">
          <CardContent className="p-4 sm:p-5">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-blue-50 dark:bg-blue-900/30 flex items-center justify-center">
                <Users className="w-5 h-5 text-blue-500 dark:text-blue-400" />
              </div>
              <div>
                <p className="text-xs text-lux-text-muted dark:text-gray-500 font-medium">{lang.totalReferrals}</p>
                <p className="text-xl font-bold text-gray-900 dark:text-white">{totalReferrals}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-white dark:bg-gray-900/80 border-gray-200 dark:border-gray-800">
          <CardContent className="p-4 sm:p-5">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-green-50 dark:bg-green-900/30 flex items-center justify-center">
                <CheckCircle className="w-5 h-5 text-green-500 dark:text-green-400" />
              </div>
              <div>
                <p className="text-xs text-lux-text-muted dark:text-gray-500 font-medium">{lang.activeReferrals}</p>
                <p className="text-xl font-bold text-gray-900 dark:text-white">{activeReferrals}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-white dark:bg-gray-900/80 border-gray-200 dark:border-gray-800">
          <CardContent className="p-4 sm:p-5">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-emerald-50 dark:bg-emerald-900/30 flex items-center justify-center">
                <Banknote className="w-5 h-5 text-emerald-500 dark:text-emerald-400" />
              </div>
              <div>
                <p className="text-xs text-lux-text-muted dark:text-gray-500 font-medium">{lang.totalEarnings}</p>
                <p className="text-xl font-bold text-gray-900 dark:text-white">{formatRupiah(affiliate?.totalEarned ?? 0)}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </motion.div>

      {/* B. Referral Link Section */}
      <motion.div variants={itemVariants}>
        <Card className="bg-white dark:bg-gray-900/80 border-gray-200 dark:border-gray-800 overflow-hidden">
          <CardHeader className="pb-3 px-5 pt-5">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base font-semibold text-gray-900 dark:text-white flex items-center gap-2">
                <Link2 className="w-4 h-4 text-blue-500" />
                {lang.referralLinkTitle}
              </CardTitle>
              <Button
                variant="ghost"
                size="sm"
                className="text-xs text-blue-500 hover:text-blue-600 dark:text-blue-400 dark:hover:text-blue-300 h-7 px-2"
                onClick={() => setEditCodeOpen(true)}
              >
                <Pencil className="w-3 h-3 mr-1" />
                {lang.changeCode}
              </Button>
            </div>
          </CardHeader>
          <CardContent className="px-5 pb-5 space-y-3">
            {/* Referral Code */}
            <div>
              <Label className="text-xs text-lux-text-muted dark:text-gray-500 mb-1.5 block">{lang.referralCode}</Label>
              <div className="flex items-center gap-2">
                <div className="flex-1 flex items-center gap-2 px-3 py-2 rounded-lg bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700">
                  <span className="font-mono text-sm font-bold text-gray-900 dark:text-white tracking-wider">{affiliate?.referralCode}</span>
                </div>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant="outline"
                      size="sm"
                      className="h-9 px-3 shrink-0"
                      onClick={() => handleCopy(affiliate?.referralCode || '', 'code')}
                    >
                      {copiedField === 'code' ? <CheckCircle className="w-4 h-4 text-green-500" /> : <Copy className="w-4 h-4" />}
                      <span className="hidden sm:inline ml-1.5 text-xs">{copiedField === 'code' ? lang.copied : lang.copyCode}</span>
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>{lang.copyCode}</TooltipContent>
                </Tooltip>
              </div>
            </div>

            {/* Referral Link */}
            <div>
              <Label className="text-xs text-lux-text-muted dark:text-gray-500 mb-1.5 block">{lang.referralLink}</Label>
              <div className="flex items-center gap-2">
                <div className="flex-1 flex items-center gap-2 px-3 py-2 rounded-lg bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 min-w-0">
                  <span className="text-xs text-gray-600 dark:text-gray-400 truncate">{affiliate?.referralLink}</span>
                </div>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant="outline"
                      size="sm"
                      className="h-9 px-3 shrink-0"
                      onClick={() => handleCopy(affiliate?.referralLink || '', 'link')}
                    >
                      {copiedField === 'link' ? <CheckCircle className="w-4 h-4 text-green-500" /> : <Copy className="w-4 h-4" />}
                      <span className="hidden sm:inline ml-1.5 text-xs">{copiedField === 'link' ? lang.copied : lang.copyLink}</span>
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>{lang.copyLink}</TooltipContent>
                </Tooltip>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant="outline"
                      size="sm"
                      className="h-9 px-3 shrink-0"
                      onClick={handleShare}
                    >
                      <Share2 className="w-4 h-4" />
                      <span className="hidden sm:inline ml-1.5 text-xs">{lang.share}</span>
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>{lang.share}</TooltipContent>
                </Tooltip>
              </div>
            </div>
          </CardContent>
        </Card>
      </motion.div>

      {/* C. Earnings History + D. Withdrawal Section (side by side on desktop) */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* C. Earnings History */}
        <motion.div variants={itemVariants}>
          <Card className="bg-white dark:bg-gray-900/80 border-gray-200 dark:border-gray-800">
            <CardHeader className="pb-3 px-5 pt-5">
              <CardTitle className="text-base font-semibold text-gray-900 dark:text-white flex items-center gap-2">
                <TrendingUp className="w-4 h-4 text-emerald-500" />
                {lang.earningsTitle}
              </CardTitle>
            </CardHeader>
            <CardContent className="px-5 pb-5">
              {filteredReferrals.length === 0 ? (
                <div className="flex flex-col items-center py-8 gap-2">
                  <Gift className="w-10 h-10 text-gray-300 dark:text-gray-600" />
                  <p className="text-sm text-lux-text-muted dark:text-gray-500">{lang.noReferrals}</p>
                </div>
              ) : (
                <>
                  {/* Filter */}
                  <div className="flex items-center gap-1.5 mb-3">
                    {(['all', 'active', 'inactive'] as const).map((filter) => (
                      <Button
                        key={filter}
                        variant={referralFilter === filter ? 'default' : 'ghost'}
                        size="sm"
                        className={`h-7 text-xs px-2.5 ${referralFilter === filter
                          ? 'bg-blue-500/15 text-blue-600 dark:text-blue-400 hover:bg-blue-500/20'
                          : 'text-lux-text-muted dark:text-gray-500 hover:text-gray-900 dark:hover:text-white'}`}
                        onClick={() => setReferralFilter(filter)}
                      >
                        {lang[filter]}
                      </Button>
                    ))}
                  </div>
                  <div className="max-h-72 overflow-y-auto space-y-2 pr-1">
                    {filteredReferrals.map((ref) => (
                      <motion.div
                        key={ref.id}
                        initial={{ opacity: 0, x: -8 }}
                        animate={{ opacity: 1, x: 0 }}
                        className="flex items-center gap-3 p-2.5 rounded-lg bg-gray-50 dark:bg-gray-800/50 border border-gray-100 dark:border-gray-800"
                      >
                        <div className={`w-2 h-2 rounded-full shrink-0 ${
                          ref.activityLevel === 'active'
                            ? 'bg-green-500'
                            : ref.activityLevel === 'recent'
                              ? 'bg-amber-400'
                              : 'bg-gray-300 dark:bg-gray-600'
                        }`} />
                        <div className="flex-1 min-w-0">
                          <p className="text-xs font-medium text-gray-900 dark:text-white truncate">
                            {ref.referredName || (ref.referredEmail ? maskEmail(ref.referredEmail) : '---')}
                          </p>
                          <p className="text-[11px] text-lux-text-muted dark:text-gray-500">
                            {formatDate(ref.createdAt, language)}
                          </p>
                        </div>
                        <div className="text-right shrink-0">
                          <p className="text-xs font-semibold text-emerald-600 dark:text-emerald-400">
                            {ref.commissionAmount > 0 ? `+${formatRupiah(ref.commissionAmount)}` : '---'}
                          </p>
                          <Badge
                            variant="outline"
                            className={`text-[10px] px-1.5 py-0 h-4 font-normal ${
                              ref.activityLevel === 'active'
                                ? 'border-green-300 text-green-600 dark:border-green-700 dark:text-green-400'
                                : ref.activityLevel === 'recent'
                                  ? 'border-amber-300 text-amber-600 dark:border-amber-700 dark:text-amber-400'
                                  : 'border-gray-300 text-gray-500 dark:border-gray-600 dark:text-gray-500'
                            }`}
                          >
                            {ref.activityLevel === 'active' ? lang.statusActive
                              : ref.activityLevel === 'recent' ? lang.statusRecent
                                : lang.statusInactive}
                          </Badge>
                        </div>
                      </motion.div>
                    ))}
                  </div>
                </>
              )}
            </CardContent>
          </Card>
        </motion.div>

        {/* D. Withdrawal Section */}
        <motion.div variants={itemVariants}>
          <Card className="bg-white dark:bg-gray-900/80 border-gray-200 dark:border-gray-800">
            <CardHeader className="pb-3 px-5 pt-5">
              <div className="flex items-center justify-between">
                <CardTitle className="text-base font-semibold text-gray-900 dark:text-white flex items-center gap-2">
                  <Wallet className="w-4 h-4 text-blue-500" />
                  {lang.withdrawalTitle}
                </CardTitle>
                <div className="text-right">
                  <p className="text-[10px] text-lux-text-muted dark:text-gray-500">{lang.currentBalance}</p>
                  <p className="text-sm font-bold text-emerald-600 dark:text-emerald-400">{formatRupiah(affiliate?.currentBalance ?? 0)}</p>
                </div>
              </div>
            </CardHeader>
            <CardContent className="px-5 pb-5 space-y-4">
              <Button
                onClick={() => setWithdrawOpen(true)}
                className="w-full bg-blue-500 hover:bg-blue-600 text-white h-10"
                disabled={(affiliate?.currentBalance ?? 0) < 100000}
              >
                <CreditCard className="w-4 h-4 mr-2" />
                {lang.requestWithdrawal}
              </Button>
              {(affiliate?.currentBalance ?? 0) < 100000 && (
                <p className="text-[11px] text-amber-600 dark:text-amber-400 text-center">{lang.minWithdrawal}</p>
              )}

              {withdrawals.length === 0 ? (
                <div className="flex flex-col items-center py-6 gap-2">
                  <Banknote className="w-8 h-8 text-gray-300 dark:text-gray-600" />
                  <p className="text-sm text-lux-text-muted dark:text-gray-500">{lang.noWithdrawals}</p>
                </div>
              ) : (
                <div className="max-h-56 overflow-y-auto space-y-2 pr-1">
                  {withdrawals.map((w) => (
                    <motion.div
                      key={w.id}
                      initial={{ opacity: 0, x: -8 }}
                      animate={{ opacity: 1, x: 0 }}
                      className="p-3 rounded-lg bg-gray-50 dark:bg-gray-800/50 border border-gray-100 dark:border-gray-800 space-y-1.5"
                    >
                      <div className="flex items-center justify-between">
                        <p className="text-sm font-semibold text-gray-900 dark:text-white">{formatRupiah(w.amount)}</p>
                        <StatusBadge status={w.status} />
                      </div>
                      <div className="flex items-center gap-1.5 text-[11px] text-lux-text-muted dark:text-gray-500">
                        <Building2 className="w-3 h-3" />
                        <span className="truncate">{w.bankAccountInfo}</span>
                      </div>
                      <p className="text-[10px] text-lux-text-muted dark:text-gray-500">
                        {lang.requestedOn} {formatDate(w.requestedAt, language)}
                        {w.paidAt && ` · ${lang.paidOn} ${formatDate(w.paidAt, language)}`}
                      </p>
                    </motion.div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </motion.div>
      </div>

      {/* E. Referral Progress - Milestones */}
      <motion.div variants={itemVariants}>
        <Card className="bg-white dark:bg-gray-900/80 border-gray-200 dark:border-gray-800">
          <CardHeader className="pb-3 px-5 pt-5">
            <CardTitle className="text-base font-semibold text-gray-900 dark:text-white flex items-center gap-2">
              <Trophy className="w-4 h-4 text-yellow-500" />
              {lang.progressTitle}
            </CardTitle>
            <p className="text-xs text-lux-text-muted dark:text-gray-500 mt-0.5">{lang.progressSubtitle}</p>
          </CardHeader>
          <CardContent className="px-5 pb-5">
            {/* Progress bar toward next milestone */}
            {nextMilestone && (
              <div className="mb-5">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-semibold text-gray-900 dark:text-white">{totalReferrals}</span>
                    <span className="text-xs text-lux-text-muted dark:text-gray-500">/ {nextMilestone.target}</span>
                    <span className="text-xs font-medium text-gray-600 dark:text-gray-400">
                      {language === 'id' ? nextMilestone.labelId : nextMilestone.labelEn}
                    </span>
                  </div>
                  <span className="text-xs text-lux-text-muted dark:text-gray-500">{Math.round(milestoneProgress)}%</span>
                </div>
                <Progress value={milestoneProgress} className="h-2.5 bg-gray-100 dark:bg-gray-800" />
              </div>
            )}

            {/* Milestone cards */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {MILESTONES.map((milestone) => {
                const achieved = totalReferrals >= milestone.target
                const isCurrent = currentMilestone?.key === milestone.key
                const Icon = milestone.icon

                return (
                  <motion.div
                    key={milestone.key}
                    whileHover={{ scale: 1.03 }}
                    whileTap={{ scale: 0.98 }}
                    className={`relative p-3 rounded-xl border text-center transition-all duration-200 ${
                      achieved
                        ? `${milestone.bgColor} ${milestone.borderColor} border`
                        : 'bg-gray-50 dark:bg-gray-800/50 border-gray-200 dark:border-gray-700 opacity-50'
                    }`}
                  >
                    {achieved && (
                      <motion.div
                        initial={{ scale: 0 }}
                        animate={{ scale: 1 }}
                        className="absolute -top-1.5 -right-1.5"
                      >
                        <CheckCircle className="w-4 h-4 text-green-500" />
                      </motion.div>
                    )}
                    <Icon className={`w-6 h-6 mx-auto mb-1.5 ${achieved ? milestone.color : 'text-gray-400 dark:text-gray-600'}`} />
                    <p className={`text-xs font-bold ${achieved ? 'text-gray-900 dark:text-white' : 'text-gray-400 dark:text-gray-600'}`}>
                      {language === 'id' ? milestone.labelId : milestone.labelEn}
                    </p>
                    <p className="text-[10px] text-lux-text-muted dark:text-gray-500 mt-0.5">{milestone.target} referrals</p>
                    {isCurrent && (
                      <Badge className="mt-1.5 text-[9px] h-4 px-1.5 bg-blue-500/15 text-blue-600 dark:text-blue-400 border-blue-200 dark:border-blue-800 hover:bg-blue-500/20">
                        {lang.active}
                      </Badge>
                    )}
                  </motion.div>
                )
              })}
            </div>
          </CardContent>
        </Card>
      </motion.div>

      {/* F. How It Works */}
      <motion.div variants={itemVariants}>
        <Card className="bg-white dark:bg-gray-900/80 border-gray-200 dark:border-gray-800">
          <CardHeader className="pb-3 px-5 pt-5">
            <CardTitle className="text-base font-semibold text-gray-900 dark:text-white flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 text-blue-500" />
              {lang.howItWorksTitle}
            </CardTitle>
          </CardHeader>
          <CardContent className="px-5 pb-5">
            {/* Steps visual */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-5">
              {[
                { icon: Share2, title: lang.how1Title, desc: lang.how1Desc, step: '01' },
                { icon: Users, title: lang.how2Title, desc: lang.how2Desc, step: '02' },
                { icon: Banknote, title: lang.how3Title, desc: lang.how3Desc, step: '03' },
              ].map((step, i) => (
                <div key={i} className="relative text-center">
                  <div className="w-12 h-12 rounded-2xl bg-blue-50 dark:bg-blue-900/30 flex items-center justify-center mx-auto mb-3">
                    <step.icon className="w-5 h-5 text-blue-500" />
                  </div>
                  <span className="text-[10px] font-bold text-blue-500 tracking-wider">STEP {step.step}</span>
                  <p className="text-sm font-semibold text-gray-900 dark:text-white mt-1">{step.title}</p>
                  <p className="text-xs text-lux-text-muted dark:text-gray-500 mt-0.5">{step.desc}</p>
                  {i < 2 && (
                    <div className="hidden sm:block absolute top-6 -right-2 text-gray-300 dark:text-gray-600">
                      <ChevronRight className="w-4 h-4" />
                    </div>
                  )}
                </div>
              ))}
            </div>

            {/* FAQ Accordion */}
            <Accordion type="single" collapsible className="w-full">
              {[
                { q: lang.q1Title, a: lang.q1Content },
                { q: lang.q2Title, a: lang.q2Content },
                { q: lang.q3Title, a: lang.q3Content },
                { q: lang.q4Title, a: lang.q4Content },
                { q: lang.q5Title, a: lang.q5Content },
              ].map((item, i) => (
                <AccordionItem key={i} value={`faq-${i}`} className="border-gray-200 dark:border-gray-800">
                  <AccordionTrigger className="text-sm text-gray-900 dark:text-white hover:no-underline py-3">
                    {item.q}
                  </AccordionTrigger>
                  <AccordionContent className="text-xs text-lux-text-muted dark:text-gray-400 leading-relaxed pb-3">
                    {item.a}
                  </AccordionContent>
                </AccordionItem>
              ))}
            </Accordion>
          </CardContent>
        </Card>
      </motion.div>

      {/* G. Promo Materials */}
      <motion.div variants={itemVariants}>
        <Card className="bg-white dark:bg-gray-900/80 border-gray-200 dark:border-gray-800">
          <CardHeader className="pb-3 px-5 pt-5">
            <CardTitle className="text-base font-semibold text-gray-900 dark:text-white flex items-center gap-2">
              <Megaphone className="w-4 h-4 text-orange-500" />
              {lang.promoTitle}
            </CardTitle>
            <p className="text-xs text-lux-text-muted dark:text-gray-500 mt-0.5">{lang.promoSubtitle}</p>
          </CardHeader>
          <CardContent className="px-5 pb-5 space-y-3">
            {/* WhatsApp */}
            <div className="p-3 rounded-lg bg-green-50 dark:bg-green-900/10 border border-green-200 dark:border-green-800/50">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <MessageCircle className="w-4 h-4 text-green-600 dark:text-green-400" />
                  <span className="text-xs font-semibold text-green-700 dark:text-green-400">{lang.whatsapp}</span>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-7 text-xs text-green-600 dark:text-green-400 hover:text-green-700 dark:hover:text-green-300 hover:bg-green-100 dark:hover:bg-green-900/20 px-2"
                  onClick={() => handleCopyPromo(promoTexts.whatsapp)}
                >
                  {copiedField === 'promo' ? <CheckCircle className="w-3.5 h-3.5 mr-1" /> : <Copy className="w-3.5 h-3.5 mr-1" />}
                  {lang.copyPromo}
                </Button>
              </div>
              <p className="text-[11px] text-green-800 dark:text-green-300/70 leading-relaxed line-clamp-2">{promoTexts.whatsapp}</p>
            </div>

            {/* Telegram */}
            <div className="p-3 rounded-lg bg-sky-50 dark:bg-sky-900/10 border border-sky-200 dark:border-sky-800/50">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <Send className="w-4 h-4 text-sky-600 dark:text-sky-400" />
                  <span className="text-xs font-semibold text-sky-700 dark:text-sky-400">{lang.telegram}</span>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-7 text-xs text-sky-600 dark:text-sky-400 hover:text-sky-700 dark:hover:text-sky-300 hover:bg-sky-100 dark:hover:bg-sky-900/20 px-2"
                  onClick={() => handleCopyPromo(promoTexts.telegram)}
                >
                  {copiedField === 'promo' ? <CheckCircle className="w-3.5 h-3.5 mr-1" /> : <Copy className="w-3.5 h-3.5 mr-1" />}
                  {lang.copyPromo}
                </Button>
              </div>
              <p className="text-[11px] text-sky-800 dark:text-sky-300/70 leading-relaxed line-clamp-2">{promoTexts.telegram}</p>
            </div>

            {/* Twitter */}
            <div className="p-3 rounded-lg bg-gray-50 dark:bg-gray-800/50 border border-gray-200 dark:border-gray-700">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <ExternalLink className="w-4 h-4 text-gray-600 dark:text-gray-400" />
                  <span className="text-xs font-semibold text-gray-700 dark:text-gray-300">{lang.twitter}</span>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-7 text-xs text-gray-600 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 px-2"
                  onClick={() => handleCopyPromo(promoTexts.twitter)}
                >
                  {copiedField === 'promo' ? <CheckCircle className="w-3.5 h-3.5 mr-1" /> : <Copy className="w-3.5 h-3.5 mr-1" />}
                  {lang.copyPromo}
                </Button>
              </div>
              <p className="text-[11px] text-gray-700 dark:text-gray-400 leading-relaxed line-clamp-2">{promoTexts.twitter}</p>
            </div>
          </CardContent>
        </Card>
      </motion.div>

      {/* ===== DIALOGS ===== */}

      {/* Update Referral Code Dialog */}
      <Dialog open={editCodeOpen} onOpenChange={setEditCodeOpen}>
        <DialogContent className="bg-white dark:bg-gray-900 border-gray-200 dark:border-gray-800 sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-gray-900 dark:text-white flex items-center gap-2">
              <Pencil className="w-4 h-4 text-blue-500" />
              {lang.updateCodeTitle}
            </DialogTitle>
            <DialogDescription>{lang.updateCodeDesc}</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label className="text-xs">{lang.newCode}</Label>
              <Input
                value={newCode}
                onChange={(e) => setNewCode(e.target.value.toUpperCase())}
                placeholder={lang.newCodePlaceholder}
                maxLength={20}
                className="font-mono tracking-wider"
              />
              <p className="text-[10px] text-lux-text-muted dark:text-gray-500">
                {language === 'id'
                  ? 'Hanya huruf besar dan angka, 4-20 karakter. Tidak bisa diubah selama 30 hari setelah pergantian.'
                  : 'Only uppercase letters and numbers, 4-20 characters. Cannot be changed for 30 days after update.'}
              </p>
            </div>
          </div>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => { setEditCodeOpen(false); setNewCode('') }} className="dark:border-gray-700 dark:text-gray-300">
              {lang.cancel}
            </Button>
            <Button
              onClick={handleUpdateCode}
              disabled={updatingCode || !newCode.trim() || newCode.trim().length < 4}
              className="bg-blue-500 hover:bg-blue-600 text-white"
            >
              {updatingCode && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              {lang.save}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Withdrawal Request Dialog */}
      <Dialog open={withdrawOpen} onOpenChange={setWithdrawOpen}>
        <DialogContent className="bg-white dark:bg-gray-900 border-gray-200 dark:border-gray-800 sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-gray-900 dark:text-white flex items-center gap-2">
              <Wallet className="w-4 h-4 text-blue-500" />
              {lang.requestWithdrawal}
            </DialogTitle>
            <DialogDescription>
              {lang.currentBalance}: <span className="font-bold text-emerald-600 dark:text-emerald-400">{formatRupiah(affiliate?.currentBalance ?? 0)}</span>
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label className="text-xs">{lang.bankName}</Label>
              <Input
                value={withdrawForm.bankName}
                onChange={(e) => setWithdrawForm(prev => ({ ...prev, bankName: e.target.value }))}
                placeholder={lang.bankNamePlaceholder}
              />
            </div>
            <div className="space-y-2">
              <Label className="text-xs">{lang.accountNumber}</Label>
              <Input
                value={withdrawForm.accountNumber}
                onChange={(e) => setWithdrawForm(prev => ({ ...prev, accountNumber: e.target.value }))}
                placeholder={lang.accountNumberPlaceholder}
              />
            </div>
            <div className="space-y-2">
              <Label className="text-xs">{lang.withdrawAmount}</Label>
              <Input
                type="number"
                value={withdrawForm.amount}
                onChange={(e) => setWithdrawForm(prev => ({ ...prev, amount: e.target.value }))}
                placeholder={lang.withdrawAmountPlaceholder}
                min={100000}
                max={affiliate?.currentBalance ?? 0}
              />
              <p className="text-[10px] text-lux-text-muted dark:text-gray-500">{lang.minWithdrawal}</p>
            </div>
          </div>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => { setWithdrawOpen(false); setWithdrawForm({ bankName: '', accountNumber: '', amount: '' }) }} className="dark:border-gray-700 dark:text-gray-300">
              {lang.cancel}
            </Button>
            <Button
              onClick={handleWithdraw}
              disabled={
                withdrawing ||
                !withdrawForm.bankName.trim() ||
                !withdrawForm.accountNumber.trim() ||
                !withdrawForm.amount ||
                Number(withdrawForm.amount) < 100000
              }
              className="bg-blue-500 hover:bg-blue-600 text-white"
            >
              {withdrawing && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              {lang.submit}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </motion.div>
    </TooltipProvider>
  )
}
