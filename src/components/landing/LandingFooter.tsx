'use client'

import React, { useState } from 'react'
import Image from 'next/image'
import { type LegalPageTab } from '@/components/LegalPagesModal'
import { toast } from 'sonner'
import SocialIcons from './SocialIcons'

interface LandingFooterProps {
  language: 'id' | 'en'
  openLegalPage: (tab: LegalPageTab) => void
}

export default function LandingFooter({ language, openLegalPage }: LandingFooterProps) {
  const [email, setEmail] = useState('')

  const handleSubscribe = (e: React.FormEvent) => {
    e.preventDefault()
    if (!email.trim() || !email.includes('@')) {
      toast.error(language === 'id' ? 'Masukkan email yang valid' : 'Please enter a valid email')
      return
    }
    toast.success(language === 'id' ? 'Terima kasih! Kamu akan mendapat tips trading & update.' : 'Thanks! You\'ll receive trading tips & updates.')
    setEmail('')
  }

  const t = (id: string, en: string) => language === 'id' ? id : en

  return (
    <footer className="border-t border-white/[0.06] bg-[#050510] mt-auto">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-14">
        {/* 4-column grid */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-10 mb-14">
          {/* Brand Column — spans 2 cols on md */}
          <div className="col-span-2">
            <div className="flex items-center gap-2.5 mb-4">
              <Image src="/logo.png" alt="LuxTrade" width={28} height={28} className="object-contain" />
              <span className="text-[15px] font-medium text-[#f0f2ff]">LuxTrade</span>
            </div>
            <p className="text-[#8892b0] max-w-sm text-[13px] leading-relaxed mb-5">
              {t(
                'Trading journal untuk trader Indonesia. Catat trade, lihat pola kesalahan, perbaiki strategi.',
                'A trading journal for traders. Log trades, see mistake patterns, fix your strategy.'
              )}
            </p>
            {/* Social Icons + extra X/Twitter link */}
            <div className="flex items-center gap-3">
              <SocialIcons footer />
              {/* Twitter/X icon */}
              <a
                href="#"
                target="_blank"
                rel="noopener noreferrer"
                aria-label="Twitter / X"
                className="w-10 h-10 rounded-xl bg-white/[0.03] border border-white/[0.08] flex items-center justify-center hover:bg-white/[0.05] hover:border-blue-400/30 transition-colors duration-200"
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" className="text-[#8892b0]">
                  <path d="M18.244 2.25h3.308l-7.227 8.26 8.425 11.24H16.17l-5.322-6.94-6.096 6.94H2.44l7.73-8.836L1.82 2.25H8.18l4.805 6.344 5.26-6.344Zm-1.176 17.94h1.836L7.18 4.126H5.204L17.068 20.19Z"/>
                </svg>
              </a>
            </div>
          </div>

          {/* Product Column */}
          <div>
            <h4 className="text-[12px] font-medium tracking-[0.12em] uppercase text-[#8892b0] mb-4">
              {t('Produk', 'Product')}
            </h4>
            <ul className="space-y-2.5">
              <li><a href="#features" className="text-[13px] text-[#8892b0] hover:text-[#f0f2ff] transition-colors duration-200">{t('Fitur', 'Features')}</a></li>
              <li><a href="#pricing" className="text-[13px] text-[#8892b0] hover:text-[#f0f2ff] transition-colors duration-200">{t('Harga', 'Pricing')}</a></li>
              <li><a href="#roadmap" className="text-[13px] text-[#8892b0] hover:text-[#f0f2ff] transition-colors duration-200">{t('Rencana', 'Roadmap')}</a></li>
              <li><a href="#demo" className="text-[13px] text-[#8892b0] hover:text-[#f0f2ff] transition-colors duration-200">Demo</a></li>
              <li><a href="#changelog" className="text-[13px] text-[#8892b0] hover:text-[#f0f2ff] transition-colors duration-200">{t('Changelog', 'Changelog')}</a></li>
            </ul>
          </div>

          {/* Company Column */}
          <div>
            <h4 className="text-[12px] font-medium tracking-[0.12em] uppercase text-[#8892b0] mb-4">
              {t('Perusahaan', 'Company')}
            </h4>
            <ul className="space-y-2.5">
              <li><button onClick={() => openLegalPage('contact')} className="text-[13px] text-[#8892b0] hover:text-[#f0f2ff] transition-colors duration-200">{t('Kontak', 'Contact')}</button></li>
              <li><a href="#about" className="text-[13px] text-[#8892b0] hover:text-[#f0f2ff] transition-colors duration-200">{t('Tentang Kami', 'About Us')}</a></li>
              <li><button onClick={() => openLegalPage('terms')} className="text-[13px] text-[#8892b0] hover:text-[#f0f2ff] transition-colors duration-200">{t('Ketentuan Layanan', 'Terms of Service')}</button></li>
              <li><button onClick={() => openLegalPage('privacy')} className="text-[13px] text-[#8892b0] hover:text-[#f0f2ff] transition-colors duration-200">{t('Kebijakan Privasi', 'Privacy Policy')}</button></li>
              <li><button onClick={() => openLegalPage('refund')} className="text-[13px] text-[#8892b0] hover:text-[#f0f2ff] transition-colors duration-200">{t('Kebijakan Refund', 'Refund Policy')}</button></li>
              <li><button onClick={() => openLegalPage('disclaimer')} className="text-[13px] text-[#8892b0] hover:text-[#f0f2ff] transition-colors duration-200">{t('Disclaimer', 'Disclaimer')}</button></li>
            </ul>
          </div>

          {/* Support Column (NEW) */}
          <div>
            <h4 className="text-[12px] font-medium tracking-[0.12em] uppercase text-[#8892b0] mb-4">
              {t('Bantuan', 'Support')}
            </h4>
            <ul className="space-y-2.5">
              <li><a href="#faq" className="text-[13px] text-[#8892b0] hover:text-[#f0f2ff] transition-colors duration-200">FAQ</a></li>
              <li><a href="https://discord.gg/KkYYFP9nC" target="_blank" rel="noopener noreferrer" className="text-[13px] text-[#8892b0] hover:text-[#f0f2ff] transition-colors duration-200">{t('Komunitas Discord', 'Discord Community')}</a></li>
              <li>
                <a href="mailto:luxtradee@gmail.com" className="text-[13px] text-[#8892b0] hover:text-[#f0f2ff] transition-colors duration-200 flex items-center gap-1.5">
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="shrink-0"><rect x="2" y="4" width="20" height="16" rx="2"/><path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7"/></svg>
                  luxtradee@gmail.com
                </a>
              </li>
              <li><a href="#" className="text-[13px] text-[#8892b0] hover:text-[#f0f2ff] transition-colors duration-200 flex items-center gap-1.5">
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="shrink-0"><circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/></svg>
                {t('Status', 'Status Page')}
              </a></li>
            </ul>
          </div>
        </div>

        {/* Newsletter Signup — glass morphic */}
        <div className="mb-10 p-5 sm:p-6 rounded-2xl bg-white/[0.03] border border-white/[0.08] backdrop-blur-xl">
          <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4">
            <div className="flex-1">
              <p className="text-[13px] font-medium text-[#f0f2ff]/80 mb-1">
                {t('Dapatkan tips trading & update', 'Get trading tips & updates')}
              </p>
              <p className="text-[11px] text-[#8892b0]/60">
                {t('Bergabung dengan 150+ trader. Tidak ada spam, berhenti kapan saja.', 'Join 150+ traders. No spam, unsubscribe anytime.')}
              </p>
            </div>
            <form onSubmit={handleSubscribe} className="flex w-full sm:w-auto gap-2">
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder={t('Email kamu', 'Your email')}
                className="flex-1 sm:w-56 px-4 py-2.5 text-[13px] rounded-xl bg-white/[0.04] border border-white/[0.08] text-[#f0f2ff] placeholder:text-[#8892b0]/40 focus:outline-none focus:border-blue-400/40 transition-colors"
              />
              <button
                type="submit"
                className="px-5 py-2.5 text-[13px] font-medium rounded-xl bg-gradient-to-r from-blue-500 to-cyan-400 text-white hover:opacity-90 transition-opacity shrink-0"
              >
                {t('Langganan', 'Subscribe')}
              </button>
            </form>
          </div>
        </div>

        {/* Bottom Bar */}
        <div className="pt-8 border-t border-white/[0.06] flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex flex-col sm:flex-row items-center gap-2 sm:gap-4">
            <p className="text-[#8892b0] text-[12px]">© 2025 LuxTrade</p>
            <span className="hidden sm:inline text-white/10">•</span>
            <p className="text-[#8892b0] text-[12px]">Made with ❤️ in Indonesia</p>
          </div>

          <div className="flex items-center gap-4 flex-wrap justify-center">
            <div className="flex items-center gap-2">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" className="opacity-40">
                <rect width="24" height="24" rx="6" fill="white/10"/>
                <path d="M6 8h12v2H6zM6 12h8v2H6zM6 16h10v2H6z" fill="#42B549"/>
              </svg>
              <span className="text-[#8892b0] text-[12px]">Powered by <span className="text-[#f0f2ff]/60">Midtrans</span></span>
            </div>
            <span className="text-white/10">•</span>
            <button onClick={() => openLegalPage('privacy')} className="text-[12px] text-[#8892b0]/50 hover:text-[#f0f2ff]/60 transition-colors">{t('Privasi', 'Privacy')}</button>
            <button onClick={() => openLegalPage('terms')} className="text-[12px] text-[#8892b0]/50 hover:text-[#f0f2ff]/60 transition-colors">{t('Ketentuan', 'Terms')}</button>
            <button onClick={() => openLegalPage('disclaimer')} className="text-[12px] text-[#8892b0]/50 hover:text-[#f0f2ff]/60 transition-colors">{t('Disclaimer', 'Disclaimer')}</button>
          </div>
        </div>
      </div>
    </footer>
  )
}
