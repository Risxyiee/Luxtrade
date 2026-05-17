'use client'

import { Eye, Plus, Trash2, TrendingUp as TrendingUpIcon } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'

export interface WatchlistItem {
  id: string
  symbol: string
  name: string
  target_price: number | null
  notes: string | null
  created_at: string
}

interface WatchlistTabProps {
  items: WatchlistItem[]
  loading: boolean
  onAdd: () => void
  onDelete: (id: string) => void
}

export default function WatchlistTab({
  items,
  loading,
  onAdd,
  onDelete
}: WatchlistTabProps) {
  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="w-8 h-8 border-2 border-purple-500 border-t-transparent rounded-full animate-spin"></div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-xl font-bold">Watchlist</h3>
          <p className="text-sm text-gray-400">Track potential opportunities</p>
        </div>
        <Button onClick={onAdd} className="bg-gradient-to-r from-emerald-500 to-teal-600">
          <Plus className="w-4 h-4 mr-2" />Add Symbol
        </Button>
      </div>

      {items.length === 0 ? (
        <Card className="bg-gradient-to-br from-[#0f0b18] to-[#12091a] border-purple-900/30">
          <CardContent className="py-16 text-center">
            <Eye className="w-12 h-12 mx-auto mb-4 text-gray-500" />
            <h3 className="text-lg font-semibold mb-2">No Watchlist Items</h3>
            <p className="text-gray-400 mb-4">Add symbols to track potential setups!</p>
            <Button onClick={onAdd} variant="outline" className="border-emerald-500/30 text-emerald-400">
              <Plus className="w-4 h-4 mr-2" /> Add First Symbol
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {items.map((item) => (
            <Card key={item.id} className="bg-gradient-to-br from-[#0f0b18] to-[#12091a] border-purple-900/30 hover:border-emerald-500/30 transition-colors group">
              <CardContent className="p-4">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <div className="w-10 h-10 rounded-lg bg-emerald-500/20 flex items-center justify-center">
                      <TrendingUpIcon className="w-5 h-5 text-emerald-400" />
                    </div>
                    <div>
                      <h4 className="font-bold">{item.symbol}</h4>
                      {item.name && <p className="text-xs text-gray-500">{item.name}</p>}
                    </div>
                  </div>
                  <button
                    onClick={() => onDelete(item.id)}
                    className="p-1 rounded opacity-0 group-hover:opacity-100 hover:bg-red-500/20 text-gray-400 hover:text-red-400 transition-all"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
                {item.target_price && (
                  <div className="mb-2">
                    <span className="text-xs text-gray-500">Target: </span>
                    <span className="text-sm font-bold text-emerald-400">{item.target_price}</span>
                  </div>
                )}
                {item.notes && (
                  <p className="text-xs text-gray-400 line-clamp-2">{item.notes}</p>
                )}
                <p className="text-xs text-gray-600 mt-2">Added {new Date(item.created_at).toLocaleDateString()}</p>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}
