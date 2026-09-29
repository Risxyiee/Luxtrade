'use client'

import { memo, useState, useMemo, useEffect, useRef } from 'react'
import {
  Menu, RefreshCw, LogOut, Keyboard, Settings, Sparkles,
  ChevronDown, Wallet, Plus, Check
} from 'lucide-react'
import LanguageSwitcher from '@/components/LanguageSwitcher'
import dynamic from 'next/dynamic'
import { ThemeToggle } from './ThemeToggle'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { getShortcutsList } from '@/lib/keyboard-shortcuts'
import NotificationPreferences from './NotificationPreferences'
import type { TradeAlertPreferences } from '@/lib/trade-alerts'

// Lazy-loaded to reduce initial bundle
const NotificationCenter = dynamic(() => import('@/components/NotificationCenter').then(m => ({ default: m.default })), { ssr: false })

// Currency flag emoji helper
function getAccountFlag(currency: string): string {
  const flags: Record<string, string> = {
    USD: '🇺🇸', EUR: '🇪🇺', GBP: '🇬🇧', JPY: '🇯🇵', AUD: '🇦🇺',
    CAD: '🇨🇦', CHF: '🇨🇭', NZD: '🇳🇿', IDR: '🇮🇩', SGD: '🇸🇬',
    CNY: '🇨🇳', KRW: '🇰🇷', INR: '🇮🇳', BRL: '🇧🇷', MXN: '🇲🇽',
  }
  return flags[currency] || '💰'
}

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
  tradingAccounts: any[]
  selectedAccountId: string | null
  setSelectedAccountId: (id: string | null) => void
  setAddAccountOpen: (open: boolean) => void
  setAddTradeOpen: (open: boolean) => void
  isAdmin?: boolean
}

const Header = memo(function Header({
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
  language = 'id',
  tradingAccounts = [],
  selectedAccountId = null,
  setSelectedAccountId = () => {},
  setAddAccountOpen = () => {},
  setAddTradeOpen = () => {},
  isAdmin = false
}: HeaderProps) {
  const [shortcutsOpen, setShortcutsOpen] = useState(false)
  const [notifPrefsOpen, setNotifPrefsOpen] = useState(false)
  const [notifPreferences, setNotifPreferences] = useState<Partial<TradeAlertPreferences> | undefined>()
  const [aiQuotaInfo, setAiQuotaInfo] = useState<{ total: number; used: number; remaining: number; isPro: boolean } | null>(null)
  const [accountDropdownOpen, setAccountDropdownOpen] = useState(false)
  const dropdownRef = useRef<HTMLDivElement>(null)

  // Close dropdown on outside click
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setAccountDropdownOpen(false)
      }
    }
    if (accountDropdownOpen) document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [accountDropdownOpen])

  // Find currently selected account name
  const selectedAccount = useMemo(() => {
    if (!selectedAccountId) return null
    return tradingAccounts.find((acc: any) => acc.id === selectedAccountId) || null
  }, [selectedAccountId, tradingAccounts])

  // Fetch AI quota info on mount (for free users)
  useEffect(() => {
    async function loadAIQuota() {
      if (isPro) return // Don't show quota for PRO users
      try {
        const res = await fetch('/api/ai/quota', { credentials: 'include' })
        if (res.ok) {
          const data = await res.json()
          setAiQuotaInfo(data)
        }
      } catch {
        // Use defaults
      }
    }
    loadAIQuota()
  }, [isPro])
  const shortcuts = useMemo(() => getShortcutsList(), [])
  
  return (
    <header className="h-16 border-b border-lux-border dark:border-blue-500/15 flex items-center justify-between px-4 lg:px-5
      bg-lux-bg-tertiary/80 dark:bg-[#050507]/80 backdrop-blur-md dark:shadow-[0_1px_0_0_rgba(59,130,246,0.08),0_8px_32px_-8px_rgba(59,130,246,0.06)] sticky top-0 z-30">

      {/* Subtle bottom glow line — 1px cyan/blue gradient */}
      <div className="absolute bottom-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-blue-500/40 to-transparent pointer-events-none" />

      {/* Left: Hamburger + Tab Title + Refresh */}
      <div className="flex items-center gap-2.5">
        <button
          onClick={() => setMobileSidebarOpen(true)}
          className="lg:hidden p-2 -ml-1 text-lux-text-secondary dark:text-gray-400 hover:text-lux-text-primary dark:hover:text-white transition-colors rounded-lg hover:bg-white/5"
          aria-label={language === 'id' ? 'Buka menu' : 'Open menu'}
        >
          <Menu className="w-5 h-5" />
        </button>

        <h2 className="text-base font-semibold text-lux-text-primary dark:text-white tracking-tight hidden sm:block">
          {menuItems.find((m: any) => m.id === activeTab)?.label || 'Dashboard'}
        </h2>

        <button
          onClick={fetchData}
          className="p-1.5 text-lux-text-muted dark:text-gray-500 hover:text-blue-400 dark:hover:text-blue-300 transition-colors rounded-lg hover:bg-blue-500/10"
          aria-label={language === 'id' ? 'Muat ulang data' : 'Refresh data'}
        >
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
        </button>
      </div>

      {/* Account Switcher — between title and right controls */}
      {tradingAccounts.length > 1 && (
        <div ref={dropdownRef} className="relative ml-2 sm:ml-3">
          <button
            onClick={() => setAccountDropdownOpen(!accountDropdownOpen)}
            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border border-lux-border dark:border-blue-500/20 bg-lux-bg-card dark:bg-white/5 hover:bg-lux-surface-hover dark:hover:bg-white/10 transition-colors text-sm"
          >
            <Wallet className="w-3.5 h-3.5 text-blue-400" />
            <span className="text-xs sm:text-sm font-medium text-lux-text-primary dark:text-white truncate max-w-[120px]">
              {selectedAccount?.name || (language === 'id' ? 'Semua Akun' : 'All Accounts')}
            </span>
            <ChevronDown className={`w-3 h-3 text-lux-text-muted dark:text-gray-400 transition-transform ${accountDropdownOpen ? 'rotate-180' : ''}`} />
          </button>

          {accountDropdownOpen && (
            <div className="absolute top-full left-0 mt-1.5 w-56 rounded-xl border border-lux-border dark:border-blue-500/20 bg-lux-bg-card dark:bg-[#0a0c12] shadow-xl shadow-black/30 z-50 py-1 overflow-hidden">
              {/* All Accounts option */}
              <button
                onClick={() => { setSelectedAccountId(null); setAccountDropdownOpen(false) }}
                className={`w-full flex items-center gap-2 px-3 py-2 text-sm transition-colors ${!selectedAccountId ? 'bg-blue-500/15 text-blue-300' : 'text-lux-text-secondary dark:text-gray-300 hover:bg-white/5'}`}
              >
                <Wallet className="w-4 h-4 flex-shrink-0" />
                <span className="flex-1 text-left truncate">{language === 'id' ? 'Semua Akun' : 'All Accounts'}</span>
                {!selectedAccountId && <Check className="w-3.5 h-3.5 text-blue-400" />}
              </button>

              <div className="h-px bg-lux-border dark:bg-blue-500/10 my-1" />

              {/* Individual accounts */}
              {tradingAccounts.map((acc: any) => (
                <button
                  key={acc.id}
                  onClick={() => { setSelectedAccountId(acc.id); setAccountDropdownOpen(false) }}
                  className={`w-full flex items-center gap-2 px-3 py-2 text-sm transition-colors ${selectedAccountId === acc.id ? 'bg-blue-500/15 text-blue-300' : 'text-lux-text-secondary dark:text-gray-300 hover:bg-white/5'}`}
                >
                  <span className="text-sm flex-shrink-0">{getAccountFlag(acc.currency)}</span>
                  <span className="flex-1 text-left truncate font-medium">{acc.name}</span>
                  {selectedAccountId === acc.id && <Check className="w-3.5 h-3.5 text-blue-400" />}
                </button>
              ))}

              <div className="h-px bg-lux-border dark:bg-blue-500/10 my-1" />

              {/* Add Account button */}
              <button
                onClick={() => { setAddAccountOpen(true); setAccountDropdownOpen(false) }}
                className="w-full flex items-center gap-2 px-3 py-2 text-sm text-emerald-400 hover:bg-emerald-500/10 transition-colors"
              >
                <Plus className="w-4 h-4" />
                <span>{language === 'id' ? 'Tambah Akun' : 'Add Account'}</span>
              </button>
            </div>
          )}
        </div>
      )}

      {/* Center spacer */}
      <div className="flex-1" />

      {/* Right: Utility Controls */}
      <div className="flex items-center gap-1.5">
        {/* AI Quota Indicator - Only for free users */}
        {!isPro && aiQuotaInfo && aiQuotaInfo.remaining > 0 && (
          <div className="hidden sm:flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-purple-500/10 border border-purple-500/20">
            <Sparkles className="w-3.5 h-3.5 text-purple-400" />
            <span className="text-[11px] text-purple-400 font-medium">
              {aiQuotaInfo.used}/{aiQuotaInfo.total} {language === 'id' ? 'AI Gratis' : 'Free AI'}
            </span>
          </div>
        )}

        {/* AI Quota Exceeded Warning - Show when quota is 0 */}
        {!isPro && aiQuotaInfo && aiQuotaInfo.remaining === 0 && (
          <div className="hidden sm:flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-red-500/10 border border-red-500/20">
            <Sparkles className="w-3.5 h-3.5 text-red-400" />
            <span className="text-[11px] text-red-400 font-medium">
              {language === 'id' ? 'AI Habis!' : 'AI Limit Reached'}
            </span>
          </div>
        )}

        <LanguageSwitcher />
        <ThemeToggle />

        <Dialog open={shortcutsOpen} onOpenChange={setShortcutsOpen}>
          <DialogTrigger asChild>
            <button
              className="p-2 text-lux-text-muted dark:text-gray-500 hover:text-lux-text-primary dark:hover:text-white hover:bg-white/5 transition-colors rounded-lg"
              aria-label={language === 'id' ? 'Pintasan keyboard' : 'Keyboard shortcuts'}
            >
              <Keyboard className="w-4 h-4" />
            </button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-md bg-lux-bg-card dark:bg-[#0a0c12] border-lux-border dark:border-blue-900/30 text-lux-text-primary dark:text-white">
            <DialogHeader>
              <DialogTitle className="text-lux-text-primary dark:text-white">{language === 'id' ? 'Pintasan Keyboard' : 'Keyboard Shortcuts'}</DialogTitle>
            </DialogHeader>
            <div className="space-y-2 pt-2">
              {shortcuts.map((s, i) => (
                <div key={i} className="flex items-center justify-between py-2 px-3 rounded-lg bg-lux-surface-hover dark:bg-white/5">
                  <span className="text-sm text-lux-text-secondary dark:text-gray-300">{s.action}</span>
                  <kbd className="px-2 py-1 text-xs font-mono bg-blue-500/20 text-blue-300 rounded border border-blue-500/30">
                    {s.combo}
                  </kbd>
                </div>
              ))}
            </div>
          </DialogContent>
        </Dialog>

        <div className="flex items-center gap-0.5" aria-label={language === 'id' ? 'Notifikasi' : 'Notifications'}>
          <NotificationCenter trades={trades} isPro={isPro} notificationPreferences={notifPreferences} />
          <button
            onClick={() => setNotifPrefsOpen(true)}
            className="p-2 text-gray-500 hover:text-gray-300 transition-colors rounded-lg hover:bg-white/5"
            aria-label={language === 'id' ? 'Pengaturan notifikasi' : 'Notification settings'}
          >
            <Settings className="w-4 h-4" />
          </button>
        </div>

        <div className="hidden sm:flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
          <span className="text-[11px] text-emerald-400 font-medium">{language === 'id' ? 'Siaran' : 'Live'}</span>
        </div>

        {user && (
          <button
            onClick={handleSignOut}
            className="p-2 text-lux-text-muted dark:text-gray-500 hover:text-red-400 hover:bg-red-500/10 transition-all rounded-lg"
            aria-label={language === 'id' ? 'Keluar' : 'Sign out'}
          >
            <LogOut className="w-4 h-4" />
          </button>
        )}

        <div className="w-8 h-8 rounded-full bg-gradient-to-br from-blue-500 to-cyan-500 flex items-center justify-center text-xs font-bold shadow-lg shadow-blue-500/20" role="img" aria-label={`Profil: ${user?.email || 'User'}`}>
          {userInitials}
        </div>
      </div>

      {/* Notification Preferences Dialog */}
      <NotificationPreferences
        open={notifPrefsOpen}
        onOpenChange={(open) => {
          setNotifPrefsOpen(open)
          if (!open) {
            // Re-fetch preferences after closing so NotificationCenter stays in sync
            fetch('/api/notifications/preferences', { credentials: 'include' })
              .then(res => res.ok ? res.json() : null)
              .then(data => { if (data?.preferences) setNotifPreferences(data.preferences) })
              .catch(() => {})
          }
        }}
        language={language}
      />

    </header>
  )
})

export default Header
