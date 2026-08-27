'use client'

import { motion } from 'framer-motion'
import { Settings, LogOut, Menu, X, ChevronLeft, ChevronRight } from 'lucide-react'
import Link from 'next/link'

interface SidebarFooterProps {
  sidebarOpen: boolean
  mobileSidebarOpen: boolean
  language: 'id' | 'en'
  user: any
  isAdmin: boolean
  setSidebarOpen: (open: boolean) => void
  setMobileSidebarOpen: (open: boolean) => void
}

export default function SidebarFooter({
  sidebarOpen,
  mobileSidebarOpen,
  language,
  user,
  isAdmin,
  setSidebarOpen,
  setMobileSidebarOpen
}: SidebarFooterProps) {
  return (
    <div className="relative p-3 border-t border-lux-border dark:border-blue-500/20 space-y-1.5 pb-safe mt-auto">
      {/* Settings Link */}
      <Link href="/settings" className="block">
        <button
          className={`w-full flex items-center gap-3 px-3 py-2 rounded-xl transition-all duration-150 group
            text-lux-text-secondary dark:text-gray-400 hover:text-lux-text-primary dark:hover:text-white hover:bg-lux-surface-hover dark:hover:bg-white/5
            ${(sidebarOpen || mobileSidebarOpen) ? '' : 'justify-center'}`}
        >
          <Settings className="w-5 h-5 flex-shrink-0 group-hover:text-blue-400 transition-colors" />
          {(sidebarOpen || mobileSidebarOpen) && (
            <span className="text-sm font-medium flex-1 text-left truncate">
              {language === 'id' ? 'Pengaturan' : 'Settings'}
            </span>
          )}
        </button>
      </Link>

      {/* Admin Panel — only for admins */}
      {isAdmin && (sidebarOpen || mobileSidebarOpen) && (
        <Link href="/dashboard/admin" className="block">
          <button
            className="w-full flex items-center gap-3 px-3 py-2 rounded-xl transition-all duration-150 group
              text-blue-400/70 hover:text-blue-400 hover:bg-blue-500/10"
          >
            <svg className="w-5 h-5 flex-shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
            </svg>
            <span className="text-sm font-medium flex-1 text-left truncate">
              {language === 'id' ? 'Panel Admin' : 'Admin Panel'}
            </span>
          </button>
        </Link>
      )}

      {/* Version Tag */}
      {(sidebarOpen || mobileSidebarOpen) && (
        <div className="px-3 py-1.5">
          <span className="text-[10px] font-mono text-lux-text-muted/40 dark:text-gray-600 tracking-wider">
            LUXTRADE v2.1.0
          </span>
        </div>
      )}

      {/* Collapse/Expand Toggle */}
      <button
        onClick={() => {
          if (typeof window !== 'undefined' && window.innerWidth < 1024) {
            setMobileSidebarOpen(false)
          } else {
            setSidebarOpen(!sidebarOpen)
          }
          if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
            navigator.vibrate(10)
          }
        }}
        aria-label={sidebarOpen
          ? (language === 'id' ? 'Tutup sidebar' : 'Collapse sidebar')
          : (language === 'id' ? 'Buka sidebar' : 'Expand sidebar')
        }
        className="relative w-full flex items-center justify-center py-2 text-lux-text-muted dark:text-gray-500 hover:text-lux-text-primary dark:hover:text-white transition-colors rounded-xl hover:bg-lux-surface-hover dark:hover:bg-white/5 active:bg-lux-surface-hover dark:active:bg-white/10 group"
      >
        <motion.div
          animate={{ rotate: sidebarOpen ? 180 : 0 }}
          transition={{ duration: 0.3, ease: "easeInOut" }}
        >
          <ChevronLeft className={`w-4 h-4 transition-transform ${!sidebarOpen ? 'rotate-180' : ''}`} />
        </motion.div>
      </button>
    </div>
  )
}
