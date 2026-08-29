'use client'

import { useState, useEffect, useCallback } from 'react'
import { Plus, X, Send, Sparkles, Wrench, Zap, Loader2, Mail, Users, CheckCircle, AlertCircle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { toast } from 'sonner'
import { motion } from 'framer-motion'
import { authFetch } from '@/lib/api-fetch'

const TARGET_LABELS: Record<string, string> = {
  verified: 'User Terverifikasi',
  all: 'Semua User',
  pro: 'User PRO',
}

export default function AutoUpdateEmailTab() {
  const [features, setFeatures] = useState<string[]>([])
  const [fixes, setFixes] = useState<string[]>([])
  const [improvements, setImprovements] = useState<string[]>([])

  const [featureInput, setFeatureInput] = useState('')
  const [fixInput, setFixInput] = useState('')
  const [improvementInput, setImprovementInput] = useState('')

  const [subject, setSubject] = useState('✨ Pembaruan LuxTrade — Fitur Baru & Perbaikan Bug')
  const [target, setTarget] = useState('verified')

  const [recipientCount, setRecipientCount] = useState<number | null>(null)
  const [loadingCount, setLoadingCount] = useState(false)
  const [sending, setSending] = useState(false)

  const fetchRecipientCount = useCallback(async (t: string) => {
    setLoadingCount(true)
    try {
      const res = await authFetch(`/api/admin/auto-update-email?target=${t}`)
      const data = await res.json()
      if (res.ok) {
        setRecipientCount(data.recipientCount ?? 0)
      } else {
        setRecipientCount(null)
      }
    } catch {
      setRecipientCount(null)
    } finally {
      setLoadingCount(false)
    }
  }, [])

  useEffect(() => {
    fetchRecipientCount(target)
  }, [target, fetchRecipientCount])

  const addItem = (list: string[], setList: (v: string[]) => void, value: string, clear: (v: string) => void) => {
    const trimmed = value.trim()
    if (!trimmed) return
    if (list.includes(trimmed)) {
      toast.warning('Item ini sudah ditambahkan')
      return
    }
    setList([...list, trimmed])
    clear('')
  }

  const removeItem = (list: string[], setList: (v: string[]) => void, index: number) => {
    setList(list.filter((_, i) => i !== index))
  }

  const totalItems = features.length + fixes.length + improvements.length

  const handleSend = async () => {
    if (totalItems === 0) {
      toast.error('Tambahkan minimal 1 item (fitur, fix, atau peningkatan)')
      return
    }

    setSending(true)
    try {
      const res = await authFetch('/api/admin/auto-update-email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ features, fixes, improvements, target, subject }),
      })
      const data = await res.json()

      if (res.ok) {
        toast.success(
          `Email terkirim! ✅ Berhasil: ${data.sent}, Gagal: ${data.failed}`,
          { duration: 6000 }
        )
        setFeatures([])
        setFixes([])
        setImprovements([])
        setFeatureInput('')
        setFixInput('')
        setImprovementInput('')
      } else {
        toast.error(data.error || 'Gagal mengirim email')
      }
    } catch {
      toast.error('Gagal terhubung ke server')
    } finally {
      setSending(false)
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent, list: string[], setList: (v: string[]) => void, value: string, clear: (v: string) => void) => {
    if (e.key === 'Enter') {
      e.preventDefault()
      addItem(list, setList, value, clear)
    }
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start gap-4">
        <div className="p-2.5 rounded-lg bg-blue-500/10 border-blue-500/20">
          <Mail className="w-5 h-5 text-cyan-400" />
        </div>
        <div>
          <h2 className="text-xl font-bold text-white">Auto Update Email</h2>
          <p className="text-[#8892b0] text-sm mt-1">
            Kirim email pembaruan fitur & perbaikan ke semua user secara otomatis
          </p>
        </div>
      </div>

      {/* Three Input Sections */}
      <div className="grid md:grid-cols-3 gap-4">
        {/* Fitur Baru */}
        <Card className="bg-[#0e1117]/80 backdrop-blur-xl border-blue-500/[0.15]">
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-3">
              <Sparkles className="w-4 h-4 text-blue-400" />
              <h3 className="text-white font-semibold text-sm">Fitur Baru</h3>
              {features.length > 0 && (
                <Badge className="bg-blue-500/20 text-blue-300 border-blue-500/30 text-[10px] h-5 px-1.5">
                  {features.length}
                </Badge>
              )}
            </div>
            <div className="flex gap-2 mb-3">
              <Input
                value={featureInput}
                onChange={(e) => setFeatureInput(e.target.value)}
                onKeyDown={(e) => handleKeyDown(e, features, setFeatures, featureInput, setFeatureInput)}
                placeholder="Tambah fitur baru..."
                className="bg-white/[0.03] border-white/[0.06] text-white placeholder:text-white/30 text-sm h-9"
              />
              <Button
                onClick={() => addItem(features, setFeatures, featureInput, setFeatureInput)}
                size="sm"
                className="h-9 w-9 p-0 bg-blue-500/20 border-blue-500/30 text-blue-300 hover:bg-blue-500/30 hover:text-blue-200 shrink-0"
              >
                <Plus className="w-4 h-4" />
              </Button>
            </div>
            {features.length === 0 && (
              <p className="text-white/30 text-xs">Belum ada fitur ditambahkan</p>
            )}
            <div className="flex flex-wrap gap-1.5">
              {features.map((item, idx) => (
                <motion.div
                  key={idx}
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.9 }}
                >
                  <Badge className="bg-blue-500/10 border-blue-500/20 text-blue-200 text-xs pr-1 gap-1">
                    {item}
                    <button
                      onClick={() => removeItem(features, setFeatures, idx)}
                      className="ml-0.5 hover:text-blue-100 transition-colors"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </Badge>
                </motion.div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Perbaikan Bug */}
        <Card className="bg-[#0e1117]/80 backdrop-blur-xl border-emerald-500/[0.15]">
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-3">
              <Wrench className="w-4 h-4 text-emerald-400" />
              <h3 className="text-white font-semibold text-sm">Perbaikan Bug</h3>
              {fixes.length > 0 && (
                <Badge className="bg-emerald-500/20 text-emerald-300 border-emerald-500/30 text-[10px] h-5 px-1.5">
                  {fixes.length}
                </Badge>
              )}
            </div>
            <div className="flex gap-2 mb-3">
              <Input
                value={fixInput}
                onChange={(e) => setFixInput(e.target.value)}
                onKeyDown={(e) => handleKeyDown(e, fixes, setFixes, fixInput, setFixInput)}
                placeholder="Tambah perbaikan bug..."
                className="bg-white/[0.03] border-white/[0.06] text-white placeholder:text-white/30 text-sm h-9"
              />
              <Button
                onClick={() => addItem(fixes, setFixes, fixInput, setFixInput)}
                size="sm"
                className="h-9 w-9 p-0 bg-emerald-500/20 border-emerald-500/30 text-emerald-300 hover:bg-emerald-500/30 hover:text-emerald-200 shrink-0"
              >
                <Plus className="w-4 h-4" />
              </Button>
            </div>
            {fixes.length === 0 && (
              <p className="text-white/30 text-xs">Belum ada perbaikan ditambahkan</p>
            )}
            <div className="flex flex-wrap gap-1.5">
              {fixes.map((item, idx) => (
                <motion.div
                  key={idx}
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.9 }}
                >
                  <Badge className="bg-emerald-500/10 border-emerald-500/20 text-emerald-200 text-xs pr-1 gap-1">
                    {item}
                    <button
                      onClick={() => removeItem(fixes, setFixes, idx)}
                      className="ml-0.5 hover:text-emerald-100 transition-colors"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </Badge>
                </motion.div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Peningkatan */}
        <Card className="bg-[#0e1117]/80 backdrop-blur-xl border-amber-500/[0.15]">
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-3">
              <Zap className="w-4 h-4 text-amber-400" />
              <h3 className="text-white font-semibold text-sm">Peningkatan</h3>
              {improvements.length > 0 && (
                <Badge className="bg-amber-500/20 text-amber-300 border-amber-500/30 text-[10px] h-5 px-1.5">
                  {improvements.length}
                </Badge>
              )}
            </div>
            <div className="flex gap-2 mb-3">
              <Input
                value={improvementInput}
                onChange={(e) => setImprovementInput(e.target.value)}
                onKeyDown={(e) => handleKeyDown(e, improvements, setImprovements, improvementInput, setImprovementInput)}
                placeholder="Tambah peningkatan..."
                className="bg-white/[0.03] border-white/[0.06] text-white placeholder:text-white/30 text-sm h-9"
              />
              <Button
                onClick={() => addItem(improvements, setImprovements, improvementInput, setImprovementInput)}
                size="sm"
                className="h-9 w-9 p-0 bg-amber-500/20 border-amber-500/30 text-amber-300 hover:bg-amber-500/30 hover:text-amber-200 shrink-0"
              >
                <Plus className="w-4 h-4" />
              </Button>
            </div>
            {improvements.length === 0 && (
              <p className="text-white/30 text-xs">Belum ada peningkatan ditambahkan</p>
            )}
            <div className="flex flex-wrap gap-1.5">
              {improvements.map((item, idx) => (
                <motion.div
                  key={idx}
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.9 }}
                >
                  <Badge className="bg-amber-500/10 border-amber-500/20 text-amber-200 text-xs pr-1 gap-1">
                    {item}
                    <button
                      onClick={() => removeItem(improvements, setImprovements, idx)}
                      className="ml-0.5 hover:text-amber-100 transition-colors"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </Badge>
                </motion.div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Send Configuration */}
      <Card className="bg-[#0e1117]/80 backdrop-blur-xl border-white/[0.06]">
        <CardContent className="p-6">
          <h3 className="text-white font-semibold mb-4 flex items-center gap-2">
            <Send className="w-4 h-4 text-cyan-400" />
            Konfigurasi Pengiriman
          </h3>
          <div className="grid md:grid-cols-2 gap-4">
            {/* Subject */}
            <div className="space-y-2">
              <label className="text-[#8892b0] text-sm">Subject Email</label>
              <Input
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                placeholder="Subject email..."
                className="bg-white/[0.03] border-white/[0.06] text-white placeholder:text-white/30 text-sm"
              />
            </div>
            {/* Target */}
            <div className="space-y-2">
              <label className="text-[#8892b0] text-sm">Target Penerima</label>
              <Select value={target} onValueChange={setTarget}>
                <SelectTrigger className="bg-white/[0.03] border-white/[0.06] text-white text-sm">
                  <SelectValue placeholder="Pilih target" />
                </SelectTrigger>
                <SelectContent className="bg-[#0e1117] border-white/[0.06]">
                  <SelectItem value="verified" className="text-white focus:bg-white/[0.05] focus:text-white">
                    <div className="flex items-center gap-2">
                      <CheckCircle className="w-3.5 h-3.5 text-blue-400" />
                      User Terverifikasi
                    </div>
                  </SelectItem>
                  <SelectItem value="all" className="text-white focus:bg-white/[0.05] focus:text-white">
                    <div className="flex items-center gap-2">
                      <Users className="w-3.5 h-3.5 text-cyan-400" />
                      Semua User
                    </div>
                  </SelectItem>
                  <SelectItem value="pro" className="text-white focus:bg-white/[0.05] focus:text-white">
                    <div className="flex items-center gap-2">
                      <Sparkles className="w-3.5 h-3.5 text-emerald-400" />
                      User PRO
                    </div>
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Recipient Count */}
          <div className="mt-4 flex items-center gap-2">
            <div className="p-1.5 rounded-md bg-blue-500/10 border-blue-500/20">
              <Users className="w-3.5 h-3.5 text-cyan-400" />
            </div>
            {loadingCount ? (
              <span className="text-white/40 text-sm flex items-center gap-2">
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                Menghitung penerima...
              </span>
            ) : recipientCount !== null ? (
              <span className="text-[#8892b0] text-sm">
                <span className="text-white font-medium">{recipientCount}</span> {TARGET_LABELS[target] || 'user'} akan menerima email ini
              </span>
            ) : (
              <span className="text-white/40 text-sm flex items-center gap-1">
                <AlertCircle className="w-3.5 h-3.5" />
                Gagal memuat jumlah penerima
              </span>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Preview & Send */}
      <Card className="bg-[#0e1117]/80 backdrop-blur-xl border-white/[0.06]">
        <CardContent className="p-6">
          {totalItems === 0 ? (
            <div className="text-center py-6">
              <div className="p-3 rounded-full bg-white/[0.03] border border-white/[0.06] w-fit mx-auto mb-3">
                <Mail className="w-6 h-6 text-white/30" />
              </div>
              <p className="text-white/40 text-sm">Tambahkan minimal 1 item di atas untuk mulai mengirim email</p>
              <p className="text-white/25 text-xs mt-1">Fitur baru, perbaikan bug, atau peningkatan</p>
            </div>
          ) : (
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
              <div className="space-y-1">
                <p className="text-white font-medium">
                  Siap mengirim <span className="text-cyan-400">{totalItems}</span> pembaruan
                </p>
                <div className="flex flex-wrap items-center gap-3 text-sm text-[#8892b0]">
                  {features.length > 0 && (
                    <span className="flex items-center gap-1">
                      <Sparkles className="w-3.5 h-3.5 text-blue-400" />
                      {features.length} fitur
                    </span>
                  )}
                  {fixes.length > 0 && (
                    <span className="flex items-center gap-1">
                      <Wrench className="w-3.5 h-3.5 text-emerald-400" />
                      {fixes.length} perbaikan
                    </span>
                  )}
                  {improvements.length > 0 && (
                    <span className="flex items-center gap-1">
                      <Zap className="w-3.5 h-3.5 text-amber-400" />
                      {improvements.length} peningkatan
                    </span>
                  )}
                  <span className="text-white/30">•</span>
                  <span className="flex items-center gap-1">
                    <Users className="w-3.5 h-3.5 text-cyan-400" />
                    {recipientCount ?? '...'} penerima
                  </span>
                </div>
              </div>
              <Button
                onClick={handleSend}
                disabled={sending}
                className="bg-gradient-to-r from-blue-500 to-cyan-400 text-white hover:opacity-90 transition-opacity shrink-0"
              >
                {sending ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Mengirim...
                  </>
                ) : (
                  <>
                    <Send className="w-4 h-4 mr-2" />
                    Kirim Email
                  </>
                )}
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
