'use client'

import React, { useState, useRef, useCallback, Suspense } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import Link from 'next/link'
import Image from 'next/image'
import { useRouter, useSearchParams } from 'next/navigation'
import {
  Mail, Lock, Eye, EyeOff, ArrowRight,
  AlertCircle, Loader2, RefreshCw, ShieldCheck, Send
} from 'lucide-react'
import { supabase } from '@/lib/supabase'

// ============================================
// 3D Background Components
// ============================================
function AuthBackground() {
  return (
    <div className="fixed inset-0 -z-10 overflow-hidden">
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

      {/* 3D Wireframe Gem */}
      <div className="absolute inset-0 flex items-center justify-center pointer-events-none" style={{
        maskImage: 'radial-gradient(circle at center, black 30%, transparent 80%)',
        WebkitMaskImage: 'radial-gradient(circle at center, black 30%, transparent 80%)',
      }}>
        <svg className="w-[600px] h-[600px] opacity-[0.15]" viewBox="0 0 200 200" fill="none" xmlns="http://www.w3.org/2000/svg" style={{ animation: 'rotate-3d 20s linear infinite', filter: 'drop-shadow(0 0 20px rgba(6, 182, 212, 0.3))' }}>
          <defs>
            <linearGradient id="gemGrad" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#06b6d4" />
              <stop offset="100%" stopColor="#3b82f6" />
            </linearGradient>
          </defs>
          <polygon points="100,10 190,60 190,140 100,190 10,140 10,60" stroke="url(#gemGrad)" strokeWidth="1" fill="none"/>
          <polygon points="100,10 190,60 100,100 10,60" stroke="url(#gemGrad)" strokeWidth="1" fill="none"/>
          <polygon points="100,190 190,140 100,100 10,140" stroke="url(#gemGrad)" strokeWidth="1" fill="none"/>
          <line x1="100" y1="10" x2="100" y2="190" stroke="url(#gemGrad)" strokeWidth="0.5" />
          <line x1="10" y1="60" x2="190" y2="140" stroke="url(#gemGrad)" strokeWidth="0.5" />
          <line x1="190" y1="60" x2="10" y2="140" stroke="url(#gemGrad)" strokeWidth="0.5" />
        </svg>
      </div>

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
          className="absolute inset-0 rounded-[inherit] pointer-events-none opacity-0 hover:opacity-100 transition-opacity duration-300"
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
// Login Form Component
// ============================================
function LoginForm() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState('')
  const [successMessage, setSuccessMessage] = useState('')
  const [isResending, setIsResending] = useState(false)
  const [showResendButton, setShowResendButton] = useState(false)
  const [fieldErrors, setFieldErrors] = useState<{ email?: boolean; password?: boolean }>({})
  const router = useRouter()
  const searchParams = useSearchParams()
  const redirectPath = searchParams.get('redirect') || '/dashboard'

  const handleResendVerification = async () => {
    if (!email) {
      setError('Masukkan email kamu untuk kirim ulang link verifikasi')
      return
    }
    setIsResending(true)
    setError('')
    setSuccessMessage('')
    try {
      const response = await fetch('/api/auth/resend-verification', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      })
      const data = await response.json()
      if (!response.ok) {
        setError(data.error || 'Gagal mengirim ulang email verifikasi. Coba lagi ya.')
        return
      }
      setSuccessMessage(data.message || 'Email verifikasi baru sudah dikirim. Cek inbox/spam ya!')
    } catch {
      setError('Gagal kirim ulang email verifikasi. Coba lagi nanti ya.')
    } finally {
      setIsResending(false)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setSuccessMessage('')
    setFieldErrors({})

    const newFieldErrors: { email?: boolean; password?: boolean } = {}
    if (!email) newFieldErrors.email = true
    if (!password) newFieldErrors.password = true

    if (Object.keys(newFieldErrors).length > 0) {
      setFieldErrors(newFieldErrors)
      setError('Email dan password harus diisi ya')
      return
    }

    setIsLoading(true)

    try {
      const { data, error: signInError } = await supabase.auth.signInWithPassword({ email, password })

      if (signInError) {
        const errorMsg = signInError.message?.toLowerCase() || ''
        if (errorMsg.includes('too many requests') || errorMsg.includes('rate limit')) {
          setError('Terlalu banyak percobaan login. Tunggu beberapa menit ya.')
          setIsLoading(false)
          return
        }
        if (errorMsg.includes('email not confirmed')) {
          setError('Email belum diverifikasi. Cek inbox/spam kamu untuk link verifikasi, atau klik tombol di bawah.')
          setShowResendButton(true)
          setIsLoading(false)
          return
        }
        if (errorMsg.includes('invalid login credentials') || errorMsg.includes('invalid credentials')) {
          setError('Email atau password salah. Coba lagi atau reset password.')
          setIsLoading(false)
          return
        }
        setError(signInError.message || 'Login gagal. Coba lagi nanti ya.')
        setIsLoading(false)
        return
      }

      if (data.session && data.user) {
        try {
          await fetch('/api/auth/sync-user', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              userId: data.user.id,
              email: data.user.email,
              fullName: data.user.user_metadata?.display_name || data.user.user_metadata?.name || data.user.user_metadata?.full_name || data.user.email?.split('@')[0],
            }),
          })
        } catch (syncError) {
          console.error('Error syncing user:', syncError)
        }
        window.location.href = redirectPath
      } else {
        setError('Login gagal. Gagal membuat sesi, coba lagi ya.')
        setIsLoading(false)
      }
    } catch (err) {
      console.error('Login error:', err)
      setError('Koneksi bermasalah. Cek internet kamu dan coba lagi ya.')
      setIsLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-[#030305] flex items-center justify-center p-4 antialiased">
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
          {/* Logo */}
          <div className="flex justify-center mb-8" style={{ transform: 'translateZ(20px)' }}>
            <Link href="/" className="inline-flex items-center gap-2.5">
              <Image
                src="/logo.png"
                alt="LuxTrade Logo"
                width={32}
                height={32}
                className="object-contain"
              />
              <span className="text-xl font-light tracking-wider text-white uppercase">
                LuxTrade
              </span>
            </Link>
          </div>

          {/* Header */}
          <div className="mb-8 text-center" style={{ transform: 'translateZ(20px)' }}>
            <h1 className="text-2xl font-light text-white tracking-wide mb-2">
              Selamat Datang Kembali
            </h1>
            <p className="text-xs text-gray-500 font-[JetBrains_Mono,monospace]">
              Masuk untuk melanjutkan jurnal trading Anda.
            </p>
          </div>

          {/* Error Message */}
          <AnimatePresence>
            {error && (
              <motion.div
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="flex flex-col gap-2 mb-5"
              >
                <div className="flex items-start gap-2 p-3 bg-red-500/10 border border-red-500/30 rounded-lg text-red-400 text-sm">
                  <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
                  <span>{error}</span>
                </div>
                {showResendButton && (
                  <button
                    type="button"
                    onClick={handleResendVerification}
                    disabled={isResending}
                    className="w-full flex items-center justify-center gap-2 py-2.5 bg-blue-500/10 border border-blue-500/30 text-blue-400 text-xs font-medium rounded-lg hover:bg-blue-500/20 transition-colors disabled:opacity-50"
                  >
                    {isResending ? (
                      <><Loader2 className="w-3.5 h-3.5 animate-spin" /> Mengirim...</>
                    ) : (
                      <><RefreshCw className="w-3.5 h-3.5" /> Kirim Ulang Link Verifikasi</>
                    )}
                  </button>
                )}
              </motion.div>
            )}
          </AnimatePresence>

          {/* Success Message */}
          <AnimatePresence>
            {successMessage && (
              <motion.div
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="flex items-start gap-2 p-3 mb-5 bg-emerald-500/10 border border-emerald-500/30 rounded-lg text-emerald-400 text-sm"
              >
                <Send className="w-4 h-4 flex-shrink-0 mt-0.5" />
                <span>{successMessage}</span>
              </motion.div>
            )}
          </AnimatePresence>

          <form onSubmit={handleSubmit} className="space-y-5" style={{ transform: 'translateZ(20px)' }}>
            {/* Email */}
            <div>
              <label className="text-[10px] font-[JetBrains_Mono,monospace] text-gray-500 uppercase tracking-widest mb-2 block">
                Email atau Username
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
              <div className="flex justify-between items-center mb-2">
                <label className="text-[10px] font-[JetBrains_Mono,monospace] text-gray-500 uppercase tracking-widest">
                  Password
                </label>
                <Link
                  href="/auth/forgot-password"
                  className="text-[10px] font-[JetBrains_Mono,monospace] text-cyan-400 transition-all hover:text-cyan-300"
                  style={{ textShadow: '0 0 8px rgba(6,182,212,0.4)' }}
                >
                  Lupa Password?
                </Link>
              </div>
              <LuxInput
                id="password"
                type={showPassword ? 'text' : 'password'}
                placeholder="••••••••••••"
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
            </div>

            {/* Submit Button */}
            <div style={{ transform: 'translateZ(40px)' }}>
              <button
                type="submit"
                disabled={isLoading}
                className="w-full py-3.5 bg-gradient-to-r from-blue-500 to-cyan-400 text-white text-sm font-medium rounded-xl flex items-center justify-center gap-2 transition-all duration-300 disabled:opacity-50"
                style={{
                  boxShadow: '0 0 0 1px rgba(255,255,255,0.1) inset, 0 4px 15px rgba(6, 182, 212, 0.3)',
                }}
              >
                {isLoading ? (
                  <><Loader2 className="w-4 h-4 animate-spin" /> Masuk...</>
                ) : (
                  <>Masuk ke Dashboard <ArrowRight className="w-4 h-4" /></>
                )}
              </button>

              <p className="mt-4 text-[10px] text-gray-600 flex items-center justify-center gap-1.5 font-[JetBrains_Mono,monospace]">
                <ShieldCheck className="w-3 h-3" /> Data Anda dilindungi enkripsi end-to-end
              </p>
            </div>
          </form>

          {/* Sign Up Link */}
          <div className="mt-6 text-center">
            <p className="text-xs text-gray-500 font-light">
              Belum punya akun?{' '}
              <Link
                href="/auth/signup"
                className="text-cyan-400 font-medium hover:underline transition-all ml-1"
              >
                Daftar gratis
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

      {/* Keyframe styles (injected once) */}
      <style jsx global>{`
        @keyframes float-orb {
          0%, 100% { transform: translate(0, 0) scale(1); }
          33% { transform: translate(40px, -50px) scale(1.1); }
          66% { transform: translate(-30px, 40px) scale(0.9); }
        }
        @keyframes rotate-3d {
          0% { transform: rotateY(0deg) rotateX(20deg); }
          100% { transform: rotateY(360deg) rotateX(20deg); }
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

export default function LoginPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-[#030305] flex items-center justify-center">
          <Loader2 className="w-8 h-8 text-blue-400 animate-spin" />
        </div>
      }
    >
      <LoginForm />
    </Suspense>
  )
}
