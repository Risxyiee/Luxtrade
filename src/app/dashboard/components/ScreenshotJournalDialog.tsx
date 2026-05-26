'use client'

import { useState, useRef } from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Camera, Loader2, Sparkles, Check, BookOpen, TrendingUp, Save, X, Image as ImageIcon } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import { toast } from 'sonner'

interface ExtractedTrade {
  symbol: string
  type: string
  open_price: number
  close_price: number
  lot_size: number
  profit_loss: number
  open_time: string
  close_time: string
  session: string
  notes: string
}

interface ExtractedJournal {
  title: string
  content: string
  mood: string
  market_condition: string
}

interface ScreenshotJournalDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onSuccess?: () => void
  selectedAccountId?: string | null
}

export default function ScreenshotJournalDialog({
  open,
  onOpenChange,
  onSuccess,
  selectedAccountId
}: ScreenshotJournalDialogProps) {
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [imagePreview, setImagePreview] = useState<string | null>(null)
  const [analyzing, setAnalyzing] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [step, setStep] = useState<'upload' | 'preview' | 'result'>('upload')

  const [trade, setTrade] = useState<ExtractedTrade | null>(null)
  const [journal, setJournal] = useState<ExtractedJournal | null>(null)
  const [rawAnalysis, setRawAnalysis] = useState<string>('')

  // Editable fields
  const [editTrade, setEditTrade] = useState<ExtractedTrade | null>(null)
  const [editJournal, setEditJournal] = useState<ExtractedJournal | null>(null)

  const reset = () => {
    setImagePreview(null)
    setAnalyzing(false)
    setSaving(false)
    setError(null)
    setStep('upload')
    setTrade(null)
    setJournal(null)
    setRawAnalysis('')
    setEditTrade(null)
    setEditJournal(null)
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  const handleImageSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    if (file.size > 10 * 1024 * 1024) {
      toast.error('File terlalu besar', { description: 'Maksimal 10MB' })
      return
    }

    // Show preview
    const reader = new FileReader()
    reader.onload = (ev) => {
      setImagePreview(ev.target?.result as string)
      setStep('preview')
    }
    reader.readAsDataURL(file)

    // Start analysis
    setAnalyzing(true)
    setError(null)

    try {
      const formData = new FormData()
      formData.append('image', file)
      if (selectedAccountId) formData.append('accountId', selectedAccountId)

      const res = await fetch('/api/screenshot-journal', {
        method: 'POST',
        body: formData
      })

      const data = await res.json()

      if (!res.ok) {
        throw new Error(data.error || 'Gagal menganalisis screenshot')
      }

      if (data.success && data.data) {
        const t = data.data.trade
        const j = data.data.journal
        const raw = data.data.raw_analysis || ''

        const hasTradeData = t && t.symbol && t.symbol.length > 0
        const hasJournalData = j && j.title && j.title.length > 0

        if (hasTradeData || hasJournalData) {
          setTrade(t)
          setJournal(j)
          setEditTrade({ ...t })
          setEditJournal({ ...j })
          setRawAnalysis(raw)
          setStep('result')
        } else if (raw) {
          // Only got raw analysis, no structured data
          setRawAnalysis(raw)
          setError('AI tidak bisa mengenali data trading di screenshot ini. Coba screenshot yang lebih jelas.')
          setStep('result')
        } else {
          setError('Tidak ada data trading yang terdeteksi di screenshot.')
        }
      } else if (data.warning) {
        setRawAnalysis(data.data?.raw_analysis || '')
        setError(data.warning)
        setStep('result')
      }
    } catch (err) {
      console.error('Screenshot analysis error:', err)
      setError(err instanceof Error ? err.message : 'Gagal menganalisis screenshot. Coba lagi.')
    } finally {
      setAnalyzing(false)
    }
  }

  const handleSave = async () => {
    if (!editTrade && !editJournal) return

    setSaving(true)
    try {
      const results: { tradeSaved?: boolean; journalSaved?: boolean } = {}

      // Save trade if we have valid trade data
      if (editTrade && editTrade.symbol) {
        const tradeRes = await fetch('/api/trades', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            symbol: editTrade.symbol,
            type: editTrade.type,
            open_price: editTrade.open_price,
            close_price: editTrade.close_price,
            lot_size: editTrade.lot_size,
            profit_loss: editTrade.profit_loss,
            open_time: editTrade.open_time || new Date().toISOString(),
            close_time: editTrade.close_time || new Date().toISOString(),
            session: editTrade.session,
            notes: editTrade.notes || 'Auto-generated from screenshot',
            account_id: selectedAccountId || null
          })
        })
        results.tradeSaved = tradeRes.ok
      }

      // Save journal if we have valid journal data
      if (editJournal && editJournal.title && editJournal.content) {
        const journalRes = await fetch('/api/journal', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            title: editJournal.title,
            content: editJournal.content,
            mood: editJournal.mood || 'neutral',
            market_condition: editJournal.market_condition || 'unknown'
          })
        })
        results.journalSaved = journalRes.ok
      }

      const savedItems: string[] = []
      if (results.tradeSaved) savedItems.push('Trade')
      if (results.journalSaved) savedItems.push('Journal')

      if (savedItems.length > 0) {
        toast.success(`${savedItems.join(' & ')} berhasil disimpan!`, {
          description: 'Data trading otomatis dari screenshot Anda'
        })
        onSuccess?.()
        onOpenChange(false)
        reset()
      } else {
        toast.error('Gagal menyimpan', { description: 'Coba lagi atau simpan manual' })
      }
    } catch (err) {
      console.error('Save error:', err)
      toast.error('Gagal menyimpan data')
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) reset(); onOpenChange(o) }}>
      <DialogContent className="bg-[#0f0b18] border-purple-900/30 text-white max-w-lg max-h-[92vh] overflow-hidden flex flex-col p-0">
        {/* Header */}
        <DialogHeader className="shrink-0 px-5 pt-5 pb-3">
          <DialogTitle className="text-lg flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-amber-500 to-orange-600 flex items-center justify-center">
              <Camera className="w-4 h-4 text-white" />
            </div>
            <div>
              <span>SS Auto Journal</span>
              <p className="text-xs text-gray-400 font-normal">Upload screenshot trading, AI auto buat trade & jurnal</p>
            </div>
          </DialogTitle>
        </DialogHeader>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-5 pb-5 custom-scrollbar">
          <AnimatePresence mode="wait">
            {/* STEP 1: Upload */}
            {step === 'upload' && !analyzing && (
              <motion.div
                key="upload"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
              >
                <div
                  onClick={() => fileInputRef.current?.click()}
                  className="border-2 border-dashed border-purple-900/40 rounded-2xl p-8 text-center hover:border-amber-500/50 hover:bg-amber-500/5 transition-all cursor-pointer active:scale-[0.98]"
                >
                  <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-gradient-to-br from-amber-500/20 to-orange-500/20 flex items-center justify-center">
                    <Camera className="w-8 h-8 text-amber-400" />
                  </div>
                  <p className="text-white font-medium mb-1">Tap untuk upload screenshot</p>
                  <p className="text-sm text-gray-400">Screenshot close trade dari MT4/MT5</p>
                  <p className="text-xs text-gray-500 mt-3">JPEG, PNG - Maks 10MB</p>
                </div>

                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  onChange={handleImageSelect}
                  className="hidden"
                />

                <div className="mt-4 bg-amber-500/10 rounded-xl p-3 border border-amber-500/20">
                  <p className="text-xs text-amber-300 font-medium mb-1.5">Hasil terbaik dengan:</p>
                  <ul className="text-xs text-amber-200/70 space-y-0.5">
                    <li>Screenshot detail trade (bukan chart)</li>
                    <li>Symbol, Price, Lot, Profit terlihat jelas</li>
                    <li>Resolusi tinggi, tidak blur</li>
                  </ul>
                </div>
              </motion.div>
            )}

            {/* STEP: Analyzing */}
            {analyzing && (
              <motion.div
                key="analyzing"
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0 }}
                className="py-8"
              >
                {imagePreview && (
                  <div className="rounded-xl overflow-hidden border border-purple-900/30 mb-6">
                    <img src={imagePreview} alt="Screenshot" className="w-full max-h-40 object-contain bg-black/50" />
                  </div>
                )}
                <div className="flex flex-col items-center gap-4">
                  <div className="relative">
                    <Loader2 className="w-14 h-14 animate-spin text-amber-400" />
                    <Sparkles className="w-5 h-5 text-amber-300 absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 animate-pulse" />
                  </div>
                  <div className="text-center">
                    <p className="text-white font-semibold">AI sedang membaca screenshot...</p>
                    <p className="text-sm text-gray-400 mt-1">Mengekstrak data trading & membuat jurnal</p>
                    <p className="text-xs text-gray-500 mt-3">Proses 10-30 detik</p>
                  </div>
                </div>
              </motion.div>
            )}

            {/* STEP: Result */}
            {step === 'result' && !analyzing && (
              <motion.div
                key="result"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                className="space-y-4"
              >
                {/* Error / Warning */}
                {error && (
                  <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-3">
                    <p className="text-sm text-red-300">{error}</p>
                  </div>
                )}

                {/* Screenshot Preview (small) */}
                {imagePreview && (
                  <div className="rounded-lg overflow-hidden border border-purple-900/20">
                    <img src={imagePreview} alt="Screenshot" className="w-full max-h-28 object-contain bg-black/30" />
                  </div>
                )}

                {/* Trade Data */}
                {editTrade && editTrade.symbol && (
                  <div className="space-y-3">
                    <div className="flex items-center gap-2">
                      <TrendingUp className="w-4 h-4 text-emerald-400" />
                      <h4 className="text-sm font-semibold text-white">Trade Data</h4>
                      <Badge variant={editTrade.type === 'BUY' ? 'default' : 'destructive'} className="text-[10px] ml-auto">
                        {editTrade.type}
                      </Badge>
                    </div>

                    <div className="grid grid-cols-2 gap-2">
                      <div className="p-2.5 rounded-lg bg-white/5">
                        <div className="text-[10px] text-gray-400 uppercase tracking-wider">Symbol</div>
                        <Input
                          value={editTrade.symbol}
                          onChange={(e) => setEditTrade({ ...editTrade, symbol: e.target.value.toUpperCase() })}
                          className="h-7 mt-0.5 text-sm font-bold bg-transparent border-0 p-0 focus-visible:ring-0"
                        />
                      </div>
                      <div className="p-2.5 rounded-lg bg-white/5">
                        <div className="text-[10px] text-gray-400 uppercase tracking-wider">Lot Size</div>
                        <Input
                          type="number"
                          step="0.01"
                          value={editTrade.lot_size}
                          onChange={(e) => setEditTrade({ ...editTrade, lot_size: parseFloat(e.target.value) || 0 })}
                          className="h-7 mt-0.5 text-sm font-bold bg-transparent border-0 p-0 focus-visible:ring-0"
                        />
                      </div>
                      <div className="p-2.5 rounded-lg bg-white/5">
                        <div className="text-[10px] text-gray-400 uppercase tracking-wider">Open Price</div>
                        <Input
                          type="number"
                          step="0.01"
                          value={editTrade.open_price}
                          onChange={(e) => setEditTrade({ ...editTrade, open_price: parseFloat(e.target.value) || 0 })}
                          className="h-7 mt-0.5 text-sm bg-transparent border-0 p-0 focus-visible:ring-0"
                        />
                      </div>
                      <div className="p-2.5 rounded-lg bg-white/5">
                        <div className="text-[10px] text-gray-400 uppercase tracking-wider">Close Price</div>
                        <Input
                          type="number"
                          step="0.01"
                          value={editTrade.close_price}
                          onChange={(e) => setEditTrade({ ...editTrade, close_price: parseFloat(e.target.value) || 0 })}
                          className="h-7 mt-0.5 text-sm bg-transparent border-0 p-0 focus-visible:ring-0"
                        />
                      </div>
                    </div>

                    {/* Profit/Loss highlight */}
                    <div className={`p-3 rounded-xl ${editTrade.profit_loss >= 0 ? 'bg-emerald-500/10 border border-emerald-500/30' : 'bg-red-500/10 border border-red-500/30'}`}>
                      <div className="text-[10px] text-gray-400 uppercase tracking-wider mb-1">Profit / Loss</div>
                      <Input
                        type="number"
                        step="0.01"
                        value={editTrade.profit_loss}
                        onChange={(e) => setEditTrade({ ...editTrade, profit_loss: parseFloat(e.target.value) || 0 })}
                        className={`h-8 text-xl font-bold bg-transparent border-0 p-0 focus-visible:ring-0 ${editTrade.profit_loss >= 0 ? 'text-emerald-400' : 'text-red-400'}`}
                      />
                    </div>

                    {/* Session */}
                    {editTrade.session && (
                      <div className="flex items-center gap-2 text-xs text-gray-400">
                        <span>Session:</span>
                        <Badge variant="outline" className="text-[10px] border-purple-500/30 text-purple-300">
                          {editTrade.session}
                        </Badge>
                        {editTrade.open_time && (
                          <>
                            <span className="ml-2">Open:</span>
                            <span className="text-white">{new Date(editTrade.open_time).toLocaleString('id-ID', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}</span>
                          </>
                        )}
                      </div>
                    )}
                  </div>
                )}

                {/* Journal Data */}
                {editJournal && editJournal.title && (
                  <div className="space-y-3">
                    <div className="flex items-center gap-2">
                      <BookOpen className="w-4 h-4 text-amber-400" />
                      <h4 className="text-sm font-semibold text-white">AI Journal</h4>
                    </div>

                    <div>
                      <div className="text-[10px] text-gray-400 uppercase tracking-wider mb-1">Judul</div>
                      <Input
                        value={editJournal.title}
                        onChange={(e) => setEditJournal({ ...editJournal, title: e.target.value })}
                        className="h-8 text-sm font-medium bg-white/5 border-purple-900/30"
                      />
                    </div>

                    <div>
                      <div className="text-[10px] text-gray-400 uppercase tracking-wider mb-1">Isi Jurnal</div>
                      <Textarea
                        value={editJournal.content}
                        onChange={(e) => setEditJournal({ ...editJournal, content: e.target.value })}
                        className="bg-white/5 border-purple-900/30 text-sm resize-none min-h-[80px]"
                        rows={4}
                      />
                    </div>

                    <div className="flex gap-2">
                      {editJournal.mood && (
                        <Badge variant="outline" className="text-[10px] border-amber-500/30 text-amber-300">
                          {editJournal.mood}
                        </Badge>
                      )}
                      {editJournal.market_condition && editJournal.market_condition !== 'unknown' && (
                        <Badge variant="outline" className="text-[10px] border-purple-500/30 text-purple-300">
                          {editJournal.market_condition}
                        </Badge>
                      )}
                    </div>
                  </div>
                )}

                {/* Raw Analysis (if no structured data) */}
                {!editTrade?.symbol && !editJournal?.title && rawAnalysis && (
                  <div className="bg-white/5 rounded-xl p-4">
                    <div className="text-xs text-gray-400 mb-2">AI Analysis:</div>
                    <p className="text-sm text-gray-300 whitespace-pre-wrap">{rawAnalysis}</p>
                  </div>
                )}

                {/* Action Buttons */}
                {(editTrade?.symbol || editJournal?.title) && (
                  <div className="flex gap-2 pt-2">
                    <Button
                      onClick={handleSave}
                      disabled={saving}
                      className="flex-1 bg-gradient-to-r from-amber-500 to-orange-600 hover:from-amber-600 hover:to-orange-700 text-white font-medium h-11"
                    >
                      {saving ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        <>
                          <Save className="w-4 h-4 mr-1.5" />
                          Simpan
                        </>
                      )}
                    </Button>
                    <Button
                      variant="outline"
                      onClick={() => { reset() }}
                      className="border-purple-900/30 h-11"
                    >
                      <ImageIcon className="w-4 h-4" />
                    </Button>
                  </div>
                )}

                {/* Retry button if error */}
                {error && (
                  <Button
                    variant="outline"
                    onClick={reset}
                    className="w-full border-purple-900/30 h-11"
                  >
                    <Camera className="w-4 h-4 mr-2" />
                    Coba Screenshot Lain
                  </Button>
                )}
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </DialogContent>
    </Dialog>
  )
}
