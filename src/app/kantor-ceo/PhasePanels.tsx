'use client'
// ============================================================
// PhasePanels — panel FASE BISNIS + ARTEFAK karyawan AI.
// Dipakai RuangCeoDashboard. Data dari GET /api/ceo-agent?action=phase
// (token login Bos, pola sama dengan StaffMemory). TANPA EMOJI.
// Tambalan fase bisnis — PATCH C (sumber: upload PATCH.md):
//   - PhasePanel        → kartu fase di Ringkasan + tombol kerja manual
//   - RoleArtifacts     → artefak per ruangan karyawan
//   - PRE_LAUNCH_TUGAS  → tugas aktif saat pre-launch (kartu karyawan)
//   - ROOM_ROLE         → id ruangan dashboard → kunci role artefak
// CATATAN ADAPTASI: route repo memakai action `art-list` / `art-body`
//   (bukan `artifact` seperti draf tambalan) — response { id, body } sama.
// ============================================================
import { useCallback, useEffect, useState } from 'react'
import { ChevronDown } from 'lucide-react'
import { getClientBrowserAsync } from '@/lib/supabase-browser'

export interface ArtifactMeta {
  id: string; role: string; kind: string; label: string; title: string; preview: string; at: string; who: string
}
export interface PhaseData {
  phase: { phase: 'pre-launch' | 'early' | 'growth'; users: number; trades7d: number; forced?: boolean }
  launch: { idx: number; total: number; text: string } | null
  artifacts: ArtifactMeta[]
}

const EMOJI_RE = /[\u{2300}-\u{23FF}\u{2600}-\u{27BF}\u{2B00}-\u{2BFF}\u{1F000}-\u{1FAFF}\u{FE0F}\u{200D}]/gu
const clean = (s: unknown) => String(s ?? '').replace(EMOJI_RE, '').replace(/ {2,}/g, ' ').trim()

const BTN = 'font-[inherit] text-xs px-3 py-2 rounded-xl border border-teal-300/30 bg-teal-400/10 text-teal-200 hover:bg-teal-400/20 transition-colors cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed'

export const PHASE_LABEL: Record<string, string> = {
  'pre-launch': 'Pre-launch',
  early: 'Early',
  growth: 'Growth',
}
const PHASE_NOTE: Record<string, string> = {
  'pre-launch': 'Belum ada cukup user/trade. Karyawan fokus menghasilkan user pertama, bukan menganalisis data kosong.',
  early: 'User mulai ada. Analisis data aktif lagi, dengan ambang sampel minimum.',
  growth: 'Data cukup. Semua analisis dan A/B berjalan penuh.',
}

/** id ruangan dashboard → kunci role artefak */
export const ROOM_ROLE: Record<string, string> = {
  CTO: 'cto', CSO: 'cso', CMO: 'cmo', CFO: 'cfo', COO: 'coo', GH: 'gh', KEVIN: 'kevin',
}

/** Tugas yang AKTIF saat pre-launch — ditampilkan di kartu karyawan */
export const PRE_LAUNCH_TUGAS: Record<string, string[]> = {
  CEO: [
    'Satu target: 10 user pertama.',
    'Prioritas harian diambil dari checklist peluncuran berurutan; maju ke langkah berikutnya hanya kalau Bos menjawab OKE.',
    'Briefing singkat tanpa LLM tiap hari; briefing penuh hanya Senin.',
  ],
  CTO: [
    'Watchdog 15 menit tetap jalan 24/7.',
    'QA 15 route + E2E login cukup mingguan (Senin).',
    'Kamis: audit SEO teknis (title, meta description, H1, canonical, sitemap, robots) lewat HTTP fetch.',
    'LLM triage hanya jalan kalau ada bug baru.',
  ],
  CSO: [
    'Senin: rancangan onboarding (3 email sambutan, 8 FAQ, hambatan jalur daftar sampai upload pertama).',
    'Email ke user yang daftar tapi belum pernah upload tetap jalan.',
    'Diskusi CSO x CMO dimatikan sampai ada data.',
  ],
  CMO: [
    'Draf harian memakai pilar rotasi 7 hari berbasis edukasi trading umum, bukan data user.',
    'Minggu: kalender konten 7 hari (repurpose satu ide ke TikTok, IG, thread).',
    'Rabu: 1 artikel SEO. Judul 10 draf terakhir dimasukkan ke prompt supaya tidak mengulang.',
    'Caption IG berbasis data komunitas dimatikan sampai data cukup.',
  ],
  CFO: [
    'Senin: titik impas dan runway (biaya tetap / harga PRO), tetap 100% matematika.',
    'Butuh env FIXED_COST_IDR dan CASH_IDR supaya angkanya terhitung.',
    'Gerbang kuota dan alarm 80% tetap.',
  ],
  DA: [
    'Di bawah 50 trade: tidak memanggil LLM, status "data belum cukup".',
    'Data sama dengan analisis sebelumnya: dilewati (hemat kuota, tidak ada laporan kembar).',
    'Analisis penuh menyala otomatis begitu sampel cukup.',
  ],
  GH: [
    'A/B CTA ditunda sampai ada traffic.',
    'Selasa: 1 eksperimen akuisisi per minggu; output sebelumnya jadi buku catatan agar tidak mengulang.',
  ],
  KEVIN: [
    'Sentinel tetap diam saat sepi.',
    'Jumat: 3 draf jawaban community seeding (edukasi, bukan promosi) untuk diposting manual oleh Bos.',
  ],
  COO: [
    'Selasa: paket outbound (jenis target + kata kunci pencarian, 2 draf pesan kolaborasi, 1 draf postingan komunitas).',
    'Semua dikirim manual oleh Bos. Penawaran PRO ke free user baru jalan setelah ada free user aktif.',
  ],
}

async function ownerFetch(query: string): Promise<any> {
  const sb = await getClientBrowserAsync()
  let token = ''
  if (sb) {
    const { data } = await sb.auth.getSession()
    token = data?.session?.access_token || ''
  }
  const res = await fetch(`/api/ceo-agent?${query}`, {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
    cache: 'no-store',
  })
  return res.json()
}

export function usePhaseData(active: boolean) {
  const [data, setData] = useState<PhaseData | null>(null)
  const [loading, setLoading] = useState(false)
  const reload = useCallback(async () => {
    setLoading(true)
    try {
      const js = await ownerFetch('action=phase')
      if (js?.phase) setData(js as PhaseData)
    } catch { /* panel tetap tampil data lama */ } finally { setLoading(false) }
  }, [])
  useEffect(() => { if (active) void reload() }, [active, reload])
  return { data, loading, reload }
}

function ArtifactItem({ a }: { a: ArtifactMeta }) {
  const [open, setOpen] = useState(false)
  const [body, setBody] = useState<string | null>(null)
  const [err, setErr] = useState('')
  const [copied, setCopied] = useState(false)

  const toggle = async () => {
    const next = !open
    setOpen(next)
    if (next && body === null) {
      try {
        /* Route repo: action=art-body&id=... (draf tambalan memakai `artifact`) */
        const js = await ownerFetch(`action=art-body&id=${encodeURIComponent(a.id)}`)
        if (js?.body) setBody(String(js.body)); else setErr('Isi artefak tidak ditemukan.')
      } catch { setErr('Gagal memuat isi artefak.') }
    }
  }
  return (
    <div className="rounded-xl border border-white/10 bg-white/5 mb-1.5">
      <button onClick={toggle} aria-expanded={open} className="w-full flex items-center gap-2 px-2.5 py-2 text-left cursor-pointer hover:bg-white/5 transition-colors">
        <span className="min-w-0 flex-1">
          <span className="block text-[11px] font-semibold text-white/90 truncate">{clean(a.title)}</span>
          <span className="block text-[9.5px] text-white/45 truncate">{a.who} · {a.label} · {String(a.at || '').slice(5, 10)}</span>
        </span>
        <ChevronDown size={13} className={`text-white/35 shrink-0 transition-transform ${open ? 'rotate-180' : ''}`} aria-hidden="true" />
      </button>
      {open && (
        <div className="px-2.5 pb-2.5">
          {err ? <div className="text-red-300 text-[10.5px]">{err}</div> : body === null ? <div className="text-white/45 text-[10.5px]">Memuat...</div> : (
            <>
              <div className="whitespace-pre-wrap text-[11px] leading-relaxed text-white/80 max-h-52 overflow-y-auto rounded-lg bg-black/20 border border-white/10 p-2">{body}</div>
              <div className="mt-1.5 flex items-center gap-2">
                <button className={BTN} onClick={async () => { try { await navigator.clipboard.writeText(body); setCopied(true); setTimeout(() => setCopied(false), 1800) } catch { /* abaikan */ } }}>Salin</button>
                {copied ? <span className="text-emerald-300 text-[10.5px]">tersalin</span> : null}
              </div>
            </>
          )}
        </div>
      )}
    </div>
  )
}

/** Daftar artefak satu karyawan — tampil di bawah panel ruangannya */
export function RoleArtifacts({ role, artifacts }: { role: string; artifacts: ArtifactMeta[] }) {
  const mine = artifacts.filter((a) => a.role === role)
  if (!mine.length) return null
  return (
    <div className="mt-3 bg-white/5 border border-white/10 rounded-2xl p-3">
      <div className="text-[9px] font-bold uppercase tracking-wider text-teal-300/80 mb-1.5">Artefak terbaru karyawan ini</div>
      {mine.slice(0, 5).map((a) => <ArtifactItem key={a.id} a={a} />)}
      <div className="text-white/35 text-[9.5px]">Draf untuk dikirim atau diposting manual oleh Bos.</div>
    </div>
  )
}

/** Kartu fase di Ringkasan: fase aktif, progres target, langkah checklist, tombol kerja manual */
export function PhasePanel({ data, loading, reload }: { data: PhaseData | null; loading: boolean; reload: () => void }) {
  const [running, setRunning] = useState(false)
  const [msg, setMsg] = useState('')
  if (!data) return <div className="text-white/45 text-[10.5px]">{loading ? 'Memuat fase bisnis...' : 'Fase bisnis belum terbaca.'}</div>

  const p = data.phase
  const users = p.users >= 0 ? p.users : 0
  const pct = Math.min(100, Math.round((users / 10) * 100))
  const run = async () => {
    setRunning(true); setMsg('')
    try {
      const js = await ownerFetch('action=work')
      /* Bentuk response repo: { ok, ...WorkResult } (spread di root) —
         draf tambalan memakai { ok, work }; dua-duanya didukung. */
      const w = js?.work || js
      setMsg(js?.ok === false ? clean(js.error || 'gagal')
        : w ? `Terjadwal hari ini: ${w.scheduled?.length || 0} · jadi: ${w.made?.length || 0} · gagal: ${w.failed?.length || 0}${w.failed?.length ? ' (' + clean(w.failed[0]) + ')' : ''}`
        : 'Selesai.')
      reload()
    } catch { setMsg('Gagal menjalankan.') } finally { setRunning(false) }
  }
  return (
    <div className="rounded-xl bg-violet-400/10 border border-violet-300/20 px-2.5 py-2 text-[10.5px] leading-relaxed text-white/80">
      <div className="flex items-center gap-2 flex-wrap">
        <b className="text-violet-200 text-[11.5px]">Fase bisnis: {PHASE_LABEL[p.phase] || p.phase}</b>
        {p.forced ? <span className="text-[9px] bg-amber-400/15 text-amber-200 rounded-full px-1.5 py-0.5">dipaksa lewat PHASE_OVERRIDE</span> : null}
      </div>
      <div className="text-white/60 mt-0.5">{PHASE_NOTE[p.phase]}</div>
      <div className="text-white/50 text-[10px] mt-0.5">Pendaftar {p.users >= 0 ? p.users : '-'} · trade 7 hari {p.trades7d >= 0 ? p.trades7d : '-'}</div>
      {p.phase === 'pre-launch' && (
        <>
          <div className="mt-1.5 h-1.5 rounded-full bg-white/10 overflow-hidden"><div className="h-full rounded-full bg-violet-300 transition-[width] duration-500" style={{ width: `${pct}%` }} /></div>
          <div className="text-white/50 text-[9.5px] mt-0.5">{users}/10 user pertama</div>
          {data.launch ? (
            <div className="mt-1.5"><b className="text-violet-200">Langkah {data.launch.idx + 1}/{data.launch.total}:</b> {clean(data.launch.text)}</div>
          ) : <div className="mt-1.5 text-white/60">Checklist peluncuran selesai. Prioritas harian kembali dipilih Alexander.</div>}
        </>
      )}
      <div className="mt-2 flex items-center gap-2 flex-wrap">
        <button className={BTN} disabled={running} onClick={run}>{running ? 'Menjalankan...' : 'Jalankan artefak hari ini'}</button>
        {msg ? <span className="text-white/60 text-[10px]">{msg}</span> : null}
      </div>
      {data.artifacts.length > 0 && (
        <div className="mt-2">
          <div className="text-[9px] font-bold uppercase tracking-wider text-violet-200/80 mb-1">Artefak terbaru semua karyawan</div>
          {data.artifacts.slice(0, 6).map((a) => <ArtifactItem key={a.id} a={a} />)}
        </div>
      )}
    </div>
  )
}
