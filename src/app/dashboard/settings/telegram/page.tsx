'use client'
/**
 * ============================================================
 * /dashboard/settings/telegram — Hubungkan Telegram (Task 37)
 * ============================================================
 * Deep linking: user TIDAK perlu mencari Chat ID manual.
 *   1. Klik "Hubungkan ke Telegram" → buka
 *      https://t.me/luxtradeebot?start=<USER_ID>
 *   2. Tekan START di Telegram
 *   3. Webhook (/api/telegram/webhook) otomatis menyimpan
 *      chat.id user ke profiles.telegram_chat_id — status di
 *      halaman ini berubah "Terhubung" sendiri (auto-poll).
 *
 * Status koneksi dibaca dari GET /api/profile/telegram-chat
 * (sekalian ambil userId untuk deep link). Tombol tes mengirim
 * alert sungguhan via POST /api/send-alert (ikut kuota: free
 * 2×/hari, Pro tanpa batas). "Lepaskan" menghapus binding.
 */

import { useCallback, useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import {
  Loader2, Send, CheckCircle2, XCircle, RefreshCw, Trash2,
  BellRing, ShieldCheck, ExternalLink, Link2, Unlink,
} from 'lucide-react'
import { toast } from 'sonner'

/* Username bot — bisa dioverride via env Cloudflare (tanpa @).
   Default: bot milik Bos. */
const BOT_USERNAME = (process.env.NEXT_PUBLIC_TELEGRAM_BOT_USERNAME || 'luxtradeebot').replace(/^@/, '')

export default function TelegramSettingsPage() {
  const [loading, setLoading] = useState(true)
  const [bound, setBound] = useState(false)
  const [chatId, setChatId] = useState<string | null>(null)
  const [userId, setUserId] = useState<string | null>(null)
  const [err, setErr] = useState<string | null>(null)
  const [warn, setWarn] = useState<string | null>(null)
  const [checking, setChecking] = useState(false)
  const [unlinking, setUnlinking] = useState(false)
  const [testing, setTesting] = useState(false)
  const justBoundRef = useRef(false)

  /* ---------- Muat status (userId + chatBound) ---------- */
  const load = useCallback(async (silent = false) => {
    if (!silent) { setLoading(true); setErr(null) }
    else setChecking(true)
    try {
      const res = await fetch('/api/profile/telegram-chat', { cache: 'no-store' })
      const r = await res.json()
      if (!res.ok) {
        if (!silent) setErr(String(r?.error || `HTTP ${res.status}`))
        return
      }
      setUserId(String(r?.userId || '') || null)
      setWarn(String(r?.warning || '') || null)
      const isBound = r?.chatBound === true
      setBound(isBound)
      setChatId(r?.chatId ? String(r.chatId) : null)
      /* Toast hanya saat transisi BARU terhubung (terdeteksi oleh
         auto-poll/focus setelah user menekan START di Telegram) —
         bukan saat pertama buka halaman dalam keadaan sudah terhubung */
      if (isBound && !justBoundRef.current && silent) {
        justBoundRef.current = true
        toast.success('🎉 Telegram berhasil terhubung!')
      }
    } catch (x: any) {
      if (!silent) setErr(String(x?.message || x).slice(0, 140))
    } finally {
      setLoading(false)
      setChecking(false)
    }
  }, [])

  useEffect(() => { load() }, [load])

  /* ---------- Auto-cek: saat belum terhubung, poll ringan +
     re-cek saat user kembali dari Telegram (window focus) ---------- */
  useEffect(() => {
    if (loading || bound) return
    const onFocus = () => { if (document.visibilityState === 'visible') load(true) }
    window.addEventListener('focus', onFocus)
    const iv = window.setInterval(() => {
      if (document.visibilityState === 'visible') load(true)
    }, 8000)
    return () => {
      window.removeEventListener('focus', onFocus)
      window.clearInterval(iv)
    }
  }, [loading, bound, load])

  /* ---------- Deep link ---------- */
  const deepLink = userId ? `https://t.me/${BOT_USERNAME}?start=${userId}` : null

  /* ---------- Lepaskan koneksi ---------- */
  const unlink = useCallback(async () => {
    setUnlinking(true)
    try {
      const res = await fetch('/api/profile/telegram-chat', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ chatId: '' }),
      })
      const r = await res.json()
      if (!res.ok) {
        toast.error(String(r?.error || `HTTP ${res.status}`).slice(0, 120))
        return
      }
      justBoundRef.current = false
      setBound(false)
      setChatId(null)
      toast.success('Koneksi Telegram dilepas.')
    } catch (x: any) {
      toast.error(String(x?.message || x).slice(0, 120))
    } finally { setUnlinking(false) }
  }, [])

  /* ---------- Tes alert sungguhan (ikut kuota) ---------- */
  const testAlert = useCallback(async () => {
    setTesting(true)
    try {
      const res = await fetch('/api/send-alert', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: '🚀 <b>Tes alert Luxtradee</b>\n\nKalau pesan ini muncul di chat-mu, alert Telegram sudah siap dipakai dari chart. ✅' }),
      })
      const r = await res.json()
      if (res.status === 429) {
        toast.error(String(r?.error || 'Kuota alert gratis habis.'))
        return
      }
      if (!res.ok) {
        toast.error(String(r?.error || `HTTP ${res.status}`).slice(0, 160))
        return
      }
      toast.success(r?.isPro ? '✅ Tes alert terkirim (Pro — tanpa batas)!' : `✅ Tes alert terkirim! Sisa kuota hari ini: ${r?.remaining ?? 0}.`)
    } catch (x: any) {
      toast.error(String(x?.message || x).slice(0, 140))
    } finally { setTesting(false) }
  }, [])

  return (
    <div className="max-w-xl mx-auto space-y-4 p-4 md:p-6">
      {/* ---------- Header ---------- */}
      <div>
        <h1 className="text-xl md:text-2xl font-bold flex items-center gap-2">
          <Send className="w-5 h-5 text-sky-400" />
          Telegram
        </h1>
        <p className="text-white/60 text-sm mt-1">
          Hubungkan akun Telegram-mu sekali saja — alert dari Trading Chart terkirim langsung ke chat pribadimu. Tanpa perlu mencari Chat ID manual.
        </p>
      </div>

      {/* ---------- Kartu utama: koneksi ---------- */}
      <Card className="bg-white/[0.02] border-white/[0.08]">
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2 flex-wrap">
            Status Koneksi
            {loading ? null : bound ? (
              <Badge className="bg-emerald-500/15 text-emerald-300 border border-emerald-400/25">Terhubung ✅</Badge>
            ) : (
              <Badge variant="outline" className="text-white/40 border-white/15">Belum terhubung</Badge>
            )}
            {!loading && (
              <button
                onClick={() => load(true)}
                disabled={checking}
                className="ml-auto inline-flex items-center gap-1 text-[11px] text-white/40 hover:text-white/80 transition-colors disabled:opacity-50 min-h-[32px]"
                aria-label="Cek ulang status koneksi"
              >
                <RefreshCw className={`w-3 h-3 ${checking ? 'animate-spin' : ''}`} />
                Cek status
              </button>
            )}
          </CardTitle>
          <CardDescription className="text-[12.5px] leading-relaxed text-white/55">
            {bound
              ? <>Alert terkirim ke chat <b className="font-mono text-white/80">{chatId}</b> — gratis 2×/hari, Pro tanpa batas.</>
              : <>Satu tombol, langsung jadi. Ikuti 3 langkah di bawah.</>}
          </CardDescription>
        </CardHeader>

        <CardContent className="space-y-3">
          {err && (
            <div className="text-[11.5px] rounded-lg px-2.5 py-1.5 border border-red-400/30 bg-red-400/10 text-red-200 flex items-start gap-1.5">
              <XCircle className="w-3.5 h-3.5 mt-0.5 shrink-0" />
              <span className="flex-1">{err}</span>
              <button onClick={() => load()} className="underline underline-offset-2 hover:text-white shrink-0">Coba lagi</button>
            </div>
          )}

          {!err && warn && (
            <div className="text-[11.5px] rounded-lg px-2.5 py-1.5 border border-amber-400/30 bg-amber-400/10 text-amber-200 flex items-start gap-1.5">
              <span className="mt-0.5 shrink-0">⚠️</span>
              <span className="flex-1">{warn}</span>
            </div>
          )}

          {loading ? (
            <div className="h-24 rounded-xl bg-white/[0.03] border border-white/[0.06] animate-pulse" aria-label="Memuat status" />
          ) : !bound && (
            /* ---------- Langkah + tombol deep link ---------- */
            <ol className="space-y-2 text-[12.5px] text-white/70 list-none">
              <li className="flex gap-2">
                <span className="shrink-0 w-5 h-5 rounded-full bg-emerald-500/15 text-emerald-300 text-[11px] font-bold flex items-center justify-center border border-emerald-400/25">1</span>
                <span className="pt-0.5">Tekan tombol <b className="text-white/90">Hubungkan ke Telegram</b> — bot <code className="px-1 rounded bg-white/10">@{BOT_USERNAME}</code> terbuka di aplikasi Telegram.</span>
              </li>
              <li className="flex gap-2">
                <span className="shrink-0 w-5 h-5 rounded-full bg-emerald-500/15 text-emerald-300 text-[11px] font-bold flex items-center justify-center border border-emerald-400/25">2</span>
                <span className="pt-0.5">Tekan <b className="text-white/90">START</b> (atau kirim apa pun) di chat bot itu.</span>
              </li>
              <li className="flex gap-2">
                <span className="shrink-0 w-5 h-5 rounded-full bg-emerald-500/15 text-emerald-300 text-[11px] font-bold flex items-center justify-center border border-emerald-400/25">3</span>
                <span className="pt-0.5">Balik ke halaman ini — status berubah <b className="text-emerald-300">Terhubung</b> otomatis. 🎉</span>
              </li>
            </ol>
          )}

          {!loading && (
            <div className="flex gap-2 flex-wrap pt-1">
              {!bound ? (
                deepLink ? (
                  <Button asChild className="bg-sky-500 hover:bg-sky-400 text-black font-semibold min-h-[44px]">
                    <a href={deepLink} target="_blank" rel="noopener noreferrer" aria-label={`Buka bot Telegram @${BOT_USERNAME}`}>
                      <Link2 className="w-4 h-4" />
                      Hubungkan ke Telegram
                      <ExternalLink className="w-3.5 h-3.5 opacity-70" />
                    </a>
                  </Button>
                ) : (
                  <Button disabled className="bg-sky-500/50 text-black/60 font-semibold min-h-[44px]">
                    <Loader2 className="w-4 h-4 animate-spin" /> Menyiapkan link…
                  </Button>
                )
              ) : (
                <>
                  <Button onClick={testAlert} disabled={testing} className="bg-emerald-500 hover:bg-emerald-400 text-black font-semibold min-h-[44px]">
                    {testing ? <Loader2 className="w-4 h-4 animate-spin" /> : <BellRing className="w-4 h-4" />}
                    Tes Alert
                  </Button>
                  <Button variant="outline" onClick={unlink} disabled={unlinking} className="min-h-[44px] text-red-300 border-red-400/30 hover:bg-red-400/10 hover:text-red-200">
                    {unlinking ? <Loader2 className="w-4 h-4 animate-spin" /> : <Unlink className="w-4 h-4" />}
                    Lepaskan
                  </Button>
                </>
              )}
            </div>
          )}

          {!loading && bound && (
            <div className="text-[11.5px] rounded-lg px-2.5 py-1.5 border border-emerald-400/25 bg-emerald-400/10 text-emerald-200 flex items-start gap-1.5">
              <CheckCircle2 className="w-3.5 h-3.5 mt-0.5 shrink-0" />
              Semua alert dari chart (tombol 🔔 Alert TG) sekarang masuk ke Telegram-mu.
            </div>
          )}
        </CardContent>
      </Card>

      {/* ---------- Kartu info: kuota & keamanan ---------- */}
      <div className="grid gap-3 sm:grid-cols-2">
        <Card className="bg-white/[0.02] border-white/[0.08]">
          <CardHeader className="pb-2">
            <CardTitle className="text-[13px] flex items-center gap-1.5">
              <BellRing className="w-3.5 h-3.5 text-amber-300" /> Kuota Alert
            </CardTitle>
          </CardHeader>
          <CardContent className="text-[12px] text-white/60 leading-relaxed">
            <b className="text-white/85">Gratis:</b> 2 alert/hari.<br />
            <b className="text-amber-300">Pro (Rp39rb/bln):</b> tanpa batas.
            <div className="mt-1.5">
              <Link href="/#pricing" className="text-amber-300 hover:text-amber-200 underline underline-offset-2">Lihat paket Pro →</Link>
            </div>
          </CardContent>
        </Card>
        <Card className="bg-white/[0.02] border-white/[0.08]">
          <CardHeader className="pb-2">
            <CardTitle className="text-[13px] flex items-center gap-1.5">
              <ShieldCheck className="w-3.5 h-3.5 text-emerald-300" /> Aman
            </CardTitle>
          </CardHeader>
          <CardContent className="text-[12px] text-white/60 leading-relaxed">
            Chat ID-mu hanya dipakai untuk mengirim alert Luxtradee — tidak dibagikan, tidak dipakai hal lain. Kapan pun bisa dilepas lewat tombol di atas.
          </CardContent>
        </Card>
      </div>

      {/* ---------- CTA kembali ke chart ---------- */}
      <div className="text-[12px] text-white/50 flex items-center gap-1.5 flex-wrap">
        <ExternalLink className="w-3.5 h-3.5" />
        Sudah terhubung? Coba dari{' '}
        <Link href="/dashboard" className="text-emerald-300 hover:text-emerald-200 underline underline-offset-2">Trading Chart → 🔔 Alert TG</Link>
      </div>
    </div>
  )
}
