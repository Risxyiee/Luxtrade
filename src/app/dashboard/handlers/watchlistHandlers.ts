import { WatchlistItem } from '../utils/types'
import { toast } from 'sonner'

interface WatchlistHandlersProps {
  watchlistForm: { symbol: string; name: string; target_price: string; notes: string }
  setWatchlistForm: (form: { symbol: string; name: string; target_price: string; notes: string }) => void
  addWatchlistOpen: boolean
  setAddWatchlistOpen: (open: boolean) => void
  saving: boolean
  setSaving: (saving: boolean) => void
  fetchData: (isRefresh?: boolean) => void
}

export const createWatchlistHandlers = ({
  watchlistForm,
  setWatchlistForm,
  addWatchlistOpen,
  setAddWatchlistOpen,
  saving,
  setSaving,
  fetchData
}: WatchlistHandlersProps) => {
  
  const handleAddWatchlist = async () => {
    if (!watchlistForm.symbol) {
      toast.error('Please enter a symbol')
      return
    }

    setSaving(true)
    try {
      const res = await fetch('/api/watchlist', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(watchlistForm)
      })
      
      const data = await res.json()
      if (res.ok) {
        toast.success('Added to watchlist!')
        setAddWatchlistOpen(false)
        setWatchlistForm({ symbol: '', name: '', target_price: '', notes: '' })
        fetchData(true)
      } else {
        toast.error(data.error || 'Failed to add')
      }
    } catch {
      toast.error('Failed to add to watchlist')
    } finally {
      setSaving(false)
    }
  }
  
  const handleDeleteWatchlist = async (id: string) => {
    try {
      const res = await fetch(`/api/watchlist?id=${id}`, { method: 'DELETE', credentials: 'include' })
      if (res.ok) {
        toast.success('Removed from watchlist!')
        fetchData(true)
      }
    } catch {
      toast.error('Failed to remove')
    }
  }

  // Set / ubah / hapus target harga item watchlist (null = hapus target).
  // Sukses → update state lokal optimis agar UI langsung reflect tanpa
  // fetchData penuh (hemat round-trip, harga polling tidak terputus).
  const handleUpdateWatchlistTarget = async (
    id: string,
    target: number | null,
    onSuccess?: (updated: { id: string; symbol: string; name: string; target_price: number | null; notes: string | null; created_at: string }) => void
  ): Promise<boolean> => {
    try {
      const res = await fetch('/api/watchlist', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ id, target_price: target })
      })
      const data = await res.json().catch(() => null)
      if (res.ok && data?.item) {
        onSuccess?.(data.item)
        return true
      }
      toast.error(data?.error || 'Failed to update target')
      return false
    } catch {
      toast.error('Failed to update target')
      return false
    }
  }

  return {
    handleAddWatchlist,
    handleDeleteWatchlist,
    handleUpdateWatchlistTarget
  }
}
