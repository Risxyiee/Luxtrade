'use client'

import { motion } from 'framer-motion'
import {
  BarChart3, Activity, Calendar, BookOpen, Eye,
  Newspaper, CalendarDays, Trophy, Target, Grid3X3, PieChart,
  Brain, FileText, Flame, Heart, Lock
} from 'lucide-react'
import { ContextGuide, useContextGuides, guideData } from '@/components/ContextGuide'

const menuCategories = {
  utama: { label: 'UTAMA' },
  alat: { label: 'ALAT', proType: 'gold' },
  lanjutan: { label: 'LANJUTAN', proType: 'purple' },
}

const menuItems = [
  // UTAMA - Tanpa PRO
  { id: 'dashboard', label: 'Dashboard', labelId: 'Dasbor', icon: BarChart3, category: 'utama', proOnly: false },
  { id: 'trades', label: 'Trades', labelId: 'Transaksi', icon: Activity, category: 'utama', proOnly: false },
  { id: 'calendar', label: 'Calendar', labelId: 'Kalender', icon: Calendar, category: 'utama', proOnly: false },
  { id: 'journal', label: 'Journal', labelId: 'Jurnal', icon: BookOpen, category: 'utama', proOnly: false },
  { id: 'watchlist', label: 'Watchlist', labelId: 'Daftar Pantauan', icon: Eye, category: 'utama', proOnly: false },
  { id: 'news', label: 'Market News', labelId: 'Berita Pasar', icon: Newspaper, category: 'utama', proOnly: false },
  { id: 'economic-calendar', label: 'Economic Calendar', labelId: 'Kalender Ekonomi', icon: CalendarDays, category: 'utama', proOnly: false },
  { id: 'achievements', label: 'Achievements', labelId: 'Pencapaian', icon: Trophy, category: 'utama', proOnly: false },

  // ALAT - PRO Emas
  { id: 'risk', label: 'Risk Calculator', labelId: 'Kalkulator Risiko', icon: Target, category: 'alat', proOnly: true, proType: 'gold' },
  { id: 'heatmap', label: 'Market Heatmap', labelId: 'Pasar Heatmap', icon: Grid3X3, category: 'alat', proOnly: true, proType: 'gold' },

  // LANJUTAN - PRO Ungu
  { id: 'analytics', label: 'Analytics', labelId: 'Analitik', icon: PieChart, category: 'lanjutan', proOnly: true, proType: 'purple' },
  { id: 'targets', label: 'Targets', labelId: 'Target', icon: Target, category: 'lanjutan', proOnly: true, proType: 'purple' },
  { id: 'ai', label: 'AI Insights', labelId: 'Insight AI', icon: Brain, category: 'lanjutan', proOnly: true, proType: 'purple' },
  { id: 'score', label: 'Trading Score', labelId: 'Skor Trading', icon: Trophy, category: 'lanjutan', proOnly: true, proType: 'purple' },
  { id: 'report', label: 'Weekly Report', labelId: 'Laporan Mingguan', icon: FileText, category: 'lanjutan', proOnly: true, proType: 'purple' },
  { id: 'streaks', label: 'Streaks', labelId: 'Streak', icon: Flame, category: 'lanjutan', proOnly: true, proType: 'purple' },
  { id: 'psychology', label: 'Psychology Tracking', labelId: 'Psikologi', icon: Heart, category: 'lanjutan', proOnly: true, proType: 'purple' },
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
      {(['utama', 'alat', 'lanjutan'] as const).map((category) => {
        const categoryItems = menuItems.filter(item => item.category === category)
        const catInfo = menuCategories[category]

        return (
          <div key={category} className="space-y-1">
            {(sidebarOpen || mobileSidebarOpen) && (
              <motion.div
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.3 }}
                className="flex items-center gap-2 px-3 py-1.5 overflow-hidden"
              >
                <span className={`text-[10px] font-bold tracking-wider ${
                  category === 'utama'
                    ? 'text-lux-text-muted dark:text-gray-500'
                    : category === 'alat'
                      ? 'text-purple-600 dark:text-purple-400'
                      : 'text-pink-600 dark:text-pink-400'
                }`}>
                  {catInfo.label}
                </span>
                {category !== 'utama' && (
                  <motion.span
                    className={`text-[7px] font-black px-1.5 py-0.5 rounded ${
                      category === 'alat'
                        ? 'bg-gradient-to-r from-amber-500 to-orange-500 text-white'
                        : 'bg-gradient-to-r from-purple-500 to-pink-500 text-white'
                    }`}
                    whileHover={{ scale: 1.1 }}
                  >
                    PRO
                  </motion.span>
                )}
                <div className="flex-1 h-px bg-gradient-to-r from-purple-500/30 to-transparent" />
              </motion.div>
            )}

            {categoryItems.map((item: any, index: number) => {
              const isLocked = item.proOnly && !isPro
              const proType = item.proType || 'purple'
              const hasGuide = guideData[item.id] !== undefined

              return (
                <motion.div
                  key={item.id}
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ duration: 0.2, delay: index * 0.05 }}
                >
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
                      className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all duration-300 relative overflow-hidden group ${
                        activeTab === item.id
                          ? 'bg-gradient-to-r from-purple-500/20 via-violet-500/15 to-pink-500/10 text-white dark:text-white shadow-lg shadow-purple-500/20'
                          : isLocked
                            ? 'text-lux-text-muted/50 dark:text-gray-500/50 hover:text-lux-text-secondary dark:hover:text-gray-400'
                            : 'text-lux-text-secondary dark:text-gray-400 hover:text-lux-text-primary dark:hover:text-white hover:bg-lux-surface-hover dark:hover:bg-white/5 active:bg-lux-surface-hover dark:active:bg-white/10'
                      }`}
                    >
                      {/* Active State Glow */}
                      {activeTab === item.id && (
                        <motion.div
                          className="absolute inset-0 bg-gradient-to-r from-purple-500/20 via-violet-500/10 to-pink-500/5"
                          initial={{ opacity: 0 }}
                          animate={{ opacity: 1 }}
                          transition={{ duration: 0.3 }}
                        />
                      )}

                      {/* Icon Container */}
                      <motion.div
                        className={`relative flex-shrink-0 ${
                          activeTab === item.id
                            ? 'text-purple-600 dark:text-purple-400'
                            : isLocked
                              ? 'text-lux-text-muted dark:text-gray-600'
                              : 'text-lux-text-muted dark:text-gray-500 group-hover:text-purple-600 dark:group-hover:text-purple-400'
                        }`}
                        whileHover={{ scale: 1.1, rotate: 5 }}
                        transition={{ type: "spring", stiffness: 300 }}
                      >
                        {activeTab === item.id && (
                          <motion.div
                            className="absolute inset-0 bg-purple-500/20 blur-xl rounded-lg"
                            animate={{
                              scale: [1, 1.2, 1],
                              opacity: [0.5, 0.8, 0.5]
                            }}
                            transition={{
                              duration: 2,
                              repeat: Infinity,
                              ease: "easeInOut"
                            }}
                          />
                        )}
                        <item.icon className="w-5 h-5 relative z-10" />
                      </motion.div>

                      {/* Menu Text - SHOW WHEN SIDEBAR OPEN (DESKTOP OR MOBILE) */}
                      {(sidebarOpen || mobileSidebarOpen) && (
                        <span className={`text-sm font-medium flex-1 text-left truncate relative z-10 overflow-hidden ${
                          activeTab === item.id ? 'text-white dark:text-white' : ''
                        }`}>
                          {language === 'id' ? item.labelId : item.label}
                        </span>
                      )}

                      {/* PRO Badge - SHOW WHEN SIDEBAR OPEN (DESKTOP OR MOBILE) */}
                      {(sidebarOpen || mobileSidebarOpen) && item.proOnly && (
                        <motion.span
                          className="flex items-center gap-1 relative z-10 flex-shrink-0"
                          whileHover={{ scale: 1.1 }}
                        >
                          <Lock className={`w-3 h-3 ${
                            proType === 'gold' ? 'text-amber-400' : 'text-purple-400'
                          }`} />
                          <span className={`text-[7px] font-black px-1 py-0.5 rounded ${
                            proType === 'gold'
                              ? 'bg-gradient-to-r from-amber-500 to-orange-500 text-white'
                              : 'bg-gradient-to-r from-purple-500 to-pink-500 text-white'
                          }`}>
                            PRO
                          </span>
                        </motion.span>
                      )}
                    </button>

                    {/* Guide Icon "?" for important menu items */}
                    {hasGuide && (sidebarOpen || mobileSidebarOpen) && (
                      <>
                        <button
                          onClick={(e) => { e.stopPropagation(); openGuide(item.id) }}
                          className="absolute top-2 right-2 w-4 h-4 bg-purple-500/20 hover:bg-purple-500/40 rounded-full flex items-center justify-center text-[8px] text-purple-400 hover:text-white transition-colors z-20"
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
                </motion.div>
              )
            })}
          </div>
        )
      })}
    </nav>
  )
}