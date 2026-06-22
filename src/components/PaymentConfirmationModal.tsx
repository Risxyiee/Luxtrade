'use client'

import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { X, Copy, Check, MessageCircle, Building2, QrCode, ArrowDown } from 'lucide-react'

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
  const [copiedField, setCopiedField] = useState<string | null>(null)

  const formatPrice = (price: number) => {
    return new Intl.NumberFormat('id-ID', {
      style: 'currency',
      currency: 'IDR',
      minimumFractionDigits: 0
    }).format(price)
  }

  const handleCopy = (text: string, field: string) => {
    navigator.clipboard.writeText(text)
    setCopiedField(field)
    setTimeout(() => setCopiedField(null), 2000)
  }

  const handleWhatsAppClick = () => {
    const message = `Halo admin LuxTrade, saya mau konfirmasi pembayaran. 📋

Paket: ${planName || '-'}
Nominal: ${planPrice ? formatPrice(planPrice) : '-'}

Ini bukti transfer saya. Mohon aktivasi akun saya. Terima kasih! 🙏`
    const encodedMessage = encodeURIComponent(message)
    const whatsappUrl = `https://wa.me/6285156306539?text=${encodedMessage}`
    window.open(whatsappUrl, '_blank')
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
          className="relative w-full max-w-lg max-h-[90vh] overflow-y-auto"
        >
          {/* Main Card */}
          <div className="relative bg-gradient-to-br from-[#0A0612] via-[#1A0F2E] to-[#0D0715] border border-purple-500/30 rounded-3xl overflow-hidden">
            {/* Header */}
            <div className="relative bg-gradient-to-r from-purple-600 via-pink-500 to-purple-600 backdrop-blur-xl border-b border-purple-400/20">
              <div className="relative p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <h2 className="text-2xl font-bold text-white flex items-center gap-3">
                      <Building2 className="w-6 h-6 text-purple-200" />
                      Pembayaran Manual
                    </h2>
                    <p className="text-purple-200 text-sm mt-1">
                      Transfer & konfirmasi untuk aktivasi akun
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

              {/* BCA Account */}
              <div className="bg-white/[0.02] border border-blue-500/20 rounded-2xl p-5 space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs text-white/40 mb-1">Metode 1</p>
                    <p className="text-lg font-bold text-white flex items-center gap-2">
                      <div className="w-8 h-8 rounded-lg bg-blue-500/20 flex items-center justify-center">
                        <span className="text-[10px] font-black text-blue-400">BCA</span>
                      </div>
                      Bank BCA
                    </p>
                  </div>
                  <div className="px-3 py-1 rounded-full bg-blue-500/20 text-blue-300 text-sm font-semibold">
                    Kode: 014
                  </div>
                </div>

                <div className="pt-3 border-t border-white/10">
                  <p className="text-xs text-white/40 mb-2">Nomor Rekening</p>
                  <div className="flex items-center gap-3">
                    <p className="text-2xl font-bold text-white font-mono tracking-wide">
                      8730255934
                    </p>
                    <button
                      onClick={() => handleCopy('8730255934', 'bca')}
                      className={`p-2 rounded-lg transition-all ${
                        copiedField === 'bca'
                          ? 'bg-emerald-500/20 text-emerald-400'
                          : 'bg-white/10 text-white/60 hover:bg-white/20 hover:text-white'
                      }`}
                    >
                      {copiedField === 'bca' ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                    </button>
                  </div>
                  <p className="text-sm text-white/60 mt-1">a.n. RIZQI AKBAR PRATAMA</p>
                </div>
              </div>

              {/* Divider */}
              <div className="flex items-center gap-3 text-white/20">
                <div className="flex-1 h-px bg-white/10" />
                <span className="text-xs">atau</span>
                <div className="flex-1 h-px bg-white/10" />
              </div>

              {/* Bank Jago Account */}
              <div className="bg-white/[0.02] border border-emerald-500/20 rounded-2xl p-5 space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs text-white/40 mb-1">Metode 2</p>
                    <p className="text-lg font-bold text-white flex items-center gap-2">
                      <div className="w-8 h-8 rounded-lg bg-emerald-500/20 flex items-center justify-center">
                        <span className="text-[10px] font-black text-emerald-400">JAGO</span>
                      </div>
                      Bank Jago
                    </p>
                  </div>
                  <div className="px-3 py-1 rounded-full bg-emerald-500/20 text-emerald-300 text-sm font-semibold">
                    Kode: 542
                  </div>
                </div>

                <div className="pt-3 border-t border-white/10">
                  <p className="text-xs text-white/40 mb-2">Nomor Rekening</p>
                  <div className="flex items-center gap-3">
                    <p className="text-2xl font-bold text-white font-mono tracking-wide">
                      105668597393
                    </p>
                    <button
                      onClick={() => handleCopy('105668597393', 'jago')}
                      className={`p-2 rounded-lg transition-all ${
                        copiedField === 'jago'
                          ? 'bg-emerald-500/20 text-emerald-400'
                          : 'bg-white/10 text-white/60 hover:bg-white/20 hover:text-white'
                      }`}
                    >
                      {copiedField === 'jago' ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                    </button>
                  </div>
                  <p className="text-sm text-white/60 mt-1">a.n. RIZQI AKBAR PRATAMA</p>
                </div>
              </div>

              {/* Divider */}
              <div className="flex items-center gap-3 text-white/20">
                <div className="flex-1 h-px bg-white/10" />
                <span className="text-xs">atau</span>
                <div className="flex-1 h-px bg-white/10" />
              </div>

              {/* QRIS */}
              <div className="bg-white/[0.02] border border-purple-500/20 rounded-2xl p-5 text-center space-y-3">
                <div className="flex items-center justify-center gap-2">
                  <QrCode className="w-5 h-5 text-purple-400" />
                  <p className="text-lg font-bold text-white">QRIS</p>
                </div>
                <p className="text-sm text-white/50">
                  Scan QRIS di aplikasi mobile banking (BCA, BriMo, GoPay, OVO, DANA, ShopeePay, dll)
                </p>
                <div className="bg-white rounded-xl p-3 inline-block">
                  <img
                    src="/qris.png"
                    alt="QRIS Payment"
                    className="w-48 h-48 mx-auto rounded-lg"
                    onError={(e) => {
                      (e.target as HTMLImageElement).style.display = 'none'
                      const parent = (e.target as HTMLImageElement).parentElement
                      if (parent) parent.innerHTML = '<div class="flex items-center justify-center w-48 h-48 bg-gray-100 rounded-lg text-gray-500 text-xs text-center p-4">QRIS Image<br/>(/public/qris.png)<br/>belum ditambahkan</div>'
                    }}
                  />
                </div>
              </div>

              {/* Arrow Down */}
              <div className="flex justify-center">
                <ArrowDown className="w-6 h-6 text-purple-400 animate-bounce" />
              </div>

              {/* Instructions */}
              <div className="bg-amber-500/10 border border-amber-500/20 rounded-2xl p-5">
                <h3 className="text-sm font-semibold text-amber-300 mb-3 flex items-center gap-2">
                  <Check className="w-4 h-4" />
                  Instruksi Pembayaran
                </h3>
                <div className="space-y-2 text-sm text-white/70">
                  <p className="flex items-start gap-2">
                    <span className="text-amber-400 font-bold mt-0.5">1.</span>
                    <span>Lakukan transfer sesuai nominal paket via BCA, Bank Jago, atau QRIS</span>
                  </p>
                  <p className="flex items-start gap-2">
                    <span className="text-amber-400 font-bold mt-0.5">2.</span>
                    <span>Screenshot bukti transfer</span>
                  </p>
                  <p className="flex items-start gap-2">
                    <span className="text-amber-400 font-bold mt-0.5">3.</span>
                    <span className="font-semibold text-amber-200">Klik tombol hijau di bawah → kirim bukti transfer via WhatsApp</span>
                  </p>
                  <p className="flex items-start gap-2">
                    <span className="text-amber-400 font-bold mt-0.5">4.</span>
                    <span>Akun akan diaktivasi secara manual oleh admin setelah verifikasi</span>
                  </p>
                </div>
              </div>

              {/* WhatsApp Button */}
              <motion.button
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                onClick={handleWhatsAppClick}
                className="w-full py-4 rounded-xl font-semibold flex items-center justify-center gap-3 bg-gradient-to-r from-green-500 to-emerald-500 hover:from-green-600 hover:to-emerald-600 text-white shadow-lg shadow-green-500/25 transition-all"
              >
                <MessageCircle className="w-5 h-5" />
                Sudah Transfer? Kirim Bukti ke WhatsApp Admin
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
