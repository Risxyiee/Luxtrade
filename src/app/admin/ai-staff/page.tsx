'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Textarea } from '@/components/ui/textarea'
import { Input } from '@/components/ui/input'
import { Skeleton } from '@/components/ui/skeleton'
import { authFetch } from '@/lib/api-fetch'
import {
  Bot, Mail, Clapperboard, Sparkles, Send, Check, X, RefreshCw,
  Users, Clock, FileText, TrendingUp, ShieldAlert, Inbox, Zap,
} from 'lucide-react'

// ─── Types ────────────────────────────────────────────────────────────────────
interface CsTask {
  id: string
  agent_type: 'CS'
  target_user_id: string | null
  context_data: {
    email?: string
    fullName?: string
    totalTrades?: number
    joinedAt?: string
  }
  generated_content: {
    subject?: string
    body?: string
    provider?: string
    model?: string
    generatedAt?: string
  }
  status: string
  created_at: string
}

interface TikTokIdea {
  hook: string
  script: string
  caption: string
  cta: string
}

interface MarketingTask {
  id: string
  agent_type: 'MARKETING'
  target_user_id: null
  context_data: {
    audienceSnapshot?: Record<string, unknown>
    generatedForDate?: string
  }
  generated_content: {
    analysis?: string
    ideas?: TikTokIdea[]
    provider?: string
    model?: string
    generatedAt?: string
  }
  status: string
  created_at: string
}

type AnyTask = CsTask | MarketingTask

const ADMIN_EMAIL = 'luxtradee@gmail.com'

function formatDateId(iso?: string): string {
  if (!iso) return '-'
  try {
    return new Date(iso).toLocaleString('id-ID', {
      day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit',
    })
  } catch { return '-' }
}

function providerBadge(provider?: string) {
  if (provider === 'groq') return { label: 'LLM · Groq', className: 'bg-purple-500/15 text-purple-300 border-purple-500/30' }
  if (provider === 'gemini') return { label: 'LLM · Gemini', className: 'bg-purple-500/15 text-purple-300 border-purple-500/30' }
  return { label: 'Template', className: 'bg-gray-500/15 text-gray-300 border-gray-500/30' }
}

// ─── Page ─────────────────────────────────────────────────────────────────────
export default function AiStaffPage() {
  const router = useRouter()
  const [isAdmin, setIsAdmin] = useState(false)
  const [gateLoading, setGateLoading] = useState(true)
  const [tasksLoading, setTasksLoading] = useState(true)
  const [tasks, setTasks] = useState<AnyTask[]>([])
  // Draft email CS yang bisa diedit admin sebelum approve (dipertahankan antar refresh)
  const [csDrafts, setCsDrafts] = useState<Record<string, { subject: string; body: string }>>({})
  const [actingId, setActingId] = useState<string | null>(null)
  const [lastSync, setLastSync] = useState<Date | null>(null)
  const [activeTab, setActiveTab] = useState<'cs' | 'marketing'>('cs')
  const draftsInitialized = useRef<Set<string>>(new Set())

  // ── Admin gate (pola sama dengan /admin-email) ──
  useEffect(() => {
    async function checkAdmin() {
      try {
        const supabase = await (await import('@/lib/supabase-browser')).getClientBrowserAsync()
        if (!supabase) { router.push('/'); return }
        const { data: { session } } = await supabase.auth.getSession()
        const email = session?.user?.email?.toLowerCase()
        if (email === ADMIN_EMAIL) setIsAdmin(true)
        else router.push('/')
      } catch { router.push('/') }
      finally { setGateLoading(false) }
    }
    checkAdmin()
  }, [router])

  // ── Load antrean pending ──
  const loadTasks = useCallback(async (silent = false) => {
    if (!silent) setTasksLoading(true)
    try {
      const res = await authFetch('/api/admin/ai-staff')
      const data = await res.json()
      if (res.ok && data.success) {
        const fresh = (data.tasks || []) as AnyTask[]
        setTasks(fresh)
        setLastSync(new Date())
        // Inisialisasi draft editor untuk task CS baru (jangan timpa editan admin)
        setCsDrafts(prev => {
          const next = { ...prev }
          for (const t of fresh) {
            if (t.agent_type === 'CS' && !draftsInitialized.current.has(t.id)) {
              draftsInitialized.current.add(t.id)
              next[t.id] = {
                subject: t.generated_content?.subject || '',
                body: t.generated_content?.body || '',
              }
            }
          }
          return next
        })
      } else {
        if (!silent) toast.error(data.error || 'Gagal memuat antrean AI Staff')
      }
    } catch {
      if (!silent) toast.error('Network error — gagal memuat antrean')
    } finally {
      setTasksLoading(false)
    }
  }, [])

  useEffect(() => {
    if (isAdmin) loadTasks()
  }, [isAdmin, loadTasks])

  // Auto-refresh tiap 60 detik (silent) — PERF: pause saat tab tidak terlihat
  useEffect(() => {
    if (!isAdmin) return
    const iv = setInterval(() => {
      if (document.visibilityState === 'visible') loadTasks(true)
    }, 60_000)
    return () => clearInterval(iv)
  }, [isAdmin, loadTasks])

  // ── Approve / Reject ──
  const handleAction = useCallback(async (task: AnyTask, action: 'approve' | 'reject') => {
    if (actingId) return
    setActingId(task.id)
    try {
      const payload: Record<string, unknown> = { taskId: task.id, action }
      if (task.agent_type === 'CS' && action === 'approve') {
        const draft = csDrafts[task.id]
        payload.edited = { subject: draft?.subject, body: draft?.body }
      }
      const res = await authFetch('/api/admin/ai-staff', {
        method: 'POST',
        body: JSON.stringify(payload),
      })
      const data = await res.json()
      if (res.ok && data.success) {
        if (action === 'approve') {
          toast.success(data.message || 'Berhasil dieksekusi!', { duration: 6000 })
        } else {
          toast.info(data.message || 'Draf ditolak', { duration: 4000 })
        }
        await loadTasks(true)
      } else {
        toast.error(data.error || 'Gagal memproses task', { duration: 8000 })
      }
    } catch {
      toast.error('Network error — coba lagi')
    } finally {
      setActingId(null)
    }
  }, [actingId, csDrafts, loadTasks])

  // ── Derived lists ──
  const csTasks = tasks.filter((t): t is CsTask => t.agent_type === 'CS')
  const mktTasks = tasks.filter((t): t is MarketingTask => t.agent_type === 'MARKETING')

  // ── Gate loading ──
  if (gateLoading) {
    return (
      <div className="min-h-screen bg-[#05070d] flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <Bot className="w-8 h-8 text-purple-400 animate-pulse" />
          <p className="text-sm text-gray-500">Memverifikasi akses admin…</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-[#05070d] text-white flex flex-col">
      {/* ── Ambient glow (ringan — pure CSS, tanpa gambar) ── */}
      <div aria-hidden className="pointer-events-none fixed inset-0 z-0">
        <div className="absolute -top-32 -left-24 w-96 h-96 rounded-full bg-purple-600/10 blur-3xl" />
        <div className="absolute -top-24 right-0 w-80 h-80 rounded-full bg-emerald-600/[0.07] blur-3xl" />
        <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-[500px] h-40 rounded-full bg-fuchsia-600/[0.04] blur-3xl" />
      </div>

      {/* ── Header ── */}
      <header className="relative border-b border-white/5 bg-[#070a12]/80 backdrop-blur sticky top-0 z-20">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-4 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="relative">
              {/* glow pulse di belakang avatar */}
              <div aria-hidden className="absolute inset-0 rounded-xl bg-purple-500/40 blur-md animate-pulse" />
              <div className="relative w-10 h-10 rounded-xl bg-gradient-to-br from-purple-500/30 to-fuchsia-500/10 border border-purple-400/40 flex items-center justify-center">
                <Bot className="w-5 h-5 text-purple-300" />
              </div>
              {/* titik status: agent aktif */}
              <span
                className="absolute -top-0.5 -right-0.5 w-2.5 h-2.5 rounded-full bg-emerald-400 border-2 border-[#070a12] animate-pulse"
                title="Agents aktif — cron berjalan"
              />
            </div>
            <div>
              <h1 className="text-base sm:text-lg font-bold leading-tight">AI Staff — Approval Center</h1>
              <p className="text-[11px] sm:text-xs text-gray-500">
                Human-in-the-Loop · AI nyiapin draf, kamu yang eksekusi
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {lastSync && (
              <span className="hidden sm:flex items-center gap-1 text-[10px] text-gray-600">
                <Clock className="w-3 h-3" />
                Sync {lastSync.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })}
              </span>
            )}
            <Button
              variant="outline"
              size="sm"
              onClick={() => loadTasks()}
              disabled={tasksLoading}
              className="border-white/10 bg-white/5 hover:bg-white/10 text-gray-300 h-8"
            >
              <RefreshCw className={`w-3.5 h-3.5 mr-1.5 ${tasksLoading ? 'animate-spin' : ''}`} />
              Refresh
            </Button>
          </div>
        </div>
      </header>

      {/* ── Main ── */}
      <main className="relative flex-1 w-full max-w-6xl mx-auto px-4 sm:px-6 py-6">
        {/* ── Kantor AI Staff (visual, pure CSS — 0 gambar, 0 lib tambahan) ── */}
        <OfficeFloor
          csCount={csTasks.length}
          mktCount={mktTasks.length}
          loading={tasksLoading}
          activeTab={activeTab}
          onSelect={setActiveTab}
        />

        {tasksLoading && tasks.length === 0 ? (
          <div className="space-y-4">
            {[0, 1, 2].map(i => (
              <Card key={i} className="bg-[#0a0c12] border-white/5">
                <CardContent className="p-6 space-y-3">
                  <Skeleton className="h-4 w-1/3 bg-white/10" />
                  <Skeleton className="h-20 w-full bg-white/5" />
                  <div className="flex gap-2">
                    <Skeleton className="h-9 w-40 bg-white/10" />
                    <Skeleton className="h-9 w-24 bg-white/5" />
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        ) : (
          <Tabs value={activeTab} onValueChange={v => setActiveTab(v as 'cs' | 'marketing')} className="w-full">
            <TabsList className="bg-[#0a0c12] border border-white/5 h-auto p-1 grid grid-cols-2 w-full sm:inline-grid sm:w-auto gap-1">
              <TabsTrigger
                value="cs"
                className="data-[state=active]:bg-purple-500/20 data-[state=active]:text-purple-300 text-gray-400 text-xs sm:text-sm px-4 py-2 gap-2"
              >
                <Mail className="w-4 h-4" />
                CS Agent
                {csTasks.length > 0 && (
                  <Badge className="bg-purple-500/25 text-purple-200 border-0 text-[10px] px-1.5">{csTasks.length}</Badge>
                )}
              </TabsTrigger>
              <TabsTrigger
                value="marketing"
                className="data-[state=active]:bg-emerald-500/20 data-[state=active]:text-emerald-300 text-gray-400 text-xs sm:text-sm px-4 py-2 gap-2"
              >
                <Clapperboard className="w-4 h-4" />
                Marketing Agent
                {mktTasks.length > 0 && (
                  <Badge className="bg-emerald-500/25 text-emerald-200 border-0 text-[10px] px-1.5">{mktTasks.length}</Badge>
                )}
              </TabsTrigger>
            </TabsList>

            {/* ══════════ TAB: CS AGENT ══════════ */}
            <TabsContent value="cs" className="mt-5 space-y-4">
              {csTasks.length === 0 ? (
                <EmptyState
                  icon={<Inbox className="w-8 h-8 text-gray-600" />}
                  title="Tidak ada draf email pending"
                  subtitle="AI CS Agent belum membuat follow-up baru. Cron berjalan harian — cek lagi nanti."
                />
              ) : (
                csTasks.map(task => {
                  const draft = csDrafts[task.id] || { subject: task.generated_content?.subject || '', body: task.generated_content?.body || '' }
                  const pb = providerBadge(task.generated_content?.provider)
                  const isActing = actingId === task.id
                  return (
                    <Card key={task.id} className="bg-[#0a0c12] border-white/5 hover:border-purple-500/20 transition-colors">
                      <CardHeader className="pb-3">
                        <div className="flex flex-wrap items-start justify-between gap-2">
                          <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-full bg-purple-500/10 border border-purple-500/25 flex items-center justify-center flex-shrink-0">
                              <span className="text-sm font-bold text-purple-300">
                                {(task.context_data?.fullName || task.context_data?.email || '?').charAt(0).toUpperCase()}
                              </span>
                            </div>
                            <div>
                              <CardTitle className="text-sm font-semibold text-white">
                                {task.context_data?.fullName || 'Tanpa nama'}
                              </CardTitle>
                              <p className="text-xs text-gray-500">{task.context_data?.email}</p>
                            </div>
                          </div>
                          <div className="flex flex-wrap items-center gap-1.5">
                            <Badge variant="outline" className={`${pb.className} border text-[10px]`}>{pb.label}</Badge>
                            <Badge variant="outline" className="bg-amber-500/10 text-amber-300 border-amber-500/30 text-[10px]">
                              <Users className="w-3 h-3 mr-1" />0 trades
                            </Badge>
                            <Badge variant="outline" className="bg-white/5 text-gray-400 border-white/10 text-[10px]">
                              <Clock className="w-3 h-3 mr-1" />{formatDateId(task.created_at)}
                            </Badge>
                          </div>
                        </div>
                      </CardHeader>
                      <CardContent className="space-y-3">
                        {/* Subjek (editable) */}
                        <div className="space-y-1.5">
                          <label className="text-[10px] font-semibold uppercase tracking-wide text-gray-500 flex items-center gap-1.5">
                            <FileText className="w-3 h-3" /> Subjek email
                          </label>
                          <Input
                            value={draft.subject}
                            onChange={e => setCsDrafts(p => ({ ...p, [task.id]: { ...draft, subject: e.target.value } }))}
                            className="bg-[#070a12] border-white/10 text-sm text-white placeholder:text-gray-600 focus-visible:ring-purple-500/40"
                            placeholder="Subjek email…"
                          />
                        </div>
                        {/* Body (editable) */}
                        <div className="space-y-1.5">
                          <label className="text-[10px] font-semibold uppercase tracking-wide text-gray-500 flex items-center gap-1.5">
                            <Mail className="w-3 h-3" /> Isi email — bisa diedit sebelum dikirim
                          </label>
                          <Textarea
                            value={draft.body}
                            onChange={e => setCsDrafts(p => ({ ...p, [task.id]: { ...draft, body: e.target.value } }))}
                            className="min-h-[180px] bg-[#070a12] border-white/10 text-sm text-gray-200 leading-relaxed placeholder:text-gray-600 focus-visible:ring-purple-500/40 resize-y"
                            placeholder="Draf email dari AI…"
                          />
                          <p className="text-[10px] text-gray-600 text-right">{draft.body.length} karakter</p>
                        </div>
                        {/* Actions */}
                        <div className="flex flex-col sm:flex-row gap-2 pt-1">
                          <Button
                            onClick={() => handleAction(task, 'approve')}
                            disabled={isActing || !!actingId || !draft.subject.trim() || !draft.body.trim()}
                            className="flex-1 bg-emerald-600 hover:bg-emerald-500 text-white font-semibold h-10"
                          >
                            {isActing ? <RefreshCw className="w-4 h-4 mr-2 animate-spin" /> : <Send className="w-4 h-4 mr-2" />}
                            Approve &amp; Kirim Email
                          </Button>
                          <Button
                            onClick={() => handleAction(task, 'reject')}
                            disabled={isActing || !!actingId}
                            variant="outline"
                            className="sm:w-36 border-red-500/30 text-red-400 hover:bg-red-500/10 hover:text-red-300 h-10"
                          >
                            <X className="w-4 h-4 mr-2" /> Tolak
                          </Button>
                        </div>
                        <p className="text-[10px] text-gray-600 flex items-center gap-1">
                          <ShieldAlert className="w-3 h-3" />
                          Email dikirim asli via Resend ke {task.context_data?.email} begitu di-approve.
                        </p>
                      </CardContent>
                    </Card>
                  )
                })
              )}
            </TabsContent>

            {/* ══════════ TAB: MARKETING AGENT ══════════ */}
            <TabsContent value="marketing" className="mt-5 space-y-4">
              {mktTasks.length === 0 ? (
                <EmptyState
                  icon={<Clapperboard className="w-8 h-8 text-gray-600" />}
                  title="Tidak ada ide konten pending"
                  subtitle="AI Marketing Agent membuat ide baru di jadwal cron — cek lagi nanti."
                />
              ) : (
                mktTasks.map(task => {
                  const pb = providerBadge(task.generated_content?.provider)
                  const ideas = task.generated_content?.ideas || []
                  const isActing = actingId === task.id
                  return (
                    <Card key={task.id} className="bg-[#0a0c12] border-white/5 hover:border-emerald-500/20 transition-colors">
                      <CardHeader className="pb-3">
                        <div className="flex flex-wrap items-start justify-between gap-2">
                          <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-xl bg-emerald-500/10 border border-emerald-500/25 flex items-center justify-center flex-shrink-0">
                              <Clapperboard className="w-5 h-5 text-emerald-400" />
                            </div>
                            <div>
                              <CardTitle className="text-sm font-semibold text-white">Paket Konten TikTok</CardTitle>
                              <p className="text-xs text-gray-500">
                                {ideas.length} ide · untuk periode {task.context_data?.generatedForDate || '-'}
                              </p>
                            </div>
                          </div>
                          <div className="flex flex-wrap items-center gap-1.5">
                            <Badge variant="outline" className={`${pb.className} border text-[10px]`}>{pb.label}</Badge>
                            <Badge variant="outline" className="bg-white/5 text-gray-400 border-white/10 text-[10px]">
                              <Clock className="w-3 h-3 mr-1" />{formatDateId(task.created_at)}
                            </Badge>
                          </div>
                        </div>
                      </CardHeader>
                      <CardContent className="space-y-4">
                        {/* Analisa audiens */}
                        <div className="rounded-lg border border-purple-500/20 bg-purple-500/5 p-4">
                          <p className="text-[10px] font-semibold uppercase tracking-wide text-purple-300 flex items-center gap-1.5 mb-2">
                            <Sparkles className="w-3.5 h-3.5" /> Analisa Audiens (dari AI)
                          </p>
                          <p className="text-xs text-gray-300 leading-relaxed whitespace-pre-wrap">
                            {task.generated_content?.analysis || '-'}
                          </p>
                        </div>

                        {/* 3 ide konten */}
                        <div className="grid gap-3 md:grid-cols-3">
                          {ideas.map((idea, idx) => (
                            <div key={idx} className="rounded-lg border border-white/5 bg-[#070a12] p-4 flex flex-col gap-3">
                              <div className="flex items-center justify-between">
                                <Badge className="bg-emerald-500/15 text-emerald-300 border-0 text-[10px]">Ide #{idx + 1}</Badge>
                                <TrendingUp className="w-3.5 h-3.5 text-gray-600" />
                              </div>
                              <div>
                                <p className="text-[10px] font-semibold uppercase tracking-wide text-gray-500 mb-1">Hook</p>
                                <p className="text-xs font-semibold text-white leading-snug">{idea.hook}</p>
                              </div>
                              <div>
                                <p className="text-[10px] font-semibold uppercase tracking-wide text-gray-500 mb-1">Script</p>
                                <p className="text-[11px] text-gray-300 leading-relaxed whitespace-pre-wrap max-h-40 overflow-y-auto pr-1 ai-staff-scroll">
                                  {idea.script}
                                </p>
                              </div>
                              <div>
                                <p className="text-[10px] font-semibold uppercase tracking-wide text-gray-500 mb-1">Caption</p>
                                <p className="text-[11px] text-gray-400 leading-relaxed">{idea.caption}</p>
                              </div>
                              <div className="mt-auto pt-2 border-t border-white/5">
                                <p className="text-[10px] font-semibold uppercase tracking-wide text-gray-500 mb-1 flex items-center gap-1">
                                  <Zap className="w-3 h-3" /> CTA
                                </p>
                                <p className="text-[11px] text-emerald-300/90 leading-relaxed">{idea.cta}</p>
                              </div>
                            </div>
                          ))}
                        </div>

                        {/* Actions */}
                        <div className="flex flex-col sm:flex-row gap-2">
                          <Button
                            onClick={() => handleAction(task, 'approve')}
                            disabled={isActing || !!actingId}
                            className="flex-1 bg-emerald-600 hover:bg-emerald-500 text-white font-semibold h-10"
                          >
                            {isActing ? <RefreshCw className="w-4 h-4 mr-2 animate-spin" /> : <Check className="w-4 h-4 mr-2" />}
                            Approve — Siap Diproduksi
                          </Button>
                          <Button
                            onClick={() => handleAction(task, 'reject')}
                            disabled={isActing || !!actingId}
                            variant="outline"
                            className="sm:w-36 border-red-500/30 text-red-400 hover:bg-red-500/10 hover:text-red-300 h-10"
                          >
                            <X className="w-4 h-4 mr-2" /> Tolak
                          </Button>
                        </div>
                        <p className="text-[10px] text-gray-600 flex items-center gap-1">
                          <ShieldAlert className="w-3 h-3" />
                          Setelah approve, konten keluar dari antrean &amp; dicatat sebagai selesai.
                        </p>
                      </CardContent>
                    </Card>
                  )
                })
              )}
            </TabsContent>
          </Tabs>
        )}
      </main>

      {/* ── Footer (sticky ke bawah) ── */}
      <footer className="relative mt-auto border-t border-white/5">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-4 flex flex-wrap items-center justify-between gap-2">
          <p className="text-[10px] text-gray-600">
            LuxTradee AI Staff · draf dibuat otomatis oleh cron, eksekusi final selalu butuh approval manusia
          </p>
          <p className="text-[10px] text-gray-700">© {new Date().getFullYear()} Luxtradee</p>
        </div>
      </footer>
    </div>
  )
}

// ─── Empty state helper ───────────────────────────────────────────────────────
function EmptyState({ icon, title, subtitle }: { icon: React.ReactNode; title: string; subtitle: string }) {
  return (
    <Card className="bg-[#0a0c12] border-white/5">
      <CardContent className="py-14 flex flex-col items-center text-center gap-4">
        <div className="relative">
          <div aria-hidden className="absolute inset-0 rounded-full bg-purple-500/20 blur-lg" />
          <div className="relative w-16 h-16 rounded-full bg-white/[0.03] border border-white/10 flex items-center justify-center">
            {icon}
          </div>
        </div>
        <div>
          <p className="text-sm font-semibold text-gray-300">{title}</p>
          <p className="text-xs text-gray-600 mt-1 max-w-sm">{subtitle}</p>
        </div>
      </CardContent>
    </Card>
  )
}

// ══════════════════════════════════════════════════════════════════════════════
// ─── KANTOR AI STAFF — visual "lantai kantor" 100% CSS (0 gambar, 0 chart lib) ──
// Dua workstation: Aily (CS Agent) & Max (Marketing Agent).
// Klik meja → pindah tab antrean agent tsb.
// ══════════════════════════════════════════════════════════════════════════════

type OfficeAccent = 'purple' | 'emerald'

const OFFICE_ACCENTS: Record<OfficeAccent, {
  ring: string; screen: string; text: string; lampGlow: string; plate: string
}> = {
  purple: {
    ring: 'ring-purple-500/40',
    screen: 'from-purple-950/70 via-[#0a0d18] to-[#05070d]',
    text: 'text-purple-300',
    lampGlow: 'bg-purple-400/20',
    plate: 'from-purple-500/25 to-transparent border-purple-500/30',
  },
  emerald: {
    ring: 'ring-emerald-500/40',
    screen: 'from-emerald-950/70 via-[#0a0d18] to-[#05070d]',
    text: 'text-emerald-300',
    lampGlow: 'bg-emerald-400/20',
    plate: 'from-emerald-500/25 to-transparent border-emerald-500/30',
  },
}

// ── Ruangan kantor: dinding + jendela malam + papan kerja + jam dinding ──
function OfficeFloor({
  csCount, mktCount, loading, activeTab, onSelect,
}: {
  csCount: number
  mktCount: number
  loading: boolean
  activeTab: 'cs' | 'marketing'
  onSelect: (tab: 'cs' | 'marketing') => void
}) {
  return (
    <section
      aria-label="Lantai kantor AI Staff"
      className="relative overflow-hidden rounded-2xl border border-white/5 bg-gradient-to-b from-[#0b0f1a] to-[#080b12] mb-5"
    >
      {/* Dinding: jendela + papan kerja + jam */}
      <div className="flex items-start justify-between gap-2 sm:gap-3 px-3 sm:px-6 pt-4">
        <WindowNight />
        <ShiftBoard csCount={csCount} mktCount={mktCount} loading={loading} />
        <WallClock />
      </div>

      {/* Meja kerja kedua agent */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-5 px-3 sm:px-6 pt-3">
        <Workstation
          name="Aily"
          role="Customer Service"
          shift="Harian · 08.00 WIB"
          accent="purple"
          avatar={<Mail className="w-4 h-4 text-purple-300" />}
          busyCount={csCount}
          loading={loading}
          active={activeTab === 'cs'}
          onSelect={() => onSelect('cs')}
        />
        <Workstation
          name="Max"
          role="Content Creator"
          shift="Senin · 10.00 WIB"
          accent="emerald"
          avatar={<Clapperboard className="w-4 h-4 text-emerald-300" />}
          busyCount={mktCount}
          loading={loading}
          active={activeTab === 'marketing'}
          onSelect={() => onSelect('marketing')}
        />
      </div>

      {/* Lantai */}
      <div aria-hidden className="mt-4 h-3 sm:h-4 bg-gradient-to-b from-[#2a3247] via-[#1b2233] to-[#11141d] border-t border-white/10" />
    </section>
  )
}

// ── Satu workstation: monitor + lampu meja + meja kayu + pelat nama ──
function Workstation({
  name, role, shift, accent, avatar, busyCount, loading, active, onSelect,
}: {
  name: string
  role: string
  shift: string
  accent: OfficeAccent
  avatar: React.ReactNode
  busyCount: number
  loading: boolean
  active: boolean
  onSelect: () => void
}) {
  const a = OFFICE_ACCENTS[accent]
  const busy = !loading && busyCount > 0

  return (
    <button
      type="button"
      onClick={onSelect}
      aria-pressed={active}
      aria-label={`Meja ${name} — ${role}, ${busy ? `${busyCount} tugas menunggu approval` : 'antrean kosong'}. Klik untuk lihat antrean.`}
      className={`group relative w-full text-left rounded-xl border p-3 sm:p-4 transition-all duration-200 outline-none focus-visible:ring-2 focus-visible:ring-white/30 ${
        active
          ? `border-white/15 bg-white/[0.04] ring-2 ${a.ring}`
          : 'border-white/5 bg-transparent hover:bg-white/[0.02] hover:border-white/10'
      }`}
    >
      {/* Status badge kanan-atas */}
      <div className="absolute top-2 right-2 z-10">
        {loading ? (
          <span className="inline-flex items-center gap-1 rounded-full border border-white/10 bg-white/5 px-2 py-0.5 text-[9px] text-gray-400">
            <RefreshCw className="w-2.5 h-2.5 animate-spin" /> cek
          </span>
        ) : busy ? (
          <span className="inline-flex items-center gap-1 rounded-full border border-amber-500/30 bg-amber-500/10 px-2 py-0.5 text-[9px] font-medium text-amber-300">
            <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse" aria-hidden />
            {busyCount} menunggu
          </span>
        ) : (
          <span className="inline-flex items-center gap-1 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2 py-0.5 text-[9px] font-medium text-emerald-300">
            <Check className="w-2.5 h-2.5" /> clear
          </span>
        )}
      </div>

      {/* Monitor */}
      <div className="mx-auto w-24 sm:w-28">
        <div className="rounded-md border border-white/10 bg-[#0d1117] p-1 shadow-lg shadow-black/40">
          <div className={`relative aspect-[4/3] rounded-sm bg-gradient-to-b ${a.screen} flex flex-col items-center justify-center overflow-hidden`}>
            {loading ? (
              <>
                <span className="flex gap-1" aria-hidden>
                  <span className="w-1.5 h-1.5 rounded-full bg-white/50 animate-bounce [animation-delay:0ms]" />
                  <span className="w-1.5 h-1.5 rounded-full bg-white/50 animate-bounce [animation-delay:150ms]" />
                  <span className="w-1.5 h-1.5 rounded-full bg-white/50 animate-bounce [animation-delay:300ms]" />
                </span>
                <span className="mt-1.5 text-[7px] uppercase tracking-widest text-gray-500">memuat</span>
              </>
            ) : busy ? (
              <>
                <span className={`text-2xl font-black leading-none ${a.text} tabular-nums`}>{busyCount}</span>
                <span className="mt-1 text-[7px] uppercase tracking-widest text-gray-500">menunggu review</span>
                {/* lampu LED status monitor */}
                <span className="absolute bottom-1 right-1 w-1 h-1 rounded-full bg-amber-400 animate-pulse" aria-hidden />
              </>
            ) : (
              <>
                <Check className="w-4 h-4 text-emerald-400/80" aria-hidden />
                <span className="mt-1 text-[7px] uppercase tracking-widest text-gray-500">antrean kosong</span>
                <span className="absolute bottom-1 right-1 w-1 h-1 rounded-full bg-emerald-400" aria-hidden />
              </>
            )}
            {/* kilau kaca layar */}
            <span aria-hidden className="pointer-events-none absolute inset-0 bg-gradient-to-tr from-transparent via-white/[0.015] to-white/[0.05]" />
          </div>
        </div>
        {/* stand monitor */}
        <div className="mx-auto h-1.5 w-5 rounded-b-sm bg-white/10" aria-hidden />
        <div className="mx-auto h-1 w-14 rounded-full bg-white/15" aria-hidden />
      </div>

      {/* Meja: lampu + mug + table top + kaki */}
      <div className="relative mt-1.5" aria-hidden>
        {/* lampu belajar */}
        <div className="absolute -top-6 left-3 flex flex-col items-center">
          <span className={`w-3.5 h-2 rounded-t-full ${busy ? 'bg-amber-400/90' : 'bg-white/25'} transition-colors`} />
          {busy && <span className={`absolute top-1 left-1/2 -translate-x-1/2 w-8 h-8 rounded-full ${a.lampGlow} blur-lg`} />}
          <span className="w-0.5 h-4 origin-bottom rotate-[20deg] bg-white/20" />
        </div>
        {/* mug kopi */}
        <div className="absolute -top-3 right-4 w-2.5 h-2.5 rounded-b-sm rounded-tl-sm bg-[#7c4a2d]/80 border-l-2 border-[#5b3620]" />
        {/* table top */}
        <div className="h-2 rounded-sm bg-gradient-to-b from-[#4a3b2d] to-[#2b2118] shadow-md shadow-black/40" />
        {/* kaki meja */}
        <div className="flex justify-between px-4">
          <span className="w-1 h-5 sm:h-7 bg-[#2b2118] rounded-b" />
          <span className="w-1 h-5 sm:h-7 bg-[#2b2118] rounded-b" />
        </div>
        {/* bayangan di lantai */}
        <div className="mx-2 h-1 rounded-full bg-black/40 blur-[2px]" />
      </div>

      {/* Pelat nama karyawan */}
      <div className={`mt-3 flex items-center gap-2.5 rounded-lg border bg-gradient-to-r p-2 ${a.plate}`}>
        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-white/15 bg-[#05070d]">
          {avatar}
        </span>
        <span className="min-w-0">
          <span className="block truncate text-xs font-semibold text-white">{name}</span>
          <span className="block truncate text-[10px] text-gray-500">{role} · {shift}</span>
        </span>
        {/* lampu status karyawan */}
        <span
          className={`ml-auto h-2 w-2 shrink-0 rounded-full ${
            loading ? 'bg-gray-500' : busy ? 'bg-amber-400 animate-pulse' : 'bg-emerald-400'
          }`}
          aria-hidden
        />
      </div>
    </button>
  )
}

// ── Jendela malam: langit gradasi + bulan + gedung dengan jendela menyala ──
function WindowNight() {
  const lit = {
    backgroundImage: 'radial-gradient(circle, rgba(250,204,21,0.5) 0.5px, transparent 1.2px)',
    backgroundSize: '4px 5px',
  }
  return (
    <div
      aria-hidden
      className="relative h-12 w-16 shrink-0 overflow-hidden rounded-md border border-white/10 bg-gradient-to-b from-[#101830] to-[#1c2745] sm:h-16 sm:w-24"
    >
      {/* bulan sabit */}
      <span className="absolute right-1.5 top-1 h-2 w-2 rounded-full bg-amber-100/90 sm:h-2.5 sm:w-2.5" />
      <span className="absolute right-1 top-0.5 h-2 w-2 rounded-full bg-[#101830] sm:h-2.5 sm:w-2.5" />
      {/* skyline */}
      <span className="absolute bottom-0 left-0 h-5 w-3 bg-[#0a0f1f]" style={lit} />
      <span className="absolute bottom-0 left-3 h-7 w-2.5 bg-[#0c1224]" style={lit} />
      <span className="absolute bottom-0 right-4 h-6 w-2.5 bg-[#0c1224]" style={lit} />
      <span className="absolute bottom-0 right-0 h-4 w-4 bg-[#0a0f1f]" style={lit} />
      {/* palang jendela */}
      <span className="absolute inset-y-0 left-1/2 w-px bg-white/10" />
      <span className="absolute inset-x-0 top-1/2 h-px bg-white/10" />
    </div>
  )
}

// ── Papan kerja: shift & jumlah tugas per agent ──
function ShiftBoard({ csCount, mktCount, loading }: { csCount: number; mktCount: number; loading: boolean }) {
  return (
    <div className="min-w-0 flex-1 rounded-lg border border-white/10 bg-[#070a12] px-2.5 py-2 sm:px-3">
      <p className="mb-1 text-[8px] font-semibold uppercase tracking-wider text-gray-500 sm:text-[9px]">
        Papan Kerja — WIB
      </p>
      <div className="space-y-0.5">
        <div className="flex items-center gap-1.5 text-[9px] sm:text-[10px]">
          <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-purple-400" aria-hidden />
          <span className="truncate text-gray-300">Aily</span>
          <span className="hidden text-gray-600 sm:inline">harian 08.00</span>
          <span className="ml-auto shrink-0 font-mono tabular-nums text-purple-300">{loading ? '—' : csCount}</span>
        </div>
        <div className="flex items-center gap-1.5 text-[9px] sm:text-[10px]">
          <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-emerald-400" aria-hidden />
          <span className="truncate text-gray-300">Max</span>
          <span className="hidden text-gray-600 sm:inline">Senin 10.00</span>
          <span className="ml-auto shrink-0 font-mono tabular-nums text-emerald-300">{loading ? '—' : mktCount}</span>
        </div>
      </div>
    </div>
  )
}

// ── Jam dinding: waktu client, render setelah mount (aman hydration) ──
function WallClock() {
  const [time, setTime] = useState<string | null>(null)
  useEffect(() => {
    const f = () => setTime(new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }))
    f()
    const iv = setInterval(f, 30_000)
    return () => clearInterval(iv)
  }, [])
  return (
    <div
      aria-hidden
      className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border-2 border-white/15 bg-[#05070d] shadow-inner sm:h-12 sm:w-12"
    >
      <span className="font-mono text-[8px] tabular-nums text-gray-300 sm:text-[10px]">{time ?? '--:--'}</span>
    </div>
  )
}
