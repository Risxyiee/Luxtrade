'use client'

import { useEffect, useState, Suspense } from 'react'
import { motion } from 'framer-motion'
import Link from 'next/link'
import Image from 'next/image'
import { useSearchParams, useRouter } from 'next/navigation'
import { CheckCircle, XCircle, Loader2, Mail, ArrowRight, RefreshCw } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'

function VerifyForm() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const token = searchParams.get('token')

  const [status, setStatus] = useState<'loading' | 'success' | 'error' | 'expired'>('loading')
  const [resendEmail, setResendEmail] = useState('')
  const [resendLoading, setResendLoading] = useState(false)
  const [resendResult, setResendResult] = useState<string | null>(null)

  useEffect(() => {
    if (!token) {
      setStatus('error')
      return
    }

    verifyToken(token)
  }, [token])

  const verifyToken = async (t: string) => {
    try {
      const res = await fetch('/api/auth/verify-email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token: t })
      })

      const data = await res.json()

      if (res.ok && data.success) {
        setStatus('success')
      } else if (res.status === 410) {
        setStatus('expired')
      } else {
        setStatus('error')
      }
    } catch {
      setStatus('error')
    }
  }

  const handleResend = async () => {
    if (!resendEmail) return
    setResendLoading(true)
    setResendResult(null)

    try {
      const res = await fetch('/api/auth/verify-email', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: resendEmail })
      })
      const data = await res.json()

      if (res.ok) {
        setResendResult('Email verifikasi baru telah dikirim!')
      } else {
        setResendResult(data.error || 'Gagal mengirim email.')
      }
    } catch {
      setResendResult('Terjadi kesalahan.')
    } finally {
      setResendLoading(false)
    }
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
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

      <div className="bg-white/[0.02] border border-white/[0.05] rounded-2xl p-8 backdrop-blur-sm">
        {/* Loading */}
        {status === 'loading' && (
          <div className="text-center">
            <Loader2 className="w-12 h-12 text-purple-500 mx-auto mb-4 animate-spin" />
            <h2 className="text-xl font-bold text-white mb-2">Memverifikasi Email...</h2>
            <p className="text-white/50 text-sm">Mohon tunggu sebentar</p>
          </div>
        )}

        {/* Success */}
        {status === 'success' && (
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="text-center"
          >
            <div className="w-16 h-16 rounded-full bg-emerald-500/20 flex items-center justify-center mx-auto mb-4">
              <CheckCircle className="w-8 h-8 text-emerald-400" />
            </div>
            <h2 className="text-xl font-bold text-white mb-2">Email Terverifikasi! ✅</h2>
            <p className="text-white/60 text-sm mb-2">
              Akun kamu sudah aktif dan siap dipakai.
            </p>
            <div className="bg-emerald-500/5 border border-emerald-500/20 rounded-lg p-3 mb-6">
              <p className="text-emerald-400/80 text-xs">
                🎉 Selamat! Kamu sekarang bisa login dan mulai menggunakan semua fitur LuxTrade.
              </p>
            </div>
            <Button
              onClick={() => router.push('/auth/login')}
              className="w-full h-12 bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-600 hover:to-teal-700 text-white font-semibold"
            >
              Login Sekarang
              <ArrowRight className="w-4 h-4 ml-2" />
            </Button>
          </motion.div>
        )}

        {/* Error */}
        {status === 'error' && (
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="text-center"
          >
            <div className="w-16 h-16 rounded-full bg-red-500/20 flex items-center justify-center mx-auto mb-4">
              <XCircle className="w-8 h-8 text-red-400" />
            </div>
            <h2 className="text-xl font-bold text-white mb-2">Verifikasi Gagal</h2>
            <p className="text-white/60 text-sm mb-2">
              Link verifikasi nggak valid atau sudah pernah dipakai.
            </p>
            <p className="text-white/40 text-sm mb-6">
              Masukkan email kamu di bawah untuk kirim ulang link verifikasi baru.
            </p>
          </motion.div>
        )}

        {/* Expired */}
        {status === 'expired' && (
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="text-center"
          >
            <div className="w-16 h-16 rounded-full bg-amber-500/20 flex items-center justify-center mx-auto mb-4">
              <Mail className="w-8 h-8 text-amber-400" />
            </div>
            <h2 className="text-xl font-bold text-white mb-2">Link Sudah Kadaluarsa ⏰</h2>
            <p className="text-white/60 text-sm mb-2">
              Link verifikasi sudah expired (berlaku 24 jam).
            </p>
            <p className="text-white/40 text-sm mb-6">
              Tenang, masukkan email kamu di bawah untuk kirim link verifikasi baru.
            </p>
          </motion.div>
        )}

        {/* Resend Form */}
        {(status === 'error' || status === 'expired') && (
          <div className="mt-6 space-y-4">
            <div className="flex gap-2">
              <Input
                type="email"
                placeholder="Email Anda"
                value={resendEmail}
                onChange={(e) => setResendEmail(e.target.value)}
                className="h-11 bg-white/[0.03] border-white/10 text-white placeholder:text-white/30"
              />
              <Button
                onClick={handleResend}
                disabled={resendLoading || !resendEmail}
                className="h-11 px-4 bg-gradient-to-r from-purple-500 to-violet-600 text-white"
              >
                {resendLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
              </Button>
            </div>
            {resendResult && (
              <p className={`text-sm text-center ${resendResult.includes('Gagal') || resendResult.includes('Terjadi') ? 'text-red-400' : 'text-emerald-400'}`}>
                {resendResult}
              </p>
            )}
            <div className="pt-4 border-t border-white/10">
              <Link
                href="/auth/login"
                className="text-amber-400 hover:text-amber-300 text-sm font-medium transition-colors"
              >
                ← Kembali ke Login
              </Link>
            </div>
          </div>
        )}
      </div>
    </motion.div>
  )
}

function VerifyLoading() {
  return (
    <div className="min-h-screen bg-[#0a0612] flex items-center justify-center p-4">
      <div className="w-full max-w-md text-center">
        <Loader2 className="w-10 h-10 text-purple-500 mx-auto mb-4 animate-spin" />
        <p className="text-white/60">Loading...</p>
      </div>
    </div>
  )
}

export default function VerifyPage() {
  return (
    <div className="min-h-screen bg-[#0a0612] flex items-center justify-center p-4">
      <div className="fixed inset-0 -z-10">
        <div className="absolute inset-0 bg-gradient-to-b from-[#0a0612] via-[#110a1f] to-[#0a0612]" />
        <div className="absolute top-0 left-1/4 w-[600px] h-[600px] bg-amber-500/5 rounded-full blur-[150px]" />
        <div className="absolute bottom-1/4 right-1/4 w-[400px] h-[400px] bg-purple-500/10 rounded-full blur-[100px]" />
      </div>

      <Suspense fallback={<VerifyLoading />}>
        <VerifyForm />
      </Suspense>
    </div>
  )
}
