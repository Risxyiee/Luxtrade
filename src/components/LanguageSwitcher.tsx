'use client'

import { useLanguage } from '@/contexts/LanguageContext'
import { Button } from '@/components/ui/button'

export default function LanguageSwitcher() {
  const { language, setLanguage, t } = useLanguage()

  return (
    <div className="flex items-center gap-1 bg-blue-500/10 rounded-lg p-1 border border-blue-500/30">
      <Button
        variant="ghost"
        size="sm"
        onClick={() => setLanguage('id')}
        className={`h-7 px-3 text-xs font-medium transition-all ${
          language === 'id'
            ? 'bg-blue-500 text-white shadow-[0_0_12px_rgba(59,130,246,0.3)]'
            : 'text-blue-300/60 hover:text-white hover:bg-blue-500/20'
        }`}
      >
        {t('nav.language.id')}
      </Button>
      <div className="w-px h-4 bg-blue-500/30" />
      <Button
        variant="ghost"
        size="sm"
        onClick={() => setLanguage('en')}
        className={`h-7 px-3 text-xs font-medium transition-all ${
          language === 'en'
            ? 'bg-blue-500 text-white shadow-[0_0_12px_rgba(59,130,246,0.3)]'
            : 'text-blue-300/60 hover:text-white hover:bg-blue-500/20'
        }`}
      >
        {t('nav.language.en')}
      </Button>
    </div>
  )
}
