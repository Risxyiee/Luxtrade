'use client'

import React, { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import Image from 'next/image'
import { X, ChevronRight, Sun, Moon } from 'lucide-react'
import { type LegalPageTab } from '@/components/LegalPagesModal'
import SocialIcons from './SocialIcons'

interface LandingSidebarProps {
  isOpen: boolean
  onClose: () => void
  language: 'id' | 'en'
  t: (key: string) => string
  openLegalPage: (tab: LegalPageTab) => void
}

export default function LandingSidebar({ isOpen, onClose, language, t, openLegalPage }: LandingSidebarProps) {
  const [isDark, setIsDark] = useState(() => {
    if (typeof window === 'undefined') return true
    return localStorage.getItem('luxtrade-theme') !== 'light'
  })

  const toggleTheme = () => {
    const newDark = !isDark
    setIsDark(newDark)
    localStorage.setItem('luxtrade-theme', newDark ? 'dark' : 'light')
    document.documentElement.classList.toggle('dark', newDark)
    document.documentElement.classList.toggle('light', !newDark)
  }

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="fixed inset-0 z-[70] bg-[var(--lux-overlay-bg)] backdrop-blur-sm"
            onClick={onClose}
            aria-hidden="true"
          />
          <motion.div
            initial={{ x: '-100%' }}
            animate={{ x: 0 }}
            exit={{ x: '-100%' }}
            transition={{ type: 'spring', damping: 30, stiffness: 300 }}
            role="dialog"
            aria-modal="true"
            aria-label={language === 'id' ? 'Menu navigasi' : 'Navigation menu'}
            className="fixed top-0 left-0 bottom-0 z-[80] w-[280px] bg-[var(--lux-sidebar-panel-bg)] backdrop-blur-xl border-r border-[var(--lux-inline-border)] flex flex-col"
          >
            {/* Sidebar Header */}
            <div className="flex items-center justify-between px-5 h-14 border-b border-[var(--lux-inline-border)]">
              <div className="flex items-center gap-2.5">
                <Image src="/logo.png" alt="LuxTrade" width={28} height={28} className="rounded-lg" />
                <span className="text-base font-bold text-[var(--lux-text-primary)]">LuxTrade</span>
              </div>
              <button onClick={onClose} className="w-9 h-9 flex items-center justify-center rounded-lg hover:bg-[var(--lux-inline-hover-bg-2)] transition-colors" aria-label="Close">
                <X className="w-4 h-4 text-[var(--lux-text-body)]" />
              </button>
            </div>

            {/* Sidebar Nav Links */}
            <nav className="flex-1 overflow-y-auto py-6 px-3">
              <div className="mb-6">
                <p className="px-3 mb-3 text-[10px] font-medium tracking-[0.15em] text-[var(--lux-text-label-2)] uppercase">
                  {language === 'id' ? 'Produk' : 'Product'}
                </p>
                {[
                  { href: '#how-it-works', label: language === 'id' ? 'Cara Kerja' : 'How It Works' },
                  { href: '#features', label: language === 'id' ? 'Fitur' : 'Features' },
                  { href: '#pricing', label: language === 'id' ? 'Harga' : 'Pricing' },
                  { href: '#demo', label: t('hero.cta.secondary') },
                  { href: '#faq', label: 'FAQ' },
                ].map((link) => (
                  <a
                    key={link.href}
                    href={link.href}
                    onClick={onClose}
                    className="flex items-center justify-between px-3 py-2.5 rounded-xl text-sm text-[var(--lux-text-body-2)] hover:text-[var(--lux-text-primary)] hover:bg-[var(--lux-inline-hover-bg)] transition-all group"
                  >
                    <span>{link.label}</span>
                    <ChevronRight className="w-3.5 h-3.5 text-[var(--lux-text-label-3)] group-hover:text-[var(--lux-text-label-2)] transition-colors" />
                  </a>
                ))}
              </div>

              <div className="mb-6">
                <p className="px-3 mb-3 text-[10px] font-medium tracking-[0.15em] text-[var(--lux-text-label-2)] uppercase">
                  {language === 'id' ? 'Perusahaan' : 'Company'}
                </p>
                {[
                  { label: language === 'id' ? 'Kontak' : 'Contact', tab: 'contact' as LegalPageTab },
                  { label: language === 'id' ? 'Ketentuan' : 'Terms', tab: 'terms' as LegalPageTab },
                  { label: 'Refund Policy', tab: 'refund' as LegalPageTab },
                  { label: language === 'id' ? 'Privasi' : 'Privacy', tab: 'privacy' as LegalPageTab },
                ].map((item) => (
                  <a
                    key={item.tab}
                    onClick={() => { openLegalPage(item.tab); onClose() }}
                    className="flex items-center justify-between px-3 py-2.5 rounded-xl text-sm text-[var(--lux-text-body-2)] hover:text-[var(--lux-text-primary)] hover:bg-[var(--lux-inline-hover-bg)] transition-all group cursor-pointer"
                  >
                    <span>{item.label}</span>
                    <ChevronRight className="w-3.5 h-3.5 text-[var(--lux-text-label-3)] group-hover:text-[var(--lux-text-label-2)] transition-colors" />
                  </a>
                ))}
              </div>

              {/* Theme Toggle in Sidebar */}
              <div className="px-3 mb-6">
                <button
                  onClick={toggleTheme}
                  className="flex items-center gap-3 w-full px-3 py-2.5 rounded-xl text-sm text-[var(--lux-text-body-2)] hover:text-[var(--lux-text-primary)] hover:bg-[var(--lux-inline-hover-bg)] transition-all group"
                >
                  {isDark ? <Sun className="w-4 h-4 text-amber-400" /> : <Moon className="w-4 h-4 text-purple-400" />}
                  <span>{isDark ? (language === 'id' ? 'Mode Terang' : 'Light Mode') : (language === 'id' ? 'Mode Gelap' : 'Dark Mode')}</span>
                </button>
              </div>

              {/* Sidebar Social */}
              <div className="px-3">
                <p className="px-0 mb-3 text-[10px] font-medium tracking-[0.15em] text-[var(--lux-text-label-2)] uppercase">
                  {language === 'id' ? 'Ikuti Kami' : 'Follow Us'}
                </p>
                <SocialIcons />
              </div>
            </nav>

            {/* Sidebar Footer */}
            <div className="px-5 py-4 border-t border-[var(--lux-inline-border)]">
              <p className="text-[var(--lux-text-label)] text-xs">© {new Date().getFullYear()} LuxTrade. All rights reserved.</p>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  )
}