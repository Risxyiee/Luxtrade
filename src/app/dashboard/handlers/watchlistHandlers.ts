import { WatchlistItem } from '../utils/types'
import { toast } from 'sonner'

interface WatchlistHandlersProps {
  watchlistForm: { symbol: string; name: string; target_price: string; notes: string }
  setWatchlistForm: (form: { symbol: string; name: string; target_price: string; notes: string }) => void
  addWatchlistOpen: boolean
  setAddWatchlistOpen: (open: boolean) => void
  saving: boolean
  setSaving: (saving: boolean) => void
  fetchData: () => void
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
        body: JSON.stringify(watchlistForm)
      })
      
      const data = await res.json()
      if (res.ok) {
        toast.success('Added to watchlist!')
        setAddWatchlistOpen(false)
        setWatchlistForm({ symbol: '', name: '', target_price: '', notes: '' })
        fetchData()
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
      const res = await fetch(`/api/watchlist?id=${id}`, { method: 'DELETE' })
      if (res.ok) {
        toast.success('Removed from watchlist!')
        fetchData()
      }
    } catch {
      toast.error('Failed to remove')
    }
  }

  return {
    handleAddWatchlist,
    handleDeleteWatchlist
  }
}
