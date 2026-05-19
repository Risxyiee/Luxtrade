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
        setLanguageState(saved)
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
    'hero.title': 'Tingkatkan Trading Forex Anda dengan Analisis AI Cerdas',
    'hero.subtitle': 'Platform trading journal pertama di Indonesia dengan analisis AI, manajemen risiko otomatis, dan insight pasar real-time.',
    'hero.cta.primary': 'Mulai Gratis Sekarang',
    'hero.cta.secondary': 'Lihat Demo',
    'hero.trust': 'Dipercaya oleh 10,000+ trader Indonesia',

    // Features
    'features.title': 'Fitur Unggulan',
    'features.subtitle': 'Semua yang Anda butuhkan untuk trading yang lebih profitable',
    'features.ai.title': 'Analisis AI Cerdas',
    'features.ai.desc': 'Dapatkan insight trading otomatis berdasarkan riwayat trading Anda',
    'features.journal.title': 'Jurnal Trading Lengkap',
    'features.journal.desc': 'Catat setiap trade dengan detail dan analisis emosi',
    'features.risk.title': 'Manajemen Risiko',
    'features.risk.desc': 'Kalkulator lot size dan manajemen risiko otomatis',
    'features.insights.title': 'Insight Pasar',
    'features.insights.desc': 'Berita dan kalender ekonomi real-time',

    // Pricing
    'pricing.title': 'Pilih Paket yang Tepat untuk Anda',
    'pricing.subtitle': 'Mulai gratis, upgrade kapan saja',
    'pricing.free.title': 'GRATIS',
    'pricing.free.price': 'Rp 0 / Selamanya',
    'pricing.free.desc': 'Untuk pemula yang ingin mulai',
    'pricing.pro.title': 'ELITE PRO',
    'pricing.pro.price': 'Rp 49.000 / Bulan',
    'pricing.pro.desc': 'Untuk trader serius yang ingin profit konsisten',
    'pricing.lifetime.title': 'LIFETIME ULTRA',
    'pricing.lifetime.price': 'Rp 52.000 / Sekali Bayar',
    'pricing.lifetime.promo': 'PROMO MERDEKA TRADER - SISA 30 SLOT!',
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
    'paywall.pro.price': 'Rp 49.000',
    'paywall.pro.period': '/ Bulan',
    'paywall.lifetime.title': 'LIFETIME ULTRA',
    'paywall.lifetime.price': 'Rp 52.000',
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
    'hero.title': 'Elevate Your Forex Trading with Smart AI Analysis',
    'hero.subtitle': 'The first trading journal platform in Indonesia with AI analysis, automatic risk management, and real-time market insights.',
    'hero.cta.primary': 'Start Free Now',
    'hero.cta.secondary': 'View Demo',
    'hero.trust': 'Trusted by 10,000+ Indonesian traders',

    // Features
    'features.title': 'Premium Features',
    'features.subtitle': 'Everything you need for more profitable trading',
    'features.ai.title': 'Smart AI Analysis',
    'features.ai.desc': 'Get automatic trading insights based on your trading history',
    'features.journal.title': 'Complete Trading Journal',
    'features.journal.desc': 'Record every trade with detailed emotion analysis',
    'features.risk.title': 'Risk Management',
    'features.risk.desc': 'Automatic lot size calculator and risk management',
    'features.insights.title': 'Market Insights',
    'features.insights.desc': 'Real-time news and economic calendar',

    // Pricing
    'pricing.title': 'Choose the Right Plan for You',
    'pricing.subtitle': 'Start free, upgrade anytime',
    'pricing.free.title': 'FREE',
    'pricing.free.price': '$0 / Forever',
    'pricing.free.desc': 'For beginners who want to start',
    'pricing.pro.title': 'ELITE PRO',
    'pricing.pro.price': '$3 / Month',
    'pricing.pro.desc': 'For serious traders who want consistent profits',
    'pricing.lifetime.title': 'LIFETIME ULTRA',
    'pricing.lifetime.price': '$5 / One-Time Payment',
    'pricing.lifetime.promo': 'PROMO: ONLY 30 SLOTS LEFT!',
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
    'paywall.pro.price': '$3',
    'paywall.pro.period': '/ Month',
    'paywall.lifetime.title': 'LIFETIME ULTRA',
    'paywall.lifetime.price': '$5',
    'paywall.lifetime.period': '/ One-Time',
    'paywall.lifetime.promo': 'PROMO: ONLY 30 SLOTS LEFT!',
    'paywall.buy': 'Buy Now',
    'paywall.close': 'Close',
  },
}
