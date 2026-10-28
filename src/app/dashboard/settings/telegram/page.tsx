'use client'
/**
 * ============================================================
 * /dashboard/settings/telegram — Atur Chat ID Telegram (Task 37)
 * ============================================================
 * Simpan Chat ID Telegram user ke kolom `profiles.telegram_chat_id`
 * → alert dari Chart (tombol 🔔 Alert TG di Vela terminal) otomatis
 * terkirim ke chat user ini, tanpa perlu env default Bos.
 *
 * Panduan singkat (SOP): chat @userinfobot di Telegram → salin ID.
 */

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Loader2, Save, Send, ExternalLink, CheckCircle2, XCircle, Trash2 } from 'lucide-react'
import { toast } from 'sonner'

export default function TelegramSettingsPage() {
  const [chatId, setChatId] = useState('')
  const [savedId, setSavedId] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [err, setErr] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setErr(null)
    try {
      const res = await fetch('/api/profile/telegram-chat', { cache: 'no-store' })
      const r = await res.json()
      if (!res.ok) { setErr(String(r?.error || `HTTP ${res.status}`)); return }
      setSavedId(r?.chatId || null)
      setChatId(r?.chatId || '')
    } catch (x: any) {
      setErr(String(x?.message || x).slice(0, 140))
    } finally { setLoading(false) }
  }, [])

  useEffect(() => { load() }, [load])

  const save = useCallback(async () => {
    const v = chatId.trim()
    if (v && !/^-?\d{4,32}$/.test(v)) {
      toast.error('Format Chat ID harus angka saja — contoh: 123456789')
      return
    }
    setSaving(true)
    try {
      const res = await fetch('/api/profile/telegram-chat', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ chatId: v }),
      })
      const r = await res.json()
      if (!res.ok) {
        toast.error(String(r?.error || `HTTP ${res.status}`).slice(0, 120))
        return
      }
      setSavedId(r?.chatId || null)
      toast.success(r?.chatBound ? `✅ Chat ID ${r.chatId} tersimpan — alert akan dikirim ke sini!` : 'Chat ID dihapus.')
    } catch (x: any) {
      toast.error(String(x?.message || x).slice(0, 120))
    } finally { setSaving(false) }
  }, [chatId])

  const dirty = chatId.trim() !== (savedId || '')

  return (
    <div className="max-w-xl mx-auto space-y-4 p-4 md:p-6">
      {/* Header */}
      <div>
        <h1 className="text-xl md:text-2xl font-bold flex items-center gap-2">
          <Send className="w-5 h-5 text-sky-400" />
          Telegram Chat ID
        </h1>
        <p className="text-white/60 text-sm mt-1">
          Sambungkan akun Telegram-mu — alert dari Trading Chart (tombol 🔔 Alert TG) terkirim langsung ke chat ini.
        </p>
      </div>

      {/* Kartu utama */}
      <Card className="bg-white/[0.02] border-white/[0.08]">
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            Chat ID-mu
            {loading ? null : savedId ? (
              <Badge className="bg-emerald-500/15 text-emerald-300 border border-emerald-400/25">Terpasang ✅</Badge>
            ) : (
              <Badge variant="outline" className="text-white/40 border-white/15">Belum diatur</Badge>
            )}
          </CardTitle>
          <CardDescription className="text-[12.5px] leading-relaxed text-white/55">
            <b className="text-amber-300">Cara dapat Chat ID:</b> Chat bot <code className="px-1 rounded bg-white/10">@userinfobot</code> di Telegram lalu salin nomor ID Anda.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="space-y-1.5">
            <Label htmlFor="tg-chat-id" className="text-white/70 text-xs">Telegram Chat ID</Label>
            <Input
              id="tg-chat-id"
              type="text"
              inputMode="numeric"
              placeholder="contoh: 123456789"
              value={chatId}
              onChange={(e) => setChatId(e.target.value.replace(/[^\d-]/g, ''))}
              disabled={loading || saving}
              className="bg-black/30 border-white/10 text-white/90 font-mono"
              autoComplete="off"
            />
          </div>

          {err && (
            <div className="text-[11.5px] rounded-lg px-2.5 py-1.5 border border-red-400/30 bg-red-400/10 text-red-200 flex items-start gap-1.5">
              <XCircle className="w-3.5 h-3.5 mt-0.5 shrink-0" /> {err}
            </div>
          )}

          <div className="flex gap-2 flex-wrap">
            <Button onClick={save} disabled={loading || saving || !dirty} className="bg-sky-500 hover:bg-sky-400 text-black font-semibold">
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
              Simpan Chat ID
            </Button>
            {savedId && (
              <Button variant="outline" disabled={saving} onClick={() => { setChatId(''); toast.info('Klik Simpan lagi untuk konfirmasi hapus.') }}>
                <Trash2 className="w-4 h-4" /> Hapus
              </Button>
            )}
          </div>

          {savedId && !loading && (
            <div className="text-[11.5px] rounded-lg px-2.5 py-1.5 border border-emerald-400/25 bg-emerald-400/10 text-emerald-200 flex items-start gap-1.5">
              <CheckCircle2 className="w-3.5 h-3.5 mt-0.5 shrink-0" />
              Alert Telegram-mu akan dikirim ke <b className="font-mono mx-1">{savedId}</b> — gratis 2×/hari, Pro tanpa batas.
            </div>
          )}
        </CardContent>
      </Card>

      {/* CTA kembali ke chart */}
      <div className="text-[12px] text-white/50 flex items-center gap-1.5 flex-wrap">
        <ExternalLink className="w-3.5 h-3.5" />
        Sudah terpasang? Coba kirim alert pertamamu dari{' '}
        <Link href="/dashboard" className="text-emerald-300 hover:text-emerald-200 underline underline-offset-2">Trading Chart → 🔔 Alert TG</Link>
      </div>
    </div>
  )
}
