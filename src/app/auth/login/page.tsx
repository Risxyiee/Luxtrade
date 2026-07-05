'use client'

import React, { useState, Suspense } from 'react'
import { motion } from 'framer-motion'
import Link from 'next/link'
import Image from 'next/image'
import { useRouter, useSearchParams } from 'next/navigation'
import { 
  Crown, Mail, Lock, Eye, EyeOff, ArrowRight, 
  AlertCircle, Loader2, RefreshCw
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { supabase } from '@/lib/supabase'

function LoginForm() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState('')
  const [successMessage, setSuccessMessage] = useState('')
  const [isResending, setIsResending] = useState(false)
  const [showResendButton, setShowResendButton] = useState(false)
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
        body: JSON.stringify({ email })
      })

      const data = await response.json()

      if (!response.ok) {
        setError(data.error || 'Gagal mengirim ulang email verifikasi. Coba lagi ya.')
        return
      }

      setSuccessMessage(data.message || 'Email verifikasi baru sudah dikirim. Cek inbox/spam ya!')
    } catch (err) {
      setError('Gagal kirim ulang email verifikasi. Coba lagi nanti ya.')
    } finally {
      setIsResending(false)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setIsLoading(true)

    if (!email || !password) {
      setError('Email dan password harus diisi ya')
      setIsLoading(false)
      return
    }

    try {
      const { data, error: signInError } = await supabase.auth.signInWithPassword({
        email,
        password,
      })
      
      if (signInError) {
        const errorMsg = signInError.message?.toLowerCase() || ''

        // Rate limit — don't retry
        if (errorMsg.includes('too many requests') || errorMsg.includes('rate limit')) {
          setError('Terlalu banyak percobaan login. Tunggu beberapa menit ya.')
          setIsLoading(false)
          return
        }

        // For ALL other errors (invalid credentials, email not confirmed, backend error, etc.),
        // try the admin-login fallback which handles:
        //   - Unconfirmed emails (force-confirm)
        //   - Backend errors (admin password re-set)
        //   - Corrupted auth state
        try {
          console.log('[login] Client signIn failed, trying admin-login fallback:', signInError.message)
          const adminRes = await fetch('/api/auth/admin-login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email, password })
          })
          const adminData = await adminRes.json()

          if (adminData.success && adminData.session) {
            // Restore the session in the browser client from the server-provided tokens
            const { data: setSessionData, error: setSessionError } = await supabase.auth.setSession({
              access_token: adminData.session.access_token,
              refresh_token: adminData.session.refresh_token,
            })

            if (!setSessionError && setSessionData.session) {
              // Sync user data
              try {
                await fetch('/api/auth/sync-user', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({
                    userId: adminData.session.user.id,
                    email: adminData.session.user.email,
                    fullName: adminData.session.user.user_metadata?.full_name ||
                             adminData.session.user.user_metadata?.display_name ||
                             adminData.session.user.user_metadata?.name ||
                             adminData.session.user.email?.split('@')[0]
                  })
                })
              } catch { /* non-critical */ }

              window.location.href = redirectPath
              return
            }
          }

          // Admin login also failed — show appropriate error
          if (adminData.error?.includes('tidak ditemukan') || adminData.error?.includes('not found')) {
            setError('Akun nggak ketemu. Belum daftar ya?')
          } else {
            // Show the original Supabase error for debugging transparency
            setError(`${signInError.message}. Coba lagi atau reset password.`)
          }
        } catch (fallbackErr) {
          // Network error on admin-login
          setError('Login gagal. Cek internet dan coba lagi ya.')
        }

        setIsLoading(false)
        return
      }

      if (data.session && data.user) {
        // Check if email is verified via our custom verification
        // This is a BEST-EFFORT check — failures should NEVER block login
        try {
          const verifyRes = await fetch('/api/auth/check-verified', {
            headers: { Authorization: `Bearer ${data.session.access_token}` }
          })
          
          // Only parse if we got a successful response
          if (verifyRes.ok) {
            const verifyData = await verifyRes.json()
            // Only block if we got an explicit verified: false
            if (verifyData.verified === false) {
              setError('Email belum diverifikasi. Cek inbox/spam kamu untuk link verifikasi, atau klik tombol di bawah.')
              setShowResendButton(true)
              setIsLoading(false)
              await supabase.auth.signOut()
              return
            }
          }
          // If response is not ok (401, 500, etc.) — continue login, don't block
        } catch (verifyErr) {
          // Network error — continue login, don't block
          console.warn('Could not check email verification (continuing):', verifyErr)
        }

        // Sync user to Prisma database
        try {
          await fetch('/api/auth/sync-user', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              userId: data.user.id,
              email: data.user.email,
              fullName: data.user.user_metadata?.display_name ||
                       data.user.user_metadata?.name ||
                       data.user.user_metadata?.full_name ||
                       data.user.email?.split('@')[0]
            })
          })
        } catch (syncError) {
          console.error('Error syncing user:', syncError)
          // Continue even if sync fails
        }

        // HARD REDIRECT - Use window.location for immediate navigation
        // This ensures a full page reload and prevents "stuck" states
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
    <div className="min-h-screen bg-[#0a0612] flex items-center justify-center p-4">
      {/* Background Effects */}
      <div className="fixed inset-0 -z-10">
        <div className="absolute inset-0 bg-gradient-to-b from-[#0a0612] via-[#110a1f] to-[#0a0612]" />
        <div className="absolute top-0 left-1/4 w-[600px] h-[600px] bg-amber-500/5 rounded-full blur-[150px]" />
        <div className="absolute bottom-1/4 right-1/4 w-[400px] h-[400px] bg-purple-500/10 rounded-full blur-[100px]" />
      </div>

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

        {/* Login Card */}
        <div className="bg-white/[0.02] border border-white/[0.05] rounded-2xl p-8 backdrop-blur-sm">
          <div className="text-center mb-6">
            <h1 className="text-2xl font-bold text-white mb-2">Selamat Datang Kembali 👑</h1>
            <p className="text-white/40 text-sm">Masuk ke trading journal kamu</p>
          </div>

          {/* Error Message */}
          {error && (
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              className="flex flex-col gap-2 mb-4"
            >
              <div className="flex items-center gap-2 p-3 bg-red-500/10 border border-red-500/30 rounded-lg text-red-400 text-sm">
                <AlertCircle className="w-4 h-4 flex-shrink-0" />
                <span>{error}</span>
              </div>
              {showResendButton && (
                <Button
                  type="button"
                  onClick={handleResendVerification}
                  disabled={isResending}
                  variant="outline"
                  className="w-full bg-amber-500/10 border-amber-500/30 text-amber-400 hover:bg-amber-500/20 h-10"
                >
                  {isResending ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Mengirim...
                    </>
                  ) : (
                    <>
                      <RefreshCw className="w-4 h-4 mr-2" />
                      Kirim Ulang Link Verifikasi
                    </>
                  )}
                </Button>
              )}
            </motion.div>
          )}

          {/* Success Message */}
          {successMessage && (
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              className="flex items-center gap-2 p-3 mb-4 bg-emerald-500/10 border border-emerald-500/30 rounded-lg text-emerald-400 text-sm"
            >
              <Mail className="w-4 h-4 flex-shrink-0" />
              <span>{successMessage}</span>
            </motion.div>
          )}

          <form onSubmit={handleSubmit} className="space-y-5">
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
              <div className="flex items-center justify-between">
                <Label htmlFor="password" className="text-white/70 text-sm">Password</Label>
                <Link href="/auth/forgot-password" className="text-xs text-amber-400/70 hover:text-amber-400 transition-colors">
                  Lupa Password?
                </Link>
              </div>
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
            </div>

            {/* Submit Button */}
            <Button
              type="submit"
              disabled={isLoading}
              className="w-full h-12 bg-gradient-to-r from-amber-500 to-orange-600 hover:from-amber-600 hover:to-orange-700 text-white font-semibold shadow-lg shadow-amber-500/25 disabled:opacity-50"
            >
              {isLoading ? (
                <>
                  <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                  Masuk...
                </>
              ) : (
                <>
                  Masuk
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

          {/* Sign Up Link */}
          <p className="text-center text-white/40 text-sm">
            Belum punya akun?{' '}
            <Link href="/auth/signup" className="text-amber-400 hover:text-amber-300 font-medium transition-colors">
              Daftar gratis
            </Link>
          </p>
        </div>

        {/* Back to Home */}
        <div className="text-center mt-6">
          <Link href="/" className="text-white/40 text-sm hover:text-white/60 transition-colors">
            ← Kembali ke Beranda
          </Link>
        </div>
      </motion.div>
    </div>
  )
}

export default function LoginPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-[#0a0612] flex items-center justify-center p-4">
        <Loader2 className="w-8 h-8 text-purple-500 animate-spin" />
      </div>
    }>
      <LoginForm />
    </Suspense>
  )
}
