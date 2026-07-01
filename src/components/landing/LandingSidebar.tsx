'use client'

import React from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import Image from 'next/image'
import { X, ChevronRight } from 'lucide-react'
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
          />
          <motion.div
            initial={{ x: '-100%' }}
            animate={{ x: 0 }}
            exit={{ x: '-100%' }}
            transition={{ type: 'spring', damping: 30, stiffness: 300 }}
            className="fixed top-0 left-0 bottom-0 z-[80] w-[280px] bg-[#0d0814]/95 backdrop-blur-xl border-r border-white/[0.08] flex flex-col"
          >
            {/* Sidebar Header */}
            <div className="flex items-center justify-between px-5 h-14 border-b border-white/[0.08]">
              <div className="flex items-center gap-2.5">
                <Image src="/logo.png" alt="LuxTrade" width={28} height={28} className="rounded-lg" />
                <span className="text-base font-extrabold bg-gradient-to-r from-white via-purple-200 to-purple-400 bg-clip-text text-transparent">LuxTrade</span>
              </div>
              <button onClick={onClose} className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-white/10 transition-colors" aria-label="Close">
                <X className="w-4 h-4 text-white/60" />
              </button>
            </div>

            {/* Sidebar Nav Links */}
            <nav className="flex-1 overflow-y-auto py-6 px-3">
              <div className="mb-6">
                <p className="px-3 mb-3 text-[10px] font-bold tracking-[0.2em] text-purple-400/70 uppercase">
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
                    className="flex items-center justify-between px-3 py-2.5 rounded-xl text-sm text-white/70 hover:text-white hover:bg-white/[0.05] transition-all group"
                  >
                    <span>{link.label}</span>
                    <ChevronRight className="w-3.5 h-3.5 text-white/20 group-hover:text-white/50 transition-colors" />
                  </a>
                ))}
              </div>

              <div className="mb-6">
                <p className="px-3 mb-3 text-[10px] font-bold tracking-[0.2em] text-purple-400/70 uppercase">
                  {language === 'id' ? 'Perusahaan' : 'Company'}
                </p>
                <a
                  onClick={() => { openLegalPage('contact'); onClose() }}
                  className="flex items-center justify-between px-3 py-2.5 rounded-xl text-sm text-white/70 hover:text-white hover:bg-white/[0.05] transition-all group cursor-pointer"
                >
                  <span>{language === 'id' ? 'Kontak' : 'Contact'}</span>
                  <ChevronRight className="w-3.5 h-3.5 text-white/20 group-hover:text-white/50 transition-colors" />
                </a>
                <a
                  onClick={() => { openLegalPage('terms'); onClose() }}
                  className="flex items-center justify-between px-3 py-2.5 rounded-xl text-sm text-white/70 hover:text-white hover:bg-white/[0.05] transition-all group cursor-pointer"
                >
                  <span>{language === 'id' ? 'Ketentuan' : 'Terms'}</span>
                  <ChevronRight className="w-3.5 h-3.5 text-white/20 group-hover:text-white/50 transition-colors" />
                </a>
                <a
                  onClick={() => { openLegalPage('refund'); onClose() }}
                  className="flex items-center justify-between px-3 py-2.5 rounded-xl text-sm text-white/70 hover:text-white hover:bg-white/[0.05] transition-all group cursor-pointer"
                >
                  <span>Refund Policy</span>
                  <ChevronRight className="w-3.5 h-3.5 text-white/20 group-hover:text-white/50 transition-colors" />
                </a>
              </div>

              {/* Sidebar Social */}
              <div className="px-3">
                <p className="px-0 mb-3 text-[10px] font-bold tracking-[0.2em] text-purple-400/70 uppercase">
                  {language === 'id' ? 'Ikuti Kami' : 'Follow Us'}
                </p>
                <SocialIcons />
              </div>
            </nav>

            {/* Sidebar Footer */}
            <div className="px-5 py-4 border-t border-white/[0.08]">
              <p className="text-white/30 text-xs">© {new Date().getFullYear()} LuxTrade. All rights reserved.</p>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  )
}