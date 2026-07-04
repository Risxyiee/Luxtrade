'use client'

import React from 'react'
import Image from 'next/image'
import { type LegalPageTab } from '@/components/LegalPagesModal'
import SocialIcons from './SocialIcons'

interface LandingFooterProps {
  language: 'id' | 'en'
  openLegalPage: (tab: LegalPageTab) => void
}

export default function LandingFooter({ language, openLegalPage }: LandingFooterProps) {
  return (
    <footer className="border-t border-[var(--lux-inline-border)] py-12 px-4 sm:px-6 lg:px-8 mt-auto">
      <div className="max-w-7xl mx-auto">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-8 mb-10">
          {/* Brand Column */}
          <div className="col-span-2">
            <div className="flex items-center gap-3 mb-4">
              <Image src="/logo.png" alt="LuxTrade Logo" width={40} height={40} className="rounded-xl shadow-lg" />
              <div>
                <span className="text-xl font-extrabold bg-gradient-to-r from-[var(--lux-text-primary)] via-purple-400 to-purple-500 bg-clip-text text-transparent">LuxTrade</span>
                <span className="text-[10px] text-purple-400/70 ml-2 tracking-[0.2em] font-bold">PREMIUM</span>
              </div>
            </div>
            <p className="text-[var(--lux-text-subtitle)] mb-6 max-w-sm text-sm leading-relaxed">
              {language === 'id' ? 'Trading journal untuk trader Indonesia. Catat trade kamu, lihat pola kesalahan, dan perbaiki strategi — bukan cuma lihat profit loss.' : 'A trading journal for traders. Log your trades, see your mistake patterns, and fix your strategy — not just stare at P/L.'}
            </p>
            <SocialIcons footer />
          </div>

          {/* Product Column */}
          <div>
            <h4 className="font-bold text-[var(--lux-text-primary)] mb-4 text-sm">{language === 'id' ? 'Produk' : 'Product'}</h4>
            <ul className="space-y-2.5">
              <li><a href="#features" className="text-[var(--lux-text-subtitle)] hover:text-purple-400 transition-colors text-sm">{language === 'id' ? 'Fitur' : 'Features'}</a></li>
              <li><a href="#pricing" className="text-[var(--lux-text-subtitle)] hover:text-purple-400 transition-colors text-sm">{language === 'id' ? 'Harga' : 'Pricing'}</a></li>
              <li><a href="#testimonials" className="text-[var(--lux-text-subtitle)] hover:text-purple-400 transition-colors text-sm">{language === 'id' ? 'Testimoni' : 'Testimonials'}</a></li>
              <li><a href="#roadmap" className="text-[var(--lux-text-subtitle)] hover:text-purple-400 transition-colors text-sm">{language === 'id' ? 'Rencana' : 'Roadmap'}</a></li>
              <li><a href="#demo" className="text-[var(--lux-text-subtitle)] hover:text-purple-400 transition-colors text-sm">{language === 'id' ? 'Demo' : 'Demo'}</a></li>
            </ul>
          </div>

          {/* Company Column */}
          <div>
            <h4 className="font-bold text-[var(--lux-text-primary)] mb-4 text-sm">{language === 'id' ? 'Perusahaan' : 'Company'}</h4>
            <ul className="space-y-2.5">
              <li><button onClick={() => openLegalPage('contact')} className="text-[var(--lux-text-subtitle)] hover:text-purple-400 transition-colors text-sm cursor-pointer">{language === 'id' ? 'Kontak' : 'Contact'}</button></li>
              <li><button onClick={() => openLegalPage('terms')} className="text-[var(--lux-text-subtitle)] hover:text-purple-400 transition-colors text-sm cursor-pointer">{language === 'id' ? 'Ketentuan Layanan' : 'Terms of Service'}</button></li>
              <li><button onClick={() => openLegalPage('refund')} className="text-[var(--lux-text-subtitle)] hover:text-purple-400 transition-colors text-sm cursor-pointer">Refund Policy</button></li>
              <li><button onClick={() => openLegalPage('faq')} className="text-[var(--lux-text-subtitle)] hover:text-purple-400 transition-colors text-sm cursor-pointer">FAQ</button></li>
            </ul>
          </div>
        </div>

        {/* Bottom bar */}
        <div className="pt-8 border-t border-[var(--lux-inline-border)]">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
            <p className="text-[var(--lux-text-label-2)] text-xs">© {new Date().getFullYear()} LuxTrade. All rights reserved.</p>
            <div className="flex items-center gap-2">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" className="opacity-40">
                <rect width="24" height="24" rx="6" fill="var(--lux-icon-circle-bg)"/>
                <path d="M6 8h12v2H6zM6 12h8v2H6zM6 16h10v2H6z" fill="#42B549"/>
              </svg>
              <span className="text-[var(--lux-text-label)] text-xs">Powered by <span className="font-semibold text-[var(--lux-text-label-2)]">Midtrans</span> — {language === 'id' ? 'Pembayaran Aman' : 'Secure Payments'}</span>
            </div>
          </div>
        </div>
      </div>
    </footer>
  )
}