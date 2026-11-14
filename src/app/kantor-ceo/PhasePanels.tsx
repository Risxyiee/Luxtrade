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

/** id ruangan dashboard → kunci role artefak (tim ramping 15-11) */
export const ROOM_ROLE: Record<string, string> = {
  CTO: 'cto', CSO: 'cso', CMO: 'cmo',
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

/* ============================================================
   LOOP BELAJAR (lib/ceo-loop.ts) — panel hasil rapat mingguan tim AI:
   keputusan taruhan (ACC/tolak oleh Bos), pelajaran terkumpul, sumber
   trafik 7 hari (dari /api/src-track), backlog produk Raka (ACC → issue
   GitHub), dan kill switch otonomi. Data: GET /api/ceo-agent?action=loop.
   ============================================================ */
export interface LoopDecision {
  id: string; week: string; owner: string; title: string; why: string; action: string
  type: string; autonomy: 'auto' | 'acc'; metric: string; target: number; evalOn: string
  status: 'proposed' | 'open' | 'evaluated' | 'dropped'
  progress?: number | null
  result?: { measured: number | null; verdict: string; lesson: string } | null
}
export interface LoopSnapshot {
  decisions: LoopDecision[]
  lessons: { at: string; id: string; verdict: string; text: string }[]
  sources: { src: string; visits: number; signups: number }[]
  backlog: { id: string; at: string; title: string; problem: string; evidence: string; change: string; acceptance: string[]; effort: string; status: string; issueUrl?: string }[]
  meeting: { at: string; week: string; summary: string; created?: string[]; evaluated?: string[] } | null
  autonomyOff: boolean
  githubReady: boolean
}

const LOOP_ROLE: Record<string, string> = {
  cmo: 'Sinta', cso: 'Maya', gh: 'Farhan', coo: 'Bagas', cto: 'Raka', ceo: 'Alexander', kevin: 'Kevin',
}
const STATUS_LABEL: Record<string, string> = {
  proposed: 'menunggu ACC Bos', open: 'berjalan', evaluated: 'sudah dievaluasi', dropped: 'dibuang',
}
const BTN_OK = 'font-[inherit] text-xs px-3 py-2 rounded-xl border border-emerald-300/30 bg-emerald-400/10 text-emerald-200 hover:bg-emerald-400/20 transition-colors cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed'
const BTN_NO = 'font-[inherit] text-xs px-3 py-2 rounded-xl border border-red-300/30 bg-red-400/10 text-red-200 hover:bg-red-400/20 transition-colors cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed'

export function LoopBelajarPanel() {
  const [data, setData] = useState<LoopSnapshot | null>(null)
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState('')
  const [msg, setMsg] = useState('')
  const [open, setOpen] = useState(false)
  const [manualVal, setManualVal] = useState<Record<string, string>>({})

  const reload = useCallback(async () => {
    setLoading(true)
    try {
      const js = await ownerFetch('action=loop')
      if (js && !js.error) setData(js as LoopSnapshot)
    } catch { /* panel tetap data lama */ } finally { setLoading(false) }
  }, [])
  useEffect(() => { void reload() }, [])

  const act = async (query: string, busyKey: string, okMsg?: string) => {
    setBusy(busyKey); setMsg('')
    try {
      const js = await ownerFetch(query)
      if (js?.error) setMsg(clean(js.error))
      else if (js?.ok === false) setMsg(clean(js.detail || js.note || 'gagal'))
      else setMsg(okMsg || clean(js?.note || 'Selesai.'))
      await reload()
    } catch { setMsg('Gagal menjalankan.') } finally { setBusy('') }
  }

  const decisions = (data?.decisions || []).filter((d) => d.status !== 'dropped')
  const proposed = decisions.filter((d) => d.status === 'proposed')
  const backlog = (data?.backlog || []).filter((b) => b.status === 'draft')

  return (
    <div className="rounded-2xl border border-white/10 bg-white/5 p-3">
      <button onClick={() => setOpen(!open)} aria-expanded={open} className="w-full flex items-center gap-2 text-left cursor-pointer hover:bg-white/5 rounded-xl transition-colors -m-1 p-1">
        <span className="min-w-0 flex-1">
          <span className="block text-[13px] font-bold text-teal-200">Loop Belajar Tim AI</span>
          <span className="block text-[10px] text-white/45">
            Rapat mingguan · taruhan bermetrik · pelajaran · backlog produk
            {data ? ` · ${proposed.length ? `${proposed.length} menunggu ACC` : 'tidak ada yang menunggu ACC'}` : ''}
          </span>
        </span>
        {loading ? <span className="text-[10px] text-white/40">memuat...</span> : null}
        <ChevronDown size={14} className={`text-white/35 shrink-0 transition-transform ${open ? 'rotate-180' : ''}`} aria-hidden="true" />
      </button>

      {open && (
        <div className="mt-2.5 max-h-96 overflow-y-auto kscroll pr-1 flex flex-col gap-2.5 text-[11px] leading-relaxed">
          {/* --- Aksi cepat --- */}
          <div className="flex items-center gap-2 flex-wrap">
            <button className={BTN} disabled={busy === 'meet'} onClick={() => act('action=meeting&force=1', 'meet', 'Rapat dijalankan — hasil lapor Discord.')}>{busy === 'meet' ? 'Menjalankan...' : 'Rapat sekarang'}</button>
            <button className={BTN} disabled={busy === 'prod'} onClick={() => act('action=product-review&force=1', 'prod', 'Review produk dijalankan — hasil lapor Discord.')}>{busy === 'prod' ? 'Menjalankan...' : 'Review produk sekarang'}</button>
            <button className={data?.autonomyOff ? BTN_OK : BTN_NO} disabled={busy === 'auto'} onClick={() => act(`action=autopilot&set=${data?.autonomyOff ? 'on' : 'off'}`, 'auto', data?.autonomyOff ? 'Otonomi dinyalakan.' : 'Otonomi dimatikan — semua keputusan wajib ACC.')}>
              {busy === 'auto' ? 'Menyimpan...' : data?.autonomyOff ? 'Nyalakan otonomi' : 'Matikan otonomi (kill switch)'}
            </button>
          </div>
          {msg ? <div className="text-white/60 text-[10.5px]">{msg}</div> : null}

          {/* --- Rapat terakhir --- */}
          {data?.meeting?.summary ? (
            <div className="rounded-xl border border-teal-300/20 bg-teal-400/10 px-2.5 py-2 text-teal-100/90">
              <b className="text-teal-200">Rapat minggu {clean(data.meeting.week)}</b> — {clean(data.meeting.summary)}
            </div>
          ) : <div className="text-white/40 text-[10.5px]">Belum ada rapat tersimpan — jalankan "Rapat sekarang" atau tunggu cron Senin 10:00 WIB.</div>}

          {/* --- Keputusan --- */}
          {decisions.length ? (
            <div>
              <div className="text-[9px] font-bold uppercase tracking-wider text-teal-300/80 mb-1">Keputusan taruhan mingguan</div>
              {decisions.slice(0, 6).map((d) => (
                <div key={d.id} className="rounded-xl border border-white/10 bg-black/20 px-2.5 py-2 mb-1.5">
                  <div className="flex items-center gap-2 flex-wrap">
                    <b className="text-white/90">{clean(d.title)}</b>
                    <span className="text-[9px] rounded-full px-1.5 py-0.5 bg-white/10 text-white/60">{LOOP_ROLE[d.owner] || d.owner}</span>
                    <span className="text-[9px] rounded-full px-1.5 py-0.5 bg-white/10 text-white/60">{STATUS_LABEL[d.status]}</span>
                    {d.autonomy === 'acc' && d.status === 'proposed' ? <span className="text-[9px] rounded-full px-1.5 py-0.5 bg-amber-400/15 text-amber-200">butuh ACC</span> : null}
                  </div>
                  <div className="text-white/60 mt-0.5">Aksi: {clean(d.action)}</div>
                  <div className="text-white/50 text-[10px]">
                    Metrik {clean(d.metric)} target {d.target} · evaluasi {clean(d.evalOn)}
                    {d.status === 'open' && typeof d.progress === 'number' ? ` · progres saat ini ${d.progress}` : ''}
                    {d.result ? ` · hasil ${d.result.verdict} (${d.result.measured ?? '?'}/${d.target})` : ''}
                  </div>
                  {d.status === 'proposed' ? (
                    <div className="mt-1.5 flex items-center gap-2 flex-wrap">
                      <button className={BTN_OK} disabled={busy === d.id} onClick={() => act(`action=dec-acc&id=${encodeURIComponent(d.id)}`, d.id, 'Keputusan di-ACC.')}>{busy === d.id ? '...' : 'ACC'}</button>
                      <button className={BTN_NO} disabled={busy === d.id} onClick={() => act(`action=dec-drop&id=${encodeURIComponent(d.id)}`, d.id, 'Keputusan ditolak.')}>Tolak</button>
                    </div>
                  ) : null}
                  {d.metric === 'manual' && d.status === 'open' ? (
                    <div className="mt-1.5 flex items-center gap-1.5 flex-wrap">
                      <input
                        aria-label={`Angka manual untuk ${clean(d.title)}`}
                        value={manualVal[d.id] || ''}
                        onChange={(e) => setManualVal((v) => ({ ...v, [d.id]: e.target.value.replace(/[^0-9]/g, '') }))}
                        inputMode="numeric"
                        placeholder="angka"
                        className="w-20 rounded-lg border border-white/15 bg-black/30 px-2 py-1.5 text-[11px] text-white/90 outline-none focus:border-teal-300/50"
                      />
                      <button className={BTN} disabled={busy === `m-${d.id}`} onClick={() => act(`action=manual-report&id=${encodeURIComponent(d.id)}&value=${manualVal[d.id] || '0'}`, `m-${d.id}`, 'Angka manual dicatat.')}>Lapor angka</button>
                    </div>
                  ) : null}
                </div>
              ))}
            </div>
          ) : <div className="text-white/40 text-[10.5px]">Belum ada keputusan taruhan.</div>}

          {/* --- Pelajaran --- */}
          {data?.lessons?.length ? (
            <div>
              <div className="text-[9px] font-bold uppercase tracking-wider text-teal-300/80 mb-1">Pelajaran tim</div>
              <ul className="list-disc pl-4 text-white/70 space-y-0.5">
                {data.lessons.slice(0, 5).map((l, i) => <li key={`${l.id}-${i}`}>[{clean(l.verdict)}] {clean(l.text)}</li>)}
              </ul>
            </div>
          ) : null}

          {/* --- Sumber trafik 7 hari --- */}
          <div>
            <div className="text-[9px] font-bold uppercase tracking-wider text-teal-300/80 mb-1">Sumber trafik 7 hari</div>
            {data?.sources?.length ? (
              <div className="text-white/70">
                {data.sources.slice(0, 6).map((s) => (
                  <div key={s.src} className="flex items-center justify-between gap-2 border-b border-white/5 py-1">
                    <span className="text-white/85">{clean(s.src)}</span>
                    <span className="text-white/50 text-[10px]">{s.visits} kunjungan · {s.signups} pendaftar</span>
                  </div>
                ))}
              </div>
            ) : <div className="text-white/40 text-[10.5px]">Belum ada data — beacon atribusi jalan saat ada pengunjung landing (?src= / utm_source).</div>}
          </div>

          {/* --- Backlog produk (Raka) --- */}
          <div>
            <div className="text-[9px] font-bold uppercase tracking-wider text-teal-300/80 mb-1">Backlog produk (Raka — ACC = issue GitHub)</div>
            {backlog.length ? backlog.slice(0, 4).map((b) => (
              <div key={b.id} className="rounded-xl border border-white/10 bg-black/20 px-2.5 py-2 mb-1.5">
                <div className="flex items-center gap-2 flex-wrap">
                  <b className="text-white/90">{clean(b.title)}</b>
                  <span className="text-[9px] rounded-full px-1.5 py-0.5 bg-white/10 text-white/60">effort {clean(b.effort)}</span>
                </div>
                <div className="text-white/55 text-[10px] mt-0.5">Bukti: {clean(b.evidence)}</div>
                <div className="mt-1.5 flex items-center gap-2 flex-wrap">
                  <button className={BTN_OK} disabled={busy === b.id || !data?.githubReady} onClick={() => act(`action=issue-create&id=${encodeURIComponent(b.id)}`, b.id, 'Issue GitHub dibuat.')}>{busy === b.id ? '...' : 'ACC — buat issue'}</button>
                  <button className={BTN_NO} disabled={busy === b.id} onClick={() => act(`action=issue-drop&id=${encodeURIComponent(b.id)}`, b.id, 'Draf dibuang.')}>Buang</button>
                  {!data?.githubReady ? <span className="text-amber-200/80 text-[9.5px]">set GITHUB_TOKEN (Issues: write) + GITHUB_REPO dulu</span> : null}
                </div>
              </div>
            )) : <div className="text-white/40 text-[10.5px]">Backlog kosong — jalankan "Review produk sekarang" atau tunggu cron Senin.</div>}
          </div>
        </div>
      )}
    </div>
  )
}
