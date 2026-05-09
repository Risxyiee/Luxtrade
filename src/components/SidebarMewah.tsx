'use client'

import { useState } from 'react'
import Link from 'next/link'
import { motion } from 'framer-motion'
import { 
  TrendingUp, Activity, Calendar, BookOpen, Target, Grid3X3, 
  PieChart, Brain, Heart, Lock, Play, Zap, X, Menu
} from 'lucide-react'
import { toast } from 'sonner'

// ==================== MENU CONFIG ====================

interface MenuItem {
  id: string
  labelId: string // Indonesian label (UTAMA)
  icon: React.ComponentType<{ className?: string }>
  proOnly: boolean
  category: 'main' | 'tools' | 'advanced'
}

const menuItems: MenuItem[] = [
  // Main - Free Features
  { id: 'dashboard', labelId: 'Dasbor', icon: TrendingUp, proOnly: false, category: 'main' },
  { id: 'trades', labelId: 'Transaksi', icon: Activity, proOnly: false, category: 'main' },
  { id: 'calendar', labelId: 'Kalender', icon: Calendar, proOnly: false, category: 'main' },
  { id: 'journal', labelId: 'Jurnal', icon: BookOpen, proOnly: false, category: 'main' },
  // Tools - PRO Features
  { id: 'risk', labelId: 'Kalkulator Risiko', icon: Target, proOnly: true, category: 'tools' },
  { id: 'heatmap', labelId: 'Pasar Heatmap', icon: Grid3X3, proOnly: true, category: 'tools' },
  // Advanced - PRO Features
  { id: 'analytics', labelId: 'Analitik', icon: PieChart, proOnly: true, category: 'advanced' },
  { id: 'goals', labelId: 'Target', icon: Target, proOnly: true, category: 'advanced' },
  { id: 'ai', labelId: 'Insight AI', icon: Brain, proOnly: true, category: 'advanced' },
  { id: 'psychology', labelId: 'Psikologi', icon: Heart, proOnly: true, category: 'advanced' },
]

// ==================== SIDEBAR COMPONENT ====================

interface SidebarMewahProps {
  activeTab: string
  setActiveTab: (tab: string) => void
  isPro: boolean
  demoMode: boolean
  language: 'en' | 'id'
  setLanguage: (lang: 'en' | 'id') => void
  setDemoMode: (mode: boolean) => void
  setPaymentModalOpen: (open: boolean) => void
  sidebarOpen: boolean
  setSidebarOpen: (open: boolean) => void
  mobileSidebarOpen: boolean
  setMobileSidebarOpen: (open: boolean) => void
}

export default function SidebarMewah({
  activeTab,
  setActiveTab,
  isPro,
  demoMode,
  language,
  setLanguage,
  setDemoMode,
  setPaymentModalOpen,
  sidebarOpen,
  setSidebarOpen,
  mobileSidebarOpen,
  setMobileSidebarOpen,
}: SidebarMewahProps) {
  
  const handleMenuClick = (item: MenuItem) => {
    if (item.proOnly && !isPro) {
      setPaymentModalOpen(true)
    } else {
      setActiveTab(item.id)
      setMobileSidebarOpen(false)
    }
  }

  return (
    <aside className={`bg-[#0a0712]/98 backdrop-blur-xl border-r border-white/5 flex flex-col fixed h-full z-40 transition-all duration-300 
      ${sidebarOpen ? 'w-64' : 'w-20'} 
      ${mobileSidebarOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}`}
    >
      {/* Logo Header */}
      <div className="p-4 border-b border-white/5">
        <Link href="/" className="flex items-center gap-3">
          <motion.div 
            className="w-10 h-10 rounded-full bg-gradient-to-br from-amber-400 via-amber-500 to-orange-500 flex items-center justify-center shadow-lg shadow-amber-500/30"
            whileHover={{ scale: 1.05, rotate: 5 }}
            whileTap={{ scale: 0.95 }}
          >
            <TrendingUp className="w-5 h-5 text-white" />
          </motion.div>
          {sidebarOpen && (
            <div>
              <h1 className="text-lg font-bold text-amber-400">LuxTrade</h1>
              <p className="text-[10px] text-gray-500">Trading Journal</p>
            </div>
          )}
        </Link>
      </div>

      <nav className="flex-1 p-2 overflow-y-auto">
        {/* ==================== UTAMA Section ==================== */}
        <div className="mb-3">
          {sidebarOpen && (
            <div className="px-3 py-2">
              <span className="text-[10px] font-bold text-white uppercase tracking-widest">UTAMA</span>
            </div>
          )}
          {menuItems.filter(item => item.category === 'main').map((item) => (
            <motion.button
              key={item.id}
              onClick={() => {
                setActiveTab(item.id)
                setMobileSidebarOpen(false)
              }}
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all duration-200 relative ${
                activeTab === item.id
                  ? 'bg-amber-500/20 text-amber-400 border-l-2 border-amber-500'
                  : 'text-gray-400 hover:bg-white/5 hover:text-white'
              }`}
              whileHover={{ x: 2 }}
              whileTap={{ scale: 0.98 }}
            >
              <item.icon className="w-5 h-5 flex-shrink-0" />
              {sidebarOpen && (
                <span className="text-sm font-medium text-left">
                  {item.labelId}
                </span>
              )}
            </motion.button>
          ))}
        </div>

        {/* ==================== ALAT Section (ORANGE PRO) ==================== */}
        <div className="mb-3">
          {sidebarOpen && (
            <div className="px-3 py-2 flex items-center gap-2">
              <span className="text-[10px] font-bold text-white uppercase tracking-widest">ALAT</span>
              <span className="text-[8px] font-black bg-gradient-to-r from-amber-500 to-orange-500 text-white px-2 py-0.5 rounded-full shadow-lg shadow-amber-500/30">PRO</span>
            </div>
          )}
          {menuItems.filter(item => item.category === 'tools').map((item) => (
            <motion.button
              key={item.id}
              onClick={() => handleMenuClick(item)}
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all duration-200 relative ${
                activeTab === item.id
                  ? 'bg-amber-500/20 text-amber-400 border-l-2 border-amber-500'
                  : 'text-gray-400 hover:bg-white/5 hover:text-white'
              }`}
              whileHover={{ x: 2 }}
              whileTap={{ scale: 0.98 }}
            >
              <item.icon className="w-5 h-5 flex-shrink-0" />
              {sidebarOpen && (
                <>
                  <span className="text-sm font-medium flex-1 text-left">
                    {item.labelId}
                  </span>
                  {/* SELALU tampilkan PRO badge untuk item PRO */}
                  {item.proOnly && (
                    <span className="flex items-center gap-1">
                      <Lock className="w-3.5 h-3.5 text-amber-400" />
                      <span className="text-[7px] font-black bg-gradient-to-r from-amber-500 to-orange-500 text-white px-1.5 py-0.5 rounded shadow-lg shadow-amber-500/30">PRO</span>
                    </span>
                  )}
                </>
              )}
            </motion.button>
          ))}
        </div>

        {/* ==================== LANJUTAN Section (PURPLE PRO) ==================== */}
        <div className="mb-3">
          {sidebarOpen && (
            <div className="px-3 py-2 flex items-center gap-2">
              <span className="text-[10px] font-bold text-white uppercase tracking-widest">LANJUTAN</span>
              <span className="text-[8px] font-black bg-gradient-to-r from-purple-500 to-violet-500 text-white px-2 py-0.5 rounded-full shadow-lg shadow-purple-500/30">PRO</span>
            </div>
          )}
          {menuItems.filter(item => item.category === 'advanced').map((item) => (
            <motion.button
              key={item.id}
              onClick={() => handleMenuClick(item)}
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all duration-200 relative ${
                activeTab === item.id
                  ? 'bg-purple-500/20 text-purple-400 border-l-2 border-purple-500'
                  : 'text-gray-400 hover:bg-white/5 hover:text-white'
              }`}
              whileHover={{ x: 2 }}
              whileTap={{ scale: 0.98 }}
            >
              <item.icon className="w-5 h-5 flex-shrink-0" />
              {sidebarOpen && (
                <>
                  <span className="text-sm font-medium flex-1 text-left">
                    {item.labelId}
                  </span>
                  {/* SELALU tampilkan PRO badge untuk item PRO */}
                  {item.proOnly && (
                    <span className="flex items-center gap-1">
                      <Lock className="w-3.5 h-3.5 text-purple-400" />
                      <span className="text-[7px] font-black bg-gradient-to-r from-purple-500 to-violet-500 text-white px-1.5 py-0.5 rounded shadow-lg shadow-purple-500/30">PRO</span>
                    </span>
                  )}
                </>
              )}
            </motion.button>
          ))}
        </div>
      </nav>

      {/* Footer Section */}
      <div className="p-3 border-t border-white/5 space-y-2">
        {/* Language Switcher - ID/EN dengan Flag */}
        {sidebarOpen && (
          <div className="flex items-center gap-1 bg-white/5 rounded-lg p-1">
            <button
              onClick={() => setLanguage('id')}
              className={`flex-1 py-2 px-3 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-1.5 ${
                language === 'id'
                  ? 'bg-amber-600/40 text-amber-300 border border-amber-500/30'
                  : 'text-gray-500 hover:text-white hover:bg-white/5'
              }`}
            >
              <span>🇮🇩</span>
              <span>ID</span>
            </button>
            <button
              onClick={() => setLanguage('en')}
              className={`flex-1 py-2 px-3 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-1.5 ${
                language === 'en'
                  ? 'bg-amber-600/40 text-amber-300 border border-amber-500/30'
                  : 'text-gray-500 hover:text-white hover:bg-white/5'
              }`}
            >
              <span>🇺🇸</span>
              <span>EN</span>
            </button>
          </div>
        )}

        {/* Demo Mode Button */}
        {sidebarOpen && (
          <motion.button
            onClick={() => {
              setDemoMode(!demoMode)
              if (!demoMode) {
                toast.success(language === 'id' ? 'Mode Demo diaktifkan!' : 'Demo mode enabled!')
              }
            }}
            className={`w-full py-2.5 px-3 rounded-xl text-sm font-bold transition-all flex items-center justify-center gap-2 ${
              demoMode
                ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                : 'bg-purple-600/30 text-purple-300 border border-purple-500/30 hover:bg-purple-600/40'
            }`}
            whileHover={{ scale: 1.01 }}
            whileTap={{ scale: 0.99 }}
          >
            <Play className="w-4 h-4" />
            {demoMode
              ? (language === 'id' ? 'Demo Aktif' : 'Demo ON')
              : (language === 'id' ? 'Coba Demo' : 'Try Demo')
            }
          </motion.button>
        )}

        {/* Upgrade ke PRO Button */}
        {!isPro && sidebarOpen && !demoMode && (
          <motion.button
            onClick={() => setPaymentModalOpen(true)}
            className="w-full py-2.5 px-3 rounded-xl bg-gradient-to-r from-amber-500 to-orange-600 text-sm font-bold text-white shadow-lg shadow-amber-500/30 flex items-center justify-center gap-2"
            whileHover={{ scale: 1.01 }}
            whileTap={{ scale: 0.99 }}
          >
            <Zap className="w-4 h-4" />
            {language === 'id' ? 'Upgrade ke PRO' : 'Upgrade to PRO'}
          </motion.button>
        )}

        {/* PRO Badge jika sudah PRO atau Demo */}
        {(isPro || demoMode) && sidebarOpen && (
          <div className="flex items-center justify-center gap-2 px-3 py-2.5 rounded-xl bg-gradient-to-r from-amber-500/20 to-orange-500/20 border border-amber-500/30">
            <Zap className="w-4 h-4 text-amber-400" />
            <span className="text-sm font-bold text-amber-400">{demoMode ? 'DEMO' : 'ELITE PRO'}</span>
          </div>
        )}

        {/* Collapse Button */}
        <button
          onClick={() => {
            if (typeof window !== 'undefined' && window.innerWidth < 1024) {
              setMobileSidebarOpen(false)
            }
            setSidebarOpen(!sidebarOpen)
          }}
          className="w-full flex items-center justify-center py-2 text-gray-500 hover:text-amber-400 transition-colors"
        >
          {sidebarOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
        </button>
      </div>
    </aside>
  )
}
