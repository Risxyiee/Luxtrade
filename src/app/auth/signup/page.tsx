'use client'

import React, { useState, useRef, useCallback, useEffect, Suspense } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import Link from 'next/link'
import Image from 'next/image'
import { useRouter, useSearchParams } from 'next/navigation'
import {
  Mail, Lock, Eye, EyeOff, ArrowRight,
  AlertCircle, Loader2, User, CheckCircle, Tag, ShieldCheck, Sparkles
} from 'lucide-react'

// ============================================
// 3D Background Components
// ============================================
function AuthBackground() {
  return (
    <div className="fixed inset-0 z-0 overflow-hidden">
      {/* Ambient gradients */}
      <div
        className="absolute inset-0"
        style={{
          background: `
            radial-gradient(ellipse 80% 50% at 20% 0%, rgba(6, 182, 212, 0.1), transparent),
            radial-gradient(ellipse 60% 50% at 80% 100%, rgba(59, 130, 246, 0.1), transparent)
          `
        }}
      />

      {/* Floating Orbs */}
      <div
        className="absolute -top-24 -left-24 w-[400px] h-[400px] rounded-full opacity-40 blur-[80px] pointer-events-none"
        style={{ background: 'radial-gradient(circle, #06b6d4, transparent)', animation: 'float-orb 15s ease-in-out infinite' }}
      />
      <div
        className="absolute -bottom-36 -right-36 w-[500px] h-[500px] rounded-full opacity-40 blur-[80px] pointer-events-none"
        style={{ background: 'radial-gradient(circle, #3b82f6, transparent)', animation: 'float-orb 15s ease-in-out infinite', animationDelay: '-5s' }}
      />
      <div
        className="absolute top-[40%] left-1/2 w-[300px] h-[300px] rounded-full opacity-20 blur-[80px] pointer-events-none -translate-x-1/2"
        style={{ background: 'radial-gradient(circle, #10b981, transparent)', animation: 'float-orb 15s ease-in-out infinite', animationDelay: '-10s' }}
      />

      {/* Perspective Grid Floor */}
      <div
        className="absolute pointer-events-none opacity-30"
        style={{
          bottom: '-50%',
          left: '-50%',
          width: '200%',
          height: '100%',
          backgroundImage: 'linear-gradient(rgba(6, 182, 212, 0.1) 1px, transparent 1px), linear-gradient(90deg, rgba(6, 182, 212, 0.1) 1px, transparent 1px)',
          backgroundSize: '50px 50px',
          transform: 'perspective(500px) rotateX(60deg)',
          maskImage: 'linear-gradient(to top, black, transparent 50%)',
          WebkitMaskImage: 'linear-gradient(to top, black, transparent 50%)',
        }}
      />
      {/* Large background watermark logo */}
      <div className="absolute inset-0 flex items-center justify-center pointer-events-none" style={{ zIndex: 1 }}>
        <div style={{
          width: 'clamp(280px, 55vw, 500px)',
          height: 'clamp(280px, 55vw, 500px)',
          position: 'relative',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          animation: 'auth-logo-spin 25s linear infinite',
        }}>
          <Image src="/logo.png" alt="" width={500} height={500} className="object-contain" style={{
            opacity: 0.04,
            filter: 'drop-shadow(0 0 60px rgba(59,130,246,0.15)) drop-shadow(0 0 120px rgba(6,182,212,0.08))',
          }} priority={false} />
        </div>
      </div>
    </div>
  )
}

// ============================================
// Spinning Logo (placed above form, visible)
// ============================================
function SpinningLogo() {
  return (
    <div className="w-full flex justify-center mb-5 relative z-10">
      <div
        style={{
          animation: 'auth-logo-spin 16s linear infinite',
          width: 'clamp(60px, 14vw, 90px)',
          height: 'clamp(60px, 14vw, 90px)',
          position: 'relative',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        {/* Glow ring behind */}
        <div
          style={{
            position: 'absolute',
            inset: '-60%',
            borderRadius: '50%',
            background: 'radial-gradient(circle, rgba(59,130,246,0.15) 0%, rgba(6,182,212,0.08) 40%, transparent 70%)',
            filter: 'blur(20px)',
            animation: 'auth-logo-glow 5s ease-in-out infinite',
            pointerEvents: 'none',
          }}
        />
        <Image
          src="/logo.png"
          alt=""
          width={90}
          height={90}
          className="object-contain"
          style={{
            opacity: 0.85,
            filter: 'drop-shadow(0 0 25px rgba(59,130,246,0.5)) drop-shadow(0 0 50px rgba(6,182,212,0.3))',
          }}
          priority={false}
        />
      </div>
    </div>
  )
}

// ============================================
// 3D Glassmorphism Card Wrapper
// ============================================
function GlassCard({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  const cardRef = useRef<HTMLDivElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const [mousePos, setMousePos] = useState({ x: 50, y: 50 })
  const [tilt, setTilt] = useState({ x: 0, y: 0 })
  const isTouchDevice = useRef(false)

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    if (isTouchDevice.current || !containerRef.current || !cardRef.current) return
    const rect = containerRef.current.getBoundingClientRect()
    const x = e.clientX - rect.left
    const y = e.clientY - rect.top
    const centerX = rect.width / 2
    const centerY = rect.height / 2

    setTilt({
      x: ((y - centerY) / centerY) * -8,
      y: ((x - centerX) / centerX) * 8,
    })
    setMousePos({
      x: (x / rect.width) * 100,
      y: (y / rect.height) * 100,
    })
  }, [])

  const handleMouseLeave = useCallback(() => {
    setTilt({ x: 0, y: 0 })
  }, [])

  React.useEffect(() => {
    isTouchDevice.current = 'ontouchstart' in window || navigator.maxTouchPoints > 0
  }, [])

  return (
    <div ref={containerRef} onMouseMove={handleMouseMove} onMouseLeave={handleMouseLeave} className="w-full max-w-md relative" style={{ perspective: '1500px', transformStyle: 'preserve-3d' }}>
      <div
        ref={cardRef}
        className={`relative ${className}`}
        style={{
          background: 'rgba(10, 14, 22, 0.6)',
          backdropFilter: 'blur(40px) saturate(180%)',
          WebkitBackdropFilter: 'blur(40px) saturate(180%)',
          borderRadius: '1.5rem',
          boxShadow: '0 1px 0 0 rgba(255,255,255,0.05) inset, 0 30px 60px -30px rgba(0,0,0,0.9), 0 0 0 1px rgba(255,255,255,0.08)',
          transformStyle: 'preserve-3d',
          transition: 'transform 0.1s ease-out',
          transform: `rotateX(${tilt.x}deg) rotateY(${tilt.y}deg) ${tilt.x === 0 && tilt.y === 0 ? '' : 'scale(1.02)'}`,
        }}
      >
        {/* Holographic Glare Layer */}
        <div
          className="absolute inset-0 rounded-[inherit] pointer-events-none transition-opacity duration-300"
          style={{
            background: `radial-gradient(circle at ${mousePos.x}% ${mousePos.y}%, rgba(255,255,255,0.06), transparent 40%)`,
            mixBlendMode: 'overlay',
            zIndex: 2,
            opacity: (tilt.x !== 0 || tilt.y !== 0) ? 1 : 0,
          }}
        />
        <div className="relative z-[1]">
          {children}
        </div>
      </div>
    </div>
  )
}

// ============================================
// Custom Input Component
// ============================================
function LuxInput({
  id,
  type = 'text',
  placeholder,
  value,
  onChange,
  required = false,
  icon: Icon,
  rightElement,
  error: hasError,
  mono = false,
}: {
  id?: string
  type?: string
  placeholder?: string
  value: string
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void
  required?: boolean
  icon?: React.ComponentType<{ className?: string }>
  rightElement?: React.ReactNode
  error?: boolean
  mono?: boolean
}) {
  const [shaking, setShaking] = useState(false)

  React.useEffect(() => {
    if (hasError) {
      setShaking(true)
      const t = setTimeout(() => setShaking(false), 500)
      return () => clearTimeout(t)
    }
  }, [hasError])

  return (
    <div className="relative flex items-center" style={{ transformStyle: 'preserve-3d' }}>
      {Icon && (
        <Icon
          className="absolute left-4 w-4 h-4 pointer-events-none transition-colors duration-300"
          style={{ color: hasError ? 'rgba(239, 68, 68, 0.7)' : 'rgba(255,255,255,0.4)' }}
        />
      )}
      <input
        id={id}
        type={type}
        placeholder={placeholder}
        value={value}
        onChange={onChange}
        required={required}
        className={
          `${mono ? 'font-[JetBrains_Mono,monospace]' : ''} w-full bg-white/[0.03] border rounded-xl py-3 px-4 pl-11 pr-11 text-white text-sm outline-none transition-all duration-300 ` +
          (hasError
            ? 'border-red-500/50 shadow-[0_0_0_4px_rgba(239,68,68,0.1)]'
            : 'border-white/[0.08] focus:border-cyan-500/50 focus:shadow-[0_0_0_4px_rgba(6,182,212,0.1)] focus:bg-white/[0.05]'
          )
        }
        style={
          shaking
            ? { animation: 'shake 0.4s ease-in-out' }
            : undefined
        }
      />
      {rightElement && (
        <div className="absolute right-3">{rightElement}</div>
      )}
    </div>
  )
}

// ============================================
// Custom Checkbox
// ============================================
function LuxCheckbox({ checked, onChange, label }: { checked: boolean; onChange: (v: boolean) => void; label: React.ReactNode }) {
  const id = React.useId()
  return (
    <div className="flex items-start gap-3 pt-2">
      <input
        id={id}
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="mt-0.5 w-4 h-4 border border-white/20 rounded cursor-pointer transition-all duration-200 bg-white/[0.03]"
        style={
          checked
            ? { background: 'linear-gradient(135deg, #3b82f6, #06b6d4)', borderColor: 'transparent' }
            : undefined
        }
      />
      <label htmlFor={id} className="text-[11px] text-gray-400 font-light leading-relaxed cursor-pointer">
        {label}
      </label>
    </div>
  )
}

// ============================================
// Generate device fingerprint
// ============================================
function generateDeviceId(): string {
  if (typeof window === 'undefined') return ''
  const canvas = document.createElement('canvas')
  const ctx = canvas.getContext('2d')
  let fp = ''
  try {
    if (ctx) { ctx.textBaseline = 'top'; ctx.font = '14px Arial'; ctx.fillText('fingerprint', 2, 2); fp += canvas.toDataURL().slice(-50) }
    fp += `${screen.width}x${screen.height}x${screen.colorDepth}`
    fp += Intl.DateTimeFormat().resolvedOptions().timeZone + navigator.language + navigator.platform
    let hash = 0
    for (let i = 0; i < fp.length; i++) { hash = ((hash << 5) - hash) + fp.charCodeAt(i); hash = hash & hash }
    return `DEV${Math.abs(hash).toString(36).toUpperCase()}`
  } catch { return `DEV${Date.now().toString(36).toUpperCase()}` }
}

// ============================================
// Success Screen
// ============================================
function SuccessScreen({ email, onLogin }: { email: string; onLogin: () => void }) {
  return (
    <GlassCard className="p-8 md:p-10">
          {/* Spinning Logo */}
          <SpinningLogo />
          <div className="flex justify-center mb-6">
            <div className="w-16 h-16 rounded-full bg-emerald-500/20 flex items-center justify-center">
              <CheckCircle className="w-8 h-8 text-emerald-400" />
            </div>
          </div>
      <div className="text-center mb-6">
        <h2 className="text-2xl font-light text-white tracking-wide mb-2">Akun Berhasil Dibuat!</h2>
        <p className="text-xs text-gray-500 font-[JetBrains_Mono,monospace]">
          Kami sudah kirim email verifikasi ke:
        </p>
        <p className="text-cyan-400 font-semibold text-lg mt-3">
          {email}
        </p>
      </div>

      <div className="bg-white/[0.03] border border-white/[0.08] rounded-xl p-4 mb-4">
        <p className="text-gray-500 text-[11px] leading-relaxed">
          Cek <strong className="text-gray-400">inbox, spam, atau folder promosi</strong> kamu. Email dari <span className="text-cyan-400/70">noreply@luxtradee.web.id</span>
        </p>
      </div>

      <div className="bg-emerald-500/5 border border-emerald-500/20 rounded-xl p-4 mb-6">
        <p className="text-emerald-400/80 text-xs leading-relaxed">
          Langkah selanjutnya: Buka email, klik tombol &quot;Verifikasi Email Saya&quot;, lalu login ke dashboard.
        </p>
      </div>

      <p className="text-gray-500 text-[10px] font-[JetBrains_Mono,monospace] mb-6 text-center">
        Link verifikasi berlaku 24 jam.
      </p>

      <button
        onClick={onLogin}
        className="w-full py-3.5 bg-gradient-to-r from-blue-500 to-cyan-400 text-white text-sm font-medium rounded-xl flex items-center justify-center gap-2 transition-all duration-300"
        style={{
          boxShadow: '0 0 0 1px rgba(255,255,255,0.1) inset, 0 4px 15px rgba(6, 182, 212, 0.3)',
        }}
      >
        Login Sekarang <ArrowRight className="w-4 h-4" />
      </button>
    </GlassCard>
  )
}

// ============================================
// Sign Up Form Component
// ============================================
function SignUpForm() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [fullName, setFullName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [deviceId, setDeviceId] = useState('')
  const [referralCode, setReferralCode] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState(false)
  const [needsSetup, setNeedsSetup] = useState(false)
  const [ageConfirmed, setAgeConfirmed] = useState(false)
  const [fieldErrors, setFieldErrors] = useState<Record<string, boolean>>({})

  useEffect(() => {
    setDeviceId(generateDeviceId())
    const ref = searchParams.get('ref')
    if (ref) setReferralCode(ref.toUpperCase())
  }, [searchParams])

  const hasMinLength = password.length >= 8
  const hasUppercase = /[A-Z]/.test(password)
  const hasLowercase = /[a-z]/.test(password)
  const hasNumber = /[0-9]/.test(password)
  const hasSpecial = /[!@#$%^&*()_+\-=\[\]{};':"|<>,.?\/`~]/.test(password)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setFieldErrors({})

    if (!hasMinLength || !hasUppercase || !hasLowercase || !hasNumber || !hasSpecial) {
      setError('Password tidak memenuhi syarat')
      return
    }

    setIsLoading(true)

    try {
      const res = await fetch('/api/auth/signup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email, password, fullName,
          deviceId: deviceId || null,
          referralCode: referralCode || null,
        }),
      })
      const data = await res.json()

      if (!res.ok) {
        if (data.needsSetup || data.code === 'DB_NOT_SETUP') {
          setNeedsSetup(true)
          setError('Pendaftaran berhasil! Silakan cek email untuk verifikasi.')
        } else {
          setError(data.error || 'Gagal membuat akun')
        }
        setIsLoading(false)
        return
      }

      if (data.emailSent) {
        setSuccess(true)
        setTimeout(() => router.push('/auth/login'), 3000)
      } else {
        setError(
          'Akun dibuat, tapi gagal mengirim email verifikasi. ' +
          'Silakan hubungi admin LuxTrade atau coba kirim ulang dari halaman login.'
        )
      }
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error'
      setError(errorMessage)
    } finally {
      setIsLoading(false)
    }
  }

  if (success) {
    return (
      <div className="min-h-screen bg-[#030305] flex items-center justify-center p-4 antialiased auth-signup-page">
        <AuthBackground />
        <div className="noise-overlay" />
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="w-full flex flex-col items-center relative z-10"
        >
          <SuccessScreen email={email} onLogin={() => router.push('/auth/login')} />
          <div className="text-center mt-8">
            <p className="text-[10px] text-gray-700 font-[JetBrains_Mono,monospace] uppercase tracking-widest">
              © 2026 LuxTrade. All rights reserved.
            </p>
          </div>
          <style jsx global>{`
            @keyframes float-orb { 0%,100%{transform:translate(0,0) scale(1)} 33%{transform:translate(40px,-50px) scale(1.1)} 66%{transform:translate(-30px,40px) scale(0.9)} }
          `}</style>
        </motion.div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-[#030305] flex items-center justify-center p-4 antialiased auth-signup-page">
      <AuthBackground />

      {/* Noise Overlay */}
      <div
        className="fixed inset-0 z-[9999] pointer-events-none opacity-[0.03]"
        style={{
          mixBlendMode: 'overlay',
          backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noiseFilter'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.65' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noiseFilter)'/%3E%3C/svg%3E")`,
        }}
      />

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6 }}
        className="w-full flex flex-col items-center relative z-10"
      >
        <GlassCard className="p-8 md:p-10">
          {/* Spinning Logo */}
          <SpinningLogo />

          {/* Header */}
          <div className="mb-8 text-center" style={{ transform: 'translateZ(20px)' }}>
            <h1 className="text-2xl font-light text-white tracking-wide mb-2">
              Buat Akun Baru
            </h1>
            <p className="text-xs text-gray-500 font-[JetBrains_Mono,monospace]">
              Mulai bangun edge trading Anda hari ini.
            </p>
          </div>

          {/* Error Message */}
          <AnimatePresence>
            {error && !needsSetup && (
              <motion.div
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="flex items-start gap-2 p-3 mb-4 bg-red-500/10 border border-red-500/30 rounded-lg text-red-400 text-sm"
              >
                <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
                <span>{error}</span>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Database Setup Warning */}
          <AnimatePresence>
            {needsSetup && (
              <motion.div
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="p-3 mb-4 bg-blue-500/10 border border-blue-500/20 rounded-lg"
              >
                <div className="flex items-start gap-2">
                  <CheckCircle className="w-4 h-4 text-blue-400 flex-shrink-0 mt-0.5" />
                  <div>
                    <p className="text-blue-400 text-xs font-medium">Pendaftaran akan tetap dilanjutkan</p>
                    <p className="text-gray-500 text-xs mt-1">Tabel database opsional. Akun tetap akan dibuat di Supabase Auth.</p>
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          <form onSubmit={handleSubmit} className="space-y-4" style={{ transform: 'translateZ(20px)' }}>
            {/* Full Name */}
            <div>
              <label className="text-[10px] font-[JetBrains_Mono,monospace] text-gray-500 uppercase tracking-widest mb-2 block">
                Nama Lengkap
              </label>
              <LuxInput
                id="fullName"
                type="text"
                placeholder="Trader LuxTrade"
                value={fullName}
                onChange={(e) => { setFullName(e.target.value); setFieldErrors(prev => ({ ...prev, fullName: false })) }}
                required
                icon={User}
                error={fieldErrors.fullName}
              />
            </div>

            {/* Email */}
            <div>
              <label className="text-[10px] font-[JetBrains_Mono,monospace] text-gray-500 uppercase tracking-widest mb-2 block">
                Email
              </label>
              <LuxInput
                id="email"
                type="email"
                placeholder="trader@luxtradee.com"
                value={email}
                onChange={(e) => { setEmail(e.target.value); setFieldErrors(prev => ({ ...prev, email: false })) }}
                required
                icon={Mail}
                error={fieldErrors.email}
                mono
              />
            </div>

            {/* Password */}
            <div>
              <label className="text-[10px] font-[JetBrains_Mono,monospace] text-gray-500 uppercase tracking-widest mb-2 block">
                Password
              </label>
              <LuxInput
                id="password"
                type={showPassword ? 'text' : 'password'}
                placeholder="Min. 8 karakter"
                value={password}
                onChange={(e) => { setPassword(e.target.value); setFieldErrors(prev => ({ ...prev, password: false })) }}
                required
                icon={Lock}
                error={fieldErrors.password}
                mono
                rightElement={
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="text-white/30 hover:text-cyan-400 transition-colors duration-200 bg-transparent border-none cursor-pointer"
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                }
              />

              {/* Password Strength Indicators */}
              {password && (
                <div className="grid grid-cols-2 gap-2 mt-2">
                  {[
                    { ok: hasMinLength, label: 'Min. 8 karakter' },
                    { ok: hasUppercase, label: 'Huruf besar' },
                    { ok: hasLowercase, label: 'Huruf kecil' },
                    { ok: hasNumber, label: 'Angka' },
                    { ok: hasSpecial, label: 'Simbol (!@#)' },
                  ].map((item) => (
                    <div key={item.label} className={`flex items-center gap-1.5 text-[11px] ${item.ok ? 'text-emerald-400' : 'text-gray-600'}`}>
                      <div className={`w-1.5 h-1.5 rounded-full ${item.ok ? 'bg-emerald-400' : 'bg-white/20'}`} />
                      {item.label}
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Referral Code */}
            <div>
              <label className="text-[10px] font-[JetBrains_Mono,monospace] text-gray-500 uppercase tracking-widest mb-2 block">
                Kode Referral / Promo <span className="text-gray-600">(Opsional)</span>
              </label>
              <LuxInput
                id="referralCode"
                type="text"
                placeholder="TRADERCEPAT"
                value={referralCode}
                onChange={(e) => setReferralCode(e.target.value.toUpperCase())}
                icon={Tag}
                mono
              />
            </div>

            {/* Terms Checkbox */}
            <LuxCheckbox
              checked={ageConfirmed}
              onChange={setAgeConfirmed}
              label={
                <>
                  Saya menyetujui{' '}
                  <a href="/terms" className="text-cyan-400 hover:underline">Syarat & Ketentuan</a>
                  {' '}serta{' '}
                  <a href="/privacy" className="text-cyan-400 hover:underline">Kebijakan Privasi</a>
                  {' '}LuxTrade.
                </>
              }
            />

            {/* Submit Button */}
            <div style={{ transform: 'translateZ(40px)' }} className="pt-4">
              <button
                type="submit"
                disabled={isLoading || !ageConfirmed}
                className="w-full py-3.5 bg-gradient-to-r from-blue-500 to-cyan-400 text-white text-sm font-medium rounded-xl flex items-center justify-center gap-2 transition-all duration-300 disabled:opacity-50"
                style={{
                  boxShadow: '0 0 0 1px rgba(255,255,255,0.1) inset, 0 4px 15px rgba(6, 182, 212, 0.3)',
                }}
              >
                {isLoading ? (
                  <><Loader2 className="w-4 h-4 animate-spin" /> Membuat akun...</>
                ) : (
                  <>Buat Akun Gratis <Sparkles className="w-4 h-4" /></>
                )}
              </button>

              <p className="mt-4 text-[10px] text-gray-600 flex items-center justify-center gap-1.5 font-[JetBrains_Mono,monospace]">
                <ShieldCheck className="w-3 h-3" /> Data Anda dilindungi enkripsi end-to-end
              </p>
            </div>
          </form>

          {/* Login Link */}
          <div className="mt-6 text-center">
            <p className="text-xs text-gray-500 font-light">
              Sudah punya akun?{' '}
              <Link href="/auth/login" className="text-cyan-400 font-medium hover:underline transition-all ml-1">
                Masuk di sini
              </Link>
            </p>
          </div>
        </GlassCard>

        {/* Footer */}
        <div className="text-center mt-8">
          <p className="text-[10px] text-gray-700 font-[JetBrains_Mono,monospace] uppercase tracking-widest">
            © 2026 LuxTrade. All rights reserved.
          </p>
        </div>
      </motion.div>

      {/* Keyframe styles */}
      <style jsx global>{`
        @keyframes float-orb {
          0%, 100% { transform: translate(0, 0) scale(1); }
          33% { transform: translate(40px, -50px) scale(1.1); }
          66% { transform: translate(-30px, 40px) scale(0.9); }
        }
        @keyframes shake {
          0%, 100% { transform: translateX(0); }
          25% { transform: translateX(-8px); }
          75% { transform: translateX(8px); }
        }
      `}</style>
    </div>
  )
}

// ============================================
// Main Component
// ============================================
function SignUpLoading() {
  return (
    <div className="min-h-screen bg-[#030305] flex items-center justify-center">
      <Loader2 className="w-8 h-8 text-blue-400 animate-spin" />
    </div>
  )
}

export default function SignUpPage() {
  return (
    <Suspense fallback={<SignUpLoading />}>
      <SignUpForm />
    </Suspense>
  )
}