'use client'

import React, { useState, useEffect, useRef } from 'react'
import dynamic from 'next/dynamic'
import { useLanguage } from '@/contexts/LanguageContext'
import LegalPagesModal, { type LegalPageTab } from '@/components/LegalPagesModal'
import LandingNavbar from '@/components/landing/LandingNavbar'
import LandingSidebar from '@/components/landing/LandingSidebar'
import HeroSection from '@/components/landing/HeroSection'
import ScrollToTopButton from '@/components/landing/ScrollToTopButton'
import LandingCheckoutModal from '@/components/landing/LandingCheckoutModal'

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
  const [legalModalTab, setLegalModalTab] = useState<LegalPageTab>('terms')
  const [showCheckoutModal, setShowCheckoutModal] = useState(false)

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

  const handleProUpgrade = () => {
    if (language === 'en') window.open('https://skrill.me/rq/RIZQI%20AKBAR/3/USD?key=vXcr_5kNitZJFVBnkmK0sakLnjB', '_blank')
    else setShowCheckoutModal(true)
  }

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



  return (
    <div className="min-h-screen bg-[#050507] text-white overflow-x-hidden flex flex-col relative landing-blueprint-grid landing-noise">
      <div className="relative z-[1] flex flex-col min-h-screen">
        <header>
          <LandingNavbar language={language} t={t} onSidebarOpen={() => setSidebarOpen(true)} />
        </header>
        <LandingSidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} language={language} t={t} openLegalPage={openLegalPage} />

        <main id="main-content" className="flex-1 pb-20 md:pb-0">
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
        <LandingCheckoutModal
          isOpen={showCheckoutModal}
          onClose={() => setShowCheckoutModal(false)}
          promoCode={promoCode}
          promoActive={promoActive}
          language={language}
        />
      </div>
    </div>
  )
}

// Structured data is handled in layout.tsx metadata
