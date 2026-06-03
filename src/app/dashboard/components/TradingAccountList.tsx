'use client'

import React from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog'
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog'
import { Loader2, Trash2, Wallet, AlertTriangle, CheckCircle, Star } from 'lucide-react'
import { toast } from 'sonner'
import { useState } from 'react'

interface TradingAccount {
  id: string
  name: string
  broker: string | null
  account_type: string
  account_number: string | null
  initial_balance: number
  current_balance: number
  leverage: number
  currency: string
  is_default: boolean
  is_active: boolean
  created_at: string
}

interface TradingAccountListProps {
  accounts: TradingAccount[]
  loading: boolean
  onRefresh: () => void
}

export default function TradingAccountList({ accounts, loading, onRefresh }: TradingAccountListProps) {
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [accountToDelete, setAccountToDelete] = useState<TradingAccount | null>(null)
  const [deleting, setDeleting] = useState(false)
  const [deleteReason, setDeleteReason] = useState('')
  const [accountTrades, setAccountTrades] = useState<Record<string, number>>({})

  // Load trade counts when accounts change
  const loadTradeCounts = async () => {
    const counts: Record<string, number> = {}
    for (const account of accounts) {
      try {
        const response = await fetch(`/api/trades?accountId=${account.id}`)
        const data = await response.json()
        if (data.trades) {
          counts[account.id] = data.trades.length
        }
      } catch (error) {
        counts[account.id] = 0
      }
    }
    setAccountTrades(counts)
  }

  React.useEffect(() => {
    loadTradeCounts()
  }, [accounts])

  const handleDeleteClick = (account: TradingAccount) => {
    setAccountToDelete(account)
    setDeleteDialogOpen(true)
    setDeleteReason('')
  }

  const handleDeleteConfirm = async () => {
    if (!accountToDelete) return

    setDeleting(true)
    try {
      const response = await fetch(`/api/trading-accounts?id=${accountToDelete.id}`, {
        method: 'DELETE',
        credentials: 'include'
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Failed to delete account')
      }

      toast.success('Akun trading berhasil dihapus!')
      setDeleteDialogOpen(false)
      setAccountToDelete(null)
      onRefresh()
    } catch (error: any) {
      console.error('Error deleting account:', error)
      if (error.message?.includes('Cannot delete default account')) {
        toast.error('Tidak bisa menghapus akun default. Setel akun lain sebagai default terlebih dahulu.')
      } else {
        toast.error(error.message || 'Gagal menghapus akun trading')
      }
    } finally {
      setDeleting(false)
    }
  }

  if (loading) {
    return (
      <div className="space-y-4">
        {[1, 2, 3].map((i) => (
          <div key={i} className="p-4 rounded-lg bg-white/[0.03] border border-white/[0.08]">
            <div className="flex items-center justify-between">
              <div>
                <div className="h-5 bg-white/10 rounded w-32 mb-2 animate-pulse" />
                <div className="h-4 bg-white/5 rounded w-24 animate-pulse" />
              </div>
              <div className="h-8 bg-white/10 rounded w-8 animate-pulse" />
            </div>
          </div>
        ))}
      </div>
    )
  }

  if (accounts.length === 0) {
    return (
      <div className="text-center py-12 text-white/40">
        <Wallet className="w-12 h-12 mx-auto mb-4 opacity-30" />
        <p>Belum ada akun trading</p>
      </div>
    )
  }

  return (
    <>
      <div className="space-y-4">
        {accounts.map((account) => (
          <Card key={account.id} className="bg-[#0f0b18] border-purple-900/30">
            <CardContent className="p-4">
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-2">
                    <h3 className="text-lg font-semibold text-white">{account.name}</h3>
                    {account.is_default && (
                      <Badge className="bg-amber-500/20 text-amber-400 border-amber-500/30 text-[10px] px-2 py-0.5">
                        <Star className="w-3 h-3 mr-1" />
                        Default
                      </Badge>
                    )}
                    <Badge className={`text-[10px] px-2 py-0.5 ${
                      account.account_type === 'REAL' 
                        ? 'bg-green-500/20 text-green-400 border-green-500/30'
                        : account.account_type === 'DEMO'
                        ? 'bg-blue-500/20 text-blue-400 border-blue-500/30'
                        : 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30'
                    }`}>
                      {account.account_type}
                    </Badge>
                  </div>

                  {account.broker && (
                    <p className="text-sm text-white/60 mb-1">{account.broker}</p>
                  )}
                  {account.account_number && (
                    <p className="text-sm text-white/60">Account: {account.account_number}</p>
                  )}

                  <div className="flex gap-4 mt-3 text-sm">
                    <div>
                      <span className="text-white/40">Balance:</span>
                      <span className="text-white font-medium ml-1">
                        {account.current_balance.toLocaleString()} {account.currency}
                      </span>
                    </div>
                    {account.leverage > 0 && (
                      <div>
                        <span className="text-white/40">Leverage:</span>
                        <span className="text-white font-medium ml-1">1:{account.leverage}</span>
                      </div>
                    )}
                  </div>
                </div>

                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => handleDeleteClick(account)}
                  disabled={deleting || account.is_default}
                  className={`h-9 w-9 p-0 ${
                    account.is_default
                      ? 'text-white/20 cursor-not-allowed'
                      : 'text-red-400 hover:text-red-300 hover:bg-red-500/10'
                  }`}
                  title={account.is_default ? 'Tidak bisa menghapus akun default' : 'Hapus akun'}
                >
                  {deleting ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Trash2 className="w-4 h-4" />
                  )}
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent className="bg-[#0f0b18] border-red-500/30 text-white max-w-md">
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2 text-red-400">
              <AlertTriangle className="w-5 h-5" />
              Hapus Akun Trading?
            </AlertDialogTitle>
            <AlertDialogDescription className="text-white/60">
              Anda yakin ingin menghapus akun trading <strong>{accountToDelete?.name}</strong>?
              <br /><br />
              {accountToDelete?.account_number && (
                <>Account: {accountToDelete.account_number}<br /></>
              )}
              {accountToDelete?.broker && (
                <>Broker: {accountToDelete.broker}<br /></>
              )}
              {accountToDelete && accountTrades[accountToDelete.id] > 0 && (
                <>
                  <br />
                  <div className="flex items-start gap-2 bg-amber-500/10 border border-amber-500/30 rounded-lg p-3 mt-2">
                    <AlertTriangle className="w-5 h-5 text-amber-400 flex-shrink-0 mt-0.5" />
                    <div>
                      <p className="text-amber-400 font-medium">Peringatan!</p>
                      <p className="text-sm text-white/70">
                        Akun ini memiliki <strong className="text-amber-400">{accountTrades[accountToDelete.id]} trade(s)</strong>.
                        <br /><br />
                        Semua trade yang terkait akan <strong>dihapus secara permanen</strong> bersama dengan akun ini.
                        Tindakan ini tidak dapat dibatalkan.
                      </p>
                    </div>
                  </div>
                </>
              )}
              {accountToDelete && accountTrades[accountToDelete.id] === 0 && (
                <>
                  <br />
                  <span className="text-white/40 text-sm">Tindakan ini tidak dapat dibatalkan.</span>
                </>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel
              disabled={deleting}
              className="border-white/10 text-white hover:bg-white/5"
            >
              Batal
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteConfirm}
              disabled={deleting}
              className="bg-red-600 hover:bg-red-700 text-white"
            >
              {deleting ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Menghapus...
                </>
              ) : (
                <>
                  <Trash2 className="w-4 h-4 mr-2" />
                  Hapus Akun
                </>
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}