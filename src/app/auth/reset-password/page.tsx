'use client'

import React, { useState, Suspense } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import { useRouter, useSearchParams } from 'next/navigation'
import { Lock, Eye, EyeOff, Loader2, CheckCircle, AlertCircle, ArrowRight, ShieldCheck } from 'lucide-react'

// ============================================
// Input field (matches login page .auth-input)
// ============================================
function LuxInput({ icon: Icon, placeholder, value, onChange, type = 'text', required, rightElement, error: hasError, onClearError, disabled }: {
  icon?: React.ComponentType<{ className?: string; style?: React.CSSProperties }>
  placeholder?: string
  value: string
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void
  type?: string
  required?: boolean
  rightElement?: React.ReactNode
  error?: boolean
  onClearError?: () => void
  disabled?: boolean
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
        disabled={disabled}
        className={`w-full transition-all duration-300 outline-none font-[JetBrains_Mono,monospace] ${hasError ? 'auth-input-error' : 'auth-input'} ${disabled ? 'opacity-50 cursor-not-allowed' : ''}`}
      />
      {rightElement && <div className="absolute right-3">{rightElement}</div>}
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
          display: 'flex', alignItems: 'center', justifyContent: 'center',
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
        position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}>
        <div style={{
          position: 'absolute', inset: '-60%', borderRadius: '50%',
          background: 'radial-gradient(circle, rgba(59,130,246,0.15) 0%, rgba(6,182,212,0.08) 40%, transparent 70%)',
          filter: 'blur(20px)', animation: 'auth-logo-glow 5s ease-in-out infinite', pointerEvents: 'none',
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
// Main Content
// ============================================
function ResetPasswordContent() {
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [success, setSuccess] = useState(false)
  const [error, setError] = useState('')
  const router = useRouter()
  const searchParams = useSearchParams()

  // Password strength
  const hasMinLength = password.length >= 8
  const hasUppercase = /[A-Z]/.test(password)
  const hasLowercase = /[a-z]/.test(password)
  const hasNumber = /[0-9]/.test(password)
  const passwordsMatch = password === confirmPassword && password !== ''

  const emailFromUrl = searchParams.get('email')

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')

    if (!hasMinLength || !hasUppercase || !hasLowercase || !hasNumber) {
      setError('Password minimal 8 karakter dengan huruf besar, huruf kecil, dan angka')
      return
    }
    if (password !== confirmPassword) {
      setError('Password tidak cocok')
      return
    }

    if (!emailFromUrl) {
      setError('Link reset tidak valid. Coba kirim ulang dari halaman Lupa Password.')
      return
    }

    setIsLoading(true)

    try {
      const response = await fetch('/api/auth/reset-password-public', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password, email: emailFromUrl }),
      })
      const data = await response.json()

      if (response.ok && data.success) {
        setSuccess(true)
        setTimeout(() => router.push('/auth/login'), 2000)
      } else {
        setError(data.error || 'Gagal mengubah password. Coba kirim ulang link dari halaman Lupa Password.')
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
                <h2 className="text-2xl font-light text-white tracking-wide mb-2">Password Berhasil Diubah!</h2>
                <p className="text-xs text-gray-500 font-[JetBrains_Mono,monospace]">Silakan login dengan password baru Anda.</p>
              </div>
              <Link href="/auth/login" className="block">
                <button className="auth-glow-btn w-full py-3.5">
                  Login Sekarang <ArrowRight className="w-4 h-4" />
                </button>
              </Link>
            </div>
          </div>
          <p className="text-center mt-8 text-[10px] text-gray-700 font-[JetBrains_Mono,monospace] uppercase tracking-widest">© 2026 LuxTrade. All rights reserved.</p>
        </div>
      </div>
    )
  }

  // ---- NO EMAIL (invalid link) ----
  if (!emailFromUrl) {
    return (
      <div className="auth-page">
        <AuthBg />
        <div className="auth-noise" />
        <div className="auth-perspective w-full max-w-md relative z-10">
          <div className="auth-glass-card p-8 md:p-10">
            <SpinningLogo />
            <div className="text-center">
              <div className="flex justify-center mb-6">
                <div className="w-16 h-16 rounded-full bg-red-500/20 flex items-center justify-center">
                  <AlertCircle className="w-8 h-8 text-red-400" />
                </div>
              </div>
              <h2 className="text-2xl font-light text-white tracking-wide mb-2">Link Tidak Valid</h2>
              <p className="text-xs text-gray-500 font-[JetBrains_Mono,monospace] mb-6">
                Link reset password tidak mengandung informasi email. Silakan kirim ulang dari halaman Lupa Password.
              </p>
              <Link href="/auth/forgot-password" className="block">
                <button className="auth-glow-btn w-full py-3.5">
                  Kirim Ulang Link Reset <ArrowRight className="w-4 h-4" />
                </button>
              </Link>
            </div>
          </div>
          <p className="text-center mt-8 text-[10px] text-gray-700 font-[JetBrains_Mono,monospace] uppercase tracking-widest relative z-10">© 2026 LuxTrade. All rights reserved.</p>
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
            <h1 className="text-2xl font-light text-white tracking-wide mb-2">Buat Password Baru</h1>
            <p className="text-xs text-gray-500 font-[JetBrains_Mono,monospace]">
              Untuk akun: <span className="text-cyan-400">{emailFromUrl}</span>
            </p>
          </div>

          {error && (
            <div className="flex items-start gap-2 p-3 mb-5 bg-red-500/10 border border-red-500/30 rounded-lg text-red-400 text-sm">
              <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" /><span>{error}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="text-[10px] font-[JetBrains_Mono,monospace] text-gray-500 uppercase tracking-widest mb-2 block">Password Baru</label>
              <LuxInput
                icon={Lock}
                type={showPassword ? 'text' : 'password'}
                placeholder="Min. 8 karakter"
                value={password}
                onChange={e => setPassword(e.target.value)}
                required
                mono
                rightElement={
                  <button type="button" onClick={() => setShowPassword(!showPassword)} className="text-white/30 hover:text-cyan-400 transition-colors bg-transparent border-none cursor-pointer">
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                }
              />
              {password && (
                <div className="grid grid-cols-2 gap-2 mt-2">
                  {[{ ok: hasMinLength, l: 'Min. 8 karakter' }, { ok: hasUppercase, l: 'Huruf besar' }, { ok: hasLowercase, l: 'Huruf kecil' }, { ok: hasNumber, l: 'Angka' }].map(i => (
                    <div key={i.l} className={`flex items-center gap-1.5 text-[11px] ${i.ok ? 'text-emerald-400' : 'text-gray-600'}`}>
                      <div className={`w-1.5 h-1.5 rounded-full ${i.ok ? 'bg-emerald-400' : 'bg-white/20'}`} />{i.l}
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div>
              <label className="text-[10px] font-[JetBrains_Mono,monospace] text-gray-500 uppercase tracking-widest mb-2 block">Konfirmasi Password</label>
              <LuxInput
                icon={Lock}
                type={showPassword ? 'text' : 'password'}
                placeholder="Ulangi password"
                value={confirmPassword}
                onChange={e => setConfirmPassword(e.target.value)}
                required
                mono
              />
              {confirmPassword && (
                <p className={`text-[11px] mt-2 ${passwordsMatch ? 'text-emerald-400' : 'text-red-400'}`}>
                  {passwordsMatch ? '✓ Password cocok' : '✗ Password tidak cocok'}
                </p>
              )}
            </div>

            <div className="pt-4">
              <button type="submit" disabled={isLoading} className="auth-glow-btn w-full py-3.5 disabled:opacity-50">
                {isLoading ? (
                  <><Loader2 className="w-4 h-4 animate-spin" /> Menyimpan...</>
                ) : (
                  <>Simpan Password Baru <ArrowRight className="w-4 h-4" /></>
                )}
              </button>
              <p className="mt-4 text-[10px] text-gray-600 flex items-center justify-center gap-1.5 font-[JetBrains_Mono,monospace]">
                <ShieldCheck className="w-3 h-3" /> Password dilindungi enkripsi end-to-end
              </p>
            </div>
          </form>

          <div className="mt-6 text-center">
            <Link href="/auth/login" className="inline-flex items-center gap-1.5 text-gray-500 text-xs font-light hover:text-cyan-400 transition-all">
              Kembali ke Login
            </Link>
          </div>
        </div>

        <p className="text-center mt-8 text-[10px] text-gray-700 font-[JetBrains_Mono,monospace] uppercase tracking-widest relative z-10">© 2026 LuxTrade. All rights reserved.</p>
      </div>
    </div>
  )
}

export default function ResetPasswordPage() {
  return (
    <Suspense fallback={<div className="auth-page"><Loader2 className="w-8 h-8 text-blue-400 animate-spin" /></div>}>
      <ResetPasswordContent />
    </Suspense>
  )
}
