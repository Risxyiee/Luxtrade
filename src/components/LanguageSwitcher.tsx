'use client'

import { useLanguage } from '@/contexts/LanguageContext'

export default function LanguageSwitcher() {
  const { language, setLanguage } = useLanguage()

  return (
    <div className="flex items-center rounded-full border border-white/15 bg-white/5 overflow-hidden">
      <button
        onClick={() => setLanguage('id')}
        className={`px-2.5 py-1 text-[11px] font-bold tracking-wider transition-all duration-200 ${
          language === 'id'
            ? 'bg-cyan-500/20 text-cyan-400 border-r border-white/10'
            : 'text-white/50 hover:text-white/80'
        }`}
        title="Bahasa Indonesia"
      >
        ID
      </button>
      <button
        onClick={() => setLanguage('en')}
        className={`px-2.5 py-1 text-[11px] font-bold tracking-wider transition-all duration-200 ${
          language === 'en'
            ? 'bg-cyan-500/20 text-cyan-400'
            : 'text-white/50 hover:text-white/80'
        }`}
        title="English"
      >
        EN
      </button>
    </div>
  )
}
