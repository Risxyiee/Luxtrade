'use client'

import React, { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import Link from 'next/link'
import Image from 'next/image'
import { useRouter } from 'next/navigation'
import { useSearchParams } from 'next/navigation'
import { 
  Crown, Mail, Lock, Eye, EyeOff, ArrowRight, 
  AlertCircle, Loader2, User, CheckCircle, Gift
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { supabase } from '@/lib/supabase'

// ============================================
// Generate simple device fingerprint
// ============================================
function generateDeviceId(): string {
  if (typeof window === 'undefined') return ''
  
  const canvas = document.createElement('canvas')
  const ctx = canvas.getContext('2d')
  let fingerprint = ''
  
  try {
    // Canvas fingerprint
    if (ctx) {
      ctx.textBaseline = 'top'
      ctx.font = '14px Arial'
      ctx.fillText('fingerprint', 2, 2)
      fingerprint += canvas.toDataURL().slice(-50)
    }
    
    // Screen info
    fingerprint += `${screen.width}x${screen.height}x${screen.colorDepth}`
    
    // Timezone
    fingerprint += Intl.DateTimeFormat().resolvedOptions().timeZone
    
    // Language
    fingerprint += navigator.language
    
    // Platform
    fingerprint += navigator.platform
    
    // Simple hash
    let hash = 0
    for (let i = 0; i < fingerprint.length; i++) {
      const char = fingerprint.charCodeAt(i)
      hash = ((hash << 5) - hash) + char
      hash = hash & hash
    }
    
    return `DEV${Math.abs(hash).toString(36).toUpperCase()}`
  } catch {
    // Fallback
    return `DEV${Date.now().toString(36).toUpperCase()}`
  }
}

// ============================================
// Inner component that uses useSearchParams
// ============================================
function SignUpForm() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [fullName, setFullName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [referralCode, setReferralCode] = useState('')
  const [deviceId, setDeviceId] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState(false)
  const [userReferralCode, setUserReferralCode] = useState('')

  // ============================================
  // Get referral code from URL and generate device ID
  // ============================================
  useEffect(() => {
    // Get referral code from URL (e.g., ?ref=LUXABC)
    const ref = searchParams.get('ref') || searchParams.get('referral')
    if (ref) {
      setReferralCode(ref.toUpperCase())
    }
    
    // Generate device fingerprint
    setDeviceId(generateDeviceId())
  }, [searchParams])

  // Password strength check
  const hasMinLength = password.length >= 8
  const hasUppercase = /[A-Z]/.test(password)
  const hasLowercase = /[a-z]/.test(password)
  const hasNumber = /[0-9]/.test(password)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')

    if (!hasMinLength || !hasUppercase || !hasLowercase || !hasNumber) {
      setError('Password tidak memenuhi syarat')
      return
    }

    setIsLoading(true)

    console.log('🚀 SIGNUP ATTEMPT ===============')
    console.log('👤 Full Name:', fullName)
    console.log('📧 Email:', email)
    console.log('🔑 Referral Code:', referralCode || 'None')
    console.log('📱 Device ID:', deviceId)
    console.log('================================')

    try {
      // Call our API instead of directly using Supabase
      // This handles referral code and device tracking
      const res = await fetch('/api/auth/signup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email,
          password,
          fullName,
          referralCode: referralCode || null,
          deviceId: deviceId || null
        })
      })

      const data = await res.json()

      if (!res.ok) {
        console.error('❌ Signup error:', data.error)
        setError(data.error || 'Gagal membuat akun')
        setIsLoading(false)
        return
      }

      // Success!
      console.log('✅ User created:', data.user?.id)
      if (data.user?.referralCode) {
        setUserReferralCode(data.user.referralCode)
      }
      setSuccess(true)
      
      // Redirect to dashboard after delay
      setTimeout(() => {
        window.location.href = '/dashboard'
      }, 3000)

    } catch (err: unknown) {
      console.error('❌ EXCEPTION:', err)
      const errorMessage = err instanceof Error ? err.message : 'Unknown error'
      setError(errorMessage)
    } finally {
      setIsLoading(false)
    }
  }

  if (success) {
    return (
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="w-full max-w-md text-center"
      >
        <div className="bg-white/[0.02] border border-white/[0.05] rounded-2xl p-8 backdrop-blur-sm">
          <div className="w-16 h-16 rounded-full bg-emerald-500/20 flex items-center justify-center mx-auto mb-4">
            <CheckCircle className="w-8 h-8 text-emerald-400" />
          </div>
          <h2 className="text-2xl font-bold text-white mb-2">Pendaftaran Berhasil!</h2>
          <p className="text-white/60 text-sm mb-4">
            Silakan cek email/spam kamu untuk verifikasi:
          </p>
          <p className="text-amber-400 font-semibold text-lg mb-4">
            {email}
          </p>
          
          {/* Show user's referral code */}
          {userReferralCode && (
            <div className="bg-purple-500/10 border border-purple-500/20 rounded-lg p-4 mb-4">
              <p className="text-purple-400 text-sm font-medium mb-2">🎁 Kode Referral Kamu:</p>
              <p className="text-2xl font-bold text-white font-mono">{userReferralCode}</p>
              <p className="text-white/40 text-xs mt-1">Bagikan kode ini dan dapatkan komisi 30%!</p>
            </div>
          )}
          
          <div className="bg-white/[0.03] rounded-lg p-4 mb-6">
            <p className="text-white/30 text-xs">
              💡 <strong className="text-white/50">Tips:</strong> Tidak menerima email? Cek folder spam atau promosi.
            </p>
          </div>
          <p className="text-white/40 text-sm mb-6">
            Kamu akan dialihkan ke dashboard dalam beberapa detik...
          </p>
          <Button 
            onClick={() => window.location.href = '/dashboard'}
            className="w-full bg-gradient-to-r from-purple-500 to-violet-600 text-white font-semibold"
          >
            Lanjut ke Dashboard
            <ArrowRight className="w-4 h-4 ml-2" />
          </Button>
        </div>
      </motion.div>
    )
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5 }}
      className="w-full max-w-md"
    >
      {/* Logo */}
      <div className="text-center mb-8">
        <Link href="/" className="inline-flex items-center gap-3">
          <Image 
            src="/logo.png" 
            alt="LuxTrade Logo" 
            width={48} 
            height={48}
            className="rounded-xl shadow-lg shadow-purple-500/20"
          />
          <span className="text-2xl font-bold bg-gradient-to-r from-amber-200 via-amber-400 to-amber-200 bg-clip-text text-transparent">
            LuxTrade
          </span>
        </Link>
      </div>

      {/* Sign Up Card */}
      <div className="bg-white/[0.02] border border-white/[0.05] rounded-2xl p-8 backdrop-blur-sm">
        <div className="text-center mb-6">
          <h1 className="text-2xl font-bold text-white mb-2">Buat Akun Gratis</h1>
          <p className="text-white/40 text-sm">Mulai tracking trading Anda hari ini</p>
        </div>

        {/* Referral Bonus Banner */}
        {referralCode && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex items-center gap-3 p-3 mb-4 bg-purple-500/10 border border-purple-500/30 rounded-lg"
          >
            <Gift className="w-5 h-5 text-purple-400 flex-shrink-0" />
            <div>
              <p className="text-purple-400 text-sm font-medium">🎁 Referral Bonus!</p>
              <p className="text-white/60 text-xs">Kode <span className="text-white font-mono">{referralCode}</span> akan memberikan bonus</p>
            </div>
          </motion.div>
        )}

        {/* Error Message */}
        {error && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex items-center gap-2 p-3 mb-4 bg-red-500/10 border border-red-500/30 rounded-lg text-red-400 text-sm"
          >
            <AlertCircle className="w-4 h-4 flex-shrink-0" />
            <span>{error}</span>
          </motion.div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Full Name */}
          <div className="space-y-2">
            <Label htmlFor="fullName" className="text-white/70 text-sm">Nama Lengkap</Label>
            <div className="relative">
              <User className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-white/30" />
              <Input
                id="fullName"
                type="text"
                placeholder="John Doe"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                required
                className="pl-10 h-12 bg-white/[0.03] border-white/10 text-white placeholder:text-white/30 focus:border-amber-500/50 focus:ring-amber-500/20"
              />
            </div>
          </div>

          {/* Email */}
          <div className="space-y-2">
            <Label htmlFor="email" className="text-white/70 text-sm">Email</Label>
            <div className="relative">
              <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-white/30" />
              <Input
                id="email"
                type="email"
                placeholder="your@email.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className="pl-10 h-12 bg-white/[0.03] border-white/10 text-white placeholder:text-white/30 focus:border-amber-500/50 focus:ring-amber-500/20"
              />
            </div>
          </div>

          {/* Password */}
          <div className="space-y-2">
            <Label htmlFor="password" className="text-white/70 text-sm">Password</Label>
            <div className="relative">
              <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-white/30" />
              <Input
                id="password"
                type={showPassword ? 'text' : 'password'}
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                className="pl-10 pr-10 h-12 bg-white/[0.03] border-white/10 text-white placeholder:text-white/30 focus:border-amber-500/50 focus:ring-amber-500/20"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-white/30 hover:text-white/60 transition-colors"
              >
                {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
              </button>
            </div>
            
            {/* Password Strength Indicators */}
            {password && (
              <div className="grid grid-cols-2 gap-2 mt-2">
                <div className={`flex items-center gap-1.5 text-xs ${hasMinLength ? 'text-emerald-400' : 'text-white/30'}`}>
                  <div className={`w-1.5 h-1.5 rounded-full ${hasMinLength ? 'bg-emerald-400' : 'bg-white/20'}`} />
                  Min. 8 karakter
                </div>
                <div className={`flex items-center gap-1.5 text-xs ${hasUppercase ? 'text-emerald-400' : 'text-white/30'}`}>
                  <div className={`w-1.5 h-1.5 rounded-full ${hasUppercase ? 'bg-emerald-400' : 'bg-white/20'}`} />
                  Huruf besar
                </div>
                <div className={`flex items-center gap-1.5 text-xs ${hasLowercase ? 'text-emerald-400' : 'text-white/30'}`}>
                  <div className={`w-1.5 h-1.5 rounded-full ${hasLowercase ? 'bg-emerald-400' : 'bg-white/20'}`} />
                  Huruf kecil
                </div>
                <div className={`flex items-center gap-1.5 text-xs ${hasNumber ? 'text-emerald-400' : 'text-white/30'}`}>
                  <div className={`w-1.5 h-1.5 rounded-full ${hasNumber ? 'bg-emerald-400' : 'bg-white/20'}`} />
                  Angka
                </div>
              </div>
            )}
          </div>

          {/* Referral Code (Optional) */}
          <div className="space-y-2">
            <Label htmlFor="referralCode" className="text-white/70 text-sm">
              Kode Referral <span className="text-white/40">(opsional)</span>
            </Label>
            <div className="relative">
              <Gift className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-white/30" />
              <Input
                id="referralCode"
                type="text"
                placeholder="LUXXXX"
                value={referralCode}
                onChange={(e) => setReferralCode(e.target.value.toUpperCase())}
                maxLength={15}
                className="pl-10 h-12 bg-white/[0.03] border-white/10 text-white placeholder:text-white/30 focus:border-purple-500/50 focus:ring-purple-500/20 font-mono uppercase"
              />
            </div>
            <p className="text-white/30 text-xs">Punya kode referral? Dapatkan bonus saat upgrade PRO!</p>
          </div>

          {/* Terms */}
          <p className="text-xs text-white/40">
            Dengan mendaftar, Anda menyetujui{' '}
            <a href="#" className="text-amber-400 hover:text-amber-300">Terms of Service</a>
            {' '}dan{' '}
            <a href="#" className="text-amber-400 hover:text-amber-300">Privacy Policy</a>
          </p>

          {/* Submit Button */}
          <Button
            type="submit"
            disabled={isLoading}
            className="w-full h-12 bg-gradient-to-r from-amber-500 to-orange-600 hover:from-amber-600 hover:to-orange-700 text-white font-semibold shadow-lg shadow-amber-500/25 disabled:opacity-50"
          >
            {isLoading ? (
              <>
                <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                Creating account...
              </>
            ) : (
              <>
                Create Account
                <ArrowRight className="w-5 h-5 ml-2" />
              </>
            )}
          </Button>
        </form>

        {/* Divider */}
        <div className="relative my-6">
          <div className="absolute inset-0 flex items-center">
            <div className="w-full border-t border-white/10" />
          </div>
          <div className="relative flex justify-center text-xs">
            <span className="px-2 bg-[#0a0612] text-white/30">atau</span>
          </div>
        </div>

        {/* Login Link */}
        <p className="text-center text-white/40 text-sm">
          Sudah punya akun?{' '}
          <Link href="/auth/login" className="text-amber-400 hover:text-amber-300 font-medium transition-colors">
            Sign in
          </Link>
        </p>
      </div>

      {/* Affiliate Info */}
      <div className="mt-4 p-4 bg-purple-500/5 border border-purple-500/10 rounded-xl">
        <div className="flex items-center gap-3">
          <Gift className="w-5 h-5 text-purple-400" />
          <div>
            <p className="text-white/80 text-sm font-medium">🎁 Program Afiliasi</p>
            <p className="text-white/40 text-xs">Ajak teman dan dapatkan komisi 30% (Rp14.700) untuk setiap upgrade PRO!</p>
          </div>
        </div>
      </div>

      {/* Back to Home */}
      <div className="text-center mt-4">
        <Link href="/" className="text-white/40 text-sm hover:text-white/60 transition-colors">
          ← Kembali ke Beranda
        </Link>
      </div>
    </motion.div>
  )
}

// ============================================
// Main component with Suspense boundary
// ============================================
import { Suspense } from 'react'

function SignUpLoading() {
  return (
    <div className="min-h-screen bg-[#0a0612] flex items-center justify-center p-4">
      <div className="w-full max-w-md text-center">
        <Loader2 className="w-10 h-10 text-purple-500 mx-auto mb-4 animate-spin" />
        <p className="text-white/60">Loading...</p>
      </div>
    </div>
  )
}

export default function SignUpPage() {
  return (
    <div className="min-h-screen bg-[#0a0612] flex items-center justify-center p-4">
      {/* Background Effects */}
      <div className="fixed inset-0 -z-10">
        <div className="absolute inset-0 bg-gradient-to-b from-[#0a0612] via-[#110a1f] to-[#0a0612]" />
        <div className="absolute top-0 left-1/4 w-[600px] h-[600px] bg-amber-500/5 rounded-full blur-[150px]" />
        <div className="absolute bottom-1/4 right-1/4 w-[400px] h-[400px] bg-purple-500/10 rounded-full blur-[100px]" />
      </div>

      <Suspense fallback={<SignUpLoading />}>
        <SignUpForm />
      </Suspense>
    </div>
  )
}
