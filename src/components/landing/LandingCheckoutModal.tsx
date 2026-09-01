'use client'

import React, { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  X, Crown, ArrowRight, ArrowLeft, CheckCircle,
  ShieldCheck, Sparkles, Loader2, Calendar, Zap, Gem,
  Lock, ChevronRight
} from 'lucide-react'
import { formatRupiah, type PricingPlan } from '@/lib/pricing'
import { toast } from 'sonner'

interface LandingCheckoutModalProps {
  isOpen: boolean
  onClose: () => void
  promoCode: string
  promoActive: boolean | null
  language?: 'id' | 'en'
}

const PLANS: { key: PricingPlan; label: string; labelEn: string; price: number; duration: string; durationEn: string; icon: React.ReactNode; badge?: string; badgeEn?: string }[] = [
  {
    key: 'PRO_30_DAYS',
    label: 'Elite Pro',
    labelEn: 'Elite Pro',
    price: 39000,
    duration: '1 Bulan',
    durationEn: '1 Month',
    icon: <Zap className="w-5 h-5" />,
  },
  {
    key: 'PRO_ANNUAL',
    label: 'Pro Annual',
    labelEn: 'Pro Annual',
    price: 390000,
    duration: '1 Tahun',
    durationEn: '1 Year',
    icon: <Calendar className="w-5 h-5" />,
    badge: 'Hemat 2 Bulan',
    badgeEn: 'Save 2 Months',
  },
  {
    key: 'PRO_LIFETIME',
    label: 'Lifetime Ultra',
    labelEn: 'Lifetime Ultra',
    price: 299000,
    duration: 'Selamanya',
    durationEn: 'Forever',
    icon: <Gem className="w-5 h-5" />,
    badge: '30 Slot Saja',
    badgeEn: 'Only 30 Slots',
  },
]

export default function LandingCheckoutModal({
  isOpen,
  onClose,
  promoCode,
  promoActive,
  language = 'id',
}: LandingCheckoutModalProps) {
  const isEn = language === 'en'

  // Steps: 'select' → 'confirm' → 'paying' → 'success'
  const [step, setStep] = useState<'select' | 'confirm' | 'paying' | 'success'>('select')
  const [selectedPlan, setSelectedPlan] = useState<PricingPlan>('PRO_30_DAYS')
  const [localPromo, setLocalPromo] = useState('')
  const [promoApplied, setPromoApplied] = useState(false)
  const [promoError, setPromoError] = useState(false)
  const [snapLoaded, setSnapLoaded] = useState(false)
  const [snapLoading, setSnapLoading] = useState(false)

  const selectedPlanInfo = PLANS.find(p => p.key === selectedPlan)!
  const isPromoPlan = selectedPlan === 'PRO_30_DAYS' && promoApplied
  const finalPrice = isPromoPlan ? 25000 : selectedPlanInfo.price

  // Reset state when modal opens
  useEffect(() => {
    if (isOpen) {
      setStep('select')
      setSelectedPlan('PRO_30_DAYS')
      setLocalPromo('')
      setPromoApplied(false)
      setPromoError(false)
    }
  }, [isOpen])

  // Prevent body scroll
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden'
    } else {
      document.body.style.overflow = ''
    }
    return () => { document.body.style.overflow = '' }
  }, [isOpen])

  // Load Snap.js when modal opens
  useEffect(() => {
    if (!isOpen) return
    if ((window as any).snap) { setSnapLoaded(true); return }

    const loadSnap = async () => {
      setSnapLoading(true)
      try {
        const res = await fetch('/api/midtrans/create-transaction')
        const config = await res.json()
        if (!config.configured || !config.snapUrl) { setSnapLoading(false); return }

        const script = document.createElement('script')
        script.id = 'midtrans-snap-modal'
        script.src = config.snapUrl
        script.setAttribute('data-client-key', config.clientKey)
        script.async = true
        script.onload = () => { setSnapLoaded(true); setSnapLoading(false) }
        script.onerror = () => { setSnapLoading(false) }
        document.body.appendChild(script)
      } catch { setSnapLoading(false) }
    }
    loadSnap()
  }, [isOpen])

  // ESC key close
  useEffect(() => {
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && step !== 'paying') onClose()
    }
    window.addEventListener('keydown', handleEsc)
    return () => window.removeEventListener('keydown', handleEsc)
  }, [onClose, step])

  const applyPromo = () => {
    if (localPromo.trim().toUpperCase() === promoCode && promoActive) {
      setPromoApplied(true)
      setPromoError(false)
    } else if (localPromo.trim().toUpperCase() === 'TRADERCEPAT') {
      setPromoApplied(true)
      setPromoError(false)
    } else {
      setPromoApplied(false)
      setPromoError(true)
    }
  }

  const handleSelectPlan = (plan: PricingPlan) => {
    setSelectedPlan(plan)
    // Reset promo if switching away from PRO_30_DAYS
    if (plan !== 'PRO_30_DAYS') {
      setPromoApplied(false)
      setLocalPromo('')
    }
  }

  const goToConfirm = () => {
    if (isPromoPlan && selectedPlan === 'PRO_30_DAYS') {
      setStep('confirm')
    } else {
      setStep('confirm')
    }
  }

  const handlePay = async () => {
    if (!snapLoaded) { toast.error(isEn ? 'Payment gateway is loading...' : 'Payment gateway sedang dimuat...'); return }

    setStep('paying')
    try {
      const body: Record<string, string> = { plan: selectedPlan }
      if (promoApplied && selectedPlan === 'PRO_30_DAYS') {
        body.promoCode = localPromo.trim().toUpperCase() || 'TRADERCEPAT'
      }

      const res = await fetch('/api/midtrans/create-transaction', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      const data = await res.json()

      if (res.status === 401) {
        setStep('select')
        onClose()
        window.location.href = `/auth/checkout?plan=${selectedPlan}`
        return
      }

      if (!res.ok) {
        toast.error(data.error || (isEn ? 'Failed to create transaction' : 'Gagal membuat transaksi'))
        setStep('confirm')
        return
      }

      ;(window as any).snap.pay(data.token, {
        onSuccess: () => {
          toast.success(isEn ? 'Payment successful! PRO account is being activated...' : 'Pembayaran berhasil! Akun PRO sedang diaktivasi...')
          setStep('success')
        },
        onPending: () => {
          toast.info(isEn ? 'Waiting for payment. Complete it to auto-activate PRO.' : 'Menunggu pembayaran. Selesaikan untuk mengaktifkan PRO otomatis.')
          setStep('success')
        },
        onError: () => {
          toast.error(isEn ? 'Payment failed or cancelled.' : 'Pembayaran gagal atau dibatalkan.')
          setStep('confirm')
        },
        onClose: () => { setStep('confirm') },
      })
    } catch {
      toast.error(isEn ? 'Failed to connect to payment gateway' : 'Gagal terhubung ke payment gateway')
      setStep('confirm')
    }
  }

  const stepLabels = [
    { key: 'select', label: isEn ? 'Choose' : 'Pilih', labelFull: isEn ? 'Pilih Paket' : 'Pilih Paket' },
    { key: 'confirm', label: isEn ? 'Pay' : 'Bayar', labelFull: isEn ? 'Konfirmasi' : 'Konfirmasi' },
    { key: 'success', label: isEn ? 'Done' : 'Selesai', labelFull: isEn ? 'Selesai' : 'Selesai' },
  ]
  const stepOrder = ['select', 'confirm', 'paying', 'success']
  const currentStepIndex = stepOrder.indexOf(step)
  const visibleStepIndex = step === 'paying' ? 1 : currentStepIndex

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
      {/* Backdrop */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="absolute inset-0 bg-black/70 backdrop-blur-sm"
        onClick={step === 'paying' ? undefined : onClose}
      />

      {/* Modal */}
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 20 }}
        transition={{ type: 'spring', damping: 25, stiffness: 300 }}
        className="relative w-full max-w-lg bg-[#0a0a1a] border border-white/10 rounded-2xl shadow-2xl shadow-blue-500/10 overflow-hidden"
      >
        {/* Close button */}
        {step !== 'paying' && (
          <button
            onClick={onClose}
            className="absolute top-4 right-4 z-10 w-8 h-8 flex items-center justify-center rounded-lg bg-white/5 hover:bg-white/10 transition-colors text-white/50 hover:text-white/80 cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        )}

        {/* Progress Steps */}
        <div className="px-6 pt-5 pb-3">
          <div className="flex items-center justify-center gap-2">
            {stepLabels.map((s, i) => (
              <React.Fragment key={s.key}>
                <div className={`flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium transition-all ${
                  step === s.key || (s.key === 'confirm' && step === 'paying')
                    ? 'bg-blue-500/20 text-blue-300 border border-blue-500/30'
                    : visibleStepIndex > i
                    ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/20'
                    : 'bg-white/5 text-white/30 border border-white/10'
                }`}>
                  {visibleStepIndex > i ? (
                    <CheckCircle className="w-3 h-3" />
                  ) : (
                    <span className="w-3 h-3 rounded-full border-current border-[1.5px] flex items-center justify-center text-[8px]">{i + 1}</span>
                  )}
                  <span className="hidden sm:inline">{s.label}</span>
                </div>
                {i < 2 && (
                  <div className={`h-px w-4 sm:w-8 transition-colors ${visibleStepIndex > i ? 'bg-emerald-500/40' : 'bg-white/10'}`} />
                )}
              </React.Fragment>
            ))}
          </div>
        </div>

        {/* Content */}
        <div className="px-6 pb-6 min-h-[340px]">
          <AnimatePresence mode="wait">
            {/* ── STEP 1: Select Plan ─────────────────── */}
            {step === 'select' && (
              <motion.div
                key="select"
                initial={{ opacity: 0, x: 30 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -30 }}
                transition={{ duration: 0.25 }}
              >
                <div className="text-center mb-6 pt-2">
                  <h3 className="text-xl font-bold text-white mb-1">
                    {isEn ? 'Choose Your Plan' : 'Pilih Paket Kamu'}
                  </h3>
                  <p className="text-white/40 text-sm">
                    {isEn ? 'Select the plan that fits your trading journey' : 'Pilih paket yang cocok untuk perjalanan trading kamu'}
                  </p>
                </div>

                {/* Plan Cards */}
                <div className="space-y-3 mb-5">
                  {PLANS.map((plan) => {
                    const isSelected = selectedPlan === plan.key
                    const showPromoPrice = plan.key === 'PRO_30_DAYS' && promoApplied

                    return (
                      <button
                        key={plan.key}
                        onClick={() => handleSelectPlan(plan.key)}
                        className={`w-full text-left p-4 rounded-xl border transition-all cursor-pointer ${
                          isSelected
                            ? 'bg-blue-500/10 border-blue-500/40 shadow-lg shadow-blue-500/5'
                            : 'bg-white/[0.02] border-white/5 hover:border-white/15 hover:bg-white/[0.04]'
                        }`}
                      >
                        <div className="flex items-center gap-3">
                          {/* Radio / Icon */}
                          <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${
                            isSelected ? 'bg-blue-500/20 text-blue-400' : 'bg-white/5 text-white/30'
                          }`}>
                            {isSelected ? <Crown className="w-5 h-5" /> : plan.icon}
                          </div>

                          {/* Plan Info */}
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                              <span className={`font-semibold text-sm ${isSelected ? 'text-blue-300' : 'text-white/80'}`}>
                                {isEn ? plan.labelEn : plan.label}
                              </span>
                              {plan.badge && (
                                <span className="text-[10px] px-2 py-0.5 rounded-full bg-amber-500/15 text-amber-400 border border-amber-500/20">
                                  {isEn ? plan.badgeEn : plan.badge}
                                </span>
                              )}
                            </div>
                            <p className="text-white/30 text-xs mt-0.5">{isEn ? plan.durationEn : plan.duration}</p>
                          </div>

                          {/* Price */}
                          <div className="text-right flex-shrink-0">
                            {showPromoPrice && (
                              <span className="text-xs text-white/20 line-through block">{formatRupiah(plan.price)}</span>
                            )}
                            <span className={`font-bold text-sm ${isSelected ? 'text-blue-300' : 'text-white/70'}`}>
                              {formatRupiah(showPromoPrice ? 25000 : plan.price)}
                            </span>
                          </div>

                          {/* Chevron */}
                          <ChevronRight className={`w-4 h-4 flex-shrink-0 transition-colors ${isSelected ? 'text-blue-400' : 'text-white/15'}`} />
                        </div>
                      </button>
                    )
                  })}
                </div>

                {/* Promo Code (only for PRO_30_DAYS) */}
                {selectedPlan === 'PRO_30_DAYS' && (
                  <div className="mb-5 p-3 rounded-xl bg-white/[0.02] border border-white/5">
                    <p className="text-xs text-white/40 mb-2 font-medium">
                      {isEn ? 'Have a promo code?' : 'Punya kode promo?'}
                    </p>
                    <div className="flex gap-2">
                      <input
                        type="text"
                        value={localPromo}
                        onChange={(e) => { setLocalPromo(e.target.value); setPromoError(false); if (promoApplied) setPromoApplied(false) }}
                        placeholder={isEn ? 'Enter code (e.g. TRADERCEPAT)' : 'Masukkan kode (cth: TRADERCEPAT)'}
                        className="flex-1 bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-cyan-400 transition-colors font-mono text-white placeholder:text-white/20"
                        onKeyDown={(e) => e.key === 'Enter' && applyPromo()}
                      />
                      <button
                        onClick={applyPromo}
                        disabled={promoApplied}
                        className="px-4 py-2 bg-white/10 rounded-lg text-sm hover:bg-white/20 transition-colors font-medium text-white/70 hover:text-white disabled:opacity-40 cursor-pointer"
                      >
                        {promoApplied ? '✓' : (isEn ? 'Apply' : 'Terapkan')}
                      </button>
                    </div>
                    {promoError && (
                      <p className="mt-1.5 text-xs text-red-400/80 font-mono">
                        {isEn ? 'Invalid or expired promo code.' : 'Kode promo tidak valid atau kedaluwarsa.'}
                      </p>
                    )}
                    {promoApplied && (
                      <p className="mt-1.5 text-xs text-emerald-400 font-mono flex items-center gap-1">
                        <CheckCircle className="w-3 h-3" />
                        {isEn ? 'Promo applied! Discount active.' : 'Promo terpakai! Diskon aktif.'}
                      </p>
                    )}
                  </div>
                )}

                {/* Continue Button */}
                <button
                  onClick={goToConfirm}
                  className="w-full py-3 bg-gradient-to-r from-blue-500 to-cyan-400 rounded-xl hover:opacity-90 transition-all text-sm font-semibold text-white glow-bg-luxury flex items-center justify-center gap-2 cursor-pointer"
                >
                  {isEn ? 'Continue to Payment' : 'Lanjut ke Pembayaran'}
                  <ArrowRight className="w-4 h-4" />
                </button>
              </motion.div>
            )}

            {/* ── STEP 2: Confirm & Pay ───────────────── */}
            {step === 'confirm' && (
              <motion.div
                key="confirm"
                initial={{ opacity: 0, x: 30 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -30 }}
                transition={{ duration: 0.25 }}
              >
                <div className="text-center mb-6 pt-2">
                  <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-blue-500/20 to-cyan-500/20 border border-blue-500/20 flex items-center justify-center mx-auto mb-3">
                    <Crown className="w-7 h-7 text-amber-400" />
                  </div>
                  <h3 className="text-xl font-bold text-white mb-1">
                    {isEn ? 'Order Summary' : 'Ringkasan Pesanan'}
                  </h3>
                  <p className="text-white/40 text-sm">
                    {isEn ? 'Review your order before paying' : 'Periksa pesanan sebelum membayar'}
                  </p>
                </div>

                {/* Order Card */}
                <div className="bg-white/[0.03] border border-white/[0.06] rounded-xl p-5 mb-6">
                  <div className="flex items-start justify-between mb-4">
                    <div>
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-white font-semibold">
                          {isEn ? selectedPlanInfo.labelEn : selectedPlanInfo.label}
                        </span>
                        {selectedPlanInfo.badge && (
                          <span className="text-[10px] px-2 py-0.5 rounded-full bg-amber-500/15 text-amber-400 border border-amber-500/20">
                            {isEn ? selectedPlanInfo.badgeEn : selectedPlanInfo.badge}
                          </span>
                        )}
                      </div>
                      <p className="text-white/40 text-xs">{isEn ? selectedPlanInfo.durationEn : selectedPlanInfo.duration}</p>
                    </div>
                    <button
                      onClick={() => setStep('select')}
                      className="text-xs text-blue-400 hover:text-blue-300 transition-colors cursor-pointer"
                    >
                      {isEn ? 'Change' : 'Ubah'}
                  </button>
                  </div>

                  {/* Features Recap */}
                  <div className="border-t border-white/5 pt-3 mb-4">
                    <ul className="space-y-1.5">
                      <li className="flex items-center gap-2 text-xs text-white/50">
                        <CheckCircle className="w-3 h-3 text-emerald-400/70" />
                        {isEn ? 'Unlimited Trade Entries' : 'Unlimited Trade Entries'}
                      </li>
                      <li className="flex items-center gap-2 text-xs text-white/50">
                        <CheckCircle className="w-3 h-3 text-emerald-400/70" />
                        {isEn ? 'Advanced Analytics & Equity Curve' : 'Analitik Lanjutan & Equity Curve'}
                      </li>
                      <li className="flex items-center gap-2 text-xs text-white/50">
                        <CheckCircle className="w-3 h-3 text-emerald-400/70" />
                        {isEn ? 'AI Auto Extract MT5/TradingView' : 'AI Auto Extract MT5/TradingView'}
                      </li>
                      <li className="flex items-center gap-2 text-xs text-white/50">
                        <CheckCircle className="w-3 h-3 text-emerald-400/70" />
                        {isEn ? 'AI Pattern Detection & Guard' : 'AI Pattern Detection & Guard'}
                      </li>
                    </ul>
                  </div>

                  {/* Price */}
                  <div className="border-t border-white/5 pt-3">
                    {isPromoPlan && (
                      <div className="flex justify-between items-center mb-1">
                        <span className="text-xs text-white/30">{isEn ? 'Original Price' : 'Harga Normal'}</span>
                        <span className="text-sm text-white/30 line-through">{formatRupiah(selectedPlanInfo.price)}</span>
                      </div>
                    )}
                    {isPromoPlan && (
                      <div className="flex justify-between items-center mb-1">
                        <span className="text-xs text-emerald-400/70">{isEn ? 'Promo Discount' : 'Diskon Promo'}</span>
                        <span className="text-sm text-emerald-400/70">-{formatRupiah(selectedPlanInfo.price - 25000)}</span>
                      </div>
                    )}
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-white/60 font-medium">{isEn ? 'Total' : 'Total'}</span>
                      <span className="text-2xl font-bold bg-gradient-to-r from-blue-300 to-cyan-300 bg-clip-text text-transparent">
                        {formatRupiah(finalPrice)}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Back + Pay Buttons */}
                <div className="flex gap-3">
                  <button
                    onClick={() => setStep('select')}
                    className="flex-1 py-3 border border-white/10 rounded-xl hover:bg-white/5 transition-all text-sm font-medium text-white/60 flex items-center justify-center gap-2 cursor-pointer"
                  >
                    <ArrowLeft className="w-4 h-4" />
                    {isEn ? 'Back' : 'Kembali'}
                  </button>
                  <button
                    onClick={handlePay}
                    disabled={!snapLoaded}
                    className="flex-[2] py-3 bg-gradient-to-r from-blue-500 to-cyan-400 rounded-xl hover:opacity-90 transition-all text-sm font-semibold text-white glow-bg-luxury flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
                  >
                    {!snapLoaded || snapLoading ? (
                      <><Loader2 className="w-4 h-4 animate-spin" /> {isEn ? 'Loading...' : 'Memuat...'}</>
                    ) : (
                      <><Sparkles className="w-4 h-4" /> {isEn ? `Pay ${formatRupiah(finalPrice)}` : `Bayar ${formatRupiah(finalPrice)}`}</>
                    )}
                  </button>
                </div>

                <p className="text-center text-[11px] text-white/20 mt-3 flex items-center justify-center gap-1.5">
                  <ShieldCheck className="w-3 h-3" />
                  {isEn ? 'Secure payment via Midtrans' : 'Pembayaran aman via Midtrans'}
                </p>
              </motion.div>
            )}

            {/* ── STEP: Paying (loading state) ─────────── */}
            {step === 'paying' && (
              <motion.div
                key="paying"
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                className="flex flex-col items-center justify-center py-16 text-center"
              >
                <div className="w-16 h-16 rounded-2xl bg-blue-500/10 border border-blue-500/20 flex items-center justify-center mb-4">
                  <Loader2 className="w-8 h-8 text-blue-400 animate-spin" />
                </div>
                <h3 className="text-lg font-bold text-white mb-1">
                  {isEn ? 'Opening Payment...' : 'Membuka Pembayaran...'}
                </h3>
                <p className="text-white/40 text-sm">
                  {isEn ? 'Midtrans payment popup will appear' : 'Popup pembayaran Midtrans akan muncul'}
                </p>
              </motion.div>
            )}

            {/* ── STEP 3: Success ──────────────────────── */}
            {step === 'success' && (
              <motion.div
                key="success"
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                className="flex flex-col items-center justify-center py-12 text-center"
              >
                <motion.div
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  transition={{ type: 'spring', delay: 0.1, stiffness: 200 }}
                  className="w-20 h-20 rounded-full bg-emerald-500/15 border border-emerald-500/25 flex items-center justify-center mb-4"
                >
                  <CheckCircle className="w-10 h-10 text-emerald-400" />
                </motion.div>

                <h3 className="text-2xl font-bold text-white mb-2">
                  {isEn ? 'Thank You! 🎉' : 'Terima Kasih! 🎉'}
                </h3>
                <p className="text-white/50 text-sm mb-2 max-w-xs">
                  {isEn
                    ? 'Your payment is being processed. PRO will be activated automatically once confirmed.'
                    : 'Pembayaran sedang diproses. PRO akan aktif otomatis setelah dikonfirmasi.'}
                </p>
                <p className="text-white/30 text-xs mb-6">
                  {isEn ? 'You\'ll be redirected to dashboard shortly...' : 'Kamu akan diarahkan ke dashboard sebentar lagi...'}
                </p>

                <div className="flex gap-3 w-full">
                  <button
                    onClick={() => window.location.href = '/dashboard'}
                    className="flex-1 py-3 bg-gradient-to-r from-emerald-500 to-teal-500 rounded-xl hover:opacity-90 transition-all text-sm font-semibold text-white flex items-center justify-center gap-2 cursor-pointer"
                  >
                    <Sparkles className="w-4 h-4" />
                    {isEn ? 'Go to Dashboard' : 'Ke Dashboard'}
                  </button>
                  <button
                    onClick={onClose}
                    className="px-5 py-3 border border-white/10 rounded-xl hover:bg-white/5 transition-all text-sm font-medium text-white/50 cursor-pointer"
                  >
                    {isEn ? 'Close' : 'Tutup'}
                  </button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Footer security badge */}
        {step === 'select' && (
          <div className="px-6 py-3 border-t border-white/5 flex items-center justify-center gap-2">
            <Lock className="w-3 h-3 text-white/20" />
            <span className="text-[11px] text-white/20">{isEn ? 'Encrypted & Secure' : 'Terenkripsi & Aman'}</span>
          </div>
        )}
      </motion.div>
    </div>
  )
}
