'use client'

import React, { useState, useEffect, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useRouter } from 'next/navigation'
import {
  Crown, ArrowRight, ArrowLeft, AlertCircle, Loader2,
  CheckCircle, Tag, Sparkles, Shield, Zap, Star,
  CreditCard, Smartphone, QrCode, Building2,
  Gift, Lock, Wallet, Check
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent } from '@/components/ui/card'
import { Progress } from '@/components/ui/progress'
import { supabase } from '@/lib/supabase'

// ============================================
// Data
// ============================================
const PLANS = [
  {
    id: 'pro-1m', plan: 'PRO', durationMonths: 1, label: '1 Bulan',
    price: 25000, popular: false, emoji: '📊',
    features: ['Semua fitur PRO', 'Analisis AI', 'Jurnal otomatis', 'Unlimited trades']
  },
  {
    id: 'pro-3m', plan: 'PRO', durationMonths: 3, label: '3 Bulan',
    price: 65000, popular: true, savings: '13%', emoji: '⭐',
    features: ['Semua fitur PRO', 'Analisis AI', 'Jurnal otomatis', 'Unlimited trades', 'Priority support']
  },
  {
    id: 'pro-6m', plan: 'PRO', durationMonths: 6, label: '6 Bulan',
    price: 120000, popular: false, savings: '20%', emoji: '🔥',
    features: ['Semua fitur PRO', 'Analisis AI', 'Jurnal otomatis', 'Unlimited trades', 'Priority support', 'Early access']
  },
  {
    id: 'lifetime', plan: 'LIFETIME', durationMonths: 1200, label: 'Lifetime',
    price: 52000, popular: false, badge: 'PROMO', emoji: '👑',
    features: ['Semua fitur selamanya', 'Analisis AI', 'Jurnal otomatis', 'Unlimited trades', 'Priority support', 'Early access', 'Exclusive community']
  }
]

const PAYMENT_METHODS = [
  { id: 'VIRTUAL_ACCOUNT', label: 'Virtual Account', icon: Building2, desc: 'BCA, BNI, BRI, Mandiri', color: 'blue' },
  { id: 'E_WALLET', label: 'E-Wallet', icon: Smartphone, desc: 'GoPay, OVO, DANA, ShopeePay', color: 'violet' },
  { id: 'QRIS', label: 'QRIS', icon: QrCode, desc: 'Scan QR dari apps manapun', color: 'emerald' },
  { id: 'CREDIT_CARD', label: 'Kartu Kredit', icon: CreditCard, desc: 'Visa, Mastercard', color: 'amber' },
]

function formatRupiah(n: number) {
  return new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 }).format(n)
}

// ============================================
// Main Form — Exact TradeWizardForm design tokens
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
        if (!user) {
          if (!process.env.NEXT_PUBLIC_SUPABASE_URL) {
            setUser({ id: 'dev-user', email: 'dev@test.com' })
            setLoading(false)
            return
          }
          router.push('/auth/login?redirect=/upgrade'); return
        }
        setUser(user)
      } catch {
        if (!process.env.NEXT_PUBLIC_SUPABASE_URL) {
          setUser({ id: 'dev-user', email: 'dev@test.com' })
        } else {
          router.push('/auth/login?redirect=/upgrade')
        }
      }
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

  // Step navigation
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
    <div className="flex items-center justify-center py-16">
      <Loader2 className="w-8 h-8 text-purple-400 animate-spin" />
    </div>
  )

  if (success) return (
    <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="text-center py-10">
      <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-gradient-to-br from-emerald-500 to-teal-600 mb-4">
        <Sparkles className="w-8 h-8 text-white" />
      </div>
      <h2 className="text-xl font-bold text-white mb-1">Upgrade Berhasil!</h2>
      <p className="text-emerald-400 text-sm">Mengalihkan ke dashboard...</p>
    </motion.div>
  )

  return (
    <div className="space-y-6 pb-4">

      {/* ========== PROGRESS BAR — exact TradeWizardForm style ========== */}
      <div className="space-y-2 shrink-0">
        <div className="flex items-center justify-between text-sm">
          <span className="text-purple-300 font-medium">
            Step {currentStep} of {totalSteps}
          </span>
          <span className="text-gray-400">
            {Math.round(progress)}% Complete
          </span>
        </div>
        <Progress value={progress} className="h-2 bg-purple-900/30" />
      </div>

      {/* ========== STEP CONTENT — scrollable on mobile ========== */}
      <div className="overflow-y-auto max-h-[55vh] lg:max-h-none -mx-1 px-1">

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
              {/* Promo Code */}
              {error && currentStep === 1 && (
                <motion.div initial={{ opacity: 0, y: -5 }} animate={{ opacity: 1, y: 0 }}
                  className="flex items-center gap-2 p-3 bg-red-500/10 border border-red-500/30 rounded-lg text-red-400 text-xs">
                  <AlertCircle className="w-4 h-4 flex-shrink-0" />
                  <span>{error}</span>
                </motion.div>
              )}

              <div className="space-y-2">
                <label className="text-white font-semibold text-sm flex items-center gap-2">
                  <Tag className="w-4 h-4 text-purple-400" />
                  Kode Promo (opsional)
                </label>
                <div className="relative">
                  <Input type="text" placeholder="Masukkan kode promo..." value={promoCode} onChange={onPromoChange} disabled={isApplying}
                    className="bg-[#0a0712] border-purple-900/30 text-white placeholder:text-gray-500 pr-10 uppercase text-sm" />
                  {isValidating && <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-purple-400 animate-spin" />}
                  {promoValid && <CheckCircle className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-emerald-400" />}
                </div>
              </div>

              {promoValid && promoData && (
                <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}
                  className="flex items-center gap-2 p-3 bg-emerald-500/10 border border-emerald-500/30 rounded-lg text-emerald-400 text-xs">
                  <Gift className="w-4 h-4 flex-shrink-0" />
                  <span>Diskon {promoData.discountPercent}% — {promoData.description}</span>
                </motion.div>
              )}

              {promoValid && (
                <Button onClick={applyPromo} disabled={isApplying}
                  className="w-full bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-600 hover:to-teal-700 text-white font-semibold">
                  {isApplying ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <><Sparkles className="w-4 h-4 mr-2" />Klaim Promo Gratis</>}
                </Button>
              )}

              {/* Plan Selection — chip style like emotion selector */}
              <div className="space-y-2">
                <label className="text-white font-semibold text-sm">Pilih Paket</label>
                <div className="space-y-2.5">
                  {PLANS.map((plan) => {
                    const isSelected = selectedPlan?.id === plan.id
                    return (
                      <Card
                        key={plan.id}
                        className={`cursor-pointer transition-all duration-200 ${
                          isSelected
                            ? 'border-purple-500 bg-purple-500/20 shadow-lg shadow-purple-500/20'
                            : 'border-purple-900/30 bg-white/5 hover:border-purple-500/50'
                        }`}
                        onClick={() => { setSelectedPlan(plan); setSelectedPaymentMethod(null); setError('') }}
                      >
                        <CardContent className="p-4">
                          <div className="flex items-center justify-between gap-3">
                            <div className="flex items-center gap-3 min-w-0">
                              <div className="text-xl flex-shrink-0">{plan.emoji}</div>
                              <div className="min-w-0">
                                <div className="flex items-center gap-2 flex-wrap">
                                  <span className="text-white font-bold text-sm">{plan.plan}</span>
                                  <span className="text-gray-400 text-xs">{plan.label}</span>
                                  {plan.badge === 'PROMO' && (
                                    <span className="px-2 py-0.5 text-[10px] font-bold rounded-md bg-gradient-to-r from-pink-500 to-violet-500 text-white">PROMO</span>
                                  )}
                                  {plan.popular && !plan.badge && (
                                    <span className="px-2 py-0.5 text-[10px] font-bold rounded-md bg-gradient-to-r from-amber-500 to-orange-500 text-white">POPULER</span>
                                  )}
                                </div>
                                <p className="text-gray-500 text-xs mt-0.5 truncate">
                                  {plan.features.slice(0, 2).join(' · ')}
                                </p>
                              </div>
                            </div>
                            <div className="text-right flex-shrink-0">
                              <p className="text-white font-bold text-base">{formatRupiah(plan.price)}</p>
                              {plan.savings && <p className="text-emerald-400 text-xs font-medium">Hemat {plan.savings}</p>}
                            </div>
                          </div>

                          {/* Expanded features when selected */}
                          {isSelected && (
                            <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} className="mt-3 pt-3 border-t border-purple-900/30">
                              <div className="flex flex-wrap gap-x-4 gap-y-1.5">
                                {plan.features.map((f, fi) => (
                                  <div key={fi} className="flex items-center gap-1.5 text-xs text-gray-300">
                                    <Check className="w-3.5 h-3.5 text-emerald-400" />
                                    <span>{f}</span>
                                  </div>
                                ))}
                              </div>
                            </motion.div>
                          )}
                        </CardContent>
                      </Card>
                    )
                  })}
                </div>
              </div>
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
              {/* Order Summary */}
              {selectedPlan && (
                <Card className="bg-gradient-to-br from-amber-500/10 to-transparent border-amber-500/30">
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between gap-3">
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="text-xl flex-shrink-0">{selectedPlan.emoji}</div>
                        <div className="min-w-0">
                          <p className="text-white font-bold text-sm">{selectedPlan.plan} {selectedPlan.label}</p>
                          <p className="text-gray-400 text-xs truncate">{selectedPlan.features.slice(0, 2).join(' · ')}</p>
                        </div>
                      </div>
                      <div className="text-right flex-shrink-0">
                        <p className="text-gray-400 text-[10px] uppercase font-medium">Total</p>
                        <p className="text-white font-bold text-lg">{formatRupiah(selectedPlan.price)}</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* Payment Methods — card style like emotion selector in TradeWizardForm */}
              <div className="space-y-2">
                <label className="text-white font-semibold text-sm">Metode Pembayaran</label>
                <div className="grid grid-cols-1 gap-2.5">
                  {PAYMENT_METHODS.map((method) => {
                    const isSelected = selectedPaymentMethod === method.id
                    const colorMap: Record<string, { selected: string; unselected: string }> = {
                      blue:    { selected: 'border-blue-500 bg-blue-500/20 shadow-lg shadow-blue-500/20', unselected: 'border-purple-900/30 bg-white/5 hover:border-blue-500/50' },
                      violet:  { selected: 'border-violet-500 bg-violet-500/20 shadow-lg shadow-violet-500/20', unselected: 'border-purple-900/30 bg-white/5 hover:border-violet-500/50' },
                      emerald: { selected: 'border-emerald-500 bg-emerald-500/20 shadow-lg shadow-emerald-500/20', unselected: 'border-purple-900/30 bg-white/5 hover:border-emerald-500/50' },
                      amber:   { selected: 'border-amber-500 bg-amber-500/20 shadow-lg shadow-amber-500/20', unselected: 'border-purple-900/30 bg-white/5 hover:border-amber-500/50' },
                    }
                    const iconBgMap: Record<string, string> = {
                      blue: 'bg-blue-500', violet: 'bg-violet-500', emerald: 'bg-emerald-500', amber: 'bg-amber-500',
                    }
                    const colorStyle = colorMap[method.color] || colorMap.blue

                    return (
                      <Card
                        key={method.id}
                        className={`cursor-pointer transition-all duration-200 ${isSelected ? colorStyle.selected : colorStyle.unselected}`}
                        onClick={() => { setSelectedPaymentMethod(method.id); setError('') }}
                      >
                        <CardContent className="p-4">
                          <div className="flex items-center gap-3">
                            {/* Radio indicator */}
                            <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center flex-shrink-0 transition-colors ${
                              isSelected ? 'border-purple-400' : 'border-purple-900/30'
                            }`}>
                              {isSelected && (
                                <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} className="w-2.5 h-2.5 rounded-full bg-purple-400" />
                              )}
                            </div>

                            {/* Icon */}
                            <div className={`w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0 ${
                              isSelected ? iconBgMap[method.color] || 'bg-purple-500' : 'bg-purple-900/20'
                            }`}>
                              <method.icon className="w-5 h-5 text-white" />
                            </div>

                            {/* Label */}
                            <div className="flex-1 min-w-0">
                              <p className="text-white font-semibold text-sm">{method.label}</p>
                              <p className="text-gray-500 text-xs">{method.desc}</p>
                            </div>

                            {/* Check */}
                            {isSelected && <CheckCircle className="w-5 h-5 text-purple-400 flex-shrink-0" />}
                          </div>
                        </CardContent>
                      </Card>
                    )
                  })}
                </div>
              </div>

              {/* Error */}
              {error && currentStep === 2 && (
                <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}
                  className="flex items-center gap-2 p-3 bg-red-500/10 border border-red-500/30 rounded-lg text-red-400 text-xs">
                  <AlertCircle className="w-4 h-4 flex-shrink-0" />
                  <span>{error}</span>
                </motion.div>
              )}

              {/* Security */}
              <div className="flex items-center gap-2 p-3 bg-purple-500/10 border border-purple-900/30 rounded-lg">
                <Lock className="w-4 h-4 text-purple-400 flex-shrink-0" />
                <span className="text-gray-400 text-xs">Pembayaran aman & terenkripsi via DOKU</span>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* ========== BOTTOM NAV — exact TradeWizardForm fixed bottom style ========== */}
      <div className="flex gap-3 pt-4 border-t border-purple-900/30 shrink-0">
        {currentStep === 2 && (
          <Button
            variant="outline"
            onClick={goBack}
            className="border-purple-900/30 flex-1 text-gray-300 hover:bg-purple-500/10 hover:text-white"
          >
            <ArrowLeft className="w-4 h-4 mr-1" />
            Kembali
          </Button>
        )}
        <Button
          onClick={currentStep === 1 ? goNext : handlePay}
          disabled={
            currentStep === 1
              ? !selectedPlan
              : isCreatingPayment || !selectedPaymentMethod
          }
          className={`flex-1 font-semibold ${
            currentStep === 1
              ? 'bg-gradient-to-r from-purple-500 to-violet-600 hover:from-purple-600 hover:to-violet-700 text-white disabled:opacity-30'
              : 'bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-600 hover:to-teal-700 text-white disabled:opacity-30'
          }`}
        >
          {currentStep === 1 ? (
            <>
              Lanjut
              <ArrowRight className="w-4 h-4 ml-1" />
            </>
          ) : isCreatingPayment ? (
            <>
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              Memproses...
            </>
          ) : (
            <>
              <Shield className="w-4 h-4 mr-1" />
              Bayar {formatRupiah(selectedPlan?.price)}
              <ArrowRight className="w-4 h-4 ml-1" />
            </>
          )}
        </Button>
      </div>

      {/* Trust badges */}
      <div className="flex items-center justify-center gap-4 pt-2">
        {[
          { icon: Shield, text: 'Aman' },
          { icon: Zap, text: 'Instan' },
          { icon: Star, text: '24/7' },
          { icon: Lock, text: 'Enkripsi' },
        ].map((b, i) => (
          <div key={i} className="flex items-center gap-1.5 text-gray-500">
            <b.icon className="w-3.5 h-3.5" />
            <span className="text-xs font-medium">{b.text}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

// ============================================
// Page
// ============================================
export default function UpgradePage() {
  const router = useRouter()

  return (
    <main className="min-h-screen bg-[#0a0712] flex items-center justify-center p-4">
      <div className="w-full max-w-lg space-y-4">
        {/* Header */}
        <div className="text-center">
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-purple-500/10 border border-purple-500/30 mb-3">
            <Crown className="w-4 h-4 text-purple-400" />
            <span className="text-xs text-purple-300 font-semibold tracking-wider">PREMIUM ACCESS</span>
          </div>
          <h1 className="text-xl font-bold text-white">
            Upgrade ke <span className="bg-gradient-to-r from-purple-400 to-violet-400 bg-clip-text text-transparent">Premium</span>
          </h1>
          <p className="text-gray-500 text-sm mt-1">Pilih paket dan metode pembayaran</p>
        </div>

        {/* Form Card */}
        <Card className="bg-[#0a0712] border-purple-900/30">
          <CardContent className="p-5">
            <UpgradeForm />
          </CardContent>
        </Card>

        {/* Back to dashboard */}
        <div className="text-center">
          <button onClick={() => router.push('/dashboard')} className="text-gray-500 text-xs hover:text-gray-300 transition-colors">
            ← Kembali ke Dashboard
          </button>
        </div>
      </div>
    </main>
  )
}
