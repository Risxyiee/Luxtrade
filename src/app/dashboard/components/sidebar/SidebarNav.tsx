'use client'

import {
  BarChart3, Activity, Calendar, BookOpen, Eye,
  Newspaper, CalendarDays, Trophy, Target, Grid3X3, PieChart,
  Brain, FileText, Flame, Heart, Lock
} from 'lucide-react'
import { ContextGuide, useContextGuides, guideData } from '@/components/ContextGuide'

const menuCategories = {
  utama: { label: 'UTAMA' },
  pasar: { label: 'PASAR' },
  alat: { label: 'ALAT', proType: 'gold' },
  lanjutan: { label: 'LANJUTAN', proType: 'purple' },
}

const menuItems = [
  // UTAMA - Tanpa PRO
  { id: 'dashboard', label: 'Dashboard', labelId: 'Dasbor', icon: BarChart3, category: 'utama', proOnly: false },
  { id: 'trades', label: 'Trades', labelId: 'Transaksi', icon: Activity, category: 'utama', proOnly: false },
  { id: 'calendar', label: 'Calendar', labelId: 'Kalender', icon: Calendar, category: 'utama', proOnly: false },
  { id: 'journal', label: 'Journal', labelId: 'Jurnal', icon: BookOpen, category: 'utama', proOnly: false },

  // PASAR - Tanpa PRO
  { id: 'watchlist', label: 'Watchlist', labelId: 'Daftar Pantauan', icon: Eye, category: 'pasar', proOnly: false },
  { id: 'news', label: 'Market News', labelId: 'Berita Pasar', icon: Newspaper, category: 'pasar', proOnly: false },
  { id: 'economic-calendar', label: 'Economic Calendar', labelId: 'Kalender Ekonomi', icon: CalendarDays, category: 'pasar', proOnly: false },

  // ALAT - PRO Emas
  { id: 'risk', label: 'Risk Calculator', labelId: 'Kalkulator Risiko', icon: Target, category: 'alat', proOnly: true, proType: 'gold' },
  { id: 'heatmap', label: 'Market Heatmap', labelId: 'Pasar Heatmap', icon: Grid3X3, category: 'alat', proOnly: true, proType: 'gold' },
  { id: 'analytics', label: 'Analytics', labelId: 'Analitik', icon: PieChart, category: 'alat', proOnly: true, proType: 'gold' },
  { id: 'targets', label: 'Targets', labelId: 'Target', icon: Target, category: 'alat', proOnly: true, proType: 'gold' },

  // LANJUTAN - PRO Ungu
  { id: 'ai', label: 'AI Insights', labelId: 'Insight AI', icon: Brain, category: 'lanjutan', proOnly: true, proType: 'purple' },
  { id: 'score', label: 'Trading Score', labelId: 'Skor Trading', icon: Trophy, category: 'lanjutan', proOnly: true, proType: 'purple' },
  { id: 'report', label: 'Weekly Report', labelId: 'Laporan Mingguan', icon: FileText, category: 'lanjutan', proOnly: true, proType: 'purple' },
  { id: 'streaks', label: 'Streaks', labelId: 'Streak', icon: Flame, category: 'lanjutan', proOnly: true, proType: 'purple' },
  { id: 'psychology', label: 'Psychology Tracking', labelId: 'Psikologi', icon: Heart, category: 'lanjutan', proOnly: true, proType: 'purple' },
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
  const { activeGuide, openGuide, closeGuide } = useContextGuides()

  return (
    <nav className="p-3 space-y-2 relative">
      {(['utama', 'pasar', 'alat', 'lanjutan'] as const).map((category) => {
        const categoryItems = menuItems.filter(item => item.category === category)
        const catInfo = menuCategories[category]

        return (
          <div key={category} className="space-y-1">
            {(sidebarOpen || mobileSidebarOpen) && (
              <div
                className="flex items-center gap-2 px-3 py-1.5 overflow-hidden"
              >
                <span className={`text-[10px] font-bold tracking-wider ${
                  category === 'utama'
                    ? 'text-lux-text-muted dark:text-gray-500'
                    : category === 'pasar'
                      ? 'text-blue-600 dark:text-blue-400'
                      : category === 'alat'
                        ? 'text-blue-600 dark:text-blue-400'
                        : 'text-cyan-600 dark:text-cyan-400'
                }`}>
                  {catInfo.label}
                </span>
                {category !== 'utama' && category !== 'pasar' && (
                  <span
                    className={`text-[7px] font-black px-1.5 py-0.5 rounded ${
                      category === 'alat'
                        ? 'bg-gradient-to-r from-blue-500 to-cyan-500 text-white'
                        : 'bg-gradient-to-r from-blue-500 to-purple-500 text-white'
                    }`}
                  >
                    PRO
                  </span>
                )}
                <div className="flex-1 h-px bg-gradient-to-r from-blue-500/30 to-transparent" />
              </div>
            )}

            {categoryItems.map((item: any) => {
              const isLocked = item.proOnly && !isPro
              const proType = item.proType || 'purple'
              const hasGuide = guideData[item.id] !== undefined

              return (
                <div key={item.id}>
                  <div className="relative">
                    <button
                      onClick={() => {
                        if (item.proOnly && !isPro) {
                          setPlanSelectionModalOpen(true)
                        } else {
                          setActiveTab(item.id)
                          setMobileSidebarOpen(false)
                        }
                        // Add haptic feedback on mobile
                        if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
                          navigator.vibrate(5)
                        }
                      }}
                      aria-label={language === 'id' ? item.labelId : item.label}
                      aria-current={activeTab === item.id ? 'page' : undefined}
                      className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all duration-150 relative overflow-hidden group ${
                        activeTab === item.id
                          ? 'bg-gradient-to-r from-blue-500/20 via-blue-400/10 to-cyan-500/10 text-white dark:text-white shadow-lg shadow-blue-500/20'
                          : isLocked
                            ? 'text-lux-text-muted/50 dark:text-gray-500/50 hover:text-lux-text-secondary dark:hover:text-gray-400'
                            : 'text-lux-text-secondary dark:text-gray-400 hover:text-lux-text-primary dark:hover:text-white hover:bg-lux-surface-hover dark:hover:bg-white/5 active:bg-lux-surface-hover dark:active:bg-white/10'
                      }`}
                    >
                      {/* Active State Glow — static, no animation */}
                      {activeTab === item.id && (
                        <div
                          className="absolute inset-0 bg-gradient-to-r from-blue-500/20 via-cyan-500/10 to-blue-500/5"
                        />
                      )}

                      {/* Icon Container — static, no infinite pulse */}
                      <div
                        className={`relative flex-shrink-0 ${
                          activeTab === item.id
                            ? 'text-blue-600 dark:text-blue-400'
                            : isLocked
                              ? 'text-lux-text-muted dark:text-gray-600'
                              : 'text-lux-text-muted dark:text-gray-500 group-hover:text-blue-600 dark:group-hover:text-blue-400'
                        }`}
                      >
                        <item.icon className="w-5 h-5 relative z-10" />
                      </div>

                      {/* Menu Text */}
                      {(sidebarOpen || mobileSidebarOpen) && (
                        <span className={`text-sm font-medium flex-1 text-left truncate relative z-10 overflow-hidden ${
                          activeTab === item.id ? 'text-white dark:text-white' : ''
                        }`}>
                          {language === 'id' ? item.labelId : item.label}
                        </span>
                      )}

                      {/* PRO Badge */}
                      {(sidebarOpen || mobileSidebarOpen) && item.proOnly && (
                        <span
                          className="flex items-center gap-1 relative z-10 flex-shrink-0"
                        >
                          <Lock className={`w-3 h-3 ${
                            proType === 'gold' ? 'text-blue-400' : 'text-cyan-400'
                          }`} />
                          <span className={`text-[7px] font-black px-1 py-0.5 rounded ${
                            proType === 'gold'
                              ? 'bg-gradient-to-r from-blue-500 to-cyan-500 text-white'
                              : 'bg-gradient-to-r from-blue-500 to-purple-500 text-white'
                          }`}>
                            PRO
                          </span>
                        </span>
                      )}
                    </button>

                    {/* Guide Icon "?" for important menu items */}
                    {hasGuide && (sidebarOpen || mobileSidebarOpen) && (
                      <>
                        <button
                          onClick={(e) => { e.stopPropagation(); openGuide(item.id) }}
                          className="absolute top-2 right-2 w-4 h-4 bg-blue-500/20 hover:bg-blue-500/40 rounded-full flex items-center justify-center text-[8px] text-blue-400 hover:text-white transition-colors z-20"
                          aria-label={`${language === 'id' ? 'Panduan' : 'Guide'}: ${language === 'id' ? item.labelId : item.label}`}
                        >
                          ?
                        </button>
                        <ContextGuide
                          isOpen={activeGuide === item.id}
                          onClose={closeGuide}
                          title={guideData[item.id].title[language]}
                          description={guideData[item.id].description[language]}
                          tips={guideData[item.id].tips?.[language]}
                          language={language}
                          position="right"
                        />
                      </>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        )
      })}
    </nav>
  )
}
