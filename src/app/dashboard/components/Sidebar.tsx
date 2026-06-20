'use client'

import { useState } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import { motion } from 'framer-motion'
import { Menu, X, BarChart3, Activity, Calendar, BookOpen, Eye,
  Newspaper, CalendarDays, Trophy, Target, Grid3X3, PieChart,
  Brain, FileText, Flame, Heart, Settings, Shield, Crown,
  Zap, AlertCircle, Lock, LogOut, Wallet, ChevronDown, Trash2, MoreHorizontal, Loader2, Plus, HelpCircle, Gift
} from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { toast } from 'sonner'
import { ContextGuide, useContextGuides, guideData } from '@/components/ContextGuide'

interface SidebarProps {
  sidebarOpen: boolean
  setSidebarOpen: (open: boolean) => void
  mobileSidebarOpen: boolean
  setMobileSidebarOpen: (open: boolean) => void
  activeTab: string
  setActiveTab: (tab: string) => void
  isPro: boolean
  user: any
  profile: any
  isAdmin: boolean
  language: 'id' | 'en'
  isFreeUser: boolean
  tradeCount: number
  FREE_TRADE_LIMIT: number
  setPlanSelectionModalOpen: (open: boolean) => void
  userInitials: string
  handleSignOut: () => void
  tradingAccounts?: any[]
  selectedAccountId?: string | null
  setSelectedAccountId?: (accountId: string | null) => void
  fetchData?: () => void
  refreshProfile?: () => void
  addTradeOpen?: boolean
  setAddTradeOpen?: (open: boolean) => void
  setAddAccountOpen?: (open: boolean) => void
}

const menuCategories = {
  utama: { label: 'UTAMA' },
  alat: { label: 'ALAT', proType: 'gold' },
  lanjutan: { label: 'LANJUTAN', proType: 'purple' },
}

const menuItems = [
  // UTAMA - Tanpa PRO
  { id: 'dashboard', label: 'Dashboard', labelId: 'Dasbor', icon: BarChart3, category: 'utama', proOnly: false },
  { id: 'trades', label: 'Trades', labelId: 'Transaksi', icon: Activity, category: 'utama', proOnly: false },
  { id: 'calendar', label: 'Calendar', labelId: 'Kalender', icon: Calendar, category: 'utama', proOnly: false },
  { id: 'journal', label: 'Journal', labelId: 'Jurnal', icon: BookOpen, category: 'utama', proOnly: false },
  { id: 'watchlist', label: 'Watchlist', labelId: 'Daftar Pantauan', icon: Eye, category: 'utama', proOnly: false },
  { id: 'news', label: 'Market News', labelId: 'Berita Pasar', icon: Newspaper, category: 'utama', proOnly: false },
  { id: 'economic-calendar', label: 'Economic Calendar', labelId: 'Kalender Ekonomi', icon: CalendarDays, category: 'utama', proOnly: false },
  { id: 'achievements', label: 'Achievements', labelId: 'Pencapaian', icon: Trophy, category: 'utama', proOnly: false },

  // ALAT - PRO Emas
  { id: 'risk', label: 'Risk Calculator', labelId: 'Kalkulator Risiko', icon: Target, category: 'alat', proOnly: true, proType: 'gold' },
  { id: 'heatmap', label: 'Market Heatmap', labelId: 'Pasar Heatmap', icon: Grid3X3, category: 'alat', proOnly: true, proType: 'gold' },

  // LANJUTAN - PRO Ungu
  { id: 'analytics', label: 'Analytics', labelId: 'Analitik', icon: PieChart, category: 'lanjutan', proOnly: true, proType: 'purple' },
  { id: 'targets', label: 'Targets', labelId: 'Target', icon: Target, category: 'lanjutan', proOnly: true, proType: 'purple' },
  { id: 'ai', label: 'AI Insights', labelId: 'Insight AI', icon: Brain, category: 'lanjutan', proOnly: true, proType: 'purple' },
  { id: 'score', label: 'Trading Score', labelId: 'Skor Trading', icon: Trophy, category: 'lanjutan', proOnly: true, proType: 'purple' },
  { id: 'report', label: 'Weekly Report', labelId: 'Laporan Mingguan', icon: FileText, category: 'lanjutan', proOnly: true, proType: 'purple' },
  { id: 'streaks', label: 'Streaks', labelId: 'Streak', icon: Flame, category: 'lanjutan', proOnly: true, proType: 'purple' },
  { id: 'psychology', label: 'Psychology Tracking', labelId: 'Psikologi', icon: Heart, category: 'lanjutan', proOnly: true, proType: 'purple' },
]

export default function Sidebar({
  sidebarOpen,
  setSidebarOpen,
  mobileSidebarOpen,
  setMobileSidebarOpen,
  activeTab,
  setActiveTab,
  isPro,
  user,
  profile,
  isAdmin,
  language,
  isFreeUser,
  tradeCount,
  FREE_TRADE_LIMIT,
  setPlanSelectionModalOpen,
  userInitials,
  handleSignOut,
  tradingAccounts = [],
  selectedAccountId = null,
  setSelectedAccountId = () => {},
  fetchData = () => {},
  refreshProfile = () => {},
  addTradeOpen = false,
  setAddTradeOpen = () => {},
  setAddAccountOpen = () => {}
}: SidebarProps) {
  const { activeGuide, openGuide, closeGuide } = useContextGuides()
  const [deleteAccountOpen, setDeleteAccountOpen] = useState(false)
  const [accountToDelete, setAccountToDelete] = useState<any>(null)
  const [deleting, setDeleting] = useState(false)

  const handleDeleteAccount = async () => {
    if (!accountToDelete) return

    setDeleting(true)
    try {
      const res = await fetch(`/api/trading-accounts/${accountToDelete.id}`, {
        method: 'DELETE',
        credentials: 'include'
      })

      if (res.ok) {
        const data = await res.json()
        toast.success(data.message || 'Akun trading berhasil dihapus')
        setDeleteAccountOpen(false)
        setAccountToDelete(null)

        // If we deleted the selected account, switch to 'all'
        if (selectedAccountId === accountToDelete.id) {
          setSelectedAccountId(null)
        }

        // Refresh data
        fetchData()
      } else {
        const data = await res.json()
        toast.error(data.error || 'Gagal menghapus akun trading')
      }
    } catch (error) {
      console.error('Error deleting account:', error)
      toast.error('Gagal menghapus akun trading')
    } finally {
      setDeleting(false)
    }
  }

  const openDeleteModal = (account: any) => {
    // Prevent deleting if it's the last account
    if (tradingAccounts.length <= 1) {
      toast.error('Tidak bisa menghapus akun terakhir. Minimal 1 akun diperlukan.')
      return
    }

    // Allow deleting any account including default
    setAccountToDelete(account)
    setDeleteAccountOpen(true)
  }
  return (
    <>
      {/* Mobile Overlay Background - Click to close with better feedback */}
      {mobileSidebarOpen && (
        <div
          className="fixed inset-0 bg-black/60 backdrop-blur-sm z-40 lg:hidden transition-opacity duration-300"
          onClick={() => {
            setMobileSidebarOpen(false)
            // Add haptic feedback if available
            if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
              navigator.vibrate(10)
            }
          }}
        />
      )}

      {/* Sidebar Component */}
      <aside className={`
        fixed lg:static
        top-0 left-0
        h-screen lg:h-full
        z-50
        transition-all duration-300 ease-in-out
        ${mobileSidebarOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}
        ${mobileSidebarOpen ? 'w-80' : sidebarOpen ? 'w-80' : 'w-20'}
        flex flex-col
      `}>
        {/* Glassmorphism Background */}
        <div className="absolute inset-0 bg-gradient-to-b from-[#0d0a1a]/98 via-[#0f0b18]/98 to-[#0d0a1a]/98 backdrop-blur-3xl border-r border-purple-500/20" />

        {/* Animated Glow Border */}
        <div className="absolute inset-y-0 right-0 w-[1px] bg-gradient-to-b from-transparent via-purple-500/30 to-transparent" />

        {/* Top Glow */}
        <div className="absolute top-0 left-0 right-0 h-32 bg-gradient-to-b from-purple-500/5 to-transparent pointer-events-none" />

        {/* Header Section - Logo & Account Selector */}
        <div className="relative p-4 border-b border-purple-500/20 shrink-0 flex flex-col">
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
                <p className="text-xs text-purple-400/60">Trading Journal</p>
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
                      <span className="text-xs font-semibold text-gray-400">Trading Account</span>
                    </div>
                    {tradingAccounts.length > 1 && (
                      <span className="text-[10px] text-gray-500">
                        {tradingAccounts.length} accounts
                      </span>
                    )}
                  </div>

                  <div className="space-y-1.5 max-h-40 overflow-y-auto">
                    <button
                      onClick={() => {
                        setSelectedAccountId(null)
                        toast.success('All Accounts selected')
                      }}
                      className={`w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm transition-all ${
                        selectedAccountId === null
                          ? 'bg-purple-500/20 border border-purple-500/30 text-white'
                          : 'bg-[#0a0712] border border-transparent text-gray-400 hover:text-white hover:bg-white/5'
                      }`}
                    >
                      <Grid3X3 className={`w-4 h-4 ${selectedAccountId === null ? 'text-purple-400' : 'text-gray-500'}`} />
                      <span className="flex-1 text-left">All Accounts</span>
                    </button>

                    {tradingAccounts.map((account: any) => (
                      <div
                        key={account.id}
                        className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm transition-all group ${
                          selectedAccountId === account.id
                            ? 'bg-purple-500/20 border border-purple-500/30 text-white'
                            : 'bg-[#0a0712] border border-transparent text-gray-400 hover:text-white hover:bg-white/5'
                        }`}
                      >
                        <button
                          onClick={() => {
                            setSelectedAccountId(account.id)
                            toast.success(`Switched to ${account.name}`)
                          }}
                          className="flex-1 flex items-center gap-2 text-left"
                        >
                          <div className={`w-2 h-2 rounded-full ${selectedAccountId === account.id ? 'bg-emerald-400' : 'bg-gray-500'}`} />
                          <span className="truncate max-w-[120px]">{account.name}</span>
                          <span className="text-xs text-gray-500">{account.currency}</span>
                        </button>

                        {/* Delete button - visible for all accounts except when it's the only one */}
                        {tradingAccounts.length > 1 && (
                          <button
                            onClick={() => openDeleteModal(account)}
                            className="p-1.5 rounded text-gray-500 hover:text-red-400 hover:bg-red-500/10 transition-all opacity-60 hover:opacity-100"
                            title="Delete Account"
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
                <div className="text-center py-3 px-3 bg-white/5 rounded-lg border border-white/10">
                  <Wallet className="w-5 h-5 text-gray-500 mx-auto mb-1" />
                  <p className="text-xs text-gray-500">Belum ada trading account</p>
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
                    title={language === 'id' ? 'Panduan' : 'Guide'}
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
                    title={language === 'id' ? 'Panduan' : 'Guide'}
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
            </motion.div>
          )}
        </div>

        <nav className="flex-1 p-3 space-y-2 overflow-y-auto overflow-x-hidden relative min-h-0 -webkit-overflow-scrolling touch overscroll-behavior-y-contain">
          {(['utama', 'alat', 'lanjutan'] as const).map((category) => {
            const categoryItems = menuItems.filter(item => item.category === category)
            const catInfo = menuCategories[category]

            return (
              <div key={category} className="space-y-1">
                {(sidebarOpen || mobileSidebarOpen) && (
                  <motion.div
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ duration: 0.3 }}
                    className="flex items-center gap-2 px-3 py-1.5 overflow-hidden"
                  >
                    <span className={`text-[10px] font-bold tracking-wider ${
                      category === 'utama'
                        ? 'text-gray-500'
                        : category === 'alat'
                          ? 'text-purple-400'
                          : 'text-pink-400'
                    }`}>
                      {catInfo.label}
                    </span>
                    {category !== 'utama' && (
                      <motion.span
                        className={`text-[7px] font-black px-1.5 py-0.5 rounded ${
                          category === 'alat'
                            ? 'bg-gradient-to-r from-amber-500 to-orange-500 text-white'
                            : 'bg-gradient-to-r from-purple-500 to-pink-500 text-white'
                        }`}
                        whileHover={{ scale: 1.1 }}
                      >
                        PRO
                      </motion.span>
                    )}
                    <div className="flex-1 h-px bg-gradient-to-r from-purple-500/30 to-transparent" />
                  </motion.div>
                )}

                {categoryItems.map((item: any, index: number) => {
                  const isLocked = item.proOnly && !isPro
                  const proType = item.proType || 'purple'
                  const hasGuide = guideData[item.id] !== undefined

                  return (
                    <motion.div
                      key={item.id}
                      initial={{ opacity: 0, x: -10 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ duration: 0.2, delay: index * 0.05 }}
                    >
                      <div className="relative">
                        <button
                          onClick={() => {
                            if (item.proOnly && !isPro) {
                              setPlanSelectionModalOpen(true)
                            } else {
                              setActiveTab(item.id)
                              setMobileSidebarOpen(false)
                            }
                            // Add haptic feedback on mobile
                            if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
                              navigator.vibrate(5)
                            }
                          }}
                          className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all duration-300 relative overflow-hidden group ${
                            activeTab === item.id
                              ? 'bg-gradient-to-r from-purple-500/20 via-violet-500/15 to-pink-500/10 text-white shadow-lg shadow-purple-500/20'
                              : isLocked
                                ? 'text-gray-500/50 hover:text-gray-400'
                                : 'text-gray-400 hover:text-white hover:bg-white/5 active:bg-white/10'
                          }`}
                        >
                          {/* Active State Glow */}
                          {activeTab === item.id && (
                            <motion.div
                              className="absolute inset-0 bg-gradient-to-r from-purple-500/20 via-violet-500/10 to-pink-500/5"
                              initial={{ opacity: 0 }}
                              animate={{ opacity: 1 }}
                              transition={{ duration: 0.3 }}
                            />
                          )}

                          {/* Icon Container */}
                          <motion.div
                            className={`relative flex-shrink-0 ${
                              activeTab === item.id
                                ? 'text-purple-400'
                                : isLocked
                                  ? 'text-gray-600'
                                  : 'text-gray-500 group-hover:text-purple-400'
                            }`}
                            whileHover={{ scale: 1.1, rotate: 5 }}
                            transition={{ type: "spring", stiffness: 300 }}
                          >
                            {activeTab === item.id && (
                              <motion.div
                                className="absolute inset-0 bg-purple-500/20 blur-xl rounded-lg"
                                animate={{
                                  scale: [1, 1.2, 1],
                                  opacity: [0.5, 0.8, 0.5]
                                }}
                                transition={{
                                  duration: 2,
                                  repeat: Infinity,
                                  ease: "easeInOut"
                                }}
                              />
                            )}
                            <item.icon className="w-5 h-5 relative z-10" />
                          </motion.div>

                          {/* Menu Text - SHOW WHEN SIDEBAR OPEN (DESKTOP OR MOBILE) */}
                          {(sidebarOpen || mobileSidebarOpen) && (
                            <span className={`text-sm font-medium flex-1 text-left truncate relative z-10 overflow-hidden ${
                              activeTab === item.id ? 'text-white' : ''
                            }`}>
                              {language === 'id' ? item.labelId : item.label}
                            </span>
                          )}

                          {/* PRO Badge - SHOW WHEN SIDEBAR OPEN (DESKTOP OR MOBILE) */}
                          {(sidebarOpen || mobileSidebarOpen) && item.proOnly && (
                            <motion.span
                              className="flex items-center gap-1 relative z-10 flex-shrink-0"
                              whileHover={{ scale: 1.1 }}
                            >
                              <Lock className={`w-3 h-3 ${
                                proType === 'gold' ? 'text-amber-400' : 'text-purple-400'
                              }`} />
                              <span className={`text-[7px] font-black px-1 py-0.5 rounded ${
                                proType === 'gold'
                                  ? 'bg-gradient-to-r from-amber-500 to-orange-500 text-white'
                                  : 'bg-gradient-to-r from-purple-500 to-pink-500 text-white'
                              }`}>
                                PRO
                              </span>
                            </motion.span>
                          )}
                        </button>

                        {/* Guide Icon "?" for important menu items */}
                        {hasGuide && (sidebarOpen || mobileSidebarOpen) && (
                          <>
                            <button
                              onClick={(e) => { e.stopPropagation(); openGuide(item.id) }}
                              className="absolute top-2 right-2 w-4 h-4 bg-purple-500/20 hover:bg-purple-500/40 rounded-full flex items-center justify-center text-[8px] text-purple-400 hover:text-white transition-colors z-20"
                              title={language === 'id' ? 'Panduan' : 'Guide'}
                            >
                              ?
                            </button>
                            <ContextGuide
                              isOpen={activeGuide === item.id}
                              onClose={closeGuide}
                              title={guideData[item.id].title[language]}
                              description={guideData[item.id].description[language]}
                              tips={guideData[item.id].tips?.[language]}
                              language={language}
                              position="right"
                            />
                          </>
                        )}
                      </div>
                    </motion.div>
                  )
                })}
              </div>
            )
          })}
        </nav>

        {/* Bottom Section */}
        <div className="relative p-3 border-t border-purple-500/20 space-y-2 shrink-0">
          {/* Promo Code Claim Button */}
          {!isPro && (sidebarOpen || mobileSidebarOpen) && (
            <motion.button
              onClick={() => {
                // Open promo code input dialog
                const promoCode = prompt('Masukkan Kode Promo (3 Bulan Gratis):')
                if (promoCode) {
                  // Apply promo code
                  fetch('/api/promo/apply', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ promoCode: promoCode.trim(), plan: 'PRO' })
                  })
                  .then(res => res.json())
                  .then(data => {
                    if (data.success) {
                      toast.success(`🎉 ${data.message}`)
                      refreshProfile()
                      fetchData && fetchData()
                    } else {
                      toast.error(data.message || data.error || 'Kode promo tidak valid')
                    }
                  })
                  .catch(() => toast.error('Gagal mengklaim kode promo'))
                }
              }}
              className="w-full py-2.5 px-3 rounded-xl bg-gradient-to-r from-green-600/20 to-emerald-600/20 text-green-300 border border-green-500/30 hover:from-green-600/30 hover:to-emerald-600/30 transition-all flex items-center justify-center gap-2 text-sm font-semibold shadow-lg shadow-green-500/10 group"
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
            >
              <Gift className="w-4 h-4 flex-shrink-0" />
              <span className="truncate">Claim Promo Code</span>
            </motion.button>
          )}

          {!isPro && (sidebarOpen || mobileSidebarOpen) && (
            <motion.button
              onClick={() => setPlanSelectionModalOpen(true)}
              className="w-full py-2.5 px-3 rounded-xl bg-gradient-to-r from-purple-600 via-violet-600 to-pink-600 text-sm font-bold text-white shadow-lg shadow-purple-500/30 relative overflow-hidden group"
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
            >
              <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent -translate-x-full group-hover:animate-[shimmer_1.5s_infinite]" />
              <span className="relative z-10 flex items-center justify-center gap-2">
                <Zap className="w-4 h-4" />
                Upgrade to Pro
              </span>
            </motion.button>
          )}

          {isPro && (sidebarOpen || mobileSidebarOpen) && (
            <motion.div
              className="flex items-center gap-2 px-3 py-2.5 rounded-xl bg-gradient-to-r from-purple-500/20 via-violet-500/10 to-pink-500/20 border border-purple-500/30 shadow-lg shadow-purple-500/20"
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ duration: 0.3 }}
            >
              <motion.div
                animate={{ rotate: [0, 360] }}
                transition={{ duration: 3, repeat: Infinity, ease: "linear" }}
              >
                <Zap className="w-4 h-4 text-purple-400" />
              </motion.div>
              <span className="text-sm font-bold bg-gradient-to-r from-purple-400 to-pink-400 bg-clip-text text-transparent overflow-hidden whitespace-nowrap">
                ELITE PRO
              </span>
            </motion.div>
          )}

          <Link href="/settings" className="block relative">
            <motion.button
              className="w-full py-2.5 px-3 rounded-xl bg-gradient-to-r from-white/5 to-white/10 text-gray-300 border border-white/10 hover:from-white/10 hover:to-white/15 hover:border-white/20 transition-all flex items-center justify-center gap-2 text-sm font-semibold relative overflow-hidden group"
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
            >
              <motion.div
                className="absolute inset-0 bg-gradient-to-r from-purple-500/10 to-pink-500/10 opacity-0 group-hover:opacity-100 transition-opacity"
              />
              <Settings className="w-4 h-4 relative z-10 group-hover:text-purple-400 transition-colors flex-shrink-0" />
              {(sidebarOpen || mobileSidebarOpen) && <span className="relative z-10 overflow-hidden whitespace-nowrap">Settings</span>}
            </motion.button>
          </Link>

          {(sidebarOpen || mobileSidebarOpen) && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3, delay: 0.1 }}
              className="relative bg-gradient-to-br from-white/5 to-white/[0.02] rounded-xl p-3 border border-white/10 overflow-hidden"
            >
              <div className="absolute top-0 left-0 w-full h-full bg-gradient-to-br from-purple-500/5 to-pink-500/5 opacity-0 hover:opacity-100 transition-opacity" />
              <div className="relative flex items-center gap-3">
                <motion.div
                  className="w-9 h-9 rounded-full bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center text-xs font-bold flex-shrink-0 shadow-lg shadow-purple-500/30"
                  whileHover={{ scale: 1.1, rotate: 5 }}
                  transition={{ type: "spring", stiffness: 300 }}
                >
                  {userInitials}
                </motion.div>
                <div className="min-w-0 flex-1 overflow-hidden">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-semibold truncate text-white">
                      {profile?.full_name || user?.email || 'User'}
                    </span>
                    {isPro ? (
                      <Badge className="bg-gradient-to-r from-purple-500/40 to-pink-500/40 text-white border-purple-500/30 text-[10px] px-1.5 py-0 flex-shrink-0">
                        PRO
                      </Badge>
                    ) : (
                      <Badge className="bg-white/10 text-gray-400 border-white/10 text-[10px] px-1.5 py-0 flex-shrink-0">
                        Free
                      </Badge>
                    )}
                  </div>
                  <Link href="/settings" className="text-xs text-gray-500 hover:text-purple-400 transition-colors">
                    Settings
                  </Link>
                </div>
              </div>
            </motion.div>
          )}

          {isAdmin && (sidebarOpen || mobileSidebarOpen) && (
            <Link href="/admin-secure" className="block">
              <motion.button
                className="w-full py-2 px-3 rounded-xl bg-gradient-to-r from-purple-600/20 to-violet-600/20 text-purple-300 border border-purple-500/30 hover:from-purple-600/30 hover:to-violet-600/30 transition-all flex items-center justify-center gap-2 text-sm font-bold shadow-lg shadow-purple-500/10"
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
              >
                <Shield className="w-4 h-4" />
                <span className="flex items-center gap-1">
                  Admin Panel
                  <Crown className="w-3 h-3 text-purple-400" />
                </span>
              </motion.button>
            </Link>
          )}

          {isFreeUser && (sidebarOpen || mobileSidebarOpen) && (
            <motion.div
              className="flex items-center gap-2 px-3 py-2 rounded-xl bg-gradient-to-r from-amber-500/10 to-orange-500/10 border border-amber-500/20"
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.3 }}
            >
              <AlertCircle className="w-4 h-4 text-amber-400 flex-shrink-0" />
              <span className="text-xs text-amber-300 overflow-hidden whitespace-nowrap">
                {tradeCount}/{FREE_TRADE_LIMIT} trades used
              </span>
            </motion.div>
          )}

          <motion.button
            onClick={() => {
              if (typeof window !== 'undefined' && window.innerWidth < 1024) {
                setMobileSidebarOpen(false)
              }
              setSidebarOpen(!sidebarOpen)
              // Add haptic feedback on mobile
              if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
                navigator.vibrate(10)
              }
            }}
            className="relative w-full flex items-center justify-center p-2.5 text-gray-400 hover:text-white transition-colors rounded-xl hover:bg-white/5 active:bg-white/10 group"
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
          >
            <motion.div
              animate={{ rotate: sidebarOpen ? 180 : 0 }}
              transition={{ duration: 0.3, ease: "easeInOut" }}
            >
              {sidebarOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </motion.div>
          </motion.button>
        </div>
      </aside>

      {/* Delete Account Confirmation Modal */}
      <Dialog open={deleteAccountOpen} onOpenChange={setDeleteAccountOpen}>
        <DialogContent className="bg-[#0f0b18] border-purple-900/30 text-white max-w-md">
          <DialogHeader>
            <DialogTitle className="text-xl flex items-center gap-2 text-red-400">
              <Trash2 className="w-5 h-5" />
              Hapus Akun Trading
            </DialogTitle>
            <DialogDescription className="text-gray-400 mt-2">
              Apakah Anda yakin ingin menghapus akun trading "{accountToDelete?.name}"?
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3 py-4">
            {accountToDelete?.is_default && (
              <div className="bg-amber-500/10 border border-amber-500/20 rounded-lg p-3">
                <p className="text-sm text-amber-300 flex items-start gap-2">
                  <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
                  <span>Ini adalah akun default. Setelah dihapus, akun lain akan otomatis dijadikan default.</span>
                </p>
              </div>
            )}

            <div className="bg-red-500/10 border border-red-500/20 rounded-lg p-3">
              <p className="text-sm text-red-300 flex items-start gap-2">
                <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
                <span>Tindakan ini tidak dapat dibatalkan. Semua data trading yang terkait dengan akun ini akan tetap tersimpan.</span>
              </p>
            </div>

            <div className="text-sm text-gray-400">
              <p>Account: <span className="text-white font-medium">{accountToDelete?.name}</span></p>
              <p>Currency: <span className="text-white font-medium">{accountToDelete?.currency}</span></p>
              <p>Type: <span className="text-white font-medium">{accountToDelete?.account_type}</span></p>
              {accountToDelete?.is_default && (
                <p className="text-amber-400 font-medium">⚠️ Akun Default</p>
              )}
            </div>
          </div>

          <DialogFooter className="gap-2">
            <Button
              variant="outline"
              onClick={() => {
                setDeleteAccountOpen(false)
                setAccountToDelete(null)
              }}
              className="border-gray-600 text-gray-300 hover:bg-gray-700"
            >
              Batal
            </Button>
            <Button
              onClick={handleDeleteAccount}
              disabled={deleting}
              className="bg-red-500 hover:bg-red-600 text-white"
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
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
