'use client'

import React, { useState, useEffect, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useRouter } from 'next/navigation'
import {
  Crown, ArrowRight, ArrowLeft, AlertCircle, Loader2,
  CheckCircle, Tag, Sparkles, Shield, Zap, Star,
  CreditCard, Smartphone, QrCode, Building2,
  Gift, Lock, Wallet
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import { supabase } from '@/lib/supabase'

// ============================================
// Data
// ============================================
const PLANS = [
  { id: 'pro-1m', plan: 'PRO', durationMonths: 1, label: '1 Bulan', price: 25000, popular: false, emoji: '📊',
    features: ['Semua fitur PRO', 'Analisis AI', 'Jurnal otomatis', 'Unlimited trades'] },
  { id: 'pro-3m', plan: 'PRO', durationMonths: 3, label: '3 Bulan', price: 65000, popular: true, savings: '13%', emoji: '⭐',
    features: ['Semua fitur PRO', 'Analisis AI', 'Jurnal otomatis', 'Unlimited trades', 'Priority support'] },
  { id: 'pro-6m', plan: 'PRO', durationMonths: 6, label: '6 Bulan', price: 120000, popular: false, savings: '20%', emoji: '🔥',
    features: ['Semua fitur PRO', 'Analisis AI', 'Jurnal otomatis', 'Unlimited trades', 'Priority support', 'Early access fitur baru'] },
  { id: 'lifetime', plan: 'LIFETIME', durationMonths: 1200, label: 'Lifetime', price: 52000, popular: false, badge: 'PROMO', emoji: '👑',
    features: ['Semua fitur selamanya', 'Analisis AI', 'Jurnal otomatis', 'Unlimited trades', 'Priority support', 'Early access', 'Exclusive community'] }
]

const PAYMENT_METHODS = [
  { id: 'VIRTUAL_ACCOUNT', label: 'Virtual Account', icon: Building2, desc: 'BCA, BNI, BRI, Mandiri', accent: 'from-blue-500 to-blue-600', bg: 'from-blue-500/15', border: 'border-blue-500/40', text: 'text-blue-400' },
  { id: 'E_WALLET', label: 'E-Wallet', icon: Smartphone, desc: 'GoPay, OVO, DANA, ShopeePay', accent: 'from-purple-500 to-violet-600', bg: 'from-purple-500/15', border: 'border-purple-500/40', text: 'text-purple-400' },
  { id: 'QRIS', label: 'QRIS', icon: QrCode, desc: 'Scan QR dari apps manapun', accent: 'from-emerald-500 to-green-600', bg: 'from-emerald-500/15', border: 'border-emerald-500/40', text: 'text-emerald-400' },
  { id: 'CREDIT_CARD', label: 'Kartu Kredit', icon: CreditCard, desc: 'Visa, Mastercard', accent: 'from-amber-500 to-orange-500', bg: 'from-amber-500/15', border: 'border-amber-500/40', text: 'text-amber-400' },
]

function formatRupiah(n: number) {
  return new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 }).format(n)
}

// ============================================
// Main Form — Pola AnimatePresence seperti TradeWizardForm
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

  const [currentStep, setCurrentStep] = useState(1)
  const totalSteps = 2
  const progress = (currentStep / totalSteps) * 100
  const [selectedPlan, setSelectedPlan] = useState<any>(null)
  const [selectedPaymentMethod, setSelectedPaymentMethod] = useState<string | null>(null)
  const [isCreatingPayment, setIsCreatingPayment] = useState(false)

  useEffect(() => {
    (async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser()
        if (!user) { router.push('/auth/login?redirect=/upgrade'); return }
        setUser(user)
      } catch { router.push('/auth/login?redirect=/upgrade') }
      finally { setLoading(false) }
    })()
  }, [router])

  // Promo
  const validatePromo = async (code: string) => {
    if (!code.trim()) { setPromoValid(false); setPromoData(null); return }
    setIsValidating(true); setError('')
    try {
      const r = await fetch('/api/promo/validate', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ code: code.trim() }) })
      const d = await r.json()
      if (d.valid) { setPromoValid(true); setPromoData(d.promoCode) }
      else { setPromoValid(false); setPromoData(null); setError(d.message || 'Kode promo tidak valid') }
    } catch { setPromoValid(false) }
    finally { setIsValidating(false) }
  }
  const onPromoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const v = e.target.value.toUpperCase()
    setPromoCode(v); setError(''); setPromoValid(false); setPromoData(null)
    if (v.length >= 4) setTimeout(() => validatePromo(v), 500)
  }
  const applyPromo = async () => {
    if (!user) return
    setIsApplying(true); setError(''); setSuccess(false)
    try {
      const r = await fetch('/api/promo/apply', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ promoCode: promoCode.trim(), plan: 'PRO' }) })
      const d = await r.json()
      if (!r.ok || !d.success) { setError(d.details || d.message || 'Gagal'); return }
      setSuccess(true); setPromoData(d.subscription)
      setTimeout(() => { window.location.href = '/dashboard' }, 2000)
    } catch { setError('Gagal') }
    finally { setIsApplying(false) }
  }

  // Step navigation — sama seperti TradeWizardForm
  const goNext = useCallback(() => {
    if (currentStep < totalSteps) {
      setCurrentStep(currentStep + 1)
      setError('')
    }
  }, [currentStep])

  const goBack = useCallback(() => {
    if (currentStep > 1) {
      setCurrentStep(currentStep - 1)
      setError('')
    }
  }, [currentStep])

  // Pay
  const handlePay = async () => {
    if (!selectedPlan || !user || !selectedPaymentMethod) return
    setIsCreatingPayment(true); setError('')
    try {
      const r = await fetch('/api/payment/create-order', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ amount: selectedPlan.price, plan: selectedPlan.plan, durationMonths: selectedPlan.durationMonths, paymentMethod: selectedPaymentMethod })
      })
      const d = await r.json()
      if (d.success && d.paymentUrl) window.location.href = d.paymentUrl
      else { setError(d.error || 'Gagal membuat pembayaran'); setIsCreatingPayment(false) }
    } catch (err: any) { setError(err.message || 'Gagal'); setIsCreatingPayment(false) }
  }

  const selectedMethod = PAYMENT_METHODS.find(m => m.id === selectedPaymentMethod)

  if (loading) return (
    <div className="w-full max-w-md text-center">
      <Loader2 className="w-10 h-10 text-amber-500 mx-auto mb-4 animate-spin" />
      <p className="text-white/60">Memuat...</p>
    </div>
  )

  if (success) return (
    <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="w-full max-w-md text-center">
      <div className="bg-gradient-to-br from-emerald-500/10 to-green-500/5 border border-emerald-500/30 rounded-3xl p-10">
        <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ type: 'spring', delay: 0.2 }} className="w-24 h-24 rounded-full bg-gradient-to-br from-emerald-500 to-green-600 flex items-center justify-center mx-auto mb-6 shadow-xl shadow-emerald-500/30"><Sparkles className="w-12 h-12 text-white" /></motion.div>
        <h2 className="text-3xl font-extrabold text-white mb-3">🎉 Upgrade Berhasil!</h2>
        <p className="text-emerald-400 font-medium">Mengalihkan ke dashboard...</p>
      </div>
    </motion.div>
  )

  return (
    <div className="w-full max-w-lg">
      {/* Header */}
      <div className="text-center mb-6">
        <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-amber-500/10 border border-amber-500/30 mb-3">
          <Crown className="w-4 h-4 text-amber-400" />
          <span className="text-sm text-amber-300 font-semibold">PREMIUM ACCESS</span>
        </div>
        <h1 className="text-2xl sm:text-3xl font-extrabold text-white mb-1">
          Upgrade ke <span className="bg-gradient-to-r from-amber-400 to-orange-400 bg-clip-text text-transparent">Premium</span>
        </h1>
        <p className="text-white/40 text-sm">
          {currentStep === 1 ? 'Pilih paket yang cocok buat kamu' : `Pilih metode bayar — ${selectedPlan?.plan} ${selectedPlan?.label}`}
        </p>
      </div>

      {/* Progress Bar — persis seperti TradeWizardForm */}
      <div className="mb-6">
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs text-white/30 font-medium">
            Step {currentStep} of {totalSteps}
          </span>
          <span className="text-xs text-white/30">{Math.round(progress)}%</span>
        </div>
        <Progress value={progress} className="h-2 bg-purple-900/30" />
      </div>

      {/* AnimatePresence — persis seperti TradeWizardForm (mode="wait") */}
      <div className="relative">
        <AnimatePresence mode="wait">
          {/* ============ STEP 1: PILIH PAKET ============ */}
          {currentStep === 1 && (
            <motion.div
              key="step1"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              transition={{ duration: 0.3 }}
              className="space-y-4"
            >
              {/* Promo */}
              <div>
                {error && currentStep === 1 && (
                  <motion.div initial={{ opacity: 0, y: -5 }} animate={{ opacity: 1, y: 0 }} className="flex items-center gap-2 p-2.5 mb-2 bg-red-500/10 border border-red-500/30 rounded-xl text-red-400 text-xs"><AlertCircle className="w-3.5 h-3.5 flex-shrink-0" /><span>{error}</span></motion.div>
                )}
                <div className="relative">
                  <Tag className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-amber-400" />
                  <Input type="text" placeholder="Kode promo (opsional)" value={promoCode} onChange={onPromoChange} disabled={isApplying}
                    className="h-10 bg-[#0a0712] border-purple-900/30 text-white placeholder:text-white/25 focus:border-amber-500/50 pl-9 pr-9 uppercase text-xs" />
                  {isValidating && <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-amber-400 animate-spin" />}
                  {promoValid && <CheckCircle className="absolute right-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-emerald-400" />}
                </div>
                {promoValid && promoData && (
                  <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="mt-1.5 p-2 bg-emerald-500/10 border border-emerald-500/30 rounded-lg text-emerald-400 text-[11px] flex items-center gap-1.5"><Gift className="w-3 h-3" /><span>Diskon {promoData.discountPercent}% — {promoData.description}</span></motion.div>
                )}
                {promoValid && <Button onClick={applyPromo} disabled={isApplying} size="sm" className="w-full h-9 mt-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold">{isApplying ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <><Sparkles className="w-3 h-3 mr-1" /> Klaim Promo Gratis</>}</Button>}
              </div>

              {/* Plan Cards */}
              <div className="space-y-2.5">
                {PLANS.map((plan, i) => (
                  <motion.button
                    key={plan.id}
                    type="button"
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: i * 0.04 }}
                    onClick={() => { setSelectedPlan(plan); setSelectedPaymentMethod(null); setError('') }}
                    className={`w-full text-left rounded-xl p-4 border-2 transition-all duration-200 ${
                      selectedPlan?.id === plan.id
                        ? 'bg-gradient-to-br from-amber-500/15 to-orange-500/10 border-amber-500/50 shadow-lg shadow-amber-500/10'
                        : 'bg-[#0a0712] border-purple-900/30 hover:border-purple-500/40 active:scale-[0.98]'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="w-10 h-10 rounded-lg bg-white/5 flex items-center justify-center text-lg flex-shrink-0">{plan.emoji}</div>
                        <div className="min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="text-white font-bold text-sm">{plan.plan}</span>
                            <span className="text-white/40 text-xs">{plan.label}</span>
                            {plan.badge === 'PROMO' && <Badge className="bg-gradient-to-r from-purple-500 to-pink-500 text-white border-0 px-1.5 py-0 text-[9px] font-bold">PROMO</Badge>}
                            {plan.popular && !plan.badge && <Badge className="bg-gradient-to-r from-amber-500 to-orange-500 text-white border-0 px-1.5 py-0 text-[9px] font-bold">POPULER</Badge>}
                          </div>
                          <p className="text-white/30 text-[11px] mt-0.5 truncate">{plan.features.slice(0, 2).join(' · ')}</p>
                        </div>
                      </div>
                      <div className="text-right flex-shrink-0">
                        <p className="text-white font-extrabold text-lg">{formatRupiah(plan.price)}</p>
                        {plan.savings && <p className="text-emerald-400 text-[10px] font-medium">Hemat {plan.savings}</p>}
                      </div>
                    </div>
                  </motion.button>
                ))}
              </div>

              {/* Tombol Lanjut — Step */}
              <Button
                type="button"
                onClick={goNext}
                disabled={!selectedPlan}
                className={`w-full h-12 rounded-xl font-bold text-sm transition-all disabled:opacity-30 disabled:cursor-not-allowed ${
                  selectedPlan
                    ? 'bg-gradient-to-r from-purple-500 to-violet-600 hover:from-purple-600 hover:to-violet-700 text-white shadow-lg shadow-purple-500/20 active:scale-[0.98]'
                    : 'bg-white/5 text-white/30'
                }`}
              >
                {selectedPlan ? (
                  <>
                    Lanjut Pilih Metode Bayar
                    <ArrowRight className="w-4 h-4 ml-2" />
                  </>
                ) : (
                  'Pilih paket dulu'
                )}
              </Button>
            </motion.div>
          )}

          {/* ============ STEP 2: METODE BAYAR ============ */}
          {currentStep === 2 && (
            <motion.div
              key="step2"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              transition={{ duration: 0.3 }}
              className="space-y-4"
            >
              {/* Ringkasan Paket */}
              {selectedPlan && (
                <div className="bg-gradient-to-br from-amber-500/10 to-orange-500/5 rounded-xl p-4 border border-amber-500/20">
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="w-10 h-10 rounded-lg bg-white/10 flex items-center justify-center text-lg flex-shrink-0">{selectedPlan.emoji}</div>
                      <div className="min-w-0">
                        <p className="text-white font-bold">{selectedPlan.plan} {selectedPlan.label}</p>
                        <p className="text-white/40 text-[11px] truncate">{selectedPlan.features.slice(0, 3).join(' · ')}</p>
                      </div>
                    </div>
                    <div className="text-right flex-shrink-0">
                      <p className="text-[10px] text-white/30 uppercase">Total</p>
                      <p className="text-white font-extrabold text-lg">{formatRupiah(selectedPlan.price)}</p>
                    </div>
                  </div>
                </div>
              )}

              {/* Label */}
              <h3 className="text-xs font-semibold text-white/40 uppercase tracking-wider">Pilih Metode Pembayaran</h3>

              {/* Payment Methods — BUTTON BIASA bukan motion.button (supaya aman di mobile) */}
              <div className="space-y-2.5">
                {PAYMENT_METHODS.map((method) => {
                  const isSel = selectedPaymentMethod === method.id
                  return (
                    <button
                      key={method.id}
                      type="button"
                      onClick={() => { setSelectedPaymentMethod(method.id); setError('') }}
                      className={`w-full flex items-center gap-3 p-4 rounded-xl border-2 text-left transition-all duration-200 active:scale-[0.98] ${
                        isSel
                          ? `bg-gradient-to-r ${method.bg} ${method.border} shadow-lg`
                          : 'bg-[#0a0712] border-purple-900/30 hover:border-purple-500/30'
                      }`}
                    >
                      {/* Radio */}
                      <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center flex-shrink-0 transition-all ${isSel ? 'border-emerald-400' : 'border-white/15'}`}>
                        {isSel && <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} className="w-2.5 h-2.5 rounded-full bg-emerald-400" />}
                      </div>

                      {/* Icon */}
                      <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${
                        isSel ? `bg-gradient-to-br ${method.accent}` : 'bg-white/5'
                      }`}>
                        <method.icon className={`w-5 h-5 ${isSel ? 'text-white' : 'text-white/40'}`} />
                      </div>

                      {/* Label */}
                      <div className="flex-1 min-w-0">
                        <p className={`text-sm font-semibold ${isSel ? 'text-white' : 'text-white/70'}`}>{method.label}</p>
                        <p className={`text-[11px] ${isSel ? 'text-white/50' : 'text-white/25'}`}>{method.desc}</p>
                      </div>

                      {/* Checkmark */}
                      {isSel && <CheckCircle className="w-5 h-5 text-emerald-400 flex-shrink-0" />}
                    </button>
                  )
                })}
              </div>

              {/* Error */}
              {error && currentStep === 2 && (
                <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex items-center gap-2 p-2.5 bg-red-500/10 border border-red-500/30 rounded-xl text-red-400 text-xs"><AlertCircle className="w-3.5 h-3.5 flex-shrink-0" /><span>{error}</span></motion.div>
              )}

              {/* Tombol Bayar */}
              <Button
                type="button"
                onClick={handlePay}
                disabled={isCreatingPayment || !selectedPaymentMethod}
                className={`w-full h-12 rounded-xl font-bold text-sm transition-all disabled:opacity-30 disabled:cursor-not-allowed ${
                  selectedPaymentMethod
                    ? 'bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-600 hover:to-teal-700 text-white shadow-lg shadow-emerald-500/20 active:scale-[0.98]'
                    : 'bg-white/5 text-white/30'
                }`}
              >
                {isCreatingPayment ? (
                  <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Menghubungkan ke DOKU...</>
                ) : selectedPaymentMethod ? (
                  <><Shield className="w-4 h-4 mr-2" />Bayar {formatRupiah(selectedPlan.price)} via {selectedMethod?.label}<ArrowRight className="w-4 h-4 ml-2" /></>
                ) : (
                  'Pilih metode bayar dulu'
                )}
              </Button>

              {/* Back */}
              <button type="button" onClick={goBack}
                className="w-full flex items-center justify-center gap-2 text-white/30 hover:text-white/50 transition-colors text-xs py-2 active:scale-[0.98]">
                <ArrowLeft className="w-3.5 h-3.5" /> Kembali ganti paket
              </button>

              {/* Security */}
              <div className="flex items-center justify-center gap-2 text-white/20 text-[11px]">
                <Lock className="w-3 h-3" /><span>Aman & terenkripsi via DOKU</span>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Trust badges */}
      <div className="flex flex-wrap items-center justify-center gap-4 mt-6">
        {[{ icon: Shield, text: 'Aman' }, { icon: Zap, text: 'Instan' }, { icon: Star, text: '24/7' }, { icon: Lock, text: 'Enkripsi' }].map((b, i) => (
          <div key={i} className="flex items-center gap-1 text-white/20"><b.icon className="w-3 h-3" /><span className="text-[10px]">{b.text}</span></div>
        ))}
      </div>

      {/* Back to dashboard */}
      <div className="text-center mt-4">
        <button onClick={() => router.push('/dashboard')} className="text-white/20 text-xs hover:text-white/40 transition-colors">← Dashboard</button>
      </div>
    </div>
  )
}

function Loading() {
  return (
    <div className="w-full text-center">
      <Loader2 className="w-10 h-10 text-amber-500 mx-auto mb-4 animate-spin" />
      <p className="text-white/60">Memuat...</p>
    </div>
  )
}

export default function UpgradePage() {
  return (
    <main className="min-h-screen bg-[#0a0612] flex items-center justify-center p-4">
      {/* Background — tanpa fixed/overlay, langsung di main */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-b from-[#0a0612] via-[#110a1f] to-[#0a0612]" />
        <div className="absolute top-0 left-1/4 w-[600px] h-[600px] bg-amber-500/5 rounded-full blur-[150px]" />
        <div className="absolute bottom-1/4 right-1/4 w-[400px] h-[400px] bg-purple-500/10 rounded-full blur-[100px]" />
      </div>

      {/* Content */}
      <div className="relative z-10 w-full flex justify-center">
        <UpgradeForm />
      </div>
    </main>
  )
}
