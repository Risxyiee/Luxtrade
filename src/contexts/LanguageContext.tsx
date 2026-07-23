'use client'

import { createContext, useContext, useState, useEffect, ReactNode } from 'react'

export type Language = 'id' | 'en'

interface LanguageContextType {
  language: Language
  setLanguage: (lang: Language) => void
  t: (key: string) => string
  formatPrice: (amount: number) => string
}

const LanguageContext = createContext<LanguageContextType | undefined>(undefined)

const STORAGE_KEY = 'luxtrade_language'

export function LanguageProvider({ children }: { children: ReactNode }) {
  const [language, setLanguageState] = useState<Language>('id')

  // Load language preference from localStorage on mount
  useEffect(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY) as Language
      if (saved === 'id' || saved === 'en') {
        // Use setTimeout to avoid synchronous setState in effect
        setTimeout(() => {
          setLanguageState(saved)
        }, 0)
      }
    } catch (error) {
      console.error('Failed to load language preference:', error)
    }
  }, [])

  const setLanguage = (lang: Language) => {
    setLanguageState(lang)
    try {
      localStorage.setItem(STORAGE_KEY, lang)
    } catch (error) {
      console.error('Failed to save language preference:', error)
    }
  }

  const t = (key: string): string => {
    return translations[language][key] || key
  }

  const formatPrice = (amount: number): string => {
    if (language === 'en') {
      return `$${amount}`
    } else {
      return `Rp ${amount.toLocaleString('id-ID')}`
    }
  }

  return (
    <LanguageContext.Provider value={{ language, setLanguage, t, formatPrice }}>
      {children}
    </LanguageContext.Provider>
  )
}

export function useLanguage() {
  const context = useContext(LanguageContext)
  if (context === undefined) {
    throw new Error('useLanguage must be used within a LanguageProvider')
  }
  return context
}

// Translation dictionaries
const translations = {
  id: {
    // Navigation
    'nav.home': 'Beranda',
    'nav.features': 'Fitur',
    'nav.pricing': 'Harga',
    'nav.contact': 'Kontak',
    'nav.login': 'Masuk',
    'nav.signup': 'Daftar',
    'nav.dashboard': 'Dashboard',
    'nav.language.id': 'ID',
    'nav.language.en': 'EN',

    // Hero Section
    'hero.title': 'Berhenti Trading Asal-Asalan. Mulai Catat, Analisis, dan Bangun Edge Anda.',
    'hero.subtitle': 'Trading journal buat trader Indonesia — catat trade, deteksi pola kesalahan lewat AI, dan lihat equity curve kamu naik.',
    'hero.cta.primary': 'Daftar Gratis',
    'hero.cta.secondary': 'Lihat Dashboard',
    'hero.trust': 'Dibangun oleh trader, untuk trader Indonesia',

    // Features
    'features.title': 'Bukan Sekadar Catatan',
    'features.subtitle': 'Tools yang beneran bikin kamu sadar di mana uang kamu hilang — dan bagaimana menghentikannya.',
    'features.ai.title': 'AI Deteksi Kesalahan',
    'features.ai.desc': 'AI menganalisis pola trade kamu dan nunjukin kesalahan yang kamu ulang tanpa sadar',
    'features.journal.title': 'Jurnal Trading Detail',
    'features.journal.desc': 'Catat setup, emosi, alasan entry/exit — bukan cuma angka profit dan loss',
    'features.risk.title': 'Kalkulator Risiko',
    'features.risk.desc': 'Hitung lot size berdasarkan risk per trade dan balance akun, otomatis',
    'features.insights.title': 'Tracking Performa',
    'features.insights.desc': 'Equity curve, win rate per session, dan statistik yang bermakna — bukan angka kosong',

    // Pricing
    'pricing.title': 'Investasi Kecil, Perubahan Besar di Akun Kamu',
    'pricing.subtitle': 'Satu bulan Elite Pro cuma Rp 39.000 — kurang dari satu loss yang seharusnya bisa kamu hindari kalau jurnalnya rapi.',
    'pricing.free.title': 'GRATIS',
    'pricing.free.price': 'Rp 0 / Selamanya',
    'pricing.free.desc': 'Untuk pemula yang ingin mulai',
    'pricing.pro.title': 'ELITE PRO',
    'pricing.pro.price': 'Rp 39.000 / Bulan',
    'pricing.pro.desc': 'Untuk trader serius yang ingin profit konsisten',
    'pricing.annual.price': 'Rp 390.000 / Tahun',
    'pricing.annual.savings': 'Hemat 2 Bulan',
    'pricing.lifetime.title': 'LIFETIME ULTRA',
    'pricing.lifetime.price': 'Rp 299.000 / Sekali Bayar',
    'pricing.lifetime.promo': 'PROMO MERDEKA TRADER - HARGA SPESIAL!',
    'pricing.lifetime.desc': 'Akses seumur hidup dengan harga promo',
    'pricing.cta.free': 'Mulai Gratis',
    'pricing.cta.upgrade': 'Upgrade ke PRO',

    // Dashboard
    'dashboard.trades': 'Transaksi',
    'dashboard.journal': 'Jurnal',
    'dashboard.analytics': 'Analitik',
    'dashboard.watchlist': 'Daftar Pantauan',
    'dashboard.calendar': 'Kalender',
    'dashboard.news': 'Berita Pasar',
    'dashboard.settings': 'Pengaturan',
    'dashboard.logout': 'Keluar',

    // Paywall
    'paywall.title': 'Masa Uji Coba Fitur PRO Anda Telah Habis!',
    'paywall.subtitle': 'Upgrade untuk akses penuh',
    'paywall.trials': 'Sisa Uji Coba',
    'paywall.free.title': 'GRATIS',
    'paywall.free.price': 'Rp 0',
    'paywall.free.period': 'Selamanya',
    'paywall.pro.title': 'ELITE PRO',
    'paywall.pro.price': 'Rp 39.000',
    'paywall.pro.period': '/ Bulan',
    'paywall.annual.price': 'Rp 390.000',
    'paywall.annual.price_en': '$39.99',
    'paywall.lifetime.title': 'LIFETIME ULTRA',
    'paywall.lifetime.price': 'Rp 299.000',
    'paywall.lifetime.period': '/ Sekali Bayar',
    'paywall.lifetime.promo': 'PROMO MERDEKA TRADER - SISA 30 SLOT!',
    'paywall.buy': 'Beli Sekarang',
    'paywall.close': 'Tutup',
  },
  en: {
    // Navigation
    'nav.home': 'Home',
    'nav.features': 'Features',
    'nav.pricing': 'Pricing',
    'nav.contact': 'Contact',
    'nav.login': 'Login',
    'nav.signup': 'Sign Up',
    'nav.dashboard': 'Dashboard',
    'nav.language.id': 'ID',
    'nav.language.en': 'EN',

    // Hero Section
    'hero.title': 'Stop Trading Blind. Start Logging, Analyzing, and Building Your Edge.',
    'hero.subtitle': 'A trading journal built for traders — log your trades, let AI catch your repeating mistakes, and watch your equity curve climb.',
    'hero.cta.primary': 'Sign Up Free',
    'hero.cta.secondary': 'See Dashboard',
    'hero.trust': 'Built by traders, for traders',

    // Features
    'features.title': 'Not Just Another Logbook',
    'features.subtitle': 'Tools that actually show you where your money goes — and how to stop the bleed.',
    'features.ai.title': 'AI Mistake Detection',
    'features.ai.desc': 'AI scans your trade history and highlights the mistakes you keep repeating without realizing',
    'features.journal.title': 'Detailed Trade Journal',
    'features.journal.desc': 'Log your setup, emotions, entry/exit reasoning — not just P/L numbers',
    'features.risk.title': 'Risk Calculator',
    'features.risk.desc': 'Auto-calculate lot size based on your risk per trade and account balance',
    'features.insights.title': 'Performance Tracking',
    'features.insights.desc': 'Equity curve, win rate per session, and stats that actually mean something',

    // Pricing
    'pricing.title': 'Small Investment, Real Impact on Your Trading',
    'pricing.subtitle': 'One month of Elite Pro costs less than a single avoidable loss — the kind you catch when your journal actually works.',
    'pricing.free.title': 'FREE',
    'pricing.free.price': '$0 / Forever',
    'pricing.free.desc': 'For beginners who want to start',
    'pricing.pro.title': 'ELITE PRO',
    'pricing.pro.price': '$4.99 / Month',
    'pricing.pro.desc': 'For serious traders who want consistent profits',
    'pricing.annual.price': '$39.99 / Year',
    'pricing.annual.savings': 'Save 2 Months',
    'pricing.lifetime.title': 'LIFETIME ULTRA',
    'pricing.lifetime.price': '$29.99 / One-Time Payment',
    'pricing.lifetime.promo': 'SPECIAL PROMO PRICE!',
    'pricing.lifetime.desc': 'Lifetime access at promotional price',
    'pricing.cta.free': 'Start Free',
    'pricing.cta.upgrade': 'Upgrade to PRO',

    // Dashboard
    'dashboard.trades': 'Trades',
    'dashboard.journal': 'Journal',
    'dashboard.analytics': 'Analytics',
    'dashboard.watchlist': 'Watchlist',
    'dashboard.calendar': 'Calendar',
    'dashboard.news': 'Market News',
    'dashboard.settings': 'Settings',
    'dashboard.logout': 'Logout',

    // Paywall
    'paywall.title': 'Your PRO Trial Has Expired!',
    'paywall.subtitle': 'Upgrade for full access',
    'paywall.trials': 'Trials Remaining',
    'paywall.free.title': 'FREE',
    'paywall.free.price': '$0',
    'paywall.free.period': 'Forever',
    'paywall.pro.title': 'ELITE PRO',
    'paywall.pro.price': '$4.99',
    'paywall.pro.period': '/ Month',
    'paywall.lifetime.title': 'LIFETIME ULTRA',
    'paywall.lifetime.price': '$29.99',
    'paywall.lifetime.period': '/ One-Time',
    'paywall.lifetime.promo': 'PROMO: ONLY 30 SLOTS LEFT!',
    'paywall.buy': 'Buy Now',
    'paywall.close': 'Close',
  },
}
