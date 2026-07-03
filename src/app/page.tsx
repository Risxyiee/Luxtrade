'use client'

import React, { useState, useCallback, useEffect } from 'react'
import { toast } from 'sonner'
import { useLanguage } from '@/contexts/LanguageContext'
import LegalPagesModal, { type LegalPageTab } from '@/components/LegalPagesModal'
import ParticleBackground from '@/components/landing/ParticleBackground'
import AnnouncementBar from '@/components/landing/AnnouncementBar'
import LandingNavbar from '@/components/landing/LandingNavbar'
import LandingSidebar from '@/components/landing/LandingSidebar'
import HeroSection from '@/components/landing/HeroSection'
import StatsStrip from '@/components/landing/StatsStrip'
import PricingSection from '@/components/landing/PricingSection'
import PromoCodeSection from '@/components/landing/PromoCodeSection'
import DemoVideoSection from '@/components/landing/DemoVideoSection'
import HowItWorksSection from '@/components/landing/HowItWorksSection'
import FeaturesSection from '@/components/landing/FeaturesSection'
import TestimonialSection from '@/components/landing/TestimonialSection'
import FAQSection from '@/components/landing/FAQSection'
import RoadmapSection from '@/components/landing/RoadmapSection'
import NewsletterSection from '@/components/landing/NewsletterSection'
import LandingFooter from '@/components/landing/LandingFooter'
import SectionDivider from '@/components/landing/SectionDivider'
import CTASectionBreak from '@/components/landing/CTASectionBreak'
import ScrollToTopButton from '@/components/landing/ScrollToTopButton'

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
  const [promoRemaining, setPromoRemaining] = useState<number | null>(null)
  const [promoMax, setPromoMax] = useState<number>(30)
  const [promoActive, setPromoActive] = useState<boolean | null>(null)
  const [newsletterEmail, setNewsletterEmail] = useState('')
  const [newsletterLoading, setNewsletterLoading] = useState(false)
  const [newsletterSuccess, setNewsletterSuccess] = useState(false)

  useEffect(() => {
    fetch('/api/promo-quota?code=TRADERCEPAT')
      .then(res => res.ok ? res.json() : null)
      .then(data => {
        if (data && data.maxQuota > 0) {
          setPromoRemaining(data.remainingQuota)
          setPromoMax(data.maxQuota)
          setPromoActive(data.isActive)
        }
      })
      .catch(() => {})
  }, [])

  // Lazily load Midtrans Snap.js only when payment is initiated
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
    <div className="min-h-screen bg-lux-bg-primary text-lux-text-primary overflow-x-hidden flex flex-col">
      <ParticleBackground />
      <header>
        <AnnouncementBar language={language} />
        <LandingNavbar language={language} t={t} onSidebarOpen={() => setSidebarOpen(true)} />
      </header>
      <LandingSidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} language={language} t={t} openLegalPage={openLegalPage} />

      <main id="main-content" className="flex-1">
        <HeroSection language={language} t={t} />
        <StatsStrip language={language} t={t} />
        <SectionDivider />
        <PricingSection language={language} t={t} payLoading={payLoading} handleProUpgrade={handleProUpgrade} handleLifetimeUpgrade={handleLifetimeUpgrade} promoRemaining={promoRemaining} />
        <PromoCodeSection language={language} promoRemaining={promoRemaining} promoMax={promoMax} promoActive={promoActive} />
        <DemoVideoSection language={language} />
        <SectionDivider />
        <HowItWorksSection language={language} t={t} />
        <FeaturesSection language={language} t={t} />
        <CTASectionBreak language={language} />
        <TestimonialSection language={language} />
        <SectionDivider />
        <FAQSection language={language} />
        <RoadmapSection language={language} />
        <SectionDivider />
        <NewsletterSection language={language} newsletterEmail={newsletterEmail} setNewsletterEmail={setNewsletterEmail} newsletterLoading={newsletterLoading} newsletterSuccess={newsletterSuccess} handleNewsletterSubmit={handleNewsletterSubmit} />
      </main>

      <LandingFooter language={language} openLegalPage={openLegalPage} />
      <ScrollToTopButton />

      <LegalPagesModal isOpen={showLegalModal} onClose={() => setShowLegalModal(false)} initialTab={legalModalTab} />

      {/* JSON-LD Structured Data */}
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
              { "@type": "Offer", "price": "49000", "priceCurrency": "IDR", "description": "PRO Plan - 30 hari" }
            ],
            "aggregateRating": { "@type": "AggregateRating", "ratingValue": "4.8", "ratingCount": "500" }
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
  )
}