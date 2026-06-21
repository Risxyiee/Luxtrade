'use client'

import React, { useState, useEffect, useCallback, Suspense } from 'react'
import { motion } from 'framer-motion'
import Link from 'next/link'
import Image from 'next/image'
import { useRouter, useSearchParams } from 'next/navigation'
import { Lock, Eye, EyeOff, Loader2, CheckCircle, AlertCircle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { supabase } from '@/lib/supabase'

function ResetPasswordContent() {
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [success, setSuccess] = useState(false)
  const [error, setError] = useState('')
  const [sessionStatus, setSessionStatus] = useState<'checking' | 'ready' | 'no-session'>('checking')
  const router = useRouter()
  const searchParams = useSearchParams()

  // Password strength check
  const hasMinLength = password.length >= 8
  const hasUppercase = /[A-Z]/.test(password)
  const hasLowercase = /[a-z]/.test(password)
  const hasNumber = /[0-9]/.test(password)
  const passwordsMatch = password === confirmPassword && password !== ''

  // Check for session from the reset link (multi-strategy)
  const checkSession = useCallback(async () => {
    console.log('🔑 [ResetPassword] Checking session...')

    // Try 1: direct getSession
    const { data: { session } } = await supabase.auth.getSession()
    if (session) {
      console.log('✅ [ResetPassword] Session found via getSession')
      setSessionStatus('ready')
      return
    }

    // Try 2: wait for URL hash processing
    console.log('⏳ [ResetPassword] No session yet, waiting...')
    await new Promise(resolve => setTimeout(resolve, 2000))

    const { data: { session: session2 } } = await supabase.auth.getSession()
    if (session2) {
      console.log('✅ [ResetPassword] Session found after delay')
      setSessionStatus('ready')
      return
    }

    // Try 3: onAuthStateChange
    const { data } = supabase.auth.onAuthStateChange((event, sess) => {
      console.log('🔄 [ResetPassword] Auth event:', event, 'session:', sess ? 'EXISTS' : 'NULL')
      if (sess) setSessionStatus('ready')
    })
    await new Promise(resolve => setTimeout(resolve, 2000))
    data.subscription.unsubscribe()

    const { data: { session: session3 } } = await supabase.auth.getSession()
    if (session3) {
      setSessionStatus('ready')
      return
    }

    // No session — admin API fallback will be used
    console.log('⚠️ [ResetPassword] No session, will use admin API fallback')
    setSessionStatus('no-session')
  }, [])

  useEffect(() => {
    checkSession()
  }, [checkSession])

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

    setIsLoading(true)

    try {
      // Strategy 1: Client session
      if (sessionStatus === 'ready') {
        const { error: updateError } = await supabase.auth.updateUser({ password })
        if (!updateError) {
          setSuccess(true)
          setTimeout(() => router.push('/auth/login'), 2000)
          return
        }
        console.warn('⚠️ Client update failed:', updateError.message)
        // Fall through to admin API
      }

      // Strategy 2: Admin API fallback
      const emailFromUrl = searchParams.get('email')
      if (!emailFromUrl) {
        setError('Tidak dapat mengidentifikasi akun. Coba kirim ulang link reset dari halaman login.')
        setIsLoading(false)
        return
      }

      const response = await fetch('/api/auth/reset-password-admin', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password, email: emailFromUrl }),
      })
      const data = await response.json()

      if (response.ok && data.success) {
        setSuccess(true)
        setTimeout(() => router.push('/auth/login'), 2000)
      } else {
        setError(data.error || 'Gagal mengubah password. Coba kirim ulang link dari halaman login.')
      }
    } catch {
      setError('Terjadi kesalahan. Silakan coba lagi.')
    } finally {
      setIsLoading(false)
    }
  }

  if (success) {
    return (
      <div className="min-h-screen bg-[#0a0612] flex items-center justify-center p-4">
        <div className="fixed inset-0 -z-10">
          <div className="absolute inset-0 bg-gradient-to-b from-[#0a0612] via-[#110a1f] to-[#0a0612]" />
        </div>
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="w-full max-w-md text-center"
        >
          <div className="bg-white/[0.02] border border-white/[0.05] rounded-2xl p-8 backdrop-blur-sm">
            <div className="w-16 h-16 rounded-full bg-emerald-500/20 flex items-center justify-center mx-auto mb-4">
              <CheckCircle className="w-8 h-8 text-emerald-400" />
            </div>
            <h2 className="text-2xl font-bold text-white mb-2">Password Berhasil Diubah!</h2>
            <p className="text-white/60 text-sm mb-4">Silakan login dengan password baru Anda.</p>
            <Loader2 className="w-5 h-5 text-amber-400 animate-spin mx-auto" />
          </div>
        </motion.div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-[#0a0612] flex items-center justify-center p-4">
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
        <div className="text-center mb-8">
          <Link href="/" className="inline-flex items-center gap-3">
            <Image src="/logo-premium.png" alt="LuxTrade Logo" width={48} height={48} className="rounded-xl shadow-lg shadow-amber-500/20" />
            <span className="text-2xl font-bold bg-gradient-to-r from-amber-200 via-amber-400 to-amber-200 bg-clip-text text-transparent">LuxTrade</span>
          </Link>
        </div>

        <div className="bg-white/[0.02] border border-white/[0.05] rounded-2xl p-8 backdrop-blur-sm">
          <div className="text-center mb-6">
            <h1 className="text-2xl font-bold text-white mb-2">Buat Password Baru</h1>
            <p className="text-white/40 text-sm">Masukkan password baru untuk akun Anda</p>
          </div>

          {sessionStatus === 'checking' && (
            <div className="flex items-center justify-center gap-2 py-4 text-white/40 text-sm mb-4">
              <Loader2 className="w-4 h-4 animate-spin" />
              Memverifikasi link reset...
            </div>
          )}

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
            <div className="space-y-2">
              <Label htmlFor="password" className="text-white/70 text-sm">Password Baru</Label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-white/30" />
                <Input
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  disabled={sessionStatus === 'checking'}
                  className="pl-10 pr-10 h-12 bg-white/[0.03] border-white/10 text-white placeholder:text-white/30 focus:border-amber-500/50"
                />
                <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-3 top-1/2 -translate-y-1/2 text-white/30 hover:text-white/60 transition-colors">
                  {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                </button>
              </div>
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

            <div className="space-y-2">
              <Label htmlFor="confirmPassword" className="text-white/70 text-sm">Konfirmasi Password</Label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-white/30" />
                <Input
                  id="confirmPassword"
                  type={showPassword ? 'text' : 'password'}
                  placeholder="••••••••"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  required
                  disabled={sessionStatus === 'checking'}
                  className="pl-10 h-12 bg-white/[0.03] border-white/10 text-white placeholder:text-white/30 focus:border-amber-500/50"
                />
              </div>
              {confirmPassword && (
                <p className={`text-xs ${passwordsMatch ? 'text-emerald-400' : 'text-red-400'}`}>
                  {passwordsMatch ? '✓ Password cocok' : '✗ Password tidak cocok'}
                </p>
              )}
            </div>

            <Button
              type="submit"
              disabled={isLoading || sessionStatus === 'checking'}
              className="w-full h-12 bg-gradient-to-r from-amber-500 to-orange-600 hover:from-amber-600 hover:to-orange-700 text-white font-semibold shadow-lg shadow-amber-500/25 disabled:opacity-50"
            >
              {isLoading ? (
                <><Loader2 className="w-5 h-5 mr-2 animate-spin" />Menyimpan...</>
              ) : (
                'Simpan Password Baru'
              )}
            </Button>
          </form>

          <div className="text-center mt-6">
            <Link href="/auth/login" className="inline-flex items-center gap-2 text-white/40 text-sm hover:text-white/60 transition-colors">
              Kembali ke Login
            </Link>
          </div>
        </div>
      </motion.div>
    </div>
  )
}

export default function ResetPasswordPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-[#0a0612] flex items-center justify-center">
        <Loader2 className="w-8 h-8 text-amber-400 animate-spin" />
      </div>
    }>
      <ResetPasswordContent />
    </Suspense>
  )
}
