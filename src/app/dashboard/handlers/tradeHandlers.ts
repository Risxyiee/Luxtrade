import { Trade, TradeFormData, Analytics, emptyFormData } from '../utils/types'
import { formatLocalDateTime } from '../utils/helpers'
import { toast } from 'sonner'

interface TradeHandlersProps {
  formData: TradeFormData
  setFormData: (data: TradeFormData) => void
  selectedTrade: Trade | null
  setSelectedTrade: (trade: Trade | null) => void
  trades: Trade[]
  setTrades: (trades: Trade[]) => void
  setAddTradeOpen: (open: boolean) => void
  setEditTradeOpen: (open: boolean) => void
  setDeleteTradeOpen: (open: boolean) => void
  setViewTradeOpen: (open: boolean) => void
  saving: boolean
  setSaving: (saving: boolean) => void
  setPlanSelectionModalOpen: (open: boolean) => void
  isFreeUser: boolean
  FREE_TRADE_LIMIT: number
  getAuthHeaders: () => Record<string, string>
  fetchData: () => void
}

export const createTradeHandlers = ({
  formData,
  setFormData,
  selectedTrade,
  setSelectedTrade,
  trades,
  setTrades,
  setAddTradeOpen,
  setEditTradeOpen,
  setDeleteTradeOpen,
  setViewTradeOpen,
  saving,
  setSaving,
  setPlanSelectionModalOpen,
  isFreeUser,
  FREE_TRADE_LIMIT,
  getAuthHeaders,
  fetchData
}: TradeHandlersProps) => {
  
  const handleAddTrade = async () => {
    if (!formData.symbol || !formData.open_price || !formData.close_price || !formData.profit_loss) {
      toast.error('Please fill all required fields')
      return
    }

    // Check trade limit for free users
    if (isFreeUser && trades.length >= FREE_TRADE_LIMIT) {
      toast.error(`Free users are limited to ${FREE_TRADE_LIMIT} trades. Upgrade to PRO for unlimited trades!`)
      setPlanSelectionModalOpen(true)
      return
    }

    setSaving(true)
    try {
      const res = await fetch('/api/trades', {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify({
          symbol: formData.symbol.toUpperCase(),
          type: formData.type,
          open_price: parseFloat(formData.open_price),
          close_price: parseFloat(formData.close_price),
          lot_size: parseFloat(formData.lot_size) || 0.1,
          profit_loss: parseFloat(formData.profit_loss),
          open_time: formData.open_time || formatLocalDateTime(new Date()),
          close_time: formData.close_time || formatLocalDateTime(new Date()),
          session: formData.session || null,
          notes: formData.notes || null,
          image_url: formData.image_url || null,
        }),
      })

      const data = await res.json()
      if (res.ok) {
        toast.success('Trade added successfully!')
        setAddTradeOpen(false)
        setFormData(emptyFormData)
        fetchData()
      } else {
        toast.error(data.error || 'Failed to add trade')
      }
    } catch (error) {
      toast.error('Failed to add trade')
    } finally {
      setSaving(false)
    }
  }

  const handleEditTrade = async () => {
    if (!selectedTrade || !formData.symbol || !formData.open_price || !formData.close_price || !formData.profit_loss) {
      toast.error('Please fill all required fields')
      return
    }

    setSaving(true)
    try {
      const res = await fetch('/api/trades', {
        method: 'PUT',
        headers: getAuthHeaders(),
        body: JSON.stringify({
          id: selectedTrade.id,
          symbol: formData.symbol.toUpperCase(),
          type: formData.type,
          open_price: parseFloat(formData.open_price),
          close_price: parseFloat(formData.close_price),
          lot_size: parseFloat(formData.lot_size) || 0.1,
          profit_loss: parseFloat(formData.profit_loss),
          session: formData.session || null,
          notes: formData.notes || null,
          image_url: formData.image_url || null,
        }),
      })

      const data = await res.json()
      if (res.ok) {
        toast.success('Trade updated successfully!')
        setEditTradeOpen(false)
        setSelectedTrade(null)
        setFormData(emptyFormData)
        fetchData()
      } else {
        toast.error(data.error || 'Failed to update trade')
      }
    } catch (error) {
      toast.error('Failed to update trade')
    } finally {
      setSaving(false)
    }
  }

  const handleDeleteTrade = async () => {
    if (!selectedTrade) return

    setSaving(true)
    try {
      const res = await fetch(`/api/trades?id=${selectedTrade.id}`, {
        method: 'DELETE',
        headers: getAuthHeaders(),
      })

      if (res.ok) {
        toast.success('Trade deleted successfully!')
        setDeleteTradeOpen(false)
        setSelectedTrade(null)
        fetchData()
      } else {
        const data = await res.json()
        toast.error(data.error || 'Failed to delete trade')
      }
    } catch (error) {
      toast.error('Failed to delete trade')
    } finally {
      setSaving(false)
    }
  }

  const openEditModal = (trade: Trade) => {
    setSelectedTrade(trade)
    setFormData({
      symbol: trade.symbol,
      type: trade.type,
      open_price: trade.open_price.toString(),
      close_price: trade.close_price.toString(),
      lot_size: trade.lot_size.toString(),
      profit_loss: trade.profit_loss.toString(),
      open_time: trade.open_time,
      close_time: trade.close_time,
      session: trade.session || '',
      notes: trade.notes || '',
    })
    setEditTradeOpen(true)
  }

  const openViewModal = (trade: Trade) => {
    setSelectedTrade(trade)
    setViewTradeOpen(true)
  }

  const openDeleteModal = (trade: Trade) => {
    setSelectedTrade(trade)
    setDeleteTradeOpen(true)
  }

  return {
    handleAddTrade,
    handleEditTrade,
    handleDeleteTrade,
    openEditModal,
    openViewModal,
    openDeleteModal
  }
}
