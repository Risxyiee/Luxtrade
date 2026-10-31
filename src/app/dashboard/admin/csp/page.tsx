'use client'

// CRITICAL: Force dynamic rendering untuk Cloudflare Workers
export const dynamic = 'force-dynamic'

import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import {
  ShieldAlert,
  ArrowLeft,
  RefreshCw,
  Trash2,
  Clock,
  Shield,
  FileWarning,
  Loader2,
  Globe,
  CheckCircle,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { toast } from 'sonner'
import { authFetch } from '@/lib/api-fetch'
import { getClientBrowserAsync } from '@/lib/supabase-browser'

const ADMIN_EMAILS = ['luxtradee@gmail.com']

interface CspGroup {
  effectiveDirective: string
  blockedUri: string
  documentUri: string
  count: number
  firstSeen: string
  lastSeen: string
  sourceFile: string | null
  sample: string | null
}

interface CspRecent {
  id: string
  document_uri: string | null
  effective_directive: string | null
  violated_directive: string | null
  blocked_uri: string | null
  source_file: string | null
  created_at: string
}

interface CspData {
  total: number
  last24h: number
  uniqueDirectives: number
  groups: CspGroup[]
  recent: CspRecent[]
  truncated: boolean
  error?: string
}

const fmtWib = (iso: string) => {
  try {
    return new Intl.DateTimeFormat('id-ID', {
      timeZone: 'Asia/Jakarta',
      day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit',
    }).format(new Date(iso))
  } catch {
    return iso
  }
}

/** Klasifikasi kasar blocked-uri untuk panduan keputusan enforce. */
function classifyBlocked(blockedUri: string): { label: string; variant: 'destructive' | 'secondary' | 'outline' } {
  if (!blockedUri || blockedUri === '(kosong)') return { label: 'inline/eval', variant: 'secondary' }
  if (blockedUri.startsWith('data:') || blockedUri === 'inline' || blockedUri === 'eval') {
    return { label: 'inline/data', variant: 'secondary' }
  }
  if (blockedUri.includes('luxtradee.web.id')) {
    return { label: 'domain sendiri — Wajib dibenahi sebelum diterapkan', variant: 'destructive' }
  }
  return { label: 'pihak ketiga — aman diblokir', variant: 'outline' }
}

export default function CspReportsPage() {
  const router = useRouter()
  const [authed, setAuthed] = useState(false)
  const [loading, setLoading] = useState(true)
  const [clearing, setClearing] = useState(false)
  const [data, setData] = useState<CspData | null>(null)
  const [showRecent, setShowRecent] = useState(false)

  const checkAuth = useCallback(async () => {
    const client = await getClientBrowserAsync()
    if (!client) {
      router.push('/auth/login')
      return
    }
    const { data: { user } } = await client.auth.getUser()
    const email = user?.email?.toLowerCase().trim() || ''
    if (!user || !ADMIN_EMAILS.includes(email)) {
      toast.error('Akses khusus admin')
      router.push('/dashboard')
      return
    }
    setAuthed(true)
  }, [router])

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res = await authFetch('/api/admin/csp-reports', { cache: 'no-store' })
      const json = await res.json()
      if (!res.ok) {
        toast.error(json.error || 'Gagal memuat laporan')
        setData({ total: 0, last24h: 0, uniqueDirectives: 0, groups: [], recent: [], truncated: false, error: json.error })
      } else {
        setData(json)
      }
    } catch {
      toast.error('Koneksi gagal')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    checkAuth().then(load)
  }, [checkAuth, load])

  const clearAll = async () => {
    if (!window.confirm('Hapus SEMUA laporan CSP? Tindakan ini tidak bisa dibatalkan.')) return
    setClearing(true)
    try {
      const res = await authFetch('/api/admin/csp-reports', { method: 'DELETE' })
      if (res.ok) {
        toast.success('Semua laporan dihapus')
        await load()
      } else {
        const json = await res.json().catch(() => ({}))
        toast.error(json.error || 'Gagal membersihkan')
      }
    } catch {
      toast.error('Koneksi gagal')
    } finally {
      setClearing(false)
    }
  }

  if (!authed) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-4">
        <div className="flex items-center gap-3 text-muted-foreground">
          <Loader2 className="h-5 w-5 animate-spin" />
          <span>Memeriksa akses admin…</span>
        </div>
      </div>
    )
  }

  const empty = data && !data.error && data.total === 0

  return (
    <div className="min-h-screen bg-background">
      <main className="max-w-5xl mx-auto p-4 sm:p-6 space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="icon" asChild aria-label="Kembali ke panel admin">
              <Link href="/dashboard/admin">
                <ArrowLeft className="h-5 w-5" />
              </Link>
            </Button>
            <div>
              <h1 className="text-xl sm:text-2xl font-bold flex items-center gap-2">
                <ShieldAlert className="h-6 w-6 text-amber-500" aria-hidden="true" />
                Papan Laporan CSP
              </h1>
              <p className="text-sm text-muted-foreground">
                Pelanggaran Content-Security-Policy (mode report-only — belum memblokir apa pun)
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={load} disabled={loading}>
              <RefreshCw className={`h-4 w-4 mr-1 ${loading ? 'animate-spin' : ''}`} />
              Muat ulang
            </Button>
            <Button variant="destructive" size="sm" onClick={clearAll} disabled={clearing || !data || data.total === 0}>
              {clearing ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <Trash2 className="h-4 w-4 mr-1" />}
              Bersihkan
            </Button>
          </div>
        </div>

        {/* Ringkasan */}
        <div className="grid grid-cols-3 gap-3 sm:gap-4">
          <Card className="p-4">
            <div className="flex items-center gap-2 text-muted-foreground text-xs sm:text-sm">
              <FileWarning className="h-4 w-4" aria-hidden="true" /> Total
            </div>
            <p className="text-2xl sm:text-3xl font-bold mt-1">{data ? data.total : '—'}</p>
            {data?.truncated && <p className="text-[10px] text-muted-foreground mt-1">1.000 terbaru</p>}
          </Card>
          <Card className="p-4">
            <div className="flex items-center gap-2 text-muted-foreground text-xs sm:text-sm">
              <Clock className="h-4 w-4" aria-hidden="true" /> 24 jam
            </div>
            <p className="text-2xl sm:text-3xl font-bold mt-1">{data ? data.last24h : '—'}</p>
          </Card>
          <Card className="p-4">
            <div className="flex items-center gap-2 text-muted-foreground text-xs sm:text-sm">
              <Shield className="h-4 w-4" aria-hidden="true" /> Direktif unik
            </div>
            <p className="text-2xl sm:text-3xl font-bold mt-1">{data ? data.uniqueDirectives : '—'}</p>
          </Card>
        </div>

        {/* Error state */}
        {data?.error && (
          <Card className="border-destructive/50">
            <CardContent className="p-4 flex items-start gap-3">
              <ShieldAlert className="h-5 w-5 text-destructive shrink-0 mt-0.5" aria-hidden="true" />
              <div className="text-sm">
                <p className="font-semibold">Tabel belum siap</p>
                <p className="text-muted-foreground mt-1">{data.error}</p>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Kosong */}
        {empty && (
          <Card>
            <CardContent className="p-8 text-center">
              <CheckCircle className="h-10 w-10 text-emerald-500 mx-auto mb-3" aria-hidden="true" />
              <p className="font-semibold">Belum ada pelanggaran CSP</p>
              <p className="text-sm text-muted-foreground mt-1">
                Bagus — draft CSP cocok dengan kondisi situs saat ini. Papan ini akan terisi otomatis
                begitu browser user melaporkan pelanggaran.
              </p>
            </CardContent>
          </Card>
        )}

        {/* Kelompok pelanggaran */}
        {data && data.groups.length > 0 && (
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base sm:text-lg">Kelompok Pelanggaran</CardTitle>
              <CardDescription className="text-xs sm:text-sm">
                Dikelompokkan per direktif × URL yang diblokir × halaman. Frekuensi tertinggi di atas.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3 max-h-96 overflow-y-auto">
              {data.groups.map((g, i) => {
                const cls = classifyBlocked(g.blockedUri)
                return (
                  <div key={`${g.effectiveDirective}|${g.blockedUri}|${g.documentUri}|${i}`}
                    className="rounded-lg border p-3 space-y-2 hover:bg-muted/40 transition-colors">
                    <div className="flex items-start justify-between gap-2">
                      <Badge variant="outline" className="font-mono text-[10px] sm:text-xs">
                        {g.effectiveDirective}
                      </Badge>
                      <Badge variant={cls.variant} className="text-[10px] sm:text-xs shrink-0">
                        {cls.label}
                      </Badge>
                    </div>
                    <div className="text-xs sm:text-sm space-y-1">
                      <p className="flex items-start gap-1.5">
                        <Globe className="h-3.5 w-3.5 mt-0.5 shrink-0 text-muted-foreground" aria-hidden="true" />
                        <span className="font-mono break-all">{g.blockedUri}</span>
                      </p>
                      <p className="text-muted-foreground break-all">
                        Halaman: <span className="font-mono">{g.documentUri}</span>
                      </p>
                      {g.sourceFile && (
                        <p className="text-muted-foreground break-all">
                          Sumber: <span className="font-mono">{g.sourceFile}</span>
                        </p>
                      )}
                    </div>
                    <div className="flex items-center justify-between text-xs text-muted-foreground">
                      <span>Terakhir: {fmtWib(g.lastSeen)}</span>
                      <Badge variant="secondary">{g.count}×</Badge>
                    </div>
                    {g.sample && (
                      <details className="text-xs">
                        <summary className="cursor-pointer text-muted-foreground hover:text-foreground">
                          Lihat sampel kode
                        </summary>
                        <pre className="mt-1 p-2 rounded bg-muted text-[10px] overflow-x-auto whitespace-pre-wrap break-all">
                          {g.sample}
                        </pre>
                      </details>
                    )}
                  </div>
                )
              })}
            </CardContent>
          </Card>
        )}

        {/* Laporan terbaru (raw) */}
        {data && data.recent.length > 0 && (
          <Card>
            <CardHeader className="pb-3">
              <button
                className="flex items-center justify-between w-full text-left"
                onClick={() => setShowRecent(v => !v)}
                aria-expanded={showRecent}
              >
                <div>
                  <CardTitle className="text-base sm:text-lg">Laporan Terbaru (mentah)</CardTitle>
                  <CardDescription className="text-xs sm:text-sm">{data.recent.length} laporan terakhir</CardDescription>
                </div>
                <Badge variant="secondary">{showRecent ? 'Tutup' : 'Buka'}</Badge>
              </button>
            </CardHeader>
            {showRecent && (
              <CardContent className="space-y-2 max-h-80 overflow-y-auto">
                {data.recent.map((r) => (
                  <div key={r.id} className="rounded border p-2 text-xs space-y-1">
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-mono font-semibold">{r.effective_directive || r.violated_directive || '?'}</span>
                      <span className="text-muted-foreground shrink-0">{fmtWib(r.created_at)}</span>
                    </div>
                    <p className="font-mono text-muted-foreground break-all">
                      {r.blocked_uri || '(kosong)'} ← {r.document_uri || '?'}
                    </p>
                  </div>
                ))}
              </CardContent>
            )}
          </Card>
        )}

        {/* Panduan keputusan */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base sm:text-lg">Cara Membaca Papan Ini</CardTitle>
          </CardHeader>
          <CardContent className="text-xs sm:text-sm text-muted-foreground space-y-2">
            <p>
              <span className="font-semibold text-foreground">Pihak ketiga</span> (iklan, CDN luar, dsb.)
              yang diblokir draft CSP → <span className="text-emerald-600 dark:text-emerald-400 font-medium">aman</span>,
              tidak perlu aksi.
            </p>
            <p>
              <span className="font-semibold text-foreground">Domain sendiri / inline / data:</span> ini berarti
              draft CSP terlalu ketat untuk kode yang ada → <span className="text-amber-600 dark:text-amber-400 font-medium">wajib
              diberi pengecualian di header sebelum CSP dinaikkan ke ENFORCE</span>, kalau tidak fitur bisa rusak.
            </p>
            <p>
              Kalau papan stabil (tidak ada entri domain sendiri yang baru selama ±1 minggu) → CSP siap
              dinaikkan dari <span className="font-mono">Report-Only</span> menjadi ENFORCE.
            </p>
          </CardContent>
        </Card>
      </main>
    </div>
  )
}
