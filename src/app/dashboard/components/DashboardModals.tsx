'use client'

import { useState } from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { Share2, Edit, Trash2, Calendar, Clock, Plus, Wallet } from 'lucide-react'
import PNLShareCard from '@/components/PNLShareCard'
import PaymentConfirmationModal from '@/components/PaymentConfirmationModal'
import PlanSelectionModal from '@/components/PlanSelectionModal'
import PaywallModal from '@/components/PaywallModal'
import WelcomeOnboarding from '@/components/WelcomeOnboarding'
import TradeWizardForm from './TradeWizardForm'
import AddAccountForm from './AddAccountForm'
import { formatCurrency } from '@/lib/supabase'
import { Trade, TradeFormData } from '../utils/types'
import { emptyFormData, moodOptions, marketConditions } from '../utils/helpers'

interface DashboardModalsProps {
  // Modal states
  editTradeOpen: boolean
  setEditTradeOpen: (open: boolean) => void
  viewTradeOpen: boolean
  setViewTradeOpen: (open: boolean) => void
  deleteTradeOpen: boolean
  setDeleteTradeOpen: (open: boolean) => void
  shareCardOpen: boolean
  setShareCardOpen: (open: boolean) => void
  addJournalOpen: boolean
  setAddJournalOpen: (open: boolean) => void
  addWatchlistOpen: boolean
  setAddWatchlistOpen: (open: boolean) => void
  planSelectionModalOpen: boolean
  setPlanSelectionModalOpen: (open: boolean) => void
  paymentModalOpen: boolean
  setPaymentModalOpen: (open: boolean) => void
  paymentConfirmationPlanName?: string
  paymentConfirmationPlanPrice?: number
  paywallModalOpen: boolean
  setPaywallModalOpen: (open: boolean) => void
  showOnboarding: boolean
  setShowOnboarding: (show: boolean) => void
  onAddFirstTrade: () => void
  onLoadSampleData: () => void
  addTradeOpen: boolean
  setAddTradeOpen: (open: boolean) => void
  addAccountOpen: boolean
  setAddAccountOpen: (open: boolean) => void

  // Trade-related
  formData: TradeFormData
  selectedTrade: Trade | null
  saving: boolean
  setFormData: (data: TradeFormData) => void
  setSelectedTrade: (trade: Trade | null) => void
  emptyFormData: TradeFormData
  handleFormChange: (field: keyof TradeFormData, value: string) => void
  handleFormTypeChange: (value: string) => void
  handleFormSessionChange: (value: string) => void
  handleNumberInput: (field: keyof TradeFormData, e: React.ChangeEvent<HTMLInputElement>) => void
  handleAddTrade: () => void
  handleEditTrade: () => void
  handleDeleteTrade: () => void
  openEditModal: (trade: Trade) => void
  openDeleteModal: (trade: Trade) => void

  // Journal-related
  journalForm: { title: string; content: string; mood: string; market_condition: string }
  setJournalForm: (form: { title: string; content: string; mood: string; market_condition: string }) => void
  handleAddJournal: () => void

  // Watchlist-related
  watchlistForm: { symbol: string; name: string; target_price: string; notes: string }
  setWatchlistForm: (form: { symbol: string; name: string; target_price: string; notes: string }) => void
  handleAddWatchlist: () => void

  // User & Plan
  user: any
  handleSelectPlan: (plan: any) => void
  handlePaymentSuccess?: () => void
  proTrialCount: number
  language: 'id' | 'en'
  tradingAccounts?: any[]
  fetchData?: () => void
}

export default function DashboardModals({
  // Modal states
  editTradeOpen,
  setEditTradeOpen,
  viewTradeOpen,
  setViewTradeOpen,
  deleteTradeOpen,
  setDeleteTradeOpen,
  shareCardOpen,
  setShareCardOpen,
  addJournalOpen,
  setAddJournalOpen,
  addWatchlistOpen,
  setAddWatchlistOpen,
  planSelectionModalOpen,
  setPlanSelectionModalOpen,
  paymentModalOpen,
  setPaymentModalOpen,
  paywallModalOpen,
  setPaywallModalOpen,
  handlePaymentSuccess,
  paymentConfirmationPlanName,
  paymentConfirmationPlanPrice,
  showOnboarding,
  setShowOnboarding,
  onAddFirstTrade,
  onLoadSampleData,
  addTradeOpen,
  setAddTradeOpen,
  addAccountOpen,
  setAddAccountOpen,

  // Trade-related
  formData,
  selectedTrade,
  saving,
  setFormData,
  setSelectedTrade,
  emptyFormData,
  handleFormChange,
  handleFormTypeChange,
  handleFormSessionChange,
  handleNumberInput,
  handleAddTrade,
  handleEditTrade,
  handleDeleteTrade,
  openEditModal,
  openDeleteModal,

  // Journal-related
  journalForm,
  setJournalForm,
  handleAddJournal,

  // Watchlist-related
  watchlistForm,
  setWatchlistForm,
  handleAddWatchlist,

  // User & Plan
  user,
  handleSelectPlan,
  proTrialCount,
  language,
  tradingAccounts = [],
  fetchData = () => {}
}: DashboardModalsProps) {
  return (
    <>
      {/* Edit Trade Modal */}
      <Dialog open={editTradeOpen} onOpenChange={(open) => {
        setEditTradeOpen(open)
        if (!open) {
          setSelectedTrade(null)
          setFormData(emptyFormData)
        }
      }}>
        <DialogContent className="bg-lux-bg-card dark:bg-[#0f0b18] border-lux-border dark:border-purple-900/30 text-lux-text-primary dark:text-white max-w-lg max-h-[90vh] overflow-hidden flex flex-col">
          <DialogHeader className="shrink-0">
            <DialogTitle className="text-xl flex items-center gap-2">
              <Edit className="w-5 h-5 text-purple-500 dark:text-purple-400" />
              Edit Trade
            </DialogTitle>
          </DialogHeader>
          <div className="overflow-y-auto flex-1 -mx-1 px-1">
            <TradeWizardForm
              formData={formData}
              onFormChange={handleFormChange}
              onTypeChange={handleFormTypeChange}
              onSessionChange={handleFormSessionChange}
              onNumberInput={handleNumberInput}
              onSave={handleEditTrade}
              onCancel={() => { setEditTradeOpen(false); setSelectedTrade(null); setFormData(emptyFormData) }}
              isEdit
              saving={saving}
              tradingAccounts={tradingAccounts}
            />
          </div>
        </DialogContent>
      </Dialog>

      {/* View Trade Modal */}
      <Dialog open={viewTradeOpen} onOpenChange={(open) => {
        setViewTradeOpen(open)
        if (!open) setSelectedTrade(null)
      }}>
        <DialogContent className="bg-lux-bg-card dark:bg-[#0f0b18] border-lux-border dark:border-purple-900/30 text-lux-text-primary dark:text-white max-w-md">
          <DialogHeader><DialogTitle className="text-xl">Trade Details</DialogTitle></DialogHeader>
          {selectedTrade && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <span className="text-2xl font-bold">{selectedTrade.symbol}</span>
                  <Badge variant={selectedTrade.type === 'BUY' ? 'default' : 'destructive'}>
                    {selectedTrade.type}
                  </Badge>
                </div>
                <span className={`text-xl font-bold ${selectedTrade.profit_loss >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                  {selectedTrade.profit_loss >= 0 ? '+' : ''}{formatCurrency(selectedTrade.profit_loss)}
                </span>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="p-3 rounded-lg bg-lux-surface-hover dark:bg-white/5">
                  <div className="text-xs text-lux-text-secondary dark:text-gray-400">Open Price</div>
                  <div className="font-bold">{selectedTrade.open_price}</div>
                </div>
                <div className="p-3 rounded-lg bg-lux-surface-hover dark:bg-white/5">
                  <div className="text-xs text-lux-text-secondary dark:text-gray-400">Close Price</div>
                  <div className="font-bold">{selectedTrade.close_price}</div>
                </div>
                <div className="p-3 rounded-lg bg-lux-surface-hover dark:bg-white/5">
                  <div className="text-xs text-lux-text-secondary dark:text-gray-400">Lot Size</div>
                  <div className="font-bold">{selectedTrade.lot_size}</div>
                </div>
                <div className="p-3 rounded-lg bg-lux-surface-hover dark:bg-white/5">
                  <div className="text-xs text-lux-text-secondary dark:text-gray-400">Session</div>
                  <div className="font-bold">{selectedTrade.session || '-'}</div>
                </div>
              </div>

              {selectedTrade.notes && (
                <div className="p-3 rounded-lg bg-lux-surface-hover dark:bg-white/5">
                  <div className="text-xs text-lux-text-secondary dark:text-gray-400 mb-1">Notes</div>
                  <div className="text-sm">{selectedTrade.notes}</div>
                </div>
              )}

              <div className="grid grid-cols-2 gap-4">
                <div className="p-3 rounded-lg bg-lux-surface-hover dark:bg-white/5 flex items-center gap-2">
                  <Calendar className="w-4 h-4 text-lux-text-secondary dark:text-gray-400" />
                  <div>
                    <div className="text-xs text-lux-text-secondary dark:text-gray-400">Open Time</div>
                    <div className="text-sm">{new Date(selectedTrade.open_time).toLocaleString()}</div>
                  </div>
                </div>
                <div className="p-3 rounded-lg bg-lux-surface-hover dark:bg-white/5 flex items-center gap-2">
                  <Clock className="w-4 h-4 text-lux-text-secondary dark:text-gray-400" />
                  <div>
                    <div className="text-xs text-lux-text-secondary dark:text-gray-400">Close Time</div>
                    <div className="text-sm">{new Date(selectedTrade.close_time).toLocaleString()}</div>
                  </div>
                </div>
              </div>

              <div className="flex gap-3 pt-2">
                <Button
                  onClick={() => {
                    setViewTradeOpen(false)
                    setShareCardOpen(true)
                  }}
                  variant="outline"
                  className="border-purple-500/30 text-purple-400"
                >
                  <Share2 className="w-4 h-4 mr-2" /> Share
                </Button>
                <Button
                  onClick={() => {
                    setViewTradeOpen(false)
                    openEditModal(selectedTrade)
                  }}
                  className="flex-1 bg-gradient-to-r from-purple-500 to-violet-600"
                >
                  <Edit className="w-4 h-4 mr-2" /> Edit
                </Button>
                <Button
                  variant="destructive"
                  onClick={() => {
                    setViewTradeOpen(false)
                    openDeleteModal(selectedTrade)
                  }}
                >
                  <Trash2 className="w-4 h-4" />
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Share Card Modal */}
      <Dialog open={shareCardOpen} onOpenChange={(open) => {
        setShareCardOpen(open)
        if (!open) setSelectedTrade(null)
      }}>
        <DialogContent className="bg-lux-bg-card dark:bg-[#0f0b18] border-lux-border dark:border-purple-900/30 text-lux-text-primary dark:text-white max-w-lg">
          <DialogHeader>
            <DialogTitle className="text-xl flex items-center gap-2">
              <Share2 className="w-5 h-5 text-purple-500 dark:text-purple-400" />
              Share Trade Card
            </DialogTitle>
          </DialogHeader>
          {selectedTrade && (
            <div className="flex flex-col items-center gap-4">
              <PNLShareCard
                symbol={selectedTrade.symbol}
                type={selectedTrade.type}
                entryPrice={selectedTrade.open_price}
                exitPrice={selectedTrade.close_price}
                lotSize={selectedTrade.lot_size}
                profitLoss={selectedTrade.profit_loss}
                session={selectedTrade.session || 'Unknown'}
                date={new Date(selectedTrade.close_time).toLocaleDateString('en-US', {
                  weekday: 'short',
                  day: 'numeric',
                  month: 'short',
                  year: 'numeric'
                })}
              />
              <p className="text-xs text-lux-text-muted dark:text-gray-500 text-center">
                Take a screenshot to share your trade on social media
              </p>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Modal */}
      <Dialog open={deleteTradeOpen} onOpenChange={(open) => {
        setDeleteTradeOpen(open)
        if (!open) setSelectedTrade(null)
      }}>
        <DialogContent className="bg-lux-bg-card dark:bg-[#0f0b18] border-lux-border dark:border-purple-900/30 text-lux-text-primary dark:text-white max-w-sm">
          <DialogHeader><DialogTitle className="text-xl text-red-500 dark:text-red-400">Delete Trade?</DialogTitle></DialogHeader>
          {selectedTrade && (
            <div className="space-y-4">
              <p className="text-lux-text-secondary dark:text-gray-400">
                Are you sure you want to delete this trade?
              </p>
              <div className="p-3 rounded-lg bg-lux-surface-hover dark:bg-white/5 flex items-center justify-between">
                <div>
                  <span className="font-bold">{selectedTrade.symbol}</span>
                  <Badge variant={selectedTrade.type === 'BUY' ? 'default' : 'destructive'} className="ml-2">
                    {selectedTrade.type}
                  </Badge>
                </div>
                <span className={`font-bold ${selectedTrade.profit_loss >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                  {selectedTrade.profit_loss >= 0 ? '+' : ''}{formatCurrency(selectedTrade.profit_loss)}
                </span>
              </div>
              <div className="flex gap-3">
                <Button
                  variant="destructive"
                  onClick={handleDeleteTrade}
                  disabled={saving}
                  className="flex-1"
                >
                  {saving ? 'Deleting...' : 'Delete'}
                </Button>
                <Button
                  variant="outline"
                  onClick={() => {
                    setDeleteTradeOpen(false)
                    setSelectedTrade(null)
                  }}
                  className="flex-1 border-purple-900/30"
                >
                  Cancel
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Add Journal Modal */}
      <Dialog open={addJournalOpen} onOpenChange={(open) => {
        setAddJournalOpen(open)
        if (!open) setJournalForm({ title: '', content: '', mood: '', market_condition: '' })
      }}>
        <DialogContent className="bg-lux-bg-card dark:bg-[#0f0b18] border-lux-border dark:border-purple-900/30 text-lux-text-primary dark:text-white max-w-lg">
          <DialogHeader><DialogTitle className="text-xl">New Journal Entry</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Title *</Label>
              <Input
                placeholder="Market Recap - Monday"
                className="bg-lux-input-bg dark:bg-[#0a0712] border-lux-input-border dark:border-purple-900/30 mt-1"
                value={journalForm.title}
                onChange={(e) => setJournalForm({ ...journalForm, title: e.target.value })}
              />
            </div>
            <div>
              <Label>Content *</Label>
              <Textarea
                placeholder="Write your thoughts about today's trading session..."
                className="bg-lux-input-bg dark:bg-[#0a0712] border-lux-input-border dark:border-purple-900/30 mt-1 resize-none"
                rows={5}
                value={journalForm.content}
                onChange={(e) => setJournalForm({ ...journalForm, content: e.target.value })}
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Mood</Label>
                <Select value={journalForm.mood} onValueChange={(v) => setJournalForm({ ...journalForm, mood: v })}>
                  <SelectTrigger className="bg-lux-input-bg dark:bg-[#0a0712] border-lux-input-border dark:border-purple-900/30 mt-1">
                    <SelectValue placeholder="How do you feel?" />
                  </SelectTrigger>
                  <SelectContent className="bg-lux-bg-card dark:bg-[#0f0b18] border-lux-border dark:border-purple-900/30">
                    {moodOptions.map(opt => (
                      <SelectItem key={opt.value} value={opt.value}>
                        <span className={opt.color}>{opt.label}</span>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Market Condition</Label>
                <Select value={journalForm.market_condition} onValueChange={(v) => setJournalForm({ ...journalForm, market_condition: v })}>
                  <SelectTrigger className="bg-lux-input-bg dark:bg-[#0a0712] border-lux-input-border dark:border-purple-900/30 mt-1">
                    <SelectValue placeholder="Market state" />
                  </SelectTrigger>
                  <SelectContent className="bg-lux-bg-card dark:bg-[#0f0b18] border-lux-border dark:border-purple-900/30">
                    {marketConditions.map(opt => (
                      <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="flex gap-3 pt-2">
              <Button
                onClick={handleAddJournal}
                disabled={saving}
                className="flex-1 bg-gradient-to-r from-purple-500 to-violet-600"
              >
                {saving ? 'Saving...' : 'Save Entry'}
              </Button>
              <Button
                variant="outline"
                onClick={() => setAddJournalOpen(false)}
                className="border-purple-900/30"
              >
                Cancel
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Add Watchlist Modal */}
      <Dialog open={addWatchlistOpen} onOpenChange={(open) => {
        setAddWatchlistOpen(open)
        if (!open) setWatchlistForm({ symbol: '', name: '', target_price: '', notes: '' })
      }}>
        <DialogContent className="bg-lux-bg-card dark:bg-[#0f0b18] border-lux-border dark:border-purple-900/30 text-lux-text-primary dark:text-white max-w-md">
          <DialogHeader><DialogTitle className="text-xl">Add to Watchlist</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Symbol *</Label>
                <Input
                  placeholder="EURUSD"
                  className="bg-lux-input-bg dark:bg-[#0a0712] border-lux-input-border dark:border-purple-900/30 mt-1"
                  value={watchlistForm.symbol}
                  onChange={(e) => setWatchlistForm({ ...watchlistForm, symbol: e.target.value.toUpperCase() })}
                />
              </div>
              <div>
                <Label>Name</Label>
                <Input
                  placeholder="Euro/USD"
                  className="bg-lux-input-bg dark:bg-[#0a0712] border-lux-input-border dark:border-purple-900/30 mt-1"
                  value={watchlistForm.name}
                  onChange={(e) => setWatchlistForm({ ...watchlistForm, name: e.target.value })}
                />
              </div>
            </div>
            <div>
              <Label>Target Price</Label>
              <Input
                type="text"
                inputMode="decimal"
                placeholder="1.0950"
                className="bg-lux-input-bg dark:bg-[#0a0712] border-lux-input-border dark:border-purple-900/30 mt-1"
                value={watchlistForm.target_price}
                onChange={(e) => setWatchlistForm({ ...watchlistForm, target_price: e.target.value })}
              />
            </div>
            <div>
              <Label>Notes</Label>
              <Textarea
                placeholder="Why watching this pair..."
                className="bg-lux-input-bg dark:bg-[#0a0712] border-lux-input-border dark:border-purple-900/30 mt-1 resize-none"
                rows={3}
                value={watchlistForm.notes}
                onChange={(e) => setWatchlistForm({ ...watchlistForm, notes: e.target.value })}
              />
            </div>
            <div className="flex gap-3 pt-2">
              <Button
                onClick={handleAddWatchlist}
                disabled={saving}
                className="flex-1 bg-gradient-to-r from-emerald-500 to-teal-600"
              >
                {saving ? 'Adding...' : 'Add to Watchlist'}
              </Button>
              <Button
                variant="outline"
                onClick={() => setAddWatchlistOpen(false)}
                className="border-purple-900/30"
              >
                Cancel
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <PlanSelectionModal
        isOpen={planSelectionModalOpen}
        onClose={() => setPlanSelectionModalOpen(false)}
        onSelectPlan={handleSelectPlan}
        onPaymentSuccess={handlePaymentSuccess}
      />

      <PaymentConfirmationModal
        isOpen={paymentModalOpen}
        onClose={() => setPaymentModalOpen(false)}
        planName={paymentConfirmationPlanName}
        planPrice={paymentConfirmationPlanPrice}
      />

      {/* Add Trade Modal */}
      <Dialog open={addTradeOpen} onOpenChange={(open) => {
        setAddTradeOpen(open)
        if (!open) setFormData(emptyFormData)
      }}>
        <DialogContent className="bg-lux-bg-card dark:bg-[#0f0b18] border-lux-border dark:border-purple-900/30 text-lux-text-primary dark:text-white max-w-lg max-h-[90vh] overflow-hidden flex flex-col">
          <DialogHeader className="shrink-0">
            <DialogTitle className="text-xl flex items-center gap-2">
              <Plus className="w-5 h-5 text-purple-500 dark:text-purple-400" />
              {language === 'id' ? 'Tambah Trade Baru' : 'Add New Trade'}
            </DialogTitle>
          </DialogHeader>
          <div className="overflow-y-auto flex-1 -mx-1 px-1">
            <TradeWizardForm
              formData={formData}
              onFormChange={handleFormChange}
              onTypeChange={handleFormTypeChange}
              onSessionChange={handleFormSessionChange}
              onNumberInput={handleNumberInput}
              onSave={handleAddTrade}
              onCancel={() => { setAddTradeOpen(false); setFormData(emptyFormData) }}
              onAutoJournalSuccess={() => { setAddTradeOpen(false); setFormData(emptyFormData); fetchData() }}
              saving={saving}
              tradingAccounts={tradingAccounts}
            />
          </div>
        </DialogContent>
      </Dialog>

      {/* Add Account Modal */}
      <AddAccountForm
        open={addAccountOpen}
        onOpenChange={setAddAccountOpen}
        onSuccess={() => {
          // Refresh data after adding account
          if (fetchData) fetchData()
        }}
      />

      {/* Paywall Modal for PRO Features - DISABLED */}
      {/* <PaywallModal
        isOpen={paywallModalOpen}
        onClose={() => setPaywallModalOpen(false)}
        onUpgrade={() => {
          setPaywallModalOpen(false)
          setPlanSelectionModalOpen(true)
        }}
        remainingTrials={proTrialCount}
      /> */}

      <WelcomeOnboarding
        isOpen={showOnboarding}
        onClose={() => setShowOnboarding(false)}
        onAddFirstTrade={onAddFirstTrade}
        onLoadSampleData={onLoadSampleData}
        onUpgrade={() => setPlanSelectionModalOpen(true)}
        language={language}
      />
    </>
  )
}