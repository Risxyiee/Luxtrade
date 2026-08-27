'use client'

import React, { useState, useCallback, useEffect, useRef } from 'react'
import dynamic from 'next/dynamic'
import { toast } from 'sonner'
import { useLanguage } from '@/contexts/LanguageContext'
import LegalPagesModal, { type LegalPageTab } from '@/components/LegalPagesModal'
import LandingNavbar from '@/components/landing/LandingNavbar'
import LandingSidebar from '@/components/landing/LandingSidebar'
import HeroSection from '@/components/landing/HeroSection'
import ScrollToTopButton from '@/components/landing/ScrollToTopButton'

const loadingDiv = <div className="h-32" />

const SocialProofBar = dynamic(() => import('@/components/landing/SocialProofBar').then(m => ({ default: m.default })), { ssr: false, loading: () => loadingDiv })
const AIVisionSimulator = dynamic(() => import('@/components/landing/AIVisionSimulator').then(m => ({ default: m.default })), { ssr: false, loading: () => loadingDiv })
const CaraKerjaSection = dynamic(() => import('@/components/landing/CaraKerjaSection').then(m => ({ default: m.default })), { ssr: false, loading: () => loadingDiv })
const PricingSectionNew = dynamic(() => import('@/components/landing/PricingSectionNew').then(m => ({ default: m.default })), { ssr: false, loading: () => loadingDiv })
const FAQSection = dynamic(() => import('@/components/landing/FAQSection').then(m => ({ default: m.default })), { ssr: false, loading: () => loadingDiv })
const FinalCTA = dynamic(() => import('@/components/landing/FinalCTA').then(m => ({ default: m.default })), { ssr: false, loading: () => loadingDiv })

interface LandingStats {
  totalUsers: number
  activeUsers: number
  tradesLogged: number
}

export default function LuxTradeLanding() {
  const { language, t } = useLanguage()
  const [showLegalModal, setShowLegalModal] = useState(false)
  const [payLoading, setPayLoading] = useState<string | null>(null)
  const [legalModalTab, setLegalModalTab] = useState<LegalPageTab>('terms')

  const openLegalPage = (tab: LegalPageTab) => {
    setLegalModalTab(tab)
    setShowLegalModal(true)
  }
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [promoCode, setPromoCode] = useState<string>('TRADERCEPAT')
  const [promoRemaining, setPromoRemaining] = useState<number | null>(30)
  const [promoMax, setPromoMax] = useState<number>(30)
  const [promoActive, setPromoActive] = useState<boolean | null>(null)

  const [landingStats, setLandingStats] = useState<LandingStats | null>(null)

  // Mobile Sticky CTA
  const mobileCtaRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const fetchWithTimeout = (url: string, timeoutMs = 5000) =>
      Promise.race([
        fetch(url).then(res => res.ok ? res.json() : null).catch(() => null),
        new Promise<null>(resolve => setTimeout(() => resolve(null), timeoutMs)),
      ])

    Promise.all([
      fetchWithTimeout('/api/landing-stats'),
      fetchWithTimeout('/api/promo/active'),
    ]).then(([statsData, promoData]) => {
      if (statsData) setLandingStats(statsData)
      if (promoData && promoData.code) {
        setPromoCode(promoData.code)
        setPromoRemaining(promoData.remainingQuota)
        setPromoMax(promoData.maxQuota)
        setPromoActive(promoData.isActive)
      }
    })
  }, [])

  // Mobile sticky CTA scroll handler
  useEffect(() => {
    const handleScroll = () => {
      if (mobileCtaRef.current) {
        if (window.scrollY > window.innerHeight * 0.8) {
          mobileCtaRef.current.classList.add('active')
        } else {
          mobileCtaRef.current.classList.remove('active')
        }
      }
    }
    window.addEventListener('scroll', handleScroll, { passive: true })
    return () => window.removeEventListener('scroll', handleScroll)
  }, [])

  const ensureSnapLoaded = useCallback(async (): Promise<boolean> => {
    if ((window as any).snap) return true

    const loadingToast = toast.loading('Memuat payment gateway...')
    try {
      const res = await fetch('/api/midtrans/create-transaction')
      const config = await res.json()
      if (!config.configured || !config.snapUrl) {
        toast.dismiss(loadingToast)
        toast.error('Payment gateway tidak tersedia')
        return false
      }

      return await new Promise<boolean>((resolve) => {
        const script = document.createElement('script')
        script.id = 'midtrans-snap-landing'
        script.src = config.snapUrl
        script.setAttribute('data-client-key', config.clientKey)
        script.async = true
        script.onload = () => { toast.dismiss(loadingToast); resolve(true) }
        script.onerror = () => { toast.dismiss(loadingToast); toast.error('Gagal memuat payment gateway'); resolve(false) }
        document.body.appendChild(script)
      })
    } catch {
      toast.dismiss(loadingToast)
      toast.error('Gagal terhubung ke payment gateway')
      return false
    }
  }, [])

  const handleMidtransPay = async (plan: 'PRO_30_DAYS' | 'PRO_LIFETIME') => {
    const ready = await ensureSnapLoaded()
    if (!ready) return

    setPayLoading(plan)
    try {
      const res = await fetch('/api/midtrans/create-transaction', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ plan }),
      })
      const data = await res.json()

      if (res.status === 401) {
        setPayLoading(null)
        window.location.href = `/auth/checkout?plan=${plan}`
        return
      }

      if (!res.ok) { toast.error(data.error || 'Gagal membuat transaksi'); setPayLoading(null); return }

      ;(window as any).snap.pay(data.token, {
        onSuccess: () => { toast.success('Pembayaran berhasil! Akun PRO sedang diaktivasi...'); setTimeout(() => window.location.href = '/dashboard', 2000) },
        onPending: () => { toast.info('Menunggu pembayaran. Selesaikan untuk mengaktifkan PRO otomatis.') },
        onError: () => { toast.error('Pembayaran gagal atau dibatalkan.') },
        onClose: () => { setPayLoading(null) },
      })
    } catch { toast.error('Gagal terhubung ke payment gateway'); setPayLoading(null) }
  }

  const handleProUpgrade = () => {
    if (language === 'en') window.open('https://skrill.me/rq/RIZQI%20AKBAR/3/USD?key=vXcr_5kNitZJFVBnkmK0sakLnjB', '_blank')
    else handleMidtransPay('PRO_30_DAYS')
  }

  return (
    <div className="min-h-screen bg-[#050507] text-white overflow-x-hidden flex flex-col relative landing-blueprint-grid landing-noise">
      <div className="relative z-[1] flex flex-col min-h-screen">
        <header>
          <LandingNavbar language={language} t={t} onSidebarOpen={() => setSidebarOpen(true)} />
        </header>
        <LandingSidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} language={language} t={t} openLegalPage={openLegalPage} />

        <main id="main-content" className="flex-1">
          <HeroSection language={language} />
          <SocialProofBar language={language} />
          <AIVisionSimulator language={language} />
          <CaraKerjaSection language={language} />
          <PricingSectionNew
            promoCode={promoCode}
            promoActive={promoActive}
            promoRemaining={promoRemaining}
            promoMax={promoMax}
            handleProUpgrade={handleProUpgrade}
            payLoading={payLoading}
            language={language}
          />
          <FAQSection language={language} />
          <FinalCTA language={language} />
        </main>



        <ScrollToTopButton />

        {/* Mobile Sticky CTA */}
        <div ref={mobileCtaRef} id="mobile-cta" className="md:hidden fixed bottom-0 left-0 w-full p-4 bg-[#050507]/90 backdrop-blur-xl border-t border-white/10 z-40">
          <button onClick={handleProUpgrade} className="block w-full py-3.5 bg-gradient-to-r from-blue-500 to-cyan-400 text-white text-center font-semibold rounded-xl glow-bg-luxury text-sm cursor-pointer">
            Daftar Gratis Sekarang
          </button>
        </div>

        <LegalPagesModal isOpen={showLegalModal} onClose={() => setShowLegalModal(false)} initialTab={legalModalTab} />
      </div>
    </div>
  )
}

// Structured data is handled in layout.tsx metadata
