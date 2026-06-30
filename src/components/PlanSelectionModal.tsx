'use client'

import { useState, useEffect, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { X, Check, Crown, Sparkles, Clock, ArrowRight, ShieldCheck, Loader2, Tag, CreditCard } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { PRICING, formatRupiah, type PricingPlan } from '@/lib/pricing'
import PaymentConfirmationModal from './PaymentConfirmationModal'
import { toast } from 'sonner'

interface Plan {
  id: string
  name: string
  description: string
  price: number
  duration: string
  durationMonths: number
  durationType: 'month' | 'lifetime'
  pricingKey: PricingPlan
  features: string[]
  popular?: boolean
  highlight?: boolean
}

interface PlanSelectionModalProps {
  isOpen: boolean
  onClose: () => void
  onSelectPlan: (plan: Plan) => void
  onPaymentSuccess?: () => void
}

const plans: Plan[] = [
  {
    id: 'free',
    name: 'Free',
    description: 'Untuk memulai perjalanan trading',
    price: 0,
    duration: 'Selamanya',
    durationMonths: 0,
    durationType: 'lifetime',
    pricingKey: 'PRO_30_DAYS',
    features: [
      '10 Jurnal Transaksi / Bulan',
      'Grafik Performa & Statistik Standar',
      'Kalkulator Risiko Trading Pemula',
      '3x Uji Coba Fitur PRO'
    ]
  },
  {
    id: 'pro-1-month',
    name: 'Elite Pro',
    description: 'Paling Populer',
    price: PRICING.PRO_30_DAYS,
    duration: '1 Bulan',
    durationMonths: 1,
    durationType: 'month',
    pricingKey: 'PRO_30_DAYS',
    features: [
      'UNLIMITED Jurnal Transaksi',
      'Analisis AI Pintar - Deteksi Kesalahan & Solusi',
      'Grafik Win-Rate & Mistake Tracker',
      'Kalkulator Risiko & Posisi Advance',
      'Ekspor Data ke Excel / PDF',
      'Akses VIP Grup & Dukungan Prioritas'
    ],
    popular: true
  },
  {
    id: 'pro-6-months',
    name: 'Elite Pro',
    description: 'Hemat Rp 30.000',
    price: PRICING.PRO_180_DAYS,
    duration: '6 Bulan',
    durationMonths: 6,
    durationType: 'month',
    pricingKey: 'PRO_180_DAYS',
    features: [
      'UNLIMITED Jurnal Transaksi',
      'Analisis AI Pintar - Deteksi Kesalahan & Solusi',
      'Grafik Win-Rate & Mistake Tracker',
      'Kalkulator Risiko & Posisi Advance',
      'Ekspor Data ke Excel / PDF',
      'Akses VIP Grup & Dukungan Prioritas',
      'Hemat Rp 30.000 vs Bulanan'
    ]
  },
  {
    id: 'lifetime-ultra',
    name: 'Lifetime Ultra',
    description: 'PROMO TERBATAS',
    price: PRICING.PRO_LIFETIME,
    duration: 'Seumur Hidup',
    durationMonths: 0,
    durationType: 'lifetime',
    pricingKey: 'PRO_LIFETIME',
    features: [
      'AKSES SEUMUR HIDUP',
      'Semua Fitur Elite PRO Selamanya',
      'VIP Telegram Support & Grup Privat',
      'Tanpa Biaya Berulang'
    ],
    highlight: true
  }
]

export default function PlanSelectionModal({ isOpen, onClose, onSelectPlan, onPaymentSuccess }: PlanSelectionModalProps) {
  const [hoveredPlan, setHoveredPlan] = useState<string | null>(null)
  const [showManualPayment, setShowManualPayment] = useState(false)
  const [selectedPlan, setSelectedPlan] = useState<Plan | null>(null)
  const [promoCode, setPromoCode] = useState('')
  const [promoValid, setPromoValid] = useState(false)
  const [promoInfo, setPromoInfo] = useState<any>(null)
  const [promoLoading, setPromoLoading] = useState(false)
  const [payLoading, setPayLoading] = useState<string | null>(null)
  const [snapLoaded, setSnapLoaded] = useState(false)
  const [gatewayAvailable, setGatewayAvailable] = useState<boolean | null>(null)

  // Load Midtrans Snap script on mount
  useEffect(() => {
    if (!isOpen) return

    const loadSnap = async () => {
      try {
        const res = await fetch('/api/midtrans/create-transaction')
        const config = await res.json()

        if (!config.configured || !config.snapUrl) {
          console.log('[PlanSelection] Midtrans not configured — manual QRIS fallback')
          setGatewayAvailable(false)
          return
        }

        setGatewayAvailable(true)

        // Already loaded?
        if ((window as any).snap) {
          setSnapLoaded(true)
          return
        }

        const script = document.createElement('script')
        script.id = 'midtrans-snap-script'
        script.src = config.snapUrl
        script.setAttribute('data-client-key', config.clientKey)
        script.async = true
        script.onload = () => {
          setSnapLoaded(true)
          console.log('[PlanSelection] Midtrans Snap.js loaded')
        }
        script.onerror = () => {
          console.warn('[PlanSelection] Failed to load Snap.js — fallback to manual')
          setGatewayAvailable(false)
        }
        document.body.appendChild(script)
      } catch {
        setGatewayAvailable(false)
      }
    }

    loadSnap()
  }, [isOpen])

  // Validate promo code
  const handleValidatePromo = useCallback(async () => {
    if (!promoCode.trim()) return

    setPromoLoading(true)
    try {
      const res = await fetch('/api/promo/validate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code: promoCode }),
      })
      const data = await res.json()

      if (data.valid) {
        setPromoValid(true)
        setPromoInfo(data.promoCode)
        toast.success(`Kode promo valid! Diskon ${data.promoCode.discountPercent}%`)
      } else {
        setPromoValid(false)
        setPromoInfo(null)
        toast.error(data.message || 'Kode promo tidak valid')
      }
    } catch {
      toast.error('Gagal memvalidasi kode promo')
    } finally {
      setPromoLoading(false)
    }
  }, [promoCode])

  // Pay via Midtrans Snap popup
  const handlePay = async (plan: Plan) => {
    // If gateway not available, fallback to manual QRIS
    if (gatewayAvailable === false || !snapLoaded) {
      setSelectedPlan(plan)
      setShowManualPayment(true)
      return
    }

    setPayLoading(plan.id)
    try {
      const res = await fetch('/api/midtrans/create-transaction', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          plan: plan.pricingKey,
          promoCode: promoValid ? promoCode : undefined,
        }),
      })

      const data = await res.json()

      if (!res.ok) {
        toast.error(data.error || 'Gagal membuat transaksi')
        setPayLoading(null)
        return
      }

      // Open Midtrans Snap payment popup
      ;(window as any).snap.pay(data.token, {
        onSuccess: () => {
          toast.success('Pembayaran berhasil! Akun PRO kamu sedang diaktivasi otomatis...')
          if (onPaymentSuccess) onPaymentSuccess()
          onClose()
          setTimeout(() => window.location.reload(), 3000)
        },
        onPending: () => {
          toast.info('Menunggu pembayaran. Selesaikan pembayaran untuk mengaktifkan PRO otomatis.')
        },
        onError: () => {
          toast.error('Pembayaran gagal atau dibatalkan.')
        },
        onClose: () => {
          setPayLoading(null)
        },
      })
    } catch (err: any) {
      toast.error(err.message || 'Gagal terhubung ke payment gateway')
      setPayLoading(null)
    }
  }

  const handlePlanSelect = (plan: Plan) => {
    if (plan.price === 0) {
      onSelectPlan(plan)
      return
    }

    // For paid plans → go through Midtrans Snap (or manual fallback)
    handlePay(plan)
  }

  const handleManualPaymentClose = () => {
    setShowManualPayment(false)
    setSelectedPlan(null)
    setPayLoading(null)
    if (onPaymentSuccess) onPaymentSuccess()
  }

  // Calculate discounted price
  const getDiscountedPrice = (plan: Plan) => {
    if (promoValid && promoInfo) {
      return Math.round(plan.price * (1 - promoInfo.discountPercent / 100))
    }
    return plan.price
  }

  if (!isOpen) return null

  return (
    <>
      <AnimatePresence>
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 bg-black/85 backdrop-blur-md z-50 flex items-center justify-center p-4"
          onClick={onClose}
        >
          <motion.div
            initial={{ scale: 0.9, opacity: 0, y: 30 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={{ scale: 0.9, opacity: 0, y: 30 }}
            transition={{ type: 'spring', damping: 25, stiffness: 300 }}
            onClick={(e) => e.stopPropagation()}
            className="relative w-full max-w-6xl max-h-[90vh] overflow-y-auto"
          >
            <div className="relative bg-gradient-to-br from-[#0A0612] via-[#1A0F2E] to-[#0D0715] border border-purple-500/20 rounded-3xl overflow-hidden shadow-2xl shadow-purple-900/20">

              {/* Decorative Elements */}
              <div className="absolute top-0 right-0 w-64 h-64 bg-purple-500/5 rounded-full blur-3xl" />
              <div className="absolute bottom-0 left-0 w-64 h-64 bg-pink-500/5 rounded-full blur-3xl" />

              {/* Header */}
              <div className="relative bg-gradient-to-r from-purple-600/90 via-pink-500/90 to-purple-600/90 backdrop-blur-xl border-b border-purple-400/20">
                <div className="relative p-6 md:p-8">
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="flex items-center gap-3 mb-2">
                        <Sparkles className="w-8 h-8 text-amber-300 animate-pulse" />
                        <h2 className="text-2xl md:text-3xl font-bold text-white tracking-tight">
                          Pilih Paket Anda
                        </h2>
                      </div>
                      <p className="text-purple-200/80 text-sm md:text-base">
                        Buka semua fitur premium & tingkatkan performa trading Anda
                      </p>
                    </div>
                    <button
                      onClick={onClose}
                      className="p-2.5 rounded-full bg-white/10 hover:bg-white/20 transition-colors group"
                    >
                      <X className="w-5 h-5 text-white group-hover:rotate-90 transition-transform duration-200" />
                    </button>
                  </div>
                </div>
              </div>

              {/* Promo Code Input */}
              <div className="px-6 md:px-8 py-4 border-b border-white/5 space-y-3">
                <div className="flex items-center gap-2 max-w-md mx-auto">
                  <div className="relative flex-1">
                    <Tag className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-purple-400" />
                    <input
                      type="text"
                      value={promoCode}
                      onChange={(e) => {
                        setPromoCode(e.target.value.toUpperCase())
                        setPromoValid(false)
                        setPromoInfo(null)
                      }}
                      onKeyDown={(e) => e.key === 'Enter' && handleValidatePromo()}
                      placeholder="Kode promo (opsional)"
                      className="w-full pl-10 pr-3 py-2.5 rounded-xl bg-white/5 border border-white/10 text-white text-sm placeholder:text-white/30 focus:outline-none focus:border-purple-500/50 focus:ring-1 focus:ring-purple-500/20 transition-all"
                    />
                  </div>
                  <button
                    onClick={handleValidatePromo}
                    disabled={!promoCode.trim() || promoLoading}
                    className="px-4 py-2.5 rounded-xl bg-purple-500/20 hover:bg-purple-500/30 border border-purple-500/30 text-purple-300 text-sm font-medium transition-all disabled:opacity-40 disabled:cursor-not-allowed"
                  >
                    {promoLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Pakai'}
                  </button>
                </div>

                {promoValid && promoInfo && (
                  <motion.div
                    initial={{ opacity: 0, y: -5 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="text-center"
                  >
                    <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-500/15 border border-emerald-500/30 text-emerald-400 text-xs font-medium">
                      <Sparkles className="w-3 h-3" />
                      Diskon {promoInfo.discountPercent}% aktif — {promoInfo.remainingQuota} kuota tersisa
                    </span>
                  </motion.div>
                )}
              </div>

              {/* Plans Grid */}
              <div className="p-6 md:p-8 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 md:gap-5">
                {plans.map((plan, index) => {
                  const discountedPrice = getDiscountedPrice(plan)
                  const hasDiscount = promoValid && promoInfo && plan.price > 0 && discountedPrice < plan.price

                  return (
                    <motion.div
                      key={plan.id}
                      initial={{ opacity: 0, y: 25 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: index * 0.08, duration: 0.4 }}
                      onMouseEnter={() => setHoveredPlan(plan.id)}
                      onMouseLeave={() => setHoveredPlan(null)}
                      onClick={() => handlePlanSelect(plan)}
                      className={`
                        relative rounded-2xl border-2 p-5 md:p-6 cursor-pointer transition-all duration-300 group
                        ${hoveredPlan === plan.id
                          ? 'border-purple-400 scale-[1.03] shadow-2xl shadow-purple-500/20'
                          : 'border-purple-500/15 hover:border-purple-500/40 hover:shadow-lg hover:shadow-purple-900/10'
                        }
                        ${plan.highlight
                          ? 'bg-gradient-to-b from-amber-500/10 via-amber-500/5 to-transparent'
                          : plan.popular
                          ? 'bg-gradient-to-b from-purple-500/10 via-purple-500/5 to-transparent'
                          : 'bg-white/[0.02]'
                        }
                      `}
                    >
                      {plan.popular && (
                        <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                          <Badge className="bg-gradient-to-r from-purple-500 to-pink-500 text-white text-[10px] font-bold px-3 py-1 shadow-lg shadow-purple-500/30 tracking-wider uppercase">
                            Terpopuler
                          </Badge>
                        </div>
                      )}

                      {plan.highlight && (
                        <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                          <Badge className="bg-gradient-to-r from-amber-500 to-orange-500 text-white text-[10px] font-bold px-3 py-1 shadow-lg shadow-amber-500/30 flex items-center gap-1 tracking-wider uppercase">
                            <Crown className="w-3 h-3" />
                            Promo
                          </Badge>
                        </div>
                      )}

                      <div className="text-center mb-4">
                        <h3 className="text-lg font-bold text-white mb-1">{plan.name}</h3>
                        <p className="text-white/50 text-xs">{plan.description}</p>
                      </div>

                      <div className="text-center mb-5">
                        {plan.price === 0 ? (
                          <div className="text-2xl font-bold text-white tracking-tight">FREE</div>
                        ) : (
                          <div>
                            {hasDiscount && (
                              <div className="text-xs text-white/30 line-through mb-1">{formatRupiah(plan.price)}</div>
                            )}
                            <div className="text-2xl md:text-3xl font-bold bg-gradient-to-r from-purple-300 via-pink-300 to-amber-300 bg-clip-text text-transparent tracking-tight">
                              {formatRupiah(discountedPrice)}
                            </div>
                            <div className="text-xs text-white/50 mt-1 flex items-center justify-center gap-1">
                              <Clock className="w-3 h-3" />
                              / {plan.duration}
                            </div>
                          </div>
                        )}
                      </div>

                      <div className="space-y-2 mb-6">
                        {plan.features.map((feature, idx) => (
                          <div key={idx} className="flex items-start gap-2 text-xs">
                            <Check className="w-3.5 h-3.5 text-emerald-400 flex-shrink-0 mt-0.5" />
                            <span className="text-white/75 leading-relaxed">{feature}</span>
                          </div>
                        ))}
                      </div>

                      <motion.button
                        whileHover={{ scale: 1.02 }}
                        whileTap={{ scale: 0.98 }}
                        disabled={payLoading === plan.id}
                        className={`
                          w-full py-3 rounded-xl font-semibold text-sm flex items-center justify-center gap-2 transition-all cursor-pointer
                          disabled:opacity-60 disabled:cursor-wait
                          ${plan.highlight
                            ? 'bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-400 hover:to-orange-400 text-white shadow-lg shadow-amber-500/20'
                            : plan.popular
                            ? 'bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-400 hover:to-pink-400 text-white shadow-lg shadow-purple-500/20'
                            : plan.price === 0
                            ? 'bg-white/10 hover:bg-white/15 text-white/80'
                            : 'bg-purple-500/15 hover:bg-purple-500/25 text-purple-300 border border-purple-500/20'
                          }
                        `}
                      >
                        {payLoading === plan.id ? (
                          <>
                            <Loader2 className="w-4 h-4 animate-spin" />
                            Membuka pembayaran...
                          </>
                        ) : plan.price === 0 ? (
                          'Mulai Gratis'
                        ) : (
                          <>
                            Bayar Sekarang
                            <ArrowRight className="w-4 h-4" />
                          </>
                        )}
                      </motion.button>
                    </motion.div>
                  )
                })}
              </div>

              {/* Footer */}
              <div className="px-6 md:px-8 pb-6 md:pb-8">
                <div className="flex flex-col sm:flex-row items-center justify-center gap-3 text-white/30 text-xs">
                  <div className="flex items-center gap-1.5">
                    <CreditCard className="w-3.5 h-3.5 text-purple-500/60" />
                    <span>Pembayaran aman via {gatewayAvailable !== false ? 'Midtrans' : 'QRIS'}</span>
                  </div>
                  <span className="hidden sm:inline">•</span>
                  <div className="flex items-center gap-1.5">
                    <ShieldCheck className="w-3.5 h-3.5 text-emerald-500/60" />
                    <span>{gatewayAvailable !== false ? 'Aktivasi PRO otomatis setelah bayar' : 'Konfirmasi via Telegram'}</span>
                  </div>
                  <span className="hidden sm:inline">•</span>
                  <div className="flex items-center gap-1.5">
                    <span>Enkripsi & Keamanan Terjamin</span>
                  </div>
                </div>
              </div>
            </div>
          </motion.div>
        </motion.div>
      </AnimatePresence>

      {/* Manual Payment Fallback (QRIS) — only shown when Midtrans is not available */}
      <PaymentConfirmationModal
        isOpen={showManualPayment}
        onClose={handleManualPaymentClose}
        planName={selectedPlan?.name}
        planPrice={selectedPlan ? getDiscountedPrice(selectedPlan) : undefined}
      />
    </>
  )
}