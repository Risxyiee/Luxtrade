'use client'

import React, { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useRouter } from 'next/navigation'
import {
  Crown, ArrowRight, ArrowLeft, AlertCircle, Loader2,
  CheckCircle, Tag, Sparkles, Shield, Zap, Star,
  CreditCard, Smartphone, QrCode, Building2,
  Receipt, Gift, Lock
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { supabase } from '@/lib/supabase'
import { Suspense } from 'react'

// ============================================
// Pricing Plans
// ============================================
const PLANS = [
  {
    id: 'pro-1m', plan: 'PRO', durationMonths: 1, label: '1 Bulan', price: 25000, popular: false,
    features: ['Semua fitur PRO', 'Analisis AI', 'Jurnal otomatis', 'Unlimited trades']
  },
  {
    id: 'pro-3m', plan: 'PRO', durationMonths: 3, label: '3 Bulan', price: 65000, popular: true, savings: '13%',
    features: ['Semua fitur PRO', 'Analisis AI', 'Jurnal otomatis', 'Unlimited trades', 'Priority support']
  },
  {
    id: 'pro-6m', plan: 'PRO', durationMonths: 6, label: '6 Bulan', price: 120000, popular: false, savings: '20%',
    features: ['Semua fitur PRO', 'Analisis AI', 'Jurnal otomatis', 'Unlimited trades', 'Priority support', 'Early access fitur baru']
  },
  {
    id: 'lifetime', plan: 'LIFETIME', durationMonths: 1200, label: 'Lifetime', price: 52000, popular: false, badge: 'PROMO',
    features: ['Semua fitur selamanya', 'Analisis AI', 'Jurnal otomatis', 'Unlimited trades', 'Priority support', 'Early access', 'Exclusive community']
  }
]

const PAYMENT_METHODS = [
  { id: 'VIRTUAL_ACCOUNT', label: 'Virtual Account', icon: Building2, desc: 'BCA, BNI, BRI, Mandiri', color: 'from-blue-500/20 to-blue-600/10', border: 'border-blue-500/30', text: 'text-blue-400' },
  { id: 'E_WALLET', label: 'E-Wallet', icon: Smartphone, desc: 'GoPay, OVO, DANA, ShopeePay', color: 'from-purple-500/20 to-purple-600/10', border: 'border-purple-500/30', text: 'text-purple-400' },
  { id: 'QRIS', label: 'QRIS', icon: QrCode, desc: 'Scan QR dari apps manapun', color: 'from-emerald-500/20 to-emerald-600/10', border: 'border-emerald-500/30', text: 'text-emerald-400' },
  { id: 'CREDIT_CARD', label: 'Kartu Kredit', icon: CreditCard, desc: 'Visa, Mastercard', color: 'from-amber-500/20 to-amber-600/10', border: 'border-amber-500/30', text: 'text-amber-400' },
]

function formatRupiah(amount: number): string {
  return new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 }).format(amount)
}

// ============================================
// Step indicator
// ============================================
function StepIndicator({ step, totalSteps }: { step: number; totalSteps: number }) {
  return (
    <div className="flex items-center justify-center gap-3 mb-8">
      {Array.from({ length: totalSteps }).map((_, i) => (
        <React.Fragment key={i}>
          <motion.div
            animate={{
              scale: step === i + 1 ? 1.2 : 1,
              backgroundColor: step >= i + 1 ? '#f59e0b' : 'rgba(255,255,255,0.1)',
            }}
            className="w-3 h-3 rounded-full"
          />
          {i < totalSteps - 1 && (
            <div className={`w-12 h-0.5 rounded-full transition-colors duration-300 ${step > i + 1 ? 'bg-amber-500' : 'bg-white/10'}`} />
          )}
        </React.Fragment>
      ))}
      <span className="text-white/40 text-xs ml-2">
        Langkah {step} dari {totalSteps}
      </span>
    </div>
  )
}

// ============================================
// Main Upgrade Form
// ============================================
function UpgradeForm() {
  const router = useRouter()
  const [promoCode, setPromoCode] = useState('')
  const [promoValid, setPromoValid] = useState(false)
  const [promoData, setPromoData] = useState<any>(null)
  const [isValidating, setIsValidating] = useState(false)
  const [isApplying, setIsApplying] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState(false)
  const [user, setUser] = useState<any>(null)
  const [loading, setLoading] = useState(true)

  // Wizard state
  const [step, setStep] = useState(1) // 1 = pilih paket, 2 = pilih metode bayar
  const [selectedPlan, setSelectedPlan] = useState<any>(null)
  const [selectedPaymentMethod, setSelectedPaymentMethod] = useState<string | null>(null)
  const [isCreatingPayment, setIsCreatingPayment] = useState(false)

  // Direction animasi slide
  const [direction, setDirection] = useState(1) // 1 = maju, -1 = mundur

  useEffect(() => {
    const getUser = async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser()
        if (!user) {
          router.push('/auth/login?redirect=/upgrade')
          return
        }
        setUser(user)
      } catch {
        router.push('/auth/login?redirect=/upgrade')
      } finally {
        setLoading(false)
      }
    }
    getUser()
  }, [router])

  const validatePromoCode = async (code: string) => {
    if (!code.trim()) { setPromoValid(false); setPromoData(null); return }
    setIsValidating(true); setError('')
    try {
      const res = await fetch('/api/promo/validate', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code: code.trim() })
      })
      const data = await res.json()
      if (data.valid) { setPromoValid(true); setPromoData(data.promoCode) }
      else { setPromoValid(false); setPromoData(null); setError(data.message || 'Kode promo tidak valid') }
    } catch { setPromoValid(false); setPromoData(null) }
    finally { setIsValidating(false) }
  }

  const handlePromoCodeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value.toUpperCase()
    setPromoCode(value); setError(''); setPromoValid(false); setPromoData(null)
    if (value.length >= 4) setTimeout(() => validatePromoCode(value), 500)
  }

  const handleApplyPromo = async () => {
    if (!user) { router.push('/auth/login?redirect=/upgrade'); return }
    if (!promoCode.trim()) { setError('Masukkan kode promo'); return }
    setIsApplying(true); setError(''); setSuccess(false)
    try {
      const res = await fetch('/api/promo/apply', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ promoCode: promoCode.trim(), plan: 'PRO' })
      })
      const data = await res.json()
      if (!res.ok || !data.success) { setError(data.details || data.message || 'Gagal menerapkan kode promo'); return }
      setSuccess(true); setPromoData(data.subscription)
      setTimeout(() => { window.location.href = '/dashboard' }, 2000)
    } catch { setError('Gagal menerapkan kode promo') }
    finally { setIsApplying(false) }
  }

  // Step 1: Pilih paket → lanjut ke step 2
  const handleSelectPlan = (plan: any) => {
    setSelectedPlan(plan)
    setSelectedPaymentMethod(null)
    setError('')
    setDirection(1)
    setStep(2)
  }

  // Step 2: Pilih metode bayar → bayar
  const handleSelectPaymentMethod = (methodId: string) => {
    setSelectedPaymentMethod(methodId)
    setError('')
  }

  // Kembali ke step 1
  const handleBack = () => {
    setDirection(-1)
    setStep(1)
    setSelectedPaymentMethod(null)
    setError('')
  }

  // Bayar via DOKU
  const handlePay = async () => {
    if (!selectedPlan || !user || !selectedPaymentMethod) return
    setIsCreatingPayment(true); setError('')
    try {
      const res = await fetch('/api/payment/create-order', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          amount: selectedPlan.price,
          plan: selectedPlan.plan,
          durationMonths: selectedPlan.durationMonths,
          paymentMethod: selectedPaymentMethod,
        })
      })
      const data = await res.json()
      if (data.success && data.paymentUrl) {
        window.location.href = data.paymentUrl
      } else {
        setError(data.error || 'Gagal membuat pembayaran')
        setIsCreatingPayment(false)
      }
    } catch (err: any) {
      setError(err.message || 'Gagal menghubungi payment gateway')
      setIsCreatingPayment(false)
    }
  }

  // Loading state
  if (loading) {
    return (
      <div className="w-full max-w-md text-center">
        <Loader2 className="w-10 h-10 text-amber-500 mx-auto mb-4 animate-spin" />
        <p className="text-white/60">Memuat...</p>
      </div>
    )
  }

  // Promo success state
  if (success) {
    return (
      <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="w-full max-w-md text-center">
        <div className="bg-gradient-to-br from-emerald-500/10 to-green-500/5 border border-emerald-500/30 rounded-3xl p-10 backdrop-blur-xl">
          <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ type: 'spring', delay: 0.2 }}
            className="w-24 h-24 rounded-full bg-gradient-to-br from-emerald-500 to-green-600 flex items-center justify-center mx-auto mb-6 shadow-xl shadow-emerald-500/30">
            <Sparkles className="w-12 h-12 text-white" />
          </motion.div>
          <h2 className="text-3xl font-extrabold text-white mb-3">🎉 Upgrade Berhasil!</h2>
          <p className="text-white/70 text-lg mb-2">Selamat datang di LuxTrade Premium</p>
          <p className="text-emerald-400 font-medium mb-8">Akses PRO aktif selama {promoData?.durationMonths || 3} bulan</p>
          <motion.div animate={{ opacity: [0.5, 1, 0.5] }} transition={{ repeat: Infinity, duration: 1.5 }}
            className="text-white/40 text-sm">Mengalihkan ke dashboard...</motion.div>
        </div>
      </motion.div>
    )
  }

  // Animasi slide variants
  const slideVariants = {
    enter: (dir: number) => ({ x: dir > 0 ? 300 : -300, opacity: 0 }),
    center: { x: 0, opacity: 1 },
    exit: (dir: number) => ({ x: dir > 0 ? -300 : 300, opacity: 0 }),
  }

  const selectedMethod = PAYMENT_METHODS.find(m => m.id === selectedPaymentMethod)

  return (
    <div className="w-full max-w-lg">
      {/* Header */}
      <div className="text-center mb-6">
        <motion.div initial={{ y: -20, opacity: 0 }} animate={{ y: 0, opacity: 1 }}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-amber-500/10 border border-amber-500/30 mb-4">
          <Crown className="w-4 h-4 text-amber-400" />
          <span className="text-sm text-amber-300 font-semibold">PREMIUM ACCESS</span>
        </motion.div>
        <h1 className="text-3xl sm:text-4xl font-extrabold text-white mb-2">
          Pilih Paket <span className="bg-gradient-to-r from-amber-400 to-orange-400 bg-clip-text text-transparent">Premium</span>
        </h1>
        <p className="text-white/40 text-sm max-w-md mx-auto">
          {step === 1
            ? 'Pilih paket yang cocok untuk kebutuhan trading kamu'
            : selectedPlan
              ? `Pilih metode bayar untuk ${selectedPlan.plan} ${selectedPlan.label}`
              : 'Pilih metode bayar'}
        </p>
      </div>

      {/* Step Indicator */}
      <StepIndicator step={step} totalSteps={2} />

      {/* Promo Code */}
      {step === 1 && (
        <div className="max-w-sm mx-auto mb-6">
          {error && (
            <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }}
              className="flex items-center gap-2 p-3 mb-3 bg-red-500/10 border border-red-500/30 rounded-xl text-red-400 text-sm">
              <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
              <span>{error}</span>
            </motion.div>
          )}
          <div className="relative">
            <Tag className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-amber-400" />
            <Input
              type="text" placeholder="Kode promo (opsional)"
              value={promoCode} onChange={handlePromoCodeChange}
              disabled={isApplying}
              className="h-11 bg-white/[0.03] border-white/10 text-white placeholder:text-white/25 focus:border-amber-500/50 pl-10 pr-10 uppercase text-sm"
            />
            {isValidating && <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-amber-400 animate-spin" />}
            {promoValid && <CheckCircle className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-emerald-400" />}
          </div>
          {promoValid && promoData && (
            <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
              className="mt-2 p-2.5 bg-emerald-500/10 border border-emerald-500/30 rounded-xl text-emerald-400 text-xs flex items-center gap-2">
              <Gift className="w-3.5 h-3.5 flex-shrink-0" />
              <span>Diskon {promoData.discountPercent}% — {promoData.description}</span>
            </motion.div>
          )}
          {promoValid && (
            <Button onClick={handleApplyPromo} disabled={isApplying || !promoCode.trim()}
              className="w-full h-10 mt-2 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-sm">
              {isApplying ? <Loader2 className="w-4 h-4 animate-spin" /> : <><Sparkles className="w-3.5 h-3.5 mr-1.5" /> Klaim Promo Gratis</>}
            </Button>
          )}
        </div>
      )}

      {/* Step 1: Pilih Paket */}
      <AnimatePresence mode="wait" custom={direction}>
        {step === 1 && (
          <motion.div
            key="step1"
            custom={direction}
            variants={slideVariants}
            initial="enter"
            animate="center"
            exit="exit"
            transition={{ duration: 0.3, ease: 'easeInOut' }}
            className="space-y-3"
          >
            {PLANS.map((plan, index) => (
              <motion.button
                key={plan.id}
                type="button"
                initial={{ opacity: 0, y: 15 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.05 }}
                onClick={() => handleSelectPlan(plan)}
                className={`w-full text-left rounded-2xl p-5 border transition-all duration-200 group ${
                  selectedPlan?.id === plan.id
                    ? 'bg-gradient-to-br from-amber-500/15 to-orange-500/10 border-amber-500/40 shadow-lg shadow-amber-500/10'
                    : plan.popular
                      ? 'bg-white/[0.03] border-white/[0.08] hover:bg-white/[0.05] hover:border-white/15'
                      : 'bg-white/[0.02] border-white/[0.06] hover:bg-white/[0.04] hover:border-white/12'
                }`}
              >
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-3">
                    {plan.badge === 'PROMO' ? (
                      <Badge className="bg-gradient-to-r from-purple-500 to-pink-500 text-white border-0 px-2 py-0.5 text-[10px] font-bold">🔥 PROMO</Badge>
                    ) : plan.popular ? (
                      <Badge className="bg-gradient-to-r from-amber-500 to-orange-500 text-white border-0 px-2 py-0.5 text-[10px] font-bold">⭐ POPULER</Badge>
                    ) : (
                      <Badge variant="outline" className="border-white/15 text-white/50 px-2 py-0.5 text-[10px]">{plan.plan}</Badge>
                    )}
                    <span className="text-white/50 text-sm">{plan.label}</span>
                  </div>
                  {plan.savings && (
                    <Badge variant="outline" className="border-emerald-500/30 text-emerald-400 text-[10px] px-2 py-0.5">
                      Hemat {plan.savings}
                    </Badge>
                  )}
                </div>

                <div className="flex items-center justify-between">
                  <div>
                    <span className="text-2xl font-extrabold text-white">{formatRupiah(plan.price)}</span>
                    <span className="text-white/25 text-sm ml-1">
                      {plan.durationMonths >= 1200 ? '' : `/ ${plan.label}`}
                    </span>
                  </div>
                  <div className="flex items-center gap-2 text-white/40 group-hover:text-white/70 transition-colors">
                    <span className="text-xs">Pilih</span>
                    <ArrowRight className="w-4 h-4" />
                  </div>
                </div>

                <div className="mt-3 pt-3 border-t border-white/[0.04]">
                  <div className="flex flex-wrap gap-2">
                    {plan.features.slice(0, 3).map((feature, i) => (
                      <span key={i} className="text-[11px] text-white/40 flex items-center gap-1">
                        <CheckCircle className="w-3 h-3 text-emerald-500/60" />
                        {feature}
                      </span>
                    ))}
                    {plan.features.length > 3 && (
                      <span className="text-[11px] text-white/30">+{plan.features.length - 3} lainnya</span>
                    )}
                  </div>
                </div>
              </motion.button>
            ))}
          </motion.div>
        )}

        {/* Step 2: Pilih Metode Bayar */}
        {step === 2 && selectedPlan && (
          <motion.div
            key="step2"
            custom={direction}
            variants={slideVariants}
            initial="enter"
            animate="center"
            exit="exit"
            transition={{ duration: 0.3, ease: 'easeInOut' }}
          >
            {/* Ringkasan Pesanan */}
            <div className="bg-gradient-to-r from-amber-500/10 to-orange-500/10 rounded-2xl p-4 border border-amber-500/20 mb-5">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-amber-300 text-xs font-semibold uppercase tracking-wider">Paket Dipilih</p>
                  <p className="text-white font-bold text-lg mt-0.5">
                    {selectedPlan.plan} {selectedPlan.label}
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-white/40 text-[10px] uppercase">Total Bayar</p>
                  <p className="text-white font-extrabold text-xl">{formatRupiah(selectedPlan.price)}</p>
                </div>
              </div>
            </div>

            {/* Tombol kembali */}
            <button
              type="button"
              onClick={handleBack}
              className="flex items-center gap-2 text-white/40 hover:text-white/70 mb-4 transition-colors text-sm"
            >
              <ArrowLeft className="w-4 h-4" />
              Ganti paket
            </button>

            {/* Metode Pembayaran */}
            <h3 className="text-xs font-semibold text-white/40 uppercase tracking-wider mb-3">Pilih Metode Pembayaran</h3>
            <div className="space-y-3 mb-5">
              {PAYMENT_METHODS.map((method) => {
                const isSelected = selectedPaymentMethod === method.id
                return (
                  <motion.button
                    key={method.id}
                    type="button"
                    onClick={() => handleSelectPaymentMethod(method.id)}
                    whileTap={{ scale: 0.98 }}
                    className={`w-full flex items-center gap-4 p-4 rounded-xl border text-left transition-all duration-200 ${
                      isSelected
                        ? `bg-gradient-to-r ${method.color} ${method.border} shadow-lg`
                        : 'bg-white/[0.02] border-white/[0.06] hover:bg-white/[0.05] hover:border-white/15'
                    }`}
                  >
                    {/* Radio indicator */}
                    <div className={`w-6 h-6 rounded-full border-2 flex items-center justify-center flex-shrink-0 transition-all ${
                      isSelected ? 'border-emerald-400 bg-emerald-400' : 'border-white/20'
                    }`}>
                      {isSelected && <div className="w-2.5 h-2.5 rounded-full bg-white" />}
                    </div>

                    {/* Icon */}
                    <div className={`w-11 h-11 rounded-xl flex items-center justify-center flex-shrink-0 ${
                      isSelected ? 'bg-white/20' : 'bg-white/[0.05]'
                    }`}>
                      <method.icon className={`w-5 h-5 ${isSelected ? 'text-white' : 'text-white/40'}`} />
                    </div>

                    {/* Info */}
                    <div className="flex-1 min-w-0">
                      <p className={`text-sm font-semibold ${isSelected ? 'text-white' : 'text-white/80'}`}>{method.label}</p>
                      <p className={`text-xs mt-0.5 ${isSelected ? 'text-white/60' : 'text-white/30'}`}>{method.desc}</p>
                    </div>

                    {/* Selected check */}
                    {isSelected && (
                      <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} className="flex-shrink-0">
                        <CheckCircle className="w-6 h-6 text-emerald-400" />
                      </motion.div>
                    )}
                  </motion.button>
                )
              })}
            </div>

            {/* Error */}
            {error && (
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}
                className="flex items-center gap-2 p-3 mb-4 bg-red-500/10 border border-red-500/30 rounded-xl text-red-400 text-sm">
                <AlertCircle className="w-4 h-4 flex-shrink-0" />
                <span>{error}</span>
              </motion.div>
            )}

            {/* Tombol Bayar */}
            <Button
              type="button"
              onClick={handlePay}
              disabled={isCreatingPayment || !selectedPaymentMethod}
              className={`w-full h-14 font-bold text-base rounded-2xl transition-all duration-300 disabled:opacity-30 disabled:cursor-not-allowed ${
                selectedPaymentMethod
                  ? 'bg-gradient-to-r from-amber-500 via-orange-500 to-amber-600 hover:from-amber-600 hover:via-orange-600 hover:to-amber-700 text-white shadow-xl shadow-amber-500/25'
                  : 'bg-white/[0.05] text-white/30'
              }`}
            >
              {isCreatingPayment ? (
                <>
                  <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                  Menghubungkan ke DOKU...
                </>
              ) : selectedPaymentMethod ? (
                <>
                  <Shield className="w-5 h-5 mr-2" />
                  Bayar {formatRupiah(selectedPlan.price)} — {selectedMethod?.label}
                  <ArrowRight className="w-5 h-5 ml-2" />
                </>
              ) : (
                <>
                  Pilih metode bayar dulu
                </>
              )}
            </Button>

            {/* Keamanan */}
            <div className="flex items-center justify-center gap-2 mt-4 text-white/25 text-xs">
              <Lock className="w-3 h-3" />
              <span>Pembayaran aman & terenkripsi via DOKU</span>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Trust badges (step 1 only) */}
      {step === 1 && (
        <div className="flex flex-wrap items-center justify-center gap-5 mt-6">
          {[
            { icon: Shield, text: 'Pembayaran Aman' },
            { icon: Zap, text: 'Aktivasi Instan' },
            { icon: Star, text: 'Support 24/7' },
            { icon: Lock, text: 'Data Terenkripsi' },
          ].map((badge, i) => (
            <div key={i} className="flex items-center gap-1.5 text-white/25">
              <badge.icon className="w-3.5 h-3.5" />
              <span className="text-[11px]">{badge.text}</span>
            </div>
          ))}
        </div>
      )}

      {/* Back to dashboard */}
      <div className="text-center mt-6">
        <button onClick={() => router.push('/dashboard')}
          className="text-white/25 text-xs hover:text-white/50 transition-colors">
          ← Kembali ke Dashboard
        </button>
      </div>
    </div>
  )
}

function UpgradeLoading() {
  return (
    <div className="min-h-screen bg-[#0a0612] flex items-center justify-center p-4">
      <div className="w-full max-w-md text-center">
        <Loader2 className="w-10 h-10 text-amber-500 mx-auto mb-4 animate-spin" />
        <p className="text-white/60">Memuat halaman...</p>
      </div>
    </div>
  )
}

export default function UpgradePage() {
  return (
    <div className="min-h-screen bg-[#0a0612] flex items-center justify-center p-4">
      <div className="fixed inset-0 -z-10">
        <div className="absolute inset-0 bg-gradient-to-b from-[#0a0612] via-[#110a1f] to-[#0a0612]" />
        <div className="absolute top-0 left-1/4 w-[600px] h-[600px] bg-amber-500/5 rounded-full blur-[150px]" />
        <div className="absolute bottom-1/4 right-1/4 w-[400px] h-[400px] bg-purple-500/10 rounded-full blur-[100px]" />
      </div>

      <Suspense fallback={<UpgradeLoading />}>
        <UpgradeForm />
      </Suspense>
    </div>
  )
}
