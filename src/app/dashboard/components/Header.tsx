'use client'

import { motion } from 'framer-motion'
import { Menu, RefreshCw, LogOut } from 'lucide-react'
import LanguageSwitcher from '@/components/LanguageSwitcher'
import NotificationCenter from '@/components/NotificationCenter'

interface HeaderProps {
  sidebarOpen: boolean
  setMobileSidebarOpen: (open: boolean) => void
  activeTab: string
  menuItems: any[]
  loading: boolean
  fetchData: () => void
  trades: any[]
  isPro: boolean
  user: any
  handleSignOut: () => void
  userInitials: string
  language: 'id' | 'en'
}

export default function Header({
  sidebarOpen,
  setMobileSidebarOpen,
  activeTab,
  menuItems,
  loading,
  fetchData,
  trades,
  isPro,
  user,
  handleSignOut,
  userInitials,
  language = 'id'
}: HeaderProps) {
  return (
    <header className="h-16 border-b border-purple-900/30 flex items-center justify-between px-4 lg:px-6 bg-[#0f0b18]/90 backdrop-blur-md sticky top-0 z-30">
      <div className="flex items-center gap-3">
        <button
          onClick={() => setMobileSidebarOpen(true)}
          className="lg:hidden p-2 text-gray-400 hover:text-white transition-colors"
        >
          <Menu className="w-5 h-5" />
        </button>
        <h2 className="text-lg font-semibold">
          {menuItems.find(m => m.id === activeTab)?.label || 'Dashboard'}
        </h2>
        <button
          onClick={fetchData}
          className="p-2 text-gray-400 hover:text-purple-400 transition-colors"
          title="Refresh data"
        >
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
        </button>
      </div>

      <div className="flex items-center gap-2 lg:gap-3">
        <LanguageSwitcher />
        <NotificationCenter trades={trades} isPro={isPro} />

        <div className="hidden sm:flex items-center gap-2 px-3 py-1.5 rounded-full bg-emerald-500/10 border border-emerald-500/20">
          <motion.div
            className="w-2 h-2 rounded-full bg-emerald-400"
            animate={{ scale: [1, 1.2, 1], opacity: [1, 0.7, 1] }}
            transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
          />
          <span className="text-xs text-emerald-400">Connected</span>
        </div>

        {user && (
          <button
            onClick={handleSignOut}
            className="p-2 text-gray-400 hover:text-white transition-colors"
            title="Sign out"
          >
            <LogOut className="w-5 h-5" />
          </button>
        )}

        <div className="w-9 h-9 rounded-full bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center text-sm font-bold" title={user?.email || 'User'}>
          {userInitials}
        </div>
      </div>
    </header>
  )
}