'use client'

import React, { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  X, Crown, ArrowRight, ArrowLeft, CheckCircle,
  ShieldCheck, Sparkles, Loader2, Calendar, Zap, Gem,
  Lock, ChevronRight, Mail, Eye, EyeOff, AlertCircle, User
} from 'lucide-react'
import { formatRupiah, type PricingPlan } from '@/lib/pricing'
import { supabase } from '@/lib/supabase'
import { toast } from 'sonner'

interface LandingCheckoutModalProps {
  isOpen: boolean
  onClose: () => void
  promoCode: string
  promoActive: boolean | null
  language?: 'id' | 'en'
}

const PLANS = [
  {
    key: 'PRO_30_DAYS' as PricingPlan,
    label: 'Elite Pro', labelEn: 'Elite Pro',
    price: 39000, duration: '1 Bulan', durationEn: '1 Month',
    icon: <Zap className="w-5 h-5" />,
  },
  {
    key: 'PRO_ANNUAL' as PricingPlan,
    label: 'Pro Annual', labelEn: 'Pro Annual',
    price: 390000, duration: '1 Tahun', durationEn: '1 Year',
    icon: <Calendar className="w-5 h-5" />,
    badge: 'Hemat 2 Bulan', badgeEn: 'Save 2 Months',
  },
  {
    key: 'PRO_LIFETIME' as PricingPlan,
    label: 'Lifetime Ultra', labelEn: 'Lifetime Ultra',
    price: 299000, duration: 'Selamanya', durationEn: 'Forever',
    icon: <Gem className="w-5 h-5" />,
    badge: '30 Slot Saja', badgeEn: 'Only 30 Slots',
  },
]

function generateDeviceId(): string {
  if (typeof window === 'undefined') return ''
  try {
    const canvas = document.createElement('canvas')
    const ctx = canvas.getContext('2d')
    let fp = ''
    if (ctx) { ctx.textBaseline = 'top'; ctx.font = '14px Arial'; ctx.fillText('fp', 2, 2); fp += canvas.toDataURL().slice(-50) }
    fp += `${screen.width}x${screen.height}x${screen.colorDepth}`
    fp += Intl.DateTimeFormat().resolvedOptions().timeZone + navigator.language + navigator.platform
    let hash = 0
    for (let i = 0; i < fp.length; i++) { hash = ((hash << 5) - hash) + fp.charCodeAt(i); hash = hash & hash }
    return `DEV${Math.abs(hash).toString(36).toUpperCase()}`
  } catch { return `DEV${Date.now().toString(36).toUpperCase()}` }
}

export default function LandingCheckoutModal({
  isOpen,
  onClose,
  promoCode,
  promoActive,
  language = 'id',
}: LandingCheckoutModalProps) {
  const isEn = language === 'en'

  // Steps: 'auth' → 'plan' → 'confirm' → 'paying' → 'success'
  const [step, setStep] = useState<'auth' | 'plan' | 'confirm' | 'paying' | 'success'>('auth')
  const [authMode, setAuthMode] = useState<'login' | 'signup'>('login')
  const [isLoggedIn, setIsLoggedIn] = useState(false)

  // Auth fields
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [fullName, setFullName] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [authLoading, setAuthLoading] = useState(false)
  const [authError, setAuthError] = useState('')

  // Unverified user (just signed up, no session yet)
  const [unverifiedUserId, setUnverifiedUserId] = useState<string | null>(null)
  const [unverifiedEmail, setUnverifiedEmail] = useState('')
  const [unverifiedName, setUnverifiedName] = useState('')

  // Plan
  const [selectedPlan, setSelectedPlan] = useState<PricingPlan>('PRO_30_DAYS')
  const [localPromo, setLocalPromo] = useState('')
  const [promoApplied, setPromoApplied] = useState(false)
  const [promoError, setPromoError] = useState(false)

  // Payment
  const [snapLoaded, setSnapLoaded] = useState(false)
  const [snapLoading, setSnapLoading] = useState(false)

  const selectedPlanInfo = PLANS.find(p => p.key === selectedPlan)!
  const isPromoPlan = selectedPlan === 'PRO_30_DAYS' && promoApplied
  const finalPrice = isPromoPlan ? 25000 : selectedPlanInfo.price

  // ── Reset when modal opens ─────────────────────
  useEffect(() => {
    if (!isOpen) return
    setStep('auth')
    setAuthMode('login')
    setIsLoggedIn(false)
    setEmail(''); setPassword(''); setFullName('')
    setShowPassword(false); setAuthLoading(false); setAuthError('')
    setUnverifiedUserId(null); setUnverifiedEmail(''); setUnverifiedName('')
    setSelectedPlan('PRO_30_DAYS')
    setLocalPromo(''); setPromoApplied(false); setPromoError(false)

    // Check if already logged in
    if (supabase) {
      supabase.auth.getSession().then(({ data: { session } }) => {
        if (session?.user) {
          setIsLoggedIn(true)
          setStep('plan')
        }
      })
    }
  }, [isOpen])

  // ── Prevent body scroll ─────────────────────────
  useEffect(() => {
    if (isOpen) document.body.style.overflow = 'hidden'
    else document.body.style.overflow = ''
    return () => { document.body.style.overflow = '' }
  }, [isOpen])

  // ── Load Snap.js when modal opens ───────────────
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

  // ── ESC key close ───────────────────────────────
  useEffect(() => {
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && step !== 'paying') onClose()
    }
    window.addEventListener('keydown', handleEsc)
    return () => window.removeEventListener('keydown', handleEsc)
  }, [onClose, step])

  // ── Auth handlers ───────────────────────────────
  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setAuthError('')
    if (!email || !password) { setAuthError(isEn ? 'Email and password are required' : 'Email dan password harus diisi'); return }
    setAuthLoading(true)
    try {
      if (!supabase) { setAuthError(isEn ? 'Service unavailable' : 'Layanan tidak tersedia'); setAuthLoading(false); return }
      const { data, error: signInError } = await supabase.auth.signInWithPassword({ email, password })
      if (signInError) {
        const msg = (signInError.message || '').toLowerCase()
        if (msg.includes('too many requests') || msg.includes('rate limit')) setAuthError(isEn ? 'Too many attempts. Wait a few minutes.' : 'Terlalu banyak percobaan. Tunggu beberapa menit.')
        else if (msg.includes('email not confirmed')) setAuthError(isEn ? 'Email not verified. Check your inbox/spam.' : 'Email belum diverifikasi. Cek inbox/spam kamu.')
        else setAuthError(isEn ? 'Wrong email or password.' : 'Email atau password salah.')
        setAuthLoading(false)
        return
      }
      if (data.session) {
        try {
          await fetch('/api/auth/sync-user', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              userId: data.user.id,
              email: data.user.email,
              fullName: data.user.user_metadata?.display_name || data.user.user_metadata?.name || email.split('@')[0]
            })
          })
        } catch { /* non-critical */ }
        setIsLoggedIn(true)
        setStep('plan')
      }
    } catch {
      setAuthError(isEn ? 'Connection problem. Check your internet.' : 'Koneksi bermasalah. Cek internet kamu.')
    } finally { setAuthLoading(false) }
  }

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault()
    setAuthError('')
    const hasMin = password.length >= 8
    const hasUpper = /[A-Z]/.test(password)
    const hasLower = /[a-z]/.test(password)
    const hasNum = /[0-9]/.test(password)
    if (!hasMin || !hasUpper || !hasLower || !hasNum) {
      setAuthError(isEn ? 'Password: min 8 chars, uppercase, lowercase, and number' : 'Password: min 8 karakter, huruf besar, kecil, dan angka')
      return
    }
    setAuthLoading(true)
    try {
      const res = await fetch('/api/auth/signup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email, password,
          fullName: fullName || email.split('@')[0],
          deviceId: generateDeviceId() || null
        })
      })
      const data = await res.json()
      if (!res.ok) { setAuthError(data.error || (isEn ? 'Failed to create account' : 'Gagal membuat akun')); setAuthLoading(false); return }
      if (data.user?.id) {
        setUnverifiedUserId(data.user.id)
        setUnverifiedEmail(email)
        setUnverifiedName(fullName || email.split('@')[0])
      }
      // Go to plan selection — webhook will auto-verify email + activate PRO after payment
      setStep('plan')
    } catch {
      setAuthError(isEn ? 'Connection problem. Check your internet.' : 'Koneksi bermasalah. Cek internet kamu.')
    } finally { setAuthLoading(false) }
  }

  // ── Promo ───────────────────────────────────────
  const applyPromo = () => {
    if (localPromo.trim().toUpperCase() === promoCode && promoActive) {
      setPromoApplied(true); setPromoError(false)
    } else if (localPromo.trim().toUpperCase() === 'TRADERCEPAT') {
      setPromoApplied(true); setPromoError(false)
    } else {
      setPromoApplied(false); setPromoError(true)
    }
  }

  // ── Pay ─────────────────────────────────────────
  const handlePay = async () => {
    if (!snapLoaded) { toast.error(isEn ? 'Payment gateway is loading...' : 'Payment gateway sedang dimuat...'); return }
    setStep('paying')
    try {
      let res: Response
      let data: any

      if (unverifiedUserId) {
        res = await fetch('/api/midtrans/create-transaction-unverified', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            userId: unverifiedUserId,
            email: unverifiedEmail,
            fullName: unverifiedName,
            plan: selectedPlan,
          }),
        })
        data = await res.json()
      } else {
        const body: Record<string, string> = { plan: selectedPlan }
        if (promoApplied && selectedPlan === 'PRO_30_DAYS') {
          body.promoCode = localPromo.trim().toUpperCase() || 'TRADERCEPAT'
        }
        res = await fetch('/api/midtrans/create-transaction', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        })
        data = await res.json()
      }

      if (!res.ok) {
        toast.error(data.error || (isEn ? 'Failed to create transaction' : 'Gagal membuat transaksi'))
        setStep('confirm')
        return
      }

      ;(window as any).snap.pay(data.token, {
        onSuccess: () => {
          toast.success(isEn ? 'Payment successful! PRO is being activated...' : 'Pembayaran berhasil! Akun PRO sedang diaktivasi...')
          setStep('success')
        },
        onPending: () => {
          toast.info(isEn ? 'Waiting for payment. PRO will auto-activate.' : 'Menunggu pembayaran. PRO akan aktif otomatis.')
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

  // ── Step labels ─────────────────────────────────
  const allSteps = [
    { key: 'auth', label: isEn ? 'Account' : 'Akun' },
    { key: 'plan', label: isEn ? 'Plan' : 'Paket' },
    { key: 'confirm', label: isEn ? 'Pay' : 'Bayar' },
    { key: 'success', label: isEn ? 'Done' : 'Selesai' },
  ]
  const stepKeys = ['auth', 'plan', 'confirm', 'paying', 'success'] as const
  const currentIdx = stepKeys.indexOf(step)
  const visibleIdx = step === 'paying' ? 2 : currentIdx

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
        className="relative w-full max-w-md bg-[#0a0a1a] border border-white/10 rounded-2xl shadow-2xl shadow-blue-500/10 overflow-hidden"
      >
        {/* Close */}
        {step !== 'paying' && (
          <button onClick={onClose} className="absolute top-4 right-4 z-10 w-8 h-8 flex items-center justify-center rounded-lg bg-white/5 hover:bg-white/10 transition-colors text-white/50 hover:text-white/80 cursor-pointer">
            <X className="w-4 h-4" />
          </button>
        )}

        {/* Progress Steps */}
        <div className="px-6 pt-5 pb-3">
          <div className="flex items-center justify-center gap-2">
            {allSteps.map((s, i) => (
              <React.Fragment key={s.key}>
                <div className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-medium transition-all ${
                  step === s.key || (s.key === 'confirm' && step === 'paying')
                    ? 'bg-blue-500/20 text-blue-300 border border-blue-500/30'
                    : visibleIdx > i
                    ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/20'
                    : 'bg-white/5 text-white/30 border border-white/10'
                }`}>
                  {visibleIdx > i
                    ? <CheckCircle className="w-3 h-3" />
                    : <span className="w-3 h-3 rounded-full border-current border-[1.5px] flex items-center justify-center text-[8px]">{i + 1}</span>
                  }
                  <span className="hidden sm:inline">{s.label}</span>
                </div>
                {i < 3 && (
                  <div className={`h-px w-3 sm:w-6 transition-colors ${visibleIdx > i ? 'bg-emerald-500/40' : 'bg-white/10'}`} />
                )}
              </React.Fragment>
            ))}
          </div>
        </div>

        {/* Content */}
        <div className="px-6 pb-6 min-h-[360px] overflow-y-auto max-h-[75vh]">
          <AnimatePresence mode="wait">

            {/* ═══════════ STEP 1: AUTH ═══════════ */}
            {step === 'auth' && (
              <motion.div key="auth" initial={{ opacity: 0, x: 30 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -30 }} transition={{ duration: 0.25 }}>
                <div className="text-center mb-5 pt-1">
                  <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-blue-500/20 to-cyan-500/20 border border-blue-500/20 flex items-center justify-center mx-auto mb-3">
                    <Lock className="w-6 h-6 text-blue-400" />
                  </div>
                  <h3 className="text-lg font-bold text-white mb-1">
                    {isEn ? 'Get Started' : 'Mulai Dulu'}
                  </h3>
                  <p className="text-white/40 text-xs">
                    {isEn ? 'Login or create an account to continue' : 'Login atau buat akun untuk lanjut'}
                  </p>
                </div>

                {/* Mode Toggle */}
                <div className="flex bg-white/5 rounded-xl p-1 mb-4">
                  <button
                    onClick={() => { setAuthMode('login'); setAuthError('') }}
                    className={`flex-1 py-2 rounded-lg text-xs font-medium transition-all cursor-pointer ${authMode === 'login' ? 'bg-blue-500/20 text-blue-300 shadow' : 'text-white/40 hover:text-white/60'}`}
                  >
                    {isEn ? 'Already Have Account' : 'Sudah Punya Akun'}
                  </button>
                  <button
                    onClick={() => { setAuthMode('signup'); setAuthError('') }}
                    className={`flex-1 py-2 rounded-lg text-xs font-medium transition-all cursor-pointer ${authMode === 'signup' ? 'bg-blue-500/20 text-blue-300 shadow' : 'text-white/40 hover:text-white/60'}`}
                  >
                    {isEn ? 'Register New' : 'Daftar Baru'}
                  </button>
                </div>

                {authError && (
                  <motion.div initial={{ opacity: 0, y: -5 }} animate={{ opacity: 1, y: 0 }} className="flex items-start gap-2 p-3 bg-red-500/10 border border-red-500/30 rounded-lg text-red-400 text-xs mb-4">
                    <AlertCircle className="w-3.5 h-3.5 mt-0.5 flex-shrink-0" />
                    <span>{authError}</span>
                  </motion.div>
                )}

                {authMode === 'login' ? (
                  <form onSubmit={handleLogin} className="space-y-3">
                    <div>
                      <label className="text-white/50 text-xs mb-1 block">Email</label>
                      <div className="relative">
                        <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/25" />
                        <input
                          type="email" value={email} onChange={e => setEmail(e.target.value)}
                          placeholder="kamu@email.com" required
                          className="w-full bg-white/5 border border-white/10 rounded-xl pl-10 pr-3 py-2.5 text-sm focus:outline-none focus:border-blue-400/50 transition-colors text-white placeholder:text-white/20"
                        />
                      </div>
                    </div>
                    <div>
                      <label className="text-white/50 text-xs mb-1 block">Password</label>
                      <div className="relative">
                        <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/25" />
                        <input
                          type={showPassword ? 'text' : 'password'} value={password} onChange={e => setPassword(e.target.value)}
                          placeholder={isEn ? 'Enter password' : 'Masukkan password'} required
                          className="w-full bg-white/5 border border-white/10 rounded-xl pl-10 pr-10 py-2.5 text-sm focus:outline-none focus:border-blue-400/50 transition-colors text-white placeholder:text-white/20"
                        />
                        <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-3 top-1/2 -translate-y-1/2 text-white/25 hover:text-white/50 cursor-pointer">
                          {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                        </button>
                      </div>
                    </div>
                    <button
                      type="submit" disabled={authLoading}
                      className="w-full py-3 bg-gradient-to-r from-blue-500 to-blue-600 hover:from-blue-400 hover:to-blue-500 text-white font-semibold text-sm shadow-lg shadow-blue-500/20 rounded-xl flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
                    >
                      {authLoading
                        ? <><Loader2 className="w-4 h-4 animate-spin" /> {isEn ? 'Logging in...' : 'Login...'}</>
                        : <>{isEn ? 'Login & Continue' : 'Login & Lanjut'} <ArrowRight className="w-4 h-4" /></>
                      }
                    </button>
                  </form>
                ) : (
                  <form onSubmit={handleSignup} className="space-y-3">
                    <div>
                      <label className="text-white/50 text-xs mb-1 block">{isEn ? 'Full Name' : 'Nama Lengkap'}</label>
                      <div className="relative">
                        <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/25" />
                        <input
                          type="text" value={fullName} onChange={e => setFullName(e.target.value)}
                          placeholder={isEn ? 'Your name' : 'Nama kamu'}
                          className="w-full bg-white/5 border border-white/10 rounded-xl pl-10 pr-3 py-2.5 text-sm focus:outline-none focus:border-blue-400/50 transition-colors text-white placeholder:text-white/20"
                        />
                      </div>
                    </div>
                    <div>
                      <label className="text-white/50 text-xs mb-1 block">Email</label>
                      <div className="relative">
                        <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/25" />
                        <input
                          type="email" value={email} onChange={e => setEmail(e.target.value)}
                          placeholder="kamu@email.com" required
                          className="w-full bg-white/5 border border-white/10 rounded-xl pl-10 pr-3 py-2.5 text-sm focus:outline-none focus:border-blue-400/50 transition-colors text-white placeholder:text-white/20"
                        />
                      </div>
                    </div>
                    <div>
                      <label className="text-white/50 text-xs mb-1 block">Password</label>
                      <div className="relative">
                        <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/25" />
                        <input
                          type={showPassword ? 'text' : 'password'} value={password} onChange={e => setPassword(e.target.value)}
                          placeholder={isEn ? 'Min 8 chars, A-Z, a-z, 0-9' : 'Min 8 karakter, A-Z, a-z, 0-9'} required
                          className="w-full bg-white/5 border border-white/10 rounded-xl pl-10 pr-10 py-2.5 text-sm focus:outline-none focus:border-blue-400/50 transition-colors text-white placeholder:text-white/20"
                        />
                        <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-3 top-1/2 -translate-y-1/2 text-white/25 hover:text-white/50 cursor-pointer">
                          {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                        </button>
                      </div>
                      {/* Password strength bars */}
                      <div className="flex gap-1 mt-2">
                        {[password.length >= 8, /[A-Z]/.test(password), /[a-z]/.test(password), /[0-9]/.test(password)].map((ok, i) => (
                          <div key={i} className={`flex-1 h-1 rounded-full transition-colors ${ok ? 'bg-emerald-500' : 'bg-white/10'}`} />
                        ))}
                      </div>
                    </div>
                    <button
                      type="submit" disabled={authLoading}
                      className="w-full py-3 bg-gradient-to-r from-blue-500 to-blue-600 hover:from-blue-400 hover:to-blue-500 text-white font-semibold text-sm shadow-lg shadow-blue-500/20 rounded-xl flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
                    >
                      {authLoading
                        ? <><Loader2 className="w-4 h-4 animate-spin" /> {isEn ? 'Creating account...' : 'Mendaftar...'}</>
                        : <>{isEn ? 'Register & Continue' : 'Daftar & Lanjut'} <ArrowRight className="w-4 h-4" /></>
                      }
                    </button>
                  </form>
                )}
              </motion.div>
            )}

            {/* ═══════════ STEP 2: SELECT PLAN ═══════════ */}
            {step === 'plan' && (
              <motion.div key="plan" initial={{ opacity: 0, x: 30 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -30 }} transition={{ duration: 0.25 }}>
                <div className="text-center mb-5 pt-1">
                  <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-amber-500/20 to-orange-500/20 border border-amber-500/20 flex items-center justify-center mx-auto mb-3">
                    <Crown className="w-6 h-6 text-amber-400" />
                  </div>
                  <h3 className="text-lg font-bold text-white mb-1">
                    {isEn ? 'Choose Your Plan' : 'Pilih Paket Kamu'}
                  </h3>
                  <p className="text-white/40 text-xs">
                    {isEn ? 'Select the plan that fits your trading' : 'Pilih paket yang cocok untuk trading kamu'}
                  </p>
                </div>

                <div className="space-y-2.5 mb-4">
                  {PLANS.map((plan) => {
                    const isSelected = selectedPlan === plan.key
                    const showPromoPrice = plan.key === 'PRO_30_DAYS' && promoApplied
                    return (
                      <button
                        key={plan.key}
                        onClick={() => { setSelectedPlan(plan.key); if (plan.key !== 'PRO_30_DAYS') { setPromoApplied(false); setLocalPromo('') } }}
                        className={`w-full text-left p-3.5 rounded-xl border transition-all cursor-pointer ${
                          isSelected
                            ? 'bg-blue-500/10 border-blue-500/40 shadow-lg shadow-blue-500/5'
                            : 'bg-white/[0.02] border-white/5 hover:border-white/15 hover:bg-white/[0.04]'
                        }`}
                      >
                        <div className="flex items-center gap-3">
                          <div className={`w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0 ${
                            isSelected ? 'bg-blue-500/20 text-blue-400' : 'bg-white/5 text-white/30'
                          }`}>
                            {isSelected ? <Crown className="w-4 h-4" /> : plan.icon}
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                              <span className={`font-semibold text-sm ${isSelected ? 'text-blue-300' : 'text-white/80'}`}>{isEn ? plan.labelEn : plan.label}</span>
                              {plan.badge && (
                                <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-amber-500/15 text-amber-400 border border-amber-500/20">
                                  {isEn ? plan.badgeEn : plan.badge}
                                </span>
                              )}
                            </div>
                            <p className="text-white/30 text-[11px] mt-0.5">{isEn ? plan.durationEn : plan.duration}</p>
                          </div>
                          <div className="text-right flex-shrink-0">
                            {showPromoPrice && <span className="text-[11px] text-white/20 line-through block">{formatRupiah(plan.price)}</span>}
                            <span className={`font-bold text-sm ${isSelected ? 'text-blue-300' : 'text-white/70'}`}>{formatRupiah(showPromoPrice ? 25000 : plan.price)}</span>
                          </div>
                          <ChevronRight className={`w-4 h-4 flex-shrink-0 transition-colors ${isSelected ? 'text-blue-400' : 'text-white/15'}`} />
                        </div>
                      </button>
                    )
                  })}
                </div>

                {/* Promo (only for PRO_30_DAYS) */}
                {selectedPlan === 'PRO_30_DAYS' && (
                  <div className="mb-4 p-3 rounded-xl bg-white/[0.02] border border-white/5">
                    <p className="text-[11px] text-white/40 mb-2 font-medium">{isEn ? 'Have a promo code?' : 'Punya kode promo?'}</p>
                    <div className="flex gap-2">
                      <input
                        type="text" value={localPromo} onChange={e => { setLocalPromo(e.target.value); setPromoError(false); if (promoApplied) setPromoApplied(false) }}
                        placeholder={isEn ? 'Enter code' : 'Masukkan kode'}
                        className="flex-1 bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-xs focus:outline-none focus:border-cyan-400 transition-colors font-mono text-white placeholder:text-white/20"
                        onKeyDown={e => e.key === 'Enter' && applyPromo()}
                      />
                      <button onClick={applyPromo} disabled={promoApplied} className="px-3 py-2 bg-white/10 rounded-lg text-xs hover:bg-white/20 transition-colors font-medium text-white/70 disabled:opacity-40 cursor-pointer">
                        {promoApplied ? '✓' : (isEn ? 'Apply' : 'Terapkan')}
                      </button>
                    </div>
                    {promoError && <p className="mt-1.5 text-[11px] text-red-400/80 font-mono">{isEn ? 'Invalid or expired code.' : 'Kode tidak valid atau kedaluwarsa.'}</p>}
                    {promoApplied && <p className="mt-1.5 text-[11px] text-emerald-400 font-mono flex items-center gap-1"><CheckCircle className="w-3 h-3" /> {isEn ? 'Promo applied!' : 'Promo terpakai!'}</p>}
                  </div>
                )}

                <div className="flex gap-2">
                  <button onClick={() => setStep('auth')} className="flex-shrink-0 py-3 px-4 border border-white/10 rounded-xl hover:bg-white/5 transition-all text-xs font-medium text-white/50 flex items-center gap-1.5 cursor-pointer">
                    <ArrowLeft className="w-3.5 h-3.5" /> {isEn ? 'Back' : 'Kembali'}
                  </button>
                  <button onClick={() => setStep('confirm')} className="flex-1 py-3 bg-gradient-to-r from-blue-500 to-cyan-400 rounded-xl hover:opacity-90 transition-all text-sm font-semibold text-white glow-bg-luxury flex items-center justify-center gap-2 cursor-pointer">
                    {isEn ? 'Continue to Payment' : 'Lanjut ke Pembayaran'} <ArrowRight className="w-4 h-4" />
                  </button>
                </div>
              </motion.div>
            )}

            {/* ═══════════ STEP 3: CONFIRM & PAY ═══════════ */}
            {step === 'confirm' && (
              <motion.div key="confirm" initial={{ opacity: 0, x: 30 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -30 }} transition={{ duration: 0.25 }}>
                <div className="text-center mb-5 pt-1">
                  <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-blue-500/20 to-cyan-500/20 border border-blue-500/20 flex items-center justify-center mx-auto mb-3">
                    <Crown className="w-6 h-6 text-amber-400" />
                  </div>
                  <h3 className="text-lg font-bold text-white mb-1">{isEn ? 'Order Summary' : 'Ringkasan Pesanan'}</h3>
                  <p className="text-white/40 text-xs">{isEn ? 'Review before paying' : 'Periksa sebelum membayar'}</p>
                </div>

                {/* Order Card */}
                <div className="bg-white/[0.03] border border-white/[0.06] rounded-xl p-4 mb-4">
                  <div className="flex items-start justify-between mb-3">
                    <div>
                      <div className="flex items-center gap-2 mb-0.5">
                        <span className="text-white font-semibold text-sm">{isEn ? selectedPlanInfo.labelEn : selectedPlanInfo.label}</span>
                        {selectedPlanInfo.badge && (
                          <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-amber-500/15 text-amber-400 border border-amber-500/20">
                            {isEn ? selectedPlanInfo.badgeEn! : selectedPlanInfo.badge}
                          </span>
                        )}
                      </div>
                      <p className="text-white/40 text-xs">{isEn ? selectedPlanInfo.durationEn : selectedPlanInfo.duration}</p>
                    </div>
                    <button onClick={() => setStep('plan')} className="text-[11px] text-blue-400 hover:text-blue-300 transition-colors cursor-pointer">{isEn ? 'Change' : 'Ubah'}</button>
                  </div>

                  {/* Features */}
                  <div className="border-t border-white/5 pt-3 mb-3">
                    <ul className="space-y-1.5">
                      <li className="flex items-center gap-2 text-[11px] text-white/50"><CheckCircle className="w-3 h-3 text-emerald-400/70" />{isEn ? 'Unlimited Trade Entries' : 'Unlimited Trade Entries'}</li>
                      <li className="flex items-center gap-2 text-[11px] text-white/50"><CheckCircle className="w-3 h-3 text-emerald-400/70" />{isEn ? 'Advanced Analytics & Equity Curve' : 'Analitik Lanjutan & Equity Curve'}</li>
                      <li className="flex items-center gap-2 text-[11px] text-white/50"><CheckCircle className="w-3 h-3 text-emerald-400/70" />{isEn ? 'AI Auto Extract MT5/TradingView' : 'AI Auto Extract MT5/TradingView'}</li>
                      <li className="flex items-center gap-2 text-[11px] text-white/50"><CheckCircle className="w-3 h-3 text-emerald-400/70" />{isEn ? 'AI Pattern Detection & Guard' : 'AI Pattern Detection & Guard'}</li>
                    </ul>
                  </div>

                  {/* Price */}
                  <div className="border-t border-white/5 pt-3">
                    {isPromoPlan && <div className="flex justify-between items-center mb-1"><span className="text-[11px] text-white/30">{isEn ? 'Original' : 'Normal'}</span><span className="text-xs text-white/30 line-through">{formatRupiah(selectedPlanInfo.price)}</span></div>}
                    {isPromoPlan && <div className="flex justify-between items-center mb-1"><span className="text-[11px] text-emerald-400/70">{isEn ? 'Promo Discount' : 'Diskon Promo'}</span><span className="text-xs text-emerald-400/70">-{formatRupiah(selectedPlanInfo.price - 25000)}</span></div>}
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-white/60 font-medium">Total</span>
                      <span className="text-2xl font-bold bg-gradient-to-r from-blue-300 to-cyan-300 bg-clip-text text-transparent">{formatRupiah(finalPrice)}</span>
                    </div>
                  </div>
                </div>

                <div className="flex gap-2">
                  <button onClick={() => setStep('plan')} className="py-3 px-4 border border-white/10 rounded-xl hover:bg-white/5 transition-all text-xs font-medium text-white/50 flex items-center gap-1.5 cursor-pointer">
                    <ArrowLeft className="w-3.5 h-3.5" /> {isEn ? 'Back' : 'Kembali'}
                  </button>
                  <button onClick={handlePay} disabled={!snapLoaded} className="flex-1 py-3 bg-gradient-to-r from-blue-500 to-cyan-400 rounded-xl hover:opacity-90 transition-all text-sm font-semibold text-white glow-bg-luxury flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50">
                    {!snapLoaded || snapLoading
                      ? <><Loader2 className="w-4 h-4 animate-spin" /> {isEn ? 'Loading...' : 'Memuat...'}</>
                      : <><Sparkles className="w-4 h-4" /> {isEn ? `Pay ${formatRupiah(finalPrice)}` : `Bayar ${formatRupiah(finalPrice)}`}</>
                    }
                  </button>
                </div>

                <p className="text-center text-[10px] text-white/20 mt-3 flex items-center justify-center gap-1.5">
                  <ShieldCheck className="w-3 h-3" /> {isEn ? 'Secure payment via Midtrans' : 'Pembayaran aman via Midtrans'}
                </p>
              </motion.div>
            )}

            {/* ═══════════ PAYING (loading) ═══════════ */}
            {step === 'paying' && (
              <motion.div key="paying" initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }} className="flex flex-col items-center justify-center py-16 text-center">
                <div className="w-16 h-16 rounded-2xl bg-blue-500/10 border border-blue-500/20 flex items-center justify-center mb-4">
                  <Loader2 className="w-8 h-8 text-blue-400 animate-spin" />
                </div>
                <h3 className="text-lg font-bold text-white mb-1">{isEn ? 'Opening Payment...' : 'Membuka Pembayaran...'}</h3>
                <p className="text-white/40 text-xs">{isEn ? 'Midtrans popup will appear' : 'Popup pembayaran Midtrans akan muncul'}</p>
              </motion.div>
            )}

            {/* ═══════════ STEP 4: SUCCESS ═══════════ */}
            {step === 'success' && (
              <motion.div key="success" initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }} className="flex flex-col items-center justify-center py-10 text-center">
                <motion.div
                  initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ type: 'spring', delay: 0.1, stiffness: 200 }}
                  className="w-16 h-16 rounded-full bg-emerald-500/15 border border-emerald-500/25 flex items-center justify-center mb-4"
                >
                  <CheckCircle className="w-8 h-8 text-emerald-400" />
                </motion.div>
                <h3 className="text-xl font-bold text-white mb-2">{isEn ? 'Thank You! 🎉' : 'Terima Kasih! 🎉'}</h3>
                <p className="text-white/50 text-xs mb-1 max-w-xs">
                  {isEn
                    ? 'Payment is being processed. PRO will activate automatically once confirmed.'
                    : 'Pembayaran sedang diproses. PRO akan aktif otomatis setelah dikonfirmasi.'}
                </p>
                {unverifiedUserId && (
                  <p className="text-white/30 text-[11px] mb-4">
                    {isEn
                      ? 'Your email will be verified automatically after payment.'
                      : 'Email kamu akan otomatis terverifikasi setelah pembayaran.'}
                  </p>
                )}
                {!unverifiedUserId && (
                  <p className="text-white/30 text-[11px] mb-4">
                    {isEn ? 'Redirecting to dashboard...' : 'Mengarahkan ke dashboard...'}
                  </p>
                )}

                <div className="w-full space-y-2">
                  <button
                    onClick={() => { onClose(); window.location.href = '/dashboard' }}
                    className="w-full py-3 bg-gradient-to-r from-emerald-500 to-teal-500 rounded-xl hover:opacity-90 transition-all text-sm font-semibold text-white flex items-center justify-center gap-2 cursor-pointer"
                  >
                    <Sparkles className="w-4 h-4" />
                    {unverifiedUserId ? (isEn ? 'Login to Dashboard' : 'Login ke Dashboard') : (isEn ? 'Go to Dashboard' : 'Ke Dashboard')}
                  </button>
                  <button onClick={onClose} className="w-full py-2.5 border border-white/10 rounded-xl hover:bg-white/5 transition-all text-xs font-medium text-white/40 cursor-pointer">
                    {isEn ? 'Close' : 'Tutup'}
                  </button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </motion.div>
    </div>
  )
}
