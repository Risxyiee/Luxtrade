'use client'
// ============================================================
// KpiPanel — "LAPORAN KPI KARYAWAN" (roadmap #4).
// Angka NYATA per karyawan AI dari /api/ceo-agent?action=kpi —
// read-only, TANPA LLM: semua angka datang dari database & agent_kv
// (office_memory, blog_posts, tiktok_posts, ai_pending_*,
// bug_reports, profiles) jadi mustahil dikarang.
//
// Aturan kantor: TANPA EMOJI di UI. Auto-refresh 5 menit + tombol
// muat ulang. Grid responsif 1/2/3 kolom, tinggi kartu seragam,
// daftar panjang punya scroll sendiri (kscroll).
// ============================================================
import { useCallback, useEffect, useState } from 'react'
import { RefreshCw } from 'lucide-react'
import { getClientBrowserAsync } from '@/lib/supabase-browser'

interface KpiRow { label: string; value: string }
interface KpiAgent {
  id: string
  nama: string
  jabatan: string
  color: string
  rows: KpiRow[]
  lastOut?: string
  belajar?: string
  mem7d: number
  lastWork?: string
}
interface KpiTotals {
  blog: number; blog7: number
  tiktok: number; tiktok7: number
  views: number; likes: number; comments: number
  pendingAcc: number
  users: number; pro: number; estMRR: number
}
interface KpiData {
  ok: boolean
  at: string
  day: string
  belajarToday: number
  totals: KpiTotals
  agents: KpiAgent[]
  error?: string
}

const fmtN = (n: number) => (n >= 0 ? n.toLocaleString('id-ID') : '-')
const fmtRp = (n: number) => 'Rp' + n.toLocaleString('id-ID')

function MiniStat({ label, value, hint, color }: { label: string; value: string; hint?: string; color: string }) {
  return (
    <div className="rounded-xl px-2.5 py-2 min-w-0" style={{ background: `${color}12`, border: `1px solid ${color}33` }}>
      <div className="text-[13px] font-bold leading-tight truncate tabular-nums" style={{ color }}>{value}</div>
      <div className="text-[9px] uppercase tracking-wider text-white/45 truncate">{label}</div>
      {hint ? <div className="text-[9px] text-white/35 truncate">{hint}</div> : null}
    </div>
  )
}

function AgentKpiCard({ a }: { a: KpiAgent }) {
  const bright = a.color
  return (
    <div className="rounded-2xl border overflow-hidden flex flex-col" style={{ borderColor: `${bright}44`, background: 'rgba(255,255,255,0.03)' }}>
      {/* Kepala kartu */}
      <div className="flex items-center gap-2 px-3 py-2" style={{ background: `${bright}14` }}>
        <span
          className="w-8 h-8 rounded-full grid place-items-center text-[13px] font-bold shrink-0"
          style={{ background: `${bright}22`, border: `1px solid ${bright}55`, color: bright }}
          aria-hidden="true"
        >{a.nama.charAt(0)}</span>
        <span className="min-w-0 flex-1">
          <span className="flex items-center gap-1.5">
            <span className="text-[12px] font-bold text-white truncate">{a.nama}</span>
            <span className="text-[8.5px] font-bold px-1.5 py-0.5 rounded-full tracking-wide shrink-0" style={{ background: `${bright}1a`, color: bright }}>{a.id}</span>
          </span>
          <span className="block text-[9.5px] text-white/45 truncate">{a.jabatan}</span>
        </span>
        <span className="text-right shrink-0">
          <span className="block text-[13px] font-bold leading-none tabular-nums" style={{ color: bright }}>{fmtN(a.mem7d)}</span>
          <span className="block text-[8.5px] text-white/40 uppercase tracking-wide">kerja 7 hr</span>
        </span>
      </div>

      {/* Isi KPI */}
      <div className="px-3 py-2 flex flex-col gap-1 flex-1">
        {a.rows.map((r, i) => (
          <div key={i} className="flex items-baseline justify-between gap-2 text-[10.5px] leading-snug">
            <span className="text-white/50 shrink min-w-0">{r.label}</span>
            <span className="text-white/90 font-semibold text-right tabular-nums shrink-0">{r.value}</span>
          </div>
        ))}
        {!a.rows.length ? (
          <div className="text-[10.5px] text-white/50">Memantau komentar &amp; peluang growth — hasilnya dicatat ke memori kerjanya.</div>
        ) : null}

        {a.belajar ? (
          <div className="rounded-lg bg-amber-400/10 border border-amber-300/20 px-2 py-1.5 text-[10px] leading-snug">
            <span className="text-amber-300/90 font-semibold">Akademi hari ini:</span> <span className="text-white/75">{a.belajar}</span>
          </div>
        ) : null}
        {a.lastOut ? (
          <div className="rounded-lg bg-white/5 border border-white/10 px-2 py-1.5 text-[10px] leading-snug text-white/60 italic line-clamp-2">
            &ldquo;{a.lastOut}&rdquo;
          </div>
        ) : null}

        <div className="mt-auto pt-1 text-[9px] text-white/35">
          {a.lastWork ? `Aktivitas kerja terakhir: ${a.lastWork}` : 'Belum ada catatan kerja tersimpan'}
        </div>
      </div>
    </div>
  )
}

export default function KpiPanel() {
  const [data, setData] = useState<KpiData | null>(null)
  const [busy, setBusy] = useState(true)
  const [err, setErr] = useState('')

  const load = useCallback(async () => {
    setBusy(true)
    setErr('')
    try {
      const sb = await getClientBrowserAsync()
      let token = ''
      if (sb) {
        const { data: sd } = await sb.auth.getSession()
        token = sd?.session?.access_token || ''
      }
      const res = await fetch('/api/ceo-agent?action=kpi', {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
        cache: 'no-store',
      })
      const js = (await res.json()) as KpiData
      if (res.ok && js?.ok) setData(js)
      else setErr(String(js?.error || `HTTP ${res.status}`))
    } catch (x: unknown) {
      setErr(String(x instanceof Error ? x.message : x))
    } finally {
      setBusy(false)
    }
  }, [])

  useEffect(() => {
    load()
    const iv = setInterval(load, 5 * 60_000)
    return () => clearInterval(iv)
  }, [load])

  const t = data?.totals

  return (
    <div className="rounded-2xl border border-white/10 bg-white/5 p-4 flex flex-col gap-2.5">
      {/* Header */}
      <div className="flex items-center gap-2 flex-wrap">
        <b className="text-emerald-200 text-[13px]">Laporan KPI Karyawan</b>
        <span className="text-[9.5px] text-white/40">angka nyata dari database — bukan karangan AI{data?.day ? ` · per ${data.day} WIB` : ''}</span>
        <button
          onClick={load}
          disabled={busy}
          className="ml-auto inline-flex items-center gap-1.5 text-[10.5px] px-2.5 py-1.5 rounded-lg border border-teal-300/30 bg-teal-400/10 text-teal-200 hover:bg-teal-400/20 transition-colors cursor-pointer disabled:opacity-40"
          aria-label="Muat ulang KPI"
        >
          <RefreshCw size={12} className={busy ? 'animate-spin' : ''} aria-hidden="true" />
          {busy ? 'Menghitung...' : 'Muat ulang'}
        </button>
      </div>

      {/* Strip ringkasan */}
      {t ? (
        <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-6 gap-2">
          <MiniStat label="Artikel SEO terbit" value={fmtN(t.blog)} hint={`7 hari: ${fmtN(t.blog7)}`} color="#ea580c" />
          <MiniStat label="Video TikTok" value={fmtN(t.tiktok)} hint={`7 hari: ${fmtN(t.tiktok7)}`} color="#7c3aed" />
          <MiniStat label="Total views TikTok" value={fmtN(t.views)} hint={`${fmtN(t.likes)} like`} color="#8b5cf6" />
          <MiniStat label="Draf nunggu ACC Bos" value={fmtN(t.pendingAcc)} hint="semua agen" color="#10b981" />
          <MiniStat label="User / PRO" value={`${fmtN(t.users)} / ${fmtN(t.pro)}`} hint={t.estMRR > 0 ? fmtRp(t.estMRR) : 'est. MRR'} color="#f59e0b" />
          <MiniStat label="Akademi hari ini" value={`${fmtN(data?.belajarToday ?? 0)} karyawan`} hint="sesi belajar pagi" color="#06b6d4" />
        </div>
      ) : null}

      {err ? <div className="text-[11px] text-red-300">Gagal memuat KPI: {err.slice(0, 140)}</div> : null}
      {!busy && !err && !data ? <div className="text-[11px] text-white/45">Belum ada data KPI.</div> : null}

      {/* Grid kartu karyawan */}
      {data?.agents?.length ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-2 max-h-[28rem] overflow-y-auto kscroll pr-1">
          {data.agents.map((a) => <AgentKpiCard key={a.id} a={a} />)}
        </div>
      ) : busy && !data ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-2">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="rounded-2xl border border-white/10 bg-white/5 h-32 animate-pulse" aria-hidden="true" />
          ))}
        </div>
      ) : null}

      <div className="text-[9.5px] text-white/35 leading-relaxed">
        Sumber: office_memory (laporan kerja &amp; akademi), blog_posts, tiktok_posts, ai_pending_actions/tasks, bug_reports, profiles, agent_kv. Angka dihitung langsung di server tiap kali panel dimuat — karyawan AI tidak bisa menaikkan nilainya sendiri.
      </div>
    </div>
  )
}
