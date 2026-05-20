'use client'

import Link from 'next/link'
import Image from 'next/image'
import { motion } from 'framer-motion'
import { Menu, X, BarChart3, Activity, Calendar, BookOpen, Eye,
  Newspaper, CalendarDays, Trophy, Target, Grid3X3, PieChart,
  Brain, FileText, Flame, Heart, Settings, Shield, Crown,
  Zap, AlertCircle, Lock, LogOut
} from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { toast } from 'sonner'

interface SidebarProps {
  sidebarOpen: boolean
  setSidebarOpen: (open: boolean) => void
  mobileSidebarOpen: boolean
  setMobileSidebarOpen: (open: boolean) => void
  activeTab: string
  setActiveTab: (tab: string) => void
  isPro: boolean
  user: any
  profile: any
  isAdmin: boolean
  language: 'id' | 'en'
  isFreeUser: boolean
  tradeCount: number
  FREE_TRADE_LIMIT: number
  setPlanSelectionModalOpen: (open: boolean) => void
  userInitials: string
  handleSignOut: () => void
}

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

export default function Sidebar({
  sidebarOpen,
  setSidebarOpen,
  mobileSidebarOpen,
  setMobileSidebarOpen,
  activeTab,
  setActiveTab,
  isPro,
  user,
  profile,
  isAdmin,
  language,
  isFreeUser,
  tradeCount,
  FREE_TRADE_LIMIT,
  setPlanSelectionModalOpen,
  userInitials,
  handleSignOut
}: SidebarProps) {
  return (
    <>
      {/* Mobile Overlay Background - Click to close */}
      {mobileSidebarOpen && (
        <div
          className="fixed inset-0 bg-black/50 backdrop-blur-sm z-40 lg:hidden"
          onClick={() => setMobileSidebarOpen(false)}
        />
      )}

      {/* Sidebar Component */}
      <aside className={`
        fixed lg:static
        top-0 left-0
        h-full
        z-50
        transition-transform duration-300 ease-in-out
        ${mobileSidebarOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}
        ${sidebarOpen ? 'w-72' : 'w-20'}
      `}>
        {/* Glassmorphism Background */}
        <div className="absolute inset-0 bg-gradient-to-b from-[#0d0a1a]/98 via-[#0f0b18]/98 to-[#0d0a1a]/98 backdrop-blur-3xl border-r border-purple-500/20" />

        {/* Animated Glow Border */}
        <div className="absolute inset-y-0 right-0 w-[1px] bg-gradient-to-b from-transparent via-purple-500/30 to-transparent" />

        {/* Top Glow */}
        <div className="absolute top-0 left-0 right-0 h-32 bg-gradient-to-b from-purple-500/5 to-transparent pointer-events-none" />

        <div className="relative p-4 border-b border-purple-500/20">
          <Link href="/" className="flex items-center gap-3 group">
            <motion.div
              className="relative flex-shrink-0"
              whileHover={{ scale: 1.1, rotate: 5 }}
              transition={{ type: "spring", stiffness: 300 }}
            >
              <div className="absolute inset-0 bg-gradient-to-br from-purple-500 to-pink-500 rounded-xl blur-lg opacity-40 group-hover:opacity-60 transition-opacity" />
              <Image
                src="/logo.png"
                alt="LuxTrade Logo"
                width={40}
                height={40}
                className="relative rounded-xl shadow-xl"
              />
            </motion.div>
            {sidebarOpen && (
              <motion.div
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -10 }}
                transition={{ duration: 0.3 }}
                className="overflow-hidden"
              >
                <h1 className="text-xl font-bold bg-gradient-to-r from-purple-300 via-purple-400 to-pink-400 bg-clip-text text-transparent">
                  LuxTrade
                </h1>
                <p className="text-xs text-purple-400/60">Trading Journal</p>
              </motion.div>
            )}
          </Link>
        </div>

        <nav className="flex-1 p-3 space-y-2 overflow-y-auto relative">
          {(['utama', 'alat', 'lanjutan'] as const).map((category) => {
            const categoryItems = menuItems.filter(item => item.category === category)
            const catInfo = menuCategories[category]

            return (
              <div key={category} className="space-y-1">
                {sidebarOpen && (
                  <motion.div
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ duration: 0.3 }}
                    className="flex items-center gap-2 px-3 py-1.5 overflow-hidden"
                  >
                    <span className={`text-[10px] font-bold tracking-wider ${
                      category === 'utama'
                        ? 'text-gray-500'
                        : category === 'alat'
                          ? 'text-purple-400'
                          : 'text-pink-400'
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

                  return (
                    <motion.div
                      key={item.id}
                      initial={{ opacity: 0, x: -10 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ duration: 0.2, delay: index * 0.05 }}
                    >
                      <button
                        onClick={() => {
                          if (item.proOnly && !isPro) {
                            setPlanSelectionModalOpen(true)
                          } else {
                            setActiveTab(item.id)
                            setMobileSidebarOpen(false)
                          }
                        }}
                        className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all duration-300 relative overflow-hidden group ${
                          activeTab === item.id
                            ? 'bg-gradient-to-r from-purple-500/20 via-violet-500/15 to-pink-500/10 text-white shadow-lg shadow-purple-500/20'
                            : isLocked
                              ? 'text-gray-500/50 hover:text-gray-400'
                              : 'text-gray-400 hover:text-white hover:bg-white/5'
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
                              ? 'text-purple-400'
                              : isLocked
                                ? 'text-gray-600'
                                : 'text-gray-500 group-hover:text-purple-400'
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

                        {/* Menu Text - ONLY SHOW WHEN SIDEBAR OPEN */}
                        {sidebarOpen && (
                          <span className={`text-sm font-medium flex-1 text-left truncate relative z-10 overflow-hidden ${
                            activeTab === item.id ? 'text-white' : ''
                          }`}>
                            {language === 'id' ? item.labelId : item.label}
                          </span>
                        )}

                        {/* PRO Badge - ONLY SHOW WHEN SIDEBAR OPEN */}
                        {sidebarOpen && item.proOnly && (
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
                    </motion.div>
                  )
                })}
              </div>
            )
          })}
        </nav>

        {/* Bottom Section */}
        <div className="relative p-3 border-t border-purple-500/20 space-y-2">
          {!isPro && sidebarOpen && (
            <motion.button
              onClick={() => setPlanSelectionModalOpen(true)}
              className="w-full py-2.5 px-3 rounded-xl bg-gradient-to-r from-purple-600 via-violet-600 to-pink-600 text-sm font-bold text-white shadow-lg shadow-purple-500/30 relative overflow-hidden group"
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
            >
              <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent -translate-x-full group-hover:animate-[shimmer_1.5s_infinite]" />
              <span className="relative z-10 flex items-center justify-center gap-2">
                <Zap className="w-4 h-4" />
                Upgrade to Pro
              </span>
            </motion.button>
          )}

          {isPro && sidebarOpen && (
            <motion.div
              className="flex items-center gap-2 px-3 py-2.5 rounded-xl bg-gradient-to-r from-purple-500/20 via-violet-500/10 to-pink-500/20 border border-purple-500/30 shadow-lg shadow-purple-500/20"
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ duration: 0.3 }}
            >
              <motion.div
                animate={{ rotate: [0, 360] }}
                transition={{ duration: 3, repeat: Infinity, ease: "linear" }}
              >
                <Zap className="w-4 h-4 text-purple-400" />
              </motion.div>
              <span className="text-sm font-bold bg-gradient-to-r from-purple-400 to-pink-400 bg-clip-text text-transparent overflow-hidden whitespace-nowrap">
                ELITE PRO
              </span>
            </motion.div>
          )}

          <Link href="/settings" className="block relative">
            <motion.button
              className="w-full py-2.5 px-3 rounded-xl bg-gradient-to-r from-white/5 to-white/10 text-gray-300 border border-white/10 hover:from-white/10 hover:to-white/15 hover:border-white/20 transition-all flex items-center justify-center gap-2 text-sm font-semibold relative overflow-hidden group"
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
            >
              <motion.div
                className="absolute inset-0 bg-gradient-to-r from-purple-500/10 to-pink-500/10 opacity-0 group-hover:opacity-100 transition-opacity"
              />
              <Settings className="w-4 h-4 relative z-10 group-hover:text-purple-400 transition-colors flex-shrink-0" />
              {sidebarOpen && <span className="relative z-10 overflow-hidden whitespace-nowrap">Settings</span>}
            </motion.button>
          </Link>

          {sidebarOpen && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3, delay: 0.1 }}
              className="relative bg-gradient-to-br from-white/5 to-white/[0.02] rounded-xl p-3 border border-white/10 overflow-hidden"
            >
              <div className="absolute top-0 left-0 w-full h-full bg-gradient-to-br from-purple-500/5 to-pink-500/5 opacity-0 hover:opacity-100 transition-opacity" />
              <div className="relative flex items-center gap-3">
                <motion.div
                  className="w-9 h-9 rounded-full bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center text-xs font-bold flex-shrink-0 shadow-lg shadow-purple-500/30"
                  whileHover={{ scale: 1.1, rotate: 5 }}
                  transition={{ type: "spring", stiffness: 300 }}
                >
                  {userInitials}
                </motion.div>
                <div className="min-w-0 flex-1 overflow-hidden">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-semibold truncate text-white">
                      {profile?.full_name || user?.email || 'User'}
                    </span>
                    {isPro ? (
                      <Badge className="bg-gradient-to-r from-purple-500/40 to-pink-500/40 text-white border-purple-500/30 text-[10px] px-1.5 py-0 flex-shrink-0">
                        PRO
                      </Badge>
                    ) : (
                      <Badge className="bg-white/10 text-gray-400 border-white/10 text-[10px] px-1.5 py-0 flex-shrink-0">
                        Free
                      </Badge>
                    )}
                  </div>
                  <Link href="/settings" className="text-xs text-gray-500 hover:text-purple-400 transition-colors">
                    Settings
                  </Link>
                </div>
              </div>
            </motion.div>
          )}

          {isAdmin && sidebarOpen && (
            <Link href="/admin-secure" className="block">
              <motion.button
                className="w-full py-2 px-3 rounded-xl bg-gradient-to-r from-purple-600/20 to-violet-600/20 text-purple-300 border border-purple-500/30 hover:from-purple-600/30 hover:to-violet-600/30 transition-all flex items-center justify-center gap-2 text-sm font-bold shadow-lg shadow-purple-500/10"
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
              >
                <Shield className="w-4 h-4" />
                <span className="flex items-center gap-1">
                  Admin Panel
                  <Crown className="w-3 h-3 text-purple-400" />
                </span>
              </motion.button>
            </Link>
          )}

          {isFreeUser && sidebarOpen && (
            <motion.div
              className="flex items-center gap-2 px-3 py-2 rounded-xl bg-gradient-to-r from-amber-500/10 to-orange-500/10 border border-amber-500/20"
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.3 }}
            >
              <AlertCircle className="w-4 h-4 text-amber-400 flex-shrink-0" />
              <span className="text-xs text-amber-300 overflow-hidden whitespace-nowrap">
                {tradeCount}/{FREE_TRADE_LIMIT} trades used
              </span>
            </motion.div>
          )}

          <motion.button
            onClick={() => {
              if (typeof window !== 'undefined' && window.innerWidth < 1024) {
                setMobileSidebarOpen(false)
              }
              setSidebarOpen(!sidebarOpen)
            }}
            className="relative w-full flex items-center justify-center p-2.5 text-gray-400 hover:text-white transition-colors rounded-xl hover:bg-white/5 group"
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
          >
            <motion.div
              animate={{ rotate: sidebarOpen ? 180 : 0 }}
              transition={{ duration: 0.3, ease: "easeInOut" }}
            >
              {sidebarOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </motion.div>
          </motion.button>
        </div>
      </aside>
    </>
  )
}
