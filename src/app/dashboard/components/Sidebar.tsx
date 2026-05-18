'use client'

import Link from 'next/link'
import Image from 'next/image'
import { motion } from 'framer-motion'
import { 
  Menu, X, BarChart3, Activity, Calendar, BookOpen, Eye, 
  Newspaper, CalendarDays, Trophy, Target, Grid3X3, PieChart, 
  Brain, FileText, Flame, Heart, Settings, Shield, Crown, 
  Zap, AlertCircle, Lock, LogOut, Link2 
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
  { id: 'auto-journal', label: 'Auto-Journal', labelId: 'Auto-Jurnal', icon: Link2, category: 'utama', proOnly: false, isExternalLink: true, href: '/dashboard/connections' },
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
    <aside className={`bg-[#0f0b18]/95 backdrop-blur-xl border-r border-purple-900/30 flex flex-col fixed h-full z-40 transition-all duration-300 
      ${sidebarOpen ? 'w-64' : 'w-20'} 
      ${mobileSidebarOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}`}>
      <div className="p-4 border-b border-purple-900/30">
        <Link href="/" className="flex items-center gap-3">
          <Image 
            src="/logo.png" 
            alt="LuxTrade Logo" 
            width={40} 
            height={40}
            className="rounded-xl shadow-lg shadow-purple-500/20"
          />
          {sidebarOpen && (
            <div>
              <h1 className="text-xl font-bold bg-gradient-to-r from-purple-200 via-purple-300 to-purple-400 bg-clip-text text-transparent">LuxTrade</h1>
              <p className="text-xs text-purple-300/60">Trading Journal</p>
            </div>
          )}
        </Link>
      </div>

      <nav className="flex-1 p-3 space-y-2 overflow-y-auto">
        {(['utama', 'alat', 'lanjutan'] as const).map((category) => {
          const categoryItems = menuItems.filter(item => item.category === category)
          const catInfo = menuCategories[category]

          return (
            <div key={category} className="space-y-1">
              {sidebarOpen && (
                <div className="flex items-center gap-2 px-3 py-1.5">
                  <span className={`text-[10px] font-bold tracking-wider ${
                    category === 'utama' 
                      ? 'text-gray-500' 
                      : category === 'alat'
                        ? 'text-purple-500'
                        : 'text-purple-400'
                  }`}>
                    {catInfo.label}
                  </span>
                  {category !== 'utama' && (
                    <span className={`text-[7px] font-black px-1.5 py-0.5 rounded ${
                      category === 'alat'
                        ? 'bg-gradient-to-r from-purple-500 to-violet-500 text-white'
                        : 'bg-gradient-to-r from-purple-500 to-violet-500 text-white'
                    }`}>
                      PRO
                    </span>
                  )}
                  <div className="flex-1 h-px bg-purple-900/30" />
                </div>
              )}

              {categoryItems.map((item: any) => {
                const isLocked = item.proOnly && !isPro
                const proType = item.proType || 'purple'
                const isExternalLink = item.isExternalLink && item.href

                return (
                  <Link key={item.id} href={isExternalLink ? item.href : '#'} className="block">
                    <motion.button
                      onClick={(e) => {
                        if (item.proOnly && !isPro) {
                          e.preventDefault()
                          setPlanSelectionModalOpen(true)
                        } else if (!isExternalLink) {
                          e.preventDefault()
                          setActiveTab(item.id)
                          setMobileSidebarOpen(false)
                        } else {
                          setMobileSidebarOpen(false)
                        }
                      }}
                      className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all duration-200 relative ${
                        activeTab === item.id
                          ? 'bg-gradient-to-r from-purple-500/20 to-violet-500/10 text-purple-400 border border-purple-500/30'
                          : 'text-gray-400 hover:bg-purple-500/10 hover:text-white'
                      } ${isLocked ? 'opacity-60' : ''}`}
                      whileHover={isLocked ? {} : { x: 4 }}
                      whileTap={isLocked ? {} : { scale: 0.98 }}
                    >
                      <item.icon className="w-5 h-5 flex-shrink-0" />
                      {sidebarOpen && (
                        <span className="text-sm font-medium flex-1 text-left truncate">
                          {language === 'id' ? item.labelId : item.label}
                        </span>
                      )}
                      {sidebarOpen && item.proOnly && (
                        <span className="flex items-center gap-1">
                          <Lock className={`w-3 h-3 ${proType === 'gold' ? 'text-purple-400' : 'text-purple-400'}`} />
                          <span className={`text-[7px] font-black px-1 py-0.5 rounded ${
                            proType === 'gold'
                              ? 'bg-gradient-to-r from-purple-500 to-violet-500 text-white'
                              : 'bg-gradient-to-r from-purple-500 to-violet-500 text-white'
                          }`}>
                            PRO
                          </span>
                        </span>
                      )}
                    </motion.button>
                  </Link>
                )
              })}
            </div>
          )
        })}
      </nav>

      <div className="p-3 border-t border-purple-900/30 space-y-2">
        {!isPro && sidebarOpen && (
          <motion.button
            onClick={() => setPlanSelectionModalOpen(true)}
            className="w-full py-2 px-3 rounded-lg bg-gradient-to-r from-purple-500 to-violet-600 text-sm font-bold text-white hover:scale-[1.02] transition-all shadow-lg shadow-purple-500/20"
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
          >
            Upgrade to Pro
          </motion.button>
        )}
        {isPro && sidebarOpen && (
          <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-purple-500/20 border border-purple-500/30">
            <Zap className="w-4 h-4 text-purple-400" />
            <span className="text-sm font-bold text-purple-400">ELITE PRO</span>
          </div>
        )}
        
        <Link href="/settings" className="block">
          <motion.button
            className="w-full py-2 px-3 rounded-lg bg-gradient-to-r from-gray-600/30 to-gray-700/30 text-gray-300 border border-gray-500/30 hover:from-gray-600/40 hover:to-gray-700/40 transition-all flex items-center justify-center gap-2 text-sm font-bold"
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
          >
            <Settings className="w-4 h-4" />
            {sidebarOpen && <span>Settings</span>}
          </motion.button>
        </Link>

        {sidebarOpen && (
          <div className="bg-white/[0.02] rounded-xl p-3 border border-white/5">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-full bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center text-xs font-bold flex-shrink-0">
                {userInitials}
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-semibold truncate">{profile?.full_name || user?.email || 'User'}</span>
                  {isPro ? (
                    <Badge className="bg-gradient-to-r from-purple-500/30 to-violet-500/30 text-purple-300 border-purple-500/30 text-[10px] px-1.5 py-0">PRO</Badge>
                  ) : (
                    <Badge className="bg-gray-500/20 text-gray-400 border-gray-500/30 text-[10px] px-1.5 py-0">Free Plan</Badge>
                  )}
                </div>
                <Link href="/settings" className="text-xs text-gray-500 hover:text-purple-400 transition-colors">Settings</Link>
              </div>
            </div>
          </div>
        )}

        {isAdmin && sidebarOpen && (
          <Link href="/admin-secure" className="block">
            <motion.button
              className="w-full py-2 px-3 rounded-lg bg-gradient-to-r from-purple-600/30 to-violet-600/30 text-violet-300 border border-violet-500/30 hover:from-purple-600/40 hover:to-violet-600/40 transition-all flex items-center justify-center gap-2 text-sm font-bold"
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
          <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-purple-500/10 border border-purple-500/20">
            <AlertCircle className="w-4 h-4 text-purple-400" />
            <span className="text-xs text-purple-300">
              {tradeCount}/{FREE_TRADE_LIMIT} trades used
            </span>
          </div>
        )}
        
        <button
          onClick={() => {
            if (typeof window !== 'undefined' && window.innerWidth < 1024) {
              setMobileSidebarOpen(false)
            }
            setSidebarOpen(!sidebarOpen)
          }}
          className="w-full flex items-center justify-center p-2 text-gray-400 hover:text-purple-400 transition-colors"
        >
          {sidebarOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
        </button>
      </div>
    </aside>
  )
}
