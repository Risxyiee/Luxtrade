'use client'

import React, { useState, useRef, useCallback, useEffect, Suspense } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import { Mail, Lock, Eye, EyeOff, ArrowRight, AlertCircle, Loader2, RefreshCw, ShieldCheck, Send, User, Tag, Sparkles, CheckCircle } from 'lucide-react'
import { supabase } from '@/lib/supabase'

// ============================================
// Device fingerprint
// ============================================
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

// ============================================
// Input field (matches reference .input-lux)
// ============================================
function LuxInput({ icon: Icon, placeholder, value, onChange, type = 'text', required, rightElement, mono, error: hasError, onClearError }: {
  icon?: React.ComponentType<{ className?: string; style?: React.CSSProperties }>
  placeholder?: string
  value: string
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void
  type?: string
  required?: boolean
  rightElement?: React.ReactNode
  mono?: boolean
  error?: boolean
  onClearError?: () => void
}) {
  const [focused, setFocused] = React.useState(false)

  return (
    <div className="relative flex items-center">
      {Icon && (
        <Icon
          className="absolute left-4 w-4 h-4 pointer-events-none transition-colors duration-300"
          style={{ color: focused ? '#06b6d4' : hasError ? 'rgba(239,68,68,0.7)' : 'rgba(255,255,255,0.4)' }}
        />
      )}
      <input
        type={type}
        placeholder={placeholder}
        value={value}
        onChange={(e) => { onChange(e); onClearError?.() }}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        required={required}
        className={
          `w-full transition-all duration-300 outline-none ${mono ? 'font-[JetBrains_Mono,monospace]' : ''} ` +
          (hasError
            ? 'auth-input-error'
            : 'auth-input'
          )
        }
      />
      {rightElement && <div className="absolute right-3">{rightElement}</div>}
    </div>
  )
}

// ============================================
// Main Auth Page (Login + Register in one card)
// ============================================
function AuthPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const redirectPath = searchParams.get('redirect') || '/dashboard'

  // View toggle
  const [view, setView] = useState<'login' | 'register'>('login')
  const [transitioning, setTransitioning] = useState(false)

  // Shared fields
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)

  // Login state
  const [loginLoading, setLoginLoading] = useState(false)
  const [loginError, setLoginError] = useState('')
  const [loginSuccess, setLoginSuccess] = useState('')
  const [isResending, setIsResending] = useState(false)
  const [showResend, setShowResend] = useState(false)
  const [loginFieldErrors, setLoginFieldErrors] = useState<Record<string, boolean>>({})

  // Register state
  const [fullName, setFullName] = useState('')
  const [referralCode, setReferralCode] = useState('')
  const [regLoading, setRegLoading] = useState(false)
  const [regError, setRegError] = useState('')
  const [regSuccess, setRegSuccess] = useState(false)
  const [termsChecked, setTermsChecked] = useState(false)
  const [termsError, setTermsError] = useState(false)
  const [regFieldErrors, setRegFieldErrors] = useState<Record<string, boolean>>({})

  // 3D Tilt
  const containerRef = useRef<HTMLDivElement>(null)
  const cardRef = useRef<HTMLDivElement>(null)
  const [tilt, setTilt] = useState({ x: 0, y: 0 })
  const [mousePos, setMousePos] = useState({ x: 50, y: 50 })
  const isTouch = useRef(false)

  useEffect(() => {
    isTouch.current = 'ontouchstart' in window || navigator.maxTouchPoints > 0
    const ref = searchParams.get('ref')
    if (ref) { setReferralCode(ref.toUpperCase()); setView('register') }
  }, [searchParams])

  // 3D tilt handler
  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    if (isTouch.current || !containerRef.current) return
    const rect = containerRef.current.getBoundingClientRect()
    const x = e.clientX - rect.left
    const y = e.clientY - rect.top
    const cx = rect.width / 2
    const cy = rect.height / 2
    setTilt({ x: ((y - cy) / cy) * -8, y: ((x - cx) / cx) * 8 })
    setMousePos({ x: (x / rect.width) * 100, y: (y / rect.height) * 100 })
  }, [])

  const handleMouseLeave = useCallback(() => {
    setTilt({ x: 0, y: 0 })
  }, [])

  // View toggle
  const switchView = (to: 'login' | 'register') => {
    if (to === view || transitioning) return
    setTransitioning(true)
    setTimeout(() => {
      setView(to)
      setTransitioning(false)
    }, 150)
  }

  // Password strength
  const hasMin = password.length >= 8
  const hasUpper = /[A-Z]/.test(password)
  const hasLower = /[a-z]/.test(password)
  const hasNum = /[0-9]/.test(password)

  // ---- LOGIN HANDLER ----
  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoginError(''); setLoginSuccess(''); setLoginFieldErrors({}); setShowResend(false)
    const errs: Record<string, boolean> = {}
    if (!email) errs.email = true
    if (!password) errs.password = true
    if (Object.keys(errs).length) { setLoginFieldErrors(errs); setLoginError('Email dan password harus diisi ya'); return }
    setLoginLoading(true)
    try {
      const { data, error: signInError } = await supabase.auth.signInWithPassword({ email, password })
      if (signInError) {
        const msg = signInError.message?.toLowerCase() || ''
        if (msg.includes('too many requests') || msg.includes('rate limit')) { setLoginError('Terlalu banyak percobaan login. Tunggu beberapa menit ya.'); setLoginLoading(false); return }
        if (msg.includes('email not confirmed')) { setLoginError('Email belum diverifikasi. Cek inbox/spam kamu, atau klik tombol di bawah.'); setShowResend(true); setLoginLoading(false); return }
        if (msg.includes('invalid login credentials') || msg.includes('invalid credentials')) { setLoginError('Email atau password salah. Coba lagi atau reset password.'); setLoginLoading(false); return }
        setLoginError(signInError.message || 'Login gagal.'); setLoginLoading(false); return
      }
      if (data.session && data.user) {
        try {
          await fetch('/api/auth/sync-user', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ userId: data.user.id, email: data.user.email, fullName: data.user.user_metadata?.display_name || data.user.user_metadata?.name || data.user.email?.split('@')[0] }) })
        } catch { /* non-critical */ }
        window.location.href = redirectPath
      } else { setLoginError('Login gagal.'); setLoginLoading(false) }
    } catch { setLoginError('Koneksi bermasalah. Cek internet kamu.'); setLoginLoading(false) }
  }

  // ---- RESEND VERIFICATION ----
  const handleResend = async () => {
    if (!email) { setLoginError('Masukkan email kamu terlebih dahulu'); return }
    setIsResending(true); setLoginError(''); setLoginSuccess('')
    try {
      const res = await fetch('/api/auth/resend-verification', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email }) })
      const data = await res.json()
      if (!res.ok) { setLoginError(data.error || 'Gagal mengirim ulang.'); return }
      setLoginSuccess(data.message || 'Email verifikasi baru sudah dikirim!')
    } catch { setLoginError('Gagal kirim ulang.') } finally { setIsResending(false) }
  }

  // ---- REGISTER HANDLER ----
  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault()
    setRegError(''); setRegFieldErrors({}); setTermsError(false)
    if (!termsChecked) { setTermsError(true); setTimeout(() => setTermsError(false), 500); setRegError('Anda harus menyetujui Syarat & Ketentuan.'); return }
    if (!hasMin || !hasUpper || !hasLower || !hasNum) { setRegError('Password tidak memenuhi syarat (min 8, huruf besar, kecil, angka)'); return }
    const errs: Record<string, boolean> = {}
    if (!fullName) errs.name = true
    if (!email) errs.email = true
    if (!password) errs.password = true
    if (Object.keys(errs).length) { setRegFieldErrors(errs); return }
    setRegLoading(true)
    try {
      const res = await fetch('/api/auth/signup', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email, password, fullName, deviceId: generateDeviceId() || null, referralCode: referralCode || null }) })
      const data = await res.json()
      if (!res.ok) { setRegError(data.error || 'Gagal membuat akun'); setRegLoading(false); return }
      if (data.emailSent) { setRegSuccess(true) } else { setRegError('Akun dibuat tapi gagal kirim email verifikasi. Hubungi admin.') }
    } catch (err: unknown) { setRegError(err instanceof Error ? err.message : 'Gagal membuat akun') } finally { setRegLoading(false) }
  }

  // ---- SUCCESS SCREEN ----
  if (regSuccess) {
    return (
      <div className="auth-page">
        <AuthBg />
        <div className="auth-noise" />
        <div className="w-full flex flex-col items-center relative z-10">
          <div className="auth-perspective w-full max-w-md relative">
            <div className="auth-glass-card p-8 md:p-10">
              <div className="flex justify-center mb-6">
                <div className="w-16 h-16 rounded-full bg-emerald-500/20 flex items-center justify-center">
                  <CheckCircle className="w-8 h-8 text-emerald-400" />
                </div>
              </div>
              <div className="text-center mb-6">
                <h2 className="text-2xl font-light text-white tracking-wide mb-2">Akun Berhasil Dibuat!</h2>
                <p className="text-xs text-gray-500 font-[JetBrains_Mono,monospace]">Kami sudah kirim email verifikasi ke:</p>
                <p className="text-cyan-400 font-semibold text-lg mt-3">{email}</p>
              </div>
              <div className="auth-surface rounded-xl p-4 mb-4">
                <p className="text-gray-500 text-[11px] leading-relaxed">
                  Cek <strong className="text-gray-400">inbox, spam, atau folder promosi</strong> kamu. Email dari <span className="text-cyan-400/70">noreply@luxtradee.web.id</span>
                </p>
              </div>
              <p className="text-gray-600 text-[10px] font-[JetBrains_Mono,monospace] mb-6 text-center">Link verifikasi berlaku 24 jam.</p>
              <button onClick={() => switchView('login')} className="auth-glow-btn w-full py-3.5">
                Login Sekarang <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          </div>
          <p className="text-center mt-8 text-[10px] text-gray-700 font-[JetBrains_Mono,monospace] uppercase tracking-widest">© 2026 LuxTrade. All rights reserved.</p>
        </div>
      </div>
    )
  }

  return (
    <div className="auth-page">
      <AuthBg />
      <div className="auth-noise" />

      <div ref={containerRef} onMouseMove={handleMouseMove} onMouseLeave={handleMouseLeave} className="auth-perspective w-full max-w-md relative z-10">
        <div
          ref={cardRef}
          className="auth-glass-card p-8 md:p-10"
          style={{
            transform: `rotateX(${tilt.x}deg) rotateY(${tilt.y}deg) ${tilt.x === 0 && tilt.y === 0 ? '' : 'scale(1.02)'}`,
          }}
        >
          {/* Glare layer */}
          <div className="auth-glare" style={{ background: `radial-gradient(circle at ${mousePos.x}% ${mousePos.y}%, rgba(255,255,255,0.06), transparent 40%)`, opacity: (tilt.x !== 0 || tilt.y !== 0) ? 1 : 0 }} />

          {/* Logo */}
          <div className="flex justify-center mb-8" style={{ transform: 'translateZ(40px)' }}>
            <Link href="/" className="inline-flex items-center gap-2.5">
              <Image src="/logo.png" alt="LuxTrade" width={32} height={32} className="object-contain" />
              <span className="text-xl font-light tracking-wider text-white uppercase">LuxTrade</span>
            </Link>
          </div>

          <div style={{ transform: 'translateZ(20px)' }}>
            {/* ========== LOGIN VIEW ========== */}
            <div className="auth-view" style={{ opacity: view === 'login' && !transitioning ? 1 : 0, transform: view === 'login' && !transitioning ? 'translateY(0)' : 'translateY(10px)', pointerEvents: view === 'login' && !transitioning ? 'auto' : 'none', display: view === 'login' || transitioning ? 'block' : 'none' }}>
              <div className="mb-8 text-center">
                <h1 className="text-2xl font-light text-white tracking-wide mb-2">Selamat Datang Kembali</h1>
                <p className="text-xs text-gray-500 font-[JetBrains_Mono,monospace]">Masuk untuk melanjutkan jurnal trading Anda.</p>
              </div>

              {/* Error */}
              {loginError && (
                <div className="flex flex-col gap-2 mb-5">
                  <div className="flex items-start gap-2 p-3 bg-red-500/10 border border-red-500/30 rounded-lg text-red-400 text-sm">
                    <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" /><span>{loginError}</span>
                  </div>
                  {showResend && (
                    <button type="button" onClick={handleResend} disabled={isResending} className="w-full flex items-center justify-center gap-2 py-2.5 bg-blue-500/10 border border-blue-500/30 text-blue-400 text-xs font-medium rounded-lg hover:bg-blue-500/20 transition-colors disabled:opacity-50">
                      {isResending ? <><Loader2 className="w-3.5 h-3.5 animate-spin" /> Mengirim...</> : <><RefreshCw className="w-3.5 h-3.5" /> Kirim Ulang Link Verifikasi</>}
                    </button>
                  )}
                </div>
              )}
              {loginSuccess && (
                <div className="flex items-start gap-2 p-3 mb-5 bg-emerald-500/10 border border-emerald-500/30 rounded-lg text-emerald-400 text-sm">
                  <Send className="w-4 h-4 flex-shrink-0 mt-0.5" /><span>{loginSuccess}</span>
                </div>
              )}

              <form onSubmit={handleLogin} className="space-y-5">
                <div>
                  <label className="text-[10px] font-[JetBrains_Mono,monospace] text-gray-500 uppercase tracking-widest mb-2 block">Email atau Username</label>
                  <LuxInput icon={Mail} placeholder="trader@luxtradee.com" value={email} onChange={e => setEmail(e.target.value)} required mono error={loginFieldErrors.email} onClearError={() => setLoginFieldErrors(p => ({ ...p, email: false }))} />
                </div>
                <div>
                  <div className="flex justify-between items-center mb-2">
                    <label className="text-[10px] font-[JetBrains_Mono,monospace] text-gray-500 uppercase tracking-widest">Password</label>
                    <Link href="/auth/forgot-password" className="text-[10px] font-[JetBrains_Mono,monospace] text-cyan-400 transition-all hover:text-cyan-300" style={{ textShadow: '0 0 8px rgba(6,182,212,0.4)' }}>Lupa Password?</Link>
                  </div>
                  <LuxInput icon={Lock} type={showPassword ? 'text' : 'password'} placeholder="••••••••••••" value={password} onChange={e => setPassword(e.target.value)} required mono error={loginFieldErrors.password} onClearError={() => setLoginFieldErrors(p => ({ ...p, password: false }))} rightElement={
                    <button type="button" onClick={() => setShowPassword(!showPassword)} className="text-white/30 hover:text-cyan-400 transition-colors bg-transparent border-none cursor-pointer">
                      {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  } />
                </div>
                <div style={{ transform: 'translateZ(60px)' }} className="pt-4">
                  <button type="submit" disabled={loginLoading} className="auth-glow-btn w-full py-3.5">
                    {loginLoading ? <><Loader2 className="w-4 h-4 animate-spin" /> Masuk...</> : <>Masuk ke Dashboard <ArrowRight className="w-4 h-4" /></>}
                  </button>
                  <p className="mt-4 text-[10px] text-gray-600 flex items-center justify-center gap-1.5 font-[JetBrains_Mono,monospace]">
                    <ShieldCheck className="w-3 h-3" /> Data Anda dilindungi enkripsi end-to-end
                  </p>
                </div>
              </form>

              <div className="mt-6 text-center">
                <p className="text-xs text-gray-500 font-light">Belum punya akun?
                  <button type="button" onClick={() => switchView('register')} className="text-cyan-400 font-medium hover:underline transition-all ml-1">Daftar gratis</button>
                </p>
              </div>
            </div>

            {/* ========== REGISTER VIEW ========== */}
            <div className="auth-view" style={{ opacity: view === 'register' && !transitioning ? 1 : 0, transform: view === 'register' && !transitioning ? 'translateY(0)' : 'translateY(10px)', pointerEvents: view === 'register' && !transitioning ? 'auto' : 'none', display: view === 'register' || transitioning ? 'block' : 'none' }}>
              <div className="mb-8 text-center">
                <h1 className="text-2xl font-light text-white tracking-wide mb-2">Buat Akun Baru</h1>
                <p className="text-xs text-gray-500 font-[JetBrains_Mono,monospace]">Mulai bangun edge trading Anda hari ini.</p>
              </div>

              {regError && (
                <div className="flex items-start gap-2 p-3 mb-5 bg-red-500/10 border border-red-500/30 rounded-lg text-red-400 text-sm">
                  <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" /><span>{regError}</span>
                </div>
              )}

              <form onSubmit={handleRegister} className="space-y-4">
                <div>
                  <label className="text-[10px] font-[JetBrains_Mono,monospace] text-gray-500 uppercase tracking-widest mb-2 block">Nama Lengkap</label>
                  <LuxInput icon={User} placeholder="Trader LuxTrade" value={fullName} onChange={e => setFullName(e.target.value)} required error={regFieldErrors.name} onClearError={() => setRegFieldErrors(p => ({ ...p, name: false }))} />
                </div>
                <div>
                  <label className="text-[10px] font-[JetBrains_Mono,monospace] text-gray-500 uppercase tracking-widest mb-2 block">Email</label>
                  <LuxInput icon={Mail} placeholder="trader@luxtradee.com" value={email} onChange={e => setEmail(e.target.value)} required mono error={regFieldErrors.email} onClearError={() => setRegFieldErrors(p => ({ ...p, email: false }))} />
                </div>
                <div>
                  <label className="text-[10px] font-[JetBrains_Mono,monospace] text-gray-500 uppercase tracking-widest mb-2 block">Password</label>
                  <LuxInput icon={Lock} type={showPassword ? 'text' : 'password'} placeholder="Min. 8 karakter" value={password} onChange={e => setPassword(e.target.value)} required mono error={regFieldErrors.password} onClearError={() => setRegFieldErrors(p => ({ ...p, password: false }))} rightElement={
                    <button type="button" onClick={() => setShowPassword(!showPassword)} className="text-white/30 hover:text-cyan-400 transition-colors bg-transparent border-none cursor-pointer">
                      {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  } />
                  {password && (
                    <div className="grid grid-cols-2 gap-2 mt-2">
                      {[{ ok: hasMin, l: 'Min. 8 karakter' }, { ok: hasUpper, l: 'Huruf besar' }, { ok: hasLower, l: 'Huruf kecil' }, { ok: hasNum, l: 'Angka' }].map(i => (
                        <div key={i.l} className={`flex items-center gap-1.5 text-[11px] ${i.ok ? 'text-emerald-400' : 'text-gray-600'}`}>
                          <div className={`w-1.5 h-1.5 rounded-full ${i.ok ? 'bg-emerald-400' : 'bg-white/20'}`} />{i.l}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
                <div>
                  <label className="text-[10px] font-[JetBrains_Mono,monospace] text-gray-500 uppercase tracking-widest mb-2 block">Kode Referral / Promo (Opsional)</label>
                  <LuxInput icon={Tag} placeholder="TRADERCEPAT" value={referralCode} onChange={e => setReferralCode(e.target.value.toUpperCase())} mono />
                </div>
                <div className="flex items-start gap-3 pt-2">
                  <input type="checkbox" checked={termsChecked} onChange={e => { setTermsChecked(e.target.checked); setTermsError(false) }} className="auth-checkbox" />
                  <label className="text-[11px] text-gray-400 font-light leading-relaxed cursor-pointer" onClick={() => { setTermsChecked(!termsChecked); setTermsError(false) }}>
                    Saya menyetujui <a href="/terms" className="text-cyan-400 hover:underline">Syarat & Ketentuan</a> serta <a href="/privacy" className="text-cyan-400 hover:underline">Kebijakan Privasi</a> LuxTrade.
                  </label>
                </div>
                <div style={{ transform: 'translateZ(60px)' }} className="pt-4">
                  <button type="submit" disabled={regLoading || !termsChecked} className="auth-glow-btn w-full py-3.5 disabled:opacity-50">
                    {regLoading ? <><Loader2 className="w-4 h-4 animate-spin" /> Membuat akun...</> : <>Buat Akun Gratis <Sparkles className="w-4 h-4" /></>}
                  </button>
                  <p className="mt-4 text-[10px] text-gray-600 flex items-center justify-center gap-1.5 font-[JetBrains_Mono,monospace]">
                    <ShieldCheck className="w-3 h-3" /> Data Anda dilindungi enkripsi end-to-end
                  </p>
                </div>
              </form>

              <div className="mt-6 text-center">
                <p className="text-xs text-gray-500 font-light">Sudah punya akun?
                  <button type="button" onClick={() => switchView('login')} className="text-cyan-400 font-medium hover:underline transition-all ml-1">Masuk di sini</button>
                </p>
              </div>
            </div>
          </div>
        </div>

        <p className="text-center mt-8 text-[10px] text-gray-700 font-[JetBrains_Mono,monospace] uppercase tracking-widest relative z-10">© 2026 LuxTrade. All rights reserved.</p>
      </div>
    </div>
  )
}

// ============================================
// Background (kept as component for reuse)
// ============================================
function AuthBg() {
  return (
    <>
      {/* Ambient gradients */}
      <div className="auth-ambient" />
      {/* Floating Orbs */}
      <div className="auth-orb auth-orb-1" />
      <div className="auth-orb auth-orb-2" />
      <div className="auth-orb auth-orb-3" />
      {/* Grid Floor */}
      <div className="auth-grid-floor" />
      {/* Spinning LuxTrade Logo */}
      <div className="absolute inset-0 flex items-center justify-center pointer-events-none" style={{ zIndex: 1 }}>
        <div style={{
          animation: 'auth-logo-spin 16s linear infinite',
          width: 'clamp(200px, 40vw, 420px)',
          height: 'clamp(200px, 40vw, 420px)',
          position: 'relative',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}>
          {/* Outer glow ring */}
          <div style={{
            position: 'absolute',
            inset: '-20%',
            borderRadius: '50%',
            background: 'radial-gradient(circle, rgba(59,130,246,0.1) 0%, rgba(6,182,212,0.06) 40%, transparent 70%)',
            filter: 'blur(30px)',
            animation: 'auth-logo-glow 5s ease-in-out infinite',
          }} />
          {/* Logo */}
          <Image src="/logo.png" alt="" width={280} height={280} className="object-contain" style={{
            opacity: 0.08,
            filter: 'drop-shadow(0 0 40px rgba(59,130,246,0.3)) drop-shadow(0 0 80px rgba(6,182,212,0.15))',
          }} priority={false} />
        </div>
      </div>
    </>
  )
}

// ============================================
// Export
// ============================================
export default function LoginPage() {
  return (
    <Suspense fallback={<div className="auth-page"><Loader2 className="w-8 h-8 text-blue-400 animate-spin" /></div>}>
      <AuthPage />
    </Suspense>
  )
}