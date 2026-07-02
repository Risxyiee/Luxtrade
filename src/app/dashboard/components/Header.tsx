'use client'

import { useState } from 'react'
import { motion } from 'framer-motion'
import { Menu, RefreshCw, LogOut, Keyboard } from 'lucide-react'
import LanguageSwitcher from '@/components/LanguageSwitcher'
import NotificationCenter from '@/components/NotificationCenter'
import { ThemeToggle } from './ThemeToggle'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { getShortcutsList } from '@/lib/keyboard-shortcuts'

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
  const [shortcutsOpen, setShortcutsOpen] = useState(false)
  const shortcuts = getShortcutsList()

  return (
    <header className="h-16 border-b border-purple-900/30 flex items-center justify-between px-4 lg:px-6 bg-[#0f0b18]/90 backdrop-blur-md sticky top-0 z-30">
      <div className="flex items-center gap-3">
        <button
          onClick={() => setMobileSidebarOpen(true)}
          className="lg:hidden p-2 text-gray-400 hover:text-white transition-colors"
          aria-label={language === 'id' ? 'Buka menu' : 'Open menu'}
        >
          <Menu className="w-5 h-5" />
        </button>
        <h2 className="text-lg font-semibold">
          {menuItems.find(m => m.id === activeTab)?.label || 'Dashboard'}
        </h2>
        <button
          onClick={fetchData}
          className="p-2 text-gray-400 hover:text-purple-400 transition-colors"
          aria-label={language === 'id' ? 'Muat ulang data' : 'Refresh data'}
        >
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
        </button>
      </div>

      <div className="flex items-center gap-2 lg:gap-3">
        <LanguageSwitcher />
        <ThemeToggle />

        <Dialog open={shortcutsOpen} onOpenChange={setShortcutsOpen}>
          <DialogTrigger asChild>
            <button
              className="p-2 text-gray-400 hover:text-white hover:bg-white/5 transition-colors rounded-md"
              aria-label={language === 'id' ? 'Pintasan keyboard' : 'Keyboard shortcuts'}
            >
              <Keyboard className="w-5 h-5" />
            </button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-md bg-[#0f0b18] border-purple-900/30 text-white">
            <DialogHeader>
              <DialogTitle className="text-white">Keyboard Shortcuts</DialogTitle>
            </DialogHeader>
            <div className="space-y-2 pt-2">
              {shortcuts.map((s, i) => (
                <div key={i} className="flex items-center justify-between py-2 px-3 rounded-lg bg-white/5">
                  <span className="text-sm text-gray-300">{s.action}</span>
                  <kbd className="px-2 py-1 text-xs font-mono bg-purple-500/20 text-purple-300 rounded border border-purple-500/30">
                    {s.combo}
                  </kbd>
                </div>
              ))}
            </div>
          </DialogContent>
        </Dialog>

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
            aria-label={language === 'id' ? 'Keluar' : 'Sign out'}
          >
            <LogOut className="w-5 h-5" />
          </button>
        )}

        <div className="w-9 h-9 rounded-full bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center text-sm font-bold" role="img" aria-label={`Profil pengguna: ${user?.email || 'User'}`}>
          {userInitials}
        </div>
      </div>
    </header>
  )
}