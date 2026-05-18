'use client'

import { motion } from 'framer-motion'
import { Menu, RefreshCw, Upload, Plus, LogOut } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import NotificationCenter from '@/components/NotificationCenter'
import TradeForm from './TradeForm'
import LanguageSwitcher from '@/components/LanguageSwitcher'

interface HeaderProps {
  sidebarOpen: boolean
  setMobileSidebarOpen: (open: boolean) => void
  activeTab: string
  menuItems: any[]
  loading: boolean
  fetchData: () => void
  trades: any[]
  isPro: boolean
  formData: any
  handleFormChange: (field: any, value: string) => void
  handleFormTypeChange: (value: string) => void
  handleFormSessionChange: (value: string) => void
  handleNumberInput: (field: any, e: React.ChangeEvent<HTMLInputElement>) => void
  handleAddTrade: () => void
  setAddTradeOpen: (open: boolean) => void
  addTradeOpen: boolean
  saving: boolean
  setFormData: (data: any) => void
  emptyFormData: any
  setSmartImportOpen: (open: boolean) => void
  user: any
  handleSignOut: () => void
  userInitials: string
}

export default function Header({
  sidebarOpen,
  setMobileSidebarOpen,
  activeTab,
  menuItems,
  loading,
  fetchData,
  trades,
  isPro,
  formData,
  handleFormChange,
  handleFormTypeChange,
  handleFormSessionChange,
  handleNumberInput,
  handleAddTrade,
  setAddTradeOpen,
  addTradeOpen,
  saving,
  setFormData,
  emptyFormData,
  setSmartImportOpen,
  user,
  handleSignOut,
  userInitials
}: HeaderProps) {
  return (
    <header className="h-16 border-b border-purple-900/30 flex items-center justify-between px-4 lg:px-6 bg-[#0f0b18]/90 backdrop-blur-md sticky top-0 z-30">
      <div className="flex items-center gap-3">
        <button 
          onClick={() => setMobileSidebarOpen(true)}
          className="lg:hidden p-2 text-gray-400 hover:text-white transition-colors"
        >
          <Menu className="w-5 h-5" />
        </button>
        <h2 className="text-lg font-semibold">
          {menuItems.find(m => m.id === activeTab)?.label || 'Dashboard'}
        </h2>
        <button 
          onClick={fetchData}
          className="p-2 text-gray-400 hover:text-purple-400 transition-colors"
          title="Refresh data"
        >
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
        </button>
      </div>
      
      <div className="flex items-center gap-2 lg:gap-3">
        <LanguageSwitcher />
        <NotificationCenter trades={trades} isPro={isPro} />
        
        <div className="hidden sm:flex items-center gap-2 px-3 py-1.5 rounded-full bg-emerald-500/10 border border-emerald-500/20">
          <motion.div
            className="w-2 h-2 rounded-full bg-emerald-400"
            animate={{ scale: [1, 1.2, 1], opacity: [1, 0.7, 1] }}
            transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
          />
          <span className="text-xs text-emerald-400">Connected</span>
        </div>
        
        <button
          onClick={() => setSmartImportOpen(true)}
          className="hidden sm:flex px-3 lg:px-4 py-2 rounded-lg bg-gradient-to-r from-purple-500/20 to-violet-500/20 text-purple-400 border border-purple-500/30 hover:from-purple-500/30 hover:to-violet-500/30 transition-all text-sm font-medium items-center gap-2"
        >
          <Upload className="w-4 h-4" />
          <span className="hidden lg:inline">Smart Import</span>
        </button>

        <Dialog open={addTradeOpen} onOpenChange={(open) => {
          setAddTradeOpen(open)
          if (!open) setFormData(emptyFormData)
        }}>
          <DialogTrigger asChild>
            <Button className="bg-gradient-to-r from-purple-500 to-violet-600 hover:from-purple-600 hover:to-violet-700 shadow-lg shadow-purple-500/20">
              <Plus className="w-4 h-4 mr-0 lg:mr-2" />
              <span className="hidden lg:inline">New Trade</span>
            </Button>
          </DialogTrigger>
          <DialogContent className="bg-[#0f0b18] border-purple-900/30 text-white max-w-md">
            <DialogHeader><DialogTitle className="text-xl">Add New Trade</DialogTitle></DialogHeader>
            <TradeForm 
              formData={formData}
              onFormChange={handleFormChange}
              onTypeChange={handleFormTypeChange}
              onSessionChange={handleFormSessionChange}
              onNumberInput={handleNumberInput}
              onSave={handleAddTrade}
              onCancel={() => { setAddTradeOpen(false); setFormData(emptyFormData) }}
              saving={saving}
            />
          </DialogContent>
        </Dialog>
        
        {user && (
          <button
            onClick={handleSignOut}
            className="p-2 text-gray-400 hover:text-white transition-colors"
            title="Sign out"
          >
            <LogOut className="w-5 h-5" />
          </button>
        )}
        
        <div className="w-9 h-9 rounded-full bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center text-sm font-bold" title={user?.email || 'User'}>
          {userInitials}
        </div>
      </div>
    </header>
  )
}
