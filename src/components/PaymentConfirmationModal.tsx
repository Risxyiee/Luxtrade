'use client'

import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { X, Copy, Check, MessageCircle, Building2 } from 'lucide-react'

interface PaymentConfirmationModalProps {
  isOpen: boolean
  onClose: () => void
  planName: string
  planPrice: number
}

export default function PaymentConfirmationModal({
  isOpen,
  onClose,
  planName,
  planPrice
}: PaymentConfirmationModalProps) {
  const [copied, setCopied] = useState(false)

  const formatPrice = (price: number) => {
    return new Intl.NumberFormat('id-ID', {
      style: 'currency',
      currency: 'IDR',
      minimumFractionDigits: 0
    }).format(price)
  }

  const handleCopyAccountNumber = () => {
    navigator.clipboard.writeText('105668597393')
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const handleTelegramClick = () => {
    const message = `Halo admin, saya mau konfirmasi pembayaran Luxtrade paket ${planName}. Ini bukti transfernya.`
    const encodedMessage = encodeURIComponent(message)
    const telegramUrl = `https://t.me/Risxyiee?text=${encodedMessage}`
    window.open(telegramUrl, '_blank')
  }

  if (!isOpen) return null

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 bg-black/80 backdrop-blur-sm z-[60] flex items-center justify-center p-4"
        onClick={onClose}
      >
        <motion.div
          initial={{ scale: 0.9, opacity: 0, y: 20 }}
          animate={{ scale: 1, opacity: 1, y: 0 }}
          exit={{ scale: 0.9, opacity: 0, y: 20 }}
          transition={{ type: 'spring', damping: 25, stiffness: 300 }}
          onClick={(e) => e.stopPropagation()}
          className="relative w-full max-w-lg"
        >
          {/* Main Card */}
          <div className="relative bg-gradient-to-br from-[#0A0612] via-[#1A0F2E] to-[#0D0715] border border-purple-500/30 rounded-3xl overflow-hidden">
            {/* Header */}
            <div className="relative bg-gradient-to-r from-emerald-600 via-teal-500 to-emerald-600 backdrop-blur-xl border-b border-emerald-500/30">
              <div className="relative p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <h2 className="text-2xl font-bold text-white flex items-center gap-3">
                      <Building2 className="w-6 h-6 text-emerald-200" />
                      Konfirmasi Pembayaran
                    </h2>
                    <p className="text-emerald-100 text-sm mt-1">
                      Transfer untuk mengaktifkan {planName}
                    </p>
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

            {/* Content */}
            <div className="p-6 space-y-6">
              {/* Plan Summary */}
              <div className="bg-gradient-to-r from-purple-500/10 to-pink-500/10 border border-purple-500/20 rounded-2xl p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs text-purple-300 mb-1">Paket yang dipilih</p>
                    <p className="text-lg font-bold text-white">{planName}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-xs text-purple-300 mb-1">Total Pembayaran</p>
                    <p className="text-xl font-bold bg-gradient-to-r from-purple-400 to-pink-400 bg-clip-text text-transparent">
                      {formatPrice(planPrice)}
                    </p>
                  </div>
                </div>
              </div>

              {/* Bank Info */}
              <div className="bg-white/[0.02] border border-white/10 rounded-2xl p-5 space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs text-white/40 mb-1">Bank</p>
                    <p className="text-lg font-bold text-white flex items-center gap-2">
                      <Building2 className="w-5 h-5 text-emerald-400" />
                      Bank Jago
                    </p>
                  </div>
                  <div className="px-3 py-1 rounded-full bg-emerald-500/20 text-emerald-300 text-sm font-semibold">
                    Kode Bank: 542
                  </div>
                </div>

                <div className="pt-4 border-t border-white/10">
                  <p className="text-xs text-white/40 mb-2">Nomor Rekening</p>
                  <div className="flex items-center gap-3">
                    <p className="text-2xl font-bold text-white font-mono tracking-wide">
                      105668597393
                    </p>
                    <button
                      onClick={handleCopyAccountNumber}
                      className={`p-2 rounded-lg transition-all ${
                        copied
                          ? 'bg-emerald-500/20 text-emerald-400'
                          : 'bg-white/10 text-white/60 hover:bg-white/20 hover:text-white'
                      }`}
                    >
                      {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                    </button>
                  </div>
                  <p className="text-sm text-white/60 mt-1">a.n. RIZQI AKBAR PRATAMA</p>
                </div>
              </div>

              {/* Instructions */}
              <div className="bg-amber-500/10 border border-amber-500/20 rounded-2xl p-5">
                <h3 className="text-sm font-semibold text-amber-300 mb-3 flex items-center gap-2">
                  <Check className="w-4 h-4" />
                  Instruksi Pembayaran
                </h3>
                <div className="space-y-2 text-sm text-white/70">
                  <p className="flex items-start gap-2">
                    <span className="text-amber-400 mt-1">1.</span>
                    <span>Silakan transfer sesuai harga paket ke Bank Jago (542)</span>
                  </p>
                  <p className="flex items-start gap-2">
                    <span className="text-amber-400 mt-1">2.</span>
                    <span>Klik ikon copy untuk menyalin nomor rekening</span>
                  </p>
                  <p className="flex items-start gap-2">
                    <span className="text-amber-400 mt-1">3.</span>
                    <span className="font-semibold text-amber-200">Simpan bukti transfer untuk aktivasi</span>
                  </p>
                  <p className="flex items-start gap-2">
                    <span className="text-amber-400 mt-1">4.</span>
                    <span>Klik tombol di bawah untuk konfirmasi ke Telegram</span>
                  </p>
                </div>
              </div>

              {/* Telegram Button */}
              <motion.button
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                onClick={handleTelegramClick}
                className="w-full py-4 rounded-xl font-semibold flex items-center justify-center gap-3 bg-gradient-to-r from-blue-500 to-cyan-500 hover:from-blue-600 hover:to-cyan-600 text-white shadow-lg shadow-blue-500/25 transition-all"
              >
                <MessageCircle className="w-5 h-5" />
                Sudah Transfer? Konfirmasi ke Telegram
              </motion.button>

              {/* Cancel Button */}
              <button
                onClick={onClose}
                className="w-full py-3 rounded-xl text-sm text-white/60 hover:text-white hover:bg-white/5 transition-all"
              >
                Batal
              </button>
            </div>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  )
}
