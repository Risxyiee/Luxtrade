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
    <footer className="border-t border-white/[0.06] bg-[#050510] mt-auto">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-14">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-10 mb-12">
          {/* Brand */}
          <div className="col-span-2">
            <div className="flex items-center gap-2.5 mb-4">
              <Image src="/logo.png" alt="LuxTrade" width={28} height={28} className="object-contain" />
              <span className="text-[15px] font-medium text-[#f0f2ff]">LuxTrade</span>
            </div>
            <p className="text-[#8892b0] max-w-sm text-[13px] leading-relaxed mb-5">
              {language === 'id'
                ? 'Trading journal untuk trader Indonesia. Catat trade, lihat pola kesalahan, perbaiki strategi.'
                : 'A trading journal for traders. Log trades, see mistake patterns, fix your strategy.'}
            </p>
            <SocialIcons footer />
          </div>

          {/* Product */}
          <div>
            <h4 className="text-[12px] font-medium tracking-[0.12em] uppercase text-[#8892b0] mb-4">{language === 'id' ? 'Produk' : 'Product'}</h4>
            <ul className="space-y-2.5">
              <li><a href="#features" className="text-[13px] text-[#8892b0] hover:text-[#f0f2ff] transition-colors duration-200">{language === 'id' ? 'Fitur' : 'Features'}</a></li>
              <li><a href="#pricing" className="text-[13px] text-[#8892b0] hover:text-[#f0f2ff] transition-colors duration-200">{language === 'id' ? 'Harga' : 'Pricing'}</a></li>
              <li><a href="#roadmap" className="text-[13px] text-[#8892b0] hover:text-[#f0f2ff] transition-colors duration-200">{language === 'id' ? 'Rencana' : 'Roadmap'}</a></li>
              <li><a href="#demo" className="text-[13px] text-[#8892b0] hover:text-[#f0f2ff] transition-colors duration-200">Demo</a></li>
            </ul>
          </div>

          {/* Legal */}
          <div>
            <h4 className="text-[12px] font-medium tracking-[0.12em] uppercase text-[#8892b0] mb-4">{language === 'id' ? 'Perusahaan' : 'Company'}</h4>
            <ul className="space-y-2.5">
              <li><button onClick={() => openLegalPage('contact')} className="text-[13px] text-[#8892b0] hover:text-[#f0f2ff] transition-colors duration-200">{language === 'id' ? 'Kontak' : 'Contact'}</button></li>
              <li><button onClick={() => openLegalPage('terms')} className="text-[13px] text-[#8892b0] hover:text-[#f0f2ff] transition-colors duration-200">{language === 'id' ? 'Ketentuan Layanan' : 'Terms of Service'}</button></li>
              <li><button onClick={() => openLegalPage('refund')} className="text-[13px] text-[#8892b0] hover:text-[#f0f2ff] transition-colors duration-200">Refund Policy</button></li>
              <li><button onClick={() => openLegalPage('privacy')} className="text-[13px] text-[#8892b0] hover:text-[#f0f2ff] transition-colors duration-200">{language === 'id' ? 'Kebijakan Privasi' : 'Privacy Policy'}</button></li>
            </ul>
          </div>
        </div>

        {/* Bottom */}
        <div className="pt-8 border-t border-white/[0.06] flex flex-col sm:flex-row items-center justify-between gap-3">
          <p className="text-[#8892b0] text-[12px]">© {new Date().getFullYear()} LuxTrade. All rights reserved.</p>
          <div className="flex items-center gap-2">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" className="opacity-40">
              <rect width="24" height="24" rx="6" fill="white/10"/>
              <path d="M6 8h12v2H6zM6 12h8v2H6zM6 16h10v2H6z" fill="#42B549"/>
            </svg>
            <span className="text-[#8892b0] text-[12px]">Powered by <span className="text-[#f0f2ff]/60">Midtrans</span></span>
          </div>
        </div>
      </div>
    </footer>
  )
}
