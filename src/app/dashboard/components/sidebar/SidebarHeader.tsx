'use client'

import { useState } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import { motion } from 'framer-motion'
import { Wallet, Grid3X3, Trash2, Plus } from 'lucide-react'
import { toast } from 'sonner'
import { ContextGuide, useContextGuides, guideData } from '@/components/ContextGuide'
import JournalGuideDialog from '../AutoJournalGuideDialog'

interface SidebarHeaderProps {
  sidebarOpen: boolean
  mobileSidebarOpen: boolean
  tradingAccounts: any[]
  selectedAccountId: string | null
  setSelectedAccountId: (id: string | null) => void
  setAddAccountOpen: (open: boolean) => void
  setAddTradeOpen: (open: boolean) => void
  language: 'id' | 'en'
  openDeleteModal: (account: any) => void
}

export default function SidebarHeader({
  sidebarOpen,
  mobileSidebarOpen,
  tradingAccounts,
  selectedAccountId,
  setSelectedAccountId,
  setAddAccountOpen,
  setAddTradeOpen,
  language,
  openDeleteModal
}: SidebarHeaderProps) {
  const { activeGuide, openGuide, closeGuide } = useContextGuides()
  const [screenshotGuideOpen, setScreenshotGuideOpen] = useState(false)
  const [autoJournalGuideOpen, setAutoJournalGuideOpen] = useState(false)

  return (
    <div className="relative p-4 pb-3 border-b border-lux-border dark:border-purple-500/20 shrink-0 flex flex-col">
      <Link href="/" className="flex items-center gap-3 group">
        <motion.div
          className="relative flex-shrink-0"
          whileHover={{ scale: 1.1, rotate: 5 }}
          transition={{ type: "spring", stiffness: 300 }}
        >
          <div className="absolute inset-0 bg-gradient-to-br from-purple-500 to-pink-500 rounded-xl blur-lg opacity-40 group-hover:opacity-60 transition-opacity" />
          <Image
            src="/logo.png"
            alt="LuxTrade Logo"
            width={40}
            height={40}
            className="relative rounded-xl shadow-xl"
          />
        </motion.div>
        {(sidebarOpen || mobileSidebarOpen) && (
          <motion.div
            initial={{ opacity: 0, x: -10 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -10 }}
            transition={{ duration: 0.3 }}
            className="overflow-hidden"
          >
            <h1 className="text-xl font-bold bg-gradient-to-r from-purple-300 via-purple-400 to-pink-400 bg-clip-text text-transparent">
              LuxTrade
            </h1>
            <p className="text-xs text-purple-500/70 dark:text-purple-400/60">Trading Journal</p>
          </motion.div>
        )}
      </Link>

      {/* Account Selector with Delete Button */}
      {(sidebarOpen || mobileSidebarOpen) && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3, delay: 0.1 }}
          className="mt-4 relative"
        >
          {/* Account Selector - Only show if has accounts */}
          {tradingAccounts.length > 0 && (
            <>
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <Wallet className="w-4 h-4 text-purple-400" />
                  <span className="text-xs font-semibold text-lux-text-secondary">Trading Account</span>
                </div>
                {tradingAccounts.length > 1 && (
                  <span className="text-[10px] text-lux-text-muted">
                    {tradingAccounts.length} accounts
                  </span>
                )}
              </div>

              <div className="space-y-1 max-h-24 lg:max-h-32 overflow-y-auto">
                <button
                  onClick={() => {
                    setSelectedAccountId(null)
                    toast.success('All Accounts selected')
                  }}
                  className={`w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm transition-all ${
                    selectedAccountId === null
                      ? 'bg-purple-500/20 border border-purple-500/30 text-white dark:text-white'
                      : 'bg-lux-bg-secondary dark:bg-[#0a0712] border border-transparent text-lux-text-secondary hover:text-lux-text-primary dark:hover:text-white hover:bg-lux-surface-hover dark:hover:bg-white/5'
                  }`}
                >
                  <Grid3X3 className={`w-4 h-4 ${selectedAccountId === null ? 'text-purple-500 dark:text-purple-400' : 'text-lux-text-muted dark:text-gray-500'}`} />
                  <span className="flex-1 text-left">All Accounts</span>
                </button>

                {tradingAccounts.map((account: any) => (
                  <div
                    key={account.id}
                    className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm transition-all group ${
                      selectedAccountId === account.id
                        ? 'bg-purple-500/20 border border-purple-500/30 text-white dark:text-white'
                        : 'bg-lux-bg-secondary dark:bg-[#0a0712] border border-transparent text-lux-text-secondary hover:text-lux-text-primary dark:hover:text-white hover:bg-lux-surface-hover dark:hover:bg-white/5'
                    }`}
                  >
                    <button
                      onClick={() => {
                        setSelectedAccountId(account.id)
                        toast.success(`Switched to ${account.name}`)
                      }}
                      className="flex-1 flex items-center gap-2 text-left"
                    >
                      <div className={`w-2 h-2 rounded-full ${selectedAccountId === account.id ? 'bg-emerald-500 dark:bg-emerald-400' : 'bg-lux-text-muted dark:bg-gray-500'}`} />
                      <span className="truncate max-w-[120px]">{account.name}</span>
                      <span className="text-xs text-lux-text-muted dark:text-gray-500">{account.currency}</span>
                    </button>

                    {/* Delete button - visible for all accounts except when it's the only one */}
                    {tradingAccounts.length > 1 && (
                      <button
                        onClick={() => openDeleteModal(account)}
                        className="p-1.5 rounded text-lux-text-muted dark:text-gray-500 hover:text-red-400 hover:bg-red-500/10 transition-all opacity-60 hover:opacity-100"
                        aria-label={`Hapus akun ${account.name}`}
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                ))}
              </div>
            </>
          )}

          {/* No accounts message */}
          {tradingAccounts.length === 0 && (
            <div className="text-center py-3 px-3 bg-lux-surface-hover dark:bg-white/5 rounded-lg border border-lux-border dark:border-white/10">
              <Wallet className="w-5 h-5 text-lux-text-muted dark:text-gray-500 mx-auto mb-1" />
              <p className="text-xs text-lux-text-muted dark:text-gray-500">Belum ada trading account</p>
            </div>
          )}

          {/* Quick Action Buttons - Add Trade & Add Account */}
          <div className="mt-3 flex gap-2">
            <div className="relative flex-1">
              <button
                onClick={() => setAddAccountOpen(true)}
                className="flex w-full py-2.5 px-2 rounded-lg bg-gradient-to-r from-blue-500/20 to-cyan-500/20 text-blue-400 border border-blue-500/30 hover:from-blue-500/30 hover:to-cyan-500/30 transition-all text-[10px] sm:text-xs font-medium items-center justify-center gap-1 group"
                title={language === 'id' ? 'Tambah Akun Trading' : 'Add Trading Account'}
              >
                <Wallet className="w-4 h-4 flex-shrink-0" />
                <span className="truncate">{language === 'id' ? 'Add Account' : 'Add Account'}</span>
              </button>
              <button
                onClick={(e) => { e.stopPropagation(); openGuide('addAccount') }}
                className="absolute -top-1 -right-1 w-4 h-4 bg-blue-500 rounded-full flex items-center justify-center text-[8px] text-white hover:bg-blue-600 transition-colors z-10"
                aria-label={language === 'id' ? 'Panduan tambah akun' : 'Add account guide'}
              >
                ?
              </button>
              <ContextGuide
                isOpen={activeGuide === 'addAccount'}
                onClose={closeGuide}
                title={guideData.addAccount.title[language]}
                description={guideData.addAccount.description[language]}
                tips={guideData.addAccount.tips?.[language]}
                language={language}
                position="right"
              />
            </div>
            <div className="relative flex-1">
              <button
                onClick={() => setAddTradeOpen(true)}
                className="flex w-full py-2.5 px-2 rounded-lg bg-gradient-to-r from-purple-500 to-violet-600 text-white hover:from-purple-600 hover:to-violet-700 shadow-lg shadow-purple-500/20 transition-all text-[10px] sm:text-xs font-medium items-center justify-center gap-1 group"
                title={language === 'id' ? 'Catat Trade Baru' : 'Add New Trade'}
              >
                <Plus className="w-4 h-4 flex-shrink-0" />
                <span className="truncate">{language === 'id' ? 'Add Trade' : 'Add Trade'}</span>
              </button>
              <button
                onClick={(e) => { e.stopPropagation(); openGuide('addTrade') }}
                className="absolute -top-1 -right-1 w-4 h-4 bg-purple-500 rounded-full flex items-center justify-center text-[8px] text-white hover:bg-purple-600 transition-colors z-10"
                aria-label={language === 'id' ? 'Panduan tambah trade' : 'Add trade guide'}
              >
                ?
              </button>
              <ContextGuide
                isOpen={activeGuide === 'addTrade'}
                onClose={closeGuide}
                title={guideData.addTrade.title[language]}
                description={guideData.addTrade.description[language]}
                tips={guideData.addTrade.tips?.[language]}
                language={language}
                position="right"
              />
            </div>
          </div>

          {/* Guide Links — visible below Add Trade & Add Account buttons */}
          <div className="mt-2 space-y-1">
            <button
              type="button"
              onClick={() => setScreenshotGuideOpen(true)}
              className="block w-full text-left text-[10px] text-emerald-400/80 hover:text-emerald-300 transition-colors leading-tight"
            >
              📄 {language === 'id' ? 'Gak bisa pake Screenshot AI? Cek panduan di sini' : "Can't use Screenshot AI? Check guide here"}
            </button>
            <button
              type="button"
              onClick={() => setAutoJournalGuideOpen(true)}
              className="block w-full text-left text-[10px] text-purple-400/80 hover:text-purple-300 transition-colors leading-tight"
            >
              📄 {language === 'id' ? 'Gak bisa pake Auto-Journal? Cek panduan di sini' : "Can't use Auto-Journal? Check guide here"}
            </button>
          </div>
        </motion.div>
      )}

      {/* Guide Dialogs */}
      <JournalGuideDialog
        open={screenshotGuideOpen}
        onOpenChange={setScreenshotGuideOpen}
        language={language}
        mode="manual"
      />
      <JournalGuideDialog
        open={autoJournalGuideOpen}
        onOpenChange={setAutoJournalGuideOpen}
        language={language}
        mode="auto"
      />
    </div>
  )
}
