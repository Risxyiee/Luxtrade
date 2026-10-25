'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { useRouter } from 'next/navigation'
import dynamic from 'next/dynamic'
import { toast } from 'sonner'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Textarea } from '@/components/ui/textarea'
import { Input } from '@/components/ui/input'
import { Skeleton } from '@/components/ui/skeleton'
import { authFetch } from '@/lib/api-fetch'
import {
  Bot, Mail, Send, Check, X, RefreshCw,
  Users, Clock, FileText, TrendingUp, Inbox,
} from 'lucide-react'

// 3D COO — dimuat lazy, tanpa SSR (three.js berat, gak perlu di server)
const CooEmployee3D = dynamic(() => import('./CooEmployee3D'), {
  ssr: false,
  loading: () => (
    <div className="w-full h-64 sm:h-72 rounded-xl border border-white/5 bg-[#0a0e18] flex items-center justify-center">
      <Bot className="w-7 h-7 text-emerald-400/60 animate-pulse" />
    </div>
  ),
})

// ─── Types ────────────────────────────────────────────────────────────────────
interface CooTask {
  id: string
  agent_type: 'COO'
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
  const [tasks, setTasks] = useState<CooTask[]>([])
  // Draf email COO yang bisa diedit Bos sebelum ACC (dipertahankan antar refresh)
  const [cooDrafts, setCooDrafts] = useState<Record<string, { subject: string; body: string }>>({})
  const [actingId, setActingId] = useState<string | null>(null)
  const [lastSync, setLastSync] = useState<Date | null>(null)
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

  // ── Load antrean pending (hanya COO — CS & Marketing sudah dipensiunkan) ──
  const loadTasks = useCallback(async (silent = false) => {
    if (!silent) setTasksLoading(true)
    try {
      const res = await authFetch('/api/admin/ai-staff')
      const data = await res.json()
      if (res.ok && data.success) {
        const fresh = (data.tasks || []) as CooTask[]
        setTasks(fresh)
        setLastSync(new Date())
        // Inisialisasi draft editor untuk task baru (jangan timpa editan Bos)
        setCooDrafts(prev => {
          const next = { ...prev }
          for (const t of fresh) {
            if (!draftsInitialized.current.has(t.id)) {
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
        if (!silent) toast.error(data.error || 'Gagal memuat antrean COO')
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
  const handleAction = useCallback(async (task: CooTask, action: 'approve' | 'reject') => {
    if (actingId) return
    setActingId(task.id)
    try {
      const payload: Record<string, unknown> = { taskId: task.id, action }
      if (action === 'approve') {
        const draft = cooDrafts[task.id]
        payload.edited = { subject: draft?.subject, body: draft?.body }
      }
      const res = await authFetch('/api/admin/ai-staff', {
        method: 'POST',
        body: JSON.stringify(payload),
      })
      const data = await res.json()
      if (res.ok && data.success) {
        if (action === 'approve') {
          toast.success(data.message || 'Email penawaran terkirim! 💸', { duration: 6000 })
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
  }, [actingId, cooDrafts, loadTasks])

  // ── Gate loading ──
  if (gateLoading) {
    return (
      <div className="min-h-screen bg-[#05070d] flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <Bot className="w-8 h-8 text-emerald-400 animate-pulse" />
          <p className="text-sm text-gray-500">Memverifikasi akses admin…</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-[#05070d] text-white flex flex-col">
      {/* ── Ambient glow (ringan — pure CSS, tanpa gambar) ── */}
      <div aria-hidden className="pointer-events-none fixed inset-0 z-0">
        <div className="absolute -top-32 -left-24 w-96 h-96 rounded-full bg-emerald-600/10 blur-3xl" />
        <div className="absolute -top-24 right-0 w-80 h-80 rounded-full bg-amber-500/[0.06] blur-3xl" />
        <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-[500px] h-40 rounded-full bg-emerald-600/[0.05] blur-3xl" />
      </div>

      {/* ── Header ── */}
      <header className="relative border-b border-white/5 bg-[#070a12]/80 backdrop-blur sticky top-0 z-20">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-4 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="relative">
              {/* glow pulse di belakang avatar */}
              <div aria-hidden className="absolute inset-0 rounded-xl bg-emerald-500/40 blur-md animate-pulse" />
              <div className="relative w-10 h-10 rounded-xl bg-gradient-to-br from-emerald-500/30 to-amber-500/10 border border-emerald-400/40 flex items-center justify-center">
                <Bot className="w-5 h-5 text-emerald-300" />
              </div>
              {/* titik status: agent aktif */}
              <span
                className="absolute -top-0.5 -right-0.5 w-2.5 h-2.5 rounded-full bg-emerald-400 border-2 border-[#070a12] animate-pulse"
                title="COO aktif — cron harian 08.00 WIB"
              />
            </div>
            <div>
              <h1 className="text-base sm:text-lg font-bold leading-tight">AI Staff · COO Jualan 💸</h1>
              <p className="text-[11px] sm:text-xs text-gray-500">
                Karyawan tunggal dashboard — buru hot lead &amp; konversi PRO · Bos tinggal ACC
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
        {/* ── Kantor 3D Raka (Three.js) ── */}
        <section aria-label="Meja 3D karyawan COO" className="mb-5">
          <CooEmployee3D
            pendingCount={tasksLoading ? 0 : tasks.length}
            loading={tasksLoading}
            onPoke={() => {
              if (tasksLoading) return
              toast.info(
                tasks.length > 0
                  ? `🫡 Siap Bos! ${tasks.length} hot lead nunggu ACC — buran check bawah!`
                  : '🫡 Siap Bos! Antrean bersih — aku mulai buru lead baru besok pagi.',
                { duration: 3500 },
              )
            }}
          />
        </section>

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
          <div className="space-y-4">
            {/* ── Info shift COO ── */}
            <Card className="bg-[#0a0c12] border-emerald-500/15">
              <CardContent className="p-4 flex flex-wrap items-center gap-x-5 gap-y-2 text-xs text-gray-400">
                <span className="flex items-center gap-1.5">
                  <TrendingUp className="w-3.5 h-3.5 text-emerald-400" />
                  Target: <b className="text-gray-200">free user paling aktif 7 hari</b> → tawarin PRO
                </span>
                <span className="flex items-center gap-1.5">
                  <Clock className="w-3.5 h-3.5 text-emerald-400" />
                  Shift: harian 08.00 WIB (cron otomatis)
                </span>
                <span className="flex items-center gap-1.5">
                  <Users className="w-3.5 h-3.5 text-emerald-400" />
                  Anti-spam: 1 lead max 1× per 7 hari
                </span>
                <span className="ml-auto text-[10px] text-gray-600">
                  CS &amp; Marketing lama sudah dipensiunkan — nggak bentrok lagi sama Kantor CEO
                </span>
              </CardContent>
            </Card>

            {/* ── Antrean draf jualan ── */}
            {tasks.length === 0 ? (
              <EmptyState
                icon={<Inbox className="w-8 h-8 text-gray-600" />}
                title="Tidak ada draf penawaran pending"
                subtitle="COO belum menemukan hot lead baru. Cron jalan harian 08.00 WIB — cek lagi nanti, atau tinggal tunggu notif Telegram."
              />
            ) : (
              tasks.map(task => {
                const draft = cooDrafts[task.id] || { subject: task.generated_content?.subject || '', body: task.generated_content?.body || '' }
                const pb = providerBadge(task.generated_content?.provider)
                const isActing = actingId === task.id
                const trades = task.context_data?.totalTrades ?? 0
                return (
                  <Card key={task.id} className="bg-[#0a0c12] border-white/5 hover:border-emerald-500/20 transition-colors">
                    <CardHeader className="pb-3">
                      <div className="flex flex-wrap items-start justify-between gap-2">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-full bg-emerald-500/10 border border-emerald-500/25 flex items-center justify-center flex-shrink-0">
                            <span className="text-sm font-bold text-emerald-300">
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
                          <Badge variant="outline" className="bg-emerald-500/10 text-emerald-300 border-emerald-500/30 text-[10px]">
                            <TrendingUp className="w-3 h-3 mr-1" />{trades} trades/7hr — HOT 🔥
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
                          <FileText className="w-3 h-3" /> Subjek email penawaran
                        </label>
                        <Input
                          value={draft.subject}
                          onChange={e => setCooDrafts(p => ({ ...p, [task.id]: { ...draft, subject: e.target.value } }))}
                          className="bg-[#070a12] border-white/10 text-sm text-white placeholder:text-gray-600 focus-visible:ring-emerald-500/40"
                          placeholder="Subjek email…"
                        />
                      </div>
                      {/* Body (editable) */}
                      <div className="space-y-1.5">
                        <label className="text-[10px] font-semibold uppercase tracking-wide text-gray-500 flex items-center gap-1.5">
                          <Mail className="w-3 h-3" /> Isi email — bisa diedit sebelum ACC
                        </label>
                        <Textarea
                          value={draft.body}
                          onChange={e => setCooDrafts(p => ({ ...p, [task.id]: { ...draft, body: e.target.value } }))}
                          className="min-h-[180px] bg-[#070a12] border-white/10 text-sm text-gray-200 leading-relaxed placeholder:text-gray-600 focus-visible:ring-emerald-500/40 resize-y"
                          placeholder="Draf penawaran dari COO…"
                        />
                        <p className="text-[10px] text-gray-600 text-right">{draft.body.length} karakter</p>
                      </div>
                      {/* Actions */}
                      <div className="flex flex-wrap items-center gap-2 pt-1">
                        <Button
                          size="sm"
                          disabled={isActing}
                          onClick={() => handleAction(task, 'approve')}
                          className="bg-emerald-500 hover:bg-emerald-400 text-[#05201a] font-semibold h-9"
                        >
                          {isActing ? (
                            <RefreshCw className="w-3.5 h-3.5 mr-1.5 animate-spin" />
                          ) : (
                            <Send className="w-3.5 h-3.5 mr-1.5" />
                          )}
                          ACC &amp; Kirim Email 💸
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          disabled={isActing}
                          onClick={() => handleAction(task, 'reject')}
                          className="border-white/10 bg-white/5 hover:bg-white/10 text-gray-400 h-9"
                        >
                          <X className="w-3.5 h-3.5 mr-1.5" />
                          Tolak
                        </Button>
                        <span className="ml-auto text-[10px] text-gray-600 flex items-center gap-1">
                          <Check className="w-3 h-3 text-emerald-500/60" />
                          Email terkirim via Resend setelah ACC
                        </span>
                      </div>
                    </CardContent>
                  </Card>
                )
              })
            )}
          </div>
        )}
      </main>

      {/* ── Footer (sticky bawah) ── */}
      <footer className="relative mt-auto border-t border-white/5 bg-[#070a12]/80">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-3 flex flex-wrap items-center justify-between gap-2 text-[10px] text-gray-600">
          <span>Luxtradee · AI Staff — Human-in-the-Loop · COO nyiapin, Bos yang ACC</span>
          <span>Karyawan di Kantor CEO (/kantor-ceo): CTO · CSO · CMO · CFO</span>
        </div>
      </footer>
    </div>
  )
}

function EmptyState({ icon, title, subtitle }: { icon: React.ReactNode; title: string; subtitle: string }) {
  return (
    <Card className="bg-[#0a0c12] border-white/5">
      <CardContent className="py-14 flex flex-col items-center text-center gap-4">
        <div className="relative">
          <div aria-hidden className="absolute inset-0 rounded-full bg-emerald-500/20 blur-lg" />
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
