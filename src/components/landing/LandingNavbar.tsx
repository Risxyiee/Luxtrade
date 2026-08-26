'use client'

import React, { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import Link from 'next/link'
import Image from 'next/image'
import { Sun, Moon } from 'lucide-react'
import LanguageSwitcher from '@/components/LanguageSwitcher'

interface LandingNavbarProps {
  language: 'id' | 'en'
  t: (key: string) => string
  onSidebarOpen: () => void
}

const SECTION_IDS = ['how-it-works', 'features', 'pricing', 'demo', 'faq']

export default function LandingNavbar({ language, t, onSidebarOpen }: LandingNavbarProps) {
  const [isDark, setIsDark] = useState(() => {
    if (typeof window === 'undefined') return true
    return localStorage.getItem('luxtrade-theme') !== 'light'
  })
  const [scrolled, setScrolled] = useState(false)
  const [activeSection, setActiveSection] = useState('')

  // Track scroll for navbar appearance
  useEffect(() => {
    const handleScroll = () => setScrolled(window.scrollY > 60)
    handleScroll()
    window.addEventListener('scroll', handleScroll, { passive: true })
    return () => window.removeEventListener('scroll', handleScroll)
  }, [])

  // Track active section
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

  const toggleTheme = () => {
    const newDark = !isDark
    setIsDark(newDark)
    localStorage.setItem('luxtrade-theme', newDark ? 'dark' : 'light')
    document.documentElement.classList.toggle('dark', newDark)
    document.documentElement.classList.toggle('light', !newDark)
  }

  const navLinks = [
    { key: 'how-it-works', label: language === 'id' ? 'Cara Kerja' : 'How It Works' },
    { key: 'features', label: t('nav.features') },
    { key: 'pricing', label: t('nav.pricing') },
    { key: 'demo', label: t('hero.cta.secondary') },
    { key: 'faq', label: 'FAQ' },
  ]

  return (
    <motion.nav
      initial={{ opacity: 0, y: -12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.6, ease: [0.32, 0.72, 0, 1], delay: 0.1 }}
      className={`fixed top-0 left-0 right-0 z-50 transition-all duration-500 ease-[cubic-bezier(0.32,0.72,0,1)] ${scrolled ? 'bg-[var(--lux-bg-primary)]/80' : 'bg-[var(--lux-navbar-bg)]'}`}
    >
      <div className="flex items-center justify-between px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto h-14">
        {/* Logo */}
        <div className="flex items-center gap-2.5 shrink-0">
          <Image src="/logo.png" alt="LuxTrade" width={32} height={32} className="rounded-lg" />
          <span className="text-base font-medium text-[var(--lux-text-primary)] tracking-tight hidden sm:block">
            LuxTrade
          </span>
        </div>

        {/* Nav Links — Desktop */}
        <div className="hidden lg:flex items-center gap-1">
          {navLinks.map((item) => {
            const isActive = activeSection === item.key
            return (
              <a
                key={item.key}
                href={`#${item.key}`}
                className={`px-3 py-1.5 text-[14px] font-medium transition-colors duration-300 ${isActive ? 'text-[var(--lux-text-primary)]' : 'text-[var(--lux-text-secondary)] hover:text-[var(--lux-text-primary)]'}`}
              >
                {item.label}
              </a>
            )
          })}
        </div>

        {/* Right Actions */}
        <div className="flex items-center gap-3">
          <button
            onClick={toggleTheme}
            className="w-8 h-8 rounded-full flex items-center justify-center text-[var(--lux-text-secondary)] hover:text-[var(--lux-text-primary)] hover:bg-[var(--lux-inline-hover-bg)] transition-all duration-300 shrink-0"
            aria-label="Toggle theme"
          >
            {isDark ? <Sun className="w-3.5 h-3.5" /> : <Moon className="w-3.5 h-3.5" />}
          </button>
          <div className="hidden sm:flex items-center">
            <LanguageSwitcher />
          </div>
          <button
            onClick={onSidebarOpen}
            className="lg:hidden w-8 h-8 rounded-full flex items-center justify-center text-[var(--lux-text-secondary)] hover:text-[var(--lux-text-primary)] hover:bg-[var(--lux-inline-hover-bg)] transition-all duration-300 shrink-0"
            aria-label="Menu"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="18" x2="21" y2="18"/></svg>
          </button>
          <Link href="/auth/login" prefetch={false} className="hidden md:inline-flex shrink-0">
            <span className="px-3 py-1.5 text-[13px] font-normal text-[var(--lux-text-secondary)] hover:text-[var(--lux-text-primary)] transition-colors duration-300">
              {t('nav.login')}
            </span>
          </Link>
          <Link href="/auth/signup" prefetch={false} className="shrink-0">
            <span className="inline-flex items-center h-8 px-5 rounded-full bg-[#00E5C3] text-black text-[12px] font-normal shadow-[0_0_12px_rgba(0,229,195,0.15)] hover:brightness-110 active:scale-[0.97] transition-all duration-300">
              {t('nav.signup')}
            </span>
          </Link>
        </div>
      </div>
    </motion.nav>
  )
}