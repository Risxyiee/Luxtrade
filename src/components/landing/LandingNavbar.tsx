'use client'

import React from 'react'
import { motion } from 'framer-motion'
import Link from 'next/link'
import Image from 'next/image'
import { ArrowRight } from 'lucide-react'
import { Button } from '@/components/ui/button'
import LanguageSwitcher from '@/components/LanguageSwitcher'

interface LandingNavbarProps {
  language: 'id' | 'en'
  t: (key: string) => string
  onSidebarOpen: () => void
}

export default function LandingNavbar({ language, t, onSidebarOpen }: LandingNavbarProps) {
  return (
    <nav className="fixed top-10 left-0 right-0 z-50">
      <div className="backdrop-blur-xl bg-[#0f051d]/80 border-b border-white/[0.08]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-14">
            <div className="flex items-center gap-3">
              <div className="relative">
                <Image src="/logo.png" alt="LuxTrade Logo" width={40} height={40} className="rounded-xl shadow-lg" />
                <motion.div className="absolute -bottom-1 -right-1 w-3 h-3 bg-emerald-400 rounded-full border-2 border-[#0f051d]" animate={{ boxShadow: ['0 0 0 0 rgba(16, 185, 129, 0.7)', '0 0 0 8px rgba(16, 185, 129, 0)', '0 0 0 0 rgba(16, 185, 129, 0.7)'] }} transition={{ duration: 2, repeat: Infinity }} />
              </div>
              <div>
                <span className="text-xl font-extrabold bg-gradient-to-r from-white via-purple-200 to-purple-400 bg-clip-text text-transparent">LuxTrade</span>
                <span className="hidden sm:inline text-[10px] text-purple-400/70 ml-2 tracking-[0.2em] font-bold">PREMIUM</span>
              </div>
            </div>
            <div className="hidden md:flex items-center gap-8">
              {[
                { key: 'how-it-works', label: language === 'id' ? 'Cara Kerja' : 'How It Works' },
                { key: 'features', label: t('nav.features') },
                { key: 'pricing', label: t('nav.pricing') },
                { key: 'demo', label: t('hero.cta.secondary') },
                { key: 'faq', label: 'FAQ' },
              ].map((item) => (
                <a key={item.key} href={`#${item.key}`} className="text-sm text-white/60 hover:text-white transition-colors font-medium relative group">
                  {item.label}
                  <span className="absolute -bottom-1 left-0 w-0 h-0.5 bg-gradient-to-r from-purple-500 to-blue-500 group-hover:w-full transition-all duration-300" />
                </a>
              ))}
            </div>
            <div className="flex items-center gap-3">
              <button onClick={onSidebarOpen} className="lg:hidden w-10 h-10 flex items-center justify-center rounded-xl bg-white/5 border border-white/[0.08] hover:bg-white/10 transition-colors" aria-label="Menu">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" className="text-white/80"><line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="18" x2="21" y2="18"/></svg>
              </button>
              <LanguageSwitcher />
              <Link href="/auth/login"><Button variant="ghost" className="text-white/70 hover:text-white hover:bg-white/10 transition-all font-semibold hidden sm:inline-flex">{t('nav.login')}</Button></Link>
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