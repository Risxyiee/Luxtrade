'use client'

import React, { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import Link from 'next/link'
import Image from 'next/image'
import { Menu, X } from 'lucide-react'
import LanguageSwitcher from '@/components/LanguageSwitcher'

interface LandingNavbarProps {
  language: 'id' | 'en'
  t: (key: string) => string
  onSidebarOpen: () => void
}

const NAV_LINKS = [
  { key: 'how-it-works', id: 'id', label: 'Cara Kerja', en: 'How It Works' },
  { key: 'features', id: 'id', label: 'Fitur', en: 'Features' },
  { key: 'pricing', id: 'id', label: 'Harga', en: 'Pricing' },
  { key: 'faq', id: 'id', label: 'FAQ', en: 'FAQ' },
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
      <motion.nav
        initial={{ opacity: 0, y: -8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${scrolled ? 'bg-[#050510]/90 backdrop-blur-xl border-b border-white/[0.06]' : 'bg-transparent'}`}
      >
        <div className="max-w-7xl mx-auto flex items-center justify-between h-14 px-4 sm:px-6 lg:px-8">
          <div className="flex items-center gap-2.5">
            <Image src="/logo.png" alt="LuxTrade" width={28} height={28} className="rounded-md" />
            <span className="text-[15px] font-medium text-[#f0f2ff] tracking-tight">LuxTrade</span>
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

          <div className="flex items-center gap-3">
            <div className="hidden sm:block"><LanguageSwitcher /></div>
            <Link href="/auth/login" prefetch={false} className="hidden md:inline-flex">
              <span className="text-[13px] text-[#8892b0] hover:text-[#f0f2ff] transition-colors duration-200">
                {t('nav.login')}
              </span>
            </Link>
            <Link href="/auth/signup" prefetch={false} className="hidden sm:inline-flex">
              <span className="bg-blue-500 text-white text-[12px] font-medium px-4 py-1.5 rounded-full hover:bg-blue-600 active:scale-[0.97] transition-all duration-200">
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