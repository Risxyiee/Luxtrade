'use client'

import {
  BarChart3, Activity, Calendar, BookOpen, Eye,
  Newspaper, CalendarDays, Trophy, Target, Grid3X3, PieChart,
  Brain, FileText, Flame, Heart, Lock
} from 'lucide-react'

const menuCategories = {
  utama: { label: 'UTAMA' },
  pasar: { label: 'PASAR' },
  alat: { label: 'ALAT', proType: 'gold' },
  lanjutan: { label: 'LANJUTAN', proType: 'purple' },
}

const menuItems = [
  { id: 'dashboard', label: 'Dashboard', labelId: 'Dasbor', icon: BarChart3, category: 'utama', proOnly: false },
  { id: 'trades', label: 'Trades', labelId: 'Transaksi', icon: Activity, category: 'utama', proOnly: false },
  { id: 'calendar', label: 'Calendar', labelId: 'Kalender', icon: Calendar, category: 'utama', proOnly: false },
  { id: 'journal', label: 'Journal', labelId: 'Jurnal', icon: BookOpen, category: 'utama', proOnly: false },

  { id: 'watchlist', label: 'Watchlist', labelId: 'Daftar Pantauan', icon: Eye, category: 'pasar', proOnly: false },
  { id: 'news', label: 'Market News', labelId: 'Berita Pasar', icon: Newspaper, category: 'pasar', proOnly: false },
  { id: 'economic-calendar', label: 'Economic Calendar', labelId: 'Kalender Ekonomi', icon: CalendarDays, category: 'pasar', proOnly: false },

  { id: 'risk', label: 'Risk Calculator', labelId: 'Kalkulator Risiko', icon: Target, category: 'alat', proOnly: true, proType: 'gold' },
  { id: 'heatmap', label: 'Market Heatmap', labelId: 'Pasar Heatmap', icon: Grid3X3, category: 'alat', proOnly: true, proType: 'gold' },
  { id: 'analytics', label: 'Analytics', labelId: 'Analitik', icon: PieChart, category: 'alat', proOnly: true, proType: 'gold' },
  { id: 'targets', label: 'Targets', labelId: 'Target', icon: Target, category: 'alat', proOnly: true, proType: 'gold' },

  { id: 'ai', label: 'AI Insights', labelId: 'Insight AI', icon: Brain, category: 'lanjutan', proOnly: true, proType: 'purple' },
  { id: 'score', label: 'Trading Score', labelId: 'Skor Trading', icon: Trophy, category: 'lanjutan', proOnly: true, proType: 'purple' },
  { id: 'report', label: 'Weekly Report', labelId: 'Laporan Mingguan', icon: FileText, category: 'lanjutan', proOnly: true, proType: 'purple' },
  { id: 'streaks', label: 'Streaks', labelId: 'Streak', icon: Flame, category: 'lanjutan', proOnly: true, proType: 'purple' },
  { id: 'psychology', label: 'Psychology', labelId: 'Psikologi', icon: Heart, category: 'lanjutan', proOnly: true, proType: 'purple' },
  { id: 'achievements', label: 'Achievements', labelId: 'Pencapaian', icon: Trophy, category: 'lanjutan', proOnly: true, proType: 'purple' },
]

interface SidebarNavProps {
  sidebarOpen: boolean
  mobileSidebarOpen: boolean
  activeTab: string
  setActiveTab: (tab: string) => void
  isPro: boolean
  language: 'id' | 'en'
  setPlanSelectionModalOpen: (open: boolean) => void
  setMobileSidebarOpen: (open: boolean) => void
}

export { menuCategories, menuItems }

export default function SidebarNav({
  sidebarOpen,
  mobileSidebarOpen,
  activeTab,
  setActiveTab,
  isPro,
  language,
  setPlanSelectionModalOpen,
  setMobileSidebarOpen
}: SidebarNavProps) {
  const isOpen = sidebarOpen || mobileSidebarOpen

  return (
    <nav className="px-2.5 py-2 space-y-3 relative">
      {(['utama', 'pasar', 'alat', 'lanjutan'] as const).map((category) => {
        const categoryItems = menuItems.filter(item => item.category === category)
        const catInfo = menuCategories[category]

        return (
          <div key={category} className="space-y-0.5">
            {isOpen && (
              <div className="flex items-center gap-2 px-3 pt-2 pb-1">
                <span className={[
                  'text-[9px] font-semibold tracking-[0.15em]',
                  category === 'utama'
                    ? 'text-lux-text-muted/60 dark:text-gray-600'
                    : 'text-blue-500/60 dark:text-blue-400/60'
                ].join(' ')}>
                  {catInfo.label}
                </span>
                {catInfo.proType && (
                  <span className="text-[6px] font-black px-1 py-px rounded bg-gradient-to-r from-blue-500/80 to-cyan-500/80 text-white/90">
                    PRO
                  </span>
                )}
                <div className="flex-1 h-px bg-white/[0.04]" />
              </div>
            )}

            {categoryItems.map((item: any) => {
              const isLocked = item.proOnly && !isPro
              const isActive = activeTab === item.id
              const Icon = item.icon
              const isCollapsed = !isOpen

              const iconColor = isActive
                ? 'text-blue-400'
                : isLocked
                  ? ''
                  : 'group-hover:text-blue-400'

              const btnBase = 'w-full flex items-center gap-3 rounded-xl transition-all duration-150 relative group'
              const btnSize = isCollapsed ? 'justify-center px-0 py-2.5' : 'px-3 py-2'
              const btnState = isActive
                ? 'bg-blue-500/15 text-white dark:text-white'
                : isLocked
                  ? 'text-lux-text-muted/40 dark:text-gray-600/40 hover:text-lux-text-muted dark:hover:text-gray-400'
                  : 'text-lux-text-muted dark:text-gray-500 hover:text-white dark:hover:text-white hover:bg-white/[0.04]'

              return (
                <button
                  key={item.id}
                  onClick={() => {
                    if (isLocked) {
                      setPlanSelectionModalOpen(true)
                    } else {
                      setActiveTab(item.id)
                      setMobileSidebarOpen(false)
                    }
                    if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
                      navigator.vibrate(5)
                    }
                  }}
                  aria-label={language === 'id' ? item.labelId : item.label}
                  aria-current={isActive ? 'page' : undefined}
                  title={language === 'id' ? item.labelId : item.label}
                  className={[btnBase, btnSize, btnState].join(' ')}
                >
                  {isActive && (
                    <div className="absolute left-0 top-1/2 -translate-y-1/2 w-[3px] h-5 rounded-full bg-blue-500 shadow-[0_0_12px_rgba(59,130,246,0.5)]" />
                  )}

                  <Icon className={["w-[18px]", "h-[18px]", "flex-shrink-0", "transition-colors", iconColor].join(' ')} />

                  {isOpen && (
                    <span className={[
                      'text-[13px] font-medium flex-1 text-left truncate',
                      isActive ? 'text-white' : ''
                    ].join(' ')}>
                      {language === 'id' ? item.labelId : item.label}
                    </span>
                  )}

                  {isOpen && item.proOnly && (
                    <Lock className={[
                      'w-3 h-3 flex-shrink-0',
                      item.proType === 'gold' ? 'text-blue-500/50' : 'text-cyan-500/50'
                    ].join(' ')} />
                  )}
                </button>
              )
            })}
          </div>
        )
      })}
    </nav>
  )
}
