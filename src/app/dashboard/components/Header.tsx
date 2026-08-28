'use client'

import { memo, useState, useMemo, useRef, useEffect } from 'react'
import {
  Menu, RefreshCw, LogOut, Keyboard, Plus, Wallet,
  ChevronDown, Trash2, Grid3X3, Zap, Gift, Settings
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
import { toast } from 'sonner'
import DeleteAccountDialog from './sidebar/DeleteAccountDialog'
import NotificationPreferences from './NotificationPreferences'
import type { TradeAlertPreferences } from '@/lib/trade-alerts'

// Lazy-loaded to reduce initial bundle
const NotificationCenter = dynamic(() => import('@/components/NotificationCenter').then(m => ({ default: m.default })), { ssr: false })

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
  const [accountDropdownOpen, setAccountDropdownOpen] = useState(false)
  const [deleteAccountOpen, setDeleteAccountOpen] = useState(false)
  const [accountToDelete, setAccountToDelete] = useState<any>(null)
  const [deleting, setDeleting] = useState(false)
  const [notifPrefsOpen, setNotifPrefsOpen] = useState(false)
  const [notifPreferences, setNotifPreferences] = useState<Partial<TradeAlertPreferences> | undefined>()

  // Fetch notification preferences on mount
  useEffect(() => {
    async function loadPrefs() {
      try {
        const res = await fetch('/api/notifications/preferences', { credentials: 'include' })
        if (res.ok) {
          const data = await res.json()
          setNotifPreferences(data.preferences)
        }
      } catch {
        // Use defaults
      }
    }
    loadPrefs()
  }, [])
  const shortcuts = useMemo(() => getShortcutsList(), [])
  const dropdownRef = useRef<HTMLDivElement>(null)

  // Close dropdown on outside click
  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setAccountDropdownOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [])

  const handleDeleteAccount = async () => {
    if (!accountToDelete) return
    setDeleting(true)
    try {
      const res = await fetch(`/api/trading-accounts/${accountToDelete.id}`, {
        method: 'DELETE',
        credentials: 'include'
      })
      if (res.ok) {
        const data = await res.json()
        toast.success(data.message || 'Akun trading berhasil dihapus')
        setDeleteAccountOpen(false)
        setAccountToDelete(null)
        if (selectedAccountId === accountToDelete.id) {
          setSelectedAccountId(null)
        }
        fetchData()
      } else {
        const data = await res.json()
        toast.error(data.error || 'Gagal menghapus akun trading')
      }
    } catch {
      toast.error('Gagal menghapus akun trading')
    } finally {
      setDeleting(false)
    }
  }

  const openDeleteModal = (account: any) => {
    if (tradingAccounts.length <= 1) {
      toast.error('Tidak bisa menghapus akun terakhir.')
      return
    }
    setAccountToDelete(account)
    setDeleteAccountOpen(true)
    setAccountDropdownOpen(false)
  }

  const selectedAccountName = selectedAccountId
    ? tradingAccounts.find((a: any) => a.id === selectedAccountId)?.name
    : null

  return (
    <header className="h-16 border-b border-lux-border dark:border-blue-500/15 flex items-center justify-between px-4 lg:px-5
      bg-lux-bg-tertiary/80 dark:bg-[#050507]/80 backdrop-blur-[24px] dark:shadow-[0_1px_0_0_rgba(59,130,246,0.08),0_8px_32px_-8px_rgba(59,130,246,0.06)] sticky top-0 z-30 relative">

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

      {/* Center: Command Center — Account Switcher + Action Buttons */}
      <div className="flex items-center gap-2 flex-wrap">
        {/* Account Switcher Dropdown */}
        {tradingAccounts.length > 0 && (
          <div className="relative" ref={dropdownRef}>
            <button
              onClick={() => setAccountDropdownOpen(!accountDropdownOpen)}
              className="flex items-center gap-2 px-3 py-1.5 rounded-xl
                bg-white/[0.04] dark:bg-white/[0.04]
                border border-white/[0.08] dark:border-blue-500/20
                hover:bg-white/[0.07] dark:hover:bg-white/[0.07] hover:border-blue-500/30
                backdrop-blur-xl transition-all duration-200 text-sm group"
            >
              <Wallet className="w-4 h-4 text-blue-400/80 group-hover:text-blue-400 transition-colors" />
              <span className="hidden md:inline max-w-[120px] truncate text-lux-text-secondary dark:text-gray-300 group-hover:text-white transition-colors">
                {selectedAccountName || (language === 'id' ? 'Semua Akun' : 'All Accounts')}
              </span>
              <ChevronDown className={`w-3.5 h-3.5 text-lux-text-muted dark:text-gray-500 transition-transform duration-200 ${accountDropdownOpen ? 'rotate-180' : ''}`} />
            </button>

            {/* Dropdown Menu */}
            {accountDropdownOpen && (
              <div className="absolute top-full left-0 mt-2 w-64 rounded-2xl overflow-hidden z-50
                bg-[#0a0c14]/95 dark:bg-[#0a0c14]/98 backdrop-blur-2xl
                border border-blue-500/20 shadow-2xl shadow-blue-500/10">
                <div className="p-2">
                  <button
                    onClick={() => { setSelectedAccountId(null); setAccountDropdownOpen(false); toast.success('All Accounts selected') }}
                    className={`w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-sm transition-all
                      ${selectedAccountId === null
                        ? 'bg-blue-500/15 text-white border border-blue-500/30'
                        : 'text-gray-400 hover:text-white hover:bg-white/5 border border-transparent'}`}>
                    <Grid3X3 className={`w-4 h-4 ${selectedAccountId === null ? 'text-blue-400' : 'text-gray-500'}`} />
                    <span className="flex-1 text-left">{language === 'id' ? 'Semua Akun' : 'All Accounts'}</span>
                  </button>

                  {tradingAccounts.map((account: any) => (
                    <div key={account.id} className={`flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-sm transition-all group
                      ${selectedAccountId === account.id
                        ? 'bg-blue-500/15 text-white border border-blue-500/30'
                        : 'text-gray-400 hover:text-white hover:bg-white/5 border border-transparent'}`}>
                      <button
                        onClick={() => { setSelectedAccountId(account.id); setAccountDropdownOpen(false); toast.success(`Switched to ${account.name}`) }}
                        className="flex-1 flex items-center gap-2.5 text-left"
                      >
                        <div className={`w-2 h-2 rounded-full flex-shrink-0 ${selectedAccountId === account.id ? 'bg-emerald-400' : 'bg-gray-500'}`} />
                        <span className="truncate">{account.name}</span>
                        <span className="text-xs text-gray-500">{account.currency}</span>
                      </button>
                      {tradingAccounts.length > 1 && (
                        <button
                          onClick={(e) => { e.stopPropagation(); openDeleteModal(account) }}
                          className="p-1 rounded text-gray-600 hover:text-red-400 hover:bg-red-500/10 transition-all opacity-0 group-hover:opacity-100"
                          aria-label={`Hapus ${account.name}`}
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Add Account Button */}
        <button
          onClick={() => setAddAccountOpen(true)}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl
            bg-white/[0.04] dark:bg-white/[0.04]
            border border-white/[0.08] dark:border-blue-500/20
            hover:bg-blue-500/15 hover:border-blue-500/30
            backdrop-blur-xl transition-all duration-200 text-sm
            text-lux-text-secondary dark:text-gray-400 hover:text-blue-400"
          title={language === 'id' ? 'Tambah Akun Trading' : 'Add Trading Account'}
        >
          <Wallet className="w-4 h-4" />
          <span className="hidden lg:inline text-xs font-medium">{language === 'id' ? 'Akun' : 'Account'}</span>
        </button>

        {/* Add Trade Button — Primary CTA */}
        <button
          onClick={() => setAddTradeOpen(true)}
          className="flex items-center gap-2 px-4 py-2 rounded-xl
            bg-gradient-to-r from-blue-500 to-cyan-500
            hover:from-blue-600 hover:to-cyan-600
            text-white text-sm font-medium
            shadow-lg shadow-blue-500/30 hover:shadow-blue-500/40 hover:shadow-[0_0_20px_rgba(59,130,246,0.25)]
            transition-all duration-200 active:scale-[0.97]"
          title={language === 'id' ? 'Catat Trade Baru' : 'Add New Trade'}
        >
          <Plus className="w-[18px] h-[18px]" />
          <span className="hidden sm:inline text-xs font-semibold tracking-wide">{language === 'id' ? 'Trade Baru' : 'New Trade'}</span>
        </button>
      </div>

      {/* Right: Utility Controls */}
      <div className="flex items-center gap-1.5">
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
              <DialogTitle className="text-lux-text-primary dark:text-white">Keyboard Shortcuts</DialogTitle>
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

        <div className="flex items-center gap-0.5">
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
          <span className="text-[11px] text-emerald-400 font-medium">Live</span>
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

      {/* Delete Account Dialog */}
      <DeleteAccountDialog
        open={deleteAccountOpen}
        onOpenChange={(open) => { setDeleteAccountOpen(open); if (!open) setAccountToDelete(null) }}
        accountToDelete={accountToDelete}
        deleting={deleting}
        handleDeleteAccount={handleDeleteAccount}
      />
    </header>
  )
})

export default Header
