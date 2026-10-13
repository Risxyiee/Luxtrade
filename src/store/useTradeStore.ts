import { create } from 'zustand'
import { persist } from 'zustand/middleware'

export interface Trade {
  id: string
  symbol: string
  type: 'BUY' | 'SELL'
  entryPrice: number
  exitPrice: number
  lotSize: number
  profit: number
  profitPercentage: number
  status: 'OPEN' | 'CLOSED'
  session: 'LONDON' | 'NEW_YORK' | 'ASIAN' | 'OVERLAP'
  setupType?: string
  rrRatio?: number
  entryDate: string
  exitDate?: string
  notes?: string
  tags?: string[]
  screenshot?: string
  userId: string
  createdAt: string
  updatedAt: string
}

export interface TradeFilters {
  symbol?: string
  type?: 'BUY' | 'SELL' | 'ALL'
  status?: 'OPEN' | 'CLOSED' | 'ALL'
  session?: string
  dateFrom?: string
  dateTo?: string
  minProfit?: number
  maxProfit?: number
  tags?: string[]
}

interface TradeState {
  // Trade data
  trades: Trade[]
  loading: boolean
  error: string | null

  // Filtering
  filters: TradeFilters
  filteredTrades: Trade[]

  // Sorting
  sortBy: 'date' | 'profit' | 'symbol' | 'profitPercentage'
  sortOrder: 'asc' | 'desc'

  // Pagination
  currentPage: number
  itemsPerPage: number

  // Actions
  setTrades: (trades: Trade[]) => void
  addTrade: (trade: Trade) => void
  updateTrade: (id: string, trade: Partial<Trade>) => void
  deleteTrade: (id: string) => void
  setLoading: (loading: boolean) => void
  setError: (error: string | null) => void

  // Filter actions
  setFilters: (filters: TradeFilters) => void
  clearFilters: () => void
  applyFilters: () => void

  // Sort actions
  setSortBy: (sortBy: 'date' | 'profit' | 'symbol' | 'profitPercentage') => void
  setSortOrder: (order: 'asc' | 'desc') => void
  sortTrades: () => void

  // Pagination actions
  setCurrentPage: (page: number) => void
  setItemsPerPage: (items: number) => void

  // Computed values (helpers)
  getWinRate: () => number
  getProfitFactor: () => number
  getTotalProfit: () => number
  getAverageTrade: () => number
  getMaxDrawdown: () => number
  getWinningTrades: () => Trade[]
  getLosingTrades: () => Trade[]
}

const initialFilters: TradeFilters = {}

export const useTradeStore = create<TradeState>()(
  persist(
    (set, get) => ({
      // Initial state
      trades: [],
      loading: false,
      error: null,
      filters: initialFilters,
      filteredTrades: [],
      sortBy: 'date',
      sortOrder: 'desc',
      currentPage: 1,
      itemsPerPage: 20,

      // Trade data actions
      setTrades: (trades) => set({ trades, filteredTrades: trades }),

      addTrade: (trade) => set((state) => ({
        trades: [trade, ...state.trades],
        filteredTrades: [trade, ...state.filteredTrades],
      })),

      updateTrade: (id, updatedTrade) => set((state) => ({
        trades: state.trades.map((t) => (t.id === id ? { ...t, ...updatedTrade } : t)),
        filteredTrades: state.filteredTrades.map((t) => (t.id === id ? { ...t, ...updatedTrade } : t)),
      })),

      deleteTrade: (id) => set((state) => ({
        trades: state.trades.filter((t) => t.id !== id),
        filteredTrades: state.filteredTrades.filter((t) => t.id !== id),
      })),

      setLoading: (loading) => set({ loading }),
      setError: (error) => set({ error }),

      // Filter actions
      setFilters: (filters) => set({ filters }),

      clearFilters: () => set({ filters: initialFilters, filteredTrades: get().trades }),

      applyFilters: () => {
        const { trades, filters } = get()
        let filtered = [...trades]

        if (filters.symbol) {
          filtered = filtered.filter((t) => t.symbol === filters.symbol)
        }

        if (filters.type && filters.type !== 'ALL') {
          filtered = filtered.filter((t) => t.type === filters.type)
        }

        if (filters.status && filters.status !== 'ALL') {
          filtered = filtered.filter((t) => t.status === filters.status)
        }

        if (filters.session) {
          filtered = filtered.filter((t) => t.session === filters.session)
        }

        if (filters.dateFrom) {
          filtered = filtered.filter((t) => new Date(t.entryDate) >= new Date(filters.dateFrom!))
        }

        if (filters.dateTo) {
          filtered = filtered.filter((t) => new Date(t.entryDate) <= new Date(filters.dateTo!))
        }

        if (filters.minProfit !== undefined) {
          filtered = filtered.filter((t) => t.profit >= filters.minProfit!)
        }

        if (filters.maxProfit !== undefined) {
          filtered = filtered.filter((t) => t.profit <= filters.maxProfit!)
        }

        if (filters.tags && filters.tags.length > 0) {
          filtered = filtered.filter((t) =>
            filters.tags!.some((tag) => t.tags?.includes(tag))
          )
        }

        set({ filteredTrades: filtered })
      },

      // Sort actions
      setSortBy: (sortBy) => set({ sortBy }),

      setSortOrder: (sortOrder) => set({ sortOrder }),

      sortTrades: () => {
        const { filteredTrades, sortBy, sortOrder } = get()
        const sorted = [...filteredTrades].sort((a, b) => {
          let comparison = 0

          switch (sortBy) {
            case 'date':
              comparison = new Date(a.entryDate).getTime() - new Date(b.entryDate).getTime()
              break
            case 'profit':
              comparison = a.profit - b.profit
              break
            case 'symbol':
              comparison = a.symbol.localeCompare(b.symbol)
              break
            case 'profitPercentage':
              comparison = a.profitPercentage - b.profitPercentage
              break
          }

          return sortOrder === 'asc' ? comparison : -comparison
        })

        set({ filteredTrades: sorted })
      },

      // Pagination actions
      setCurrentPage: (page) => set({ currentPage: page }),
      setItemsPerPage: (items) => set({ itemsPerPage: items }),

      // Computed values
      getWinRate: () => {
        const { filteredTrades } = get()
        if (filteredTrades.length === 0) return 0
        const wins = filteredTrades.filter((t) => t.profit > 0).length
        return Math.round((wins / filteredTrades.length) * 100)
      },

      getProfitFactor: () => {
        const { filteredTrades } = get()
        if (filteredTrades.length === 0) return 0

        const grossProfit = filteredTrades
          .filter((t) => t.profit > 0)
          .reduce((sum, t) => sum + t.profit, 0)

        const grossLoss = filteredTrades
          .filter((t) => t.profit < 0)
          .reduce((sum, t) => sum + Math.abs(t.profit), 0)

        if (grossLoss === 0) return grossProfit > 0 ? Infinity : 0
        return Math.round((grossProfit / grossLoss) * 100) / 100
      },

      getTotalProfit: () => {
        const { filteredTrades } = get()
        return filteredTrades.reduce((sum, t) => sum + t.profit, 0)
      },

      getAverageTrade: () => {
        const { filteredTrades } = get()
        if (filteredTrades.length === 0) return 0
        const total = filteredTrades.reduce((sum, t) => sum + t.profit, 0)
        return Math.round((total / filteredTrades.length) * 100) / 100
      },

      getMaxDrawdown: () => {
        const { filteredTrades } = get()
        if (filteredTrades.length === 0) return 0

        let peak = 0
        let maxDrawdown = 0
        let runningTotal = 0

        // Sort by date first
        const sortedByDate = [...filteredTrades].sort(
          (a, b) => new Date(a.entryDate).getTime() - new Date(b.entryDate).getTime()
        )

        sortedByDate.forEach((t) => {
          runningTotal += t.profit

          if (runningTotal > peak) {
            peak = runningTotal
          }

          const drawdown = ((peak - runningTotal) / peak) * 100
          if (drawdown > maxDrawdown) {
            maxDrawdown = drawdown
          }
        })

        return Math.round(maxDrawdown * 100) / 100
      },

      getWinningTrades: () => {
        const { filteredTrades } = get()
        return filteredTrades.filter((t) => t.profit > 0)
      },

      getLosingTrades: () => {
        const { filteredTrades } = get()
        return filteredTrades.filter((t) => t.profit <= 0)
      },
    }),
    {
      name: 'luxtrade-trade-storage',
      // Only persist non-sensitive data
      partialize: (state) => ({
        filters: state.filters,
        sortBy: state.sortBy,
        sortOrder: state.sortOrder,
        itemsPerPage: state.itemsPerPage,
      }),
    }
  )
)
