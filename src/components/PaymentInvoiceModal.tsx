'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  X, Copy, Check, ExternalLink, Clock, ShieldCheck, Receipt,
  Sparkles, ChevronDown, ChevronUp, Loader2, CheckCircle2,
  Banknote, Smartphone, QrCode, Lock, AlertCircle, CreditCard,
  Wallet, Crown, PartyPopper, ArrowRight, MessageCircle, HeadphonesIcon
} from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { formatRupiah } from '@/lib/pricing'

// ============================================
// Payment method categories mapped to SakuraPay codes
// ============================================
const PAYMENT_CATEGORIES: {
  type: string
  label: string
  icon: typeof Banknote
  methods: { code: string; label: string }[]
  color: {
    sel: string
    unsel: string
    glow: string
    iconBg: string
  }
}[] = [
  {
    type: 'QRIS',
    label: 'QRIS',
    icon: QrCode,
    methods: [
      { code: 'QRIS', label: 'QRIS' },
    ],
    color: {
      sel: 'border-emerald-400 bg-emerald-500/15',
      unsel: 'border-white/10 bg-white/[0.03]',
      glow: 'shadow-emerald-500/30 shadow-lg',
      iconBg: 'bg-emerald-500',
    },
  },
  {
    type: 'EWALLET',
    label: 'E-Wallet',
    icon: Smartphone,
    methods: [
      { code: 'GOPAY', label: 'GoPay' },
      { code: 'DANA', label: 'DANA' },
      { code: 'OVO', label: 'OVO' },
      { code: 'SHOPEEPAY', label: 'ShopeePay' },
      { code: 'LINKAJA', label: 'LinkAja' },
    ],
    color: {
      sel: 'border-cyan-400 bg-blue-500/15',
      unsel: 'border-white/10 bg-white/[0.03]',
      glow: 'shadow-blue-500/30 shadow-lg',
      iconBg: 'bg-blue-500',
    },
  },
  {
    type: 'VA',
    label: 'Virtual Account',
    icon: Banknote,
    methods: [
      { code: 'BCAVA', label: 'BCA' },
      { code: 'BNIVA', label: 'BNI' },
      { code: 'BRIVA', label: 'BRI' },
      { code: 'PERMATAVA', label: 'Permata' },
      { code: 'MUAMALATVA', label: 'Muamalat' },
    ],
    color: {
      sel: 'border-amber-400 bg-amber-500/15',
      unsel: 'border-white/10 bg-white/[0.03]',
      glow: 'shadow-amber-500/30 shadow-lg',
      iconBg: 'bg-amber-500',
    },
  },
]

// Min amounts from SakuraPay docs (in IDR)
const METHOD_MIN_AMOUNTS: Record<string, number> = {
  QRIS: 500,
  GOPAY: 500,
  DANA: 1000,
  OVO: 1000,
  SHOPEEPAY: 1000,
  LINKAJA: 1000,
  BCAVA: 10000,
  BNIVA: 10000,
  BRIVA: 10000,
  PERMATAVA: 10000,
  MUAMALATVA: 10000,
  ALFAMART: 10000,
  INDOMARET: 10000,
}

// ============================================
// Types
// ============================================
type OrderStatus = 'PENDING' | 'SUCCESS' | 'FAILED' | 'EXPIRED' | 'UNKNOWN'

interface PaymentInvoiceModalProps {
  isOpen: boolean
  onClose: () => void
  invoiceNumber: string
  planName: string
  duration: string
  amount: number
  expiresAt: string
  plan: string           // PRO | LIFETIME
  durationMonths: number
  paymentUrl?: string
  orderId?: string
  onPayNow?: () => void
  initialStatus?: OrderStatus
  paidAt?: string | null
}

export default function PaymentInvoiceModal({
  isOpen,
  onClose,
  invoiceNumber,
  planName,
  duration,
  amount,
  expiresAt,
  plan,
  durationMonths,
  paymentUrl: initialPaymentUrl,
  orderId: initialOrderId,
  onPayNow,
  initialStatus,
  paidAt: initialPaidAt,
}: PaymentInvoiceModalProps) {
  const [copied, setCopied] = useState<string | null>(null)
  const [paying, setPaying] = useState(false)
  const [paid, setPaid] = useState(false)
  const [paymentUrl, setPaymentUrl] = useState(initialPaymentUrl || '')
  const [orderId, setOrderId] = useState(initialOrderId || '')
  // The real invoice number from API (used for polling), starts with prop value
  const [realInvoiceNumber, setRealInvoiceNumber] = useState(invoiceNumber)

  // Status from DB (polling)
  const [orderStatus, setOrderStatus] = useState<OrderStatus>(initialStatus || 'PENDING')
  const [paidAtDate, setPaidAtDate] = useState<string | null>(initialPaidAt || null)
  const [pollCount, setPollCount] = useState(0)
  const pollingRef = useRef<NodeJS.Timeout | null>(null)
  const isPaidRef = useRef(false)

  // Payment method selection
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null)
  const [selectedMethod, setSelectedMethod] = useState<string | null>(null)
  const [payError, setPayError] = useState('')
  const [showManualTransfer, setShowManualTransfer] = useState(false)

  // Confirm payment button state
  const [confirming, setConfirming] = useState(false)
  const [confirmMessage, setConfirmMessage] = useState('')
  const [confirmType, setConfirmType] = useState<'info' | 'success' | 'error'>('info')

  // Derived: is this order fully paid?
  const isPaid = orderStatus === 'SUCCESS'
  const isExpired = orderStatus === 'EXPIRED'
  const canPay = selectedMethod !== null && !paying && !paid && !isPaid

  // ============================================
  // POLLING: Check order status every 5 seconds after payment
  // ============================================
  const pollOrderStatus = useCallback(async () => {
    if (isPaidRef.current || !realInvoiceNumber) return

    try {
      const res = await fetch(`/api/payment/order-status?invoiceNumber=${encodeURIComponent(realInvoiceNumber)}`)
      if (!res.ok) return

      const data = await res.json()
      if (data.status === 'SUCCESS') {
        isPaidRef.current = true
        setOrderStatus('SUCCESS')
        setPaidAtDate(data.paidAt || new Date().toISOString())
        // Stop polling on success
        if (pollingRef.current) {
          clearInterval(pollingRef.current)
          pollingRef.current = null
        }
      } else if (data.status === 'EXPIRED') {
        setOrderStatus('EXPIRED')
        if (pollingRef.current) {
          clearInterval(pollingRef.current)
          pollingRef.current = null
        }
      }
    } catch {
      // Silent fail on polling
    }
  }, [realInvoiceNumber])

  // Start polling when user has paid (opened gateway)
  useEffect(() => {
    if (paid && !isPaidRef.current) {
      // Poll every 5 seconds
      pollingRef.current = setInterval(() => {
        setPollCount(prev => prev + 1)
      }, 5000)
    }

    return () => {
      if (pollingRef.current) {
        clearInterval(pollingRef.current)
        pollingRef.current = null
      }
    }
  }, [paid])

  // Actual polling triggered by pollCount changes
  useEffect(() => {
    if (paid && !isPaidRef.current && pollCount > 0) {
      pollOrderStatus()
    }
  }, [paid, pollCount, pollOrderStatus])

  // Reset on modal open
  useEffect(() => {
    if (isOpen) {
      isPaidRef.current = false
      setOrderStatus(initialStatus || 'PENDING')
      setPaidAtDate(initialPaidAt || null)
      setPollCount(0)
      setRealInvoiceNumber(invoiceNumber)
    }
  }, [isOpen, initialStatus, initialPaidAt, invoiceNumber])

  // ============================================
  // Helpers
  // ============================================
  // Discord admin link
  const DISCORD_ADMIN_LINK = 'https://discord.gg/KkYYFP9nC'
  const tgMessage = encodeURIComponent(`Halo admin LuxTrade, saya butuh bantuan terkait pembayaran. Invoice: ${invoiceNumber}. Paket: ${planName} (${formatRupiah(amount)}). Terima kasih.`)

  const getMethodsForCategory = (catType: string) => {
    const cat = PAYMENT_CATEGORIES.find(c => c.type === catType)
    return cat?.methods || []
  }

  const isBelowMin = (methodCode: string) => {
    const min = METHOD_MIN_AMOUNTS[methodCode]
    return min ? amount < min : false
  }

  const formatExpiry = (dateStr: string) => {
    try {
      return new Date(dateStr).toLocaleString('id-ID', {
        day: 'numeric',
        month: 'long',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      })
    } catch {
      return dateStr
    }
  }

  const formatPaidDate = (dateStr: string | null) => {
    if (!dateStr) return null
    try {
      return new Date(dateStr).toLocaleString('id-ID', {
        day: 'numeric',
        month: 'long',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      })
    } catch {
      return null
    }
  }

  const handleCopy = (text: string, id: string) => {
    navigator.clipboard.writeText(text)
    setCopied(id)
    setTimeout(() => setCopied(null), 2000)
  }

  // ============================================
  // CONFIRM PAYMENT HANDLER (Saya Sudah Bayar)
  // ============================================
  const handleConfirmPayment = async () => {
    setConfirming(true)
    setConfirmMessage('')

    try {
      const res = await fetch('/api/payment/confirm-payment', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ invoiceNumber: realInvoiceNumber }),
      })

      const data = await res.json()

      if (data.success && data.status === 'SUCCESS') {
        // Payment confirmed!
        setConfirmType('success')
        setConfirmMessage('Pembayaran berhasil dikonfirmasi! Mengaktifkan paket...')
        isPaidRef.current = true
        setOrderStatus('SUCCESS')
        setPaidAtDate(data.paidAt || new Date().toISOString())
        if (pollingRef.current) {
          clearInterval(pollingRef.current)
          pollingRef.current = null
        }
      } else if (data.status === 'PENDING') {
        setConfirmType('info')
        setConfirmMessage(data.hint || data.message || 'Pembayaran belum terdeteksi. Coba lagi dalam 1-2 menit.')
      } else if (data.status === 'EXPIRED') {
        setConfirmType('error')
        setConfirmMessage(data.message || 'Invoice sudah kedaluwarsa.')
        setOrderStatus('EXPIRED')
        if (pollingRef.current) {
          clearInterval(pollingRef.current)
          pollingRef.current = null
        }
      } else {
        setConfirmType('info')
        setConfirmMessage(data.message || 'Tidak dapat memeriksa status pembayaran.')
      }
    } catch (err: any) {
      setConfirmType('error')
      setConfirmMessage('Gagal terhubung ke server. Coba lagi.')
    } finally {
      setConfirming(false)
    }
  }

  const handleCategorySelect = (catType: string) => {
    if (selectedCategory === catType) {
      setSelectedCategory(null)
      setSelectedMethod(null)
    } else {
      setSelectedCategory(catType)
      const methods = getMethodsForCategory(catType)
      const validMethod = methods.find(m => !isBelowMin(m.code))
      setSelectedMethod(validMethod?.code || null)
    }
    setPayError('')
  }

  const handleMethodSelect = (methodCode: string) => {
    if (isBelowMin(methodCode)) {
      setPayError(`Min. pembayaran ${methodCode} adalah ${formatRupiah(METHOD_MIN_AMOUNTS[methodCode])}`)
      return
    }
    setSelectedMethod(methodCode)
    setPayError('')
  }

  // ============================================
  // MAIN PAY HANDLER
  // ============================================
  const handlePay = async () => {
    if (!selectedMethod) return
    setPaying(true)
    setPayError('')

    try {
      if (paymentUrl) {
        window.open(paymentUrl, '_blank')
        setPaying(false)
        setPaid(true)
        return
      }

      const response = await fetch('/api/payment/create-order', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          amount,
          plan,
          durationMonths,
          paymentMethod: selectedMethod,
        })
      })

      const data = await response.json()

      if (!response.ok || !data.paymentUrl) {
        throw new Error(data.error || data.details || 'Gagal membuat pesanan')
      }

      setPaymentUrl(data.paymentUrl)
      setOrderId(data.orderId || '')
      // Store the real invoice number from API for polling
      if (data.invoiceNumber) {
        setRealInvoiceNumber(data.invoiceNumber)
      }

      // Open SakuraPay gateway
      window.open(data.paymentUrl, '_blank')
      setPaying(false)
      setPaid(true)
    } catch (error: any) {
      console.error('Payment error:', error)
      setPaying(false)
      setPayError(error.message || 'Gagal membuat pembayaran. Silakan coba lagi atau gunakan Transfer Manual.')
    }
  }

  const getSelectedCategoryData = () => {
    return PAYMENT_CATEGORIES.find(c => c.type === selectedCategory)
  }

  if (!isOpen) return null

  // ============================================
  // RENDER
  // ============================================
  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 bg-black/85 backdrop-blur-md z-[60] flex items-center justify-center p-4"
        onClick={onClose}
      >
        <motion.div
          initial={{ scale: 0.9, opacity: 0, y: 30 }}
          animate={{ scale: 1, opacity: 1, y: 0 }}
          exit={{ scale: 0.9, opacity: 0, y: 30 }}
          transition={{ type: 'spring', damping: 25, stiffness: 300 }}
          onClick={(e) => e.stopPropagation()}
          className="relative w-full max-w-lg max-h-[90vh] overflow-y-auto"
        >
          <div className={`
            relative rounded-3xl overflow-hidden shadow-2xl
            ${isPaid
              ? 'border border-emerald-400/30 shadow-emerald-500/20'
              : 'border border-blue-500/20 shadow-blue-900/20'
            }
          `}>
            {/* Background */}
            <div className={`
              absolute inset-0 bg-gradient-to-br
              ${isPaid
                ? 'from-[#041a12] via-[#0a2618] to-[#0d1f15]'
                : 'from-[#0A0612] via-[#1A0F2E] to-[#0D0715]'
              }
            `} />

            {/* Decorative glow */}
            {isPaid && (
              <div className="absolute top-0 left-1/2 -translate-x-1/2 w-96 h-96 bg-emerald-500/8 rounded-full blur-3xl" />
            )}
            {!isPaid && (
              <div className="absolute top-0 left-1/2 -translate-x-1/2 w-80 h-80 bg-blue-500/5 rounded-full blur-3xl" />
            )}

            {/* ============================================ */}
            {/* HEADER                                        */}
            {/* ============================================ */}
            <div className={`
              relative backdrop-blur-xl border-b
              ${isPaid
                ? 'bg-gradient-to-r from-emerald-600/90 via-green-500/90 to-emerald-600/90 border-b border-emerald-400/20'
                : 'bg-gradient-to-r from-emerald-600/90 via-teal-500/90 to-emerald-600/90 border-b border-emerald-400/20'
              }
            `}>
              <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNDAiIGhlaWdodD0iNDAiIHZpZXdCb3g9IjAgMCA0MCA0MCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48Y2lyY2xlIGN4PSIyMCIgY3k9IjIwIiByPSIxIiBmaWxsPSJyZ2JhKDI1NSwyNTUsMjU1LDAuMDUpIi8+PC9zdmc+')] opacity-50" />
              <div className="relative p-6">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className={`p-2.5 rounded-xl ${isPaid ? 'bg-white/20' : 'bg-white/15'}`}>
                      {isPaid ? (
                        <PartyPopper className="w-6 h-6 text-white" />
                      ) : (
                        <Receipt className="w-6 h-6 text-white" />
                      )}
                    </div>
                    <div>
                      <h2 className="text-xl font-bold text-white">
                        {isPaid ? 'Pembayaran Berhasil!' : paid ? 'Menunggu Pembayaran...' : 'Invoice Pembayaran'}
                      </h2>
                      <p className={`text-xs mt-0.5 ${isPaid ? 'text-emerald-100/90' : 'text-emerald-100/80'}`}>
                        {isPaid
                          ? `${planName} telah diaktifkan`
                          : paid
                            ? 'Menunggu konfirmasi pembayaran otomatis...'
                            : 'Pilih metode & lanjut ke pembayaran'
                        }
                      </p>
                    </div>
                  </div>
                  <button
                    onClick={onClose}
                    className="p-2 rounded-full bg-white/10 hover:bg-white/20 transition-colors"
                  >
                    <X className="w-5 h-5 text-white" />
                  </button>
                </div>
              </div>
            </div>

            {/* Invoice Body */}
            <div className="relative p-6 space-y-5">

              {/* ============================================ */}
              {/* PAID SUCCESS STATE                            */}
              {/* ============================================ */}
              {isPaid && (
                <motion.div
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  className="space-y-4"
                >
                  {/* Success Banner */}
                  <div className="bg-gradient-to-r from-emerald-500/15 via-green-500/15 to-emerald-500/15 border border-emerald-400/25 rounded-2xl p-6 flex flex-col items-center gap-3 relative overflow-hidden">
                    {/* Shimmer effect */}
                    <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/5 to-transparent animate-pulse" />
                    <motion.div
                      initial={{ scale: 0 }}
                      animate={{ scale: 1 }}
                      transition={{ type: 'spring', damping: 12, stiffness: 200, delay: 0.1 }}
                      className="relative w-16 h-16 rounded-full bg-gradient-to-br from-emerald-400 to-green-500 flex items-center justify-center shadow-lg shadow-emerald-500/40"
                    >
                      <CheckCircle2 className="w-8 h-8 text-white" />
                    </motion.div>
                    <div className="relative text-center">
                      <p className="text-xl font-bold text-emerald-300">Lunas & Berhasil</p>
                      <p className="text-sm text-white/60 mt-1">
                        Akun Anda telah otomatis di-upgrade ke {planName}
                      </p>
                    </div>
                    <Badge className="relative bg-emerald-500/25 text-emerald-300 text-xs font-semibold px-3">
                      ✓ Pembayaran Dikonfirmasi
                    </Badge>
                  </div>

                  {/* Invoice Card — Paid version */}
                  <div className="bg-gradient-to-br from-emerald-500/[0.06] to-emerald-500/[0.02] border border-emerald-500/20 rounded-2xl overflow-hidden">
                    <div className="h-1 bg-gradient-to-r from-emerald-500 via-green-400 to-amber-400" />
                    <div className="p-5 space-y-3">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <Sparkles className="w-5 h-5 text-emerald-400" />
                          <span className="font-bold text-white tracking-tight">LuxTrade</span>
                        </div>
                        <Badge className="bg-emerald-500/20 text-emerald-300 text-[10px]">
                          LUNAS
                        </Badge>
                      </div>

                      <div className="h-px bg-emerald-500/10" />

                      <div className="flex items-center justify-between text-sm">
                        <span className="text-white/40">No. Invoice</span>
                        <div className="flex items-center gap-2">
                          <code className="text-white font-mono text-xs">{invoiceNumber}</code>
                          <button onClick={() => handleCopy(invoiceNumber, 'invoice')} className="p-1 rounded hover:bg-white/10 transition-colors">
                            {copied === 'invoice' ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3 text-white/40" />}
                          </button>
                        </div>
                      </div>

                      <div className="flex items-center justify-between text-sm">
                        <span className="text-white/40">Paket</span>
                        <span className="text-white font-medium flex items-center gap-1.5">
                          <Crown className="w-3.5 h-3.5 text-emerald-400" />
                          {planName}
                        </span>
                      </div>

                      <div className="flex items-center justify-between text-sm">
                        <span className="text-white/40">Durasi</span>
                        <span className="text-white">{duration}</span>
                      </div>

                      {/* PAID DATE — shown when paid */}
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-white/40">Tanggal Pembayaran</span>
                        <div className="flex items-center gap-1.5">
                          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                          <span className="text-emerald-300 text-xs font-medium">
                            {formatPaidDate(paidAtDate) || formatPaidDate(new Date().toISOString())}
                          </span>
                        </div>
                      </div>

                      <div className="flex items-center justify-between text-sm">
                        <span className="text-white/40">Status</span>
                        <Badge className="bg-emerald-500/25 text-emerald-300 text-[10px] font-semibold">
                          ✓ Lunas
                        </Badge>
                      </div>

                      <div className="h-px bg-emerald-500/10" />

                      <div className="flex items-center justify-between">
                        <span className="text-white/60 font-medium">Total Dibayar</span>
                        <span className="text-2xl font-bold bg-gradient-to-r from-emerald-300 via-green-300 to-emerald-300 bg-clip-text text-transparent">
                          {formatRupiah(amount)}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Upgrade Confirmation Message */}
                  <div className="bg-gradient-to-r from-amber-500/10 to-amber-500/5 border border-amber-500/20 rounded-2xl p-4 flex items-start gap-3">
                    <Crown className="w-5 h-5 text-amber-400 flex-shrink-0 mt-0.5" />
                    <div>
                      <p className="text-sm font-semibold text-amber-300">
                        {planName} Aktif!
                      </p>
                      <p className="text-xs text-white/50 mt-1">
                        Semua fitur premium sudah bisa diakses. Selamat trading!
                      </p>
                    </div>
                  </div>

                  {/* Security */}
                  <div className="flex items-center justify-center gap-1.5 text-white/20 text-[10px]">
                    <ShieldCheck className="w-3 h-3" />
                    <span>Dicetak otomatis oleh LuxTrade Payment System</span>
                  </div>

                  {/* Go to Dashboard Button */}
                  <motion.button
                    whileHover={{ scale: 1.01 }}
                    whileTap={{ scale: 0.98 }}
                    onClick={onClose}
                    className="w-full py-4 rounded-xl font-semibold flex items-center justify-center gap-3 bg-gradient-to-r from-emerald-500 via-green-500 to-emerald-500 hover:from-emerald-400 hover:via-green-400 hover:to-emerald-400 text-white shadow-lg shadow-emerald-500/25 cursor-pointer transition-all"
                  >
                    <ArrowRight className="w-5 h-5" />
                    Kembali ke Dashboard
                  </motion.button>

                  {/* ===== HELP BLOCK — SUCCESS state ===== */}
                  <div className="mt-1 bg-white/[0.03] border border-white/10 rounded-2xl p-4 space-y-3">
                    <div className="flex items-center gap-2">
                      <HeadphonesIcon className="w-4 h-4 text-amber-400" />
                      <p className="text-xs font-medium text-white/60">Butuh Bantuan?</p>
                    </div>
                    <p className="text-[11px] text-white/40 leading-relaxed">
                      Paket PRO/Lifetime belum aktif secara otomatis? Jangan khawatir! Hubungi admin untuk aktivasi manual.
                    </p>
                    <motion.a
                      href={`${TG_ADMIN_LINK}?text=${tgMessage}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      whileHover={{ scale: 1.01 }}
                      whileTap={{ scale: 0.98 }}
                      className="flex items-center justify-center gap-2 w-full py-3 rounded-xl bg-[#0088cc]/15 border border-[#0088cc]/25 text-[#0088cc] text-sm font-medium hover:bg-[#0088cc]/25 cursor-pointer transition-colors"
                    >
                      <svg viewBox="0 0 24 24" fill="currentColor" className="w-4 h-4">
                        <path d="M11.944 0A12 12 0 0 0 0 12a12 12 0 0 0 12 12 12 12 0 0 0 12-12A12 12 0 0 0 12 0h-.056zm4.962 7.224c.1-.002.321.023.465.14a.506.506 0 0 1 .171.325c.016.093.036.306.02.472-.18 1.898-.962 6.502-1.36 8.627-.168.9-.499 1.201-.82 1.23-.696.065-1.225-.46-1.9-.902-1.056-.693-1.653-1.124-2.678-1.8-1.185-.78-.417-1.21.258-1.91.177-.184 3.247-2.977 3.307-3.23.007-.032.014-.15-.056-.212s-.174-.041-.249-.024c-.106.024-1.793 1.14-5.061 3.345-.479.33-.913.492-1.302.48-.428-.012-1.252-.242-1.865-.44-.752-.245-1.349-.374-1.297-.789.027-.216.325-.437.893-.663 3.498-1.524 5.83-2.529 6.998-3.015 3.332-1.386 4.025-1.627 4.476-1.635z" />
                      </svg>
                      Chat Admin via Discord
                    </motion.a>
                  </div>
                </motion.div>
              )}

              {/* ============================================ */}
              {/* WAITING STATE (paid but not confirmed yet)   */}
              {/* ============================================ */}
              {!isPaid && !isExpired && paid && (
                <motion.div
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  className="space-y-4"
                >
                  {/* Waiting Banner */}
                  <div className="bg-blue-500/10 border border-blue-500/20 rounded-2xl p-5 flex flex-col items-center gap-3">
                    <div className="relative">
                      <Loader2 className="w-10 h-10 text-blue-400 animate-spin" />
                    </div>
                    <div className="text-center">
                      <p className="text-lg font-bold text-blue-300">Menunggu Konfirmasi</p>
                      <p className="text-sm text-white/60 mt-1">
                        Selesaikan pembayaran di tab yang baru dibuka, lalu klik "Saya Sudah Bayar" di bawah.
                      </p>
                    </div>
                    <Badge className="bg-blue-500/20 text-blue-300 text-xs animate-pulse">
                      <Loader2 className="w-3 h-3 mr-1 animate-spin" />
                      Memeriksa Status...
                    </Badge>
                  </div>

                  {/* Compact Invoice Info */}
                  <div className="bg-white/[0.02] border border-white/10 rounded-2xl overflow-hidden">
                    <div className="p-4 space-y-3">
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-white/40">No. Invoice</span>
                        <code className="text-white font-mono text-xs">{invoiceNumber}</code>
                      </div>
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-white/40">Paket</span>
                        <span className="text-white font-medium">{planName}</span>
                      </div>
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-white/40">Total</span>
                        <span className="text-lg font-bold text-white">{formatRupiah(amount)}</span>
                      </div>
                      <div className="h-px bg-white/5" />
                      <div className="flex items-center gap-2 text-xs text-white/40">
                        <Clock className="w-3.5 h-3.5" />
                        <span>Invoice berlaku hingga {formatExpiry(expiresAt)}</span>
                      </div>
                    </div>
                  </div>

                  {/* Confirmation feedback message */}
                  {confirmMessage && (
                    <motion.div
                      initial={{ opacity: 0, y: -5 }}
                      animate={{ opacity: 1, y: 0 }}
                      className={`rounded-2xl p-4 flex items-start gap-3 ${
                        confirmType === 'success'
                          ? 'bg-emerald-500/10 border border-emerald-500/25'
                          : confirmType === 'error'
                            ? 'bg-red-500/10 border border-red-500/25'
                            : 'bg-amber-500/10 border border-amber-500/25'
                      }`}
                    >
                      {confirmType === 'success' ? (
                        <CheckCircle2 className="w-5 h-5 text-emerald-400 flex-shrink-0 mt-0.5" />
                      ) : confirmType === 'error' ? (
                        <AlertCircle className="w-5 h-5 text-red-400 flex-shrink-0 mt-0.5" />
                      ) : (
                        <Clock className="w-5 h-5 text-amber-400 flex-shrink-0 mt-0.5" />
                      )}
                      <p className={`text-sm leading-relaxed ${
                        confirmType === 'success'
                          ? 'text-emerald-300'
                          : confirmType === 'error'
                            ? 'text-red-300'
                            : 'text-amber-300'
                      }`}>
                        {confirmMessage}
                      </p>
                    </motion.div>
                  )}

                  {/* ===== "SAYA SUDAH BAYAR" BUTTON ===== */}
                  <motion.button
                    whileHover={{ scale: 1.01 }}
                    whileTap={{ scale: 0.98 }}
                    onClick={handleConfirmPayment}
                    disabled={confirming}
                    className="w-full py-4 rounded-xl font-semibold flex items-center justify-center gap-3 bg-gradient-to-r from-emerald-500 via-green-500 to-emerald-500 hover:from-emerald-400 hover:via-green-400 hover:to-emerald-400 text-white shadow-lg shadow-emerald-500/25 cursor-pointer transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {confirming ? (
                      <Loader2 className="w-5 h-5 animate-spin" />
                    ) : (
                      <CheckCircle2 className="w-5 h-5" />
                    )}
                    {confirming ? 'Memeriksa Status Pembayaran...' : 'Saya Sudah Bayar'}
                  </motion.button>

                  {/* Retry open gateway */}
                  {paymentUrl && (
                    <button
                      onClick={() => window.open(paymentUrl, '_blank')}
                      className="w-full py-3 rounded-xl text-sm text-blue-300 hover:text-blue-200 hover:bg-blue-500/10 transition-all flex items-center justify-center gap-2"
                    >
                      <ExternalLink className="w-4 h-4" />
                      Buka Ulang Halaman Pembayaran
                    </button>
                  )}

                  <button
                    onClick={onClose}
                    className="w-full py-3 rounded-xl text-xs text-white/40 hover:text-white/70 hover:bg-white/5 transition-all"
                  >
                    Kembali ke Dashboard
                  </button>

                  {/* ===== HELP BLOCK — WAITING state ===== */}
                  <div className="mt-1 bg-white/[0.03] border border-white/10 rounded-2xl p-4 space-y-3">
                    <div className="flex items-center gap-2">
                      <HeadphonesIcon className="w-4 h-4 text-amber-400" />
                      <p className="text-xs font-medium text-white/60">Butuh Bantuan?</p>
                    </div>
                    <p className="text-[11px] text-white/40 leading-relaxed">
                      Ada masalah dengan QRIS atau pembayaran? Hubungi admin langsung untuk bantuan cepat.
                    </p>
                    <motion.a
                      href={`${TG_ADMIN_LINK}?text=${tgMessage}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      whileHover={{ scale: 1.01 }}
                      whileTap={{ scale: 0.98 }}
                      className="flex items-center justify-center gap-2 w-full py-3 rounded-xl bg-[#0088cc]/15 border border-[#0088cc]/25 text-[#0088cc] text-sm font-medium hover:bg-[#0088cc]/25 cursor-pointer transition-colors"
                    >
                      <svg viewBox="0 0 24 24" fill="currentColor" className="w-4 h-4">
                        <path d="M11.944 0A12 12 0 0 0 0 12a12 12 0 0 0 12 12 12 12 0 0 0 12-12A12 12 0 0 0 12 0h-.056zm4.962 7.224c.1-.002.321.023.465.14a.506.506 0 0 1 .171.325c.016.093.036.306.02.472-.18 1.898-.962 6.502-1.36 8.627-.168.9-.499 1.201-.82 1.23-.696.065-1.225-.46-1.9-.902-1.056-.693-1.653-1.124-2.678-1.8-1.185-.78-.417-1.21.258-1.91.177-.184 3.247-2.977 3.307-3.23.007-.032.014-.15-.056-.212s-.174-.041-.249-.024c-.106.024-1.793 1.14-5.061 3.345-.479.33-.913.492-1.302.48-.428-.012-1.252-.242-1.865-.44-.752-.245-1.349-.374-1.297-.789.027-.216.325-.437.893-.663 3.498-1.524 5.83-2.529 6.998-3.015 3.332-1.386 4.025-1.627 4.476-1.635z" />
                      </svg>
                      Chat Admin via Discord
                    </motion.a>
                  </div>
                </motion.div>
              )}

              {/* ============================================ */}
              {/* EXPIRED STATE                                  */}
              {/* ============================================ */}
              {!isPaid && isExpired && (
                <motion.div
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  className="space-y-4"
                >
                  <div className="bg-red-500/10 border border-red-500/20 rounded-2xl p-5 flex flex-col items-center gap-3">
                    <Clock className="w-10 h-10 text-red-400" />
                    <div className="text-center">
                      <p className="text-lg font-bold text-red-300">Invoice Expired</p>
                      <p className="text-sm text-white/60 mt-1">
                        Invoice ini sudah melewati batas waktu. Silakan buat pesanan baru.
                      </p>
                    </div>
                    <Badge className="bg-red-500/20 text-red-300 text-xs">
                      Expired
                    </Badge>
                  </div>
                  <button
                    onClick={onClose}
                    className="w-full py-3 rounded-xl text-xs text-white/60 hover:text-white hover:bg-white/5 transition-all border border-white/10"
                  >
                    Buat Pesanan Baru
                  </button>
                </motion.div>
              )}

              {/* ============================================ */}
              {/* PENDING STATE — Full payment flow              */}
              {/* ============================================ */}
              {!isPaid && !isExpired && !paid && (
                <>
                  {/* Invoice Card */}
                  <div className="relative bg-gradient-to-br from-white/[0.04] to-white/[0.01] border border-white/10 rounded-2xl overflow-hidden">
                    <div className="h-1 bg-gradient-to-r from-blue-500 via-cyan-400 to-amber-500" />
                    <div className="p-5 space-y-4">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <Sparkles className="w-5 h-5 text-amber-400" />
                          <span className="font-bold text-white tracking-tight">LuxTrade</span>
                        </div>
                        <Badge variant="outline" className="text-[10px] border-blue-500/30 text-cyan-300 bg-blue-500/10">
                          INVOICE
                        </Badge>
                      </div>

                      <div className="space-y-3">
                        <div className="flex items-center justify-between text-sm">
                          <span className="text-white/40">No. Invoice</span>
                          <div className="flex items-center gap-2">
                            <code className="text-white font-mono text-xs">{invoiceNumber}</code>
                            <button onClick={() => handleCopy(invoiceNumber, 'invoice')} className="p-1 rounded hover:bg-white/10 transition-colors">
                              {copied === 'invoice' ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3 text-white/40" />}
                            </button>
                          </div>
                        </div>

                        <div className="h-px bg-white/5" />

                        <div className="flex items-center justify-between text-sm">
                          <span className="text-white/40">Paket</span>
                          <span className="text-white font-medium">{planName}</span>
                        </div>

                        <div className="flex items-center justify-between text-sm">
                          <span className="text-white/40">Durasi</span>
                          <span className="text-white">{duration}</span>
                        </div>

                        <div className="flex items-center justify-between text-sm">
                          <span className="text-white/40">Status</span>
                          <Badge className="bg-yellow-500/20 text-yellow-300 text-[10px]">
                            Menunggu Pembayaran
                          </Badge>
                        </div>

                        <div className="flex items-center justify-between text-sm">
                          <span className="text-white/40">Berlaku Hingga</span>
                          <div className="flex items-center gap-1.5">
                            <Clock className="w-3.5 h-3.5 text-amber-400/60" />
                            <span className="text-white/70 text-xs">{formatExpiry(expiresAt)}</span>
                          </div>
                        </div>
                      </div>

                      <div className="h-px bg-gradient-to-r from-transparent via-white/10 to-transparent" />

                      <div className="flex items-center justify-between">
                        <span className="text-white/60 font-medium">Total Pembayaran</span>
                        <span className="text-2xl font-bold bg-gradient-to-r from-cyan-300 via-pink-300 to-amber-300 bg-clip-text text-transparent">
                          {formatRupiah(amount)}
                        </span>
                      </div>
                    </div>

                    <div className="px-5 pb-4">
                      <div className="flex items-center justify-center gap-1.5 text-white/20 text-[10px]">
                        <ShieldCheck className="w-3 h-3" />
                        <span>Dicetak otomatis oleh LuxTrade Payment System</span>
                      </div>
                    </div>
                  </div>

                  {/* ===== STEP 1: CATEGORY SELECTION ===== */}
                  <div className="bg-white/[0.02] border border-white/10 rounded-2xl p-4 space-y-3">
                    <p className="text-xs text-white/50 font-medium flex items-center gap-1.5">
                      <Lock className="w-3.5 h-3.5 text-cyan-400" />
                      Langkah 1 — Pilih Kategori Pembayaran
                    </p>
                    <div className="grid grid-cols-3 gap-2">
                      {PAYMENT_CATEGORIES.map((cat) => {
                        const isSelected = selectedCategory === cat.type
                        const Icon = cat.icon
                        return (
                          <button
                            type="button"
                            key={cat.type}
                            onClick={() => handleCategorySelect(cat.type)}
                            className={`
                              relative flex flex-col items-center gap-2 p-3 rounded-xl border-2 transition-all duration-200
                              cursor-pointer active:scale-[0.96]
                              ${isSelected
                                ? `${cat.color.sel} ${cat.color.glow}`
                                : `${cat.color.unsel} hover:border-white/20`
                              }
                            `}
                          >
                            {isSelected && (
                              <motion.div
                                layoutId="method-glow"
                                className="absolute inset-0 rounded-xl opacity-30"
                                style={{
                                  background: `radial-gradient(ellipse at center, ${
                                    cat.type === 'QRIS' ? 'rgba(16,185,129,0.3)' :
                                    cat.type === 'EWALLET' ? 'rgba(59,130,246,0.3)' :
                                    'rgba(245,158,11,0.3)'
                                  }, transparent 70%)`,
                                }}
                                transition={{ type: 'spring', damping: 20 }}
                              />
                            )}
                            <div className={`relative p-2 rounded-lg transition-colors ${isSelected ? cat.color.iconBg : 'bg-white/5'}`}>
                              <Icon className={`w-5 h-5 transition-colors ${isSelected ? 'text-white' : 'text-white/40'}`} />
                            </div>
                            <span className={`relative text-[11px] font-semibold transition-colors ${
                              isSelected ? 'text-white' : 'text-white/50'
                            }`}>
                              {cat.label}
                            </span>
                            <div className="relative flex flex-wrap justify-center gap-0.5">
                              {cat.methods.slice(0, 3).map((m) => (
                                <span key={m.code} className={`text-[8px] px-1.5 py-0.5 rounded-full transition-colors ${
                                  isSelected ? 'bg-white/15 text-white/70' : 'bg-white/5 text-white/25'
                                }`}>
                                  {m.label}
                                </span>
                              ))}
                              {cat.methods.length > 3 && (
                                <span className={`text-[8px] px-1.5 py-0.5 rounded-full transition-colors ${
                                  isSelected ? 'bg-white/15 text-white/70' : 'bg-white/5 text-white/25'
                                }`}>
                                  +{cat.methods.length - 3}
                                </span>
                              )}
                            </div>
                            {isSelected && (
                              <motion.div
                                initial={{ scale: 0 }}
                                animate={{ scale: 1 }}
                                className="absolute -top-1.5 -right-1.5 w-5 h-5 rounded-full bg-emerald-500 flex items-center justify-center shadow-lg"
                              >
                                <Check className="w-3 h-3 text-white" />
                              </motion.div>
                            )}
                          </button>
                        )
                      })}
                    </div>
                  </div>

                  {/* ===== STEP 2: SPECIFIC METHOD ===== */}
                  {selectedCategory && (
                    <motion.div
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ duration: 0.2 }}
                      className="bg-white/[0.02] border border-white/10 rounded-2xl p-4 space-y-3"
                    >
                      <p className="text-xs text-white/50 font-medium flex items-center gap-1.5">
                        <CreditCard className="w-3.5 h-3.5 text-cyan-400" />
                        Langkah 2 — Pilih Metode Spesifik
                      </p>
                      <div className="space-y-2">
                        {getMethodsForCategory(selectedCategory).map((method) => {
                          const isSelected = selectedMethod === method.code
                          const belowMin = isBelowMin(method.code)
                          const catData = getSelectedCategoryData()
                          return (
                            <button
                              type="button"
                              key={method.code}
                              onClick={() => handleMethodSelect(method.code)}
                              disabled={belowMin}
                              className={`
                                w-full flex items-center gap-3 p-3 rounded-xl border-2 transition-all duration-200
                                cursor-pointer active:scale-[0.98]
                                ${isSelected
                                  ? `${catData?.color.sel || ''} ${catData?.color.glow || ''}`
                                  : belowMin
                                    ? 'border-white/5 bg-white/[0.01] opacity-35 cursor-not-allowed'
                                    : 'border-white/10 bg-white/[0.02] hover:border-white/20'
                                }
                              `}
                            >
                              <div className={`w-4 h-4 rounded-full border-2 flex items-center justify-center flex-shrink-0 transition-colors ${
                                isSelected ? 'border-emerald-400 bg-emerald-400/20' : 'border-white/20'
                              }`}>
                                {isSelected && <div className="w-2 h-2 rounded-full bg-emerald-400" />}
                              </div>
                              <div className="flex-1 min-w-0">
                                <span className={`text-sm font-medium transition-colors ${
                                  isSelected ? 'text-white' : 'text-white/60'
                                }`}>
                                  {method.label}
                                </span>
                                {belowMin && (
                                  <p className="text-amber-400 text-[10px] mt-0.5">Min. {formatRupiah(METHOD_MIN_AMOUNTS[method.code])}</p>
                                )}
                              </div>
                              {isSelected && (
                                <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }}>
                                  <CheckCircle2 className="w-5 h-5 text-emerald-400" />
                                </motion.div>
                              )}
                            </button>
                          )
                        })}
                      </div>
                    </motion.div>
                  )}

                  {/* Error */}
                  {!paid && payError && (
                    <motion.div
                      initial={{ opacity: 0, y: -5 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="flex items-start gap-2 p-3 bg-red-500/10 border border-red-500/20 rounded-xl text-red-400 text-xs"
                    >
                      <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
                      <span>{payError}</span>
                    </motion.div>
                  )}

                  {/* ===== BAYAR SEKARANG BUTTON ===== */}
                  <motion.button
                    whileHover={canPay ? { scale: 1.01 } : {}}
                    whileTap={canPay ? { scale: 0.98 } : {}}
                    onClick={handlePay}
                    disabled={!canPay}
                    className={`
                      w-full py-4 rounded-xl font-semibold flex items-center justify-center gap-3 transition-all text-sm
                      ${canPay
                        ? 'bg-gradient-to-r from-emerald-500 via-teal-500 to-emerald-500 hover:from-emerald-400 hover:via-teal-400 hover:to-emerald-400 text-white shadow-lg shadow-emerald-500/25 cursor-pointer'
                        : 'bg-white/5 text-white/25 border border-white/10 cursor-not-allowed'
                      }
                    `}
                  >
                    {paying ? (
                      <>
                        <Loader2 className="w-5 h-5 animate-spin" />
                        Membuat Pesanan...
                      </>
                    ) : !selectedMethod ? (
                      <>
                        <Lock className="w-5 h-5" />
                        Pilih Metode Pembayaran
                      </>
                    ) : (
                      <>
                        <ExternalLink className="w-5 h-5" />
                        Bayar Sekarang — {formatRupiah(amount)}
                      </>
                    )}
                  </motion.button>

                  {!paid && selectedMethod && !payError && (
                    <p className="text-[10px] text-center text-white/25">
                      Anda akan dialihkan ke halaman pembayaran SakuraPay
                    </p>
                  )}

                  {/* ===== MANUAL TRANSFER FALLBACK ===== */}
                  <div className="rounded-2xl border border-white/5 overflow-hidden">
                    <button
                      type="button"
                      onClick={() => setShowManualTransfer(!showManualTransfer)}
                      className="w-full flex items-center justify-between px-4 py-3 text-xs text-white/30 hover:text-white/50 hover:bg-white/[0.02] transition-colors"
                    >
                      <span className="flex items-center gap-1.5">
                        <Banknote className="w-3.5 h-3.5" />
                        Transfer Manual (Cadangan)
                      </span>
                      {showManualTransfer
                        ? <ChevronUp className="w-3.5 h-3.5" />
                        : <ChevronDown className="w-3.5 h-3.5" />
                      }
                    </button>

                    <AnimatePresence>
                      {showManualTransfer && (
                        <motion.div
                          initial={{ height: 0, opacity: 0 }}
                          animate={{ height: 'auto', opacity: 1 }}
                          exit={{ height: 0, opacity: 0 }}
                          transition={{ duration: 0.2 }}
                          className="overflow-hidden"
                        >
                          <div className="px-4 pb-4 pt-1">
                            <div className="bg-white/[0.03] rounded-xl p-4">
                              <p className="text-[10px] text-white/30 mb-3 text-center">
                                Gunakan hanya jika pembayaran otomatis gagal
                              </p>
                              <div className="text-center space-y-3">
                                <div>
                                  <p className="text-xs text-white/40">Bank Jago (542)</p>
                                  <div className="flex items-center justify-center gap-2 mt-1">
                                    <p className="text-lg font-bold text-white font-mono">105668597393</p>
                                    <button
                                      onClick={() => handleCopy('105668597393', 'bank')}
                                      className="p-1 rounded hover:bg-white/10 transition-colors"
                                    >
                                      {copied === 'bank' ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5 text-white/40" />}
                                    </button>
                                  </div>
                                  <p className="text-xs text-white/50">a.n. RIZQI AKBAR PRATAMA</p>
                                </div>
                                <a
                                  href="https://discord.gg/KkYYFP9nC"
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-[#5865F2]/20 text-[#5865F2] text-xs font-medium hover:bg-[#5865F2]/30 transition-colors"
                                >
                                  <Wallet className="w-3.5 h-3.5" />
                                  Konfirmasi via Discord
                                </a>
                              </div>
                            </div>
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>

                  {/* ===== HELP BLOCK — PENDING state ===== */}
                  <div className="mt-1 bg-white/[0.03] border border-white/10 rounded-2xl p-4 space-y-3">
                    <div className="flex items-center gap-2">
                      <HeadphonesIcon className="w-4 h-4 text-amber-400" />
                      <p className="text-xs font-medium text-white/60">Butuh Bantuan?</p>
                    </div>
                    <p className="text-[11px] text-white/40 leading-relaxed">
                      Ada kendala dengan metode pembayaran atau ada pertanyaan? Hubungi admin langsung.
                    </p>
                    <motion.a
                      href={DISCORD_ADMIN_LINK}
                      target="_blank"
                      rel="noopener noreferrer"
                      whileHover={{ scale: 1.01 }}
                      whileTap={{ scale: 0.98 }}
                      className="flex items-center justify-center gap-2 w-full py-3 rounded-xl bg-[#5865F2]/15 border border-[#5865F2]/25 text-[#5865F2] text-sm font-medium hover:bg-[#5865F2]/25 cursor-pointer transition-colors"
                    >
                      <svg viewBox="0 0 24 24" fill="currentColor" className="w-4 h-4">
                        <path d="M20.317 4.37a19.791 19.791 0 0 0-4.885-1.515.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0 12.64 12.64 0 0 0-.617-1.25.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057a.082.082 0 0 0 .031.057 19.9 19.9 0 0 0 5.993 3.03.078.078 0 0 0 .084-.028 14.09 14.09 0 0 0 1.226-1.994.076.076 0 0 0-.041-.106 13.107 13.107 0 0 1-1.872-.892.077.077 0 0 1-.008-.128 10.2 10.2 0 0 0 .372-.292.074.074 0 0 1 .077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 0 1 .078.01c.12.098.246.198.373.292a.077.077 0 0 1-.006.127 12.299 12.299 0 0 1-1.873.892.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028 19.839 19.839 0 0 0 6.002-3.03.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.03zM8.02 15.33c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.956-2.419 2.157-2.419 1.21 0 2.176 1.095 2.157 2.42 0 1.333-.956 2.418-2.157 2.418zm7.975 0c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.955-2.419 2.157-2.419 1.21 0 2.176 1.095 2.157 2.42 0 1.333-.946 2.418-2.157 2.418z" />
                      </svg>
                      Chat Admin via Discord
                    </motion.a>
                  </div>

                  {/* Back */}
                  <button
                    onClick={onClose}
                    className="w-full py-3 rounded-xl text-xs text-white/40 hover:text-white/70 hover:bg-white/5 transition-all"
                  >
                    Kembali ke Pilih Paket
                  </button>
                </>
              )}
            </div>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  )
}
