'use client'

import React, { useState, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog'
import { Badge } from '@/components/ui/badge'
import { Loader2, Wallet, Plus, ChevronDown, Trash2, Grid3X3, Check } from 'lucide-react'
import { toast } from 'sonner'
import AddAccountForm from '../components/AddAccountForm'
import TradingAccountList from '../components/TradingAccountList'

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
  const [selectedAccountId, setSelectedAccountId] = useState<string | null>(null)
  const [accountDropdownOpen, setAccountDropdownOpen] = useState(false)
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [accountToDelete, setAccountToDelete] = useState<TradingAccount | null>(null)
  const [deleting, setDeleting] = useState(false)
  const dropdownRef = React.useRef<HTMLDivElement>(null)

  // Get selected account name
  const selectedAccountName = selectedAccountId
    ? accounts.find((a: TradingAccount) => a.id === selectedAccountId)?.name
    : null

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

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setAccountDropdownOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [])

  const handleDeleteClick = (account: TradingAccount) => {
    // Prevent deleting if it's the last account
    if (accounts.length <= 1) {
      toast.error('Tidak bisa menghapus akun terakhir. Minimal 1 akun diperlukan.')
      return
    }

    // Prevent deleting default account
    if (account.is_default) {
      toast.error('Tidak bisa menghapus akun default. Setel akun lain sebagai default terlebih dahulu.')
      return
    }

    setAccountToDelete(account)
    setDeleteDialogOpen(true)
    setAccountDropdownOpen(false)
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

      // If deleted account was selected, clear selection
      if (selectedAccountId === accountToDelete.id) {
        setSelectedAccountId(null)
      }

      fetchAccounts()
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

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-lux-text-primary dark:text-white">Akun Trading</h2>
          <p className="text-white/60 mt-1">Kelola akun trading Anda</p>
        </div>
        <div className="flex items-center gap-2">
          {/* Account Switcher Dropdown */}
          {accounts.length > 0 && (
            <div className="relative" ref={dropdownRef}>
              <Button
                variant="outline"
                size="default"
                onClick={() => setAccountDropdownOpen(!accountDropdownOpen)}
                className="bg-lux-bg-card dark:bg-[#0a0c12] border-white/10 hover:border-blue-500/30 hover:bg-white/5 text-white"
              >
                <Wallet className="w-4 h-4 mr-2 text-blue-400" />
                <span className="truncate max-w-[150px]">
                  {selectedAccountName || 'Semua Akun'}
                </span>
                <ChevronDown className={`w-4 h-4 ml-2 transition-transform ${accountDropdownOpen ? 'rotate-180' : ''}`} />
              </Button>

              {accountDropdownOpen && (
                <div className="absolute right-0 top-full mt-2 w-64 bg-lux-bg-card dark:bg-[#0a0c12] border border-white/10 rounded-lg shadow-xl z-50 overflow-hidden">
                  {/* All Accounts Option */}
                  <button
                    onClick={() => {
                      setSelectedAccountId(null)
                      setAccountDropdownOpen(false)
                      toast.success('Semua akun dipilih')
                    }}
                    className={`w-full flex items-center gap-3 px-4 py-3 text-sm transition-all ${
                      selectedAccountId === null
                        ? 'bg-blue-500/20 text-white border-l-2 border-blue-500'
                        : 'text-gray-400 hover:text-white hover:bg-white/5 border-l-2 border-transparent'
                    }`}
                  >
                    <Grid3X3 className={`w-4 h-4 ${selectedAccountId === null ? 'text-blue-400' : 'text-gray-500'}`} />
                    <span className="flex-1 text-left">Semua Akun</span>
                    {selectedAccountId === null && <Check className="w-4 h-4 text-blue-400" />}
                  </button>

                  {/* Account List */}
                  {accounts.map((account) => (
                    <div
                      key={account.id}
                      className={`flex items-center gap-2 px-4 py-3 text-sm transition-all ${
                        selectedAccountId === account.id
                          ? 'bg-blue-500/20 text-white border-l-2 border-blue-500'
                          : 'text-gray-400 hover:text-white hover:bg-white/5 border-l-2 border-transparent'
                      }`}
                    >
                      <div className={`flex-1 flex items-center gap-3 cursor-pointer`} onClick={() => {
                        setSelectedAccountId(account.id)
                        setAccountDropdownOpen(false)
                        toast.success(`Switched to ${account.name}`)
                      }}>
                        <div className={`w-2 h-2 rounded-full flex-shrink-0 ${selectedAccountId === account.id ? 'bg-emerald-400' : 'bg-gray-500'}`} />
                        <div className="flex-1">
                          <div className="flex items-center gap-2">
                            <span className="truncate font-medium">{account.name}</span>
                            {account.is_default && (
                              <Badge className="bg-amber-500/20 text-amber-400 border-amber-500/30 text-[9px] px-1.5 py-0">
                                Default
                              </Badge>
                            )}
                          </div>
                          <div className="flex items-center gap-2 text-xs text-gray-500 mt-0.5">
                            <span className={`px-1.5 py-0.5 rounded ${
                              account.account_type === 'REAL'
                                ? 'bg-green-500/10 text-green-400'
                                : 'bg-blue-500/10 text-blue-400'
                            }`}>
                              {account.account_type}
                            </span>
                            {account.account_number && <span>{account.account_number}</span>}
                            <span>{account.current_balance.toLocaleString()} {account.currency}</span>
                          </div>
                        </div>
                      </div>
                      {accounts.length > 1 && !account.is_default && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={(e) => {
                            e.stopPropagation()
                            handleDeleteClick(account)
                          }}
                          className="h-8 w-8 p-0 text-gray-500 hover:text-red-400 hover:bg-red-500/10"
                          title="Hapus akun"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </Button>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Add Account Button */}
          <Button
            onClick={() => setAddAccountOpen(true)}
            className="bg-gradient-to-r from-blue-500 to-blue-600 hover:from-blue-600 hover:to-blue-700"
          >
            <Plus className="w-4 h-4 mr-2" />
            Tambah Akun
          </Button>
        </div>
      </div>

      {/* Accounts List */}
      <Card className="bg-lux-bg-card dark:bg-lux-bg-card dark:bg-[#0a0c12] border-lux-border dark:border-lux-border dark:border-blue-900/30">
        <CardHeader>
          <CardTitle className="text-white flex items-center gap-2">
            <Wallet className="w-5 h-5 text-blue-400" />
            Daftar Akun Trading
          </CardTitle>
        </CardHeader>
        <CardContent>
          <TradingAccountList accounts={accounts} loading={loading} onRefresh={fetchAccounts} />
        </CardContent>
      </Card>

      {/* Add Account Dialog */}
      <AddAccountForm
        open={addAccountOpen}
        onOpenChange={setAddAccountOpen}
        onSuccess={fetchAccounts}
      />

      {/* Delete Confirmation Dialog */}
      {deleteDialogOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
          <div className="bg-lux-bg-card dark:bg-[#080b12] border border-red-500/30 rounded-lg p-6 max-w-md w-full mx-4">
            <h3 className="text-lg font-semibold text-red-400 flex items-center gap-2 mb-4">
              <Trash2 className="w-5 h-5" />
              Hapus Akun Trading?
            </h3>
            <div className="text-white/60 space-y-2 mb-6">
              <p>Anda yakin ingin menghapus akun trading <strong>{accountToDelete?.name}</strong>?</p>
              {accountToDelete?.account_number && <p>Account: {accountToDelete.account_number}</p>}
              {accountToDelete?.broker && <p>Broker: {accountToDelete.broker}</p>}
              <p className="text-sm text-amber-400 mt-3">⚠️ Tindakan ini tidak dapat dibatalkan. Semua trade yang terkait akan dihapus.</p>
            </div>
            <div className="flex justify-end gap-3">
              <Button
                variant="outline"
                onClick={() => {
                  setDeleteDialogOpen(false)
                  setAccountToDelete(null)
                }}
                disabled={deleting}
                className="border-white/10 text-white hover:bg-white/5"
              >
                Batal
              </Button>
              <Button
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
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}