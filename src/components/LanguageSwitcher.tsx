'use client'

import { useLanguage } from '@/contexts/LanguageContext'
import { Button } from '@/components/ui/button'

export default function LanguageSwitcher() {
  const { language, setLanguage, t } = useLanguage()

  return (
    <div className="flex items-center gap-1 bg-white/5 rounded-lg p-1 border border-white/10">
      <Button
        variant={language === 'id' ? 'default' : 'ghost'}
        size="sm"
        onClick={() => setLanguage('id')}
        className={`h-7 px-3 text-xs font-medium transition-all ${
          language === 'id'
            ? 'bg-purple-600 text-white'
            : 'text-gray-400 hover:text-white hover:bg-white/10'
        }`}
      >
        {t('nav.language.id')}
      </Button>
      <div className="w-px h-4 bg-white/20" />
      <Button
        variant={language === 'en' ? 'default' : 'ghost'}
        size="sm"
        onClick={() => setLanguage('en')}
        className={`h-7 px-3 text-xs font-medium transition-all ${
          language === 'en'
            ? 'bg-purple-600 text-white'
            : 'text-gray-400 hover:text-white hover:bg-white/10'
        }`}
      >
        {t('nav.language.en')}
      </Button>
    </div>
  )
}
