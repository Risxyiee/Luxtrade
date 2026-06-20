'use client'

import React, { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useRouter } from 'next/navigation'
import {
  Crown, ArrowRight, ArrowLeft, AlertCircle, Loader2,
  CheckCircle, Tag, Sparkles, Shield, Zap, Star,
  CreditCard, Smartphone, QrCode, Building2, ChevronDown,
  Receipt, Gift, TrendingUp, Lock, Clock, Eye
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { supabase } from '@/lib/supabase'
import { Suspense } from 'react'

// ============================================
// Pricing Plans Configuration
// ============================================
const PLANS = [
  {
    id: 'pro-1m',
    plan: 'PRO',
    durationMonths: 1,
    label: '1 Bulan',
    price: 25000,
    popular: false,
    features: ['Semua fitur PRO', 'Analisis AI', 'Jurnal otomatis', 'Unlimited trades']
  },
  {
    id: 'pro-3m',
    plan: 'PRO',
    durationMonths: 3,
    label: '3 Bulan',
    price: 65000,
    popular: true,
    savings: '13%',
    features: ['Semua fitur PRO', 'Analisis AI', 'Jurnal otomatis', 'Unlimited trades', 'Priority support']
  },
  {
    id: 'pro-6m',
    plan: 'PRO',
    durationMonths: 6,
    label: '6 Bulan',
    price: 120000,
    popular: false,
    savings: '20%',
    features: ['Semua fitur PRO', 'Analisis AI', 'Jurnal otomatis', 'Unlimited trades', 'Priority support', 'Early access fitur baru']
  },
  {
    id: 'lifetime',
    plan: 'LIFETIME',
    durationMonths: 1200,
    label: 'Lifetime',
    price: 52000,
    popular: false,
    badge: 'PROMO',
    features: ['Semua fitur selamanya', 'Analisis AI', 'Jurnal otomatis', 'Unlimited trades', 'Priority support', 'Early access', 'Exclusive community']
  }
]

const PAYMENT_METHODS = [
  { id: 'va', label: 'Virtual Account', icon: Building2, desc: 'BCA, BNI, BRI, Mandiri' },
  { id: 'ewallet', label: 'E-Wallet', icon: Smartphone, desc: 'GoPay, OVO, DANA, ShopeePay' },
  { id: 'qris', label: 'QRIS', icon: QrCode, desc: 'Scan QR dari apps manapun' },
  { id: 'cc', label: 'Kartu Kredit', icon: CreditCard, desc: 'Visa, Mastercard' },
]

function formatRupiah(amount: number): string {
  return new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 }).format(amount)
}

// ============================================
// Upgrade Page Component
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
  const [selectedPlan, setSelectedPlan] = useState<any>(null)
  const [showPayment, setShowPayment] = useState(false)
  const [isCreatingPayment, setIsCreatingPayment] = useState(false)
  const [paymentData, setPaymentData] = useState<any>(null)

  useEffect(() => {
    const getUser = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        router.push('/auth/login?redirect=/upgrade')
        return
      }
      setUser(user)
    }
    getUser()
  }, [router])

  const validatePromoCode = async (code: string) => {
    if (!code.trim()) { setPromoValid(false); setPromoData(null); return }
    setIsValidating(true); setError('')
    try {
      const res = await fetch('/api/promo/validate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code: code.trim() })
      })
      const data = await res.json()
      if (data.valid) { setPromoValid(true); setPromoData(data.promoCode) }
      else { setPromoValid(false); setPromoData(null); setError(data.message || 'Kode promo tidak valid') }
    } catch (err: any) {
      setError(err.message || 'Gagal memvalidasi kode promo'); setPromoValid(false); setPromoData(null)
    } finally { setIsValidating(false) }
  }

  const handlePromoCodeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value.toUpperCase()
    setPromoCode(value); setError(''); setPromoValid(false); setPromoData(null)
    if (value.length >= 4) {
      const timeout = setTimeout(() => validatePromoCode(value), 500)
      return () => clearTimeout(timeout)
    }
  }

  const handleApplyPromo = async () => {
    if (!user) { router.push('/auth/login?redirect=/upgrade'); return }
    if (!promoCode.trim()) { setError('Silakan masukkan kode promo'); return }
    setIsApplying(true); setError(''); setSuccess(false)
    try {
      const res = await fetch('/api/promo/apply', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ promoCode: promoCode.trim(), plan: 'PRO' })
      })
      const data = await res.json()
      if (!res.ok || !data.success) { setError(data.details || data.message || data.error || 'Gagal menerapkan kode promo'); return }
      setSuccess(true); setPromoData(data.subscription)
      setTimeout(() => { window.location.href = '/dashboard' }, 2000)
    } catch (err: any) { setError(err.message || 'Gagal menerapkan kode promo') }
    finally { setIsApplying(false) }
  }

  const handleSelectPlan = (plan: any) => {
    setSelectedPlan(plan)
    setShowPayment(false)
    setPaymentData(null)
    setError('')
  }

  const handlePayWithDOKU = async () => {
    if (!selectedPlan || !user) return
    setIsCreatingPayment(true); setError('')
    try {
      const res = await fetch('/api/payment/create-order', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          amount: selectedPlan.price,
          plan: selectedPlan.plan,
          durationMonths: selectedPlan.durationMonths,
        })
      })
      const data = await res.json()
      if (data.success && data.paymentUrl) {
        // Redirect to DOKU payment page
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

  // Success state after promo
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
          <p className="text-emerald-400 font-medium mb-8">
            Akses PRO aktif selama {promoData?.durationMonths || 3} bulan
          </p>
          <motion.div animate={{ opacity: [0.5, 1, 0.5] }} transition={{ repeat: Infinity, duration: 1.5 }}
            className="text-white/40 text-sm">
            Mengalihkan ke dashboard...
          </motion.div>
        </div>
      </motion.div>
    )
  }

  // Payment confirmation page
  if (showPayment && selectedPlan) {
    return (
      <motion.div initial={{ opacity: 0, x: 50 }} animate={{ opacity: 1, x: 0 }} className="w-full max-w-lg">
        {/* Header */}
        <button onClick={() => { setShowPayment(false); setError('') }}
          className="flex items-center gap-2 text-white/50 hover:text-white/80 mb-6 transition-colors">
          <ArrowLeft className="w-4 h-4" />
          <span className="text-sm">Kembali ke pilihan paket</span>
        </button>

        {/* Invoice Card */}
        <div className="bg-white/[0.02] border border-white/[0.08] rounded-2xl overflow-hidden backdrop-blur-sm">
          {/* Invoice Header */}
          <div className="bg-gradient-to-r from-amber-500/10 via-purple-500/10 to-cyan-500/10 px-6 py-5 border-b border-white/[0.05]">
            <div className="flex items-center justify-between">
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <Receipt className="w-4 h-4 text-amber-400" />
                  <span className="text-xs font-semibold text-amber-400 uppercase tracking-wider">Invoice</span>
                </div>
                <h3 className="text-xl font-bold text-white">LuxTrade {selectedPlan.plan}</h3>
              </div>
              <Badge className={`px-3 py-1 text-xs font-bold ${selectedPlan.badge === 'PROMO' ? 'bg-amber-500/20 text-amber-400 border-amber-500/30' : 'bg-purple-500/20 text-purple-400 border-purple-500/30'}`}>
                {selectedPlan.label}
              </Badge>
            </div>
          </div>

          {/* Invoice Body */}
          <div className="p-6 space-y-4">
            {/* Order Summary */}
            <div className="space-y-3">
              <h4 className="text-xs font-semibold text-white/40 uppercase tracking-wider">Detail Pesanan</h4>
              <div className="flex justify-between items-center">
                <span className="text-white/70">Layanan</span>
                <span className="text-white font-medium">LuxTrade {selectedPlan.plan} Plan</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-white/70">Durasi</span>
                <span className="text-white font-medium">{selectedPlan.durationMonths >= 1200 ? 'Selamanya' : `${selectedPlan.label}`}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-white/70">Email</span>
                <span className="text-white/60 text-sm">{user?.email}</span>
              </div>
            </div>

            <div className="border-t border-white/[0.05] pt-4">
              <div className="flex justify-between items-center">
                <span className="text-white/50">Subtotal</span>
                <span className="text-white">{formatRupiah(selectedPlan.price)}</span>
              </div>
              {selectedPlan.savings && (
                <div className="flex justify-between items-center mt-2">
                  <span className="text-emerald-400 text-sm">Hemat ({selectedPlan.savings})</span>
                  <span className="text-emerald-400 text-sm">
                    -{formatRupiah(Math.floor(selectedPlan.price * parseInt(selectedPlan.savings) / 100))}
                  </span>
                </div>
              )}
            </div>

            {/* Total */}
            <div className="bg-gradient-to-r from-amber-500/10 to-orange-500/10 rounded-xl p-4 border border-amber-500/20">
              <div className="flex justify-between items-center">
                <span className="text-amber-300 font-semibold">Total Bayar</span>
                <span className="text-2xl font-extrabold text-white">{formatRupiah(selectedPlan.price)}</span>
              </div>
            </div>

            {/* Payment Methods */}
            <div className="space-y-3">
              <h4 className="text-xs font-semibold text-white/40 uppercase tracking-wider">Metode Pembayaran</h4>
              <div className="grid grid-cols-2 gap-2">
                {PAYMENT_METHODS.map((method) => (
                  <div key={method.id} className="flex items-center gap-3 p-3 rounded-xl bg-white/[0.03] border border-white/[0.06]">
                    <method.icon className="w-5 h-5 text-white/50" />
                    <div>
                      <p className="text-white text-xs font-medium">{method.label}</p>
                      <p className="text-white/30 text-[10px]">{method.desc}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Error */}
            {error && (
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}
                className="flex items-center gap-2 p-3 bg-red-500/10 border border-red-500/30 rounded-lg text-red-400 text-sm">
                <AlertCircle className="w-4 h-4 flex-shrink-0" />
                <span>{error}</span>
              </motion.div>
            )}

            {/* Pay Button */}
            <Button
              onClick={handlePayWithDOKU}
              disabled={isCreatingPayment}
              className="w-full h-14 bg-gradient-to-r from-amber-500 via-orange-500 to-amber-600 hover:from-amber-600 hover:via-orange-600 hover:to-amber-700 text-white font-bold text-lg shadow-xl shadow-amber-500/20 disabled:opacity-50"
            >
              {isCreatingPayment ? (
                <>
                  <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                  Membuat pembayaran...
                </>
              ) : (
                <>
                  <Shield className="w-5 h-5 mr-2" />
                  Bayar {formatRupiah(selectedPlan.price)}
                  <ArrowRight className="w-5 h-5 ml-2" />
                </>
              )}
            </Button>

            {/* Security Note */}
            <div className="flex items-center justify-center gap-2 text-white/30 text-xs">
              <Shield className="w-3 h-3" />
              <span>Pembayaran aman & terenkripsi via DOKU</span>
            </div>
          </div>
        </div>
      </motion.div>
    )
  }

  // Plan Selection Page
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5 }}
      className="w-full max-w-4xl"
    >
      {/* Header */}
      <div className="text-center mb-10">
        <motion.div initial={{ y: -20, opacity: 0 }} animate={{ y: 0, opacity: 1 }}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-amber-500/10 border border-amber-500/30 mb-6">
          <Crown className="w-4 h-4 text-amber-400" />
          <span className="text-sm text-amber-300 font-semibold">PREMIUM ACCESS</span>
        </motion.div>
        <h1 className="text-4xl sm:text-5xl font-extrabold text-white mb-4">
          Pilih Paket <span className="bg-gradient-to-r from-amber-400 to-orange-400 bg-clip-text text-transparent">Premium</span>
        </h1>
        <p className="text-white/40 text-lg max-w-xl mx-auto">
          Upgrade jurnal trading kamu dengan fitur AI, analisis mendalam, dan akses tanpa batas
        </p>
      </div>

      {/* Promo Code Section */}
      <div className="max-w-md mx-auto mb-10">
        {error && (
          <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }}
            className="flex items-start gap-2 p-3 mb-4 bg-red-500/10 border border-red-500/30 rounded-xl text-red-400 text-sm">
            <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
            <span>{error}</span>
          </motion.div>
        )}
        <div className="relative">
          <Tag className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-amber-400" />
          <Input
            type="text"
            placeholder="Masukkan kode promo (opsional)"
            value={promoCode}
            onChange={handlePromoCodeChange}
            disabled={isApplying}
            className="h-12 bg-white/[0.03] border-white/10 text-white placeholder:text-white/25 focus:border-amber-500/50 focus:ring-amber-500/20 pl-10 pr-10 uppercase"
          />
          {isValidating && <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 w-5 h-5 text-amber-400 animate-spin" />}
          {promoValid && <CheckCircle className="absolute right-3 top-1/2 -translate-y-1/2 w-5 h-5 text-emerald-400" />}
        </div>
        {promoValid && promoData && (
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
            className="mt-2 p-3 bg-emerald-500/10 border border-emerald-500/30 rounded-xl text-emerald-400 text-sm flex items-center gap-2">
            <Gift className="w-4 h-4 flex-shrink-0" />
            <span>Diskon {promoData.discountPercent}% — {promoData.description}</span>
          </motion.div>
        )}
        {promoValid && (
          <Button onClick={handleApplyPromo} disabled={isApplying || !promoCode.trim()}
            className="w-full h-11 mt-3 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold">
            {isApplying ? <Loader2 className="w-4 h-4 animate-spin" /> : <><Sparkles className="w-4 h-4 mr-2" /> Klaim Promo Gratis</>}
          </Button>
        )}
      </div>

      {/* Plans Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-8">
        {PLANS.map((plan, index) => (
          <motion.div
            key={plan.id}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: index * 0.1 }}
            onClick={() => handleSelectPlan(plan)}
            className={`relative cursor-pointer rounded-2xl p-6 border transition-all duration-300 group ${
              plan.popular
                ? 'bg-gradient-to-br from-amber-500/10 via-purple-500/5 to-cyan-500/10 border-amber-500/30 hover:border-amber-500/50 hover:shadow-[0_0_40px_rgba(251,191,36,0.15)]'
                : 'bg-white/[0.02] border-white/[0.06] hover:border-white/20 hover:bg-white/[0.04]'
            }`}
          >
            {plan.popular && (
              <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                <Badge className="bg-gradient-to-r from-amber-500 to-orange-500 text-white border-0 px-3 py-1 text-xs font-bold shadow-lg shadow-amber-500/30">
                  ⭐ POPULER
                </Badge>
              </div>
            )}
            {plan.badge === 'PROMO' && (
              <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                <Badge className="bg-gradient-to-r from-purple-500 to-pink-500 text-white border-0 px-3 py-1 text-xs font-bold shadow-lg shadow-purple-500/30">
                  🔥 PROMO
                </Badge>
              </div>
            )}

            <div className="flex items-start justify-between mb-4">
              <div>
                <p className={`text-xs font-semibold uppercase tracking-wider mb-1 ${plan.popular ? 'text-amber-400' : 'text-white/40'}`}>
                  {plan.plan}
                </p>
                <p className="text-white/60 text-sm">{plan.label}</p>
              </div>
              {plan.savings && (
                <Badge variant="outline" className="border-emerald-500/30 text-emerald-400 text-[10px] px-2 py-0.5">
                  Hemat {plan.savings}
                </Badge>
              )}
            </div>

            <div className="mb-4">
              <span className="text-3xl font-extrabold text-white">{formatRupiah(plan.price)}</span>
              <span className="text-white/30 text-sm ml-1">
                {plan.durationMonths >= 1200 ? '' : `/ ${plan.label}`}
              </span>
            </div>

            <div className="space-y-2">
              {plan.features.map((feature, i) => (
                <div key={i} className="flex items-center gap-2">
                  <CheckCircle className="w-3.5 h-3.5 text-emerald-400 flex-shrink-0" />
                  <span className="text-white/60 text-xs">{feature}</span>
                </div>
              ))}
            </div>

            <div className="mt-5 pt-4 border-t border-white/[0.05]">
              <div className={`w-full h-10 rounded-xl flex items-center justify-center gap-2 text-sm font-semibold transition-all ${
                plan.popular
                  ? 'bg-gradient-to-r from-amber-500 to-orange-500 text-white group-hover:shadow-lg group-hover:shadow-amber-500/20'
                  : 'bg-white/[0.05] text-white/70 group-hover:bg-white/10 group-hover:text-white'
              }`}>
                Pilih Paket
                <ArrowRight className="w-4 h-4" />
              </div>
            </div>
          </motion.div>
        ))}
      </div>

      {/* Trust Badges */}
      <div className="flex flex-wrap items-center justify-center gap-6 mb-8">
        {[
          { icon: Shield, text: 'Pembayaran Aman' },
          { icon: Zap, text: 'Aktivasi Instan' },
          { icon: Star, text: 'Support 24/7' },
          { icon: Lock, text: 'Data Terenkripsi' },
        ].map((badge, i) => (
          <div key={i} className="flex items-center gap-2 text-white/30">
            <badge.icon className="w-4 h-4" />
            <span className="text-xs">{badge.text}</span>
          </div>
        ))}
      </div>

      {/* Back Link */}
      <div className="text-center">
        <button onClick={() => router.push('/dashboard')}
          className="text-white/30 text-sm hover:text-white/50 transition-colors">
          ← Kembali ke Dashboard
        </button>
      </div>
    </motion.div>
  )
}

// ============================================
// Loading State
// ============================================
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

// ============================================
// Main Page
// ============================================
export default function UpgradePage() {
  return (
    <div className="min-h-screen bg-[#0a0612] flex items-center justify-center p-4">
      <div className="fixed inset-0 -z-10">
        <div className="absolute inset-0 bg-gradient-to-b from-[#0a0612] via-[#110a1f] to-[#0a0612]" />
        <div className="absolute top-0 left-1/4 w-[600px] h-[600px] bg-amber-500/5 rounded-full blur-[150px]" />
        <div className="absolute bottom-1/4 right-1/4 w-[400px] h-[400px] bg-purple-500/10 rounded-full blur-[100px]" />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] bg-cyan-500/3 rounded-full blur-[200px]" />
      </div>

      <Suspense fallback={<UpgradeLoading />}>
        <UpgradeForm />
      </Suspense>
    </div>
  )
}
