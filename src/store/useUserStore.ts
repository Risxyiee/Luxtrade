import { create } from 'zustand'
import { persist } from 'zustand/middleware'

export interface UserProfile {
  id: string
  email: string
  full_name?: string
  avatar_url?: string
  plan: 'free' | 'pro' | 'elite'
  trade_count: number
  created_at: string
}

interface UserState {
  // User data
  user: any
  profile: UserProfile | null
  isAuthenticated: boolean
  isAdmin: boolean

  // User preferences
  tradeCount: number
  FREE_TRADE_LIMIT: number

  // Actions
  setUser: (user: any) => void
  setProfile: (profile: UserProfile | null) => void
  setAuthenticated: (isAuthenticated: boolean) => void
  setAdmin: (isAdmin: boolean) => void
  setTradeCount: (count: number) => void
  incrementTradeCount: () => void

  // Computed
  isPro: () => boolean
  isFreeUser: () => boolean
  getUserInitials: () => string
  canAddTrade: () => boolean
  tradesRemaining: () => number
}

export const useUserStore = create<UserState>()(
  persist(
    (set, get) => ({
      // Initial state
      user: null,
      profile: null,
      isAuthenticated: false,
      isAdmin: false,
      tradeCount: 0,
      FREE_TRADE_LIMIT: 50,

      // Actions
      setUser: (user) => set({ user }),

      setProfile: (profile) => set({ profile }),

      setAuthenticated: (isAuthenticated) => set({ isAuthenticated }),

      setAdmin: (isAdmin) => set({ isAdmin }),

      setTradeCount: (count) => set({ tradeCount: count }),

      incrementTradeCount: () => set((state) => ({ tradeCount: state.tradeCount + 1 })),

      // Computed
      isPro: () => {
        const { profile } = get()
        return profile?.plan === 'pro' || profile?.plan === 'elite'
      },

      isFreeUser: () => {
        const { profile } = get()
        return profile?.plan === 'free' || !profile
      },

      getUserInitials: () => {
        const { profile, user } = get()
        const name = profile?.full_name || user?.email || 'User'

        if (name.includes('@')) {
          // If it's an email, take first 2 letters
          return name.substring(0, 2).toUpperCase()
        }

        // If it's a name, take first letter of each word
        return name
          .split(' ')
          .map((n) => n[0])
          .join('')
          .substring(0, 2)
          .toUpperCase()
      },

      canAddTrade: () => {
        const state = get()
        if (state.isPro()) return true
        return state.tradeCount < state.FREE_TRADE_LIMIT
      },

      tradesRemaining: () => {
        const state = get()
        if (state.isPro()) return Infinity
        return Math.max(0, state.FREE_TRADE_LIMIT - state.tradeCount)
      },
    }),
    {
      name: 'luxtrade-user-storage',
      // Don't persist sensitive user data
      partialize: (state) => ({
        tradeCount: state.tradeCount,
      }),
    }
  )
)
