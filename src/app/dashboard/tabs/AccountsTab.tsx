'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog'
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog'
import { Badge } from '@/components/ui/badge'
import { Loader2, Trash2, Wallet, AlertTriangle, Plus, Star } from 'lucide-react'
import { toast } from 'sonner'
import AddAccountForm from '../components/AddAccountForm'

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

export default function AccountsTab() {
  const [accounts, setAccounts] = useState<TradingAccount[]>([])
  const [loading, setLoading] = useState(true)
  const [addAccountOpen, setAddAccountOpen] = useState(false)
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [accountToDelete, setAccountToDelete] = useState<TradingAccount | null>(null)
  const [deleting, setDeleting] = useState(false)

  // Helper: Get auth headers
  const getAuthHeaders = () => {
    return { 'Content-Type': 'application/json' }
  }

  // Fetch accounts
  const fetchAccounts = async () => {
    try {
      setLoading(true)
      const response = await fetch('/api/trading-accounts', {
        headers: getAuthHeaders(),
        credentials: 'include'
      })

      if (!response.ok) {
        throw new Error('Failed to fetch accounts')
      }

      const data = await response.json()
      setAccounts(data.accounts || [])
    } catch (error) {
      console.error('Error fetching accounts:', error)
      toast.error('Gagal memuat akun trading')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchAccounts()
  }, [])

  const handleDeleteClick = (account: TradingAccount) => {
    setAccountToDelete(account)
    setDeleteDialogOpen(true)
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
      fetchAccounts()
    } catch (error: any) {
      console.error('Error deleting account:', error)
      if (error.message?.includes('default')) {
        toast.error('Tidak bisa menghapus akun default. Setel akun lain sebagai default terlebih dahulu.')
      } else if (error.message?.includes('hasTrades')) {
        toast.error('Akun ini memiliki trade. Hapus trade terlebih dahulu.')
      } else {
        toast.error(error.message || 'Gagal menghapus akun trading')
      }
    } finally {
      setDeleting(false)
    }
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-white">Akun Trading</h2>
          <p className="text-white/60 mt-1">Kelola akun trading Anda</p>
        </div>
        <Button
          onClick={() => setAddAccountOpen(true)}
          className="bg-gradient-to-r from-purple-500 to-violet-600 hover:from-purple-600 hover:to-violet-700"
        >
          <Plus className="w-4 h-4 mr-2" />
          Tambah Akun
        </Button>
      </div>

      {/* Accounts List */}
      <Card className="bg-[#0f0b18] border-purple-900/30">
        <CardHeader>
          <CardTitle className="text-white flex items-center gap-2">
            <Wallet className="w-5 h-5 text-purple-400" />
            Daftar Akun Trading
          </CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-8 h-8 animate-spin text-purple-400" />
            </div>
          ) : accounts.length === 0 ? (
            <div className="text-center py-12 text-white/40">
              <Wallet className="w-16 h-16 mx-auto mb-4 opacity-30" />
              <p className="text-lg mb-2">Belum ada akun trading</p>
              <p className="text-sm">Tambahkan akun trading untuk mulai tracking</p>
            </div>
          ) : (
            <div className="space-y-4">
              {accounts.map((account) => (
                <Card key={account.id} className="bg-[#1a1025] border-purple-900/30 hover:border-purple-500/50 transition-all">
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
          )}
        </CardContent>
      </Card>

      {/* Add Account Dialog */}
      <AddAccountForm
        open={addAccountOpen}
        onOpenChange={setAddAccountOpen}
        onSuccess={fetchAccounts}
      />

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
              Tindakan ini tidak dapat dibatalkan.
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
    </div>
  )
}