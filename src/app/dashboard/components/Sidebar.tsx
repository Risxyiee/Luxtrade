'use client'

import { useState, useRef, useEffect, useCallback } from 'react'
import { toast } from 'sonner'
import SidebarHeader from './sidebar/SidebarHeader'
import SidebarNav from './sidebar/SidebarNav'
import SidebarFooter from './sidebar/SidebarFooter'
import DeleteAccountDialog from './sidebar/DeleteAccountDialog'

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
  tradingAccounts?: any[]
  selectedAccountId?: string | null
  setSelectedAccountId?: (accountId: string | null) => void
  fetchData?: () => void
  refreshProfile?: () => void
  addTradeOpen?: boolean
  setAddTradeOpen?: (open: boolean) => void
  setAddAccountOpen?: (open: boolean) => void
}

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
  handleSignOut,
  tradingAccounts = [],
  selectedAccountId = null,
  setSelectedAccountId = () => {},
  fetchData = () => {},
  refreshProfile = () => {},
  addTradeOpen = false,
  setAddTradeOpen = () => {},
  setAddAccountOpen = () => {}
}: SidebarProps) {
  const [deleteAccountOpen, setDeleteAccountOpen] = useState(false)
  const [accountToDelete, setAccountToDelete] = useState<any>(null)
  const [deleting, setDeleting] = useState(false)

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

        // If we deleted the selected account, switch to 'all'
        if (selectedAccountId === accountToDelete.id) {
          setSelectedAccountId(null)
        }

        // Refresh data
        fetchData()
      } else {
        const data = await res.json()
        toast.error(data.error || 'Gagal menghapus akun trading')
      }
    } catch (error) {
      console.error('Error deleting account:', error)
      toast.error('Gagal menghapus akun trading')
    } finally {
      setDeleting(false)
    }
  }

  const openDeleteModal = (account: any) => {
    // Prevent deleting if it's the last account
    if (tradingAccounts.length <= 1) {
      toast.error('Tidak bisa menghapus akun terakhir. Minimal 1 akun diperlukan.')
      return
    }

    // Allow deleting any account including default
    setAccountToDelete(account)
    setDeleteAccountOpen(true)
  }

  // Focus management for mobile sidebar
  const sidebarRef = useRef<HTMLElement>(null)
  const previousFocusRef = useRef<HTMLElement | null>(null)

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      setMobileSidebarOpen(false)
      return
    }
    if (e.key !== 'Tab' || !sidebarRef.current) return

    const focusableElements = sidebarRef.current.querySelectorAll<HTMLElement>(
      'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
    )
    if (focusableElements.length === 0) return

    const firstEl = focusableElements[0]
    const lastEl = focusableElements[focusableElements.length - 1]

    if (e.shiftKey) {
      if (document.activeElement === firstEl) {
        e.preventDefault()
        lastEl.focus()
      }
    } else {
      if (document.activeElement === lastEl) {
        e.preventDefault()
        firstEl.focus()
      }
    }
  }, [setMobileSidebarOpen])

  useEffect(() => {
    if (mobileSidebarOpen) {
      previousFocusRef.current = document.activeElement as HTMLElement
      // Delay focus to allow animation
      setTimeout(() => {
        sidebarRef.current?.focus()
      }, 100)
    } else if (previousFocusRef.current) {
      previousFocusRef.current.focus()
      previousFocusRef.current = null
    }
  }, [mobileSidebarOpen])

  return (
    <>
      {/* Mobile Overlay Background - Click to close with better feedback */}
      {mobileSidebarOpen && (
        <div
          className="fixed inset-0 bg-black/60 backdrop-blur-sm z-40 lg:hidden transition-opacity duration-300"
          onClick={() => {
            setMobileSidebarOpen(false)
            // Add haptic feedback if available
            if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
              navigator.vibrate(10)
            }
          }}
          aria-hidden="true"
        />
      )}

      {/* Sidebar Component */}
      <aside
        ref={sidebarRef}
        {...(mobileSidebarOpen ? {
          role: 'dialog',
          'aria-modal': 'true',
          'aria-label': language === 'id' ? 'Menu navigasi' : 'Navigation menu',
          onKeyDown: handleKeyDown,
          tabIndex: -1
        } : {})}
        className={`
        fixed lg:static
        top-0 left-0
        h-dvh lg:h-auto
        z-50
        transition-all duration-300 ease-in-out
        ${mobileSidebarOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}
        ${mobileSidebarOpen ? 'w-80' : sidebarOpen ? 'w-80' : 'w-20'}
        flex flex-col overflow-hidden
      `}>
        {/* Glassmorphism Background */}
        <div className="absolute inset-0 bg-gradient-to-b from-lux-bg-sidebar via-lux-bg-tertiary to-lux-bg-sidebar dark:from-[#0d0a1a]/98 dark:via-[#0f0b18]/98 dark:to-[#0d0a1a]/98 backdrop-blur-3xl border-r border-lux-border dark:border-purple-500/20" />

        {/* Animated Glow Border */}
        <div className="absolute inset-y-0 right-0 w-[1px] bg-gradient-to-b from-transparent via-purple-500/30 to-transparent" />

        {/* Top Glow */}
        <div className="absolute top-0 left-0 right-0 h-32 bg-gradient-to-b from-purple-500/5 to-transparent pointer-events-none" />

        {/* Header Section - Logo & Account Selector */}
        <SidebarHeader
          sidebarOpen={sidebarOpen}
          mobileSidebarOpen={mobileSidebarOpen}
          tradingAccounts={tradingAccounts}
          selectedAccountId={selectedAccountId}
          setSelectedAccountId={setSelectedAccountId}
          setAddAccountOpen={setAddAccountOpen}
          setAddTradeOpen={setAddTradeOpen}
          language={language}
          openDeleteModal={openDeleteModal}
        />

        {/* Scrollable content area on mobile; on desktop nav scrolls independently */}
        <div className="flex-1 lg:flex-none flex flex-col min-h-0 overflow-y-auto overscroll-y-contain scrollbar-thin">
          <SidebarNav
            sidebarOpen={sidebarOpen}
            mobileSidebarOpen={mobileSidebarOpen}
            activeTab={activeTab}
            setActiveTab={setActiveTab}
            isPro={isPro}
            language={language}
            setPlanSelectionModalOpen={setPlanSelectionModalOpen}
            setMobileSidebarOpen={setMobileSidebarOpen}
          />

          {/* Bottom Section - Compact on mobile */}
          <SidebarFooter
            sidebarOpen={sidebarOpen}
            mobileSidebarOpen={mobileSidebarOpen}
            isPro={isPro}
            isFreeUser={isFreeUser}
            tradeCount={tradeCount}
            FREE_TRADE_LIMIT={FREE_TRADE_LIMIT}
            language={language}
            user={user}
            profile={profile}
            isAdmin={isAdmin}
            userInitials={userInitials}
            setPlanSelectionModalOpen={setPlanSelectionModalOpen}
            handleSignOut={handleSignOut}
            setSidebarOpen={setSidebarOpen}
            setMobileSidebarOpen={setMobileSidebarOpen}
          />
        </div>
      </aside>

      {/* Delete Account Confirmation Modal */}
      <DeleteAccountDialog
        open={deleteAccountOpen}
        onOpenChange={(open) => {
          setDeleteAccountOpen(open)
          if (!open) setAccountToDelete(null)
        }}
        accountToDelete={accountToDelete}
        deleting={deleting}
        handleDeleteAccount={handleDeleteAccount}
      />
    </>
  )
}