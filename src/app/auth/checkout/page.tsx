'use client'

import React, { useState, useEffect, Suspense } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import Link from 'next/link'
import Image from 'next/image'
import { useRouter, useSearchParams } from 'next/navigation'
import {
  Crown, Mail, Lock, Eye, EyeOff, ArrowRight,
  AlertCircle, Loader2, User, CheckCircle, ShieldCheck, Sparkles
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { supabase } from '@/lib/supabase'
import { PRICING, formatRupiah, type PricingPlan } from '@/lib/pricing'
import { toast } from 'sonner'

function generateDeviceId(): string {
  if (typeof window === 'undefined') return ''
  const canvas = document.createElement('canvas')
  const ctx = canvas.getContext('2d')
  let fp = ''
  try {
    if (ctx) { ctx.textBaseline = 'top'; ctx.font = '14px Arial'; ctx.fillText('fp', 2, 2); fp += canvas.toDataURL().slice(-50) }
    fp += `${screen.width}x${screen.height}x${screen.colorDepth}`
    fp += Intl.DateTimeFormat().resolvedOptions().timeZone + navigator.language + navigator.platform
    let hash = 0
    for (let i = 0; i < fp.length; i++) { hash = ((hash << 5) - hash) + fp.charCodeAt(i); hash = hash & hash }
    return `DEV${Math.abs(hash).toString(36).toUpperCase()}`
  } catch { return `DEV${Date.now().toString(36).toUpperCase()}` }
}

function CheckoutContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const planParam = (searchParams.get('plan') || 'PRO_30_DAYS') as PricingPlan

  // Steps: 'auth' → 'payment' → 'verify-email'
  const [step, setStep] = useState<'auth' | 'payment' | 'verify-email'>('auth')
  const [mode, setMode] = useState<'login' | 'signup'>('login')

  // Auth fields
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [fullName, setFullName] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [authLoading, setAuthLoading] = useState(false)
  const [authError, setAuthError] = useState('')

  // Payment
  const [snapLoaded, setSnapLoaded] = useState(false)
  const [payLoading, setPayLoading] = useState(false)

  // Plan info
  const planPrice = PRICING[planParam] || PRICING.PRO_30_DAYS
  const planLabel = planParam === 'PRO_LIFETIME' ? 'Lifetime Ultra' : planParam === 'PRO_180_DAYS' ? 'Elite Pro 6 Bulan' : 'Elite Pro 1 Bulan'

  // Load Midtrans Snap.js
  useEffect(() => {
    const loadSnap = async () => {
      try {
        const res = await fetch('/api/midtrans/create-transaction')
        const config = await res.json()
        if (!config.configured || !config.snapUrl) return
        if ((window as any).snap) { setSnapLoaded(true); return }
        const script = document.createElement('script')
        script.id = 'midtrans-snap-checkout'
        script.src = config.snapUrl
        script.setAttribute('data-client-key', config.clientKey)
        script.async = true
        script.onload = () => setSnapLoaded(true)
        document.body.appendChild(script)
      } catch { /* ignore */ }
    }
    loadSnap()
  }, [])

  // Check if already logged in
  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session?.user) {
        setStep('payment')
      }
    })
  }, [])

  // ── Login handler ──────────────────────────────────
  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setAuthError('')
    if (!email || !password) { setAuthError('Email dan password harus diisi'); return }
    setAuthLoading(true)

    try {
      const { data, error: signInError } = await supabase.auth.signInWithPassword({ email, password })

      if (signInError) {
        const msg = signInError.message?.toLowerCase() || ''
        if (msg.includes('invalid') || msg.includes('credentials')) {
          setAuthError('Email atau password salah.')
          setMode('signup') // Suggest signup
        } else if (msg.includes('email not confirmed')) {
          setAuthError('Email belum diverifikasi. Cek inbox/spam kamu.')
        } else if (msg.includes('not found')) {
          setAuthError('Akun tidak ditemukan. Silakan daftar dulu.')
          setMode('signup')
        } else {
          setAuthError('Login gagal. Coba lagi.')
        }
        setAuthLoading(false)
        return
      }

      if (data.session) {
        // Sync user
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

        setStep('payment')
      }
    } catch {
      setAuthError('Koneksi bermasalah. Cek internet kamu.')
    } finally {
      setAuthLoading(false)
    }
  }

  // ── Signup handler ─────────────────────────────────
  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault()
    setAuthError('')
    const hasMin = password.length >= 8
    const hasUpper = /[A-Z]/.test(password)
    const hasLower = /[a-z]/.test(password)
    const hasNum = /[0-9]/.test(password)
    if (!hasMin || !hasUpper || !hasLower || !hasNum) {
      setAuthError('Password: min 8 karakter, huruf besar, kecil, dan angka')
      return
    }
    setAuthLoading(true)

    try {
      const res = await fetch('/api/auth/signup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email,
          password,
          fullName: fullName || email.split('@')[0],
          deviceId: generateDeviceId() || null
        })
      })
      const data = await res.json()

      if (!res.ok) {
        setAuthError(data.error || 'Gagal membuat akun')
        setAuthLoading(false)
        return
      }

      // Auto-login after signup
      const { data: loginData, error: loginErr } = await supabase.auth.signInWithPassword({ email, password })
      if (loginErr || !loginData.session) {
        // If auto-login fails (unverified email), go to verify step
        setStep('verify-email')
        setAuthLoading(false)
        return
      }

      // Sync user
      try {
        await fetch('/api/auth/sync-user', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            userId: loginData.user.id,
            email: loginData.user.email,
            fullName: fullName || email.split('@')[0]
          })
        })
      } catch { /* non-critical */ }

      // Go to payment
      setStep('payment')
    } catch {
      setAuthError('Koneksi bermasalah. Cek internet kamu.')
    } finally {
      setAuthLoading(false)
    }
  }

  // ── Pay via Midtrans ──────────────────────────────
  const handlePay = async () => {
    if (!snapLoaded) { toast.error('Payment gateway sedang dimuat...'); return }
    setPayLoading(true)
    try {
      const res = await fetch('/api/midtrans/create-transaction', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ plan: planParam }),
      })
      const data = await res.json()

      if (!res.ok) {
        console.error('[Checkout] Pay failed:', res.status, data)
        toast.error(data.error || `Gagal membuat transaksi (${res.status})`)
        setPayLoading(false)
        return
      }

      ;(window as any).snap.pay(data.token, {
        onSuccess: () => {
          toast.success('Pembayaran berhasil! Akun PRO sedang diaktivasi...')
          setStep('verify-email')
        },
        onPending: () => { toast.info('Menunggu pembayaran...') },
        onError: () => { toast.error('Pembayaran gagal atau dibatalkan.') },
        onClose: () => { setPayLoading(false) },
      })
    } catch {
      toast.error('Gagal terhubung ke payment gateway')
      setPayLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-[#0a0612] flex items-center justify-center p-4">
      {/* Background */}
      <div className="fixed inset-0 -z-10">
        <div className="absolute inset-0 bg-gradient-to-b from-[#0a0612] via-[#110a1f] to-[#0a0612]" />
        <div className="absolute top-0 left-1/4 w-[600px] h-[600px] bg-amber-500/5 rounded-full blur-[150px]" />
        <div className="absolute bottom-1/4 right-1/4 w-[400px] h-[400px] bg-purple-500/10 rounded-full blur-[100px]" />
      </div>

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-md"
      >
        {/* Logo */}
        <div className="text-center mb-6">
          <Link href="/" className="inline-flex items-center gap-3">
            <Image src="/logo.png" alt="LuxTrade" width={48} height={48} className="rounded-xl shadow-lg shadow-purple-500/20" />
            <span className="text-2xl font-bold bg-gradient-to-r from-amber-200 via-amber-400 to-amber-200 bg-clip-text text-transparent">
              LuxTrade
            </span>
          </Link>
        </div>

        {/* Progress Steps */}
        <div className="flex items-center justify-center gap-2 mb-6">
          {[
            { key: 'auth', label: 'Akun' },
            { key: 'payment', label: 'Bayar' },
            { key: 'verify-email', label: 'Selesai' },
          ].map((s, i) => (
            <React.Fragment key={s.key}>
              <div className={`flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium transition-all ${
                step === s.key
                  ? 'bg-purple-500/20 text-purple-300 border border-purple-500/30'
                  : ['auth', 'payment', 'verify-email'].indexOf(step) > i
                  ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/20'
                  : 'bg-white/5 text-white/30 border border-white/10'
              }`}>
                {['auth', 'payment', 'verify-email'].indexOf(step) > i ? (
                  <CheckCircle className="w-3 h-3" />
                ) : (
                  <span className="w-3 h-3 rounded-full border-current border-[1.5px] flex items-center justify-center text-[8px]">{i + 1}</span>
                )}
                {s.label}
              </div>
              {i < 2 && (
                <div className={`h-px w-6 ${['auth', 'payment', 'verify-email'].indexOf(step) > i ? 'bg-emerald-500/40' : 'bg-white/10'}`} />
              )}
            </React.Fragment>
          ))}
        </div>

        {/* ── STEP 1: Auth (Login / Signup) ─────────── */}
        <AnimatePresence mode="wait">
          {step === 'auth' && (
            <motion.div
              key="auth"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              className="bg-white/[0.02] border border-white/[0.05] rounded-2xl p-8 backdrop-blur-sm"
            >
              {/* Plan Summary */}
              <div className="bg-gradient-to-r from-purple-500/10 to-pink-500/10 border border-purple-500/20 rounded-xl p-4 mb-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs text-purple-300">Paket yang dipilih</p>
                    <p className="text-lg font-bold text-white flex items-center gap-2">
                      <Crown className="w-5 h-5 text-amber-400" />
                      {planLabel}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-xs text-purple-300">Total</p>
                    <p className="text-xl font-bold bg-gradient-to-r from-purple-300 to-pink-300 bg-clip-text text-transparent">
                      {formatRupiah(planPrice)}
                    </p>
                  </div>
                </div>
              </div>

              {/* Mode Toggle */}
              <div className="flex bg-white/5 rounded-xl p-1 mb-6">
                <button
                  onClick={() => { setMode('login'); setAuthError('') }}
                  className={`flex-1 py-2 rounded-lg text-sm font-medium transition-all ${mode === 'login' ? 'bg-purple-500/20 text-purple-300 shadow' : 'text-white/40 hover:text-white/60'}`}
                >
                  Sudah Punya Akun
                </button>
                <button
                  onClick={() => { setMode('signup'); setAuthError('') }}
                  className={`flex-1 py-2 rounded-lg text-sm font-medium transition-all ${mode === 'signup' ? 'bg-purple-500/20 text-purple-300 shadow' : 'text-white/40 hover:text-white/60'}`}
                >
                  Daftar Baru
                </button>
              </div>

              {authError && (
                <motion.div initial={{ opacity: 0, y: -5 }} animate={{ opacity: 1, y: 0 }} className="flex items-start gap-2 p-3 bg-red-500/10 border border-red-500/30 rounded-lg text-red-400 text-sm mb-4">
                  <AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />
                  <span>{authError}</span>
                </motion.div>
              )}

              {mode === 'login' ? (
                <form onSubmit={handleLogin} className="space-y-4">
                  <div>
                    <Label className="text-white/60 text-sm">Email</Label>
                    <div className="relative mt-1.5">
                      <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/30" />
                      <Input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="kamu@email.com" className="pl-10 bg-white/5 border-white/10 text-white placeholder:text-white/20" required />
                    </div>
                  </div>
                  <div>
                    <Label className="text-white/60 text-sm">Password</Label>
                    <div className="relative mt-1.5">
                      <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/30" />
                      <Input type={showPassword ? 'text' : 'password'} value={password} onChange={e => setPassword(e.target.value)} placeholder="Masukkan password" className="pl-10 pr-10 bg-white/5 border-white/10 text-white placeholder:text-white/20" required />
                      <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-3 top-1/2 -translate-y-1/2 text-white/30 hover:text-white/60">
                        {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>
                  </div>
                  <Button type="submit" disabled={authLoading} className="w-full h-12 bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-400 hover:to-pink-400 text-white font-semibold shadow-lg shadow-purple-500/25">
                    {authLoading ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Login...</> : <>Login & Lanjut Bayar <ArrowRight className="w-4 h-4 ml-2" /></>}
                  </Button>
                </form>
              ) : (
                <form onSubmit={handleSignup} className="space-y-4">
                  <div>
                    <Label className="text-white/60 text-sm">Nama Lengkap</Label>
                    <div className="relative mt-1.5">
                      <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/30" />
                      <Input type="text" value={fullName} onChange={e => setFullName(e.target.value)} placeholder="Nama kamu" className="pl-10 bg-white/5 border-white/10 text-white placeholder:text-white/20" />
                    </div>
                  </div>
                  <div>
                    <Label className="text-white/60 text-sm">Email</Label>
                    <div className="relative mt-1.5">
                      <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/30" />
                      <Input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="kamu@email.com" className="pl-10 bg-white/5 border-white/10 text-white placeholder:text-white/20" required />
                    </div>
                  </div>
                  <div>
                    <Label className="text-white/60 text-sm">Password</Label>
                    <div className="relative mt-1.5">
                      <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/30" />
                      <Input type={showPassword ? 'text' : 'password'} value={password} onChange={e => setPassword(e.target.value)} placeholder="Min 8 karakter, A-Z, a-z, 0-9" className="pl-10 pr-10 bg-white/5 border-white/10 text-white placeholder:text-white/20" required />
                      <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-3 top-1/2 -translate-y-1/2 text-white/30 hover:text-white/60">
                        {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>
                    <div className="flex gap-1 mt-2">
                      {[password.length >= 8, /[A-Z]/.test(password), /[a-z]/.test(password), /[0-9]/.test(password)].map((ok, i) => (
                        <div key={i} className={`flex-1 h-1 rounded-full ${ok ? 'bg-emerald-500' : 'bg-white/10'}`} />
                      ))}
                    </div>
                  </div>
                  <Button type="submit" disabled={authLoading} className="w-full h-12 bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-400 hover:to-pink-400 text-white font-semibold shadow-lg shadow-purple-500/25">
                    {authLoading ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Mendaftar...</> : <>Daftar & Lanjut Bayar <ArrowRight className="w-4 h-4 ml-2" /></>}
                  </Button>
                </form>
              )}

              <div className="mt-4 text-center">
                <Link href="/" className="text-white/30 hover:text-white/50 text-xs transition-colors">
                  Kembali ke Beranda
                </Link>
              </div>
            </motion.div>
          )}

          {/* ── STEP 2: Payment ──────────────────────── */}
          {step === 'payment' && (
            <motion.div
              key="payment"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              className="bg-white/[0.02] border border-white/[0.05] rounded-2xl p-8 backdrop-blur-sm text-center"
            >
              <div className="w-16 h-16 rounded-full bg-purple-500/20 flex items-center justify-center mx-auto mb-4">
                <Crown className="w-8 h-8 text-amber-400" />
              </div>
              <h2 className="text-2xl font-bold text-white mb-2">Siap Upgrade! 🎉</h2>
              <p className="text-white/50 text-sm mb-6">
                Akun: <span className="text-white/80">{email}</span>
              </p>

              <div className="bg-gradient-to-r from-purple-500/10 to-pink-500/10 border border-purple-500/20 rounded-xl p-5 mb-6">
                <p className="text-xs text-purple-300 mb-1">{planLabel}</p>
                <p className="text-3xl font-bold bg-gradient-to-r from-purple-300 via-pink-300 to-amber-300 bg-clip-text text-transparent">
                  {formatRupiah(planPrice)}
                </p>
              </div>

              <Button
                onClick={handlePay}
                disabled={payLoading || !snapLoaded}
                size="lg"
                className="w-full h-14 bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-400 hover:to-pink-400 text-white font-bold text-base shadow-lg shadow-purple-500/25 disabled:opacity-50"
              >
                {payLoading ? (
                  <><Loader2 className="w-5 h-5 mr-2 animate-spin" /> Membuka pembayaran...</>
                ) : !snapLoaded ? (
                  <><Loader2 className="w-5 h-5 mr-2 animate-spin" /> Memuat payment gateway...</>
                ) : (
                  <><Sparkles className="w-5 h-5 mr-2" /> Bayar {formatRupiah(planPrice)}</>
                )}
              </Button>

              <p className="text-white/25 text-xs mt-4 flex items-center justify-center gap-1.5">
                <ShieldCheck className="w-3 h-3" />
                Pembayaran aman via Midtrans — Aktivasi PRO otomatis
              </p>
            </motion.div>
          )}

          {/* ── STEP 3: Done / Verify Email ──────────── */}
          {step === 'verify-email' && (
            <motion.div
              key="verify-email"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              className="bg-white/[0.02] border border-white/[0.05] rounded-2xl p-8 backdrop-blur-sm text-center"
            >
              <div className="w-16 h-16 rounded-full bg-emerald-500/20 flex items-center justify-center mx-auto mb-4">
                <CheckCircle className="w-8 h-8 text-emerald-400" />
              </div>
              <h2 className="text-2xl font-bold text-white mb-2">Akun PRO Aktif! 🎉</h2>
              <p className="text-white/60 text-sm mb-6">
                Selamat! Paket <strong className="text-amber-400">{planLabel}</strong> sudah aktif.
              </p>

              {/* Email verification reminder */}
              <div className="bg-amber-500/10 border border-amber-500/20 rounded-xl p-4 mb-6 text-left">
                <div className="flex items-center gap-2 mb-2">
                  <Mail className="w-4 h-4 text-amber-400" />
                  <p className="text-amber-300 text-sm font-semibold">Verifikasi Email Kamu</p>
                </div>
                <p className="text-white/50 text-xs">
                  Cek inbox/spam email <strong className="text-white/70">{email}</strong> dan klik link verifikasi untuk keamanan akun.
                </p>
              </div>

              <Button
                onClick={() => router.push('/dashboard')}
                size="lg"
                className="w-full h-12 bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 text-white font-semibold shadow-lg shadow-emerald-500/25"
              >
                Buka Dashboard <ArrowRight className="w-4 h-4 ml-2" />
              </Button>

              <div className="mt-4">
                <button
                  onClick={async () => {
                    try {
                      const res = await fetch('/api/auth/resend-verification', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ email })
                      })
                      const data = await res.json()
                      toast.success(data.message || 'Email verifikasi dikirim ulang!')
                    } catch { toast.error('Gagal mengirim ulang') }
                  }}
                  className="text-white/30 hover:text-white/50 text-xs transition-colors"
                >
                  Kirim ulang email verifikasi
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>
    </div>
  )
}

export default function CheckoutPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-[#0a0612] flex items-center justify-center">
        <Loader2 className="w-8 h-8 text-purple-400 animate-spin" />
      </div>
    }>
      <CheckoutContent />
    </Suspense>
  )
}