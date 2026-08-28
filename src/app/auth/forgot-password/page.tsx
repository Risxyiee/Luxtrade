'use client'

import React, { useState, Suspense } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import { Mail, ArrowLeft, Loader2, CheckCircle, AlertCircle, ArrowRight, ShieldCheck } from 'lucide-react'

// ============================================
// Input field (matches login page .auth-input)
// ============================================
function LuxInput({ icon: Icon, placeholder, value, onChange, type = 'text', required, error: hasError, onClearError }: {
  icon?: React.ComponentType<{ className?: string; style?: React.CSSProperties }>
  placeholder?: string
  value: string
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void
  type?: string
  required?: boolean
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
        className={`w-full transition-all duration-300 outline-none font-[JetBrains_Mono,monospace] ${hasError ? 'auth-input-error' : 'auth-input'}`}
      />
    </div>
  )
}

// ============================================
// Background
// ============================================
function AuthBg() {
  return (
    <>
      <div className="auth-ambient" />
      <div className="auth-orb auth-orb-1" />
      <div className="auth-orb auth-orb-2" />
      <div className="auth-orb auth-orb-3" />
      <div className="auth-grid-floor" />
      <div className="fixed inset-0 flex items-center justify-center pointer-events-none" style={{ zIndex: 2 }}>
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
    </>
  )
}

// ============================================
// Spinning Logo
// ============================================
function SpinningLogo() {
  return (
    <div className="w-full flex justify-center mb-5 relative z-10">
      <div style={{
        animation: 'auth-logo-spin 16s linear infinite',
        width: 'clamp(60px, 14vw, 90px)',
        height: 'clamp(60px, 14vw, 90px)',
        position: 'relative',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
      }}>
        <div style={{
          position: 'absolute', inset: '-60%', borderRadius: '50%',
          background: 'radial-gradient(circle, rgba(59,130,246,0.15) 0%, rgba(6,182,212,0.08) 40%, transparent 70%)',
          filter: 'blur(20px)',
          animation: 'auth-logo-glow 5s ease-in-out infinite',
          pointerEvents: 'none',
        }} />
        <Image src="/logo.png" alt="" width={90} height={90} className="object-contain" style={{
          opacity: 0.85,
          filter: 'drop-shadow(0 0 25px rgba(59,130,246,0.5)) drop-shadow(0 0 50px rgba(6,182,212,0.3))',
        }} priority={false} />
      </div>
    </div>
  )
}

// ============================================
// Main Page
// ============================================
function ForgotPasswordContent() {
  const [email, setEmail] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [success, setSuccess] = useState(false)
  const [error, setError] = useState('')
  const [fieldError, setFieldError] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(''); setFieldError(false)

    if (!email) {
      setFieldError(true)
      setError('Email harus diisi')
      return
    }

    setIsLoading(true)

    try {
      const response = await fetch('/api/auth/send-reset-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      })

      const data = await response.json()

      if (!response.ok) {
        setError(data.error || 'Gagal mengirim link reset password.')
      } else {
        setSuccess(true)
      }
    } catch {
      setError('Terjadi kesalahan. Silakan coba lagi.')
    } finally {
      setIsLoading(false)
    }
  }

  // ---- SUCCESS SCREEN ----
  if (success) {
    return (
      <div className="auth-page">
        <AuthBg />
        <div className="auth-noise" />
        <div className="w-full flex flex-col items-center relative z-10">
          <div className="auth-perspective w-full max-w-md relative">
            <div className="auth-glass-card p-8 md:p-10">
              <SpinningLogo />
              <div className="flex justify-center mb-6">
                <div className="w-16 h-16 rounded-full bg-emerald-500/20 flex items-center justify-center">
                  <CheckCircle className="w-8 h-8 text-emerald-400" />
                </div>
              </div>
              <div className="text-center mb-6">
                <h2 className="text-2xl font-light text-white tracking-wide mb-2">Email Terkirim!</h2>
                <p className="text-xs text-gray-500 font-[JetBrains_Mono,monospace]">Kami sudah kirim link reset password ke:</p>
                <p className="text-cyan-400 font-semibold text-lg mt-3">{email}</p>
              </div>
              <div className="auth-surface rounded-xl p-4 mb-4">
                <p className="text-gray-500 text-[11px] leading-relaxed">
                  Cek <strong className="text-gray-400">inbox, spam, atau folder promosi</strong> kamu. Email dari <span className="text-cyan-400/70">noreply@luxtradee.web.id</span>
                </p>
              </div>
              <div className="auth-surface rounded-xl p-4 mb-6" style={{ borderColor: 'rgba(234,179,8,0.15)' }}>
                <p className="text-amber-400/80 text-[11px] leading-relaxed">
                  ⚠️ Link reset password cuma berlaku <strong>1 jam</strong>. Kalau kamu nggak merasa minta reset, langsung aja abaikan email ini.
                </p>
              </div>
              <Link href="/auth/login" className="block">
                <button className="auth-glow-btn w-full py-3.5">
                  Kembali ke Login <ArrowRight className="w-4 h-4" />
                </button>
              </Link>
            </div>
          </div>
          <p className="text-center mt-8 text-[10px] text-gray-700 font-[JetBrains_Mono,monospace] uppercase tracking-widest">© 2026 LuxTrade. All rights reserved.</p>
        </div>
      </div>
    )
  }

  // ---- FORM SCREEN ----
  return (
    <div className="auth-page">
      <AuthBg />
      <div className="auth-noise" />

      <div className="auth-perspective w-full max-w-md relative z-10">
        <div className="auth-glass-card p-8 md:p-10">
          <SpinningLogo />

          <div className="mb-8 text-center">
            <h1 className="text-2xl font-light text-white tracking-wide mb-2">Lupa Password?</h1>
            <p className="text-xs text-gray-500 font-[JetBrains_Mono,monospace]">Masukkan email dan kami kirim link reset password.</p>
          </div>

          {error && (
            <div className="flex items-start gap-2 p-3 mb-5 bg-red-500/10 border border-red-500/30 rounded-lg text-red-400 text-sm">
              <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" /><span>{error}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <label className="text-[10px] font-[JetBrains_Mono,monospace] text-gray-500 uppercase tracking-widest mb-2 block">Email</label>
              <LuxInput
                icon={Mail}
                placeholder="trader@luxtradee.com"
                value={email}
                onChange={e => setEmail(e.target.value)}
                required
                mono
                error={fieldError}
                onClearError={() => setFieldError(false)}
              />
            </div>

            <div className="pt-4">
              <button type="submit" disabled={isLoading} className="auth-glow-btn w-full py-3.5">
                {isLoading ? (
                  <><Loader2 className="w-4 h-4 animate-spin" /> Mengirim...</>
                ) : (
                  <>Kirim Link Reset <ArrowRight className="w-4 h-4" /></>
                )}
              </button>
              <p className="mt-4 text-[10px] text-gray-600 flex items-center justify-center gap-1.5 font-[JetBrains_Mono,monospace]">
                <ShieldCheck className="w-3 h-3" /> Link reset aman & berlaku 1 jam
              </p>
            </div>
          </form>

          <div className="mt-6 text-center">
            <Link href="/auth/login" className="inline-flex items-center gap-1.5 text-gray-500 text-xs font-light hover:text-cyan-400 transition-all">
              <ArrowLeft className="w-3.5 h-3.5" />
              Kembali ke Login
            </Link>
          </div>
        </div>

        <p className="text-center mt-8 text-[10px] text-gray-700 font-[JetBrains_Mono,monospace] uppercase tracking-widest relative z-10">© 2026 LuxTrade. All rights reserved.</p>
      </div>
    </div>
  )
}

export default function ForgotPasswordPage() {
  return (
    <Suspense fallback={<div className="auth-page"><Loader2 className="w-8 h-8 text-blue-400 animate-spin" /></div>}>
      <ForgotPasswordContent />
    </Suspense>
  )
}
