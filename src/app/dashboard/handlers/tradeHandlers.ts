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
    console.log('🟢 [handleAddTrade] Starting trade creation...')
    console.log('📊 [handleAddTrade] Form data:', formData)
    
    if (!formData.symbol || !formData.type || !formData.lot_size || !formData.open_price) {
      console.log('❌ [handleAddTrade] Validation failed - missing required fields')
      toast.error('Please fill all required fields')
      return
    }

    // Check trade limit for free users
    if (isFreeUser && trades.length >= FREE_TRADE_LIMIT) {
      console.log('⚠️ [handleAddTrade] Trade limit exceeded')
      toast.error(`Free users are limited to ${FREE_TRADE_LIMIT} trades. Upgrade to PRO for unlimited trades!`)
      setPlanSelectionModalOpen(true)
      return
    }

    setSaving(true)
    try {
      const payload: any = {
        symbol: formData.symbol.toUpperCase(),
        type: formData.type,
        lot_size: parseFloat(formData.lot_size) || 0.1,
        open_price: parseFloat(formData.open_price),
      }

      // Only add these fields if they have values
      if (formData.close_price) {
        payload.close_price = parseFloat(formData.close_price)
      }
      if (formData.profit_loss) {
        payload.profit_loss = parseFloat(formData.profit_loss)
      }
      if (formData.open_time) {
        payload.open_time = formData.open_time
      } else {
        payload.open_time = formatLocalDateTime(new Date())
      }
      if (formData.close_time) {
        payload.close_time = formData.close_time
      } else if (formData.close_price) {
        // If trade has close_price but no close_time, use current time
        payload.close_time = formatLocalDateTime(new Date())
      }
      if (formData.session) {
        payload.session = formData.session
      }
      if (formData.notes) {
        payload.notes = formData.notes
      }
      if (formData.image_url) {
        payload.image_url = formData.image_url
      }
      if (formData.screenshot_url) {
        payload.screenshot_url = formData.screenshot_url
      }
      if (formData.emotion) {
        payload.emotion = formData.emotion
      }

      console.log('📤 [handleAddTrade] Sending payload:', payload)
      console.log('🔑 [handleAddTrade] Auth headers:', getAuthHeaders())

      const res = await fetch('/api/trades', {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify(payload),
      })

      console.log('📡 [handleAddTrade] Response status:', res.status)
      
      const data = await res.json()
      console.log('📥 [handleAddTrade] Response data:', data)
      
      if (res.ok) {
        console.log('✅ [handleAddTrade] Trade created successfully!')
        toast.success('Trade added successfully!')
        setAddTradeOpen(false)
        setFormData(emptyFormData)
        fetchData()
      } else {
        console.log('❌ [handleAddTrade] Failed to create trade:', data)
        toast.error(data.error || 'Failed to add trade')
      }
    } catch (error) {
      console.error('❌ [handleAddTrade] Error:', error)
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
      image_url: trade.image_url || '',
      screenshot_url: trade.screenshot_url || '', // New field
      emotion: trade.emotion || '', // New field
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
