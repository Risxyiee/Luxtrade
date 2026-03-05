'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { motion } from 'framer-motion'
import Link from 'next/link'
import { Crown, Check, Loader2, AlertCircle } from 'lucide-react'
import { supabase } from '@/lib/supabase'

export default function AuthCallbackPage() {
  const router = useRouter()
  const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading')
  const [errorMessage, setErrorMessage] = useState('')

  useEffect(() => {
    const handleCallback = async () => {
      try {
        // Get the auth code from URL
        const url = new URL(window.location.href)
        const code = url.searchParams.get('code')
        const error = url.searchParams.get('error')
        const errorDescription = url.searchParams.get('error_description')

        // Check for error in URL
        if (error) {
          setStatus('error')
          setErrorMessage(errorDescription || error)
          return
        }

        // Exchange code for session
        if (code) {
          const { data, error: exchangeError } = await supabase.auth.exchangeCodeForSession(code)

          if (exchangeError) {
            setStatus('error')
            setErrorMessage(exchangeError.message)
            return
          }

          // Create profile if new user
          if (data.user) {
            await supabase.from('profiles').upsert({
              id: data.user.id,
              email: data.user.email,
              full_name: data.user.user_metadata?.full_name || data.user.email?.split('@')[0],
              subscription_status: 'FREE',
              email_confirmed: true,
              created_at: new Date().toISOString(),
              updated_at: new Date().toISOString(),
            }, { onConflict: 'id' })
          }

          setStatus('success')

          // Redirect to dashboard after 3 seconds
          setTimeout(() => {
            router.push('/dashboard')
          }, 3000)
        } else {
          // No code in URL
          setStatus('error')
          setErrorMessage('Link konfirmasi tidak valid')
        }
      } catch (err) {
        setStatus('error')
        setErrorMessage('Terjadi kesalahan saat konfirmasi')
      }
    }

    handleCallback()
  }, [router])

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
        className="w-full max-w-md text-center"
      >
        <div className="bg-white/[0.02] border border-white/[0.05] rounded-2xl p-8 backdrop-blur-sm">
          {/* Logo */}
          <div className="flex justify-center mb-6">
            <Link href="/" className="inline-flex items-center gap-3">
              <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-amber-400 via-amber-500 to-orange-600 flex items-center justify-center shadow-lg shadow-amber-500/20">
                <Crown className="w-6 h-6 text-white" />
              </div>
              <span className="text-2xl font-bold bg-gradient-to-r from-amber-200 via-amber-400 to-amber-200 bg-clip-text text-transparent">
                LuxTrade
              </span>
            </Link>
          </div>

          {/* Loading State */}
          {status === 'loading' && (
            <div className="py-8">
              <Loader2 className="w-12 h-12 text-amber-400 animate-spin mx-auto mb-4" />
              <h2 className="text-xl font-bold text-white mb-2">Memverifikasi...</h2>
              <p className="text-white/40 text-sm">Mohon tunggu, sedang mengkonfirmasi akun kamu.</p>
            </div>
          )}

          {/* Success State */}
          {status === 'success' && (
            <div className="py-8">
              <div className="w-16 h-16 rounded-full bg-emerald-500/20 flex items-center justify-center mx-auto mb-4">
                <Check className="w-8 h-8 text-emerald-400" />
              </div>
              <h2 className="text-2xl font-bold text-white mb-2">Akun Terkonfirmasi!</h2>
              <p className="text-white/40 text-sm mb-4">
                Selamat datang di LuxTrade. Kamu akan dialihkan ke dashboard...
              </p>
              <p className="text-white/30 text-xs">
                Tidak redirect otomatis?{' '}
                <Link href="/dashboard" className="text-amber-400 hover:text-amber-300">
                  Klik di sini
                </Link>
              </p>
            </div>
          )}

          {/* Error State */}
          {status === 'error' && (
            <div className="py-8">
              <div className="w-16 h-16 rounded-full bg-red-500/20 flex items-center justify-center mx-auto mb-4">
                <AlertCircle className="w-8 h-8 text-red-400" />
              </div>
              <h2 className="text-2xl font-bold text-white mb-2">Konfirmasi Gagal</h2>
              <p className="text-red-400 text-sm mb-4">{errorMessage}</p>
              <p className="text-white/30 text-xs mb-4">
                Link mungkin sudah kadaluarsa atau tidak valid.
              </p>
              <Link href="/auth/login">
                <button className="w-full py-3 bg-gradient-to-r from-amber-500 to-orange-600 text-white font-semibold rounded-lg">
                  Ke Halaman Login
                </button>
              </Link>
            </div>
          )}
        </div>
      </motion.div>
    </div>
  )
}
