'use client'

import React, { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import Link from 'next/link'
import Image from 'next/image'
import { ArrowRight, Sun, Moon } from 'lucide-react'
import { Button } from '@/components/ui/button'
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

  const [activeSection, setActiveSection] = useState('')

  // Track active section on scroll
  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            setActiveSection(entry.target.id)
          }
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
    <nav className="fixed top-10 left-0 right-0 z-50">
      <div className="backdrop-blur-xl bg-[var(--lux-navbar-bg)] border-b border-[var(--lux-inline-border)]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-14">
            <div className="flex items-center gap-3">
              <div className="relative">
                <Image src="/logo.png" alt="LuxTrade Logo" width={40} height={40} className="rounded-xl shadow-lg" />
                <motion.div className="absolute -bottom-1 -right-1 w-3 h-3 bg-emerald-400 rounded-full border-2 border-[var(--lux-bg-primary)]" animate={{ boxShadow: ['0 0 0 0 rgba(16, 185, 129, 0.7)', '0 0 0 8px rgba(16, 185, 129, 0)', '0 0 0 0 rgba(16, 185, 129, 0.7)'] }} transition={{ duration: 2, repeat: Infinity }} />
              </div>
              <div>
                <span className="text-xl font-extrabold bg-gradient-to-r from-[var(--lux-text-primary)] via-purple-300 to-purple-400 bg-clip-text text-transparent">LuxTrade</span>
                <span className="hidden sm:inline text-[10px] text-purple-400/70 ml-2 tracking-[0.2em] font-bold">PREMIUM</span>
              </div>
            </div>
            <div className="hidden md:flex items-center gap-8">
              {navLinks.map((item) => {
                const isActive = activeSection === item.key
                return (
                  <a key={item.key} href={`#${item.key}`} className={`text-sm font-medium transition-colors relative group ${isActive ? 'text-[var(--lux-text-primary)]' : 'text-[var(--lux-text-body)] hover:text-[var(--lux-text-primary)]'}`}>
                    {item.label}
                    <span className={`absolute -bottom-1 left-0 h-0.5 bg-gradient-to-r from-purple-500 to-blue-500 transition-all duration-300 ${isActive ? 'w-full' : 'w-0 group-hover:w-full'}`} />
                  </a>
                )
              })}
            </div>
            <div className="flex items-center gap-2 sm:gap-3">
              <button onClick={toggleTheme} className="w-11 h-11 flex items-center justify-center rounded-xl bg-[var(--lux-inline-hover-bg)] border border-[var(--lux-inline-border)] hover:bg-[var(--lux-inline-hover-bg-3)] transition-colors" aria-label="Toggle theme">
                {isDark ? <Sun className="w-4 h-4 text-amber-400" /> : <Moon className="w-4 h-4 text-purple-400" />}
              </button>
              <button onClick={onSidebarOpen} className="lg:hidden w-11 h-11 flex items-center justify-center rounded-xl bg-[var(--lux-inline-hover-bg)] border border-[var(--lux-inline-border)] hover:bg-[var(--lux-inline-hover-bg-3)] transition-colors" aria-label="Menu">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" className="text-[var(--lux-text-body-2)]"><line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="18" x2="21" y2="18"/></svg>
              </button>
              <LanguageSwitcher />
              <Link href="/auth/login"><Button variant="ghost" className="text-[var(--lux-text-body-2)] hover:text-[var(--lux-text-primary)] hover:bg-[var(--lux-inline-hover-bg-3)] transition-all font-semibold hidden sm:inline-flex">{t('nav.login')}</Button></Link>
              <Link href="/auth/signup">
                <Button className="h-10 px-5 bg-gradient-to-r from-purple-500 to-blue-600 hover:from-purple-600 hover:to-blue-700 text-white font-extrabold shadow-lg shadow-purple-500/30 transition-all">
                  {t('nav.signup')} <ArrowRight className="w-4 h-4 ml-1.5" />
                </Button>
              </Link>
            </div>
          </div>
        </div>
      </div>
    </nav>
  )
}