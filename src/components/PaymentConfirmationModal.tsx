'use client'

import { motion, AnimatePresence } from 'framer-motion'
import { X, Check, MessageCircle, QrCode, Shield, ExternalLink } from 'lucide-react'

interface PaymentConfirmationModalProps {
  isOpen: boolean
  onClose: () => void
  planName?: string
  planPrice?: number
}

export default function PaymentConfirmationModal({
  isOpen,
  onClose,
  planName,
  planPrice
}: PaymentConfirmationModalProps) {
  const formatPrice = (price: number) => {
    return new Intl.NumberFormat('id-ID', {
      style: 'currency',
      currency: 'IDR',
      minimumFractionDigits: 0
    }).format(price)
  }

  const handleTelegramClick = () => {
    const message = `Halo admin LuxTrade, saya mau konfirmasi pembayaran paket ${planName || '-'} seharga ${planPrice ? formatPrice(planPrice) : '-'}. Ini bukti transfer saya. Mohon aktivasi akun Pro saya. Terima kasih!`
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
          className="relative w-full max-w-md max-h-[90vh] overflow-y-auto"
        >
          {/* Main Card */}
          <div className="relative bg-gradient-to-br from-[#0A0612] via-[#1A0F2E] to-[#0D0715] border border-purple-500/30 rounded-3xl overflow-hidden">
            {/* Header */}
            <div className="relative bg-gradient-to-r from-emerald-600 via-teal-500 to-emerald-600 backdrop-blur-xl border-b border-emerald-500/30">
              <div className="relative p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <h2 className="text-2xl font-bold text-white flex items-center gap-3">
                      <QrCode className="w-6 h-6 text-emerald-200" />
                      Pembayaran QRIS
                    </h2>
                    <p className="text-emerald-100 text-sm mt-1">
                      Scan QRIS untuk mengaktifkan {planName}
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
            <div className="p-6 space-y-5">

              {/* Plan Summary */}
              {planName && (
                <div className="bg-gradient-to-r from-purple-500/10 to-pink-500/10 border border-purple-500/20 rounded-2xl p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-xs text-purple-300 mb-1">Paket yang dipilih</p>
                      <p className="text-lg font-bold text-white">{planName}</p>
                    </div>
                    {planPrice && planPrice > 0 && (
                      <div className="text-right">
                        <p className="text-xs text-purple-300 mb-1">Total Pembayaran</p>
                        <p className="text-xl font-bold bg-gradient-to-r from-purple-400 to-pink-400 bg-clip-text text-transparent">
                          {formatPrice(planPrice)}
                        </p>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* QRIS QR Code */}
              <div className="bg-white/[0.03] border border-emerald-500/20 rounded-2xl p-5 space-y-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-emerald-500/20 flex items-center justify-center">
                    <QrCode className="w-5 h-5 text-emerald-400" />
                  </div>
                  <div>
                    <p className="text-base font-bold text-white">Scan QRIS</p>
                    <p className="text-xs text-white/50">Gunakan e-wallet atau mobile banking</p>
                  </div>
                </div>

                {/* QR Image */}
                <div className="bg-white rounded-2xl p-4 flex items-center justify-center">
                  <img
                    src="/qris-luxtrade.jpeg"
                    alt="QRIS LuxTrade"
                    className="w-full max-w-[240px] h-auto rounded-lg"
                  />
                </div>

                {/* NMID Info */}
                <div className="flex items-center justify-between pt-1">
                  <div>
                    <p className="text-[10px] text-white/30 uppercase tracking-wider">Merchant</p>
                    <p className="text-sm font-semibold text-white/80">Luxtrade</p>
                  </div>
                  <div className="text-right">
                    <p className="text-[10px] text-white/30 uppercase tracking-wider">NMID</p>
                    <p className="text-sm font-mono text-white/60">ID1026539975908</p>
                  </div>
                </div>
              </div>

              {/* Instructions */}
              <div className="bg-amber-500/10 border border-amber-500/20 rounded-2xl p-4">
                <h3 className="text-sm font-semibold text-amber-300 mb-3 flex items-center gap-2">
                  <Check className="w-4 h-4" />
                  Cara Pembayaran
                </h3>
                <div className="space-y-2 text-sm text-white/70">
                  <p className="flex items-start gap-2">
                    <span className="text-amber-400 font-bold mt-0.5">1.</span>
                    <span>Scan QRIS di atas pakai e-wallet / m-banking kamu</span>
                  </p>
                  <p className="flex items-start gap-2">
                    <span className="text-amber-400 font-bold mt-0.5">2.</span>
                    <span>Masukkan nominal <strong className="text-amber-200">{planPrice ? formatPrice(planPrice) : 'sesuai paket'}</strong></span>
                  </p>
                  <p className="flex items-start gap-2">
                    <span className="text-amber-400 font-bold mt-0.5">3.</span>
                    <span className="font-semibold text-amber-200">Setelah bayar, klik tombol biru di bawah untuk konfirmasi ke Telegram admin</span>
                  </p>
                  <p className="flex items-start gap-2">
                    <span className="text-amber-400 font-bold mt-0.5">4.</span>
                    <span>Kirim bukti bayar di Telegram — akun Pro diaktivasi manual</span>
                  </p>
                </div>
              </div>

              {/* Telegram Confirm Button */}
              <motion.button
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                onClick={handleTelegramClick}
                className="w-full py-4 rounded-xl font-semibold flex items-center justify-center gap-3 bg-gradient-to-r from-[#0088cc] to-[#00a0e3] hover:from-[#0077b5] hover:to-[#0090cc] text-white shadow-lg shadow-[#0088cc]/25 transition-all"
              >
                <MessageCircle className="w-5 h-5" />
                Sudah Bayar? Konfirmasi ke Telegram
                <ExternalLink className="w-4 h-4 opacity-70" />
              </motion.button>

              {/* Security Note */}
              <div className="flex items-center justify-center gap-2 text-xs text-white/30">
                <Shield className="w-3 h-3" />
                Pembayaran aman via QRIS — Konfirmasi privat via Telegram
              </div>

              {/* Cancel */}
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