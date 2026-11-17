'use client'

import React, { useState, useEffect } from 'react'
import { DISCORD_INVITE_URL } from '@/lib/site-links'
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
            <Image src="/logo.png" alt="LuxTradee" width={28} height={28} priority className="object-contain" />
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
              href={DISCORD_INVITE_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="hidden sm:flex items-center gap-2 px-3 py-1.5 rounded-full bg-[#5865F2]/10 border border-[#5865F2]/30 text-[#5865F2] hover:bg-[#5865F2]/20 transition-colors"
              title="Komunitas"
            >
              <MessageSquare className="w-4 h-4" />
              <span className="text-[12px] font-medium">Komunitas</span>
            </a>
            <LanguageSwitcher />
            <Link href="/auth/login" prefetch={false} className="text-[13px] text-[#8892b0] hover:text-[#f0f2ff] transition-colors duration-200">
              {t('nav.login')}
            </Link>
            {/* CTA UTAMA — jurnal tamu tanpa daftar, BUKAN halaman signup
                (Bos: pengunjung mencatat dulu, baru diminta daftar) */}
            <a
              href="#jurnal-gratis"
              className="bg-emerald-500 text-[#05100c] text-[12px] font-bold px-3 sm:px-4 py-1.5 rounded-full hover:bg-emerald-400 active:scale-[0.97] transition-all duration-200"
            >
              {language === 'id' ? 'Mulai Jurnal Gratis' : 'Start Journal Free'}
            </a>
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