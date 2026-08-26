'use client'

import React, { useState, useCallback, useEffect } from 'react'
import dynamic from 'next/dynamic'
import { toast } from 'sonner'
import { useLanguage } from '@/contexts/LanguageContext'
import LegalPagesModal, { type LegalPageTab } from '@/components/LegalPagesModal'
import AnnouncementBar from '@/components/landing/AnnouncementBar'
import LandingNavbar from '@/components/landing/LandingNavbar'
import LandingSidebar from '@/components/landing/LandingSidebar'
import HeroSection from '@/components/landing/HeroSection'
import StatsStrip from '@/components/landing/StatsStrip'
import PromoCodeSection from '@/components/landing/PromoCodeSection'
import HowItWorksSection from '@/components/landing/HowItWorksSection'
import FeaturesSection from '@/components/landing/FeaturesSection'
import FAQSection from '@/components/landing/FAQSection'
import SectionDivider from '@/components/landing/SectionDivider'
import LandingFooter from '@/components/landing/LandingFooter'
import ScrollToTopButton from '@/components/landing/ScrollToTopButton'
import { PRICING } from '@/lib/pricing'

const PricingSection = dynamic(() => import('@/components/landing/PricingSection').then(m => ({ default: m.default })), { ssr: false })
const DashboardShowcase = dynamic(() => import('@/components/landing/DashboardShowcase').then(m => ({ default: m.default })), { ssr: false })
const CTASectionBreak = dynamic(() => import('@/components/landing/CTASectionBreak').then(m => ({ default: m.default })), { ssr: false })
const RoadmapSection = dynamic(() => import('@/components/landing/RoadmapSection').then(m => ({ default: m.default })), { ssr: false })
const NewsletterSection = dynamic(() => import('@/components/landing/NewsletterSection').then(m => ({ default: m.default })), { ssr: false })

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
  const [newsletterEmail, setNewsletterEmail] = useState('')
  const [newsletterLoading, setNewsletterLoading] = useState(false)
  const [newsletterSuccess, setNewsletterSuccess] = useState(false)

  const [landingStats, setLandingStats] = useState<LandingStats | null>(null)

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
  const handleLifetimeUpgrade = () => {
    if (language === 'en') window.open('https://skrill.me/rq/RIZQI%20AKBAR/5/USD?key=EI71vCJNy64rGTOWNzhHPcWiTXS', '_blank')
    else handleMidtransPay('PRO_LIFETIME')
  }

  const handleNewsletterSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!newsletterEmail.trim()) return
    setNewsletterLoading(true)
    try {
      const res = await fetch('/api/newsletter', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: newsletterEmail })
      })
      const data = await res.json()
      if (res.ok) {
        setNewsletterSuccess(true)
        setNewsletterEmail('')
        setTimeout(() => setNewsletterSuccess(false), 4000)
      }
    } catch { /* ignore */ }
    setNewsletterLoading(false)
  }

  return (
    <div className="min-h-screen bg-[#050510] text-[#f0f2ff] overflow-x-hidden flex flex-col relative">
      {/* Premium ambient lighting */}
      <div className="fixed inset-0 pointer-events-none z-0" aria-hidden="true">
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[1000px] h-[600px] bg-blue-500/[0.07] rounded-full blur-[150px]" />
        <div className="absolute top-[40%] right-0 w-[600px] h-[600px] bg-blue-500/[0.04] rounded-full blur-[120px]" />
        <div className="absolute bottom-0 left-0 w-[800px] h-[400px] bg-blue-500/[0.05] rounded-full blur-[140px]" />
      </div>
      <div className="relative z-[1] flex flex-col min-h-screen">
      <header>
        <AnnouncementBar language={language} promoCode={promoCode} promoActive={promoActive} />
        <LandingNavbar language={language} t={t} onSidebarOpen={() => setSidebarOpen(true)} />
      </header>
      <LandingSidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} language={language} t={t} openLegalPage={openLegalPage} />

      <main id="main-content" className="flex-1">
        <HeroSection language={language} t={t} landingStats={landingStats} />
        <StatsStrip language={language} t={t} landingStats={landingStats} />
        <SectionDivider />
        <HowItWorksSection language={language} t={t} />
        <DashboardShowcase language={language} />
        <FeaturesSection language={language} t={t} />
        <CTASectionBreak language={language} />
        <SectionDivider />
        <PricingSection language={language} t={t} payLoading={payLoading} handleProUpgrade={handleProUpgrade} handleLifetimeUpgrade={handleLifetimeUpgrade} promoRemaining={promoRemaining} />
        <PromoCodeSection language={language} promoCode={promoCode} promoRemaining={promoRemaining} promoMax={promoMax} promoActive={promoActive} />
        <SectionDivider />
        <FAQSection language={language} />
        <SectionDivider />
        <RoadmapSection language={language} />
        <NewsletterSection language={language} newsletterEmail={newsletterEmail} setNewsletterEmail={setNewsletterEmail} newsletterLoading={newsletterLoading} newsletterSuccess={newsletterSuccess} handleNewsletterSubmit={handleNewsletterSubmit} />
      </main>

      <LandingFooter language={language} openLegalPage={openLegalPage} />
      <ScrollToTopButton />

      <LegalPagesModal isOpen={showLegalModal} onClose={() => setShowLegalModal(false)} initialTab={legalModalTab} />

      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify({
            "@context": "https://schema.org",
            "@type": "SoftwareApplication",
            "name": "LuxTrade",
            "applicationCategory": "FinanceApplication",
            "operatingSystem": "Web",
            "description": "AI Trading Journal Indonesia - Catat trade, deteksi kesalahan, naikkan win rate. Screenshot trade dari MT4/MT5, AI auto-extract data & deteksi pola kesalahan berulang.",
            "url": "https://luxtrade.id",
            "offers": [
              { "@type": "Offer", "price": "0", "priceCurrency": "IDR", "description": "Free Plan - 10 trades/bulan" },
              { "@type": "Offer", "price": String(PRICING.PRO_30_DAYS), "priceCurrency": "IDR", "description": "PRO Plan - 30 hari" },
              { "@type": "Offer", "price": String(PRICING.PRO_ANNUAL), "priceCurrency": "IDR", "description": "PRO Annual - 365 hari" },
              { "@type": "Offer", "price": String(PRICING.PRO_LIFETIME), "priceCurrency": "IDR", "description": "Lifetime Ultra - Sekali bayar" }
            ]
          })
        }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify({
            "@context": "https://schema.org",
            "@type": "Organization",
            "name": "LuxTrade",
            "url": "https://luxtrade.id",
            "logo": "https://luxtrade.id/logo.png",
            "sameAs": []
          })
        }}
      />
      </div>
    </div>
  )
}
