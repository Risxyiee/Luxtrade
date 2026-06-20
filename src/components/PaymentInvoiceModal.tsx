'use client'

import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { X, Copy, Check, ExternalLink, Clock, ShieldCheck, Receipt, Sparkles, ChevronDown, Loader2, CheckCircle2, Banknote, CreditCard, Smartphone } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { formatRupiah } from '@/lib/pricing'

interface PaymentInvoiceModalProps {
  isOpen: boolean
  onClose: () => void
  invoiceNumber: string
  planName: string
  duration: string
  amount: number
  expiresAt: string
  paymentUrl: string
  onPayNow?: () => void
}

export default function PaymentInvoiceModal({
  isOpen,
  onClose,
  invoiceNumber,
  planName,
  duration,
  amount,
  expiresAt,
  paymentUrl,
  onPayNow
}: PaymentInvoiceModalProps) {
  const [copied, setCopied] = useState<string | null>(null)
  const [paying, setPaying] = useState(false)
  const [paid, setPaid] = useState(false)

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

  const handleCopy = (text: string, id: string) => {
    navigator.clipboard.writeText(text)
    setCopied(id)
    setTimeout(() => setCopied(null), 2000)
  }

  const handlePay = async () => {
    if (paymentUrl) {
      setPaying(true)
      // Small delay for UX feel
      await new Promise(r => setTimeout(r, 500))
      window.open(paymentUrl, '_blank')
      setPaying(false)
      setPaid(true)
    }
  }

  if (!isOpen) return null

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
          <div className="relative bg-gradient-to-br from-[#0A0612] via-[#1A0F2E] to-[#0D0715] border border-purple-500/20 rounded-3xl overflow-hidden shadow-2xl shadow-purple-900/20">

            {/* Decorative */}
            <div className="absolute top-0 left-1/2 -translate-x-1/2 w-80 h-80 bg-purple-500/5 rounded-full blur-3xl" />

            {/* Header */}
            <div className="relative bg-gradient-to-r from-emerald-600/90 via-teal-500/90 to-emerald-600/90 backdrop-blur-xl border-b border-emerald-400/20">
              <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNDAiIGhlaWdodD0iNDAiIHZpZXdCb3g9IjAgMCA0MCA0MCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48Y2lyY2xlIGN4PSIyMCIgY3k9IjIwIiByPSIxIiBmaWxsPSJyZ2JhKDI1NSwyNTUsMjU1LDAuMDUpIi8+PC9zdmc+')] opacity-50" />
              <div className="relative p-6">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="p-2.5 rounded-xl bg-white/15">
                      <Receipt className="w-6 h-6 text-white" />
                    </div>
                    <div>
                      <h2 className="text-xl font-bold text-white">
                        {paid ? 'Pembayaran Diproses' : 'Invoice Pembayaran'}
                      </h2>
                      <p className="text-emerald-100/80 text-xs mt-0.5">
                        {paid ? 'Anda akan dialihkan ke halaman pembayaran' : 'Selesaikan pembayaran untuk mengaktifkan'}
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
            <div className="p-6 space-y-5">
              {/* Success State */}
              {paid && (
                <motion.div
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  className="bg-emerald-500/10 border border-emerald-500/20 rounded-2xl p-5 flex flex-col items-center gap-3"
                >
                  <CheckCircle2 className="w-12 h-12 text-emerald-400" />
                  <div className="text-center">
                    <p className="text-lg font-bold text-emerald-300">Pesanan Dibuat!</p>
                    <p className="text-sm text-white/60 mt-1">
                      Anda akan dialihkan ke halaman pembayaran DOKU
                    </p>
                  </div>
                  <Badge className="bg-emerald-500/20 text-emerald-300 text-xs">
                    Menunggu Pembayaran
                  </Badge>
                </motion.div>
              )}

              {/* Invoice Card */}
              <div className="relative bg-gradient-to-br from-white/[0.04] to-white/[0.01] border border-white/10 rounded-2xl overflow-hidden">
                {/* Invoice Top Decoration */}
                <div className="h-1 bg-gradient-to-r from-purple-500 via-pink-500 to-amber-500" />

                <div className="p-5 space-y-4">
                  {/* LuxTrade Header */}
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Sparkles className="w-5 h-5 text-amber-400" />
                      <span className="font-bold text-white tracking-tight">LuxTrade</span>
                    </div>
                    <Badge variant="outline" className="text-[10px] border-purple-500/30 text-purple-300 bg-purple-500/10">
                      INVOICE
                    </Badge>
                  </div>

                  {/* Invoice Details */}
                  <div className="space-y-3">
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-white/40">No. Invoice</span>
                      <div className="flex items-center gap-2">
                        <code className="text-white font-mono text-xs">{invoiceNumber}</code>
                        <button
                          onClick={() => handleCopy(invoiceNumber, 'invoice')}
                          className="p-1 rounded hover:bg-white/10 transition-colors"
                        >
                          {copied === 'invoice' ? (
                            <Check className="w-3 h-3 text-emerald-400" />
                          ) : (
                            <Copy className="w-3 h-3 text-white/40" />
                          )}
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
                      <Badge className={
                        paid
                          ? 'bg-amber-500/20 text-amber-300 text-[10px]'
                          : 'bg-yellow-500/20 text-yellow-300 text-[10px]'
                      }>
                        {paid ? 'Menunggu Pembayaran' : 'Menunggu Pembayaran'}
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

                  {/* Divider */}
                  <div className="h-px bg-gradient-to-r from-transparent via-white/10 to-transparent" />

                  {/* Total */}
                  <div className="flex items-center justify-between">
                    <span className="text-white/60 font-medium">Total Pembayaran</span>
                    <span className="text-2xl font-bold bg-gradient-to-r from-purple-300 via-pink-300 to-amber-300 bg-clip-text text-transparent">
                      {formatRupiah(amount)}
                    </span>
                  </div>
                </div>

                {/* Invoice Bottom Decoration */}
                <div className="px-5 pb-4">
                  <div className="flex items-center justify-center gap-1.5 text-white/20 text-[10px]">
                    <ShieldCheck className="w-3 h-3" />
                    <span>Dicetak otomatis oleh LuxTrade Payment System</span>
                  </div>
                </div>
              </div>

              {/* Payment Methods */}
              <div className="bg-white/[0.02] border border-white/10 rounded-2xl p-4">
                <p className="text-xs text-white/40 mb-3 font-medium">Metode Pembayaran Tersedia</p>
                <div className="grid grid-cols-3 gap-2">
                  {[
                    { icon: Banknote, label: 'Virtual Account', color: 'text-blue-400 bg-blue-500/10' },
                    { icon: Smartphone, label: 'E-Wallet', color: 'text-emerald-400 bg-emerald-500/10' },
                    { icon: CreditCard, label: 'Kartu / QRIS', color: 'text-purple-400 bg-purple-500/10' },
                  ].map((method) => (
                    <div key={method.label} className="flex flex-col items-center gap-1.5 p-2 rounded-xl bg-white/[0.02]">
                      <div className={`p-1.5 rounded-lg ${method.color}`}>
                        <method.icon className="w-4 h-4" />
                      </div>
                      <span className="text-[10px] text-white/50 text-center leading-tight">{method.label}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Instructions */}
              {!paid && (
                <div className="bg-amber-500/10 border border-amber-500/15 rounded-2xl p-4">
                  <p className="text-xs font-semibold text-amber-300 mb-2 flex items-center gap-1.5">
                    <ChevronDown className="w-3.5 h-3.5" />
                    Cara Pembayaran
                  </p>
                  <div className="space-y-1.5 text-xs text-white/60">
                    <p>1. Klik tombol &quot;Bayar Sekarang&quot; di bawah</p>
                    <p>2. Anda akan dialihkan ke halaman pembayaran DOKU</p>
                    <p>3. Pilih metode pembayaran yang Anda inginkan</p>
                    <p>4. Selesaikan pembayaran — fitur PRO akan aktif otomatis</p>
                  </div>
                </div>
              )}

              {/* Pay Button */}
              {paymentUrl && (
                <motion.button
                  whileHover={{ scale: 1.01 }}
                  whileTap={{ scale: 0.99 }}
                  onClick={handlePay}
                  disabled={paying || paid}
                  className={`
                    w-full py-4 rounded-xl font-semibold flex items-center justify-center gap-3 transition-all text-sm
                    ${paid
                      ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 cursor-default'
                      : 'bg-gradient-to-r from-emerald-500 via-teal-500 to-emerald-500 hover:from-emerald-400 hover:via-teal-400 hover:to-emerald-400 text-white shadow-lg shadow-emerald-500/25 cursor-pointer'
                    }
                  `}
                >
                  {paying ? (
                    <>
                      <Loader2 className="w-5 h-5 animate-spin" />
                      Mengalihkan...
                    </>
                  ) : paid ? (
                    <>
                      <CheckCircle2 className="w-5 h-5" />
                      Selesaikan Pembayaran di Tab Baru
                    </>
                  ) : (
                    <>
                      <ExternalLink className="w-5 h-5" />
                      Bayar Sekarang — {formatRupiah(amount)}
                    </>
                  )}
                </motion.button>
              )}

              {/* Manual Fallback */}
              {!paymentUrl && (
                <div className="bg-white/[0.03] border border-white/10 rounded-2xl p-5">
                  <p className="text-xs text-white/50 mb-3 text-center">Transfer Manual (Cadangan)</p>
                  <div className="text-center space-y-3">
                    <div>
                      <p className="text-xs text-white/40">Bank Jago (542)</p>
                      <p className="text-lg font-bold text-white font-mono mt-1">105668597393</p>
                      <p className="text-xs text-white/50">a.n. RIZQI AKBAR PRATAMA</p>
                    </div>
                    <a
                      href={`https://t.me/Risxyiee?text=${encodeURIComponent(`Halo admin, saya mau konfirmasi pembayaran LuxTrade paket ${planName} (${formatRupiah(amount)}). Invoice: ${invoiceNumber}`)}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-blue-500/20 text-blue-300 text-xs font-medium hover:bg-blue-500/30 transition-colors"
                    >
                      <ExternalLink className="w-3.5 h-3.5" />
                      Konfirmasi via Telegram
                    </a>
                  </div>
                </div>
              )}

              {/* Close / Back */}
              <button
                onClick={onClose}
                className="w-full py-3 rounded-xl text-xs text-white/40 hover:text-white/70 hover:bg-white/5 transition-all"
              >
                {paid ? 'Kembali ke Dashboard' : 'Kembali ke Pilih Paket'}
              </button>
            </div>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  )
}
