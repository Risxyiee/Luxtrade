'use client'

/**
 * RuangCeoDashboard — dashboard interaktif Ruang CEO.
 * Dimuat via next/dynamic ssr:false dari page.tsx (client-only).
 * Sumber data: /api/ceo-agent (Cloudflare Workers via OpenNext).
 */

import { useCallback, useEffect, useState } from 'react'
import { motion, type Variants } from 'framer-motion'
import { toast } from 'sonner'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Progress } from '@/components/ui/progress'
import { Separator } from '@/components/ui/separator'
import {
  Bot,
  Bug,
  Copy,
  DollarSign,
  Eye,
  EyeOff,
  KeyRound,
  Mail,
  Megaphone,
  RefreshCw,
  Send,
  Server,
  Users,
} from 'lucide-react'

/* ---------- tipe respons API ---------- */
interface CtoResult {
  title?: string; siteOk?: boolean; status?: number; latencyMs?: number
  bugs24h?: number; err?: string; error?: string
}
interface CsoResult {
  title?: string; total?: number; active?: number; passive?: number
  err?: string; error?: string
}
interface CmoResult {
  title?: string; draft?: string; angle?: string; usedFallback?: boolean
  error?: string
}
interface CfoResult {
  title?: string; limit?: number; usedToday?: number; usedYesterday?: number
  quota429?: number; status?: string; error?: string
}
interface AgentsPayload { cto?: CtoResult; cso?: CsoResult; cmo?: CmoResult; cfo?: CfoResult }
interface BriefingSummary extends AgentsPayload {
  at?: string; notifySent?: boolean; notifyErr?: string; text?: string
}

const KEY_STORAGE = 'ruangCeoKey'

/* ---------- animasi (framer-motion) ---------- */
const stagger: Variants = {
  hidden: {},
  show: { transition: { staggerChildren: 0.08, delayChildren: 0.05 } },
}
const fadeUp: Variants = {
  hidden: { opacity: 0, y: 24 },
  show: { opacity: 1, y: 0, transition: { duration: 0.45, ease: 'easeOut' } },
}
const fadeIn: Variants = {
  hidden: { opacity: 0 },
  show: { opacity: 1, transition: { duration: 0.5 } },
}

async function callAgent(action: string, key: string): Promise<Record<string, unknown>> {
  const res = await fetch(`/api/ceo-agent?action=${encodeURIComponent(action)}`, {
    headers: key ? { Authorization: `Bearer ${key}` } : undefined,
  })
  const data = await res.json().catch(() => ({}) as Record<string, unknown>)
  if (!res.ok) {
    const msg = typeof data?.error === 'string' ? data.error : `HTTP ${res.status}`
    throw new Error(msg)
  }
  return data
}

const fmtN = (n: number | undefined) =>
  typeof n === 'number' && n >= 0 ? n.toLocaleString('id-ID') : '—'

/* ---------- badge status util ---------- */
function StatusBadge({ ok, label }: { ok: boolean | null; label: string }) {
  if (ok === null) return <Badge variant="outline" className="text-muted-foreground">{label}</Badge>
  return ok
    ? <Badge className="bg-emerald-600 hover:bg-emerald-600 text-white">{label} ✅</Badge>
    : <Badge variant="destructive">{label} ❌</Badge>
}

export default function RuangCeoDashboard() {
  const [key, setKey] = useState('')
  const [showKey, setShowKey] = useState(false)
  const [loading, setLoading] = useState<'agents' | 'briefing' | 'last' | 'acc' | null>(null)
  const [agents, setAgents] = useState<AgentsPayload | null>(null)
  const [briefing, setBriefing] = useState<BriefingSummary | null>(null)

  useEffect(() => {
    const saved = localStorage.getItem(KEY_STORAGE)
    if (saved) setKey(saved)
  }, [])

  const saveKey = (v: string) => {
    setKey(v)
    if (v) localStorage.setItem(KEY_STORAGE, v)
    else localStorage.removeItem(KEY_STORAGE)
  }

  const handleAgents = useCallback(async () => {
    if (!key) { toast.error('Masukkan ADMIN_SECRET / CRON_SECRET dulu ya, Bos.') ; return }
    setLoading('agents')
    try {
      const data = await callAgent('agents', key)
      setAgents(data as AgentsPayload)
      toast.success('Data 4 agen berhasil dimuat')
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Gagal memuat data agen')
    } finally {
      setLoading(null)
    }
  }, [key])

  const handleBriefing = useCallback(async () => {
    if (!key) { toast.error('Masukkan ADMIN_SECRET / CRON_SECRET dulu ya, Bos.') ; return }
    setLoading('briefing')
    try {
      const data = await callAgent('briefing', key)
      setBriefing(data as BriefingSummary)
      if ((data as BriefingSummary).notifySent) toast.success('Briefing jalan + terkirim ke Discord!')
      else toast.warning('Briefing jalan, tapi gagal kirim ke Discord — cek DISCORD_WEBHOOK_URL.')
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Briefing gagal dijalankan')
    } finally {
      setLoading(null)
    }
  }, [key])

  const handleBriefingLast = useCallback(async () => {
    if (!key) { toast.error('Masukkan ADMIN_SECRET / CRON_SECRET dulu ya, Bos.') ; return }
    setLoading('last')
    try {
      const data = await callAgent('briefing-last', key)
      setBriefing(data as BriefingSummary)
      toast.success('Briefing terakhir dimuat')
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Belum ada briefing tersimpan')
    } finally {
      setLoading(null)
    }
  }, [key])

  const copyBriefing = useCallback(async () => {
    if (!briefing?.text) return
    try {
      await navigator.clipboard.writeText(briefing.text)
      toast.success('Teks briefing dikopi ke clipboard')
    } catch {
      toast.error('Gagal mengopi — browser memblokir clipboard')
    }
  }, [briefing])

  /* Flow "ACC EMAIL" — kirim email sapaan ke user pasif (Resend),
     pengganti reply "ACC EMAIL" via WhatsApp yang sudah dimatikan */
  const handleAccEmail = useCallback(async () => {
    if (!key) { toast.error('Masukkan ADMIN_SECRET / CRON_SECRET dulu ya, Bos.') ; return }
    setLoading('acc')
    try {
      const data = await callAgent('acc-email', key)
      if (data?.dup) { toast.info('ACC EMAIL hari ini sudah pernah dijalankan (dedup harian).'); return }
      const sent = typeof data?.emailsSent === 'number' && (data.emailsSent as number) >= 0
        ? (data.emailsSent as number) : null
      if (sent === null) toast.warning('ACC EMAIL dicatat — set RESEND_API_KEY agar email terkirim otomatis.')
      else toast.success(`Email sapaan terkirim ke ${sent} user pasif hari ini`)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'ACC EMAIL gagal dijalankan')
    } finally {
      setLoading(null)
    }
  }, [key])

  const cto = briefing?.cto ?? agents?.cto
  const cso = briefing?.cso ?? agents?.cso
  const cmo = briefing?.cmo ?? agents?.cmo
  const cfo = briefing?.cfo ?? agents?.cfo
  const quotaPct = cfo?.limit && cfo.limit > 0 && typeof cfo.usedToday === 'number'
    ? Math.min(100, Math.round((cfo.usedToday / cfo.limit) * 100))
    : 0

  return (
    <motion.div
      className="mx-auto w-full max-w-5xl px-4 py-8 sm:py-10"
      variants={stagger}
      initial="hidden"
      animate="show"
    >
      {/* ── Header ── */}
      <motion.header className="mb-8" variants={fadeIn}>
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-emerald-600 text-white shadow transition-transform duration-300 hover:scale-105 hover:rotate-3">
            <Bot className="h-6 w-6" aria-hidden="true" />
          </div>
          <div>
            <h1 className="flex items-center gap-2 text-2xl font-bold tracking-tight sm:text-3xl">
              Ruang CEO
              <span className="relative flex h-2.5 w-2.5" aria-hidden="true">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
                <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-emerald-500" />
              </span>
            </h1>
            <p className="text-sm text-muted-foreground">
              LuxTradee Super AI Agent — CTO · CSO · CMO · CFO dalam satu dasbor
            </p>
          </div>
        </div>
      </motion.header>

      {/* ── Auth + Aksi ── */}
      <motion.div variants={fadeUp} whileHover={{ y: -2 }} transition={{ duration: 0.2 }}>
      <Card className="mb-6">
        <CardHeader className="pb-4">
          <CardTitle className="flex items-center gap-2 text-base">
            <KeyRound className="h-4 w-4" aria-hidden="true" /> Akses Bos
          </CardTitle>
          <CardDescription>
            Tempel <code className="rounded bg-muted px-1 py-0.5 text-xs">ADMIN_SECRET</code> atau{' '}
            <code className="rounded bg-muted px-1 py-0.5 text-xs">CRON_SECRET</code> (disimpan lokal di browser ini).
            Semua aksi kecuali info butuh key.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="ceo-key">Secret Key</Label>
            <div className="flex gap-2">
              <Input
                id="ceo-key"
                type={showKey ? 'text' : 'password'}
                placeholder="ADMIN_SECRET / CRON_SECRET"
                value={key}
                onChange={(e) => saveKey(e.target.value)}
                autoComplete="off"
                className="max-w-md"
              />
              <Button
                type="button"
                variant="outline"
                size="icon"
                onClick={() => setShowKey((s) => !s)}
                aria-label={showKey ? 'Sembunyikan key' : 'Tampilkan key'}
              >
                {showKey ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </Button>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button onClick={handleAgents} disabled={loading !== null}>
              <RefreshCw className={`mr-2 h-4 w-4 ${loading === 'agents' ? 'animate-spin' : ''}`} aria-hidden="true" />
              {loading === 'agents' ? 'Memuat…' : 'Muat Data 4 Agen'}
            </Button>
            <Button onClick={handleBriefing} disabled={loading !== null} variant="secondary">
              <Send className={`mr-2 h-4 w-4 ${loading === 'briefing' ? 'animate-pulse' : ''}`} aria-hidden="true" />
              {loading === 'briefing' ? 'Briefing berjalan…' : 'Jalankan Briefing + Kirim Discord'}
            </Button>
            <Button onClick={handleBriefingLast} disabled={loading !== null} variant="outline">
              {loading === 'last' ? 'Memuat…' : 'Briefing Terakhir'}
            </Button>
            <Button onClick={handleAccEmail} disabled={loading !== null} variant="outline">
              <Mail className={`mr-2 h-4 w-4 ${loading === 'acc' ? 'animate-pulse' : ''}`} aria-hidden="true" />
              {loading === 'acc' ? 'Mengirim email…' : 'ACC EMAIL ke User Pasif'}
            </Button>
          </div>
        </CardContent>
      </Card>
      </motion.div>

      {/* ── 4 Kartu Agen ── */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        {/* CTO */}
        <motion.div variants={fadeUp} whileHover={{ y: -4 }} transition={{ duration: 0.2 }}>
        <Card className="h-full">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center justify-between text-base">
              <span className="flex items-center gap-2"><Server className="h-4 w-4" aria-hidden="true" /> CTO — IT &amp; QA</span>
              <StatusBadge ok={cto ? !!cto.siteOk : null} label="Website" />
            </CardTitle>
            <CardDescription>Monitoring situs &amp; bug 24 jam</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            {cto ? (
              <>
                <p>HTTP Status: <strong>{cto.status ?? '—'}</strong> · Latensi: <strong>{typeof cto.latencyMs === 'number' ? `${cto.latencyMs} ms` : '—'}</strong></p>
                <p className="flex items-center gap-1.5">
                  <Bug className="h-4 w-4" aria-hidden="true" /> Bug 24 jam:{' '}
                  <strong>{typeof cto.bugs24h === 'number' && cto.bugs24h >= 0 ? cto.bugs24h : 'gagal diambil'}</strong>
                  {typeof cto.bugs24h === 'number' && cto.bugs24h > 0 && (
                    <Badge variant="destructive" className="ml-1">perlu dicek</Badge>
                  )}
                </p>
                {(cto.err || cto.error) && <p className="text-xs text-rose-600">{cto.err || cto.error}</p>}
              </>
            ) : <p className="text-muted-foreground">Belum ada data — klik “Muat Data 4 Agen”.</p>}
          </CardContent>
        </Card>
        </motion.div>

        {/* CSO */}
        <motion.div variants={fadeUp} whileHover={{ y: -4 }} transition={{ duration: 0.2 }}>
        <Card className="h-full">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-base">
              <Users className="h-4 w-4" aria-hidden="true" /> CSO — Customer Success
            </CardTitle>
            <CardDescription>Pendaftar · aktif · pasif 24 jam</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            {cso ? (
              <>
                <div className="grid grid-cols-3 gap-2 text-center">
                  <div className="rounded-lg bg-muted p-2">
                    <p className="text-lg font-bold">{fmtN(cso.total)}</p>
                    <p className="text-xs text-muted-foreground">Total</p>
                  </div>
                  <div className="rounded-lg bg-emerald-600/10 p-2">
                    <p className="text-lg font-bold text-emerald-700">{fmtN(cso.active)}</p>
                    <p className="text-xs text-muted-foreground">Aktif</p>
                  </div>
                  <div className="rounded-lg bg-amber-600/10 p-2">
                    <p className="text-lg font-bold text-amber-700">{fmtN(cso.passive)}</p>
                    <p className="text-xs text-muted-foreground">Pasif</p>
                  </div>
                </div>
                {(cso.err || cso.error) && <p className="text-xs text-rose-600">{cso.err || cso.error}</p>}
              </>
            ) : <p className="text-muted-foreground">Belum ada data.</p>}
          </CardContent>
        </Card>
        </motion.div>

        {/* CMO */}
        <motion.div variants={fadeUp} whileHover={{ y: -4 }} transition={{ duration: 0.2 }}>
        <Card className="h-full">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center justify-between text-base">
              <span className="flex items-center gap-2"><Megaphone className="h-4 w-4" aria-hidden="true" /> CMO — Draf TikTok</span>
              {cmo?.usedFallback && <Badge variant="outline" className="text-amber-600">fallback</Badge>}
            </CardTitle>
            <CardDescription>Naskah harian gaya CEO</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            {cmo?.draft ? (
              <>
                {cmo.angle && <p className="text-xs text-muted-foreground">Angle: {cmo.angle}</p>}
                <pre className="max-h-48 overflow-y-auto whitespace-pre-wrap rounded-lg bg-muted p-3 font-sans text-sm" style={{ scrollbarWidth: 'thin' }}>
                  {cmo.draft}
                </pre>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={async () => {
                    try { await navigator.clipboard.writeText(cmo.draft || ''); toast.success('Draf dikopi') }
                    catch { toast.error('Gagal mengopi') }
                  }}
                >
                  <Copy className="mr-2 h-3.5 w-3.5" aria-hidden="true" /> Kopi Draf
                </Button>
              </>
            ) : cmo ? <p className="text-sm text-rose-600">{cmo.error || 'Gagal generate draf'}</p>
              : <p className="text-sm text-muted-foreground">Belum ada data.</p>}
          </CardContent>
        </Card>
        </motion.div>

        {/* CFO */}
        <motion.div variants={fadeUp} whileHover={{ y: -4 }} transition={{ duration: 0.2 }}>
        <Card className="h-full">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-base">
              <DollarSign className="h-4 w-4" aria-hidden="true" /> CFO — Kuota API Gemini
            </CardTitle>
            <CardDescription>Gerbang anti-429 (Gemini Vision)</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            {cfo ? (
              <>
                <motion.div
                  initial={{ scaleX: 0 }}
                  animate={{ scaleX: 1 }}
                  transition={{ duration: 0.8, ease: 'easeOut' }}
                  style={{ transformOrigin: 'left' }}
                >
                  <Progress value={quotaPct} aria-label={`Kuota terpakai ${quotaPct}%`} />
                </motion.div>
                <p>Terpakai hari ini: <strong>{fmtN(cfo.usedToday)}</strong> / {fmtN(cfo.limit)}</p>
                <p>Kemarin: <strong>{fmtN(cfo.usedYesterday)}</strong> · Event 429 kemarin: <strong>{fmtN(cfo.quota429)}</strong></p>
                <p className={cfo.status?.startsWith('KRITIS') ? 'font-semibold text-rose-600' : cfo.status?.startsWith('WASPADA') ? 'font-semibold text-amber-600' : 'font-semibold text-emerald-700'}>
                  {cfo.status || '—'}
                </p>
                {(cfo as CfoResult).error && <p className="text-xs text-rose-600">{(cfo as CfoResult).error}</p>}
              </>
            ) : <p className="text-muted-foreground">Belum ada data.</p>}
          </CardContent>
        </Card>
        </motion.div>
      </div>

      {/* ── Briefing ── */}
      {briefing?.text && (
        <motion.div
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.45, ease: 'easeOut' }}
          className="mt-6"
        >
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Morning Briefing</CardTitle>
            <CardDescription>
              {briefing.at ? new Date(briefing.at).toLocaleString('id-ID') : ''}
              {' · '}Discord: {briefing.notifySent
                ? <span className="font-medium text-emerald-700">terkirim ✅</span>
                : <span className="font-medium text-rose-600">gagal{briefing.notifyErr ? ` — ${briefing.notifyErr}` : ''}</span>}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <Separator />
            <pre className="max-h-96 overflow-y-auto whitespace-pre-wrap rounded-lg bg-muted p-4 font-mono text-xs leading-relaxed" style={{ scrollbarWidth: 'thin' }}>
              {briefing.text}
            </pre>
            <Button size="sm" variant="outline" onClick={copyBriefing}>
              <Copy className="mr-2 h-3.5 w-3.5" aria-hidden="true" /> Kopi Teks Briefing
            </Button>
          </CardContent>
        </Card>
        </motion.div>
      )}
    </motion.div>
  )
}
