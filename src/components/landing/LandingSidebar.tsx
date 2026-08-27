'use client'

import React from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import Image from 'next/image'
import { X, ChevronRight } from 'lucide-react'
import Link from 'next/link'
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
  return (
    <AnimatePresence>
      {isOpen && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="fixed inset-0 z-[70] bg-black/60 backdrop-blur-sm"
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
            className="fixed top-0 left-0 bottom-0 z-[80] w-[280px] bg-[#050510] border-r border-white/[0.08] flex flex-col"
          >
            <div className="flex items-center justify-between px-5 h-14 border-b border-white/[0.08]">
              <div className="flex items-center gap-2.5">
                <Image src="/logo.png" alt="LuxTrade" width={28} height={28} className="object-contain" />
                <span className="text-[15px] font-medium text-[#f0f2ff]">LuxTrade</span>
              </div>
              <button onClick={onClose} className="w-9 h-9 flex items-center justify-center rounded-lg hover:bg-white/[0.05] transition-colors" aria-label="Close">
                <X className="w-4 h-4 text-[#8892b0]" />
              </button>
            </div>

            <nav className="flex-1 overflow-y-auto py-6 px-3">
              <div className="mb-6">
                <p className="px-3 mb-3 text-[11px] font-medium tracking-[0.15em] text-[#8892b0] uppercase">
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
                    className="flex items-center justify-between px-3 py-2.5 rounded-xl text-[14px] text-[#8892b0] hover:text-[#f0f2ff] hover:bg-white/[0.03] transition-colors duration-200 group"
                  >
                    <span>{link.label}</span>
                    <ChevronRight className="w-3.5 h-3.5 text-[#2a3350] group-hover:text-[#4a5578] transition-colors" />
                  </a>
                ))}
              </div>

              <div className="mb-6">
                <p className="px-3 mb-3 text-[11px] font-medium tracking-[0.15em] text-[#8892b0] uppercase">
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
                    className="flex items-center justify-between px-3 py-2.5 rounded-xl text-[14px] text-[#8892b0] hover:text-[#f0f2ff] hover:bg-white/[0.03] transition-colors duration-200 group cursor-pointer"
                  >
                    <span>{item.label}</span>
                    <ChevronRight className="w-3.5 h-3.5 text-[#2a3350] group-hover:text-[#4a5578] transition-colors" />
                  </a>
                ))}
              </div>

              <div className="px-3">
                <p className="px-0 mb-3 text-[11px] font-medium tracking-[0.15em] text-[#8892b0] uppercase">
                  {language === 'id' ? 'Ikuti Kami' : 'Follow Us'}
                </p>
                <SocialIcons />
              </div>
            </nav>

            <div className="px-5 py-4 border-t border-white/[0.08] space-y-3">
              <div className="flex gap-2">
                <Link href="/auth/login" onClick={onClose} className="flex-1 text-center py-2.5 text-[13px] font-medium text-[#8892b0] border border-white/10 rounded-xl hover:text-white hover:border-white/20 transition-colors">
                  {t('nav.login')}
                </Link>
                <Link href="/auth/signup" onClick={onClose} className="flex-1 text-center py-2.5 text-[13px] font-medium text-white bg-blue-500 rounded-xl hover:bg-blue-600 transition-colors">
                  {t('nav.signup')}
                </Link>
              </div>
              <p className="text-[#8892b0] text-[11px]">© {new Date().getFullYear()} LuxTrade</p>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  )
}