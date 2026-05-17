'use client'

import { useState } from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { Upload, Share2, Edit, Trash2, Calendar, Clock, Camera, FileText, Sparkles, Loader2 } from 'lucide-react'
import { motion } from 'framer-motion'
import PNLShareCard from '@/components/PNLShareCard'
import PaymentModal from '@/components/PaymentModal'
import PlanSelectionModal from '@/components/PlanSelectionModal'
import PaywallModal from '@/components/PaywallModal'
import WelcomeOnboarding from '@/components/WelcomeOnboarding'
import TradeForm from './TradeForm'
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
  csvImportOpen: boolean
  setCsvImportOpen: (open: boolean) => void
  smartImportOpen: boolean
  setSmartImportOpen: (open: boolean) => void
  planSelectionModalOpen: boolean
  setPlanSelectionModalOpen: (open: boolean) => void
  paymentModalOpen: boolean
  setPaymentModalOpen: (open: boolean) => void
  paywallModalOpen: boolean
  setPaywallModalOpen: (open: boolean) => void
  showOnboarding: boolean
  setShowOnboarding: (show: boolean) => void

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

  // CSV Import-related
  csvFile: File | null
  csvPreview: Trade[]
  csvImporting: boolean
  setCsvFile: (file: File | null) => void
  setCsvPreview: (trades: Trade[]) => void
  handleCsvFileChange: (e: React.ChangeEvent<HTMLInputElement>) => void
  handleCsvImport: () => void

  // Smart Import-related
  importTab: 'screenshot' | 'file'
  setImportTab: (tab: 'screenshot' | 'file') => void
  screenshotPreview: string | null
  importedTrades: Trade[]
  importParsing: boolean
  setScreenshotPreview: (preview: string | null) => void
  setImportedTrades: (trades: Trade[]) => void
  handleScreenshotUpload: (e: React.ChangeEvent<HTMLInputElement>) => void
  handleFileUpload: (e: React.ChangeEvent<HTMLInputElement>) => void
  handleSaveImportedTrades: () => void
  updateImportedTrade: (index: number, field: keyof Trade, value: string | number) => void
  removeImportedTrade: (index: number) => void

  // User & Plan
  user: any
  handleSelectPlan: (plan: any) => void
  proTrialCount: number
  language: 'id' | 'en'
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
  csvImportOpen,
  setCsvImportOpen,
  smartImportOpen,
  setSmartImportOpen,
  planSelectionModalOpen,
  setPlanSelectionModalOpen,
  paymentModalOpen,
  setPaymentModalOpen,
  paywallModalOpen,
  setPaywallModalOpen,
  showOnboarding,
  setShowOnboarding,

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

  // CSV Import-related
  csvFile,
  csvPreview,
  csvImporting,
  setCsvFile,
  setCsvPreview,
  handleCsvFileChange,
  handleCsvImport,

  // Smart Import-related
  importTab,
  setImportTab,
  screenshotPreview,
  importedTrades,
  importParsing,
  setScreenshotPreview,
  setImportedTrades,
  handleScreenshotUpload,
  handleFileUpload,
  handleSaveImportedTrades,
  updateImportedTrade,
  removeImportedTrade,

  // User & Plan
  user,
  handleSelectPlan,
  proTrialCount,
  language,
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
        <DialogContent className="bg-[#0f0b18] border-purple-900/30 text-white max-w-md">
          <DialogHeader><DialogTitle className="text-xl">Edit Trade</DialogTitle></DialogHeader>
          <TradeForm
            formData={formData}
            onFormChange={handleFormChange}
            onTypeChange={handleFormTypeChange}
            onSessionChange={handleFormSessionChange}
            onNumberInput={handleNumberInput}
            onSave={handleEditTrade}
            onCancel={() => { setEditTradeOpen(false); setSelectedTrade(null); setFormData(emptyFormData) }}
            isEdit
            saving={saving}
          />
        </DialogContent>
      </Dialog>

      {/* View Trade Modal */}
      <Dialog open={viewTradeOpen} onOpenChange={(open) => {
        setViewTradeOpen(open)
        if (!open) setSelectedTrade(null)
      }}>
        <DialogContent className="bg-[#0f0b18] border-purple-900/30 text-white max-w-md">
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
                <div className="p-3 rounded-lg bg-white/5">
                  <div className="text-xs text-gray-400">Open Price</div>
                  <div className="font-bold">{selectedTrade.open_price}</div>
                </div>
                <div className="p-3 rounded-lg bg-white/5">
                  <div className="text-xs text-gray-400">Close Price</div>
                  <div className="font-bold">{selectedTrade.close_price}</div>
                </div>
                <div className="p-3 rounded-lg bg-white/5">
                  <div className="text-xs text-gray-400">Lot Size</div>
                  <div className="font-bold">{selectedTrade.lot_size}</div>
                </div>
                <div className="p-3 rounded-lg bg-white/5">
                  <div className="text-xs text-gray-400">Session</div>
                  <div className="font-bold">{selectedTrade.session || '-'}</div>
                </div>
              </div>

              {selectedTrade.notes && (
                <div className="p-3 rounded-lg bg-white/5">
                  <div className="text-xs text-gray-400 mb-1">Notes</div>
                  <div className="text-sm">{selectedTrade.notes}</div>
                </div>
              )}

              <div className="grid grid-cols-2 gap-4">
                <div className="p-3 rounded-lg bg-white/5 flex items-center gap-2">
                  <Calendar className="w-4 h-4 text-gray-400" />
                  <div>
                    <div className="text-xs text-gray-400">Open Time</div>
                    <div className="text-sm">{new Date(selectedTrade.open_time).toLocaleString()}</div>
                  </div>
                </div>
                <div className="p-3 rounded-lg bg-white/5 flex items-center gap-2">
                  <Clock className="w-4 h-4 text-gray-400" />
                  <div>
                    <div className="text-xs text-gray-400">Close Time</div>
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
        <DialogContent className="bg-[#0f0b18] border-purple-900/30 text-white max-w-lg">
          <DialogHeader>
            <DialogTitle className="text-xl flex items-center gap-2">
              <Share2 className="w-5 h-5 text-purple-400" />
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
              <p className="text-xs text-gray-500 text-center">
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
        <DialogContent className="bg-[#0f0b18] border-purple-900/30 text-white max-w-sm">
          <DialogHeader><DialogTitle className="text-xl text-red-400">Delete Trade?</DialogTitle></DialogHeader>
          {selectedTrade && (
            <div className="space-y-4">
              <p className="text-gray-400">
                Are you sure you want to delete this trade?
              </p>
              <div className="p-3 rounded-lg bg-white/5 flex items-center justify-between">
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
        <DialogContent className="bg-[#0f0b18] border-purple-900/30 text-white max-w-lg">
          <DialogHeader><DialogTitle className="text-xl">New Journal Entry</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Title *</Label>
              <Input
                placeholder="Market Recap - Monday"
                className="bg-[#0a0712] border-purple-900/30 mt-1"
                value={journalForm.title}
                onChange={(e) => setJournalForm({ ...journalForm, title: e.target.value })}
              />
            </div>
            <div>
              <Label>Content *</Label>
              <Textarea
                placeholder="Write your thoughts about today's trading session..."
                className="bg-[#0a0712] border-purple-900/30 mt-1 resize-none"
                rows={5}
                value={journalForm.content}
                onChange={(e) => setJournalForm({ ...journalForm, content: e.target.value })}
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Mood</Label>
                <Select value={journalForm.mood} onValueChange={(v) => setJournalForm({ ...journalForm, mood: v })}>
                  <SelectTrigger className="bg-[#0a0712] border-purple-900/30 mt-1">
                    <SelectValue placeholder="How do you feel?" />
                  </SelectTrigger>
                  <SelectContent className="bg-[#0f0b18] border-purple-900/30">
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
                  <SelectTrigger className="bg-[#0a0712] border-purple-900/30 mt-1">
                    <SelectValue placeholder="Market state" />
                  </SelectTrigger>
                  <SelectContent className="bg-[#0f0b18] border-purple-900/30">
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
        <DialogContent className="bg-[#0f0b18] border-purple-900/30 text-white max-w-md">
          <DialogHeader><DialogTitle className="text-xl">Add to Watchlist</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Symbol *</Label>
                <Input
                  placeholder="EURUSD"
                  className="bg-[#0a0712] border-purple-900/30 mt-1"
                  value={watchlistForm.symbol}
                  onChange={(e) => setWatchlistForm({ ...watchlistForm, symbol: e.target.value.toUpperCase() })}
                />
              </div>
              <div>
                <Label>Name</Label>
                <Input
                  placeholder="Euro/USD"
                  className="bg-[#0a0712] border-purple-900/30 mt-1"
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
                className="bg-[#0a0712] border-purple-900/30 mt-1"
                value={watchlistForm.target_price}
                onChange={(e) => setWatchlistForm({ ...watchlistForm, target_price: e.target.value })}
              />
            </div>
            <div>
              <Label>Notes</Label>
              <Textarea
                placeholder="Why watching this pair..."
                className="bg-[#0a0712] border-purple-900/30 mt-1 resize-none"
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

      {/* CSV Import Modal */}
      <Dialog open={csvImportOpen} onOpenChange={(open) => {
        setCsvImportOpen(open)
        if (!open) {
          setCsvFile(null)
          setCsvPreview([])
        }
      }}>
        <DialogContent className="bg-[#0f0b18] border-purple-900/30 text-white max-w-2xl">
          <DialogHeader><DialogTitle className="text-xl">Import Trades from CSV</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div className="border-2 border-dashed border-purple-900/30 rounded-xl p-8 text-center">
              <Upload className="w-12 h-12 mx-auto mb-4 text-gray-500" />
              <p className="text-gray-400 mb-4">Upload a CSV file with your trades</p>
              <Input
                type="file"
                accept=".csv"
                onChange={handleCsvFileChange}
                className="max-w-sm mx-auto"
              />
              <p className="text-xs text-gray-500 mt-4">
                Supported columns: symbol, type, open_price, close_price, profit_loss, lot_size, session
              </p>
            </div>

            {csvPreview.length > 0 && (
              <div>
                <div className="flex items-center justify-between mb-2">
                  <p className="text-sm text-gray-400">Preview ({csvPreview.length} trades)</p>
                  <Badge variant="outline" className="border-purple-500/30 text-purple-400">
                    {csvPreview.filter(t => t.profit_loss > 0).length} wins / {csvPreview.filter(t => t.profit_loss < 0).length} losses
                  </Badge>
                </div>
                <div className="max-h-60 overflow-y-auto rounded-lg bg-white/5 p-2">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="text-gray-400 border-b border-purple-900/30">
                        <th className="text-left p-2">Symbol</th>
                        <th className="text-left p-2">Type</th>
                        <th className="text-right p-2">P/L</th>
                      </tr>
                    </thead>
                    <tbody>
                      {csvPreview.slice(0, 10).map((trade, i) => (
                        <tr key={i} className="border-b border-purple-900/20">
                          <td className="p-2 font-bold">{trade.symbol}</td>
                          <td className="p-2">
                            <Badge variant={trade.type === 'BUY' ? 'default' : 'destructive'} className="text-xs">
                              {trade.type}
                            </Badge>
                          </td>
                          <td className={`p-2 text-right font-bold ${trade.profit_loss >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                            {trade.profit_loss >= 0 ? '+' : ''}{formatCurrency(trade.profit_loss)}
                          </td>
                        </tr>
                      ))}
                      {csvPreview.length > 10 && (
                        <tr><td colSpan={3} className="p-2 text-center text-gray-500">...and {csvPreview.length - 10} more</td></tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            <div className="flex gap-3 pt-2">
              <Button
                onClick={handleCsvImport}
                disabled={csvImporting || csvPreview.length === 0}
                className="flex-1 bg-gradient-to-r from-purple-500 to-violet-600"
              >
                {csvImporting ? 'Importing...' : `Import ${csvPreview.length} Trades`}
              </Button>
              <Button
                variant="outline"
                onClick={() => setCsvImportOpen(false)}
                className="border-purple-900/30"
              >
                Cancel
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Smart Import Modal - Universal Trade Importer */}
      <Dialog open={smartImportOpen} onOpenChange={(open) => {
        setSmartImportOpen(open)
        if (!open) {
          setImportedTrades([])
          setScreenshotPreview(null)
          setImportTab('screenshot')
        }
      }}>
        <DialogContent className="bg-[#0f0b18] border-purple-900/30 text-white max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-xl flex items-center gap-2">
              <Upload className="w-5 h-5 text-purple-400" />
              Universal Trade Importer
            </DialogTitle>
            <p className="text-sm text-gray-400">Import trades from MT5 screenshots or report files</p>
          </DialogHeader>

          {/* Tab Switcher */}
          <div className="flex bg-white/5 rounded-lg p-1 mb-4">
            <button
              onClick={() => setImportTab('screenshot')}
              className={`flex-1 flex items-center justify-center gap-2 py-2.5 px-4 rounded-md text-sm font-medium transition-all ${
                importTab === 'screenshot'
                  ? 'bg-gradient-to-r from-purple-500 to-violet-600 text-white shadow-lg'
                  : 'text-gray-400 hover:text-white'
              }`}
            >
              <Camera className="w-4 h-4" />
              Screenshot OCR
            </button>
            <button
              onClick={() => setImportTab('file')}
              className={`flex-1 flex items-center justify-center gap-2 py-2.5 px-4 rounded-md text-sm font-medium transition-all ${
                importTab === 'file'
                  ? 'bg-gradient-to-r from-purple-500 to-violet-600 text-white shadow-lg'
                  : 'text-gray-400 hover:text-white'
              }`}
            >
              <FileText className="w-4 h-4" />
              Upload File
            </button>
          </div>

          <div className="space-y-4">
            {/* TAB 1: Screenshot OCR */}
            {importTab === 'screenshot' && (
              <div className="space-y-4">
                <div className="border-2 border-dashed border-purple-900/30 rounded-xl p-6 text-center hover:border-purple-500/50 transition-colors">
                  <Camera className="w-12 h-12 mx-auto mb-4 text-purple-400" />
                  <p className="text-gray-300 mb-2 font-medium">Upload MT5 Screenshot</p>
                  <p className="text-sm text-gray-500 mb-4">AI will detect trades from your screenshot</p>
                  <Input
                    type="file"
                    accept="image/*"
                    onChange={handleScreenshotUpload}
                    className="max-w-sm mx-auto"
                    disabled={importParsing}
                  />
                </div>

                {/* Loading Indicator */}
                {importParsing && (
                  <div className="bg-purple-500/10 rounded-xl p-6 border border-purple-500/30">
                    <div className="flex flex-col items-center gap-4">
                      <div className="relative">
                        <Loader2 className="w-12 h-12 animate-spin text-purple-400" />
                        <div className="absolute inset-0 flex items-center justify-center">
                          <div className="w-6 h-6 bg-purple-500/20 rounded-full animate-ping" />
                        </div>
                      </div>
                      <div className="text-center">
                        <p className="text-white font-medium">🔍 Analyzing Screenshot...</p>
                        <p className="text-sm text-gray-400 mt-1">AI is reading your trade data</p>
                        <p className="text-xs text-gray-500 mt-2">This may take 10-30 seconds</p>
                      </div>
                    </div>
                  </div>
                )}

                {/* Screenshot Preview */}
                {screenshotPreview && !importParsing && (
                  <div className="relative rounded-lg overflow-hidden border border-purple-900/30">
                    <img
                      src={screenshotPreview}
                      alt="Screenshot preview"
                      className="w-full max-h-48 object-contain bg-black/50"
                    />
                  </div>
                )}

                <div className="bg-purple-500/10 rounded-lg p-4 border border-purple-500/20">
                  <p className="text-xs text-purple-300">
                    <strong>Tip:</strong> For best results, use clear MT5 history screenshots showing Symbol, Type, Lots, Price, and Profit columns.
                  </p>
                </div>
              </div>
            )}

            {/* TAB 2: File Upload */}
            {importTab === 'file' && (
              <div className="space-y-4">
                <div className="border-2 border-dashed border-purple-900/30 rounded-xl p-6 text-center hover:border-purple-500/50 transition-colors">
                  <FileText className="w-12 h-12 mx-auto mb-4 text-purple-400" />
                  <p className="text-gray-300 mb-2 font-medium">Upload Report File</p>
                  <p className="text-sm text-gray-500 mb-4">PDF, HTML, or CSV from MT4/MT5</p>
                  <Input
                    type="file"
                    accept=".pdf,.html,.htm,.csv"
                    onChange={handleFileUpload}
                    className="max-w-sm mx-auto"
                    disabled={importParsing}
                  />
                </div>

                {importParsing && (
                  <div className="flex items-center justify-center py-4">
                    <Loader2 className="w-6 h-6 animate-spin text-purple-400" />
                    <span className="ml-2 text-gray-400">Parsing file...</span>
                  </div>
                )}

                <div className="bg-purple-500/10 rounded-lg p-4 border border-purple-500/20">
                  <p className="text-xs text-purple-300">
                    <strong>Supported:</strong> MT5 Detailed Report (HTML), MT4 Statement (HTML), PDF reports with trade tables, CSV exports.
                  </p>
                </div>
              </div>
            )}

            {/* Trades Preview - EDITABLE */}
            {importedTrades.length > 0 && (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="space-y-4"
              >
                {/* Summary Stats */}
                <div className="bg-gradient-to-r from-purple-500/10 to-violet-500/10 rounded-xl p-4 border border-purple-500/20">
                  <h4 className="font-bold text-sm text-white mb-3 flex items-center gap-2">
                    <Sparkles className="w-4 h-4 text-purple-400" />
                    📊 Detected {importedTrades.length} Trades - Edit Before Saving
                  </h4>
                  <div className="grid grid-cols-4 gap-3">
                    <div className="p-3 rounded-lg bg-white/5">
                      <div className="text-xs text-gray-400">Total Trades</div>
                      <div className="text-lg font-bold text-white">{importedTrades.length}</div>
                    </div>
                    <div className="p-3 rounded-lg bg-white/5">
                      <div className="text-xs text-gray-400">Winners</div>
                      <div className="text-lg font-bold text-emerald-400">
                        {importedTrades.filter(t => t.profit_loss >= 0).length}
                      </div>
                    </div>
                    <div className="p-3 rounded-lg bg-white/5">
                      <div className="text-xs text-gray-400">Total P/L</div>
                      <div className={`text-lg font-bold ${
                        importedTrades.reduce((sum, t) => sum + t.profit_loss, 0) >= 0 ? 'text-emerald-400' : 'text-red-400'
                      }`}>
                        {formatCurrency(importedTrades.reduce((sum, t) => sum + t.profit_loss, 0))}
                      </div>
                    </div>
                    <div className="p-3 rounded-lg bg-white/5">
                      <div className="text-xs text-gray-400">Best Trade</div>
                      <div className="text-lg font-bold text-emerald-400">
                        {Math.max(...importedTrades.map(t => t.profit_loss)) >= 0
                          ? '+' + formatCurrency(Math.max(...importedTrades.map(t => t.profit_loss)))
                          : formatCurrency(Math.max(...importedTrades.map(t => t.profit_loss)))
                        }
                      </div>
                    </div>
                  </div>
                </div>

                {/* Editable Trades Table */}
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <p className="text-sm text-gray-400">📝 Click on fields to edit</p>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setImportedTrades([])}
                      className="text-xs text-red-400 hover:text-red-300"
                    >
                      Clear All
                    </Button>
                  </div>
                  <div className="max-h-72 overflow-y-auto rounded-lg bg-[#0a0712] border border-purple-900/30 custom-scrollbar">
                    <table className="w-full text-sm">
                      <thead className="sticky top-0 bg-[#0f0b18] z-10">
                        <tr className="text-gray-400 border-b border-purple-900/30">
                          <th className="text-left p-2 text-xs">#</th>
                          <th className="text-left p-2 text-xs">Symbol</th>
                          <th className="text-left p-2 text-xs">Type</th>
                          <th className="text-right p-2 text-xs">Lots</th>
                          <th className="text-right p-2 text-xs">Open</th>
                          <th className="text-right p-2 text-xs">Close</th>
                          <th className="text-right p-2 text-xs">P/L</th>
                          <th className="text-center p-2 text-xs">✕</th>
                        </tr>
                      </thead>
                      <tbody>
                        {importedTrades.map((trade, i) => (
                          <tr key={i} className="border-b border-purple-900/10 hover:bg-purple-900/10 transition-colors">
                            <td className="p-2 text-gray-500 text-xs">{i + 1}</td>
                            <td className="p-1">
                              <Input
                                value={trade.symbol}
                                onChange={(e) => updateImportedTrade(i, 'symbol', e.target.value.toUpperCase())}
                                className="w-20 h-7 text-xs bg-transparent border-0 p-1 font-bold focus:bg-white/5"
                              />
                            </td>
                            <td className="p-1">
                              <Select
                                value={trade.type}
                                onValueChange={(v) => updateImportedTrade(i, 'type', v)}
                              >
                                <SelectTrigger className="w-16 h-7 text-xs bg-transparent border-0 p-1">
                                  <Badge variant={trade.type === 'BUY' ? 'default' : 'destructive'} className="text-[10px]">
                                    {trade.type}
                                  </Badge>
                                </SelectTrigger>
                                <SelectContent className="bg-[#1a0f2e]">
                                  <SelectItem value="BUY">BUY</SelectItem>
                                  <SelectItem value="SELL">SELL</SelectItem>
                                </SelectContent>
                              </Select>
                            </td>
                            <td className="p-1">
                              <Input
                                type="number"
                                step="0.01"
                                value={trade.lot_size}
                                onChange={(e) => updateImportedTrade(i, 'lot_size', parseFloat(e.target.value) || 0)}
                                className="w-14 h-7 text-xs bg-transparent border-0 p-1 text-right focus:bg-white/5"
                              />
                            </td>
                            <td className="p-1">
                              <Input
                                type="number"
                                step="0.00001"
                                value={trade.open_price}
                                onChange={(e) => updateImportedTrade(i, 'open_price', parseFloat(e.target.value) || 0)}
                                className="w-20 h-7 text-xs bg-transparent border-0 p-1 text-right focus:bg-white/5"
                              />
                            </td>
                            <td className="p-1">
                              <Input
                                type="number"
                                step="0.00001"
                                value={trade.close_price}
                                onChange={(e) => updateImportedTrade(i, 'close_price', parseFloat(e.target.value) || 0)}
                                className="w-20 h-7 text-xs bg-transparent border-0 p-1 text-right focus:bg-white/5"
                              />
                            </td>
                            <td className="p-1">
                              <Input
                                type="number"
                                step="0.01"
                                value={trade.profit_loss}
                                onChange={(e) => updateImportedTrade(i, 'profit_loss', parseFloat(e.target.value) || 0)}
                                className={`w-20 h-7 text-xs bg-transparent border-0 p-1 text-right font-bold focus:bg-white/5 ${
                                  trade.profit_loss >= 0 ? 'text-emerald-400' : 'text-red-400'
                                }`}
                              />
                            </td>
                            <td className="p-1 text-center">
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => removeImportedTrade(i)}
                                className="w-6 h-6 p-0 text-gray-500 hover:text-red-400 hover:bg-red-500/10"
                              >
                                ✕
                              </Button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </motion.div>
            )}

            {/* Action Buttons */}
            <div className="flex gap-3 pt-2">
              <Button
                onClick={handleSaveImportedTrades}
                disabled={importedTrades.length === 0 || importParsing}
                className="flex-1 bg-gradient-to-r from-purple-500 to-violet-600"
              >
                <Sparkles className="w-4 h-4 mr-2" />
                Import {importedTrades.length} Trades
              </Button>
              <Button
                variant="outline"
                onClick={() => setSmartImportOpen(false)}
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
      />

      <PaymentModal
        isOpen={paymentModalOpen}
        onClose={() => setPaymentModalOpen(false)}
        userId={user?.id}
        email={user?.email}
      />

      {/* Paywall Modal for PRO Features */}
      <PaywallModal
        isOpen={paywallModalOpen}
        onClose={() => setPaywallModalOpen(false)}
        onUpgrade={() => {
          setPaywallModalOpen(false)
          setPlanSelectionModalOpen(true)
        }}
        remainingTrials={proTrialCount}
      />

      {/* Welcome Onboarding */}
      <WelcomeOnboarding
        isOpen={showOnboarding}
        onClose={() => setShowOnboarding(false)}
        onUpgrade={() => setPlanSelectionModalOpen(true)}
        language={language}
      />
    </>
  )
}
