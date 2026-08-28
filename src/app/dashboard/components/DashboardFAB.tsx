'use client'

import { useState, useRef, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Plus, Wallet, ChevronDown, Trash2, Grid3X3, X,
} from 'lucide-react'
import { toast } from 'sonner'
import DeleteAccountDialog from './sidebar/DeleteAccountDialog'

interface DashboardFABProps {
  language: 'id' | 'en'
  tradingAccounts: any[]
  selectedAccountId: string | null
  setSelectedAccountId: (id: string | null) => void
  setAddAccountOpen: (open: boolean) => void
  setAddTradeOpen: (open: boolean) => void
  fetchData: () => void
}

export default function DashboardFAB({
  language,
  tradingAccounts,
  selectedAccountId,
  setSelectedAccountId,
  setAddAccountOpen,
  setAddTradeOpen,
  fetchData,
}: DashboardFABProps) {
  const [open, setOpen] = useState(false)
  const [accountDropdownOpen, setAccountDropdownOpen] = useState(false)
  const [deleteAccountOpen, setDeleteAccountOpen] = useState(false)
  const [accountToDelete, setAccountToDelete] = useState<any>(null)
  const [deleting, setDeleting] = useState(false)
  const dropdownRef = useRef<HTMLDivElement>(null)

  const t = (id: string, en: string) => language === 'id' ? id : en

  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setAccountDropdownOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [])

  useEffect(() => {
    if (!open) return
    const handleClick = (e: MouseEvent) => {
      const fabArea = document.getElementById('dashboard-fab-area')
      if (fabArea && !fabArea.contains(e.target as Node)) {
        setOpen(false)
        setAccountDropdownOpen(false)
      }
    }
    const timer = setTimeout(() => {
      document.addEventListener('mousedown', handleClick)
    }, 100)
    return () => {
      clearTimeout(timer)
      document.removeEventListener('mousedown', handleClick)
    }
  }, [open])

  const handleDeleteAccount = async () => {
    if (!accountToDelete) return
    setDeleting(true)
    try {
      const res = await fetch(`/api/trading-accounts/${accountToDelete.id}`, { method: 'DELETE', credentials: 'include' })
      if (res.ok) {
        const data = await res.json()
        toast.success(data.message || t('Akun trading berhasil dihapus', 'Trading account deleted'))
        setDeleteAccountOpen(false)
        setAccountToDelete(null)
        if (selectedAccountId === accountToDelete.id) setSelectedAccountId(null)
        fetchData()
      } else {
        const data = await res.json()
        toast.error(data.error || t('Gagal menghapus akun', 'Failed to delete account'))
      }
    } catch {
      toast.error(t('Gagal menghapus akun', 'Failed to delete account'))
    } finally {
      setDeleting(false)
    }
  }

  const openDeleteModal = (account: any) => {
    if (tradingAccounts.length <= 1) {
      toast.error(t('Tidak bisa menghapus akun terakhir.', 'Cannot delete the last account.'))
      return
    }
    setAccountToDelete(account)
    setDeleteAccountOpen(true)
    setAccountDropdownOpen(false)
  }

  const selectedAccountName = selectedAccountId
    ? tradingAccounts.find((a: any) => a.id === selectedAccountId)?.name
    : null

  const fabClass = open
    ? 'bg-red-500/90 hover:bg-red-500 shadow-red-500/30'
    : 'bg-gradient-to-br from-blue-500 to-cyan-500 hover:from-blue-600 hover:to-cyan-600 shadow-blue-500/40 hover:shadow-[0_0_24px_rgba(59,130,246,0.4)]'

  const fabLabel = open
    ? t('Tutup menu', 'Close menu')
    : t('Buka menu aksi', 'Open action menu')

  return (
    <div id="dashboard-fab-area" className="fixed bottom-6 right-6 z-40 flex flex-col items-end gap-3">
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: 20, scale: 0.9 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 20, scale: 0.9 }}
            transition={{ duration: 0.2, ease: 'easeOut' }}
            className="bg-[#0a0c14]/98 backdrop-blur-2xl border border-blue-500/20 rounded-2xl shadow-2xl shadow-blue-500/10 overflow-hidden w-72"
          >
            {tradingAccounts.length > 0 && (
              <div className="p-2 border-b border-white/5">
                <p className="px-3 py-1.5 text-[10px] font-semibold uppercase tracking-wider text-gray-500">
                  {t('Akun Trading', 'Trading Account')}
                </p>
                <div className="relative" ref={dropdownRef}>
                  <button
                    onClick={() => setAccountDropdownOpen(!accountDropdownOpen)}
                    className="w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-sm transition-all hover:bg-white/5 border border-transparent"
                  >
                    <Wallet className="w-4 h-4 text-blue-400" />
                    <span className="flex-1 text-left text-gray-300 truncate">
                      {selectedAccountName || t('Semua Akun', 'All Accounts')}
                    </span>
                    <ChevronDown className={`w-3.5 h-3.5 text-gray-500 transition-transform ${accountDropdownOpen ? 'rotate-180' : ''}`} />
                  </button>

                  <AnimatePresence>
                    {accountDropdownOpen && (
                      <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} className="overflow-hidden">
                        <div className="pt-1 pb-1">
                          <button
                            onClick={() => { setSelectedAccountId(null); setAccountDropdownOpen(false); toast.success('All Accounts selected') }}
                            className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm transition-all ${selectedAccountId === null ? 'bg-blue-500/15 text-white border border-blue-500/30' : 'text-gray-400 hover:text-white hover:bg-white/5 border border-transparent'}`}
                          >
                            <Grid3X3 className={`w-4 h-4 ${selectedAccountId === null ? 'text-blue-400' : 'text-gray-500'}`} />
                            <span className="flex-1 text-left">{t('Semua Akun', 'All Accounts')}</span>
                          </button>
                          {tradingAccounts.map((account: any) => (
                            <div key={account.id} className={`flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm transition-all group ${selectedAccountId === account.id ? 'bg-blue-500/15 text-white border border-blue-500/30' : 'text-gray-400 hover:text-white hover:bg-white/5 border border-transparent'}`}>
                              <button
                                onClick={() => { setSelectedAccountId(account.id); setAccountDropdownOpen(false); toast.success('Switched to ' + account.name) }}
                                className="flex-1 flex items-center gap-2.5 text-left"
                              >
                                <div className={`w-2 h-2 rounded-full flex-shrink-0 ${selectedAccountId === account.id ? 'bg-emerald-400' : 'bg-gray-500'}`} />
                                <span className="truncate">{account.name}</span>
                                <span className="text-xs text-gray-500">{account.currency}</span>
                              </button>
                              {tradingAccounts.length > 1 && (
                                <button
                                  onClick={(e) => { e.stopPropagation(); openDeleteModal(account) }}
                                  className="p-1 rounded text-gray-600 hover:text-red-400 hover:bg-red-500/10 transition-all opacity-0 group-hover:opacity-100"
                                  aria-label={'Hapus ' + account.name}
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              )}
                            </div>
                          ))}
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              </div>
            )}

            <div className="p-2 space-y-1">
              <button
                onClick={() => { setAddTradeOpen(true); setOpen(false) }}
                className="w-full flex items-center gap-3 px-3 py-3 rounded-xl text-sm transition-all bg-gradient-to-r from-blue-500 to-cyan-500 hover:from-blue-600 hover:to-cyan-600 text-white font-medium shadow-lg shadow-blue-500/25 active:scale-[0.97]"
              >
                <Plus className="w-5 h-5" />
                <span>{t('Catat Trade Baru', 'Log New Trade')}</span>
              </button>
              <button
                onClick={() => { setAddAccountOpen(true); setOpen(false) }}
                className="w-full flex items-center gap-3 px-3 py-3 rounded-xl text-sm transition-all text-gray-300 hover:text-white hover:bg-white/5 border border-white/5 hover:border-blue-500/20"
              >
                <Wallet className="w-5 h-5" />
                <span>{t('Tambah Akun Trading', 'Add Trading Account')}</span>
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <motion.button
        onClick={() => setOpen(!open)}
        whileTap={{ scale: 0.9 }}
        className={['w-14 h-14 rounded-2xl flex items-center justify-center shadow-xl transition-all duration-300 cursor-pointer', fabClass].join(' ')}
        aria-label={fabLabel}
      >
        {open ? <X className="w-6 h-6 text-white" /> : <Plus className="w-7 h-7 text-white" />}
      </motion.button>

      <DeleteAccountDialog
        open={deleteAccountOpen}
        onOpenChange={(v) => { setDeleteAccountOpen(v); if (!v) setAccountToDelete(null) }}
        accountToDelete={accountToDelete}
        deleting={deleting}
        handleDeleteAccount={handleDeleteAccount}
      />
    </div>
  )
}
