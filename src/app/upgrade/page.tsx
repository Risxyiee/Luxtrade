'use client'

import React, { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import { useRouter } from 'next/navigation'
import {
  Crown, ArrowRight, AlertCircle, Loader2,
  CheckCircle, Tag, Sparkles
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { supabase } from '@/lib/supabase'

// ============================================
// Upgrade Page Component
// ============================================
function UpgradeForm() {
  const router = useRouter()
  const [promoCode, setPromoCode] = useState('')
  const [promoValid, setPromoValid] = useState(false)
  const [promoData, setPromoData] = useState<any>(null)
  const [isValidating, setIsValidating] = useState(false)
  const [isApplying, setIsApplying] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState(false)
  const [user, setUser] = useState<any>(null)

  // Get user on mount
  useEffect(() => {
    const getUser = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        router.push('/auth/login?redirect=/upgrade')
        return
      }
      setUser(user)
    }

    getUser()
  }, [router])

  // Validate promo code
  const validatePromoCode = async (code: string) => {
    if (!code.trim()) {
      setPromoValid(false)
      setPromoData(null)
      return
    }

    setIsValidating(true)
    setError('')

    try {
      const res = await fetch('/api/promo/validate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code: code.trim() })
      })

      const data = await res.json()

      if (data.valid) {
        setPromoValid(true)
        setPromoData(data.promoCode)
      } else {
        setPromoValid(false)
        setPromoData(null)
        setError(data.message || 'Kode promo tidak valid')
      }
    } catch (err: any) {
      setError(err.message || 'Gagal memvalidasi kode promo')
      setPromoValid(false)
      setPromoData(null)
    } finally {
      setIsValidating(false)
    }
  }

  // Handle promo code input change
  const handlePromoCodeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value.toUpperCase()
    setPromoCode(value)
    setError('')
    setPromoValid(false)
    setPromoData(null)

    // Debounce validation
    if (value.length >= 4) {
      const timeout = setTimeout(() => {
        validatePromoCode(value)
      }, 500)
      return () => clearTimeout(timeout)
    }
  }

  // Apply promo code
  const handleApplyPromo = async () => {
    if (!user) {
      router.push('/auth/login?redirect=/upgrade')
      return
    }

    if (!promoCode.trim()) {
      setError('Silakan masukkan kode promo')
      return
    }

    setIsApplying(true)
    setError('')
    setSuccess(false)

    try {
      const res = await fetch('/api/promo-simple/apply', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          promoCode: promoCode.trim(),
          plan: 'PRO'
        })
      })

      const data = await res.json()

      if (!res.ok || !data.success) {
        setError(data.details || data.message || data.error || 'Gagal menerapkan kode promo')
        return
      }

      setSuccess(true)
      setPromoData(data.subscription)

      // Redirect to dashboard after delay
      setTimeout(() => {
        router.push('/dashboard')
      }, 2000)
    } catch (err: any) {
      setError(err.message || 'Gagal menerapkan kode promo')
    } finally {
      setIsApplying(false)
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
          <div className="w-20 h-20 rounded-full bg-emerald-500/20 flex items-center justify-center mx-auto mb-4">
            <Sparkles className="w-10 h-10 text-emerald-400" />
          </div>
          <h2 className="text-2xl font-bold text-white mb-2">Upgrade Berhasil!</h2>
          <p className="text-white/60 text-sm mb-4">
            Anda sekarang memiliki akses PRO selama {promoData?.durationMonths || 3} bulan!
          </p>
          <p className="text-emerald-400 text-sm mb-6">
            Mengalihkan ke dashboard...
          </p>
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
      {/* Upgrade Card */}
      <div className="bg-white/[0.02] border border-white/[0.05] rounded-2xl p-8 backdrop-blur-sm">
        <div className="text-center mb-6">
          <div className="w-16 h-16 rounded-full bg-gradient-to-br from-amber-500/20 to-orange-500/20 flex items-center justify-center mx-auto mb-4">
            <Crown className="w-8 h-8 text-amber-400" />
          </div>
          <h1 className="text-2xl font-bold text-white mb-2">Upgrade ke Premium</h1>
          <p className="text-white/40 text-sm">Dapatkan akses penuh ke semua fitur LuxTrade</p>
        </div>

        {/* Error Message */}
        {error && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex items-start gap-2 p-3 mb-4 bg-red-500/10 border border-red-500/30 rounded-lg text-red-400 text-sm"
          >
            <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
            <span>{error}</span>
          </motion.div>
        )}

        {/* Promo Code Input */}
        <div className="space-y-4 mb-6">
          <div className="space-y-2">
            <Label htmlFor="promoCode" className="text-white/70 text-sm flex items-center gap-2">
              <Tag className="w-4 h-4" />
              Kode Promo
            </Label>
            <div className="relative">
              <Input
                id="promoCode"
                type="text"
                placeholder="Masukkan kode promo"
                value={promoCode}
                onChange={handlePromoCodeChange}
                disabled={isApplying}
                className="h-12 bg-white/[0.03] border-white/10 text-white placeholder:text-white/30 focus:border-amber-500/50 focus:ring-amber-500/20 uppercase"
              />
              {isValidating && (
                <div className="absolute right-3 top-1/2 -translate-y-1/2">
                  <Loader2 className="w-5 h-5 text-amber-400 animate-spin" />
                </div>
              )}
              {promoValid && (
                <div className="absolute right-3 top-1/2 -translate-y-1/2">
                  <CheckCircle className="w-5 h-5 text-emerald-400" />
                </div>
              )}
            </div>
          </div>

          {/* Promo Code Details */}
          {promoValid && promoData && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="p-4 bg-gradient-to-r from-emerald-500/10 to-green-500/10 border border-emerald-500/30 rounded-lg"
            >
              <div className="flex items-start gap-3">
                <div className="flex-shrink-0 mt-0.5">
                  <CheckCircle className="w-5 h-5 text-emerald-400" />
                </div>
                <div className="flex-1">
                  <p className="text-white font-semibold text-sm mb-1">
                    Diskon {promoData.discountPercent}%
                  </p>
                  <p className="text-white/60 text-xs mb-2">
                    {promoData.description}
                  </p>
                  <div className="flex items-center gap-2 text-xs text-white/50">
                    <span>Durasi: {promoData.durationMonths} bulan</span>
                    <span>•</span>
                    <span>Sisa kuota: {promoData.remainingQuota}/{promoData.totalQuota}</span>
                  </div>
                </div>
              </div>
            </motion.div>
          )}
        </div>

        {/* Submit Button */}
        <Button
          onClick={handleApplyPromo}
          disabled={isApplying || !promoCode.trim()}
          className="w-full h-12 bg-gradient-to-r from-amber-500 to-orange-600 hover:from-amber-600 hover:to-orange-700 text-white font-semibold shadow-lg shadow-amber-500/25 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {isApplying ? (
            <>
              <Loader2 className="w-5 h-5 mr-2 animate-spin" />
              Memproses...
            </>
          ) : (
            <>
              Terapkan Kode Promo
              <Sparkles className="w-5 h-5 ml-2" />
            </>
          )}
        </Button>

        {/* Alternative */}
        <div className="relative my-6">
          <div className="absolute inset-0 flex items-center">
            <div className="w-full border-t border-white/10" />
          </div>
          <div className="relative flex justify-center text-xs">
            <span className="px-2 bg-[#0a0612] text-white/30">atau</span>
          </div>
        </div>

        <p className="text-center text-white/40 text-sm mb-4">
          Tidak punya kode promo?
        </p>

        <Button
          variant="outline"
          className="w-full h-12 border-white/10 text-white hover:bg-white/5"
          onClick={() => router.push('/dashboard')}
        >
          Lanjut dengan Akun Gratis
          <ArrowRight className="w-5 h-5 ml-2" />
        </Button>
      </div>

      {/* Back to Dashboard */}
      <div className="text-center mt-4">
        <button
          onClick={() => router.push('/dashboard')}
          className="text-white/40 text-sm hover:text-white/60 transition-colors"
        >
          ← Kembali ke Dashboard
        </button>
      </div>
    </motion.div>
  )
}

// ============================================
// Main component with Suspense boundary
// ============================================
import { Suspense } from 'react'

function UpgradeLoading() {
  return (
    <div className="min-h-screen bg-[#0a0612] flex items-center justify-center p-4">
      <div className="w-full max-w-md text-center">
        <Loader2 className="w-10 h-10 text-purple-500 mx-auto mb-4 animate-spin" />
        <p className="text-white/60">Loading...</p>
      </div>
    </div>
  )
}

export default function UpgradePage() {
  return (
    <div className="min-h-screen bg-[#0a0612] flex items-center justify-center p-4">
      {/* Background Effects */}
      <div className="fixed inset-0 -z-10">
        <div className="absolute inset-0 bg-gradient-to-b from-[#0a0612] via-[#110a1f] to-[#0a0612]" />
        <div className="absolute top-0 left-1/4 w-[600px] h-[600px] bg-amber-500/5 rounded-full blur-[150px]" />
        <div className="absolute bottom-1/4 right-1/4 w-[400px] h-[400px] bg-purple-500/10 rounded-full blur-[100px]" />
      </div>

      <Suspense fallback={<UpgradeLoading />}>
        <UpgradeForm />
      </Suspense>
    </div>
  )
}