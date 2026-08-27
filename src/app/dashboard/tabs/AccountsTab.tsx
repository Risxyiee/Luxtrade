'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog'
import { Badge } from '@/components/ui/badge'
import { Loader2, Wallet, Plus } from 'lucide-react'
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

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-lux-text-primary dark:text-white">Akun Trading</h2>
          <p className="text-white/60 mt-1">Kelola akun trading Anda</p>
        </div>
        <Button
          onClick={() => setAddAccountOpen(true)}
          className="bg-gradient-to-r from-blue-500 to-blue-600 hover:from-blue-600 hover:to-blue-700"
        >
          <Plus className="w-4 h-4 mr-2" />
          Tambah Akun
        </Button>
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
    </div>
  )
}