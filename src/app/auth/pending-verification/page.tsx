'use client'

import { Suspense } from 'react'
import { motion } from 'framer-motion'
import Link from 'next/link'
import Image from 'next/image'
import { useRouter } from 'next/navigation'
import {
  Mail, Clock, ArrowRight, RefreshCw, Loader2, 
  CheckCircle, AlertCircle, Shield
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useState, useEffect, useCallback } from 'react'

function PendingVerificationForm() {
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [isLoading, setIsLoading] = useState(true)
  const [resendLoading, setResendLoading] = useState(false)
  const [resendSuccess, setResendSuccess] = useState('')
  const [resendError, setResendError] = useState('')
  const [timeLeft, setTimeLeft] = useState(0)
  const [canResend, setCanResend] = useState(false)
  const [status, setStatus] = useState<'loading' | 'unverified' | 'verified' | 'error'>('loading')

  // Check verification status
  const checkStatus = useCallback(async () => {
    try {
      const res = await fetch('/api/auth/check-verify-status')
      const data = await res.json()

      if (!res.ok) {
        setStatus('error')
        setEmail(data.email || '')
        setIsLoading(false)
        return
      }

      setEmail(data.email || '')
      setTimeLeft(data.timeLeftSeconds || 0)

      if (data.verified) {
        console.log(`✅ User verified! Source: ${data.source || 'unknown'}`)
        setStatus('verified')
      } else {
        setStatus('unverified')
      }
      setIsLoading(false)
    } catch {
      setStatus('error')
      setIsLoading(false)
    }
  }, [])

  useEffect(() => {
    checkStatus()
  }, [checkStatus])

  // Auto-poll verification status every 5 seconds when unverified
  // This catches the case where user verifies in another tab/window
  useEffect(() => {
    if (status !== 'unverified' || isLoading) return

    const pollInterval = setInterval(() => {
      checkStatus()
    }, 5000) // poll every 5 seconds

    return () => clearInterval(pollInterval)
  }, [status, isLoading, checkStatus])

  // Countdown timer
  useEffect(() => {
    if (timeLeft <= 0) {
      if (status === 'unverified') setCanResend(true)
      return
    }

    setCanResend(false)
    const timer = setInterval(() => {
      setTimeLeft(prev => {
        if (prev <= 1) {
          clearInterval(timer)
          if (status === 'unverified') setCanResend(true)
          return 0
        }
        return prev - 1
      })
    }, 1000)

    return () => clearInterval(timer)
  }, [timeLeft, status])

  // Format time
  const formatTime = (seconds: number) => {
    const h = Math.floor(seconds / 3600)
    const m = Math.floor((seconds % 3600) / 60)
    const s = seconds % 60
    if (h > 0) return `${h}j ${m}m ${s}d`
    if (m > 0) return `${m}m ${s}d`
    return `${s}d`
  }

  const handleResend = async () => {
    if (!email || !canResend || resendLoading) return
    setResendLoading(true)
    setResendSuccess('')
    setResendError('')

    try {
      const res = await fetch('/api/auth/resend-verification', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email })
      })
      const data = await res.json()

      if (res.ok) {
        setResendSuccess(data.message || 'Link verifikasi baru sudah dikirim!')
        setCanResend(false)
        setTimeLeft(300)
        checkStatus()
      } else {
        setResendError(data.error || 'Gagal mengirim email.')
      }
    } catch {
      setResendError('Terjadi kesalahan. Coba lagi ya.')
    } finally {
      setResendLoading(false)
    }
  }

  // Loading
  if (isLoading) {
    return (
      <div className="w-full max-w-md text-center">
        <div className="bg-white/[0.02] border border-white/[0.05] rounded-2xl p-8 backdrop-blur-sm">
          <Loader2 className="w-10 h-10 text-amber-500 mx-auto mb-4 animate-spin" />
          <p className="text-white/60">Memeriksa status akun...</p>
        </div>
      </div>
    )
  }

  // Already verified — redirect to login
  if (status === 'verified') {
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
          <h2 className="text-xl font-bold text-white mb-2">Email Sudah Terverifikasi! ✅</h2>
          <p className="text-white/60 text-sm mb-6">
            Akun kamu sudah aktif. Langsung login aja!
          </p>
          <Button
            onClick={() => router.push('/auth/login')}
            className="w-full h-12 bg-gradient-to-r from-amber-500 to-orange-600 text-white font-semibold shadow-lg shadow-amber-500/25"
          >
            Login Sekarang
            <ArrowRight className="w-4 h-4 ml-2" />
          </Button>
        </div>
      </motion.div>
    )
  }

  // Unverified — main content
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="w-full max-w-md"
    >
      <div className="bg-white/[0.02] border border-white/[0.05] rounded-2xl p-8 backdrop-blur-sm">
        {/* Header Icon */}
        <div className="text-center mb-6">
          <div className="w-20 h-20 rounded-full bg-amber-500/10 border-2 border-amber-500/30 flex items-center justify-center mx-auto mb-4">
            <Mail className="w-10 h-10 text-amber-400" />
          </div>
          <h1 className="text-2xl font-bold text-white mb-2">Verifikasi Email Kamu 📬</h1>
          <p className="text-white/50 text-sm">
            Kami kirim link verifikasi ke email kamu. Buka email dan klik tombol verifikasi.
          </p>
        </div>

        {/* Email Display */}
        {email && (
          <div className="bg-white/[0.03] border border-white/10 rounded-xl p-4 mb-6 text-center">
            <p className="text-white/40 text-xs mb-1">Email terdaftar:</p>
            <p className="text-amber-400 font-semibold">{email}</p>
          </div>
        )}

        {/* Countdown Timer */}
        {timeLeft > 0 && (
          <div className="bg-amber-500/5 border border-amber-500/20 rounded-xl p-4 mb-6 text-center">
            <div className="flex items-center justify-center gap-2 mb-2">
              <Clock className="w-5 h-5 text-amber-400" />
              <span className="text-white/70 text-sm font-medium">Waktu tersisa untuk verifikasi</span>
            </div>
            <p className="text-2xl font-bold text-amber-400 font-mono">
              {formatTime(timeLeft)}
            </p>
            <p className="text-white/30 text-xs mt-1">
              {timeLeft > 3600 
                ? 'Segera verifikasi sebelum link kadaluarsa'
                : timeLeft > 300
                  ? 'Link masih berlaku, cek email kamu sekarang'
                  : 'Hampir habis! Buruan verifikasi atau kirim ulang'
              }
            </p>
          </div>
        )}

        {/* Expired Warning */}
        {timeLeft === 0 && status === 'unverified' && (
          <div className="bg-red-500/5 border border-red-500/20 rounded-xl p-4 mb-6 text-center">
            <div className="flex items-center justify-center gap-2 mb-2">
              <AlertCircle className="w-5 h-5 text-red-400" />
              <span className="text-red-400 text-sm font-medium">Link Verifikasi Sudah Kadaluarsa</span>
            </div>
            <p className="text-white/40 text-xs">
              Link verifikasi kamu sudah expired. Kirim ulang link baru di bawah.
            </p>
          </div>
        )}

        {/* Resend Section */}
        <div className="space-y-4">
          {/* Status Messages */}
          {resendSuccess && (
            <motion.div
              initial={{ opacity: 0, y: -5 }}
              animate={{ opacity: 1, y: 0 }}
              className="flex items-center gap-2 p-3 bg-emerald-500/10 border border-emerald-500/30 rounded-lg text-emerald-400 text-sm"
            >
              <CheckCircle className="w-4 h-4 flex-shrink-0" />
              <span>{resendSuccess}</span>
            </motion.div>
          )}

          {resendError && (
            <motion.div
              initial={{ opacity: 0, y: -5 }}
              animate={{ opacity: 1, y: 0 }}
              className="flex items-center gap-2 p-3 bg-red-500/10 border border-red-500/30 rounded-lg text-red-400 text-sm"
            >
              <AlertCircle className="w-4 h-4 flex-shrink-0" />
              <span>{resendError}</span>
            </motion.div>
          )}

          {/* Resend Button */}
          <Button
            onClick={handleResend}
            disabled={!canResend || resendLoading || !email}
            className="w-full h-11 bg-gradient-to-r from-amber-500 to-orange-600 hover:from-amber-600 hover:to-orange-700 text-white font-medium shadow-lg shadow-amber-500/20 disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {resendLoading ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Mengirim...
              </>
            ) : timeLeft > 0 && !canResend ? (
              <>
                <Clock className="w-4 h-4 mr-2" />
                Kirim Ulang ({formatTime(timeLeft)})
              </>
            ) : (
              <>
                <RefreshCw className="w-4 h-4 mr-2" />
                Kirim Ulang Link Verifikasi
              </>
            )}
          </Button>

          {/* Security Note */}
          <div className="flex items-start gap-2 p-3 bg-white/[0.02] rounded-lg">
            <Shield className="w-4 h-4 text-white/20 flex-shrink-0 mt-0.5" />
            <p className="text-white/30 text-xs">
              Untuk keamanan, akun kamu belum bisa diakses sampai email diverifikasi. 
              Link verifikasi berlaku <strong className="text-white/50">24 jam</strong>.
            </p>
          </div>
        </div>

        {/* Action Links */}
        <div className="mt-6 pt-4 border-t border-white/10 space-y-3">
          <Button
            onClick={() => router.push('/auth/login')}
            variant="ghost"
            className="w-full text-white/50 hover:text-white hover:bg-white/5 h-10"
          >
            ← Kembali ke Login
          </Button>
          <p className="text-center text-white/30 text-xs">
            Salah email?{' '}
            <Link href="/auth/signup" className="text-amber-400/70 hover:text-amber-400 transition-colors">
              Daftar dengan email lain
            </Link>
          </p>
        </div>
      </div>
    </motion.div>
  )
}

function PendingVerificationLoading() {
  return (
    <div className="min-h-screen bg-[#0a0612] flex items-center justify-center p-4">
      <div className="w-full max-w-md text-center">
        <Loader2 className="w-10 h-10 text-amber-500 mx-auto mb-4 animate-spin" />
        <p className="text-white/60">Loading...</p>
      </div>
    </div>
  )
}

export default function PendingVerificationPage() {
  return (
    <div className="min-h-screen bg-[#0a0612] flex items-center justify-center p-4">
      {/* Background Effects */}
      <div className="fixed inset-0 -z-10">
        <div className="absolute inset-0 bg-gradient-to-b from-[#0a0612] via-[#110a1f] to-[#0a0612]" />
        <div className="absolute top-0 left-1/4 w-[600px] h-[600px] bg-amber-500/5 rounded-full blur-[150px]" />
        <div className="absolute bottom-1/4 right-1/4 w-[400px] h-[400px] bg-purple-500/10 rounded-full blur-[100px]" />
      </div>

      <Suspense fallback={<PendingVerificationLoading />}>
        <PendingVerificationForm />
      </Suspense>
    </div>
  )
}
