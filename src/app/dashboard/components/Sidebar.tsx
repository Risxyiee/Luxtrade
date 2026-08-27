'use client'

import { useRef, useCallback, useEffect, memo } from 'react'
import SidebarHeader from './sidebar/SidebarHeader'
import SidebarNav from './sidebar/SidebarNav'
import SidebarFooter from './sidebar/SidebarFooter'

interface SidebarProps {
  sidebarOpen: boolean
  setSidebarOpen: (open: boolean) => void
  mobileSidebarOpen: boolean
  setMobileSidebarOpen: (open: boolean) => void
  activeTab: string
  setActiveTab: (tab: string) => void
  isPro: boolean
  user: any
  isAdmin: boolean
  language: 'id' | 'en'
  setPlanSelectionModalOpen: (open: boolean) => void
}

const Sidebar = memo(function Sidebar({
  sidebarOpen,
  setSidebarOpen,
  mobileSidebarOpen,
  setMobileSidebarOpen,
  activeTab,
  setActiveTab,
  isPro,
  user,
  isAdmin,
  language,
  setPlanSelectionModalOpen,
}: SidebarProps) {
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
      setTimeout(() => {
        sidebarRef.current?.focus()
      }, 100)
    } else if (previousFocusRef.current) {
      previousFocusRef.current.focus()
      previousFocusRef.current = null
    }
  }, [mobileSidebarOpen])

  const closeMobileSidebar = () => {
    setMobileSidebarOpen(false)
    if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
      navigator.vibrate(10)
    }
  }

  return (
    <>
      {/* Mobile Overlay */}
      {mobileSidebarOpen && (
        <div
          className="fixed inset-0 bg-black/60 z-40 lg:hidden backdrop-blur-sm transition-opacity duration-200"
          onClick={closeMobileSidebar}
          aria-hidden="true"
        />
      )}

      {/* Desktop Sidebar — always visible on lg+ */}
      <aside className="hidden lg:flex relative h-full">
        <div className={`
          flex flex-col overflow-hidden relative h-full
          transition-all duration-300 ease-in-out shrink-0
          ${sidebarOpen ? 'w-64' : 'w-[72px]'}
        `}>
          {/* Glassmorphism Background */}
          <div className="absolute inset-0 bg-gradient-to-b from-lux-bg-sidebar via-lux-bg-tertiary to-lux-bg-sidebar dark:from-[#050507]/98 dark:via-[#060810]/98 dark:to-[#050507]/98 backdrop-blur-xl border-r border-lux-border dark:border-blue-500/20 pointer-events-none" />
          <div className="absolute inset-y-0 right-0 w-[1px] bg-gradient-to-b from-transparent via-blue-500/20 to-transparent pointer-events-none" />
          <div className="absolute top-0 left-0 right-0 h-24 bg-gradient-to-b from-blue-500/5 to-transparent pointer-events-none" />

          <SidebarHeader
            sidebarOpen={sidebarOpen}
            mobileSidebarOpen={false}
          />

          <div className="flex-1 overflow-y-auto overscroll-y-contain scrollbar-thin">
            <SidebarNav
              sidebarOpen={sidebarOpen}
              mobileSidebarOpen={false}
              activeTab={activeTab}
              setActiveTab={setActiveTab}
              isPro={isPro}
              language={language}
              setPlanSelectionModalOpen={setPlanSelectionModalOpen}
              setMobileSidebarOpen={setMobileSidebarOpen}
            />
          </div>

          <SidebarFooter
            sidebarOpen={sidebarOpen}
            mobileSidebarOpen={false}
            language={language}
            user={user}
            isAdmin={isAdmin}
            setSidebarOpen={setSidebarOpen}
            setMobileSidebarOpen={setMobileSidebarOpen}
          />
        </div>
      </aside>

      {/* Mobile Sidebar — only rendered when open */}
      {mobileSidebarOpen && (
        <aside
          ref={sidebarRef}
          role="dialog"
          aria-modal="true"
          aria-label={language === 'id' ? 'Menu navigasi' : 'Navigation menu'}
          onKeyDown={handleKeyDown}
          tabIndex={-1}
          className="fixed top-0 left-0 h-dvh z-50 lg:hidden w-72 flex flex-col overflow-hidden"
        >
          {/* Glassmorphism Background */}
          <div className="absolute inset-0 bg-gradient-to-b from-lux-bg-sidebar via-lux-bg-tertiary to-lux-bg-sidebar dark:from-[#0d0a1a]/98 dark:via-[#0f0b18]/98 dark:to-[#0d0a1a]/98 border-r border-lux-border dark:border-blue-500/20 pointer-events-none" />
          <div className="absolute inset-y-0 right-0 w-[1px] bg-gradient-to-b from-transparent via-blue-500/20 to-transparent pointer-events-none" />
          <div className="absolute top-0 left-0 right-0 h-24 bg-gradient-to-b from-blue-500/5 to-transparent pointer-events-none" />

          <SidebarHeader
            sidebarOpen={true}
            mobileSidebarOpen={mobileSidebarOpen}
          />

          <div className="flex-1 flex flex-col min-h-0 overflow-y-auto overscroll-y-contain scrollbar-thin">
            <SidebarNav
              sidebarOpen={true}
              mobileSidebarOpen={mobileSidebarOpen}
              activeTab={activeTab}
              setActiveTab={setActiveTab}
              isPro={isPro}
              language={language}
              setPlanSelectionModalOpen={setPlanSelectionModalOpen}
              setMobileSidebarOpen={setMobileSidebarOpen}
            />

            <SidebarFooter
              sidebarOpen={true}
              mobileSidebarOpen={mobileSidebarOpen}
              language={language}
              user={user}
              isAdmin={isAdmin}
              setSidebarOpen={setSidebarOpen}
              setMobileSidebarOpen={setMobileSidebarOpen}
            />
          </div>
        </aside>
      )}
    </>
  )
})

export default Sidebar
