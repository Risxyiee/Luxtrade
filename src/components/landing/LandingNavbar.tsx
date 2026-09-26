'use client'

import React, { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import Link from 'next/link'
import Image from 'next/image'
import { Menu, X, MessageSquare } from 'lucide-react'
import LanguageSwitcher from '@/components/LanguageSwitcher'

interface LandingNavbarProps {
  language: 'id' | 'en'
  t: (key: string) => string
  onSidebarOpen: () => void
}

const NAV_LINKS = [
  { key: 'cara-kerja', label: 'Cara Kerja', en: 'How It Works' },
  { key: 'features', label: 'Fitur', en: 'Features' },
  { key: 'pricing', label: 'Harga', en: 'Pricing' },
  { key: 'faq', label: 'FAQ', en: 'FAQ' },
]

export default function LandingNavbar({ language, t, onSidebarOpen }: LandingNavbarProps) {
  const [scrolled, setScrolled] = useState(false)
  const [activeSection, setActiveSection] = useState('')

  useEffect(() => {
    const handleScroll = () => setScrolled(window.scrollY > 40)
    handleScroll()
    window.addEventListener('scroll', handleScroll, { passive: true })
    return () => window.removeEventListener('scroll', handleScroll)
  }, [])

  const SECTION_IDS = NAV_LINKS.map(l => l.key)
  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) setActiveSection(entry.target.id)
        }
      },
      { rootMargin: '-30% 0px -60% 0px' }
    )
    for (const id of SECTION_IDS) {
      const el = document.getElementById(id)
      if (el) observer.observe(el)
    }
    return () => observer.disconnect()
  }, [])

  return (
    <>
      <a href="#main-content" className="sr-only focus:not-sr-only focus:fixed focus:top-2 focus:left-2 focus:z-[100] focus:px-4 focus:py-2 focus:bg-blue-600 focus:text-white focus:rounded-md">Skip to content</a>
      <motion.nav
        initial={{ opacity: 0, y: -8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className={`fixed top-0 left-0 right-0 z-50 transition-colors duration-300 ${scrolled ? 'bg-[#050510]/90 backdrop-blur-xl border-b border-white/[0.06]' : 'bg-transparent'}`}
        aria-label="Main navigation"
      >
        <div className="max-w-7xl mx-auto flex items-center justify-between h-14 px-4 sm:px-6 lg:px-8">
          <div className="flex items-center gap-2.5">
            <Image src="/logo.png" alt="LuxTradee" width={28} height={28} className="object-contain" />
            <span className="text-[15px] font-medium text-[#f0f2ff] tracking-tight">LuxTradee</span>
          </div>

          <div className="hidden md:flex items-center gap-6">
            {NAV_LINKS.map((item) => (
              <a
                key={item.key}
                href={`#${item.key}`}
                className={`text-[13px] font-medium transition-colors duration-200 ${activeSection === item.key ? 'text-[#f0f2ff]' : 'text-[#8892b0] hover:text-[#f0f2ff]'}`}
              >
                {language === 'id' ? item.label : item.en}
              </a>
            ))}
          </div>

          <div className="flex items-center gap-2">
            <a
              href="https://discord.gg/JwMxsmMqG"
              target="_blank"
              rel="noopener noreferrer"
              className="hidden sm:flex items-center gap-2 px-3 py-1.5 rounded-full bg-[#5865F2]/10 border border-[#5865F2]/30 text-[#5865F2] hover:bg-[#5865F2]/20 transition-colors"
              title="Join Discord Community"
            >
              <MessageSquare className="w-4 h-4" />
              <span className="text-[12px] font-medium">Discord</span>
            </a>
            <LanguageSwitcher />
            <a
              href="https://discord.gg/JwMxsmMqG"
              target="_blank"
              rel="noopener noreferrer"
              aria-label="Discord"
              className="text-[13px] text-[#8892b0] hover:text-[#5865F2] transition-colors duration-200 flex items-center gap-1.5"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                <path d="M20.317 4.37a19.791 19.791 0 0 0-4.885-1.515.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0 12.64 12.64 0 0 0-.617-1.25.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057a.082.082 0 0 0 .031.057 19.9 19.9 0 0 0 5.993 3.03.078.078 0 0 0 .084-.028 14.09 14.09 0 0 0 1.226-1.994.076.076 0 0 0-.041-.106 13.107 13.107 0 0 1-1.872-.892.077.077 0 0 1-.008-.128 10.2 10.2 0 0 0 .372-.292.074.074 0 0 1 .077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 0 1 .078.01c.12.098.246.198.373.292a.077.077 0 0 1-.006.127 12.299 12.299 0 0 1-1.873.892.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028 19.839 19.839 0 0 0 6.002-3.03.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.03zM8.02 15.33c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.956-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.956 2.418-2.157 2.418zm7.975 0c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.955-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.946 2.418-2.157 2.418z"/>
              </svg>
              <span className="hidden lg:inline">Discord</span>
            </a>
            <Link href="/auth/login" prefetch={false} className="text-[13px] text-[#8892b0] hover:text-[#f0f2ff] transition-colors duration-200">
              {t('nav.login')}
            </Link>
            <Link href="/auth/signup" prefetch={false}>
              <span className="bg-blue-500 text-white text-[12px] font-medium px-3 sm:px-4 py-1.5 rounded-full hover:bg-blue-600 active:scale-[0.97] transition-all duration-200">
                {t('nav.signup')}
              </span>
            </Link>
            <button
              onClick={onSidebarOpen}
              className="md:hidden w-8 h-8 flex items-center justify-center text-[#8892b0] hover:text-[#f0f2ff]"
              aria-label="Menu"
            >
              <Menu className="w-4 h-4" />
            </button>
          </div>
        </div>
      </motion.nav>
    </>
  )
}