'use client'

import React, { useState, useCallback } from 'react'
import {
  ArrowRight, ArrowLeft, AlertCircle, Loader2,
  CheckCircle, Tag, Sparkles, Shield, Zap, Star,
  Gift, Lock, Check, MessageCircle
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent } from '@/components/ui/card'
import { Progress } from '@/components/ui/progress'
import { PRICING, formatRupiah } from '@/lib/pricing'

// ============================================
// Data
// ===========================================
const PLANS = [
  {
    id: 'pro-1m', plan: 'PRO', durationMonths: 1, label: '1 Bulan',
    price: PRICING.PRO_30_DAYS, popular: false, emoji: '📊',
    features: ['Semua fitur PRO', 'Analisis AI', 'Jurnal otomatis', 'Unlimited trades']
  },
  {
    id: 'pro-1y', plan: 'PRO', durationMonths: 12, label: '1 Tahun',
    price: PRICING.PRO_ANNUAL, popular: true, savings: '16%', emoji: '⭐',
    features: ['Semua fitur PRO', 'Analisis AI', 'Jurnal otomatis', 'Unlimited trades', 'Priority support']
  },
  {
    id: 'lifetime', plan: 'LIFETIME', durationMonths: 1200, label: 'Lifetime',
    price: PRICING.PRO_LIFETIME, popular: false, badge: 'PROMO', emoji: '👑',
    features: ['Semua fitur selamanya', 'Analisis AI', 'Jurnal otomatis', 'Unlimited trades', 'Priority support', 'Early access', 'Exclusive community']
  }
]

// ============================================
// Client Component
// ============================================
interface UpgradeFormClientProps {
  user: { id: string; email: string }
}

function UpgradeFormClient({ user }: UpgradeFormClientProps) {
  const [promoCode, setPromoCode] = useState('')
  const [promoValid, setPromoValid] = useState(false)
  const [promoData, setPromoData] = useState<any>(null)
  const [isValidating, setIsValidating] = useState(false)
  const [isApplying, setIsApplying] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState(false)

  const [currentStep, setCurrentStep] = useState(1)
  const totalSteps = 2
  const progress = (currentStep / totalSteps) * 100
  const [selectedPlan, setSelectedPlan] = useState<any>(null)

  // Promo
  const validatePromo = async (code: string) => {
    if (!code.trim()) { setPromoValid(false); setPromoData(null); return }
    setIsValidating(true); setError('')
    try {
      const r = await fetch('/api/promo/validate', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ code: code.trim() }) })
      const d = await r.json()
      if (d.valid) { setPromoValid(true); setPromoData(d.promoCode) }
      else { setPromoValid(false); setPromoData(null); setError(d.message || 'Kode promo tidak valid') }
    } catch { setPromoValid(false) }
    finally { setIsValidating(false) }
  }
  const onPromoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const v = e.target.value.toUpperCase()
    setPromoCode(v); setError(''); setPromoValid(false); setPromoData(null)
    if (v.length >= 4) setTimeout(() => validatePromo(v), 500)
  }
  const applyPromo = async () => {
    if (!user) return
    setIsApplying(true); setError(''); setSuccess(false)
    try {
      const r = await fetch('/api/promo/apply', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ promoCode: promoCode.trim(), plan: 'PRO' }) })
      const d = await r.json()
      if (!r.ok || !d.success) { setError(d.details || d.message || 'Gagal'); return }
      setSuccess(true); setPromoData(d.subscription)
      setTimeout(() => { window.location.href = '/dashboard' }, 2000)
    } catch { setError('Gagal') }
    finally { setIsApplying(false) }
  }

  // Step navigation
  const goNext = useCallback(() => {
    if (currentStep < totalSteps) {
      setCurrentStep(currentStep + 1)
      setError('')
    }
  }, [currentStep])

  const goBack = useCallback(() => {
    if (currentStep > 1) {
      setCurrentStep(currentStep - 1)
      setError('')
    }
  }, [currentStep])

  // Pay — manual transfer via Discord
  const handlePay = () => {
    if (!selectedPlan) return
    window.open('https://discord.gg/HDUNAsnW2R', '_blank')
  }

  if (success) return (
    <div className="text-center py-10">
      <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-gradient-to-br from-emerald-500 to-teal-600 mb-4">
        <Sparkles className="w-8 h-8 text-white" />
      </div>
      <h2 className="text-xl font-bold text-white mb-1">Upgrade Berhasil!</h2>
      <p className="text-emerald-400 text-sm">Mengalihkan ke dashboard...</p>
    </div>
  )

  return (
    <div className="space-y-6 pb-4">

      {/* ========== PROGRESS BAR ========== */}
      <div className="space-y-2 shrink-0">
        <div className="flex items-center justify-between text-sm">
          <span className="text-purple-300 font-medium">
            Step {currentStep} of {totalSteps}
          </span>
          <span className="text-gray-400">
            {Math.round(progress)}% Complete
          </span>
        </div>
        <Progress value={progress} className="h-2 bg-purple-900/30" />
      </div>

      {/* ========== STEP CONTENT — clean, no touch-action override ========== */}
      <div className="overflow-y-auto max-h-[55vh] lg:max-h-none -mx-1 px-1">

        {/* ============ STEP 1: PILIH PAKET ============ */}
        {currentStep === 1 && (
          <div className="space-y-4 animate-in fade-in slide-in-from-right-4 duration-300">
            {error && (
              <div className="flex items-center gap-2 p-3 bg-red-500/10 border border-red-500/30 rounded-lg text-red-400 text-xs">
                <AlertCircle className="w-4 h-4 flex-shrink-0" />
                <span>{error}</span>
              </div>
            )}

            {/* Promo Code */}
            <div className="space-y-2">
              <label className="text-white font-semibold text-sm flex items-center gap-2">
                <Tag className="w-4 h-4 text-purple-400" />
                Kode Promo (opsional)
              </label>
              <div className="relative">
                <Input type="text" placeholder="Masukkan kode promo..." value={promoCode} onChange={onPromoChange} disabled={isApplying}
                  className="bg-[#0a0712] border-purple-900/30 text-white placeholder:text-gray-500 pr-10 uppercase text-sm" />
                {isValidating && <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-purple-400 animate-spin" />}
                {promoValid && <CheckCircle className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-emerald-400" />}
              </div>
            </div>

            {promoValid && promoData && (
              <div className="flex items-center gap-2 p-3 bg-emerald-500/10 border border-emerald-500/30 rounded-lg text-emerald-400 text-xs">
                <Gift className="w-4 h-4 flex-shrink-0" />
                <span>Diskon {promoData.discountPercent}% — {promoData.description}</span>
              </div>
            )}

            {promoValid && (
              <Button onClick={applyPromo} disabled={isApplying}
                className="w-full bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-600 hover:to-teal-700 text-white font-semibold">
                {isApplying ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <><Sparkles className="w-4 h-4 mr-2" />Klaim Promo Gratis</>}
              </Button>
            )}

            {/* Plan Selection */}
            <div className="space-y-2">
              <label className="text-white font-semibold text-sm">Pilih Paket</label>
              <div className="space-y-2.5">
                {PLANS.map((plan) => {
                  const isSelected = selectedPlan?.id === plan.id
                  return (
                    <button
                      type="button"
                      key={plan.id}
                      onClick={() => { setSelectedPlan(plan); setError('') }}
                      className={`w-full p-4 rounded-xl border-2 transition-all duration-200 cursor-pointer select-none active:scale-[0.98] text-left ${
                        isSelected
                          ? 'border-purple-500 bg-purple-500/20 shadow-lg shadow-purple-500/20'
                          : 'border-purple-900/30 bg-white/5 hover:border-purple-500/50'
                      }`}
                    >
                      <div className="flex items-center justify-between gap-3">
                        <div className="flex items-center gap-3 min-w-0">
                          <div className="text-xl flex-shrink-0">{plan.emoji}</div>
                          <div className="min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="text-white font-bold text-sm">{plan.plan}</span>
                              <span className="text-gray-400 text-xs">{plan.label}</span>
                              {plan.badge === 'PROMO' && (
                                <span className="px-2 py-0.5 text-[10px] font-bold rounded-md bg-gradient-to-r from-pink-500 to-violet-500 text-white">PROMO</span>
                              )}
                              {plan.popular && !plan.badge && (
                                <span className="px-2 py-0.5 text-[10px] font-bold rounded-md bg-gradient-to-r from-amber-500 to-orange-500 text-white">POPULER</span>
                              )}
                            </div>
                            <p className="text-gray-500 text-xs mt-0.5 truncate">
                              {plan.features.slice(0, 2).join(' · ')}
                            </p>
                          </div>
                        </div>
                        <div className="text-right flex-shrink-0">
                          <p className="text-white font-bold text-base">{formatRupiah(plan.price)}</p>
                          {plan.savings && <p className="text-emerald-400 text-xs font-medium">Hemat {plan.savings}</p>}
                        </div>
                      </div>

                      {/* Expanded features when selected */}
                      {isSelected && (
                        <div className="mt-3 pt-3 border-t border-purple-900/30">
                          <div className="flex flex-wrap gap-x-4 gap-y-1.5">
                            {plan.features.map((f, fi) => (
                              <div key={fi} className="flex items-center gap-1.5 text-xs text-gray-300">
                                <Check className="w-3.5 h-3.5 text-emerald-400" />
                                <span>{f}</span>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </button>
                  )
                })}
              </div>
            </div>
          </div>
        )}

        {/* ============ STEP 2: METODE BAYAR ============ */}
        {currentStep === 2 && (
          <div className="space-y-4 animate-in fade-in slide-in-from-right-4 duration-300">
            {/* Order Summary */}
            {selectedPlan && (
              <Card className="bg-gradient-to-br from-amber-500/10 to-transparent border-amber-500/30">
                <CardContent className="p-4">
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="text-xl flex-shrink-0">{selectedPlan.emoji}</div>
                      <div className="min-w-0">
                        <p className="text-white font-bold text-sm">{selectedPlan.plan} {selectedPlan.label}</p>
                        <p className="text-gray-400 text-xs truncate">{selectedPlan.features.slice(0, 2).join(' · ')}</p>
                      </div>
                    </div>
                    <div className="text-right flex-shrink-0">
                      <p className="text-gray-400 text-[10px] uppercase font-medium">Total</p>
                      <p className="text-white font-bold text-lg">{formatRupiah(selectedPlan.price)}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Bank Jago Info */}
            <div className="space-y-2">
              <label className="text-white font-semibold text-sm">Transfer ke Rekening</label>
              <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-xl p-4 space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-black text-emerald-400 bg-emerald-500/20 px-2 py-0.5 rounded">JAGO</span>
                    <span className="text-white font-bold">105668597393</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => { navigator.clipboard.writeText('105668597393') }}
                    className="text-xs text-emerald-400 hover:text-emerald-300 bg-emerald-500/20 px-2 py-1 rounded"
                  >
                    Copy
                  </button>
                </div>
                <p className="text-xs text-white/50">a.n. Rizqi Akbar Pratama — Kode Bank: 542</p>
              </div>
              <p className="text-amber-300/80 text-xs">Transfer sesuai nominal, lalu klik tombol hijau di bawah untuk konfirmasi ke Discord admin.</p>
            </div>

            {/* Error */}
            {error && (
              <div className="flex items-center gap-2 p-3 bg-red-500/10 border border-red-500/30 rounded-lg text-red-400 text-xs">
                <AlertCircle className="w-4 h-4 flex-shrink-0" />
                <span>{error}</span>
              </div>
            )}

            {/* Security */}
            <div className="flex items-center gap-2 p-3 bg-purple-500/10 border border-purple-900/30 rounded-lg">
              <Lock className="w-4 h-4 text-purple-400 flex-shrink-0" />
              <span className="text-gray-400 text-xs">Transfer Bank Jago — Konfirmasi manual via Discord</span>
            </div>
          </div>
        )}
      </div>

      {/* ========== BOTTOM NAV ========== */}
      <div className="flex gap-3 pt-4 border-t border-purple-900/30 shrink-0">
        {currentStep === 2 && (
          <Button
            variant="outline"
            onClick={goBack}
            className="border-purple-900/30 flex-1 text-gray-300 hover:bg-purple-500/10 hover:text-white"
          >
            <ArrowLeft className="w-4 h-4 mr-1" />
            Kembali
          </Button>
        )}
        <Button
          onClick={currentStep === 1 ? goNext : handlePay}
          disabled={
            currentStep === 1
              ? !selectedPlan
              : !selectedPlan
          }
          className={`flex-1 font-semibold ${
            currentStep === 1
              ? 'bg-gradient-to-r from-purple-500 to-violet-600 hover:from-purple-600 hover:to-violet-700 text-white disabled:opacity-30'
              : 'bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-600 hover:to-teal-700 text-white disabled:opacity-30'
          }`}
        >
          {currentStep === 1 ? (
            <>
              Lanjut
              <ArrowRight className="w-4 h-4 ml-1" />
            </>
          ) : (
            <>
              <MessageCircle className="w-4 h-4 mr-1" />
              Bayar & Konfirmasi via Discord
              <ArrowRight className="w-4 h-4 ml-1" />
            </>
          )}
        </Button>
      </div>

      {/* Trust badges */}
      <div className="flex items-center justify-center gap-4 pt-2">
        {[
          { icon: Shield, text: 'Aman' },
          { icon: Zap, text: 'Instan' },
          { icon: Star, text: '24/7' },
          { icon: Lock, text: 'Enkripsi' },
        ].map((b, i) => (
          <div key={i} className="flex items-center gap-1.5 text-gray-500">
            <b.icon className="w-3.5 h-3.5" />
            <span className="text-xs font-medium">{b.text}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

export default UpgradeFormClient