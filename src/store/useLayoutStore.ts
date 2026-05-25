import { create } from 'zustand'
import { persist } from 'zustand/middleware'

export type Language = 'id' | 'en'
export type Currency = 'USD' | 'IDR' | 'EUR' | 'GBP' | 'JPY'

interface LayoutState {
  // Sidebar states
  sidebarOpen: boolean
  mobileSidebarOpen: boolean
  setSidebarOpen: (open: boolean) => void
  setMobileSidebarOpen: (open: boolean) => void
  toggleSidebar: () => void
  toggleMobileSidebar: () => void

  // Active tab
  activeTab: string
  setActiveTab: (tab: string) => void

  // Language
  language: Language
  setLanguage: (lang: Language) => void

  // Currency
  currency: Currency
  setCurrency: (curr: Currency) => void

  // Theme
  theme: 'light' | 'dark'
  setTheme: (theme: 'light' | 'dark') => void
  toggleTheme: () => void

  // UI preferences
  compactMode: boolean
  setCompactMode: (compact: boolean) => void

  // Notifications
  notificationPermission: 'default' | 'granted' | 'denied'
  setNotificationPermission: (permission: 'default' | 'granted' | 'denied') => void
}

export const useLayoutStore = create<LayoutState>()(
  persist(
    (set, get) => ({
      // Sidebar states
      sidebarOpen: true,
      mobileSidebarOpen: false,
      setSidebarOpen: (open) => set({ sidebarOpen: open }),
      setMobileSidebarOpen: (open) => set({ mobileSidebarOpen: open }),
      toggleSidebar: () => set((state) => ({ sidebarOpen: !state.sidebarOpen })),
      toggleMobileSidebar: () => set((state) => ({ mobileSidebarOpen: !state.mobileSidebarOpen })),

      // Active tab
      activeTab: 'dashboard',
      setActiveTab: (tab) => set({ activeTab: tab }),

      // Language
      language: 'id',
      setLanguage: (lang) => set({ language: lang }),

      // Currency
      currency: 'USD',
      setCurrency: (curr) => set({ currency: curr }),

      // Theme
      theme: 'dark',
      setTheme: (theme) => set({ theme }),
      toggleTheme: () => set((state) => ({ theme: state.theme === 'dark' ? 'light' : 'dark' })),

      // UI preferences
      compactMode: false,
      setCompactMode: (compact) => set({ compactMode: compact }),

      // Notifications
      notificationPermission: 'default',
      setNotificationPermission: (permission) => set({ notificationPermission: permission }),
    }),
    {
      name: 'luxtrade-layout-storage',
      // Only persist specific fields
      partialize: (state) => ({
        sidebarOpen: state.sidebarOpen,
        language: state.language,
        currency: state.currency,
        theme: state.theme,
        compactMode: state.compactMode,
      }),
    }
  )
)
