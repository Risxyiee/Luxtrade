'use client'

import { useState, useRef, useCallback } from 'react'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import {
  Camera, Upload, Loader2, Sparkles, Save, X, Pencil,
  TrendingUp, TrendingDown, Target, AlertTriangle, CheckCircle2,
  ArrowRight, BookOpen, Tag, Clock, DollarSign
} from 'lucide-react'
import { toast } from 'sonner'

interface ScreenshotJournalModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onSaveJournal: (journal: {
    title: string
    content: string
    mood: string
    market_condition: string
    tags: string
    image_url?: string
  }) => Promise<boolean>
  onSaveTrade?: (trade: any) => Promise<boolean>
}

interface AIMessage {
  trade: {
    symbol: string
    type: string
    open_price: number
    close_price: number
    stop_loss: number
    take_profit: number
    lot_size: number
    profit_loss: number
    open_time: string
    close_time: string
    swap: number
    commission: number
    order_id: string
    platform: string
  } | null
  journal: {
    title: string
    content: string
    mood: string
    market_condition: string
    tags: string[]
    setup_type: string
    risk_reward_ratio: number
  }
}

const MOOD_OPTIONS = [
  { value: 'confident', label: 'Confident', icon: '💪', color: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30' },
  { value: 'calm', label: 'Calm', icon: '😌', color: 'bg-sky-500/20 text-sky-400 border-sky-500/30' },
  { value: 'excited', label: 'Excited', icon: '🤩', color: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30' },
  { value: 'anxious', label: 'Anxious', icon: '😰', color: 'bg-orange-500/20 text-orange-400 border-orange-500/30' },
  { value: 'fearful', label: 'Fearful', icon: '😨', color: 'bg-red-500/20 text-red-400 border-red-500/30' },
  { value: 'greedy', label: 'Greedy', icon: '🤑', color: 'bg-amber-500/20 text-amber-400 border-amber-500/30' },
  { value: 'frustrated', label: 'Frustrated', icon: '😤', color: 'bg-rose-500/20 text-rose-400 border-rose-500/30' },
  { value: 'regretful', label: 'Regretful', icon: '😔', color: 'bg-purple-500/20 text-purple-400 border-purple-500/30' },
  { value: 'neutral', label: 'Neutral', icon: '😐', color: 'bg-gray-500/20 text-gray-400 border-gray-500/30' },
]

const MARKET_CONDITIONS = [
  { value: 'trending_up', label: 'Trending Up', icon: '📈' },
  { value: 'trending_down', label: 'Trending Down', icon: '📉' },
  { value: 'ranging', label: 'Ranging', icon: '↔️' },
  { value: 'volatile', label: 'Volatile', icon: '⚡' },
  { value: 'breakout', label: 'Breakout', icon: '🚀' },
  { value: 'reversal', label: 'Reversal', icon: '🔄' },
]

export default function ScreenshotJournalModal({
  open,
  onOpenChange,
  onSaveJournal,
  onSaveTrade
}: ScreenshotJournalModalProps) {
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [imagePreview, setImagePreview] = useState<string | null>(null)
  const [imageBase64, setImageBase64] = useState<string | null>(null)
  const [mimeType, setMimeType] = useState<string>('image/jpeg')
  const [analyzing, setAnalyzing] = useState(false)
  const [saving, setSaving] = useState(false)
  const [aiResult, setAiResult] = useState<AIMessage | null>(null)
  const [editing, setEditing] = useState(false)

  // Editable fields
  const [editTitle, setEditTitle] = useState('')
  const [editContent, setEditContent] = useState('')
  const [editMood, setEditMood] = useState('neutral')
  const [editMarketCondition, setEditMarketCondition] = useState('ranging')
  const [editTags, setEditTags] = useState('')

  const handleFileSelect = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    if (!file.type.startsWith('image/')) {
      toast.error('Hanya file gambar yang didukung')
      return
    }

    if (file.size > 10 * 1024 * 1024) {
      toast.error('Ukuran file maksimal 10MB')
      return
    }

    setMimeType(file.type)
    setAiResult(null)
    setEditing(false)

    const reader = new FileReader()
    reader.onload = (e) => {
      const result = e.target?.result as string
      setImagePreview(result)
      setImageBase64(result)
    }
    reader.readAsDataURL(file)

    // Reset file input
    e.target.value = ''
  }, [])

  const handleAnalyze = useCallback(async () => {
    if (!imageBase64) return

    setAnalyzing(true)
    setAiResult(null)

    try {
      const res = await fetch('/api/screenshot-journal', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          imageBase64,
          mimeType
        })
      })

      const data = await res.json()

      if (!res.ok || !data.success) {
        toast.error('Gagal menganalisis', {
          description: data.error || data.hint || 'Coba upload screenshot yang lebih jelas'
        })
        setAnalyzing(false)
        return
      }

      setAiResult(data)
      setEditTitle(data.journal.title)
      setEditContent(data.journal.content)
      setEditMood(data.journal.mood || 'neutral')
      setEditMarketCondition(data.journal.market_condition || 'ranging')
      setEditTags(data.journal.tags?.join(', ') || '')
      setEditing(false)

      toast.success('✅ Screenshot berhasil dianalisis!', {
        description: data.trade?.symbol
          ? `${data.trade.type} ${data.trade.symbol} — P/L: $${data.trade.profit_loss}`
          : 'Jurnal trading siap disimpan'
      })
    } catch (err) {
      toast.error('Gagal menganalisis screenshot', {
        description: 'Periksa koneksi internet dan coba lagi'
      })
    } finally {
      setAnalyzing(false)
    }
  }, [imageBase64, mimeType])

  const handleSave = useCallback(async () => {
    if (!editTitle || !editContent) {
      toast.error('Judul dan konten wajib diisi')
      return
    }

    setSaving(true)
    try {
      // Save journal entry
      const journalSuccess = await onSaveJournal({
        title: editTitle,
        content: editContent,
        mood: editMood,
        market_condition: editMarketCondition,
        tags: editTags,
        image_url: imagePreview || undefined
      })

      // Save trade if available and trade save handler provided
      if (journalSuccess && aiResult?.trade && onSaveTrade && aiResult.trade.symbol) {
        await onSaveTrade({
          symbol: aiResult.trade.symbol,
          type: aiResult.trade.type,
          open_price: aiResult.trade.open_price,
          close_price: aiResult.trade.close_price || aiResult.trade.open_price,
          lot_size: aiResult.trade.lot_size || 0.01,
          profit_loss: aiResult.trade.profit_loss || 0,
          open_time: aiResult.trade.open_time || new Date().toISOString(),
          close_time: aiResult.trade.close_time || new Date().toISOString(),
          session: null,
          notes: `Screenshot Journal: ${editTitle}`,
          setup_type: aiResult.journal.setup_type,
          emotion: editMood,
          image_url: imagePreview || undefined
        })
      }

      toast.success('🎉 Jurnal berhasil disimpan!')
      handleClose()
    } catch {
      toast.error('Gagal menyimpan jurnal')
    } finally {
      setSaving(false)
    }
  }, [editTitle, editContent, editMood, editMarketCondition, editTags, imagePreview, aiResult, onSaveJournal, onSaveTrade])

  const handleClose = useCallback(() => {
    setImagePreview(null)
    setImageBase64(null)
    setAiResult(null)
    setEditing(false)
    setAnalyzing(false)
    setSaving(false)
    setEditTitle('')
    setEditContent('')
    setEditMood('neutral')
    setEditMarketCondition('ranging')
    setEditTags('')
    onOpenChange(false)
  }, [onOpenChange])

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="bg-[#0f0b18] border-purple-900/30 text-white max-w-lg w-[95vw] max-h-[92vh] overflow-hidden flex flex-col">
        <DialogHeader className="shrink-0">
          <DialogTitle className="text-xl flex items-center gap-2">
            <Camera className="w-5 h-5 text-purple-400" />
            Screenshot → Auto Journal
          </DialogTitle>
          <p className="text-sm text-gray-400 mt-1">
            Upload screenshot trading, AI akan otomatis membuat jurnal
          </p>
        </DialogHeader>

        <div className="overflow-y-auto flex-1 -mx-1 px-1 space-y-4">
          {/* Upload Area */}
          {!imagePreview ? (
            <div
              onClick={() => fileInputRef.current?.click()}
              className="border-2 border-dashed border-purple-500/30 rounded-xl p-8 text-center cursor-pointer hover:border-purple-500/50 hover:bg-purple-500/5 transition-all"
            >
              <Camera className="w-12 h-12 text-purple-400 mx-auto mb-3" />
              <p className="text-sm font-medium text-gray-300">
                Tap untuk upload screenshot
              </p>
              <p className="text-xs text-gray-500 mt-1">
                PNG, JPG, JPEG — Maks 10MB
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {/* Image Preview */}
              <div className="relative rounded-xl overflow-hidden border border-purple-500/20">
                <img
                  src={imagePreview}
                  alt="Screenshot"
                  className="w-full max-h-56 object-contain bg-black/50"
                />
                <button
                  onClick={() => {
                    setImagePreview(null)
                    setImageBase64(null)
                    setAiResult(null)
                  }}
                  className="absolute top-2 right-2 p-1.5 rounded-full bg-black/60 hover:bg-black/80 transition-colors"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* Analyze Button */}
              {!aiResult && !analyzing && (
                <Button
                  onClick={handleAnalyze}
                  className="w-full bg-gradient-to-r from-purple-500 to-violet-600 hover:from-purple-600 hover:to-violet-700 shadow-lg shadow-purple-500/20 py-5"
                >
                  <Sparkles className="w-5 h-5 mr-2" />
                  Analisis dengan AI
                  <ArrowRight className="w-4 h-4 ml-2" />
                </Button>
              )}

              {/* Loading State */}
              {analyzing && (
                <div className="flex flex-col items-center py-8 gap-3">
                  <div className="relative">
                    <Loader2 className="w-10 h-10 text-purple-400 animate-spin" />
                    <Sparkles className="w-4 h-4 text-yellow-400 absolute -top-1 -right-1 animate-pulse" />
                  </div>
                  <p className="text-sm text-gray-400">AI sedang menganalisis screenshot...</p>
                  <p className="text-xs text-gray-500">Membaca data trading & membuat jurnal</p>
                </div>
              )}

              {/* AI Result */}
              {aiResult && !analyzing && (
                <div className="space-y-3">
                  {/* Trade Info Card */}
                  {aiResult.trade?.symbol && (
                    <div className="rounded-xl bg-gradient-to-br from-purple-500/10 to-violet-500/10 border border-purple-500/20 p-3 space-y-2">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <Badge variant={aiResult.trade.type === 'BUY' ? 'default' : 'destructive'}
                            className={aiResult.trade.type === 'BUY'
                              ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30 hover:bg-emerald-500/30'
                              : 'bg-red-500/20 text-red-400 border-red-500/30 hover:bg-red-500/30'
                            }>
                            {aiResult.trade.type === 'BUY' ? <TrendingUp className="w-3 h-3 mr-1" /> : <TrendingDown className="w-3 h-3 mr-1" />}
                            {aiResult.trade.type}
                          </Badge>
                          <span className="font-bold text-lg">{aiResult.trade.symbol}</span>
                        </div>
                        {aiResult.trade.profit_loss !== 0 && (
                          <span className={`font-bold text-lg ${aiResult.trade.profit_loss > 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                            {aiResult.trade.profit_loss > 0 ? '+' : ''}${aiResult.trade.profit_loss.toFixed(2)}
                          </span>
                        )}
                      </div>
                      <div className="grid grid-cols-2 gap-2 text-xs">
                        {aiResult.trade.open_price > 0 && (
                          <div className="flex items-center gap-1 text-gray-400">
                            <Target className="w-3 h-3" /> Entry: {aiResult.trade.open_price}
                          </div>
                        )}
                        {aiResult.trade.close_price > 0 && aiResult.trade.close_price !== aiResult.trade.open_price && (
                          <div className="flex items-center gap-1 text-gray-400">
                            <Target className="w-3 h-3" /> Close: {aiResult.trade.close_price}
                          </div>
                        )}
                        {aiResult.trade.stop_loss > 0 && (
                          <div className="flex items-center gap-1 text-red-400/70">
                            <AlertTriangle className="w-3 h-3" /> SL: {aiResult.trade.stop_loss}
                          </div>
                        )}
                        {aiResult.trade.take_profit > 0 && (
                          <div className="flex items-center gap-1 text-emerald-400/70">
                            <CheckCircle2 className="w-3 h-3" /> TP: {aiResult.trade.take_profit}
                          </div>
                        )}
                        {aiResult.trade.lot_size > 0 && (
                          <div className="flex items-center gap-1 text-gray-400">
                            <DollarSign className="w-3 h-3" /> Lot: {aiResult.trade.lot_size}
                          </div>
                        )}
                        {aiResult.journal.risk_reward_ratio > 0 && (
                          <div className="flex items-center gap-1 text-purple-400">
                            <Target className="w-3 h-3" /> RR: 1:{aiResult.journal.risk_reward_ratio.toFixed(1)}
                          </div>
                        )}
                      </div>
                    </div>
                  )}

                  {/* Edit Toggle */}
                  <button
                    onClick={() => setEditing(!editing)}
                    className="flex items-center gap-1.5 text-xs text-purple-400 hover:text-purple-300 transition-colors"
                  >
                    <Pencil className="w-3 h-3" />
                    {editing ? 'Preview' : 'Edit jurnal'}
                  </button>

                  {editing ? (
                    /* Edit Mode */
                    <div className="space-y-3">
                      <div>
                        <Label className="text-xs text-gray-400 mb-1">Judul</Label>
                        <Input
                          value={editTitle}
                          onChange={(e) => setEditTitle(e.target.value)}
                          className="bg-white/5 border-purple-500/20"
                          placeholder="Judul jurnal..."
                        />
                      </div>
                      <div>
                        <Label className="text-xs text-gray-400 mb-1">Konten Jurnal</Label>
                        <Textarea
                          value={editContent}
                          onChange={(e) => setEditContent(e.target.value)}
                          className="bg-white/5 border-purple-500/20 min-h-[120px]"
                          placeholder="Tulis jurnal trading..."
                        />
                      </div>
                      <div>
                        <Label className="text-xs text-gray-400 mb-1.5 block">Mood</Label>
                        <div className="flex flex-wrap gap-1.5">
                          {MOOD_OPTIONS.map((m) => (
                            <button
                              key={m.value}
                              onClick={() => setEditMood(m.value)}
                              className={`px-2 py-1 rounded-lg text-xs border transition-all ${
                                editMood === m.value
                                  ? m.color
                                  : 'bg-white/5 border-white/10 text-gray-400 hover:bg-white/10'
                              }`}
                            >
                              {m.icon} {m.label}
                            </button>
                          ))}
                        </div>
                      </div>
                      <div>
                        <Label className="text-xs text-gray-400 mb-1.5 block">Kondisi Market</Label>
                        <div className="flex flex-wrap gap-1.5">
                          {MARKET_CONDITIONS.map((m) => (
                            <button
                              key={m.value}
                              onClick={() => setEditMarketCondition(m.value)}
                              className={`px-2 py-1 rounded-lg text-xs border transition-all ${
                                editMarketCondition === m.value
                                  ? 'bg-purple-500/20 text-purple-400 border-purple-500/30'
                                  : 'bg-white/5 border-white/10 text-gray-400 hover:bg-white/10'
                              }`}
                            >
                              {m.icon} {m.label}
                            </button>
                          ))}
                        </div>
                      </div>
                      <div>
                        <Label className="text-xs text-gray-400 mb-1 block">Tags (pisahkan dengan koma)</Label>
                        <Input
                          value={editTags}
                          onChange={(e) => setEditTags(e.target.value)}
                          className="bg-white/5 border-purple-500/20"
                          placeholder="gold, breakout, tp_hit..."
                        />
                      </div>
                    </div>
                  ) : (
                    /* Preview Mode */
                    <div className="space-y-3">
                      {/* Title */}
                      <div>
                        <div className="flex items-center gap-1.5 text-xs text-gray-500 mb-1">
                          <BookOpen className="w-3 h-3" /> Judul
                        </div>
                        <h3 className="font-semibold text-base">{editTitle}</h3>
                      </div>

                      {/* Mood & Market */}
                      <div className="flex flex-wrap gap-2">
                        {editMood && (
                          <Badge className={
                            MOOD_OPTIONS.find(m => m.value === editMood)?.color || 'bg-gray-500/20 text-gray-400'
                          }>
                            {MOOD_OPTIONS.find(m => m.value === editMood)?.icon} {MOOD_OPTIONS.find(m => m.value === editMood)?.label}
                          </Badge>
                        )}
                        {editMarketCondition && (
                          <Badge className="bg-white/10 text-gray-300 border-white/10">
                            {MARKET_CONDITIONS.find(m => m.value === editMarketCondition)?.icon}{' '}
                            {MARKET_CONDITIONS.find(m => m.value === editMarketCondition)?.label}
                          </Badge>
                        )}
                        {aiResult.journal.setup_type && (
                          <Badge className="bg-violet-500/20 text-violet-400 border-violet-500/30">
                            {aiResult.journal.setup_type}
                          </Badge>
                        )}
                      </div>

                      {/* Tags */}
                      {editTags && (
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <Tag className="w-3 h-3 text-gray-500" />
                          {editTags.split(',').map((tag, i) => (
                            <Badge key={i} variant="outline" className="text-xs bg-white/5 border-white/10">
                              {tag.trim()}
                            </Badge>
                          ))}
                        </div>
                      )}

                      {/* Content */}
                      <div>
                        <div className="flex items-center gap-1.5 text-xs text-gray-500 mb-1">
                          <BookOpen className="w-3 h-3" /> Jurnal
                        </div>
                        <div className="text-sm text-gray-300 leading-relaxed whitespace-pre-wrap bg-white/5 rounded-lg p-3">
                          {editContent}
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <DialogFooter className="shrink-0 pt-3 border-t border-purple-900/20 flex flex-col sm:flex-row gap-2">
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            capture="environment"
            onChange={handleFileSelect}
            className="hidden"
          />
          <Button
            variant="outline"
            onClick={() => fileInputRef.current?.click()}
            className="border-purple-500/30 text-purple-400 hover:bg-purple-500/10"
          >
            <Upload className="w-4 h-4 mr-2" />
            Ganti Foto
          </Button>
          <div className="flex-1" />
          <Button
            variant="ghost"
            onClick={handleClose}
            className="text-gray-400 hover:text-white"
          >
            Batal
          </Button>
          {aiResult && (
            <Button
              onClick={handleSave}
              disabled={saving || !editTitle || !editContent}
              className="bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-600 hover:to-teal-700 shadow-lg shadow-emerald-500/20"
            >
              {saving ? (
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              ) : (
                <Save className="w-4 h-4 mr-2" />
              )}
              Simpan Jurnal
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
